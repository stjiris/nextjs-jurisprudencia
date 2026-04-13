import LoggerApi from "@/core/logger-api";
import { getDoc, updateDoc } from "@/core/doc";
import { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const ROOT_PATH = process.env.LOCAL_ROOT || "results";
const FILESYSTEM_PATH = "/FileSystem";

function getAnonimizadoJsonPath(doc: Record<string, any>): string | null {
    try {
        const { generateFilePath } = require("@stjiris/filesystem-lib");
        const dirPath = `${ROOT_PATH}${FILESYSTEM_PATH}${generateFilePath(doc)}`;
        return path.join(dirPath, "Anonimizado.json");
    } catch {
        return null;
    }
}

function saveAnonimizedEntitiesLocal(doc: Record<string, any>, entities: Record<string, string[]>, textoHash: string, sumarioHash?: string) {
    const filePath = getAnonimizadoJsonPath(doc);
    if (!filePath) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const data: Record<string, any> = { _textoHash: textoHash, ...entities };
    if (sumarioHash) data._sumarioHash = sumarioHash;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

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

        if (originalTexto) {
            update["Texto Não Anonimizado"] = originalTexto;
        }

        if (anonimizedSumario) {
            update["Sumário"] = anonimizedSumario;
            if (originalSumario) {
                update["Sumário Não Anonimizado"] = originalSumario;
            }
        }

        await updateDoc(jurisId, update);

        // Save Anonimizado.docx and Anonimizado.pdf to the filesystem (best-effort)
        try {
            const { saveAnonimizedDocument } = await import("@stjiris/filesystem-lib");
            await saveAnonimizedDocument(current._source, anonimizedTexto, anonimizedSumario || undefined);
        } catch (fsErr) {
            console.error("receber: failed to save anonymized files to filesystem:", fsErr);
        }

        // Save Anonimizado.json with the final entities (best-effort)
        if (entities) {
            try {
                const textoHash = crypto.createHash("sha256").update(originalTexto || "").digest("hex");
                const sumarioHash = originalSumario ? crypto.createHash("sha256").update(originalSumario).digest("hex") : undefined;
                saveAnonimizedEntitiesLocal(current._source, entities, textoHash, sumarioHash);
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
