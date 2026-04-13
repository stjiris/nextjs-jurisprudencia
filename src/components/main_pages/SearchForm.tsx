'use client';

import Link from "next/link";
import { useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKeysFromContext } from "@/contexts/keys";
import { FORM_KEY, SwapableFilterList, UsedFilters } from "./SwapableFilterList";

// Helper field names combined into MinDate/MaxDate on submit
const DATE_HELPERS = new Set(["_MinDay", "_MinMonth", "_MinYear", "_MaxDay", "_MaxMonth", "_MaxYear"]);

function submit(form: HTMLFormElement, router: ReturnType<typeof useNavRouter>) {
    const fd = new FormData(form);
    const searchParams = new URLSearchParams();

    for (const key of fd.keys()) {
        if (DATE_HELPERS.has(key)) continue;
        const values = fd.getAll(key).filter(v => String(v).length > 0);
        for (const v of values) searchParams.append(key, v as string);
    }

    // Combine day+month+year helpers into MinDate / MaxDate
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

    const minYearRef  = useRef<HTMLInputElement>(null);
    const minMonthRef = useRef<HTMLSelectElement>(null);
    const minDayRef   = useRef<HTMLInputElement>(null);
    const maxYearRef  = useRef<HTMLInputElement>(null);
    const maxMonthRef = useRef<HTMLSelectElement>(null);
    const maxDayRef   = useRef<HTMLInputElement>(null);

    const search = useSearchParams();
    const term    = search.get("term");
    const group   = search.get("group");
    const q       = search.get("q");
    const minDate = search.get("MinDate") || "";
    const maxDate = search.get("MaxDate") || "";
    const keys = useKeysFromContext();

    const [minPrecision, setMinPrecision] = useState<DatePrecision>(() => minDate ? detectPrecision(minDate) : "dia");
    const [maxPrecision, setMaxPrecision] = useState<DatePrecision>(() => maxDate ? detectPrecision(maxDate) : "dia");

    // Sync precision if URL changes (e.g. navigating to a bookmarked URL)
    useEffect(() => { if (minDate) setMinPrecision(detectPrecision(minDate)); }, [minDate]);
    useEffect(() => { if (maxDate) setMaxPrecision(detectPrecision(maxDate)); }, [maxDate]);

    const resetDatas = useCallback(() => {
        if (minDayRef.current)   minDayRef.current.value   = "";
        if (minMonthRef.current) minMonthRef.current.value = "";
        if (minYearRef.current)  minYearRef.current.value  = "";
        if (maxDayRef.current)   maxDayRef.current.value   = "";
        if (maxMonthRef.current) maxMonthRef.current.value = "";
        if (maxYearRef.current)  maxYearRef.current.value  = "";
        setMinPrecision("dia");
        setMaxPrecision("dia");
    }, []);

    useEffect(() => {
        const el = form.current;
        if (!el) return;

        const handleChange = () => {
            const minDay   = minDayRef.current?.value   || "";
            const minMonth = minMonthRef.current?.value || "";
            const minYear  = minYearRef.current?.value  || "";
            const maxDay   = maxDayRef.current?.value   || "";
            const maxMonth = maxMonthRef.current?.value || "";
            const maxYear  = maxYearRef.current?.value  || "";

            submit(el, router);

            el.reset();
            if (minDay   && minDayRef.current)   minDayRef.current.value   = minDay;
            if (minMonth && minMonthRef.current) minMonthRef.current.value = minMonth;
            if (minYear  && minYearRef.current)  minYearRef.current.value  = minYear;
            if (maxDay   && maxDayRef.current)   maxDayRef.current.value   = maxDay;
            if (maxMonth && maxMonthRef.current) maxMonthRef.current.value = maxMonth;
            if (maxYear  && maxYearRef.current)  maxYearRef.current.value  = maxYear;
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
                    isMin={true}
                    precision={minPrecision}
                    onPrecision={setMinPrecision}
                    defaultValue={minDate}
                    yearRef={minYearRef}
                    monthRef={minMonthRef}
                    dayRef={minDayRef}
                />
                <DateRangeInput
                    label="Até:"
                    name="MaxDate"
                    isMin={false}
                    precision={maxPrecision}
                    onPrecision={setMaxPrecision}
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
                        Tem de ter {keys?.records?.Texto?.name}
                    </label>
                </div>

                <SwapableFilterList filtersUsed={filtersUsed} />
            </div>
        </form>
    );
}

function DateRangeInput({ label, name, isMin, precision, onPrecision, defaultValue, yearRef, monthRef, dayRef }: {
    label: string;
    name: string;
    isMin: boolean;
    precision: DatePrecision;
    onPrecision: (p: DatePrecision) => void;
    defaultValue: string;
    yearRef: React.RefObject<HTMLInputElement>;
    monthRef: React.RefObject<HTMLSelectElement>;
    dayRef: React.RefObject<HTMLInputElement>;
}) {
    const yearDefault  = defaultValue.slice(0, 4);
    const monthDefault = defaultValue.length >= 7 ? String(parseInt(defaultValue.slice(5, 7))) : "";
    const dayDefault   = defaultValue.length === 10 ? String(parseInt(defaultValue.slice(8, 10))) : "";

    const prevEmpty = useRef(!yearDefault);

    const prefix = name === "MinDate" ? "Min" : "Max";

    // Which fields are user-editable vs auto-filled
    const dayActive   = precision === "dia";
    const monthActive = precision === "dia" || precision === "mes";

    // Auto-fill display values for disabled fields
    const autoDay   = isMin ? "1" : "31";
    const autoMonth = isMin ? "1" : "12"; // Jan or Dez

    const inputCls    = "form-control form-control-sm rounded-0";
    const disabledStyle = { color: "var(--bs-secondary-color, #6c757d)", backgroundColor: "var(--bs-tertiary-bg, #f8f9fa)" };

    return (
        <div className="my-1">
            <div className="d-flex gap-1 mb-1">
                <small className="input-group-text rounded-0 px-1" style={{ minWidth: 50 }}>{label}</small>
                {(["dia", "mes", "ano"] as DatePrecision[]).map(p => (
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

            <div className="input-group input-group-sm">
                {/* Day */}
                <input
                    key={`day-${precision}`}
                    type="number"
                    name={dayActive ? `_${prefix}Day` : undefined}
                    ref={dayActive ? dayRef : undefined}
                    min="1"
                    max="31"
                    placeholder="DD"
                    defaultValue={dayActive ? dayDefault : autoDay}
                    disabled={!dayActive}
                    className={inputCls}
                    style={!dayActive ? disabledStyle : undefined}
                />

                {/* Month */}
                <select
                    key={`month-${precision}`}
                    name={monthActive ? `_${prefix}Month` : undefined}
                    ref={monthActive ? monthRef : undefined}
                    disabled={!monthActive}
                    defaultValue={monthActive ? monthDefault : autoMonth}
                    className="form-select form-select-sm rounded-0"
                    style={
                        !monthActive ? disabledStyle :
                        !monthDefault ? { color: "var(--bs-secondary-color, #6c757d)" } :
                        undefined
                    }
                    onChange={(e) => {
                        if (monthActive) e.currentTarget.style.color = e.currentTarget.value ? "" : "var(--bs-secondary-color, #6c757d)";
                    }}
                >
                    <option value="">Mês</option>
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>

                {/* Year */}
                <input
                    key={`year-${precision}`}
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
            </div>
        </div>
    );
}
