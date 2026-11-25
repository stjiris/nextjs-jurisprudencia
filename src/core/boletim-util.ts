import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import type { NextApiResponse } from "next";

export interface ColectivoJudges {
    relator: string;
    adjuntos: string[];
}

export interface BoletimEntry {
    index: number;
    id: string;
    data: string;
    processo: string;
    seccao?: string;
    area?: string;
    meioProcessual?: string;
    descritores: string[];
    sumario: string;
    colectivo: ColectivoJudges;
    permalink: string;
}

export interface DescriptorIndexItem {
    descriptor: string;
    isDiscontinued?: boolean;
    entries: {
        index: number;
        processo: string;
        data: string;
    }[];
}

export function isDiscontinuedDescriptor(desc: string): boolean {
    // Deprecated quote-based heuristic removed: quotes/apostrophes are formatting artifacts from Word/OCR.
    return false;
}

export function resolveRelator(src: any): string[] | string | null {
    if (!src) return null;
    const rProf = src["Relator Nome Profissional"];
    if (rProf) {
        if (Array.isArray(rProf)) return rProf;
        if (typeof rProf === "string") return rProf;
        if (Array.isArray(rProf.Show) && rProf.Show.length > 0) return rProf.Show;
        if (Array.isArray(rProf.Original) && rProf.Original.length > 0) return rProf.Original;
        if (typeof rProf.Show === "string") return rProf.Show;
        if (typeof rProf.Original === "string") return rProf.Original;
    }
    const rComp = src["Relator Nome Completo"];
    if (rComp) {
        if (Array.isArray(rComp)) return rComp;
        if (typeof rComp === "string") return rComp;
        if (Array.isArray(rComp.Show) && rComp.Show.length > 0) return rComp.Show;
        if (Array.isArray(rComp.Original) && rComp.Original.length > 0) return rComp.Original;
    }
    const rOrig = src.Original?.["Relator Nome Profissional"] || src.Original?.["Relator"] || src.Original?.["Relator Nome Completo"];
    if (rOrig) {
        if (Array.isArray(rOrig)) return rOrig;
        if (typeof rOrig === "string") return rOrig;
    }
    return null;
}

