import { AggregationsAggregate, AggregationsAggregationContainer, AggregationsMaxAggregate, AggregationsMinAggregate, AggregationsStringTermsAggregate, AggregationsTermsAggregation, AggregationsTermsBucketBase, Indices, long, SearchTotalHits } from "@elastic/elasticsearch/lib/api/types";
import search, { aggs, filterableProps, createQueryDslQueryContainer, populateFilters, sortAlphabetically } from "@/core/elasticsearch"
import { NextApiRequest, NextApiResponse } from "next";
import { INDICES_OTHERS } from "@/types/indices";
import { listAggregation } from "@/components/indices-helpers";

export default async function indicesCsvHandler(
    req: NextApiRequest,
    res: NextApiResponse<string>
) {
    const term = Array.isArray(req.query.term) ? req.query.term[0] : req.query.term  || "Área";
    let group = "Secção";
    if( "group" in req.query ){
        group = Array.isArray(req.query.group) ? req.query.group[0] : req.query.group!;
    }

    const sfilters = {pre: [], after: []};
    populateFilters(sfilters, req.query, []);
    const result = await search(createQueryDslQueryContainer(req.query.q), sfilters, 0, listAggregation(term,group), 0)

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
        sortedGroup = Object.entries(groupObj).sort((a,b) => sortAlphabetically(a[0], b[0]))
        sortedGroup.slice(10).forEach( a => othersCount += groupObj[a[0]] )
        sortedGroup.splice(10)
        if( othersCount > 0 ){
            sortedGroup.push([INDICES_OTHERS, othersCount])
        }
    }
    const props = {
        total: total,
        minAno: parseInt((result.aggregations?.MinAno as AggregationsMinAggregate).value_as_string || "") || 0,
        maxAno: parseInt((result.aggregations?.MaxAno as AggregationsMaxAggregate).value_as_string || "") || Infinity,
        termAggregation: result.aggregations![term] as AggregationsStringTermsAggregate,
        term,
        group,
        sortedGroup
    }
    
    return res.setHeader("Content-Type", "text/csv; charset=utf-8").setHeader("Content-Disposition","attachment").send(`"#","Índice","${props.group}",${props.sortedGroup.map(([name, count],i) => `"${name}"`).join(",")},"Datas"
${props.termAggregation.buckets.length},"${props.term}",${(props.termAggregation.buckets as any[]).reduce((acc, b)=> acc+b.doc_count, 0)},${props.sortedGroup.map(([name,count], i) => count).join(",")},"de ... até"
${(props.termAggregation.buckets as any[]).map( (b, i) => bucketLine(i, b, props.sortedGroup)).join("\n")}\n`);
}



function bucketLine(index: number, bucket: any, sortedGroup: [string, number][]){
    const othersCount = bucket.Group.sum_other_doc_count + bucket.Group.buckets.reduce((acc:number, b: any) => acc + (sortedGroup.find(([s,n]) => s == b.key) != null ? 0 : b.doc_count), 0)
    return `${index+1},"${bucket.key}",${bucket.doc_count},${sortedGroup.map(([groupKey, groupValue], i) => groupKey == INDICES_OTHERS ? othersCount : (bucket.Group.buckets.find((b:any) => b.key === groupKey)?.doc_count || 0)).join(",")},${bucket.MinAno.value_as_string == bucket.MaxAno.value_as_string ?
                `"${bucket.MaxAno.value_as_string}"`
            :
                `"${bucket.MinAno.value_as_string} ... ${bucket.MaxAno.value_as_string}"`
            }`
}

