import GenericPage from "@/components/genericPageStructure";
import { LoggerServerSideProps } from "@/core/logger-api";
import { authenticate, AuthenticateResponse, withAuthentication } from "@/core/user/authenticate";
import { deleteUserSession } from "@/core/user/session";
import { readUser, updateUser, User } from "@/core/user/usercrud";
import { SearchHit } from "@elastic/elasticsearch/lib/api/types";
import Link from "next/link";


export const getServerSideProps = withAuthentication<UpdateProps>(async (ctx) => {
    LoggerServerSideProps(ctx);
    if( ctx.req.method === "POST" ){
        let requestPostDataParams = await new Promise<URLSearchParams>((resolve) => {
            let _data = ""
            ctx.req.on('data', (d) => _data+=d.toString());
            ctx.req.on("end", () => resolve(new URLSearchParams(_data)))
        });

        let user = requestPostDataParams.get("user");
        let oldpass = requestPostDataParams.get("oldpass");
        let newpass = requestPostDataParams.get("newpass");
        let r = user && oldpass && await authenticate(user, oldpass);
        let success = false;
        if( user && newpass && r === AuthenticateResponse.AUTHORIZED){
            success = await updateUser(user, newpass)
            await deleteUserSession(user)
        }
        return {props: {success: success, user: (await readUser(ctx.req.cookies["user"]!))!}}
    }
    return {props: {user: (await readUser(ctx.req.cookies["user"]!))!}}
})

type UpdateProps = {
    success?: boolean
    user: SearchHit<User>
}

export default function Update({user, success}: UpdateProps){
    return <GenericPage title="Jurisprudência STJ - Alterar palavra-passe">
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-6 col-xl-4">
                <div className="card shadow">
                    <div className="card-body">
                        <h4 className="card-title">Alterar palavra-passe</h4>
                        {typeof success === "boolean" && (success ? <div className=" w-75 mx-auto alert alert-success">Alterações registadas</div> : <div className=" w-75 mx-auto alert alert-danger">Ocorreu um erro</div>)}
                        <form method="POST">
                            <div className="w-75 mx-auto my-2">
                                <input name="user" type="text" className="form-control" placeholder="Utilizador" readOnly value={user._source?.username}/>
                            </div>
                            <div className="w-75 mx-auto my-2">
                                <input name="oldpass" type="password" className="form-control" placeholder="Palavra passe atual"/>
                            </div>
                            <div className="w-75 mx-auto my-2">
                                <input name="newpass" type="password" className="form-control" placeholder="Nova palavra passe"/>
                            </div>
                            <div className="w-75 mx-auto my-2 d-flex justify-content-between">
                                <button className="btn btn-primary" type="submit">Alterar</button>
                                <Link href="/user" className="btn btn-warning">Cancelar</Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </GenericPage>
}