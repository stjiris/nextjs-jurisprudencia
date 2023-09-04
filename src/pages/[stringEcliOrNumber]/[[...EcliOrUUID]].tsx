import { GetServerSideProps } from "next";
import search from "@/core/elasticsearch"
import { GenericField, JurisprudenciaDocument, JurisprudenciaDocumentKey } from "@stjiris/jurisprudencia-document";
import React, { CSSProperties, HTMLAttributes, ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import TargetBlankLink from "@/components/link";
import Head from "next/head";
import GenericPage from "@/components/genericPageStructure";
import { trackClickedDocument } from "@/core/track-search";
import { useRouter } from "next/router";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    let {stringEcliOrNumber,EcliOrUUID,search: searchId} = ctx.query;
    if(!stringEcliOrNumber) throw new Error("Invalid request")

    if(searchId){
        await trackClickedDocument(searchId as string, EcliOrUUID as string)
    }


    let must = [];
    if(stringEcliOrNumber == "ecli"){
        if( !EcliOrUUID ) throw new Error("Invalid request")
        let ecli = Array.isArray(EcliOrUUID) ? EcliOrUUID[0] : EcliOrUUID
        must.push({term: {ECLI: ecli}})
    }
    else{
        let proc = Array.isArray(stringEcliOrNumber) ? stringEcliOrNumber[0] : stringEcliOrNumber;
        must.push({term: {"Número de Processo": proc}})
        if( EcliOrUUID ){
            let uuid = Array.isArray(EcliOrUUID) ? EcliOrUUID[0] : EcliOrUUID
            must.push({wildcard: {UUID: `${uuid}*`}})
        }
    }

    let r = await search({bool: {must}}, {pre:[], after:[]}, 0, {}, 100, {_source: {excludes: ["Original","HASH","Content"]}});
    if( r.hits.hits.length <= 0 ){
        ctx.res.statusCode = 404;
        return {props: {}}
    }
    if( r.hits.hits.length == 1 ){
        return {props: {doc: r.hits.hits[0]._source}}
    }
    return {props: {doc: r.hits.hits.map( o => o._source )}}
}

export default function MaybeDocumentPage(props: {doc?: JurisprudenciaDocument | JurisprudenciaDocument[]}){
    let Comp;
    if( !props.doc ){
        Comp = <NoDocumentPage />
    }
    else if( Array.isArray(props.doc) ){
        Comp = <MultipleDocumentPage docs={props.doc} />
    }
    else{
        Comp = <DocumentPage doc={props.doc}/>
    }


    return <GenericPage keys_to_remove={["stringEcliOrNumber", "EcliOrUUID","search"]}>
        {Comp}
    </GenericPage>
}

function NoDocumentPage(){
    return <>
        <Head>
            <title>Documento Não Encontrado - Jurisprudência - STJ</title>
        </Head>
        <div className="alert alert-info" role="alert">
            <h4 className="alert-heading">Sem resultados...</h4>
            <strong><i className="bi bi-lightbulb-fill"></i>Sugestões:</strong>
            <ol>
                <li>O recurso não foi encontrado ou ainda não foi publicado neste arquivo</li>
            </ol>
        </div>
    </>
}

function MultipleDocumentPage(props: {docs: JurisprudenciaDocument[]}){
    return <>
        <Head>
            <title>Vários documentos encontrados - Jurisprudência - STJ</title>
        </Head>
        <div className="alert alert-info" role="alert">
            <h4 className="alert-heading">Escolher documento a abrir...</h4>
            <ol>
                {props.docs.map((doc, i) => <li key={i}>
                    <Link href={doc.ECLI?.startsWith("ECLI:PT:STJ:") ? `/ecli/${doc.ECLI}` : `/${encodeURIComponent(doc["Número de Processo"]!)}/${doc.UUID}`} target="_blank">{doc["Número de Processo"]}</Link>
                </li>)}
            </ol>
        </div>
    </>
}

