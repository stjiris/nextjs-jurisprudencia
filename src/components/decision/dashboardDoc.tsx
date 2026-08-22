import { CanonicalValues, JurisprudenciaDocument, JurisprudenciaDocumentDateKey, JurisprudenciaDocumentExactKey, JurisprudenciaDocumentGenericKey, JurisprudenciaDocumentKey, JurisprudenciaDocumentStateKey, JurisprudenciaDocumentTextKey, PartialJurisprudenciaDocument, VotacaoCategories, VotacaoCategory, formatVotacaoShow, isControlledField, parseVotacao } from "@stjiris/jurisprudencia-document";
import { useCanAccess } from "@/contexts/auth";
import { Dispatch, SetStateAction, ClipboardEvent, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { JurisprudenciaKey } from "@/types/keys";
import { DatalistObj } from "@/types/search";
import dynamic from 'next/dynamic';
import { NextRouter, useRouter } from "next/router";
import Createable from "react-select/creatable";
import AsyncCreatable from "react-select/async-creatable";
import { useFetch } from "../useFetch";
import { createFilter } from "react-select";

export const ReactQuill = dynamic(
    () => import('react-quill').then(mod => mod.default),
    { ssr: false, loading: () => <div className="form-control h-100 p-0 border-0" style={{minHeight: "10em", background: "#f8f8f8"}} /> }
);

function useIsMounted() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    return mounted;
}

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
    const mounted = useIsMounted();

    let onChange = (content: string, delta: any, source: string) => {
        if (source === 'user') {
            let valueWithoutEmpty = content.replaceAll("<p><br></p>", "");
            setUpdateObject(old => ({ ...old, [accessKey.key]: valueWithoutEmpty }));
            setValue(valueWithoutEmpty);
        }
    }

    return <InputRow accessKey={accessKey} toSave={html !== initialValue}>
        {mounted && <ReactQuill
            className="form-control h-100 p-0 border-0"
            theme="snow"
            defaultValue={initialValue}
            onChange={onChange}
        />}
    </InputRow>;
}

