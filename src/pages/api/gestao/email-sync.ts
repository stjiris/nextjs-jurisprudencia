import LoggerApi from "@/core/logger-api";
import { pollAndProcessSyncEmails } from "@/core/email-sync";
import type { NextApiRequest, NextApiResponse } from "next";

type Response = { ok: boolean; processed?: number; errors?: number; message?: string };

/**
 * POST /api/gestao/email-sync
 *
 * Polls the IMAP inbox for incoming JURIS-SYNC emails and applies state changes.
 * Only active on external deployments (SYNC_ROLE=externo).
 * Intended to be called by the email-sync Docker service every minute.
 */
export default LoggerApi(async function emailSyncHandler(
    req: NextApiRequest,
    res: NextApiResponse<Response>
) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    if (process.env.SYNC_ROLE !== "externo") {
        return res.status(403).json({ ok: false, message: "Email sync is only active on external deployments (SYNC_ROLE=externo)" });
    }

    try {
        const { processed, errors } = await pollAndProcessSyncEmails();
        return res.status(200).json({ ok: true, processed, errors });
    } catch (err: any) {
        console.error("Error in /api/gestao/email-sync:", err);
        return res.status(500).json({ ok: false, message: err?.message || "Internal server error" });
    }
});
