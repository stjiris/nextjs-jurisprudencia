'use client';

import Link from "next/link";
import { useRouter as useNavRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
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

    const minYearRef  = useRef<HTMLInputElement>(null);
    const minMonthRef = useRef<HTMLSelectElement>(null);
    const maxYearRef  = useRef<HTMLInputElement>(null);
    const maxMonthRef = useRef<HTMLSelectElement>(null);

    const resetDatas = useCallback(() => {
        if (minYearRef.current)  minYearRef.current.value  = "";
        if (minMonthRef.current) minMonthRef.current.value = "";
        if (maxYearRef.current)  maxYearRef.current.value  = "";
        if (maxMonthRef.current) maxMonthRef.current.value = "";
    }, []);

    useEffect(() => {
        const el = form.current;
        if (!el) return;

        const handleChange = () => {
            // Save date values before reset (reset clears uncontrolled inputs)
            const minYear  = minYearRef.current?.value  || "";
            const minMonth = minMonthRef.current?.value || "";
            const maxYear  = maxYearRef.current?.value  || "";
            const maxMonth = maxMonthRef.current?.value || "";

            submit(el, router);

            el.reset();
            if (minYear  && minYearRef.current)  minYearRef.current.value  = minYear;
            if (minMonth && minMonthRef.current) minMonthRef.current.value = minMonth;
            if (maxYear  && maxYearRef.current)  maxYearRef.current.value  = maxYear;
            if (maxMonth && maxMonthRef.current) maxMonthRef.current.value = maxMonth;
        };

        el.addEventListener("change", handleChange);
        return () => el.removeEventListener("change", handleChange);
    }, [router]);

    const search = useSearchParams();
    const term     = search.get("term");
    const group    = search.get("group");
    const q        = search.get("q");
    const minYear  = search.get("MinYear")  || "";
    const minMonth = search.get("MinMonth") || "";
    const maxYear  = search.get("MaxYear")  || "";
    const maxMonth = search.get("MaxMonth") || "";
    const keys = useKeysFromContext();

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

                <div className="input-group input-group-sm my-1">
                    <label className="input-group-text rounded-0" style={{ minWidth: 50 }}>De:</label>
                    <input
                        type="number"
                        name="MinYear"
                        ref={minYearRef}
                        placeholder="Ano"
                        min="1900"
                        max="2100"
                        defaultValue={minYear}
                        className="form-control"
                        style={{ minWidth: 0 }}
                    />
                    <select name="MinMonth" ref={minMonthRef} defaultValue={minMonth} className="form-select form-select-sm rounded-0">
                        <option value="">--</option>
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>

                <div className="input-group input-group-sm my-1">
                    <label className="input-group-text rounded-0" style={{ minWidth: 50 }}>Até:</label>
                    <input
                        type="number"
                        name="MaxYear"
                        ref={maxYearRef}
                        placeholder="Ano"
                        min="1900"
                        max="2100"
                        defaultValue={maxYear}
                        className="form-control"
                        style={{ minWidth: 0 }}
                    />
                    <select name="MaxMonth" ref={maxMonthRef} defaultValue={maxMonth} className="form-select form-select-sm rounded-0">
                        <option value="">--</option>
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>

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
