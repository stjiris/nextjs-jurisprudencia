import GenericPage, { DashboardGenericPage } from "@/components/genericPageStructure"
import { getElasticSearchClient } from "@/core/elasticsearch";
import { withAuthentication } from "@/core/user/authenticate"
import Table from "material-react-table";
import { JurisprudenciaDocument, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { useState, Dispatch, SetStateAction } from "react";

export const getServerSideProps = withAuthentication<UpdateProps>( async (ctx) => {
    let id = Array.isArray(ctx.query.id) ? ctx.query.id[0] : ctx.query.id || "";
    if(!id) throw new Error("Invalid request")

    let client = await getElasticSearchClient();

    return client.get<JurisprudenciaDocument>({
        index: JurisprudenciaVersion,
        id: id
    }).then(r => ({props: {doc: r._source!, id: id}}))
}, (ctx) => {
    return `/dashboard/doc/${ctx.params?.id || ""}`
})

interface UpdateProps {
    doc: JurisprudenciaDocument,
    id: string
}

const Sep = () => <div className="m-2 p-0"></div>

export default function Update({doc, id}: UpdateProps){
    let [updateObj, setUpdateObj] = useState<Record<string, string | string[]>>({})
    
    return <DashboardGenericPage>
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <ReadOnlyInput accessKey="ID" value={id} />
                        <Sep/>
                        <UpdateInput accessKey="Número de Processo" value={doc["Número de Processo"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Fonte" value={doc["Fonte"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="URL" value={doc["URL"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="ECLI" value={doc["ECLI"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Data" value={doc["Data"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Área" value={doc["Área"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Meio Processual" value={doc["Meio Processual"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Relator Nome Profissional" value={doc["Relator Nome Profissional"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Secção" value={doc["Secção"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Tribunal de Recurso" value={doc["Tribunal de Recurso"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Tribunal de Recurso - Processo" value={doc["Tribunal de Recurso - Processo"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Decisão" value={doc["Decisão"]} setUpdateObject={setUpdateObj}/>
                        <ReadOnlyInput accessKey="Decisão (textual)" value={doc["Decisão (textual)"]} />
                        <UpdateInput accessKey="Votação - Decisão" value={doc["Votação - Decisão"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Votação - Vencidos" value={doc["Votação - Vencidos"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Votação - Declarações" value={doc["Votação - Declarações"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Descritores" value={doc["Descritores"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Jurisprudência" value={doc["Jurisprudência"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Jurisprudência Estrangeira" value={doc["Jurisprudência Estrangeira"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Jurisprudência Internacional" value={doc["Jurisprudência Internacional"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Jurisprudência Nacional" value={doc["Jurisprudência Nacional"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Doutrina" value={doc["Doutrina"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Legislação Comunitária" value={doc["Legislação Comunitária"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Legislação Estrangeira" value={doc["Legislação Estrangeira"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Legislação Nacional" value={doc["Legislação Nacional"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Referências Internacionais" value={doc["Referências Internacionais"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Referência de publicação" value={doc["Referência de publicação"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Área Temática" value={doc["Área Temática"]} setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Indicações Eventuais" value={doc["Indicações Eventuais"]} setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <ReadOnlyInput accessKey="Sumário" value={doc["Sumário"]} />
                        <ReadOnlyInput accessKey="Texto" value={doc["Texto"]} />
                    </div>
                    <div className="card-footer">
                        {JSON.stringify({id: id, updates: updateObj})}
                    </div>
                </div>
            </div>
        </div>
    </DashboardGenericPage>
}

type MaybeKeyOfJurisprudencia = keyof JurisprudenciaDocument | (string & Record<never,never>)

function ReadOnlyInput({accessKey, value}: {accessKey: MaybeKeyOfJurisprudencia, value: string | string[]}){
    return <div className="input-group">
        <small className="input-group-text w-25">{accessKey}</small>
        <input className="form-control" value={value} readOnly/>
    </div>
}

function UpdateInput({accessKey, value, setUpdateObject}: {accessKey: MaybeKeyOfJurisprudencia, value: string | string[], setUpdateObject: Dispatch<SetStateAction<Record<string, string | string[]>>>}){
    let update = (key: string, newValue: string | string[]) => {
        if( JSON.stringify(newValue) === JSON.stringify(value) ){
            setUpdateObject(({[key]: _key_to_remove, ...old}) => ({...old}))
        }
        else{
            setUpdateObject((old) => ({...old, [key]: newValue}))
        }
    }

    if( typeof value === "string" ){
        return <div className="input-group">
            <small className="input-group-text w-25">{accessKey}</small>
            <input className="form-control" defaultValue={value} onInput={(evt) => update(accessKey, evt.currentTarget.value)}/>
        </div>
    }
    else if(Array.isArray(value)){
        return <div className="input-group">
            <small className="input-group-text w-25">{accessKey}</small>
            <textarea className="form-control" defaultValue={value.join("\n")} rows={value.length} onInput={(evt) => update(accessKey, evt.currentTarget.value.split("\n"))}/>
        </div>
    }
    else{
        return <div className="input-group">
            <small className="input-group-text w-25">{accessKey}</small>
            <textarea className="form-control" readOnly value={JSON.stringify(value, null, "  ")} rows={JSON.stringify(value, null, "   ").split("\n").length}/>
        </div>
    }
}