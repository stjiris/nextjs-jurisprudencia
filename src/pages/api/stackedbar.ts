import search, { aggs, createQueryDslQueryContainer, getElasticSearchClient, populateFilters, SearchFilters } from '@/core/elasticsearch';
import { long, SearchTotalHits } from '@elastic/elasticsearch/lib/api/types';
import type { NextApiRequest, NextApiResponse } from 'next';
//import '@/styles/vis.css'
export function barChartAggregation(termsList: string[], termAreaChart: string | string[] | undefined, selectedArea?: string | string[] | undefined): Record<string, any> {
    const currAggs: Record<string, any> = {};
    termsList.forEach((term) => {
      currAggs[term] = {
        terms: {
          field: aggs[term].terms?.field?.replace("keyword","raw"),
          size: 500, // This value was causing a "too_many_buckets_exception" I halfed it
        }
      }
    });
    // Sort the aggs object based on the order of optionLabels
    const sortedAggs: Record<string, any> = {};
    termsList.forEach((label) => {
      if (currAggs.hasOwnProperty(label)) {
        sortedAggs[label] = aggs[label];
      }
    });

    return sortedAggs;
}
  
export default async function stackedBarHandler(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    const optionLabels = [
        "Jurisprudência",
        "Área",
        "Secção",
        "Relator Nome Profissional",
        "Meio Processual",
        "Decisão",
        "Decisão (textual)",
        "Votação - Decisão",
        "Votação - Vencidos",
        "Votação - Declarações",
        "Descritores",
        "Tribunal de Recurso",
        "Tribunal de Recurso - Processo",
        "Área Temática",
        "Jurisprudência Estrangeira",
        "Jurisprudência Internacional",
        "Doutrina",
        "Jurisprudência Nacional",
        "Legislação Comunitária",
        "Legislação Estrangeira",
        "Legislação Nacional",
        "Referências Internacionais",
        "Referência de publicação",
        "Indicações Eventuais"
    ];

    const sfilters = { pre: [], after: [] } as SearchFilters;
    populateFilters(sfilters, req.query,[]);

    try {
      const body = await search(createQueryDslQueryContainer(req.query.q), sfilters, 0, barChartAggregation(optionLabels, req.query.termAreaChart, req.query.area), 0);
  
      const aggs = body?.aggregations;
      let total = 0;
      if( body.hits.total ){
          if( Number.isInteger(body.hits.total) ){
              total = body.hits.total as long;
          }
          else{
              total = (body.hits.total as SearchTotalHits).value;
          }
      }

      return res.status(200).json(aggs);
    } catch (error) {
      console.error(error);
      return res.status(500);
    }
}