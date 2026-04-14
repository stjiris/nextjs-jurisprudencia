import { GenericPageWithForm } from "@/components/main_pages/genericPageStructure"
import { Loading } from "@/components/loading"
import { FormProps, withForm } from "@/components/main_pages/pageWithForm"
import { useFetch } from "@/components/useFetch"
import { getSearchedArray } from "@/core/elasticsearch"
import { LoggerServerSideProps } from "@/core/logger-api"
import { saveSearch } from "@/core/track-search"
import { SearchHandlerResponse } from "@/types/search"
import Link from "next/link"
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation"
import { modifySearchParams, SelectNavigate } from "@/components/main_pages/SelectNavigate"
import JurisprudenciaItem from "@/components/main_pages/search/JurisprudenciaItem"

interface PesquisaProps extends FormProps{
    searchedArray: string[]
    searchId?: string
    pages: number
}

export const getServerSideProps = LoggerServerSideProps(withForm<PesquisaProps>(async (ctx, formProps) => {
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
}))

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