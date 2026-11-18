import search, { createQueryDslQueryContainer, parseSort, populateFilters } from '@/core/elasticsearch';
import LoggerApi from '@/core/logger-api';
import { authenticatedHandler } from '@/core/user/authenticate';
import { SortCombinations } from '@elastic/elasticsearch/lib/api/types';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
    extractColectivo,
    generatePermalink,
    normalizeSeccao,
    resolveRelator,
    cleanDescriptorName,
    generateBoletimHTML,
    renderDocx,
    BoletimEntry,
    BoletimRenderOptions
} from '@/core/boletim-util';
import { useSource, getSiteBaseUrl, formatPtDate } from '@/core/boletim-pesquisa-helper';

interface CompositeSessionItem {
    id?: string;
    name: string;
    qs: string;
}

export default LoggerApi(async function boletimPesquisaCompostoHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        let sessions: CompositeSessionItem[] = [];

        // Parse sessions from GET query or POST body
        if (req.query.sessions) {
            try {
                const raw = Array.isArray(req.query.sessions) ? req.query.sessions[0] : req.query.sessions;
                sessions = JSON.parse(raw);
            } catch (e) {
                console.warn("[Boletim Composto] Falha ao fazer parse de sessions do query:", e);
            }
        } else if (req.body && req.body.sessions) {
            sessions = typeof req.body.sessions === "string" ? JSON.parse(req.body.sessions) : req.body.sessions;
        }

        if (!Array.isArray(sessions) || sessions.length === 0) {
            res.status(400).send(`<!DOCTYPE html><html><body><h3>Nenhuma pesquisa selecionada para o Boletim Composto.</h3><p>Por favor selecione pelo menos uma pesquisa guardada no histórico.</p></body></html>`);
            return;
        }

        const authed = await authenticatedHandler(req);
        const format = (Array.isArray(req.query.format) ? req.query.format[0] : req.query.format) || "html";
        const allEntries: BoletimEntry[] = [];
        const seenUuids = new Set<string>();
        const sessionNames: string[] = [];
        const dateCollection: string[] = [];

        for (const sess of sessions) {
            const sessName = sess.name || "Pesquisa Sem Título";
            sessionNames.push(sessName);

            // Parse session querystring into a Record<string, string | string[]>
            const rawQs = (sess.qs || "").replace(/^\?+/, "");
            const parsedQs = new URLSearchParams(rawQs);
            const queryRecord: Record<string, string | string[]> = {};
            parsedQs.forEach((v, k) => {
                if (queryRecord[k]) {
                    if (Array.isArray(queryRecord[k])) {
                        (queryRecord[k] as string[]).push(v);
                    } else {
                        queryRecord[k] = [queryRecord[k] as string, v];
                    }
                } else {
                    queryRecord[k] = v;
                }
            });

            const sfilters = { pre: [], after: [] };
            populateFilters(sfilters, queryRecord);
            const sort: SortCombinations[] = [];
            parseSort(Array.isArray(queryRecord.sort) ? queryRecord.sort[0] : queryRecord.sort, sort);
            const rpp = parseInt(Array.isArray(queryRecord.rpp) ? queryRecord.rpp[0] : queryRecord.rpp || "") || 25;
            const queryObj = createQueryDslQueryContainer(queryRecord.q);

            const result = await search(queryObj, sfilters, 0, {}, rpp, { sort, _source: useSource }, authed);
            const hits = result.hits.hits || [];

            for (const hit of hits) {
                const src = (hit._source || {}) as any;
                const uuid = src.UUID || hit._id;
                if (seenUuids.has(uuid)) {
                    continue; // Deduplicate across searches
                }
                seenUuids.add(uuid);

                const relatorRaw = resolveRelator(src);
                const colectivo = extractColectivo(src.Texto, relatorRaw);
                const rawDesc = src.Descritores?.Show || src.Descritores?.Original || [];
                const descritores = Array.isArray(rawDesc)
                    ? rawDesc.map((d: any) => cleanDescriptorName(`${d}`)).filter(Boolean)
                    : [];
                const proc = src["Número de Processo"] || "Sem número";
                const permalink = generatePermalink(proc, uuid, getSiteBaseUrl(req));
                const seccao = normalizeSeccao(src.Secção?.Show?.[0] || src.Secção?.Original?.[0]) || undefined;
                const dataFormatted = src.Data ? src.Data.replace(/\//g, "-") : "";
                if (dataFormatted) {
                    dateCollection.push(dataFormatted);
                }

                allEntries.push({
                    index: allEntries.length + 1,
                    id: uuid,
                    data: dataFormatted,
                    processo: proc,
                    seccao,
                    area: sessName, // Tagged by session topic
                    meioProcessual: src["Meio Processual"]?.Show?.[0],
                    descritores,
                    sumario: src.Sumário || "Sumário não disponível",
                    colectivo,
                    permalink
                });
            }
        }

        const now = new Date();
        const emissionDate = now.toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

        let periodStr = "";
        if (dateCollection.length > 0) {
            dateCollection.sort();
            const earliest = formatPtDate(dateCollection[0]);
            const latest = formatPtDate(dateCollection[dateCollection.length - 1]);
            periodStr = earliest === latest ? `Decisões de: ${earliest}` : `Período das Decisões: ${earliest} a ${latest}`;
        }

        const criteriaStr = sessionNames.join(" • ");
        const title = `Boletim Composto de Jurisprudência`;
        const subtitle = `Compilação de Múltiplas Pesquisas (${sessionNames.length} Temas: ${criteriaStr})`;

        const omitLogo = req.query.omitLogo === "true" || req.query.omitLogo === "1";
        const omitTitle = req.query.omitTitle === "true" || req.query.omitTitle === "1";
        const omitPeriod = req.query.omitPeriod === "true" || req.query.omitPeriod === "1";
        const omitFilters = req.query.omitFilters === "true" || req.query.omitFilters === "1";

        const docxDownloadUrl = `${process.env.NEXT_BASE_PATH || ""}/api/boletim/pesquisa/composto?format=docx&sessions=${encodeURIComponent(JSON.stringify(sessions))}`;

        const renderOptions: BoletimRenderOptions = {
            title,
            subtitle,
            area: criteriaStr,
            year: `${now.getFullYear()}`,
            month: `${now.getMonth() + 1}`,
            entries: allEntries,
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

        if (format === "docx") {
            const nowStr = now.toISOString().slice(0, 10);
            const filename = `Boletim-Composto-${nowStr}`;
            return await renderDocx(renderOptions, filename, res);
        }

        const html = generateBoletimHTML(renderOptions);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(200).send(html);
    } catch (err: any) {
        console.error("[Boletim Pesquisa Composto] Erro ao compilar:", err?.message || err);
        res.status(500).send(`<!DOCTYPE html><html><body><h3>Erro ao gerar Boletim Composto</h3><p>${err?.message || "Erro interno"}</p></body></html>`);
    }
});
