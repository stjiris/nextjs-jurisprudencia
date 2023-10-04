//@ts-nocheck
import { JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaVersion, PartialJurisprudenciaDocument, isJurisprudenciaDocumentDateKeys, isJurisprudenciaDocumentExactKeys, isJurisprudenciaDocumentGenericKeys, isJurisprudenciaDocumentTextKeys } from "@stjiris/jurisprudencia-document";
import { getElasticSearchClient } from "./elasticsearch";
import crypto from "node:crypto"

export const existsDoc = (docId: string) => getElasticSearchClient().then(c => c.exists({index: JurisprudenciaVersion, id: docId}))

export const getDoc = (docId: string) => getElasticSearchClient().then( c => c.get<JurisprudenciaDocument>({index: JurisprudenciaVersion, id: docId}))

export const updateDoc = (docId: string, previewDoc: PartialJurisprudenciaDocument) =>  getElasticSearchClient().then(c => {

    let doc: PartialJurisprudenciaDocument = {};
    for( let key in previewDoc ){
        if( !previewDoc[key] ) continue;
        if( isJurisprudenciaDocumentExactKeys(key) && typeof previewDoc[key] === "string" ){
            doc[key] = previewDoc[key];
            continue;
        }
        if( isJurisprudenciaDocumentGenericKeys(key) && typeof previewDoc[key] === "object" && previewDoc[key]?.Index.every(v => typeof v === "string") && previewDoc[key]?.Original.every(v => typeof v === "string") && previewDoc[key]?.Show.every(v => typeof v === "string") ){
            doc[key] = previewDoc[key];
            continue;
        }
        if( isJurisprudenciaDocumentDateKeys(key) && typeof previewDoc[key] === "string" && previewDoc[key].match(/^\d{2}\/\d{2}\/\d{4}$/) ){
            doc[key] = previewDoc[key];
            continue;
        }
        if( isJurisprudenciaDocumentTextKeys(key) && typeof previewDoc[key] === "string" ){
            doc[key] = previewDoc[key];
            continue;
        }
    }
    return c.update<JurisprudenciaDocument,PartialJurisprudenciaDocument>({index: JurisprudenciaVersion, id: docId, doc, refresh: "wait_for"})
})

export const createDoc = (newdoc: PartialJurisprudenciaDocument) => getElasticSearchClient().then(c => {
    throw new Error("TODO: Unimplemented");
    let createdDoc: PartialJurisprudenciaDocument = {};
    let CONTENT: string[] = [];
    let key: JurisprudenciaDocumentKey;
    for( key in defaultValues ){
        if( !newdoc[key] ) continue;
        if( typeof newdoc[key] === "string" ){
            let v = newdoc[key] as string;
            CONTENT.push(v);
            continue;
        }
        else if(typeof newdoc[key] === "string"){
            let maybeVal = newdoc[key].trim();
            if( maybeVal.length > 0 ){
                CONTENT.push(maybeVal);
                if( Array.isArray(defaultValues[key]) ){
                    createdDoc[key] = [maybeVal]
                }
                else{
                    createdDoc[key] = maybeVal
                }
            }
            else{
                createdDoc[key] = defaultValues[key]
            }
        }    
    }
    createdDoc["Original"] = {
        "Sem Original": "Documento criado nesta aplicação"
    }
    createdDoc["HASH"] = {
        "Original": calculateUUID(createDoc,["Original"]),
        "Sumário": calculateUUID(createdDoc,["Sumário"]),
        "Texto": calculateUUID(createdDoc,["Texto"]),
        "Processo": calculateUUID(createdDoc, ["Número de Processo"])
    },
    createdDoc["UUID"] = calculateUUID(createdDoc["HASH"],["Sumário","Texto","Processo"])
    createdDoc["CONTENT"] = CONTENT
    return c.index<JurisprudenciaDocument>({index: JurisprudenciaVersion, document: createdDoc as JurisprudenciaDocument, refresh: "wait_for"})
})

export const deleteDoc = (docId: string) => getElasticSearchClient().then(c => c.delete({index: JurisprudenciaVersion, id: docId, refresh: "wait_for"}))


function calculateUUID(table: Record<string, any>, keys: string[]=[]){
    let str = JSON.stringify(table, keys);
    let hash = crypto.createHash("sha1");
    hash.write(str);
    return hash.digest().toString("base64url");
}