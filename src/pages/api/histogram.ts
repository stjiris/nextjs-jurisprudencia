import search, { aggs, createQueryDslQueryContainer, populateFilters, SearchFilters } from '@/core/elasticsearch';
import { AggregationsAggregationContainer } from '@elastic/elasticsearch/lib/api/types';
import type { NextApiRequest, NextApiResponse } from 'next';

function histogramAggregation(key: string, value: string): Record<string, AggregationsAggregationContainer> {
    const termFieldName = aggs[key].terms?.field!;
    return {
        MinAno: aggs.MinAno,
        MaxAno: aggs.MaxAno,
        Term: {
            filter: {
                term: {
                    [termFieldName]: value
                }
            },
            aggs: {
                MinAno: aggs.MinAno,
                MaxAno: aggs.MaxAno,
                Anos: {
                    date_histogram: {
                        "field": "Data",
                        "calendar_interval": "year",
                        "format": "yyyy"
                    }
                }
            }
        }
    }
}

export default async function histogramHandler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
    const aggKey = Array.isArray(req.query.term) ? req.query.term[0] : req.query.term || "Relator";
    const value = Array.isArray(req.query.histogram_value) ? req.query.histogram_value[0] : req.query.histogram_value || "";
    if( !(aggKey in aggs) ) return res.status(400).json({})
    
    const sfilters: SearchFilters = {pre: [], after: []};
    const filters = populateFilters(sfilters, req.query, []);

    return search(createQueryDslQueryContainer(req.query.q), sfilters, 0, histogramAggregation(aggKey, value), 0).then( r => res.json(r.aggregations))
}
