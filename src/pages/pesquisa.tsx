import { useState } from "react"
import { useRouter } from "next/router"
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
import dynamic from "next/dynamic"
import { modifySearchParams, SelectNavigate } from "@/components/main_pages/SelectNavigate"
import JurisprudenciaItem from "@/components/main_pages/search/JurisprudenciaItem"
import JurisprudenciaTable from "@/components/main_pages/search/JurisprudenciaTable"
import { useAuth, useCanAccess } from "@/contexts/auth"

const SavedSessionsModal = dynamic(() => import("@/components/saved_sessions/SavedSessionsModal"), { ssr: false });

interface PesquisaProps extends FormProps{
    searchedArray: string[]
    searchId?: string
    pages: number
    syncRole?: string | null
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
        searchId,
        syncRole: process.env.SYNC_ROLE || null
    }
}))

export default function Pesquisa(props: PesquisaProps){
    const searchParams = useSearchParams();
    const results = useFetch<SearchHandlerResponse>(`/api/search?${searchParams}`,[])

    return <GenericPageWithForm {...props} title="Jurisprudência STJ - Pesquisa">
        {results ? 
            results.length > 0 ? 
                <ShowResults results={results} searchParams={searchParams} searchInfo={props}/> :
                <NoResults searchInfo={props} /> :
            <Loading />
        }
        <SavedSessionsModal />
    </GenericPageWithForm>
}

