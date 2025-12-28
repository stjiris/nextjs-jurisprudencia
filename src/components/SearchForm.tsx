import { DatalistObj } from "@/types/search";
import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context";
import Link from "next/link";
import { ReadonlyURLSearchParams, useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { NextRouter, useRouter } from "next/router";
import { Dispatch, DragEventHandler, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FORM_KEY, useFormOrderedKeys } from "./formKeys";
import { replaceSearchParams } from "./SelectNavigate";
import { useKeysFromContext } from "@/contexts/keys";
import { SwapableFilterList, UsedFilters } from "./SwapableFilterList";

function submit(form: HTMLFormElement, router: AppRouterInstance){
    const fd = new FormData(form);
    const searchParams = new URLSearchParams();
    for( let key of fd.keys() ){
        let values = fd.getAll(key).filter(v => v.length > 0);
        searchParams.delete(key);
        for( let v of values ){
            searchParams.append(key, v as string)
        }
    }
    let keysOrder = new URLSearchParams(window.location.search).get(FORM_KEY);
    if(keysOrder){
        searchParams.set(FORM_KEY, keysOrder);
    }
    router.push(`?${searchParams.toString()}`);
}


function isoDateOnly(value?: string | null): string {
  if (!value) return "";
  return value.length >= 10 ? value.slice(0, 10) : value;
}


export default function SearchForm({count, filtersUsed}:{count: number, filtersUsed: Record<string, string[]>}) {
    const form = useRef<HTMLFormElement>(null);
    const router = useNavRouter();

    // Isto é uma logica de macabra que não vou desifrar, foi feito pelo Salvador
    // Não vou mexer porque parece estar a funcionar
    const dataInicio = useRef<HTMLInputElement>(null);
    const dataFim = useRef<HTMLInputElement>(null);
    
    let resetDatas = useCallback(() => {
        if( dataInicio.current )
            dataInicio.current.value = ""
        if( dataFim.current )
            dataFim.current.value = ""
    },[dataFim, dataInicio])

    useEffect(() => {
        const element = form.current;
        const handleSubmit = () => {
            if( element?.checkValidity() ){
                submit(element, router);
                let valueDataInicio = dataInicio.current?.value;
                let valueDataFim = dataFim.current?.value;
                form.current?.reset();
                if(dataInicio.current && valueDataInicio)
                    dataInicio.current.value = valueDataInicio
                if(dataFim.current && valueDataFim)
                    dataFim.current.value = valueDataFim
            }
            else{
                element?.reportValidity();
            }
        }
        element?.addEventListener("change", handleSubmit);
        return () => {
            element?.removeEventListener("change", handleSubmit)
        }
    }, [form, router])

    function _validateDate() {
        const startVal = dataInicio.current?.value || "";
        const endVal = dataFim.current?.value || "";

        if (dataFim.current && 'setCustomValidity' in dataFim.current) {
            (dataFim.current as HTMLInputElement).setCustomValidity("");
        }

        if (startVal && endVal && startVal > endVal) {
            if (dataFim.current && 'setCustomValidity' in dataFim.current) {
                (dataFim.current as HTMLInputElement).setCustomValidity("Data final deve ser igual ou posterior à data inicial");
            }
            return false;
        }
        return true;
    }

    const search = useSearchParams();
    const term = search.get("term");
    const group = search.get("group");
    const keys = useKeysFromContext();

    const minDate = search.get("MinDate");
    const maxDate = search.get("MaxDate");

    return <form ref={form} method="get" style={{top: 0}} className="position-sticky">
        {term ? <input type="text" name="term" hidden value={term} readOnly/> : ""}
        {group ? <input type="text" name="group" hidden value={group} readOnly/> : ""}
        <div className="d-block">
            <div className="d-flex align-items-center justify-content-between">
                <b className="d-inline m-0">
                    <i className="bi-archive"></i> {count} Processos
                </b>
                {Object.keys(filtersUsed).length > 0 ? 
                    <Link
                        className="text-danger text-decoration-none"
                        href={"?"+[term ? `term=${encodeURIComponent(term)}`: "", group ? `group=${encodeURIComponent(group)}`: ""].filter(s => s.length > 0).join("&")}
                        onClick={resetDatas}>
                            <i className="bi bi-eraser-fill"></i> Limpar
                        </Link>
                : ""}
            </div>
            <div className="d-flex my-1 pb-1 align-items-baseline">
                <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
                <input type="search" className="form-control form-control-sm rounded-0" name="q" placeholder="Texto Livre" defaultValue={""}/>
            </div>
            
            <div className="d-flex my-1 pb-1 align-items-baseline">
                <small className="pe-1 text-white"><i className="bi bi-calendar3"></i></small>
                <div className="input-group input-group-sm">
                    <div className="input-group-prepend">
                        <label htmlFor="data_inicio" className="input-group-text rounded-0 p-1" style={{minWidth: '50px'}}>
                            De:
                        </label>
                    </div>
                    <input
                        id="data_inicio"
                        type="date"
                        name="MinDate"
                        className="form-control"
                        max={maxDate || undefined}
                        defaultValue={minDate || ""}
                        ref={dataInicio as React.RefObject<HTMLInputElement>}
                        onChange={() => { _validateDate(); }}
                    />
                </div>
            </div>

            <div className="d-flex my-1 pb-1 align-items-baseline">
                <small className="pe-1 text-white"><i className="bi bi-calendar3"></i></small>
                <div className="input-group input-group-sm">
                    <div className="input-group-prepend">
                        <label htmlFor="data_fim" className="input-group-text rounded-0 p-1" style={{minWidth: '50px'}}>
                            Até:
                        </label>
                    </div>
                    <input
                        id="data_fim"
                        type="date"
                        name="MaxDate"
                        className="form-control"
                        min={minDate || undefined}
                        defaultValue={maxDate || ""}
                        ref={dataFim as React.RefObject<HTMLInputElement>}
                        onChange={() => { _validateDate(); }}
                    />
                </div>
            </div>

            <div className="d-flex align-items-baseline">
                <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
                <div className="my-1 pb-1 align-items-baseline form-check">
                    <input id="checkbox-has-text" type="checkbox" className="form-check-input" name="mustHaveText" value="true" defaultChecked={search.has("mustHaveText")}/>
                    <label className="form-check-label" htmlFor="checkbox-has-text">Tem de ter {keys?.records?.Texto?.name}</label>
                </div>
            </div>
            {"hasField" in filtersUsed ? <div className="d-flex align-items-baseline">
                <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
                <div className="d-flex w-100 flex-column my-1 border pb-1">
                    <input type="text" className="form-control form-control-sm border-0 border-bottom rounded-0" name="hasField" autoComplete="off" list="datalist-Campos" placeholder="Tem de ter o campo"/>
                    <UsedFilters filtersUsed={filtersUsed} accessKey="hasField" />
                </div>
            </div> : ""}
            {"notHasField" in filtersUsed ? <div className="d-flex align-items-baseline">
                <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
                <div className="d-flex w-100 flex-column my-1 border pb-1">
                    <input type="text" className="form-control form-control-sm border-0 border-bottom rounded-0" name="notHasField" autoComplete="off" list="datalist-Campos" placeholder="Não pode ter o campo"/>
                    <UsedFilters filtersUsed={filtersUsed} accessKey="notHasField" />
                </div>
            </div> : ""}
            <SwapableFilterList filtersUsed={filtersUsed}/>
        </div>
    </form>
}

