import { GetServerSideProps, GetServerSidePropsContext, NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { trackApiRequest, trackSspRequest } from "./track-requests";
import { PreviewData } from "next";
import { ParsedUrlQuery } from "querystring";


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

export function LoggerServerSideProps<
    Props extends { [key: string]: any } = { [key: string]: any },
    Params extends ParsedUrlQuery = ParsedUrlQuery,
    Preview extends PreviewData = PreviewData
>(fn: GetServerSideProps<Props, Params, Preview>): GetServerSideProps<Props, Params, Preview> {
    return async (ctx) => {
        const start = new Date();
        const result = await fn(ctx);
        const end = new Date();

        let status = 200;
        if ('redirect' in result) status = 307;
        else if ('notFound' in result) status = 404;

        const req = ctx.req;
        console.log(`[SSP] ${start.toISOString()} ${req.method} ${req.url} ${status} ${(+end) - (+start)}ms`);
        trackSspRequest(req, status, start, end).catch(e => console.log(e));
        return result;
    };
}