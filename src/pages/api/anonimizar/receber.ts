import LoggerApi from "@/core/logger-api";
import { getDoc, updateDoc } from "@/core/doc";
import { getElasticSearchClient } from "@/core/elasticsearch";
import { JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export default LoggerApi(async function receberHandler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const secret = process.env.ANONIMIZADOR_SECRET;
    if (secret && req.headers["x-service-secret"] !== secret) {
        return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const {
        jurisId,
        anonimizedTexto,
        anonimizedSumario,
        originalTexto,
        originalSumario,
        entities,
        images, // optional: Array<{ filename: string; data?: string; base64?: string }>
    } = req.body;

    if (!jurisId || !anonimizedTexto) {
        return res.status(400).json({ ok: false, message: "Missing jurisId or anonimizedTexto" });
    }

    try {
        let current: any = null;
        let targetDocId = jurisId;

        try {
            const direct = await getDoc(jurisId);
            if (direct && direct._source) {
                current = direct;
                targetDocId = (direct as any)._id || jurisId;
            }
        } catch {
            // direct getDoc failed or threw, fallback to search by UUID or Process Number
        }

        if (!current || !current._source) {
            try {
                const client = await getElasticSearchClient();
                const searchRes = await client.search({
                    index: JurisprudenciaVersion,
                    size: 1,
                    query: {
                        bool: {
                            should: [
                                { term: { "UUID": jurisId } },
                                { term: { "Número de Processo": jurisId } },
                                { term: { "Número de Processo.Index": jurisId } },
                                { term: { "Número de Processo.Index.keyword": jurisId } }
                            ]
                        }
                    }
                });
                if (searchRes.hits.hits.length > 0) {
                    current = searchRes.hits.hits[0];
                    targetDocId = current._id;
                }
            } catch (searchErr) {
                console.error("receber: fallback search failed:", searchErr);
            }
        }

        if (!current || !current._source) {
            console.error("receber: document not found in Elasticsearch for jurisId:", jurisId);
            return res.status(404).json({ ok: false, message: `Document not found: ${jurisId}` });
        }

        const baseDir = process.env.IMAGES_PATH || path.join(process.cwd(), "images");

        // If Anonimizador sent binary/base64 images over HTTP, save them to IMAGES_PATH
        if (Array.isArray(images) && images.length > 0) {
            try {
                await fs.promises.mkdir(baseDir, { recursive: true });
                for (const img of images) {
                    if (img.filename && (img.data || img.base64)) {
                        if (typeof img.filename !== "string" || img.filename.includes("\0") || img.filename.includes("..")) {
                            continue;
                        }
                        const cleanName = img.filename.split(/[?#]/)[0];
                        const safeName = path.basename(cleanName);
                        if (!safeName.includes("..") && !safeName.includes("\0") && /^[a-zA-Z0-9_\-\.]+$/.test(safeName)) {
                            const raw = img.data || img.base64;
                            const buffer = Buffer.from(raw, "base64");
                            await fs.promises.writeFile(path.join(baseDir, safeName), buffer);
                            console.log("receber: saved received image", safeName, "to", baseDir);
                        }
                    }
                }
            } catch (imgErr) {
                console.error("receber: failed to save received image binaries:", imgErr);
            }
        }

        // Collect all image references from the returned texts
        const foundImageHashes: string[] = [];
        const textsToCheck = [anonimizedTexto, anonimizedSumario].filter(Boolean) as string[];
        for (const t of textsToCheck) {
            const matches = t.matchAll(/\/api\/images\/([a-zA-Z0-9_\-\.]+)/g);
            for (const m of matches) {
                if (m[1] && !foundImageHashes.includes(m[1])) {
                    foundImageHashes.push(m[1]);
                }
            }
        }

        const update: Record<string, any> = {
            Texto: anonimizedTexto,
            STATE: "preparação",
        };

        if (foundImageHashes.length > 0) {
            update.hasImages = true;
            update.imageHashes = foundImageHashes;
        }

        if (originalTexto) {
            update["Texto Não Anonimizado"] = originalTexto;
        }

        if (anonimizedSumario) {
            update["Sumário"] = anonimizedSumario;
            if (originalSumario) {
                update["Sumário Não Anonimizado"] = originalSumario;
            }
        }

        await updateDoc(targetDocId, update);

        const { saveAnonimizedDocument, saveAnonimizedEntities } = await import("@stjiris/filesystem-lib");

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
                console.log("receber: saved Anonimizado.json for", jurisId);
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
