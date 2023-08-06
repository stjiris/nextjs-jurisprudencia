import { JurisprudenciaDocumentKeys, JurisprudenciaDocumentProperties } from "@stjiris/jurisprudencia-document";

export function exportableKeys() {
    return JurisprudenciaDocumentKeys.filter(k => {
        let property = JurisprudenciaDocumentProperties[k]
        return (!("type" in property) || (property.type !== "object" && property.type !== "text" ));
    })
}
