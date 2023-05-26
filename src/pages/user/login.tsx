import GenericPage from "@/components/genericPageStructure";
import { authenticate, AuthenticateResponse } from "@/core/user/authenticate";
import { createSession, validateSession } from "@/core/user/session";
import { GetServerSideProps } from "next";

interface LoginProps {
    response?: AuthenticateResponse
}

export const getServerSideProps : GetServerSideProps<LoginProps> = async (ctx) => {
    let redirect = Array.isArray(ctx.query.redirect) ? ctx.query.redirect[0] : ctx.query.redirect || `/dashboard`
    if( ctx.req.method === "POST" ){
        let requestPostDataParams = await new Promise<URLSearchParams>((resolve) => {
            let _data = ""
            ctx.req.on('data', (d) => _data+=d.toString());
            ctx.req.on("end", () => resolve(new URLSearchParams(_data)))
        });

        let user = requestPostDataParams.get("user");
        let pass = requestPostDataParams.get("pass");
        let r = user && pass && await authenticate(user, pass);
        if( r === AuthenticateResponse.AUTHORIZED){
            let session = await createSession(user!);
            ctx.res.setHeader("Set-cookie", [`user=${user}; HttpOnly; Secure; Path=/`,`session=${session}; HttpOnly; Secure; Path=/`])
            return {redirect: {destination: redirect, permanent: false}}
        }
        else{
            return {props: {response: r || AuthenticateResponse.INVALID_USER}}
        }
    }
    else{
        let user = ctx.req.cookies["user"]
        let session = ctx.req.cookies["session"]

        if( user && session && await validateSession(user, session) ){
            return {redirect: {destination: redirect, permanent: false}}
        }
    }

    return {props: {}}
}


export default function Login(props: LoginProps){
    return <GenericPage>
        { props.response && <div className="alert alert-waring">Utilizador ou palavra passe errados</div> }
        <form method="POST">
            <input name="user" type="text" />
            <input name="pass" type="password" />
            <input type="submit" />
        </form>
    </GenericPage>
}