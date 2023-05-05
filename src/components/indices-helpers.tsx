import search, { aggs, createQueryDslQueryContainer, populateFilters, sortBucketsAlphabetically } from "@/core/elasticsearch";
import { IndicesProps, INDICES_OTHERS } from "@/types/indices";
import { AggregationsAggregationContainer, AggregationsMaxAggregate, AggregationsMinAggregate, AggregationsStringTermsAggregate, long, SearchTotalHits } from "@elastic/elasticsearch/lib/api/types";
import { GetServerSideProps } from "next";

export function listAggregation(term: string, group?: string): Record<string, AggregationsAggregationContainer> {
    const termFieldName = aggs[term].terms?.field!;
    const groupFieldName = group ? aggs[group].terms?.field : null;
    const new_aggs = {
        MinAno: aggs.MinAno,
        MaxAno: aggs.MaxAno,
        [term]: {
            terms: {
                field: termFieldName.replace("keyword","raw"),
                size: 65536/5,
                order: {
                    _key: "asc",
                }
            },
            aggs: {
                MinAno: {
                    min: {
                        field: "Data"
                    }
                },
                MaxAno: {
                    max: {
                        field: "Data"
                    }
                }
            }
        }
    } as Record<string, AggregationsAggregationContainer>
    if( groupFieldName){
        new_aggs[term].aggs!.Group = {
            terms: {
                field: groupFieldName.replace("keyword","raw"),
                size: 10,
                min_doc_count: 1,
                order: {
                    _key: "desc"
                }
            }
        }
    }
    return new_aggs;
}

export const getServerSidePropsHelper: GetServerSideProps<IndicesProps> = async (ctx) => {
    const LIMIT_ROWS = Array.isArray(ctx.query.LIMIT_ROWS) ? parseInt(ctx.query.LIMIT_ROWS[0]) : parseInt(ctx.query.LIMIT_ROWS || "5000") || 5000;
    const term = Array.isArray(ctx.query.term) ? ctx.query.term[0] : ctx.query.term  || "Área";
    let group = "Secção";
    if( "group" in ctx.query ){
        group = Array.isArray(ctx.query.group) ? ctx.query.group[0] : ctx.query.group!;
    }

    const sfilters = {pre: [], after: []};
    const filtersUsed = populateFilters(sfilters, ctx.query, []);
    const result = await search(createQueryDslQueryContainer(ctx.query.q), sfilters, 0, listAggregation(term,group), 0)
    
    let total = 0;
    if( result.hits.total ){
        if( Number.isInteger(result.hits.total) ){
            total = result.hits.total as long;
        }
        else{
            total = (result.hits.total as SearchTotalHits).value;
        }
    }

    let othersCount = 0;
    let groupObj = {} as Record<string, number>;
    let sortedGroup = [] as [string, number][];
    if(group){
        let buckets = (result.aggregations![term] as AggregationsStringTermsAggregate).buckets;
        if( !Array.isArray(buckets) ) throw new Error("Invalid bucket");
        buckets.forEach( buck => {
            othersCount += buck.Group.sum_other_doc_count
            let subbuckets = (buck.Group as AggregationsStringTermsAggregate).buckets;
            if( Array.isArray(subbuckets) ){
                subbuckets.forEach(s => groupObj[s.key] = (groupObj[s.key]|| 0) +  s.doc_count)
            }
        })
        sortedGroup = Object.entries(groupObj).sort((a,b) => sortBucketsAlphabetically({key: a[0], doc_count: a[1]}, {key: b[0], doc_count: b[1]}))
        sortedGroup.slice(10).forEach( a => othersCount += groupObj[a[0]] )
        sortedGroup.splice(10)
        if( othersCount > 0 ){
            sortedGroup.push([INDICES_OTHERS, othersCount])
        }
    }


    return {props: {
        total: total,
        filtersUsed: filtersUsed,
        minAno: parseInt((result.aggregations?.MinAno as AggregationsMinAggregate).value_as_string || "") || 0,
        maxAno: parseInt((result.aggregations?.MaxAno as AggregationsMaxAggregate).value_as_string || "") || Infinity,
        termAggregation: result.aggregations![term] as AggregationsStringTermsAggregate,
        term,
        group,
        sortedGroup,
        LIMIT_ROWS
    }}
}