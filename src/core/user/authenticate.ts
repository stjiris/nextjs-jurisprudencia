import { GetServerSideProps, GetServerSidePropsContext, NextApiHandler, NextApiRequest, PreviewData } from "next";
import { ParsedUrlQuery } from "querystring";
import { validateSession } from "./session";
import { getClient, User, USERS_INDEX, compare, hashPassword, readUser } from "./usercrud";


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

export async function authenticatedHandler<T>(req: NextApiRequest){
    let user = req.cookies["user"];
    let session = req.cookies["session"];
    return !!user && !!session && await validateSession(user, session);
}