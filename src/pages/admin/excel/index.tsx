import { DashboardGenericPage } from "@/components/genericPageStructure";
import { useFetch } from "@/components/useFetch";
import { withAuthentication } from "@/core/user/authenticate";
import { ExcelFile, ExcelState, FileState } from "@/types/excel";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export const getServerSideProps = withAuthentication<{}>(async ctx => ({props: {}}))

const intl = new Intl.DateTimeFormat("pt-PT", {dateStyle: "short", timeStyle: "long"})

export default function ExcelPage(){
    const [lastUpdate, setlastUpdate] = useState<Date>(new Date(0));
    const progress = useFetch<ExcelState>(`/api/excel/status`, [lastUpdate])
    const files = useFetch<ExcelFile[]>(`/api/excel/files`, [lastUpdate])
    const router = useRouter();

    useEffect(() => {
        let int = setInterval(() => setlastUpdate(new Date()), 2500)
        return () => clearInterval(int);
    }, [])

    return <DashboardGenericPage>
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <div className="row">
                            <div className="col-8">
                                <div className="progress">
                                    <div className="progress-bar" role="progressbar" style={{width: `${(progress?.import || 0)*100}%`}} aria-valuenow={((progress?.import || 0)*100)} aria-valuemin={0} aria-valuemax={100}></div>
                                </div>
                                <div className="progress">
                                    <div className="progress-bar" role="progressbar" style={{width: `${(progress?.export_agg || 0)*100}%`}} aria-valuenow={((progress?.export_agg || 0)*100)} aria-valuemin={0} aria-valuemax={100}></div>
                                </div>
                                <div className="progress">
                                    <div className="progress-bar" role="progressbar" style={{width: `${(progress?.export_all || 0)*100}%`}} aria-valuenow={((progress?.export_all || 0)*100)} aria-valuemin={0} aria-valuemax={100}></div>
                                </div>
                            </div>
                            <div className="col-4 text-end">
                                Última atualização: {intl.format(lastUpdate)}
                            </div>
                            <div className="col-6">
                                <input type="file" className="form-control" disabled/>
                            </div>
                            <div className="col-6">
                                
                            </div>
                            <div className="col-6">
                                <button className="btn btn-primary" disabled={true || progress?.import!== null}><i className="bi bi-play"></i> WIP (Atualizar)</button>
                            </div>
                            <div className="col-6">
                                <button className="btn btn-primary" disabled={progress?.export_agg !== null || progress?.export_all !== null} onClick={() => fetch(router.basePath+`/api/excel/run`, {method:"POST"}).then(r => setlastUpdate(new Date()))}><i className="bi bi-play"></i> Nova exportação</button>
                            </div>
                        </div>
                        <hr/>
                        <table className="table table-sm">
                            <thead>
                                <tr>
                                    <th>Ficheiro de Atualização</th>
                                    <th>Ficheiro de Agregações</th>
                                    <th>Ficheiro de Conteúdos</th>
                                    <th>Data</th>
                                    <th>Detalhes do processo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {files?.map(f => <RowFile key={f.id} file={f} />)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </DashboardGenericPage>
}

function RowFile(props: {file: ExcelFile}){
    return <tr>
        <CellFile id={props.file.id} state={props.file.imported} link="imp"/>
        <CellFile id={props.file.id} state={props.file.exported_agg} link="agg"/>
        <CellFile id={props.file.id} state={props.file.exported_all} link="all"/>
        <td>{intl.format(parseInt(props.file.id))}</td>
        <CellFile id={props.file.id} state={props.file.result} link="res"/>
    </tr>
}

function CellFile({id, state, link}: {id: string, state: FileState, link: string}){
    return <td>{state === FileState.no_file ? <><i className="bi bi-x"></i> Sem ficheiro</> : state === FileState.dot_file ? <><i className="bi bi-hourglass"></i> A processar</> : <Link href={`/api/excel/${id}/${link}`} target="_blank" download={`${id}${link}`}><i className="bi bi-download"></i> Descarregar</Link>}</td>
}