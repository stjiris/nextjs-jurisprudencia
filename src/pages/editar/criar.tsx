import { withAuthentication } from "@/core/user/authenticate"
import { JurisprudenciaDocumentDateKey, JurisprudenciaDocumentExactKey, JurisprudenciaDocumentGenericKey, JurisprudenciaDocumentKey, JurisprudenciaDocumentStateKey, JurisprudenciaDocumentStateValues, JurisprudenciaDocumentTextKey, PartialJurisprudenciaDocument, isJurisprudenciaDocumentContentKey, isJurisprudenciaDocumentDateKey, isJurisprudenciaDocumentExactKey, isJurisprudenciaDocumentGenericKey, isJurisprudenciaDocumentHashKey, isJurisprudenciaDocumentObjectKey, isJurisprudenciaDocumentStateKey, isJurisprudenciaDocumentTextKey } from "@stjiris/jurisprudencia-document";
import { useContext, useState } from "react";

import Link from "next/link";
import { useParams, useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { WriteResponseBase } from "@elastic/elasticsearch/lib/api/types";
import { useKeysFromContext } from "@/contexts/keys";
import { JurisprudenciaKey } from "@/types/keys";
import { LoggerServerSideProps } from "@/core/logger-api";
import { DateInput, ExactInput, ExactInputWithSuggestions, ShowCode, ShowGenerated, TextInput, TokenSelection, UpdateContext, UpdateObject } from "@/components/decision/dashboardDoc";
import GenericPage from "@/components/main_pages/genericPageStructure";

export const getServerSideProps = LoggerServerSideProps(withAuthentication<{}>(async ctx => {
    return {props: {}}
}))

export default function CreatePage() {
    return <GenericPage title="Jurisprudência STJ - Criar Documento">
        <Create />
    </GenericPage>
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

    if (AUTO_GENERATED.includes(accessKey.key)) return <ShowGenerated accessKey={accessKey} doc={doc} />;
    if (isJurisprudenciaDocumentObjectKey(accessKey.key) || isJurisprudenciaDocumentHashKey(accessKey.key) || isJurisprudenciaDocumentContentKey(accessKey.key))
            return <ShowCode accessKey={accessKey} doc={doc} />
        if (isJurisprudenciaDocumentDateKey(accessKey.key))
            return <DateInput accessKey={{...accessKey, key: accessKey.key as JurisprudenciaDocumentDateKey}} doc={doc} />
        if (isJurisprudenciaDocumentTextKey(accessKey.key)) {
            return <TextInput accessKey={{...accessKey, key: accessKey.key as JurisprudenciaDocumentTextKey}} doc={doc} />
        }
    
        if (isJurisprudenciaDocumentGenericKey(accessKey.key)) {
            if (accessKey.editorSuggestions && !accessKey.editorRestricted) {
                return <>&nbsp;</>
            }else if (accessKey.editorRestricted) {
                return <TokenSelection accessKey={{...accessKey, key: accessKey.key as JurisprudenciaDocumentGenericKey}} doc={doc} />
            }
            return <>&nbsp;</>
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
            {Object.keys(updateObject).map((key, i) => <li key={i}>{keys?.[key as keyof typeof keys]?.name}</li>)}
        </ul>
    </div>
}