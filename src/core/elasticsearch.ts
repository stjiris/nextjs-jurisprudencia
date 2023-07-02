import { Client } from "@elastic/elasticsearch";
import { AggregationsAggregationContainer, AggregationsStringTermsBucket, AggregationsTermsAggregation, QueryDslQueryContainer, SearchRequest, SortCombinations } from "@elastic/elasticsearch/lib/api/types";
import { isValidJurisprudenciaDocumentKey, JurisprudenciaDocumentProperties, JurisprudenciaVersion, PartialTypedJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";

export const filterableProps = Object.entries(JurisprudenciaDocumentProperties).filter(([_, obj]) => obj.type == 'keyword' || ("fields" in obj && obj.fields.keyword)).map( ([name, _]) => name).filter( o => o != "URL" && o != "UUID");

const DATA_FIELD = "Data";

export const aggs = {
    MinAno: {
        min: {
            field: DATA_FIELD,
            format: 'yyyy'
        }
    },
    MaxAno: {
        max: {
            field: DATA_FIELD,
            format: 'yyyy'
        }
    }
} as Record<string, AggregationsAggregationContainer>;
filterableProps.forEach(name => {
    let key = name
    if( isValidJurisprudenciaDocumentKey(name) && "fields" in JurisprudenciaDocumentProperties[name] ){
        key += ".keyword"
    }
    aggs[name] = {
        terms: {
            field: key,
            size: 65536,
            order: {
                _key: "asc"
            }
        }
    }
});

export const DEFAULT_AGGS = {
    MaxAno : aggs.MaxAno,
    MinAno : aggs.MinAno
};
export const RESULTS_PER_PAGE = 10;

export async function getElasticSearchClient(){
    return new Client({node: process.env.ES_URL || "http://localhost:9200", auth: { username: "elastic", password: "elasticsearch"}})
}

export type SearchFilters = {
    pre: QueryDslQueryContainer[];
    after: QueryDslQueryContainer[];
};

export default function search(
    query: QueryDslQueryContainer | QueryDslQueryContainer[],
    filters: SearchFilters={pre: [],after: []},
    page: number=0,
    saggs: Record<string, AggregationsAggregationContainer>=DEFAULT_AGGS,
    rpp=RESULTS_PER_PAGE,
    extras: Partial<SearchRequest>={}){
    return getElasticSearchClient().then(client => client.search<PartialTypedJurisprudenciaDocument>({
        index: JurisprudenciaVersion,
        query: {
            bool: {
                must: query,
                filter: filters.pre
            }
        },
        post_filter: { // Filter after aggregations
            bool: {
                filter: filters.after
            }
        },
        aggs: saggs,
        size: rpp,
        from: page*rpp,
        track_total_hits: true,
        _source: filterableProps.concat("Sumário"),
        ...extras // Allows 
    }))
}

const padZero = (num: number | string, size: number=4) => {
    let s = num.toString();
    while( s.length < size ){
        s = "0" + s;
    }
    return s;
}

export function populateFilters(filters: SearchFilters, body: Partial<Record<string, string | string[]>>={}, afters=["MinAno","MaxAno"]){
    const filtersUsed = {} as Record<string, string[]>;
    for( let key in aggs ){
        let aggName = key;
        let aggObj = aggs[key];
        let aggField = (aggObj.terms ? "terms" : "significant_terms") as keyof AggregationsAggregationContainer;
        if( !aggObj[aggField] ) continue;
        if( body[aggName] ){
            filtersUsed[aggName] = ((Array.isArray(body[aggName]) ? body[aggName] : [body[aggName]]) as string[]).filter(o => o.length > 0);
            let when = "pre" as keyof SearchFilters;
            if( afters.indexOf(aggName) != -1 ){
                when = "after" as keyof SearchFilters;
            }
            let fieldName = (aggObj[aggField] as AggregationsTermsAggregation).field!;
            let should = filtersUsed[aggName].filter(o => !o.startsWith("not:"))
            let must_not = filtersUsed[aggName].filter(o => o.startsWith("not:")).map(o => o.substring(4))
            filters[when].push({
                bool: {
                    should: should.map( o => (o.startsWith("\"") && o.endsWith("\"") ? {
                        term: {
                            [fieldName.replace("keyword","raw")]: { value: `${o.slice(1,-1)}` }
                        }
                    } : {
                        wildcard: {
                            [fieldName]: { value: `*${o}*` }
                        }
                    })),
                    must_not: must_not.map( o => (o.startsWith("\"") && o.endsWith("\"") ? {
                        term: {
                            [fieldName.replace("keyword","raw")]: { value: `${o.slice(1,-1)}` }
                        }
                    } : {
                        wildcard: {
                            [fieldName]: { value: `*${o}*` }
                        }
                    }))
                }
            });
        }
    }

    let dateWhen = "pre" as keyof SearchFilters;
    if( afters.indexOf("MinAno") >= 0 || afters.indexOf("MaxAno") >= 0 ) dateWhen = "after";
    let minAno = Array.isArray(body.MinAno) ? body.MinAno[0] : body.MinAno
    let maxAno = Array.isArray(body.MaxAno) ? body.MaxAno[0] : body.MaxAno

    if( minAno && maxAno ){

        filtersUsed.MinAno = [minAno];
        filtersUsed.MaxAno = [maxAno];
        filters[dateWhen].push({
            range: {
                [DATA_FIELD]: {
                    gte: padZero(minAno),
                    lt: padZero((parseInt(maxAno) || new Date().getFullYear())+1),
                    format: "yyyy"
                }
            }
        });
    }
    else if( minAno ){
        filtersUsed.MinAno = [minAno];
        filters[dateWhen].push({
            range: {
                [DATA_FIELD]: {
                    gte: padZero(minAno),
                    format: "yyyy"
                }
            }
        });
    }
    else if( maxAno ){
        filtersUsed.MaxAno = [maxAno];
        filters[dateWhen].push({
            range: {
                [DATA_FIELD]: {
                    lt: padZero((parseInt(maxAno) || new Date().getFullYear())+1),
                    format: "yyyy"
                }
            }
        });
    }
    if( body.notHasField ){
        filtersUsed.notHasField = (Array.isArray(body.notHasField) ? body.notHasField : [body.notHasField]).filter(o => o.length> 0);
        filtersUsed.notHasField.forEach(field => {
            filters.pre.push({
                bool: {
                    must_not: {
                        exists: {
                            field: field
                        }
                    }
                }
            });
        });
    }
    if( body.hasField ){
        filtersUsed.hasField = (Array.isArray(body.hasField) ? body.hasField : [body.hasField]).filter(o => o.length> 0);
        filtersUsed.hasField.forEach(field => {
            filters.pre.push({
                bool: {
                    must: {
                        exists: {
                            field: field
                        }
                    },
                    must_not: {
                        term: {
                            [field]: ""
                        }
                    }
                }
            });
        });
    }
    return filtersUsed;
}

export function parseSort(value: string | undefined, array: SortCombinations[]){
    const sortV = value || "des";
    if( sortV == "des" ){
        array.push({
            [DATA_FIELD]: { order: "desc" }
        });
    }
    else if( sortV == "asc" ){
        array.push({
            [DATA_FIELD]: { order: "asc" }
        });
    }
    else if( sortV == "score" ){
        array.push({
            _score: { order: "desc" }
        });
        array.push({
            [DATA_FIELD]: { order: "desc" }
        })
    }
    return sortV;
}

export function createQueryDslQueryContainer(string?: string | string[]): QueryDslQueryContainer | QueryDslQueryContainer[] {
    if( !string ){
        return {
            match_all: {}
        };
    }
    return [{
        simple_query_string: {
            query: Array.isArray(string) ? string.join(" ") : string,
            fields: ["*"],
            default_operator: 'OR'
        }
    }];
}


export function getSearchedArray(text: string){
    return getElasticSearchClient().then(c => c.indices.analyze({index: JurisprudenciaVersion, text: text})).then( r => r.tokens?.map( o => o.token ) || []).catch( e => [] as string[])
}

export function sortAlphabetically(a: string, b: string){
    if (a.startsWith("«") && !b.startsWith("«"))
        return 1;
    if (b.startsWith("«") && !a.startsWith("«"))
        return -1;
    let ak = a.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]*/, "");
    let bk = b.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]*/, "");
    return ak.localeCompare(bk);
}

export function sortBucketsAlphabetically(a: AggregationsStringTermsBucket,b: AggregationsStringTermsBucket) {
    return sortAlphabetically(a.key, b.key);
}