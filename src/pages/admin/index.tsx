import { GetServerSideProps } from "next";
import { DashboardGenericPage } from "@/components/genericPageStructure"
import { withAuthentication } from "@/core/user/authenticate";
import Link from "next/link";
import { ReactNode } from "react";

export const getServerSideProps: GetServerSideProps<{}> = withAuthentication(async (ctx) => ({props: {}}))

export default function IndexPage(){
    return <DashboardGenericPage>
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <LinkEntry link="/admin/doc" title="Documento">
                                <p>Atualizar ou criar acordão</p>
                        </LinkEntry>
                        <LinkEntry link="/admin/bulk" title="Índices">
                                <p>Atualizar vários valores de índices ao mesmo tempo</p>
                        </LinkEntry>
                        <LinkEntry link="/admin/term-info" title="Notas de índices">
                                <p>Atualizar ou criar notas dos índices</p>
                        </LinkEntry>
                        <LinkEntry link="/admin/users" title="Utilizadores">
                                <p>Atualizar, modificar ou criar utilizadores</p>
                        </LinkEntry>
                        <LinkEntry link="/admin/excel" title="Importar/Exportar">
                                <p>Importar ou exportar excel para atualização dos dados</p>
                        </LinkEntry>
                        <LinkEntry link="/admin/filters" title="Filtros">
                                <p>Gerir filtros escondidos ou removidos</p>
                        </LinkEntry>
                    </div>
                </div>
            </div>
        </div>
    </DashboardGenericPage>
}

function LinkEntry({title, link, children}: {title: string, link: string, children: ReactNode}){
    return <div className="card m-1">
        <div className="card-body">
            <div className="card-title"><Link href={link}>{title}</Link></div>
            {children}
        </div>
    </div>
}