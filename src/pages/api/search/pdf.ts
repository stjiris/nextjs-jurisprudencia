// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import search, { createQueryDslQueryContainer, filterableProps, getElasticSearchClient, parseSort, populateFilters, RESULTS_PER_PAGE } from '@/core/elasticsearch';
import { authenticatedHandler } from '@/core/user/authenticate';
import { HighlightFragment, SearchHandlerResponse } from '@/types/search';
import { SearchHighlight, SortCombinations } from '@elastic/elasticsearch/lib/api/types';
import { JurisprudenciaDocumentKey } from '@stjiris/jurisprudencia-document';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import type { NextApiRequest, NextApiResponse } from 'next'

const useSource: JurisprudenciaDocumentKey[] = ["ECLI", "Número de Processo", "UUID", "Data", "Área", "Meio Processual", "Relator Nome Profissional", "Secção", "Votação", "Decisão", "Descritores", "Sumário", "Texto", "STATE"]

export default async function pdfSearch(
    req: NextApiRequest,
    res: NextApiResponse<SearchHandlerResponse>
) {
    const sfilters = { pre: [], after: [] };
    populateFilters(sfilters, req.query)
    const sort: SortCombinations[] = [];
    parseSort(Array.isArray(req.query?.sort) ? req.query.sort[0] : req.query.sort, sort)
    const queryObj = createQueryDslQueryContainer(req.query.q);
    const authed = await authenticatedHandler(req);


    const client = await getElasticSearchClient();
    let r = await search(queryObj, sfilters, 0, {}, RESULTS_PER_PAGE, { sort, scroll: "1m", track_scores: true, _source: useSource }, authed)

    let [pandoc, wls] = convert("Resultados pesquisa", "markdown");
    pandoc.stderr.pipe(process.stderr)
    pandoc.stdout.pipe(res);
    while (r.hits.hits.length > 0) {
        for (let hit of r.hits.hits) {
            wls(`<div style="page-break-after: always;">\n`)
            if (hit._source?.Descritores?.Show || hit._source?.Descritores?.Original) {
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
        r = await client.scroll({ scroll_id: r._scroll_id, scroll: "30s" })
    }
    pandoc.stdin.end()

    //res.writeHead(200, {
    //    "Content-Type": "application/pdf"
    //})

    return await new Promise(resolve => pandoc.stdout.on("end", resolve))
}

function convert(title: string, format: string) {
    let proc: ChildProcessWithoutNullStreams;
    if (format === "pdf") {
        proc = spawn("pandoc", ["-t", format, "-o", "-", "--standalone", "--pdf-engine", "xelatex", "--template", "pdf-template.tex"], {});
    }
    else {
        proc = spawn("pandoc", ["-t", format, "-o", "-", "--standalone", "--pdf-engine", "xelatex"], {});
    }

    let wls = (...args: string[]) => proc.stdin.write(args.join("\n") + "\n");

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
    wls(`---\n`)

    return [proc, wls] as const;
}