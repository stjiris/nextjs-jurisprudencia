import { AggregationsMaxAggregate, AggregationsMinAggregate, long, SearchTotalHits } from "@elastic/elasticsearch/lib/api/types";
import { GetServerSideProps, GetServerSidePropsContext, PreviewData } from "next";
import search, { createQueryDslQueryContainer, DEFAULT_AGGS, populateFilters } from "@/core/elasticsearch"
import { ParsedUrlQuery } from "querystring";

export interface FormProps {
    count: number,
    filtersUsed: Record<string, string[]>,
    minAno: number,
    maxAno: number
}

export function withForm<
    Props extends FormProps,
    Params extends ParsedUrlQuery = ParsedUrlQuery,
    Preview extends PreviewData = PreviewData>(sub: (ctx: GetServerSidePropsContext, formProps: FormProps) => Promise<Props>): GetServerSideProps<Props, Params, Preview>{
    return async (ctx) => {
        const sfilters = {pre: [], after: []};
        const filtersUsed = populateFilters(sfilters, ctx.query)
        const queryObj = createQueryDslQueryContainer(ctx.query.q);
        const result = await search(queryObj, sfilters, 0, DEFAULT_AGGS, 0, {track_scores: true, _source: []})
        let total = 0;
        if( result.hits.total ){
            if( Number.isInteger(result.hits.total) ){
                total = result.hits.total as long;
            }
            else{
                total = (result.hits.total as SearchTotalHits).value;
            }
        }
        
        let formProps = {
            count: total,
            filtersUsed: filtersUsed,
            minAno: parseInt((result.aggregations?.MinAno as AggregationsMinAggregate).value_as_string || "") || 0,
            maxAno: parseInt((result.aggregations?.MaxAno as AggregationsMaxAggregate).value_as_string || "") || Infinity
        }
        return {props: await sub(ctx, formProps)}
    }
}
