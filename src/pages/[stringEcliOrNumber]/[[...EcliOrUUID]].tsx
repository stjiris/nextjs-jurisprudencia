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

const MUST_HAVE = ["UUID", "Número de Processo", "Fonte", "ECLI", "URL", "Sumário", "Texto", "Área", "Data"]

export const getServerSideProps: GetServerSideProps = LoggerServerSideProps(async (ctx) => {
    let { stringEcliOrNumber, EcliOrUUID, search: searchId } = ctx.query;
    if (!stringEcliOrNumber) {
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
        if (!EcliOrUUID) {
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
    const NON_ANON_FIELDS = ["Sumário Não Anonimizado", "Texto Não Anonimizado"];
    let includes = keys.filter(k => k.documentShow || MUST_HAVE.includes(k.key)).map(k => k.key);
    let excludes = keys.filter(k => !k.documentShow && !MUST_HAVE.includes(k.key)).map(k => k.key);
    if (authed) {
        includes = [...new Set([...includes, ...NON_ANON_FIELDS])] as typeof includes;
        excludes = excludes.filter(k => !NON_ANON_FIELDS.includes(k));
    }
    let r = await search({ bool: { must } }, { pre: [], after: [] }, 0, {}, 100, { _source: { includes, excludes } }, authed);
    if (r.hits.hits.length <= 0) {
        ctx.res.statusCode = 404;
        return { props: {} }
    }
    const isExterno = process.env.SYNC_ROLE === "externo";
    if (r.hits.hits.length == 1) {
        return { props: { doc: r.hits.hits[0]._source, keys, id: r.hits.hits[0]._id, isExterno } }
    }
    return { props: { doc: r.hits.hits.map(o => o._source), ids: r.hits.hits.map(o => o._id), keys, isExterno } }
})

export default function MaybeDocumentPage(props: { doc?: JurisprudenciaDocument | JurisprudenciaDocument[], keys: JurisprudenciaKey[], id?: string, ids?: string[], isExterno?: boolean }) {
    let Comp;
    if (!props.doc) {
        Comp = <NoDocumentPage />
    }
    else if (Array.isArray(props.doc)) {
        Comp = <MultipleDocumentPage docs={props.doc} ids={props.ids!} />
    }
    else {
        Comp = <DocumentPage doc={props.doc} id={props.id!} keys={props.keys} isExterno={props.isExterno} />
    }


    return <GenericPage keys_to_remove={["stringEcliOrNumber", "EcliOrUUID", "search"]} title="">
        {Comp}
    </GenericPage>
}

function NoDocumentPage() {
    return <>
        <Head>
            <title>Acórdão Não Encontrado (404) - Jurisprudência - STJ</title>
        </Head>
        <div className="container py-4">
            <div className="alert alert-warning shadow-sm" role="alert">
                <h4 className="alert-heading">
                    <i className="bi bi-search me-2"></i>
                    Acórdão não encontrado (404)
                </h4>
                <p className="mb-2">
                    Não foi encontrado nenhum acórdão com os dados de identificação fornecidos neste endereço.
                </p>
                <hr />
                <strong><i className="bi bi-lightbulb me-1"></i>Possíveis causas:</strong>
                <ul className="mb-3 mt-1 small">
                    <li>O número de processo ou ECLI indicado não existe no acervo;</li>
                    <li>O acórdão ainda se encontra em fase de preparação ou importação e não está público (requer início de sessão);</li>
                    <li>O acórdão pode ter sido movido ou o link de acesso está incompleto.</li>
                </ul>
                <div className="d-flex gap-2">
                    <Link href="/pesquisa" className="btn btn-primary btn-sm">
                        <i className="bi bi-search me-1"></i> Ir para a Pesquisa
                    </Link>
                    <Link href="/" className="btn btn-outline-secondary btn-sm">
                        <i className="bi bi-house me-1"></i> Início
                    </Link>
                </div>
            </div>
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

function DocumentPage(props: { doc: JurisprudenciaDocument, id: string, keys: JurisprudenciaKey[], isExterno?: boolean }) {
    let proc = props.doc["Número de Processo"]!;

    return <>
        <Head>
            <title>{`${proc} - Jurisprudência - STJ`}</title>
        </Head>
        <DecisionView {...props} />
    </>
}






