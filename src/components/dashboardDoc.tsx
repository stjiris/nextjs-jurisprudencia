import { JurisprudenciaDocument, JurisprudenciaDocumentDateKey, JurisprudenciaDocumentExactKey, JurisprudenciaDocumentGenericKey, JurisprudenciaDocumentKey, JurisprudenciaDocumentTextKey, PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { Dispatch, SetStateAction, createContext, useContext, useMemo, useRef, useState } from "react";

import { JurisprudenciaKey } from "@/types/keys";
import { DatalistObj } from "@/types/search";
import dynamic from 'next/dynamic';
import { NextRouter, useRouter } from "next/router";
import 'react-quill/dist/quill.snow.css';
import Createable from "react-select/creatable";
import { useFetch } from "./useFetch";
import { createFilter } from "react-select";
export const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

export type UpdateObject = PartialJurisprudenciaDocument;

export const UpdateContext = createContext<[UpdateObject, Dispatch<SetStateAction<UpdateObject>>]>([{}, () => { }]);

export type InputProps<T> = {
    accessKey: JurisprudenciaKey & { key: T },
    doc: JurisprudenciaDocument
}

export type SimpleInputProps = {
    accessKey: JurisprudenciaKey & { key: JurisprudenciaDocumentKey },
    doc: Partial<Record<JurisprudenciaDocumentKey, string>>
}

export function TextInput({ accessKey, doc }: InputProps<JurisprudenciaDocumentTextKey>) {
    let [, setUpdateObject] = useContext(UpdateContext);
    let initialValue = doc[accessKey.key] || "";
    let [html, setValue] = useState<string>(initialValue);

    let onChange = (newvalue: string) => {
        let valueWithoutEmpty = newvalue.replaceAll("<p><br></p>", "");
        setUpdateObject(old => ({ ...old, [accessKey.key]: valueWithoutEmpty }));
        setValue(valueWithoutEmpty);
    }

    return <InputRow accessKey={accessKey} toSave={html !== initialValue}>
        <ReactQuill className="form-control h-100 p-0 border-0" theme="snow" defaultValue={initialValue} onChange={onChange} />
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

export function ExactInput({ accessKey, doc, options }: InputProps<JurisprudenciaDocumentExactKey> & { options?: string[] }) {
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

    if (options && options.length > 0) {
        // select input
        return <InputRow accessKey={accessKey} toSave={toSave}>
            <select className="form-select" defaultValue={initialValue} onChange={(evt) => update(evt.currentTarget.value)}>
                {options.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
        </InputRow>;
    }

    return <InputRow accessKey={accessKey} toSave={toSave}>
        <input className="form-control" defaultValue={initialValue} onInput={(evt) => update(evt.currentTarget.value)} />
    </InputRow>;
}

export function GenericInput({ accessKey, doc }: InputProps<JurisprudenciaDocumentGenericKey>) {
    let [, setUpdateObject] = useContext(UpdateContext);
    let initialValue = doc[accessKey.key] || { Original: [], Show: [], Index: [] };
    let [toSave, setToSave] = useState<boolean>(false);

    let originalRef = useRef<HTMLTextAreaElement>(null);
    let showRef = useRef<HTMLTextAreaElement>(null);
    let indexRef = useRef<HTMLTextAreaElement>(null);

    let update = () => {
        if (!originalRef.current || !showRef.current || !indexRef.current) return;
        let toBeNewValue = { Original: originalRef.current.value.split("\n"), Show: showRef.current.value.split("\n"), Index: indexRef.current.value.split("\n") };
        if (JSON.stringify(toBeNewValue, ["Original", "Show", "Index"]) === JSON.stringify(initialValue, ["Original", "Show", "Index"])) {
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
                    <textarea ref={indexRef} className="form-control" defaultValue={initialValue.Index.join("\n")} rows={initialValue.Index.length} onInput={(evt) => update()} />
                </div>
            </div>
        </div>
    </>
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

export function ShowGenerated({ accessKey }: InputProps<JurisprudenciaDocumentKey>) {
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

export function ExactInputSelection({ accessKey, doc }: SimpleInputProps) {
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

    let options = useFetch<DatalistObj[]>(`/api/datalist?agg=${encodeURIComponent(accessKey.key)}`, []) || [{ key: initialValue }];

    let toSaveString = toSave ? "*" : "";

    return <InputRow accessKey={accessKey} toSave={toSave}>
        <select className="form-select" defaultValue={initialValue} onChange={(evt) => update(evt.currentTarget.value)}>
            <option value="">Selecione...</option>
            {options?.map((v, i) => <option key={i} value={v.key}>{v.key}</option>)}
        </select>
    </InputRow>;
}


export function TokenSelection({ accessKey, doc }: SimpleInputProps) {
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

    let options = useFetch<DatalistObj[]>(`/api/datalist?agg=${encodeURIComponent(accessKey.key)}`, []);
    let optionsList = useMemo(() => {
        if (!options) return [{ value: initialValue, label: initialValue }];
        if (!initialValue || options.find(v => v.key === initialValue)) return options.map((v) => ({ value: v.key, label: v.key }));
        return options.map((v) => ({ value: v.key, label: v.key })).concat({ value: initialValue, label: initialValue });
    }, [options]);

    let toSaveString = toSave ? "*" : "";
    let defaultValue = initialValue ? initialValue.split("\n").map(v => ({ value: v, label: v })) : [];

    return <InputRow accessKey={accessKey} toSave={toSave}>
        <Createable
            placeholder="Selectione..."
            defaultValue={defaultValue}
            loadingMessage={lbl => "A carregar..."}
            formatCreateLabel={lbl => `Novo ${accessKey.name}: "${lbl}"`}
            className="w-75"
            isMulti
            options={optionsList}
            onChange={(evt) => update(evt.map(v => v.value).join("\n"))}
            createOptionPosition="first"
            filterOption={createFilter({
                matchFrom: "start",
                ignoreCase: false,
                ignoreAccents: false,
            })}
        />
    </InputRow>;
}

export function GenericInputSimple({ accessKey, doc }: InputProps<JurisprudenciaDocumentGenericKey>) {
    let [, setUpdateObject] = useContext(UpdateContext);
    let initialValue = doc[accessKey.key]?.Index || "";
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

    return <InputRow accessKey={accessKey} toSave={toSave}>
        <textarea className="form-control" defaultValue={initialValue} onInput={(evt) => update(evt.currentTarget.value)} rows={4} />
    </InputRow>;
}

export function GenericInputOriginalOnly({ accessKey, doc }: InputProps<JurisprudenciaDocumentGenericKey>) {
    let [, setUpdateObject] = useContext(UpdateContext);
    let initialValue = doc[accessKey.key] || { Original: [], Show: [], Index: [] };
    let [toSave, setToSave] = useState<boolean>(false);

    let originalRef = useRef<HTMLTextAreaElement>(null);

    let update = () => {
        if (!originalRef.current) return;
        // Keep the existing Show and Index values, only update Original
        let toBeNewValue = { 
            Original: originalRef.current.value.split("\n"), 
            Show: initialValue.Show, 
            Index: initialValue.Index 
        };
        if (JSON.stringify(toBeNewValue, ["Original", "Show", "Index"]) === JSON.stringify(initialValue, ["Original", "Show", "Index"])) {
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
            <div className="form-control w-75">
                <div className="col-12">
                    <textarea ref={originalRef} className="form-control" defaultValue={initialValue.Original.join("\n")} rows={initialValue.Original.length} onInput={(evt) => update()} />
                </div>
            </div>
        </div>
    </>
}

function InputRow({ accessKey, toSave, children }: { accessKey: JurisprudenciaKey, toSave: boolean, children: React.ReactNode }) {
    return <div className="input-group">
        <small className={"input-group-text w-25 " + (toSave ? "fw-bold" : "")}>{accessKey.name}{toSave ? "*" : ""}</small>
        {children}
    </div>;
}