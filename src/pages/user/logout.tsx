import GenericPage from "@/components/genericPageStructure";
import { LoggerServerSideProps } from "@/core/logger-api";
import { authenticate, AuthenticateResponse } from "@/core/user/authenticate";
import { createSession, deleteSession, validateSession } from "@/core/user/session";
import { GetServerSideProps } from "next";
import Link from "next/link";


export const getServerSideProps : GetServerSideProps<{}> = async (ctx) => {
    LoggerServerSideProps(ctx);
    let user = ctx.req.cookies["user"]
    let session = ctx.req.cookies["session"]

    if( user && session && await validateSession(user, session) ){
        deleteSession(user, session);
    }
    ctx.res.setHeader("Set-cookie", [`user=; HttpOnly; Secure; Path=/; Expires=Thu, Jan 01 1970 00:00:00 UTC`,`session=; HttpOnly; Secure; Path=/; Expires=Thu, Jan 01 1970 00:00:00 UTC`])
    return {redirect: {destination: "/", permanent: false}}
}


export default function Login(props: {}){
    return <>Deverá ser redirecionado, caso não aconteça clique <Link href="/">aqui</Link></>
}