import fs from "fs";
import path from "path";
import { getGraphToken } from "@/core/email-sync";
import { getElasticSearchClient } from "@/core/elasticsearch";
import { parseDocumentFile } from "@/core/document-file-parser";
import { parseFilename } from "@/core/filename-parser";
import { canonicalizeSeccao } from "@/core/seccao-util";
import { createDoc, updateDoc } from "@/core/doc";
import { JurisprudenciaVersion, PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";

export interface SharepointDriveFile {
    driveId: string;
    driveName: string;
    itemId: string;
    name: string;
    webUrl: string;
    parentPath: string;
    lastModifiedDateTime: string;
}

export interface SharepointDeltaResult {
    ok: boolean;
    configured: boolean;
    found: number;
    drives: { name: string; count: number }[];
    files?: SharepointDriveFile[];
    siteId?: string;
    token?: string;
    message: string;
}

export interface SharepointSyncResult {
    ok: boolean;
    found?: number;
    importedCount?: number;
    totalImportacao?: number;
    running?: boolean;
    message: string;
}

function parseFolderMetadata(parentPath: string): { data?: string; seccao?: string; area?: string } {
    const result: { data?: string; seccao?: string; area?: string } = {};
    const dateMatches = [...parentPath.matchAll(/(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?/g)];
    const last = dateMatches.at(-1);
    if (last) {
        const day = parseInt(last[1], 10);
        const month = parseInt(last[2], 10);
        let year = parseInt(last[3] ?? String(new Date().getFullYear()), 10);
        if (year < 100) year += 2000;
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            result.data = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
        }
    }

    const lower = parentPath.toLowerCase();
    const secMatch = lower.match(/\b([1-7])\s*(?:\.?[ºªa])?\s*(?:se[cç][aã]o)?\b/i);
    if (secMatch) {
        const can = canonicalizeSeccao(`${secMatch[1]}ª Secção`);
        result.seccao = can;
        if (["1", "2", "6", "7"].includes(secMatch[1])) result.area = "Área Cível";
        else if (["3", "5"].includes(secMatch[1])) result.area = "Área Criminal";
        else if (secMatch[1] === "4") result.area = "Área Social";
    } else if (/contencioso/i.test(lower)) {
        result.seccao = "Contencioso";
        result.area = "Contencioso";
    } else if (/c[o]?nflitos/i.test(lower)) {
        result.seccao = "Conflitos";
        result.area = "Conflitos";
    } else if (/forma[cç][aã]o/i.test(lower)) {
        result.seccao = "Formação";
        result.area = "Formação";
    }
    return result;
}

type ExistingMatch = { action: "skip" } | { action: "create" } | { action: "merge"; id: string };

async function findExistingMatch(
    webUrl: string,
    nrProcesso: string,
    isSumario: boolean,
    folderDate?: string
): Promise<ExistingMatch> {
    try {
        const es = await getElasticSearchClient();
        const should: any[] = [];
        if (webUrl) should.push({ term: { "URL": webUrl } });
        if (nrProcesso && nrProcesso.length >= 4) {
            const slash = nrProcesso.replace(/^(\d+)[\-_](\d{2}\.\d)/, "$1/$2");
            const hyphen = nrProcesso.replace(/^(\d+)[\/_](\d{2}\.\d)/, "$1-$2");
            should.push({ term: { "Número de Processo": slash } });
            should.push({ term: { "Número de Processo": hyphen } });
        }
        if (should.length === 0) return { action: "create" };

        const res = await es.search<any>({
            index: JurisprudenciaVersion,
            size: 10,
            _source: ["URL", "Data", "STATE", "Sumário Não Anonimizado", "Texto Não Anonimizado"],
            query: {
                bool: {
                    should,
                    minimum_should_match: 1,
                    must_not: [{ term: { "STATE": "eliminado" } }],
                },
            },
        });

        for (const hit of res.hits.hits) {
            const src = hit._source || {};
            if (webUrl && src["URL"] === webUrl) return { action: "skip" };
            if (folderDate && src["Data"] && src["Data"] !== folderDate) continue;

            const hasSumario = Boolean(src["Sumário Não Anonimizado"]?.trim());
            const hasTexto = Boolean(src["Texto Não Anonimizado"]?.trim());
            if (isSumario && hasSumario) return { action: "skip" };
            if (!isSumario && hasTexto) return { action: "skip" };
            if (hit._id && ((isSumario && !hasSumario && hasTexto) || (!isSumario && !hasTexto && hasSumario))) {
                return { action: "merge", id: hit._id };
            }
            return { action: "skip" };
        }
        return { action: "create" };
    } catch {
        return { action: "create" };
    }
}

async function ingestMissingSharepointFiles(delta: SharepointDeltaResult, maxBatch = 20): Promise<number> {
    if (!delta.ok || !delta.token || !delta.siteId || !delta.files || delta.files.length === 0) {
        return 0;
    }

    const supportedExts = [".docx", ".pdf", ".doc"];
    const candidates = delta.files
        .filter((f) => {
            const lower = f.name.toLowerCase();
            if (/tabela.*\.pdf$/i.test(lower)) return false;
            return supportedExts.some((ext) => lower.endsWith(ext));
        })
        .sort((a, b) => (b.lastModifiedDateTime || "").localeCompare(a.lastModifiedDateTime || ""));

    let imported = 0;
    for (const file of candidates) {
        if (imported >= maxBatch) break;
        const parsedName = parseFilename(file.name);
        const folderMeta = parseFolderMetadata(file.parentPath);
        const isSumario = parsedName.tipoDocumento === "sumario";

        const match = await findExistingMatch(file.webUrl, parsedName.nrProcesso, isSumario, folderMeta.data);
        if (match.action === "skip") {
            continue;
        }

        try {
            const contentResp = await fetch(
                `https://graph.microsoft.com/v1.0/sites/${delta.siteId}/drives/${file.driveId}/items/${file.itemId}/content`,
                { headers: { Authorization: `Bearer ${delta.token}` } }
            );
            if (!contentResp.ok) continue;

            const arrayBuf = await contentResp.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            const parsed = await parseDocumentFile(file.name, buffer);
            const doc = parsed.parsedDoc;

            if (folderMeta.data) doc["Data"] = folderMeta.data;
            if (folderMeta.seccao && !doc["Secção"]) {
                doc["Secção"] = { Index: [folderMeta.seccao], Original: [folderMeta.seccao], Show: [folderMeta.seccao] };
            }
            if (folderMeta.area && !doc["Área"]) {
                doc["Área"] = { Index: [folderMeta.area], Original: [folderMeta.area], Show: [folderMeta.area] };
            }

            doc["STATE"] = "importação";
            doc["Fonte"] = "STJ (Sharepoint)";
            if (file.webUrl) doc["URL"] = file.webUrl;

            if (match.action === "merge") {
                const mergeFields: PartialJurisprudenciaDocument = { STATE: "importação" };
                if (doc["Texto Não Anonimizado"]) mergeFields["Texto Não Anonimizado"] = doc["Texto Não Anonimizado"];
                if (doc["Sumário Não Anonimizado"]) mergeFields["Sumário Não Anonimizado"] = doc["Sumário Não Anonimizado"];
                await updateDoc(match.id, mergeFields);
            } else {
                await createDoc(doc);
            }
            imported++;
        } catch (err) {
            console.warn(`[sharepoint-sync] Failed direct import of ${file.name}:`, err);
        }
    }

    return imported;
}

async function countImportacaoDocs(): Promise<number | null> {
    try {
        const es = await getElasticSearchClient();
        const res = await es.count({
            index: JurisprudenciaVersion,
            query: { term: { STATE: "importação" } },
        });
        return typeof res.count === "number" ? res.count : null;
    } catch {
        return null;
    }
}

/**
 * Triggers the clitools ingestion process in clitools_interno either via HTTP
 * (port 4000, waiting up to 45s for completion) or via trigger flag file.
 */
export async function triggerClitoolsSync(requestedBy: string): Promise<{
    ok: boolean;
    running?: boolean;
    httpReachable?: boolean;
    stderrTail?: string;
    message?: string;
}> {
    const candidateUrls = Array.from(
        new Set(
            [
                process.env.CLITOOLS_URL,
                "http://clitools_interno:4000",
                "http://clitools_dev:4000",
                "http://clitools:4000",
            ].filter((u): u is string => Boolean(u && u.trim()))
        )
    );
    const localRoot = process.env.LOCAL_ROOT || "/filesystem-results";
    let lastHttpError = "";

    for (const clitoolsUrl of candidateUrls) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 50_000);
            const resp = await fetch(`${clitoolsUrl.replace(/\/$/, "")}/sync?wait=true`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestedBy, timestamp: Date.now() }),
                signal: controller.signal,
            });
            clearTimeout(timeout);
            const data = await resp.json().catch(() => ({}));
            if (resp.ok) {
                return {
                    ok: data.ok !== false,
                    running: Boolean(data.running),
                    httpReachable: true,
                    stderrTail: data.stderrTail,
                    message: data.message || "Sincronização executada no serviço clitools.",
                };
            }
            return {
                ok: false,
                running: Boolean(data.running),
                httpReachable: true,
                stderrTail: data.stderrTail,
                message: data.message || `Falha no serviço clitools (HTTP ${resp.status}).`,
            };
        } catch (err: any) {
            lastHttpError = err?.cause?.code || err?.message || String(err);
        }
    }

    try {
        if (fs.existsSync(localRoot)) {
            const triggerFile = path.join(localRoot, ".trigger_sharepoint_sync");
            fs.writeFileSync(triggerFile, JSON.stringify({ requestedBy, timestamp: new Date().toISOString() }));
            return {
                ok: true,
                running: true,
                httpReachable: false,
                message: "Serviço clitools HTTP indisponível; pedido de sincronização gravado em disco.",
            };
        }
    } catch (err) {
        console.warn("[sharepoint-sync] Could not write trigger file:", err);
    }

    const reason = lastHttpError ? ` (${lastHttpError})` : "";
    return {
        ok: false,
        httpReachable: false,
        message: `Serviço de ingestão clitools não acessível neste instante${reason}.`,
    };
}

