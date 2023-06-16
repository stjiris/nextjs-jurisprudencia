import { JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaVersion, PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { getElasticSearchClient } from "./elasticsearch";
import crypto from "node:crypto"

export const getDoc = (docId: string) => getElasticSearchClient().then( c => c.get<JurisprudenciaDocument>({index: JurisprudenciaVersion, id: docId}))

export const updateDoc = (docId: string, doc: PartialJurisprudenciaDocument) =>  getElasticSearchClient().then(c => c.update<JurisprudenciaDocument,PartialJurisprudenciaDocument>({index: JurisprudenciaVersion, id: docId, doc: doc, refresh: "wait_for"}))

let defaultValues: JurisprudenciaDocument = {
    "Número de Processo": "«sem valor»",
    Fonte: "«sem valor»",
    URL: "«sem valor»",
    ECLI: "«sem valor»",
    Data: "01/01/0001",
    Área: "«sem valor»",
    "Meio Processual": ["«sem valor»"],
    "Relator Nome Completo": "«sem valor»",
    "Relator Nome Profissional": "«sem valor»",
    Secção: "«sem valor»",
    "Tribunal de Recurso": "«sem valor»",
    "Tribunal de Recurso - Processo": "«sem valor»",
    Decisão: ["«sem valor»"],
    "Decisão (textual)": ["«sem valor»"],
    "Votação - Decisão": ["«sem valor»"],
    "Votação - Vencidos": ["«sem valor»"],
    "Votação - Declarações": ["«sem valor»"],
    Descritores: ["«sem valor»"],
    Jurisprudência: ["Simples"],
    "Jurisprudência Estrangeira": ["«sem valor»"],
    "Jurisprudência Internacional": ["«sem valor»"],
    "Jurisprudência Nacional": ["«sem valor»"],
    "Doutrina": ["«sem valor»"],
    "Legislação Comunitária": ["«sem valor»"],
    "Legislação Estrangeira": ["«sem valor»"],
    "Legislação Nacional": ["«sem valor»"],
    "Referências Internacionais": ["«sem valor»"],
    "Referência de publicação": ["«sem valor»"],
    "Área Temática": ["«sem valor»"],
    "Indicações Eventuais": ["«sem valor»"],
    CONTENT: [],
    Original: {
        "Sem original": "Documento criado por esta aplicação"
    },
    Sumário: "",
    Texto: "",
    HASH: {},
    UUID: ""
}

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