function DocumentPage(props: {doc: JurisprudenciaDocument}){
    const [related, setRelated] = useState<JurisprudenciaDocument[]>([]);
    const router = useRouter()

    let proc = props.doc["Número de Processo"]!;
    let uuid = props.doc["UUID"]!;
    useEffect(() => {
        fetch(`${router.basePath}/api/related/${encodeURIComponent(proc)}/${uuid}`)
            .then( r => r.json())
            .then(l => setRelated(l))
    }, [proc, uuid, router.basePath])
    
    return <>
        <Head>
            <title>{`${proc} - Jurisprudência - STJ`}</title>
        </Head>
        <div className="border border-dark container-fluid">
            <Row>
                <div className="col-1"><b>N.º de Processo:</b></div>
                <div className="col-7">{props.doc["Número de Processo"]}</div>
                <div className="col-4 text-end">
                    {props.doc.ECLI && props.doc.ECLI.length > 0 && props.doc.ECLI !== "«sem valor»" && <><small><TargetBlankLink href={`https://jurisprudencia.csm.org.pt/ecli/${props.doc.ECLI!}`} target="_blank" >{props.doc.ECLI}</TargetBlankLink></small>&nbsp;</>}
                    {props.doc.URL && props.doc.URL.length > 0 && props.doc.URL !== "«sem valor»" && <><small><TargetBlankLink href={props.doc.URL}>{new URL(props.doc.URL!).host}</TargetBlankLink></small>&nbsp;</>}
                    <small><b>Fonte:&nbsp;</b><span>{props.doc.Fonte}</span></small>
                </div>
            </Row>
            {related.length > 0 ?
                <Row style={{background: "#dfdfdf"}}>
                    <div className="col-1"><i className="bi bi-link"></i>Relacionados:</div>
                    <div className="col-11">
                        {related.flatMap((d,i) => [" / ", <Link key={i} href={`/${encodeURIComponent(d["Número de Processo"]!)}/${d.UUID}`}>{d["Número de Processo"]}</Link>, ` (${d.Data})`]).slice(1)}
                    </div>
                </Row> : 
            <></>}
            <DefaultRow doc={props.doc} accessKey="Data" noLink={true} />
            <DefaultRow doc={props.doc} accessKey="Área" />
            <DefaultRow doc={props.doc} accessKey="Meio Processual" />
            <DefaultRow doc={props.doc} accessKey="Relator Nome Profissional" showkey="Relator"/>
            
            <DefaultRow doc={props.doc} accessKey="Secção"/>
            <MultipleRow doc={props.doc} accessKeys={["Tribunal de Recurso","Tribunal de Recurso - Processo"]} showKeys={["T. de Recurso","Processo"]}/>
            <DefaultRow doc={props.doc} accessKey="Decisão"/>
            <DefaultRow doc={props.doc} accessKey="Votação"/>
            <DefaultRow doc={props.doc} accessKey="Descritores"/>
            <DefaultRow doc={props.doc} accessKey="Jurisprudência Estrangeira"/>
            <DefaultRow doc={props.doc} accessKey="Jurisprudência Internacional"/>
            <DefaultRow doc={props.doc} accessKey="Jurisprudência Nacional"/>
            <DefaultRow doc={props.doc} accessKey="Doutrina"/>
            <DefaultRow doc={props.doc} accessKey="Legislação Comunitária"/>
            <DefaultRow doc={props.doc} accessKey="Legislação Estrangeira"/>
            <DefaultRow doc={props.doc} accessKey="Legislação Nacional"/>
            <DefaultRow doc={props.doc} accessKey="Referências Internacionais"/>
            <DefaultRow doc={props.doc} accessKey="Referência de publicação" showkey="R. de publicação"/>
            <DefaultRow doc={props.doc} accessKey="Área Temática"/>
            <DefaultRow doc={props.doc} accessKey="Indicações Eventuais"/>
        </div>
        <h6 className="border-top border-2 mt-2"><b>Sumário</b></h6>
        <div className="p-2" dangerouslySetInnerHTML={{__html: props.doc.Sumário!}}></div>
        <h6 className="border-top border-2 mt-2"><b>Decisão Texto Integral</b></h6>
        <div className="p-2" dangerouslySetInnerHTML={{__html: props.doc.Texto!}}></div>
    </>
}

function MultipleRow(props: {accessKeys: JurisprudenciaDocumentKey[], doc: JurisprudenciaDocument, showKeys?: string[]}){
    return <Row>
        <div className="col-1"><b>{props.showKeys?.at(0) || props.accessKeys.at(0)}</b></div>
        <div className="col-11">
            <Properties accessKey={props.accessKeys.at(0)!} accessValue={props.doc[props.accessKeys.at(0)!]!}/>
            {props.accessKeys.slice(1).map((k,i) => <React.Fragment key={i}>&nbsp;<span>{props.showKeys?.at(i+1) || k}: <Properties accessKey={k} accessValue={props.doc[k]!}/></span></React.Fragment>)}
        </div>
    </Row>
}

function DefaultRow(props: {accessKey: JurisprudenciaDocumentKey, showkey?: string, doc: JurisprudenciaDocument, style?: CSSProperties, noLink?: boolean}){
    return <Row style={props.style}>
        <div className="col-1"><b>{props.showkey ? props.showkey : props.accessKey}:</b></div>
        <div className="col-11">
            <Properties accessKey={props.accessKey} accessValue={props.doc[props.accessKey]} noLink={props.noLink}/>
        </div>
    </Row>
}

function Row(props: {children: ReactNode, style?: CSSProperties}){
    return <div className="row border-bottom" style={props.style}>{props.children}</div>
}

function Properties({accessKey, accessValue, noLink}: {accessKey: string, accessValue: JurisprudenciaDocument[JurisprudenciaDocumentKey], noLink?: boolean}){
    if( !accessValue ) return <>«sem valor»</>
    if( typeof accessValue === "string"  ){
        return noLink ? <>{accessValue}</> : <Link href={`/pesquisa?${accessKey}=${encodeURIComponent(accessValue)}`}>{accessValue}</Link>
    }
    if( "Index" in accessValue && "Show" in accessValue && "Original" in accessValue){
        let v = accessValue;
        return <>{Array.isArray(v.Show) ? v.Show.flatMap((v, i) => [" / ", noLink ? v : <Link key={i} href={`/pesquisa?${accessKey}=${encodeURIComponent(v)}`}>{v}</Link>]).slice(1) : v.Show}</>
    }
    return <details>
        <summary>{accessKey}</summary>
        <pre>{JSON.stringify(accessValue)}</pre>
    </details>
}