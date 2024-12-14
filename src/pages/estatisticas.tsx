import GenericPage, { GenericPageWithForm } from "@/components/genericPageStructure"
import search, { createQueryDslQueryContainer, DEFAULT_AGGS, getSearchedArray, parseSort, populateFilters, RESULTS_PER_PAGE } from "@/core/elasticsearch";
import { LoggerServerSideProps } from "@/core/logger-api";
import { authenticatedHandler } from "@/core/user/authenticate";
import { AggregationsMaxAggregate, AggregationsMinAggregate, long, SearchTotalHits, SortCombinations } from "@elastic/elasticsearch/lib/api/types";
import { GetServerSideProps } from "next";
import Head from "next/head"

export const getServerSideProps: GetServerSideProps<EstatisticaProps> = async (ctx) => {
    LoggerServerSideProps(ctx);
    const sfilters = {pre: [], after: []};
    const filtersUsed = populateFilters(sfilters, ctx.query)
    const sort: SortCombinations[] = [];
    parseSort(Array.isArray(ctx.query?.sort) ? ctx.query.sort[0] : ctx.query.sort, sort)
    const page = parseInt(Array.isArray(ctx.query.page) ? ctx.query.page[0] : ctx.query.page || "" ) || 0
    const queryObj = createQueryDslQueryContainer(ctx.query.q);
    const authed = await authenticatedHandler(ctx.req);
    const result = await search(queryObj, sfilters, page, DEFAULT_AGGS, 0, {sort, track_scores: true, _source: []}, authed)
    let total = 0;
    if( result.hits.total ){
        if( Number.isInteger(result.hits.total) ){
            total = result.hits.total as long;
        }
        else{
            total = (result.hits.total as SearchTotalHits).value;
        }
    }
    return {props: {
        total: total,
        filtersUsed: filtersUsed,
        minAno: parseInt((result.aggregations?.MinAno as AggregationsMinAggregate).value_as_string || "") || 0,
        maxAno: parseInt((result.aggregations?.MaxAno as AggregationsMaxAggregate).value_as_string || "") || Infinity
    }}
}

type EstatisticaProps = {
    filtersUsed: Record<string, string[]>
    minAno: number,
    maxAno: number,
    total: number
}

export default function Estatistica(props: EstatisticaProps){
    return <GenericPageWithForm filtersUsed={props.filtersUsed} minAno={props.minAno} maxAno={props.maxAno} count={props.total} title="Jurisprudência STJ - Estatística">
        <div className="alert alert-warning">
            Sem estatísticas ainda
        </div>
    </GenericPageWithForm>
}