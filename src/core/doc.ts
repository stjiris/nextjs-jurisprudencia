//@ts-nocheck
import { JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaVersion, PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { getElasticSearchClient } from "./elasticsearch";
import crypto from "node:crypto"

export const existsDoc = (docId: string) => getElasticSearchClient().then(c => c.exists({index: JurisprudenciaVersion, id: docId}))

export const getDoc = (docId: string) => getElasticSearchClient().then( c => c.get<JurisprudenciaDocument>({index: JurisprudenciaVersion, id: docId}))

let defaultValues: JurisprudenciaDocument = {
    "Número de Processo": null,
    Fonte: null,
    URL: null,
    ECLI: null,
    Data: "01/01/0001",
    Área: null,
    "Meio Processual": null,
    "Relator Nome Completo": null,
    "Relator Nome Profissional": null,
    Secção: null,
    "Tribunal de Recurso": null,
    "Tribunal de Recurso - Processo": null,
    Decisão: null,
    "Decisão (textual)": null,
    "Votação - Decisão": null,
    "Votação - Vencidos": null,
    "Votação - Declarações": null,
    Descritores: null,
    Jurisprudência: null,
    "Jurisprudência Estrangeira": null,
    "Jurisprudência Internacional": null,
    "Jurisprudência Nacional": null,
    "Doutrina": null,
    "Legislação Comunitária": null,
    "Legislação Estrangeira": null,
    "Legislação Nacional": null,
    "Referências Internacionais": null,
    "Referência de publicação": null,
    "Área Temática": null,
    "Indicações Eventuais": null,
    CONTENT: [],
    Original: {
        "Sem original": "Documento criado por esta aplicação"
    },
    Sumário: "",
    Texto: "",
    HASH: null,
    UUID: ""
}

export const updateDoc = (docId: string, doc: PartialJurisprudenciaDocument) =>  getElasticSearchClient().then(c => {
    throw new Error("TODO: Unimplemented")
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