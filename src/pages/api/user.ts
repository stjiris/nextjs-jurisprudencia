import { authenticatedHandler } from "@/core/user/authenticate";
import { readUser, updateUser } from "@/core/user/usercrud";
import { NextApiRequest, NextApiResponse } from "next";

export default async function docApiHandler(
    req: NextApiRequest,
    res: NextApiResponse
){
    const authed = await authenticatedHandler(req);
    if( !authed ){
        return res.status(401).json(null);
    }
    let user = req.cookies["user"]!;

    if( req.method === "GET"){
        return res.json(await readUser(user).then(r => ({name: r?._source?.username})))
    }

    return res.status(405).json(null)
}
