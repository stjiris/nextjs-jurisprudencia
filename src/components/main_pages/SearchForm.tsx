'use client';

import Link from "next/link";
import { useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKeysFromContext } from "@/contexts/keys";
import { FORM_KEY, SwapableFilterList, UsedFilters } from "./SwapableFilterList";

// Helper field names used by the "mes" precision inputs (combined into MinDate/MaxDate on submit)
const MES_HELPERS = new Set(["_MinMesYear", "_MinMesMonth", "_MaxMesYear", "_MaxMesMonth"]);

function submit(form: HTMLFormElement, router: ReturnType<typeof useNavRouter>) {
    const fd = new FormData(form);
    const searchParams = new URLSearchParams();

    for (const key of fd.keys()) {
        if (MES_HELPERS.has(key)) continue;
        const values = fd.getAll(key).filter(v => String(v).length > 0);
        for (const v of values) searchParams.append(key, v as string);
    }

    // Combine year+month helper fields into MinDate / MaxDate (YYYY-MM format)
    const minMesYear  = (fd.get("_MinMesYear")  as string | null)?.trim();
    const minMesMonth = (fd.get("_MinMesMonth") as string | null)?.trim();
    if (minMesYear && minMesMonth) searchParams.set("MinDate", `${minMesYear}-${minMesMonth.padStart(2, "0")}`);

    const maxMesYear  = (fd.get("_MaxMesYear")  as string | null)?.trim();
    const maxMesMonth = (fd.get("_MaxMesMonth") as string | null)?.trim();
    if (maxMesYear && maxMesMonth) searchParams.set("MaxDate", `${maxMesYear}-${maxMesMonth.padStart(2, "0")}`);

    const currentParams = new URLSearchParams(window.location.search);
    const keysOrder = currentParams.get(FORM_KEY);
    if (keysOrder) searchParams.set(FORM_KEY, keysOrder);
    const rpp = currentParams.get("rpp");
    if (rpp) searchParams.set("rpp", rpp);
    const sort = currentParams.get("sort");
    if (sort) searchParams.set("sort", sort);

    router.push(`?${searchParams.toString()}`);
}

const MONTHS = [
    { value: "1",  label: "Jan" }, { value: "2",  label: "Fev" },
    { value: "3",  label: "Mar" }, { value: "4",  label: "Abr" },
    { value: "5",  label: "Mai" }, { value: "6",  label: "Jun" },
    { value: "7",  label: "Jul" }, { value: "8",  label: "Ago" },
    { value: "9",  label: "Set" }, { value: "10", label: "Out" },
    { value: "11", label: "Nov" }, { value: "12", label: "Dez" },
];

const CURRENT_YEAR = new Date().getFullYear();

// Intercept spinner clicks on an empty year input so up→current year, down→stays empty
function onYearInput(e: React.FormEvent<HTMLInputElement>, prevEmpty: React.MutableRefObject<boolean>) {
    const inp = e.currentTarget;
    if (prevEmpty.current && inp.value === "1900") inp.value = String(CURRENT_YEAR);
    else if (prevEmpty.current && inp.value === "2100") inp.value = "";
    prevEmpty.current = !inp.value;
}

type DatePrecision = "ano" | "mes" | "dia";

function detectPrecision(date: string): DatePrecision {
    if (/^\d{4}$/.test(date))       return "ano";
    if (/^\d{4}-\d{2}$/.test(date)) return "mes";
    return "dia";
}

