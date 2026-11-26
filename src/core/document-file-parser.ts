import mammoth from "mammoth";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
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
    "Tribunal de Conflitos": "Conflitos",
    "Conflitos": "Conflitos",
    "Formação": "Formação"
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

function formatValidPtDate(dayNum: number, monthNum: number, yearNum: number): string | undefined {
    if (yearNum < 1900 || yearNum > 2099) return undefined;
    if (monthNum < 1 || monthNum > 12) return undefined;
    if (dayNum < 1 || dayNum > 31) return undefined;
    const d = String(dayNum).padStart(2, "0");
    const m = String(monthNum).padStart(2, "0");
    return `${d}/${m}/${yearNum}`;
}

function formatTodayPt(): string {
    const now = new Date();
    return formatValidPtDate(now.getDate(), now.getMonth() + 1, now.getFullYear())!;
}

function matchAllTextDates(text: string): string[] {
    const results: string[] = [];
    const regex = /\b([0-3]?[0-9])\s+de\s+([a-zA-ZçÇãõáéíóú]+)\s+de\s+(20\d\d|19\d\d)\b/gi;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
        const day = parseInt(m[1], 10);
        const monthName = m[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const monthStr = MONTHS_PT[monthName] || MONTHS_PT[m[2].toLowerCase()];
        const year = parseInt(m[3], 10);
        if (monthStr) {
            const formatted = formatValidPtDate(day, parseInt(monthStr, 10), year);
            if (formatted) results.push(formatted);
        }
    }
    return results;
}

