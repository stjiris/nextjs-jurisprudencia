import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { trackRequest } from "./track-requests";


export default function LoggerApi(cb: NextApiHandler): NextApiHandler{
    return async function(req: NextApiRequest, res: NextApiResponse){
        const start = new Date();
        let r = await cb(req, res);
        const end = new Date();
        console.log(`[API] ${start.toISOString()} ${req.method} ${req.url} ${res.statusCode} ${(+end) - (+start)}ms`);
        trackRequest(req, res, start, end);
        return r;
    }
}