import { useKeys } from "@/components/formKeys";
import { JurisprudenciaKey } from "@/types/keys";
import { JurisprudenciaDocumentKey } from "@stjiris/jurisprudencia-document";
import { createContext, useContext, useMemo } from "react";

export const DEFAULT_KEYS: KeysContextType = { // Before fecthing it is empty
    keys: [],
    records: {}
}

export const KeysContext = createContext<KeysContextType>(DEFAULT_KEYS);

export function KeysProvider(props: {children: React.ReactNode}){
    let fetched = useKeys();
    let keys = useMemo(() => fetched ? fetched.reduce((acc, c) => {acc[c.key] = c; return acc},{} as Record<JurisprudenciaDocumentKey, JurisprudenciaKey>) : {} as Record<JurisprudenciaDocumentKey, JurisprudenciaKey>, [fetched]);
    return <KeysContext.Provider value={{keys: fetched || [], records: keys}}>
        {props.children}
    </KeysContext.Provider>
}

export function useKeysFromContext(){
    return useContext(KeysContext)
}

export type KeysContextType = {
    keys: JurisprudenciaKey[],
    records: Record<JurisprudenciaDocumentKey, JurisprudenciaKey>
}