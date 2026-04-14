import crypto from "crypto";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getElasticSearchClient } from "./elasticsearch";
import { JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { updateDoc } from "./doc";

const SYNC_SUBJECT_PREFIX = "[JURIS-SYNC]";

export type SyncAction = "publicar" | "tornar-privado" | "editar";

interface SyncPayload {
    action: SyncAction;
    uuid: string;
    ts: number;
    content?: Record<string, any>; // only for "editar"
    sig: string;
}

// --- Signature helpers ---

function computeSig(secret: string, action: SyncAction, uuid: string, ts: number, content?: Record<string, any>): string {
    const contentHash = content
        ? crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex")
        : undefined;
    const data = JSON.stringify({ action, uuid, ts, ...(contentHash ? { contentHash } : {}) });
    return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function buildSyncPayload(action: SyncAction, uuid: string, content?: Record<string, any>): SyncPayload {
    const secret = process.env.SYNC_SECRET;
    if (!secret) throw new Error("SYNC_SECRET not configured");
    const ts = Date.now();
    const sig = computeSig(secret, action, uuid, ts, content);
    return { action, uuid, ts, ...(content ? { content } : {}), sig };
}

function verifySyncPayload(payload: SyncPayload): boolean {
    const secret = process.env.SYNC_SECRET;
    if (!secret) {
        console.error("[email-sync] SYNC_SECRET not configured, cannot verify payload");
        return false;
    }
    const { action, uuid, ts, content, sig } = payload;
    // Reject emails older than 24 hours (to handle polling delays)
    if (Date.now() - ts > 86_400_000) {
        console.warn("[email-sync] Payload expired (>24h old)");
        return false;
    }
    const expected = computeSig(secret, action, uuid, ts, content);
    try {
        return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
    } catch {
        return false;
    }
}

// --- SMTP: sending ---

async function sendSyncEmailInternal(action: SyncAction, uuid: string, content?: Record<string, any>): Promise<void> {
    const host = process.env.SYNC_SMTP_HOST;
    const port = parseInt(process.env.SYNC_SMTP_PORT || "587");
    const secure = process.env.SYNC_SMTP_SECURE === "true";
    const user = process.env.SYNC_SMTP_USER;
    const pass = process.env.SYNC_SMTP_PASS;
    const from = process.env.SYNC_SMTP_FROM;
    const to = process.env.SYNC_SMTP_TO;

    if (!host || !user || !pass || !from || !to) {
        throw new Error("Missing SMTP configuration (SYNC_SMTP_HOST, SYNC_SMTP_USER, SYNC_SMTP_PASS, SYNC_SMTP_FROM, SYNC_SMTP_TO)");
    }

    const payload = buildSyncPayload(action, uuid, content);

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
    });

    await transporter.sendMail({
        from,
        to,
        subject: `${SYNC_SUBJECT_PREFIX} ${action} ${uuid}`,
        text: JSON.stringify(payload),
        headers: { "X-Juris-Sync": "1" },
    });

    console.log(`[email-sync] Sent ${action} for UUID ${uuid} to ${to}`);
}

export async function sendSyncEmail(action: "publicar" | "tornar-privado", uuid: string): Promise<void> {
    return sendSyncEmailInternal(action, uuid);
}

export async function sendSyncEditEmail(uuid: string, content: Record<string, any>): Promise<void> {
    return sendSyncEmailInternal("editar", uuid, content);
}

// --- Elasticsearch: find doc by UUID ---

async function findDocIdByUUID(uuid: string): Promise<string | null> {
    const client = await getElasticSearchClient();
    const result = await client.search({
        index: JurisprudenciaVersion,
        query: { term: { UUID: uuid } },
        size: 1,
        _source: false,
    });
    const hit = result.hits.hits[0];
    return hit?._id ?? null;
}

// --- Apply action on external deployment ---

