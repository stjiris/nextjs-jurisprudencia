import { JurisprudenciaDocumentKey } from "@stjiris/jurisprudencia-document";
import { useState, Dispatch, SetStateAction, useCallback, useEffect } from "react";

import dynamic from 'next/dynamic';
export const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import 'react-quill/dist/quill.snow.css';

export interface UpdateObject extends Record<string, string | string []>{}

type MaybeKeyOfJurisprudencia = JurisprudenciaDocumentKey | (string & Record<never, never>);

export function HTMLInput({ accessKey, value, setUpdateObject }: { accessKey: MaybeKeyOfJurisprudencia; value: string; setUpdateObject: Dispatch<SetStateAction<UpdateObject>>; }) {
    let [html, setValue] = useState<string>(value);
    let [edit, setEdit] = useState<boolean>(false);

    useEffect(() => {
        if (!edit) {
            // Reset values
            setValue(value);
            setUpdateObject(({ [accessKey]: _curr, ...old }) => ({ ...old }));
        }
    }, [edit]);

    let onChange = useCallback((newvalue: string) => {
        setUpdateObject(old => ({ ...old, [accessKey]: newvalue }));
        setValue(newvalue);
    }, []);

    return <>
        <div className="d-flex align-items-baseline my-2">
            <h4 className="m-0 w-25">{accessKey}{value === html ? "" : "*"}</h4>
            <button className="btn btn-warning mx-1" onClick={() => setEdit((v) => !v)}>{edit ? "Cancelar" : "Editar"}</button>
        </div>
        {edit && <ReactQuill theme="snow" value={html} onChange={onChange} />}
    </>;
}
export function ReadOnlyInput({ accessKey, value }: { accessKey: MaybeKeyOfJurisprudencia; value: string | string[]; }) {
    return <div className="input-group">
        <small className="input-group-text w-25">{accessKey}</small>
        <input className="form-control" value={value} readOnly />
    </div>;
}
export function UpdateInput({ accessKey, value, setUpdateObject }: { accessKey: MaybeKeyOfJurisprudencia; value: string | string[]; setUpdateObject: Dispatch<SetStateAction<UpdateObject>>; }) {
    let [toSave, setToSave] = useState<boolean>(false);
    let update = (key: string, newValue: string | string[]) => {
        if (JSON.stringify(newValue) === JSON.stringify(value)) {
            setUpdateObject(({ [key]: _key_to_remove, ...old }) => ({ ...old }));
            setToSave(false);
        }
        else {
            setUpdateObject((old) => ({ ...old, [key]: newValue }));
            setToSave(true);
        }
    };

    let toSaveString = toSave ? "*" : "";

    if (typeof value === "string") {
        return <div className="input-group">
            <small className="input-group-text w-25">{accessKey}{toSaveString}</small>
            <input className="form-control" defaultValue={value} onInput={(evt) => update(accessKey, evt.currentTarget.value)} />
        </div>;
    }
    else if (Array.isArray(value)) {
        return <div className="input-group">
            <small className="input-group-text w-25">{accessKey}{toSaveString}</small>
            <textarea className="form-control" defaultValue={value.join("\n")} rows={value.length} onInput={(evt) => update(accessKey, evt.currentTarget.value.split("\n"))} />
        </div>;
    }
    else if (value) {
        return <div className="input-group">
            <small className="input-group-text w-25">{accessKey}{toSaveString}</small>
            <textarea className="form-control" readOnly value={JSON.stringify(value, null, "  ")} rows={JSON.stringify(value, null, "   ").split("\n").length} />
        </div>;
    }
    else{
        return <div className="input-group">
        <small className="input-group-text w-25">{accessKey}{toSaveString}</small>
        <textarea className="form-control" defaultValue="" rows={1} onInput={(evt) => update(accessKey, evt.currentTarget.value.split("\n"))} />
    </div>;
    }
}
