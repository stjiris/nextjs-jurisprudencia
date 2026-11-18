import LoggerApi from '@/core/logger-api';
import type { NextApiRequest, NextApiResponse } from 'next';
import { renderDocx } from '@/core/boletim-util';
import { buildBoletimPesquisaOptions } from '@/core/boletim-pesquisa-helper';

export default LoggerApi(async function boletimPesquisaDocxHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const renderOptions = await buildBoletimPesquisaOptions(req);
        const nowStr = new Date().toISOString().slice(0, 10);
        const filename = `Boletim-Pesquisa-${nowStr}`;
        await renderDocx(renderOptions, filename, res);
    } catch (err: any) {
        console.error("[Boletim Pesquisa DOCX] Erro ao compilar documento Word:", err?.message || err);
        if (!res.headersSent && !res.writableEnded) {
            res.status(500).json({ error: `Erro ao gerar documento Word (.docx): ${err?.message || "Erro interno"}` });
        }
    }
});
