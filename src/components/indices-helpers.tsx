import { aggs } from "@/core/elasticsearch";
import { AggregationsAggregationContainer } from "@elastic/elasticsearch/lib/api/types";

export function listAggregation(term: string, group?: string): Record<string, AggregationsAggregationContainer> {
    const termFieldName = aggs[term].terms?.field!;
    const groupFieldName = group ? aggs[group].terms?.field : null;
    const new_aggs = {
        MinAno: aggs.MinAno,
        MaxAno: aggs.MaxAno,
        [term]: {
            terms: {
                field: termFieldName.replace("keyword","raw"),
                size: 65536/5,
                order: {
                    _key: "asc",
                }
            },
            aggs: {
                MinAno: {
                    min: {
                        field: "Data"
                    }
                },
                MaxAno: {
                    max: {
                        field: "Data"
                    }
                }
            }
        }
    } as Record<string, AggregationsAggregationContainer>
    if( groupFieldName){
        new_aggs[term].aggs!.Group = {
            terms: {
                field: groupFieldName.replace("keyword","raw"),
                size: 10,
                min_doc_count: 1,
                order: {
                    _key: "desc"
                }
            }
        }
    }
    return new_aggs;
}