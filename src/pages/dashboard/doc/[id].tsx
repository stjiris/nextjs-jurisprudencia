import GenericPage, { DashboardGenericPage } from "@/components/genericPageStructure"
import { getElasticSearchClient } from "@/core/elasticsearch";
import { withAuthentication } from "@/core/user/authenticate"
import { JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { useState, Dispatch, SetStateAction, useCallback, useEffect } from "react";

import dynamic from 'next/dynamic';
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import 'react-quill/dist/quill.snow.css';

import Link from "next/link";
import { useRouter as useNavRouter } from "next/navigation";
import { useRouter } from "next/router";

export const getServerSideProps = withAuthentication<UpdateProps>( async (ctx) => {
    let id = Array.isArray(ctx.query.id) ? ctx.query.id[0] : ctx.query.id || "";
    if(!id) throw new Error("Invalid request")

    let client = await getElasticSearchClient();

    return client.get<JurisprudenciaDocument>({
        index: JurisprudenciaVersion,
        id: id
    }).then(r => ({props: {doc: r._source!, id: id}}))
}, (ctx) => {
    return `/dashboard/doc/${ctx.params?.id || ""}`
})

interface UpdateObject extends Record<string, string | string []>{}

interface UpdateProps {
    doc: JurisprudenciaDocument,
    id: string
}

const Sep = () => <div className="m-2 p-0"></div>

export default function Update({doc, id}: UpdateProps){
    let [updateObj, setUpdateObj] = useState<UpdateObject>({})
    let navRouter = useNavRouter();
    let router = useRouter();
    const save = async () => {
        fetch(`${router.basePath}/api/doc/${id}/update`)
    }
    
    return <DashboardGenericPage>
        <div className="row">
            <div className="col-12 col-md-4 col-xl-6">
                <div className="card shadow position-sticky top-0">
                    <h4 className="m-0">Original {doc.URL && <>- <Link target="_blank" href={doc.URL}>{doc.Fonte}</Link></>}</h4>
                    <ShowOriginal original={doc.Original}/>
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
                        <UpdateInput accessKey="Secção" value={doc["Secção"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Tribunal de Recurso" value={doc["Tribunal de Recurso"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Tribunal de Recurso - Processo" value={doc["Tribunal de Recurso - Processo"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Decisão" value={doc["Decisão"]} setUpdateObject={setUpdateObj}/>
                        <ReadOnlyInput accessKey="Decisão (textual)" value={doc["Decisão (textual)"]} />
                        <UpdateInput accessKey="Votação - Decisão" value={doc["Votação - Decisão"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Votação - Vencidos" value={doc["Votação - Vencidos"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Votação - Declarações" value={doc["Votação - Declarações"]} setUpdateObject={setUpdateObj}/>
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
                            <h3>Sem alterações</h3>
                        }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </DashboardGenericPage>
}

type MaybeKeyOfJurisprudencia = JurisprudenciaDocumentKey | (string & Record<never,never>)

function HTMLInput({accessKey, value, setUpdateObject}: {accessKey: MaybeKeyOfJurisprudencia, value: string, setUpdateObject: Dispatch<SetStateAction<UpdateObject>>}){
    let [html, setValue] = useState<string>(value);
    let [edit, setEdit] = useState<boolean>(false);

    useEffect(() => {
        if( !edit ){
            // Reset values
            setValue(value);
            setUpdateObject(({[accessKey]: _curr, ...old}) => ({...old}))
        }
    },[edit])

    let onChange = useCallback((newvalue: string) => {
        setUpdateObject(old => ({...old, [accessKey]: newvalue}))
        setValue(newvalue)
    }, [])
    
    return <>
        <div className="d-flex align-items-baseline my-2">
            <h4 className="m-0 w-25">{accessKey}{value === html ? "" : "*"}</h4>
            <button className="btn btn-warning mx-1" onClick={() => setEdit((v) => !v)}>{edit ? "Cancelar" : "Editar"}</button>
        </div>
        {edit && <ReactQuill theme="snow" value={html} onChange={onChange}/>}
    </>
}

function ReadOnlyInput({accessKey, value}: {accessKey: MaybeKeyOfJurisprudencia, value: string | string[]}){
    return <div className="input-group">
        <small className="input-group-text w-25">{accessKey}</small>
        <input className="form-control" value={value} readOnly/>
    </div>
}

function UpdateInput({accessKey, value, setUpdateObject}: {accessKey: MaybeKeyOfJurisprudencia, value: string | string[], setUpdateObject: Dispatch<SetStateAction<UpdateObject>>}){
    let [toSave, setToSave] = useState<boolean>(false)
    let update = (key: string, newValue: string | string[]) => {
        if( JSON.stringify(newValue) === JSON.stringify(value) ){
            setUpdateObject(({[key]: _key_to_remove, ...old}) => ({...old}))
            setToSave(false)
        }
        else{
            setUpdateObject((old) => ({...old, [key]: newValue}))
            setToSave(true)
        }
    }

    let toSaveString = toSave ? "*" : "";

    if( typeof value === "string" ){
        return <div className="input-group">
            <small className="input-group-text w-25">{accessKey}{toSaveString}</small>
            <input className="form-control" defaultValue={value} onInput={(evt) => update(accessKey, evt.currentTarget.value)}/>
        </div>
    }
    else if(Array.isArray(value)){
        return <div className="input-group">
            <small className="input-group-text w-25">{accessKey}{toSaveString}</small>
            <textarea className="form-control" defaultValue={value.join("\n")} rows={value.length} onInput={(evt) => update(accessKey, evt.currentTarget.value.split("\n"))}/>
        </div>
    }
    else{
        return <div className="input-group">
            <small className="input-group-text w-25">{accessKey}{toSaveString}</small>
            <textarea className="form-control" readOnly value={JSON.stringify(value, null, "  ")} rows={JSON.stringify(value, null, "   ").split("\n").length}/>
        </div>
    }
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