import search, { aggs, createQueryDslQueryContainer, filterableProps, getElasticSearchClient, parseSort, populateFilters, RESULTS_PER_PAGE, SearchFilters, sortBucketsAlphabetically } from '@/core/elasticsearch';
import type { NextApiRequest, NextApiResponse } from 'next'

export function parallelSetsAggregation(terms: string[], numAggs: int): Record<string, any> {
    const aggregation = {
        aggs: {
            multi_terms: {
              terms: terms.map(term => ({ field: `${term.replace('keyword', 'raw')}.keyword`})),
              size: numAggs
            }
        }
    };
    return aggregation;
}

export default async function parallelSetsHandler(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    const sfilters = { pre: [], after: [] } as SearchFilters;
    populateFilters(sfilters, req.query);
    const numOfFields = req.query.numOfFields ? parseInt(req.query.numOfFields as string, 10) : 4;
    const numOfAggs = req.query.numOfAggregations ? parseInt(req.query.numOfAggregations as string, 10) : 50;
    const listOfFilters: number[] = req.query._f?.split('-').map(num => parseInt(num, 10));

    const terms = req.query.terms ? req.query.terms.split(',').slice(0, numOfFields) : [];

    try {
        const client = await getElasticSearchClient();
        const body = await search(createQueryDslQueryContainer(req.query.q), sfilters, 0, parallelSetsAggregation(terms, numOfAggs), 0);
        const aggs = body?.aggregations;

        return res.status(200).json(aggs);
    } catch (error) {
      console.error(error);
      return res.status(500);
    }
}