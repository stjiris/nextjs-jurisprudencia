import GenericPage from "@/components/genericPageStructure";
import { LoggerServerSideProps } from "@/core/logger-api";
import { authenticate, AuthenticateResponse } from "@/core/user/authenticate";
import { createSession, validateSession } from "@/core/user/session";
import { GetServerSideProps } from "next";

interface LoginProps {
    response?: AuthenticateResponse
}

export const getServerSideProps : GetServerSideProps<LoginProps> = async (ctx) => {
    LoggerServerSideProps(ctx);
    let redirect = Array.isArray(ctx.query.redirect) ? ctx.query.redirect[0] : ctx.query.redirect || `/admin`
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
    return <GenericPage keys_to_remove={["redirect"]} title="Jurisprudência STJ - Autenticação">
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-6 col-xl-4">
                <div className="card shadow">
                    <div className="card-body">
                        <h4 className="card-title">Autenticação</h4>
                        { props.response !== undefined && <div className="alert alert-warning w-75 mx-auto">Utilizador ou palavra passe errados</div> }
                        <form method="POST">
                            <div className="w-75 mx-auto my-2">
                                <input name="user" type="text" className="form-control" placeholder="Utilizador"/>
                            </div>
                            <div className="w-75 mx-auto my-2">
                                <input name="pass" type="password" className="form-control" placeholder="Palavra passe"/>
                            </div>
                            <div className="w-75 mx-auto my-2">
                                <button className="btn btn-primary" type="submit">Entrar</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </GenericPage>
}