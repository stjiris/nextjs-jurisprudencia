import crypto from "crypto";
import { getElasticSearchClient } from "./elasticsearch";
import { JurisprudenciaDocument, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { updateDoc } from "./doc";

const SYNC_SUBJECT_PREFIX = "[JURIS-SYNC]";
// The payload is base64'd and wrapped in these markers in the email body, so mail
// transforms (HTML conversion, entity encoding, appended disclaimers, line-wrapping)
// can't corrupt it — the receiver extracts exactly what's between the markers.
const SYNC_BODY_MARKER = "JURISSYNCv1:";
const SYNC_BODY_END = ":ENDJURISSYNC";
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
    if (syncImporting) {
        console.log(`[email-sync] Skipping outbound ${action} for UUID=${uuid} — currently importing from externo`);
        return;
    }
    const config = getMsConfig();
    const to = process.env.SYNC_MS_RECIPIENT || config.mailbox;
    const token = await getGraphToken(config.tenantId, config.clientId, config.clientSecret);
    const payload = buildSyncPayload(action, uuid, content);

    const payloadJson = JSON.stringify(payload);
    const emailBody = `${SYNC_BODY_MARKER}${Buffer.from(payloadJson, "utf-8").toString("base64")}${SYNC_BODY_END}`;

    console.log(`[email-sync] Sending ${action} UUID=${uuid} to=${to} — payload ${payloadJson.length} chars, body ${emailBody.length} chars. Payload preview: ${payloadJson.slice(0, 200)}`);

    const resp = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(config.mailbox)}/sendMail`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            message: {
                subject: `${SYNC_SUBJECT_PREFIX} ${action} ${uuid}`,
                body: { contentType: "Text", content: emailBody },
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

// --- Email body decoding ---

// Recovers the sync payload from an email body. The payload is base64 between
// SYNC_BODY_MARKER/SYNC_BODY_END; we strip any HTML/entities the mail system added,
// pull out the marked region, drop non-base64 chars (whitespace from line-wrapping),
// and decode. Falls back to a longest base64 run, then to plain JSON, so a one-sided
// deploy or an unmangled body still parses.
function decodeSyncBody(rawBody: string): SyncPayload | null {
    if (!rawBody) return null;
    const text = rawBody.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

    const tryParse = (s: string): SyncPayload | null => {
        try {
            const p = JSON.parse(s);
            return p && p.action && p.uuid && p.sig ? (p as SyncPayload) : null;
        } catch {
            return null;
        }
    };
    const fromBase64 = (b64: string): SyncPayload | null => {
        try {
            return tryParse(Buffer.from(b64.replace(/[^A-Za-z0-9+/=]/g, ""), "base64").toString("utf-8"));
        } catch {
            return null;
        }
    };

    // 1) Preferred: base64 between the markers.
    const s = text.indexOf(SYNC_BODY_MARKER);
    const e = s !== -1 ? text.indexOf(SYNC_BODY_END, s + 1) : -1;
    if (s !== -1 && e !== -1) {
        const p = fromBase64(text.slice(s + SYNC_BODY_MARKER.length, e));
        if (p) return p;
    }
    // 2) Marker lost: try the longest base64-looking run.
    const runs = text.match(/[A-Za-z0-9+/=]{40,}/g);
    if (runs) {
        for (const run of runs.sort((a, b) => b.length - a.length)) {
            const p = fromBase64(run);
            if (p) return p;
        }
    }
    // 3) Fallback: plain-JSON body (old format / unmangled).
    const js = text.indexOf("{");
    const je = text.lastIndexOf("}");
    if (js !== -1 && je > js) {
        const p = tryParse(text.slice(js, je + 1));
        if (p) return p;
    }
    return null;
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

        // Note: "[JURIS-SYNC-BACK]" also starts with "[JURIS-SYNC]", so the
        // sync-back check must come first — those emails belong to the interno
        // poller and must stay unread here.
        if (subject.startsWith(SYNC_BACK_SUBJECT_PREFIX)) {
            continue;
        }
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

        // Log the actual body (truncated) so the email contents are visible for debugging.
        console.log(`[email-sync] Received "${subject}" from=${fromAddress} bodyLen=${body.length}. Body preview: ${body.slice(0, 300)}`);

        const payload = decodeSyncBody(body);
        if (!payload) {
            console.warn(`[email-sync] Could not parse sync payload, skipping. Full body: ${body.slice(0, 1000)}`);
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

// ============================================================================
// Sync-back: externo → interno. Externo is the source of truth during the
// testing phase — it exports every document changed since the last export
// (tracked by _seq_no) in batched emails, and interno fully overwrites its
// copies on import. No conflict detection by design.
// ============================================================================

const SYNC_BACK_SUBJECT_PREFIX = "[JURIS-SYNC-BACK]";
const SYNC_META_INDEX = "juris-sync-meta";
const SYNC_META_DOC_ID = "sync-state";
// Graph API rejects requests around ~4MB; leave room for base64 (+33%) and envelope.
const SYNC_BACK_MAX_BATCH_JSON_BYTES = 2_500_000;
const SYNC_BACK_MAX_BATCH_DOCS = 100;

interface SyncBackPayload {
    action: "bulk-sync";
    batchIndex: number;
    batchTotal: number;
    ts: number;
    documents: Record<string, any>[];
    sig: string;
}

// While interno is applying an imported batch, outbound sync emails are
// suppressed so the overwrite can't echo back to externo.
let syncImporting = false;
export function isSyncImporting(): boolean {
    return syncImporting;
}

function computeSyncBackSig(secret: string, batchIndex: number, batchTotal: number, ts: number, documents: Record<string, any>[]): string {
    const documentsHash = crypto.createHash("sha256").update(JSON.stringify(documents)).digest("hex");
    const data = JSON.stringify({ action: "bulk-sync", batchIndex, batchTotal, ts, documentsHash });
    return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function buildSyncBackPayload(batchIndex: number, batchTotal: number, documents: Record<string, any>[]): SyncBackPayload {
    const secret = process.env.SYNC_SECRET;
    if (!secret) throw new Error("SYNC_SECRET not configured");
    const ts = Date.now();
    const sig = computeSyncBackSig(secret, batchIndex, batchTotal, ts, documents);
    return { action: "bulk-sync", batchIndex, batchTotal, ts, documents, sig };
}

function verifySyncBackPayload(payload: SyncBackPayload): boolean {
    const secret = process.env.SYNC_SECRET;
    if (!secret) {
        console.error("[email-sync-back] SYNC_SECRET not configured, cannot verify payload");
        return false;
    }
    if (Date.now() - payload.ts > 86_400_000) {
        console.warn("[email-sync-back] Payload expired (>24h old)");
        return false;
    }
    const expected = computeSyncBackSig(secret, payload.batchIndex, payload.batchTotal, payload.ts, payload.documents);
    try {
        return crypto.timingSafeEqual(Buffer.from(payload.sig, "hex"), Buffer.from(expected, "hex"));
    } catch {
        return false;
    }
}

function decodeSyncBackBody(rawBody: string): SyncBackPayload | null {
    if (!rawBody) return null;
    const text = rawBody.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

    const tryParse = (s: string): SyncBackPayload | null => {
        try {
            const p = JSON.parse(s);
            return p && p.action === "bulk-sync" && Array.isArray(p.documents) && p.sig ? (p as SyncBackPayload) : null;
        } catch {
            return null;
        }
    };
    const fromBase64 = (b64: string): SyncBackPayload | null => {
        try {
            return tryParse(Buffer.from(b64.replace(/[^A-Za-z0-9+/=]/g, ""), "base64").toString("utf-8"));
        } catch {
            return null;
        }
    };

    const s = text.indexOf(SYNC_BODY_MARKER);
    const e = s !== -1 ? text.indexOf(SYNC_BODY_END, s + 1) : -1;
    if (s !== -1 && e !== -1) {
        const p = fromBase64(text.slice(s + SYNC_BODY_MARKER.length, e));
        if (p) return p;
    }
    const runs = text.match(/[A-Za-z0-9+/=]{40,}/g);
    if (runs) {
        for (const run of runs.sort((a, b) => b.length - a.length)) {
            const p = fromBase64(run);
            if (p) return p;
        }
    }
    return null;
}

// --- Sync state (last exported _seq_no) ---

async function readLastSyncSeqNo(): Promise<number> {
    const client = await getElasticSearchClient();
    try {
        const doc = await client.get<{ lastSyncSeqNo: number }>({ index: SYNC_META_INDEX, id: SYNC_META_DOC_ID });
        return doc._source?.lastSyncSeqNo ?? -1;
    } catch {
        return -1;
    }
}

export async function writeLastSyncSeqNo(seqNo: number): Promise<void> {
    const client = await getElasticSearchClient();
    await client.index({
        index: SYNC_META_INDEX,
        id: SYNC_META_DOC_ID,
        document: { lastSyncSeqNo: seqNo, lastSyncTimestamp: new Date().toISOString() },
    });
}

// --- Externo: export ---

async function sendSyncBackEmail(batchIndex: number, batchTotal: number, documents: Record<string, any>[]): Promise<void> {
    const config = getMsConfig();
    const to = process.env.SYNC_MS_RECIPIENT || config.mailbox;
    const token = await getGraphToken(config.tenantId, config.clientId, config.clientSecret);
    const payload = buildSyncBackPayload(batchIndex, batchTotal, documents);

    const payloadJson = JSON.stringify(payload);
    const emailBody = `${SYNC_BODY_MARKER}${Buffer.from(payloadJson, "utf-8").toString("base64")}${SYNC_BODY_END}`;

    const resp = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(config.mailbox)}/sendMail`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            message: {
                subject: `${SYNC_BACK_SUBJECT_PREFIX} batch ${batchIndex + 1}/${batchTotal} (${documents.length} docs)`,
                body: { contentType: "Text", content: emailBody },
                toRecipients: [{ emailAddress: { address: to } }],
            },
            saveToSentItems: false,
        }),
    });

    if (!resp.ok) {
        throw new Error(`MS Graph sendMail failed for sync-back batch ${batchIndex + 1}/${batchTotal} (${resp.status}): ${await resp.text()}`);
    }
    console.log(`[email-sync-back] Sent batch ${batchIndex + 1}/${batchTotal} with ${documents.length} documents`);
}

