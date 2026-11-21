import mammoth from "mammoth";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { parseFilename } from "./filename-parser";
import { canonicalizeSeccao } from "./seccao-util";
import { PartialJurisprudenciaDocument, matchCanonical, ControlledField } from "@stjiris/jurisprudencia-document";

const MONTHS_PT: Record<string, string> = {
    janeiro: "01",
    fevereiro: "02",
    março: "03",
    marco: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12"
};

const SECCAO_TO_AREA: Record<string, string> = {
    "1.ª Secção (Cível)": "Área Cível",
    "2.ª Secção (Cível)": "Área Cível",
    "3.ª Secção (Criminal)": "Área Criminal",
    "4.ª Secção (Social)": "Área Social",
    "5.ª Secção (Criminal)": "Área Criminal",
    "6.ª Secção (Cível)": "Área Cível",
    "7.ª Secção (Cível)": "Área Cível",
    "Contencioso": "Contencioso",
    "Conflitos": "Conflitos"
};

export type ParsedDocumentResult = {
    ok: boolean;
    filename: string;
    parsedDoc: PartialJurisprudenciaDocument;
    summary: {
        filename: string;
        processo?: string;
        relator?: string;
        data?: string;
        seccao?: string;
        area?: string;
        meioProcessual?: string;
        decisao?: string;
        descritores?: string[];
        temSumario: boolean;
        caracteresTexto: number;
        numImagens: number;
    };
};