function ShowResults({results, searchParams, searchInfo}: {results: SearchHandlerResponse, searchParams: ReadonlyURLSearchParams, searchInfo: PesquisaProps}){
    const auth = useAuth();

    const sort = searchParams.get("sort") || "des"
    let page = parseInt(searchParams.get("page") || "0")
    const rpp = parseInt(searchParams.get("rpp") || "10")
    const searchQuery = searchParams.get("q") || ""

    return <>
        <div className="mb-2 d-flex align-items-center gap-2">
            <SelectNavigate name="rpp-select" className="results-toolbar-control" defaultValue={rpp} valueToHref={(v, params) => {
                                                                                                    const newParams = modifySearchParams(params, "rpp", v);
                                                                                                    return `/pesquisa?${modifySearchParams(newParams, "page", "0")}`;
                                                                                                } }>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="500">500</option>
            </SelectNavigate>
            <SelectNavigate name="sort" className="results-toolbar-control" defaultValue={sort} valueToHref={(v, params) => `/pesquisa?${modifySearchParams(params, "sort", v)}` }>
                <option value="score">Relevância</option>
                <option value="asc">Data Ascendente</option>
                <option value="des">Data Descendente</option>
            </SelectNavigate>
            <Link
                href={`/api/boletim/pesquisa/html?${searchParams.toString()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="results-toolbar-control"
                title="Visualizar os acórdãos desta página no formato Boletim de Jurisprudência"
            >
                <i className="bi bi-file-earmark-text"></i>
                <span>Ver como Boletim</span>
            </Link>
            <button
                type="button"
                className="results-toolbar-control"
                data-bs-toggle="modal"
                data-bs-target="#modal-saved-sessions"
                title="Pesquisas Guardadas e Boletim Composto"
            >
                <i className="bi bi-bookmarks"></i>
                <span>Pesquisas Guardadas</span>
            </button>
            <AdminSharepointSyncButton syncRole={searchInfo.syncRole} />
            <AdminSyncButton syncRole={searchInfo.syncRole} />
        </div>
        {auth ? (
            <JurisprudenciaTable results={results} searchId={searchInfo.searchId} />
        ) : (
            results.map((h, i) => <JurisprudenciaItem key={i} hit={h} searchId={searchInfo.searchId} hasQuery={!!searchQuery} searchQuery={searchQuery}/>)
        )}
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

function NoResults({ searchInfo }: { searchInfo?: PesquisaProps }){
    return <>
        <div className="mb-2 d-flex align-items-center gap-2">
            <AdminSharepointSyncButton syncRole={searchInfo?.syncRole} />
            <AdminSyncButton syncRole={searchInfo?.syncRole} />
        </div>
        <div className="alert alert-info" role="alert">
            <h4 className="alert-heading">Sem resultados...</h4>
            <strong><i className="bi bi-lightbulb-fill"></i> Sugestões:</strong>
            <ol>
                <li>Verifique os filtros utilizados (tribunais, relator, data)</li>
                <li>Verifique o termo pesquisado</li>
            </ol>
        </div>
    </>
}

function AdminSharepointSyncButton({ syncRole }: { syncRole?: string | null }) {
    const router = useRouter();
    const user = useAuth();
    const [running, setRunning] = useState(false);
    const [status, setStatus] = useState<{ variant: "success" | "warning" | "danger"; text: string } | null>(null);

    // Visível para todos os utilizadores autenticados e apenas em ambiente interno/dev (SharePoint é estritamente interno)
    if (!user || syncRole === "externo") return null;

    const handleSharepointSync = async () => {
        if (running) return;
        setRunning(true);
        setStatus(null);
        try {
            const res = await fetch(`${router.basePath}/api/gestao/sync-sharepoint`, { method: "POST" });
            const data = await res.json();
            if (!data.ok) {
                setStatus({ variant: "danger", text: data.message || `Erro ${res.status}` });
            } else {
                const text = data.message || (typeof data.found === "number" ? `${data.found} novos acórdãos encontrados.` : "Sincronização SharePoint concluída.");
                setStatus({ variant: "success", text });
            }
        } catch (err: any) {
            setStatus({ variant: "danger", text: err?.message || "Falha de comunicação com o SharePoint." });
        } finally {
            setRunning(false);
            setTimeout(() => {
                setStatus((prev) => (prev?.variant === "success" ? null : prev));
            }, 7000);
        }
    };

    return (
        <div className="d-inline-flex align-items-center gap-1">
            <button
                type="button"
                className="results-toolbar-control border-success text-success"
                onClick={handleSharepointSync}
                disabled={running}
                title="Verificar se existem novos acórdãos nas pastas do SharePoint do STJ e importá-los para o sistema"
                style={{ fontWeight: 600 }}
            >
                {running ? (
                    <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: "12px", height: "12px" }}></span>
                        <span>A verificar SharePoint...</span>
                    </>
                ) : (
                    <>
                        <i className="bi bi-cloud-arrow-down"></i>
                        <span>Sincronizar SharePoint</span>
                    </>
                )}
            </button>
            {status && (
                <span
                    className={`badge bg-${status.variant} d-inline-flex align-items-center gap-1`}
                    style={{ fontSize: "11.5px", padding: "4px 8px", cursor: "pointer", verticalAlign: "middle" }}
                    onClick={() => setStatus(null)}
                    title="Clique para fechar aviso"
                >
                    {status.variant === "success" && <i className="bi bi-check-circle"></i>}
                    {status.variant === "warning" && <i className="bi bi-exclamation-triangle"></i>}
                    {status.variant === "danger" && <i className="bi bi-x-circle"></i>}
                    <span>{status.text}</span>
                    <i className="bi bi-x ms-1" style={{ opacity: 0.8 }}></i>
                </span>
            )}
        </div>
    );
}

function AdminSyncButton({ syncRole }: { syncRole?: string | null }) {
    const router = useRouter();
    const user = useAuth();
    const [running, setRunning] = useState(false);
    const [status, setStatus] = useState<{ variant: "success" | "warning" | "danger"; text: string } | null>(null);

    if (!user) return null;

    const isExterno = syncRole === "externo";
    const endpoint = isExterno ? "/api/gestao/sync-export" : "/api/gestao/sync-request";
    const title = isExterno ? "Exportar para Interno" : "Sincronizar com externo";
    const tooltip = isExterno
        ? "Exportar acórdãos alterados para o Juris Interno por email"
        : "Pedir sincronização ao Juris Externo (as alterações chegam dentro de ~1 min)";

    const handleSync = async () => {
        if (running) return;
        setRunning(true);
        setStatus(null);
        try {
            const res = await fetch(`${router.basePath}${endpoint}`, { method: "POST" });
            const data = await res.json();
            if (!data.ok) {
                setStatus({ variant: "danger", text: data.message || `Erro ${res.status}` });
            } else if (data.refused) {
                setStatus({ variant: "warning", text: data.message || "Sincronização recusada." });
            } else {
                const text = data.message
                    || (typeof data.sent === "number" ? `${data.sent} doc(s) enviado(s).`
                        : typeof data.processed === "number" ? `${data.processed} doc(s) aplicado(s).`
                            : "Sincronização pedida com sucesso.");
                setStatus({ variant: "success", text });
            }
        } catch (err: any) {
            setStatus({ variant: "danger", text: err?.message || "Falha de comunicação." });
        } finally {
            setRunning(false);
            setTimeout(() => {
                setStatus((prev) => (prev?.variant === "success" ? null : prev));
            }, 6000);
        }
    };

    return (
        <div className="d-inline-flex align-items-center gap-1">
            <button
                type="button"
                className="results-toolbar-control border-primary text-primary"
                onClick={handleSync}
                disabled={running}
                title={tooltip}
                style={{ fontWeight: 600 }}
            >
                {running ? (
                    <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: "12px", height: "12px" }}></span>
                        <span>{isExterno ? "A exportar..." : "A sincronizar com externo..."}</span>
                    </>
                ) : (
                    <>
                        <i className={`bi ${isExterno ? "bi-box-arrow-up" : "bi-arrow-repeat"}`}></i>
                        <span>{title}</span>
                    </>
                )}
            </button>
            {status && (
                <span
                    className={`badge bg-${status.variant} d-inline-flex align-items-center gap-1`}
                    style={{ fontSize: "11.5px", padding: "4px 8px", cursor: "pointer", verticalAlign: "middle" }}
                    onClick={() => setStatus(null)}
                    title="Clique para fechar aviso"
                >
                    {status.variant === "success" && <i className="bi bi-check-circle"></i>}
                    {status.variant === "warning" && <i className="bi bi-exclamation-triangle"></i>}
                    {status.variant === "danger" && <i className="bi bi-x-circle"></i>}
                    <span>{status.text}</span>
                    <i className="bi bi-x ms-1" style={{ opacity: 0.8 }}></i>
                </span>
            )}
        </div>
    );
}