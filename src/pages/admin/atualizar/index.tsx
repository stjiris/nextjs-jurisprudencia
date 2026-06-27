import { DashboardGenericPage } from "@/components/genericPageStructure";
import { useFetch } from "@/components/useFetch";
import { LoggerServerSideProps } from "@/core/logger-api";
import { withAuthentication } from "@/core/user/authenticate";
import { EtlRunWithId } from "@/core/etl-trigger";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export const getServerSideProps = withAuthentication<{}>(async ctx => {
    LoggerServerSideProps(ctx);
    return { props: {} }
})

// Hard-coded estimate derived from the full-run history (6.5h-8.5h observed).
const ESTIMATED_DURATION_MS = 7 * 60 * 60 * 1000;

const intl = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" })

function fmt(d: string | null | undefined) {
    return d ? intl.format(new Date(d)) : "—";
}

export default function AtualizarPage() {
    const router = useRouter();
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date(0));
    const run = useFetch<EtlRunWithId | null>(`/api/etl/status`, [lastUpdate]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let int = setInterval(() => setLastUpdate(new Date()), 5000)
        return () => clearInterval(int);
    }, [])

    const active = !!run && (run.status === "scheduled" || run.status === "running");

    const schedule = () => {
        setBusy(true);
        fetch(`${router.basePath}/api/etl/schedule`, { method: "POST" })
            .then(r => r.json())
            .then(() => setLastUpdate(new Date()))
            .catch(e => console.error(e))
            .finally(() => setBusy(false));
    }

    return <DashboardGenericPage title="Jurisprudência STJ - Atualizar do DGSI">
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <h5 className="card-title">Atualização completa a partir do DGSI</h5>
                        <p className="text-muted small">
                            Agenda uma atualização completa (<code>--full</code>) que percorre todo o DGSI e
                            reconcilia os acórdãos já indexados &mdash; apanha correções a decisões existentes,
                            não apenas as novas. Corre durante a noite para não sobrecarregar o DGSI.
                        </p>

                        <button
                            className="btn btn-primary"
                            disabled={busy || active}
                            onClick={schedule}>
                            <i className="bi bi-clock-history"></i> Atualizar esta noite
                        </button>

                        <hr />
                        <RunStatus run={run} />

                        <p className="text-muted small mt-3 mb-0">
                            Nota: a atualização não remove acórdãos que tenham deixado de existir no DGSI e pode
                            criar duplicados se o endereço (URL) de um acórdão mudar.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </DashboardGenericPage>
}

function RunStatus({ run }: { run: EtlRunWithId | null | undefined }) {
    if (run === undefined) return <p>A carregar&hellip;</p>;
    if (run === null) return <p>Nenhuma atualização agendada até agora.</p>;

    const estEnd = new Date(
        (run.startedAt ? new Date(run.startedAt) : new Date(run.scheduledFor)).getTime() + ESTIMATED_DURATION_MS
    );

    switch (run.status) {
        case "scheduled":
            return <div className="alert alert-info mb-0">
                Agendada para <b>{fmt(run.scheduledFor)}</b>. Duração estimada <b>~7 horas</b>
                {" "}(deverá terminar por volta das <b>{intl.format(estEnd)}</b>).
                <div className="small">Pedida por {run.requestedBy}.</div>
            </div>;
        case "running":
            return <div className="alert alert-warning mb-0">
                Em execução desde <b>{fmt(run.startedAt)}</b>. Duração estimada <b>~7 horas</b>
                {" "}(deverá terminar por volta das <b>{intl.format(estEnd)}</b>).
            </div>;
        case "success":
            return <div className="alert alert-success mb-0">
                Concluída com sucesso em <b>{fmt(run.endedAt)}</b>.
                <div className="small">
                    Criados {run.created ?? 0}, atualizados {run.updated ?? 0}, ignorados {run.skiped ?? 0}.
                </div>
            </div>;
        case "failed":
            return <div className="alert alert-danger mb-0">
                Falhou em <b>{fmt(run.endedAt)}</b>{run.error ? <> &mdash; {run.error}</> : null}.
            </div>;
        case "skipped":
            return <div className="alert alert-secondary mb-0">
                Ignorada ({run.error || "outra execução em curso"}).
            </div>;
        default:
            return null;
    }
}
