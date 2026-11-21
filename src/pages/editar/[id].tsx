import { withAuthentication } from "@/core/user/authenticate"
import { JurisprudenciaDocument, JurisprudenciaDocumentDateKey, JurisprudenciaDocumentExactKey, JurisprudenciaDocumentGenericKey, JurisprudenciaDocumentStateKey, JurisprudenciaDocumentStateValue, JurisprudenciaDocumentStateValues, JurisprudenciaDocumentTextKey, PartialJurisprudenciaDocument, isJurisprudenciaDocumentContentKey, isJurisprudenciaDocumentDateKey, isJurisprudenciaDocumentExactKey, isJurisprudenciaDocumentGenericKey, isJurisprudenciaDocumentHashKey, isJurisprudenciaDocumentObjectKey, isJurisprudenciaDocumentStateKey, isJurisprudenciaDocumentTextKey } from "@stjiris/jurisprudencia-document";
import { useContext, useState } from "react";
import { useRouter } from "next/router";
import { Loading } from "@/components/loading";
import { useFetch } from "@/components/useFetch";
import { GetResponse, WriteResponseBase } from "@elastic/elasticsearch/lib/api/types";
import { useKeysFromContext } from "@/contexts/keys";
import { JurisprudenciaKey } from "@/types/keys";
import { LoggerServerSideProps } from "@/core/logger-api";
import { DateInput, ExactInput, ShowCode, TextInput, TextPairInput, TokenSelection, UpdateContext, UpdateObject, ExactInputWithSuggestions, ExactInputRestricted } from "@/components/decision/dashboardDoc";
import GenericPage from "@/components/main_pages/genericPageStructure";

export const getServerSideProps = LoggerServerSideProps(withAuthentication<{}>(async ctx => {
    return { props: {} }
}))

interface UpdateProps {
    id: string
    doc: JurisprudenciaDocument
}

export default function UpdatePage() {
    const router = useRouter();
    let { id } = router.query;
    if (Array.isArray(id)) {
        id = id[0];
    }
    let response = useFetch<GetResponse<JurisprudenciaDocument>>(`/api/doc/${id}`, [id]);

    return <GenericPage title="Jurisprudência STJ - Editar Documento">
        {response && response._source && id && <Update doc={response._source} id={id} />}
        {!response && <Loading text="A carregar documento" />}
        {response && !response._source && <div className="alert alert-danger">
            <h3>Erro ao carregar o documento</h3>
        </div>}
    </GenericPage>
}

const TEXT_PAIRS: [string, string][] = [
    ["Texto", "Texto Não Anonimizado"],
    ["Sumário", "Sumário Não Anonimizado"],
];

function Update({ doc, id }: UpdateProps) {
    let keys = useKeysFromContext();
    let [updateObject, setUpdateObject] = useState<UpdateObject>({});

    // Build a map from key name to JurisprudenciaKey for pair lookup
    const keyMap = Object.fromEntries(keys.keys.map(k => [k.key, k]));

    // Pair up Texto/Sumário with their "Não Anonimizado" counterparts whenever the
    // field is editor-enabled — regardless of whether content already exists — so an
    // empty Sumário (Não Anonimizado) still shows the same side-by-side editable layout
    // and has a clear place to be filled in, instead of rendering scattered/empty.
    const activePairs = TEXT_PAIRS.filter(([left]) => keyMap[left]?.editorEnabled);
    const activePairRightKeys = new Set(activePairs.map(([, right]) => right));
    const activePairLeftKeys = new Set(activePairs.map(([left]) => left));

    const hasPairs = activePairs.length > 0;

    return <UpdateContext.Provider value={[updateObject, setUpdateObject]}>
        <div className="container-fluid">
            <div className="row">
                <div className={"card shadow mx-auto " + (hasPairs ? "col-11" : "col-6")}>
                    <UpdateDocument id={id} doc={doc} />
                    {keys.keys.map((key, i) => {
                        if (!key.editorEnabled) return null;
                        if (activePairLeftKeys.has(key.key)) {
                            const pair = TEXT_PAIRS.find(([left]) => left === key.key)!;
                            const rightKeyConfig = (keyMap[pair[1]] ?? { key: pair[1], name: pair[1], editorEnabled: true }) as any;
                            return <TextPairInput key={i} leftKey={key as any} rightKey={rightKeyConfig} doc={doc} />;
                        }
                        if (activePairRightKeys.has(key.key)) return null;
                        return <EditKey key={i} accessKey={key} doc={doc} />;
                    })}
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
        return <DateInput accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentDateKey }} doc={doc} />
    if (isJurisprudenciaDocumentTextKey(accessKey.key)) {
        return <TextInput accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentTextKey }} doc={doc} />
    }

    if (isJurisprudenciaDocumentGenericKey(accessKey.key)) {
        return <TokenSelection accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentGenericKey }} doc={doc} editorSuggestions={accessKey.editorSuggestions} editorRestricted={accessKey.editorRestricted} />
    }
    if (isJurisprudenciaDocumentExactKey(accessKey.key)) {
        if (accessKey.editorRestricted) {
            return <ExactInputRestricted accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentExactKey }} doc={doc} />
        }
        if (accessKey.editorSuggestions) {
            return <ExactInputWithSuggestions accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentExactKey }} doc={doc} />
        }
        return <ExactInput accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentExactKey }} doc={doc} />

    }
    if (isJurisprudenciaDocumentStateKey(accessKey.key))
        return <ExactInput accessKey={{ ...accessKey, key: accessKey.key as JurisprudenciaDocumentStateKey }} doc={doc} options={JurisprudenciaDocumentStateValues} />

    return <>Unreachable</>
}

