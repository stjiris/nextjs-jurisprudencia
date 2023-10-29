//@ts-nocheck
import { DashboardGenericPage } from "@/components/genericPageStructure"
import { withAuthentication } from "@/core/user/authenticate"
import { JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaDocumentStateValues, PartialJurisprudenciaDocument, isJurisprudenciaDocumentContentKey, isJurisprudenciaDocumentDateKey, isJurisprudenciaDocumentExactKey, isJurisprudenciaDocumentGenericKey, isJurisprudenciaDocumentHashKey, isJurisprudenciaDocumentObjectKey, isJurisprudenciaDocumentStateKey, isJurisprudenciaDocumentTextKey } from "@stjiris/jurisprudencia-document";
import { createContext, useContext, useEffect, useState } from "react";

import Link from "next/link";
import { useParams, useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { ReadOnlyInput, UpdateInput, HTMLInput, UpdateObject, DateInput, TextInput, UpdateContext, ExactInput, GenericInput, ShowCode } from "@/components/dashboardDoc";
import { Loading } from "@/components/loading";
import { useFetch } from "@/components/useFetch";
import { GetResponse, WriteResponseBase } from "@elastic/elasticsearch/lib/api/types";
import { KeysContext, useKeysFromContext } from "@/contexts/keys";
import { JurisprudenciaKey } from "@/types/keys";

export const getServerSideProps = withAuthentication( async (ctx) => ({props: {}}))

interface UpdateProps {
    id: string
    doc: JurisprudenciaDocument
}

export default function UpdatePage(){
    let searchParams = useSearchParams();
    let id = searchParams.get("id");
    let response = useFetch<GetResponse<JurisprudenciaDocument>>(`/api/doc/${id}`, [id]);

    return <DashboardGenericPage>
        {response && response._source && <Update doc={response._source} id={id} />}
        {!response && <Loading text="A carregar documento"/>}
        {response && !response._source && <div className="alert alert-danger">
            <h3>Erro ao carregar o documento</h3>
        </div>}
    </DashboardGenericPage>
}

function Update({doc, id}: UpdateProps){
    let keys = useKeysFromContext();
    let [updateObject, setUpdateObject] = useState<UpdateObject>({});

    return <UpdateContext.Provider value={[updateObject, setUpdateObject]}>
        <div className="row">
            <div className="col-12 col-md-4">
                <div className="card shadow position-sticky top-0">
                    <h4 className="m-0">Original {doc.URL && <>- <Link target="_blank" href={doc.URL}>{doc.Fonte}</Link></>}</h4>
                    <ShowOriginal original={doc.Original || {}}/>
                </div>
            </div>
            <div className="col-12 col-md-8">
                <div className="card shadow">
                    <div className="card-body">
                        <UpdateDocument id={id}/>
                        {keys.keys.map((key, i) => <EditKey key={i} accessKey={key} doc={doc} />)}
                    </div>
                </div>
            </div>
        </div>
    </UpdateContext.Provider>
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

function EditKey({accessKey, doc}: {accessKey: JurisprudenciaKey, doc: PartialJurisprudenciaDocument}){

    if( isJurisprudenciaDocumentObjectKey(accessKey.key) ) return <ShowCode accessKey={accessKey} doc={doc}/>
    if( isJurisprudenciaDocumentHashKey(accessKey.key) ) return <ShowCode accessKey={accessKey} doc={doc}/>
    if( isJurisprudenciaDocumentContentKey(accessKey.key) ) return <ShowCode accessKey={accessKey} doc={doc}/>
    if( isJurisprudenciaDocumentTextKey(accessKey.key) ) return <TextInput accessKey={accessKey} doc={doc}/>
    if( isJurisprudenciaDocumentDateKey(accessKey.key) ) return <DateInput accessKey={accessKey} doc={doc}/>
    if( isJurisprudenciaDocumentStateKey(accessKey.key) ) return <ExactInput accessKey={accessKey} doc={doc} options={JurisprudenciaDocumentStateValues}/>
    if( isJurisprudenciaDocumentExactKey(accessKey.key) ) return <ExactInput accessKey={accessKey} doc={doc}/>
    if( isJurisprudenciaDocumentGenericKey(accessKey.key) ) return <GenericInput accessKey={accessKey} doc={doc}/>
    
    //throw new Error("Unreachable")
    return <>Unreachable</>
}

function UpdateDocument({id}: {id: string}){
    let keys = useKeysFromContext().records;
    let [updateObject,] = useContext(UpdateContext);
    let router = useRouter();
    let navRouter = useNavRouter();
    let update = async () => {
        await fetch(`${router.basePath}/api/doc/${id}`, {
            method: "PUT",
            body: JSON.stringify(updateObject)
        });
        navRouter.refresh();
    }

    let deleteDoc = async () => {
        if( !confirm("Tem a certeza que quer eliminar o documento?") ) return;
        let writeResponseBase = await fetch(`${router.basePath}/api/doc/${id}`, {
            method: "DELETE",
        }).then( r => r.json() as Promise<WriteResponseBase> );
        if( writeResponseBase.result === "updated" ){
            navRouter.refresh();
        }
        else{
            navRouter.push("/admin/doc")
        }
    }

    return <div className="alert alert-info">
        <div className="d-flex">
            <h4 className="flex-shrink-1">Documento <code>{id}</code></h4>
            <div className="flex-grow-1"></div>
            <div className="btn-group">
                <button className="btn btn-secondary" onClick={() => navRouter.push(".")}>Voltar</button>
                <button className="btn btn-danger" onClick={deleteDoc} disabled={Object.keys(updateObject).length > 0}>Eliminar</button>
                <button className="btn btn-warning" onClick={() => navRouter.refresh()} disabled={Object.keys(updateObject).length === 0}>Cancelar</button>
                <button className="btn btn-success" onClick={update} disabled={Object.keys(updateObject).length === 0}>Guardar</button>
            </div>
        </div>
        <ul>
            {Object.keys(updateObject).map((key, i) => <li key={i}>{keys?.[key]?.name}</li>)}
        </ul>
    </div>
}