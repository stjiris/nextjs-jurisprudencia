import { Client } from "@elastic/elasticsearch";
import { AggregationsCardinalityAggregate, AggregationsSumAggregate, AggregationsTermsAggregateBase,SearchHit } from "@elastic/elasticsearch/lib/api/types";
import { isJurisprudenciaDocumentGenericKeys, JurisprudenciaDocumentGenericKeys, JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaDocumentKeys, JurisprudenciaDocumentProperties, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { rm, writeFile } from "fs/promises";
import { join } from "path";
import { utils, writeFileAsync, WorkBook, Sheet } from "xlsx";
import { aggs, getElasticSearchClient } from "./elasticsearch";
import { EXCEL_AGG_PATH, EXCEL_ALL_PATH, EXCEL_RES_PATH } from "./excel";

const EXCEL_SECTION_SIZE = 1000;

function writeFileXLSX(filename: string, wb: WorkBook){
    return new Promise<void>(resolve => writeFileAsync(filename, wb, {}, () => resolve()))
}

let running = false; // TODO: understand thread_workers with nextjs 
export async function excelBuilder(excludeKeys: string[], all: boolean, cb: (progress: number | null) => void){
    if( running ) return;
    running = true;
    cb(0)
    let client = await getElasticSearchClient()
    let start = new Date();
    let id = (+start).toString()
    const stats: any = {
        excluded: excludeKeys.join(","),
        all
    }
    const log = (msg: string) => {
        let when = new Date()
        stats[msg] = when
        console.log(`[${id}] +${+when - +start}ms ${msg}`)
    }

    let tmpAgg = join(EXCEL_AGG_PATH, `.${id}.xlsx`)
    let finAgg = join(EXCEL_AGG_PATH, `${id}.xlsx`)
    await writeFile(tmpAgg,"")

    let keys = []
    let wb = utils.book_new();
    log(`start_aggs`)
    for( let key of JurisprudenciaDocumentKeys ){
        cb(JurisprudenciaDocumentKeys.indexOf(key) / JurisprudenciaDocumentKeys.length)
        let Property = JurisprudenciaDocumentProperties[key];
        let fields = !("type" in Property) ? [`${key}.Original`,`${key}.Show`,`${key}.Index.raw`] : [key] 
        if( "type" in Property && (Property.type === "object" || Property.type === "text") ) continue;
        if( excludeKeys.includes(key) ) continue;
        keys.push(key);
        
        let i=0;
        for( let field of fields ){
            let data = await aggregateField(client, field)
            utils.book_append_sheet(wb, utils.aoa_to_sheet(data), key.substring(0, 20)+"-"+("OMI"[i++])); // OMI - Original Mostrar Indice
        }
    }
    log(`end_aggs`)
    // we dont need to wait - eventually remove it
    writeFileXLSX(finAgg, wb).then(() => rm(tmpAgg))

    
    if(all){
        log(`start_all`)
        let tmpAll = join(EXCEL_ALL_PATH, `.${id}.xlsx`)
        let finAll = join(EXCEL_ALL_PATH, `${id}.xlsx`)
        await writeFile(tmpAll, "")
        let wbAll = await allIndices(client, keys as JurisprudenciaDocumentKey[], cb)
        log(`end_all`)
        writeFileXLSX(finAll, wbAll).then(() => rm(tmpAll))
    }


    let statsFile = join(EXCEL_RES_PATH, `${id}.xlsx`)
    let sh = utils.json_to_sheet([stats]);
    let wbRes = utils.book_new()
    utils.book_append_sheet(wbRes, sh);
    writeFileXLSX(statsFile, wbRes)
    running = false;
}


async function fieldCard(client: Client, field: string, groupingField?: string){
    if( groupingField ){
        let groupingCard = await client.search({
            index: JurisprudenciaVersion,
            size: 0,
            aggs: {
                [groupingField]: {
                    cardinality: {
                        field: groupingField
                    }
                }
            }
        }).then(r => (r.aggregations![groupingField] as AggregationsCardinalityAggregate).value);
        return await client.search({
            index: JurisprudenciaVersion,
            size: 0,
            aggs: {
                SumValue: {
                    sum_bucket: {
                        buckets_path: "Grouping.Cardinality"
                    }
                },
                Grouping: {
                    terms: {
                        field: groupingField,
                        size: groupingCard*10
                    },
                    aggs: {
                        Cardinality: {
                            cardinality: {
                                field: field
                            }
                        }
                    }
                }
            }
        }).then(r => (r.aggregations!.SumValue as AggregationsSumAggregate).value!)
    }
    return await client.search({
        index: JurisprudenciaVersion,
        size: 0,
        aggs: {
            [field]: {
                cardinality: {
                    field: field
                }
            }
        }
    }).then(r => (r.aggregations![field] as AggregationsCardinalityAggregate).value)        
}

async function aggregateField(client: Client, field: string, groupingField?: string){
    let cardinality = await fieldCard(client, field, groupingField);
    let numParts = Math.ceil(cardinality / EXCEL_SECTION_SIZE);
    let header =  ["correção",field,"#",groupingField || ""]
    let data: ["",string,number,string][] = [];

    for( let i = 0; i < numParts; i++ ){
        let r = await client.search<{},Record<string,AggregationsTermsAggregateBase>>({
            index: JurisprudenciaVersion,
            size: 0,
            aggs: {
                [field]: {
                    terms: {
                        field: field,
                        include: {
                            partition: i,
                            num_partitions: numParts
                        },
                        size: EXCEL_SECTION_SIZE*10, // EXCEL_SECTION_SIZE is an approx value
                        order: {
                            _key: "asc"
                        },
                        missing: field === "Data" ? '01/01/0001' : ""
                    },
                    aggs: groupingField ? {
                        group: {
                            terms: {
                                field: groupingField,
                                size: 1,
                                missing: ""
                            }
                        }
                    } : {}
                }
            }
        });
        let bucks = r.aggregations![field].buckets;
        if( !Array.isArray(bucks) ) throw new Error("Invalid buckets type, expected array.")
        bucks.forEach(b => data.push(["", b.key_as_string || b.key, b.doc_count, groupingField ? ("key_as_string" in b.group.buckets[0] ? b.group.buckets[0].key_as_string : b.group.buckets[0].key) : "*"]))
    }
    data.unshift(header as any) 
    return data
}

async function allIndices(client: Client, keys: JurisprudenciaDocumentKey[], cb: (n: number) => void) {
    let wb = utils.book_new();
    let r = await client.search<JurisprudenciaDocument>({
        index: JurisprudenciaVersion,
        scroll: "10s",
        _source: keys,
        track_total_hits: true
    });
    let shs: Record<string, Sheet> = {}
    keys.forEach( k => shs[k] = utils.aoa_to_sheet([isJurisprudenciaDocumentGenericKeys(k) ? [`${k} - Original`,`${k} - Mostrar`,`${k} - Indice`,"id"] : [k,"id"]]))
    let i = 0;
    while( r.hits.hits.length > 0 ){
        cb(i / (typeof r.hits.total === "object" ? r.hits.total.value : r.hits.total || 1 ))
        for( let key of keys ){
            if( isJurisprudenciaDocumentGenericKeys(key) ){
                utils.sheet_add_aoa(shs[key], r.hits.hits.flatMap(hit => allGenericColumns(hit, key as typeof JurisprudenciaDocumentGenericKeys[number])))
            }
            else {
                utils.sheet_add_aoa(shs[key], r.hits.hits.map(hit => ([hit._source![key] || "", hit._id])), {origin: -1})
            }
        }
        i+= r.hits.hits.length
        r = await client.scroll({scroll: "10s", scroll_id: r._scroll_id});
    }

    keys.forEach( k => utils.book_append_sheet(wb, shs[k], k))

    return wb;
}

function allGenericColumns(hit: SearchHit<JurisprudenciaDocument>, key: typeof JurisprudenciaDocumentGenericKeys[number]){
    let data = [];
    let ori = hit._source![key]?.Original || [];
    let shw = hit._source![key]?.Show || [];
    let ind = hit._source![key]?.Index || [];
    for( let i = 0; i < Math.max(ori?.length,shw?.length, ind?.length); i++){
        data.push([ori[i] || "", shw[i] || "", ind[i] || "", hit._id])
    }
    return data
}