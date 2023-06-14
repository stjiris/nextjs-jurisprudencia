import { aggs, sortAlphabetically } from "@/core/elasticsearch";
import { NextApiRequest, NextApiResponse } from "next";

export default async function termInfoListHandler(
    req: NextApiRequest,
    res: NextApiResponse<string[]>
){  
    let resp = Object.entries(aggs).map(([s, c]) => c.terms?.field?.replace(".keyword", "") || "").filter( k => k.length > 0 ).sort((a,b) => sortAlphabetically(a,b));
    if( req.method === "GET" ){
        return res.json(resp)
    }
    return res.status(405).json(resp)
}
