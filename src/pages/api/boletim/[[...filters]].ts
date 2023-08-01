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
    let title = `Sumários de Acórdãos - ${area} - ${month}/${year}`

    let pandoc = spawn("pandoc", ["-t",format,"-o","-","--standalone","--pdf-engine","xelatex","--template","pdf-template.tex"], {});
    pandoc.stderr.pipe(process.stderr)
    pandoc.stdout.pipe(res);
    let wls = (...args: string[]) => pandoc.stdin.write(args.join("\n")+"\n");
    getElasticSearchClient().then(async client => {
        wls(`---`)
        wls(`title: ${title}`)
        wls(`output:`)
        wls(`   beamer_presentation:`)
        wls(`       keep_tex: true`)
        wls(`header-includes:`)
        wls(` - \\usepackage{fancyhdr}`)
        wls(` - \\pagestyle{fancy}`)
        wls(` - \\fancyhead{}`)
        wls(` - \\fancyhead[L]{${title}}`)
        wls(`---`)
        wls(``)
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
                wls(`<div style="page-break-after: always;">\n`)
                if( hit._source?.Descritores?.Show || hit._source?.Descritores?.Original ){
                    wls(`---\n`)
                    wls(...(hit._source?.Descritores.Show || hit._source?.Descritores.Original).map(d => `**${d}**\n`))
                    wls(`---\n`)
                    wls(`<div>`);
                    wls(hit._source.Sumário || "Sumário não disponível")
                    wls(`</div>`)
                    wls(`${hit._source['Data']}\n`)
                    wls(`Proc. nº ${hit._source['Número de Processo']}\n`)
                    wls(`${hit._source['Relator Nome Profissional']?.Show.join("\n")}\n`)                
                }
                wls(`</div>\n`)
            }
            r = await client.scroll({scroll_id: r._scroll_id, scroll: "30s"})
        }
        pandoc.stdin.end()
    }).catch(e => {
        console.error(e);
    })

    if( format === "pdf" ){
        res.writeHead(200, {
            "Content-Type": "application/pdf"
        })
    }
    
    return await new Promise(resolve => pandoc.stdout.on("end", resolve))
}

