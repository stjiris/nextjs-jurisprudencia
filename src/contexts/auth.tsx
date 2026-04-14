import { useFetch } from "@/components/useFetch";
import { Feature, Role, roleCanAccess } from "@/core/user/roles";
import { createContext, useContext } from "react";

export type AuthedUser = {
    name: string;
    role: Role;
}

export const AuthContext = createContext<AuthedUser | null>(null);

export function AuthProvider(props: {children: React.ReactNode}){
    const user = useFetch<AuthedUser | null>("/api/user", []) || null;
    return <AuthContext.Provider value={user}>
        {props.children}
    </AuthContext.Provider>
}

export function useAuth(){
    return useContext(AuthContext);
}

/** Returns true if the logged-in user has access to the given feature. */
export function useCanAccess(feature: Feature): boolean {
    const user = useContext(AuthContext);
    if (!user) return false;
    return roleCanAccess(user.role, feature);
}
