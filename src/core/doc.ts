import { JurisprudenciaDocument, JurisprudenciaVersion, PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { getElasticSearchClient } from "./elasticsearch";

export const getDoc = (docId: string) => getElasticSearchClient().then( c => c.get<JurisprudenciaDocument>({index: JurisprudenciaVersion, id: docId}))

export const updateDoc = (docId: string, doc: PartialJurisprudenciaDocument) =>  getElasticSearchClient().then(c => c.update<JurisprudenciaDocument,PartialJurisprudenciaDocument>({index: JurisprudenciaVersion, id: docId, doc: doc, refresh: "wait_for"}))

export const createDoc = (doc: PartialJurisprudenciaDocument) => getElasticSearchClient().then(c => c.index({index: JurisprudenciaVersion, document: doc, refresh: "wait_for"}))

export const deleteDoc = (docId: string) => getElasticSearchClient().then(c => c.delete({index: JurisprudenciaVersion, id: docId, refresh: "wait_for"}))
