// How a document coming from externo is applied on interno. Plain .mjs with no
// app imports so the email import (email-sync.ts) and the one-off file transfer
// (scripts/sync-catchup/apply.mjs, which runs inside clitools) share one logic.
import fs from "fs";
import path from "path";

export const SHAREPOINT_FONTE = "STJ (Sharepoint)";
export const DGSI_FONTE = "STJ (DGSI)";
export const SYNC_REVIEW_INDEX = "juris-sync-review";

// Interno-only data that externo's copy doesn't carry and must survive the overwrite.
const PRESERVED_FIELDS = ["Texto Não Anonimizado", "Sumário Não Anonimizado", "ENTITIES", "Original"];
const PRESERVED_HASH_FIELDS = ["Texto Não Anonimizado", "Sumário Não Anonimizado"];

const isEmpty = (value) =>
    value === undefined || value === null || value === "" ||
    (typeof value === "object" && Object.keys(value).length === 0);

const isAdoption = (existing, incoming) =>
    existing.Fonte === SHAREPOINT_FONTE && incoming.Fonte === DGSI_FONTE;

/**
 * Decides what to do with an incoming document.
 * uuidHit: the interno document with the same UUID, or null.
 * processHits: interno documents with the same Número de Processo.
 * Each hit is { id, source }.
 *
 * Returns { action, target?, reason?, possibleDuplicate? } where action is one of
 * "overwrite" | "adopt" | "create" | "hold".
 *
 * A SharePoint document is adopted on process number + Data, whatever its state:
 * what arrives from externo is the finished production work, and interno only needs
 * to show it. One process can hold several decisions, so a process-only match
 * creates the document and flags it, and a different decision is never overwritten.
 */
export function planSyncDoc(incoming, uuidHit, processHits) {
    const sameUrl = incoming.URL ? processHits.find(h => h.source.URL === incoming.URL) : undefined;
    const direct = uuidHit ?? sameUrl;
    if (direct) return { action: isAdoption(direct.source, incoming) ? "adopt" : "overwrite", target: direct };

    if (incoming.Fonte !== DGSI_FONTE) return { action: "create" };

    const sharepoint = processHits.filter(h => h.source.Fonte === SHAREPOINT_FONTE);
    const sameDate = sharepoint.filter(h => h.source.Data === incoming.Data);
    if (sameDate.length === 0) return { action: "create", possibleDuplicate: sharepoint.length > 0 };
    if (sameDate.length > 1) return { action: "hold", reason: "several-candidates" };

    return { action: "adopt", target: sameDate[0] };
}

/**
 * The document to store on interno. Externo is the source of truth, except for
 * interno-only data, and its STATE is respected so a document made private there
 * doesn't come back public.
 */
export function mergeSyncDoc(incoming, existing) {
    const doc = { ...incoming, STATE: incoming.STATE ?? "público" };
    if (!existing) return doc;

    for (const field of PRESERVED_FIELDS) {
        if (isEmpty(doc[field]) && !isEmpty(existing[field])) doc[field] = existing[field];
    }

    const content = [...new Set([...(existing.CONTENT ?? []), ...(incoming.CONTENT ?? [])])];
    if (content.length > 0) doc.CONTENT = content;

    if (doc.HASH && existing.HASH) {
        doc.HASH = { ...doc.HASH };
        for (const field of PRESERVED_HASH_FIELDS) {
            if (existing.HASH[field] && !isEmpty(existing[field])) doc.HASH[field] = existing.HASH[field];
        }
    }
    return doc;
}

export function reviewEntry(incoming, uuid, plan, processHits) {
    return {
        createdAt: new Date().toISOString(),
        reason: plan.reason ?? "possible-duplicate",
        applied: plan.action !== "hold",
        uuid,
        processo: incoming["Número de Processo"] ?? null,
        data: incoming.Data ?? null,
        candidateIds: plan.target ? [plan.target.id] : processHits.map(h => h.id),
        contentJson: JSON.stringify(incoming),
    };
}

/**
 * The file path includes the UUID, which adoption can change, so the folder follows
 * it. lib is @stjiris/filesystem-lib. Returns "moved", or why nothing was moved.
 */
export function moveAdoptedFolder(lib, existing, merged) {
    let oldPath;
    let newPath;
    let newRelPath;
    try {
        newRelPath = lib.generateFilePath(merged);
        oldPath = `${lib.ROOT_PATH}${lib.FILESYSTEM_PATH}${lib.generateFilePath(existing)}`;
        newPath = `${lib.ROOT_PATH}${lib.FILESYSTEM_PATH}${newRelPath}`;
    } catch {
        return "missing-metadata";
    }
    if (oldPath === newPath) return "same-path";
    if (!fs.existsSync(oldPath)) return "no-folder";
    if (fs.existsSync(newPath)) return "target-exists";

    fs.mkdirSync(path.dirname(newPath), { recursive: true });
    fs.renameSync(oldPath, newPath);

    const detalhesPath = path.join(newPath, `${lib.DETAILS_NAME}.json`);
    if (fs.existsSync(detalhesPath)) {
        const detalhes = JSON.parse(fs.readFileSync(detalhesPath, "utf-8"));
        detalhes.file_path = newRelPath;
        detalhes.jurisprudencia_document = merged.UUID;
        detalhes.last_update_date = new Date().toISOString();
        fs.writeFileSync(detalhesPath, JSON.stringify(detalhes, null, 2), { encoding: "utf-8" });
    }
    return "moved";
}
