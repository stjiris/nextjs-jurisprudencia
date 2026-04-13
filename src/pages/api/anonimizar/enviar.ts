import LoggerApi from "@/core/logger-api";
import { authenticatedHandler } from "@/core/user/authenticate";
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

type AnonimizarResponse = {
    ok: boolean;
    token?: string;
    message?: string;
};

export default LoggerApi(async function anonimizarHandler(
    req: NextApiRequest,
    res: NextApiResponse<AnonimizarResponse>
) {
    const anonimizadorUrl = process.env.ANONIMIZADOR_URL;
    const anonimizadorSecret = process.env.ANONIMIZADOR_SECRET;

    if (!anonimizadorUrl) {
        return res.status(500).json({
            ok: false,
            message: "Missing ANONIMIZADOR_URL environment variable",
        });
    }

    if (!anonimizadorSecret) {
        return res.status(501).json({
            ok: false,
            message: "Missing ANONIMIZADOR_SERVICE_SECRET environment variable",
        });
    }

    if (req.method !== "POST") {
        return res.status(405).json({
            ok: false,
            message: "Method not allowed",
        });
    }

    const authed = await authenticatedHandler(req);
    if (!authed) {
        return res.status(401).json({
            ok: false,
            message: "Unauthorized",
        });
    }

    try {
        const { doc, id, jurisUrl } = req.body;

        if (!doc || !id) {
            return res.status(400).json({
                ok: false,
                message: "Missing document or id",
            });
        }

        const token = doc.UUID;

        const { loadDocumentFile, loadAnonimizedEntities } = await import("@stjiris/filesystem-lib");

        let nlpJson = null;
        try {
            nlpJson = loadDocumentFile(doc, "nlp");
        } catch (nlpErr) {
            console.warn("Failed to load NLP document, proceeding without it:", nlpErr);
        }

        // Load saved entities from Anonimizado.json and validate against current text hashes
        let savedEntities: Record<string, string[]> | null = null;
        try {
            const anonFile = loadAnonimizedEntities(doc);
            if (anonFile) {
                const textoSrc = doc["Texto Não Anonimizado"] || doc["Texto"] || "";
                const sumarioSrc = doc["Sumário Não Anonimizado"] || doc["Sumário"];
                const textoHash = crypto.createHash("sha256").update(textoSrc).digest("hex");
                const textoValid = textoHash === anonFile._textoHash;
                const sumarioValid = !anonFile._sumarioHash ||
                    (sumarioSrc && crypto.createHash("sha256").update(sumarioSrc).digest("hex") === anonFile._sumarioHash);
                if (textoValid && sumarioValid) {
                    const { _textoHash, _sumarioHash, ...entities } = anonFile;
                    savedEntities = entities as Record<string, string[]>;
                    console.log("enviar: restored entities from Anonimizado.json for", id);
                } else {
                    console.warn("enviar: Anonimizado.json hash mismatch — entities not restored. textoValid:", textoValid, "sumarioValid:", sumarioValid);
                }
            } else {
                console.log("enviar: no Anonimizado.json found for", id);
            }
        } catch (err) {
            console.warn("Failed to load/validate Anonimizado.json:", err);
        }

        const sendRes = await fetch(`${anonimizadorUrl}/api/juris/save_document`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-service-secret": anonimizadorSecret,
            },
            body: JSON.stringify({
                token,
                document: doc,
                nlp: nlpJson,
                jurisUrl,
                entities: savedEntities,
                ts: Date.now(),
            }),
        });

        if (!sendRes.ok) {
            const text = await sendRes.text();
            console.error("Error sending to second app:", sendRes.status, text);
            return res.status(502).json({
                ok: false,
                message: "Failed to send document to second app",
            });
        }

        return res.status(200).json({
            ok: true,
            token,
            message: "Documento enviado para o segundo app com sucesso",
        });
    } catch (err) {
        console.error("Error in /api/anonimizar/enviar:", err);
        return res.status(503).json({
            ok: false,
            message: "Internal server error",
        });
    }
});
