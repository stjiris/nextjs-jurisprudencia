import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";


export default function LoggerApi(cb: NextApiHandler): NextApiHandler{
    const start = new Date();
    return async function(req: NextApiRequest, res: NextApiResponse){
        let r = await cb(req, res);
        const end = Date.now();
        console.log(`[API] ${start.toISOString()} ${req.method} ${req.url} ${res.statusCode} ${end - (+start)}ms`);
        return r;
    }
}