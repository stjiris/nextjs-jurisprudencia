import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { modifySearchParams } from "./select-navigate";
import { useFetch } from "./useFetch";
import { JurisprudenciaKey } from "@/types/keys";
import { useKeysFromContext } from "@/contexts/keys";

export const FORM_KEY = "_f";
export const FORM_SPL = "-"

export function useKeys(deps: any[]=[]){
    return useFetch<JurisprudenciaKey[]>("/api/keys", deps);
}

export function useFormOrderedKeys(){
    let params = useSearchParams();
    let router = useRouter();
    let {keys: allKeys} = useKeysFromContext();
    let availableKeys = useMemo(() => allKeys?.map(k => k.active ? k : null), [allKeys])
    let defaultKeys = useMemo(() => allKeys?.map(k => k.filtersShow ? k : null), [allKeys])

    let [sort, _setSort] = useState<number[]>([]);

    useEffect(() => {
        _setSort(params.get(FORM_KEY)?.split(FORM_SPL).map(i => parseInt(i.trim())) ||  defaultKeys?.map((k,i) => k ? i : null).filter(i => i!==null) as number[] || [])
    }, [params, defaultKeys])

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
        return setSort((currSort) => [...availableKeys?.map((v, i) => v !== null ? i : -1).filter((i) => i >= 0  && !currSort.includes(i)) || []].concat(currSort))
    }
    if( !availableKeys || availableKeys.length === 0 ) return [[], {move, hide, all}, 0] as const; // Server return

    return [sort.map((i) => availableKeys![i] ), {move, hide, all}, (availableKeys.filter(k => k !== null).length || 0) - sort.filter((i) => availableKeys![i] ).length] as const;
}