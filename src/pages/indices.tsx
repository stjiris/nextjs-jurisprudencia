import { GenericPageWithForm } from "@/components/genericPageStructure";
import { useEffect, useRef, useState } from "react";
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { addSearchParams, modifySearchParams, SelectNavigate } from "@/components/select-navigate";
import Head from "next/head";
import Script from "next/script";
import { FormProps, withForm } from "@/components/pageWithForm";
import { useRouter } from "next/router";
import { IndicesProps, INDICES_OTHERS } from "@/types/indices";
import { Loading, SmallSpinner } from "@/components/loading";
import { useFetch } from "@/components/useFetch";
import { JurisprudenciaKey } from "@/types/keys";
import { useKeysFromContext } from "@/contexts/keys";
import indicesCsvHandler from "./api/indices.csv";
import { LoggerServerSideProps } from "@/core/logger-api";

interface IndicesPageProps extends FormProps {
    term: string
    group: string
    limits: number
}

export const getServerSideProps = withForm<IndicesPageProps>(async (ctx, formProps) => {
    LoggerServerSideProps(ctx);
    const limits = Array.isArray(ctx.query.LIMIT_ROWS) ? parseInt(ctx.query.LIMIT_ROWS[0]) : parseInt(ctx.query.LIMIT_ROWS || "5000") || 5000;
    const term = Array.isArray(ctx.query.term) ? ctx.query.term[0] : ctx.query.term  || "Área";
    let group = "Secção";
    if( "group" in ctx.query ){
        group = Array.isArray(ctx.query.group) ? ctx.query.group[0] : ctx.query.group!;
    }
    
    return {
        ...formProps,
        term,
        group,
        limits
    }
    
});

export default function Indices(props: IndicesPageProps){
    return <GenericPageWithForm escapeChildren={<HistogramModal />} {...props} title="Jurisprudência STJ - Índices">
        <Script src="https://cdn.plot.ly/plotly-2.12.1.min.js" />
        <TermInfo term={props.term}/>
        <IndicesTable {...props}/>
    </GenericPageWithForm>
}

function IndicesTable(props: IndicesPageProps){
    let router = useRouter()
    let searchParams = useSearchParams();
    let state = useFetch<IndicesProps>(`/api/indices?${searchParams.toString()}`,[])

    if( !state ){
        return <Loading />
    }

    let {sortedGroup, termAggregation} = state;
    if( !Array.isArray(termAggregation.buckets) ){
        return <div className="alert alert-danger">Erro: Esperada lista, recebido objeto</div>;
    }
    // Gold no highlight retirar o texto
    return <>
        {(termAggregation.sum_other_doc_count || 0) > 0 && <div className="alert alert-warning" role="alert">
            <h5 className="alert-heading">
                <strong><i className="bi bi-exclamation-circle"></i> Atenção:</strong> 
            </h5>
            <ul>
                <li>Existem {termAggregation.sum_other_doc_count} outros valores não listados.</li>
            </ul>
        </div>}
        <table className="table table-sm" style={{width: "fit-content"}}>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Índice <a href={`${router.basePath}/api/indices.csv?${searchParams.toString()}`} className="ms-1" download="indices.csv"><i className="bi bi-filetype-csv"></i></a><a href={`${router.basePath}/api/indices.xlsx?${searchParams.toString()}`} className="ms-1" download="indices.xlsx"><i className="bi bi-filetype-xlsx"></i></a></th>
                    <th className="text-end-border-end">
                        <SelectGroup group={props.group}/>
                    </th>
                    {sortedGroup.map(([name, count],i) => <td key={i} className="text-end border-end">{name == INDICES_OTHERS || props.group in props.filtersUsed ? name : <Link href={`?${modifySearchParams(new URLSearchParams(searchParams.toString()), props.group, `"${name}"`)}`}>{name}</Link>}</td>)}
                    <th></th>
                    <th className="text-start">Datas</th>
                </tr>
                <tr>
                    <th>{termAggregation.buckets.length}</th>
                    <th>
                        <SelectTerm term={props.term}/>
                    </th>
                    <th className="text-end border-end"><Link href={`/pesquisa?${searchParams.toString()}`}>{termAggregation.buckets.reduce((acc, b)=> acc+b.doc_count, 0)}</Link></th>
                    {sortedGroup.map(([name,count], i) => <td key={i} className="text-end border-end"><Link href={`/pesquisa?${modifySearchParams(new URLSearchParams(searchParams.toString()), props.group, `"${name}"`)}`}>{count}</Link></td>)}
                    <th></th>
                    <th className="text-start">de ... até</th>
                </tr>
            </thead>
            <tbody>
                {termAggregation.buckets.length <= props.limits && termAggregation.buckets.map( (b, i) => <ShowBucketRow key={i} index={i} bucket={b} filtersUsed={props.filtersUsed} searchParams={new URLSearchParams(searchParams.toString())} term={props.term} group={props.group} sortedGroup={sortedGroup} />)}
            </tbody>
        </table>
        {termAggregation.buckets.length > props.limits && <div className="d-flex flex-wrap">
            {termAggregation.buckets.map( (b, i) => <ShowBucketLine key={i} index={i} bucket={b} filtersUsed={props.filtersUsed} searchParams={new URLSearchParams(searchParams.toString())} term={props.term} group={props.group} sortedGroup={sortedGroup} />)}
        </div>}
    </>
}

