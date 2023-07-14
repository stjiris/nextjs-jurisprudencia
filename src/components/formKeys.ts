import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { useState } from "react";
import { modifySearchParams } from "./select-navigate";

export const FORM_KEY = "_f";
export const FORM_SPL = "-"

export const FORM_KEYS = [{accessKey:"Jurisprudência"},{accessKey:"Área"},{accessKey:"Secção"},{accessKey: "Relator Nome Profissional", showKey: "Relator"},{accessKey: "Meio Processual"},{accessKey:"Decisão"},{accessKey:"Decisão (textual)"},{accessKey:"Votação - Decisão"},{accessKey:"Votação - Vencidos"},{accessKey:"Votação - Declarações"},{accessKey:"Tribunal de Recurso"},{accessKey:"Descritores"},{accessKey:"Fonte"},{accessKey:"Área Temática"},{accessKey:"Jurisprudência Estrangeira"},{accessKey:"Jurisprudência Internacional"},{accessKey:"Doutrina"},{accessKey:"Jurisprudência Nacional"},{accessKey:"Legislação Comunitária"},{accessKey:"Legislação Estrangeira"},{accessKey:"Legislação Nacional"},{accessKey:"Referências Internacionais"},{accessKey:"Referência de publicação"},{accessKey:"Indicações Eventuais"}];


export function useFormOrderedKeys(){
    let params = useSearchParams();
    let router = useRouter();
    
    let [sort, setSort] = useState<number[]>(() => {
        let _sort = params.get(FORM_KEY)?.split(FORM_SPL).map(i => parseInt(i.trim())).filter(i => i) || [];
        if( _sort?.length !== FORM_KEYS.length ){
            _sort = _sort?.concat([...FORM_KEYS.map((_k,i) => i).filter(i => !_sort?.includes(i))])
        }
        return _sort;
    })
    
    
    return [sort.map((i) => FORM_KEYS[i]), (i1: number,i2: number) => {
        if( i1 === i2 ) return sort;
        setSort((_sort) => {
            let newSrc = _sort.map((actualValue, i) => i === i1 ? _sort[i2] : i === i2 ? _sort[i1] : actualValue )
            router.replace("?"+modifySearchParams(params, FORM_KEY, newSrc.join(FORM_SPL)).toString(), undefined, {scroll: false, shallow: true})
            return newSrc
        })
    }] as const;
}