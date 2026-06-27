import { NextApiRequest, NextApiResponse } from "next";
import { authenticatedHandler } from "@/core/user/authenticate";
import { scheduleRun } from "@/core/etl-trigger";
import LoggerApi from "@/core/logger-api";

export default LoggerApi(async function etlScheduleHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (!await authenticatedHandler(req)) return res.status(401).json({ error: "unauthorized" });
    if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

    const user = req.cookies["user"]!;
    const { run, alreadyScheduled } = await scheduleRun(user);
    return res.json({ run, alreadyScheduled });
});
