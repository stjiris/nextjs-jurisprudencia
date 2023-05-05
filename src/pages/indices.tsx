import { AggregationsAggregate, AggregationsAggregationContainer, AggregationsMaxAggregate, AggregationsMinAggregate, AggregationsStringTermsAggregate, AggregationsTermsAggregation, AggregationsTermsBucketBase, Indices, long, SearchTotalHits } from "@elastic/elasticsearch/lib/api/types";
import search, { aggs, filterableProps, createQueryDslQueryContainer, populateFilters, sortBucketsAlphabetically } from "@/core/elasticsearch"
import { GetServerSideProps } from "next";
import { GenericPageWithForm } from "@/components/genericPageStructure";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ReadonlyURLSearchParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AggregationsTermsAggregateBase } from "@elastic/elasticsearch/lib/api/typesWithBodyKey";
import { count } from "console";
import { addSearchParams, modifySearchParams, SelectNavigate } from "@/components/select-navigate";
import Head from "next/head";
import Script from "next/script";
import { getServerSidePropsHelper } from "@/components/indices-helpers";
import { IndicesProps, INDICES_OTHERS } from "@/types/indices";

export const getServerSideProps = getServerSidePropsHelper;

export default function Indices(props: IndicesProps){
    const [termInfo, setTermInfo] = useState<string>("A carregar informação...");
    const searchParams = useSearchParams();
    if( !Array.isArray(props.termAggregation.buckets) ) throw new Error("Invalid bucket")

    useEffect(() => {
        fetch(`./api/terms-info?term=${encodeURIComponent(props.term)}`).then( r => r.status == 200 ? r.text() : "Sem informação..." ).then(setTermInfo)
    }, [props.term])

    return <GenericPageWithForm escapeChildren={<HistogramModal />} count={props.total} filtersUsed={props.filtersUsed} minAno={props.minAno} maxAno={props.maxAno}>
        <Head>
            <title>Jurisprudência STJ - Índices</title>
            <meta name="description" content="Permite explorar, pesquisar e filtrar os acórdãos publicados pelo Supremo Tribunal de Justiça na DGSI.pt." />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
        </Head>
        <Script src="https://cdn.plot.ly/plotly-2.12.1.min.js" />
        {(props.termAggregation.sum_other_doc_count || 0) > 0 ? <div className="alert alert-warning" role="alert">
            <h5 className="alert-heading">
                <strong><i className="bi bi-exclamation-circle"></i> Atenção:</strong> 
            </h5>
            <ul>
                <li>Existem {props.termAggregation.sum_other_doc_count} outros valores não listados.</li>
            </ul>
        </div> : ""}
        {termInfo ? <div className="alert alert-info m-1 p-1" role="alert"><p className="m-0" dangerouslySetInnerHTML={{__html: termInfo}}></p></div> : ""}
        <table className="table table-sm" style={{width: "fit-content"}}>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Índice <Link href={`./api/indices.csv?${searchParams.toString()}`} className="ms-1"><i className="bi bi-filetype-csv"></i></Link></th>
                    <th className="text-end-border-end">
                        <SelectGroup group={props.group}/>
                    </th>
                    {props.sortedGroup.map(([name, count],i) => <td key={i} className="text-end border-end">{name == INDICES_OTHERS || props.group in props.filtersUsed ? name : <Link href={`?${modifySearchParams(searchParams, props.group, `"${name}"`)}`}>{name}</Link>}</td>)}
                    <th></th>
                    <th className="text-start">Datas</th>
                </tr>
                <tr>
                    <th>{props.termAggregation.buckets.length}</th>
                    <th>
                        <SelectTerm term={props.term}/>
                    </th>
                    <th className="text-end border-end"><Link href={`/pesquisa?${searchParams.toString()}`}>{props.termAggregation.buckets.reduce((acc, b)=> acc+b.doc_count, 0)}</Link></th>
                    {props.sortedGroup.map(([name,count], i) => <td key={i} className="text-end border-end"><Link href={`/pesquisa?${modifySearchParams(searchParams, props.group, `"${name}"`)}`}>{count}</Link></td>)}
                    <th></th>
                    <th className="text-start">de ... até</th>
                </tr>
            </thead>
            {props.termAggregation.buckets.length <= props.LIMIT_ROWS ? <tbody>
                {props.termAggregation.buckets.map( (b, i) => <ShowBucketRow key={i} index={i} bucket={b} filtersUsed={props.filtersUsed} searchParams={searchParams} term={props.term} group={props.group} sortedGroup={props.sortedGroup} />)}
            </tbody>: ""}
        </table>
        {props.termAggregation.buckets.length > props.LIMIT_ROWS ? <div className="d-flex flex-wrap">
            {props.termAggregation.buckets.map( (b, i) => <ShowBucketLine key={i} index={i} bucket={b} filtersUsed={props.filtersUsed} searchParams={searchParams} term={props.term} group={props.group} sortedGroup={props.sortedGroup} />)}
        </div> : ""}
    </GenericPageWithForm>
}

