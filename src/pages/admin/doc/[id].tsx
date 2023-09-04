//@ts-nocheck
import { DashboardGenericPage } from "@/components/genericPageStructure"
import { withAuthentication } from "@/core/user/authenticate"
import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { useEffect, useState } from "react";

import Link from "next/link";
import { useParams, useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { ReadOnlyInput, UpdateInput, HTMLInput, UpdateObject } from "@/components/dashboardDoc";
import { Loading } from "@/components/loading";

export const getServerSideProps = withAuthentication( async (ctx) => ({props: {}}))

interface UpdateProps {
    id: string
    doc: JurisprudenciaDocument
}

const Sep = () => <div className="m-2 p-0"></div>

export default function UpdatePage(){
    let [error, setError] = useState<string>()
    let [props, setProps] = useState<UpdateProps>();
    let searchParams = useSearchParams();
    let router = useRouter();
    useEffect(() => {
        let id = searchParams.get("id");
        if( id ){
            fetch(`${router.basePath}/api/doc/${id}`)
                .then(r => r.status === 200 ?
                    r.json().then( esr => setProps({doc:esr._source, id: id!}))
                    :
                    setError(`Erro ao aceder ao documento. (${r.status} ${r.statusText})`))
        }
    },[searchParams, router.basePath])
    return <DashboardGenericPage>
        <div className="alert alert-danger">New version doesn support edditing yet</div>
        {props && <Update doc={props.doc} id={props.id} />}
        {!props && !error && <Loading text="A carregar documento"/>}
        {error && <div className="alert alert-danger">
            <h3>{error}</h3>
        </div>}
    </DashboardGenericPage>
}

function Update({doc, id}: UpdateProps){
    let [updateObj, setUpdateObj] = useState<UpdateObject>({})
    let navRouter = useNavRouter();
    let router = useRouter();
    const save = async () => {
        fetch(`${router.basePath}/api/doc/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(updateObj)
        }).finally(() => {
            navRouter.refresh()
        })
    }

    const del = async () => {
        let r = prompt("Tem a certeza que quer eliminar o documento? Insira o Número de Processo:");
        if( r !== doc["Número de Processo"] ) return;
        fetch(`${router.basePath}/api/doc/${id}`, {
            method: "DELETE"
        }).finally(() => {
            navRouter.push(`/admin/doc`)
        })
    }
    
    return <>
        <div className="row">
            <div className="col-12 col-md-4 col-xl-6">
                <div className="card shadow position-sticky top-0">
                    <h4 className="m-0">Original {doc.URL && <>- <Link target="_blank" href={doc.URL}>{doc.Fonte}</Link></>}</h4>
                    <ShowOriginal original={doc.Original || {}}/>
                </div>
            </div>
            <div className="col-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <ReadOnlyInput accessKey="ID" value={id} />
                        <Sep/>
                        <UpdateInput accessKey="Número de Processo" value={doc["Número de Processo"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Fonte" value={doc["Fonte"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="URL" value={doc["URL"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="ECLI" value={doc["ECLI"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Data" value={doc["Data"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Área" value={doc["Área"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Meio Processual" value={doc["Meio Processual"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Relator Nome Profissional" value={doc["Relator Nome Profissional"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Relator Nome Completo" value={doc["Relator Nome Completo"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Secção" value={doc["Secção"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Tribunal de Recurso" value={doc["Tribunal de Recurso"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Tribunal de Recurso - Processo" value={doc["Tribunal de Recurso - Processo"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Decisão" value={doc["Decisão"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Votação" value={doc["Votação"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Descritores" value={doc["Descritores"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Jurisprudência" value={doc["Jurisprudência"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Jurisprudência Estrangeira" value={doc["Jurisprudência Estrangeira"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Jurisprudência Internacional" value={doc["Jurisprudência Internacional"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Jurisprudência Nacional" value={doc["Jurisprudência Nacional"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Doutrina" value={doc["Doutrina"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Legislação Comunitária" value={doc["Legislação Comunitária"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Legislação Estrangeira" value={doc["Legislação Estrangeira"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Legislação Nacional" value={doc["Legislação Nacional"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Referências Internacionais" value={doc["Referências Internacionais"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Referência de publicação" value={doc["Referência de publicação"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Área Temática" value={doc["Área Temática"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Indicações Eventuais" value={doc["Indicações Eventuais"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <HTMLInput accessKey="Sumário" value={doc["Sumário"]} setUpdateObject={setUpdateObj}/>
                        <HTMLInput accessKey="Texto" value={doc["Texto"]} setUpdateObject={setUpdateObj}/>
                    </div>
                    <div className="card-footer">
                        <div className="alert alert-info" role="alert">
                        {Object.keys(updateObj).length > 0 ?
                            <>
                                <h3>Os seguintes campos serão atualizados:</h3>
                                <ul>
                                    {Object.keys(updateObj).map((k,i) => <li key={i}>{k}</li>)}
                                </ul>
                                <button className="btn btn-warning" onClick={() => {navRouter.refresh()}}>Cancelar</button>
                                <button className="btn btn-primary" onClick={() => {save()}}>Confirmar alterações</button>
                            </>
                            :
                            <>
                                <h3>Sem alterações</h3>
                                <Link className="btn btn-warning" href=".">Cancelar</Link>
                                <button className="btn btn-danger" onClick={() => del()}>Eliminar</button>
                            </>
                        }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </>
}

function ShowOriginal({original}: {original: Record<string, any>}){
    return <table className="table table-sm">
        <tbody>
            {Object.entries(original).map(([accessKey, obj], i) => obj.length > 1200 ?
                <tr key={i}>
                    <td colSpan={2}>
                        <details>
                            <summary>{accessKey}</summary>
                            <div dangerouslySetInnerHTML={{__html: obj}}></div>
                        </details>
                    </td>
                </tr>
                :
                <tr key={i}>
                    <td>{accessKey}</td>
                    <td dangerouslySetInnerHTML={{__html: obj}}></td>
                </tr>
            )}
        </tbody>
    </table>
}