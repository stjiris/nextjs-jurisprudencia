import { getElasticSearchClient } from '@/core/elasticsearch';
import { JurisprudenciaVersion } from '@stjiris/jurisprudencia-document';
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function getLastReport(
  req: NextApiRequest,
  res: NextApiResponse
) {
    let client = await getElasticSearchClient();
    let report = (await client.search({
        index: "jurisprudencia-indexer-report.0.0",
        query: {
            term: {
                target: JurisprudenciaVersion
            }
        },
        size: 1,
        sort: [{
            dateStart: "desc"
        }]
    }).catch(_ => ({hits: {hits: []}}))).hits.hits[0]?._source

    return res.json({
        version: JurisprudenciaVersion,
        report: report
    })
}
