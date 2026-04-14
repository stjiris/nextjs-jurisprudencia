import { GetServerSideProps } from "next";
import { getUserRole, withAuthentication } from "@/core/user/authenticate";
import { Feature, Role, roleCanAccess } from "@/core/user/roles";
import Link from "next/link";
import { ReactNode } from "react";
import { LoggerServerSideProps } from "@/core/logger-api";
import GenericPage from "@/components/main_pages/genericPageStructure";

interface IndexPageProps {
    role: Role;
}

export const getServerSideProps = LoggerServerSideProps(withAuthentication<IndexPageProps>(async ctx => {
    const role = await getUserRole(ctx.req) ?? 'editor';
    return { props: { role } }
}))

export default function IndexPage({ role }: IndexPageProps) {
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