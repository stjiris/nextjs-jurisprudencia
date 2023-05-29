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
            return {redirect: {destination: redirect, statusCode: 303}}
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
        <form method="POST" className="container-sm">
            { props.response !== undefined && <div className="alert alert-warning">Utilizador ou palavra passe errados</div> }
            <div className="form-group row">
                <label htmlFor="UserInput" className="col-sm-2 col-form-label">Utilizador:</label>
                <div className="col-sm-10">
                    <input name="user" type="text" className="form-control" id="UserInput" placeholder="Utilizador"/>
                </div>
            </div>
            <div className="form-group row">
                <label htmlFor="PassInput" className="col-sm-2 col-form-label">Palavra-passe:</label>
                <div className="col-sm-10">
                    <input name="pass" type="password" className="form-control" id="PassInput" placeholder="Palavra-passe"/>
                </div>
            </div>
            <div className="form-group row">
                <div className="col-sm-12 d-flex justify-content-end">
                    <button type="submit" className="btn btn-primary">Entrar</button>
                </div>
            </div>
        </form>
    </GenericPage>
}