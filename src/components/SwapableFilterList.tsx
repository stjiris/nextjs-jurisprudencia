import { Dispatch, DragEventHandler, SetStateAction, useState } from "react";
import { useFormOrderedKeys } from "./formKeys";
import { replaceSearchParams } from "./SelectNavigate";
import Link from "next/link";
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { DatalistObj } from "@/types/search";
import { NextRouter, useRouter } from "next/router";

export function SwapableFilterList({filtersUsed}: {filtersUsed: Record<string, string[]>} ){

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
            <a role="button" className={"bg-white flex-grow border-0 text-dark " + (target !== undefined && selected !== undefined || rest!==0 ? "": "text-muted")} onDragOver={dragOver} onClick={(e) => {e.preventDefault(); rest!==0 ? all() : null;}} data-key="-1"><i className="bi bi-eye"></i> Esconder / Repor ({rest})</a>
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

export function UsedFilters({filtersUsed, accessKey}: {filtersUsed: Record<string, string[]>, accessKey: string}){
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