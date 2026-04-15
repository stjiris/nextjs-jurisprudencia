import { canBeActive } from "@/types/keys";
import { Client } from "@elastic/elasticsearch";
import { AggregationsAggregate, AggregationsAggregationContainer, AggregationsStringTermsBucket, AggregationsTermsAggregation, QueryDslQueryContainer, SearchRequest, SearchResponse, SortCombinations } from "@elastic/elasticsearch/lib/api/types";
import { isJurisprudenciaDocumentGenericKey, JurisprudenciaDocument, JurisprudenciaDocumentDateKey, JurisprudenciaDocumentDateKeys, JurisprudenciaDocumentKeys, JurisprudenciaDocumentProperties, JurisprudenciaDocumentStateValue, JurisprudenciaDocumentStateValues, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";

export const filterableProps = JurisprudenciaDocumentKeys.filter(canBeActive);

// Expand a MinDate param (YYYY | YYYY-MM | YYYY-MM-DD) to dd/MM/yyyy for Elasticsearch gte
function expandMinDate(date: string): string {
    if (/^\d{4}$/.test(date))       return `01/01/${date}`;
    if (/^\d{4}-\d{2}$/.test(date)) { const [y, m] = date.split("-"); return `01/${m}/${y}`; }
    const [year, month, day] = date.split("-"); return `${day}/${month}/${year}`;
}

// Expand a MaxDate param (YYYY | YYYY-MM | YYYY-MM-DD) to dd/MM/yyyy for Elasticsearch lte
function expandMaxDate(date: string): string {
    if (/^\d{4}$/.test(date))       return `31/12/${date}`;
    if (/^\d{4}-\d{2}$/.test(date)) {
        const [y, m] = date.split("-");
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
        return `${lastDay}/${m}/${y}`;
    }
    const [year, month, day] = date.split("-"); return `${day}/${month}/${year}`;
}

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
            format: "yyyy"
        }
    },
    MaxAno: {
        max: {
            field: DATA_FIELD,
            format: "yyyy"
        }
    }
} as Record<string, AggregationsAggregationContainer>;
filterableProps.forEach((name) => {
    let key = name;
    if (isJurisprudenciaDocumentGenericKey(name)) {
        key += ".Index.keyword";
    }
    aggs[name] = {
        terms: {
            field: key,
            size: 65536,
            order: {
                _key: "asc"
            }
        }
    };
});

export const DEFAULT_AGGS = {
    MaxAno: aggs.MaxAno,
    MinAno: aggs.MinAno
};
export const DEFAULT_RESULTS_PER_PAGE = 10;

const _esClient = new Client({ node: process.env.ES_URL || "http://localhost:9200", auth: { username: "elastic", password: "elasticsearch" }, sniffOnStart: false, sniffOnConnectionFault: false, sniffInterval: false });

export async function getElasticSearchClient() {
    return _esClient;
}

export type SearchFilters = {
    pre: QueryDslQueryContainer[];
    after: QueryDslQueryContainer[];
};