function SelectGroup(props: {group: string}){
    return <SelectNavigate name="group" defaultValue={props.group} valueToHref={(v, params) => `?${modifySearchParams(params, "group", v).toString()}`}>
        <option value="" label="(total)"/>
        <option value="Área" label="Área"/>
        <option value="Secção" label="Secção"/>
    </SelectNavigate>
}
function SelectTerm(props: {term: string}){
    return <SelectNavigate name="group" defaultValue={props.term} valueToHref={(v, params) => `?${modifySearchParams(params, "term", v).toString()}`}>
            <option value="Jurisprudência" label="Jurisprudência"/>
            <option value="Área" label="Área"/>
            <option value="Secção" label="Secção"/>
            <option value="Relator Nome Profissional" label="Relator"/>
            <option value="Meio Processual" label="Meio Processual"/>
            <option value="Decisão" label="Decisão"/>
            <option value="Decisão (textual)" label="Decisão (textual)"/>
            <option value="Votação - Decisão" label="Votação - Decisão"/>
            <option value="Votação - Vencidos" label="Votação - Vencidos"/>
            <option value="Votação - Declarações" label="Votação - Declarações"/>
            <option value="Descritores" label="Descritores"/>
            <option value="Tribunal de Recurso" label="Tribunal de Recurso"/>
            <option value="Tribunal de Recurso - Processo" label="Tribunal de Recurso - Processo"/>
            <option value="Área Temática" label="Área Temática"/>
            <option value="Jurisprudência Estrangeira" label="Jurisprudência Estrangeira"/>
            <option value="Jurisprudência Internacional" label="Jurisprudência Internacional"/>
            <option value="Doutrina" label="Doutrina"/>
            <option value="Jurisprudência Nacional" label="Jurisprudência Nacional"/>
            <option value="Legislação Comunitária" label="Legislação Comunitária"/>
            <option value="Legislação Estrangeira" label="Legislação Estrangeira"/>
            <option value="Legislação Nacional" label="Legislação Nacional"/>
            <option value="Referências Internacionais" label="Referências Internacionais"/>
            <option value="Referência de publicação" label="Referência de publicação"/>
            <option value="Indicações Eventuais" label="Indicações Eventuais"/>
    </SelectNavigate>
}

function ShowBucketRow(props: {bucket: any, index: number, term: string, group: string, filtersUsed: Record<string, string[]>, searchParams: ReadonlyURLSearchParams, sortedGroup: [string, number][]}){
    const othersCount = props.bucket.Group.sum_other_doc_count + props.bucket.Group.buckets.reduce((acc:number, b: any) => acc + (props.sortedGroup.find(([s,n]) => s == b.key) != null ? 0 : b.doc_count), 0)
    return <tr>
        <td className="text-muted">{props.index+1}</td>
        <td className="text-nowrap" style={{width: "0px"}}>{props.term in props.filtersUsed ? props.bucket.key : <Link href={`?${modifySearchParams(props.searchParams, props.term, `"${props.bucket.key}"`)}`}>{props.bucket.key}</Link>}</td>
        <td className="text-end border-end text-nowrap" style={{width: "0px"}}><Link href={`/pesquisa?${modifySearchParams(props.searchParams, props.term, `"${props.bucket.key}"`)}`}>{props.bucket.doc_count}</Link></td>
        {props.sortedGroup.map(([groupKey, groupValue], i) => <td key={i} className="text-end border-end text-nowrap">
            <Link href={`/pesquisa?${modifySearchParams(modifySearchParams(props.searchParams, props.term, `"${props.bucket.key}"`), props.group, `"${groupKey}"`)}`}><HideZero n={groupKey == INDICES_OTHERS ? othersCount : props.bucket.Group.buckets.find((b:any) => b.key === groupKey)?.doc_count || 0}/></Link>
        </td>)}
        <td></td>
        <td className="text-start text-nowrap">
            {props.bucket.MinAno.value_as_string == props.bucket.MaxAno.value_as_string ?
                props.bucket.MaxAno.value_as_string
            :
            props.bucket.doc_count <= 2 ? 
                <>{props.bucket.MinAno.value_as_string} ... {props.bucket.MaxAno.value_as_string}</>
            :
            <Link href="#histogram" data-bs-toggle="modal" data-bs-target="#modal-histogram" data-key={props.term} data-value={props.bucket.key} data-query={`./api/histogram?${modifySearchParams(props.searchParams, "term", props.term)}&histogram_value=${encodeURIComponent(props.bucket.key)}`}>
                {props.bucket.MinAno.value_as_string} ... {props.bucket.MaxAno.value_as_string}
            </Link>
            }
        </td>
    </tr>
}


function ShowBucketLine(props: {bucket: any, index: number, term: string, group: string, filtersUsed: Record<string, string[]>, searchParams: ReadonlyURLSearchParams, sortedGroup: [string, number][]}){
    return <div className="mx-2">
        <Link href={`/indices?${addSearchParams(props.searchParams, props.term, `"${props.bucket.key}"`)}`}>{props.bucket.key}</Link> ({props.bucket.doc_count})
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