import { GetServerSideProps } from "next";
import { DashboardGenericPage } from "@/components/genericPageStructure"
import { withAuthentication } from "@/core/user/authenticate";
import Link from "next/link";

export const getServerSideProps: GetServerSideProps<{}> = withAuthentication(async (ctx) => ({props: {}}))

export default function IndexPage(){
    return <DashboardGenericPage>
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body d-flex flex-wrap">
                        <div className="card m-1">
                            <div className="card-body">
                                <div className="card-title"><Link href="/dashboard/doc">Documento</Link></div>
                                <p>Atualizar ou criar acordão</p>
                            </div>
                        </div>
                        <div className="card m-1">
                            <div className="card-body">
                                <div className="card-title"><Link href="/dashboard/bulk">Índices</Link></div>
                                <p>Atualizar vários valores de índices ao mesmo tempo</p>
                            </div>
                        </div>
                        <div className="card m-1">
                            <div className="card-body">
                                <div className="card-title"><Link href="/dashboard/term-info">Notas de índices</Link></div>
                                <p>Atualizar ou criar notas dos índices</p>
                            </div>
                        </div>
                        <div className="card m-1">
                            <div className="card-body">
                                <div className="card-title"><Link href="/dashboard/users">Utilizadores</Link></div>
                                <p>Atualizar, modificar ou criar utilizadores</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </DashboardGenericPage>
}