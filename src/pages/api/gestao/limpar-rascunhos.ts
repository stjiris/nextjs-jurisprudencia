import LoggerApi from "@/core/logger-api";
import { authenticatedHandler, getUserRole } from "@/core/user/authenticate";
import { roleCanAccess } from "@/core/user/roles";
import { getElasticSearchClient } from "@/core/elasticsearch";
import { deleteDoc, updateDoc } from "@/core/doc";
import { JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { logAuditEvent, getUsernameFromReq, getIpFromReq } from "@/core/audit-log";
import type { NextApiRequest, NextApiResponse } from "next";

type Response = {
    ok: boolean;
    cleaned?: number;
    totalFound?: number;
    message?: string;
    details?: Array<{ id: string; processo: string; state: string; action: string }>;
};

/**
 * POST /api/gestao/limpar-rascunhos
 *
 * Cleans obsolete/duplicate draft documents currently in 'importação' or 'preparação'.
 * By default, targets documents whose process number already exists in 'público' (or all if mode='all').
 * Accessible only to administrators with 'manageUsers' permission.
 */
export default LoggerApi(async function limparRascunhosHandler(
    req: NextApiRequest,
    res: NextApiResponse<Response>
) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const authed = await authenticatedHandler(req);
    if (!authed) {
        return res.status(401).json({ ok: false, message: "Não autorizado" });
    }

    const role = await getUserRole(req) ?? "editor";
    if (!roleCanAccess(role, "manageUsers")) {
        return res.status(403).json({ ok: false, message: "Permissão insuficiente (requer 'manageUsers')" });
    }

    const {
        states = ["importação", "preparação"],
        mode = "published_only", // "published_only" | "all"
        action = "eliminar",    // "eliminar" (sets STATE: "eliminado") | "purgar" (deletes doc from ES)
    } = req.body || {};

    try {
        const client = await getElasticSearchClient();
        const searchRes = await client.search<Record<string, any>>({
            index: JurisprudenciaVersion,
            query: {
                terms: { STATE: states }
            },
            size: 1000
        });

        const hits = searchRes.hits.hits;
        const details: Array<{ id: string; processo: string; state: string; action: string }> = [];
        let cleaned = 0;

        for (const hit of hits) {
            const id = hit._id;
            const src = hit._source;
            if (!id || !src) continue;

            const processo = src["Número de Processo"] || "";
            const currState = src.STATE || "";

            let shouldClean = mode === "all";

            if (!shouldClean && processo) {
                // Check if this process already exists as 'público'
                const altProcesso = processo.includes("/") ? processo.replace(/\//g, "-") : processo.replace(/-/g, "/");
                const pubCheck = await client.search({
                    index: JurisprudenciaVersion,
                    query: {
                        bool: {
                            must: [
                                { term: { STATE: "público" } },
                                {
                                    bool: {
                                        should: [
                                            { term: { "Número de Processo": processo } },
                                            { term: { "Número de Processo": altProcesso } },
                                            { term: { "Número de Processo.Index.keyword": processo } },
                                            { term: { "Número de Processo.Index.keyword": altProcesso } },
                                        ]
                                    }
                                }
                            ]
                        }
                    },
                    size: 1
                });

                if (pubCheck.hits.hits.length > 0) {
                    shouldClean = true;
                }
            }

            if (shouldClean) {
                if (action === "purgar") {
                    await deleteDoc(id);
                    details.push({ id, processo, state: currState, action: "purgado" });
                } else {
                    await updateDoc(id, { STATE: "eliminado" });
                    details.push({ id, processo, state: currState, action: "marcado_eliminado" });
                }
                cleaned++;
            }
        }

        const username = getUsernameFromReq(req) || "admin";
        await logAuditEvent("limpar-rascunhos", username, {
            details: JSON.stringify({
                cleaned,
                totalFound: hits.length,
                mode,
                action,
            }),
            ip: getIpFromReq(req),
        });

        return res.status(200).json({
            ok: true,
            cleaned,
            totalFound: hits.length,
            message: `${cleaned} acórdão(s) em [${states.join(", ")}] foram limpos com sucesso (${action === "purgar" ? "purgados" : "marcados como eliminados"}).`,
            details
        });
    } catch (err: any) {
        console.error("Error in /api/gestao/limpar-rascunhos:", err);
        return res.status(500).json({ ok: false, message: `Erro ao limpar rascunhos: ${err?.message || err}` });
    }
});