export function cleanDescriptorName(desc: string): string {
    if (!desc) return "";
    return desc
        .trim()
        .replace(/^['’`"“”«»\s]+|['’`"“”«»\s]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function normalizeSeccao(raw?: string): string | undefined {
    if (!raw) return undefined;
    let s = raw.trim();
    if (!s) return undefined;

    // Normalizar variações sem acento de Seccao / Secao
    s = s.replace(/\bse[cç][aã]o\s*social\b/gi, "Secção Social");
    s = s.replace(/\bse[cç][oõ]es\s*c[ií]veis\b/gi, "Secções Cíveis");
    s = s.replace(/\bse[cç][aã]o\s*c[ií]vel\b/gi, "Secção Cível");
    s = s.replace(/\bse[cç][oõ]es\s*criminais\b/gi, "Secções Criminais");
    s = s.replace(/\bse[cç][aã]o\s*criminal\b/gi, "Secção Criminal");
    s = s.replace(/\bse[cç][aã]o\s*(?:do\s*)?contencioso\b/gi, "Secção do Contencioso");
    s = s.replace(/\bse[cç][aã]o\s*(?:de\s*|da\s*)?forma[cç][aã]o\b/gi, "Formação");
    s = s.replace(/\bforma[cç][aã]o(?:\s+de\s+aprecia[cç][aã]o\s+preliminar)?\b/gi, "Formação");
    
    // Normalizar ordinais: "1ª", "1a", "1 ª", "1.ª"
    s = s.replace(/\b([1-7])\s*[ºªa]\s*(?:se[cç][aã]o)?\b/gi, "$1.ª Secção");
    s = s.replace(/\bse[cç][aã]o\b/gi, "Secção");
    s = s.replace(/\bse[cç][oõ]es\b/gi, "Secções");
    return s;
}

export function formatSubtitle(area: string): string {
    const clean = (area || "").trim();
    if (/social/i.test(clean)) return "Sumários de Acórdãos da Secção Social (4.ª Secção)";
    if (/c[ií]vel|c[ií]veis/i.test(clean)) return "Sumários de Acórdãos das Secções Cíveis (1.ª, 2.ª e 7.ª Secções)";
    if (/criminal|criminais/i.test(clean)) return "Sumários de Acórdãos das Secções Criminais (3.ª e 5.ª Secções)";
    if (/contencioso/i.test(clean)) return "Sumários de Acórdãos da Secção de Contencioso";
    if (/c[o]?nflitos/i.test(clean)) return "Sumários de Acórdãos do Tribunal de Conflitos";
    if (/forma[cç][aã]o/i.test(clean)) return "Sumários de Acórdãos da Formação de Apreciação Preliminar";

    let normalized = clean
        .replace(/^Area\b/i, "Área")
        .replace(/\b([1-7])\s*[ºªa]\s*(?:se[cç][aã]o)?\b/gi, "$1.ª Secção")
        .replace(/\bse[cç][aã]o\b/gi, "Secção")
        .replace(/\bse[cç][oõ]es\b/gi, "Secções");

    return `Sumários de Acórdãos — ${normalized}`;
}

export function splitDescritores(descritores: string[]): {
    regular: string[];
    discontinued: string[];
} {
    const regular: string[] = [];
    const discontinued: string[] = [];

    for (const d of descritores) {
        const cleaned = cleanDescriptorName(d);
        if (!cleaned) continue;
        if (isDiscontinuedDescriptor(cleaned)) {
            discontinued.push(cleaned);
        } else {
            regular.push(cleaned);
        }
    }

    regular.sort((a, b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" }));
    discontinued.sort((a, b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" }));

    return { regular, discontinued };
}

export interface DescriptorIndexGroup {
    letter: string;
    items: DescriptorIndexItem[];
}

export interface BoletimRenderOptions {
    title: string;
    subtitle: string;
    area: string;
    year: string;
    month: string; // "1" to "12" or "all"
    entries: BoletimEntry[];
    descritorFilter?: string;
    searchQuery?: string;
    periodStr?: string;
    emissionDate?: string;
    fontSize?: string; // e.g. "10pt" | "11pt" | "12pt" | "13pt" (default: "11pt")
    indexPosition?: "start" | "end" | "none"; // default: "end"
    docxDownloadUrl?: string;
    omitLogo?: boolean;
    omitTitle?: boolean;
    omitPeriod?: boolean;
    omitFilters?: boolean;
}

// Cached Base64 of STJ Institutional Logo
let _stjLogoBase64: string | null = null;

export function getStjLogoBase64(): string {
    if (_stjLogoBase64) return _stjLogoBase64;
    try {
        const logoPath = path.join(process.cwd(), "public", "stj-logo.png");
        if (fs.existsSync(logoPath)) {
            _stjLogoBase64 = fs.readFileSync(logoPath).toString("base64");
            return _stjLogoBase64;
        }
    } catch {
        // Fallback gracefully if filesystem read fails
    }
    return "";
}

/**
 * Strips honorifics, numbers, and signature metadata from a judge's name.
 */
export function cleanJudgeName(name: string): string {
    if (!name) return "";
    return name
        .replace(/^[\s\-–—*•\d.ºª°]+/, "")
        .replace(/^(?:(?:Ju[ií]z(?:es)?|Conselheiro[sa]?|Desembargador(?:es)?|Adjunt[oa]s?|Srs?\b\.?|Doutor(?:es)?|Dra?\b\.?|O\s+Relator|A\s+Relatora)[\s.:,-]*)+/gi, "")
        .replace(/\s*\((?:com\s+)?(?:declara[çc][aã]o|vencid[oa]|voto).*\)$/i, "")
        .replace(/\s*\(assinado\s+(?:digital|electr[oó]nica)mente\)$/i, "")
        .replace(/^[:\s\-–—.]+/, "")
        .replace(/\s*,\s*$/, "")
        .trim();
}

/**
 * Extracts the full panel of judges (Colectivo: Relator + Adjuntos)
 * from decision text or falls back to the Relator field.
 */
export function extractColectivo(
    texto?: string | null,
    relatorRaw?: string[] | string | null
): ColectivoJudges {
    let relator = "";
    if (Array.isArray(relatorRaw)) {
        relator = relatorRaw[0] || "";
    } else if (typeof relatorRaw === "string") {
        relator = relatorRaw;
    }
    relator = cleanJudgeName(relator);

    const adjuntos: string[] = [];

    if (texto) {
        const clean = texto
            .replace(/<br\s*[\/]?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<\/div>/gi, "\n")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/\r/g, "");

        const lines = clean
            .split("\n")
            .map(l => l.trim())
            .filter(Boolean);

        const tail = lines.slice(-60);

        // Pattern 1: explicit "(Relator)" or "(Relatora)"
        const relatorIdx = tail.findIndex(l => /\(relator[a]?\)/i.test(l));
        if (relatorIdx !== -1) {
            const rLine = tail[relatorIdx];
            const match = rLine.match(/^(.+?)\s*\((relator[a]?)\)/i);
            if (match) {
                relator = `${cleanJudgeName(match[1])} (${match[2].toLowerCase() === "relatora" ? "Relatora" : "Relator"})`;
            } else {
                const isRelatora = /relatora/i.test(rLine);
                const namePart = rLine.replace(/\(relator[a]?\)/i, "").trim();
                if (namePart) {
                    relator = `${cleanJudgeName(namePart)} (${isRelatora ? "Relatora" : "Relator"})`;
                }
            }

            for (let i = relatorIdx + 1; i < tail.length; i++) {
                const line = tail[i].trim();
                if (!line) continue;
                if (/^(lisboa|porto|coimbra|data|processo|proc|sum[aá]rio|tribunal|custa|taxa|voto|confer[êe]ncia|acordam)/i.test(line)) {
                    break;
                }
                if (line.length > 60) break;
                if (/assinado\s+(digital|electr[oó]nica)mente/i.test(line)) continue;
                if (/^\(?(com\s+declara[çc][aã]o|vencid[oa]|voto)/i.test(line)) break;

                const cleaned = cleanJudgeName(line);
                if (cleaned && cleaned.length > 3 && !adjuntos.includes(cleaned) && cleaned !== relator.replace(/\s*\(relator[a]?\)/i, "").trim()) {
                    adjuntos.push(cleaned);
                }
            }
        }

        // Pattern 2: "Adjuntos:"
        if (adjuntos.length === 0) {
            const adjIdx = tail.findIndex(l => /^(?:os\s+)?adjuntos?\s*[:,-]?/i.test(l));
            if (adjIdx !== -1) {
                for (let i = adjIdx + 1; i < tail.length; i++) {
                    const line = tail[i].trim();
                    if (!line) continue;
                    if (/^(lisboa|porto|coimbra|data|processo|proc|custa|taxa|voto)/i.test(line)) break;
                    if (line.length > 60) break;
                    if (/assinado\s+(digital|electr[oó]nica)mente/i.test(line)) continue;
                    const cleaned = cleanJudgeName(line);
                    if (cleaned && cleaned.length > 3 && !adjuntos.includes(cleaned) && cleaned !== relator.replace(/\s*\(relator[a]?\)/i, "").trim()) {
                        adjuntos.push(cleaned);
                    }
                }
            }
        }

        // Pattern 3: "Atesto que os... adjuntos... votaram em conformidade"
        if (adjuntos.length === 0) {
            const atesto = tail.find(l => /atesto\s+que/i.test(l));
            if (atesto) {
                const m = atesto.match(/adjuntos?\s+(.+?)(?:deram|votaram|t[êe]m|n[ãa]o\s+assinam)/i);
                if (m) {
                    const names = m[1].split(/\s+e\s+|,\s*/).map(cleanJudgeName).filter(n => n.length > 3);
                    for (const n of names) {
                        if (!adjuntos.includes(n) && n !== relator.replace(/\s*\(relator[a]?\)/i, "").trim()) {
                            adjuntos.push(n);
                        }
                    }
                }
            }
        }
    }

    if (relator && !/\(relator[a]?\)/i.test(relator)) {
        const isFemale = /\b(Ana|Maria|Albertina|Catarina|Helena|Isabel|Adelina|Fátima|Rosa|Margarida|Teresa|Paula|Graça|Leonor)\b/i.test(relator);
        relator = `${relator} (${isFemale ? "Relatora" : "Relator"})`;
    }

    return { relator: relator || "Relator não especificado", adjuntos };
}

/**
 * Builds the canonical public permalink for a decision.
 */
export function generatePermalink(proc?: string | null, uuid?: string | null, baseUrl: string = "https://juris.stj.pt"): string {
    if (proc && uuid) {
        return `${baseUrl}/${encodeURIComponent(proc)}/${uuid}`;
    }
    if (proc) {
        return `${baseUrl}/pesquisa?N%C3%BAmero+de+Processo=${encodeURIComponent(proc)}`;
    }
    return baseUrl;
}

/**
 * Normalizes descriptors and builds an Alphabetical Descriptor Index.
 */
export function buildDescriptorIndex(entries: BoletimEntry[]): DescriptorIndexGroup[] {
    const map = new Map<string, { isDiscontinued: boolean; entries: DescriptorIndexItem["entries"] }>();

    for (const entry of entries) {
        for (const rawDesc of entry.descritores) {
            const isDiscontinued = isDiscontinuedDescriptor(rawDesc);
            const cleaned = cleanDescriptorName(rawDesc);
            const desc = cleaned.replace(/^[:\-–,."“«]+|[:\-–,."”»]+$/g, "").trim();
            if (!desc) continue;
            if (!map.has(desc)) {
                map.set(desc, { isDiscontinued, entries: [] });
            }
            const item = map.get(desc)!;
            if (isDiscontinued) item.isDiscontinued = true;
            if (!item.entries.some(e => e.index === entry.index)) {
                item.entries.push({
                    index: entry.index,
                    processo: entry.processo,
                    data: entry.data
                });
            }
        }
    }

    // Sort descriptors alphabetically using pt-PT locale
    const sortedDesc = Array.from(map.keys()).sort((a, b) =>
        a.localeCompare(b, "pt-PT", { sensitivity: "base" })
    );

    const groupMap = new Map<string, DescriptorIndexItem[]>();

    for (const desc of sortedDesc) {
        const normalizedFirstChar = desc.charAt(0).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const letter = /^[A-Z]$/.test(normalizedFirstChar) ? normalizedFirstChar : "#";
        if (!groupMap.has(letter)) {
            groupMap.set(letter, []);
        }
        const data = map.get(desc)!;
        groupMap.get(letter)!.push({
            descriptor: desc,
            isDiscontinued: data.isDiscontinued,
            entries: data.entries
        });
    }

    const sortedLetters = Array.from(groupMap.keys()).sort((a, b) => {
        if (a === "#") return 1;
        if (b === "#") return -1;
        return a.localeCompare(b, "pt-PT");
    });

    return sortedLetters.map(letter => ({
        letter,
        items: groupMap.get(letter)!
    }));
}

const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function formatPeriodHeader(month: string, year: string): string {
    if (month === "all" || month === "ano" || month === "0") {
        return `Boletim Anual de ${year}`;
    }
    const mNum = parseInt(month, 10);
    const mName = MONTH_NAMES[mNum - 1] || month;
    return `${mName} de ${year}`;
}

/**
 * Generates institutional, responsive, print-ready HTML matching the official STJ Docx standards.
 */
export function generateBoletimHTML(options: BoletimRenderOptions): string {
    const {
        title,
        subtitle,
        area,
        year,
        month,
        entries,
        descritorFilter,
        searchQuery,
        periodStr: customPeriodStr,
        emissionDate,
        fontSize = "11pt",
        indexPosition = "end",
        docxDownloadUrl,
        omitLogo = false,
        omitTitle = false,
        omitPeriod = false,
        omitFilters = false
    } = options;
    const logoBase64 = getStjLogoBase64();
    const logoSrc = logoBase64 ? `data:image/png;base64,${logoBase64}` : "/stj-logo.png";
    const periodStr = customPeriodStr || formatPeriodHeader(month, year);
    const indexGroups = buildDescriptorIndex(entries);

    // Font size scaling
    let baseFontSize = "11pt";
    let descFontSize = "1.05rem";
    let summaryFontSize = "1rem";
    let metaFontSize = "0.95rem";
    let summaryLineHeight = "1.6";

    switch ((fontSize || "").toLowerCase()) {
        case "10pt":
        case "sm":
        case "small":
            baseFontSize = "10pt";
            descFontSize = "0.98rem";
            summaryFontSize = "0.92rem";
            metaFontSize = "0.85rem";
            summaryLineHeight = "1.5";
            break;
        case "12pt":
        case "md":
        case "medium":
            baseFontSize = "12pt";
            descFontSize = "1.12rem";
            summaryFontSize = "1.06rem";
            metaFontSize = "1rem";
            summaryLineHeight = "1.65";
            break;
        case "13pt":
        case "lg":
        case "large":
            baseFontSize = "13pt";
            descFontSize = "1.18rem";
            summaryFontSize = "1.12rem";
            metaFontSize = "1.05rem";
            summaryLineHeight = "1.7";
            break;
        case "11pt":
        default:
            baseFontSize = "11pt";
            descFontSize = "1.05rem";
            summaryFontSize = "1rem";
            metaFontSize = "0.95rem";
            summaryLineHeight = "1.6";
            break;
    }

    return `<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHTML(title)}</title>
    <style>
        :root {
            --stj-primary: #8b181b;
            --stj-gold: #c29b38;
            --stj-dark: #1f2937;
            --stj-gray: #4b5563;
            --stj-light: #f9fafb;
            --stj-border: #e5e7eb;
            --stj-link: #1d4ed8;
            --font-serif: "Times New Roman", Times, Georgia, serif;
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            --base-font-size: ${baseFontSize};
            --desc-font-size: ${descFontSize};
            --summary-font-size: ${summaryFontSize};
            --meta-font-size: ${metaFontSize};
            --summary-line-height: ${summaryLineHeight};
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--font-serif);
            font-size: var(--base-font-size);
            color: var(--stj-dark);
            background-color: #f3f4f6;
            line-height: var(--summary-line-height);
            padding: 2rem 1rem;
        }

        .document-container {
            max-width: 860px;
            margin: 0 auto;
            background: #ffffff;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            border-radius: 8px;
            padding: 3rem 3.5rem;
        }

        /* Institutional Header */
        .boletim-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 2rem;
            padding-bottom: 2rem;
            border-bottom: 2px solid var(--stj-gold);
            margin-bottom: 2.5rem;
        }

        .header-logo-container img {
            height: 85px;
            width: auto;
            object-fit: contain;
        }

        .header-text {
            text-align: right;
        }

        .stj-republica {
            font-family: var(--font-sans);
            font-size: 0.75rem;
            letter-spacing: 0.15em;
            color: var(--stj-gray);
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 0.25rem;
        }

        .stj-org-title {
            font-size: 1.5rem;
            font-weight: bold;
            color: var(--stj-primary);
            letter-spacing: 0.05em;
            margin-bottom: 0.25rem;
        }

        .boletim-title {
            font-size: 1.15rem;
            font-weight: bold;
            color: var(--stj-dark);
        }

        .boletim-period {
            font-size: 0.95rem;
            color: var(--stj-gray);
            margin-top: 0.25rem;
        }

        .filter-badge-box {
            background-color: #fef3c7;
            border: 1px solid #fde68a;
            border-radius: 6px;
            padding: 0.75rem 1rem;
            margin-bottom: 2rem;
            font-family: var(--font-sans);
            font-size: 0.875rem;
            color: #92400e;
        }

        /* Entries */
        .boletim-entry {
            margin-bottom: 2.5rem;
            padding-bottom: 2rem;
            border-bottom: 1px solid var(--stj-border);
            page-break-inside: auto;
            break-inside: auto;
        }

        .boletim-entry:last-of-type {
            border-bottom: none;
        }

        /* Caixa de Metadados com Contornos Pretos */
        .entry-metadata-box {
            border: 1.5px solid #000000;
            border-radius: 4px;
            padding: 1.15rem 1.35rem;
            margin-bottom: 1.35rem;
            background-color: #ffffff;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: avoid;
            break-after: avoid;
        }

        .descriptors-container {
            display: grid;
            grid-template-columns: 1fr 1px 1fr;
            gap: 1.25rem;
            margin-bottom: 1rem;
            padding-bottom: 0.85rem;
            border-bottom: 1px solid #d1d5db;
        }

        .descriptors-container.single-column {
            display: block;
            grid-template-columns: none;
        }

        .desc-column {
            min-width: 0;
        }

        .desc-column-divider {
            background-color: #9ca3af;
            width: 1px;
        }

        .desc-column-title {
            font-weight: bold;
            font-size: var(--desc-font-size, 1.05rem);
            color: #000000;
            margin-bottom: 0.45rem;
            text-align: left;
        }

        .desc-list {
            list-style-type: none;
            padding-left: 0.85rem;
            margin: 0;
        }

        .desc-list li {
            font-weight: bold;
            font-size: var(--desc-font-size, 1.02rem);
            color: #111827;
            line-height: 1.35;
            margin-bottom: 0.2rem;
        }

        .desc-list.discontinued li {
            font-style: italic;
            font-weight: normal;
            color: #374151;
        }

        .box-meta-details {
            font-size: var(--meta-font-size, 0.95rem);
            color: #1f2937;
            line-height: 1.5;
        }

        .meta-line {
            margin-bottom: 0.2rem;
        }

        .meta-date {
            font-weight: 500;
        }

        .meta-proc {
            font-weight: 600;
        }

        .entry-colectivo {
            margin-top: 0.35rem;
            margin-bottom: 0.35rem;
        }

        .judge-name {
            display: block;
        }

        .judge-name.relator {
            font-weight: 500;
        }

        .entry-permalink {
            margin-top: 0.5rem;
            font-size: 0.875rem;
            word-break: break-all;
        }

        .entry-permalink a {
            color: var(--stj-link);
            text-decoration: underline;
        }

        .entry-permalink a:hover {
            color: #1e40af;
        }

        .entry-summary {
            font-size: var(--summary-font-size, 1rem);
            text-align: justify;
            text-justify: inter-word;
            line-height: var(--summary-line-height, 1.6);
            margin-bottom: 1.25rem;
            color: #111827;
            page-break-inside: auto;
            break-inside: auto;
        }

        .entry-summary p {
            margin-bottom: 0.75rem;
            orphans: 3;
            widows: 3;
        }

        /* Alphabetical Descriptor Index Section */
        .index-section {
            padding-top: 2rem;
            page-break-inside: auto;
        }

        .index-section.index-at-end {
            margin-top: 4rem;
            border-top: 2px solid var(--stj-gold);
            page-break-before: always;
            break-before: page;
        }

        .index-section.index-at-start {
            margin-top: 1rem;
            margin-bottom: 3.5rem;
            padding-bottom: 2rem;
            border-bottom: 2px solid var(--stj-gold);
        }

        .index-heading {
            font-size: 1.35rem;
            font-weight: bold;
            color: var(--stj-primary);
            text-align: center;
            margin-bottom: 1.5rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .index-letter-group {
            margin-bottom: 1.5rem;
            break-inside: avoid;
        }

        .index-letter-header {
            font-size: 1.25rem;
            font-weight: bold;
            color: var(--stj-primary);
            border-bottom: 1px solid var(--stj-border);
            padding-bottom: 0.25rem;
            margin-bottom: 0.5rem;
        }

        .index-item {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            font-size: 0.9rem;
            padding: 0.35rem 0;
            gap: 1.25rem;
            border-bottom: 1px dotted #e5e7eb;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .index-descriptor-name {
            font-weight: 500;
            color: #111827;
            flex-shrink: 0;
            max-width: 45%;
            line-height: 1.4;
            word-break: normal;
        }

        .index-entry-links {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            align-items: center;
            gap: 0.35rem;
            font-family: var(--font-sans);
            font-size: 0.8rem;
            flex: 1 1 auto;
            text-align: right;
        }

        .index-entry-links a {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--stj-link);
            text-decoration: none;
            padding: 0.15rem 0.4rem;
            background-color: #eff6ff;
            border-radius: 3px;
            border: 1px solid #bfdbfe;
            white-space: nowrap;
            line-height: 1.25;
            transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .index-entry-links a:hover {
            background-color: #dbeafe;
            border-color: #93c5fd;
        }

        @media (max-width: 600px) {
            .index-item {
                flex-direction: column;
                gap: 0.4rem;
            }
            .index-descriptor-name {
                max-width: 100%;
            }
            .index-entry-links {
                justify-content: flex-start;
            }
        }

        /* Print Specific Styling */
        @media print {
            body {
                background: none;
                padding: 0;
                font-size: var(--base-font-size, 11pt);
            }

            .document-container {
                box-shadow: none;
                border-radius: 0;
                padding: 0;
                max-width: 100%;
            }

            @page {
                size: A4;
                margin: 2.5cm 2.5cm 2.5cm 3.0cm;
                @top-left {
                    content: "${escapeHTML(subtitle)}";
                    font-family: "Times New Roman", serif;
                    font-size: 9pt;
                    color: #4b5563;
                }
                @top-right {
                    content: counter(page);
                    font-family: "Times New Roman", serif;
                    font-size: 9pt;
                }
            }

            .boletim-entry {
                page-break-inside: auto;
                break-inside: auto;
            }

            .entry-metadata-box {
                page-break-inside: avoid;
                break-inside: avoid;
                page-break-after: avoid;
                break-after: avoid;
            }

            .entry-summary {
                page-break-inside: auto;
                break-inside: auto;
            }

            .entry-summary p {
                orphans: 3;
                widows: 3;
            }

            .index-section.index-at-end {
                page-break-before: always;
                break-before: page;
            }

            .index-section.index-at-start {
                page-break-after: always;
                break-after: page;
            }

            .entry-permalink a {
                color: #000000;
                text-decoration: underline;
            }

            .boletim-interactive-toolbar {
                display: none !important;
            }
        }

        /* Interactive Customization Toolbar */
        .boletim-interactive-toolbar {
            position: sticky;
            top: 0;
            z-index: 9999;
            background: #1e293b;
            color: #f8fafc;
            padding: 0.65rem 1.25rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.12);
            font-family: var(--font-sans);
            font-size: 0.875rem;
        }

        .toolbar-brand {
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.4rem;
            white-space: nowrap;
            color: #94a3b8;
        }

        .toolbar-toggles {
            display: flex;
            align-items: center;
            gap: 1.25rem;
            flex-wrap: wrap;
        }

        .toolbar-toggles label {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            cursor: pointer;
            margin: 0;
            user-select: none;
            color: #e2e8f0;
            font-size: 0.85rem;
        }

        .toolbar-toggles input[type="checkbox"] {
            cursor: pointer;
            width: 15px;
            height: 15px;
            accent-color: #3b82f6;
        }

        .toolbar-actions {
            display: flex;
            align-items: center;
            gap: 0.65rem;
            white-space: nowrap;
        }

        .toolbar-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.4rem 0.85rem;
            border-radius: 4px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            border: none;
            font-size: 0.85rem;
            line-height: 1.2;
            transition: background 0.15s, transform 0.1s;
        }

        .btn-print {
            background: #2563eb;
            color: #ffffff;
        }

        .btn-print:hover {
            background: #1d4ed8;
        }

        .btn-docx {
            background: #059669;
            color: #ffffff;
        }

        .btn-docx:hover {
            background: #047857;
        }

        @media print {
            .d-print-none, .boletim-interactive-toolbar, #word-guide-modal {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
        }
    </style>
