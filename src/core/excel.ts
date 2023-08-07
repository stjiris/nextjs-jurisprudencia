import { exportableKeys } from "@/components/exportable-keys";
import { ExcelState } from "@/types/excel";
import { Client } from "@elastic/elasticsearch";
import { AggregationsCardinalityAggregate, AggregationsSumAggregate, AggregationsTermsAggregateBase, SearchHit, SearchPointInTimeReference } from "@elastic/elasticsearch/lib/api/types";
import { isJurisprudenciaDocumentGenericKeys, JurisprudenciaDocument, JurisprudenciaDocumentGenericKeys, JurisprudenciaDocumentKey, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { createHash } from "crypto";
import { CellValue, stream } from "exceljs";
import { mkdirSync } from "fs";
import { rename } from "fs/promises";
import { join } from "path";
import { getElasticSearchClient } from "./elasticsearch";
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

export function startParser(start: Date, excludeKeys: string[]=[]){
    if( busy() ) return;

    let importFile = join(EXCEL_IMP_PATH, `${+start}.xlsx`);

    let rd = new stream.xlsx.WorkbookReader(importFile, {});

    return readWorkbook(rd).then((logs) => {
        EXCEL_STATE.import = null;
        return startBuilder(start, excludeKeys, false, logs)
    }).finally(() => {
        EXCEL_STATE.import = null
    })
}

async function readWorkbook(wb: stream.xlsx.WorkbookReader){
    let logs: string[][] = [];
    let client = await getElasticSearchClient();
    for await (const worksheetReader of wb ) {
        let worksheetData = await readWorksheet(worksheetReader)
        let header = worksheetData.splice(0,1)[0];
        
        let idIndex = header.indexOf("id");
        let correcaoIndex = header.indexOf("correção");
        if( correcaoIndex !== -1 ){
            // correcao fieldToUpdate # groupingField
            let fieldToUpdate = header[correcaoIndex+1]?.toString();
            let groupingField = header[correcaoIndex+3]?.toString();
            if( !fieldToUpdate ) continue;

            logs.push(...await updateAggs(worksheetData, client, correcaoIndex, fieldToUpdate, groupingField) as unknown as string[][])
        }
        else if(idIndex !== -1){
            // Field | Fields | id
            let fields = header.map(h => h?.toString()).filter(h => h && h !== "id" && h !== "hash") as string[];
            let indexes = header.map((h, i) => [h,i]).filter(([h,i]) => h && h !== "id" && h !== "hash").map(([h,i]) => i as number);
            logs.push(...await updateIds(worksheetData, client, idIndex, fields, indexes))

        }
        else{
            logs.push(["invalid header", ...header as string[]])
        }
    }
    return logs;
}

async function readWorksheet(ws: stream.xlsx.WorksheetReader){
    let data = []
    for await(const row of ws){
        data.push(row.values as CellValue[])
    }
    return data;
}

async function updateAggs(data: CellValue[][], client: Client, correcaoIndex: number, fieldToUpdate: string, groupingField?: string ){
    let logs = []
    for(let i=0; i < data.length; i++){
        EXCEL_STATE.import = i / data.length;
        let row = data[i];
        let newValue = row[correcaoIndex]?.toString();
        let oldValue = row[correcaoIndex+1]?.toString()
        let grpValue = row[correcaoIndex+3]?.toString();
        if( !newValue || !oldValue) continue;

        let must = [{
            term: {
                [fieldToUpdate]: oldValue
            }
        }];
        if( groupingField && grpValue ){
            must.push({
                term: {
                    [groupingField]: grpValue
                }
            })
        }

        if( isJurisprudenciaDocumentGenericField(fieldToUpdate) ){
            let r = await client.updateByQuery({
                index: JurisprudenciaVersion,
                query: {bool: {must}},
                script: {
                    source: `
                        int oldValueIndex = ctx._source[params.fieldToUpdate][params.subPath].indexOf(params.oldValue);
                        ctx._source[params.fieldToUpdate][params.subPath][oldValueIndex] = params.newValue;`,
                    params: {
                        fieldToUpdate: fieldToUpdate.replace(/\..*/g,""),
                        subPath: fieldToUpdate.replace(/[^.]*\./,"").replace(".raw",""),
                        newValue,
                        oldValue
                    }
                    
                },
                refresh: true
            }, {
                requestTimeout: "5m"
            })
            logs.push([fieldToUpdate, oldValue, newValue, r.took, r.updated])
        }
        else{
            let r = await client.updateByQuery({
                index: JurisprudenciaVersion,
                query: {bool: {must}},
                script: {
                    source: `ctx._source[params.fieldToUpdate] = params.newValue;`,
                    params: {
                        fieldToUpdate,
                        newValue
                    }
                    
                },
                refresh: true
            }, {
                requestTimeout: "5m"
            })
            logs.push([fieldToUpdate, oldValue, newValue, r.took, r.updated])
        }
    }

    return logs;
}

async function updateIds(worksheetData: CellValue[][], client: Client, idIndex: number, fieldsName: string[], fieldsIndex: number[]) {
    let logs: string[][] = []
    let actualField = fieldsName[0].replace(" - Original","").replace(" - Mostrar","").replace(" - Indice","");
    if( fieldsName.some(fn => fn.indexOf(actualField) === -1) ) return [["invalid header", ...fieldsName]];
    let indexFieldMap: Record<string, number | undefined> = {};
    if( isJurisprudenciaDocumentGenericKeys(actualField) ){
        indexFieldMap = {
            Original: fieldsIndex[fieldsName.indexOf(`${actualField} - Original`)],
            Show: fieldsIndex[fieldsName.indexOf(`${actualField} - Mostrar`)],
            Index: fieldsIndex[fieldsName.indexOf(`${actualField} - Indice`)]
        }
    }

    let total = worksheetData.length;
    let ops = [];
    while( worksheetData.length > 0 ){
        EXCEL_STATE.import = (total-worksheetData.length) / total;
        console.log(worksheetData.length, total, (total-worksheetData.length) / total,"%")

        let currId = worksheetData[0][idIndex]?.toString();
        if( !currId ){ break; }
        let targetRows = worksheetData.filter(row => row[idIndex] === currId);
        worksheetData = worksheetData.filter(row => row[idIndex] !== currId);
        if( !targetRows.some( row => rowUpdated(row as string[]) )) continue;

        let update: Record<string,string | Record<string, string[]>> = {}
        if( isJurisprudenciaDocumentGenericKeys(actualField) ){
            update[actualField] = {};
            for(let key in indexFieldMap){
                if( indexFieldMap[key] ){
                    //@ts-ignore TODO: why typescrip
                    update[actualField][key] = targetRows.map( r => r[indexFieldMap[key]!]?.toString().trim() || "").filter( s => s.length > 0 )
                }
            }
        }
        else{
            update[actualField] = targetRows.at(-1)![fieldsIndex[0]]!.toString().trim();
        }
        ops.push(...[{
            update: {
                _id: currId
            }
        },{
            doc: update
        }]);
        if( ops.length > 500 ){
            await client.bulk({
                index: JurisprudenciaVersion,
                operations: ops
            }).then(r => {
                logs.push(["update", actualField, r.took.toString(), "ms",r.items.length.toString(),r.errors ? "errors" : "no errors", ...r.items.map(i => i.update?.error?.reason || "")])
            })
            ops = [];
        }
    }
    if( ops.length > 0 ){
        await client.bulk({
            index: JurisprudenciaVersion,
            operations: ops
        }).then(r => {
            logs.push(["update", actualField, r.took.toString(), "ms",r.items.length.toString(),r.errors ? "errors" : "no errors", ...r.items.map(i => i.update?.error?.reason || "")])
        })
    }
    return logs;
}


export function startBuilder(start: Date, excludeKeys: string[]=[], all: boolean=true, importLogs?: string[][]){
    if( busy() ) return;

    let keys = exportableKeys().filter(k => !excludeKeys.includes(k));
    
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

            if( importLogs ){
                let impSh = workbook.addWorksheet("Importação");
                for( let row of importLogs ){
                    impSh.addRow(row);
                }
            }

            await workbook.commit()

        }).finally(() => {
            client.closePointInTime(pit);
        })
    });
}

