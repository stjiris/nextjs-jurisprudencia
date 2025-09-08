import { GetServerSideProps } from "next";
import search from "@/core/elasticsearch"
import { GenericField, JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaDocumentStateValue, isJurisprudenciaDocumentStateKey } from "@stjiris/jurisprudencia-document";
import React, { CSSProperties, HTMLAttributes, ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import TargetBlankLink from "@/components/link";
import Head from "next/head";
import GenericPage from "@/components/genericPageStructure";
import { trackClickedDocument } from "@/core/track-search";
import { getAllKeys } from "@/core/keys";
import { JurisprudenciaKey } from "@/types/keys";
import { useFetch } from "@/components/useFetch";
import { authenticatedHandler } from "@/core/user/authenticate";
import { BadgeFromState } from "@/components/BadgeFromState";
import { useAuth } from "@/contexts/auth";
import { LoggerServerSideProps } from "@/core/logger-api";

const MUST_HAVE = ["UUID", "Número de Processo", "Fonte", "ECLI", "URL", "Sumário", "Texto"]

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    LoggerServerSideProps(ctx);
    let { stringEcliOrNumber, EcliOrUUID, search: searchId } = ctx.query;
    if (!stringEcliOrNumber){
        return {
            redirect: {
                destination: "/",
                permanent: false
            },
        }
    }

    if (searchId) {
        await trackClickedDocument(searchId as string, EcliOrUUID as string)
    }


    let must = [];
    if (stringEcliOrNumber == "ecli") {
        if (!EcliOrUUID){
            return {
                redirect: {
                    destination: "/",
                    permanent: false
                },
            }
        }
        let ecli = Array.isArray(EcliOrUUID) ? EcliOrUUID[0] : EcliOrUUID
        must.push({ term: { ECLI: ecli } })
    }
    else {
        let proc = Array.isArray(stringEcliOrNumber) ? stringEcliOrNumber[0] : stringEcliOrNumber;
        must.push({ term: { "Número de Processo": proc } })
        if (EcliOrUUID) {
            let uuid = Array.isArray(EcliOrUUID) ? EcliOrUUID[0] : EcliOrUUID
            must.push({ wildcard: { UUID: `${uuid}*` } })
        }
    }

    const authed = await authenticatedHandler(ctx.req);
    let keys = await getAllKeys(authed);
    let includes = keys.filter(k => k.documentShow || MUST_HAVE.includes(k.key)).map(k => k.key);
    let excludes = keys.filter(k => !k.documentShow && !MUST_HAVE.includes(k.key)).map(k => k.key);
    let r = await search({ bool: { must } }, { pre: [], after: [] }, 0, {}, 100, { _source: { includes, excludes } }, authed);
    if (r.hits.hits.length <= 0) {
        ctx.res.statusCode = 404;
        return { props: {} }
    }
    if (r.hits.hits.length == 1) {
        return { props: { doc: r.hits.hits[0]._source, keys, id: r.hits.hits[0]._id } }
    }
    return { props: { doc: r.hits.hits.map(o => o._source), ids: r.hits.hits.map(o => o._id), keys } }
}

export default function MaybeDocumentPage(props: { doc?: JurisprudenciaDocument | JurisprudenciaDocument[], keys: JurisprudenciaKey[], id?: string, ids?: string[] }) {
    let Comp;
    if (!props.doc) {
        Comp = <NoDocumentPage />
    }
    else if (Array.isArray(props.doc)) {
        Comp = <MultipleDocumentPage docs={props.doc} ids={props.ids!} />
    }
    else {
        Comp = <DocumentPage doc={props.doc} id={props.id!} keys={props.keys} />
    }


    return <GenericPage keys_to_remove={["stringEcliOrNumber", "EcliOrUUID", "search"]} title="">
        {Comp}
    </GenericPage>
}

