import { authenticatedHandler } from "@/core/user/authenticate";
import { NextApiRequest, NextApiResponse } from "next";
import { createDoc, deleteDoc, existsDoc, getDoc, isDoc, updateDoc } from "@/core/doc";

export default async function docApiHandler(
    req: NextApiRequest,
    res: NextApiResponse
){
    const authed = await authenticatedHandler(req);
    if( !authed ){
        return res.status(401).json({});
    }

    const id = req.query.doc as string;
    if( !(await existsDoc(id)) ){
        return res.status(404).json({})
    }

    if( req.method === "GET" ){
        return res.json(await getDoc(id));
    }

    if( req.method === "PUT" ){
        const content = req.body;
        if( isDoc(content) ){
            return res.json(await updateDoc(id, content))
        }
        else{
            return res.status(400).json({error: "invalid document"})
        }
    }

    if( req.method === "DELETE" ){
        return res.json(await deleteDoc(id))
    }
    return res.status(405).json(await getDoc(id))
}