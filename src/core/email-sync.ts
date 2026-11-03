import crypto from "crypto";
import { getElasticSearchClient } from "./elasticsearch";
import { JurisprudenciaDocument, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { updateDoc } from "./doc";
import { mergeSyncDoc, moveAdoptedFolder, planSyncDoc, reviewEntry, SYNC_REVIEW_INDEX } from "./sync-merge.mjs";

const SYNC_SUBJECT_PREFIX = "[JURIS-SYNC]";
const SYNC_REQUEST_SUBJECT_PREFIX = "[JURIS-SYNC-REQUEST]";
// Sentinel UUID for the empty pull-request payload — non-empty so decodeSyncBody's
// truthiness check passes and the HMAC stays consistent with the single-doc format.
const SYNC_REQUEST_UUID = "__sync_request__";
// The payload is base64'd and wrapped in these markers in the email body, so mail
// transforms (HTML conversion, entity encoding, appended disclaimers, line-wrapping)
// can't corrupt it — the receiver extracts exactly what's between the markers.
const SYNC_BODY_MARKER = "JURISSYNCv1:";
const SYNC_BODY_END = ":ENDJURISSYNC";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// "sync-doc" carries one full document externo→interno (see sync-merge.mjs).
// "sync-request" is an empty interno→externo signal asking externo to run its export.
export type SyncAction = "publicar" | "tornar-privado" | "editar" | "sync-doc" | "sync-request";

interface SyncPayload {
    action: SyncAction;
    uuid: string;
    ts: number;
    content?: Record<string, any>;
    sig: string;
}

// Fields holding the ORIGINAL, non-anonimized text. These must never reach the
// público (externo) deployment — not over the shared mailbox, not into externo's
// index. Same set the public document page already gates behind authentication.
const NON_ANON_FIELDS = ["Texto Não Anonimizado", "Sumário Não Anonimizado"] as const;

// Only DGSI documents carry a CONTENT that is safe for externo (scraped from the
// public DGSI site). See stripNonAnon.
const PUBLIC_CONTENT_FONTE = "STJ (DGSI)";

// Return a shallow copy of the content safe to send to / store on externo: the
// non-anonimized text fields removed, and CONTENT removed unless it comes from DGSI.
// CONTENT is a flat bag of the document's raw text — for SharePoint and manually
// created docs it can hold the original, pre-anonimization text (names and all), so
// it must not reach the público index. For DGSI docs CONTENT is public and feeds
// público full-text search, so it is kept.
function stripNonAnon<T extends Record<string, any>>(content: T): T {
    const clone: Record<string, any> = { ...content };
    for (const field of NON_ANON_FIELDS) delete clone[field];
    if (clone.Fonte !== PUBLIC_CONTENT_FONTE) delete clone.CONTENT;
    return clone as T;
}

// Optional CC copied on every sync email, as a running log of what crossed the
// mailbox. Safe because nothing on the sync bus carries non-anonimized content:
// interno→externo is stripped by stripNonAnon, and externo→interno originates on
// externo, which never held it. Set SYNC_MS_CC to enable; empty = no CC.
function ccRecipients(): { emailAddress: { address: string } }[] {
    return (process.env.SYNC_MS_CC || "")
        .split(",")
        .map(a => a.trim())
        .filter(a => a.length > 0)
        .map(address => ({ emailAddress: { address } }));
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
    // interno→externo: the público deployment must never receive the non-anonimized
    // text, so strip it before it ever enters the (shared) mailbox.
    const safeContent = content ? stripNonAnon(content) : content;
    const payload = buildSyncPayload(action, uuid, safeContent);

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
                ccRecipients: ccRecipients(),
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

// --- Apply a document from externo on interno ---

async function applySyncDoc(uuid: string, content: Record<string, any>): Promise<boolean> {
    const client = await getElasticSearchClient();
    const processo = content["Número de Processo"];
    const toHit = (h: any) => ({ id: h._id as string, source: h._source as Record<string, any> });

    const uuidResult = await client.search<Record<string, any>>({
        index: JurisprudenciaVersion,
        query: { term: { UUID: uuid } },
        size: 1,
    });
    const processResult = processo
        ? await client.search<Record<string, any>>({
            index: JurisprudenciaVersion,
            query: { term: { "Número de Processo": processo } },
            size: 50,
        })
        : null;
    const uuidHit = uuidResult.hits.hits[0] ? toHit(uuidResult.hits.hits[0]) : null;
    const processHits = (processResult?.hits.hits ?? []).map(toHit);

    const plan = planSyncDoc(content, uuidHit, processHits);

    if (plan.action === "hold" || plan.possibleDuplicate) {
        await client.index({ index: SYNC_REVIEW_INDEX, id: uuid, document: reviewEntry(content, uuid, plan, processHits) });
    }
    if (plan.action === "hold") {
        console.warn(`[email-sync-back] Held UUID=${uuid} for review: ${plan.reason}`);
        return true;
    }

    const existing = plan.target?.source;
    const doc = mergeSyncDoc(content, existing) as JurisprudenciaDocument;
    if (plan.target) {
        await client.index({ index: JurisprudenciaVersion, id: plan.target.id, document: doc });
        console.log(`[email-sync-back] ${plan.action} UUID=${uuid} (id=${plan.target.id})`);
    } else {
        await client.index({ index: JurisprudenciaVersion, document: doc });
        console.log(`[email-sync-back] Created UUID=${uuid}`);
    }

    if (plan.action === "adopt") {
        // The document is already saved, so a folder problem must not fail the import.
        try {
            const lib = await import("@stjiris/filesystem-lib");
            console.log(`[email-sync-back] Folder for UUID=${uuid}: ${moveAdoptedFolder(lib, existing, doc)}`);
        } catch (err) {
            console.error(`[email-sync-back] Could not move the folder for UUID=${uuid}:`, err);
        }
    }
    return true;
}

// --- Apply action on external deployment ---

async function applyAction(action: SyncAction, uuid: string, content?: Record<string, any>): Promise<boolean> {
    const client = await getElasticSearchClient();
    const docId = await findDocIdByUUID(uuid);

    // Defense in depth: an interno→externo action must never write the non-anonimized
    // text into the público index, even if an out-of-date interno still sends it.
    // sync-doc is externo→interno, where interno legitimately holds its own text.
    if (content && action !== "sync-doc") {
        content = stripNonAnon(content);
    }

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

    // sync-doc (externo→interno): see sync-merge.mjs for the matching and merge rules.
    if (action === "sync-doc") {
        if (!content) {
            console.warn(`[email-sync-back] sync-doc for UUID ${uuid} has no content, skipping`);
            return false;
        }
        return applySyncDoc(uuid, content);
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
    } else if (action === "tornar-privado") {
        await updateDoc(docId, { STATE: "privado" });
        console.log(`[email-sync] Applied tornar-privado to UUID=${uuid} (id=${docId})`);
    } else {
        console.warn(`[email-sync] Unhandled action "${action}" for UUID ${uuid}`);
        return false;
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

        // Pull request from interno: verify it, then run the export in-process.
        // "[JURIS-SYNC-REQUEST]" does not start with "[JURIS-SYNC]" (the bracket
        // differs), so it must be handled explicitly before the bare-prefix check.
        if (subject.startsWith(SYNC_REQUEST_SUBJECT_PREFIX)) {
            if (trustedFrom && fromAddress.toLowerCase() !== trustedFrom.toLowerCase()) {
                console.warn(`[email-sync] Ignoring sync-request from untrusted sender: ${fromAddress}`);
                await markRead(msg.id);
                continue;
            }
            const reqPayload = decodeSyncBody(msg.body?.content?.trim() || "");
            if (!reqPayload || !verifySyncPayload(reqPayload) || reqPayload.action !== "sync-request") {
                console.warn(`[email-sync] Invalid sync-request, ignoring: ${subject}`);
                await markRead(msg.id);
                errors++;
                continue;
            }
            await markRead(msg.id);
            try {
                console.log("[email-sync] Received sync-request from interno — running export");
                const r = await sendBulkSyncEmails();
                console.log(`[email-sync] sync-request export: sent ${r.sent} document email(s)`);
                processed++;
            } catch (err) {
                console.error("[email-sync] sync-request export failed:", err);
                errors++;
            }
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
// (tracked by _seq_no) as ONE email per document, and interno applies it per
// sync-merge.mjs: externo wins except for interno-only data. Reuses the single-doc
// SyncPayload machinery (buildSyncPayload / decodeSyncBody / verifySyncPayload /
// applyAction) with action "sync-doc".
// ============================================================================

const SYNC_BACK_SUBJECT_PREFIX = "[JURIS-SYNC-BACK]";
const SYNC_META_INDEX = "juris-sync-meta";
const SYNC_META_DOC_ID = "sync-state";
// Email carries incremental deltas only. If more than this many documents changed
// since the last export (e.g. the bookmark was never set, so the whole corpus
// qualifies), refuse rather than flood the mailbox — that load goes via an ES
// snapshot instead.
const SYNC_BACK_MAX_DELTA = 1000;

// While interno is applying imported documents, outbound sync emails are
// suppressed so the overwrite can't echo back to externo.
let syncImporting = false;
export function isSyncImporting(): boolean {
    return syncImporting;
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

// --- Shared mailer: one signed SyncPayload per email, with Graph 429 backoff ---

async function sendSignedMail(subject: string, payload: SyncPayload): Promise<void> {
    const config = getMsConfig();
    const to = process.env.SYNC_MS_RECIPIENT || config.mailbox;
    const token = await getGraphToken(config.tenantId, config.clientId, config.clientSecret);
    const emailBody = `${SYNC_BODY_MARKER}${Buffer.from(JSON.stringify(payload), "utf-8").toString("base64")}${SYNC_BODY_END}`;
    const requestBody = JSON.stringify({
        message: {
            subject,
            body: { contentType: "Text", content: emailBody },
            toRecipients: [{ emailAddress: { address: to } }],
            ccRecipients: ccRecipients(),
        },
        saveToSentItems: false,
    });

    // Graph throttles sendMail by message rate and total bytes; on 429 it returns
    // a Retry-After. Honour it (capped) and retry a few times before giving up.
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const resp = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(config.mailbox)}/sendMail`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: requestBody,
        });
        if (resp.ok) return;
        if (resp.status === 429 && attempt < maxAttempts) {
            const retryAfter = parseInt(resp.headers.get("Retry-After") || "", 10);
            const waitMs = Math.min(Number.isFinite(retryAfter) ? retryAfter * 1000 : attempt * 30_000, 120_000);
            console.warn(`[email-sync-back] Throttled on "${subject}" (attempt ${attempt}/${maxAttempts}), waiting ${Math.round(waitMs / 1000)}s`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
        }
        throw new Error(`MS Graph sendMail failed for "${subject}" (${resp.status}): ${await resp.text()}`);
    }
}

// --- Interno: pull request (asks externo to run its export) ---

export async function sendSyncRequestEmail(): Promise<void> {
    const payload = buildSyncPayload("sync-request", SYNC_REQUEST_UUID);
    await sendSignedMail(SYNC_REQUEST_SUBJECT_PREFIX, payload);
    console.log("[email-sync] Sent sync-request to externo");
}

// --- Externo: export (one email per changed document) ---

async function sendSyncBackDocEmail(uuid: string, fullDoc: Record<string, any>): Promise<void> {
    const payload = buildSyncPayload("sync-doc", uuid, fullDoc);
    await sendSignedMail(`${SYNC_BACK_SUBJECT_PREFIX} ${uuid}`, payload);
}

export async function sendBulkSyncEmails(): Promise<{ sent: number; refused?: boolean; message?: string; maxSeqNo: number }> {
    const client = await getElasticSearchClient();
    const lastSeqNo = await readLastSyncSeqNo();

    // Refuse a runaway delta rather than emailing the whole corpus.
    const countResp: any = await client.count({
        index: JurisprudenciaVersion,
        query: { range: { _seq_no: { gt: lastSeqNo } } },
    });
    const pending = countResp.count ?? 0;
    if (pending > SYNC_BACK_MAX_DELTA) {
        const message = `delta too large (${pending} docs > ${SYNC_BACK_MAX_DELTA}); re-seed interno via ES snapshot instead of email`;
        console.warn(`[email-sync-back] Export refused: ${message}`);
        return { sent: 0, refused: true, message, maxSeqNo: lastSeqNo };
    }

    console.log(`[email-sync-back] Export starting — ${pending} document(s) with _seq_no > ${lastSeqNo}`);
    let sent = 0;
    let sentSeqNo = lastSeqNo;
    let searchAfter: any[] | undefined = undefined;

    // Fixed range on the original bookmark; pagination is driven by search_after.
    // The bookmark is advanced per document, so a failure part-way through resumes
    // from the last document actually sent.
    for (;;) {
        const page: any = await client.search({
            index: JurisprudenciaVersion,
            query: { range: { _seq_no: { gt: lastSeqNo } } },
            sort: [{ _seq_no: "asc" }],
            seq_no_primary_term: true,
            size: 100,
            ...(searchAfter ? { search_after: searchAfter } : {}),
        });
        const hits = page.hits.hits;
        if (hits.length === 0) break;

        for (const hit of hits) {
            if (!hit._source) continue;
            const uuid = hit._source.UUID;
            if (!uuid) {
                console.warn(`[email-sync-back] Doc id=${hit._id} has no UUID, skipping`);
                continue;
            }
            await sendSyncBackDocEmail(uuid, hit._source);
            sent++;
            if (typeof hit._seq_no === "number") {
                sentSeqNo = hit._seq_no;
                await writeLastSyncSeqNo(sentSeqNo);
            }
        }
        searchAfter = hits[hits.length - 1].sort;
    }

    console.log(sent === 0
        ? "[email-sync-back] Nothing to export"
        : `[email-sync-back] Export complete: ${sent} document email(s), maxSeqNo=${sentSeqNo}`);
    return { sent, maxSeqNo: sentSeqNo };
}

// --- Interno: import (one document per email) ---

export async function pollAndProcessBackSyncEmails(): Promise<{ processed: number; errors: number }> {
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

            const payload = decodeSyncBody(msg.body?.content?.trim() || "");
            if (!payload || payload.action !== "sync-doc") {
                console.warn(`[email-sync-back] Could not parse sync-doc payload for "${subject}", skipping`);
                await markRead(msg.id);
                continue;
            }

            if (!verifySyncPayload(payload)) {
                console.warn(`[email-sync-back] Invalid or expired signature for subject: ${subject}`);
                await markRead(msg.id);
                errors++;
                continue;
            }

            try {
                const ok = await applyAction("sync-doc", payload.uuid, payload.content);
                if (ok) processed++; else errors++;
            } catch (err) {
                console.error(`[email-sync-back] Failed to apply sync-doc for UUID ${payload.uuid}:`, err);
                errors++;
            }

            await markRead(msg.id);
        }
    } finally {
        syncImporting = false;
    }

    if (processed > 0 || errors > 0) {
        console.log(`[email-sync-back] Poll complete: ${processed} applied, ${errors} errors`);
    }
    return { processed, errors };
}
