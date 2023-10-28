import { authenticatedHandler } from "@/core/user/authenticate";
import { NextApiRequest, NextApiResponse } from "next";
import { createDoc, deleteDoc, getDoc, updateDoc } from "@/core/doc";
import { WriteResponseBase } from "@elastic/elasticsearch/lib/api/types";

export default async function docApiHandler(
    req: NextApiRequest,
    res: NextApiResponse
){
    const authed = await authenticatedHandler(req);
    if( !authed ){
        return res.status(401).json({});
    }

    if( req.method === "POST"){
        try{
            const content = JSON.parse(req.body);
            return res.json(await createDoc(content))
        }
        catch(e){
            console.log(e)
            return res.status(400).json({})
        }
    }

    return res.status(405).json({})
}
