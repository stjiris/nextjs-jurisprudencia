import { NextApiRequest, NextApiResponse } from "next";
import { authenticatedHandler } from "@/core/user/authenticate";
import { getLatestRun, EtlRunWithId } from "@/core/etl-trigger";
import LoggerApi from "@/core/logger-api";

export default LoggerApi(async function etlStatusHandler(
    req: NextApiRequest,
    res: NextApiResponse<EtlRunWithId | null>
) {
    if (!await authenticatedHandler(req)) return res.status(401).json(null);
    return res.json(await getLatestRun());
});
