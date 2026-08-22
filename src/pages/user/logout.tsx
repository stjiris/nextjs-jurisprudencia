import { LoggerServerSideProps } from "@/core/logger-api";
import { deleteSession, validateSession } from "@/core/user/session";
import { logAuditEvent } from "@/core/audit-log";
import { GetServerSideProps } from "next";
import Link from "next/link";


export const getServerSideProps : GetServerSideProps<{}> = LoggerServerSideProps(async (ctx) => {
    let user = ctx.req.cookies["user"]
    let session = ctx.req.cookies["session"]

    if( user && session && await validateSession(user, session) ){
        deleteSession(user, session);
        const ip = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || ctx.req.socket?.remoteAddress || "unknown";
        logAuditEvent("logout", user, { ip });
    }
    ctx.res.setHeader("Set-cookie", [`user=; HttpOnly; Path=/; Expires=Thu, Jan 01 1970 00:00:00 UTC`,`session=; HttpOnly; Path=/; Expires=Thu, Jan 01 1970 00:00:00 UTC`])
    return {redirect: {destination: "/", permanent: false}}
})


export default function Login(props: {}){
    return <>Deverá ser redirecionado, caso não aconteça clique <Link href="/">aqui</Link></>
}