import { JurisprudenciaDocument, JurisprudenciaDocumentDateKey, JurisprudenciaDocumentExactKey, JurisprudenciaDocumentGenericKey, JurisprudenciaDocumentKey, JurisprudenciaDocumentStateKey, JurisprudenciaDocumentTextKey, PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { Dispatch, SetStateAction, createContext, useContext, useMemo, useRef, useState } from "react";

import { JurisprudenciaKey } from "@/types/keys";
import { DatalistObj } from "@/types/search";
import dynamic from 'next/dynamic';
import { NextRouter, useRouter } from "next/router";
import 'react-quill/dist/quill.snow.css';
import Createable from "react-select/creatable";
import { useFetch } from "../useFetch";
import { createFilter } from "react-select";

export const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

export type UpdateObject = PartialJurisprudenciaDocument;

export const UpdateContext = createContext<[UpdateObject, Dispatch<SetStateAction<UpdateObject>>]>([{}, () => { }]);

export type InputProps<T> = {
    accessKey: JurisprudenciaKey & { key: T },
    doc: JurisprudenciaDocument | PartialJurisprudenciaDocument
}

export function TextInput({ accessKey, doc }: InputProps<JurisprudenciaDocumentTextKey>) {
    let [, setUpdateObject] = useContext(UpdateContext);
    let initialValue = doc[accessKey.key] || "";
    let [html, setValue] = useState<string>(initialValue);
    
    let onChange = (content: string, delta: any, source: string) => {
        if (source === 'user') {
            let valueWithoutEmpty = content.replaceAll("<p><br></p>", "");
            setUpdateObject(old => ({ ...old, [accessKey.key]: valueWithoutEmpty }));
            setValue(valueWithoutEmpty);
        }
    }
    
    return <InputRow accessKey={accessKey} toSave={html !== initialValue}>
        <ReactQuill 
            className="form-control h-100 p-0 border-0" 
            theme="snow" 
            defaultValue={initialValue}
            onChange={onChange} 
        />
    </InputRow>;
}

export function DateInput({ accessKey, doc }: InputProps<JurisprudenciaDocumentDateKey>) {
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

    return <InputRow accessKey={accessKey} toSave={toSave}>
        <input className="form-control" type="date" defaultValue={defaultValue} onInput={(evt) => update(evt.currentTarget.value)} />
    </InputRow>;
}

export function ExactInput({ accessKey, doc, options }: InputProps<JurisprudenciaDocumentExactKey | JurisprudenciaDocumentStateKey> & { options?: readonly string[] }) {
    let [, setUpdateObject] = useContext(UpdateContext);
    let initialValue = doc[accessKey.key];
    let displayValue = initialValue ?? "";
    let [toSave, setToSave] = useState<boolean>(false);

    let update = (newValue: string) => {

        if (newValue === initialValue) {
            setUpdateObject(({ [accessKey.key]: _key_to_remove, ...old }) => ({ ...old }));
            setToSave(false);
        } else {
            setUpdateObject((old) => ({ ...old, [accessKey.key]: newValue }));
            setToSave(true);
        }
    };

    if (options && options.length > 0) {
        return <InputRow accessKey={accessKey} toSave={toSave}>
            <select 
                className="form-select" 
                defaultValue={displayValue} 
                onChange={(evt) => update(evt.currentTarget.value)}
            >
                {options.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
        </InputRow>;
    }

    return <InputRow accessKey={accessKey} toSave={toSave}>
        <input 
            className="form-control" 
            defaultValue={displayValue} 
            onInput={(evt) => update(evt.currentTarget.value)} 
        />
    </InputRow>;
}

export function ShowCode({ accessKey, doc }: InputProps<JurisprudenciaDocumentKey>) {
    return <div className="input-group">
        <small className="input-group-text w-25">{accessKey.name}</small>
        <details className="form-control">
            <summary>Mostrar código</summary>
            <pre className="my-0"><code>{JSON.stringify(doc[accessKey.key] || null, null, 2)}</code></pre>
        </details>
    </div>;
}

export function ShowGenerated({ accessKey, doc }: InputProps<JurisprudenciaDocumentKey>) {
    return <div className="input-group">
        <small className="input-group-text w-25">{accessKey.name}</small>
        <input className="form-control" defaultValue="Gerado automaticamente" disabled />
    </div>;
}

export function ExactInputWithSuggestions({ accessKey, doc }: InputProps<JurisprudenciaDocumentExactKey>) {
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

    const datalistId = `datalist-${encodeURIComponent(accessKey.key)}`
    const router = useRouter();
    const [datalist, setDatalist] = useState<DatalistObj[] | null>(null);


    return <InputRow accessKey={accessKey} toSave={toSave}>
        <input className="form-control" defaultValue={initialValue} list={datalistId} onInput={(evt) => update(evt.currentTarget.value)} onFocus={() => !datalist && loadDatalist(router, accessKey.key, setDatalist)} />
        <datalist id={datalistId}>
            {datalist?.map(({ key }, i) => <option key={i} value={`${key}`} />)}
        </datalist>
    </InputRow>;
}

async function loadDatalist(router: NextRouter, accessKey: string, setDatalist: Dispatch<SetStateAction<DatalistObj[] | null>>) {
    return fetch(`${router.basePath}/api/datalist?agg=${encodeURIComponent(accessKey)}`)
        .then(r => r.json())
        .catch(e => {
            console.log(e)
            return []
        })
        .then(setDatalist)
}

export function TokenSelection({ accessKey, doc, editorSuggestions, editorRestricted }: InputProps<JurisprudenciaDocumentGenericKey> & { editorSuggestions?: boolean, editorRestricted?: boolean }) {
    const [, setUpdateObject] = useContext(UpdateContext);
    
    const fieldValue = doc[accessKey.key];
    const initialValue = fieldValue == null ? "" : fieldValue['Show'].join("\n");
    
    const [toSave, setToSave] = useState<boolean>(false);
    const defaultValue = initialValue ? initialValue.split("\n").map(v => ({ value: v, label: v })) : [];

    const update = (newValue: string) => {

        if (newValue === initialValue) {
            setUpdateObject(({ [accessKey.key]: _key_to_remove, ...old }) => ({ ...old }));
            setToSave(false);
        } else {
            let toBeNewValue = { Original: initialValue.split("\n"), Show: newValue.split("\n"), Index: newValue.split("\n") };
            setUpdateObject((old) => ({ ...old, [accessKey.key]: toBeNewValue }));
            setToSave(true);
        }
    };
    
    let options: DatalistObj[] | null | undefined = useFetch<DatalistObj[]>(`/api/datalist?agg=${encodeURIComponent(accessKey.key)}`, []);

    options = editorSuggestions ? options : null;
    
    let optionsList: readonly { value: string, label: string }[] = useMemo(() => {
        if (!options)
            return [{ value: initialValue, label: initialValue }];
        if (!initialValue || options.find(v => v.key === initialValue)) {
            return options.map((v) => ({ value: v.key, label: v.key }));
        }
        return options.map((v) => ({ value: v.key, label: v.key })).concat({ value: initialValue, label: initialValue });
    }, [options, initialValue]);
    
    const finalOptionsList = editorSuggestions ? optionsList : undefined;
    
    return (
        <InputRow accessKey={accessKey} toSave={toSave}>
            <Createable
                placeholder="Selecione..."
                defaultValue={defaultValue}
                loadingMessage={() => "A carregar..."}
                formatCreateLabel={(lbl) => `Novo ${accessKey.name}: "${lbl}"`}
                className="w-75"
                isMulti
                options={finalOptionsList}
                onChange={(evt) => update(evt.map(v => v.value).join("\n"))}
                createOptionPosition="first"
                isValidNewOption={() => !editorRestricted}
                filterOption={createFilter({
                    matchFrom: "start",
                    ignoreCase: true,
                    ignoreAccents: true,
                })}
            />
        </InputRow>
    );
}

function InputRow({ accessKey, toSave, children }: { accessKey: JurisprudenciaKey, toSave: boolean, children: React.ReactNode }) {
    return <div className="input-group">
        <small className={"input-group-text w-25 " + (toSave ? "fw-bold" : "")}>{accessKey.name}{toSave ? "*" : ""}</small>
        {children}
    </div>;
}