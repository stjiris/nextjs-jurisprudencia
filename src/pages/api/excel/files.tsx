import { NextApiRequest, NextApiResponse } from "next";
import { ExcelFile, FileState } from "@/types/excel";
import { authenticatedHandler } from "@/core/user/authenticate";
import { EXCEL_AGG_PATH, EXCEL_ALL_PATH, EXCEL_IMP_PATH, EXCEL_RES_PATH } from "@/core/excel";
import { readdir } from "fs/promises";
import { basename } from "path";

export default async function excelStatusHandler(
    req: NextApiRequest,
    res: NextApiResponse<ExcelFile[]>
){
    return listExcelFiles().then(res.json)
}

function logErr(e: Error): string[]{
    console.error(e);
    return [];
}

function remExt<T>(ext: string, cb: (arg: string, i: number, arr: string[]) => T){
    return (files: string[]) => files.filter(f => f.match(/^\.?\d+\.xlsx$/)).map(f => basename(f, ext)).map(cb)
}

function parseId(id: string): [string, Date, FileState]{
    let state = FileState.file;
    if( id.startsWith(".") ){
        id = id.slice(1)
        state = FileState.dot_file
    }
    
    return [id, new Date(parseInt(id)), state]
}


export async function listExcelFiles(): Promise<ExcelFile[]>{
    let result: Record<string, ExcelFile> = {};

    const assign = (key: keyof ExcelFile) => (states:[string, Date, FileState][]) => states.forEach(([id, date, state]) => result[id] = Object.assign(result[id] || {}, {id: id, date: date, [key]: state}))
    
    return await Promise.all([
        readdir(EXCEL_IMP_PATH).then(remExt(".xlsx", parseId)).then(assign("imported")).catch(logErr),
        readdir(EXCEL_AGG_PATH).then(remExt(".xlsx", parseId)).then(assign("exported_agg")).catch(logErr),
        readdir(EXCEL_ALL_PATH).then(remExt(".xlsx", parseId)).then(assign("exported_all")).catch(logErr),
        readdir(EXCEL_RES_PATH).then(remExt(".xlsx", parseId)).then(assign("result")).catch(logErr),
    ]).then(_ => {
        return Object.values(result).map(e => Object.assign({imported: FileState.no_file, exported_agg: FileState.no_file, exported_all: FileState.no_file, result: FileState.no_file}, e)).sort((a,b) => b.id.localeCompare(a.id));
    })
}