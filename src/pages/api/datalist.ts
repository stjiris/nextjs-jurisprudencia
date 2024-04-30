import search, { aggs, createQueryDslQueryContainer, filterableProps, getElasticSearchClient, parseSort, populateFilters, RESULTS_PER_PAGE, SearchFilters, sortBucketsAlphabetically } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import { DatalistObj } from '@/types/search';
import { AggregationsAggregationContainer, AggregationsStringTermsAggregate } from '@elastic/elasticsearch/lib/api/types';
import { JurisprudenciaVersion } from '@stjiris/jurisprudencia-document';
import type { NextApiRequest, NextApiResponse } from 'next'

export default LoggerApi(async function datalistHandler(
  req: NextApiRequest,
  res: NextApiResponse<DatalistObj[]>
) {
    let aggKey = Array.isArray(req.query.agg) ? req.query.agg[0] : req.query.agg || "";
    let client = await getElasticSearchClient();
    if( aggKey == "Campos" ){
        return client.indices.getMapping({index: JurisprudenciaVersion}).then(body => {
            let datalist = Object.keys(body[JurisprudenciaVersion].mappings.properties || {}).map(k => ({key: k}))
            return res.json(datalist)
        });
    }

    let agg = aggs[aggKey];
    if( !agg ) {
        return res.status(404).json([]);;
    }
    let finalAgg: AggregationsAggregationContainer = {
        terms: {
            field: agg.terms?.field?.replace("keyword","raw"),
            size: agg.terms?.size,
            order: {
                _key: "asc"
            }
        }
    }
    const sfilters = {pre: [], after: []} as SearchFilters;
    populateFilters(sfilters, req.query, [aggKey]);
    const authed = await authenticatedHandler(req);
    return search(createQueryDslQueryContainer(req.query.q), sfilters, 0, { [aggKey]: finalAgg }, 10, {}, authed).then(body => {
        if( !body.aggregations || !body.aggregations[aggKey] || !("buckets" in body.aggregations[aggKey]) ) throw new Error("Invalid aggregation result")
        
        let buckets = (body.aggregations[aggKey] as AggregationsStringTermsAggregate).buckets
        if( !Array.isArray(buckets) ) throw new Error("Invalid aggregation bucket result");

        return res.json(buckets.sort(sortBucketsAlphabetically).map( ({key, doc_count}) => ({key: key.toString(), count: doc_count})));
    }).catch(err => {
        console.error(err);
        return res.status(500).json([]);
    });
});
