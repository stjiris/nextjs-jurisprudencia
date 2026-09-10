import { useAuth } from "@/contexts/auth";
import { JurisprudenciaKey } from "@/types/keys";
import { isJurisprudenciaDocumentStateKey, JurisprudenciaDocument, JurisprudenciaDocumentKey, JurisprudenciaDocumentStateValue } from "@stjiris/jurisprudencia-document";
import { useFetch } from "../useFetch";
import ManageDecisionOptions from "./ManageDecisionOptions";
import Link from "next/link";
import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeFromState } from "../BadgeFromState";
import { highlightTextInElement, searchQueryToTerm } from "./highlightText";

const MUST_HAVE = ["UUID", "Número de Processo", "Fonte", "ECLI", "URL", "Sumário", "Texto", "STATE"]

export default function DecisionView(props: { doc: JurisprudenciaDocument, id: string, keys: JurisprudenciaKey[], isExterno?: boolean }) {
    let auth = useAuth();
    let proc = props.doc["Número de Processo"]!;
    let uuid = props.doc["UUID"]!;
    let related = useFetch<JurisprudenciaDocument[]>(`/api/related/${encodeURIComponent(proc)}/${uuid}`, []) || []
    const keyName = Object.fromEntries(props.keys.map(k => [k.key, k.name]));
    const hasAnon     = !!(props.doc["Texto"] || props.doc["Sumário"]);
    const hasOriginal = !!(props.doc["Texto Não Anonimizado"] || props.doc["Sumário Não Anonimizado"]);
    const canSwitch   = hasAnon && hasOriginal;
    const showToggle  = !!auth && (hasAnon || hasOriginal);
    let [showOriginal, setShowOriginal] = useState(!hasAnon && hasOriginal);
    let sumario = showOriginal ? (props.doc["Sumário Não Anonimizado"] ?? props.doc.Sumário) : (props.doc.Sumário || props.doc["Sumário Não Anonimizado"]);
    let texto = showOriginal ? (props.doc["Texto Não Anonimizado"] ?? props.doc.Texto) : (props.doc.Texto || props.doc["Texto Não Anonimizado"]);
    const sumarioIsOriginal = showOriginal || !props.doc.Sumário;
    const textoIsOriginal = showOriginal || !props.doc.Texto;

    const searchParams = useSearchParams();
    const searchTerm = searchQueryToTerm(searchParams.get("q"));
    const contentRef = useRef<HTMLDivElement>(null);
    const scrolledRef = useRef(false);
    useEffect(() => {
        const el = contentRef.current;
        if (!el || !searchTerm) return;
        highlightTextInElement(el, searchTerm);
        if (scrolledRef.current) return;
        const firstMark = el.querySelector("mark");
        if (firstMark) {
            scrolledRef.current = true;
            firstMark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [searchTerm, sumario, texto]);

    return <>
        <div className="container">
            <div className="row justify-content-center">
                <div className="col-12 col-md-11 container border border-dark">
                    {auth && <div className="row border-bottom border-2 border-dark pb-1">
                        <div className="col-md-10">
                            <ManageDecisionOptions {...props} />
                        </div>
                    </div>}
                    <div className="row border-bottom">
                        <div className="col-6 d-flex align-items-baseline">
                            <b style={{ minWidth: 175, flexShrink: 0 }}>N.º de Processo:</b>
                            <span>{props.doc["Número de Processo"]}</span>
                        </div>
                        <div className="col-6 text-end">
                            {props.doc.URL && props.doc.URL.length > 0 && props.doc.URL !== "«sem valor»" && <><small><Link className="bi bi-box-arrow-up-right" href={props.doc.URL} target="_blank" >{new URL(props.doc.URL!).host}</Link></small>&nbsp;</>}
                            <small><b>Fonte:&nbsp;</b><span>{props.doc.Fonte}</span></small>
                        </div>
                    </div>
                    <div className="row border-bottom">
                        <div className="col-12">
                            {props.doc.ECLI && props.doc.ECLI.length > 0 && props.doc.ECLI !== "«sem valor»" && <><b>ECLI: </b><small><Link href={`https://jurisprudencia.csm.org.pt/ecli/${props.doc.ECLI!}`} target="_blank" >{props.doc.ECLI}<i className="bi bi-box-arrow-up-right ms-1 align-top"></i></Link></small>&nbsp;</>}
                        </div>
                    </div>

                    <div className="row border-bottom">
                        {related.length > 0 ?
                            <>
                                <div className="col-6"><i className="bi bi-link"></i>Relacionados:</div>
                                <div className="col-6 text-end">
                                    {related.flatMap((d, i) => [" / ", <Link key={i} href={`/${encodeURIComponent(d["Número de Processo"]!)}/${d.UUID}`}>{d["Número de Processo"]}</Link>, ` (${d.Data})`]).slice(1)}
                                </div>
                            </>
                            : <></>}
                    </div>


                    {props.keys.filter(k => k.documentShow && !MUST_HAVE.includes(k.key)).map(k => <DefaultRow key={k.key} doc={props.doc} showkey={k.name} accessKey={k.key} noLink={!k.indicesList} />)}
                </div>
                <div className="row justify-content-center">
                    <div className="col-12 col-md-10 mt-3" id="decision-content" ref={contentRef}>
                        {showToggle && <div className="mb-2">
                            <div
                                style={{ display: "inline-flex", border: "1px solid var(--primary-red)", borderRadius: "4px", fontSize: "0.8rem", userSelect: "none", overflow: "hidden" }}
                            >
                                <span
                                    onClick={() => canSwitch && setShowOriginal(true)}
                                    title={hasOriginal ? "Ver texto original (não anonimizado)" : "Sem versão original"}
                                    style={{ minWidth: "7rem", textAlign: "center", padding: "3px 12px", color: "var(--primary-red)", backgroundColor: showOriginal ? "var(--secondary-gold)" : "transparent", transition: "background-color 0.2s ease", cursor: canSwitch ? "pointer" : "default", opacity: hasOriginal ? 1 : 0.4 }}
                                >Original</span>
                                <span
                                    onClick={() => canSwitch && setShowOriginal(false)}
                                    title={hasAnon ? "Ver texto anonimizado" : "Sem versão anonimizada"}
                                    style={{ minWidth: "7rem", textAlign: "center", padding: "3px 12px", color: "var(--primary-red)", backgroundColor: !showOriginal ? "var(--secondary-gold)" : "transparent", borderLeft: "1px solid var(--primary-red)", transition: "background-color 0.2s ease", cursor: canSwitch ? "pointer" : "default", opacity: hasAnon ? 1 : 0.4 }}
                                >Anonimizado</span>
                            </div>
                        </div>}
                        {sumario && <>
                            <h6 className="border-top border-2"><b>{keyName["Sumário"] || "Sumário"}</b></h6>
                            <div className="p-2" dangerouslySetInnerHTML={{ __html: sumario }}></div>
                        </>}

                        {texto && <>
                            <h6 className="border-top border-2"><b>{keyName["Texto"] || "Texto Integral"}</b></h6>
                            <div className="p-2" dangerouslySetInnerHTML={{ __html: texto }}></div>
                        </>}
                    </div>
                </div>
            </div>
        </div>
    </>
}

function DefaultRow(props: { accessKey: JurisprudenciaDocumentKey, showkey?: string, doc: JurisprudenciaDocument, style?: CSSProperties, noLink?: boolean }) {
    let value = props.doc[props.accessKey];
    if (!value) return <></>

    if (typeof value === "string" && value.length === 0) return <></>
    if (typeof value === "object" && "Show" in value && "Original" in value && value.Show.length === 0 && value.Original.length === 0) return <></>
    return props.doc[props.accessKey] ? <Row style={props.style}>
        <div className="col-12 d-flex">
            <b style={{ minWidth: 175, flexShrink: 0 }}>{props.showkey ? props.showkey : props.accessKey}:</b>
            <span><Properties accessKey={props.accessKey} accessValue={props.doc[props.accessKey]} noLink={props.noLink} /></span>
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
    const [showOrig, setShowOrig] = useState(false);
    const show = props.value.Show ?? [];
    const original = props.value.Original ?? [];

    // nothing normalized to show — just render the raw
    if (show.length === 0) {
        return <>{original.flatMap((v, i) => [" / ", v]).slice(1)}</>
    }

    // offer "ver original" whenever the shown (normalized) value differs from the raw one,
    // e.g. a value that fell back to "Outro" / "Sem informação"
    const differs = original.length > 0 && (show.length !== original.length || show.some((v, i) => v !== original[i]));
    const values = showOrig ? original : show;
    const linkable = !showOrig && !props.noLink;

    return <>
        {values.flatMap((v, i) => [" / ", linkable ? <Link key={i} href={`/pesquisa?${props.accessKey}=${encodeURIComponent(v)}`}>{v}</Link> : v]).slice(1)}
        {differs && <a role="button" onClick={() => setShowOrig(s => !s)} title="Ver o valor original (antes da normalização)" style={{ marginLeft: 8, fontSize: "0.8em", cursor: "pointer", color: "var(--primary-red)" }}>{showOrig ? "(ver normalizado)" : "(ver original)"}</a>}
    </>
}