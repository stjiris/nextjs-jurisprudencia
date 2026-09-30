import { getElasticSearchClient, padZero } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { PartialJurisprudenciaDocument } from '@stjiris/jurisprudencia-document';
import {
    extractColectivo,
    generatePermalink,
    generateBoletimHTML,
    generateBoletimMarkdown,
    BoletimEntry,
    BoletimRenderOptions,
    formatPeriodHeader
} from '@/core/boletim-util';
import { spawn } from 'child_process';
import type { NextApiRequest, NextApiResponse } from 'next';

function formatSubtitle(area: string): string {
    if (area.includes("Social")) return "Sumários de Acórdãos da Secção Social";
    if (area.includes("Cível") || area.includes("Civel")) return "Sumários de Acórdãos das Secções Cíveis";
    if (area.includes("Criminal")) return "Sumários de Acórdãos das Secções Criminais";
    if (area.includes("Contencioso")) return "Sumários de Acórdãos do Contencioso";
    return `Sumários de Acórdãos - ${area}`;
}

function parseDateForSort(dateStr: string): number {
    if (!dateStr) return 0;
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
        // Expected format: DD-MM-YYYY or DD/MM/YYYY
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const t = new Date(y, m, d).getTime();
        if (!isNaN(t)) return t;
    }
    const t = Date.parse(dateStr);
    return isNaN(t) ? 0 : t;
}

