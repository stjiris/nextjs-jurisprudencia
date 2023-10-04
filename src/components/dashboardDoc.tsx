import { GenericField, JurisprudenciaDocument, JurisprudenciaDocumentDateKeys, JurisprudenciaDocumentExactKeys, JurisprudenciaDocumentGenericKeys, JurisprudenciaDocumentKey, JurisprudenciaDocumentKeys, JurisprudenciaDocumentTextKeys, PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { useState, Dispatch, SetStateAction, useCallback, useEffect, createContext, useContext, useRef } from "react";

import dynamic from 'next/dynamic';
export const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import 'react-quill/dist/quill.snow.css';
import { JurisprudenciaKey } from "@/types/keys";

export type UpdateObject = PartialJurisprudenciaDocument;

export const UpdateContext = createContext<[UpdateObject, Dispatch<SetStateAction<UpdateObject>>]>([{}, () => { }]);

export type InputProps<T> = {
    accessKey: JurisprudenciaKey & { key: T },
    doc: JurisprudenciaDocument
}

export function TextInput({accessKey, doc}: InputProps<JurisprudenciaDocumentTextKeys>){
    let [, setUpdateObject] = useContext(UpdateContext);
    let initialValue = doc[accessKey.key] || "";
    let [html, setValue] = useState<string>(initialValue);
    let [edit, setEdit] = useState<boolean>(false);

    useEffect(() => {
        if (!edit) {
            // Reset values
            setValue(initialValue);
            setUpdateObject(({ [accessKey.key]: _curr, ...old }) => ({ ...old }));
        }
    }, [edit, accessKey.key, initialValue, setUpdateObject]);

    let onChange = (newvalue: string) => {
        setUpdateObject(old => ({ ...old, [accessKey.key]: newvalue }));
        setValue(newvalue);
    }

    return <>
        <div className="d-flex align-items-baseline my-2">
            <h4 className="m-0 w-25">{accessKey.name}{initialValue === html ? "" : "*"}</h4>
            <button className="btn btn-warning mx-1" onClick={() => setEdit((v) => !v)}>{edit ? "Cancelar" : "Editar"}</button>
        </div>
        {edit && <ReactQuill theme="snow" value={html} onChange={onChange} />}
    </>;
}

export function DateInput({accessKey, doc}: InputProps<JurisprudenciaDocumentDateKeys>){
    let [, setUpdateObject] = useContext(UpdateContext);
    let initialValue = doc[accessKey.key] || "1900/01/01"
    let defaultValue = initialValue.split("/").reverse().join("-")
    let [toSave, setToSave] = useState<boolean>(false);
    let update = (newValue: string) => {
        let newValueD = newValue.split("-").reverse().join("/")
        if (JSON.stringify(newValueD) === JSON.stringify(initialValue)) {
            setUpdateObject(({ [accessKey.key]: _key_to_remove, ...old }) => ({ ...old }));
            setToSave(false);
        }
        else {
            setUpdateObject((old) => ({ ...old, [accessKey.key]: newValueD }));
            setToSave(true);
        }
    };

    let toSaveString = toSave ? "*" : "";

    
    return <div className="input-group">
        <small className="input-group-text w-25">{accessKey.name}{toSaveString}</small>
        <input className="form-control" type="date" defaultValue={defaultValue} onInput={(evt) => update(evt.currentTarget.value)} />
    </div>;
}

export function ExactInput({accessKey, doc}: InputProps<JurisprudenciaDocumentExactKeys>){
    let [, setUpdateObject] = useContext(UpdateContext);
    let initialValue = doc[accessKey.key] || "";
    let [toSave, setToSave] = useState<boolean>(false);
    let update = (newValue: string) => {
        if (JSON.stringify(newValue) === JSON.stringify(initialValue)) {
            setUpdateObject(({ [accessKey.key]: _key_to_remove, ...old }) => ({ ...old }));
            setToSave(false);
        }
        else {
            setUpdateObject((old) => ({ ...old, [accessKey.key]: newValue }));
            setToSave(true);
        }
    };

    let toSaveString = toSave ? "*" : "";

    return <div className="input-group">
        <small className="input-group-text w-25">{accessKey.name}{toSaveString}</small>
        <input className="form-control" defaultValue={initialValue} onInput={(evt) => update(evt.currentTarget.value)} />
    </div>;
}

export function GenericInput({accessKey, doc}: InputProps<JurisprudenciaDocumentGenericKeys>){
    let [, setUpdateObject] = useContext(UpdateContext);
    let initialValue = doc[accessKey.key] || {Original: [], Show: [], Index: []};
    let [toSave, setToSave] = useState<boolean>(false);

    let originalRef = useRef<HTMLTextAreaElement>(null);
    let showRef = useRef<HTMLTextAreaElement>(null);
    let indexRef = useRef<HTMLTextAreaElement>(null);

    let update = () => {
        if( !originalRef.current || !showRef.current || !indexRef.current ) return;
        let toBeNewValue = { Original: originalRef.current.value.split("\n"), Show: showRef.current.value.split("\n"), Index: indexRef.current.value.split("\n") };
        if( JSON.stringify(toBeNewValue, ["Original","Show","Index"]) === JSON.stringify(initialValue, ["Original","Show","Index"]) ){
            setUpdateObject(({ [accessKey.key]: _key_to_remove, ...old }) => ({ ...old }));
            setToSave(false);
        }
        else {
            setUpdateObject((old) => ({ ...old, [accessKey.key]: toBeNewValue }));
            setToSave(true);
        }
    };

    let toSaveString = toSave ? "*" : "";
    
    return <>
        <div className="input-group">
            <small className="input-group-text w-25">{accessKey.name}{toSaveString}</small>
            <div className="form-control w-75 d-flex flex-wrap">
                <div className="col-4">Original</div>
                <div className="col-4">Mostrar</div>
                <div className="col-4">Índice</div>
                <div className="col-4">
                    <textarea ref={originalRef} className="form-control" defaultValue={initialValue.Original.join("\n")} rows={initialValue.Original.length} onInput={(evt) => update()} />
                </div>
                <div className="col-4">
                    <textarea ref={showRef} className="form-control" defaultValue={initialValue.Show.join("\n")} rows={initialValue.Show.length} onInput={(evt) => update()} />
                </div>
                <div className="col-4">
                    <textarea  ref={indexRef} className="form-control" defaultValue={initialValue.Index.join("\n")} rows={initialValue.Index.length} onInput={(evt) => update()} />
                </div>
            </div>
        </div>
    </>
}

export function ShowCode({accessKey, doc}: InputProps<JurisprudenciaDocumentKey>){
    return <div className="input-group">
        <small className="input-group-text w-25">{accessKey.name}</small>
        <details className="form-control">
            <summary>Mostrar código</summary>
            <pre className="my-0"><code>{JSON.stringify(doc[accessKey.key], null, 2)}</code></pre>
        </details>
    </div>;
}