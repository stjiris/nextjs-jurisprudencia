import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

export function useFetch<T>(relativeUrl: string, otherDeps: any[]) {
    const router = useRouter();
    let [resp, setResp] = useState<T>()

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
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

                if (!res.ok)
                    throw new Error(`Request failed ${res.status}`);
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
