import { startBuilder } from "@/core/excel";
import { authenticatedHandler } from "@/core/user/authenticate";
import { NextApiRequest, NextApiResponse } from "next";
import { isMainThread } from "worker_threads";

export default async function excelStatusHandler(
    req: NextApiRequest,
    res: NextApiResponse
){
    if( !await authenticatedHandler(req) ) return res.status(401).json(false);
    // TODO: arguments
    return res.json(startBuilder())
}