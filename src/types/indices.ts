import { AggregationsStringTermsAggregate } from "@elastic/elasticsearch/lib/api/types"

export const INDICES_OTHERS = "[Outros]"

export interface IndicesNewProps{
    termAggregation: AggregationsStringTermsAggregate
    sortedGroup: [string, number][]
}