export default function SearchForm({ count, filtersUsed }: { count: number; filtersUsed: Record<string, string[]> }) {
    const form = useRef<HTMLFormElement>(null);
    const router = useNavRouter();
    const minDateRef  = useRef<HTMLInputElement>(null);
    const minMonthRef = useRef<HTMLSelectElement>(null);
    const maxDateRef  = useRef<HTMLInputElement>(null);
    const maxMonthRef = useRef<HTMLSelectElement>(null);

    const search = useSearchParams();
    const term     = search.get("term");
    const group    = search.get("group");
    const q        = search.get("q");
    const minDate  = search.get("MinDate") || "";
    const maxDate  = search.get("MaxDate") || "";
    const keys = useKeysFromContext();

    const [minPrecision, setMinPrecision] = useState<DatePrecision>(() => minDate ? detectPrecision(minDate) : "dia");
    const [maxPrecision, setMaxPrecision] = useState<DatePrecision>(() => maxDate ? detectPrecision(maxDate) : "dia");

    // Sync precision if URL changes (e.g. navigating to a bookmarked URL)
    useEffect(() => { if (minDate) setMinPrecision(detectPrecision(minDate)); }, [minDate]);
    useEffect(() => { if (maxDate) setMaxPrecision(detectPrecision(maxDate)); }, [maxDate]);

    const resetDatas = useCallback(() => {
        if (minDateRef.current)  minDateRef.current.value  = "";
        if (minMonthRef.current) minMonthRef.current.value = "";
        if (maxDateRef.current)  maxDateRef.current.value  = "";
        if (maxMonthRef.current) maxMonthRef.current.value = "";
        setMinPrecision("dia");
        setMaxPrecision("dia");
    }, []);

    useEffect(() => {
        const el = form.current;
        if (!el) return;

        const handleChange = () => {
            const minVal      = minDateRef.current?.value  || "";
            const minMonthVal = minMonthRef.current?.value || "";
            const maxVal      = maxDateRef.current?.value  || "";
            const maxMonthVal = maxMonthRef.current?.value || "";

            submit(el, router);

            el.reset();
            if (minVal      && minDateRef.current)  minDateRef.current.value  = minVal;
            if (minMonthVal && minMonthRef.current) minMonthRef.current.value = minMonthVal;
            if (maxVal      && maxDateRef.current)  maxDateRef.current.value  = maxVal;
            if (maxMonthVal && maxMonthRef.current) maxMonthRef.current.value = maxMonthVal;
        };

        el.addEventListener("change", handleChange);
        return () => el.removeEventListener("change", handleChange);
    }, [router]);

    return (
        <form ref={form} method="get" className="position-sticky" style={{ top: 0 }}>
            {term && <input name="term" hidden value={term} readOnly />}
            {group && <input name="group" hidden value={group} readOnly />}

            <div className="d-block">
                <div className="d-flex align-items-center justify-content-between">
                    <b><i className="bi-archive" /> {count} Processos</b>
                    {(Object.keys(filtersUsed).length > 0 || q) && (
                        <Link
                            href={"?" + [term && `term=${encodeURIComponent(term)}`, group && `group=${encodeURIComponent(group)}`].filter(Boolean).join("&")}
                            className="text-danger text-decoration-none"
                            onClick={resetDatas}
                        >
                            <i className="bi bi-eraser-fill" /> Limpar
                        </Link>
                    )}
                </div>

                <input
                    type="search"
                    name="q"
                    className="form-control form-control-sm rounded-0 my-1"
                    placeholder="Texto Livre"
                    defaultValue={q || ""}
                />

                <DateRangeInput
                    label="De:"
                    name="MinDate"
                    precision={minPrecision}
                    onPrecision={setMinPrecision}
                    defaultValue={minDate}
                    inputRef={minDateRef}
                    monthRef={minMonthRef}
                />
                <DateRangeInput
                    label="Até:"
                    name="MaxDate"
                    precision={maxPrecision}
                    onPrecision={setMaxPrecision}
                    defaultValue={maxDate}
                    inputRef={maxDateRef}
                    monthRef={maxMonthRef}
                />

                <div className="form-check my-1">
                    <input
                        id="checkbox-has-text"
                        type="checkbox"
                        name="mustHaveText"
                        value="true"
                        defaultChecked={search.has("mustHaveText")}
                        className="form-check-input"
                    />
                    <label htmlFor="checkbox-has-text" className="form-check-label">
                        Tem de ter {keys?.records?.Texto?.name}
                    </label>
                </div>

                <SwapableFilterList filtersUsed={filtersUsed} />
            </div>
        </form>
    );
}

function DateRangeInput({ label, name, precision, onPrecision, defaultValue, inputRef, monthRef }: {
    label: string;
    name: string;
    precision: DatePrecision;
    onPrecision: (p: DatePrecision) => void;
    defaultValue: string;
    inputRef: React.RefObject<HTMLInputElement>;
    monthRef: React.RefObject<HTMLSelectElement>;
}) {
    const yearDefault       = defaultValue.slice(0, 4);
    const monthSelectDefault = defaultValue.length >= 7 ? String(parseInt(defaultValue.slice(5, 7))) : "";
    const dayDefault        = defaultValue.length === 10 ? defaultValue : "";

    // Track whether the year input was empty before the last input event (for spinner correction)
    const prevEmpty = useRef(!yearDefault);

    // Helper names for "mes" mode so year alone doesn't pollute MinDate/MaxDate
    const prefix      = name === "MinDate" ? "Min" : "Max";
    const mesYearName = `_${prefix}MesYear`;
    const mesMonthName = `_${prefix}MesMonth`;

    const inputCls = "form-control form-control-sm rounded-0";

    return (
        <div className="my-1">
            <div className="d-flex gap-1 mb-1">
                <small className="input-group-text rounded-0 px-1" style={{ minWidth: 50 }}>{label}</small>
                {(["ano", "mes", "dia"] as DatePrecision[]).map(p => (
                    <button
                        key={p}
                        type="button"
                        className={`btn btn-outline-secondary btn-sm px-1 py-0${precision === p ? " active" : ""}`}
                        onClick={() => onPrecision(p)}
                    >
                        {p === "ano" ? "Ano" : p === "mes" ? "Mês" : "Dia"}
                    </button>
                ))}
            </div>

            {precision === "ano" && (
                <input
                    key="ano"
                    type="number"
                    name={name}
                    ref={inputRef}
                    placeholder={`Ano (ex: ${CURRENT_YEAR})`}
                    min="1900"
                    max="2100"
                    defaultValue={yearDefault}
                    className={inputCls}
                    onInput={(e) => onYearInput(e, prevEmpty)}
                />
            )}

            {precision === "mes" && (
                <div key="mes" className="input-group input-group-sm">
                    <input
                        type="number"
                        name={mesYearName}
                        ref={inputRef}
                        placeholder={`${CURRENT_YEAR}`}
                        min="1900"
                        max="2100"
                        defaultValue={yearDefault}
                        className={inputCls}
                        onInput={(e) => onYearInput(e, prevEmpty)}
                        onChange={(e) => e.stopPropagation()} // year alone doesn't submit; month select does
                    />
                    <select
                        name={mesMonthName}
                        ref={monthRef}
                        defaultValue={monthSelectDefault}
                        className="form-select form-select-sm rounded-0"
                    >
                        <option value="">Mês</option>
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
            )}

            {precision === "dia" && (
                <input
                    key="dia"
                    type="date"
                    name={name}
                    ref={inputRef}
                    defaultValue={dayDefault}
                    className={inputCls}
                />
            )}
        </div>
    );
}
