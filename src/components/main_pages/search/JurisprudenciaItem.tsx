import { BadgeFromState } from "@/components/BadgeFromState";
import { useKeysFromContext } from "@/contexts/keys";
import { HighlightFragment, SearchHandlerResponseItem } from "@/types/search";
import { JurisprudenciaDocumentGenericKey, JurisprudenciaDocumentTextKeys } from "@stjiris/jurisprudencia-document";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const TEXTO_PREVIEW_SIZE = 350

function stripHtml(html: string) {
    return html.replace(/<[^>]*>/g, '');
}

function HighlightBar({ dataKey, fragments }: { dataKey: string, fragments?: HighlightFragment[] }) {
    return <div className="highlight">
        <div className="highlight-bar" data-key={dataKey}>
            {fragments ? fragments.map((marker, i) => <div key={i} className="highlight-bar-hit-parent">
                <div className="highlight-bar-hit" data-offset={marker.offset} data-per={marker.offset / marker.size} style={{ left: `${marker.offset / marker.size * 100}%`, background: "green" }}></div>
                <div className="highlight-bar-hit-content d-none" dangerouslySetInnerHTML={{ __html: marker.textFragment }}></div>
            </div>) : null}
        </div>
    </div>
}

function TruncatedPlainText({ text, size }: { text: string, size: number }) {
    return <div className="col-12 p-2" style={{ whiteSpace: "pre-line" }}>
        {text.substring(0, size)}{text.length > size ? '...' : ''}
    </div>
}

export default function JurisprudenciaItem({ hit, searchId, hasQuery, searchQuery }: {
    hit: SearchHandlerResponseItem,
    searchId?: string,
    hasQuery?: boolean,
    searchQuery?: string
}) {
    const keys = useKeysFromContext().records;
    const qParam = searchQuery ? `q=${encodeURIComponent(searchQuery)}` : "";
    const searchParam = searchId
        ? `?search=${searchId}${qParam ? `&${qParam}` : ""}`
        : qParam ? `?${qParam}` : "";
    const numeroProcesso = hit._source?.["Número de Processo"];
    const data = hit._source?.Data;
    const area = hit._source?.Área?.Show;
    const secao = showOrOriginal(hit, "Secção").join(" / ");
    const meioProcessual = hit._source?.["Meio Processual"]?.Show?.join(" / ");
    const relator = showOrOriginal(hit, "Relator Nome Profissional").join(" / ");
    const decisao = showOrOriginal(hit, "Decisão").join(" / ");
    const descritores = showOrOriginal(hit, "Descritores").join(" / ");
    return <article className="row result">
        <div className="col-12">
            <div className="result-title">
                <Link href={hit._source?.ECLI?.startsWith("ECLI:PT:STJ:") ? `/ecli/${hit._source.ECLI}${searchParam}` : `/${encodeURIComponent(numeroProcesso!)}/${hit._source?.UUID}${searchParam}`}>
                    {numeroProcesso}
                </Link>
                <span className="result-title-meta">
                    {data ? ` - ${data}` : ""}
                    {area ? secao ? ` - ${area} - ${secao}` : ` - ${area}` : ""}
                </span>
                {keys?.STATE.active && hit._source.STATE ? <span className="px-1"><BadgeFromState state={hit._source["STATE"]} /></span> : <></>}
            </div>
        </div>

        <div className="col-12 col-lg-8 result-meta">
            {meioProcessual && <div><b>{keys?.["Meio Processual"].name}:</b> {meioProcessual}</div>}
            {relator && <div><b>{keys?.["Relator Nome Profissional"].name}:</b> {relator}</div>}
            {decisao && <div><b>{keys?.Decisão.name}:</b> {decisao}</div>}
            {descritores && <div><b>{keys?.Descritores.name}:</b> {descritores}</div>}
        </div>

        {hit._source?.Sumário
            ? <SumarioPreview sumario={hit._source.Sumário} sumarioName={keys?.Sumário.name} />
            : null}

        {hasQuery && (hit.highlight?.Texto || hit.textoPreview) ? <details className="col-12 d-print-none">
            <summary className="d-flex align-items-center list-unstyled">
                <span style={{ width: "10%", flexShrink: 1 }}>
                    <i className="bi bi-caret-downright-fill"></i>
                    <b className="mouse-click">{keys?.Texto.name}</b>
                </span>
                <HighlightBar dataKey="Texto" fragments={hit.highlight?.Texto as HighlightFragment[] | undefined} />
            </summary>
            {hit.highlight?.Texto
                ? <div className="col-12 p-2 border d-flex flex-wrap">
                    {(hit.highlight.Texto as HighlightFragment[]).flatMap((frag, i) => [<div key={`sep-${i}`} className="pesquisa-sep"></div>, <div key={i} dangerouslySetInnerHTML={{ __html: frag.textFragment }}></div>])}
                </div>
                : <TruncatedPlainText text={hit.textoPreview || ""} size={TEXTO_PREVIEW_SIZE} />}
        </details> : (
            hit.textoPreview
                ? <TextoPreview texto={hit.textoPreview} textoName={keys?.Texto.name} />
                : null
        )}
    </article>
}

function SumarioPreview({ sumario, sumarioName }: { sumario: string; sumarioName?: string }) {
    const cleanText = stripHtml(sumario).trim();
    const [expanded, setExpanded] = useState(false);
    const [isClamped, setIsClamped] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);

    // The text is clamped by CSS to 3 lines; only offer the toggle when something is actually hidden.
    useEffect(() => {
        const el = textRef.current;
        if (!el) return;
        const check = () => setIsClamped(el.scrollHeight > el.clientHeight + 1);
        check();
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
        ro?.observe(el);
        return () => ro?.disconnect();
    }, [cleanText]);

    return (
        <div className="col-12 col-lg-8 result-sumario">
            <div ref={textRef} className={`result-sumario-text${expanded ? " expanded" : ""}`}>
                <b>{sumarioName}:</b>{' '}{cleanText}
            </div>
            {(isClamped || expanded) && (
                <button
                    type="button"
                    className="btn btn-link p-0 align-baseline result-sumario-toggle"
                    onClick={() => setExpanded(e => !e)}
                >
                    {expanded ? "Mostrar menos" : "Mostrar mais"}
                    <i className={`bi ms-1 ${expanded ? 'bi-caret-up-fill' : 'bi-caret-down-fill'}`} />
                </button>
            )}
        </div>
    );
}

function TextoPreview({ texto, textoName }: { texto: string; textoName?: string }) {
    const cleanText = texto;
    const isTruncated = cleanText.length > TEXTO_PREVIEW_SIZE;
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="col-12 col-lg-8" style={{ whiteSpace: "pre-line" }}>
            <b>{textoName}:</b>{' '}
            {expanded ? cleanText : cleanText.substring(0, TEXTO_PREVIEW_SIZE)}
            {!expanded && isTruncated && '...'}
            {isTruncated && (
                <button
                    type="button"
                    className="btn btn-link p-0 ms-1 align-baseline"
                    style={{ color: 'inherit', lineHeight: 1 }}
                    onClick={() => setExpanded(e => !e)}
                >
                    <i className={`bi ${expanded ? 'bi-caret-up-fill' : 'bi-caret-down-fill'}`} />
                </button>
            )}
        </div>
    );
}

function showOrOriginal(hit: SearchHandlerResponseItem, key: JurisprudenciaDocumentGenericKey) {
    let show = hit._source![key]?.Show;
    if (show && show.length > 0) return show;
    let original = hit._source![key]?.Original;
    return original || [];
}