/**
 * Directly queries Microsoft Graph API to check if there are new or modified
 * files on the monitored STJ SharePoint drives ("Anonimização", "Jurisprudência/Acórdãos").
 */
export async function checkSharepointDelta(): Promise<SharepointDeltaResult> {
    const tenantId = process.env.TENANT_ID || process.env.SYNC_MS_TENANT_ID;
    const clientId = process.env.CLIENT_ID || process.env.SYNC_MS_CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET || process.env.SYNC_MS_CLIENT_SECRET;
    const siteId = process.env.SITE_ID || "stjpt.sharepoint.com,a29f0586-30ca-4bdf-8061-4aa55d2197fb,69813a68-bfcf-4fe4-93b3-23b4b9aa04d1";

    let driveNames = ["Anonimização", "Jurisprudência/Acórdãos"];
    if (process.env.DRIVES) {
        try {
            driveNames = typeof process.env.DRIVES === "string" ? JSON.parse(process.env.DRIVES) : process.env.DRIVES;
        } catch {
            // Keep default
        }
    }

    if (!tenantId || !clientId || !clientSecret || !siteId) {
        return {
            ok: false,
            configured: false,
            found: 0,
            drives: [],
            message: "Credenciais de acesso ao SharePoint do STJ (TENANT_ID, CLIENT_ID, SITE_ID) não configuradas neste ambiente.",
        };
    }

    try {
        const token = await getGraphToken(tenantId, clientId, clientSecret);
        const drivesResp = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drives`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!drivesResp.ok) {
            const text = await drivesResp.text();
            throw new Error(`Falha ao obter drives do SharePoint (${drivesResp.status}): ${text}`);
        }

        const drivesData = await drivesResp.json();
        const allDrives: Array<{ id: string; name: string }> = drivesData.value || [];
        const monitoredDrives = allDrives.filter((d) => d && driveNames.includes(d.name));

        let totalFound = 0;
        const driveStats: { name: string; count: number }[] = [];
        const collectedFiles: SharepointDriveFile[] = [];

        for (const drive of monitoredDrives) {
            let nextUrl: string | null = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${drive.id}/root/delta`;
            let driveFileCount = 0;
            let pageCount = 0;

            while (nextUrl && pageCount < 50) {
                pageCount++;
                const deltaResp: globalThis.Response = await fetch(nextUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!deltaResp.ok) break;

                const deltaData: { value?: any[]; [k: string]: any } = await deltaResp.json();
                const items: any[] = deltaData.value || [];
                const files = items.filter((item) => !item.deleted && !item.folder && item.file);
                driveFileCount += files.length;
                totalFound += files.length;
                for (const f of files) {
                    collectedFiles.push({
                        driveId: drive.id,
                        driveName: drive.name,
                        itemId: f.id,
                        name: f.name || "",
                        webUrl: f.webUrl || "",
                        parentPath: f.parentReference?.path || "",
                        lastModifiedDateTime: f.lastModifiedDateTime || "",
                    });
                }
                nextUrl = typeof deltaData["@odata.nextLink"] === "string" ? deltaData["@odata.nextLink"] : null;
            }
            driveStats.push({ name: drive.name, count: driveFileCount });
        }

        return {
            ok: true,
            configured: true,
            found: totalFound,
            drives: driveStats,
            files: collectedFiles,
            siteId,
            token,
            message: totalFound > 0
                ? `Encontrados ${totalFound} ficheiro(s) no SharePoint (${driveStats.map((d) => `${d.name}: ${d.count}`).join(", ")}).`
                : "SharePoint verificado: sem novos acórdãos pendentes (tudo atualizado).",
        };
    } catch (err: any) {
        console.error("[sharepoint-sync] Delta check error:", err);
        return {
            ok: false,
            configured: true,
            found: 0,
            drives: [],
            message: `Erro ao consultar o Microsoft Graph: ${err?.message || err}`,
        };
    }
}

