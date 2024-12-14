import { getKey } from "@/core/keys";
import LoggerApi from "@/core/logger-api";
import { JurisprudenciaKey } from "@/types/keys";
import { JurisprudenciaDocumentKey } from "@stjiris/jurisprudencia-document";

import { NextApiRequest, NextApiResponse } from "next";

export default LoggerApi(async function getKeyHandler(
    req: NextApiRequest,
    res: NextApiResponse<JurisprudenciaKey>
    ){
    let key = (Array.isArray(req.query.key) ? req.query.key[0] : req.query.key!) as JurisprudenciaDocumentKey;

    return res.json(await getKey(key));
});
