import { useFetch } from "@/components/useFetch";
import { createContext, useContext, useMemo } from "react";

export type AuthedUser = {
    name: string
}

export const AuthContext = createContext<AuthedUser | null>(null);

export function AuthProvider(props: {children: React.ReactNode}){
    const user = useFetch<AuthedUser | null>("/api/user", []) || null;
    return <AuthContext.Provider value={user}>
        {props.children}
    </AuthContext.Provider>
}

export function useAuth(){
    return useContext(AuthContext)
}
