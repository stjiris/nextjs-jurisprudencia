import { Dispatch, DragEventHandler, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { DatalistObj } from "@/types/search";
import { NextRouter, useRouter } from "next/router";
import { useKeysFromContext } from "@/contexts/keys";
import { modifySearchParams, replaceSearchParams } from "./SelectNavigate";

export const FORM_KEY = "_f";

const FORM_SPL = "-"

export function useFormOrderedKeys() {
    let params = useSearchParams();
    let router = useRouter();
    let { keys: allKeys } = useKeysFromContext();
    let availableKeys = useMemo(() => allKeys?.map(k => k.active ? k : null), [allKeys])
    let defaultKeys = useMemo(() => allKeys?.map(k => k.filtersShow ? k : null), [allKeys])

    let [sort, _setSort] = useState<number[]>([]);
    const [previousSort, setPreviousSort] = useState<number[]>([]);

    useEffect(() => {
        const baseSort: number[] = params.get(FORM_KEY)?.split(FORM_SPL).map(i => parseInt(i.trim())) || defaultKeys?.map((k, i) => k ? i : null).filter(i => i !== null) as number[] || [];
        const sortSet = new Set(baseSort);
        const extra: number[] = [];
        availableKeys?.forEach((k, i) => {
            if (k && !sortSet.has(i) && params.has(k.key)) {
                extra.push(i);
            }
        });
        _setSort([...extra, ...baseSort]);
    }, [params, defaultKeys, availableKeys])

    let setSort = (cb: ((arg: number[]) => number[])) => {
        _setSort(curr => {
            let updated = cb(curr)
            router.replace("?" + modifySearchParams(params, FORM_KEY, updated.join(FORM_SPL)).toString(), undefined, { scroll: false, shallow: true })
            return updated;
        })
    }

    const move = (currPos: number, insAfter: number) => {
        if (currPos === insAfter) return;
        return setSort((currSort) => {
            let firstHalf = currSort.slice(0, currPos);
            let secondHalf = currSort.slice(currPos + 1);
            let final = firstHalf.concat(secondHalf);
            final.splice(insAfter, 0, currSort[currPos]);
            return final;
        })
    }

    const hide = (currPos: number) => {
        return setSort((currSort) => currSort.slice(0, currPos).concat(currSort.slice(currPos + 1)));
    }

    const all = () => {
        setSort((currSort) => {
            const hiddenItems = availableKeys?.map((v, i) => v !== null ? i : -1)
                .filter((i) => i >= 0 && !currSort.includes(i)) || [];
            
            if (hiddenItems.length === 0 && previousSort.length > 0) {
                const restored = previousSort;
                setPreviousSort([]);
                return restored;
            } else {
                setPreviousSort(currSort);
                return [...hiddenItems, ...currSort];
            }
        });
    }
    if (!availableKeys || availableKeys.length === 0) return [[], { move, hide, all }, 0] as const; // Server return

    return [sort.map((i) => availableKeys![i]), { move, hide, all }, (availableKeys.filter(k => k !== null).length || 0) - sort.filter((i) => availableKeys![i]).length] as const;
}

export function SwapableFilterList({filtersUsed}: {filtersUsed: Record<string, string[]>} ){

    let [sort, {move, all, hide}, rest] = useFormOrderedKeys();
    let [target, setTarget] = useState<number>();
    let [selected, setSelected] = useState<number>();

    let dragEnd: DragEventHandler<HTMLDivElement> = (e) => {
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
        setTarget(parseInt(e.currentTarget.dataset.key!))
    };
    let dragOver: DragEventHandler<HTMLElement> = (e) => {
        setSelected(parseInt(e.currentTarget.dataset.key!));
    }

    return <div data-key="-2" className="border-top">
        <div className="d-flex my-1 pb-1 align-items-baseline">
            <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
            <a role="button" className={"bg-white flex-grow border-0 text-dark " + (target !== undefined && selected !== undefined || rest!==0 ? "": "text-muted")} onDragOver={dragOver} onClick={(e) => {e.preventDefault(); all();}} data-key="-1"><i className="bi bi-eye"></i> Esconder / Repor ({rest})</a>
        </div>
        {sort.map((k,i) => k && <div data-key={i} key={i} draggable onDragOver={dragOver} onDragStart={dragStart} onDragEnd={dragEnd} className={"d-flex align-items-baseline " +( selected === i || target === i ? "shadow" : "")}>
            <small className={`pe-1 ${target!==i ? "text-muted" : ""} cursor-move`} style={{cursor: "move"}}><i className="bi bi-list"></i></small>
            <FilterList filtersUsed={filtersUsed} accessKey={k.key} showKey={k.name} dontSuggest={!k.filtersSuggest}/>
        </div>)}
    </div>
}

function InvertFilter({accessKey, currValue}: {accessKey: string, currValue: string}){
    const searchParams = useSearchParams();
    const bare = currValue.replace(/^or:/, "");
    const isNeg = bare.startsWith("not:");
    const newValue = isNeg ? bare.replace(/^not:/, "") : `not:${bare}`;
    return <Link className="text-body" href={`?${replaceSearchParams(searchParams, accessKey, newValue, currValue)}`}>
        <i className={`mx-1 bi bi-dash-circle${isNeg?"-fill":""}`}></i>
        <i className={`me-1 bi bi-plus-circle${!isNeg?"-fill":""}`}></i>
    </Link>
}

function OrToggle({accessKey, currValue}: {accessKey: string, currValue: string}){
    const searchParams = useSearchParams();
    const isOr = currValue.startsWith("or:");
    const bare = currValue.replace(/^(not:|or:)/, "");
    const newValue = isOr ? bare : `or:${bare}`;
    return <Link className="text-decoration-none me-1" href={`?${replaceSearchParams(searchParams, accessKey, newValue, currValue)}`} title="OU — pelo menos um destes termos">
        <small className={isOr ? "text-primary fw-bold" : "text-muted"}>∨</small>
    </Link>
}

function EditableFilterTag({accessKey, value}: {accessKey: string, value: string}){
    const searchParams = useSearchParams();
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const displayValue = value.replace(/^(not:|or:)/, "");
    const prefix = value.startsWith("not:") ? "not:" : value.startsWith("or:") ? "or:" : "";

    const startEdit = () => {
        setDraft(displayValue);
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
    };

    const confirm = () => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== displayValue) {
            const newValue = prefix + trimmed;
            router.replace("?" + replaceSearchParams(searchParams, accessKey, newValue, value).toString(), undefined, { scroll: false, shallow: true });
        }
        setEditing(false);
    };

    const id = `checkbox-${encodeURIComponent(value)}`;

    return <div className="p-1 m-0 d-flex align-items-center" style={{background: "var(--secondary-gold)", borderBottom: "1px solid var(--primary-gold)"}}>
        <input type="checkbox" className="form-check-input" name={accessKey} value={value} id={id} hidden defaultChecked={true}/>
        <InvertFilter currValue={value} accessKey={accessKey}/>
        <OrToggle currValue={value} accessKey={accessKey}/>
        {editing
            ? <input
                ref={inputRef}
                className="form-control form-control-sm border-0 flex-grow-1 mx-1 py-0 px-1"
                style={{background: "transparent", minWidth: 0}}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={confirm}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); confirm(); } if (e.key === "Escape") setEditing(false); }}
                autoFocus
              />
            : <span role="button" className="d-block flex-grow-1 mx-1" title="Clique para editar" onClick={startEdit}>{displayValue}</span>
        }
        <label role="button" htmlFor={id} className="form-check-label d-flex justify-content-between align-items-center">
            <span className="d-block text-danger"><i className="bi bi-trash"></i></span>
        </label>
    </div>;
}

