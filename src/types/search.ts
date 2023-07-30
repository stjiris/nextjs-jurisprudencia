import { PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";

export interface HighlightFragment {
    textFragment: string,
    textMatch: string,
    offset: number,
    size: number
}

export interface SearchHandlerResponseItem{
    _source: PartialJurisprudenciaDocument,
    score: number,
    max_score: number,
    highlight?: Record<string, (string | HighlightFragment)[]>
}

export type SearchHandlerResponse = SearchHandlerResponseItem[]

export type DatalistObj = {
    key: string,
    count?: number
}