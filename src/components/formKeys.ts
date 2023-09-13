import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { useState } from "react";
import { modifySearchParams } from "./select-navigate";
import { JurisprudenciaDocumentKey, JurisprudenciaDocumentKeys } from "@stjiris/jurisprudencia-document";

export const FORM_KEY = "_f";
export const FORM_SPL = "-"

export const RENAME: Partial<Record<JurisprudenciaDocumentKey,string>> = {
    "Relator Nome Profissional": "Relator"
}
export const REMOVE: JurisprudenciaDocumentKey[] = ["Original","CONTENT","HASH"];
export const DONT_SUGGEST: JurisprudenciaDocumentKey[] = ["ECLI","Número de Processo"];
export const ALL_FORM_KEYS: {accessKey: JurisprudenciaDocumentKey, dontSuggest?: boolean, showKey?: string}[] = JurisprudenciaDocumentKeys.map( o => ({accessKey: o, dontSuggest: DONT_SUGGEST.includes(o), showKey: RENAME[o] ? RENAME[o] : o}))
export function defaultKeys(){
    // In case we want a different set of default keys
    let USE: JurisprudenciaDocumentKey[] = ["Número de Processo","Indicações Eventuais","Sumário","Texto","URL","UUID","ECLI","Fonte","Referência de publicação","Secção","Data","Relator Nome Profissional","Meio Processual","Descritores","Votação","Decisão"]
    return ALL_FORM_KEYS.filter((key) => USE.includes(key.accessKey)).map((_v,i) => i);
}

export function useFormOrderedKeys(){
    let params = useSearchParams();
    let router = useRouter();
    
    let [sort, _setSort] = useState<number[]>(() => {
        let _sort = params.get(FORM_KEY)?.split(FORM_SPL).map(i => parseInt(i.trim())).filter(i => i) || defaultKeys();
        return _sort;
    })

    let setSort = (cb: ((arg: number[]) => number[]) ) => {
        _setSort(curr => {
            let updated = cb(curr)
            router.replace("?"+modifySearchParams(params, FORM_KEY, updated.join(FORM_SPL)).toString(), undefined, {scroll: false, shallow: true})
            return updated;
        })
    }
    
    const move = (currPos: number, insAfter: number) => {
        if( currPos === insAfter ) return;
        return setSort((currSort) => {
            let firstHalf = currSort.slice(0, currPos);
            let secondHalf = currSort.slice(currPos+1);
            let final = firstHalf.concat(secondHalf);
            final.splice(insAfter, 0, currSort[currPos]);
            return final;
        })
    }

    const hide = (currPos: number) => {
        return setSort((currSort) => currSort.slice(0, currPos).concat(currSort.slice(currPos+1)));
    }

    const all = () => {
        return setSort((currSort) => [...ALL_FORM_KEYS.map((_v, i) => i).filter((i) => !currSort.includes(i))].concat(currSort))
    }
    
    return [sort.map((i) => ALL_FORM_KEYS[i]), {move, hide, all}] as const;
}