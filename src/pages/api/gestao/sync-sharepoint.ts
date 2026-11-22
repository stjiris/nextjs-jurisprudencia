import LoggerApi from "@/core/logger-api";
import { authenticatedHandler, getUserRole } from "@/core/user/authenticate";
import { roleCanAccess } from "@/core/user/roles";
import { logAuditEvent, getUsernameFromReq, getIpFromReq } from "@/core/audit-log";
import { syncSharepoint, checkSharepointDelta } from "@/core/sharepoint-sync";
import type { NextApiRequest, NextApiResponse } from "next";

type Response = {
    ok: boolean;
    found?: number;
    message?: string;
    details?: any;
};

/**
 * POST /api/gestao/sync-sharepoint
 * GET  /api/gestao/sync-sharepoint (status/preview only)
 *
 * Checks for new or modified rulings in the STJ SharePoint folders
 * and triggers ingestion into the internal index ('importação' state).
 * Strictly restricted to administrators ('manageUsers' permission) on
 * internal deployments.
 */
export default LoggerApi(async function syncSharepointHandler(
    req: NextApiRequest,
    res: NextApiResponse<Response>
) {
    if (req.method !== "POST" && req.method !== "GET") {
        return res.status(405).json({ ok: false, message: "Método não permitido" });
    }

    const authed = await authenticatedHandler(req);
    if (!authed) {
        return res.status(401).json({ ok: false, message: "Não autorizado" });
    }

    const role = (await getUserRole(req)) ?? "editor";
    if (!roleCanAccess(role, "manageUsers")) {
        return res.status(403).json({ ok: false, message: "Acesso reservado ao modo de administração (requer 'admin')" });
    }

    if (process.env.SYNC_ROLE === "externo") {
        return res.status(403).json({
            ok: false,
            message: "A sincronização direta com o SharePoint só é permitida no ambiente interno por salvaguarda de RGPD.",
        });
    }

    const username = getUsernameFromReq(req) || "admin";

    // Read-only status / preview check via GET
    if (req.method === "GET") {
        try {
            const status = await checkSharepointDelta();
            return res.status(200).json(status);
        } catch (err: any) {
            console.error("Error in GET /api/gestao/sync-sharepoint:", err);
            return res.status(500).json({ ok: false, message: err?.message || "Erro ao consultar estado do SharePoint" });
        }
    }

    // Trigger sync via POST
    try {
        const result = await syncSharepoint({ username });
        await logAuditEvent("sincronizar", username, {
            details: JSON.stringify({
                target: "sharepoint",
                found: result.found,
                message: result.message,
            }),
            ip: getIpFromReq(req),
        });
        return res.status(result.ok ? 200 : 500).json(result);
    } catch (err: any) {
        console.error("Error in POST /api/gestao/sync-sharepoint:", err);
        return res.status(500).json({ ok: false, message: err?.message || "Erro interno ao sincronizar SharePoint" });
    }
});