function isJurisprudenciaDocumentGenericField(s: string){
    return  (s.endsWith(".Original") ||
            s.endsWith(".Show") ||
            s.endsWith(".Index.raw")) && isJurisprudenciaDocumentGenericKeys(s.replace(/\.[^.]*/g,""));
}

async function createAggExcel(id: string, client: Client, pit: SearchPointInTimeReference, keys: JurisprudenciaDocumentKey[]): Promise<Date>{
    if(EXCEL_STATE.export_agg !== null) throw new Error("Server busy.")
    EXCEL_STATE.export_agg = 0;
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
    EXCEL_STATE.export_all = 0;
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
        bucks.forEach((b: any) => data.push(["", b.key_as_string || b.key, b.doc_count, groupingField ? ("key_as_string" in b.group.buckets[0] ? b.group.buckets[0].key_as_string : b.group.buckets[0].key) : "*"]))
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
    let data: string[][][] = keys.map((k) => [isJurisprudenciaDocumentGenericKeys(k) ? [`${k} - Original`,`${k} - Mostrar`,`${k} - Indice`,"id","hash"] : [k,"id","hash"]]);

    let i = 0;
    while( r.hits.hits.length > 0 ){
        EXCEL_STATE.export_all = i / (typeof r.hits.total === "object" ? r.hits.total.value : r.hits.total || 1 )
        keys.forEach((key, i) => {
            if( isJurisprudenciaDocumentGenericKeys(key) ){
                data[i].push(...r.hits.hits.flatMap(hit => allGenericColumns(hit, key as typeof JurisprudenciaDocumentGenericKeys[number])))
            }
            else{
                data[i].push(...r.hits.hits.flatMap(hit => [addHash([hit._source![key] as any || "", hit._id])]))
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
        data.push(addHash([ori[i] || "", shw[i] || "", ind[i] || "", hit._id]))
    }
    return data
}

function hash(s: string){
    return Buffer.from(s).toString('base64url');
}

function addHash(row: string[]){
    return [...row, hash(row.join(""))]
}

function rowUpdated(row: string[]){
    let rowHash = row[row.length-1];
    let rowContentHash = hash(row.slice(0,row.length-1).join(""))
    return rowHash !== rowContentHash;
}