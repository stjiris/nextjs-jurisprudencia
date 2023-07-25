import { ExactTypedJurisprudenciaDocument, isValidJurisprudenciaDocumentArrayKey, isValidJurisprudenciaDocumentKey, isValidJurisprudenciaDocumentRecordKey, isValidJurisprudenciaDocumentStringKey, JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaVersion, PartialJurisprudenciaDocument, PartialTypedJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { getElasticSearchClient } from "./elasticsearch";
import crypto from "node:crypto"

export const existsDoc = (docId: string) => getElasticSearchClient().then(c => c.exists({index: JurisprudenciaVersion, id: docId}))

export const getDoc = (docId: string) => getElasticSearchClient().then( c => c.get<JurisprudenciaDocument>({index: JurisprudenciaVersion, id: docId}))

type NullableTypedJurisprudenciaDocument = {[key in keyof PartialTypedJurisprudenciaDocument]: PartialTypedJurisprudenciaDocument[key] | null}

export const isDoc = (obj: any): obj is NullableTypedJurisprudenciaDocument => {
    if( typeof obj !== "object" ) return false;
    
    let valid = true;
    for(let key of Object.keys(obj)){

        if( isValidJurisprudenciaDocumentKey(key) && obj[key] === null) continue;
        else if( isValidJurisprudenciaDocumentStringKey(key) ){
            valid &&= typeof obj[key] === "string"
        }
        else if( isValidJurisprudenciaDocumentArrayKey(key) ){
            valid &&= typeof obj[key] === "object" && Array.isArray(obj[key]) && obj[key].every((vs: any) => typeof vs === "string")
        }
        else if( isValidJurisprudenciaDocumentRecordKey(key) ){
            valid &&= typeof obj[key] === "object" && Object.entries(obj[key]).every(([ks, vs]) => typeof ks === "string" && typeof vs === "string" )
        }
        else{
            valid = false;
        }
    }

    return false
}

export const updateDoc = (docId: string, doc: NullableTypedJurisprudenciaDocument) =>  getElasticSearchClient().then(c => {
    let updatedDoc: PartialTypedJurisprudenciaDocument = {};
    for( let key in doc ){
        if( isValidJurisprudenciaDocumentKey(key) && doc[key] === null ){
            if( isValidJurisprudenciaDocumentStringKey(key) ){
                updatedDoc[key] = "«sem valor»"
            }
            else if(isValidJurisprudenciaDocumentArrayKey(key)){
                updatedDoc[key] = ["«sem valor»"]
            }
            else if( isValidJurisprudenciaDocumentRecordKey(key) ){
                updatedDoc[key] = {}
            }
        }
        else if(isValidJurisprudenciaDocumentKey(key) && doc[key]){
            if( isValidJurisprudenciaDocumentStringKey(key) ){
                updatedDoc[key] = doc[key]!
            }
            else if(isValidJurisprudenciaDocumentArrayKey(key)){
                updatedDoc[key] = doc[key]!
            }
            else if( isValidJurisprudenciaDocumentRecordKey(key) ){
                updatedDoc[key] = doc[key]!
            }
        }
    }
    return c.update<JurisprudenciaDocument,PartialJurisprudenciaDocument>({index: JurisprudenciaVersion, id: docId, doc: updatedDoc, refresh: "wait_for"})
})

export const createDoc = (newdoc: PartialJurisprudenciaDocument) => getElasticSearchClient().then(c => {
    let createdDoc: PartialJurisprudenciaDocument = {};
    let CONTENT: string[] = [];
    let key: JurisprudenciaDocumentKey;
    for( key in defaultValues ){
        if( Array.isArray(newdoc[key]) ){
            let maybeVal = newdoc[key].filter((v: string) => v.trim().length > 0);
            if( maybeVal.length > 0 ){
                createdDoc[key] = maybeVal;
                CONTENT.push(...maybeVal);
            }
            else{
                createdDoc[key] = defaultValues[key]
            }
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
        "Sumário": calculateUUID(createdDoc,["Sumário"]),
        "Texto": calculateUUID(createdDoc,["Texto"]),
        "Processo": calculateUUID(createdDoc, ["Número de Processo"])

    },
    createdDoc["UUID"] = calculateUUID(createdDoc["HASH"],["Sumário","Texto","Processo"])
    createdDoc["CONTENT"] = CONTENT
    console.log(createdDoc["UUID"])
    return c.index<JurisprudenciaDocument>({index: JurisprudenciaVersion, document: createdDoc as JurisprudenciaDocument, refresh: "wait_for"})
})

export const deleteDoc = (docId: string) => getElasticSearchClient().then(c => c.delete({index: JurisprudenciaVersion, id: docId, refresh: "wait_for"}))


function calculateUUID(table: Record<string, any>, keys: string[]=[]){
    let str = JSON.stringify(table, keys);
    let hash = crypto.createHash("sha1");
    hash.write(str);
    return hash.digest().toString("base64url");
}