export async function sendBulkSyncEmails(): Promise<{ sent: number; documents: number; maxSeqNo: number }> {
    const client = await getElasticSearchClient();
    const lastSeqNo = await readLastSyncSeqNo();
    console.log(`[email-sync-back] Export starting — documents with _seq_no > ${lastSeqNo}`);

    // Collect changed docs, batching by serialized size so each email stays
    // under the Graph API request limit.
    const batches: Record<string, any>[][] = [];
    let current: Record<string, any>[] = [];
    let currentBytes = 0;
    let maxSeqNo = lastSeqNo;
    let totalDocs = 0;
    let searchAfter: any[] | undefined = undefined;

    for (;;) {
        const page: any = await client.search({
            index: JurisprudenciaVersion,
            query: { range: { _seq_no: { gt: lastSeqNo } } },
            sort: [{ _seq_no: "asc" }],
            seq_no_primary_term: true,
            size: 200,
            ...(searchAfter ? { search_after: searchAfter } : {}),
        });
        const hits = page.hits.hits;
        if (hits.length === 0) break;

        for (const hit of hits) {
            if (!hit._source) continue;
            const docBytes = JSON.stringify(hit._source).length;
            if (current.length > 0 && (currentBytes + docBytes > SYNC_BACK_MAX_BATCH_JSON_BYTES || current.length >= SYNC_BACK_MAX_BATCH_DOCS)) {
                batches.push(current);
                current = [];
                currentBytes = 0;
            }
            current.push(hit._source);
            currentBytes += docBytes;
            totalDocs++;
            if (typeof hit._seq_no === "number" && hit._seq_no > maxSeqNo) maxSeqNo = hit._seq_no;
        }
        searchAfter = hits[hits.length - 1].sort;
    }
    if (current.length > 0) batches.push(current);

    if (batches.length === 0) {
        console.log("[email-sync-back] Nothing to export");
        return { sent: 0, documents: 0, maxSeqNo: lastSeqNo };
    }

    for (let i = 0; i < batches.length; i++) {
        await sendSyncBackEmail(i, batches.length, batches[i]);
    }

    await writeLastSyncSeqNo(maxSeqNo);
    console.log(`[email-sync-back] Export complete: ${batches.length} emails, ${totalDocs} documents, maxSeqNo=${maxSeqNo}`);
    return { sent: batches.length, documents: totalDocs, maxSeqNo };
}

