import LoggerApi from "@/core/logger-api";
import { authenticatedHandler } from "@/core/user/authenticate";
import { existsDoc, getDoc, updateDoc } from "@/core/doc";
import { logAuditEvent, getUsernameFromReq, getIpFromReq } from "@/core/audit-log";
import type { NextApiRequest, NextApiResponse } from "next";

type Response = { ok: boolean; message?: string };

export default LoggerApi(async function restaurarHandler(
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

        if (state !== "eliminado") {
            return res.status(409).json({ ok: false, message: `Cannot restaurar a document in state '${state}'` });
        }

        await updateDoc(id, { STATE: "preparação" });

        logAuditEvent("restaurar", getUsernameFromReq(req), {
            documentId: id,
            documentProcesso: doc._source?.["Número de Processo"],
            ip: getIpFromReq(req),
        });

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error("Error in /api/gestao/restaurar:", err);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
});