export default LoggerApi(async function boletimHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const date = new Date();
    const currentMonth = `${date.getMonth() + 1}`;
    const currentYear = `${date.getFullYear()}`;
    const [
        area = "Área Social",
        year = currentYear,
        month = currentMonth,
        format = "pdf"
    ] = Array.isArray(req.query.filters)
        ? req.query.filters
        : req.query.filters
        ? [req.query.filters]
        : [];

    const descritorFilter = (Array.isArray(req.query.descritor) ? req.query.descritor[0] : req.query.descritor);
    const searchQuery = (Array.isArray(req.query.q) ? req.query.q[0] : req.query.q);

    const isAnnual = month === "all" || month === "ano" || month === "0";
    const periodStr = formatPeriodHeader(month, year);
    const subtitle = formatSubtitle(area);
    const title = `${subtitle} - ${periodStr}`;

    const dateRange = isAnnual
        ? {
            gte: `01/01/${padZero(parseInt(year))}`,
            lte: `31/12/${padZero(parseInt(year))}`,
            format: "dd/MM/yyyy"
        }
        : {
            gte: `01/${padZero(parseInt(month), 2)}/${padZero(parseInt(year))}`,
            lt: `01/${padZero(parseInt(month), 2)}/${padZero(parseInt(year))}||+1M`,
            format: "dd/MM/yyyy"
        };

    const must: any[] = [
        {
            term: {
                "Área.Index.keyword": area
            }
        },
        {
            range: {
                "Data": dateRange
            }
        }
    ];

    if (descritorFilter) {
        must.push({
            term: {
                "Descritores.Index.keyword": descritorFilter
            }
        });
    }

    if (searchQuery) {
        must.push({
            multi_match: {
                query: searchQuery,
                fields: ["Sumário", "Descritores.Show", "Texto"]
            }
        });
    }

    try {
        const client = await getElasticSearchClient();
        let r = await client.search<PartialJurisprudenciaDocument>({
            query: {
                bool: {
                    must
                }
            },
            _source: [
                "Data",
                "Número de Processo",
                "Secção",
                "Área",
                "Meio Processual",
                "Descritores",
                "Sumário",
                "Texto",
                "Relator Nome Profissional",
                "Relator Nome Completo",
                "UUID",
                "URL"
            ],
            size: 50,
            scroll: "60s"
        });

        const rawHits: any[] = [];
        while (r.hits.hits.length > 0) {
            for (const hit of r.hits.hits) {
                rawHits.push(hit);
            }
            r = await client.scroll({ scroll_id: r._scroll_id, scroll: "60s" });
        }

        // Sort hits chronologically by Data, then Process Number
        rawHits.sort((a, b) => {
            const timeA = parseDateForSort(a._source?.Data || "");
            const timeB = parseDateForSort(b._source?.Data || "");
            if (timeA !== timeB) return timeA - timeB;
            const procA = a._source?.["Número de Processo"] || "";
            const procB = b._source?.["Número de Processo"] || "";
            return procA.localeCompare(procB);
        });

        // Map to structured BoletimEntry
        const entries: BoletimEntry[] = rawHits.map((hit, idx) => {
            const src = hit._source || {};
            const relatorRaw = src["Relator Nome Profissional"]?.Show || src["Relator Nome Completo"]?.Show;
            const colectivo = extractColectivo(src.Texto, relatorRaw);
            const rawDesc = src.Descritores?.Show || src.Descritores?.Original || [];
            const descritores = Array.isArray(rawDesc) ? rawDesc.map(d => `${d}`) : [];
            const proc = src["Número de Processo"] || "Sem número";
            const uuid = src.UUID || hit._id;
            const permalink = generatePermalink(proc, uuid);
            const seccao = src.Secção?.Show?.[0] || undefined;
            const dataFormatted = src.Data ? src.Data.replace(/\//g, "-") : "";

            return {
                index: idx + 1,
                id: uuid,
                data: dataFormatted,
                processo: proc,
                seccao,
                area: src.Área?.Show?.[0],
                meioProcessual: src["Meio Processual"]?.Show?.[0],
                descritores,
                sumario: src.Sumário || "Sumário não disponível",
                colectivo,
                permalink
            };
        });

        const renderOptions: BoletimRenderOptions = {
            title,
            subtitle,
            area,
            year,
            month,
            entries,
            descritorFilter,
            searchQuery
        };

        if (format === "html") {
            const html = generateBoletimHTML(renderOptions);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.status(200).send(html);
            return;
        }

        // PDF Generation via Pandoc + XeLaTeX
        const markdown = generateBoletimMarkdown(renderOptions);

        return await new Promise<void>((resolve) => {
            let procSpawned = false;
            let pandocProc: any;

            try {
                pandocProc = spawn("pandoc", [
                    "-t", "pdf",
                    "-o", "-",
                    "--standalone",
                    "--pdf-engine", "xelatex",
                    "--template", "pdf-template.tex"
                ]);
                procSpawned = true;
            } catch {
                procSpawned = false;
            }

            if (!procSpawned || !pandocProc) {
                // Fallback to HTML if Pandoc is not installed on this host
                const html = generateBoletimHTML(renderOptions);
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.status(200).send(html);
                resolve();
                return;
            }

            let hasError = false;

            pandocProc.on("error", (err: any) => {
                hasError = true;
                console.warn("[Boletim PDF] Pandoc unavailable or failed, serving HTML view:", err.message);
                if (!res.headersSent) {
                    const html = generateBoletimHTML(renderOptions);
                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    res.status(200).send(html);
                }
                resolve();
            });

            pandocProc.stdout.on("data", () => {
                if (!res.headersSent) {
                    res.writeHead(200, {
                        "Content-Type": "application/pdf",
                        "Content-Disposition": `inline; filename="boletim-${encodeURIComponent(area)}-${year}-${month}.pdf"`
                    });
                }
            });

            pandocProc.stdout.pipe(res);

            pandocProc.on("close", (code: number) => {
                if (code !== 0 && !res.headersSent && !hasError) {
                    console.warn(`[Boletim PDF] Pandoc process exited with code ${code}, serving HTML`);
                    const html = generateBoletimHTML(renderOptions);
                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    res.status(200).send(html);
                }
                resolve();
            });

            pandocProc.stdin.write(markdown);
            pandocProc.stdin.end();
        });
    } catch (e) {
        console.error("[Boletim API] Error generating boletim:", e);
        if (!res.headersSent) {
            res.status(500).json({ error: "Erro ao gerar o boletim de jurisprudência." });
        }
    }
});