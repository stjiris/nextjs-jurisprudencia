import { BadgeFromState } from "@/components/BadgeFromState"
import { GenericPageWithForm } from "@/components/genericPageStructure"
import { Loading } from "@/components/loading"
import { FormProps, withForm } from "@/components/pageWithForm"
import { modifySearchParams, SelectNavigate } from "@/components/SelectNavigate"
import { useFetch } from "@/components/useFetch"
import { useKeysFromContext } from "@/contexts/keys"
import search, { createQueryDslQueryContainer, DEFAULT_AGGS, DEFAULT_RESULTS_PER_PAGE, getSearchedArray, parseSort, populateFilters } from "@/core/elasticsearch"
import { LoggerServerSideProps } from "@/core/logger-api"
import { saveSearch } from "@/core/track-search"
import { JurisprudenciaKey } from "@/types/keys"
import { HighlightFragment, SearchHandlerResponse, SearchHandlerResponseItem } from "@/types/search"
import { SearchHit } from "@elastic/elasticsearch/lib/api/types"
import { JurisprudenciaDocument, JurisprudenciaDocumentGenericKey, JurisprudenciaDocumentGenericKeys } from "@stjiris/jurisprudencia-document"
import Head from "next/head"
import Link from "next/link"
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation"
import { MouseEventHandler, ReactNode, useEffect, useMemo, useState } from "react"

interface PesquisaProps extends FormProps{
    searchedArray: string[]
    searchId?: string
    pages: number
}

export const getServerSideProps = withForm<PesquisaProps>(async (ctx, formProps) => {
    LoggerServerSideProps(ctx);
    let searchId = await saveSearch(ctx.resolvedUrl)
    let searchedArray = await getSearchedArray(Array.isArray(ctx.query.q) ? ctx.query.q.join(" ") : ctx.query.q || "")
    let rpp = parseInt(ctx.query.rpp as string || "10")
    let pages = Math.ceil(formProps.count / rpp)

    return {
        ...formProps,
        searchedArray,
        pages,
        searchId
    }
})

export default function Pesquisa(props: PesquisaProps){
    const searchParams = useSearchParams();
    const results = useFetch<SearchHandlerResponse>(`/api/search?${searchParams}`,[])

    return <GenericPageWithForm {...props} title="Jurisprudência STJ - Pesquisa">
        {results ? 
            results.length > 0 ? 
                <ShowResults results={results} searchParams={searchParams} searchInfo={props}/> :
                <NoResults /> :
            <Loading />
        }
    </GenericPageWithForm>
}

function ShowResults({results, searchParams, searchInfo}: {results: SearchHandlerResponse, searchParams: ReadonlyURLSearchParams, searchInfo: PesquisaProps}){

    const sort = searchParams.get("sort") || "des"
    let page = parseInt(searchParams.get("page") || "0")
    const rpp = parseInt(searchParams.get("rpp") || "10")
    
    return <>
        <div className="mb-2 d-flex align-items-center gap-2">
            <SelectNavigate name="rpp-select" className="me-1" defaultValue={rpp} valueToHref={(v, params) => {
                                                                                                    const newParams = modifySearchParams(params, "rpp", v);
                                                                                                    return `/pesquisa?${modifySearchParams(newParams, "page", "0")}`;
                                                                                                } }>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="500">500</option>
            </SelectNavigate>
            <SelectNavigate name="sort" className="me-2" defaultValue={sort} valueToHref={(v, params) => `/pesquisa?${modifySearchParams(params, "sort", v)}` }>
                <option value="score">Relevância</option>
                <option value="asc">Data Ascendente</option>
                <option value="des">Data Descendente</option>
            </SelectNavigate>
        </div>
        {...results.map((h, i) => <JurisprudenciaItem key={i} hit={h} searchId={searchInfo.searchId}/>)}
        <article className="row d-print-none">
            <nav>
                <ul className="pagination justify-content-center text-center">
                    <li className="page-item">
                        <NavLink page={0} icon="bi-chevron-double-left" searchParams={searchParams}/>
                    </li>
                    <li className="page-item">
                        {page > 0 ? <NavLink page={page-1} icon="bi-chevron-left" searchParams={searchParams}/> : <span className="page-link"><i className="bi bi-chevron-left disabled"></i></span> }
                    </li>
                        
                    <li className="page-item w-25">
                        <span className="page-link"><small>Página {page+1}/{searchInfo.pages}</small></span>
                    </li>
                    <li className="page-item">
                        {page < searchInfo.pages-1 ? <NavLink page={page+1} icon="bi-chevron-right" searchParams={searchParams}/>: <span className="page-link"><i className="bi bi-chevron-right disabled"></i></span> }
                    </li>
                    <li className="page-item">
                        <NavLink page={searchInfo.pages-1} icon="bi-chevron-double-right" searchParams={searchParams}/>
                    </li>

                </ul>
            </nav>
        </article>
    </>
}

function NavLink({page, icon, searchParams}: {page: number, icon: string, searchParams: ReadonlyURLSearchParams}){
    const tmp = new URLSearchParams(searchParams.toString());
    tmp.set("page", page.toString())
    return <Link className="page-link" href={`?${tmp.toString()}`} title={`Ir para a página ${page+1}`}><i className={`bi ${icon}`}></i></Link>
}

