import { GetServerSidePropsContext, NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { trackApiRequest, trackSspRequest } from "./track-requests";


export default function LoggerApi(cb: NextApiHandler): NextApiHandler{
    return async function(req: NextApiRequest, res: NextApiResponse){
        const start = new Date();
        let r = await cb(req, res);
        const end = new Date();
        console.log(`[API] ${start.toISOString()} ${req.method} ${req.url} ${res.statusCode} ${(+end) - (+start)}ms`);
        await trackApiRequest(req, res, start, end);
        return r;
    }
}

export function LoggerServerSideProps(ctx: GetServerSidePropsContext){
    const start = new Date();
    const { req, res } = ctx;
    
    res.on("close", () => {
        const end = new Date();
        console.log(`[SSP] ${start.toISOString()} ${req.method} ${req.url} ${res.statusCode} ${(+end) - (+start)}ms`);
        trackSspRequest(req, res, start, end).catch(e => console.log(e));
    });
}