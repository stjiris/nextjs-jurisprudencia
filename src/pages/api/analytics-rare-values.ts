import search, { createQueryDslQueryContainer, populateFilters, SearchFilters } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import type { NextApiRequest, NextApiResponse } from 'next';
import { AggregationsCalendarInterval, AggregationsDateHistogramAggregate, AggregationsStringTermsAggregate } from '@elastic/elasticsearch/lib/api/types';

// Helper to map timePeriod to Elasticsearch interval
const getInterval = (period: string): AggregationsCalendarInterval => {
  if (period === 'day') return 'day';
  if (period === 'week') return 'week';
  if (period === 'month') return 'month';
  return 'year';
};

export default LoggerApi(async function analyticsRareValuesHandler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  try {
    const { query } = req;
    const field = typeof query.field === 'string' ? query.field : 'Decisão';
    const maxCount = Number.isFinite(Number(query.maxCount)) ? Number(query.maxCount) : 1;

    // Build filters
    const sfilters: SearchFilters = { pre: [], after: [] };
    populateFilters(sfilters, query, []);
    const authed = await authenticatedHandler(req);
    const searchQuery = createQueryDslQueryContainer(query.q as string | string[] | undefined);

    // Aggregation: terms (field) only
    const aggs = {
      rare_terms: {
        terms: {
          field: `${field}.Index.keyword`,
          size: 10000,
          min_doc_count: 1,
          shard_min_doc_count: 1
        }
      }
    } as Record<string, any>;

    const body = await search(
      searchQuery,
      sfilters,
      0,
      aggs,
      0, // no hits, just aggs
      {_source: false},
      authed
    );

    // Format response: only rare value buckets (doc_count <= maxCount)
    const rareBuckets = ((body.aggregations?.rare_terms as AggregationsStringTermsAggregate)?.buckets ?? []) as any[];
    const result: any[] = [];
    for (const rb of rareBuckets) {
      if (rb.doc_count <= maxCount) {
        result.push({
          term: rb.key,
          count: rb.doc_count
        });
      }
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('Analytics Rare Values API error:', error);
    return res.status(500).json({ error: 'Erro ao carregar valores raros: ' + (error as Error).message });
  }
}); 