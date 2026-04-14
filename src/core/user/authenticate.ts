import { GetServerSideProps, GetServerSidePropsContext, NextApiHandler, NextApiRequest, PreviewData } from "next";
import { ParsedUrlQuery } from "querystring";
import { validateSession } from "./session";
import { getClient, User, USERS_INDEX, compare, hashPassword, readUser } from "./usercrud";
import { Feature, Role, roleCanAccess } from "./roles";
import { IncomingMessage } from "http";
import { NextApiRequestCookies } from "next/dist/server/api-utils";


export enum AuthenticateResponse {
    INVALID_USER,
    WRONG_PASSWORD,
    AUTHORIZED
}

export async function authenticate(user: string, password: string) {
    let client = await getClient();
    let r = await client.search<User>({ index: USERS_INDEX, query: { term: { username: user } } });
    if (r.hits.hits.length == 0) {
        return AuthenticateResponse.INVALID_USER;
    }
    else {
        let user = r.hits.hits[0];
        if(compare(hashPassword(user._source?.salt || "", password), user._source?.hash || "")) {
            return AuthenticateResponse.AUTHORIZED;
        }
        else {
            return AuthenticateResponse.WRONG_PASSWORD;
        }
    }
}


export function withAuthentication<
        Props extends { [key: string]: any } = { [key: string]: any },
        Params extends ParsedUrlQuery = ParsedUrlQuery,
        Preview extends PreviewData = PreviewData>(sub: GetServerSideProps<Props, Params, Preview>): (GetServerSideProps<Props, Params, Preview>) {
    return async (ctx) => {
        let user = ctx.req.cookies["user"];
        let session = ctx.req.cookies["session"];

        if( user && session && await validateSession(user, session) ){
            return await sub(ctx)
        }
        else{
            return {redirect: {permanent: false, destination: `/user/login?redirect=${encodeURIComponent(ctx.resolvedUrl)}`}}
        }

    }
}

export async function authenticatedHandler(req: GetServerSidePropsContext["req"]){
    let user = req.cookies["user"];
    let session = req.cookies["session"];
    return !!user && !!session && await validateSession(user, session);
}

/**
 * Returns the authenticated user's role, or null if not logged in.
 * Falls back to 'admin' for users created before roles were introduced.
 */
export async function getUserRole(req: GetServerSidePropsContext["req"]): Promise<Role | null> {
    const username = req.cookies["user"];
    const session = req.cookies["session"];
    if (!username || !session || !(await validateSession(username, session))) return null;
    const user = await readUser(username);
    return (user?._source?.role as Role | undefined) ?? 'admin';
}

/**
 * getServerSideProps wrapper that requires a minimum role for a feature.
 * Redirects to login if not authenticated, to /admin if authenticated but insufficient role.
 */
export function withRole<
        Props extends { [key: string]: any } = { [key: string]: any },
        Params extends ParsedUrlQuery = ParsedUrlQuery,
        Preview extends PreviewData = PreviewData>(
    feature: Feature,
    sub: GetServerSideProps<Props, Params, Preview>
): GetServerSideProps<Props, Params, Preview> {
    return async (ctx) => {
        const role = await getUserRole(ctx.req);
        if (!role) {
            return { redirect: { permanent: false, destination: `/user/login?redirect=${encodeURIComponent(ctx.resolvedUrl)}` } };
        }
        if (!roleCanAccess(role, feature)) {
            return { redirect: { permanent: false, destination: '/admin' } };
        }
        return await sub(ctx);
    };
}

/**
 * API route helper that checks auth + minimum role for a feature.
 * Returns true if the request is allowed.
 */
export async function authenticatedHandlerWithRole(req: GetServerSidePropsContext["req"], feature: Feature): Promise<boolean> {
    const role = await getUserRole(req);
    return !!role && roleCanAccess(role, feature);
}