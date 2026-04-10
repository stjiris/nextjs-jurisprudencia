import LoggerApi from "@/core/logger-api";
import { getDoc, updateDoc } from "@/core/doc";
import { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
const { saveAnonimizedDocument, saveAnonimizedEntities } = await import("@stjiris/filesystem-lib");

export default LoggerApi(async function receberHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const secret = process.env.ANONIMIZADOR_SECRET;
    if (secret && req.headers["x-service-secret"] !== secret) {
        return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const { jurisId, anonimizedTexto, anonimizedSumario, originalTexto, originalSumario, entities } = req.body;

    if (!jurisId || !anonimizedTexto) {
        return res.status(400).json({ ok: false, message: "Missing jurisId or anonimizedTexto" });
    }

    try {
        const current = await getDoc(jurisId);
        if (!current._source) {
            return res.status(404).json({ ok: false, message: "Document not found" });
        }

        const update: Record<string, string> = {
            Texto: anonimizedTexto,
            STATE: "preparação",
        };

        if (!current._source["Texto Não Anonimizado"] && originalTexto) {
            update["Texto Não Anonimizado"] = originalTexto;
        }

        if (anonimizedSumario) {
            update["Sumário"] = anonimizedSumario;
            if (!current._source["Sumário Não Anonimizado"] && originalSumario) {
                update["Sumário Não Anonimizado"] = originalSumario;
            }
        }

        await updateDoc(jurisId, update);

        // Save Anonimizado.docx and Anonimizado.pdf to the filesystem (best-effort)
        try {
            await saveAnonimizedDocument(current._source, anonimizedTexto, anonimizedSumario || undefined);
        } catch (fsErr) {
            console.error("receber: failed to save anonymized files to filesystem:", fsErr);
        }

        // Save Anonimizado.json with the final entities (best-effort)
        if (entities) {
            try {
                const textoHash = crypto.createHash("sha256").update(originalTexto || "").digest("hex");
                const sumarioHash = originalSumario ? crypto.createHash("sha256").update(originalSumario).digest("hex") : undefined;
                saveAnonimizedEntities(current._source, entities, textoHash, sumarioHash);
            } catch (fsErr) {
                console.error("receber: failed to save Anonimizado.json to filesystem:", fsErr);
            }
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error("Error in /api/anonimizar/receber:", err);
        return res.status(500).json({ ok: false, message: "Internal server error" });
    }
});
