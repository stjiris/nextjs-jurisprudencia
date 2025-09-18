import { DatalistObj } from "@/types/search";
import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context";
import Link from "next/link";
import { ReadonlyURLSearchParams, useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { NextRouter, useRouter } from "next/router";
import { Dispatch, DragEventHandler, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FORM_KEY, useFormOrderedKeys } from "./formKeys";
import { replaceSearchParams } from "./select-navigate";
import { useKeysFromContext } from "@/contexts/keys";
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

function submit(form: HTMLFormElement, router: AppRouterInstance) {
    const fd = new FormData(form);
    const searchParams = new URLSearchParams();
    for (let key of fd.keys()) {
        let values = fd.getAll(key).filter(v => v.length > 0);
        searchParams.delete(key);
        for (let v of values) {
            searchParams.append(key, v as string);
        }
    }
    let keysOrder = new URLSearchParams(window.location.search).get(FORM_KEY);
    if (keysOrder) {
        searchParams.set(FORM_KEY, keysOrder);
    }
    router.push(`?${searchParams.toString()}`);
}

function parseISOToLocalDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if ([y, m, d].some(n => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d);
}

function isoDateOnly(value?: string | null): string {
  if (!value) return "";
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function firstFilter(filtersUsed: Record<string, string[]>, key: string): string | undefined {
  return (filtersUsed && filtersUsed[key] && filtersUsed[key].length > 0) ? filtersUsed[key][0] : undefined;
}

export default function SearchForm({ count, filtersUsed }: { count: number, filtersUsed: Record<string, string[]>}) {
    const form = useRef<HTMLFormElement | null>(null);
    const dataInicio = useRef<HTMLInputElement | null>(null);
    const dataFim = useRef<HTMLInputElement | null>(null);
    const router = useNavRouter();

    const rawMin = firstFilter(filtersUsed, "MinDate") ?? firstFilter(filtersUsed, "MinData") ?? undefined;
    const rawMax = firstFilter(filtersUsed, "MaxDate") ?? firstFilter(filtersUsed, "MaxData") ?? undefined;

    const minDateStr = isoDateOnly(rawMin);
    const maxDateStr = isoDateOnly(rawMax);

    // If you need Date objects for logic:
    const minDateObj = parseISOToLocalDate(minDateStr);
    const maxDateObj = parseISOToLocalDate(maxDateStr);

    const resetDatas = useCallback(() => {
        if (dataInicio.current) dataInicio.current.value = "";
        if (dataFim.current) dataFim.current.value = "";
    }, [dataFim, dataInicio]);

    function validateStartEnd(): boolean {
        const startVal = dataInicio.current?.value || "";
        const endVal = dataFim.current?.value || "";

        if (dataFim.current && 'setCustomValidity' in dataFim.current) {
            (dataFim.current as HTMLInputElement).setCustomValidity("");
        }

        if (startVal && endVal && startVal > endVal) {
            if (dataFim.current && 'setCustomValidity' in dataFim.current) {
                (dataFim.current as HTMLInputElement).setCustomValidity("Data final deve ser igual ou posterior à data inicial");
            }
            return false;
        }
        return true;
    }

    useEffect(() => {
        const element = form.current;
        const handleSubmit = () => {
            const okDates = validateStartEnd();
            if (!okDates) {
                element?.reportValidity();
                return;
            }

            if (element?.checkValidity()) {
                submit(element, router);
                const valueDataInicio = dataInicio.current?.value;
                const valueDataFim = dataFim.current?.value;
                if (dataInicio.current && valueDataInicio)
                    dataInicio.current.value = valueDataInicio;
                if (dataFim.current && valueDataFim)
                    dataFim.current.value = valueDataFim;
            } else {
                element?.reportValidity();
            }
        };
        element?.addEventListener("change", handleSubmit);
        return () => element?.removeEventListener("change", handleSubmit);
    }, [form, router, minDateStr, maxDateStr]);

    const search = useSearchParams();
    const q = search.get("q");
    const term = search.get("term");
    const group = search.get("group");
    const keys = useKeysFromContext();
    // Advanced search state
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [advancedRows, setAdvancedRows] = useState([{ op: "", term: q || "" }]);
    const [freeText, setFreeText] = useState(q || "");

    function handleAdvancedChange(idx: number, field: "op" | "term", value: string) {
        console.log('Advanced Change:', { idx, field, value });
        setAdvancedRows(rows => {
            const newRows = rows.map((row, i) => i === idx ? { ...row, [field]: value } : row);
            console.log('New Advanced Rows:', newRows);
            return newRows;
        });
    }
    function addAdvancedRow() {
        setAdvancedRows(rows => [...rows, { op: "AND", term: "" }]);
    }
    function removeAdvancedRow(idx: number) {
        setAdvancedRows(rows => rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows);
    }
    function buildAdvancedQuery() {
        const query = advancedRows.map((row, i) => {
            if (i === 0) return row.term;
            if (row.op === "NOT") return `AND NOT ${row.term}`;
            return `${row.op} ${row.term}`;
        }).join(" ").replace(/ +/g, " ");
        console.log('Built Query:', query);
        return query;
    }
    function handleAdvancedApply() {
        const query = buildAdvancedQuery();
        console.log('Applying Query:', query);
        setFreeText(query);
        // Also update the input value in the form
        const input = form.current?.querySelector('input[name="q"]') as HTMLInputElement;
        if (input) {
            input.value = query;
            console.log('Updated input value:', input.value);
        }
        // Trigger form submit
        form.current?.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function handleFreeTextChange(e: React.ChangeEvent<HTMLInputElement>) {
        setFreeText(e.target.value);
        setAdvancedRows([{ op: "", term: e.target.value }]);
    }

    return (
        <form ref={form} method="get" style={{ top: 0 }} className="position-sticky">
            {term ? <input type="text" name="term" hidden value={term} readOnly /> : ""}
            {group ? <input type="text" name="group" hidden value={group} readOnly /> : ""}
            <div className="d-block">
                <div className="d-flex align-items-center justify-content-between">
                    <b className="d-inline m-0">
                        <i className="bi-archive"></i> {count} Processos
                    </b>
                    {(Object.keys(filtersUsed).length > 0 || q) && (
                        <Link
                            className="text-danger text-decoration-none"
                            href={"?" + [term ? `term=${encodeURIComponent(term)}` : "", group ? `group=${encodeURIComponent(group)}` : ""].filter(s => s.length > 0).join("&")}
                            onClick={resetDatas}>
                            <i className="bi bi-eraser-fill"></i> Limpar
                        </Link>
                    )}
                </div>
                <div className="d-flex my-1 pb-1 align-items-baseline">
                    <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
                    <div className="w-100">
                        <input type="search" className="form-control form-control-sm rounded-0" name="q" placeholder="Texto Livre" defaultValue={q || ""} onChange={handleFreeTextChange} />
                        <span
                            className="text-primary fw-semibold cursor-pointer user-select-none"
                            style={{ textDecoration: showAdvanced ? 'underline' : 'none', transition: 'text-decoration 0.2s', display: 'inline-block', marginTop: '2px' }}
                            tabIndex={0}
                            role="button"
                            onClick={() => setShowAdvanced(v => !v)}
                            onKeyPress={e => { if (e.key === 'Enter' || e.key === ' ') setShowAdvanced(v => !v); }}
                            onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseOut={e => (e.currentTarget.style.textDecoration = showAdvanced ? 'underline' : 'none')}
                        >
                            {showAdvanced ? "Ocultar Pesquisa Avançada" : "Pesquisa Avançada"}
                        </span>
                    </div>
                </div>
                {showAdvanced && (
                    <div className="border rounded p-2 bg-light small mb-2" style={{ maxWidth: 350, margin: '0 auto' }}>
                        <div className="d-flex align-items-center mb-2">
                            <span className="fw-semibold">Pesquisa Avançada</span>
                            <OverlayTrigger
                                placement="right"
                                overlay={
                                    <Tooltip id="advanced-help-tooltip">
                                        <div><b>E</b>: ambos os termos devem aparecer.<br/><b>OU</b>: pelo menos um termo.<br/><b>NÃO</b>: exclui resultados com o termo.</div>
                                    </Tooltip>
                                }
                            >
                                <i className="bi bi-question-circle advanced-help-icon" tabIndex={0} aria-label="Ajuda sobre operadores" />
                            </OverlayTrigger>
                        </div>
                        {advancedRows.map((row, idx) => {
                            // Ensure op is always valid for dropdown
                            const validOps = ["AND", "OR", "NOT"];
                            const opValue = validOps.includes(row.op) ? row.op : "AND";
                            return (
                                <div className="d-flex align-items-center mb-1 advanced-row-hover" key={idx}>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm me-1"
                                        placeholder="Termo"
                                        value={row.term}
                                        onChange={e => handleAdvancedChange(idx, "term", e.target.value)}
                                        style={{ flex: 1 }}
                                        tabIndex={0}
                                    />
                                    {idx > 0 && (
                                        <select
                                            className="form-select form-select-sm ms-1 me-1"
                                            value={opValue}
                                            onChange={e => handleAdvancedChange(idx, "op", e.target.value)}
                                            style={{ width: 70 }}
                                            tabIndex={0}
                                            aria-label="Operador lógico"
                                        >
                                            <option value="AND">E</option>
                                            <option value="OR">OU</option>
                                            <option value="NOT">NÃO</option>
                                        </select>
                                    )}
                                    {advancedRows.length > 1 && (
                                        <OverlayTrigger
                                            placement="top"
                                            overlay={<Tooltip id={`trash-tooltip-${idx}`}>Remover termo</Tooltip>}
                                        >
                                            <button
                                                className="btn btn-danger btn-sm ms-1"
                                                type="button"
                                                onClick={() => removeAdvancedRow(idx)}
                                                title="Remover"
                                                tabIndex={0}
                                                aria-label="Remover termo"
                                            >
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        </OverlayTrigger>
                                    )}
                                </div>
                            );
                        })}
                        <div className="d-flex justify-content-between mt-2">
                            <button className="btn btn-secondary btn-sm me-1" type="button" onClick={addAdvancedRow} style={{ minWidth: 36 }} tabIndex={0} aria-label="Adicionar termo">+</button>
                            <button className="btn btn-primary btn-sm" type="button" onClick={handleAdvancedApply} style={{ minWidth: 80 }} tabIndex={0} aria-label="Aplicar pesquisa">Aplicar</button>
                        </div>
                    </div>
                )}
                <div className="d-flex my-1 pb-1 align-items-baseline">
                    <small className="pe-1 text-white"><i className="bi bi-calendar3"></i></small>
                    <div className="input-group input-group-sm">
                        <div className="input-group-prepend flex-shrink">
                            <label htmlFor="data_inicio" className="input-group-text rounded-0 p-1">De:</label>
                        </div>
                        <input
                            id="data_inicio"
                            type="date"
                            name="MinDate"
                            min={minDateStr || undefined}
                            max={maxDateStr || undefined}
                            defaultValue={search.get("MinDate") || minDateStr || ""}
                            ref={dataInicio as React.RefObject<HTMLInputElement>}
                            onChange={() => { validateStartEnd(); }}
                        />
                    </div>
                    
                </div>
                <div className="d-flex my-1 pb-1 align-items-baseline">
                    <small className="pe-1 text-white"><i className="bi bi-calendar3"></i></small>
                    <div className="input-group input-group-sm">
                        <div className="input-group-prepend flex-shrink">
                            <label htmlFor="data_fim" className="input-group-text rounded-0 p-1">Até:</label>
                        </div>
                        <input
                            id="data_fim"
                            type="date"
                            name="MaxDate"
                            min={minDateStr || undefined}
                            max={maxDateStr || undefined}
                            defaultValue={search.get("MaxDate") || maxDateStr || ""}
                            ref={dataInicio as React.RefObject<HTMLInputElement>}
                            onChange={() => { validateStartEnd(); }}
                        />
                    </div>
                </div>

            
                <div className="d-flex align-items-baseline">
                    <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
                    <div className="my-1 pb-1 align-items-baseline form-check">
                        <input id="checkbox-has-text" type="checkbox" className="form-check-input" name="mustHaveText" value="true" defaultChecked={search.has("mustHaveText")} />
                        <label className="form-check-label" htmlFor="checkbox-has-text">Tem de ter {keys?.records?.Texto?.name}</label>
                    </div>
                </div>
                {"hasField" in filtersUsed && (
                    <div className="d-flex align-items-baseline">
                        <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
                        <div className="d-flex w-100 flex-column my-1 border pb-1">
                            <input type="text" className="form-control form-control-sm border-0 border-bottom rounded-0" name="hasField" autoComplete="off" list="datalist-Campos" placeholder="Tem de ter o campo" />
                            <UsedFilters filtersUsed={filtersUsed} accessKey="hasField" />
                        </div>
                    </div>
                )}
                {"notHasField" in filtersUsed && (
                    <div className="d-flex align-items-baseline">
                        <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
                        <div className="d-flex w-100 flex-column my-1 border pb-1">
                            <input type="text" className="form-control form-control-sm border-0 border-bottom rounded-0" name="notHasField" autoComplete="off" list="datalist-Campos" placeholder="Não pode ter o campo" />
                            <UsedFilters filtersUsed={filtersUsed} accessKey="notHasField" />
                        </div>
                    </div>
                )}
                <SwapableFilterList filtersUsed={filtersUsed} />
            </div>
        </form>
    );
}

function SwapableFilterList({ filtersUsed }: { filtersUsed: Record<string, string[]> }) {
    let [sort, { move, all, hide }, rest] = useFormOrderedKeys();
    let [target, setTarget] = useState<number>();
    let [selected, setSelected] = useState<number>();
    // New state to trigger a refresh in FilterList when order changes.
    const [orderVersion, setOrderVersion] = useState(0);

    let dragEnd: DragEventHandler<HTMLDivElement> = (e) => {
        if (selected === undefined || target === undefined) return;

        if (selected === -1) {
            hide(target);
            setSelected(undefined);
            setTarget(undefined);
        }
        if (selected >= 0) {
            move(target, selected);
            // Increment reset trigger when a filter is moved.
            setOrderVersion(prev => prev + 1);
            setSelected(undefined);
            setTarget(selected);
            setTimeout(() => setTarget(undefined), 1800);
        }
    };

    let dragStart: DragEventHandler<HTMLDivElement> = (e) => {
        setTarget(parseInt(e.currentTarget.dataset.key!));
    };
    let dragOver: DragEventHandler<HTMLElement> = (e) => {
        setSelected(parseInt(e.currentTarget.dataset.key!));
    };

    return (
        <div data-key="-2" className="border-top">
            <div className="d-flex my-1 pb-1 align-items-baseline">
                <small className="pe-1 text-white"><i className="bi bi-dash"></i></small>
                <a role="button"
                    className={"bg-white flex-grow border-0 text-dark " + ((target !== undefined && selected !== undefined) || rest !== 0 ? "" : "text-muted")}
                    onDragOver={dragOver}
                    onClick={(e) => {
                        e.preventDefault();
                        if (rest !== 0) {
                            all(); // Mostra filtros
                        } else {
                            // Esconde filtros
                            for (let i = 0; i < sort.length; i++) {
                                hide(i);
                            }
                        }
                    }}

                    data-key="-1">
                    <i className="bi bi-eye"></i> Esconder / Repor ({rest})
                </a>
            </div>
            {sort.map((k, i) => k && (
                <div
                    data-key={i}
                    key={i}
                    draggable
                    onDragOver={dragOver}
                    onDragStart={dragStart}
                    onDragEnd={dragEnd}
                    className={"d-flex align-items-baseline " + (selected === i || target === i ? "shadow" : "")}
                    style={{ backgroundColor: selected === i || target === i ? "#e0f7fa" : "transparent" }}  // Melhoria visual ao movimentar filtros
                >
                    <small className={`pe-1 ${target !== i ? "text-muted" : ""} cursor-move`} style={{ cursor: "move" }}>
                        <i className="bi bi-list"></i>
                    </small>
                    <FilterList
                        filtersUsed={filtersUsed}
                        accessKey={k.key}
                        showKey={k.name}
                        dontSuggest={!k.filtersSuggest}
                        resetTrigger={orderVersion}  // Pass the reset trigger
                    />
                </div>
            ))}
        </div>
    );
}

function FilterList({
    filtersUsed,
    accessKey,
    dontSuggest,
    showKey,
    resetTrigger
}: {
    filtersUsed: Record<string, string[]>,
    accessKey: keyof JurisprudenciaDocument | string,
    dontSuggest?: boolean,
    showKey?: string,
    resetTrigger: number
}) {
    const datalistId = `datalist-${encodeURIComponent(accessKey)}`;
    const searchParams = useSearchParams();
    const router = useRouter();
    const [datalist, setDatalist] = useState<DatalistObj[]>([]);

    // Reset the datalist whenever resetTrigger changes.
    useEffect(() => {
        console.log("Resetting datalist due to resetTrigger:", resetTrigger);
        setDatalist([]);
    }, [resetTrigger]);

    // Add automatic mapping function for Secção to Área
    const areaFromSeccao = (seccao: string) => {
        const map: Record<string, string> = {
            "1.ª Secção (Cível)": "Área Cível",
            "2.ª Secção (Cível)": "Área Cível",
            "3.ª Secção (Criminal)": "Área Criminal",
            "4.ª Secção (Social)": "Área Social",
            "5.ª Secção (Criminal)": "Área Criminal",
            "6.ª Secção (Cível)": "Área Cível",
            "7.ª Secção (Cível)": "Área Cível",
        };
        return map[seccao] || "";
    };

    return (
        <div className="d-flex flex-column my-1 border pb-1 flex-grow-1">
            <datalist id={datalistId}>
                {datalist.map(({ key, count }, i) => (
                    <option key={i} value={`"${key}"`} label={count ? `Quantidade: ${count}` : ""} />
                ))}
            </datalist>
            <input
                type="text"
                className="form-control form-control-sm border-0 border-bottom rounded-0"
                name={accessKey}
                autoComplete="off"
                list={datalistId}
                placeholder={(showKey || accessKey)}
                onFocus={() => {
                    if (!dontSuggest && datalist.length === 0) {
                        loadDatalist(router, accessKey, searchParams, setDatalist);
                    }
                }}
                onChange={e => {
                    // If this is the Secção input, auto-set Área
                    if (accessKey === "Secção") {
                        const area = areaFromSeccao(e.target.value.replace(/"/g, ""));
                        if (area) {
                            const form = e.target.form;
                            if (form) {
                                const areaInput = form.querySelector('input[name="Área"]') as HTMLInputElement;
                                if (areaInput) {
                                    areaInput.value = area;
                                    // Trigger change event for Área
                                    areaInput.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }
                        }
                    }
                }}
            />
            <UsedFilters filtersUsed={filtersUsed} accessKey={accessKey} />
        </div>
    );
}

function InvertFilter({ accessKey, currValue }: { accessKey: string, currValue: string }) {
    const searchParams = useSearchParams();
    const isNeg = currValue.startsWith("not:");
    const newValue = isNeg ? currValue.replace(/^not:/, "") : `not:${currValue}`;
    const params = new URLSearchParams(searchParams.toString());
    return (
        <Link className="text-body" href={`?${replaceSearchParams(params, accessKey, newValue, currValue)}`}>
            <i className={`mx-1 bi bi-dash-circle${isNeg ? "-fill" : ""}`}></i>
            <i className={`me-1 bi bi-plus-circle${!isNeg ? "-fill" : ""}`}></i>
        </Link>
    );
}

function UsedFilters({ filtersUsed, accessKey }: { filtersUsed: Record<string, string[]>, accessKey: string }) {
    let cache: string[] = [];
    let comps: JSX.Element[] = [];
    if (accessKey in filtersUsed) {
        for (let [i, value] of filtersUsed[accessKey].entries()) {
            if (cache.indexOf(value) === -1) {
                cache.push(value);
                const id = `checkbox-${encodeURIComponent(value)}`;
                comps.push(
                    <div key={i} className="p-1 m-0 d-flex align-items-center" style={{ background: "var(--secondary-gold)", borderBottom: "1px solid var(--primary-gold)" }}>
                        <input type="checkbox" className="form-check-input" name={accessKey} value={value} id={id} hidden defaultChecked={true} />
                        <InvertFilter currValue={value} accessKey={accessKey} />
                        <span className="d-block flex-grow-1 mx-1">{value.replace(/^not:/, "")}</span>
                        <label role="button" htmlFor={id} className="form-check-label d-flex justify-content-between align-items-center">
                            <span className="d-block text-danger"><i className="bi bi-trash"></i></span>
                        </label>
                    </div>
                );
            }
        }
    }
    return <>{comps}</>;
}

async function loadDatalist(
    router: NextRouter,
    accessKey: string,
    searchParams: ReadonlyURLSearchParams,
    setDatalist: Dispatch<SetStateAction<DatalistObj[]>>
) {
    try {
        const response = await fetch(`${router.basePath}/api/datalist?agg=${encodeURIComponent(accessKey)}&${searchParams.toString()}`);
        const data = await response.json();
        setDatalist(data);
    } catch (e) {
        console.log(e);
        setDatalist([]);
    }
}
