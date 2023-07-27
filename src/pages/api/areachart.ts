import search, { aggs, createQueryDslQueryContainer, filterableProps, getElasticSearchClient, parseSort, populateFilters, RESULTS_PER_PAGE, SearchFilters, sortBucketsAlphabetically } from '@/core/elasticsearch';
import { JurisprudenciaDocument, Properties, Index } from '@/core/jurisprudencia'
import { DatalistObj, HighlightFragment, SearchHandlerResponse } from '@/types/search';
import { YearCountMap } from '@/types/vis';
import { AggregationsAggregationContainer, AggregationsAggregation, SearchHighlight, SearchHit, SearchResponse, SortCombinations, AggregationsTermsAggregationCollectMode, AggregationsStringTermsAggregate, AggregationsBucketAggregationBase, AggregationsMinAggregate, AggregationsMaxAggregate, long, SearchTotalHits } from '@elastic/elasticsearch/lib/api/types';
import { AggregationsTermsAggregateBase, AggregationsTermsAggregation } from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import type { NextApiRequest, NextApiResponse } from 'next'
export function areachartAggregation(key: string): Record<string, any> {
  return {
    MinAno: aggs.MinAno,
    MaxAno: aggs.MaxAno,
    [key]: {
      terms: {
        field: aggs[key].terms?.field?.replace("keyword", "raw"),
        size: 20
      },
      aggs: {
        MinAno: aggs.MinAno,
        MaxAno: aggs.MaxAno,
        Anos: {
          date_histogram: {
            field: "Data",
            calendar_interval: "year",
            format: "yyyy",
          },
        },
      },
    },
  };
}

export function preprocessAreaChartData( aggs: any): { years: number[]; yearCounts: YearCountMap } {
  const yearCounts: YearCountMap = {};
  aggs.buckets.forEach((bucket: any) => {
    bucket.Anos.buckets.forEach((subBucket: any) => {
      const year = parseInt(subBucket.key_as_string);
      if (!yearCounts[year]) {
        yearCounts[year] = { x: year };
      }
      yearCounts[year][bucket.key] = subBucket.doc_count;
    });
  });

  const minAno = aggs.MinAno;
  const maxAno = aggs.MaxAno;

  const years = Array.from(
    { length: maxAno - minAno + 1 },
    (_, i) => minAno + i
  );

  for (const year in yearCounts) {
    const counts = yearCounts[year];
    for (const bucket of aggs.buckets) {
      if (!counts[bucket.key]) {
        counts[bucket.key] = 0;
      }
    }
  }

  return { years, yearCounts };
}


export default async function areachartHandler(
  req: NextApiRequest,
  res: NextApiResponse<YearCountMap>
) {
  const aggKey = Array.isArray(req.query.termAreaChart) ? req.query.termAreaChart[0] : req.query.termAreaChart || "Área";
  if (!(aggKey in aggs)) {
    return res.status(400).json({});
  }
  console.log("req.query");
  console.log(req.query);

  const sfilters = { pre: [], after: [] } as SearchFilters;
  populateFilters(sfilters, req.query);
  try {
    const client = await getElasticSearchClient();
    const body = await search(createQueryDslQueryContainer(req.query.q), sfilters, 0, areachartAggregation(aggKey), 0);
    const aggs = body?.aggregations?.[aggKey];
    let total = 0;
    if( body.hits.total ){
        if( Number.isInteger(body.hits.total) ){
            total = body.hits.total as long;
        }
        else{
            total = (body.hits.total as SearchTotalHits).value;
        }
    }
    console.log("total", total);
    if (!aggs) {
      return res.status(400).json({});
    }
    const { years, yearCounts } = preprocessAreaChartData(aggs);

    return res.status(200).json(yearCounts);
  } catch (error) {
    console.error(error);
    return res.status(500);
  }
}
