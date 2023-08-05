import { ExcelState } from "@/types/excel";
import { Client } from "@elastic/elasticsearch";
import { AggregationsCardinalityAggregate, AggregationsTermsAggregateBase, AggregationsDateRangeAggregate, AggregationsMultiTermsBucketKeys, AggregationsSumBucketAggregation, AggregationsSumAggregate } from "@elastic/elasticsearch/lib/api/types";
import { JurisprudenciaDocumentProperties, isJurisprudenciaDocumentContentKey, isJurisprudenciaDocumentTextKeys, isValidJurisprudenciaDocumentKey, JurisprudenciaDocument, JurisprudenciaDocumentKeys, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import path, { join } from "path";
import { Worker } from "worker_threads";
import xlsx, { utils, WorkBook, writeFileXLSX } from "xlsx";
import { aggs, getElasticSearchClient } from "./elasticsearch";
import { excelBuilder } from "./excel-builder";

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
    export: null,
    import: null
}

export function startBuilder(excludeKeys: string[]=[], all: boolean=true){
    excelBuilder(excludeKeys, all, (v) => EXCEL_STATE.export = v)
}