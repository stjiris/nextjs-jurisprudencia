import search, { aggs, createQueryDslQueryContainer, populateFilters, SearchFilters } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import type { NextApiRequest, NextApiResponse } from 'next';

export function barChartAggregation(termsList: string[]): Record<string, any> {
    const currAggs: Record<string, any> = {};
    termsList.forEach((term) => {
      if (aggs[term] && aggs[term].terms) {
        currAggs[term] = {
          terms: {
            field: aggs[term].terms?.field?.replace("keyword","raw"),
            size: 99,
          }
        }
      }
    });
    currAggs['Outros'] = {
      missing: {}, 
    };
    const sortedAggs: Record<string, any> = {};
    termsList.forEach((label) => {
        if (currAggs.hasOwnProperty(label)) {
            sortedAggs[label] = currAggs[label];
        }
    });

    for (const label in sortedAggs) {
      if (sortedAggs.hasOwnProperty(label)) {
          sortedAggs[label].terms.order = { "_count": "desc" };
      }
    }

  return sortedAggs;
}
  
export default LoggerApi(async function stackedBarHandler(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    const optionLabels = [
      "Área",
      "Secção",
      "Relator Nome Profissional",
      "Meio Processual",
      "Votação",
      "Descritores"];

    const sfilters = { pre: [], after: [] } as SearchFilters;
    populateFilters(sfilters, req.query,[]);

    try {
      const authed = await authenticatedHandler(req);
      const body = await search(createQueryDslQueryContainer(req.query.q), sfilters, 0, barChartAggregation(optionLabels), 0, {}, authed);
      const aggs = body?.aggregations;

      return res.status(200).json(aggs);

    } catch (error) {
      console.error(error);
      return res.status(500);
    }
});
