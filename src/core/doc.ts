//@ts-nocheck
import { JurisprudenciaDocument, JurisprudenciaDocumentStateValues, JurisprudenciaVersion, PartialJurisprudenciaDocument, isJurisprudenciaDocumentDateKey, isJurisprudenciaDocumentExactKey, isJurisprudenciaDocumentGenericKey, isJurisprudenciaDocumentStateKey, isJurisprudenciaDocumentTextKey, calculateUUID, calculateHASH } from "@stjiris/jurisprudencia-document";
import crypto from "node:crypto";
import { getElasticSearchClient } from "./elasticsearch";

export const existsDoc = (docId: string) => getElasticSearchClient().then(c => c.exists({ index: JurisprudenciaVersion, id: docId }))

export const getDoc = (docId: string) => getElasticSearchClient().then(c => c.get<JurisprudenciaDocument>({ index: JurisprudenciaVersion, id: docId }))

export const updateDoc = (docId: string, previewDoc: PartialJurisprudenciaDocument) => getElasticSearchClient().then(c => {
    let doc: PartialJurisprudenciaDocument = {};
    for (let key in previewDoc) {
        if (!previewDoc[key]) continue;
        if (isJurisprudenciaDocumentExactKey(key) && typeof previewDoc[key] === "string") {
            doc[key] = previewDoc[key];
            continue;
        }
        if (isJurisprudenciaDocumentGenericKey(key) && typeof previewDoc[key] === "object" && previewDoc[key]?.Index.every(v => typeof v === "string") && previewDoc[key]?.Original.every(v => typeof v === "string") && previewDoc[key]?.Show.every(v => typeof v === "string")) {
            doc[key] = previewDoc[key];
            continue;
        }
        if (isJurisprudenciaDocumentDateKey(key) && typeof previewDoc[key] === "string" && previewDoc[key].match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            doc[key] = previewDoc[key];
            continue;
        }
        if (isJurisprudenciaDocumentTextKey(key) && typeof previewDoc[key] === "string") {
            doc[key] = previewDoc[key];
            continue;
        }
        if (isJurisprudenciaDocumentStateKey(key) && typeof previewDoc[key] === "string" && JurisprudenciaDocumentStateValues.includes(previewDoc[key])) {
            doc[key] = previewDoc[key];
            continue;
        }
    }
    return c.update<JurisprudenciaDocument, PartialJurisprudenciaDocument>({ index: JurisprudenciaVersion, id: docId, doc, refresh: "wait_for" })
})

export const createDoc = (newdoc: PartialJurisprudenciaDocument) => getElasticSearchClient().then(c => {
    let doc: PartialJurisprudenciaDocument = {};
    let CONTENT = []
    for (let key in newdoc) {
        if (!newdoc[key]) continue;
        if (isJurisprudenciaDocumentExactKey(key) && typeof newdoc[key] === "string") {
            doc[key] = newdoc[key];
            CONTENT.push(newdoc[key])
            continue;
        }
        if (isJurisprudenciaDocumentGenericKey(key) && typeof newdoc[key] === "object" && newdoc[key]?.Index.every(v => typeof v === "string") && newdoc[key]?.Original.every(v => typeof v === "string") && newdoc[key]?.Show.every(v => typeof v === "string")) {
            doc[key] = newdoc[key];
            CONTENT.push(...newdoc[key].Show)
            CONTENT.push(...newdoc[key].Original)
            CONTENT.push(...newdoc[key].Index)
            continue;
        }
        if (isJurisprudenciaDocumentDateKey(key) && typeof newdoc[key] === "string" && newdoc[key].match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            doc[key] = newdoc[key];
            CONTENT.push(newdoc[key])
            continue;
        }
        if (isJurisprudenciaDocumentTextKey(key) && typeof newdoc[key] === "string") {
            doc[key] = newdoc[key];
            CONTENT.push(newdoc[key])
            continue;
        }
        if (isJurisprudenciaDocumentStateKey(key) && typeof newdoc[key] === "string" && JurisprudenciaDocumentStateValues.includes(newdoc[key])) {
            doc[key] = newdoc[key];
            continue;
        }
    }
    doc.Fonte = "STJ (Manual)"
    doc.CONTENT = CONTENT
    doc.Original = {
        "Sem Original": "Documento criado nesta aplicação"
    }
    doc.HASH = calculateHASH(doc);
    doc.UUID = calculateUUID(doc.HASH)
    doc.STATE = doc.STATE || "preparação"

    return c.index<JurisprudenciaDocument>({ index: JurisprudenciaVersion, document: doc as JurisprudenciaDocument, refresh: "wait_for" });
})

export const createSimpleDoc = (newdoc: Record<keyof PartialJurisprudenciaDocument, string>) => {
    let doc: PartialJurisprudenciaDocument = {};
    for (let key in newdoc) {
        if (!newdoc[key]) continue;
        let trimmed = newdoc[key].trim();
        if (isJurisprudenciaDocumentExactKey(key)) {
            doc[key] = trimmed;
            continue;
        }
        if (isJurisprudenciaDocumentGenericKey(key)) {
            let value = trimmed.split("\n").map(v => v.trim()).filter(v => v.length > 0);
            doc[key] = {
                Index: value,
                Original: value,
                Show: value
            }
            continue;
        }
        if (isJurisprudenciaDocumentDateKey(key) && trimmed.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            doc[key] = trimmed;
            continue;
        }
        if (isJurisprudenciaDocumentTextKey(key)) {
            doc[key] = trimmed;
            continue;
        }
        if (isJurisprudenciaDocumentStateKey(key) && JurisprudenciaDocumentStateValues.includes(trimmed)) {
            doc[key] = trimmed;
            continue;
        }
    }
    return createDoc(doc)
}

export const deleteDoc = (docId: string) => getElasticSearchClient().then(c => c.delete({ index: JurisprudenciaVersion, id: docId, refresh: "wait_for" }))