function SelectGroup(props: {group: string}){
    let searchParams = useSearchParams();
    let router = useRouter();
    let keys = useKeysFromContext();
    return <SelectNavigate name="group" defaultValue={props.group} valueToHref={(v, params) => `?${modifySearchParams(new URLSearchParams(params), "group", v).toString()}`}>
        <option value="" label="(total)"/>
        {keys.keys.filter(k => k.indicesGroup).map(k => <option key={k.key} label={k.name} value={k.key}/>)}
    </SelectNavigate>
}

function SelectTerm(props: {term: string}){
    let searchParams = useSearchParams();
    let router = useRouter();
    let keys = useKeysFromContext();
    return <SelectNavigate name="group" defaultValue={props.term} valueToHref={(v, params) => `?${modifySearchParams(new URLSearchParams(params), "term", v).toString()}`}>
        {keys.keys.filter(k => k.indicesList).map(k => <option key={k.key} label={k.name} value={k.key}/>)}
    </SelectNavigate>    
}

function ShowBucketRow(props: {bucket: any, index: number, term: string, group: string, filtersUsed: Record<string, string[]>, searchParams: URLSearchParams, sortedGroup: [string, number][]}){
    let group = props.bucket.Group;
    const othersCount = group ? group.sum_other_doc_count + group.buckets.reduce((acc: number, b: any) => acc + (props.sortedGroup.find(([s, n]) => s == b.key) != null ? 0 : b.doc_count), 0) : 0;
    return <tr>
        <td className="text-muted">{props.index+1}</td>
        <td className="text-nowrap" style={{width: "0px"}}>{props.term in props.filtersUsed ? (props.filtersUsed[props.term].find( f => f.substring(1,f.length-1) === props.bucket.key) ? <b>{props.bucket.key}</b> : props.bucket.key) : <Link href={`?${modifySearchParams(new URLSearchParams(props.searchParams), props.term, `"${props.bucket.key}"`)}`}>{props.bucket.key}</Link>}</td>
        <td className="text-end border-end text-nowrap" style={{width: "0px"}}><Link href={`/pesquisa?${addSearchParams(new URLSearchParams(props.searchParams), props.term, `"${props.bucket.key}"`)}`}>{props.bucket.doc_count}</Link></td>
        {props.sortedGroup.map(([groupKey, groupValue], i) => <td key={i} className="text-end border-end text-nowrap">
            <Link href={`/pesquisa?${modifySearchParams(addSearchParams(new URLSearchParams(props.searchParams), props.term, `"${props.bucket.key}"`), props.group, `"${groupKey}"`)}`}><HideZero n={groupKey == INDICES_OTHERS ? othersCount : group.buckets.find((b:any) => b.key === groupKey)?.doc_count || 0}/></Link>
        </td>)}
        <td></td>
        <td className="text-end text-nowrap">
            {props.bucket.MinAno && props.bucket.MaxAno ?
                props.group != "" ?
                    <>{props.bucket.MinAno.value_as_string} ... {props.bucket.MaxAno.value_as_string}</>
                    :
                    <Link href="#histogram" data-bs-toggle="modal" data-bs-target="#modal-histogram" data-key={props.term} data-value={props.bucket.key} data-query={`./api/histogram?${modifySearchParams(new URLSearchParams(props.searchParams), "term", props.term)}&histogram_value=${encodeURIComponent(props.bucket.key)}`}>
                        {props.bucket.MinAno.value_as_string} ... {props.bucket.MaxAno.value_as_string}
                    </Link>
                : ""}
        </td>
    </tr>
}

