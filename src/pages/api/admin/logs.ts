import LoggerApi from "@/core/logger-api";
import { authenticatedHandlerWithRole } from "@/core/user/authenticate";
import { queryAuditLog } from "@/core/audit-log";
import type { NextApiRequest, NextApiResponse } from "next";

export default LoggerApi(async function logsHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const authed = await authenticatedHandlerWithRole(req, "manageUsers");
    if (!authed) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;
    const user = Array.isArray(req.query.user) ? req.query.user[0] : req.query.user;
    const from = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const to = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    const page = parseInt((Array.isArray(req.query.page) ? req.query.page[0] : req.query.page) || "0");
    const size = parseInt((Array.isArray(req.query.size) ? req.query.size[0] : req.query.size) || "50");

    try {
        const result = await queryAuditLog({ action, user, from, to, page, size: Math.min(size, 100) });
        return res.json(result);
    } catch (err) {
        console.error("[admin/logs] Error querying audit log:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
