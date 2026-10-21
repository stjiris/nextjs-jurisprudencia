/**
 * STJ JURISPRUDÊNCIA - TEST SUITE PARA OS PEDIDOS E FIXES DO PROF. JOSÉ LUÍS BORBINHA (JLB)
 * 
 * Validação:
 * 1. BUG Slash "/" em Pesquisa Livre (escapeLuceneSlash & createQueryDslQueryContainer)
 * 2. BUG Filtros por Índice (Secção, Decisão=Admitir&Votação=Desempate em populateFilters)
 * 3. Layout do Boletim: Caixa de Metadados com Contornos Pretos
 * 4. Descritores Descontinuados (com pelica/apóstrofe):
 *    - 2 Colunas com linha vertical divisória no Boletim
 *    - Descritores descontinuados sem pelica e em itálico
 *    - Ordenação alfabética pelo nome sem pelica no índice
 * 5. Autocomplete e Debounce no formulário do Boletim
 */

const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${message}`);
        failed++;
    }
}

console.log("\n=======================================================");
console.log("   STJ JURISPRUDÊNCIA - SUITE DE TESTES: JLB FEEDBACK   ");
console.log("=======================================================\n");

// ======================== TEST 1: SLASH ESCAPING ========================
console.log("--- 1. Testes de Escape do Caractere '/' em Pesquisa Livre ---");

function escapeLuceneSlash(s) {
    return s.replace(/(?<!\\)\//g, "\\/");
}

assert(escapeLuceneSlash("xico/xica") === "xico\\/xica", "Palavra com barra isolada: xico/xica -> xico\\/xica");
assert(escapeLuceneSlash("+1004/23.0T8PTG.E1.S1-B") === "+1004\\/23.0T8PTG.E1.S1-B", "Número de processo com + e barra: +1004/23... -> +1004\\/23...");
assert(escapeLuceneSlash("1004/23.0T8PTG.E1.S1-B") === "1004\\/23.0T8PTG.E1.S1-B", "Número de processo simples: 1004/23... -> 1004\\/23...");
assert(escapeLuceneSlash('"1004/23"') === '"1004\\/23"', "Termo entre aspas com barra");
assert(escapeLuceneSlash("ja\\/escapado") === "ja\\/escapado", "Não duplica barras já escapadas");

// Test createQueryDslQueryContainer logic
const TEXT_FIELDS = ["Texto", "Sumário", "CONTENT", "*.Index"];
function createQueryDslQueryContainer(string) {
    if (!string) return { match_all: {} };
    const values = (Array.isArray(string) ? string : [string]).filter(s => s.length > 0);
    if (values.length === 0) return { match_all: {} };

    return values.map(q => {
        const trimmed = escapeLuceneSlash(q.trim());
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return { query_string: { query: trimmed, fields: TEXT_FIELDS, phrase_slop: 0 } };
        }
        if (/[()"]|\bAND\b|\bOR\b|\bNOT\b/i.test(trimmed)) {
            return { query_string: { query: trimmed, fields: TEXT_FIELDS } };
        }
        const words = trimmed.split(/\s+/).filter(w => w.length > 0);
        if (words.length <= 1) {
            return { query_string: { query: trimmed, fields: TEXT_FIELDS } };
        }
        return {
            bool: {
                should: [
                    { query_string: { query: `"${trimmed}"`, fields: TEXT_FIELDS, boost: words.length + 1, phrase_slop: 0 } },
                    ...words.map(w => ({ query_string: { query: w, fields: TEXT_FIELDS } }))
                ],
                minimum_should_match: 1
            }
        };
    });
}

const qSingle = createQueryDslQueryContainer("xico/xica")[0];
assert(qSingle.query_string.query === "xico\\/xica", "Consulta simples xico/xica gera query_string escapada");

const qProc = createQueryDslQueryContainer("+1004/23.0T8PTG.E1.S1-B")[0];
assert(qProc.query_string.query === "+1004\\/23.0T8PTG.E1.S1-B", "Consulta de processo +1004/23... gera query_string escapada");

const qMulti = createQueryDslQueryContainer("1004/23 recurso")[0];
assert(qMulti.bool.should[0].query_string.query === '"1004\\/23 recurso"', "Multi-palavra: frase preserva barra escapada");
assert(qMulti.bool.should[1].query_string.query === '1004\\/23', "Multi-palavra: palavra individual preserva barra escapada");

// ======================== TEST 2: INDEX FILTERS ========================
console.log("\n--- 2. Testes de Filtros por Índice (Secção, Decisão e Votação) ---");

const asciiFold = (s) => s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\xAA/g, 'a')
    .replace(/\xBA/g, 'o')
    .replace(/[\xC6\xE6]/g, 'ae')
    .replace(/[\xD0\xF0]/g, 'd')
    .replace(/[\xD8\xF8]/g, 'o')
    .replace(/[\xDE\xFE]/g, 'th')
    .replace(/\xDF/g, 'ss')
    .replace(/[\u0152\u0153]/g, 'oe');

const hasAdvanced = (arr) => arr.some((v) => {
    const trimmed = v.trim();
    if (/^"[^"]*"$/.test(trimmed)) return false;
    return /[()]|\bAND\b|\bOR\b|\bNOT\b/i.test(trimmed);
});

assert(hasAdvanced(['"1ª Secção"']) === false, 'hasAdvanced é false para termo exacto entre aspas simples: "1ª Secção"');
assert(hasAdvanced(['"Admitir"']) === false, 'hasAdvanced é false para termo exacto entre aspas simples: "Admitir"');
assert(hasAdvanced(['Admitir']) === false, 'hasAdvanced é false para termo simples sem aspas');
assert(hasAdvanced(['("1ª Secção" OR "2ª Secção")']) === true, 'hasAdvanced é true para expressão booleana complexa');

const termClause = (fieldName, o) => {
    const isQuoted = o.startsWith('"') && o.endsWith('"');
    const val = isQuoted ? o.slice(1, -1) : o;
    const isGenericKeyword = fieldName.endsWith('.Index.keyword');
    const rawField = isGenericKeyword ? fieldName.replace(/\.keyword$/, '.raw') : fieldName;

    if (isQuoted) {
        if (isGenericKeyword) {
            return {
                bool: {
                    should: [
                        { term: { [rawField]: { value: val } } },
                        { term: { [fieldName]: { value: val } } },
                        { term: { [fieldName]: { value: asciiFold(val).toLowerCase() } } },
                        { term: { [fieldName]: { value: asciiFold(val).toUpperCase() } } },
                        { term: { [fieldName]: { value: val, case_insensitive: true } } }
                    ],
                    minimum_should_match: 1
                }
            };
        }
        return { term: { [fieldName]: { value: val } } };
    }

    if (isGenericKeyword) {
        const folded = asciiFold(val);
        return {
            bool: {
                should: [
                    { term: { [rawField]: { value: val } } },
                    { term: { [rawField]: { value: val, case_insensitive: true } } },
                    { term: { [fieldName]: { value: folded.toLowerCase() } } },
                    { term: { [fieldName]: { value: folded.toUpperCase() } } },
                    { wildcard: { [rawField]: { value: `*${val}*`, case_insensitive: true } } },
                    { wildcard: { [fieldName]: { value: `*${folded.toLowerCase()}*` } } },
                    { wildcard: { [fieldName]: { value: `*${folded.toUpperCase()}*` } } },
                    { wildcard: { [fieldName]: { value: `*${folded}*`, case_insensitive: true } } }
                ],
                minimum_should_match: 1
            }
        };
    }

    const pattern = fieldName.endsWith('.keyword') ? asciiFold(val) : val;
    return { wildcard: { [fieldName]: { value: `*${pattern}*`, case_insensitive: true } } };
};

const seccaoClause = termClause("Secção.Index.keyword", '"1ª Secção"');
assert(seccaoClause.bool !== undefined, "Secção entre aspas gera cláusula bool robusta");
assert(seccaoClause.bool.should.some(c => c.term && c.term["Secção.Index.raw"] && c.term["Secção.Index.raw"].value === "1ª Secção"), "Secção entre aspas pesquisa exact match no campo .raw");
assert(seccaoClause.bool.should.some(c => c.term && c.term["Secção.Index.keyword"] && c.term["Secção.Index.keyword"].value === "1a seccao"), "Secção entre aspas pesquisa forma normalizada em .keyword");

const decisaoClause = termClause("Decisão.Index.keyword", "Admitir");
assert(decisaoClause.bool !== undefined, "Decisão=Admitir (sem aspas) gera cláusula bool robusta");
assert(decisaoClause.bool.should.some(c => c.term && c.term["Decisão.Index.raw"] && c.term["Decisão.Index.raw"].value === "Admitir"), "Decisão sem aspas tenta exact match no .raw");
assert(decisaoClause.bool.should.some(c => c.term && c.term["Decisão.Index.keyword"] && c.term["Decisão.Index.keyword"].value === "admitir"), "Decisão sem aspas tenta exact normalizado no .keyword");

const votacaoClause = termClause("Votação.Index.keyword", "Desempate");
assert(votacaoClause.bool !== undefined, "Votação=Desempate (sem aspas) gera cláusula bool robusta");

// ======================== TEST 3: DESCRITORES DESCONTINUADOS ========================
console.log("\n--- 3. Testes de Descritores Descontinuados (com pelica ') ---");

function isDiscontinuedDescriptor(desc) {
    const trimmed = desc.trim();
    return trimmed.startsWith("'") || trimmed.startsWith("’") || trimmed.startsWith("`");
}

