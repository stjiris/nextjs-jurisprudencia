import { DashboardGenericPage } from "@/components/genericPageStructure";
import { LoggerServerSideProps } from "@/core/logger-api";
import { withAuthentication } from "@/core/user/authenticate";
import { listUsers, User } from "@/core/user/usercrud";
import { GetServerSideProps } from "next";

interface UsersPageProps {
    users: (User & { id: string })[]
}

export const getServerSideProps: GetServerSideProps<UsersPageProps> = withAuthentication(async (ctx) => {
    LoggerServerSideProps(ctx);
    let r = await listUsers();
    return {props: {users: r.hits.hits.map(({_id, _source: u}) => ({id: _id, username: u?.username || "", salt: u?.salt || "", hash: u?.hash || ""}))}}
})

export default function UsersPage({users}: UsersPageProps){

    return <DashboardGenericPage title="Jurisprudência STJ - Usuários">
        <table>
            <thead>
                <tr>
                    <th>Id</th>
                    <th>User</th>
                    <th>Salt</th>
                    <th>Hash</th>
                </tr>
            </thead>
            <tbody>
                {users.map( (u,i) => <tr key={i} ><td>{u.id}</td><td>{u.username}</td><td>{u.salt}</td><td>{u.hash}</td></tr>)}
            </tbody>
        </table>
    </DashboardGenericPage>
}