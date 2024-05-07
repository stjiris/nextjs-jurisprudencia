import { getKey, updateKey } from "@/core/keys";
import LoggerApi from "@/core/logger-api";
import { authenticatedHandler } from "@/core/user/authenticate";
import { JurisprudenciaKey } from "@/types/keys";
import { JurisprudenciaDocumentKey } from "@stjiris/jurisprudencia-document";

import { NextApiRequest, NextApiResponse } from "next";

export default LoggerApi(async function getExcelHandler(
    req: NextApiRequest,
    res: NextApiResponse<JurisprudenciaKey | null>
    ){
    if( req.method !== "PUT" ) return res.status(405).json(null);
    if( !(await authenticatedHandler(req)) ) return res.status(401).json(null);

    let key = (Array.isArray(req.query.key) ? req.query.key[0] : req.query.key!) as JurisprudenciaDocumentKey;
    let attr = (Array.isArray(req.query.attr) ? req.query.attr[0] : req.query.attr!) as keyof JurisprudenciaKey;

    if( attr === "key" ) return res.status(400).json(null);
    
    await updateKey(key, {[attr]: JSON.parse(req.body)} )
    return res.json(await getKey(key))
});
