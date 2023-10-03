import { DatalistObj } from "@/types/search";
import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context";
import Link from "next/link";
import { ReadonlyURLSearchParams, useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { NextRouter, useRouter } from "next/router";
import { Dispatch, DragEventHandler, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FORM_KEY, useFormOrderedKeys } from "./formKeys";
import { replaceSearchParams } from "./select-navigate";
import { useKeysFromContext } from "@/contexts/keys";

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

export default function SearchForm({count, filtersUsed, minAno, maxAno}:{count: number, filtersUsed: Record<string, string[]>, minAno: number, maxAno: number}) {
    const form = useRef<HTMLFormElement>(null);
    const dataInicio = useRef<HTMLInputElement>(null);
    const dataFim = useRef<HTMLInputElement>(null);
    const router = useNavRouter();
    let resetDatas = useCallback(() => {
        if( dataInicio.current ) dataInicio.current.value = ""
        if( dataFim.current ) dataFim.current.value = ""
    },[dataFim, dataInicio])
    useEffect(() => {
        const element = form.current;
        const handleSubmit = () => {
            if( element?.checkValidity() ){
                submit(element, router);
                let valueDataInicio = dataInicio.current?.value;
                let valueDataFim = dataFim.current?.value;
                form.current?.reset();
                if(dataInicio.current && valueDataInicio) dataInicio.current.value = valueDataInicio
                if(dataFim.current && valueDataFim) dataFim.current.value = valueDataFim
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

    const search = useSearchParams();
    const q = search.get("q");
    const term = search.get("term");
    const group = search.get("group");
    const keys = useKeysFromContext();

    return <form ref={form} method="get" style={{top: 0}} className="position-sticky">
        {term ? <input type="text" name="term" hidden value={term} readOnly/> : ""}
        {group ? <input type="text" name="group" hidden value={group} readOnly/> : ""}
        <div className="d-block">
            <div className="d-flex align-items-center justify-content-between">
                <b className="d-inline m-0">
                    <i className="bi-archive"></i> {count} Processos
                </b>
                {Object.keys(filtersUsed).length > 0 || q ? 
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
                <input type="search" className="form-control form-control-sm rounded-0" name="q" placeholder="Texto Livre" defaultValue={q || ""}/>
            </div>
            <div className="d-flex my-1 pb-1 align-items-baseline">
                <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
                <div className="input-group input-group-sm">
                    <div className="input-group-prepend flex-shrink">
                        <label htmlFor="data_inicio" className="input-group-text rounded-0 p-1">De:</label>
                    </div>
                    <input id="data_inicio" type="number" className="form-control form-control-sm rounded-0 p-1" name="MinAno" min={minAno} max={maxAno} defaultValue={search.get("MinAno") || ""} step={1} placeholder={`${minAno}`} ref={dataInicio}/>
                </div>
                <div className="input-group input-group-sm">
                    <div className="input-group-prepend flex-shrink">
                        <label htmlFor="data_fim" className="input-group-text rounded-0 p-1">Até:</label>
                    </div>
                    <input id="data_fim" type="number" className="form-control form-control-sm rounded-0 p-1" name="MaxAno" min={minAno} max={maxAno} defaultValue={search.get("MaxAno") || ""} step={1} placeholder={`${maxAno}`} ref={dataFim}/>
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

function SwapableFilterList({filtersUsed}: {filtersUsed: Record<string, string[]>} ){

    let [sort, {move, all, hide}, rest] = useFormOrderedKeys();
    let [target, setTarget] = useState<number>();
    let [selected, setSelected] = useState<number>();

    let dragEnd: DragEventHandler<HTMLDivElement> = (e) => {
        // Own element
        if( selected === undefined || target === undefined ) return;

        if( selected === -1 ){ 
            hide(target);
            setSelected(undefined)
            setTarget(undefined)
        };
        if( selected >= 0 ){
            move(target, selected)
            setSelected(undefined)
            setTarget(selected)
            setTimeout( () => setTarget(undefined), 1800 )
        }
    }

    let dragStart: DragEventHandler<HTMLDivElement> = (e) => {
        // Own element
        setTarget(parseInt(e.currentTarget.dataset.key!))
    };
    let dragOver: DragEventHandler<HTMLElement> = (e) => {
        // Target
        setSelected(parseInt(e.currentTarget.dataset.key!));
    }

    return <div data-key="-2" className="border-top">
        <div className="d-flex my-1 pb-1 align-items-baseline">
            <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
            <label role="button" className={"bg-white flex-grow border-0 " + (target !== undefined && selected !== undefined || rest!==0 ? "": "text-muted")} onDragOver={dragOver} onClick={(e) => {e.preventDefault(); rest!==0 ? all() : null;}} data-key="-1"><i className="bi bi-eye"></i> Esconder / Repor ({rest})</label>
        </div>
        {sort.map((k,i) => k && <div data-key={i} key={i} draggable onDragOver={dragOver} onDragStart={dragStart} onDragEnd={dragEnd} className={"d-flex align-items-baseline " +( selected === i || target === i ? "shadow" : "")}>
            <small className={`pe-1 ${target!==i ? "text-muted" : ""} cursor-move`} style={{cursor: "move"}}><i className="bi bi-list"></i></small>
            <FilterList filtersUsed={filtersUsed} accessKey={k.key} showKey={k.name} dontSuggest={!k.filtersSuggest}/>
        </div>)}
    </div>
}

function InvertFilter({accessKey, currValue}: {accessKey: string, currValue: string}){
    const searchParams = useSearchParams();

    const isNeg = currValue.startsWith("not:");
    const newValue = isNeg ? currValue.replace(/^not:/,"") : `not:${currValue}`;

    return <Link className="text-body" href={`?${replaceSearchParams(searchParams, accessKey, newValue, currValue)}`}>
        <i className={`mx-1 bi bi-dash-circle${isNeg?"-fill":""}`}></i>
        <i className={`me-1 bi bi-plus-circle${!isNeg?"-fill":""}`}></i>
    </Link>
}

function UsedFilters({filtersUsed, accessKey}: {filtersUsed: Record<string, string[]>, accessKey: string}){
    let cache = [];
    let comps = [];
    if( accessKey in filtersUsed ){
        for(let [i, value] of filtersUsed[accessKey].entries()){
            if( cache.indexOf(value) == -1){
                cache.push(value);
                const id = `checkbox-${encodeURIComponent(value)}`
                
                

                comps.push(<div key={i} className="p-1 m-0 d-flex align-items-center" style={{background: "var(--secondary-gold)", borderBottom: "1px solid var(--primary-gold)"}}>
                    <input type="checkbox" className="form-check-input" name={accessKey} value={value} id={id} hidden defaultChecked={true}/>
                    <InvertFilter currValue={value} accessKey={accessKey}/>
                    <span className="d-block flex-grow-1 mx-1">{value.replace(/^not:/, "")}</span>
                    <label role="button" htmlFor={id} className="form-check-label d-flex justify-content-between align-items-center">
                        <span className="d-block text-danger"><i className="bi bi-trash"></i></span>
                    </label>
                </div>)
            }
        }
    }
    return <>{comps}</>;
}

function FilterList({filtersUsed, accessKey, dontSuggest, showKey}: {filtersUsed: Record<string, string[]>, accessKey: keyof JurisprudenciaDocument | string, dontSuggest?: boolean, showKey?: string}){
    const datalistId = `datalist-${encodeURIComponent(accessKey)}`
    const searchParams = useSearchParams();
    const router = useRouter()
    const [datalist, setDatalist] = useState<DatalistObj[]>([]);

    return <div className="d-flex flex-column my-1 border pb-1 flex-grow-1">
        <datalist id={datalistId}>
            {datalist.map(({key, count}, i) => <option key={i} value={`"${key}"`} label={count ? `Quantidade: ${count}` : ""}/>)}
        </datalist>
        <input type="text" className="form-control form-control-sm border-0 border-bottom rounded-0" name={accessKey} autoComplete="off" list={datalistId} placeholder={showKey || accessKey} onFocus={() => !dontSuggest && datalist.length == 0 ? loadDatalist(router, accessKey, searchParams, setDatalist) : null}/>
        <UsedFilters filtersUsed={filtersUsed} accessKey={accessKey}/>
    </div>
}

async function loadDatalist(router: NextRouter, accessKey: string, searchParams: ReadonlyURLSearchParams, setDatalist: Dispatch<SetStateAction<DatalistObj[]>>){
    return fetch(`${router.basePath}/api/datalist?agg=${encodeURIComponent(accessKey)}&${searchParams.toString()}`)
        .then( r => r.json() )
        .catch( e => {
            console.log(e)
            return []
        })
        .then(setDatalist)
}