import { getElasticSearchClient } from "../elasticsearch";

import crypto, { timingSafeEqual } from "crypto";

export const sha256 = (msg: string) => crypto.createHash("sha256").update(msg).digest("hex");
const saltGen = (size: number=16) => crypto.randomBytes(size).toString("hex");

export const USERS_INDEX = "users.0.0"

export async function getClient(){
    let client = await getElasticSearchClient();
    if( !(await client.indices.exists({index: USERS_INDEX})) ){
        await client.indices.create({
            index: USERS_INDEX,
            mappings: {
                properties: {
                    "username": {
                        type: 'keyword'
                    },
                    "salt": {
                        type: 'binary'
                    },
                    "hash": {
                        type: 'binary'
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
        await createUser("admin", process.env.ADMIN_PASSWORD || "admin")
    }
    return client;
}

export type User = {
    username: string,
    salt: string,
    hash: string
}

export function hashPassword(salt: string, password: string){
    return sha256(salt + password);
}

export function compare(hash1: string, hash2: string){
    return timingSafeEqual(Buffer.from(hash1), Buffer.from(hash2))
}

export async function listUsers(from: number=0){
    let client = await getClient();
    return await client.search<User>({index: USERS_INDEX, from: from, track_total_hits: true})
}

export async function createUser(user: string, password: string){
    let client = await getClient();
    let r = await client.search<User>({index: USERS_INDEX, query: {term: {username: user}}});
    if( r.hits.hits.length > 0 ){
        return false;
    }
    else{
        let salt = saltGen();
        let r = await client.index({
            index: USERS_INDEX,
            document: {
                username: user,
                salt: salt,
                hash: hashPassword(salt, password)
            },
            refresh: "wait_for"
        })
        return r.result === "created"
    }
}


export async function readUser(user: string){
    let client = await getClient();
    let r = await client.search<User>({index: USERS_INDEX, query: {term: {username: user}}});
    if( r.hits.hits[0] ){
        return r.hits.hits[0];
    }
    return null;
}

export async function updateUser(user: string, password: string){
    let client = await getClient();
    let r = await client.search<User>({index: USERS_INDEX, query: {term: {username: user}}});
    if( r.hits.hits.length === 1 ){
        let hit = r.hits.hits[0];
        let salt = saltGen();
        return await client.index({
            index: USERS_INDEX,
            id: hit._id,
            document: {
                username: user,
                salt: salt,
                hash: hashPassword(salt, password)
            },
            refresh: "wait_for"
        }).then( r => r.result === "updated")
    }
    return false;
}

export async function deleteUser(user: string){
    let client = await getClient();
    return await client.deleteByQuery({index: USERS_INDEX, query: {term: {username: user}}, refresh: true});
}