import LoggerApi from "@/core/logger-api";
import { sendBulkSyncEmails } from "@/core/email-sync";
import type { NextApiRequest, NextApiResponse } from "next";

type Response = { ok: boolean; sent?: number; documents?: number; message?: string };

/**
 * POST /api/gestao/sync-export
 *
 * Exports every document changed since the last export (tracked by _seq_no)
 * as batched [JURIS-SYNC-BACK] emails for the interno deployment to import.
 * Only active on external deployments (SYNC_ROLE=externo).
 * Triggered nightly by the sync_back_export Docker service or manually.
 */
export default LoggerApi(async function syncExportHandler(
    req: NextApiRequest,
    res: NextApiResponse<Response>
) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    if (process.env.SYNC_ROLE !== "externo") {
        return res.status(403).json({ ok: false, message: "Sync export is only active on external deployments (SYNC_ROLE=externo)" });
    }

    try {
        const { sent, documents } = await sendBulkSyncEmails();
        return res.status(200).json({ ok: true, sent, documents });
    } catch (err: any) {
        console.error("Error in /api/gestao/sync-export:", err);
        return res.status(500).json({ ok: false, message: err?.message || "Internal server error" });
    }
});
