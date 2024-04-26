import { aggs } from "@/core/elasticsearch";
import { createReadStream } from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import path from "path";

export default async function docApiHandler(
    req: NextApiRequest,
    res: NextApiResponse
){
    const aggKey = Array.isArray(req.query.area) ? req.query.area[0] : req.query.area || "rss";

        const pathToRSS = path.join(process.env.RSS_FOLDER || "", aggKey + ".xml")
        const stream = createReadStream(pathToRSS)
        stream.on("error", function(){
            res.status(404).end("Not found")
        })
        stream.on("ready", function(){
            res.writeHead(200, {
                "Content-Type": "text/xml"
            })
        })
        stream.pipe(res)

}