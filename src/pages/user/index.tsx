import GenericPage from "@/components/genericPageStructure"
import { withAuthentication } from "@/core/user/authenticate"
import { readUser, User } from "@/core/user/usercrud";
import { SearchHit } from "@elastic/elasticsearch/lib/api/types";
import Link from "next/link";

interface UserIndexProps {
    user: SearchHit<User>;
}

export const getServerSideProps = withAuthentication<UserIndexProps>(async (ctx) => {
    let user = ctx.req.cookies["user"]!;
    
    
    return {props: {user: (await readUser(user))!} }
})

export default function UserIndex({user}: UserIndexProps){
    return <GenericPage>
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-6 col-xl-4">
                <div className="card shadow">
                    <div className="card-body">
                        <h4 className="card-title">Bem vindo, {user._source?.username}!</h4>
                        <div className="d-flex justify-content-between w-75 mx-auto">
                            <Link href="/admin" className="btn btn-primary m-1">Gestão</Link>
                            <Link href="/user/update" className="btn btn-primary m-1">Mudar palavra-passe</Link>
                            <Link href="/user/logout" className="btn btn-warning m-1">Logout</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </GenericPage>
}