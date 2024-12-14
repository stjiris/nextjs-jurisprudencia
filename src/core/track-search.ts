import { getElasticSearchClient } from "./elasticsearch";

import crypto from "crypto";

const SAVED_SEARCH_INDEX = "saved-searches.0.1"

async function getClient(){
    let client = await getElasticSearchClient();
    if( !(await client.indices.exists({index: SAVED_SEARCH_INDEX})) ){
        await client.indices.create({
            index: SAVED_SEARCH_INDEX,
            mappings: {
                properties: {
                    "searchHash": {
                        type: 'keyword'
                    },
                    "searchParams": {
                        type: 'keyword'
                    },
                    "searchClicks": {
                        type: 'keyword'
                    }
                }
            },
            settings: {
                number_of_shards: 1,
                number_of_replicas: 0,
                max_result_window: 550000
            }
        }).catch(e => {
            console.log(e)
        });
    }
    return client;
}


function shakeHash(str: string){
    let hash = crypto.createHash("shake256", { outputLength: 14 });
    hash.write(str);
    return hash.digest().toString("base64url");
}

export async function saveSearch(reqString: string){
    let client = await getClient();
    let r = await client.search<{searchHash: string}>({ index: SAVED_SEARCH_INDEX, query: { term: { searchParams: reqString }}, _source: ["searchHash"]});
    if( r.hits.hits.length > 0 ){
        return r.hits.hits[0]._source?.searchHash;
    }
    let hashStr = shakeHash(reqString);
    r = await client.search({
        index: SAVED_SEARCH_INDEX,
        query: { term: {searchHash: hashStr}},
        _source: false
    });
    while(r.hits.hits.length > 0){ // prevent new hashes from coliding since we are using only the first 7 bytes
        let salt = crypto.randomBytes(10).toString('hex') // using salt to make less likely to colide
        hashStr = shakeHash(hashStr + salt);
        r = await client.search({
            index: SAVED_SEARCH_INDEX,
            query: { term: {searchHash: hashStr}},
            _source: false
        }); 
    }
    await client.index({
        index: SAVED_SEARCH_INDEX,
        document: {
            searchHash: hashStr,
            searchParams: reqString,
            searchClicks: []
        }
    });

    return hashStr;
}

export async function trackClickedDocument(searchHash: string, documentId: string){
    let client = await getClient();
    let r = await client.search<{searchClicks: string[]}>({
        index: SAVED_SEARCH_INDEX,
        query: { term: { searchHash: searchHash } },
        _source: ["searchClicks"]
    }).catch( e => {
        console.log(e);
        return {hits: {hits: []}}
    });
    if( r.hits.hits.length == 0 ) return;

    await client.update({
        index: SAVED_SEARCH_INDEX,
        id: r.hits.hits[0]._id,
        doc: {
            searchClicks: r.hits.hits[0]._source?.searchClicks.concat([documentId])
        }
    }).catch(e => {
        console.log(e);
    });
}

export async function getShearchParams(searchHash: string){
    let client = await getClient()
    let r = await client.search<{searchParams: string}>({
        index: SAVED_SEARCH_INDEX,
        query: {
            term: { searchHash: searchHash }
        },
        _source: ["searchParams"]
    }).catch( e => {
        console.log(e);
        return {hits: {hits: []}}
    });
    if( r.hits.hits.length == 0 ) return;

    return r.hits.hits[0]._source?.searchParams;
}