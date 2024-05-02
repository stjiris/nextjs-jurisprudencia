//@ts-nocheck
import { DashboardGenericPage } from "@/components/genericPageStructure"
import { withAuthentication } from "@/core/user/authenticate"
import { JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaDocumentStateKeys, JurisprudenciaDocumentStateValues, PartialJurisprudenciaDocument, isJurisprudenciaDocumentContentKey, isJurisprudenciaDocumentDateKey, isJurisprudenciaDocumentExactKey, isJurisprudenciaDocumentGenericKey, isJurisprudenciaDocumentHashKey, isJurisprudenciaDocumentObjectKey, isJurisprudenciaDocumentStateKey, isJurisprudenciaDocumentTextKey } from "@stjiris/jurisprudencia-document";
import { createContext, useContext, useEffect, useState } from "react";

import Link from "next/link";
import { useParams, useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { ReadOnlyInput, UpdateInput, HTMLInput, UpdateObject, DateInput, TextInput, UpdateContext, ExactInput, GenericInput, ShowCode, ShowGenerated } from "@/components/dashboardDoc";
import { Loading } from "@/components/loading";
import { useFetch } from "@/components/useFetch";
import { GetResponse, WriteResponseBase } from "@elastic/elasticsearch/lib/api/types";
import { KeysContext, useKeysFromContext } from "@/contexts/keys";
import { JurisprudenciaKey } from "@/types/keys";
import { LoggerServerSideProps } from "@/core/logger-api";

export const getServerSideProps = withAuthentication<{}>(async ctx => {
    LoggerServerSideProps(ctx);
    return {props: {}}
})

export default function CreatePage() {
    return <DashboardGenericPage>
        <Link href="/editar/simples/criar">Mudar para modo simples</Link>
        <Create />
    </DashboardGenericPage>
}

function Create() {
    let keys = useKeysFromContext();
    let [updateObject, setUpdateObject] = useState<UpdateObject>({});

    return <UpdateContext.Provider value={[updateObject, setUpdateObject]}>
        <div className="row">
            <div className="col-12">
                <div className="card shadow">
                    <div className="card-body">
                        <CreateDocument />
                        {keys.keys.map((key, i) => <CreateKey key={i} accessKey={key} doc={{ STATE: "público" }} />)}
                    </div>
                </div>
            </div>
        </div>
    </UpdateContext.Provider>
}

const AUTO_GENERATED: JurisprudenciaDocumentKey[] = ["Fonte", "CONTENT", "Original", "HASH", "UUID"]

function CreateKey({ accessKey, doc }: { accessKey: JurisprudenciaKey, doc: PartialJurisprudenciaDocument }) {

    if (AUTO_GENERATED.includes(accessKey.key)) return <ShowGenerated accessKey={accessKey} />;
    if (isJurisprudenciaDocumentObjectKey(accessKey.key)) return <ShowCode accessKey={accessKey} doc={doc} />
    if (isJurisprudenciaDocumentHashKey(accessKey.key)) return <ShowCode accessKey={accessKey} doc={doc} />
    if (isJurisprudenciaDocumentContentKey(accessKey.key)) return <ShowCode accessKey={accessKey} doc={doc} />
    if (isJurisprudenciaDocumentTextKey(accessKey.key)) return <TextInput accessKey={accessKey} doc={doc} />
    if (isJurisprudenciaDocumentDateKey(accessKey.key)) return <DateInput accessKey={accessKey} doc={doc} />
    if (isJurisprudenciaDocumentStateKey(accessKey.key)) return <ExactInput accessKey={accessKey} doc={doc} options={JurisprudenciaDocumentStateValues} />
    if (isJurisprudenciaDocumentExactKey(accessKey.key)) return <ExactInput accessKey={accessKey} doc={doc} />
    if (isJurisprudenciaDocumentGenericKey(accessKey.key)) return <GenericInput accessKey={accessKey} doc={doc} />

    //throw new Error("Unreachable")
    return <>Unreachable</>
}

function CreateDocument() {
    let keys = useKeysFromContext().records;
    let [updateObject,] = useContext(UpdateContext);
    let router = useRouter();
    let navRouter = useNavRouter();
    let update = async () => {
        let writeResponseBase = await fetch(`${router.basePath}/api/doc`, {
            method: "POST",
            body: JSON.stringify(updateObject)
        }).then(r => r.json() as Promise<WriteResponseBase>);
        navRouter.push(`./${writeResponseBase._id}`)
    }

    return <div className="alert alert-info">
        <div className="d-flex">
            <h4 className="flex-shrink-1">Documento <code>(novo)</code></h4>
            <div className="flex-grow-1"></div>
            <div className="btn-group">
                <button className="btn btn-secondary" onClick={() => navRouter.back()}>Voltar</button>
                <button className="btn btn-warning" onClick={() => navRouter.refresh()} disabled={Object.keys(updateObject).length === 0}>Cancelar</button>
                <button className="btn btn-success" onClick={update} disabled={Object.keys(updateObject).length === 0}>Guardar</button>
            </div>
        </div>
        <ul>
            {Object.keys(updateObject).map((key, i) => <li key={i}>{keys?.[key]?.name}</li>)}
        </ul>
    </div>
}