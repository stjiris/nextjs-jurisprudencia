import GenericPage from "@/components/genericPageStructure";
import { authenticate, AuthenticateResponse, withAuthentication } from "@/core/user/authenticate";
import { createSession, deleteSession, deleteUserSession, updateSession, validateSession } from "@/core/user/session";
import { deleteUser, readUser, updateUser, User } from "@/core/user/usercrud";
import { SearchHit } from "@elastic/elasticsearch/lib/api/types";
import { GetServerSideProps } from "next";
import Link from "next/link";


export const getServerSideProps = withAuthentication<UpdateProps>(async (ctx) => {
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
}, "/user/update")

type UpdateProps = {
    success?: boolean
    user: SearchHit<User>
}

export default function Update({user, success}: UpdateProps){
    return <GenericPage>
        <form method="post" className="container">
            {typeof success === "boolean" && (success ? <div className="alert alert-success">Alterações registadas</div> : <div className="alert alert-danger">Ocorreu um erro</div>)}
            <div className="form-group row">
                <label htmlFor="IDInput" className="col-sm-2 col-form-label">ID</label>
                <div className="col-sm-10">
                    <input type="text" className="form-control" id="IDInput" readOnly value={user._id} placeholder="ID"/>
                </div>
            </div>
            <div className="form-group row">
                <label htmlFor="IDInput" className="col-sm-2 col-form-label">Utilizador</label>
                <div className="col-sm-10">
                    <input name="user" type="text" className="form-control" id="IDInput" readOnly value={user._source?.username} placeholder="Utilizador"/>
                </div>
            </div>
            <div className="form-group row">
                <label htmlFor="currentPassInput" className="col-sm-2 col-form-label">Palavra-passe atual</label>
                <div className="col-sm-10">
                    <input name="oldpass" type="password" className="form-control" id="currentPassInput" placeholder="Palavra-passe atual" />
                </div>
            </div>
            <div className="form-group row">
                <label htmlFor="newPassInput" className="col-sm-2 col-form-label">Nova palavra-passe</label>
                <div className="col-sm-10">
                    <input name="newpass" type="password" className="form-control" id="newPassInput" placeholder="Nova palavra-passe" />
                </div>
            </div>
            <div className="form-group row">
                <div className="col-sm-10">
                    <button type="submit" className="btn btn-primary">Atualizar</button>
                </div>
                <div className="col-sm-2">
                    <Link className="btn btn-warning" href="/user/logout">Sair</Link>
                </div>
            </div>
        </form>
    </GenericPage>
}