function UpdateDocument({ id, doc }: { id: string, doc: JurisprudenciaDocument }) {
    let keys = useKeysFromContext().records;
    let [updateObject,] = useContext(UpdateContext);
    let router = useRouter();
    const [saving, setSaving] = useState(false);

    let update = async (): Promise<boolean> => {
        setSaving(true);
        try {
            const res = await fetch(`${router.basePath}/api/doc/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateObject)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                alert(`Erro ao guardar documento: ${errData.message || res.statusText}`);
                return false;
            }
            return true;
        } catch (e: any) {
            alert(`Erro ao guardar documento: ${e?.message || e}`);
            return false;
        } finally {
            setSaving(false);
        }
    };

    // URL of the decision's view page, using the *new* process number if it was
    // edited — otherwise a save that changes it leaves the return link pointing at
    // the old (now non-existent) process-number URL.
    let decisionUrl = () => {
        const numeroProcesso = (updateObject as PartialJurisprudenciaDocument)["Número de Processo"] ?? doc["Número de Processo"];
        return `/${encodeURIComponent(numeroProcesso!)}/${doc.UUID}`;
    };

    let deleteDoc = async () => {
        if (!confirm("Tem a certeza que quer eliminar o documento?")) return;
        setSaving(true);
        try {
            const res = await fetch(`${router.basePath}/api/doc/${id}`, {
                method: "DELETE",
            });
            const writeResponseBase = await res.json() as WriteResponseBase;
            if (writeResponseBase.result === "updated") {
                router.back();
            } else {
                router.push("/pesquisa/");
            }
        } catch (e: any) {
            alert(`Erro ao eliminar documento: ${e?.message || e}`);
        } finally {
            setSaving(false);
        }
    };

    return <div className="container-fluid alert alert-info col-12 mt-2">
        <div className="row">
            <div className="col-6">
                <h4>Documento</h4>
                <h4><code>{id}</code></h4>
            </div>
            <div className="col-6 text-end">
                <div className="btn-group">
                    <button 
                        className="btn btn-secondary" 
                        type="button"
                        onClick={() => {
                            if (Object.keys(updateObject).length > 0 && !confirm("Existem alterações por guardar. Tem a certeza que pretende voltar sem guardar?")) {
                                return;
                            }
                            router.back();
                        }}>
                        Voltar
                    </button>
                    <button 
                        className="btn btn-danger" 
                        type="button"
                        onClick={deleteDoc} 
                        disabled={Object.keys(updateObject).length > 0 || saving}>
                        Eliminar
                    </button>
                    <button 
                        className="btn btn-warning" 
                        type="button"
                        onClick={() => router.reload()} 
                        disabled={Object.keys(updateObject).length === 0 || saving}>
                        Cancelar
                    </button>
                    <button 
                        className="btn btn-success" 
                        type="button"
                        onClick={async () => {
                            const ok = await update();
                            if (ok) {
                                alert("Documento guardado com sucesso!");
                                router.reload();
                            }
                        }} 
                        disabled={Object.keys(updateObject).length === 0 || saving}>
                        {saving ? "A guardar…" : "Guardar"}
                    </button>
                    <button 
                        className="btn btn-primary" 
                        type="button"
                        onClick={async () => {
                            const url = decisionUrl();
                            const ok = await update();
                            if (ok) {
                                router.push(url);
                            }
                        }} 
                        disabled={Object.keys(updateObject).length === 0 || saving}>
                        {saving ? "A guardar…" : "Guardar e Voltar"}
                    </button>
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