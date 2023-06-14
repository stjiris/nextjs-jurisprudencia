import { authenticatedHandler } from "@/core/user/authenticate";
import { deleteTerm, getTerm, updateTerm } from "@/core/term-info";
import { NextApiRequest, NextApiResponse } from "next";

export default async function termInfoHandler(
    req: NextApiRequest,
    res: NextApiResponse<string>
){
    const term = req.query.term as string;
    if( req.method === "GET" ){
        return res.json(await getTerm(term) || "");
    }

    if( req.method === "PUT" && await authenticatedHandler(req) ){
        const content = req.body;
        return res.json(await updateTerm(term, content) || "")
    }

    if( req.method === "DELETE" && await authenticatedHandler(req) ){
        return res.json(await deleteTerm(term) || "")
    }
    res.status(405).json(await getTerm(term) || "")
}