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
    entries: {
        index: number;
        processo: string;
        data: string;
    }[];
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
export function generatePermalink(proc?: string | null, uuid?: string | null): string {
    if (proc && uuid) {
        return `https://juris.stj.pt/${encodeURIComponent(proc)}/${uuid}`;
    }
    if (proc) {
        return `https://juris.stj.pt/pesquisa?N%C3%BAmero+de+Processo=${encodeURIComponent(proc)}`;
    }
    return "https://juris.stj.pt";
}

/**
 * Normalizes descriptors and builds an Alphabetical Descriptor Index.
 */
export function buildDescriptorIndex(entries: BoletimEntry[]): DescriptorIndexGroup[] {
    const map = new Map<string, DescriptorIndexItem["entries"]>();

    for (const entry of entries) {
        for (const rawDesc of entry.descritores) {
            const desc = rawDesc.trim().replace(/^[:\-–,."“«]+|[:\-–,."”»]+$/g, "").trim();
            if (!desc) continue;
            if (!map.has(desc)) {
                map.set(desc, []);
            }
            const list = map.get(desc)!;
            if (!list.some(e => e.index === entry.index)) {
                list.push({
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
        groupMap.get(letter)!.push({
            descriptor: desc,
            entries: map.get(desc)!
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
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .boletim-entry:last-of-type {
            border-bottom: none;
        }

        .entry-descriptors {
            margin-bottom: 1rem;
        }

        .descriptor-item {
            font-weight: bold;
            font-size: var(--desc-font-size, 1.05rem);
            color: #000000;
            line-height: 1.35;
            margin-bottom: 0.15rem;
        }

        .entry-summary {
            font-size: var(--summary-font-size, 1rem);
            text-align: justify;
            text-justify: inter-word;
            line-height: var(--summary-line-height, 1.6);
            margin-bottom: 1.25rem;
            color: #111827;
        }

        .entry-summary p {
            margin-bottom: 0.75rem;
        }

        .entry-metadata {
            margin-top: 1rem;
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
            align-items: baseline;
            justify-content: space-between;
            font-size: 0.9rem;
            padding: 0.25rem 0;
            gap: 1rem;
        }

        .index-descriptor-name {
            font-weight: 500;
            color: #111827;
        }

        .index-entry-links {
            text-align: right;
            white-space: nowrap;
            font-family: var(--font-sans);
            font-size: 0.8rem;
        }

        .index-entry-links a {
            color: var(--stj-link);
            text-decoration: none;
            padding: 0.15rem 0.35rem;
            background-color: #eff6ff;
            border-radius: 3px;
            margin-left: 0.35rem;
            border: 1px solid #bfdbfe;
        }

        .index-entry-links a:hover {
            background-color: #dbeafe;
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
                page-break-inside: avoid;
                break-inside: avoid;
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
                        <span class="index-descriptor-name">${escapeHTML(item.descriptor)}</span>
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
                <div class="entry-descriptors">
                    ${entry.descritores.map(d => `<div class="descriptor-item">${escapeHTML(d)}</div>`).join("")}
                </div>

                <div class="entry-summary">
                    ${formatSummaryHTML(entry.sumario)}
                </div>

                <div class="entry-metadata">
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
                        <span class="index-descriptor-name">${escapeHTML(item.descriptor)}</span>
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
                lines.push(`* **${item.descriptor}**: ${entryRefs}`);
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
        for (const desc of entry.descritores) {
            lines.push(`**${desc.replace(/`/g, "")}**\\`);
        }
        lines.push("");
        lines.push(cleanSummaryForMarkdown(entry.sumario));
        lines.push("");
        lines.push(`\\medskip`);
        lines.push(`\\noindent ${entry.data}\\`);
        lines.push(`Proc. n.º ${entry.processo}${entry.seccao ? ` - ${entry.seccao}` : ""}\\`);
        lines.push(`${entry.colectivo.relator}\\`);
        for (const adj of entry.colectivo.adjuntos) {
            lines.push(`${adj}\\`);
        }
        lines.push(`\\href{${entry.permalink}}{${entry.permalink}}`);
        lines.push("");
        lines.push("\\bigskip");
        lines.push("\\hrule");
        lines.push("\\bigskip");
        lines.push("");
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
        .trim();
}
