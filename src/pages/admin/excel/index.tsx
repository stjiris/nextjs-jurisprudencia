import { exportableKeys } from "@/components/exportable-keys";
import { DashboardGenericPage } from "@/components/genericPageStructure";
import { useFetch } from "@/components/useFetch";
import { LoggerServerSideProps } from "@/core/logger-api";
import { withAuthentication } from "@/core/user/authenticate";
import { ExcelFile, ExcelState, FileState } from "@/types/excel";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import dynamic from 'next/dynamic';

const AnalyticsDashboard = dynamic(() => import('@/components/AnalyticsDashboard'), { ssr: false });
const NormalizationDashboard = dynamic(() => import('@/components/NormalizationDashboard'), { ssr: false });

export const getServerSideProps = withAuthentication<{}>(async ctx => {
    LoggerServerSideProps(ctx);
    return {props: {}}
})

const intl = new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "long",
    timeZone: "UTC"
})

export default function ExcelPage(){
    const keysParentRef = useRef<HTMLFormElement>(null);
    const [lastUpdate, setlastUpdate] = useState<Date>(new Date(0));
    const progress = useFetch<ExcelState>(`/api/excel/status`, [lastUpdate])
    const files = useFetch<ExcelFile[]>(`/api/excel/files`, [lastUpdate])
    const router = useRouter();
    const exportables = exportableKeys();
    const [importFile, setImportFile] = useState<File>() 

    useEffect(() => {
        let int = setInterval(() => setlastUpdate(new Date()), 2500)
        return () => clearInterval(int);
    }, [])

    const getParams = () => {
        if( !keysParentRef.current ) return new URLSearchParams();
        let fd = new FormData(keysParentRef.current);
        let selected = fd.getAll("key");
        let params = new URLSearchParams();
        exportables.forEach(k => {
            if( !selected.includes(k) ){
                params.append("exclude", k)
            }
        })
        if( allBox().checked ){
            params.set("doAll","")
        }
        return params;
    }

    const runExportRequest = () => {
        let params = getParams();
        fetch(`${router.basePath}/api/excel/run?${params.toString()}`, {method:"POST"}).then(r => setlastUpdate(new Date()))
    }

    const runImportRequest = () => {
        if( !importFile ) return alert("Nenhum ficheiro selecionado!");
        let params = getParams();
        let fd = new FormData();
        fd.set("doImport", "")
        fd.set("import", importFile)
        fetch(`${router.basePath}/api/excel/run?${params.toString()}`, {method:"POST", body: fd}).then(r => setlastUpdate(new Date()))
    }

    const checkboxes = () => Array.from(keysParentRef.current?.querySelectorAll<HTMLInputElement>("input[type='checkbox']") || []);
    const toggleBox = () => document.getElementById("input-key-toggle") as HTMLInputElement
    const allBox = () => document.getElementById("input-all") as HTMLInputElement

    const updateToggle = () => {
        let allChecked = checkboxes().every(c => c.checked);
        let allUnchecked = checkboxes().every(c => !c.checked);
        let b = toggleBox();
        if( allChecked || allUnchecked ){
            b.checked = allChecked;
            b.indeterminate = false;
        }
        else{
            b.indeterminate = true;
        }
    }

    const toggleAll = () => {
        let b = toggleBox();
        if( b.indeterminate ){
            checkboxes().forEach( c => {
                c.checked = false;
            })
            b.indeterminate = false
            b.checked = false
        }
        else{
            checkboxes().forEach( c => {
                c.checked = b.checked;
            })

        }
    }

    return <DashboardGenericPage title="Jurisprudência STJ - Excel">
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <div className="row">
                            <div className="col-8">
                                <div className="row">
                                    <div className="col-2">Importação:</div>
                                    <div className="col-10">
                                        <div className="progress">
                                            <div className="progress-bar" role="progressbar" style={{width: `${(progress?.import || 0)*100}%`}} aria-valuenow={((progress?.import || 0)*100)} aria-valuemin={0} aria-valuemax={100}></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-2" >Agregações:</div>
                                    <div className="col-10">
                                        <div className="progress">
                                            <div className="progress-bar" role="progressbar" style={{width: `${(progress?.export_agg || 0)*100}%`}} aria-valuenow={((progress?.export_agg || 0)*100)} aria-valuemin={0} aria-valuemax={100}></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-2" >Conteudos:</div>
                                    <div className="col-10">
                                        <div className="progress">
                                            <div className="progress-bar" role="progressbar" style={{width: `${(progress?.export_all || 0)*100}%`}} aria-valuenow={((progress?.export_all || 0)*100)} aria-valuemin={0} aria-valuemax={100}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-4 text-end">
                                <span>Última atualização: {intl.format(lastUpdate)}</span>
                            </div>
                            <form ref={keysParentRef} className="col-12 row border-top border-bottom pt-1 pb-1">
                                {exportables.map((k,i) => <div className="form-check col-4" key={k}><input id={`input-key-${i}`} className="form-check-input" name="key" value={k} type="checkbox" defaultChecked onChange={updateToggle} /><label htmlFor={`input-key-${i}`} className="form-check-label">{k}</label></div>)}
                            </form>
                            <div className="col-8">
                                <input type="file" className="form-control" onChange={(e) => (e.currentTarget.files?.length || 0) > 0 ? setImportFile(e.currentTarget.files![0]) : setImportFile(undefined)} accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/>
                            </div>
                            <div className="col-4">
                                <div className="form-check"><input className="form-check-input" id="input-key-toggle" type="checkbox" defaultChecked onChange={toggleAll} /><label htmlFor="input-key-toggle" className="form-check-label">Selecionar tudo</label></div>
                                <div className="form-check"><input className="form-check-input" id="input-all" type="checkbox" defaultChecked/><label htmlFor="input-all" className="form-check-label">Exportar conteúdo</label></div>
                            </div>
                            <div className="col-8">
                                <button className="btn btn-primary" disabled={progress?.import!== null || progress?.export_agg !== null || progress?.export_all !== null || !importFile} onClick={runImportRequest}><i className="bi bi-play"></i> Atualizar</button>
                            </div>
                            <div className="col-4">
                                <button className="btn btn-primary" disabled={progress?.import!== null || progress?.export_agg !== null || progress?.export_all !== null} onClick={runExportRequest}><i className="bi bi-play"></i> Nova exportação</button>
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
            <AnalyticsDashboard />
            <NormalizationDashboard />
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