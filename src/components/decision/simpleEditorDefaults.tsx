import { JurisprudenciaDocumentKey, PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";

export type SimpleJurisprudenciaDocument = Record<JurisprudenciaDocumentKey, string>;

function setPartialDocumentField(
    doc: PartialJurisprudenciaDocument, 
    key: string, 
    value: string
): void {
    (doc as Record<string, any>)[key] = value;
}

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

export function getSimpleEditorDefaults(ctx: PartialJurisprudenciaDocument = {}): PartialJurisprudenciaDocument {
    const result: PartialJurisprudenciaDocument = {};
    
    for (let key in SIMPLE_EDITOR_DEFAULTS) {
        const typedKey = key as keyof typeof SIMPLE_EDITOR_DEFAULTS;
        const defaultValue = SIMPLE_EDITOR_DEFAULTS[typedKey];
        
        if (typeof defaultValue === "function") {
            const value = (defaultValue as ((ctx: any) => string | undefined))(ctx);
            if (value) {
                setPartialDocumentField(result, key, value);
            }
        } else {
            setPartialDocumentField(result, key, defaultValue as string);
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