function NoDocumentPage() {
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

function MultipleDocumentPage(props: { docs: JurisprudenciaDocument[], ids: string[] }) {
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

// Add styles for the text container
const styles = `
.acordao-text-container {
    max-width: 900px;
    margin: 0 auto;
    font-size: 1.1rem;
    line-height: 1.6;
}

.sumario-text-container {
    font-size: 1.35rem;
    line-height: 1.7;
    margin-top: 0.25rem;
    padding-top: 0;
}
`;

function DocumentPage(props: { doc: JurisprudenciaDocument, id: string, keys: JurisprudenciaKey[] }) {
    let auth = useAuth();
    let proc = props.doc["Número de Processo"]!;
    let uuid = props.doc["UUID"]!;
    let related = useFetch<JurisprudenciaDocument[]>(`/api/related/${encodeURIComponent(proc)}/${uuid}`, []) || []

    return <>
        <Head>
            <title>{`${proc} - Jurisprudência - STJ`}</title>
            <style>{styles}</style>
        </Head>
        {auth &&
            <div className="border border-dark container-fluid mb-1">
                <Row>
                    <div className="col-1"><b>Gestão:</b></div>
                    <div className="col-11"><Link href={`/editar/avancado/${encodeURIComponent(props.id)}`}><i className="bi bi-pencil-square"></i> Abrir editor</Link></div>
                </Row>
            </div>}
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
                <Row style={{ background: "#dfdfdf" }}>
                    <div className="col-1"><i className="bi bi-link"></i>Relacionados:</div>
                    <div className="col-11">
                        {related.flatMap((d, i) => [" / ", <Link key={i} href={`/${encodeURIComponent(d["Número de Processo"]!)}/${d.UUID}`}>{d["Número de Processo"]}</Link>, ` (${d.Data})`]).slice(1)}
                    </div>
                </Row> :
                <></>}
            {props.keys.filter(k => k.documentShow && !MUST_HAVE.includes(k.key)).map(k => <DefaultRow key={k.key} doc={props.doc} showkey={k.name} accessKey={k.key} noLink={!k.indicesList} />)}
        </div>
        <h6 className="border-top border-2 mt-2 mb-1"><b>Sumário</b></h6>
        <div className="p-2 sumario-text-container" dangerouslySetInnerHTML={{ __html: props.doc.Sumário! }}></div>
        <h6 className="border-top border-2 mt-2"><b>Decisão Texto Integral</b></h6>
        <div className="p-2 acordao-text-container" dangerouslySetInnerHTML={{ __html: props.doc.Texto! }}></div>
    </>
}

function DefaultRow(props: { accessKey: JurisprudenciaDocumentKey, showkey?: string, doc: JurisprudenciaDocument, style?: CSSProperties, noLink?: boolean }) {
    let value = props.doc[props.accessKey];
    if (!value) return <></>

    if (typeof value === "string" && value.length === 0) return <></>
    if (typeof value === "object" && "Show" in value && "Original" in value && value.Show.length === 0 && value.Original.length === 0) return <></>
    return props.doc[props.accessKey] ? <Row style={props.style}>
        <div className="col-1"><b>{props.showkey ? props.showkey : props.accessKey}:</b></div>
        <div className="col-11">
            <Properties accessKey={props.accessKey} accessValue={props.doc[props.accessKey]} noLink={props.noLink} />
        </div>
    </Row> : <></>
}

function Row(props: { children: ReactNode, style?: CSSProperties }) {
    return <div className="row border-bottom" style={props.style}>{props.children}</div>
}

function Properties({ accessKey, accessValue, noLink }: { accessKey: string, accessValue: JurisprudenciaDocument[JurisprudenciaDocumentKey], noLink?: boolean }) {
    if (!accessValue) return <>«sem valor»</>
    if (isJurisprudenciaDocumentStateKey(accessKey)) {
        return <BadgeFromState state={accessValue as JurisprudenciaDocumentStateValue} />
    }
    if (typeof accessValue === "string") {
        return noLink ? <>{accessValue}</> : <Link href={`/pesquisa?${accessKey}=${encodeURIComponent(accessValue)}`}>{accessValue}</Link>
    }
    if ("Index" in accessValue && "Show" in accessValue && "Original" in accessValue) {
        let v = accessValue;
        return <ShowOrOriginal accessKey={accessKey} value={accessValue} noLink={noLink} />
    }
    return <details>
        <summary>{accessKey}</summary>
        <pre>{JSON.stringify(accessValue)}</pre>
    </details>
}

function ShowOrOriginal(props: { accessKey: string, value: { Show?: string[], Original?: string[] }, noLink?: boolean }) {
    if (props.value.Show && props.value.Show.length > 0) {
        return <>{props.value.Show.flatMap((v, i) => [" / ", props.noLink ? v : <Link key={i} href={`/pesquisa?${props.accessKey}=${encodeURIComponent(v)}`}>{v}</Link>]).slice(1)}</>
    }
    else {
        return <>{props.value.Original?.flatMap((v, i) => [" / ", v]).slice(1)}</>
    }
}