const pesquisaSummaryStyles = `
.pesquisa-sumario {
    font-size: 1.15rem;
    line-height: 1.7;
}
`;

function JurisprudenciaItem({hit, searchId}:{hit: SearchHandlerResponseItem, searchId?: string}){
    const keys = useKeysFromContext().records;
    const searchParam = searchId ? `?search=${searchId}` : ""
    const numeroProcesso = hit._source?.["Número de Processo"];
    const data = hit._source?.Data;
    const area = hit._source?.Área?.Show;
    const secao = showOrOriginal(hit, "Secção").join(" / ");
    const meioProcessual = hit._source?.["Meio Processual"]?.Show?.join(" / ");
    const relator = showOrOriginal(hit, "Relator Nome Profissional").join(" / ");
    const decisao = showOrOriginal(hit, "Decisão").join(" / ");
    return <article className="row border-top result">
        <style>{pesquisaSummaryStyles}</style>
        <div className="col-12 pt-1">
            <div>
                <Link href={hit._source?.ECLI?.startsWith("ECLI:PT:STJ:") ? `/ecli/${hit._source.ECLI}${searchParam}` : `/${encodeURIComponent(numeroProcesso!)}/${hit._source?.UUID}${searchParam}`} target="_blank">
                    [{numeroProcesso}]
                </Link>
                {data ? ` - ${data}` : ""}
            </div>
            {(area || secao) && (
                <div>
                    {area ? area : ""}{area && secao ? " - " : ""}{secao}
                </div>
            )}
            {meioProcessual && <div><b>Meio Processual:</b> {meioProcessual}</div>}
            {relator && <div><b>Relator:</b> {relator}</div>}
            {decisao && <div><b>Decisão:</b> {decisao}</div>}
        </div>
        {hit._source?.Sumário? <details className="col-12">
            <summary className="d-flex align-items-center list-unstyled">
                <span style={{width: "10%", flexShrink: 1}}>
                    <i className="bi bi-caret-downright-fill"></i>
                    <b className="mouse-click">{keys?.Sumário.name}:</b>
                </span>
                {hit.highlight?.["SumárioMarks"] ? <div className="highlight">
                    <div className="highlight-bar" data-key="Sumário">
                        {(hit.highlight.SumárioMarks as HighlightFragment[]).map((marker,i) => <div key={i} className="highlight-bar-hit-parent">
                            <div className="highlight-bar-hit" data-offset={marker.offset} data-per={marker.offset/marker.size} style={{left: `${marker.offset/marker.size*100}%`, background: "green"}}></div>
                            <div className="highlight-bar-hit-content d-none" dangerouslySetInnerHTML={{__html: marker.textFragment}}></div>
                        </div>)}
                    </div>
                </div>:""}
            </summary>
            <div className="col-12 p-2 border pesquisa-sumario" dangerouslySetInnerHTML={{__html: hit.highlight?.Sumário ? hit.highlight?.Sumário : hit._source.Sumário}} />
        </details>:""}
        {hit.highlight?.Texto ? <details className="col-12 d-print-none">
            <summary className="d-flex align-items-center list-unstyled">
                <span style={{width: "10%", flexShrink: 1}}>
                    <i className="bi bi-caret-downright-fill"></i>
                    <b className="mouse-click">{keys?.Texto.name}:</b>
                </span>
                <div className="highlight">
                    <div className="highlight-bar" data-key="Texto">
                        {(hit.highlight.Texto as HighlightFragment[]).map((marker, i) => <div key={i} className="highlight-bar-hit-parent">
                            <div className="highlight-bar-hit" data-offset={marker.offset} data-per={marker.offset/marker.size} style={{left: `${marker.offset/marker.size*100}%`, background: "green"}}></div>
                            <div className="highlight-bar-hit-content d-none" dangerouslySetInnerHTML={{__html: marker.textFragment}}></div>
                        </div>)}
                    </div>
                </div>
            </summary>
            <div className="col-12 p-2 border d-flex flex-wrap">
                {(hit.highlight.Texto as HighlightFragment[]).flatMap((frag,i) => [<div key={i} className="pesquisa-sep"></div>,<div key={i} dangerouslySetInnerHTML={{__html: frag.textFragment}}></div>])}
            </div>
        </details> : ""}
    </article>
}

function NoResults(){
    return <div className="alert alert-info" role="alert">
        <h4 className="alert-heading">Sem resultados...</h4>
        <strong><i className="bi bi-lightbulb-fill"></i> Sugestões:</strong>
        <ol>
            <li>Verifique os filtros utilizados (tribunais, relator, , data)</li>
            <li>Verifique o termo pesquisado</li>
        </ol>
    </div>
}

function ShowKey({Comp, ...props}: {hit: SearchHandlerResponseItem, accessKey: JurisprudenciaDocumentGenericKey, Comp: (props: {vs: string[], ak: string}) => JSX.Element}){
    let actual = showOrOriginal(props.hit, props.accessKey);
    let showName = useKeysFromContext().records?.[props.accessKey].name || "";
    return actual.length > 0 ? <Comp vs={actual} ak={showName} /> : <></>
}

function showOrOriginal(hit: SearchHandlerResponseItem, key: JurisprudenciaDocumentGenericKey){
    let show = hit._source![key]?.Show;
    if( show && show.length > 0 ) return show;
    let original = hit._source![key]?.Original;
    return original || [];
}