async function applyAction(action: SyncAction, uuid: string, content?: Record<string, any>): Promise<boolean> {
    const docId = await findDocIdByUUID(uuid);
    if (!docId) {
        console.warn(`[email-sync] Document with UUID ${uuid} not found in this deployment, skipping`);
        return false;
    }

    if (action === "editar") {
        if (!content) {
            console.warn(`[email-sync] editar action missing content for UUID ${uuid}`);
            return false;
        }
        await updateDoc(docId, content);
        console.log(`[email-sync] Applied editar to UUID=${uuid} (id=${docId})`);
    } else {
        const newState = action === "publicar" ? "público" : "privado";
        await updateDoc(docId, { STATE: newState });
        console.log(`[email-sync] Applied action=${action} (STATE=${newState}) to UUID=${uuid} (id=${docId})`);
    }
    return true;
}

// --- IMAP: polling ---

export async function pollAndProcessSyncEmails(): Promise<{ processed: number; errors: number }> {
    const host = process.env.SYNC_IMAP_HOST;
    const port = parseInt(process.env.SYNC_IMAP_PORT || "993");
    const secure = process.env.SYNC_IMAP_SECURE !== "false"; // default true
    const user = process.env.SYNC_IMAP_USER;
    const pass = process.env.SYNC_IMAP_PASS;
    const trustedFrom = process.env.SYNC_IMAP_TRUSTED_FROM;

    if (!host || !user || !pass) {
        throw new Error("Missing IMAP configuration (SYNC_IMAP_HOST, SYNC_IMAP_USER, SYNC_IMAP_PASS)");
    }

    const imapClient = new ImapFlow({
        host,
        port,
        secure,
        auth: { user, pass },
        logger: false,
    });

    await imapClient.connect();

    let processed = 0;
    let errors = 0;

    try {
        const lock = await imapClient.getMailboxLock("INBOX");
        try {
            // Collect all unseen message UIDs first (iterating while modifying flags can cause issues)
            const messages: { uid: number; envelope: any; source: Buffer }[] = [];

            for await (const msg of imapClient.fetch({ seen: false }, { envelope: true, source: true, uid: true })) {
                if (msg.source) messages.push({ uid: msg.uid, envelope: msg.envelope, source: msg.source });
            }

            for (const msg of messages) {
                const subject: string = msg.envelope.subject || "";

                // Only process JURIS-SYNC emails
                if (!subject.startsWith(SYNC_SUBJECT_PREFIX)) {
                    continue;
                }

                // Verify trusted sender
                const fromAddress: string = msg.envelope.from?.[0]?.address || "";
                if (trustedFrom && fromAddress.toLowerCase() !== trustedFrom.toLowerCase()) {
                    console.warn(`[email-sync] Ignoring email from untrusted sender: ${fromAddress}`);
                    await imapClient.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
                    continue;
                }

                // Parse email body
                let body: string | undefined;
                try {
                    const parsed = await simpleParser(msg.source);
                    body = parsed.text?.trim();
                } catch (parseErr) {
                    console.error("[email-sync] Failed to parse email:", parseErr);
                    await imapClient.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
                    errors++;
                    continue;
                }

                if (!body) {
                    console.warn("[email-sync] Empty email body, skipping");
                    await imapClient.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
                    continue;
                }

                // Parse JSON payload
                let payload: SyncPayload;
                try {
                    payload = JSON.parse(body);
                } catch {
                    console.warn("[email-sync] Non-JSON email body, skipping");
                    await imapClient.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
                    continue;
                }

                // Verify signature
                if (!verifySyncPayload(payload)) {
                    console.warn(`[email-sync] Invalid or expired signature for email with subject: ${subject}`);
                    await imapClient.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
                    errors++;
                    continue;
                }

                // Apply the action
                try {
                    const ok = await applyAction(payload.action, payload.uuid, payload.content);
                    if (ok) processed++;
                } catch (actionErr) {
                    console.error(`[email-sync] Failed to apply action ${payload.action} for UUID ${payload.uuid}:`, actionErr);
                    errors++;
                }

                // Always mark as read so we don't reprocess
                await imapClient.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
            }
        } finally {
            lock.release();
        }
    } finally {
        await imapClient.logout();
    }

    console.log(`[email-sync] Poll complete: ${processed} processed, ${errors} errors`);
    return { processed, errors };
}