function parsePortugueseDate(text: string): string | undefined {
    // 1. Matches DD/MM/YYYY or DD-MM-YYYY
    const numericMatch = text.match(/\b([0-3]?[0-9])[\/\-]([0-1]?[0-9])[\/\-](20\d\d|19\d\d)\b/);
    if (numericMatch) {
        const d = numericMatch[1].padStart(2, "0");
        const m = numericMatch[2].padStart(2, "0");
        const y = numericMatch[3];
        return `${d}/${m}/${y}`;
    }

    // 2. Matches "28 de Outubro de 2026"
    const textMatch = text.match(/\b([0-3]?[0-9])\s+de\s+([a-zA-ZçÇãõáéíóú]+)\s+de\s+(20\d\d|19\d\d)\b/i);
    if (textMatch) {
        const d = textMatch[1].padStart(2, "0");
        const monthName = textMatch[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const m = MONTHS_PT[monthName] || MONTHS_PT[textMatch[2].toLowerCase()];
        const y = textMatch[3];
        if (m) {
            return `${d}/${m}/${y}`;
        }
    }

    return undefined;
}

function canonicalGeneric(field: ControlledField, raw: string[]) {
    const normalized = raw.map(v => {
        const m = matchCanonical(field, v, 1);
        return m.matched ? m.value : v;
    });
    return { Original: raw, Show: normalized, Index: normalized };
}

export async function parseDocumentFile(
    filename: string,
    buffer: Buffer
): Promise<ParsedDocumentResult> {
    const ext = path.extname(filename).toLowerCase();
    const parsedFilename = parseFilename(filename);

    const imagesDir = process.env.IMAGES_PATH || path.join(process.cwd(), "images");
    const extractedImageHashes: string[] = [];

    let htmlContent = "";
    let rawText = "";

    if (ext === ".docx") {
        // Convert docx to HTML and extract embedded images
        const customImageHandler = mammoth.images.imgElement(async (image) => {
            try {
                const imageBuffer = await image.read();
                const hash = crypto.createHash("sha256").update(imageBuffer).digest("hex");
                const extension = (image.contentType || "").split("/")[1] || "png";
                const safeName = `img_${hash}.${extension}`;
                
                await fs.promises.mkdir(imagesDir, { recursive: true });
                await fs.promises.writeFile(path.join(imagesDir, safeName), imageBuffer);
                
                if (!extractedImageHashes.includes(safeName)) {
                    extractedImageHashes.push(safeName);
                }
                
                return {
                    src: `/api/images/${safeName}`
                };
            } catch (imgErr) {
                console.warn("Failed to extract docx image, falling back to inline data URL:", imgErr);
                const base64 = await image.read("base64");
                return {
                    src: `data:${image.contentType};base64,${base64}`
                };
            }
        });

        const htmlResult = await mammoth.convertToHtml({ buffer }, {
            convertImage: customImageHandler
        });
        htmlContent = htmlResult.value || "";

        const textResult = await mammoth.extractRawText({ buffer });
        rawText = textResult.value || "";
    } else {
        // Fallback for plain text or simple extraction
        rawText = buffer.toString("utf-8");
        htmlContent = rawText
            .split(/\r?\n\r?\n/)
            .filter(p => p.trim().length > 0)
            .map(p => `<p>${p.replace(/\r?\n/g, "<br>")}</p>`)
            .join("");
    }

    // --- Metadata Detection from Filename & Raw Text ---

    // 1. Número de Processo
    let processo = parsedFilename.nrProcesso;
    if (!processo || processo.length < 5 || !processo.includes(".")) {
        const procMatch = rawText.match(/(?:Processo|Proc\.?)\s*(?:n\.?[ºo]?\s*)?([0-9]+[\/\-_][0-9]{2}\.[0-9][A-Z0-9\-\.\/]+)/i);
        if (procMatch) {
            processo = procMatch[1].replace(/^(\d+)[\-_](\d{2}\.\d)/, "$1/$2");
        }
    }

    // 2. Relator
    let relator = parsedFilename.relator;
    if (!relator) {
        const relatorMatch = rawText.match(/(?:Relator(?:a)?|Juiz(?:a)?\s+Relator(?:a)?)\s*[:\.]?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõçA-ZÁÉÍÓÚÂÊÔÃÕÇ\s\.\-]+?)(?=\r?\n|$)/);
        if (relatorMatch) {
            const candidate = relatorMatch[1].trim();
            if (candidate.length > 3 && candidate.length < 60) {
                relator = candidate;
            }
        }
    }

    // 3. Data
    let data = parsePortugueseDate(rawText) || new Date().toLocaleDateString("pt-PT");

    // 4. Secção & Área
    let seccaoCandidate = "";
    const seccaoMatch = rawText.match(/\b([1-7]\.?[ªa]?\s*Secção(?:\s*\([A-Za-záéíóú]+\))?|Secção\s*(?:Cível|Criminal|Social)|Contencioso|Conflitos)\b/i);
    if (seccaoMatch) {
        seccaoCandidate = seccaoMatch[1].trim();
    }
    const seccaoCanonical = seccaoCandidate ? canonicalizeSeccao(seccaoCandidate) : "";
    const area = seccaoCanonical ? (SECCAO_TO_AREA[seccaoCanonical] || "Área Cível") : "";

    // 5. Meio Processual
    let meioProcessual = "";
    const meioMatch = rawText.match(/(?:Meio Processual|Espécie|Recurso)\s*[:\.]?\s*([A-Za-zÀ-ÿ\s\-]+?)(?=\r?\n|$)/i);
    if (meioMatch) {
        meioProcessual = meioMatch[1].trim();
    }

    // 6. Decisão
    let decisao = "";
    const decisaoMatch = rawText.match(/(?:Decisão|Acórdão)\s*[:\.]?\s*([A-Za-zÀ-ÿ\s\-]+?)(?=\r?\n|$)/i);
    if (decisaoMatch) {
        decisao = decisaoMatch[1].trim();
    }

    // 7. Descritores
    let descritores: string[] = [];
    const descMatch = rawText.match(/(?:Descritores|Sumário de Descritores)\s*[:\.]?\s*([^\r\n]+)/i);
    if (descMatch) {
        descritores = descMatch[1]
            .split(/[,;\/]/)
            .map(d => d.trim())
            .filter(d => d.length > 2);
    }

    // --- Sumário vs Texto Splitting ---
    let sumarioHtml = "";
    let textoHtml = htmlContent;
    let temSumario = false;

    if (parsedFilename.tipoDocumento === "sumario") {
        sumarioHtml = htmlContent;
        textoHtml = "";
        temSumario = true;
    } else {
        // Check for embedded Sumário within the document
        const sumarioMarkerRegex = /<(?:h[1-6]|p|strong)[^>]*>\s*(?:<strong>)?\s*(?:SUMÁRIO|Sumário|Sumário do Acórdão|Sumário elaborado pelo Relator)[\s\.:\-_]*\s*(?:<\/strong>)?\s*<\/(?:h[1-6]|p|strong)>/i;
        const match = htmlContent.search(sumarioMarkerRegex);

        if (match !== -1) {
            temSumario = true;
            // Look for transition to body: e.g. "I - Relatório", "Acórdão", "Decisão", "Texto Integral"
            const bodyMarkerRegex = /<(?:h[1-6]|p|strong)[^>]*>\s*(?:<strong>)?\s*(?:I\s*[\.\-–—]\s*Relatório|ACÓRDÃO|Acórdão|TEXTO INTEGRAL|Decisão)[\s\.:\-_]*\s*(?:<\/strong>)?\s*<\/(?:h[1-6]|p|strong)>/i;
            const subContent = htmlContent.slice(match);
            const bodyMatch = subContent.search(bodyMarkerRegex);

            if (bodyMatch > 50) {
                sumarioHtml = subContent.slice(0, bodyMatch).trim();
                textoHtml = subContent.slice(bodyMatch).trim();
            } else {
                // Keep the whole content in Texto, extract plain summary
                sumarioHtml = "";
            }
        }
    }

    // Build the PartialJurisprudenciaDocument object
    const doc: PartialJurisprudenciaDocument = {
        "Número de Processo": processo,
        "Data": data,
        "STATE": "importação",
        "Fonte": "STJ (Manual / Ficheiro)",
        "Jurisprudência": { Index: ["Simples"], Original: ["Simples"], Show: ["Simples"] },
    };

    if (textoHtml) {
        doc["Texto"] = textoHtml;
        doc["Texto Não Anonimizado"] = textoHtml;
    }

    if (sumarioHtml) {
        doc["Sumário"] = sumarioHtml;
        doc["Sumário Não Anonimizado"] = sumarioHtml;
    }

    if (relator) {
        doc["Relator Nome Profissional"] = canonicalGeneric("Relator Nome Profissional", [relator]);
    }

    if (seccaoCanonical) {
        doc["Secção"] = { Index: [seccaoCanonical], Original: [seccaoCandidate || seccaoCanonical], Show: [seccaoCanonical] };
    }

    if (area) {
        doc["Área"] = { Index: [area], Original: [area], Show: [area] };
    }

    if (meioProcessual) {
        doc["Meio Processual"] = canonicalGeneric("Meio Processual", [meioProcessual]);
    }

    if (decisao) {
        doc["Decisão"] = canonicalGeneric("Decisão", [decisao]);
    }

    if (descritores.length > 0) {
        doc["Descritores"] = { Index: descritores, Original: descritores, Show: descritores };
    }

    if (extractedImageHashes.length > 0) {
        doc["hasImages"] = true;
        doc["imageHashes"] = extractedImageHashes;
    }

    return {
        ok: true,
        filename,
        parsedDoc: doc,
        summary: {
            filename,
            processo: processo || undefined,
            relator: relator || undefined,
            data,
            seccao: seccaoCanonical || undefined,
            area: area || undefined,
            meioProcessual: meioProcessual || undefined,
            decisao: decisao || undefined,
            descritores: descritores.length > 0 ? descritores : undefined,
            temSumario,
            caracteresTexto: rawText.length,
            numImagens: extractedImageHashes.length
        }
    };
}
