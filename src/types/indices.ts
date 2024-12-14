import { AggregationsStringTermsAggregate } from "@elastic/elasticsearch/lib/api/types"

export const INDICES_OTHERS = "[Outros]"

export interface IndicesProps{
    termAggregation: AggregationsStringTermsAggregate
    sortedGroup: [string, number][]
}