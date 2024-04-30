import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";


export default function LoggerApi(cb: NextApiHandler): NextApiHandler{
    return async function(req: NextApiRequest, res: NextApiResponse){
        const start = new Date();
        let r = await cb(req, res);
        const end = Date.now();
        console.log(`[API] ${start.toISOString()} ${req.method} ${req.url} ${res.statusCode} ${end - (+start)}ms`);
        return r;
    }
}