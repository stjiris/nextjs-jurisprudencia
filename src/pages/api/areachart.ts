import search, { aggs, createQueryDslQueryContainer, populateFilters, SearchFilters } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import type { NextApiRequest, NextApiResponse } from 'next';
export function areachartAggregation(key: string): Record<string, any> {
  return {
    MinAno: aggs.MinAno,
    MaxAno: aggs.MaxAno,
    [key]: {
      terms: {
        field: aggs[key].terms?.field?.replace("keyword","raw"),
        size: 10
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

export function preprocessAreaChartData( aggs: any): { years: number[]; yearCounts: any } {
  const yearCounts: any = {};
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


export default LoggerApi(async function areachartHandler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  const aggKey = Array.isArray(req.query.termAreaChart) ? req.query.termAreaChart[0] : req.query.termAreaChart || "Área";
  if (!(aggKey in aggs)) {
    return res.status(400).json({});
  }

  const sfilters = { pre: [], after: [] } as SearchFilters;
  populateFilters(sfilters, req.query, []);
  try {
    const authed = await authenticatedHandler(req);
    const body = await search(createQueryDslQueryContainer(req.query.q), sfilters, 0, areachartAggregation(aggKey), 0, {}, authed);
    const aggs = body?.aggregations?.[aggKey];
    
    if (!aggs) {
      return res.status(400).json({});
    }
    const { years, yearCounts } = preprocessAreaChartData(aggs);

    return res.status(200).json(yearCounts);
  } catch (error) {
    console.error(error);
    return res.status(500);
  }
});
