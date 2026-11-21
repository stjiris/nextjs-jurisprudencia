import { authenticatedHandler } from "@/core/user/authenticate";
import { parseDocumentFile } from "@/core/document-file-parser";
import formidable from "formidable";
import fs from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import LoggerApi from "@/core/logger-api";

export const config = {
    api: {
        bodyParser: false,
    },
};

export default LoggerApi(async function parseFileHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    const authed = await authenticatedHandler(req);
    if (!authed) {
        return res.status(401).json({ ok: false, message: "Não autorizado" });
    }

    const form = formidable({
        keepExtensions: true,
        maxFileSize: 50 * 1024 * 1024, // 50MB
    });

    try {
        const [, files] = await form.parse(req);
        const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

        if (!uploadedFile) {
            return res.status(400).json({ ok: false, message: "Nenhum ficheiro enviado (campo 'file' em falta)" });
        }

        const buffer = await fs.promises.readFile(uploadedFile.filepath);
        const originalName = uploadedFile.originalFilename || "acordao.docx";

        // Clean up temp file
        try {
            await fs.promises.unlink(uploadedFile.filepath);
        } catch {
            // Best effort temp cleanup
        }

        const result = await parseDocumentFile(originalName, buffer);
        return res.status(200).json(result);
    } catch (err: any) {
        console.error("Error in /api/doc/parse-file:", err);
        return res.status(500).json({
            ok: false,
            message: `Erro ao processar o ficheiro: ${err?.message || "Erro interno"}`
        });
    }
});
