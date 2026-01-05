import { withAuthentication } from "@/core/user/authenticate"
import { JurisprudenciaDocument, JurisprudenciaDocumentDateKey, JurisprudenciaDocumentExactKey, JurisprudenciaDocumentGenericKey, JurisprudenciaDocumentStateKey, JurisprudenciaDocumentStateValue, JurisprudenciaDocumentStateValues, JurisprudenciaDocumentTextKey, PartialJurisprudenciaDocument, isJurisprudenciaDocumentContentKey, isJurisprudenciaDocumentDateKey, isJurisprudenciaDocumentExactKey, isJurisprudenciaDocumentGenericKey, isJurisprudenciaDocumentHashKey, isJurisprudenciaDocumentObjectKey, isJurisprudenciaDocumentStateKey, isJurisprudenciaDocumentTextKey } from "@stjiris/jurisprudencia-document";
import { useContext, useState } from "react";

import Link from "next/link";
import { useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { Loading } from "@/components/loading";
import { useFetch } from "@/components/useFetch";
import { GetResponse, WriteResponseBase } from "@elastic/elasticsearch/lib/api/types";
import { useKeysFromContext } from "@/contexts/keys";
import { JurisprudenciaKey } from "@/types/keys";
import { LoggerServerSideProps } from "@/core/logger-api";
import { DateInput, ExactInput, ShowCode, TextInput, TokenSelection, UpdateContext, UpdateObject, ExactInputWithSuggestions } from "@/components/decision/dashboardDoc";
import DecisionView from "@/components/decision/DecisionView";
import GenericPage from "@/components/main_pages/genericPageStructure";

export const getServerSideProps = withAuthentication<{}>(async ctx => {
    LoggerServerSideProps(ctx);
    return {props: {}}
})

interface UpdateProps {
    id: string
    doc: JurisprudenciaDocument
}

export default function UpdatePage() {
    let searchParams = useSearchParams();
    let id = searchParams.get("id");
    let response = useFetch<GetResponse<JurisprudenciaDocument>>(`/api/doc/${id}`, [id]);

    return <GenericPage title="Jurisprudência STJ - Editar Documento">
        {response && response._source && id && <Update doc={response._source} id={id} />}
        {!response && <Loading text="A carregar documento" />}
        {response && !response._source && <div className="alert alert-danger">
            <h3>Erro ao carregar o documento</h3>
        </div>}
    </GenericPage>
}

function Update({ doc, id }: UpdateProps) {
    let keys = useKeysFromContext();
    let [updateObject, setUpdateObject] = useState<UpdateObject>({});

    return <UpdateContext.Provider value={[updateObject, setUpdateObject]}>
        <div className="container-fluid">
            <div className="row">
                <div className="col-6">
                    <DecisionView doc={doc} id={id} keys={keys.keys} />
                </div>
                <div className="card shadow col-6">
                    <UpdateDocument id={id} />
                    {keys.keys.map((key, i) => <EditKey key={i} accessKey={key} doc={doc} />)}
                </div>
            </div>
        </div>
    </UpdateContext.Provider>
}

function EditKey({ accessKey, doc }: { accessKey: JurisprudenciaKey, doc: PartialJurisprudenciaDocument }) {
    if (!accessKey.editorEnabled) {
        return <></>
    }
    if (isJurisprudenciaDocumentObjectKey(accessKey.key) || isJurisprudenciaDocumentHashKey(accessKey.key) || isJurisprudenciaDocumentContentKey(accessKey.key))
        return <ShowCode accessKey={accessKey} doc={doc} />
    if (isJurisprudenciaDocumentDateKey(accessKey.key))
        return <DateInput accessKey={{...accessKey, key: accessKey.key as JurisprudenciaDocumentDateKey}} doc={doc} />
    if (isJurisprudenciaDocumentTextKey(accessKey.key)) {
        return <TextInput accessKey={{...accessKey, key: accessKey.key as JurisprudenciaDocumentTextKey}} doc={doc} />
    }

    if (isJurisprudenciaDocumentGenericKey(accessKey.key)) {
        return <TokenSelection accessKey={{...accessKey, key: accessKey.key as JurisprudenciaDocumentGenericKey}} doc={doc} editorSuggestions={accessKey.editorSuggestions} editorRestricted={accessKey.editorRestricted} />
    }
    if (isJurisprudenciaDocumentExactKey(accessKey.key)) {
        if (accessKey.editorSuggestions) {
            return <ExactInputWithSuggestions accessKey={{...accessKey, key: accessKey.key as JurisprudenciaDocumentExactKey}} doc={doc} />
        }
        return <ExactInput accessKey={{...accessKey, key: accessKey.key as JurisprudenciaDocumentExactKey}} doc={doc} />

    }
    if (isJurisprudenciaDocumentStateKey(accessKey.key))
        return <ExactInput accessKey={{...accessKey, key: accessKey.key as JurisprudenciaDocumentStateKey}} doc={doc} options={JurisprudenciaDocumentStateValues} />

    return <>Unreachable</>
}

function UpdateDocument({ id }: { id: string }) {
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
        if (!confirm("Tem a certeza que quer eliminar o documento?")) return;
        let writeResponseBase = await fetch(`${router.basePath}/api/doc/${id}`, {
            method: "DELETE",
        }).then(r => r.json() as Promise<WriteResponseBase>);
        if (writeResponseBase.result === "updated") {
            navRouter.refresh();
        }
        else {
            navRouter.push("/admin/")
        }
    }

    return <div className="container-fluid alert alert-info col-12 mt-2">
        <div className="row">
            <div className="col-6">
                <h4>Documento</h4>
                <h4><code>{id}</code></h4>
            </div>
            <div className="col-6 text-end">
                <div className="btn-group">
                    <button className="btn btn-secondary" onClick={() => navRouter.back()}>Voltar</button>
                    <button className="btn btn-danger" onClick={deleteDoc} disabled={Object.keys(updateObject).length > 0}>Eliminar</button>
                    <button className="btn btn-warning" onClick={() => navRouter.refresh()} disabled={Object.keys(updateObject).length === 0}>Cancelar</button>
                    <button className="btn btn-success" onClick={update} disabled={Object.keys(updateObject).length === 0}>Guardar</button>
                </div>
            </div>
        </div>
        <div className="row">
            <div className="col-12">
                <ul>
                    {Object.keys(updateObject).map((key, i) => <li key={i}>{keys?.[key as keyof typeof keys]?.name}</li>)}
                </ul>
            </div>
        </div>
    </div>
}