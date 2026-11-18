import LoggerApi from '@/core/logger-api';
import type { NextApiRequest, NextApiResponse } from 'next';
import { generateBoletimHTML } from '@/core/boletim-util';
import { buildBoletimPesquisaOptions } from '@/core/boletim-pesquisa-helper';

export default LoggerApi(async function boletimPesquisaHtmlHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const renderOptions = await buildBoletimPesquisaOptions(req);
        const html = generateBoletimHTML(renderOptions);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(200).send(html);
    } catch (err: any) {
        console.error("[Boletim Pesquisa HTML] Erro ao compilar resultados:", err?.message || err);
        res.status(500).send(`<!DOCTYPE html><html><body><h3>Erro ao gerar Boletim dos resultados da pesquisa</h3><p>${err?.message || "Erro interno"}</p></body></html>`);
    }
});