function matchAllNumericDates(text: string): string[] {
    const results: string[] = [];
    // DD/MM/YYYY or DD-MM-YYYY
    const dmyRegex = /\b([0-3]?[0-9])[\/\-]([0-1]?[0-9])[\/\-](20\d\d|19\d\d)\b/g;
    let m: RegExpExecArray | null;
    while ((m = dmyRegex.exec(text)) !== null) {
        const formatted = formatValidPtDate(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
        if (formatted) results.push(formatted);
    }
    // YYYY-MM-DD or YYYY/MM/DD
    const ymdRegex = /\b(20\d\d|19\d\d)[\/\-]([0-1]?[0-9])[\/\-]([0-3]?[0-9])\b/g;
    while ((m = ymdRegex.exec(text)) !== null) {
        const formatted = formatValidPtDate(parseInt(m[3], 10), parseInt(m[2], 10), parseInt(m[1], 10));
        if (formatted) results.push(formatted);
    }
    return results;
}

function parsePortugueseDate(text: string, filename?: string): string | undefined {
    // 1. Explicit "Data:" / "Data do Acórdão:" field
    const explicitMatch = text.match(/(?:Data(?:\s+do\s+Ac[óo]rd[ãa]o)?)\s*[:\-]\s*([^\r\n]{6,40})/i);
    if (explicitMatch) {
        const txtDates = matchAllTextDates(explicitMatch[1]);
        if (txtDates.length > 0) return txtDates[0];
        const numDates = matchAllNumericDates(explicitMatch[1]);
        if (numDates.length > 0) return numDates[0];
    }

    // 2. Closing signature date: "Lisboa, 18 de Novembro de 2026" or "Supremo Tribunal de Justiça, 4 de novembro de 2026"
    // Require comma/dash directly followed by the date (or "em <date>") so footnote precedent citations like
    // "Acórdão do STJ, de 22/04/2020" or "Acórdão do Supremo Tribunal de Justiça de 30 de maio de 2017" never match.
    const closingRegex = /(?:^|[.\s])(?:Lisboa|Supremo\s+Tribunal\s+de\s+Justi[çc]a|STJ)\s*[,\-–—]\s*(?:em\s+)?(\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+\s+de\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi;
    const closingDates: string[] = [];
    let cm: RegExpExecArray | null;
    while ((cm = closingRegex.exec(text)) !== null) {
        const td = matchAllTextDates(cm[1]);
        if (td.length > 0) closingDates.push(td[td.length - 1]);
        const nd = matchAllNumericDates(cm[1]);
        if (nd.length > 0) closingDates.push(nd[nd.length - 1]);
    }
    if (closingDates.length > 0) {
        return closingDates[closingDates.length - 1];
    }

    // 3. Opening header: "Acordam no Supremo Tribunal de Justiça em 28 de Outubro de 2026"
    const openingMatch = text.match(/Acordam[^.\r\n]{0,120}\bem\s+([^\r\n.]{6,40})/i);
    if (openingMatch) {
        const td = matchAllTextDates(openingMatch[1]);
        if (td.length > 0) return td[0];
        const nd = matchAllNumericDates(openingMatch[1]);
        if (nd.length > 0) return nd[0];
    }

    // 4. Last textual Portuguese date ("DD de Mês de YYYY") — avoids factual case dates in the Relatório
    const allTextDates = matchAllTextDates(text);
    if (allTextDates.length > 0) {
        return allTextDates[allTextDates.length - 1];
    }

    // 5. Filename date fallback (e.g. DD-MM-YYYY or YYYY-MM-DD)
    if (filename) {
        const fnDates = matchAllNumericDates(filename.replace(/_/g, "-"));
        if (fnDates.length > 0) return fnDates[fnDates.length - 1];
    }

    // 6. Last valid numeric date in the document
    const allNumDates = matchAllNumericDates(text);
    if (allNumDates.length > 0) {
        return allNumDates[allNumDates.length - 1];
    }

    return undefined;
}

function plainTextToHtml(text: string): string {
    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<p>${line}</p>`)
        .join("");
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
    } else if (ext === ".pdf") {
        try {
            rawText = execFileSync("pdftotext", ["-", "-"], { input: buffer, encoding: "utf-8", timeout: 10000 }) || "";
        } catch {
            // pdftotext unavailable: avoid decoding binary %PDF streams as raw UTF-8 text
            const asciiHead = buffer.subarray(0, 16).toString("ascii");
            rawText = asciiHead.startsWith("%PDF") ? "" : buffer.toString("utf-8");
        }
        htmlContent = plainTextToHtml(rawText);
    } else {
        // Fallback for plain text or simple extraction
        rawText = buffer.toString("utf-8");
        htmlContent = plainTextToHtml(rawText);
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
    let data = parsePortugueseDate(rawText, filename) || formatTodayPt();

    // 4. Secção & Área
    // Prefer explicit Secção header, STJ "Acordam ... Secção ... STJ" opening, or special tribunals,
    // ignoring lower-court section mentions ("Tribunal da Comarca / Relação / Instância Central ... 2ª Secção").
    let seccaoCandidate = "";
    const explicitSeccaoMatch = rawText.match(/^\s*Sec[cç][aã]o\s*[:\-]\s*([^\r\n]+)/im);
    const acordamSeccaoMatch = rawText.match(/Acordam[^.\r\n]{0,80}?\b([1-7]\.?[ºªa]?\s*Secção(?:\s*\(?[A-Za-záéíóú]+\)?)?|Secção\s+(?:Social|Cível|Criminal|de\s+Contencioso|do\s+Contencioso|de\s+Formação|da\s+Formação|de\s+Conflitos)|Formação)\b[^.\r\n]{0,80}?(?:Supremo\s+Tribunal\s+de\s+Justi[çc]a|STJ|\r?\n|$)/i);
    const filteredTextForSeccao = rawText
        .split(/\r?\n/)
        .filter(line => !/(?:Tribunal\s+da\s+(?:Comarca|Rela[cç][aã]o)|Inst[aâ]ncia\s+Central|Ju[ií]zo\s)/i.test(line))
        .join("\n");
    const seccaoMatch =
        explicitSeccaoMatch
        || acordamSeccaoMatch
        || filteredTextForSeccao.match(/\b([1-7]\.?[ªa]?\s*Secção(?:\s*\([A-Za-záéíóú]+\))?|Secção\s*(?:Cível|Criminal|Social|de\s+Contencioso|do\s+Contencioso|de\s+Formação|da\s+Formação|de\s+Conflitos)|Tribunal\s+(?:de|dos)\s+Conflitos|Formação\s+de\s+Apreciação\s+Preliminar)\b/i)
        || filteredTextForSeccao.match(/(?:Acordam\s+na|Secção\s+da?)\s+(Formação)\b/)
        || filteredTextForSeccao.match(/\b(Contencioso|Conflitos)\b/);
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
        (doc as any)["hasImages"] = true;
        (doc as any)["imageHashes"] = extractedImageHashes;
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
