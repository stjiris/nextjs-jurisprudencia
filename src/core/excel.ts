import { ExcelState } from "@/types/excel";
import { isJurisprudenciaDocumentGenericKeys, JurisprudenciaDocument, JurisprudenciaDocumentGenericKeys, JurisprudenciaDocumentKey, JurisprudenciaDocumentKeys, JurisprudenciaDocumentProperties, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { mkdirSync } from "fs";
import { rename } from "fs/promises";
import { join } from "path";
import { getElasticSearchClient } from "./elasticsearch";
import { stream } from "exceljs";
import { SearchHit, AggregationsTermsAggregateBase, SearchPointInTimeReference, AggregationsCardinalityAggregate, AggregationsSumAggregate } from "@elastic/elasticsearch/lib/api/types";
import { Client } from "@elastic/elasticsearch";
const WorkbookWriter = stream.xlsx.WorkbookWriter;


const EXCEL_SECTION_SIZE = 1000;

export const EXCEL_FILES_PATH = "./files/"
export const EXCEL_IMP_PATH = join(EXCEL_FILES_PATH, "imp");
export const EXCEL_AGG_PATH = join(EXCEL_FILES_PATH, "agg");
export const EXCEL_ALL_PATH = join(EXCEL_FILES_PATH, "all");
export const EXCEL_RES_PATH = join(EXCEL_FILES_PATH, "res");

// Ensure folders exists
mkdirSync(EXCEL_IMP_PATH, {recursive: true})
mkdirSync(EXCEL_AGG_PATH, {recursive: true})
mkdirSync(EXCEL_ALL_PATH, {recursive: true})
mkdirSync(EXCEL_RES_PATH, {recursive: true})

export const EXCEL_STATE: ExcelState = {
    export_agg: null,
    export_all: null,
    import: null
}

function busy(){
    return EXCEL_STATE.import !== null || EXCEL_STATE.export_agg !== null || EXCEL_STATE.export_all !== null;
}

export function startBuilder(excludeKeys: string[]=[], all: boolean=true){
    if( busy() ) return;

    let keys = JurisprudenciaDocumentKeys.filter(k => {
        let property = JurisprudenciaDocumentProperties[k]
        return (!("type" in property) || (property.type !== "object" && property.type !== "text" )) && !excludeKeys.includes(k);
    })

    console.log(keys)
    
    let start = new Date();
    let nameId = (+start).toString()

    return getElasticSearchClient().then(async client => {
        let pit = await client.openPointInTime({
            index: JurisprudenciaVersion,
            keep_alive: "5m",
        });
        return Promise.all([
            createAggExcel(nameId, client, pit, keys).catch(e => e),
            all ? createAllExcel(nameId, client, pit, keys).catch(e => e) : Promise.resolve("Não")
        ]).then(async ([aggDate, allDate]) => {
            EXCEL_STATE.export_agg = null;
            EXCEL_STATE.export_all = null;

            let finRes = join(EXCEL_RES_PATH, `${nameId}.xlsx`)
            let workbook = new WorkbookWriter({filename: finRes});

            let aggSh = workbook.addWorksheet("Agregações");
            let allSh = workbook.addWorksheet("Todos");

            aggSh.addRow(["Começou", start])
            allSh.addRow(["Começou", start])

            aggSh.addRow(["Resultado", aggDate])
            allSh.addRow(["Resultado", allDate])

            await workbook.commit()

        }).finally(() => {
            client.closePointInTime(pit);
        })
    });
}

async function createAggExcel(id: string, client: Client, pit: SearchPointInTimeReference, keys: JurisprudenciaDocumentKey[]): Promise<Date>{
    if(EXCEL_STATE.export_agg !== null) throw new Error("Server busy.")
    let tmpAgg = join(EXCEL_AGG_PATH, `.${id}.xlsx`)
    let finAgg = join(EXCEL_AGG_PATH, `${id}.xlsx`)
    
    let workbook = new WorkbookWriter({filename: tmpAgg});

    for( let i = 0; i < keys.length; i++){
        let key = keys[i];
        EXCEL_STATE.export_agg = i / keys.length
        let fields = isJurisprudenciaDocumentGenericKeys(key) ? [`${key}.Original`,`${key}.Show`,`${key}.Index.raw`] : [key]
        for(let j = 0; j < fields.length; j++){
            let field = fields[j];
            let sheetName = field.substring(0,30)+"OMI"[j]
            let sh = workbook.addWorksheet(sheetName)
            let fieldData = await aggregateField(client,pit, field);
            fieldData.forEach(d => sh.addRow(d).commit())
            sh.commit()
        }
    }
    EXCEL_STATE.export_agg = 1;

    await workbook.commit();
    await rename(tmpAgg, finAgg);

    return new Date()
}

async function createAllExcel(id: string, client: Client, pit: SearchPointInTimeReference, keys: JurisprudenciaDocumentKey[]): Promise<Date>{
    if(EXCEL_STATE.export_all !== null) throw new Error("Server busy.")
    let tmpAll = join(EXCEL_ALL_PATH, `.${id}.xlsx`)
    let finAll = join(EXCEL_ALL_PATH, `${id}.xlsx`)

    let data = await getAllIndices(client, pit, keys)

    let workbook = new WorkbookWriter({filename: tmpAll});

    for( let i = 0; i < keys.length; i++){
        let key = keys[i];
        EXCEL_STATE.export_all = i / keys.length
        let sh = workbook.addWorksheet(key);
        let rows = data[i];
        for( let j = 0; j < rows.length; j++){
            sh.addRow(rows[j]).commit();
        }
        sh.commit();
    }
    EXCEL_STATE.export_all = 1;
    await workbook.commit();
    await rename(tmpAll, finAll);

    return new Date()
}

async function fieldCard(client: Client, pit: SearchPointInTimeReference, field: string, groupingField?: string){
    if( groupingField ){
        let groupingCard = await client.search({
            pit: pit,
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
            pit: pit,
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
        size: 0,
        pit: pit,
        aggs: {
            [field]: {
                cardinality: {
                    field: field
                }
            }
        }
    }).then(r => (r.aggregations![field] as AggregationsCardinalityAggregate).value)        
}

async function aggregateField(client: Client, pit: SearchPointInTimeReference, field: string, groupingField?: string){
    let cardinality = await fieldCard(client, pit, field, groupingField);
    let numParts = Math.ceil(cardinality / EXCEL_SECTION_SIZE);
    let header =  ["correção",field,"#",groupingField || ""]
    let data: ["",string,number,string][] = [];

    for( let i = 0; i < numParts; i++ ){
        EXCEL_STATE.export_agg = i / numParts;
        let r = await client.search<{},Record<string,AggregationsTermsAggregateBase>>({
            size: 0,
            pit: pit,
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

async function getAllIndices(client: Client, pit: SearchPointInTimeReference, keys: JurisprudenciaDocumentKey[]) {
    let r = await client.search<JurisprudenciaDocument>({
        pit: pit,
        _source: keys,
        track_total_hits: true,
        sort: [{"Data": "asc"}]
    });
    let data: string[][][] = keys.map((k) => [isJurisprudenciaDocumentGenericKeys(k) ? [`${k} - Original`,`${k} - Mostrar`,`${k} - Indice`,"id"] : [k,"id"]]);

    let i = 0;
    while( r.hits.hits.length > 0 ){
        EXCEL_STATE.export_all = i / (typeof r.hits.total === "object" ? r.hits.total.value : r.hits.total || 1 )
        keys.forEach((key, i) => {
            if( isJurisprudenciaDocumentGenericKeys(key) ){
                data[i].push(...r.hits.hits.flatMap(hit => allGenericColumns(hit, key as typeof JurisprudenciaDocumentGenericKeys[number])))
            }
            else{
                data[i].push(...r.hits.hits.flatMap(hit => [[hit._source![key] as any || "", hit._id]]))
            }
        })
        i+= r.hits.hits.length
        r = await client.search({pit: pit, _source: keys, track_total_hits: true, sort: [{"Data": "asc"}], search_after: r.hits.hits.at(-1)?.sort});
    }

    return data;
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
