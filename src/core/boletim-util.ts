import fs from "fs";
import path from "path";

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
    const trimmed = desc.trim();
    return trimmed.startsWith("'") || trimmed.startsWith("’") || trimmed.startsWith("`");
}

export function cleanDescriptorName(desc: string): string {
    return desc.trim().replace(/^['’`]|['’`]$/g, "").trim();
}

export function splitDescritores(descritores: string[]): {
    regular: string[];
    discontinued: string[];
} {
    const regular: string[] = [];
    const discontinued: string[] = [];

    for (const d of descritores) {
        const trimmed = d.trim();
        if (!trimmed) continue;
        if (isDiscontinuedDescriptor(trimmed)) {
            discontinued.push(cleanDescriptorName(trimmed));
        } else {
            regular.push(trimmed);
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
    fontSize?: string; // e.g. "10pt" | "11pt" | "12pt" | "13pt" (default: "11pt")
    indexPosition?: "start" | "end"; // default: "end"
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
    const { title, subtitle, area, year, month, entries, descritorFilter, searchQuery, fontSize = "11pt", indexPosition = "end" } = options;
    const logoBase64 = getStjLogoBase64();
    const logoSrc = logoBase64 ? `data:image/png;base64,${logoBase64}` : "/stj-logo.png";
    const periodStr = formatPeriodHeader(month, year);
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
        }
    </style>
</head>
<body>
    <div class="document-container">
        <!-- STJ Institutional Header -->
        <header class="boletim-header">
            <div class="header-logo-container">
                <img src="${logoSrc}" alt="Supremo Tribunal de Justiça" />
            </div>
            <div class="header-text">
                <div class="stj-republica">República Portuguesa</div>
                <div class="stj-org-title">Supremo Tribunal de Justiça</div>
                <div class="boletim-title">${escapeHTML(subtitle)}</div>
                <div class="boletim-period">${escapeHTML(periodStr)}</div>
            </div>
        </header>

        ${descritorFilter ? `
        <div class="filter-badge-box">
            <strong>Caderno Temático:</strong> Filtrado pelo descritor "<em>${escapeHTML(descritorFilter)}</em>"
        </div>` : ""}

        ${searchQuery ? `
        <div class="filter-badge-box">
            <strong>Pesquisa Textual:</strong> "<em>${escapeHTML(searchQuery)}</em>"
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
                        const { regular, discontinued } = splitDescritores(entry.descritores);
                        const hasDiscontinued = discontinued.length > 0;
                        if (hasDiscontinued) {
                            return `
                            <div class="descriptors-container">
                                <div class="desc-column">
                                    <div class="desc-column-title">Descritores</div>
                                    <ul class="desc-list">
                                        ${regular.map(d => `<li>${escapeHTML(d)}</li>`).join("")}
                                    </ul>
                                </div>
                                <div class="desc-column-divider"></div>
                                <div class="desc-column">
                                    <div class="desc-column-title">Descritores Descontinuados</div>
                                    <ul class="desc-list discontinued">
                                        ${discontinued.map(d => `<li><em>${escapeHTML(d)}</em></li>`).join("")}
                                    </ul>
                                </div>
                            </div>`;
                        } else {
                            return `
                            <div class="descriptors-container single-column">
                                <div class="desc-column">
                                    <div class="desc-column-title">Descritores</div>
                                    <ul class="desc-list">
                                        ${regular.map(d => `<li>${escapeHTML(d)}</li>`).join("")}
                                    </ul>
                                </div>
                            </div>`;
                        }
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
    lines.push(`fontsize: ${fontSize}`);
    lines.push("geometry:");
    lines.push("  - a4paper");
    lines.push("  - top=2.5cm");
    lines.push("  - bottom=2.5cm");
    lines.push("  - left=3.0cm");
    lines.push("  - right=2.5cm");
    lines.push("header-includes:");
    lines.push("  - \\usepackage{fancyhdr}");
    lines.push("  - \\usepackage{lastpage}");
    lines.push("  - \\usepackage{graphicx}");
    lines.push("  - \\usepackage{framed}");
    lines.push("  - \\setlength{\\fboxrule}{1.2pt}");
    lines.push("  - \\setlength{\\fboxsep}{8pt}");
    lines.push("  - \\pagestyle{fancy}");
    lines.push("  - \\fancyhead{}");
    lines.push(`  - \\fancyhead[L]{\\small\\textbf{${subtitle.replace(/[\\&%$#_{}~^]/g, "\\$&")}}}`);
    lines.push("  - \\fancyhead[R]{\\includegraphics[height=0.9cm]{stj-logo.png}}");
    lines.push("  - \\fancyfoot{}");
    lines.push(`  - \\fancyfoot[L]{\\small ${periodStr.replace(/[\\&%$#_{}~^]/g, "\\$&")}}`);
    lines.push("  - \\fancyfoot[R]{\\small Pág. \\thepage\\ de \\pageref{LastPage}}");
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
        const { regular, discontinued } = splitDescritores(entry.descritores);
        if (discontinued.length > 0) {
            lines.push("{\\small\\textbf{Descritores}}\\par\\vspace{1pt}");
            for (const desc of regular) {
                lines.push(`\\quad {\\small\\textbf{${desc.replace(/`/g, "")}}}\\par`);
            }
            lines.push("\\vspace{3pt}{\\small\\textbf{Descritores Descontinuados}}\\par\\vspace{1pt}");
            for (const desc of discontinued) {
                lines.push(`\\quad {\\small\\textit{${desc.replace(/`/g, "")}}}\\par`);
            }
        } else {
            lines.push("{\\small\\textbf{Descritores}}\\par\\vspace{1pt}");
            for (const desc of regular) {
                lines.push(`\\quad {\\small\\textbf{${desc.replace(/`/g, "")}}}\\par`);
            }
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
        // Collapse the spaces left by nested tags and trim each line: 4+ leading spaces would make pandoc render a code block.
        .replace(/[ \t ]+/g, " ")
        .split("\n").map(l => l.trim()).join("\n")
        .trim();
}
