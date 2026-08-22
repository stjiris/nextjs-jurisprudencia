import LoggerApi from "@/core/logger-api";
import { authenticatedHandler } from "@/core/user/authenticate";
import { existsDoc, getDoc, updateDoc } from "@/core/doc";
import { sendSyncEmail } from "@/core/email-sync";
import { logAuditEvent, getUsernameFromReq, getIpFromReq } from "@/core/audit-log";
import type { NextApiRequest, NextApiResponse } from "next";

type Response = { ok: boolean; message?: string };

export default LoggerApi(async function publicarHandler(
    req: NextApiRequest,
    res: NextApiResponse<Response>
) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const authed = await authenticatedHandler(req);
    if (!authed) {
        return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const { id } = req.body;
    if (!id || typeof id !== "string") {
        return res.status(400).json({ ok: false, message: "Missing document id" });
    }

    try {
        if (!(await existsDoc(id))) {
            return res.status(404).json({ ok: false, message: "Document not found" });
        }

        const doc = await getDoc(id);
        const state = doc._source?.STATE;
        const uuid = doc._source?.UUID;

        if (state === "importação" || state === "eliminado" || state === "público") {
            return res.status(409).json({ ok: false, message: `Cannot publicar a document in state '${state}'` });
        }

        // On interno, send sync email first — if it fails, abort the state change
        if (process.env.SYNC_ROLE === "interno" && uuid && doc._source) {
            try {
                await sendSyncEmail("publicar", uuid, doc._source as Record<string, any>);
            } catch (emailErr) {
                console.error("[gestao/publicar] Failed to send sync email:", emailErr);
                return res.status(500).json({ ok: false, message: "Falhou a propagação por email. Estado não foi alterado." });
            }
        }

        await updateDoc(id, { STATE: "público" });

        logAuditEvent("publicar", getUsernameFromReq(req), {
            documentId: id,
            documentProcesso: doc._source?.["Número de Processo"],
            ip: getIpFromReq(req),
        });

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error("Error in /api/gestao/publicar:", err);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
});
