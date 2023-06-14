import { aggs, getElasticSearchClient } from "./elasticsearch";

const TERM_INFO_INDEX = "term-info.0.0"
interface TermInfo {
    text: string
}

async function getClient(){
    let client = await getElasticSearchClient();
    if( !(await client.indices.exists({index: TERM_INFO_INDEX})) ){
        await client.indices.create({
            index: TERM_INFO_INDEX,
            mappings: {
                properties: {
                    "text": {
                        type: "text"
                    }
                }
            },
            settings: {
                number_of_shards: 1,
                number_of_replicas: 0,
                max_result_window: 1
            }
        }).catch(e => {
            console.log(e)
        });
    }
    return client;
}

export async function getTerm(term: string){
    let client = await getClient();
    let r = await client.get<TermInfo>({
        index: TERM_INFO_INDEX,
        id: aggs[term].terms?.field?.replace(".keyword", "") || ""
    },{
        ignore: [404]
    })
    return r._source?.text;
}

export async function updateTerm(term: string, text: string){
    let client = await getClient();

    let r = await client.update<TermInfo,Partial<TermInfo>>({
        index: TERM_INFO_INDEX,
        id: aggs[term].terms?.field?.replace(".keyword", "") || "",
        doc: {
            text: text
        },
        doc_as_upsert: true, // if term doesn't exist create it
        refresh: "wait_for"
    })

    return await getTerm(term);
}

export async function deleteTerm(term: string) {
    return updateTerm(term, "");
}