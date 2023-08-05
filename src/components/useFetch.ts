import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export function useFetch<T>(relativeUrl: string, otherDeps: any[]){
    const router = useRouter();
    let [resp, setResp] = useState<T>()
    
    useEffect(() => {
        let abort = new AbortController();
        fetch(router.basePath+relativeUrl, {signal: abort.signal})
            .then(r => r.json() )
            .then(setResp)
            .catch(e => console.error(e))
        return () => abort.abort()
    },[relativeUrl, router.basePath, ...otherDeps])

    return resp;
}
