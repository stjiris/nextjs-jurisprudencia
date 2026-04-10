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

export default function SearchForm({ count, filtersUsed }: { count: number; filtersUsed: Record<string, string[]> }) {
    const form = useRef<HTMLFormElement>(null);
    const router = useNavRouter();

    const dataInicio = useRef<HTMLInputElement>(null);
    const dataFim = useRef<HTMLInputElement>(null);

    const maxTouched = useRef(false);

    const resetDatas = useCallback(() => {
        if (dataInicio.current) dataInicio.current.value = "";
        if (dataFim.current) dataFim.current.value = "";
        maxTouched.current = false;
    }, []);

    function validateDates() {
        const start = dataInicio.current?.value || "";
        const end = dataFim.current?.value || "";

        if (dataFim.current) dataFim.current.setCustomValidity("");

        if (start && end && start > end) {
            dataFim.current?.setCustomValidity(
                "Data final deve ser igual ou posterior à data inicial"
            );
            return false;
        }
        return true;
    }

    useEffect(() => {
        const el = form.current;
        if (!el) return;

        const handleChange = () => {
            if (!validateDates()) return el.reportValidity();

            let removedName: string | null = null;
            if (!maxTouched.current && dataFim.current) {
                removedName = dataFim.current.name;
                dataFim.current.removeAttribute("name");
            }

            submit(el, router);

            if (removedName && dataFim.current) {
                dataFim.current.name = removedName;
            }

            const a = dataInicio.current?.value;
            const b = dataFim.current?.value;
            el.reset();
            if (a && dataInicio.current) dataInicio.current.value = a;
            if (b && dataFim.current) dataFim.current.value = b;
        };

        el.addEventListener("change", handleChange);
        return () => el.removeEventListener("change", handleChange);
    }, [router]);

    const search = useSearchParams();
    const term = search.get("term");
    const group = search.get("group");
    const q = search.get("q");
    const minDate = search.get("MinDate");
    const maxDate = search.get("MaxDate");
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
                        type="date"
                        name="MinDate"
                        ref={dataInicio}
                        defaultValue={minDate || ""}
                        max={maxDate || undefined}
                        className="form-control"
                        onChange={() => {
                            validateDates();
                            if (!maxTouched.current && dataFim.current) {
                                dataFim.current.value = dataInicio.current?.value || "";
                            }
                        }}
                    />
                </div>

                <div className="input-group input-group-sm my-1">
                    <label className="input-group-text rounded-0" style={{ minWidth: 50 }}>Até:</label>
                    <input
                        type="date"
                        name="MaxDate"
                        ref={dataFim}
                        defaultValue={maxDate || ""}
                        min={minDate || undefined}
                        className="form-control"
                        onChange={() => {
                            maxTouched.current = true;
                            validateDates();
                        }}
                    />
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
