import search, { getElasticSearchClient, padZero } from '@/core/elasticsearch';
import { SearchTotalHits } from '@elastic/elasticsearch/lib/api/types';
import { PartialJurisprudenciaDocument } from '@stjiris/jurisprudencia-document';
import { spawn } from 'child_process';
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function datalistHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    let date = new Date();
    let currentMonth = `${date.getMonth()}`;
    let currentYear = `${date.getFullYear()}`;
    let [area="Área Social", year=currentYear, month=currentMonth, format="pdf"] = Array.isArray(req.query.filters) ? req.query.filters : req.query.filters ? [req.query.filters] : [];

    let pandoc = spawn("pandoc", ["-f","html","-t","pdf","-o","-","--standalone","--pdf-engine","xelatex"], {});
    pandoc.stderr.pipe(process.stderr)
    pandoc.stdout.pipe(res);
    let wls = (...args: string[]) => pandoc.stdin.write(args.join("\n")+"\n");
    getElasticSearchClient().then(async client => {
        wls(`<!DOCTYPE html>`)
        wls(`<head>`)
        wls(`<title>Sumários de Acórdãos - ${area} - ${month}/${year}</title>`)
        wls(`</head>`)
        let r = await client.search<PartialJurisprudenciaDocument>({
            query: {
                bool: {
                    must: [{
                        term: {
                            "Área.Index.keyword": area
                        }
                    },{
                        range: {
                            "Data": {
                                gte: `01/${padZero(parseInt(month),2)}/${padZero(parseInt(year))}`,
                                lt: `01/${padZero(parseInt(month),2)}/${padZero(parseInt(year))}\|\|+1M`,
                                format: "dd/MM/yyyy"
                            }
                        }
                    }]
                }
            },
            scroll: "30s"
        });
        while( r.hits.hits.length > 0 ){
            for( let hit of r.hits.hits ){
                if( hit._source?.Descritores?.Show || hit._source?.Descritores?.Original ){
                    pandoc.stdin.write(`<table><thead>\n`)
                    for( let desc of hit._source?.Descritores.Show || hit._source?.Descritores.Original ){
                    pandoc.stdin.write(`<tr><th>${desc}</th></tr>\n\n`)
                    }
                    pandoc.stdin.write(`</thead></table>\n`)
                    pandoc.stdin.write(`<div>`);
                    pandoc.stdin.write(hit._source.Sumário || "Sumário não disponível")
                    pandoc.stdin.write(`</div>`)
                    pandoc.stdin.write(`<p>${hit._source['Data']}</p>`)
                    pandoc.stdin.write(`<p>Proc. nº ${hit._source['Número de Processo']}</p>`)
                    pandoc.stdin.write(`<p>${hit._source['Relator Nome Profissional']?.Show.join("\n")}</p>`)
                }
            }
            r = await client.scroll({scroll_id: r._scroll_id, scroll: "30s"})
        }
        pandoc.stdin.end()
    }).catch(e => {
        console.error(e);
    })

    res.writeHead(200, {
        "Content-Type": "application/pdf"
    })
    
    return await new Promise(resolve => pandoc.stdout.on("end", resolve))
}

