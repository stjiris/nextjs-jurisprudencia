import { DashboardGenericPage } from "@/components/genericPageStructure";
import { withAuthentication } from "@/core/user/authenticate";

export const getServerSideProps = withAuthentication<{term: string}>(async ctx => ({props: {term: Array.isArray(ctx.query.term) ? ctx.query.term[0] : ctx.query.term || ""}}), ctx => `/dashboard/term-info/${ctx.query.term}`)

export default function TermsInfoPage({term}: {term: string}){
    return <DashboardGenericPage>TODO: {term}</DashboardGenericPage>
}
