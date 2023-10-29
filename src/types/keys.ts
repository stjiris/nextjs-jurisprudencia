import { MappingProperty } from "@elastic/elasticsearch/lib/api/types"
import { JurisprudenciaDocumentKey, isJurisprudenciaDocumentContentKey, isJurisprudenciaDocumentDateKey, isJurisprudenciaDocumentHashKey, isJurisprudenciaDocumentObjectKey, isJurisprudenciaDocumentTextKey } from "@stjiris/jurisprudencia-document"


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
}

export const KEYS_INFO_INDEX_VERSION = "keys-info.0.0"

export const KEYS_INFO_PROPERTIES: Record<keyof JurisprudenciaKey, MappingProperty> = {
    key: {type: "keyword"},
    name: {type: "keyword"},
    description: {type: "text"},
    active: {type: "boolean"},
    filtersSuggest: {type: "boolean"},
    filtersShow: {type: "boolean"},
    filtersOrder: {type: "float"},
    indicesList: {type: "boolean"},
    indicesGroup: {type: "boolean"},
    documentShow: {type: "boolean"},
    authentication: {type: "boolean"}
}

export function canBeActive(key: JurisprudenciaDocumentKey){
    return !(isJurisprudenciaDocumentContentKey(key) || isJurisprudenciaDocumentDateKey(key) || isJurisprudenciaDocumentHashKey(key) ||  isJurisprudenciaDocumentTextKey(key) || isJurisprudenciaDocumentObjectKey(key));
}

export function makeValidValue(jurisprudenciaKey: JurisprudenciaKey): JurisprudenciaKey{
    let obj = {...jurisprudenciaKey};
    let key = jurisprudenciaKey.key;

    if( !canBeActive(key) ){
        obj.active = false
    }
    if( !obj.active ) {
        obj.filtersShow = false;
        obj.indicesList = false;
        obj.filtersSuggest = false;
    }
    if( !obj.indicesList ) obj.indicesGroup = false;
    return obj;
}