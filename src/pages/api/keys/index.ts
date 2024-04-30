import { getAllKeys } from "@/core/keys";
import LoggerApi from "@/core/logger-api";
import { authenticatedHandler } from "@/core/user/authenticate";
import { JurisprudenciaKey } from "@/types/keys";

import { NextApiRequest, NextApiResponse } from "next";

export default LoggerApi(async function getKeysHandler(
    req: NextApiRequest,
    res: NextApiResponse<JurisprudenciaKey[]>
    ){
    let authed = await authenticatedHandler(req);
    return res.json(await getAllKeys(authed));
});
