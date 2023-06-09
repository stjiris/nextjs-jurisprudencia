// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import search, { createQueryDslQueryContainer, filterableProps, parseSort, populateFilters, RESULTS_PER_PAGE } from '@/core/elasticsearch';
import { JurisprudenciaDocument, Properties } from '@/core/jurisprudencia'
import { HighlightFragment, SearchHandlerResponse } from '@/types/search';
import { AggregationsAggregate, SearchHighlight, SearchHit, SearchResponse, SortCombinations } from '@elastic/elasticsearch/lib/api/types';
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function searchHandler(
  req: NextApiRequest,
  res: NextApiResponse<SearchHandlerResponse>
) {
    const sfilters = {pre: [], after: []};
    populateFilters(sfilters, req.query)
    const sort: SortCombinations[] = [];
    parseSort(Array.isArray(req.query?.sort) ? req.query.sort[0] : req.query.sort, sort)
    const page = parseInt(Array.isArray(req.query.page) ? req.query.page[0] : req.query.page || "" ) || 0
    const queryObj = createQueryDslQueryContainer(req.query.q);
    const highlight: SearchHighlight = {
        fields: {
            "Descritores": {
                type: "unified",
                highlight_query: {
                    bool: {
                        must: queryObj
                    }
                },
                pre_tags: [""],
                post_tags: [""],
                number_of_fragments: 0           
            },
            "Sumário": {
                type: "fvh",
                highlight_query: {
                    bool: {
                        must: queryObj
                    }
                },
                number_of_fragments: 0,
                pre_tags: ["<mark>"],
                post_tags: ["</mark>"]
            },
            "Texto": { 
                type: "fvh",
                highlight_query: {
                    bool: {
                        must: queryObj
                    }
                },
                number_of_fragments: 1000,
                pre_tags: ["MARK_START"],
                post_tags: ["MARK_END"]
            }
        },
        max_analyzed_offset: 1000000
    }
    const result = await search(queryObj, sfilters, page, {}, RESULTS_PER_PAGE, {sort, highlight, track_scores: true, _source: [...filterableProps, "Data", "Sumário", "Texto"]})
    const r: SearchHandlerResponse = [];
    for( let hit of result.hits.hits ){
        const {Texto, "Relator Nome Completo": _completo, HASH: _HASH, ...rest} = hit._source!
        if(hit.highlight){
            let highlight: Record<string, (string | HighlightFragment)[]> = {
                Descritores: hit.highlight.Descritores,
                Sumário: hit.highlight.Sumário
            };
            let SumárioMarks = undefined;
            if( hit.highlight.Sumário ){
                SumárioMarks = [] as HighlightFragment[];
                let it = hit.highlight.Sumário[0].matchAll(/[^>]{0,100}<mark>(?<mat>\w+)<\/mark>[^<]{0,100}/g)
                if( it ){
                    for( let m of it ){
                        let mat = m.groups?.mat || ""
                        SumárioMarks.push({
                            textFragment: m[0],
                            textMatch: mat,
                            offset: m.index || 0,
                            size: hit._source?.Sumário.length
                        })
                    }
                }
                highlight.SumárioMarks = SumárioMarks;
            }

            if( hit.highlight.Texto ){
                highlight.Texto = []
                for(let i = 0; i < hit.highlight.Texto.length; i++){
                    let text = hit.highlight.Texto[i];
                    let mat = text.match(/MARK_START(?<mat>.*?)MARK_END/)?.groups?.mat || "";
                    highlight.Texto.push({
                        textFragment: text.replace(/<[^>]+>/g, "").replace(/MARK_START/g, "<mark>").replace(/MARK_END/g, "</mark>").replace(/<\/?\w*$/, ""),
                        textMatch: mat,
                        offset: hit._source?.Texto.indexOf(text.substring(0, text.indexOf("MARK_START"))) || 0,
                        size: hit._source?.Texto.length || 0,
                    })
                }
            }

            r.push({
                highlight,
                _source: rest,
                score: hit._score || 1,
                max_score: result.hits.max_score || 1
            })
        }
        else{
            r.push({
                _source: rest,
                score: hit._score || 1,
                max_score: result.hits.max_score || 1
            })
        }
    }


    res.status(200).json(r);

}
