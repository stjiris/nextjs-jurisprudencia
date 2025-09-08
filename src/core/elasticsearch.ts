import { canBeActive } from "@/types/keys";
import { Client } from "@elastic/elasticsearch";
import { AggregationsAggregationContainer, AggregationsStringTermsBucket, AggregationsTermsAggregation, QueryDslQueryContainer, SearchRequest, SortCombinations } from "@elastic/elasticsearch/lib/api/types";
import { isJurisprudenciaDocumentGenericKey, JurisprudenciaDocument, JurisprudenciaDocumentDateKey, JurisprudenciaDocumentDateKeys, JurisprudenciaDocumentKeys, JurisprudenciaDocumentProperties, JurisprudenciaDocumentStateValue, JurisprudenciaDocumentStateValues, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";

export const filterableProps = JurisprudenciaDocumentKeys.filter(canBeActive);

const DATA_FIELD: JurisprudenciaDocumentDateKey = "Data";
const ENV_PUBLIC_STATES = process.env.PUBLIC_STATES?.trim().split(",") || [];
const _PUBLIC_STATES: JurisprudenciaDocumentStateValue[] = [];
for (let state of ENV_PUBLIC_STATES) {
    if (JurisprudenciaDocumentStateValues.includes(state as JurisprudenciaDocumentStateValue)) {
        _PUBLIC_STATES.push(state as JurisprudenciaDocumentStateValue);
    }
}

export const PUBLIC_STATES = [..._PUBLIC_STATES];

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
    if (isJurisprudenciaDocumentGenericKey(name)) {
        key += ".Index.keyword"
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
    MaxAno: aggs.MaxAno,
    MinAno: aggs.MinAno
};
export const RESULTS_PER_PAGE = 10;

export async function getElasticSearchClient() {
    return new Client({ node: process.env.ES_URL || "http://localhost:9200", auth: { username: "elastic", password: "elasticsearch" } })
}

export type SearchFilters = {
    pre: QueryDslQueryContainer[];
    after: QueryDslQueryContainer[];
};

export default function search(
    query: QueryDslQueryContainer | QueryDslQueryContainer[],
    filters: SearchFilters = { pre: [], after: [] },
    page: number = 0,
    saggs: Record<string, AggregationsAggregationContainer> = DEFAULT_AGGS,
    rpp = RESULTS_PER_PAGE,
    extras: Partial<SearchRequest> = {}, all: boolean = false) {
    const must = Array.isArray(query) ? query : [query];
    if (!all) {
        must.push({ terms: { STATE: _PUBLIC_STATES } })
    }
    return getElasticSearchClient().then(client => client.search<JurisprudenciaDocument>({
        index: JurisprudenciaVersion,
        query: {
            bool: {
                must: must,
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
        from: page * rpp,
        track_total_hits: true,
        _source: (filterableProps as any[]).concat("Sumário"),
        ...extras // Allows 
    }))
}

export const padZero = (num: number | string, size: number = 4) => {
    let s = num.toString();
    while (s.length < size) {
        s = "0" + s;
    }
    return s;
}

export function populateFilters(filters: SearchFilters, body: Partial<Record<string, string | string[]>> = {}, afters = ["MinAno", "MaxAno"]) {
    const filtersUsed = {} as Record<string, string[]>;
    for (let key in aggs) {
        let aggName = key;
        let aggObj = aggs[key];
        let aggField = (aggObj.terms ? "terms" : "significant_terms") as keyof AggregationsAggregationContainer;
        if (!aggObj[aggField]) continue;
        if (body[aggName]) {
            filtersUsed[aggName] = ((Array.isArray(body[aggName]) ? body[aggName] : [body[aggName]]) as string[]).filter(o => o.length > 0);
            let when = "pre" as keyof SearchFilters;
            if (afters.indexOf(aggName) != -1) {
                when = "after" as keyof SearchFilters;
            }
            let fieldName = (aggObj[aggField] as AggregationsTermsAggregation).field!;
            let should = filtersUsed[aggName].filter(o => !o.startsWith("not:"))
            let must_not = filtersUsed[aggName].filter(o => o.startsWith("not:")).map(o => o.substring(4))
            let must_or_should = !isJurisprudenciaDocumentGenericKey(aggName) || body["_should"]?.includes(aggName) ? "should" : "must"  // AND or OR - if a signle value use alawys OR else default OR but flag for AND

            // Detect advanced operators in any value
            const hasAdvanced = (arr: string[]) => arr.some(v => /[\(\)\"\bAND\b|\bOR\b|\bNOT\b]/i.test(v));
            if (should.length && hasAdvanced(should)) {
                filters[when].push({
                    query_string: {
                        query: should.join(" "),
                        fields: [fieldName],
                        default_operator: "OR"
                    }
                });
            } else if (should.length) {
            filters[when].push({
                bool: {
                        [must_or_should]: should.map(o => (o.startsWith("\"") && o.endsWith("\"")) ? {
                        term: {
                            [fieldName.replace("keyword", "raw")]: { value: `${o.slice(1, -1)}` }
                        }
                    } : {
                        wildcard: {
                            [fieldName]: { value: `*${o}*` }
                        }
                        }),
                    }
                });
            }
            if (must_not.length && hasAdvanced(must_not)) {
                filters[when].push({
                    bool: {
                        must_not: [
                            {
                                query_string: {
                                    query: must_not.join(" "),
                                    fields: [fieldName],
                                    default_operator: "OR"
                                }
                            }
                        ]
                    }
                });
            } else if (must_not.length) {
                filters[when].push({
                    bool: {
                        must_not: must_not.map(o => (o.startsWith("\"") && o.endsWith("\"")) ? {
                        term: {
                            [fieldName.replace("keyword", "raw")]: { value: `${o.slice(1, -1)}` }
                        }
                    } : {
                        wildcard: {
                            [fieldName]: { value: `*${o}*` }
                        }
                        })
                }
            });
            }
        }
    }

    let dateWhen = "pre" as keyof SearchFilters;
    if (afters.indexOf("MinAno") >= 0 || afters.indexOf("MaxAno") >= 0) dateWhen = "after";
    let minAno = Array.isArray(body.MinAno) ? body.MinAno[0] : body.MinAno
    let maxAno = Array.isArray(body.MaxAno) ? body.MaxAno[0] : body.MaxAno

    if (minAno || maxAno) {
        const rangeQuery: any = {
            range: {
                [DATA_FIELD]: {
                    format: "yyyy-MM-dd||dd/MM/yyyy"
                }
            }
        };
        if (minAno) {
            rangeQuery.range[DATA_FIELD].gte = minAno;
        filtersUsed.MinAno = [minAno];
        }
        if (maxAno) {
            rangeQuery.range[DATA_FIELD].lte = maxAno;
        filtersUsed.MaxAno = [maxAno];
                }
        filters[dateWhen].push(rangeQuery);
    }
    
    if (body.notHasField) {
        filtersUsed.notHasField = (Array.isArray(body.notHasField) ? body.notHasField : [body.notHasField]).filter(o => o.length > 0);
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
    if (body.hasField) {
        filtersUsed.hasField = (Array.isArray(body.hasField) ? body.hasField : [body.hasField]).filter(o => o.length > 0);
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
    if (body.mustHaveText) {
        filtersUsed.mustHaveText = ["true"];
        filters.pre.push({
            bool: {
                must: {
                    exists: {
                        field: "Texto"
                    }
                }
            }
        });
    }
    //Lógica backend do calendário
    if (body.DataExata) {
        const selectedDate = Array.isArray(body.DataExata) ? body.DataExata[0] : body.DataExata;
        if (selectedDate) {
            // Converter yyyy-MM-dd para dd/MM/yyyy 
            const [year, month, day] = selectedDate.split('-');
            const formattedDate = `${day}/${month}/${year}`;
            filtersUsed["Data"] = [formattedDate];
            filters.pre.push({
                term: {
                    [DATA_FIELD]: formattedDate
                }
            });
        }
    }
    return filtersUsed;
}

export function parseSort(value: string | undefined, array: SortCombinations[]) {
    const sortV = value || "des";
    if (sortV == "des") {
        array.push({
            [DATA_FIELD]: { order: "desc" }
        });
    }
    else if (sortV == "asc") {
        array.push({
            [DATA_FIELD]: { order: "asc" }
        });
    }
    else if (sortV == "score") {
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
    if (!string) {
        return {
            match_all: {}
        };
    }
    // Use query_string to support AND, OR, NOT, and parentheses in free text search
    return [{
        query_string: {
            query: Array.isArray(string) ? string.join(" ") : string,
            fields: ["*"]
        }
    }];
}


export function getSearchedArray(text: string) {
    return getElasticSearchClient().then(c => c.indices.analyze({ index: JurisprudenciaVersion, text: text })).then(r => r.tokens?.map(o => o.token) || []).catch(e => [] as string[])
}

export function sortAlphabetically(a: string, b: string) {
    if (a.startsWith("«") && !b.startsWith("«"))
        return 1;
    if (b.startsWith("«") && !a.startsWith("«"))
        return -1;
    let ak = a.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]*/, "");
    let bk = b.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]*/, "");
    return ak.localeCompare(bk);
}

export function sortBucketsAlphabetically(a: AggregationsStringTermsBucket, b: AggregationsStringTermsBucket) {
    return sortAlphabetically(a.key, b.key);
}