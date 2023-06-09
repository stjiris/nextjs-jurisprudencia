// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import search from '@/core/elasticsearch';
import { JurisprudenciaDocument } from '@/core/jurisprudencia'
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<JurisprudenciaDocument[]>
) {
    let {proc, uuid} = req.query;
    if( !proc || Array.isArray(proc)) throw new Error("Invalid request")
    
    let m = proc.match(/(?<base>[^/]+\/\w+\.\w+)(-\w+)?\./); 
    if( !m ){
        return res.status(200).json([]);
    }

    return search({wildcard: {"Número de Processo": `${m.groups?.base}*`}}, {pre:[], after:[]}, 0, {}, 100, {_source: ['Número de Processo', "UUID", "Data"]}).then( related => {
        return related.hits.hits.map( hit => hit._source ? ({
            "Número de Processo": hit._source["Número de Processo"],
            UUID: hit._source.UUID,
            Data: hit._source.Data
        }) : {}).filter( hit => hit.UUID.indexOf(uuid) != 0);
    }).then( l => res.status(200).json(l))
}