export function TextPairInput({ leftKey, rightKey, doc }: { leftKey: JurisprudenciaKey & { key: JurisprudenciaDocumentTextKey }, rightKey: JurisprudenciaKey & { key: JurisprudenciaDocumentTextKey }, doc: JurisprudenciaDocument | PartialJurisprudenciaDocument }) {
    let [, setUpdateObject] = useContext(UpdateContext);
    let leftInitial = doc[leftKey.key] || "";
    let rightInitial = doc[rightKey.key] || "";
    let [leftHtml, setLeftHtml] = useState<string>(leftInitial);
    let [rightHtml, setRightHtml] = useState<string>(rightInitial);
    const mounted = useIsMounted();

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
        <div className="d-flex gap-2" style={{ height: "700px" }}>
            <div className="d-flex flex-column" style={{ width: "50%" }}>
                <small className={"fw-semibold mb-1" + (leftChanged ? " text-warning" : "")}>{leftKey.name}{leftChanged ? "*" : ""}</small>
                {mounted && <ReactQuill
                    className="flex-grow-1 overflow-hidden"
                    theme="snow"
                    defaultValue={leftInitial}
                    onChange={onLeftChange}
                />}
            </div>
            <div className="vr" />
            <div className="d-flex flex-column" style={{ width: "50%" }}>
                <small className={"fw-semibold mb-1" + (rightChanged ? " text-warning" : "")}>{rightKey.name}{rightChanged ? "*" : ""}</small>
                {mounted && <ReactQuill
                    className="flex-grow-1 overflow-hidden"
                    theme="snow"
                    defaultValue={rightInitial}
                    onChange={onRightChange}
                />}
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

type TokenSelectionProps = InputProps<JurisprudenciaDocumentGenericKey> & { editorSuggestions?: boolean, editorRestricted?: boolean };

// Votação is parametrized (category + vote counts) so it needs its own control
// instead of a token list. Dispatch happens before any hook runs, so each branch
// keeps a stable hook order.
export function TokenSelection(props: TokenSelectionProps) {
    if (props.accessKey.key === "Votação") {
        return <VotacaoSelection {...props} />;
    }
    return <GenericTokenSelection {...props} />;
}

function GenericTokenSelection({ accessKey, doc, editorSuggestions, editorRestricted }: TokenSelectionProps) {
    const [, setUpdateObject] = useContext(UpdateContext);
    const canBypassCanonical = useCanAccess("bypassCanonical");
    const router = useRouter();

    const fieldValue = doc[accessKey.key];
    const initialValue = fieldValue == null ? "" : fieldValue['Show'].join("\n");

    const [toSave, setToSave] = useState<boolean>(false);
    const defaultValue = useMemo(
        () => initialValue ? initialValue.split("\n").map(v => ({ value: v, label: v })) : [],
        [initialValue]
    );

    const controlledKey = isControlledField(accessKey.key) ? accessKey.key : null;
    const [selectedValues, setSelectedValues] = useState(defaultValue);

    const update = useCallback((newValue: string) => {
        if (newValue === initialValue) {
            setUpdateObject(({ [accessKey.key]: _key_to_remove, ...old }) => ({ ...old }));
            setToSave(false);
        } else {
            let Original = fieldValue?.Original ?? newValue.split("\n");
            let toBeNewValue = { Original, Show: newValue.split("\n"), Index: newValue.split("\n") };
            setUpdateObject((old) => ({ ...old, [accessKey.key]: toBeNewValue }));
            setToSave(true);
        }
    }, [initialValue, accessKey.key, fieldValue, setUpdateObject]);

    const blockNewValues = controlledKey ? !canBypassCanonical : editorRestricted;

    const loadOptions = useCallback(async (inputValue: string) => {
        const params = new URLSearchParams({ agg: accessKey.key });
        if (inputValue) params.set("prefix", inputValue);
        const res = await fetch(`${router.basePath}/api/datalist?${params}`);
        if (!res.ok) return [];
        const data: DatalistObj[] = await res.json();
        return data.map(d => ({ value: d.key, label: d.key }));
    }, [accessKey.key, router.basePath]);

    const handleChange = useCallback((evt: readonly { value: string; label: string }[]) => {
        const arr = [...evt];
        setSelectedValues(arr);
        update(arr.map(v => v.value).join("\n"));
    }, [update]);

    const handlePaste = useCallback(async (e: ClipboardEvent<HTMLDivElement>) => {
        const text = e.clipboardData?.getData("text/plain") || "";
        const cleaned = text.replace(/^descritores\s*:\s*/i, "");
        const tokens = cleaned.split(/[,;]/).map(t => t.trim()).filter(Boolean);
        if (tokens.length < 2) return;

        e.preventDefault();

        const results = await Promise.all(tokens.map(token => loadOptions(token)));
        const matched: { value: string; label: string }[] = [];
        const unmatched: string[] = [];

        for (let i = 0; i < tokens.length; i++) {
            const normalizedToken = tokens[i].toLowerCase();
            const match = results[i].find(o => o.value.toLowerCase() === normalizedToken);
            if (match) {
                matched.push(match);
            } else {
                unmatched.push(tokens[i]);
            }
        }

        if (matched.length > 0) {
            setSelectedValues(prev => {
                const existing = new Set(prev.map(v => v.value));
                const newValues = matched.filter(m => !existing.has(m.value));
                const merged = [...prev, ...newValues];
                update(merged.map(v => v.value).join("\n"));
                return merged;
            });
        }

        if (unmatched.length > 0) {
            alert(`${unmatched.length} descritor(es) não encontrado(s):\n${unmatched.join(", ")}`);
        }
    }, [loadOptions, update]);

    if (controlledKey) {
        const options = CanonicalValues[controlledKey].map(v => ({ value: v, label: v }));
        return (
            <InputRow accessKey={accessKey} toSave={toSave}>
                <Createable
                    placeholder="Selecione..."
                    defaultValue={defaultValue}
                    loadingMessage={() => "A carregar..."}
                    formatCreateLabel={(lbl) => `Novo ${accessKey.name}: "${lbl}"`}
                    className="w-75"
                    isMulti
                    options={options}
                    onChange={(evt) => update(evt.map(v => v.value).join("\n"))}
                    createOptionPosition="first"
                    isValidNewOption={() => !blockNewValues}
                    filterOption={createFilter({ matchFrom: "start", ignoreCase: true, ignoreAccents: true })}
                />
            </InputRow>
        );
    }

    return (
        <InputRow accessKey={accessKey} toSave={toSave}>
            <div className="w-75" onPaste={handlePaste}>
                <AsyncCreatable
                    placeholder="Escreva para pesquisar..."
                    value={selectedValues}
                    loadOptions={loadOptions}
                    loadingMessage={() => "A carregar..."}
                    noOptionsMessage={({ inputValue }) => inputValue ? "Sem resultados" : "Escreva para pesquisar..."}
                    formatCreateLabel={(lbl) => `Novo ${accessKey.name}: "${lbl}"`}
                    isMulti
                    onChange={handleChange}
                    createOptionPosition="first"
                    isValidNewOption={() => !blockNewValues}
                    cacheOptions
                />
            </div>
        </InputRow>
    );
}

// Index carries the count-free category (so the facet groups correctly) while Show
// carries the counts, rebuilt by formatVotacaoShow.
function VotacaoSelection({ accessKey, doc }: TokenSelectionProps) {
    const [, setUpdateObject] = useContext(UpdateContext);

    const fieldValue = doc[accessKey.key];
    const initialShow = fieldValue == null ? "" : fieldValue['Show'].join("\n");
    const initialParse = useMemo(() => parseVotacao(initialShow), [initialShow]);

    const [category, setCategory] = useState<string>(initialParse.matched ? initialParse.category : "");
    const [vencidos, setVencidos] = useState<number>(initialParse.vencidos);
    const [declaracoes, setDeclaracoes] = useState<number>(initialParse.declaracoes);
    const [toSave, setToSave] = useState<boolean>(false);

    const showsVencidos = category === "Maioria com votos vencidos" || category === "Maioria com votos vencidos e declarações de voto";
    const showsDeclaracoes = category === "Maioria com declarações de voto" || category === "Maioria com votos vencidos e declarações de voto";

    const update = (nextCategory: string, nextVencidos: number, nextDeclaracoes: number) => {
        setCategory(nextCategory);
        setVencidos(nextVencidos);
        setDeclaracoes(nextDeclaracoes);

        if (!nextCategory) {
            setUpdateObject(({ [accessKey.key]: _key_to_remove, ...old }) => ({ ...old }));
            setToSave(false);
            return;
        }

        const show = formatVotacaoShow(nextCategory as VotacaoCategory, nextVencidos, nextDeclaracoes);
        if (show === initialShow) {
            setUpdateObject(({ [accessKey.key]: _key_to_remove, ...old }) => ({ ...old }));
            setToSave(false);
            return;
        }

        const Original = fieldValue?.Original ?? [show];
        setUpdateObject((old) => ({ ...old, [accessKey.key]: { Original, Show: [show], Index: [nextCategory] } }));
        setToSave(true);
    };

    return (
        <InputRow accessKey={accessKey} toSave={toSave}>
            <select className="form-select w-50" value={category} onChange={(evt) => update(evt.target.value, vencidos, declaracoes)}>
                <option value="">Selecione...</option>
                {VotacaoCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {showsVencidos && <input className="form-control" type="number" min={0} value={vencidos} title="Votos vencidos"
                onChange={(evt) => update(category, parseInt(evt.target.value) || 0, declaracoes)} />}
            {showsDeclaracoes && <input className="form-control" type="number" min={0} value={declaracoes} title="Declarações de voto"
                onChange={(evt) => update(category, vencidos, parseInt(evt.target.value) || 0)} />}
            {category && <small className="input-group-text">{formatVotacaoShow(category as VotacaoCategory, vencidos, declaracoes)}</small>}
        </InputRow>
    );
}

function InputRow({ accessKey, toSave, children }: { accessKey: JurisprudenciaKey, toSave: boolean, children: React.ReactNode }) {
    return <div className="input-group ">
        <small className={"input-group-text w-25 align-items-start" + (toSave ? "fw-bold" : "")} >{accessKey.name}{toSave ? "*" : ""} </small>
        {children}
    </ div>;
}