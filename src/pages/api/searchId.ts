import search, { createQueryDslQueryContainer, getElasticSearchClient, populateFilters, SearchFilters } from "@/core/elasticsearch";
import { authenticatedHandler } from "@/core/user/authenticate";
import { PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { NextApiRequest, NextApiResponse } from "next";

export default async function datalistHandler(
  req: NextApiRequest,
  res: NextApiResponse<{[key: string] : PartialJurisprudenciaDocument}>
) {
    let id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id || "";

    let sf: SearchFilters = {
        pre: id.length > 0 ? [{
            bool: {
                should: [{
                    ids: {
                        values: id,
                        boost: 50,
                        _name: "id"
                    }
                },
                {
                    wildcard: {
                        "ECLI": {
                            value: `*${id}*`,
                            boost: 30,
                            _name: "ECLI"
                        },

                    }
                },
                {
                    wildcard: {
                        "UUID": {
                            value: `*${id}*`,
                            boost: 20,
                            _name: "UUID"
                        },

                    }
                },
                {
                    wildcard: {
                        "Número de Processo": {
                            value: `*${id}*`,
                            boost: 10,
                            _name: "UUID"
                        },

                    }
                }
                ]
            }
        }] : [],
        after: []
    }
    let state = (Array.isArray(req.query.state) ? req.query.state : req.query.state?.split(",") || []).filter(s => s.length > 0);
    if( state.length > 0 ){
        sf.pre.push({
            terms: {
                STATE: state,
                _name: "state"
            }
        })
    }

    let all = await authenticatedHandler(req);

    let page = parseInt(Array.isArray(req.query.page) ? req.query.page[0] : req.query.page || "" ) || 0

    let {hits: {hits, total}} = await search(createQueryDslQueryContainer(), sf, page, {}, 5, {_source: ["Relator Nome Profissional", "Data", "Número de Processo", "ECLI","UUID","STATE"]},all);
    let r = {} as {[key: string]: PartialJurisprudenciaDocument}
    for( let hit of hits ){
        r[hit._id] = hit._source!
    }
    res.setHeader("Pagination-Count", typeof total === "number" ? total : total?.value || 0)
    res.setHeader("Pagination-Page", page)
    res.setHeader("Pagination-Limit", 5)
    return res.json( r )

}