export function UsedFilters({filtersUsed, accessKey}: {filtersUsed: Record<string, string[]>, accessKey: string}){
    let cache = [];
    let comps = [];
    if( accessKey in filtersUsed ){
        for(let [i, value] of filtersUsed[accessKey].entries()){
            if( cache.indexOf(value) == -1){
                cache.push(value);
                comps.push(<EditableFilterTag key={i} accessKey={accessKey} value={value}/>)
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
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleFocus = () => {
        if (dontSuggest || datalist.length > 0) return;
        loadDatalist(router, accessKey, searchParams, "", setDatalist);
    };

    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
        if (dontSuggest) return;
        const value = e.currentTarget.value;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            loadDatalist(router, accessKey, searchParams, value, setDatalist);
        }, 200);
    };

    return <div className="d-flex flex-column my-1 border pb-1 flex-grow-1">
        <datalist id={datalistId}>
            {datalist.map(({key, count}, i) => <option key={i} value={`"${key}"`} label={count ? `Quantidade: ${count}` : ""}/>)}
        </datalist>
        <input type="text" className="form-control form-control-sm border-0 border-bottom rounded-0" name={accessKey} autoComplete="off" list={datalistId} placeholder={showKey || accessKey} onFocus={handleFocus} onInput={handleInput}/>
        <UsedFilters filtersUsed={filtersUsed} accessKey={accessKey}/>
    </div>
}

async function loadDatalist(router: NextRouter, accessKey: string, searchParams: ReadonlyURLSearchParams, prefix: string, setDatalist: Dispatch<SetStateAction<DatalistObj[]>>){
    return fetch(`${router.basePath}/api/datalist?agg=${encodeURIComponent(accessKey)}&prefix=${encodeURIComponent(prefix)}&${searchParams.toString()}`)
        .then( r => r.json() )
        .catch( e => {
            console.log(e)
            return []
        })
        .then(setDatalist)
}