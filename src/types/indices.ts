import { AggregationsStringTermsAggregate } from "@elastic/elasticsearch/lib/api/types"

export const INDICES_OTHERS = "[Outros]"

export interface IndicesProps{
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