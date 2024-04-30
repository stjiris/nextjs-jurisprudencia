import {DashboardGenericPage} from "@/components/genericPageStructure";

export default function ClosePageAfterPopupLogin() {
    return <DashboardGenericPage>
        <div className="container">Sessão restabelecida com sucesso. Pode fechar esta janela.</div>
    </DashboardGenericPage>
}