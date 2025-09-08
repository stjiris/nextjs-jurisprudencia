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

export default LoggerApi(async function analyticsTimelineHandler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  try {
    const { query } = req;
    const timePeriod = typeof query.timePeriod === 'string' ? query.timePeriod : 'month';
    const interval = getInterval(timePeriod);

    // Construir filtros para a busca, usando função populateFilters
    const sfilters: SearchFilters = { pre: [], after: [] };
    populateFilters(sfilters, query, []);
    const authed = await authenticatedHandler(req);
    const searchQuery = createQueryDslQueryContainer(query.q as string | string[] | undefined);

    // Aggregation: date_histogram
    const aggs = {
      timeline: {
        date_histogram: {
          field: 'Data',
          calendar_interval: interval,
          min_doc_count: 1,
          format: 'yyyy-MM-dd',
        },
        aggs: {
          eclis: {
            terms: {
              field: 'ECLI',
              size: 10000
            }
          }
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

    // Formatar dados para o gráfico
    const buckets = ((body.aggregations?.timeline as AggregationsDateHistogramAggregate)?.buckets ?? []) as any[];
    const result = buckets.filter((b: any) => b.doc_count > 0).map((b: any) => ({
      date: b.key_as_string,
      count: b.doc_count,
      eclis: (b.eclis?.buckets as any[] | undefined)?.map((e: any) => e.key) || []
    }));
    return res.status(200).json(result);
  } catch (error) {
    console.error('Analytics Timeline API error:', error);
    return res.status(500).json({ error: 'Erro ao carregar dados temporais: ' + (error as Error).message });
  }
}); 