import GenericPage from "@/components/main_pages/genericPageStructure";
import { LoggerServerSideProps } from "@/core/logger-api";
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = LoggerServerSideProps(async ctx => {
    return {props: {}}
})
export default function ClosePageAfterPopupLogin() {
    return <GenericPage title="Estabelecer sessão">
        <div className="container">Sessão restabelecida com sucesso. Pode fechar esta janela.</div>
    </GenericPage>
}