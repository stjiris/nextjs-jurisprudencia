import { ReadonlyURLSearchParams, useRouter, useSearchParams } from "next/navigation";
import { SelectHTMLAttributes } from "react";


export function SelectNavigate({valueToHref,...selectProps}: {valueToHref: (value: string, params: ReadonlyURLSearchParams) => string} & SelectHTMLAttributes<HTMLSelectElement> ){
    const router = useRouter();
    const searchparams = useSearchParams();

    return <select onChange={(evt) => router.push(valueToHref(evt.target.value, searchparams))} {...selectProps}>
        {selectProps.children}
    </select>
}

type ParamsLike = ReadonlyURLSearchParams | URLSearchParams;

function cloneParams(params: ParamsLike) {
  return new URLSearchParams(
    typeof params === "string" ? params : params.toString()
  );
}

export function modifySearchParams(params: ParamsLike, key: string, value: string): ParamsLike {
  const p = cloneParams(params);
  p.set(key, value);
  return p;
}

export function addSearchParams(params: ParamsLike, key: string, value: string): ParamsLike {
  const p = cloneParams(params);
  p.append(key, value);
  return p;
}


export function replaceSearchParams(params: ParamsLike, key: string, newValue: string, oldValue: string): ParamsLike {
    const newParams = cloneParams(params)
    newParams.delete(key);
    for( let value of params.getAll(key) ){
        if( value == oldValue ){
            newParams.append(key, newValue);
        }
        else{
            newParams.append(key, value);
        }
    }
    
    return newParams;
}