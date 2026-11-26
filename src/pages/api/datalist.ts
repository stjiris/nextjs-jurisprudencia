import search, { aggs, asciiFold, createQueryDslQueryContainer, getElasticSearchClient, populateFilters, SearchFilters, sortAlphabetically, sortBucketsAlphabetically } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import { DatalistObj } from '@/types/search';
import { AggregationsAggregationContainer, AggregationsStringTermsAggregate, QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import { JurisprudenciaVersion } from '@stjiris/jurisprudencia-document';
import type { NextApiRequest, NextApiResponse } from 'next'
import { CANONICAL_SECCAO_NAMES, mergeSeccaoBuckets, getSeccaoVariants } from '@/core/seccao-util';

const CROSS_FIELD_SECCAO_FROM_AREA = ["Formação", "Conflitos"] as const;

function buildFieldVariantClauses(rawField: string, keywordField: string, variants: string[]) {
    return variants.flatMap(v => [
        { term: { [rawField]: { value: v } } },
        { term: { [keywordField]: { value: v } } },
        { term: { [keywordField]: { value: asciiFold(v).toLowerCase() } } },
        { term: { [keywordField]: { value: asciiFold(v).toUpperCase() } } },
        { term: { [keywordField]: { value: v, case_insensitive: true } } },
    ]);
}

function buildAreaFallbackFilter(canonicalName: string): QueryDslQueryContainer {
    const variants = getSeccaoVariants(canonicalName);
    const areaShould = buildFieldVariantClauses("Área.Index.raw", "Área.Index.keyword", variants);
    const seccaoShould = buildFieldVariantClauses("Secção.Index.raw", "Secção.Index.keyword", variants);
    return {
        bool: {
            should: areaShould,
            minimum_should_match: 1,
            must_not: [{
                bool: {
                    should: seccaoShould,
                    minimum_should_match: 1,
                },
            }],
        },
    };
}

// ES terms-agg `include` uses Lucene's RegExp, which does NOT support the (?i)
// inline flag (it matches literally and returns nothing). The aggregation runs on
// the case-preserving `.raw` field, so to get a case-insensitive "contains" match
// we expand each ASCII letter into a [aA] class and escape Lucene regexp
// metacharacters on everything else.
function caseInsensitiveContains(prefix: string): string {
    const expanded = Array.from(prefix).map(ch => {
        if (/[a-zA-Z]/.test(ch)) return `[${ch.toLowerCase()}${ch.toUpperCase()}]`;
        if (/[.?+*|{}[\]()"\\#@&<>~]/.test(ch)) return `\\${ch}`;
        return ch;
    }).join("");
    return `.*${expanded}.*`;
}

export default LoggerApi(async function datalistHandler(
    req: NextApiRequest,
    res: NextApiResponse<DatalistObj[]>
) {
    let aggKey = Array.isArray(req.query.agg) ? req.query.agg[0] : req.query.agg || "";
    let client = await getElasticSearchClient();
    if (aggKey == "Campos") {
        return client.indices.getMapping({ index: JurisprudenciaVersion }).then(body => {
            let datalist = Object.keys(body[JurisprudenciaVersion].mappings.properties || {}).map(k => ({ key: k }))
            return res.json(datalist)
        });
    }

    let agg = aggs[aggKey];
    if (!agg) {
        return res.status(404).json([]);;
    }
    const prefix = Array.isArray(req.query.prefix) ? req.query.prefix[0] : req.query.prefix;
    const isSeccao = aggKey === "Secção";
    let finalAgg: AggregationsAggregationContainer = {
        terms: {
            field: agg.terms?.field?.replace("keyword", "raw"),
            size: isSeccao ? 500 : (prefix ? 20 : 50),
            order: {
                _key: "asc"
            },
            ...(!isSeccao && prefix ? { include: caseInsensitiveContains(prefix) } : {})
        }
    }
    const sfilters = { pre: [], after: [] } as SearchFilters;
    populateFilters(sfilters, req.query, [aggKey]);
    const authed = await authenticatedHandler(req);
    const saggs: Record<string, AggregationsAggregationContainer> = {
        [aggKey]: finalAgg,
        ...(isSeccao ? {
            _seccao_from_area: {
                filters: {
                    filters: Object.fromEntries(
                        CROSS_FIELD_SECCAO_FROM_AREA.map(name => [name, buildAreaFallbackFilter(name)])
                    ),
                },
            },
        } : {}),
    };
    return search(createQueryDslQueryContainer(req.query.q), sfilters, 0, saggs, 10, {}, authed).then(body => {
        if (!body.aggregations || !body.aggregations[aggKey] || !("buckets" in body.aggregations[aggKey])) throw new Error("Invalid aggregation result")

        let buckets = (body.aggregations[aggKey] as AggregationsStringTermsAggregate).buckets
        if (!Array.isArray(buckets)) throw new Error("Invalid aggregation bucket result");

        if (isSeccao) {
            const combinedBuckets: { key: string | number; doc_count?: number }[] = [...buckets];
            const areaFallback = (body.aggregations._seccao_from_area as { buckets?: Record<string, { doc_count?: number }> } | undefined)?.buckets;
            if (areaFallback) {
                for (const [name, b] of Object.entries(areaFallback)) {
                    if ((b?.doc_count || 0) > 0) {
                        combinedBuckets.push({ key: name, doc_count: b.doc_count });
                    }
                }
            }
            let merged = mergeSeccaoBuckets(combinedBuckets);
            const existingKeys = new Set(merged.map(m => m.key));
            for (const canonical of CANONICAL_SECCAO_NAMES) {
                if (!existingKeys.has(canonical)) {
                    merged.push({ key: canonical, count: 0 });
                }
            }
            if (prefix) {
                const pfxLower = prefix.toLowerCase();
                merged = merged.filter(item => {
                    if (item.key.toLowerCase().includes(pfxLower)) return true;
                    const variants = getSeccaoVariants(item.key);
                    return variants.some(v => v.toLowerCase().includes(pfxLower));
                });
            }
            merged.sort((a, b) => sortAlphabetically(a.key, b.key));
            return res.json(merged);
        }

        return res.json(buckets.sort(sortBucketsAlphabetically).map(({ key, doc_count }) => ({ key: key.toString(), count: doc_count })));
    }).catch(err => {
        console.error(err);
        return res.status(500).json([]);
    });
});
