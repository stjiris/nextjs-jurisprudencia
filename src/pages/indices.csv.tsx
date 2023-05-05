import { AggregationsAggregate, AggregationsAggregationContainer, AggregationsMaxAggregate, AggregationsMinAggregate, AggregationsStringTermsAggregate, AggregationsTermsAggregation, AggregationsTermsBucketBase, Indices, long, SearchTotalHits } from "@elastic/elasticsearch/lib/api/types";
import search, { aggs, filterableProps, createQueryDslQueryContainer, populateFilters, sortBucketsAlphabetically } from "@/core/elasticsearch"
import { GetServerSideProps } from "next";
import { GenericPageWithForm } from "@/components/genericPageStructure";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ReadonlyURLSearchParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AggregationsTermsAggregateBase } from "@elastic/elasticsearch/lib/api/typesWithBodyKey";
import { count } from "console";
import { addSearchParams, modifySearchParams, SelectNavigate } from "@/components/select-navigate";
import Head from "next/head";
import Script from "next/script";

function listAggregation(term: string, group?: string): Record<string, AggregationsAggregationContainer> {
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

const OTHERS = "[Outros]"

export const getServerSideProps: GetServerSideProps<IndicesProps> = async (ctx) => {
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
            sortedGroup.push([OTHERS, othersCount])
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

interface IndicesProps{
    total: number
    filtersUsed: Record<string, string[]>
    minAno: number
    maxAno: number
    termAggregation: AggregationsStringTermsAggregate
    term: string
    group: string
    sortedGroup: [string, number][]
    LIMIT_ROWS: number
}

export default function Indices(props: IndicesProps){
    if( !Array.isArray(props.termAggregation.buckets) ) throw new Error("Invalid bucket")

    return <pre>{`"#","Índice","${props.group}",${props.sortedGroup.map(([name, count],i) => `"${name}"`).join(",")},"Datas"
${props.termAggregation.buckets.length},"${props.term}",${props.termAggregation.buckets.reduce((acc, b)=> acc+b.doc_count, 0)},${props.sortedGroup.map(([name,count], i) => count).join(",")},"de ... até"
${props.termAggregation.buckets.map( (b, i) => bucketLine(i, b, props.sortedGroup)).join("\n")}\n`}</pre>
}



function bucketLine(index: number, bucket: any, sortedGroup: [string, number][]){
    const othersCount = bucket.Group.sum_other_doc_count + bucket.Group.buckets.reduce((acc:number, b: any) => acc + (sortedGroup.find(([s,n]) => s == b.key) != null ? 0 : b.doc_count), 0)
    return `${index+1},"${bucket.key}",${bucket.doc_count},${sortedGroup.map(([groupKey, groupValue], i) => {groupKey == OTHERS ? othersCount : (bucket.Group.buckets.find((b:any) => b.key === groupKey)?.doc_count)}).join(",")},${bucket.MinAno.value_as_string == bucket.MaxAno.value_as_string ?
                `"${bucket.MaxAno.value_as_string}"`
            :
                `"${bucket.MinAno.value_as_string} ... ${bucket.MaxAno.value_as_string}"`
            }`
}

