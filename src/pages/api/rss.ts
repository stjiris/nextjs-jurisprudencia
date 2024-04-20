import { createReadStream } from "fs";
import { NextApiRequest, NextApiResponse } from "next";

export default async function docApiHandler(
    req: NextApiRequest,
    res: NextApiResponse
){
    
    res.writeHead(200, {
        "Content-Type": "text/xml"
    })
    createReadStream("rss.xml").pipe(res)
}