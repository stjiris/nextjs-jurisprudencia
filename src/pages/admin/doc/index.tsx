import { DashboardGenericPage } from "@/components/genericPageStructure";
import { withAuthentication } from "@/core/user/authenticate";
import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react"

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
    
    return <div className="card-body">
        <div className="card-title d-flex align-items-baseline justify-content-between">
            <h4 className="card-title">Editar documento</h4>
            <Link href="/admin/doc/criar" className="btn btn-primary">Criar</Link>
        </div>
        <div className="input-group">
            <span className="input-group-text">Pesquisar:</span>
            <input ref={inputRef} className="form-control" type="text" placeholder="ID, ECLI, UUID ou Processo" onInput={(evt) => setId(evt.currentTarget.value)}/>
        </div>
        { id && <SearchResults id={id} />}
    </div>
}

function SearchResults({id}:{id: string}){
    let [results, setResults] = useState<{[key: string]: JurisprudenciaDocument}>();
    let router = useRouter();

    useEffect(() => {
        setResults(undefined)
        const controller = new AbortController();
        fetch(`${router.basePath}/api/searchId?id=${encodeURIComponent(id)}`, {signal: controller.signal}).then( r => 
            r.status === 200 ? r.json() as Promise<{[key: string]: JurisprudenciaDocument}> : {}
        ).then(setResults)
        return () => {
            controller.abort();
        }
    }, [id, router.basePath])

    return <div className="my-2">
        {results ?
        (Object.keys(results).length > 0 ? 
        <div>
            {Object.keys(results).map(id => <SearchResultHit key={id} id={id} doc={results![id]} />)}
        </div>
        :
        <h6>Sem resultados...</h6>)
        : 
        <h6>A procurar...</h6>}
    { Array.isArray(results) }
    </div>
}

function SearchResultHit({id, doc}: {id:string, doc: JurisprudenciaDocument}){
    return <div className="card m-1 p-0">
        <div className="card-body row align-items-center p-1">
            <div className="card-title col-5"><Link href={`/admin/doc/${encodeURIComponent(id)}/`}>{doc["ECLI"]}</Link></div>
            <ul className="col-7 list-group list-group-flush">
                <li className="list-group-item">Processo: <b>{doc["Número de Processo"]}</b></li>
                <li className="list-group-item">Relator: <b>{doc["Relator Nome Profissional"]}</b></li>
                <li className="list-group-item">Data: <b>{doc["Data"]}</b></li>
            </ul>
        </div>
    </div>

}