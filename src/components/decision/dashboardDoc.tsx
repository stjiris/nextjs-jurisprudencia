import { JurisprudenciaDocument, JurisprudenciaDocumentDateKey, JurisprudenciaDocumentExactKey, JurisprudenciaDocumentGenericKey, JurisprudenciaDocumentKey, JurisprudenciaDocumentStateKey, JurisprudenciaDocumentTextKey, PartialJurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { Dispatch, MutableRefObject, SetStateAction, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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

export function TextPairInput({ leftKey, rightKey, doc }: { leftKey: JurisprudenciaKey & { key: JurisprudenciaDocumentTextKey }, rightKey: JurisprudenciaKey & { key: JurisprudenciaDocumentTextKey }, doc: JurisprudenciaDocument | PartialJurisprudenciaDocument }) {
    let [, setUpdateObject] = useContext(UpdateContext);
    let leftInitial = doc[leftKey.key] || "";
    let rightInitial = doc[rightKey.key] || "";
    let [leftHtml, setLeftHtml] = useState<string>(leftInitial);
    let [rightHtml, setRightHtml] = useState<string>(rightInitial);
    let leftWrapRef = useRef<HTMLDivElement>(null);
    let rightWrapRef = useRef<HTMLDivElement>(null);
    let syncingRef = useRef(false);

    const getEditor = (wrapRef: MutableRefObject<HTMLDivElement | null>) =>
        wrapRef.current?.querySelector<HTMLElement>(".ql-editor") ?? null;

    const syncScroll = useCallback((source: MutableRefObject<HTMLDivElement | null>, target: MutableRefObject<HTMLDivElement | null>) => {
        if (syncingRef.current) return;
        const sourceEl = getEditor(source);
        const targetEl = getEditor(target);
        if (!sourceEl || !targetEl) return;
        syncingRef.current = true;
        const ratio = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1);
        targetEl.scrollTop = ratio * (targetEl.scrollHeight - targetEl.clientHeight);
        syncingRef.current = false;
    }, []);

    useEffect(() => {
        const leftEl = getEditor(leftWrapRef);
        const rightEl = getEditor(rightWrapRef);
        if (!leftEl || !rightEl) return;
        const onLeftScroll = () => syncScroll(leftWrapRef, rightWrapRef);
        const onRightScroll = () => syncScroll(rightWrapRef, leftWrapRef);
        leftEl.addEventListener("scroll", onLeftScroll);
        rightEl.addEventListener("scroll", onRightScroll);
        return () => {
            leftEl.removeEventListener("scroll", onLeftScroll);
            rightEl.removeEventListener("scroll", onRightScroll);
        };
    }, [syncScroll]);

    const onLeftChange = (content: string, _delta: any, source: string) => {
        if (source === 'user') {
            let v = content.replaceAll("<p><br></p>", "");
            setUpdateObject(old => ({ ...old, [leftKey.key]: v }));
            setLeftHtml(v);
        }
    };

    const onRightChange = (content: string, _delta: any, source: string) => {
        if (source === 'user') {
            let v = content.replaceAll("<p><br></p>", "");
            setUpdateObject(old => ({ ...old, [rightKey.key]: v }));
            setRightHtml(v);
        }
    };

    const leftChanged = leftHtml !== leftInitial;
    const rightChanged = rightHtml !== rightInitial;

    return <div className="border rounded mb-2 p-2">
        <div className="d-flex gap-2" style={{ height: "400px" }}>
            <div className="d-flex flex-column flex-grow-1 overflow-hidden" ref={leftWrapRef}>
                <small className={"fw-semibold mb-1" + (leftChanged ? " text-warning" : "")}>{leftKey.name}{leftChanged ? "*" : ""}</small>
                <ReactQuill
                    className="flex-grow-1 overflow-hidden"
                    theme="snow"
                    defaultValue={leftInitial}
                    onChange={onLeftChange}
                />
            </div>
            <div className="vr" />
            <div className="d-flex flex-column flex-grow-1 overflow-hidden" ref={rightWrapRef}>
                <small className={"fw-semibold mb-1" + (rightChanged ? " text-warning" : "")}>{rightKey.name}{rightChanged ? "*" : ""}</small>
                <ReactQuill
                    className="flex-grow-1 overflow-hidden"
                    theme="snow"
                    defaultValue={rightInitial}
                    onChange={onRightChange}
                />
            </div>
        </div>
    </div>;
}

export function TextPairsCombinedInput({ pairs, doc }: {
    pairs: Array<{ leftKey: JurisprudenciaKey & { key: JurisprudenciaDocumentTextKey }, rightKey: JurisprudenciaKey & { key: JurisprudenciaDocumentTextKey } }>,
    doc: JurisprudenciaDocument | PartialJurisprudenciaDocument
}) {
    const [, setUpdateObject] = useContext(UpdateContext);
    const syncingRef = useRef(false);
    const editor0Wrap = useRef<HTMLDivElement>(null);
    const editor1Wrap = useRef<HTMLDivElement>(null);
    const side0Scroll = useRef<HTMLDivElement>(null);
    const side1Scroll = useRef<HTMLDivElement>(null);

    const getEditor = (wrapRef: MutableRefObject<HTMLDivElement | null>) =>
        wrapRef.current?.querySelector<HTMLElement>(".ql-editor") ?? null;

    const syncScroll = useCallback((sourceEl: HTMLElement | null, targetEl: HTMLElement | null) => {
        if (syncingRef.current || !sourceEl || !targetEl) return;
        syncingRef.current = true;
        const ratio = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1);
        targetEl.scrollTop = ratio * (targetEl.scrollHeight - targetEl.clientHeight);
        syncingRef.current = false;
    }, []);

    useEffect(() => {
        const pairs = [
            { editorWrap: editor0Wrap, sideScroll: side0Scroll },
            { editorWrap: editor1Wrap, sideScroll: side1Scroll },
        ];
        const cleanups: (() => void)[] = [];
        pairs.forEach(({ editorWrap, sideScroll }) => {
            const editorEl = getEditor(editorWrap);
            const sideEl = sideScroll.current;
            if (!editorEl || !sideEl) return;
            const onEditor = () => syncScroll(editorEl, sideEl);
            const onSide = () => syncScroll(sideEl, editorEl);
            editorEl.addEventListener("scroll", onEditor);
            sideEl.addEventListener("scroll", onSide);
            cleanups.push(() => { editorEl.removeEventListener("scroll", onEditor); sideEl.removeEventListener("scroll", onSide); });
        });
        return () => cleanups.forEach(f => f());
    }, [syncScroll]);

    const editorWraps = [editor0Wrap, editor1Wrap];

    return <div className="border rounded mb-2 p-2">
        <div className="d-flex gap-2" style={{ height: "500px" }}>
            <div className="d-flex flex-column flex-grow-1 overflow-hidden">
                <small className="fw-semibold mb-1">{pairs[0].rightKey.name}</small>
                <div
                    ref={side0Scroll}
                    className="flex-grow-1 overflow-auto border rounded p-2 bg-light"
                    dangerouslySetInnerHTML={{ __html: (doc[pairs[0].rightKey.key] as string) || "" }}
                />
            </div>
            <div className="vr" />
            <div className="d-flex flex-column flex-grow-1 overflow-hidden gap-2">
                {pairs.map((pair, i) => {
                    const initial = (doc[pair.leftKey.key] as string) || "";
                    return <div key={pair.leftKey.key} className="d-flex flex-column flex-grow-1 overflow-hidden" ref={editorWraps[i]}>
                        <small className="fw-semibold mb-1">{pair.leftKey.name}</small>
                        <ReactQuill
                            className="flex-grow-1 overflow-hidden"
                            theme="snow"
                            defaultValue={initial}
                            onChange={(content, _delta, source) => {
                                if (source === 'user') {
                                    const v = content.replaceAll("<p><br></p>", "");
                                    setUpdateObject(old => ({ ...old, [pair.leftKey.key]: v }));
                                }
                            }}
                        />
                    </div>;
                })}
            </div>
            <div className="vr" />
            <div className="d-flex flex-column flex-grow-1 overflow-hidden">
                <small className="fw-semibold mb-1">{pairs[1].rightKey.name}</small>
                <div
                    ref={side1Scroll}
                    className="flex-grow-1 overflow-auto border rounded p-2 bg-light"
                    dangerouslySetInnerHTML={{ __html: (doc[pairs[1].rightKey.key] as string) || "" }}
                />
            </div>
        </div>
    </div>;
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

export function ExactInputRestricted({ accessKey, doc }: InputProps<JurisprudenciaDocumentExactKey>) {
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

    const handleInput = (evt: React.FormEvent<HTMLInputElement>) => {
        const newValue = evt.currentTarget.value;

        if (!datalist || datalist.some(item => item.key === newValue) || newValue === "") {
            update(newValue);
        } else {
            evt.currentTarget.value = initialValue;
        }
    };

    return <InputRow accessKey={accessKey} toSave={toSave}>
        <input
            className="form-control"
            defaultValue={initialValue}
            list={datalistId}
            onInput={handleInput}
            onFocus={() => !datalist && loadDatalist(router, accessKey.key, setDatalist)}
        />
        <datalist id={datalistId}>
            {datalist?.map(({ key }, i) => <option key={i} value={`${key}`} />)}
        </datalist>
    </InputRow>;
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
    return <div className="input-group ">
        <small className={"input-group-text w-25 align-items-start" + (toSave ? "fw-bold" : "")} >{accessKey.name}{toSave ? "*" : ""} </small>
        {children}
    </ div>;
}