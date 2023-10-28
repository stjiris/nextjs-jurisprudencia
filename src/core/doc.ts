//@ts-nocheck
import { JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaVersion, PartialJurisprudenciaDocument, isJurisprudenciaDocumentDateKey, isJurisprudenciaDocumentExactKey, isJurisprudenciaDocumentGenericKey, isJurisprudenciaDocumentTextKey } from "@stjiris/jurisprudencia-document";
import { getElasticSearchClient } from "./elasticsearch";
import crypto from "node:crypto"

export const existsDoc = (docId: string) => getElasticSearchClient().then(c => c.exists({index: JurisprudenciaVersion, id: docId}))

export const getDoc = (docId: string) => getElasticSearchClient().then( c => c.get<JurisprudenciaDocument>({index: JurisprudenciaVersion, id: docId}))

export const updateDoc = (docId: string, previewDoc: PartialJurisprudenciaDocument) =>  getElasticSearchClient().then(c => {

    let doc: PartialJurisprudenciaDocument = {};
    for( let key in previewDoc ){
        if( !previewDoc[key] ) continue;
        if( isJurisprudenciaDocumentExactKey(key) && typeof previewDoc[key] === "string" ){
            doc[key] = previewDoc[key];
            continue;
        }
        if( isJurisprudenciaDocumentGenericKey(key) && typeof previewDoc[key] === "object" && previewDoc[key]?.Index.every(v => typeof v === "string") && previewDoc[key]?.Original.every(v => typeof v === "string") && previewDoc[key]?.Show.every(v => typeof v === "string") ){
            doc[key] = previewDoc[key];
            continue;
        }
        if( isJurisprudenciaDocumentDateKey(key) && typeof previewDoc[key] === "string" && previewDoc[key].match(/^\d{2}\/\d{2}\/\d{4}$/) ){
            doc[key] = previewDoc[key];
            continue;
        }
        if( isJurisprudenciaDocumentTextKey(key) && typeof previewDoc[key] === "string" ){
            doc[key] = previewDoc[key];
            continue;
        }
    }
    return c.update<JurisprudenciaDocument,PartialJurisprudenciaDocument>({index: JurisprudenciaVersion, id: docId, doc, refresh: "wait_for"})
})

export const createDoc = (newdoc: PartialJurisprudenciaDocument) => getElasticSearchClient().then(c => {
    let doc: PartialJurisprudenciaDocument = {};
    let CONTENT = []
    for( let key in newdoc ){
        if( !newdoc[key] ) continue;
        if( isJurisprudenciaDocumentExactKey(key) && typeof newdoc[key] === "string" ){
            doc[key] = newdoc[key];
            CONTENT.push(newdoc[key])
            continue;
        }
        if( isJurisprudenciaDocumentGenericKey(key) && typeof newdoc[key] === "object" && newdoc[key]?.Index.every(v => typeof v === "string") && newdoc[key]?.Original.every(v => typeof v === "string") && newdoc[key]?.Show.every(v => typeof v === "string") ){
            doc[key] = newdoc[key];
            CONTENT.push(...newdoc[key].Show)
            CONTENT.push(...newdoc[key].Original)
            CONTENT.push(...newdoc[key].Index)
            continue;
        }
        if( isJurisprudenciaDocumentDateKey(key) && typeof newdoc[key] === "string" && newdoc[key].match(/^\d{2}\/\d{2}\/\d{4}$/) ){
            doc[key] = newdoc[key];
            CONTENT.push(newdoc[key])
            continue;
        }
        if( isJurisprudenciaDocumentTextKey(key) && typeof newdoc[key] === "string" ){
            doc[key] = newdoc[key];
            CONTENT.push(newdoc[key])
            continue;
        }
    }
    doc.Fonte = "STJ (Manual)"
    doc.CONTENT = CONTENT
    doc.Original = {
        "Sem Original": "Documento criado nesta aplicação"
    }
    doc.HASH = {
        "Original": calculateUUID(doc,["Original"]),
        "Sumário": calculateUUID(doc,["Sumário"]),
        "Texto": calculateUUID(doc,["Texto"]),
        "Processo": calculateUUID(doc, ["Número de Processo"])
    },
    doc.UUID = calculateUUID(doc.HASH,["Sumário","Texto","Processo"])
    doc.STATE = "preparação"
    
    return c.index<JurisprudenciaDocument>({index: JurisprudenciaVersion, document: doc as JurisprudenciaDocument, refresh: "wait_for"});
})

export const deleteDoc = (docId: string) => getElasticSearchClient().then(c => c.delete({index: JurisprudenciaVersion, id: docId, refresh: "wait_for"}))


function calculateUUID(table: Record<string, any>, keys: string[]=[]){
    let str = JSON.stringify(table, keys);
    let hash = crypto.createHash("sha1");
    hash.write(str);
    return hash.digest().toString("base64url");
}