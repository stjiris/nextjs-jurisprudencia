import { canBeActive } from "@/types/keys";
import { Client } from "@elastic/elasticsearch";
import { AggregationsAggregate, AggregationsAggregationContainer, AggregationsStringTermsBucket, AggregationsTermsAggregation, QueryDslQueryContainer, SearchRequest, SearchResponse, SortCombinations } from "@elastic/elasticsearch/lib/api/types";
import { isJurisprudenciaDocumentGenericKey, JurisprudenciaDocument, JurisprudenciaDocumentDateKey, JurisprudenciaDocumentDateKeys, JurisprudenciaDocumentExactKeys, JurisprudenciaDocumentGenericKeys, JurisprudenciaDocumentKeys, JurisprudenciaDocumentProperties, JurisprudenciaDocumentStateValue, JurisprudenciaDocumentStateValues, JurisprudenciaDocumentTextKeys, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";

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
export const DEFAULT_RESULTS_PER_PAGE = 10;

export async function getElasticSearchClient() {
    return new Client({ node: process.env.ES_URL || "http://localhost:9200", auth: { username: "elastic", password: "elasticsearch" } })
}

export type SearchFilters = {
    pre: QueryDslQueryContainer[];
    after: QueryDslQueryContainer[];
};

export default async function search(
    query: QueryDslQueryContainer | QueryDslQueryContainer[],
    filters: SearchFilters = { pre: [], after: [] },
    page: number = 0,
    saggs: Record<string, AggregationsAggregationContainer> = DEFAULT_AGGS,
    rpp = DEFAULT_RESULTS_PER_PAGE,
    extras: Partial<SearchRequest> = {}, all: boolean = false): Promise<SearchResponse<JurisprudenciaDocument, Record<string, AggregationsAggregate>>> {

    const must = Array.isArray(query) ? query : [query];
    if (!all) {
        must.push({ terms: { STATE: _PUBLIC_STATES } })
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

    const isSafeForQueryString = (value: string): boolean => {
        const quoteCount = (value.match(/"/g) || []).length;
        return quoteCount % 2 === 0;
    };

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
            const shouldQueryString = should.join(" ");
            if (should.length && hasAdvanced(should) && isSafeForQueryString(shouldQueryString)) {
                filters[when].push({
                    query_string: {
                        query: shouldQueryString,
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
            const mustNotQueryString = must_not.join(" ");
            if (must_not.length && hasAdvanced(must_not) && isSafeForQueryString(mustNotQueryString)) {
                filters[when].push({
                    bool: {
                        must_not: [
                            {
                                query_string: {
                                    query: mustNotQueryString,
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
    if (afters.indexOf("MinDate") >= 0 || afters.indexOf("MaxDate") >= 0)
        dateWhen = "after";
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
            const [year, month, day] = minDate.split('-');
            const formattedMinDate = `${day}/${month}/${year}`;

            rangeQuery.range[DATA_FIELD].gte = formattedMinDate;
            filtersUsed.MinDate = [formattedMinDate];
        }
        if (maxDate) {
            const [year, month, day] = maxDate.split('-');
            const formattedMaxDate = `${day}/${month}/${year}`;

            rangeQuery.range[DATA_FIELD].lte = formattedMaxDate;
            filtersUsed.MaxDate = [formattedMaxDate];
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
    return filtersUsed;
}

export function parseSort(value: string | undefined, array: SortCombinations[]): string {
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
    const raw = Array.isArray(string) ? string.join(" ") : string;
    const query = raw.trim();
    if (!query) {
        return {
            match_all: {}
        };
    }

    const sumarioField = JurisprudenciaDocumentTextKeys.find(key => key === "Sumário") || "Sumário";
    const textoField = JurisprudenciaDocumentTextKeys.find(key => key === "Texto") || "Texto";
    const descritoresBase = JurisprudenciaDocumentGenericKeys.find(key => key === "Descritores") || "Descritores";
    const descritoresField = `${descritoresBase}.Index`;
    const numeroProcessoField = JurisprudenciaDocumentKeys.find(key => key === "Número de Processo") || "Número de Processo";

    const exactKeys = JurisprudenciaDocumentExactKeys.filter(key => key === "Número de Processo" || key === "ECLI");
    const genericKeys = JurisprudenciaDocumentGenericKeys.filter(key => key !== "Descritores");

    const metadataFields = [
        ...exactKeys.map(key => `${key}^100`),
        `${descritoresField}^50`,
        ...genericKeys.map(key => `${key}.Index^30`)
    ];

    const textFields = [
        `${sumarioField}^60`,
        `${textoField}^1`
    ];

    const caseNumberPattern = /^\d{1,7}\/\d{2}\.[0-9A-Z]{3,8}\.[0-9A-Z]{1,4}$/i;
    const metadataMultiMatch: QueryDslQueryContainer = {
        multi_match: {
            query,
            type: "best_fields",
            fields: metadataFields,
            fuzziness: "AUTO"
        }
    };

    const textMultiMatch: QueryDslQueryContainer = {
        multi_match: {
            query,
            type: "best_fields",
            fields: textFields,
            fuzziness: "AUTO"
        }
    };

    if (caseNumberPattern.test(query)) {
        return {
            bool: {
                should: [
                    {
                        match_phrase: {
                            [numeroProcessoField]: {
                                query,
                                boost: 10
                            }
                        }
                    },
                    metadataMultiMatch,
                    textMultiMatch
                ],
                minimum_should_match: 1
            }
        };
    }

    return {
        bool: {
            should: [
                {
                    match_phrase: {
                        [descritoresField]: {
                            query,
                            boost: 20
                        }
                    }
                },
                {
                    match_phrase: {
                        [sumarioField]: {
                            query,
                            boost: 20
                        }
                    }
                },
                metadataMultiMatch,
                textMultiMatch
            ],
            minimum_should_match: 1
        }
    };
}


export async function getSearchedArray(text: string): Promise<string[]> {
    try {
        const c = await getElasticSearchClient();
        const r = await c.indices.analyze({ index: JurisprudenciaVersion, text: text });
        return r.tokens?.map(o => o.token) || [];
    } catch (e) {
        return [] as string[];
    }
}

export async function getAutocompleteSuggestions(text: string): Promise<{ text: string, type: string }[]> {
    const queryText = text?.trim();
    if (!queryText) return [];

    const fieldDefs = [
        { key: "Descritores", field: `${JurisprudenciaDocumentGenericKeys.find(k => k === "Descritores") || "Descritores"}.Index` },
        { key: "Relator Nome Profissional", field: `${JurisprudenciaDocumentGenericKeys.find(k => k === "Relator Nome Profissional") || "Relator Nome Profissional"}.Index` },
        { key: "Área", field: `${JurisprudenciaDocumentGenericKeys.find(k => k === "Área") || "Área"}.Index` },
        { key: "Secção", field: `${JurisprudenciaDocumentGenericKeys.find(k => k === "Secção") || "Secção"}.Index` },
        { key: "Meio Processual", field: `${JurisprudenciaDocumentGenericKeys.find(k => k === "Meio Processual") || "Meio Processual"}.Index` },
        { key: "Votação", field: `${JurisprudenciaDocumentGenericKeys.find(k => k === "Votação") || "Votação"}.Index` }
    ];
    const escapedUpper = queryText.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const includePattern = `${escapedUpper}.*`;

    try {
        const client = await getElasticSearchClient();
        const response = await client.search<JurisprudenciaDocument, Record<string, AggregationsAggregate>>({
            index: JurisprudenciaVersion,
            size: 0,
            query: {
                bool: {
                    should: fieldDefs.map(({ field }) => ({
                        match_phrase_prefix: { [field]: { query: queryText } }
                    })),
                    minimum_should_match: 1
                }
            },
            aggs: {
                descritores: { terms: { field: `${fieldDefs[0].field}.keyword`, size: 10, include: includePattern } },
                relator: { terms: { field: `${fieldDefs[1].field}.keyword`, size: 10, include: includePattern } },
                area: { terms: { field: `${fieldDefs[2].field}.keyword`, size: 10, include: includePattern } },
                secao: { terms: { field: `${fieldDefs[3].field}.keyword`, size: 10, include: includePattern } },
                meioProcessual: { terms: { field: `${fieldDefs[4].field}.keyword`, size: 10, include: includePattern } },
                votacao: { terms: { field: `${fieldDefs[5].field}.keyword`, size: 10, include: includePattern } }
            }
        });

        const aggMap: Array<{ key: keyof typeof response.aggregations | string; type: string }> = [
            { key: "descritores", type: "Descritores" },
            { key: "relator", type: "Relator Nome Profissional" },
            { key: "area", type: "Área" },
            { key: "secao", type: "Secção" },
            { key: "meioProcessual", type: "Meio Processual" },
            { key: "votacao", type: "Votação" }
        ];

        const unique = new Map<string, { text: string; type: string }>();
        for (const { key, type } of aggMap) {
            const agg = (response.aggregations as Record<string, { buckets?: AggregationsStringTermsBucket[] }> | undefined)?.[key];
            const buckets = Array.isArray(agg?.buckets) ? agg!.buckets : [];
            for (const bucket of buckets) {
                if (typeof bucket.key === "string") {
                    const id = `${type}:${bucket.key}`;
                    if (!unique.has(id)) unique.set(id, { text: bucket.key, type });
                }
            }
        }

        return Array.from(unique.values()).slice(0, 30);
    } catch (e) {
        return [];
    }
}

export function sortAlphabetically(a: string, b: string): number {
    if (a.startsWith("«") && !b.startsWith("«"))
        return 1;
    if (b.startsWith("«") && !a.startsWith("«"))
        return -1;
    let ak = a.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]*/, "");
    let bk = b.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]*/, "");
    return ak.localeCompare(bk);
}

export function sortBucketsAlphabetically(a: AggregationsStringTermsBucket, b: AggregationsStringTermsBucket): number {
    return sortAlphabetically(a.key, b.key);
}