function ShowBucketLine(props: {bucket: any, index: number, term: string, group: string, filtersUsed: Record<string, string[]>, searchParams: URLSearchParams, sortedGroup: [string, number][]}){
    return <div className="mx-2">
        <Link href={`/indices?${addSearchParams(new URLSearchParams(props.searchParams), props.term, `"${props.bucket.key}"`)}`}>{props.bucket.key}</Link> ({props.bucket.doc_count})
    </div>
}

function HideZero({n}:{n:number}){
    return <>{n>0?n:""}</>
}

const INITIAL_STATE = {key:"Termo",value:"Valor",query:"/api/histogram"};
function HistogramModal(){
    const modal = useRef<HTMLDivElement>(null);
    const histogram = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<{key:string, value:string, query:string}>(INITIAL_STATE);
    const [loading, setLoading] = useState<boolean>(false)

    useEffect(() => {
        let modalElement = modal.current;
        if(!modalElement) return;
        const modalShow = (event: Event & {relatedTarget: HTMLElement}) => {
            setState({key: event.relatedTarget.dataset.key!, value: event.relatedTarget.dataset.value!, query: event.relatedTarget.dataset.query!})
        }
        const modalHide = (event: Event) => {
            setState(INITIAL_STATE);

        }
        modalElement.addEventListener("show.bs.modal", modalShow as any)
        modalElement.addEventListener("hide.bs.modal", modalHide as any)
        return () => {
            modalElement!.removeEventListener("show.bs.modal", modalShow as any)
            modalElement!.removeEventListener("hide.bs.modal", modalHide as any)
        }
    }, [modal])

    useEffect(() => {
        if( state.key == INITIAL_STATE.key && state.value == INITIAL_STATE.value && state.query == INITIAL_STATE.query ) {
            if("Plotly" in window) (window.Plotly as any).purge(histogram.current)
            return; 
        };
        setLoading(true)
        fetch(state.query)
            .then( r => r.json())
            .then( aggs => {
                ((window as any).Plotly as any).newPlot(histogram.current, [{
                    x: aggs.Term.Anos.buckets.map((b: any) => b.key_as_string),
                    y: aggs.Term.Anos.buckets.map((b: any) => b.doc_count),
                    type: "bar"
                }], {xaxis: {autotypenumbers: 'strict'}}, {responsive: true});
                setLoading(false)
            })
    }, [state])

    return <div ref={modal} className="modal fade" id="modal-histogram" tabIndex={-1} role="dialog" aria-labelledby="modal-histogram-label" aria-hidden="true">
        <div className="modal-dialog">
            <div className="modal-content">
                <div className="modal-header">
                    <div>
                        <h3 id="modal-histogram-label">Histograma</h3>
                        <small>{state.key} com o valor &quot;{state.value}&quot;</small>
                    </div>
                </div>
                <div className="modal-body">
                    {loading ? "A carregar informação" : "" }
                    <div ref={histogram} id="histogram" className="w-100"></div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" type="button" data-bs-dismiss="modal">Fechar</button>
                </div>
            </div>
        </div>
    </div>
}

function TermInfo(props: {term: string}){
    let termInfo = useFetch<JurisprudenciaKey>(`/api/keys/${encodeURIComponent(props.term)}`, [])

    return <>
        {termInfo !== undefined ? 
            <div className="alert alert-info m-1 p-1" role="alert" dangerouslySetInnerHTML={{__html: termInfo.description}}></div>
            :
            <div className="alert alert-info m-1 p-1" role="alert">
                <p className="m-0">
                    <SmallSpinner />&nbsp;A carregar informação...
                </p>
            </div>
        }
    </>
}