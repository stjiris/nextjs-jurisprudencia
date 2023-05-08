import { JurisprudenciaDocument } from "@/core/jurisprudencia";
import { DatalistObj } from "@/types/search";
import Link from "next/link";
import { ReadonlyURLSearchParams, useRouter, useSearchParams } from "next/navigation"
import { ChangeEvent, ChangeEventHandler, useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import { replaceSearchParams } from "./select-navigate";

export default function SearchForm({count, filtersUsed, minAno, maxAno}:{count: number, filtersUsed: Record<string, string[]>, minAno: number, maxAno: number}) {
    const form = useRef<HTMLFormElement>(null);
    useEffect(() => {
        const element = form.current;
        const handleSubmit = () => {
            if( element?.checkValidity() ){
                element?.submit();
            }
            else{
                element?.reportValidity();
            }
        }
        element?.addEventListener("change", handleSubmit);
        return () => {
            element?.removeEventListener("change", handleSubmit)
        }
    }, [form])

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
                        <label htmlFor="data_fim" className="input-group-text rounded-0 p-1">De:</label>
                    </div>
                    <input id="data_fim" type="number" className="form-control form-control-sm rounded-0 p-1" name="MaxAno" min={minAno} max={maxAno} defaultValue={search.get("MaxAno") || ""} step={1} placeholder={`${maxAno}`}/>
                </div>
            </div>
            <FilterList filtersUsed={filtersUsed} accessKey="Número de Processo" suggest={false}/>
            <FilterList filtersUsed={filtersUsed} accessKey="ECLI" suggest={false}/>
            <FilterList filtersUsed={filtersUsed} accessKey="Jurisprudência"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Área"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Secção"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Relator Nome Profissional" showKey="Relator"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Meio Processual"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Decisão"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Decisão (textual)"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Votação - Decisão"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Votação - Vencidos"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Votação - Declarações"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Tribunal de Recurso"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Descritores"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Fonte"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Área Temática"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Jurisprudência Estrangeira"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Jurisprudência Internacional"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Doutrina"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Jurisprudência Nacional"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Legislação Comunitária"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Legislação Estrangeira"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Legislação Nacional"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Referências Internacionais"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Referência de publicação"/>
            <FilterList filtersUsed={filtersUsed} accessKey="Indicações Eventuais"/>
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

function InvertFilter({accessKey, currValue}: {accessKey: string, currValue: string}){
    const router = useRouter();
    const searchParams = useSearchParams();

    const isNeg = currValue.startsWith("not:");
    const newValue = isNeg ? currValue.replace(/^not:/,"") : `not:${currValue}`;

    return <div role="button" onClick={() => router.push(`?${replaceSearchParams(searchParams, accessKey, newValue, currValue).toString()}`)}>
        <i className={`mx-1 bi bi-dash-circle${isNeg?"-fill":""}`}></i>
        <i className={`me-1 bi bi-plus-circle${!isNeg?"-fill":""}`}></i>
    </div>
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

function FilterList({filtersUsed, accessKey, suggest, showKey}: {filtersUsed: Record<string, string[]>, accessKey: keyof JurisprudenciaDocument | string, suggest?: boolean, showKey?: string}){
    const datalistId = `datalist-${encodeURIComponent(accessKey)}`
    const searchParams = useSearchParams();
    const [datalist, setDatalist] = useState<DatalistObj[]>([]);

    return <div className="d-flex flex-column my-1 border pb-1">
        <datalist id={datalistId}>
            {datalist.map(({key, count}, i) => <option key={i} value={`"${key}"`} label={count ? `Quantidade: ${count}` : ""}/>)}
        </datalist>
        <input type="text" className="form-control form-control-sm border-0 border-bottom rounded-0" name={accessKey} autoComplete="off" list={datalistId} placeholder={showKey || accessKey} onFocus={() => datalist.length == 0 ? loadDatalist(accessKey, searchParams, setDatalist) : null}/>
        <UsedFilters filtersUsed={filtersUsed} accessKey={accessKey}/>
    </div>
}

async function loadDatalist(accessKey: string, searchParams: ReadonlyURLSearchParams, setDatalist: Dispatch<SetStateAction<DatalistObj[]>>){
    return fetch(`./api/datalist?agg=${encodeURIComponent(accessKey)}&${searchParams.toString()}`)
        .then( r => r.json() )
        .catch( e => {
            console.log(e)
            return []
        })
        .then(setDatalist)
}