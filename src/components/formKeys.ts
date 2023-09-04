import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { useState } from "react";
import { modifySearchParams } from "./select-navigate";

export const FORM_KEY = "_f";
export const FORM_SPL = "-"

export const ALL_FORM_KEYS = [{accessKey: "Número de Processo", dontSuggest: true},{accessKey: "ECLI", dontSuggest: true},{accessKey:"Jurisprudência"},{accessKey:"Área"},{accessKey:"Secção"},{accessKey: "Relator Nome Profissional", showKey: "Relator"},{accessKey: "Meio Processual"},{accessKey:"Decisão"},{accessKey:"Votação"},{accessKey:"Tribunal de Recurso"},{accessKey:"Descritores"},{accessKey:"Fonte"},{accessKey:"Área Temática"},{accessKey:"Jurisprudência Estrangeira"},{accessKey:"Jurisprudência Internacional"},{accessKey:"Doutrina"},{accessKey:"Jurisprudência Nacional"},{accessKey:"Legislação Comunitária"},{accessKey:"Legislação Estrangeira"},{accessKey:"Legislação Nacional"},{accessKey:"Referências Internacionais"},{accessKey:"Referência de publicação"},{accessKey:"Indicações Eventuais"}];

export function defaultKeys(){
    // In case we want a different set of default keys
    return ALL_FORM_KEYS.filter(() => true).map((_v,i) => i);
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