import search, { createQueryDslQueryContainer, getElasticSearchClient, populateFilters, SearchFilters } from "@/core/elasticsearch";
import { authenticatedHandler } from "@/core/user/authenticate";
import { PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { NextApiRequest, NextApiResponse } from "next";

export default async function datalistHandler(
  req: NextApiRequest,
  res: NextApiResponse<{[key: string] : PartialJurisprudenciaDocument}>
) {
    let id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id || "";
    if( id === ""){
        return res.json({});
    }

    let sf: SearchFilters = {
        pre: [{
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
        }],
        after: []
    }

    let all = await authenticatedHandler(req);

    let {hits: {hits}} = await search(createQueryDslQueryContainer(), sf, 0, {}, 5, {_source: ["Relator Nome Profissional", "Data", "Número de Processo", "ECLI","UUID","STATE"]},all);
    let r = {} as {[key: string]: PartialJurisprudenciaDocument}
    for( let hit of hits ){
        r[hit._id] = hit._source!
    }
    return res.json( r )

}
