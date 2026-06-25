import crypto from "crypto";
import { getElasticSearchClient } from "./elasticsearch";
import { JurisprudenciaDocument, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { updateDoc } from "./doc";

const SYNC_SUBJECT_PREFIX = "[JURIS-SYNC]";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export type SyncAction = "publicar" | "tornar-privado" | "editar";

interface SyncPayload {
    action: SyncAction;
    uuid: string;
    ts: number;
    content?: Record<string, any>;
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

// --- Microsoft Graph auth ---

let cachedToken: { token: string; expiresAt: number } | null = null;

function getMsConfig() {
    const envOrFail = (name: string) => {
        const v = process.env[name];
        if (!v) throw new Error(`Missing environment variable ${name}`);
        return v;
    };
    return {
        tenantId: envOrFail("SYNC_MS_TENANT_ID"),
        clientId: envOrFail("SYNC_MS_CLIENT_ID"),
        clientSecret: envOrFail("SYNC_MS_CLIENT_SECRET"),
        mailbox: envOrFail("SYNC_MS_MAILBOX"),
    };
}

async function getGraphToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
        return cachedToken.token;
    }
    const resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            scope: "https://graph.microsoft.com/.default",
        }),
    });
    if (!resp.ok) {
        throw new Error(`Failed to obtain MS Graph token (${resp.status}): ${await resp.text()}`);
    }
    const data = await resp.json();
    cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return cachedToken.token;
}

// --- Graph API: sending ---

async function sendSyncEmailInternal(action: SyncAction, uuid: string, content?: Record<string, any>): Promise<void> {
    const config = getMsConfig();
    const to = process.env.SYNC_MS_RECIPIENT || config.mailbox;
    const token = await getGraphToken(config.tenantId, config.clientId, config.clientSecret);
    const payload = buildSyncPayload(action, uuid, content);

    const resp = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(config.mailbox)}/sendMail`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            message: {
                subject: `${SYNC_SUBJECT_PREFIX} ${action} ${uuid}`,
                body: { contentType: "Text", content: JSON.stringify(payload) },
                toRecipients: [{ emailAddress: { address: to } }],
            },
            saveToSentItems: false,
        }),
    });

    if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[email-sync] sendMail failed — mailbox=${config.mailbox} to=${to} action=${action} uuid=${uuid}`);
        throw new Error(`MS Graph sendMail failed (${resp.status}): ${errText}`);
    }

    console.log(`[email-sync] Sent ${action} for UUID ${uuid} to ${to}`);
}

export async function sendSyncEmail(action: "tornar-privado", uuid: string): Promise<void>;
export async function sendSyncEmail(action: "publicar", uuid: string, content: Record<string, any>): Promise<void>;
export async function sendSyncEmail(action: "publicar" | "tornar-privado", uuid: string, content?: Record<string, any>): Promise<void> {
    return sendSyncEmailInternal(action, uuid, content);
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
    const client = await getElasticSearchClient();
    const docId = await findDocIdByUUID(uuid);

    if (action === "publicar") {
        if (!docId) {
            if (!content) {
                console.warn(`[email-sync] publicar for unknown UUID ${uuid} has no content, cannot create`);
                return false;
            }
            const doc = { ...content, STATE: "público" } as JurisprudenciaDocument;
            await client.index({ index: JurisprudenciaVersion, document: doc, refresh: "wait_for" });
            console.log(`[email-sync] Created document for UUID=${uuid} via publicar sync`);
        } else {
            await updateDoc(docId, { STATE: "público" });
            console.log(`[email-sync] Updated STATE=público for UUID=${uuid} (id=${docId})`);
        }
        return true;
    }

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
        await updateDoc(docId, { STATE: "privado" });
        console.log(`[email-sync] Applied tornar-privado to UUID=${uuid} (id=${docId})`);
    }
    return true;
}

// --- Graph API: polling ---

export async function pollAndProcessSyncEmails(): Promise<{ processed: number; errors: number }> {
    const config = getMsConfig();
    const trustedFrom = process.env.SYNC_MS_TRUSTED_FROM || config.mailbox;
    const token = await getGraphToken(config.tenantId, config.clientId, config.clientSecret);

    const mailboxBase = `${GRAPH_BASE}/users/${encodeURIComponent(config.mailbox)}`;

    const resp = await fetch(
        `${mailboxBase}/mailFolders/Inbox/messages?$filter=isRead eq false&$select=id,subject,from,body&$top=50`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Prefer: 'outlook.body-content-type="text"',
            },
        }
    );
    if (!resp.ok) {
        throw new Error(`Failed to fetch inbox messages (${resp.status}): ${await resp.text()}`);
    }
    const { value: messages } = await resp.json();

    let processed = 0;
    let errors = 0;

    const markRead = (msgId: string) =>
        fetch(`${mailboxBase}/messages/${msgId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ isRead: true }),
        });

    for (const msg of messages) {
        const subject: string = msg.subject || "";
        const fromAddress: string = msg.from?.emailAddress?.address || "";

        if (!subject.startsWith(SYNC_SUBJECT_PREFIX)) {
            // Not a sync email — leave unread for the mailbox owner
            continue;
        }

        if (trustedFrom && fromAddress.toLowerCase() !== trustedFrom.toLowerCase()) {
            console.warn(`[email-sync] Ignoring email from untrusted sender: ${fromAddress}`);
            await markRead(msg.id);
            continue;
        }

        const body: string = msg.body?.content?.trim() || "";
        if (!body) {
            console.warn("[email-sync] Empty email body, skipping");
            await markRead(msg.id);
            continue;
        }

        let payload: SyncPayload;
        try {
            payload = JSON.parse(body);
        } catch {
            console.warn("[email-sync] Non-JSON email body, skipping");
            await markRead(msg.id);
            continue;
        }

        if (!verifySyncPayload(payload)) {
            console.warn(`[email-sync] Invalid or expired signature for subject: ${subject}`);
            await markRead(msg.id);
            errors++;
            continue;
        }

        try {
            const ok = await applyAction(payload.action, payload.uuid, payload.content);
            if (ok) processed++;
        } catch (actionErr) {
            console.error(`[email-sync] Failed to apply action ${payload.action} for UUID ${payload.uuid}:`, actionErr);
            errors++;
        }

        await markRead(msg.id);
    }

    if (processed > 0 || errors > 0) {
        console.log(`[email-sync] Poll complete: ${processed} processed, ${errors} errors`);
    }
    return { processed, errors };
}