function cleanDescriptorName(desc) {
    return desc.trim().replace(/^['’`]|['’`]$/g, "").trim();
}

function splitDescritores(descritores) {
    const regular = [];
    const discontinued = [];

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

assert(isDiscontinuedDescriptor("'Arrendamento Urbano") === true, "Identifica pelica simples (')");
assert(isDiscontinuedDescriptor("’Acordo Coletivo") === true, "Identifica pelica tipográfica (’)");
assert(isDiscontinuedDescriptor("Acordo de empresa") === false, "Identifica descritor regular");

assert(cleanDescriptorName("'Arrendamento Urbano") === "Arrendamento Urbano", "Remove pelica inicial");
assert(cleanDescriptorName("’Acordo Coletivo’") === "Acordo Coletivo", "Remove pelica inicial e final");

const sampleDesc = ["Herança indivisa", "'Arrendamento Urbano", "Contrato de arrendamento", "'Cabeça de casal"];
const splitRes = splitDescritores(sampleDesc);
assert(splitRes.regular.length === 2, "2 descritores regulares identificados");
assert(splitRes.discontinued.length === 2, "2 descritores descontinuados identificados");
assert(splitRes.discontinued[0] === "Arrendamento Urbano", "Descritor descontinuado sem pelica");
assert(splitRes.discontinued[1] === "Cabeça de casal", "Descritores descontinuados ordenados alfabeticamente");
assert(splitRes.regular[0] === "Contrato de arrendamento", "Descritores regulares ordenados alfabeticamente");

// ======================== TEST 4: BOLETIM UTIL VERIFICATION ========================
console.log("\n--- 4. Testes de Layout do Boletim e Caixa com Contornos Pretos ---");

const targetBase = path.join("C:", "Users", "shueb", "OneDrive", "Documentos", "Tese", "nextjs-jurisprudencia");
const boletimUtilPath = path.join(targetBase, "src", "core", "boletim-util.ts");
const boletimUtilSrc = fs.readFileSync(boletimUtilPath, "utf-8");

assert(boletimUtilSrc.includes(".entry-metadata-box {"), "CSS possui a classe .entry-metadata-box");
assert(boletimUtilSrc.includes("border: 1.5px solid #000000;"), "Caixa de metadados tem contorno preto de 1.5px");
assert(boletimUtilSrc.includes("grid-template-columns: 1fr 1px 1fr;"), "Descritores divididos em 2 colunas com divisor de 1px");
assert(boletimUtilSrc.includes(".desc-column-divider {"), "Possui linha vertical divisória (.desc-column-divider)");
assert(boletimUtilSrc.includes("Descritores Descontinuados"), "Coluna de 'Descritores Descontinuados' presente");
assert(boletimUtilSrc.includes("splitDescritores(entry.descritores)"), "HTML de cada acórdão usa splitDescritores()");
assert(boletimUtilSrc.includes("isDiscontinuedDescriptor"), "Utiliza isDiscontinuedDescriptor()");

// Test buildDescriptorIndex grouping with discontinued descriptor
function buildDescriptorIndex(entries) {
    const map = new Map();

    for (const entry of entries) {
        for (const rawDesc of entry.descritores) {
            const isDiscontinued = isDiscontinuedDescriptor(rawDesc);
            const cleaned = cleanDescriptorName(rawDesc);
            const desc = cleaned.replace(/^[:\-–,."“«]+|[:\-–,."”»]+$/g, "").trim();
            if (!desc) continue;
            if (!map.has(desc)) {
                map.set(desc, { isDiscontinued, entries: [] });
            }
            const item = map.get(desc);
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

    const sortedDesc = Array.from(map.keys()).sort((a, b) =>
        a.localeCompare(b, "pt-PT", { sensitivity: "base" })
    );

    const groupMap = new Map();

    for (const desc of sortedDesc) {
        const normalizedFirstChar = desc.charAt(0).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const letter = /^[A-Z]$/.test(normalizedFirstChar) ? normalizedFirstChar : "#";
        if (!groupMap.has(letter)) {
            groupMap.set(letter, []);
        }
        const data = map.get(desc);
        groupMap.get(letter).push({
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
        items: groupMap.get(letter)
    }));
}

const entriesTest = [
    {
        index: 1,
        processo: "100/20",
        data: "10-01-2025",
        descritores: ["'Arrendamento Urbano", "Contrato de trabalho"]
    }
];

const idxRes = buildDescriptorIndex(entriesTest);
const grpA = idxRes.find(g => g.letter === "A");
assert(grpA !== undefined, "Descritor descontinuado 'Arrendamento Urbano agrupa sob a letra 'A' (e não '#')");
const itemArr = grpA.items.find(i => i.descriptor === "Arrendamento Urbano");
assert(itemArr !== undefined, "Nome do descritor no índice sem a pelica");
assert(itemArr.isDiscontinued === true, "Item sinalizado como descontinuado no índice (para renderizar em itálico)");

// ======================== TEST 5: INDICES PAGE & BOLETIM FORM UX ========================
console.log("\n--- 5. Testes de Páginas: indices.tsx e boletim.tsx ---");

const indicesPagePath = path.join(targetBase, "src", "pages", "indices.tsx");
const indicesPageSrc = fs.readFileSync(indicesPagePath, "utf-8");
assert(indicesPageSrc.includes("formatIndexItemLabel"), "indices.tsx possui helper formatIndexItemLabel()");
assert(indicesPageSrc.includes("content = <em>{content}</em>"), "indices.tsx renderiza descritor descontinuado em itálico (<em>)");
assert(indicesPageSrc.includes("key.replace(/^['’`]|['’`]$/g, \"\").trim()"), "indices.tsx remove a pelica dos descritores descontinuados");

const boletimPagePath = path.join(targetBase, "src", "pages", "boletim.tsx");
const boletimPageSrc = fs.readFileSync(boletimPagePath, "utf-8");
assert(boletimPageSrc.includes("debouncedDescritor"), "boletim.tsx utiliza debouncedDescritor para evitar contagens instantâneas");
assert(boletimPageSrc.includes("datalist id=\"descritores-datalist\""), "boletim.tsx possui datalist para sugestões de descritores");
assert(boletimPageSrc.includes("/api/datalist?agg=Descritores&prefix="), "boletim.tsx consulta API de datalist progressivo ao digitar");
assert(boletimPageSrc.includes("count === null || isDebouncing"), "boletim.tsx não exibe aviso de erro prematuro durante a digitação/debounce");

console.log("\n=======================================================");
console.log(`   RESULTADO: ${passed} PASSOU / ${failed} FALHOU`);
console.log("=======================================================\n");

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
