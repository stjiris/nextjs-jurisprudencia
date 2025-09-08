import { BadgeFromState } from "@/components/BadgeFromState"
import { GenericPageWithForm } from "@/components/genericPageStructure"
import { Loading } from "@/components/loading"
import { FormProps, withForm } from "@/components/pageWithForm"
import { modifySearchParams, SelectNavigate } from "@/components/select-navigate"
import { useFetch } from "@/components/useFetch"
import { useKeysFromContext } from "@/contexts/keys"
import search, { createQueryDslQueryContainer, DEFAULT_AGGS, getSearchedArray, parseSort, populateFilters, RESULTS_PER_PAGE } from "@/core/elasticsearch"
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
    let pages = Math.ceil(formProps.count / RESULTS_PER_PAGE)

    return {
        ...formProps,
        searchedArray,
        pages,
        searchId
    }
})

export default function Pesquisa(props: PesquisaProps){
    const searchParams = useSearchParams();
    const [resultsPerPage, setResultsPerPage] = useState<string>("10");
    const [page, setPage] = useState<number>(0);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [advancedRows, setAdvancedRows] = useState([{ op: "", term: "" }]);
    const freeTextParam = searchParams.get("q") || "";
    const [freeText, setFreeText] = useState(freeTextParam);
    const results = useFetch<SearchHandlerResponse>(`/api/search?${searchParams}&rpp=${resultsPerPage}&page=${page}&q=${encodeURIComponent(freeText)}`,[])

    function handleRppChange(e: React.ChangeEvent<HTMLSelectElement>) {
        setResultsPerPage(e.target.value);
        setPage(0); // Reset to first page when changing rpp
    }

    // Advanced search logic
    function handleAdvancedChange(idx: number, field: "op" | "term", value: string) {
        setAdvancedRows(rows => rows.map((row, i) => i === idx ? { ...row, [field]: value } : row));
    }
    function addAdvancedRow() {
        setAdvancedRows(rows => [...rows, { op: "AND", term: "" }]);
    }
    function removeAdvancedRow(idx: number) {
        setAdvancedRows(rows => rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows);
    }
    function buildAdvancedQuery() {
        return advancedRows.map((row, i) => `${i > 0 ? row.op : ""} ${row.term}`.trim()).join(" ").replace(/ +/g, " ");
    }
    function handleAdvancedApply() {
        setFreeText(buildAdvancedQuery());
    }
    function handleFreeTextChange(e: React.ChangeEvent<HTMLInputElement>) {
        setFreeText(e.target.value);
    }

    // Calculate number of pages based on resultsPerPage and props.count
    const totalResults = props.count || 0;
    const rpp = parseInt(resultsPerPage);
    const pages = rpp > 0 ? Math.ceil(totalResults / rpp) : 1;

    return <GenericPageWithForm {...props} title="Jurisprudência STJ - Pesquisa">
        <div className="mb-2 d-flex align-items-center gap-2">
            <label htmlFor="rpp-select" className="mb-0"><b>Resultados por página:&nbsp;</b></label>
            <select id="rpp-select" value={resultsPerPage} onChange={handleRppChange}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
            </select>
            <SelectNavigate name="sort" className="me-2" defaultValue={searchParams.get("sort") || "des"} valueToHref={(v, params) => `/pesquisa?${modifySearchParams(params, "sort", v)}` }>
                <option value="score">Relevância</option>
                <option value="asc">Data Ascendente</option>
                <option value="des">Data Descendente</option>
            </SelectNavigate>
            {props.searchId ? <i className="bi bi-share" title="Partilhar" role="button" onClick={onClickShare} data-id={props.searchId}></i> : ""}
        </div>
        <div className="row">
            <div className="col-md-9">
                {results ? 
                    results.length > 0 ? 
                        <ShowResults results={results} searchParams={searchParams} searchInfo={{...props, pages}} page={page} setPage={setPage} /> :
                        <NoResults /> :
                    <Loading />
                }
            </div>
        </div>
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

function ShowResults({results, searchParams, searchInfo, page, setPage}: {results: SearchHandlerResponse, searchParams: ReadonlyURLSearchParams, searchInfo: PesquisaProps & {pages: number}, page: number, setPage: (p: number) => void}){
    return <>
        {...results.map((h, i) => <JurisprudenciaItem key={i} hit={h} searchId={searchInfo.searchId}/>) }
        <article className="row d-print-none">
            <nav>
                <ul className="pagination justify-content-center text-center">
                    <li className="page-item">
                        <button className="page-link" onClick={() => setPage(0)} disabled={page === 0}><i className="bi bi-chevron-double-left"></i></button>
                    </li>
                    <li className="page-item">
                        <button className="page-link" onClick={() => setPage(page-1)} disabled={page === 0}><i className="bi bi-chevron-left"></i></button>
                    </li>
                    <li className="page-item w-25">
                        <span className="page-link"><small>Página {page+1}/{searchInfo.pages}</small></span>
                    </li>
                    <li className="page-item">
                        <button className="page-link" onClick={() => setPage(page+1)} disabled={page >= searchInfo.pages-1}><i className="bi bi-chevron-right"></i></button>
                    </li>
                    <li className="page-item">
                        <button className="page-link" onClick={() => setPage(searchInfo.pages-1)} disabled={page >= searchInfo.pages-1}><i className="bi bi-chevron-double-right"></i></button>
                    </li>
                </ul>
            </nav>
        </article>
    </>
}

function NavLink({page, icon, searchParams}: {page: number, icon: string, searchParams: ReadonlyURLSearchParams}){
    const tmp = new URLSearchParams(searchParams);
    tmp.set("page", page.toString())
    return <Link className="page-link" href={`?${tmp.toString()}`} title={`Ir para a página ${page+1}`}><i className={`bi ${icon}`}></i></Link>
}

const scoreColor = (per:number) => per < 0.2 ? '#E3D5A1' : per < 0.4 ? '#CEB65E' : per < 0.6 ? '#B49936' : per < 0.8 ? '#8C752C' : '#6C5A22';

// Add or update styles for the summary in search results
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
            <li>Verifique os filtros utilizados (tribunais, relator, descritores, data)</li>
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
