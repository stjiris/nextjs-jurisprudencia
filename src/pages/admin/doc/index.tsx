import { DashboardGenericPage } from "@/components/genericPageStructure";
import { useFetch } from "@/components/useFetch";
import { withAuthentication } from "@/core/user/authenticate";
import { JurisprudenciaDocument, JurisprudenciaDocumentStateValues } from "@stjiris/jurisprudencia-document";
import { GetServerSideProps } from "next";
import Link from "next/link";
import { use, useEffect, useLayoutEffect, useRef, useState } from "react"
import { BadgeFromState, colorFromState } from "@/components/BadgeFromState";

export const getServerSideProps: GetServerSideProps<{}> = withAuthentication(async (ctx) => ({props: {}}))

export default function UpdatePage(){
    return <DashboardGenericPage>
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <SearchCard />
                </div>
            </div>
        </div>
    </DashboardGenericPage>
}

function SearchCard(){
    let inputRef = useRef<HTMLInputElement>(null);
    let [id, setId] = useState<string>(inputRef.current?.value || "");
    let StateChecked = JurisprudenciaDocumentStateValues.map(v => ({stateName: v, useState: useState(true)} as const))
    let allSame = StateChecked.every(({useState}) => useState[0] === StateChecked[0].useState[0])
    
    return <div className="card-body">
        <div className="card-title d-flex align-items-baseline justify-content-between">
            <h4 className="card-title">Editar documento</h4>
            <div className="btn-group align-items-baseline">
                <button key="Todos" className={`btn btn-sm btn-${allSame ? (StateChecked[0].useState[0] ? "primary" : "light") : "light"}`} onClick={() =>  StateChecked.forEach(({useState}) => allSame ? useState[1](!useState[0]) : useState[1](true))}>Todos</button>
                {StateChecked.map(({stateName, useState}, i) => <button key={i} className={`btn btn-sm btn-${useState[0] ? colorFromState(stateName) : "light"}`} onClick={() => useState[1](!useState[0])}>{stateName}</button>)}
            </div>
            <Link href="/admin/doc/criar" className="btn btn-primary">Criar</Link>
        </div>
        <div className="input-group">
            <span className="input-group-text">Pesquisar:</span>
            <input ref={inputRef} className="form-control" type="text" placeholder="ID, ECLI, UUID ou Processo" onInput={(evt) => setId(evt.currentTarget.value)}/>
        </div>
        <SearchResults id={id} state={StateChecked.filter(s => s.useState[0]).map(s => s.stateName)}/>
    </div>
}

function SearchResults({id, state}:{id: string, state: JurisprudenciaDocument["STATE"][]}){
    let [page, setPage] = useState(0);
    let results = useFetch<{[key: string]: JurisprudenciaDocument}>(`/api/searchId?id=${encodeURIComponent(id)}&state=${encodeURIComponent(state.join(","))}&page=${page}`, [id, state, page])
    useEffect(() => {
        if( Object.keys(results || {}).length <= 0 ) setPage(0)
    }, [results, id, state])
    return <div className="my-2">
        {results ?
        (Object.keys(results).length > 0 ? 
        <div>
            {Object.keys(results).map(id => <SearchResultHit key={id} id={id} doc={results![id]} />)}
            <div className="d-flex justify-content-center btn-group">
                <button className="btn btn-primary" onClick={() => setPage(p => p-1)} disabled={page <= 0}>Documentos anteriores</button>
                <span className="btn btn-secondary">{page+1}</span>
                <button className="btn btn-primary" onClick={() => setPage(p => p+1)} disabled={Object.keys(results).length < 5}>Próximos documentos</button>
            </div>
        </div>
        :
        <h6>Sem resultados...</h6>)
        : 
        <h6>A procurar...</h6>}
    </div>
}

function SearchResultHit({id, doc}: {id:string, doc: JurisprudenciaDocument}){
    return <div className="card m-1 p-0">
        <div className="card-body row align-items-center p-1">
            <div className="card-title col-5">
                <Link href={`/admin/doc/${encodeURIComponent(id)}/`}>{doc["ECLI"] || "(ecli vazio)"}</Link><br/>
                <BadgeFromState state={doc.STATE || undefined} />
            </div>
            <ul className="col-7 list-group list-group-flush">
                <li className="list-group-item">Processo: <b>{doc["Número de Processo"]}</b></li>
                <li className="list-group-item">Relator: <b>{doc["Relator Nome Profissional"]?.Show}</b></li>
                <li className="list-group-item">Data: <b>{doc["Data"]}</b></li>
            </ul>
        </div>
    </div>

}