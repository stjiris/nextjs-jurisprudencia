import GenericPage from "@/components/main_pages/genericPageStructure";
import Link from "next/link";
import Head from "next/head";

export default function Custom500() {
    return (
        <GenericPage title="Jurisprudência STJ - Erro no Servidor">
            <Head>
                <title>Erro no Servidor (500) - Jurisprudência STJ</title>
            </Head>
            <div className="container py-5">
                <div className="row justify-content-center">
                    <div className="col-md-8 col-lg-6 text-center">
                        <div className="card shadow-sm border-0 p-4">
                            <div className="mb-3">
                                <i className="bi bi-exclamation-octagon display-1 text-danger"></i>
                            </div>
                            <h2 className="card-title h3 mb-2">Erro no Servidor (500)</h2>
                            <p className="text-muted mb-4">
                                Ocorreu uma falha inesperada ao processar o seu pedido no Juris.
                            </p>

                            <div className="alert alert-light border text-start mb-4">
                                <strong className="d-block mb-1">
                                    <i className="bi bi-tools me-1 text-danger"></i>
                                    O que pode fazer:
                                </strong>
                                <ul className="mb-0 ps-3 small text-muted">
                                    <li>Tente recarregar a página dentro de momentos;</li>
                                    <li>Verifique se a base de dados Elasticsearch e serviços internos estão acessíveis;</li>
                                    <li>Se o problema persistir, contacte a equipa técnica do NAP / STJ.</li>
                                </ul>
                            </div>

                            <div className="d-flex justify-content-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => window.location.reload()}
                                >
                                    <i className="bi bi-arrow-clockwise me-1"></i>
                                    Tentar Novamente
                                </button>
                                <Link href="/pesquisa" className="btn btn-outline-secondary">
                                    <i className="bi bi-search me-1"></i>
                                    Pesquisa de Acórdãos
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </GenericPage>
    );
}