</head>
<body>
    <!-- Interactive Header Customization Toolbar -->
    <div class="boletim-interactive-toolbar d-print-none">
        <div class="toolbar-brand">
            <span>Ajustar Cabeçalho:</span>
        </div>
        <div class="toolbar-toggles">
            <label><input type="checkbox" id="toggle-logo"${omitLogo ? " checked" : ""} onchange="toggleHeaderElement('boletim-logo', !this.checked)" /> Omitir Logótipo</label>
            <label><input type="checkbox" id="toggle-title"${omitTitle ? " checked" : ""} onchange="toggleHeaderElement('boletim-header-text', !this.checked)" /> Omitir Título</label>
            <label><input type="checkbox" id="toggle-period"${omitPeriod ? " checked" : ""} onchange="toggleHeaderElement('boletim-period', !this.checked)" /> Omitir Período</label>
            <label><input type="checkbox" id="toggle-filters"${omitFilters ? " checked" : ""} onchange="toggleHeaderElement('boletim-filters', !this.checked)" /> Omitir Filtros</label>
        </div>
        <div class="toolbar-actions">
            <button type="button" class="toolbar-btn btn-print" onclick="window.print()" title="Imprimir documento ou Guardar em PDF">
                Imprimir / PDF
            </button>
            <button type="button" class="toolbar-btn btn-docx" onclick="openWordModal()" title="Opções e instruções para editar no Microsoft Word">
                Editar no Word
            </button>
        </div>
    </div>

    <!-- Word Guide Modal (Opção C: Alta Fidelidade via PDF Reflow ou DOCX Direto) -->
    <div id="word-guide-modal" class="d-print-none" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.65); z-index:99999; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(3px);">
        <div style="background:#ffffff; border-radius:10px; max-width:540px; width:100%; padding:1.75rem; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position:relative; max-height:90vh; overflow-y:auto;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.75rem;">
                <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:#1e293b; display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-size:1.35rem;">📝</span> Edição no Microsoft Word
                </h3>
                <button type="button" onclick="closeWordModal()" style="background:none; border:none; font-size:1.75rem; line-height:1; cursor:pointer; color:#94a3b8; padding:0 0.25rem;">&times;</button>
            </div>

            <!-- Recomendado: Abrir PDF no Word -->
            <div style="background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:8px; padding:1.25rem; margin-bottom:1.25rem;">
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
                    <span style="background:#2563eb; color:#ffffff; font-size:0.75rem; font-weight:700; text-transform:uppercase; padding:0.15rem 0.5rem; border-radius:4px;">Recomendado</span>
                    <h4 style="margin:0; font-size:1rem; color:#1e3a8a; font-weight:700;">Fidelidade Visual 100% Oficial</h4>
                </div>
                <p style="margin:0 0 0.75rem 0; font-size:0.875rem; color:#1e40af; line-height:1.5;">
                    O motor <strong>PDF Reflow do Microsoft Word</strong> converte o PDF oficial mantendo com máxima perfeição o logótipo do STJ, as molduras pretas, a disposição em 2 colunas e as etiquetas de índice:
                </p>
                <ol style="margin:0 0 1rem 1.25rem; font-size:0.85rem; color:#1e3a8a; line-height:1.5;">
                    <li>Clique abaixo em <strong>"Guardar como PDF"</strong> (no diálogo do navegador, escolha o destino <em>"Guardar como PDF"</em>).</li>
                    <li>No seu computador, clique com o botão direito no PDF descarregado e escolha <strong>"Abrir com" &rarr; "Word"</strong> (ou no Word: <em>Ficheiro &rarr; Abrir</em>).</li>
                </ol>
                <button type="button" onclick="printPdfFromModal()" style="background:#2563eb; color:#ffffff; border:none; padding:0.55rem 1.15rem; border-radius:6px; font-weight:600; font-size:0.9rem; cursor:pointer; display:inline-flex; align-items:center; gap:0.5rem; box-shadow:0 2px 4px rgba(37,99,235,0.2);">
                    <span>📄</span> 1. Guardar como PDF
                </button>
            </div>

            <!-- Alternativa: Descarregar .docx Direto -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem;">
                <h4 style="margin:0 0 0.35rem 0; font-size:0.9rem; color:#475569; font-weight:600;">
                    Em alternativa: Descarregamento .docx Direto
                </h4>
                <p style="margin:0 0 0.75rem 0; font-size:0.825rem; color:#64748b; line-height:1.45;">
                    Descarrega o documento Word gerado pelo servidor (ideal para rascunhos rápidos ou extração de texto):
                </p>
                ${docxDownloadUrl ? `
                <a id="btn-export-docx" href="${escapeHTML(docxDownloadUrl)}" class="toolbar-btn btn-docx" download style="display:inline-flex; text-decoration:none;" onclick="closeWordModal()">
                    <span>📥</span> Descarregar .docx Direto
                </a>` : ""}
            </div>
        </div>
    </div>

    <div class="document-container">
        <!-- STJ Institutional Header -->
        <header class="boletim-header" id="boletim-header">
            <div class="header-logo-container" id="boletim-logo"${omitLogo ? ' style="display:none;"' : ''}>
                <img src="${logoSrc}" alt="Supremo Tribunal de Justiça" />
            </div>
            <div class="header-text" id="boletim-header-text"${omitTitle ? ' style="display:none;"' : ''}>
                <div class="stj-republica">República Portuguesa</div>
                <div class="stj-org-title">Supremo Tribunal de Justiça</div>
                <div class="boletim-title">${escapeHTML(subtitle)}</div>
                <div class="boletim-period" id="boletim-period"${omitPeriod ? ' style="display:none;"' : ''}>
                    ${escapeHTML(periodStr)}
                    ${emissionDate ? ` &nbsp;•&nbsp; <span style="font-weight: normal; font-size: 0.9em; color: var(--stj-gray);">Compilado em ${escapeHTML(emissionDate)}</span>` : ""}
                </div>
            </div>
        </header>

        ${descritorFilter ? `
        <div class="filter-badge-box" id="boletim-filters"${omitFilters ? ' style="display:none;"' : ''}>
            <strong>Caderno Temático:</strong> Filtrado pelo descritor "<em>${escapeHTML(descritorFilter)}</em>"
        </div>` : ""}

        ${indexPosition === "start" ? `
        <!-- Alphabetical Descriptor Index (Início) -->
        <section id="indice-remissivo" class="index-section index-at-start">
            <h3 class="index-heading">Índice Alfabético por Tema / Descritor</h3>
            <div class="index-content">
                ${indexGroups.map(group => `
                <div class="index-letter-group">
                    <div class="index-letter-header">${group.letter}</div>
                    ${group.items.map(item => `
                    <div class="index-item">
                        <span class="index-descriptor-name">${item.isDiscontinued ? `<em>${escapeHTML(item.descriptor)}</em>` : escapeHTML(item.descriptor)}</span>
                        <span class="index-entry-links">
                            ${item.entries.map(e => `<a href="#entry-${e.index}" title="Proc. n.º ${escapeHTML(e.processo)} (${escapeHTML(e.data)})">${e.index}</a>`).join("")}
                        </span>
                    </div>
                    `).join("")}
                </div>
                `).join("")}
            </div>
        </section>` : ""}

        <!-- Decision Summaries -->
        <main class="boletim-body">
            ${entries.map(entry => `
            <article id="entry-${entry.index}" class="boletim-entry">
                <div class="entry-metadata-box">
                    ${(() => {
                        const cleanedList = (entry.descritores || [])
                            .map(d => cleanDescriptorName(d))
                            .filter(Boolean);
                        const unique = [...new Set(cleanedList)].sort((a, b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" }));
                        return `
                        <div class="descriptors-container single-column">
                            <div class="desc-column">
                                <div class="desc-column-title">Descritores</div>
                                <ul class="desc-list">
                                    ${unique.map(d => `<li>${escapeHTML(d)}</li>`).join("")}
                                </ul>
                            </div>
                        </div>`;
                    })()}

                    <div class="box-meta-details">
                        <div class="meta-line meta-date">${escapeHTML(entry.data)}</div>
                        <div class="meta-line meta-proc">Proc. n.º ${escapeHTML(entry.processo)}${entry.seccao ? ` - ${escapeHTML(entry.seccao)}` : ""}</div>
                        <div class="entry-colectivo">
                            <span class="judge-name relator">${escapeHTML(entry.colectivo.relator)}</span>
                            ${entry.colectivo.adjuntos.map(adj => `<span class="judge-name adjunto">${escapeHTML(adj)}</span>`).join("")}
                        </div>
                        <div class="entry-permalink">
                            <a href="${escapeHTML(entry.permalink)}" target="_blank" rel="noopener noreferrer">${escapeHTML(entry.permalink)}</a>
                        </div>
                    </div>
                </div>

                <div class="entry-summary">
                    ${formatSummaryHTML(entry.sumario)}
                </div>
            </article>
            `).join("")}
        </main>

        ${indexPosition === "end" ? `
        <!-- Alphabetical Descriptor Index (Fim) -->
        <footer id="indice-remissivo" class="index-section index-at-end">
            <h3 class="index-heading">Índice Alfabético por Tema / Descritor</h3>
            <div class="index-content">
                ${indexGroups.map(group => `
                <div class="index-letter-group">
                    <div class="index-letter-header">${group.letter}</div>
                    ${group.items.map(item => `
                    <div class="index-item">
                        <span class="index-descriptor-name">${item.isDiscontinued ? `<em>${escapeHTML(item.descriptor)}</em>` : escapeHTML(item.descriptor)}</span>
                        <span class="index-entry-links">
                            ${item.entries.map(e => `<a href="#entry-${e.index}" title="Proc. n.º ${escapeHTML(e.processo)} (${escapeHTML(e.data)})">${e.index}</a>`).join("")}
                        </span>
                    </div>
                    `).join("")}
                </div>
                `).join("")}
            </div>
        </footer>` : ""}
    </div>
    <script>
    function openWordModal() {
        var m = document.getElementById("word-guide-modal");
        if (m) m.style.display = "flex";
    }
    function closeWordModal() {
        var m = document.getElementById("word-guide-modal");
        if (m) m.style.display = "none";
    }
    function printPdfFromModal() {
        closeWordModal();
        setTimeout(function() {
            window.print();
        }, 150);
    }
    window.addEventListener("keydown", function(e) {
        if (e.key === "Escape") closeWordModal();
    });
    document.addEventListener("DOMContentLoaded", function() {
        var modalEl = document.getElementById("word-guide-modal");
        if (modalEl) {
            modalEl.addEventListener("click", function(e) {
                if (e.target === modalEl) closeWordModal();
            });
        }
    });
    function toggleHeaderElement(id, show) {
        var el = document.getElementById(id);
        if (el) {
            el.style.display = show ? "" : "none";
        }
        var docxBtn = document.getElementById("btn-export-docx");
        if (docxBtn) {
            try {
                var url = new URL(docxBtn.href, window.location.origin);
                var map = {
                    'boletim-logo': 'omitLogo',
                    'boletim-header-text': 'omitTitle',
                    'boletim-period': 'omitPeriod',
                    'boletim-filters': 'omitFilters'
                };
                if (map[id]) {
                    if (!show) {
                        url.searchParams.set(map[id], "1");
                    } else {
                        url.searchParams.delete(map[id]);
                    }
                    docxBtn.href = url.pathname + url.search;
                }
            } catch(e){}
        }
    }
    </script>
