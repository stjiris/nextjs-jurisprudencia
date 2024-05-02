import { NextApiRequest, NextApiResponse } from "next";
import { getElasticSearchClient } from "./elasticsearch";
import { NextRequest, NextResponse, userAgent } from "next/server";
import { IncomingMessage, ServerResponse } from "http";

const REQUEST_INDEX = "requests.0.1"

async function getClient(){
    let client = await getElasticSearchClient();
    if( !(await client.indices.exists({index: REQUEST_INDEX})) ){
        await client.indices.create({
            index: REQUEST_INDEX,
            mappings: {
                properties: {
                    method: {
                        type: 'keyword'
                    },
                    url: {
                        type: 'keyword'
                    },
                    status: {
                        type: 'integer'
                    },
                    start: {
                        type: 'date'
                    },
                    end: {
                        type: 'date'
                    },
                    duration: {
                        type: 'integer'
                    },
                    userAgent: {
                        type: 'keyword'
                    },
                    ip: {
                        type: 'ip'
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


export async function trackApiRequest(req: NextApiRequest, res: NextApiResponse, start: Date, end: Date){
    let client = await getClient();
    return await client.index({
        index: REQUEST_INDEX,
        body: {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            start: start.toISOString(),
            end: end.toISOString(),
            duration: (+end) - (+start),
            userAgent: req.headers['user-agent'],
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
        }
    })
}

export async function trackSspRequest(req: IncomingMessage, res: ServerResponse<IncomingMessage>, start: Date, end: Date){
    let client = await getClient();
    return await client.index({
        index: REQUEST_INDEX,
        body: {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            start: start.toISOString(),
            end: end.toISOString(),
            duration: (+end) - (+start),
            userAgent: req.headers['user-agent'],
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
        }
    })
}