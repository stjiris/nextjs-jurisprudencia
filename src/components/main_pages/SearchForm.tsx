'use client';

import Link from "next/link";
import { useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useKeysFromContext } from "@/contexts/keys";
import { FORM_KEY, SwapableFilterList } from "./SwapableFilterList";

// Helper field names combined into MinDate/MaxDate on submit
const DATE_HELPERS = new Set(["_MinDay", "_MinMonth", "_MinYear", "_MaxDay", "_MaxMonth", "_MaxYear"]);

const CURRENT_YEAR = new Date().getFullYear();

function submit(form: HTMLFormElement, router: ReturnType<typeof useNavRouter>) {
    const fd = new FormData(form);
    const searchParams = new URLSearchParams();
    const processedKeys = new Set<string>();

    for (const key of fd.keys()) {
        if (DATE_HELPERS.has(key)) continue;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);
        const seen = new Set<string>();
        for (const v of fd.getAll(key)) {
            const s = String(v);
            if (s.length > 0 && !seen.has(s)) { seen.add(s); searchParams.append(key, s); }
        }
    }

    // Precision is implicit: YYYY if only year, YYYY-MM if year+month, YYYY-MM-DD if all three
    for (const prefix of ["Min", "Max"] as const) {
        const year  = (fd.get(`_${prefix}Year`)  as string | null)?.trim();
        const month = (fd.get(`_${prefix}Month`) as string | null)?.trim();
        const day   = (fd.get(`_${prefix}Day`)   as string | null)?.trim();
        const paramKey = `${prefix}Date`;
        if (year && month && day) {
            searchParams.set(paramKey, `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
        } else if (year && month) {
            searchParams.set(paramKey, `${year}-${month.padStart(2, "0")}`);
        } else if (year) {
            searchParams.set(paramKey, year);
        }
    }

    const currentParams = new URLSearchParams(window.location.search);
    const keysOrder = currentParams.get(FORM_KEY);
    if (keysOrder) searchParams.set(FORM_KEY, keysOrder);
    const rpp = currentParams.get("rpp");
    if (rpp) searchParams.set("rpp", rpp);
    const sort = currentParams.get("sort");
    if (sort) searchParams.set("sort", sort);

    router.push(`?${searchParams.toString()}`);
}

// Intercept spinner clicks on an empty year input so up→current year, down→stays empty
function onYearInput(e: React.FormEvent<HTMLInputElement>, prevEmpty: React.MutableRefObject<boolean>) {
    const inp = e.currentTarget;
    if (prevEmpty.current && inp.value === "1900") inp.value = String(CURRENT_YEAR);
    else if (prevEmpty.current && inp.value === "2100") inp.value = "";
    prevEmpty.current = !inp.value;
}

const MONTHS = [
    { value: "1",  label: "Jan" }, { value: "2",  label: "Fev" },
    { value: "3",  label: "Mar" }, { value: "4",  label: "Abr" },
    { value: "5",  label: "Mai" }, { value: "6",  label: "Jun" },
    { value: "7",  label: "Jul" }, { value: "8",  label: "Ago" },
    { value: "9",  label: "Set" }, { value: "10", label: "Out" },
    { value: "11", label: "Nov" }, { value: "12", label: "Dez" },
];

export default function SearchForm({ count, filtersUsed }: { count: number; filtersUsed: Record<string, string[]> }) {
    const form = useRef<HTMLFormElement>(null);
    const router = useNavRouter();
    const submitting = useRef(false);

    const minYearRef  = useRef<HTMLInputElement>(null);
    const minMonthRef = useRef<HTMLSelectElement>(null);
    const minDayRef   = useRef<HTMLInputElement>(null);
    const maxYearRef  = useRef<HTMLInputElement>(null);
    const maxMonthRef = useRef<HTMLSelectElement>(null);
    const maxDayRef   = useRef<HTMLInputElement>(null);

    const search = useSearchParams();
    const term    = search.get("term");
    const group   = search.get("group");
    const q       = search.get("q") || "";
    const qValues = search.getAll("q").filter(v => v.length > 0);
    const minDate = search.get("MinDate") || "";
    const maxDate = search.get("MaxDate") || "";
    const keys = useKeysFromContext();

    const resetDatas = useCallback(() => {
        if (minDayRef.current)   { minDayRef.current.value   = ""; }
        if (minMonthRef.current) { minMonthRef.current.value = ""; minMonthRef.current.style.color = "var(--bs-secondary-color, #6c757d)"; }
        if (minYearRef.current)  { minYearRef.current.value  = ""; }
        if (maxDayRef.current)   { maxDayRef.current.value   = ""; }
        if (maxMonthRef.current) { maxMonthRef.current.value = ""; maxMonthRef.current.style.color = "var(--bs-secondary-color, #6c757d)"; }
        if (maxYearRef.current)  { maxYearRef.current.value  = ""; }
    }, []);

    useEffect(() => {
        const el = form.current;
        if (!el) return;

        const handleChange = (e: Event) => {
            if (submitting.current) return;
            submitting.current = true;
            const target = e.target as HTMLElement;

            // Auto-fill: day filled → fill month (default) + year (current) if empty
            // Auto-fill: month filled → fill year (current) if empty
            for (const [dayRef, monthRef, yearRef, autoMonth] of [
                [minDayRef, minMonthRef, minYearRef, "1"],
                [maxDayRef, maxMonthRef, maxYearRef, "12"],
            ] as const) {
                if (target === dayRef.current && dayRef.current?.value) {
                    if (monthRef.current && !monthRef.current.value) {
                        monthRef.current.value = autoMonth;
                        monthRef.current.style.color = "";
                    }
                    if (yearRef.current && !yearRef.current.value) {
                        yearRef.current.value = String(CURRENT_YEAR);
                    }
                }
                if (target === monthRef.current && monthRef.current?.value) {
                    if (yearRef.current && !yearRef.current.value) {
                        yearRef.current.value = String(CURRENT_YEAR);
                    }
                }
            }

            submit(el, router);

            // Clear filter text inputs so stale typed values don't re-submit on the next change
            el.querySelectorAll<HTMLInputElement>("input[list]").forEach(inp => { inp.value = ""; });

            submitting.current = false;
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
                    {(Object.keys(filtersUsed).length > 0 || qValues.length > 0) && (
                        <Link
                            href={"?" + [term && `term=${encodeURIComponent(term)}`, group && `group=${encodeURIComponent(group)}`].filter(Boolean).join("&")}
                            className="text-danger text-decoration-none"
                            onClick={resetDatas}
                        >
                            <i className="bi bi-eraser-fill" /> Limpar
                        </Link>
                    )}
                </div>

                <input type="search" name="q" defaultValue={q} className="form-control form-control-sm my-1" placeholder="Texto Livre" />

                <DateRangeInput
                    label="De:"
                    name="MinDate"
                    isMin={true}
                    defaultValue={minDate}
                    yearRef={minYearRef}
                    monthRef={minMonthRef}
                    dayRef={minDayRef}
                />
                <DateRangeInput
                    label="Até:"
                    name="MaxDate"
                    isMin={false}
                    defaultValue={maxDate}
                    yearRef={maxYearRef}
                    monthRef={maxMonthRef}
                    dayRef={maxDayRef}
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
                        Tem de ter {keys?.records?.Texto?.name} de Acordão
                    </label>
                </div>

                <SwapableFilterList filtersUsed={filtersUsed} />
            </div>
        </form>
    );
}

function DateRangeInput({ label, name, isMin, defaultValue, yearRef, monthRef, dayRef }: {
    label: string;
    name: string;
    isMin: boolean;
    defaultValue: string;
    yearRef: React.RefObject<HTMLInputElement>;
    monthRef: React.RefObject<HTMLSelectElement>;
    dayRef: React.RefObject<HTMLInputElement>;
}) {
    const yearDefault  = defaultValue.slice(0, 4);
    const monthDefault = defaultValue.length >= 7 ? String(parseInt(defaultValue.slice(5, 7))) : "";
    const dayDefault   = defaultValue.length === 10 ? String(parseInt(defaultValue.slice(8, 10))) : "";

    const prevEmpty     = useRef(!yearDefault);
    const datePickerRef = useRef<HTMLInputElement>(null);

    const prefix   = name === "MinDate" ? "Min" : "Max";
    const inputCls = "form-control form-control-sm rounded-0";
    const grey     = "var(--bs-secondary-color, #6c757d)";

    function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
        const val = e.target.value; // "YYYY-MM-DD"
        if (!val) return;
        const [y, m, d] = val.split("-");
        if (dayRef.current)   dayRef.current.value   = String(parseInt(d));
        if (monthRef.current) { monthRef.current.value = String(parseInt(m)); monthRef.current.style.color = ""; }
        if (yearRef.current)  yearRef.current.value   = y;
        // Trigger form change to auto-submit
        yearRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
    }

    return (
        <div className="my-1">
            <small className="d-block mb-1 text-muted">{label}</small>
            <div className="input-group input-group-sm">
                {/* Day */}
                <input
                    type="number"
                    name={`_${prefix}Day`}
                    ref={dayRef}
                    min="1"
                    max="31"
                    placeholder="dia"
                    defaultValue={dayDefault}
                    className={inputCls}
                />

                {/* Month */}
                <select
                    name={`_${prefix}Month`}
                    ref={monthRef}
                    defaultValue={monthDefault}
                    className="form-select form-select-sm rounded-0"
                    style={{ color: monthDefault ? undefined : grey }}
                    onChange={(e) => {
                        e.currentTarget.style.color = e.currentTarget.value ? "" : grey;
                    }}
                >
                    <option value="">mês</option>
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>

                {/* Year */}
                <input
                    type="number"
                    name={`_${prefix}Year`}
                    ref={yearRef}
                    min="1900"
                    max="2100"
                    placeholder={String(CURRENT_YEAR)}
                    defaultValue={yearDefault}
                    className={inputCls}
                    onInput={(e) => onYearInput(e, prevEmpty)}
                />

                {/* Hidden native date picker */}
                <input
                    type="date"
                    ref={datePickerRef}
                    onChange={handlePickerChange}
                    style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none", border: 0, padding: 0 }}
                    tabIndex={-1}
                    aria-hidden="true"
                />
                <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-2"
                    title="Escolher data"
                    onClick={() => {
                        try { datePickerRef.current?.showPicker(); }
                        catch { datePickerRef.current?.click(); }
                    }}
                >
                    <i className="bi bi-calendar3" />
                </button>
            </div>
        </div>
    );
}
