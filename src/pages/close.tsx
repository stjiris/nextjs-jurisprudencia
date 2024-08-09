import {DashboardGenericPage} from "@/components/genericPageStructure";
import { LoggerServerSideProps } from "@/core/logger-api";
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ctx => {
    LoggerServerSideProps(ctx);
    return {props: {}}
}
export default function ClosePageAfterPopupLogin() {
    return <DashboardGenericPage title="Estabelecer sessão">
        <div className="container">Sessão restabelecida com sucesso. Pode fechar esta janela.</div>
    </DashboardGenericPage>
}