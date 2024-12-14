import { JurisprudenciaDocumentKey } from "@stjiris/jurisprudencia-document";

export type SimpleJurisprudenciaDocument = Record<JurisprudenciaDocumentKey, string>;

export const SIMPLE_EDITOR_DEFAULTS = {
    STATE: "preparação",
    Data: () => new Date().toLocaleDateString("pt-PT"),
    Tipo: "Acórdão",
    Jurisprudência: "Simples",
    Fonte: "STJ (Manual)",
    Votação: "Decisão por unanimidade\nDecisão sem declarações de voto\nDecisão sem voto de vencido",
    Decisão: "Negar provimento",
    Área: (ctx: SimpleJurisprudenciaDocument) => "Secção" in ctx ? areaFromSeccao(ctx.Secção) : undefined,
} as Partial<Record<JurisprudenciaDocumentKey, string | ((ctx: SimpleJurisprudenciaDocument) => string | undefined)>>;

export function getSimpleEditorDefaults(ctx: Partial<SimpleJurisprudenciaDocument> = {}): Partial<SimpleJurisprudenciaDocument> {
    let result: Partial<SimpleJurisprudenciaDocument> = {};
    for (let key in SIMPLE_EDITOR_DEFAULTS) {
        if (typeof SIMPLE_EDITOR_DEFAULTS[key as keyof typeof SIMPLE_EDITOR_DEFAULTS] === "function") {
            let value = (SIMPLE_EDITOR_DEFAULTS[key as keyof typeof SIMPLE_EDITOR_DEFAULTS] as ((ctx: any) => string | undefined))(ctx);
            if (value) result[key as JurisprudenciaDocumentKey] = value;
        } else {
            result[key as JurisprudenciaDocumentKey] = SIMPLE_EDITOR_DEFAULTS[key as keyof typeof SIMPLE_EDITOR_DEFAULTS] as string;
        }
    }
    return result;
}

function areaFromSeccao(seccao: string) {
    const ÁreasFromSecções = {
        "1.ª Secção (Cível)": "Área Cível",
        "2.ª Secção (Cível)": "Área Cível",
        "3.ª Secção (Criminal)": "Área Criminal",
        "4.ª Secção (Social)": "Área Social",
        "5.ª Secção (Criminal)": "Área Criminal",
        "6.ª Secção (Cível)": "Área Cível",
        "7.ª Secção (Cível)": "Área Cível",
        "Contencioso": "Contencioso",
    }
    return seccao in ÁreasFromSecções ? ÁreasFromSecções[seccao as keyof typeof ÁreasFromSecções] : "{sem Área}"
}
