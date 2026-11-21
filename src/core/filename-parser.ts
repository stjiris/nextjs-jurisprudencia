import path from "node:path";

export type ParsedFilename = {
    nrProcesso: string;
    tipoDocumento: "acordao" | "sumario" | "acordao_com_sumario" | "acordao_com_sumario_e_descritores";
    hasEmbeddedSumario: boolean;
    hasEmbeddedDescritores: boolean;
    relator?: string;
};

const KEYWORD_PATTERN = /^(ac[oó]rd[aã]o|sum[aá]rio|descritores)$/i;

function normalize(s: string): string {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isKeyword(segment: string): boolean {
    return KEYWORD_PATTERN.test(segment.trim());
}

function parsePatternB(basename: string): ParsedFilename | null {
    const parts = basename.split(" - ");
    if (parts.length < 2) return null;

    const nrProcesso = parts[0].trim();
    const tipo = normalize(parts[1].trim());
    const relator = parts.length >= 3 ? parts.slice(2).join(" - ").trim() : undefined;

    if (tipo === "sumario") {
        return { nrProcesso, tipoDocumento: "sumario", hasEmbeddedSumario: false, hasEmbeddedDescritores: false, relator };
    }
    if (tipo === "acordao") {
        return { nrProcesso, tipoDocumento: "acordao", hasEmbeddedSumario: false, hasEmbeddedDescritores: false, relator };
    }
    return null;
}

function parsePatternC(basename: string): ParsedFilename | null {
    const plusIdx = basename.indexOf("+");
    if (plusIdx === -1) return null;

    const nrProcesso = basename.slice(0, plusIdx);
    const rest = basename.slice(plusIdx + 1);

    const flags: string[] = [];
    let relator: string | undefined;

    const tokens = rest.split("+");
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const dashIdx = token.indexOf("-");
        if (dashIdx !== -1 && i === tokens.length - 1) {
            const flag = token.slice(0, dashIdx);
            relator = token.slice(dashIdx + 1);
            if (flag) flags.push(normalize(flag));
        } else {
            const dashIdx2 = token.indexOf("-");
            if (dashIdx2 !== -1) {
                const flag = token.slice(0, dashIdx2);
                relator = token.slice(dashIdx2 + 1);
                if (flag) flags.push(normalize(flag));
            } else {
                flags.push(normalize(token));
            }
        }
    }

    const hasSumario = flags.includes("sumario");
    const hasDescritores = flags.includes("descritores");

    let tipoDocumento: ParsedFilename["tipoDocumento"];
    if (hasSumario && hasDescritores) {
        tipoDocumento = "acordao_com_sumario_e_descritores";
    } else if (hasSumario) {
        tipoDocumento = "acordao_com_sumario";
    } else {
        tipoDocumento = "acordao";
    }

    return { nrProcesso, tipoDocumento, hasEmbeddedSumario: hasSumario, hasEmbeddedDescritores: hasDescritores, relator: relator || undefined };
}

function parsePatternA(basename: string): ParsedFilename | null {
    const segments = basename.split("_");
    if (segments.length < 2) return null;

    let splitAt = -1;
    for (let i = 1; i < segments.length; i++) {
        if (isKeyword(segments[i])) {
            splitAt = i;
            break;
        }
    }
    if (splitAt === -1) return null;

    const nrProcesso = segments.slice(0, splitAt).join("_");
    const typeSegments = segments.slice(splitAt).map(s => normalize(s.trim()));

    const hasAcordao = typeSegments.includes("acordao");
    const hasSumario = typeSegments.includes("sumario");

    let tipoDocumento: ParsedFilename["tipoDocumento"];
    if (hasAcordao && hasSumario) {
        tipoDocumento = "acordao_com_sumario";
    } else if (hasSumario) {
        tipoDocumento = "sumario";
    } else {
        tipoDocumento = "acordao";
    }

    return { nrProcesso, tipoDocumento, hasEmbeddedSumario: hasAcordao && hasSumario, hasEmbeddedDescritores: false };
}

export function normalizeProcessNumber(nr: string): string {
    const trimmed = (nr || "").trim();
    // Convert first hyphen/underscore between sequential number and 2-digit year (e.g. "1469-18.2..." or "1469_18.2...") to official slash "/"
    return trimmed.replace(/^(\d+)[\-_](\d{2}\.\d)/, "$1/$2");
}

export function parseFilename(filename: string): ParsedFilename {
    const basename = path.basename(filename, path.extname(filename));

    // Pattern B: " - " separator (check first — most specific delimiter)
    const resultB = parsePatternB(basename);
    if (resultB) {
        resultB.nrProcesso = normalizeProcessNumber(resultB.nrProcesso);
        return resultB;
    }

    // Pattern C: "+" separator
    const resultC = parsePatternC(basename);
    if (resultC) {
        resultC.nrProcesso = normalizeProcessNumber(resultC.nrProcesso);
        return resultC;
    }

    // Pattern A: "_" separator with keyword detection
    const resultA = parsePatternA(basename);
    if (resultA) {
        resultA.nrProcesso = normalizeProcessNumber(resultA.nrProcesso);
        return resultA;
    }

    // Fallback: entire basename is the process number
    return { nrProcesso: normalizeProcessNumber(basename), tipoDocumento: "acordao", hasEmbeddedSumario: false, hasEmbeddedDescritores: false };
}
