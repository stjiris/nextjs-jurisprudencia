import search, { createQueryDslQueryContainer, getElasticSearchClient } from '@/core/elasticsearch';
import { AggregationsAggregationContainer, AggregationsCumulativeCardinalityAggregate } from '@elastic/elasticsearch/lib/api/types';
import { JurisprudenciaVersion } from '@stjiris/jurisprudencia-document';
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function getLastReport(
  req: NextApiRequest,
  res: NextApiResponse
) {
    let mostRecentResult = await search(createQueryDslQueryContainer(), undefined, 0, {MostRecent: {max: {field: "Data"}}}, 0, {}, true);
    let mostRecentAgg = mostRecentResult.aggregations!.MostRecent as AggregationsCumulativeCardinalityAggregate;
    return res.json({
        version: JurisprudenciaVersion,
        mostRecent: mostRecentAgg.value_as_string
    })
}
