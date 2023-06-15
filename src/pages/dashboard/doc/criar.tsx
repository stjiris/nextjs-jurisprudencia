import GenericPage, { DashboardGenericPage } from "@/components/genericPageStructure"
import { getElasticSearchClient } from "@/core/elasticsearch";
import { withAuthentication } from "@/core/user/authenticate"
import { JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { useState, Dispatch, SetStateAction } from "react";
import { useRouter as useNavRouter } from "next/navigation";
import { useRouter } from "next/router";
import { HTMLInput, ReadOnlyInput, UpdateInput } from "@/components/dashboardDoc";
import { WriteResponseBase } from "@elastic/elasticsearch/lib/api/types";

export const getServerSideProps = withAuthentication<{}>( async (ctx) => {
    return {props: {}}
}, "/dashboard/doc/criar")

const Sep = () => <div className="m-2 p-0"></div>

export default function Create(){
    const navRouter = useNavRouter();
    const router = useRouter();
    const [updateObj, setUpdateObj] = useState<Record<string, string | string[]>>({})

    const save = async () => {
        fetch(`${router.basePath}/api/doc/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(updateObj)
        }).then(r => r.status === 200 ? r.json() : r.status).then( (r: WriteResponseBase | number)  => {
            if( typeof r === "number" ){
                alert(`Não foi possível criar documento. (${r})`)
            }
            else{
                navRouter.push(`/dashboard/doc/${r._id}`);
            }

        })
    }


    return <DashboardGenericPage>
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <ReadOnlyInput accessKey="ID" value={""} />
                        <Sep/>
                        <UpdateInput accessKey="Número de Processo" value="" setUpdateObject={setUpdateObj}/>
                        <ReadOnlyInput accessKey="Fonte" value="STJ (manual)"/>
                        <UpdateInput accessKey="URL" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="ECLI" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Data" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Área" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Meio Processual" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Relator Nome Profissional" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Secção" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Tribunal de Recurso" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Tribunal de Recurso - Processo" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Decisão" value="" setUpdateObject={setUpdateObj}/>
                        <ReadOnlyInput accessKey="Decisão (textual)" value=""/>
                        <UpdateInput accessKey="Votação - Decisão" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Votação - Vencidos" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Votação - Declarações" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Descritores" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Jurisprudência" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Jurisprudência Estrangeira" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Jurisprudência Internacional" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Jurisprudência Nacional" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Doutrina" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Legislação Comunitária" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Legislação Estrangeira" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Legislação Nacional" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Referências Internacionais" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Referência de publicação" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Área Temática" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Indicações Eventuais" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <HTMLInput accessKey="Sumário" value="" setUpdateObject={setUpdateObj}/>
                        <HTMLInput accessKey="Texto" value="" setUpdateObject={setUpdateObj}/>
                    </div>
                    <div className="card-footer">
                        <div className="alert alert-info" role="alert">
                        {Object.keys(updateObj).length > 0 ?
                            <>
                                <h3>Será criado um documento com os seguintes campos:</h3>
                                <ul>
                                    {Object.keys(updateObj).map((k,i) => <li key={i}>{k}</li>)}
                                </ul>
                                <button className="btn btn-warning" onClick={() => {navRouter.refresh()}}>Cancelar</button>
                                <button className="btn btn-primary" onClick={() => {save()}}>Criar documento</button>
                            </>
                            :
                            <h3>Sem campos preenchidos</h3>
                        }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </DashboardGenericPage>
}
