import search, { createQueryDslQueryContainer, parseSort, populateFilters } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import { SortCombinations } from '@elastic/elasticsearch/lib/api/types';
import { JurisprudenciaDocumentKey } from '@stjiris/jurisprudencia-document';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
    extractColectivo,
    generatePermalink,
    generateBoletimHTML,
    BoletimEntry,
    BoletimRenderOptions
} from '@/core/boletim-util';

const useSource: JurisprudenciaDocumentKey[] = [
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
];

function getSiteBaseUrl(req: NextApiRequest): string {
    const first = (h: string | string[] | undefined) => (Array.isArray(h) ? h[0] : h)?.split(",")[0].trim();
    const host = first(req.headers["x-forwarded-host"]) || first(req.headers.host);
    if (!host) return "https://juris.stj.pt";
    const proto = first(req.headers["x-forwarded-proto"]) || "http";
    return `${proto}://${host}${process.env.NEXT_BASE_PATH || ""}`;
}

export default LoggerApi(async function boletimPesquisaHtmlHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const sfilters = { pre: [], after: [] };
        populateFilters(sfilters, req.query);
        const sort: SortCombinations[] = [];
        parseSort(Array.isArray(req.query?.sort) ? req.query.sort[0] : req.query.sort, sort);
        const page = parseInt(Array.isArray(req.query.page) ? req.query.page[0] : req.query.page || "") || 0;
        const rpp = parseInt(Array.isArray(req.query.rpp) ? req.query.rpp[0] : req.query.rpp || "") || 10;
        const queryObj = createQueryDslQueryContainer(req.query.q);
        const authed = await authenticatedHandler(req);

        // Fetch ONLY the acórdãos currently visible on this page
        const result = await search(queryObj, sfilters, page, {}, rpp, { sort, _source: useSource }, authed);
        const hits = result.hits.hits || [];

        // Collect search attributes for the institutional header
        const criteria: string[] = [];
        const qTerm = Array.isArray(req.query.q) ? req.query.q.join(" ") : req.query.q;
        if (qTerm && qTerm.trim()) {
            criteria.push(`Termo: "${qTerm.trim()}"`);
        }

        const ignoredKeys = ["page", "rpp", "sort", "q", "fontSize", "indexPosition"];
        for (const [key, val] of Object.entries(req.query)) {
            if (ignoredKeys.includes(key)) continue;
            const valStr = Array.isArray(val) ? val.join(", ") : val;
            if (valStr && valStr.trim()) {
                criteria.push(`${key}: ${valStr.replace(/"/g, "").trim()}`);
            }
        }

        const criteriaStr = criteria.length > 0 ? criteria.join(" | ") : "Pesquisa Geral";
        const subtitle = `Compilação de Acórdãos — ${criteriaStr}`;
        const title = `Boletim de Jurisprudência — ${criteriaStr}`;

        const entries: BoletimEntry[] = hits.map((hit, idx) => {
            const src = (hit._source || {}) as any;
            const relatorRaw = src["Relator Nome Profissional"]?.Show || src["Relator Nome Completo"]?.Show;
            const colectivo = extractColectivo(src.Texto, relatorRaw);
            const rawDesc = src.Descritores?.Show || src.Descritores?.Original || [];
            const descritores = Array.isArray(rawDesc) ? rawDesc.map((d: any) => `${d}`) : [];
            const proc = src["Número de Processo"] || "Sem número";
            const uuid = src.UUID || hit._id;
            const permalink = generatePermalink(proc, uuid, getSiteBaseUrl(req));
            const seccao = src.Secção?.Show?.[0] || undefined;
            const dataFormatted = src.Data ? src.Data.replace(/\//g, "-") : "";

            return {
                index: page * rpp + idx + 1,
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
            area: criteriaStr,
            year: `${new Date().getFullYear()}`,
            month: `${new Date().getMonth() + 1}`,
            entries,
            searchQuery: qTerm || undefined,
            fontSize: (Array.isArray(req.query.fontSize) ? req.query.fontSize[0] : req.query.fontSize) || "11pt",
            indexPosition: ((Array.isArray(req.query.indexPosition) ? req.query.indexPosition[0] : req.query.indexPosition) || "end") as "start" | "end"
        };

        const html = generateBoletimHTML(renderOptions);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(200).send(html);
    } catch (err: any) {
        console.error("[Boletim Pesquisa HTML] Erro ao compilar resultados:", err?.message || err);
        res.status(500).send(`<!DOCTYPE html><html><body><h3>Erro ao gerar Boletim dos resultados da pesquisa</h3><p>${err?.message || "Erro interno"}</p></body></html>`);
    }
});
