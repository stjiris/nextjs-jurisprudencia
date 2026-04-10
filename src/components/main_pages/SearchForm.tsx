'use client';

import Link from "next/link";
import { useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKeysFromContext } from "@/contexts/keys";
import { FORM_KEY, SwapableFilterList, UsedFilters } from "./SwapableFilterList";

function submit(form: HTMLFormElement, router: ReturnType<typeof useNavRouter>) {
    const fd = new FormData(form);
    const searchParams = new URLSearchParams();

    for (const key of fd.keys()) {
        const values = fd.getAll(key).filter(v => String(v).length > 0);
        for (const v of values) searchParams.append(key, v as string);
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

type DatePrecision = "ano" | "mes" | "dia";

function detectPrecision(date: string): DatePrecision {
    if (/^\d{4}$/.test(date))       return "ano";
    if (/^\d{4}-\d{2}$/.test(date)) return "mes";
    return "dia";
}

export default function SearchForm({ count, filtersUsed }: { count: number; filtersUsed: Record<string, string[]> }) {
    const form = useRef<HTMLFormElement>(null);
    const router = useNavRouter();
    const minDateRef = useRef<HTMLInputElement>(null);
    const maxDateRef = useRef<HTMLInputElement>(null);

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
        if (minDateRef.current) minDateRef.current.value = "";
        if (maxDateRef.current) maxDateRef.current.value = "";
        setMinPrecision("dia");
        setMaxPrecision("dia");
    }, []);

    useEffect(() => {
        const el = form.current;
        if (!el) return;

        const handleChange = () => {
            const minVal = minDateRef.current?.value || "";
            const maxVal = maxDateRef.current?.value || "";

            submit(el, router);

            el.reset();
            if (minVal && minDateRef.current) minDateRef.current.value = minVal;
            if (maxVal && maxDateRef.current) maxDateRef.current.value = maxVal;
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
                />
                <DateRangeInput
                    label="Até:"
                    name="MaxDate"
                    precision={maxPrecision}
                    onPrecision={setMaxPrecision}
                    defaultValue={maxDate}
                    inputRef={maxDateRef}
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

function DateRangeInput({ label, name, precision, onPrecision, defaultValue, inputRef }: {
    label: string;
    name: string;
    precision: DatePrecision;
    onPrecision: (p: DatePrecision) => void;
    defaultValue: string;
    inputRef: React.RefObject<HTMLInputElement>;
}) {
    // Derive the right defaultValue for each input type from whatever format is in the URL
    const yearDefault  = defaultValue.slice(0, 4);
    const monthDefault = defaultValue.length >= 7 ? defaultValue.slice(0, 7) : "";
    const dayDefault   = defaultValue.length === 10 ? defaultValue : "";

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
                    placeholder="Ano (ex: 2025)"
                    min="1900"
                    max="2100"
                    defaultValue={yearDefault}
                    className="form-control form-control-sm rounded-0"
                />
            )}
            {precision === "mes" && (
                <input
                    key="mes"
                    type="month"
                    name={name}
                    ref={inputRef}
                    defaultValue={monthDefault}
                    className="form-control form-control-sm rounded-0"
                />
            )}
            {precision === "dia" && (
                <input
                    key="dia"
                    type="date"
                    name={name}
                    ref={inputRef}
                    defaultValue={dayDefault}
                    className="form-control form-control-sm rounded-0"
                />
            )}
        </div>
    );
}
