import { GetServerSideProps } from "next";
import { withRole } from "@/core/user/authenticate";
import { LoggerServerSideProps } from "@/core/logger-api";
import GenericPage from "@/components/main_pages/genericPageStructure";
import { useFetch } from "@/components/useFetch";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { AuditAction, AuditEvent } from "@/core/audit-log";

const ACTIONS: AuditAction[] = [
    "login", "logout", "publicar", "tornar-privado", "restaurar",
    "editar", "criar", "eliminar", "importar", "exportar",
];

export const getServerSideProps: GetServerSideProps = LoggerServerSideProps(
    withRole("manageUsers", async () => ({ props: {} }))
);

export default function LogsPage() {
    const searchParams = useSearchParams();
    const [action, setAction] = useState(searchParams.get("action") || "");
    const [user, setUser] = useState(searchParams.get("user") || "");
    const [page, setPage] = useState(0);

    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (user) params.set("user", user);
    params.set("page", page.toString());
    params.set("size", "50");

    const data = useFetch<{ events: AuditEvent[]; total: number }>(
        `/api/admin/logs?${params}`,
        [action, user, page]
    );

    const totalPages = data ? Math.ceil(data.total / 50) : 0;

    return (
        <GenericPage title="Jurisprudência STJ - Registo de Atividade">
            <div className="row justify-content-sm-center">
                <div className="col-sm-12 col-lg-10">
                    <h4 className="mb-3">Registo de Atividade</h4>

                    <div className="d-flex gap-2 mb-3 flex-wrap">
                        <select
                            className="form-select form-select-sm"
                            style={{ maxWidth: 200 }}
                            value={action}
                            onChange={e => { setAction(e.target.value); setPage(0); }}
                        >
                            <option value="">Todas as ações</option>
                            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            style={{ maxWidth: 200 }}
                            placeholder="Filtrar por utilizador"
                            value={user}
                            onChange={e => { setUser(e.target.value); setPage(0); }}
                        />
                    </div>

                    {!data ? (
                        <div className="text-center py-4">
                            <div className="spinner-border spinner-border-sm" role="status" />
                            <span className="ms-2">A carregar...</span>
                        </div>
                    ) : data.events.length === 0 ? (
                        <div className="alert alert-info">Sem registos.</div>
                    ) : (
                        <>
                            <div className="table-responsive">
                                <table className="table table-sm table-hover">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Data/Hora</th>
                                            <th>Utilizador</th>
                                            <th>Ação</th>
                                            <th>Documento</th>
                                            <th>Detalhes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.events.map((evt, i) => (
                                            <tr key={i}>
                                                <td className="text-nowrap">
                                                    {new Date(evt.timestamp).toLocaleString("pt-PT")}
                                                </td>
                                                <td>{evt.user}</td>
                                                <td>
                                                    <span className={`badge bg-${actionColor(evt.action)}`}>
                                                        {evt.action}
                                                    </span>
                                                </td>
                                                <td>
                                                    {evt.documentProcesso ? (
                                                        evt.documentId ? (
                                                            <Link href={`/${encodeURIComponent(evt.documentProcesso)}/${evt.documentId}`}>
                                                                {evt.documentProcesso}
                                                            </Link>
                                                        ) : (
                                                            evt.documentProcesso
                                                        )
                                                    ) : (
                                                        ""
                                                    )}
                                                </td>
                                                <td>{evt.details || ""}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {totalPages > 1 && (
                                <nav>
                                    <ul className="pagination pagination-sm justify-content-center">
                                        <li className={`page-item ${page === 0 ? "disabled" : ""}`}>
                                            <button className="page-link" onClick={() => setPage(p => Math.max(0, p - 1))}>
                                                Anterior
                                            </button>
                                        </li>
                                        <li className="page-item disabled">
                                            <span className="page-link">
                                                {page + 1} / {totalPages}
                                            </span>
                                        </li>
                                        <li className={`page-item ${page >= totalPages - 1 ? "disabled" : ""}`}>
                                            <button className="page-link" onClick={() => setPage(p => p + 1)}>
                                                Seguinte
                                            </button>
                                        </li>
                                    </ul>
                                </nav>
                            )}
                        </>
                    )}
                </div>
            </div>
        </GenericPage>
    );
}

function actionColor(action: string): string {
    switch (action) {
        case "login": return "primary";
        case "logout": return "secondary";
        case "publicar": return "success";
        case "tornar-privado": return "warning";
        case "eliminar": return "danger";
        case "restaurar": return "info";
        case "editar": return "dark";
        default: return "light";
    }
}
