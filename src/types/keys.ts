import { MappingProperty } from "@elastic/elasticsearch/lib/api/types"
import { JurisprudenciaDocumentKey, isJurisprudenciaDocumentContentKey, isJurisprudenciaDocumentDateKey, isJurisprudenciaDocumentExactKey, isJurisprudenciaDocumentGenericKey, isJurisprudenciaDocumentHashKey, isJurisprudenciaDocumentObjectKey, isJurisprudenciaDocumentStateKey, isJurisprudenciaDocumentTextKey } from "@stjiris/jurisprudencia-document"


export type JurisprudenciaKey = {
    key: JurisprudenciaDocumentKey
    name: string
    description: string
    active: boolean
    filtersSuggest: boolean
    filtersShow: boolean
    filtersOrder: number
    indicesList: boolean
    indicesGroup: boolean
    documentShow: boolean
    authentication: boolean
    editorEnabled?: boolean
    editorSuggestions?: boolean
    editorRestricted?: boolean
    editorOriginalOnly?: boolean
}

export const KEYS_INFO_INDEX_VERSION = "keys-info.0.0"

export const KEYS_INFO_PROPERTIES: Record<keyof JurisprudenciaKey, MappingProperty> = {
    key: { type: "keyword" },
    name: { type: "keyword" },
    description: { type: "text" },
    active: { type: "boolean" },
    filtersSuggest: { type: "boolean" },
    filtersShow: { type: "boolean" },
    filtersOrder: { type: "float" },
    indicesList: { type: "boolean" },
    indicesGroup: { type: "boolean" },
    documentShow: { type: "boolean" },
    authentication: { type: "boolean" },
    editorEnabled: { type: "boolean" },
    editorSuggestions: { type: "boolean" },
    editorRestricted: { type: "boolean" },
    editorOriginalOnly: { type: "boolean" },
}

export function canBeActive(key: JurisprudenciaDocumentKey) {
    return !(isJurisprudenciaDocumentContentKey(key) || isJurisprudenciaDocumentDateKey(key) || isJurisprudenciaDocumentHashKey(key) || isJurisprudenciaDocumentTextKey(key) || isJurisprudenciaDocumentObjectKey(key));
}

export function canHaveSuggestions(key: JurisprudenciaDocumentKey) {
    return isJurisprudenciaDocumentGenericKey(key) || isJurisprudenciaDocumentExactKey(key);
}

export function makeValidValue(jurisprudenciaKey: JurisprudenciaKey): JurisprudenciaKey {
    let obj = { ...jurisprudenciaKey };
    let key = jurisprudenciaKey.key;

    if (!canBeActive(key)) {
        obj.active = false
    }
    if (!obj.active) {
        obj.filtersShow = false;
        obj.indicesList = false;
        obj.filtersSuggest = false;
    }
    if (!obj.indicesList) obj.indicesGroup = false;

    if (!canHaveSuggestions(key)) {
        obj.editorSuggestions = false;
    }
    if (!obj.editorSuggestions) obj.editorRestricted = false;
    if (!obj.editorEnabled) {
        obj.editorRestricted = false;
        obj.editorSuggestions = false;
        obj.editorOriginalOnly = false;
    }
    if( !isJurisprudenciaDocumentGenericKey(key) ){
        obj.editorOriginalOnly = false;
    }
    return obj;
}