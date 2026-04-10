import LoggerApi from "@/core/logger-api";
import { authenticatedHandler } from "@/core/user/authenticate";
import { existsDoc, getDoc, updateDoc } from "@/core/doc";
import { sendSyncEmail } from "@/core/email-sync";
import type { NextApiRequest, NextApiResponse } from "next";

type Response = { ok: boolean; message?: string };

export default LoggerApi(async function tornarPrivadoHandler(
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

        if (state === "importação" || state === "eliminado" || state === "privado") {
            return res.status(409).json({ ok: false, message: `Cannot tornar-privado a document in state '${state}'` });
        }

        await updateDoc(id, { STATE: "privado" });

        // Propagate to external deployment if this is the internal deployment
        if (process.env.SYNC_ROLE === "interno" && uuid) {
            try {
                await sendSyncEmail("tornar-privado", uuid);
            } catch (emailErr) {
                // Log but don't fail the request — local state change succeeded
                console.error("[gestao/tornar-privado] Failed to send sync email:", emailErr);
                return res.status(200).json({ ok: true, message: "Estado atualizado, mas falhou a propagação por email" });
            }
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error("Error in /api/gestao/tornar-privado:", err);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
});