/**
 * Main coordinator for SharePoint sync: counts current 'importação' docs,
 * queries delta, triggers clitools ingestion synchronously (up to 45s),
 * and reports the actual delta imported into 'importação'.
 */
export async function syncSharepoint({ username }: { username: string }): Promise<SharepointSyncResult> {
    const beforeImportacao = await countImportacaoDocs();
    const deltaStatus = await checkSharepointDelta();
    const clitoolsTrigger = await triggerClitoolsSync(username);
    let afterImportacao = await countImportacaoDocs();
    let importedCount =
        beforeImportacao !== null && afterImportacao !== null
            ? Math.max(0, afterImportacao - beforeImportacao)
            : 0;

    // Direct fallback ingestion if clitools didn't bring missing SharePoint files into 'importação'
    // (e.g. clitools offline, stale delta cursor, or folders/drives not handled by legacy ETL)
    if (!clitoolsTrigger.running && deltaStatus.ok && (deltaStatus.files?.length || 0) > 0 && importedCount === 0) {
        const directImported = await ingestMissingSharepointFiles(deltaStatus);
        if (directImported > 0) {
            importedCount += directImported;
            afterImportacao = await countImportacaoDocs();
        }
    }

    if (!clitoolsTrigger.ok && importedCount === 0) {
        if (deltaStatus.ok) {
            const totalInfo = afterImportacao !== null ? ` (total em 'importação': ${afterImportacao})` : "";
            return {
                ok: true,
                found: deltaStatus.found,
                importedCount: 0,
                totalImportacao: afterImportacao ?? undefined,
                message: `SharePoint verificado diretamente via Microsoft Graph (clitools indisponível): ${deltaStatus.found} ficheiro(s) encontrados, todos já importados${totalInfo}.`,
            };
        }
        const errDetail = clitoolsTrigger.stderrTail
            ? ` Detalhe: ${clitoolsTrigger.stderrTail.trim().split(/\r?\n/).slice(-2).join(" | ")}`
            : "";
        const graphNote = deltaStatus.message ? ` | Graph: ${deltaStatus.message}` : "";
        return {
            ok: false,
            found: deltaStatus.found,
            importedCount,
            totalImportacao: afterImportacao ?? undefined,
            message: `${clitoolsTrigger.message || "Falha ao executar ingestão do SharePoint."}${errDetail}${graphNote}`,
        };
    }

    if (clitoolsTrigger.running) {
        return {
            ok: true,
            running: true,
            found: deltaStatus.found,
            importedCount,
            totalImportacao: afterImportacao ?? undefined,
            message: clitoolsTrigger.httpReachable
                ? `Sincronização em execução no clitools (${deltaStatus.found} ficheiro(s) visíveis no SharePoint). Atualize "Por Anonimizar" dentro de instantes.`
                : `${clitoolsTrigger.message} (${deltaStatus.found} ficheiro(s) visíveis no SharePoint).`,
        };
    }

    const totalInfo = afterImportacao !== null ? ` (total em 'importação': ${afterImportacao})` : "";
    if (importedCount > 0) {
        return {
            ok: true,
            found: deltaStatus.found,
            importedCount,
            totalImportacao: afterImportacao ?? undefined,
            message: `Sincronização concluída: ${importedCount} novo(s) acórdão(s) colocado(s) em 'importação'${totalInfo}.`,
        };
    }

    return {
        ok: true,
        found: deltaStatus.found,
        importedCount: 0,
        totalImportacao: afterImportacao ?? undefined,
        message: `Sincronização concluída: nenhum novo acórdão colocado em 'importação' (${deltaStatus.found} ficheiro(s) no SharePoint já importados ou sem alterações)${totalInfo}.`,
    };
}
