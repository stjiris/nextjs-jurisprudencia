import GenericPage, { GenericPageWithForm } from "@/components/genericPageStructure"
import SearchForm from "@/components/searchForm"
import { modifySearchParams, SelectNavigate } from "@/components/select-navigate"
import search, { createQueryDslQueryContainer, DEFAULT_AGGS, getSearchedArray, parseSort, populateFilters, RESULTS_PER_PAGE } from "@/core/elasticsearch"
import { JurisprudenciaDocument } from "@/core/jurisprudencia"
import { saveSearch } from "@/core/track-search"
import { HighlightFragment, SearchHandlerResponse, SearchHandlerResponseItem } from "@/types/search"
import { AggregationsAggregate, long, SearchHit, SearchResponse, SortCombinations } from "@elastic/elasticsearch/lib/api/types"
import { AggregationsMaxAggregate, AggregationsMinAggregate, SearchTotalHits } from "@elastic/elasticsearch/lib/api/typesWithBodyKey"
import { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation"
import { useEffect, useState, MouseEventHandler } from "react"

export const getServerSideProps: GetServerSideProps<SearchInfo> = async (ctx) => {

    const sfilters = {pre: [], after: []};
    const filtersUsed = populateFilters(sfilters, ctx.query)
    const sort: SortCombinations[] = [];
    parseSort(Array.isArray(ctx.query?.sort) ? ctx.query.sort[0] : ctx.query.sort, sort)
    const page = parseInt(Array.isArray(ctx.query.page) ? ctx.query.page[0] : ctx.query.page || "" ) || 0
    const queryObj = createQueryDslQueryContainer(ctx.query.q);
    const result = await search(queryObj, sfilters, page, DEFAULT_AGGS, 0, {sort, track_scores: true, _source: []})
    let total = 0;
    if( result.hits.total ){
        if( Number.isInteger(result.hits.total) ){
            total = result.hits.total as long;
        }
        else{
            total = (result.hits.total as SearchTotalHits).value;
        }
    }

    return {props: {
        searchId: await saveSearch(ctx.resolvedUrl),
        pages:  Math.ceil(total / RESULTS_PER_PAGE),
        searchedArray: await getSearchedArray(Array.isArray(ctx.query.q) ? ctx.query.q.join(" ") : (ctx.query.q || "")),
        total: total,
        filtersUsed: filtersUsed,
        minAno: parseInt((result.aggregations?.MinAno as AggregationsMinAggregate).value_as_string || "") || 0,
        maxAno: parseInt((result.aggregations?.MaxAno as AggregationsMaxAggregate).value_as_string || "") || Infinity
    }}
}

interface SearchInfo{
    searchedArray: string[]
    searchId?: string
    pages: number
    total: number
    filtersUsed: Record<string, string[]>
    minAno: number
    maxAno: number
}

export default function Pesquisa(props: SearchInfo){
    const [results, setResults] = useState<SearchHandlerResponse>()
    const searchParams = useSearchParams()

    useEffect(() => {
        fetch(`./api/search/?${searchParams}`)
            .then( r => r.json())
            .then(l => setResults(l))
    }, [searchParams])

    return <GenericPageWithForm count={props.total} filtersUsed={props.filtersUsed} minAno={props.minAno} maxAno={props.maxAno}>
        <Head>
            <title>Jurisprudência STJ - Pesquisa</title>
            <meta name="description" content="Permite explorar, pesquisar e filtrar os acórdãos publicados pelo Supremo Tribunal de Justiça na DGSI.pt." />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
        </Head>
        {results ? 
            results.length > 0 ? 
                <ShowResults results={results} searchParams={searchParams} searchInfo={props}/> :
                <NoResults /> :
            <Loading />
        }
    </GenericPageWithForm>
}

const onClickShare: MouseEventHandler<HTMLElement> = (event) => {
    let id = event.currentTarget.dataset.id;
    let url = `./go/${id}`;
    if( "canShare" in navigator && navigator.canShare({url})){
        navigator.share({url});
    }
    else{
        let text = window.location.href.replace(/\/pesquisa.*/,url.slice(1))
        navigator.clipboard.writeText(text);
    }
}

function ShowResults({results, searchParams, searchInfo}: {results: SearchHandlerResponse, searchParams: ReadonlyURLSearchParams, searchInfo: SearchInfo}){
    const sort = searchParams.get("sort") || "des"
    const page = parseInt(searchParams.get("page") || "0")
    return <>
        <article>
            <b className="d-none d-print-inline">Ordenação:</b>
            <b><SelectNavigate name="sort" className="me-2" defaultValue={sort} valueToHref={(v, params) => `/pesquisa?${modifySearchParams(params, "sort", v)}`}>
                <option value="score">Relevância</option>
                <option value="asc">Data Ascendente</option>
                <option value="des">Data Descendente</option>
            </SelectNavigate></b>
            {searchInfo.searchId ? <i className="bi bi-share" role="button" onClick={onClickShare} data-id={searchInfo.searchId}></i>:""}
            <div className="d-inline float-end d-print-none">
                {searchInfo.searchedArray.length > 0 ? 
                    ["Termos da pesquisa destacados:", searchInfo.searchedArray.map( (s,i) => <span key={i} className="badge bg-white text-dark" style={{border: `3px solid var(--highlight-${i}, var(--primary-gold))`}}>{s}</span>)]
                : ""}
            </div>
        </article>
        {...results.map((h, i) => <JurisprudenciaItem key={i} hit={h} searchId={searchInfo.searchId}/>)}
        <article className="row d-print-none">
            <nav>
                <ul className="pagination justify-content-center text-center">
                    <li className="page-item">
                        <NavLink page={0} icon="bi-chevron-double-left" searchParams={searchParams}/>
                    </li>
                    <li className="page-item">
                        {page > 0 ? <NavLink page={page-1} icon="bi-chevron-left" searchParams={searchParams}/> : <a className="page-link"><i className="bi bi-chevron-left disabled"></i></a> }
                    </li>
                        
                    <li className="page-item w-25">
                        <a className="page-link"><small>Página {page+1}/{searchInfo.pages}</small></a>
                    </li>
                    <li className="page-item">
                        {page < searchInfo.pages-1 ? <NavLink page={page+1} icon="bi-chevron-right" searchParams={searchParams}/>: <a className="page-link"><i className="bi bi-chevron-right disabled"></i></a> }
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
    const tmp = new URLSearchParams(searchParams);
    tmp.set("page", page.toString())
    return <Link className="page-link" href={`?${tmp.toString()}`}><i className={`bi ${icon}`}></i></Link>

}

const scoreColor = (per:number) => per < 0.2 ? '#E3D5A1' : per < 0.4 ? '#CEB65E' : per < 0.6 ? '#B49936' : per < 0.8 ? '#8C752C' : '#6C5A22';

function JurisprudenciaItem({hit, searchId}:{hit: SearchHandlerResponseItem, searchId?: string}){
    const searchParam = searchId ? `?search=${searchId}` : ""
    return <article className="row border-top result">
        <div className="col-12 pt-1 d-flex flex-wrap">
            <small className="relevancia" style={{color: scoreColor(hit.score!/hit.max_score)}}>
                {[0.2,0.4,0.6,0.8,1].map((b,i) => <i key={i} className={`bi bi-square${hit.score!/hit.max_score < b ? "" : "-fill"} me-1`}></i>)}
            </small>
            <Link href={hit._source?.ECLI.startsWith("ECLI:PT:STJ:") ? `/a/ecli/${hit._source.ECLI}${searchParam}` : `/a/${encodeURIComponent(hit._source?.["Número de Processo"])}/${hit._source?.UUID}${searchParam}`} target="_blank">{hit._source?.["Número de Processo"]}</Link>
            <span>&nbsp;- {hit._source?.Data}</span>
            {hit._source?.Área ? <span>&nbsp;- {hit._source.Área}</span> : ""}
            {hit._source?.["Meio Processual"] ? <span>&nbsp;- {hit._source["Meio Processual"].join(" / ")}</span> : ""}
            <span>&nbsp;- {hit._source?.["Relator Nome Profissional"]}</span>
            <span>&nbsp;- {hit._source?.Secção}</span>
        </div>
        <div className="col-12 d-flex flex-wrap">
            {hit._source?.["Votação - Decisão"]? <div className="mx-1"><b>Votação:&nbsp;</b><span>{hit._source?.["Votação - Decisão"]}</span></div> : ""}
            {hit._source?.["Decisão"]? <div className="mx-1"><b>Votação:&nbsp;</b><span>{hit._source?.["Decisão"].join(" / ")}</span></div> : ""}
        </div>
        {Array.isArray(hit._source?.Descritores) ? <div className="col-12">
            <div className="mx-1">
                <b>Descritores:&nbsp;</b>
                {hit._source?.Descritores.flatMap(d => [" / ",hit.highlight?.Descritores && hit.highlight.Descritores.find(h => (h as string).includes(d))?<mark>{d}</mark>:d]).slice(1)}
            </div>
        </div>: ""}
        {hit._source?.Sumário? <details className="col-12">
            <summary className="d-flex align-items-center list-unstyled">
                <span style={{width: "10%", flexShrink: 1}}>
                    <i className="bi bi-caret-downright-fill"></i>
                    <b className="mouse-click">Sumário:</b>
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
            <div className="col-12 p-2 border normalize-sumario-weight" dangerouslySetInnerHTML={{__html: hit.highlight?.Sumário ? hit.highlight?.Sumário : hit._source.Sumário}} />
        </details>:""}
        {hit.highlight?.Texto ? <details className="col-12 d-print-none">
            <summary className="d-flex align-items-center list-unstyled">
                <span style={{width: "10%", flexShrink: 1}}>
                    <i className="bi bi-caret-downright-fill"></i>
                    <b className="mouse-click">Texto:</b>
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
            <li>Verifique os filtros utilizados (tribunais, relator, descritores, data)</li>
            <li>Verifique o termo pesquisado</li>
        </ol>
    </div>
}

function Loading(){
    return <div className="alert alert-info" role="alert">
        <h4 className="alert-heading">A carregar resultados...</h4>
    </div>
}