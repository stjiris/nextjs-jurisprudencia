import { authenticatedHandlerWithRole } from "@/core/user/authenticate";
import { NextApiRequest, NextApiResponse } from "next";
import { existsDoc, updateDoc } from "@/core/doc";
import { PDF_DIR } from "@/core/pdf";
import formidable from "formidable";
import { readFile, rename, writeFile } from "fs/promises";
import { execFile } from "child_process";
import { join } from "path";
import LoggerApi from "@/core/logger-api";

const OCR_BASE = process.env.OCR_URL;

export const config = {
    api: {
        bodyParser: false
    }
}

const form = formidable({
    filter: (part) => part.mimetype === "application/pdf",
    uploadDir: PDF_DIR,
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024
});

function pdftotext(pdfPath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        execFile("pdftotext", ["-layout", pdfPath, "-"], (err, stdout) => {
            if (err) reject(err);
            else resolve(stdout);
        });
    });
}

async function ocrExtract(pdfPath: string): Promise<{ text: string; pdfWithLayer: Buffer | null }> {
    if (!OCR_BASE) throw new Error("OCR_URL not configured");
    const pdfBuffer = await readFile(pdfPath);
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", blob, "document.pdf");
    formData.append("config", JSON.stringify({
        lang: ["por"],
        outputs: ["pdf_indexed", "txt"],
        compress: true,
    }));

    const uploadRes = await fetch(`${OCR_BASE}/perform-ocr`, { method: "POST", body: formData });
    const uploadData = await uploadRes.json();
    if (!uploadData.success) throw new Error(uploadData.message || "OCR upload failed");

    const docId = uploadData.doc_id;

    while (true) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(`${OCR_BASE}/check-status?doc_id=${docId}`);
        const statusData = await statusRes.json();
        const stage = statusData.status?.stage;
        if (stage === "post-ocr") break;
        if (stage === "error") throw new Error(statusData.status.message || "OCR failed");
    }

    const txtRes = await fetch(`${OCR_BASE}/get-result?doc_id=${docId}&type=txt`);
    const text = txtRes.ok ? await txtRes.text() : "";

    let pdfWithLayer: Buffer | null = null;
    const pdfRes = await fetch(`${OCR_BASE}/get-result?doc_id=${docId}&type=pdf_indexed`);
    if (pdfRes.ok) {
        pdfWithLayer = Buffer.from(await pdfRes.arrayBuffer());
    }

    return { text, pdfWithLayer };
}

function textToHtml(text: string): string {
    return text.split("\n").filter(line => line.trim()).map(line => `<p><font>${line}</font><br>`).join('');
}

export default LoggerApi(async function pdfUploadHandler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") return res.status(405).json({});

    const serviceSecret = process.env.ETL_SECRET;
    const hasServiceAuth = serviceSecret && req.headers["x-service-secret"] === serviceSecret;
    if (!hasServiceAuth && !(await authenticatedHandlerWithRole(req, 'importExport'))) {
        return res.status(403).json({});
    }

    const [fields, files] = await form.parse(req);

    const id = Array.isArray(fields.id) ? fields.id[0] : fields.id;
    if (!id) return res.status(400).json({ error: "Missing id field" });

    const uuid = Array.isArray(fields.uuid) ? fields.uuid[0] : fields.uuid;
    if (!uuid) return res.status(400).json({ error: "Missing uuid field" });

    if (!(await existsDoc(id))) {
        return res.status(404).json({ error: "Document not found" });
    }

    const file = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;
    if (!file) return res.status(400).json({ error: "No PDF file provided" });

    const pdfPath = join(PDF_DIR, `${uuid}.pdf`);
    await rename(file.filepath, pdfPath);

    const updateFields: any = {};

    const text = await pdftotext(pdfPath).catch(() => "");

    if (text.trim()) {
        updateFields.Texto = textToHtml(text);
        updateFields.PDF = "true";
    } else {
        const ocr = await ocrExtract(pdfPath).catch(() => null);
        if (ocr) {
            if (ocr.text.trim()) {
                updateFields.Texto = textToHtml(ocr.text);
            }
            if (ocr.pdfWithLayer) {
                await writeFile(pdfPath, ocr.pdfWithLayer);
            }
            updateFields.PDF = "ocr";
        } else {
            updateFields.PDF = "no-text";
        }
    }

    await updateDoc(id, updateFields);

    return res.json({ success: true, textExtracted: !!updateFields.Texto });
});
