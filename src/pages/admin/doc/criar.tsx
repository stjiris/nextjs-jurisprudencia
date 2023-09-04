//@ts-nocheck
import GenericPage, { DashboardGenericPage } from "@/components/genericPageStructure"
import { getElasticSearchClient } from "@/core/elasticsearch";
import { withAuthentication } from "@/core/user/authenticate"
import { JurisprudenciaDocumentArrayKey, JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaVersion, PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { useState, Dispatch, SetStateAction } from "react";
import { useRouter as useNavRouter } from "next/navigation";
import { useRouter } from "next/router";
import { DateInput, HTMLInput, ReadOnlyInput, UpdateInput } from "@/components/dashboardDoc";
import { WriteResponseBase } from "@elastic/elasticsearch/lib/api/types";

export const getServerSideProps = withAuthentication<{}>( async (ctx) => ({props: {}}))

const Sep = () => <div className="m-2 p-0"></div>

const defaultValues: JurisprudenciaDocument = {
    "Número de Processo": "",
    Fonte: "STJ (Manual)",
    URL: "",
    ECLI: "",
    Data: new Date().toLocaleDateString("pt-PT"),
    Área: "",
    "Meio Processual": [""],
    "Relator Nome Completo": "",
    "Relator Nome Profissional": "",
    Secção: "",
    "Tribunal de Recurso": "",
    "Tribunal de Recurso - Processo": "",
    Decisão: [""],
    "Votação": [""],
    Descritores: [""],
    Jurisprudência: ["Simples"],
    "Jurisprudência Estrangeira": [""],
    "Jurisprudência Internacional": [""],
    "Jurisprudência Nacional": [""],
    "Doutrina": [""],
    "Legislação Comunitária": [""],
    "Legislação Estrangeira": [""],
    "Legislação Nacional": [""],
    "Referências Internacionais": [""],
    "Referência de publicação": [""],
    "Área Temática": [""],
    "Indicações Eventuais": [""],
    CONTENT: [],
    HASH: {},
    Original: {},
    UUID: "",
    Sumário: "",
    Texto: ""
}

export default function Create(){
    const navRouter = useNavRouter();
    const router = useRouter();
    const [updateObj, setUpdateObj] = useState<PartialJurisprudenciaDocument>(defaultValues)

    
    const save = async () => {
        let object = {...defaultValues, ...updateObj};
        fetch(`${router.basePath}/api/doc/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(object)
        }).then(r => r.status === 200 ? r.json() : r.status).then( (r: WriteResponseBase | number)  => {
            if( typeof r === "number" ){
                alert(`Não foi possível criar documento. (${r})`)
            }
            else{
                navRouter.push(`/admin/doc/${r._id}`);
            }

        })
    }


    return <DashboardGenericPage>
        <div className="alert alert-danger">New version doesn support edditing yet</div>
    </DashboardGenericPage>
    /*    <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <ReadOnlyInput accessKey="ID" value="" />
                        <Sep/>
                        <UpdateInput accessKey="Número de Processo" value={defaultValues["Número de Processo"]} setUpdateObject={setUpdateObj}/>
                        <ReadOnlyInput accessKey="Fonte" value={defaultValues["Fonte"]}/>
                        <UpdateInput accessKey="URL" value={defaultValues["URL"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="ECLI" value={defaultValues["ECLI"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <DateInput accessKey="Data" value={defaultValues["Data"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Área" value={defaultValues["Área"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Meio Processual" value={defaultValues["Meio Processual"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Relator Nome Profissional" value={defaultValues["Relator Nome Profissional"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Relator Nome Completo" value={defaultValues["Relator Nome Completo"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Secção" value={defaultValues["Secção"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Tribunal de Recurso" value={defaultValues["Tribunal de Recurso"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Tribunal de Recurso - Processo" value={defaultValues["Tribunal de Recurso - Processo"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Decisão" value={defaultValues.Decisão} setUpdateObject={setUpdateObj}/>
                        <ReadOnlyInput accessKey="Decisão (textual)" value=""/>
                        <UpdateInput accessKey="Votação - Decisão" value={defaultValues["Votação - Decisão"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Votação - Vencidos" value={defaultValues["Votação - Vencidos"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Votação - Declarações" value={defaultValues["Votação - Declarações"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Descritores" value={defaultValues["Descritores"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Jurisprudência" value={defaultValues["Jurisprudência"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Jurisprudência Estrangeira" value={defaultValues["Jurisprudência Estrangeira"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Jurisprudência Internacional" value={defaultValues["Jurisprudência Internacional"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Jurisprudência Nacional" value={defaultValues["Jurisprudência Nacional"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Doutrina" value={defaultValues["Doutrina"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Legislação Comunitária" value={defaultValues["Legislação Comunitária"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Legislação Estrangeira" value={defaultValues["Legislação Estrangeira"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Legislação Nacional" value={defaultValues["Legislação Nacional"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Referências Internacionais" value={defaultValues["Referências Internacionais"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Referência de publicação" value={defaultValues["Referência de publicação"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Área Temática" value={defaultValues["Área Temática"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Indicações Eventuais" value={defaultValues["Indicações Eventuais"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <HTMLInput accessKey="Sumário" value={defaultValues["Sumário"]} setUpdateObject={setUpdateObj}/>
                        <HTMLInput accessKey="Texto" value={defaultValues["Texto"]} setUpdateObject={setUpdateObj}/>
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
    </DashboardGenericPage>*/
}
