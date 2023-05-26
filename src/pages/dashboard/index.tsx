import { GetServerSideProps } from "next";
import { DashboardGenericPage } from "@/components/genericPageStructure"
import { withAuthentication } from "@/core/user/authenticate";

export const getServerSideProps: GetServerSideProps<{}> = withAuthentication(async (ctx) => ({props: {}}), "/dashboard")

export default function DashboardIndex(){
    return <DashboardGenericPage>TODO:</DashboardGenericPage>
}