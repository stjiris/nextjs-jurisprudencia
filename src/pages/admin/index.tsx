import { GetServerSideProps } from "next";
import { getUserRole, withAuthentication } from "@/core/user/authenticate";
import { Feature, Role, roleCanAccess } from "@/core/user/roles";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { useRouter } from "next/router";
import { LoggerServerSideProps } from "@/core/logger-api";
import GenericPage from "@/components/main_pages/genericPageStructure";

interface IndexPageProps {
    role: Role;
    syncRole: string | null;
}

export const getServerSideProps = LoggerServerSideProps(withAuthentication<IndexPageProps>(async ctx => {
    const role = await getUserRole(ctx.req) ?? 'editor';
    return { props: { role, syncRole: process.env.SYNC_ROLE || null } }
}))

export default function IndexPage({ role, syncRole }: IndexPageProps) {
    const can = (feature: Feature) => roleCanAccess(role, feature);

    return <GenericPage title="Jurisprudência STJ - Administração">
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <LinkEntry link="/pesquisa" title="Pesquisa">
                            <p>Pesquise normalmente pelos acórdãos. Terá acesso a mais informação e poderá abrir em modo de edição os acórdãos</p>
                        </LinkEntry>
                        <LinkEntry link="/editar/criar" title="Criar Acórdão">
                            <p>Criar acórdão manualmente ou por importação automática de ficheiro (.docx / .pdf)</p>
                        </LinkEntry>
                        {can('importExport') && <LinkEntry link="/admin/excel" title="Importar/Exportar">
                            <p>Importar ou exportar excel para atualização dos dados</p>
                        </LinkEntry>}
                        {can('filters') && <LinkEntry link="/admin/filters" title="Filtros">
                            <p>Gerir filtros escondidos ou removidos</p>
                        </LinkEntry>}
                        {can('manageUsers') && <LinkEntry link="/admin/users" title="Utilizadores">
                            <p>Criar e gerir utilizadores</p>
                        </LinkEntry>}
                        {can('manageUsers') && <LinkEntry link="/admin/logs" title="Registo de Atividade">
                            <p>Consultar o registo de ações realizadas no sistema</p>
                        </LinkEntry>}
                        <LinkEntry link="/changelog" title="Registo de Alterações (Changelog)">
                            <p>Consultar histórico de versões, notas de lançamento e melhorias do sistema</p>
                        </LinkEntry>
                        <CleanDraftsTrigger />
                        {syncRole !== "externo" && <SyncTrigger
                            title="Sincronizar SharePoint"
                            description="Verificar novas minutas e acórdãos nas pastas do SharePoint do STJ (Anonimização e Jurisprudência/Acórdãos) e importar para o estado de 'importação'."
                            endpoint="/api/gestao/sync-sharepoint"
                            icon="bi-cloud-arrow-down"
                        />}
                        {syncRole === "interno" && <SyncTrigger
                            title="Sincronizar com externo"
                            description="Pedir ao juris externo as últimas alterações (o externo sobrepõe os dados locais). As alterações chegam dentro de ~1 min."
                            endpoint="/api/gestao/sync-request"
                            icon="bi-arrow-repeat"
                        />}
                        {syncRole === "externo" && <SyncTrigger
                            title="Exportar para Interno"
                            description="Enviar por email todos os documentos alterados desde a última exportação."
                            endpoint="/api/gestao/sync-export"
                            icon="bi-box-arrow-up"
                        />}
                    </div>
                </div>
            </div>
        </div>
    </GenericPage>
}

function LinkEntry({ title, link, children }: { title: string, link: string, children: ReactNode }) {
    return <div className="card m-1">
        <div className="card-body">
            <div className="card-title"><Link href={link}>{title}</Link></div>
            {children}
        </div>
    </div>
}

function SyncTrigger({ title, description, endpoint, icon }: { title: string, description: string, endpoint: string, icon: string }) {
    const router = useRouter();
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<{ variant: "success" | "warning" | "danger", text: string } | null>(null);

    const trigger = async () => {
        setRunning(true);
        setResult(null);
        try {
            const res = await fetch(`${router.basePath}${endpoint}`, { method: "POST" });
            const data = await res.json();
            if (!data.ok) {
                setResult({ variant: "danger", text: data.message || `Erro ${res.status}` });
            } else if (data.refused) {
                setResult({ variant: "warning", text: data.message || "Sincronização recusada." });
            } else {
                const text = data.message
                    || (typeof data.sent === "number" ? `${data.sent} documento(s) enviado(s).`
                        : typeof data.processed === "number" ? `${data.processed} documento(s) aplicado(s).`
                            : "Concluído.");
                setResult({ variant: "success", text });
            }
        } catch (err: any) {
            setResult({ variant: "danger", text: err?.message || "Falha de rede." });
        } finally {
            setRunning(false);
        }
    };

    return <div className="card m-1">
        <div className="card-body">
            <div className="card-title">{title}</div>
            <p>{description}</p>
            <button className="btn btn-primary" onClick={trigger} disabled={running}>
                {running
                    ? <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>A processar…</>
                    : <><i className={`bi ${icon} me-2`}></i>{title}</>}
            </button>
            {result && <div className={`alert alert-${result.variant} mt-3 mb-0 py-2`} role="alert">{result.text}</div>}
        </div>
    </div>
}

function CleanDraftsTrigger() {
    const router = useRouter();
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<{ variant: "success" | "warning" | "danger", text: string } | null>(null);

    const trigger = async (mode: "published_only" | "all") => {
        const confirmMsg = mode === "all"
            ? "Tem a certeza que quer limpar TODOS os acórdãos em 'importação' e 'preparação'?"
            : "Limpar apenas os acórdãos em 'importação' e 'preparação' que já se encontram publicados?";
        if (!confirm(confirmMsg)) return;

        setRunning(true);
        setResult(null);
        try {
            const res = await fetch(`${router.basePath}/api/gestao/limpar-rascunhos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, action: "eliminar" })
            });
            const data = await res.json();
            if (!data.ok) {
                setResult({ variant: "danger", text: data.message || `Erro ${res.status}` });
            } else {
                setResult({ variant: "success", text: data.message || `${data.cleaned} acórdãos limpos.` });
            }
        } catch (err: any) {
            setResult({ variant: "danger", text: err?.message || "Falha de rede." });
        } finally {
            setRunning(false);
        }
    };

    return <div className="card m-1">
        <div className="card-body">
            <div className="card-title fw-bold">Limpeza de Rascunhos e Duplicados</div>
            <p className="text-muted small">
                Limpar acórdãos pendentes em &apos;importação&apos; ou &apos;preparação&apos; que já se encontram publicados noutras plataformas (ou limpar todos para permitir sincronização limpa).
            </p>
            <div className="d-flex gap-2">
                <button
                    type="button"
                    className="btn btn-outline-warning btn-sm"
                    disabled={running}
                    onClick={() => trigger("published_only")}
                >
                    <i className="bi bi-eraser me-1"></i>
                    {running ? "A processar..." : "Limpar Apenas Já Publicados"}
                </button>
                <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    disabled={running}
                    onClick={() => trigger("all")}
                >
                    <i className="bi bi-trash me-1"></i>
                    {running ? "A processar..." : "Limpar Todas as Listas"}
                </button>
            </div>
            {result && (
                <div className={`alert alert-${result.variant} mt-2 py-1 px-2 small mb-0`} role="alert">
                    {result.text}
                </div>
            )}
        </div>
    </div>;
}