import search, { aggs, createQueryDslQueryContainer, getElasticSearchClient, populateFilters, SearchFilters } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import type { NextApiRequest, NextApiResponse } from 'next';

export function matrixAggregation(term1: string, term2: string): Record<string, any> {
  return {
    matrix: {
      terms: {
        field: aggs[term1].terms?.field?.replace("keyword","raw"),
        size: 50,
      },
      aggs: {
        matrix: {
          terms: {
            field: aggs[term2].terms?.field?.replace("keyword","raw"),
          },
        },
      },
    },
  };
}

export default LoggerApi(async function matrixHandler(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    const sfilters = { pre: [], after: [] } as SearchFilters;
    populateFilters(sfilters, req.query, []);
    const term1 = Array.isArray(req.query.termMatrix1) ? req.query.termMatrix1[0] : req.query.termMatrix1 || "Área";
    const term2 = Array.isArray(req.query.termMatrix2) ? req.query.termMatrix2[0] : req.query.termMatrix2 || "Secção"; 

    try {
      const authed = await authenticatedHandler(req);
      const body = await search(createQueryDslQueryContainer(req.query.q), sfilters, 0, matrixAggregation(term1, term2), 0, {}, authed); 
      const aggs = body?.aggregations;

      return res.status(200).json(aggs);
    } catch (error) {
      console.error(error);
      return res.status(500);
    }

});