// --- Interno: import ---

async function applyBulkSync(documents: Record<string, any>[]): Promise<{ upserted: number; created: number }> {
    const client = await getElasticSearchClient();
    let upserted = 0;
    let created = 0;
    for (const doc of documents) {
        const uuid = doc.UUID;
        if (!uuid) {
            console.warn("[email-sync-back] Document without UUID in batch, skipping");
            continue;
        }
        // Externo is the source of truth: full overwrite, always público.
        const finalDoc = { ...doc, STATE: "público" };
        const existingId = await findDocIdByUUID(uuid);
        if (existingId) {
            await client.index({ index: JurisprudenciaVersion, id: existingId, document: finalDoc });
            upserted++;
        } else {
            await client.index({ index: JurisprudenciaVersion, document: finalDoc });
            created++;
        }
    }
    return { upserted, created };
}

export async function pollAndProcessBackSyncEmails(): Promise<{ processed: number; documents: number; errors: number }> {
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
    let documents = 0;
    let errors = 0;

    const markRead = (msgId: string) =>
        fetch(`${mailboxBase}/messages/${msgId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ isRead: true }),
        });

    syncImporting = true;
    try {
        for (const msg of messages) {
            const subject: string = msg.subject || "";
            const fromAddress: string = msg.from?.emailAddress?.address || "";

            if (!subject.startsWith(SYNC_BACK_SUBJECT_PREFIX)) continue;

            if (trustedFrom && fromAddress.toLowerCase() !== trustedFrom.toLowerCase()) {
                console.warn(`[email-sync-back] Ignoring email from untrusted sender: ${fromAddress}`);
                await markRead(msg.id);
                continue;
            }

            const body: string = msg.body?.content?.trim() || "";
            const payload = body ? decodeSyncBackBody(body) : null;
            if (!payload) {
                console.warn(`[email-sync-back] Could not parse payload for "${subject}", skipping`);
                await markRead(msg.id);
                continue;
            }

            if (!verifySyncBackPayload(payload)) {
                console.warn(`[email-sync-back] Invalid or expired signature for subject: ${subject}`);
                await markRead(msg.id);
                errors++;
                continue;
            }

            try {
                const { upserted, created } = await applyBulkSync(payload.documents);
                console.log(`[email-sync-back] Applied batch ${payload.batchIndex + 1}/${payload.batchTotal}: ${upserted} overwritten, ${created} created`);
                processed++;
                documents += payload.documents.length;
            } catch (err) {
                console.error(`[email-sync-back] Failed to apply batch ${payload.batchIndex + 1}/${payload.batchTotal}:`, err);
                errors++;
            }

            await markRead(msg.id);
        }
    } finally {
        syncImporting = false;
    }

    if (processed > 0 || errors > 0) {
        console.log(`[email-sync-back] Poll complete: ${processed} batches, ${documents} documents, ${errors} errors`);
    }
    return { processed, documents, errors };
}
