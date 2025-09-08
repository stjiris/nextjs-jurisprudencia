import { useKeys } from "@/components/formKeys";
import { DashboardGenericPage } from "@/components/genericPageStructure";
import { useFetch } from "@/components/useFetch";
import { getAllKeys } from "@/core/keys";
import { LoggerServerSideProps } from "@/core/logger-api";
import { withAuthentication } from "@/core/user/authenticate";
import { JurisprudenciaKey, canBeActive, canHaveSuggestions } from "@/types/keys";
import { isJurisprudenciaDocumentGenericKey } from "@stjiris/jurisprudencia-document";
import dynamic from "next/dynamic";
import { NextRouter, useRouter } from "next/router";
import { CSSProperties, useEffect, useState } from "react";
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import 'react-quill/dist/quill.snow.css';

export const getServerSideProps = withAuthentication<{}>(async ctx => {
    LoggerServerSideProps(ctx);
    return {props: {}}
})

export default function ExcelPage() {
    let [bell, setBell] = useState(0);
    let update = () => setBell(b => b + 1)
    let keys = useKeys([bell]) || [];
    return <DashboardGenericPage title="Jurisprudência STJ - Filtros">
        <div className="card shadow">
            <div className="card-body">
                <table className="table table-hover">
                    <thead>
                        <tr>
                            <th className="text-center table-secondary" colSpan={1}></th>
                            <th className="text-center" colSpan={3}>Sistema</th>
                            <th className="text-center" colSpan={2}>Acessibilidade</th>
                            <th className="text-center" colSpan={2}>Filtros</th>
                            <th className="text-center" colSpan={2}>Indices</th>
                            <th className="text-center" colSpan={1}>Documento</th>
                            <th className="text-center" colSpan={4}>Edição Simples</th>
                        </tr>
                        <tr>
                            <th className="text-center table-secondary">#</th>
                            <th>Campo</th>
                            <th className="text-center">Ativo</th>
                            <th className="text-center">Autenticação</th>

                            <th>Nome</th>
                            <th>Descrição</th>

                            <th className="text-center">Primário</th>
                            <th className="text-center">Sugestões</th>

                            <th className="text-center">Agrupa</th>
                            <th className="text-center">Agrupa colunas</th>

                            <th className="text-center">Mostrar</th>

                            <th className="text-center">Ativo</th>
                            <th className="text-center">Sugestões</th>
                            <th className="text-center">Restrito</th>
                            <th className="text-center">Apenas Original</th>
                        </tr>
                    </thead>
                    <tbody>
                        {keys.map((k) => <ShowFilterRow key={k.key} innitialKey={k} update={update} />)}
                    </tbody>
                </table>
            </div>
        </div>
    </DashboardGenericPage>
}

function ShowFilterRow({ innitialKey, update: updateOrder }: { innitialKey: JurisprudenciaKey, update: () => void }) {
    let [jurisprudenciaKey, setJurisprudenciaKey] = useState(innitialKey);
    let [edit, setEdit] = useState(false);
    let [desc, setDesc] = useState(innitialKey.description);
    let router = useRouter();

    let update = async (attr: keyof JurisprudenciaKey, value: any) => {
        let r = await fetch(`${router.basePath}/api/keys/${encodeURIComponent(innitialKey.key)}/${encodeURIComponent(attr)}`, {
            method: "PUT",
            body: JSON.stringify(value)
        });
        if (r.status !== 200) alert("Algo correu mal a atualizar definições, por favor atualize a página ou tente mais tarde.");

        let values = (await r.json()) as JurisprudenciaKey | null;

        if (values) setJurisprudenciaKey(values);
    }

    let disableKey = !canBeActive(jurisprudenciaKey.key);
    let BooleanInput = ({ attr }: { attr: keyof JurisprudenciaKey }) => <input onChange={e => update(attr, e.currentTarget.checked)} className="form-check-input" type="checkbox" checked={jurisprudenciaKey[attr] as boolean} />
    let DisabledBooleanInput = ({ attr }: { attr: keyof JurisprudenciaKey }) => disableKey ? <></> : <BooleanInput attr={attr} />
    let disableEditorSuggestions = !canHaveSuggestions(jurisprudenciaKey.key);
    let EditorSuggestions = () => disableEditorSuggestions ? <></> : <BooleanInput attr="editorSuggestions" />
    let EditorRestricted = () => disableEditorSuggestions ? <></> : <BooleanInput attr="editorRestricted" />
    let EditorOriginalOnly = () => !isJurisprudenciaDocumentGenericKey(jurisprudenciaKey.key) ? <></> : <BooleanInput attr="editorOriginalOnly" />

    return <>
        <tr className="align-middle">
            <td className="text-center table-secondary">
                <button className="btn p-0 m-0" onClick={e => update("filtersOrder", jurisprudenciaKey.filtersOrder - 1).then(updateOrder)}><i className="bi bi-arrow-up"></i></button>
                <label className="mx-1">{jurisprudenciaKey.filtersOrder}</label>
                <button className="btn p-0 m-0" onClick={e => update("filtersOrder", jurisprudenciaKey.filtersOrder + 1).then(updateOrder)}><i className="bi bi-arrow-down"></i></button>
            </td>
            <th><label className="form-label p-0 m-0">{jurisprudenciaKey.key}</label></th>
            <td className="text-center"><DisabledBooleanInput attr="active" /></td>
            <td className="text-center"><BooleanInput attr="authentication" /></td>
            <td><input onChange={e => update("name", e.currentTarget.value)} className="form-control p-0 m-0" type="text" value={jurisprudenciaKey.name} /></td>
            <td>{!edit ? <button className="btn btn-primary py-0 m-0" onClick={() => setEdit(e => !e)}>Editar</button> : <><button className="btn btn-danger py-0 m-0" onClick={() => { setEdit(false); setDesc(jurisprudenciaKey.description) }}>Cancelar</button><button className="btn btn-primary py-0 m-0" onClick={() => { setEdit(false); update("description", desc) }}>Guardar</button></>}</td>
            <td className="text-center"><DisabledBooleanInput attr="filtersShow" /></td>
            <td className="text-center"><DisabledBooleanInput attr="filtersSuggest" /></td>
            <td className="text-center"><DisabledBooleanInput attr="indicesList" /></td>
            <td className="text-center"><DisabledBooleanInput attr="indicesGroup" /></td>
            <td className="text-center"><BooleanInput attr="documentShow" /></td>
            <td className="text-center"><BooleanInput attr="editorEnabled" /></td>
            <td className="text-center"><EditorSuggestions /></td>
            <td className="text-center"><EditorRestricted /></td>
            <td className="text-center"><EditorOriginalOnly /></td>
        </tr>
        {edit && <tr style={{ "--bs-table-accent-bg": "initial" } as CSSProperties}>
            <td colSpan={9}><ReactQuill theme="snow" value={desc} onChange={setDesc} /></td>
        </tr>}
    </>
}
