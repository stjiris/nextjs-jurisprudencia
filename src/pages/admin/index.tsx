import { GetServerSideProps } from "next";
import { DashboardGenericPage } from "@/components/genericPageStructure"
import { withAuthentication } from "@/core/user/authenticate";
import Link from "next/link";
import { ReactNode } from "react";

export const getServerSideProps: GetServerSideProps<{}> = withAuthentication(async (ctx) => ({ props: {} }))

export default function IndexPage() {
    return <DashboardGenericPage>
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <LinkEntry link="/pesquisa" title="Pesquisa">
                            <p>Pesquise normalmente pelos acórdãos. Terá acesso a mais informação e poderá abrir em modo de edição os acórdãos</p>
                        </LinkEntry>
                        <LinkEntry link="/editar/simples/criar" title="Criar Acórdão">
                            <p>Criar acordão manualmente</p>
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

function LinkEntry({ title, link, children }: { title: string, link: string, children: ReactNode }) {
    return <div className="card m-1">
        <div className="card-body">
            <div className="card-title"><Link href={link}>{title}</Link></div>
            {children}
        </div>
    </div>
}