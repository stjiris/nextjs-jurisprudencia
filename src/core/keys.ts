import { JurisprudenciaKey, KEYS_INFO_INDEX_VERSION, KEYS_INFO_PROPERTIES, makeValidValue } from "@/types/keys";
import { getElasticSearchClient } from "./elasticsearch";
import { JurisprudenciaDocumentKey, JurisprudenciaDocumentKeys } from "@stjiris/jurisprudencia-document";

async function getClient() {
    let client = await getElasticSearchClient();
    if (!(await client.indices.exists({ index: KEYS_INFO_INDEX_VERSION }))) {
        await client.indices.create({
            index: KEYS_INFO_INDEX_VERSION,
            mappings: {
                properties: KEYS_INFO_PROPERTIES
            },
            settings: {
                number_of_shards: 1,
                number_of_replicas: 0,
                refresh_interval: "1s"
            }
        }).catch(e => {
            console.log(e)
        });
        await client.bulk<JurisprudenciaKey, JurisprudenciaKey>({
            index: KEYS_INFO_INDEX_VERSION,
            operations: JurisprudenciaDocumentKeys.flatMap((key, i) => [
                { create: {} },
                { key: key, name: key, description: "Sem descrição", active: false, filtersSuggest: false, filtersShow: false, filtersOrder: i + 1, indicesList: false, indicesGroup: false, documentShow: false, authentication: false, editorEnabled: false, editorRestricted: false, editorSuggestions: false }
            ])
        })
    }
    else {
        let r = await client.search<JurisprudenciaKey>({
            index: KEYS_INFO_INDEX_VERSION,
            size: JurisprudenciaDocumentKeys.length
        })
        if (r.hits.hits.length < JurisprudenciaDocumentKeys.length) {
            let create = JurisprudenciaDocumentKeys.filter(k => !r.hits.hits.some(h => h._source?.key === k));
            await client.bulk<JurisprudenciaKey, JurisprudenciaKey>({
                index: KEYS_INFO_INDEX_VERSION,
                operations: create.flatMap((key, i) => [
                    { create: {} },
                    { key: key, name: key, description: "Sem descrição", active: false, filtersSuggest: false, filtersShow: false, filtersOrder: r.hits.hits.length + 1, indicesList: false, indicesGroup: false, documentShow: false, authentication: false, editorEnabled: false, editorRestricted: false, editorSuggestions: false }
                ]),
                refresh: "true"
            }).then(r => console.log(r.items[0]))
        }
    }
    return client;
}

export async function getAllKeys(authed: boolean = false) {
    let client = await getClient();
    return await client.search<JurisprudenciaKey>({
        index: KEYS_INFO_INDEX_VERSION,
        size: JurisprudenciaDocumentKeys.length,
        sort: [{
            "filtersOrder": "asc"
        }, {
            "key": "asc"
        }]
    }).then(r => r.hits.hits.map<JurisprudenciaKey>(({ _source: key }) => {
        if (!key) throw new Error("Unreachable");

        if (!authed && key.authentication) {
            return {
                key: key.key,
                name: key.name,
                description: key.description,
                filtersOrder: key.filtersOrder,
                active: false,
                authentication: true,
                documentShow: false,
                filtersShow: false,
                filtersSuggest: false,
                indicesGroup: false,
                indicesList: false,
                editorEnabled: false,
                editorRestricted: false,
                editorSuggestions: false
            }
        }

        return key;
    }));
}

export function getKey(k: JurisprudenciaDocumentKey) {
    return getClient().then(c => c.search<JurisprudenciaKey>({ index: KEYS_INFO_INDEX_VERSION, query: { term: { key: k } } })).then(r => r.hits.hits[0]._source!)
}

export async function updateKey(key: JurisprudenciaDocumentKey, update: Partial<JurisprudenciaKey>) {
    let client = await getClient();

    let r = await client.search<JurisprudenciaKey>({
        index: KEYS_INFO_INDEX_VERSION,
        query: {
            term: {
                "key": key
            }
        }
    });
    let hit = r.hits.hits[0];
    if (!hit) return;

    // if update a boolean that it's dependent of other update it
    if (update.indicesGroup) update.indicesList = true;
    if (update.filtersSuggest || update.filtersShow || update.indicesList) update.active = true;
    if (update.editorRestricted) update.editorSuggestions = true;
    if (update.editorSuggestions) update.editorEnabled = true;
    if (update.editorOriginalOnly) update.editorEnabled = true;

    // Can never update internal key
    update = makeValidValue({ ...hit._source!, ...update, key: key })

    return await client.update<JurisprudenciaKey>({
        index: KEYS_INFO_INDEX_VERSION,
        id: hit._id,
        doc: update,
        refresh: "true"
    })
}
