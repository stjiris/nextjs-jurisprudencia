import { AggregationsMaxAggregate, AggregationsMinAggregate, AggregationsStringTermsAggregate, AggregationsTermsAggregation, AggregationsTermsBucketBase, Indices, long, SearchTotalHits } from "@elastic/elasticsearch/lib/api/types";
import search, { createQueryDslQueryContainer, populateFilters, sortAlphabetically, sortBucketsAlphabetically } from "@/core/elasticsearch"
import { NextApiRequest, NextApiResponse } from "next";
import { IndicesProps, INDICES_OTHERS } from "@/types/indices";
import { listAggregation } from "@/components/indices-helpers";
import { getAllKeys } from "@/core/keys";
import { authenticatedHandler } from "@/core/user/authenticate";
import LoggerApi from "@/core/logger-api";

export default LoggerApi(async function indicesCsvHandler(
    req: NextApiRequest,
    res: NextApiResponse<IndicesProps>
) {
    const term = Array.isArray(req.query.term) ? req.query.term[0] : req.query.term || "Área";
    let group = "Secção";
    if ("group" in req.query) {
        group = Array.isArray(req.query.group) ? req.query.group[0] : req.query.group!;
    }

    const authed = await authenticatedHandler(req);
    let keys = await getAllKeys(authed);
    let canGroup = keys.find(k => k.key === group)?.indicesGroup;
    let canAggre = keys.find(k => k.key === term)?.indicesList;
    if (!canGroup) {
        group = "";
    }
    if (!canAggre) {
        return res.json({ termAggregation: { buckets: [] }, sortedGroup: [] })
    }

    const sfilters = { pre: [], after: [] };
    populateFilters(sfilters, req.query, []);
    const result = await search(createQueryDslQueryContainer(req.query.q), sfilters, 0, listAggregation(term, group), 0, {}, authed)


    let othersCount = 0;
    let groupObj = {} as Record<string, number>;
    let sortedGroup = [] as [string, number][];
    if (group) {
        let buckets = (result.aggregations![term] as AggregationsStringTermsAggregate).buckets;
        if (!Array.isArray(buckets)) throw new Error("Invalid bucket");
        buckets.forEach(buck => {
            othersCount += buck.Group.sum_other_doc_count
            let subbuckets = (buck.Group as AggregationsStringTermsAggregate).buckets;
            if (Array.isArray(subbuckets)) {
                subbuckets.forEach(s => groupObj[s.key] = (groupObj[s.key] || 0) + s.doc_count)
            }
        })
        buckets.sort(sortBucketsAlphabetically)
        sortedGroup = Object.entries(groupObj).sort((a, b) => sortAlphabetically(a[0], b[0]))
        sortedGroup.slice(10).forEach(a => othersCount += groupObj[a[0]])
        sortedGroup.splice(10)
        if (othersCount > 0) {
            sortedGroup.push([INDICES_OTHERS, othersCount])
        }
    }
    return res.json({
        termAggregation: result.aggregations![term] as AggregationsStringTermsAggregate,
        sortedGroup
    });
});