export default async function search(query: QueryDslQueryContainer | QueryDslQueryContainer[], filters: SearchFilters = { pre: [], after: [] }, page: number = 0, saggs: Record<string, AggregationsAggregationContainer> = DEFAULT_AGGS, rpp = DEFAULT_RESULTS_PER_PAGE, extras: Partial<SearchRequest> = {}, all: boolean = false): Promise<SearchResponse<JurisprudenciaDocument, Record<string, AggregationsAggregate>>> {
    const must = Array.isArray(query) ? query : [query];
    if (!all) {
        must.push({ terms: { STATE: _PUBLIC_STATES } });
    }
    const client = await getElasticSearchClient();
    return await client.search<JurisprudenciaDocument>({
        index: JurisprudenciaVersion,
        query: {
            bool: {
                must: must,
                filter: filters.pre
            }
        },
        post_filter: {
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
    });
}

export function padZero(num: number | string, size: number = 4): string {
    let s = num.toString();
    while (s.length < size) {
        s = "0" + s;
    }
    return s;
}

export function populateFilters(filters: SearchFilters, body: Partial<Record<string, string | string[]>> = {}, afters = ["MinDate", "MaxDate"]) {
    const filtersUsed = {} as Record<string, string[]>;
    for (let key in aggs) {
        let aggName = key;
        let aggObj = aggs[key];
        let aggField = (aggObj.terms ? "terms" : "significant_terms") as keyof AggregationsAggregationContainer;
        if (!aggObj[aggField]) continue;
        if (body[aggName]) {
            filtersUsed[aggName] = ((Array.isArray(body[aggName]) ? body[aggName] : [body[aggName]]) as string[]).filter((o) => o.length > 0);
            let when = "pre" as keyof SearchFilters;
            if (afters.indexOf(aggName) != -1) {
                when = "after" as keyof SearchFilters;
            }
            let fieldName = (aggObj[aggField] as AggregationsTermsAggregation).field!;
            let must_include = filtersUsed[aggName].filter((o) => !o.startsWith("not:") && !o.startsWith("or:"));
            let or_include = filtersUsed[aggName].filter((o) => o.startsWith("or:")).map((o) => o.substring(3));
            let must_not = filtersUsed[aggName].filter((o) => o.startsWith("not:")).map((o) => o.substring(4));
            let must_or_should = !isJurisprudenciaDocumentGenericKey(aggName) || body["_should"]?.includes(aggName) ? "should" : "must";

            // Detect advanced operators in any value
            const hasAdvanced = (arr: string[]) => arr.some((v) => /[\(\)\"\bAND\b|\bOR\b|\bNOT\b]/i.test(v));
            const asciiFold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const termClause = (fieldName: string, o: string) => {
                if (o.startsWith('"') && o.endsWith('"')) {
                    // Exact match: use keyword field so the normalizer is applied automatically
                    return { term: { [fieldName]: { value: o.slice(1, -1) } } };
                }
                // Wildcard: strip accents from the pattern to match the asciifolding normalizer on stored values
                const pattern = fieldName.endsWith('.keyword') ? asciiFold(o) : o;
                return { wildcard: { [fieldName]: { value: `*${pattern}*`, case_insensitive: true } } };
            };

            if (must_include.length && hasAdvanced(must_include)) {
                filters[when].push({
                    query_string: { query: must_include.join(" "), fields: [fieldName], default_operator: "OR" }
                });
            } else if (must_include.length) {
                filters[when].push({ bool: { [must_or_should]: must_include.map(o => termClause(fieldName, o)) } });
            }

            if (or_include.length && hasAdvanced(or_include)) {
                filters[when].push({
                    query_string: { query: or_include.join(" OR "), fields: [fieldName], default_operator: "OR" }
                });
            } else if (or_include.length) {
                filters[when].push({ bool: { should: or_include.map(o => termClause(fieldName, o)), minimum_should_match: 1 } });
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
                filters[when].push({ bool: { must_not: must_not.map(o => termClause(fieldName, o)) } });
            }
        }
    }

    let dateWhen = "pre" as keyof SearchFilters;
    if (afters.indexOf("MinDate") >= 0 || afters.indexOf("MaxDate") >= 0) dateWhen = "after";

    let minDate = Array.isArray(body.MinDate) ? body.MinDate[0] : body.MinDate;
    let maxDate = Array.isArray(body.MaxDate) ? body.MaxDate[0] : body.MaxDate;

    if (minDate || maxDate) {
        const rangeQuery: any = {
            range: {
                [DATA_FIELD]: {
                    format: "dd/MM/yyyy"
                }
            }
        };
        if (minDate) {
            rangeQuery.range[DATA_FIELD].gte = expandMinDate(minDate);
            filtersUsed.MinDate = [minDate];
        }
        if (maxDate) {
            rangeQuery.range[DATA_FIELD].lte = expandMaxDate(maxDate);
            filtersUsed.MaxDate = [maxDate];
        }
        filters[dateWhen].push(rangeQuery);
    }

    if (body.notHasField) {
        filtersUsed.notHasField = (Array.isArray(body.notHasField) ? body.notHasField : [body.notHasField]).filter((o) => o.length > 0);
        filtersUsed.notHasField.forEach((field) => {
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
        filtersUsed.hasField = (Array.isArray(body.hasField) ? body.hasField : [body.hasField]).filter((o) => o.length > 0);
        filtersUsed.hasField.forEach((field) => {
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
    return filtersUsed;
}

export function parseSort(value: string | undefined, array: SortCombinations[]): string {
    const sortV = value || "des";
    if (sortV == "des") {
        array.push({
            [DATA_FIELD]: { order: "desc" }
        });
    } else if (sortV == "asc") {
        array.push({
            [DATA_FIELD]: { order: "asc" }
        });
    } else if (sortV == "score") {
        array.push({
            _score: { order: "desc" }
        });
        array.push({
            [DATA_FIELD]: { order: "desc" }
        });
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
    return [
        {
            query_string: {
                query: Array.isArray(string) ? string.join(" ") : string,
                fields: ["*"]
            }
        }
    ];
}

export async function getSearchedArray(text: string): Promise<string[]> {
    try {
        const c = await getElasticSearchClient();
        const r = await c.indices.analyze({ index: JurisprudenciaVersion, text: text });
        return r.tokens?.map((o) => o.token) || [];
    } catch (e) {
        return [] as string[];
    }
}

export function sortAlphabetically(a: string, b: string): number {
    if (a.startsWith("«") && !b.startsWith("«")) return 1;
    if (b.startsWith("«") && !a.startsWith("«")) return -1;
    let ak = a.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]*/, "");
    let bk = b.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]*/, "");
    return ak.localeCompare(bk);
}

export function sortBucketsAlphabetically(a: AggregationsStringTermsBucket, b: AggregationsStringTermsBucket): number {
    return sortAlphabetically(a.key, b.key);
}
