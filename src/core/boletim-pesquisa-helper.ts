import search, { createQueryDslQueryContainer, parseSort, populateFilters } from '@/core/elasticsearch';
import { authenticatedHandler } from '@/core/user/authenticate';
import { SortCombinations } from '@elastic/elasticsearch/lib/api/types';
import { JurisprudenciaDocumentKey } from '@stjiris/jurisprudencia-document';
import type { NextApiRequest } from 'next';
import {
    extractColectivo,
    generatePermalink,
    normalizeSeccao,
    resolveRelator,
    cleanDescriptorName,
    BoletimEntry,
    BoletimRenderOptions
} from '@/core/boletim-util';

export const useSource: JurisprudenciaDocumentKey[] = [
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

export function getSiteBaseUrl(req: NextApiRequest): string {
    const first = (h: string | string[] | undefined) => (Array.isArray(h) ? h[0] : h)?.split(",")[0].trim();
    const host = first(req.headers["x-forwarded-host"]) || first(req.headers.host);
    if (!host) return "https://juris.stj.pt";
    const proto = first(req.headers["x-forwarded-proto"]) || "http";
    return `${proto}://${host}${process.env.NEXT_BASE_PATH || ""}`;
}

export function formatPtDate(val?: string): string {
    if (!val) return "";
    const clean = val.trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, d] = clean.split("-");
        return `${d}/${m}/${y}`;
    }
    // YYYY-MM
    if (/^\d{4}-\d{2}$/.test(clean)) {
        const [y, m] = clean.split("-");
        return `${m}/${y}`;
    }
    // DD/MM/YYYY or DD-MM-YYYY
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(clean)) {
        return clean.replace(/-/g, "/");
    }
    return clean;
}

export async function buildBoletimPesquisaOptions(req: NextApiRequest): Promise<BoletimRenderOptions> {
    const sfilters = { pre: [], after: [] };
    populateFilters(sfilters, req.query);
    const sort: SortCombinations[] = [];
    parseSort(Array.isArray(req.query?.sort) ? req.query.sort[0] : req.query.sort, sort);
    const page = parseInt(Array.isArray(req.query.page) ? req.query.page[0] : req.query.page || "") || 0;
    const rpp = parseInt(Array.isArray(req.query.rpp) ? req.query.rpp[0] : req.query.rpp || "") || 10;
    const queryObj = createQueryDslQueryContainer(req.query.q);
    const authed = await authenticatedHandler(req);

    // Fetch acórdãos from Elasticsearch
    const result = await search(queryObj, sfilters, page, {}, rpp, { sort, _source: useSource }, authed);
    const hits = result.hits.hits || [];

    // Parse date filters into clear Portuguese period string
    const minDateRaw = Array.isArray(req.query.MinDate) ? req.query.MinDate[0] : req.query.MinDate;
    const maxDateRaw = Array.isArray(req.query.MaxDate) ? req.query.MaxDate[0] : req.query.MaxDate;
    let periodStr = "";

    if (minDateRaw && maxDateRaw) {
        periodStr = `Período: ${formatPtDate(minDateRaw)} a ${formatPtDate(maxDateRaw)}`;
    } else if (minDateRaw) {
        periodStr = `Período: a partir de ${formatPtDate(minDateRaw)}`;
    } else if (maxDateRaw) {
        periodStr = `Período: até ${formatPtDate(maxDateRaw)}`;
    }

    // Collect search criteria badges
    const criteria: string[] = [];
    const qTerm = Array.isArray(req.query.q) ? req.query.q.join(" ") : req.query.q;
    if (qTerm && qTerm.trim()) {
        criteria.push(`Termo: "${qTerm.trim()}"`);
    }

    const ignoredKeys = [
        "page", "rpp", "sort", "q", "fontSize", "indexPosition",
        "MinDate", "MaxDate", "omitLogo", "omitTitle", "omitPeriod", "omitFilters",
        "pesquisa_textual", "format"
    ];

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
        const relatorRaw = resolveRelator(src);
        const colectivo = extractColectivo(src.Texto, relatorRaw);
        const rawDesc = src.Descritores?.Show || src.Descritores?.Original || [];
        const descritores = Array.isArray(rawDesc)
            ? rawDesc.map((d: any) => cleanDescriptorName(`${d}`)).filter(Boolean)
            : [];
        const proc = src["Número de Processo"] || "Sem número";
        const uuid = src.UUID || hit._id;
        const permalink = generatePermalink(proc, uuid, getSiteBaseUrl(req));
        const seccao = normalizeSeccao(src.Secção?.Show?.[0] || src.Secção?.Original?.[0]) || undefined;
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

    // If no explicit date filter, derive period from actual hit decision dates
    if (!periodStr && entries.length > 0) {
        const dates = entries.map(e => e.data).filter(Boolean).sort();
        if (dates.length > 0) {
            const earliest = formatPtDate(dates[0]);
            const latest = formatPtDate(dates[dates.length - 1]);
            periodStr = earliest === latest ? `Decisões de: ${earliest}` : `Período das Decisões: ${earliest} a ${latest}`;
        }
    }

    const now = new Date();
    const emissionDate = now.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });

    const omitLogo = req.query.omitLogo === "true" || req.query.omitLogo === "1";
    const omitTitle = req.query.omitTitle === "true" || req.query.omitTitle === "1";
    const omitPeriod = req.query.omitPeriod === "true" || req.query.omitPeriod === "1";
    const omitFilters = req.query.omitFilters === "true" || req.query.omitFilters === "1";

    const docxParams = new URLSearchParams(req.query as any);
    docxParams.delete("format");
    const docxDownloadUrl = `${process.env.NEXT_BASE_PATH || ""}/api/boletim/pesquisa/docx?${docxParams.toString()}`;

    return {
        title,
        subtitle,
        area: criteriaStr,
        year: `${now.getFullYear()}`,
        month: `${now.getMonth() + 1}`,
        entries,
        searchQuery: qTerm || undefined,
        periodStr,
        emissionDate,
        fontSize: (Array.isArray(req.query.fontSize) ? req.query.fontSize[0] : req.query.fontSize) || "11pt",
        indexPosition: ((Array.isArray(req.query.indexPosition) ? req.query.indexPosition[0] : req.query.indexPosition) || "end") as "start" | "end",
        docxDownloadUrl,
        omitLogo,
        omitTitle,
        omitPeriod,
        omitFilters
    };
}
