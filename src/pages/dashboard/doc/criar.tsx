import GenericPage, { DashboardGenericPage } from "@/components/genericPageStructure"
import { getElasticSearchClient } from "@/core/elasticsearch";
import { withAuthentication } from "@/core/user/authenticate"
import { JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaVersion } from "@stjiris/jurisprudencia-document";
import { useState, Dispatch, SetStateAction } from "react";

export const getServerSideProps = withAuthentication<{}>( async (ctx) => {
    return {props: {}}
}, "/dashboard/doc/criar")

const Sep = () => <div className="m-2 p-0"></div>

export default function Create(){
    let [updateObj, setUpdateObj] = useState<Record<string, string | string[]>>({})
    
    return <DashboardGenericPage>
        <div className="row justify-content-sm-center">
            <div className="col-sm-12 col-md-8 col-xl-6">
                <div className="card shadow">
                    <div className="card-body">
                        <ReadOnlyInput accessKey="ID" value={""} />
                        <Sep/>
                        <UpdateInput accessKey="Número de Processo" value="" setUpdateObject={setUpdateObj}/>
                        <ReadOnlyInput accessKey="Fonte" value="STJ (manual)"/>
                        <UpdateInput accessKey="URL" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="ECLI" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Data" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Área" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Meio Processual" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Relator Nome Profissional" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Secção" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Tribunal de Recurso" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Tribunal de Recurso - Processo" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Decisão" value="" setUpdateObject={setUpdateObj}/>
                        <ReadOnlyInput accessKey="Decisão (textual)" value=""/>
                        <UpdateInput accessKey="Votação - Decisão" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Votação - Vencidos" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Votação - Declarações" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Descritores" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Jurisprudência" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Jurisprudência Estrangeira" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Jurisprudência Internacional" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Jurisprudência Nacional" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Doutrina" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Legislação Comunitária" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Legislação Estrangeira" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Legislação Nacional" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <UpdateInput accessKey="Referências Internacionais" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Referência de publicação" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Área Temática" value="" setUpdateObject={setUpdateObj}/>
                        <UpdateInput accessKey="Indicações Eventuais" value="" setUpdateObject={setUpdateObj}/>
                        <Sep/>
                        <ReadOnlyInput accessKey="Sumário" value=""/>
                        <ReadOnlyInput accessKey="Texto" value=""/>
                    </div>
                    <div className="card-footer">
                        {JSON.stringify({id: "", create: updateObj})}
                    </div>
                </div>
            </div>
        </div>
    </DashboardGenericPage>
}

type MaybeKeyOfJurisprudencia = JurisprudenciaDocumentKey | (string & Record<never,never>)

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