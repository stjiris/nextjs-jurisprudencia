import GenericPage from "@/components/main_pages/genericPageStructure";
import Link from "next/link";
import Head from "next/head";

export default function Custom404() {
    return (
        <GenericPage title="Jurisprudência STJ - Página Não Encontrada">
            <Head>
                <title>Página Não Encontrada (404) - Jurisprudência STJ</title>
            </Head>
            <div className="container py-5">
                <div className="row justify-content-center">
                    <div className="col-md-8 col-lg-6 text-center">
                        <div className="card shadow-sm border-0 p-4">
                            <div className="mb-3">
                                <i className="bi bi-file-earmark-x display-1 text-warning"></i>
                            </div>
                            <h2 className="card-title h3 mb-2">Página Não Encontrada (404)</h2>
                            <p className="text-muted mb-4">
                                O acórdão, página ou recurso que está a tentar aceder não existe ou pode ter sido movido.
                            </p>

                            <div className="alert alert-light border text-start mb-4">
                                <strong className="d-block mb-1">
                                    <i className="bi bi-info-circle me-1 text-primary"></i>
                                    Possíveis causas:
                                </strong>
                                <ul className="mb-0 ps-3 small text-muted">
                                    <li>O número de processo ou ECLI foi introduzido incorretamente;</li>
                                    <li>O documento ainda não foi publicado ou encontra-se em modo privado/preparação (requer início de sessão como administrador);</li>
                                    <li>O endereço URL foi alterado ou o link está desatualizado.</li>
                                </ul>
                            </div>

                            <div className="d-flex justify-content-center gap-2">
                                <Link href="/pesquisa" className="btn btn-primary">
                                    <i className="bi bi-search me-1"></i>
                                    Pesquisa de Acórdãos
                                </Link>
                                <Link href="/" className="btn btn-outline-secondary">
                                    <i className="bi bi-house me-1"></i>
                                    Página Inicial
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </GenericPage>
    );
}
