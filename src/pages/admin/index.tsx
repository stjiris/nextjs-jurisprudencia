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
                            <p>Criar acordão manualmente</p>
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
                        {can('manageUsers') && syncRole === "interno" && <SyncTrigger
                            title="Sincronizar com Externo"
                            description="Importar as alterações enviadas pelo juris externo (o externo sobrepõe os dados locais)."
                            endpoint="/api/gestao/sync-import"
                        />}
                        {can('manageUsers') && syncRole === "externo" && <SyncTrigger
                            title="Exportar para Interno"
                            description="Enviar por email todos os documentos alterados desde a última exportação."
                            endpoint="/api/gestao/sync-export"
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

function SyncTrigger({ title, description, endpoint }: { title: string, description: string, endpoint: string }) {
    const router = useRouter();
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const trigger = async () => {
        setRunning(true);
        setResult(null);
        try {
            const res = await fetch(`${router.basePath}${endpoint}`, { method: "POST" });
            const data = await res.json();
            if (data.ok) {
                setResult(`Concluído: ${JSON.stringify(data)}`);
            } else {
                setResult(`Erro: ${data.message || res.status}`);
            }
        } catch (err: any) {
            setResult(`Erro: ${err?.message || "falha de rede"}`);
        } finally {
            setRunning(false);
        }
    };

    return <div className="card m-1">
        <div className="card-body">
            <div className="card-title">{title}</div>
            <p>{description}</p>
            <button className="btn btn-primary btn-sm" onClick={trigger} disabled={running}>
                {running ? "A executar..." : title}
            </button>
            {result && <div className="mt-2 small text-muted">{result}</div>}
        </div>
    </div>
}