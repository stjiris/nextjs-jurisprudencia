import { createClient } from "redis";

import crypto from "crypto";

export const sha256 = (msg: string) => crypto.createHash("sha256").update(msg).digest("hex");
const saltGen = (size: number=16) => crypto.randomBytes(size).toString("hex");

export const SESSION_KEY = "redis-sessions.0.0"
export const SESSION_EXPIRE = 15*60;

export function getClient(){
    return createClient({
        url: "redis://redis:6379/0",
    }).connect();
}

export async function createSession(user: string){
    let client = await getClient();
    try{
        let tries = 3;
        let sessionId: string | null = null;
        while( !sessionId ){
            sessionId = saltGen(24);
            // assert session doesn't exist
            const r = await client.set(`${SESSION_KEY}:${sessionId}`, user, { NX: true, EX: SESSION_EXPIRE })
            if( r !== "OK" ){
                sessionId = null;
            }
            tries--;
            if( tries == 0 ){
                break;
            }
        }
        if( sessionId ){
            return sessionId;
        }
        else{
            return "";
        }
    }
    finally{
        await client.quit();
    }
}

export async function validateSession(user: string, session: string){
    let client = await getClient();
    try{
        const sessionUser = await client.get(`${SESSION_KEY}:${session}`);
        if( !sessionUser ){
            return false;
        }
        if( sessionUser !== user ){
            return false;
        }
        await client.expire(`${SESSION_KEY}:${session}`, SESSION_EXPIRE);
        return true;
    }
    finally{
        await client.quit();
    }
}

export async function deleteSession(user: string, session: string){
    let client = await getClient();
    try{
        return await client.del(`${SESSION_KEY}:${session}`);
    }
    finally{
        await client.quit();
    }
}

export async function deleteUserSession(user: string){
    let client = await getClient();
    try{
        const sessions = await client.keys(`${SESSION_KEY}:*`);
        for( let session of sessions ){
            const sessionUser = await client.get(session);
            if( sessionUser == user ){
                await client.del(session);
            }
        }
        return true;
    }
    finally{
        await client.quit();
    }
}