import { GetServerSideProps } from "next";
import search from "@/core/elasticsearch"
import { JurisprudenciaDocument } from "@stjiris/jurisprudencia-document";
import Link from "next/link";
import Head from "next/head";
import { trackClickedDocument } from "@/core/track-search";
import { getAllKeys } from "@/core/keys";
import { JurisprudenciaKey } from "@/types/keys";
import { authenticatedHandler } from "@/core/user/authenticate";
import { LoggerServerSideProps } from "@/core/logger-api";
import GenericPage from "@/components/main_pages/genericPageStructure";
import DecisionView from "@/components/decision/DecisionView";

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
                    <Link href={doc.ECLI?.startsWith("ECLI:PT:STJ:") ? `/ecli/${doc.ECLI}` : `/${encodeURIComponent(doc["Número de Processo"]!)}/${doc.UUID}`}>{doc["Número de Processo"]}</Link>
                </li>)}
            </ol>
        </div>
    </>
}

function DocumentPage(props: { doc: JurisprudenciaDocument, id: string, keys: JurisprudenciaKey[] }) {
    let proc = props.doc["Número de Processo"]!;

    return <>
        <Head>
            <title>{`${proc} - Jurisprudência - STJ`}</title>
        </Head>
        <DecisionView {...props} />
    </>
}






