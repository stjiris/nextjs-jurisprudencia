import { DatalistObj } from "@/types/search";
import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context";
import Link from "next/link";
import { ReadonlyURLSearchParams, useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { NextRouter, useRouter } from "next/router";
import { Dispatch, DragEventHandler, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { useFormOrderedKeys } from "./formKeys";
import { replaceSearchParams } from "./select-navigate";

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
    router.push(`?${searchParams.toString()}`);
}

export default function SearchForm({count, filtersUsed, minAno, maxAno}:{count: number, filtersUsed: Record<string, string[]>, minAno: number, maxAno: number}) {
    const form = useRef<HTMLFormElement>(null);
    const router = useNavRouter();
    useEffect(() => {
        const element = form.current;
        const handleSubmit = () => {
            if( element?.checkValidity() ){
                submit(element, router);
                form.current?.reset();
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
                        href={"?"+[term ? `term=${encodeURIComponent(term)}`: "", group ? `group=${encodeURIComponent(group)}`: ""].filter(s => s.length > 0).join("&")}>
                            <i className="bi bi-eraser-fill"></i> Limpar
                        </Link>
                : ""}
            </div>
            <div className="d-flex flex-column my-1">
                <input type="search" className="form-control form-control-sm rounded-0" name="q" placeholder="Texto Livre" defaultValue={q || ""}/>
            </div>
            <div className="d-flex my-1">
                <div className="input-group input-group-sm">
                    <div className="input-group-prepend flex-shrink">
                        <label htmlFor="data_inicio" className="input-group-text rounded-0 p-1">De:</label>
                    </div>
                    <input id="data_inicio" type="number" className="form-control form-control-sm rounded-0 p-1" name="MinAno" min={minAno} max={maxAno} defaultValue={search.get("MinAno") || ""} step={1} placeholder={`${minAno}`}/>
                </div>
                <div className="input-group input-group-sm">
                    <div className="input-group-prepend flex-shrink">
                        <label htmlFor="data_fim" className="input-group-text rounded-0 p-1">Até:</label>
                    </div>
                    <input id="data_fim" type="number" className="form-control form-control-sm rounded-0 p-1" name="MaxAno" min={minAno} max={maxAno} defaultValue={search.get("MaxAno") || ""} step={1} placeholder={`${maxAno}`}/>
                </div>
            </div>
            <FilterList filtersUsed={filtersUsed} accessKey="Número de Processo" dontSuggest/>
            <FilterList filtersUsed={filtersUsed} accessKey="ECLI" dontSuggest/>
            {/* TODO: allow user to swipe */}
            <SwapableFilterList filtersUsed={filtersUsed}/>
            {"hasField" in filtersUsed ? <div className="d-flex flex-column my-1 border pb-1">
                <input type="text" className="form-control form-control-sm border-0 border-bottom rounded-0" name="hasField" autoComplete="off" list="datalist-Campos" placeholder="Tem de ter o campo"/>
                <UsedFilters filtersUsed={filtersUsed} accessKey="hasField" />
            </div> : ""}
            {"notHasField" in filtersUsed ? <div className="d-flex flex-column my-1 border pb-1">
                <input type="text" className="form-control form-control-sm border-0 border-bottom rounded-0" name="notHasField" autoComplete="off" list="datalist-Campos" placeholder="Tem de ter o campo"/>
                <UsedFilters filtersUsed={filtersUsed} accessKey="notHasField" />
            </div> : ""}
        </div>
    </form>
}

function SwapableFilterList({filtersUsed}: {filtersUsed: Record<string, string[]>} ){

    let [sort, swipe] = useFormOrderedKeys();
    let [target, setTarget] = useState<number>();
    let [selected, setSelected] = useState<number>();
    

    let parentRef = useRef<HTMLDivElement>(null);

    let dragEnd: DragEventHandler<HTMLDivElement> = (e) => {
        let elems = parentRef.current?.querySelectorAll("[data-key]");
        if( !elems ) return;
        let mouseY = e.clientY;
        let swap = null;
        for(let i = 0; i < elems?.length; i++){
            let {y, height} = elems[i].getClientRects()[0]
            if( mouseY > y && mouseY < y+height ){
                swap = i;
            }
        }
        if( swap === null ) return;

        let newIndForCurrent = swap;
        let newIndForOther = parseInt(e.currentTarget.dataset.key!);
        console.log(newIndForCurrent, newIndForOther)
        swipe(newIndForCurrent, newIndForOther);
        setSelected(undefined)
        setTarget(undefined)
    }

    let dragStart: DragEventHandler<HTMLDivElement> = (e) => {
        setTarget(parseInt(e.currentTarget.dataset.key!))
    }

    let dragOver: DragEventHandler<HTMLDivElement> = (e) => {
        setSelected(parseInt(e.currentTarget.dataset.key!));
    }

    return <div ref={parentRef}>
        {sort.map((k,i) => <div data-key={i} key={i} draggable onDragOver={dragOver} onDragStart={dragStart} onDragEnd={dragEnd}  className="d-flex align-items-baseline">
            <small className={`pe-1 ${target!==i ? "text-muted" : ""} cursor-move`} style={{cursor: "move"}}><i className={target===i || selected === i ? "bi bi-circle-fill" : "bi bi-circle"}></i></small>
            <FilterList filtersUsed={filtersUsed} accessKey={k.accessKey} showKey={k.showKey}/>
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