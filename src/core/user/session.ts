import { getElasticSearchClient } from "../elasticsearch";

import crypto from "crypto";

export const sha256 = (msg: string) => crypto.createHash("sha256").update(msg).digest("hex");
const saltGen = (size: number=16) => crypto.randomBytes(size).toString("hex");

export const SESSION_INDEX = "sessions.0.0"

export async function getClient(){
    let client = await getElasticSearchClient();
    if( !(await client.indices.exists({index: SESSION_INDEX})) ){
        await client.indices.create({
            index: SESSION_INDEX,
            mappings: {
                properties: {
                    "username": {
                        type: 'keyword'
                    },
                    "session": {
                        type: 'keyword'
                    },
                    "until": {
                        type: 'keyword',
                        index: false
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

export type Session = {
    username: string,
    session: string,
    until: string
}

export async function listSessions(from: number=0){
    let client = await getClient();
    return await client.search<Session>({index: SESSION_INDEX, from: from, track_total_hits: true})
}

export function dateIn(minutes: number, from?: Date){
    let start = from || new Date();

    return new Date(start.getTime() + minutes*60000)
}

export async function createSession(user: string){
    let client = await getClient();
    let sessionId: string | null = null;
    while( !sessionId ){
        sessionId = saltGen(24);
        // assert session doesn't exist
        let r = await client.search<Session>({index: SESSION_INDEX, query: {bool: {must: [{term: {username: user}},{term:{session: sessionId}}]}},terminate_after: 1});
        if( r.hits.hits.length > 0 ){
            sessionId = null;
        }
    }
    
    let r = await client.index({
        index: SESSION_INDEX,
        document: {
            username: user,
            session: sessionId,
            until: dateIn(15).toString()
        },
        refresh: "wait_for"
    })
    if( r.result === "created" ){
        return sessionId;
    }
    else{
        return "";
    }
}

export async function validateSession(user: string, session: string){
    let client = await getClient();
    let r = await client.search<Session>({index: SESSION_INDEX, query: {bool: {must: [{term: {username: user}},{term:{session: session}}]}}});
    if( r.hits.hits.length == 0 ) return false;

    let sessionObj = r.hits.hits[0]
    if( new Date().getTime() - new Date(sessionObj._source?.until!).getTime() > 0 ){
        await deleteSession(user, session);
        return false;
    }
    else{
        await updateSession(user, session);
        return true;
    }
}

export async function updateSession(user: string, session: string){
    let client = await getClient();
    return await client.updateByQuery({index: SESSION_INDEX, query: {bool: {must: [{term: {username: user}},{term:{session: session}}]}}, script: `ctx._source.until = "${dateIn(15).toString()}"`, conflicts: "proceed"});
}

export async function deleteSession(user: string, session: string){
    let client = await getClient();
    return await client.deleteByQuery({index: SESSION_INDEX, query: {bool: {must: [{term: {username: user}},{term:{session: session}}]}}, conflicts: "proceed"});
}

export async function deleteUserSession(user: string){
    let client = await getClient();
    return await client.deleteByQuery({index: SESSION_INDEX, query: {bool: {must: [{term: {username: user}}]}}, conflicts: "proceed"});
}