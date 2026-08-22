import LoggerApi from "@/core/logger-api";
import { pollAndProcessBackSyncEmails } from "@/core/email-sync";
import type { NextApiRequest, NextApiResponse } from "next";

type Response = { ok: boolean; processed?: number; documents?: number; errors?: number; message?: string };

/**
 * POST /api/gestao/sync-import
 *
 * Polls the mailbox for [JURIS-SYNC-BACK] emails from externo and applies
 * them: every received document fully overwrites the local copy (externo is
 * the source of truth) and is stored with STATE=público.
 * Only active on internal deployments (SYNC_ROLE=interno).
 * Called by the sync_back_import Docker service every minute or manually.
 */
export default LoggerApi(async function syncImportHandler(
    req: NextApiRequest,
    res: NextApiResponse<Response>
) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    if (process.env.SYNC_ROLE !== "interno") {
        return res.status(403).json({ ok: false, message: "Sync import is only active on internal deployments (SYNC_ROLE=interno)" });
    }

    try {
        const { processed, documents, errors } = await pollAndProcessBackSyncEmails();
        return res.status(200).json({ ok: true, processed, documents, errors });
    } catch (err: any) {
        console.error("Error in /api/gestao/sync-import:", err);
        return res.status(500).json({ ok: false, message: err?.message || "Internal server error" });
    }
});
