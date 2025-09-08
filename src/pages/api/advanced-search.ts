import search, { createQueryDslQueryContainer, filterableProps, parseSort, populateFilters, RESULTS_PER_PAGE } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import { HighlightFragment, SearchHandlerResponse } from '@/types/search';
import { SearchHighlight, SortCombinations } from '@elastic/elasticsearch/lib/api/types';
import { JurisprudenciaDocumentKey } from '@stjiris/jurisprudencia-document';
import type { NextApiRequest, NextApiResponse } from 'next';

const useSource: JurisprudenciaDocumentKey[] = [
  "ECLI", "Número de Processo", "UUID", "Data", "Área", "Meio Processual", 
  "Relator Nome Profissional", "Secção", "Votação", "Decisão", "Descritores", 
  "Sumário", "Texto", "STATE"
];

export default LoggerApi(async function advancedSearchHandler(
  req: NextApiRequest,
  res: NextApiResponse<SearchHandlerResponse>
) {
  const sfilters = { pre: [], after: [] };
  populateFilters(sfilters, req.query);
  
  const sort: SortCombinations[] = [];
  parseSort(Array.isArray(req.query?.sort) ? req.query.sort[0] : req.query.sort, sort);
  
  const page = parseInt(Array.isArray(req.query.page) ? req.query.page[0] : req.query.page || "") || 0;
  const queryObj = createQueryDslQueryContainer(req.query.q);
  
  // Add advanced filters
  const advancedFilters = req.query.advancedFilters;
  if (advancedFilters && typeof advancedFilters === 'string') {
    try {
      const filters = JSON.parse(advancedFilters);
      Object.entries(filters).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          (sfilters.pre as any[]).push({
            term: {
              [key]: value
            }
          });
        }
      });
    } catch (error) {
      console.error('Error parsing advanced filters:', error);
    }
  }
  
  const highlight: SearchHighlight = {
    fields: {
      "Descritores.Show": {
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
  };
  
  const authed = await authenticatedHandler(req);
  
  // Read rpp (results per page) from query, support 'all' as a special value
  let rpp = 10;
  if (typeof req.query.rpp === 'string') {
    if (req.query.rpp === 'all') {
      rpp = 10000; // Arbitrary high number for 'all'
    } else {
      const parsed = parseInt(req.query.rpp);
      if (!isNaN(parsed) && parsed > 0) rpp = parsed;
    }
  }
  
  const result = await search(
    queryObj, 
    sfilters, 
    page, 
    {}, 
    rpp, 
    { sort, highlight, track_scores: true, _source: useSource }, 
    authed
  );
  
  const r: SearchHandlerResponse = [];
  
  for (let hit of result.hits.hits) {
    const { Texto, "Relator Nome Completo": _completo, HASH: _HASH, ...rest } = hit._source!;
    
    if (hit.highlight) {
      let highlight: Record<string, (string | HighlightFragment)[]> = {
        Descritores: hit.highlight["Descritores.Show"],
        Sumário: hit.highlight.Sumário
      };
      
      let SumárioMarks = undefined;
      if (hit.highlight.Sumário) {
        SumárioMarks = [] as HighlightFragment[];
        let it = hit.highlight.Sumário[0].matchAll(/[^>]{0,100}<mark>(\w+)<\/mark>[^<]{0,100}/g);
        if (it) {
          for (let m of it) {
            let mat = m[1] || "";
            SumárioMarks.push({
              textFragment: m[0],
              textMatch: mat,
              offset: m.index || 0,
              size: hit._source?.Sumário?.length || 0
            });
          }
        }
        highlight.SumárioMarks = SumárioMarks;
      }

      if (hit.highlight.Texto) {
        highlight.Texto = [];
        for (let i = 0; i < hit.highlight.Texto.length; i++) {
          let text = hit.highlight.Texto[i];
          let mat = text.match(/MARK_START(.*?)MARK_END/)?.[1] || "";
          highlight.Texto.push({
            textFragment: text.replace(/<[^>]+>/g, "").replace(/MARK_START/g, "<mark>").replace(/MARK_END/g, "</mark>").replace(/<\/?\w*$/, ""),
            textMatch: mat,
            offset: hit._source?.Texto?.indexOf(text.substring(0, text.indexOf("MARK_START"))) || 0,
            size: hit._source?.Texto?.length || 0,
          });
        }
      }

      r.push({
        highlight,
        _source: rest,
        score: hit._score || 1,
        max_score: result.hits.max_score || 1
      });
    } else {
      r.push({
        _source: rest,
        score: hit._score || 1,
        max_score: result.hits.max_score || 1
      });
    }
  }

  res.status(200).json(r);
}); 