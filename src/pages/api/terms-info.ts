import { aggs, getElasticSearchClient } from "@/core/elasticsearch";
import { NextApiRequest, NextApiResponse } from "next";

export default async function datalistHandler(
  req: NextApiRequest,
  res: NextApiResponse<string>
){
    const term = Array.isArray(req.query.term) ? req.query.term[0] : req.query.term;
    if( !term ) return res.status(500).send("Request didn't have 'term' param.")

    let client = await getElasticSearchClient();

    let r = await client.get<{text: string}>({
        index: "terms-info.0.0",
        id: aggs[term].terms?.field?.replace(".keyword", "") || ""
    })

    res.send(r._source?.text || "");

}
