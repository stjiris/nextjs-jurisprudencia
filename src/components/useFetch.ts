import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

// A null url skips the request, for callers whose options come from elsewhere.
export function useFetch<T>(relativeUrl: string | null, otherDeps: any[]) {
    const router = useRouter();
    let [resp, setResp] = useState<T>()

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (relativeUrl === null) return;

        const abort = new AbortController();

        fetch(router.basePath + relativeUrl, { signal: abort.signal })
            .then(r => {
                if (!r.ok) {
                    throw new Error(`Request failed ${r.status} ${r.statusText}`);
                }
                return r.json();
            })
            .then(setResp)
            .catch(e => {
                if (e && e.name === "AbortError") {
                    return;
                }
                console.error(e);
            });

        return () => abort.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [relativeUrl, router.basePath, ...otherDeps]);

    return resp;
}

export function useFetchPost<TReq = any, TRes = any>(relativeUrl: string) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<any | null>(null);
    const [response, setResponse] = useState<TRes | undefined>(undefined);

    const post = useCallback(
        async (body?: TReq, init?: RequestInit): Promise<TRes> => {
            setLoading(true);
            setError(null);
            try {

                const res = await fetch(router.basePath + relativeUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
                    body: body ? JSON.stringify(body) : init?.body,
                    signal: init?.signal,
                });

                if (!res.ok) {
                    let errMsg = "";
                    try {
                        const errJson = await res.json();
                        errMsg = errJson.message || errJson.error || "";
                    } catch {
                        // Response body not JSON
                    }

                    if (!errMsg) {
                        if (res.status === 404) errMsg = "Página ou documento não encontrado (404)";
                        else if (res.status === 401) errMsg = "Sessão expirada ou não autenticado (401)";
                        else if (res.status === 403) errMsg = "Acesso negado: sem permissões necessárias (403)";
                        else if (res.status === 409) errMsg = "Conflito com o estado atual do documento (409)";
                        else if (res.status === 502 || res.status === 503) errMsg = "Serviço externo temporariamente indisponível (502/503)";
                        else errMsg = `Erro ${res.status}: ${res.statusText || "Falha na operação"}`;
                    }

                    const customError: any = new Error(errMsg);
                    customError.status = res.status;
                    throw customError;
                }
                const data = await res.json();
                setResponse(data);
                return data;
            } catch (err) {
                setError(err);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [router.basePath, relativeUrl]
    );

    return { post, loading, error, response };
}