</body>
</html>`;
}

/**
 * Generates formatted Markdown for Pandoc + XeLaTeX compilation.
 */
export function generateBoletimMarkdown(options: BoletimRenderOptions): string {
    const { title, subtitle, area, year, month, entries, descritorFilter, fontSize = "11pt", indexPosition = "end" } = options;
    const periodStr = formatPeriodHeader(month, year);
    const indexGroups = buildDescriptorIndex(entries);

    const lines: string[] = [];

    lines.push("---");
    lines.push(`title: "${title.replace(/"/g, '\\"')}"`);
    lines.push(`subtitle: "${subtitle.replace(/"/g, '\\"')}"`);
    lines.push(`date: "${periodStr}"`);
    const logoFile = fs.existsSync(path.join(process.cwd(), "public", "stj-logo.png"))
        ? path.join(process.cwd(), "public", "stj-logo.png").replace(/\\/g, "/")
        : fs.existsSync(path.join(process.cwd(), "stj-logo.png"))
        ? path.join(process.cwd(), "stj-logo.png").replace(/\\/g, "/")
        : "stj-logo.png";

    lines.push(`fontsize: ${fontSize}`);
    lines.push("geometry:");
    lines.push("  - a4paper");
    lines.push("  - top=2.5cm");
    lines.push("  - bottom=2.5cm");
    lines.push("  - left=3.0cm");
    lines.push("  - right=2.5cm");
    lines.push("header-includes:");
    lines.push("  - \\usepackage{fancyhdr}");
    lines.push("  - \\usepackage{graphicx}");
    lines.push("  - \\setlength{\\fboxrule}{1.2pt}");
    lines.push("  - \\setlength{\\fboxsep}{8pt}");
    lines.push("  - \\pagestyle{fancy}");
    lines.push("  - \\fancyhead{}");
    lines.push(`  - \\fancyhead[L]{\\small\\textbf{${subtitle.replace(/[\\&%$#_{}~^]/g, "\\$&")}}}`);
    lines.push(`  - \\fancyhead[R]{\\includegraphics[height=0.9cm]{${logoFile}}}`);
    lines.push("  - \\fancyfoot{}");
    lines.push(`  - \\fancyfoot[L]{\\small ${periodStr.replace(/[\\&%$#_{}~^]/g, "\\$&")}}`);
    lines.push("  - \\fancyfoot[R]{\\small Pág. \\thepage}");
    lines.push("  - \\renewcommand{\\headrulewidth}{0.4pt}");
    lines.push("  - \\renewcommand{\\footrulewidth}{0.4pt}");
    lines.push("---");
    lines.push("");

    if (descritorFilter) {
        lines.push(`> **Caderno Temático:** *${descritorFilter}*\n`);
    }

    const appendIndexMarkdown = () => {
        lines.push("\\newpage");
        lines.push("# Índice Alfabético por Tema / Descritor {.unnumbered}");
        lines.push("");

        for (const group of indexGroups) {
            lines.push(`## ${group.letter} {.unnumbered}`);
            for (const item of group.items) {
                const entryRefs = item.entries.map(e => `[${e.index}](#entry-${e.index})`).join(", ");
                const formattedDesc = item.isDiscontinued ? `*${item.descriptor}*` : `**${item.descriptor}**`;
                lines.push(`* ${formattedDesc}: ${entryRefs}`);
            }
            lines.push("");
        }
    };

    if (indexPosition === "start") {
        appendIndexMarkdown();
        lines.push("\\newpage");
    }

    for (const entry of entries) {
        lines.push("\\noindent");
        lines.push("\\fbox{\\begin{minipage}{\\dimexpr\\textwidth-2\\fboxsep-2\\fboxrule\\relax}");
        const cleanedList = (entry.descritores || [])
            .map(d => cleanDescriptorName(d))
            .filter(Boolean);
        const unique = [...new Set(cleanedList)].sort((a, b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" }));
        lines.push("{\\small\\textbf{Descritores}}\\par\\vspace{1pt}");
        for (const desc of unique) {
            lines.push(`\\quad {\\small\\textbf{${desc.replace(/[`\\&%$#_{}~^]/g, "")}}}\\par`);
        }
        lines.push("\\vspace{4pt}\\hrule\\vspace{4pt}");
        lines.push(`{\\small\\textbf{${entry.data}}}\\par`);
        lines.push(`{\\small\\textbf{Proc. n.º ${entry.processo}${entry.seccao ? ` - ${entry.seccao}` : ""}}}\\par`);
        lines.push(`{\\small ${entry.colectivo.relator}}\\par`);
        for (const adj of entry.colectivo.adjuntos) {
            lines.push(`{\\small ${adj}}\\par`);
        }
        lines.push(`\\vspace{2pt}{\\footnotesize\\url{${entry.permalink}}}`);
        lines.push("\\end{minipage}}");
        lines.push("");
        lines.push("\\vspace{8pt}");
        lines.push(cleanSummaryForMarkdown(entry.sumario));
        lines.push("");
        lines.push("\\vspace{20pt}");
    }

    if (indexPosition === "end") {
        appendIndexMarkdown();
    }

    return lines.join("\n");
}

function escapeHTML(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatSummaryHTML(sumario: string): string {
    if (!sumario) return "<p>Sumário não disponível.</p>";

    // If summary already has html tags
    if (/<p[\s>]|<br[\s>]/i.test(sumario)) {
        return sumario;
    }

    return sumario
        .split("\n\n")
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p>${escapeHTML(p).replace(/\n/g, "<br />")}</p>`)
        .join("");
}

function cleanSummaryForMarkdown(sumario: string): string {
    if (!sumario) return "Sumário não disponível.";
    return sumario
        .replace(/<br\s*[\/]?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/[ \t\u00A0]+/g, " ")
        .split("\n").map(l => l.trim()).join("\n")
        .trim();
}

/**
 * Generates clean, semantic HTML tailored specifically for Pandoc Word (.docx) export.
 * This ensures that:
 * 1. The decision metadata and descriptors are enclosed in an official solid rectangular table box (<table border="1">).
 * 2. Descriptors appear as an indented native bullet list (<ul><li>).
 * 3. Metadata fields (Data, Processo, Relator, Adjuntos, Hiperligação) are rendered line-by-line.
 * 4. Sumário paragraphs are cleanly formatted directly below the metadata box.
 * 5. An alphabetical descriptor index is included at the start or end with working internal anchors.
 */
export function generateBoletimDocxHTML(options: BoletimRenderOptions): string {
    const {
        title,
        subtitle,
        area,
        year,
        month,
        entries,
        descritorFilter,
        fontSize = "11pt",
        indexPosition = "end",
        periodStr: customPeriodStr,
        emissionDate,
        omitLogo,
        omitTitle,
        omitPeriod,
        omitFilters
    } = options;
    const periodStr = customPeriodStr || formatPeriodHeader(month, year);
    let formattedPeriod = periodStr;
    if (!formattedPeriod.toLowerCase().startsWith("período") && !formattedPeriod.toLowerCase().startsWith("decisões")) {
        formattedPeriod = `Período das Decisões: ${formattedPeriod}`;
    }

    const indexGroups = buildDescriptorIndex(entries);

    const logoFile = fs.existsSync(path.join(process.cwd(), "public", "stj-logo.png"))
        ? path.join(process.cwd(), "public", "stj-logo.png").replace(/\\/g, "/")
        : "public/stj-logo.png";

    const parts: string[] = [];

    parts.push('<!DOCTYPE html>');
    parts.push('<html lang="pt-PT">');
    parts.push('<head>');
    parts.push('<meta charset="utf-8" />');
    // Note: omit <title> so Pandoc standalone does not generate an unwanted oversized top banner
    parts.push('</head>');
    parts.push('<body style="font-family: \'Times New Roman\', Times, serif; color: #111827; line-height: 1.5;">');

    // Institutional Header with Logo (centered without table to avoid unwanted border box in Word)
    if (!omitTitle) {
        parts.push('<div style="text-align: center; margin-bottom: 14pt;">');
        if (!omitLogo) {
            parts.push(`<p style="text-align: center; margin: 0 0 8pt 0;"><img src="${logoFile}" width="140" height="70" alt="Supremo Tribunal de Justiça" /></p>`);
        }
        parts.push('<p style="font-size: 10pt; letter-spacing: 0.15em; color: #4b5563; text-transform: uppercase; font-weight: bold; margin: 0 0 3pt 0;">REPÚBLICA PORTUGUESA</p>');
        parts.push('<h1 style="font-size: 18pt; color: #800000; margin: 0 0 5pt 0; font-weight: bold;">Supremo Tribunal de Justiça</h1>');
        parts.push(`<h2 style="font-size: 13pt; color: #111827; margin: 0 0 5pt 0; font-weight: bold;">${escapeHTML(subtitle || title)}</h2>`);
        if (!omitPeriod) {
            parts.push(`<p style="font-size: 9.5pt; color: #374151; margin: 0 0 6pt 0;"><em>${escapeHTML(formattedPeriod)}${emissionDate ? ` &bull; Compilado em ${escapeHTML(emissionDate)}` : ""}</em></p>`);
        }
        parts.push('</div>');
    } else if (!omitPeriod) {
        parts.push(`<p style="text-align: center; font-size: 10pt; color: #374151; margin: 0 0 10pt 0;"><em>${escapeHTML(formattedPeriod)}${emissionDate ? ` &bull; Compilado em ${escapeHTML(emissionDate)}` : ""}</em></p>`);
    }

    if (!omitFilters && descritorFilter) {
        parts.push('<div style="background-color: #fef3c7; border: 1px solid #fde68a; padding: 8pt 12pt; margin-bottom: 14pt;">');
        parts.push(`<p style="margin: 0; font-size: 10pt; color: #92400e;"><strong>Caderno Temático:</strong> Filtrado pelo descritor "<em>${escapeHTML(descritorFilter)}</em>"</p>`);
        parts.push('</div>');
    }

    parts.push('<hr style="border: none; border-top: 1.5pt solid #800000; margin: 10pt 0 18pt 0;" />');

    const renderIndexHTML = () => {
        const indexParts: string[] = [];
        indexParts.push('<div style="margin-top: 28pt; margin-bottom: 28pt;">');
        indexParts.push('<h2 style="font-size: 15pt; color: #800000; text-align: center; text-transform: uppercase; margin-bottom: 16pt; letter-spacing: 0.05em;">Índice Alfabético por Tema / Descritor</h2>');
        for (const group of indexGroups) {
            indexParts.push(`<h3 style="font-size: 13pt; color: #800000; border-bottom: 1.5pt solid #800000; margin-top: 16pt; margin-bottom: 8pt; padding-bottom: 2pt;">${escapeHTML(group.letter)}</h3>`);
            for (const item of group.items) {
                const badges = item.entries.map(e => `<a href="#entry-${e.index}" style="color: #1d4ed8; text-decoration: none; font-weight: bold;">[${e.index}]</a>`).join("&nbsp; ");
                indexParts.push(`<p style="margin: 3pt 0 3pt 10pt; font-size: 10pt; color: #111827; line-height: 1.45;"><strong>${escapeHTML(item.descriptor)}</strong> &nbsp;&nbsp;&bull;&bull;&bull;&nbsp;&nbsp; ${badges}</p>`);
            }
        }
        indexParts.push('</div>');
        return indexParts.join('\n');
    };

    if (indexPosition === "start") {
        parts.push(renderIndexHTML());
        parts.push('<hr style="border: none; border-top: 1.5pt solid #800000; margin: 18pt 0;" />');
    }

    for (const entry of entries) {
        // Collect cleaned unique descriptors in alphabetical order
        const cleanedList = (entry.descritores || [])
            .map(d => cleanDescriptorName(d))
            .filter(Boolean);
        const uniqueDesc = [...new Set(cleanedList)].sort((a, b) =>
            a.localeCompare(b, "pt-PT", { sensitivity: "base" })
        );

        // Bookmark anchor and Acórdão Title
        parts.push(`<h3 id="entry-${entry.index}" style="color: #800000; font-size: 12pt; font-weight: bold; margin-top: 18pt; margin-bottom: 6pt;">Acórdão n.º ${entry.index}</h3>`);

        // Bordered Metadata Box (Single solid frame matching the official PDF box)
        parts.push('<table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border: 1.5pt solid #000000; border-collapse: collapse; margin-bottom: 12pt;">');
        parts.push('<colgroup><col style="width: 100%;" /></colgroup>');
        parts.push('<tbody>');
        parts.push('<tr>');
        parts.push('<td style="border: 1.5pt solid #000000; padding: 10pt 12pt; background-color: #ffffff;">');
        parts.push('<p style="font-weight: bold; font-size: 11pt; margin: 0 0 6pt 0; color: #000000;">Descritores</p>');
        if (uniqueDesc.length > 0) {
            for (const desc of uniqueDesc) {
                parts.push(`<p style="margin: 1pt 0 1pt 12pt; font-size: 10pt; color: #111827;">&bull; &nbsp;${escapeHTML(desc)}</p>`);
            }
        } else {
            parts.push('<p style="margin: 2pt 0; font-size: 10pt; font-style: italic; color: #4b5563;">Sem descritores registados.</p>');
        }
        parts.push('<hr style="border: none; border-top: 1pt solid #9ca3af; margin: 8pt 0;" />');
        parts.push(`<p style="margin: 2pt 0; font-size: 10pt; color: #111827;"><strong>${escapeHTML(entry.data)}</strong></p>`);
        parts.push(`<p style="margin: 2pt 0; font-size: 10pt; color: #111827;"><strong>Proc. n.º ${escapeHTML(entry.processo)}${entry.seccao ? ` - ${escapeHTML(entry.seccao)}` : ""}</strong></p>`);
        parts.push(`<p style="margin: 2pt 0; font-size: 10pt; color: #111827;">${escapeHTML(entry.colectivo.relator)}</p>`);
        for (const adj of entry.colectivo.adjuntos) {
            parts.push(`<p style="margin: 2pt 0; font-size: 10pt; color: #111827;">${escapeHTML(adj)}</p>`);
        }
        parts.push(`<p style="margin: 4pt 0 2pt 0; font-size: 9.5pt;"><a href="${escapeHTML(entry.permalink)}" style="color: #1e40af; text-decoration: underline;">${escapeHTML(entry.permalink)}</a></p>`);
        parts.push('</td>');
        parts.push('</tr>');
        parts.push('</tbody>');
        parts.push('</table>');

        // Sumário directly below the box
        parts.push('<div style="font-size: 10.5pt; line-height: 1.55; text-align: justify; color: #111827; margin-top: 8pt; margin-bottom: 20pt;">');
        parts.push(formatSummaryHTML(entry.sumario));
        parts.push('</div>');

        parts.push('<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20pt 0;" />');
    }

    if (indexPosition === "end") {
        parts.push(renderIndexHTML());
    }

    parts.push('</body>');
    parts.push('</html>');

    return parts.join('\n');
}

/**
 * Generates structured Markdown optimized specifically for Pandoc Word (.docx) export.
 */
export function generateBoletimDocxMarkdown(options: BoletimRenderOptions): string {
    return generateBoletimDocxHTML(options);
}

/**
 * Compiles renderOptions directly into a downloadable Word .docx file using Pandoc.
 */
export async function renderDocx(
    renderOptions: BoletimRenderOptions,
    filename: string,
    res: NextApiResponse
): Promise<void> {
    const htmlContent = generateBoletimDocxHTML(renderOptions);

    return await new Promise<void>((resolve) => {
        let pandocProc: any;
        try {
            pandocProc = spawn("pandoc", [
                "-f", "html",
                "-t", "docx",
                "-o", "-",
                "--standalone"
            ]);
        } catch (e: any) {
            console.warn("[Boletim DOCX] Não foi possível iniciar o Pandoc:", e?.message);
            res.status(500).json({ error: "Erro ao gerar DOCX: Pandoc indisponível no ambiente" });
            resolve();
            return;
        }

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let hasError = false;

        pandocProc.stdout.on("data", (chunk: Buffer) => {
            stdoutChunks.push(chunk);
        });

        pandocProc.stderr.on("data", (chunk: Buffer) => {
            stderrChunks.push(chunk);
        });

        pandocProc.on("error", (err: any) => {
            hasError = true;
            console.warn("[Boletim DOCX] Erro no processo Pandoc:", err.message);
            if (!res.headersSent && !res.writableEnded) {
                res.status(500).json({ error: `Erro ao compilar documento Word: ${err.message}` });
            }
            resolve();
        });

        pandocProc.on("close", (code: number) => {
            if (code === 0 && stdoutChunks.length > 0 && !hasError) {
                const docxBuffer = Buffer.concat(stdoutChunks);
                res.writeHead(200, {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "Content-Disposition": `attachment; filename="${filename.replace(/[/\\?%*:|"<>]/g, "_")}.docx"`,
                    "Content-Length": docxBuffer.length
                });
                res.end(docxBuffer);
            } else {
                const errMsg = Buffer.concat(stderrChunks).toString("utf-8");
                console.error("[Boletim DOCX] Pandoc falhou com código", code, ":", errMsg);
                if (!res.headersSent && !res.writableEnded) {
                    res.status(500).json({ error: `Erro ao gerar documento Word (Pandoc exit ${code})` });
                }
            }
            resolve();
        });

        pandocProc.stdin.write(htmlContent);
        pandocProc.stdin.end();
    });
}
