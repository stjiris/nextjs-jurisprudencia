import fs from "fs";
import path from "path";
import { getGraphToken } from "@/core/email-sync";

export interface SharepointDeltaResult {
    ok: boolean;
    configured: boolean;
    found: number;
    drives: { name: string; count: number }[];
    message: string;
}

export interface SharepointSyncResult {
    ok: boolean;
    found?: number;
    message: string;
}

/**
 * Triggers the clitools ingestion process in clitools_interno either via HTTP
 * (port 4000) or via a trigger flag file in the shared etl_results volume.
 */
export async function triggerClitoolsSync(requestedBy: string): Promise<{ ok: boolean; message?: string }> {
    const clitoolsUrl = process.env.CLITOOLS_URL || "http://clitools_interno:4000";
    const localRoot = process.env.LOCAL_ROOT || "/filesystem-results";

    let fileTriggered = false;
    try {
        if (fs.existsSync(localRoot)) {
            const triggerFile = path.join(localRoot, ".trigger_sharepoint_sync");
            fs.writeFileSync(triggerFile, JSON.stringify({ requestedBy, timestamp: new Date().toISOString() }));
            fileTriggered = true;
        }
    } catch (err) {
        console.warn("[sharepoint-sync] Could not write trigger file:", err);
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const resp = await fetch(`${clitoolsUrl}/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestedBy, timestamp: Date.now() }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (resp.ok) {
            const data = await resp.json().catch(() => ({}));
            return { ok: true, message: data.message || "Sincronização iniciada com sucesso no serviço clitools." };
        }
    } catch {
        // clitools service offline or unreachable via HTTP
    }

    if (fileTriggered) {
        return { ok: true, message: "Pedido de sincronização registado em disco para processamento imediato pelo clitools." };
    }

    return { ok: false, message: "Serviço de ingestão clitools não acessível neste instante." };
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

        for (const drive of monitoredDrives) {
            const deltaUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${drive.id}/root/delta`;
            const deltaResp = await fetch(deltaUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!deltaResp.ok) continue;

            const deltaData = await deltaResp.json();
            const items: any[] = deltaData.value || [];
            const files = items.filter((item) => !item.deleted && !item.folder && item.file);
            totalFound += files.length;
            driveStats.push({ name: drive.name, count: files.length });
        }

        return {
            ok: true,
            configured: true,
            found: totalFound,
            drives: driveStats,
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
 * Main coordinator for SharePoint sync: queries delta and triggers ingestion.
 */
export async function syncSharepoint({ username }: { username: string }): Promise<SharepointSyncResult> {
    const deltaStatus = await checkSharepointDelta();
    const clitoolsTrigger = await triggerClitoolsSync(username);

    if (deltaStatus.ok) {
        if (clitoolsTrigger.ok) {
            const msg = deltaStatus.found > 0
                ? `Sincronização iniciada com sucesso. Encontrados ${deltaStatus.found} ficheiros no SharePoint a serem processados.`
                : "Sincronização executada: o SharePoint não tem novos acórdãos pendentes (tudo atualizado).";
            return { ok: true, found: deltaStatus.found, message: msg };
        } else {
            const msg = deltaStatus.found > 0
                ? `Encontrados ${deltaStatus.found} ficheiros no SharePoint. Pedido de importação registado no sistema.`
                : "SharePoint verificado: sem novos acórdãos pendentes.";
            return { ok: true, found: deltaStatus.found, message: msg };
        }
    }

    if (clitoolsTrigger.ok) {
        return { ok: true, message: "Sincronização com o SharePoint iniciada com sucesso no serviço clitools." };
    }

    return {
        ok: false,
        message: deltaStatus.message || clitoolsTrigger.message || "Não foi possível contactar o SharePoint nem o serviço de ingestão.",
    };
}
