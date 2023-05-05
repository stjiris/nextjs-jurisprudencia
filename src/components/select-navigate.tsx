import { ReadonlyURLSearchParams, useRouter, useSearchParams } from "next/navigation";
import { SelectHTMLAttributes } from "react";


export function SelectNavigate({valueToHref,...selectProps}: {valueToHref: (value: string, params: ReadonlyURLSearchParams) => string} & SelectHTMLAttributes<HTMLSelectElement> ){
    const router = useRouter();
    const searchparams = useSearchParams();

    return <select onChange={(evt) => router.push(valueToHref(evt.target.value, searchparams))} {...selectProps}>
        {selectProps.children}
    </select>
}

export function modifySearchParams(searchParams: URLSearchParams, key: string, value: string){
    const newParams = new URLSearchParams(searchParams);
    newParams.set(key, value);
    return newParams;
}

export function addSearchParams(searchParams: URLSearchParams, key: string, value: string){
    const newParams = new URLSearchParams(searchParams);
    newParams.append(key, value);
    return newParams;
}