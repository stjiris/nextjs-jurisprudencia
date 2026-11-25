export const CANONICAL_SECCAO_MAP: Record<string, { seccao: string; area: string; num: number }> = {
    "1": { seccao: "1.ª Secção (Cível)", area: "Área Cível", num: 1 },
    "2": { seccao: "2.ª Secção (Cível)", area: "Área Cível", num: 2 },
    "3": { seccao: "3.ª Secção (Criminal)", area: "Área Criminal", num: 3 },
    "4": { seccao: "4.ª Secção (Social)", area: "Área Social", num: 4 },
    "5": { seccao: "5.ª Secção (Criminal)", area: "Área Criminal", num: 5 },
    "6": { seccao: "6.ª Secção (Cível)", area: "Área Cível", num: 6 },
    "7": { seccao: "7.ª Secção (Cível)", area: "Área Cível", num: 7 },
};

export const CANONICAL_SECCAO_NAMES = [
    "1.ª Secção (Cível)",
    "2.ª Secção (Cível)",
    "3.ª Secção (Criminal)",
    "4.ª Secção (Social)",
    "5.ª Secção (Criminal)",
    "6.ª Secção (Cível)",
    "7.ª Secção (Cível)",
    "Contencioso",
    "Tribunal de Conflitos",
    "Formação",
] as const;

/**
 * Normalizes any section variation to the canonical STJ form.
 * E.g. "3ª Secção", "3.ª Secção", "3ª Secção (Criminal)", "3ª Secção Criminal" -> "3.ª Secção (Criminal)"
 * E.g. "Secção Social", "4ª Secção" -> "4.ª Secção (Social)"
 * E.g. "Secção do Contencioso" -> "Contencioso"
 */
export function canonicalizeSeccao(raw?: string | null): string {
    if (!raw) return "";
    const trimmed = raw.trim();
    if (!trimmed) return "";

    // Contencioso
    if (/contencioso/i.test(trimmed)) {
        return "Contencioso";
    }
    // Conflitos (including legacy typo "Cnflitos")
    if (/c[o]?nflitos/i.test(trimmed)) {
        return "Tribunal de Conflitos";
    }
    // Formação (Formação de Apreciação Preliminar / Secção de Formação)
    if (/forma[cç][aã]o/i.test(trimmed)) {
        return "Formação";
    }
    // Secção Social without number
    if (/social/i.test(trimmed)) {
        return "4.ª Secção (Social)";
    }
    // Ordinal numbers 1-7 (supports "1ª", "1.ª", "1a", "1 ª", "1ª Secção", etc.)
    const m = trimmed.match(/\b([1-7])\s*(?:\.?[ºªa]|ª)?/i);
    if (m && CANONICAL_SECCAO_MAP[m[1]]) {
        return CANONICAL_SECCAO_MAP[m[1]].seccao;
    }

    return trimmed;
}

/**
 * Returns all possible textual variations that may exist in Elasticsearch for a section.
 */
export function getSeccaoVariants(rawOrCanonical: string): string[] {
    const canonical = canonicalizeSeccao(rawOrCanonical);
    const m = canonical.match(/^([1-7])\.ª Secção/);
    if (m) {
        const num = m[1];
        const entry = CANONICAL_SECCAO_MAP[num];
        const areaSuffix = entry.area === "Área Cível" ? "Cível"
            : entry.area === "Área Criminal" ? "Criminal"
            : entry.area === "Área Social" ? "Social"
            : "";

        const variants = new Set<string>([
            canonical,
            `${num}ª Secção (${areaSuffix})`,
            `${num}.ª Secção (${areaSuffix})`,
            `${num}ª Secção`,
            `${num}.ª Secção`,
            `${num}ª Secção ${areaSuffix}`,
            `${num}.ª Secção ${areaSuffix}`,
            `${num}ª`,
            `${num}.ª`,
            `Secção ${num}`,
        ]);

        if (num === "4") {
            variants.add("Secção Social");
            variants.add("Área Social");
        }

        return Array.from(variants);
    }

    if (/contencioso/i.test(canonical)) {
        return [
            "Contencioso",
            "Secção de Contencioso",
            "Secção do Contencioso",
            "Secção Contencioso",
        ];
    }

    if (/c[o]?nflitos/i.test(canonical)) {
        return [
            "Tribunal de Conflitos",
            "Tribunal dos Conflitos",
            "Secção de Conflitos",
            "Conflitos",
            "Cnflitos",
        ];
    }

    if (/forma[cç][aã]o/i.test(canonical)) {
        return [
            "Formação",
            "Formacao",
            "Formação de Apreciação Preliminar",
            "Secção de Formação",
            "Secção da Formação",
        ];
    }

    return [canonical, rawOrCanonical].filter(Boolean);
}

/**
 * Merges raw aggregation buckets by canonical section and sums their doc_counts.
 */
export function mergeSeccaoBuckets<T extends { key: string | number; doc_count?: number }>(
    buckets: T[]
): { key: string; count: number }[] {
    const map = new Map<string, number>();

    for (const b of buckets) {
        const keyStr = String(b.key).trim();
        if (!keyStr) continue;
        const canonicalKey = canonicalizeSeccao(keyStr);
        map.set(canonicalKey, (map.get(canonicalKey) || 0) + (b.doc_count || 0));
    }

    const result: { key: string; count: number }[] = [];
    for (const [key, count] of map.entries()) {
        result.push({ key, count });
    }

    return result;
}
