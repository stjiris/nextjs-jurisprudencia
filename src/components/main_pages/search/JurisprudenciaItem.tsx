import { BadgeFromState } from "@/components/BadgeFromState";
import { useKeysFromContext } from "@/contexts/keys";
import { HighlightFragment, SearchHandlerResponseItem } from "@/types/search";
import { JurisprudenciaDocumentGenericKey, JurisprudenciaDocumentTextKeys } from "@stjiris/jurisprudencia-document";
import Link from "next/link";
import { useState } from "react";

const SUMARY_SIZE = 550

export default function JurisprudenciaItem({ hit, searchId }: { hit: SearchHandlerResponseItem, searchId?: string }) {
    const keys = useKeysFromContext().records;
    const searchParam = searchId ? `?search=${searchId}` : ""
    const numeroProcesso = hit._source?.["Número de Processo"];
    const data = hit._source?.Data;
    const area = hit._source?.Área?.Show;
    const secao = showOrOriginal(hit, "Secção").join(" / ");
    const meioProcessual = hit._source?.["Meio Processual"]?.Show?.join(" / ");
    const relator = showOrOriginal(hit, "Relator Nome Profissional").join(" / ");
    const decisao = showOrOriginal(hit, "Decisão").join(" / ");
    const descritores = showOrOriginal(hit, "Descritores").join(" / ");
    return <article className="row border-top result">
        <div className="col-12 pt-1">
            <div>
                <Link href={hit._source?.ECLI?.startsWith("ECLI:PT:STJ:") ? `/ecli/${hit._source.ECLI}${searchParam}` : `/${encodeURIComponent(numeroProcesso!)}/${hit._source?.UUID}${searchParam}`}>
                    {numeroProcesso}
                </Link>
                {data ? ` - ${data}` : ""}
                {area ? secao ? ` - ${area} - ${secao}` : ` - ${area}` : ""}
                {keys?.STATE.active && hit._source.STATE ? <span className="px-1"><BadgeFromState state={hit._source["STATE"]} /></span> : <></>}
            </div>

            {meioProcessual && <div><b>{keys?.["Meio Processual"].name}:</b> {meioProcessual}</div>}
            {relator && <div><b>{keys?.["Relator Nome Profissional"].name}:</b> {relator}</div>}
            {decisao && <div><b>{keys?.Decisão.name}:</b> {decisao}</div>}
            {descritores && <div><b>{keys?.Descritores.name}:</b> {descritores}</div>}

        </div>

        {hit._source?.Sumário && !hit.highlight?.Sumário ? (
            <SumarioPreview sumario={hit._source.Sumário} sumarioName={keys?.Sumário.name} />
        ) : ""}

        {hit._source?.Sumário && hit.highlight?.Sumário ? <details className="col-12">
            <summary className="d-flex align-items-center list-unstyled">
                <span style={{ width: "10%", flexShrink: 1 }}>
                    <i className="bi bi-caret-downright-fill"></i>
                    <b className="mouse-click">{keys?.Sumário.name}:</b>
                </span>
                <div className="highlight">

                    <div className="highlight-bar" data-key="Sumário">
                        {(hit.highlight.Sumário as HighlightFragment[]).map((marker, i) => <div key={i} className="highlight-bar-hit-parent">
                            <div className="highlight-bar-hit" data-offset={marker.offset} data-per={marker.offset / marker.size} style={{ left: `${marker.offset / marker.size * 100}%`, background: "green" }}></div>
                            <div className="highlight-bar-hit-content d-none" dangerouslySetInnerHTML={{ __html: marker.textFragment }}></div>
                        </div>)}
                    </div>
                </div>
            </summary>
            <div className="col-12 p-2 border pesquisa-sumario" dangerouslySetInnerHTML={{ __html: hit.highlight?.Sumário ? hit.highlight?.Sumário : hit._source.Sumário }} />

        </details> : ""}

        {hit.highlight?.Texto ? <details className="col-12 d-print-none">
            <summary className="d-flex align-items-center list-unstyled">
                <span style={{ width: "10%", flexShrink: 1 }}>
                    <i className="bi bi-caret-downright-fill"></i>
                    <b className="mouse-click">{keys?.Texto.name}</b>
                </span>
                <div className="highlight">
                    <div className="highlight-bar" data-key="Texto">
                        {(hit.highlight.Texto as HighlightFragment[]).map((marker, i) => <div key={i} className="highlight-bar-hit-parent">
                            <div className="highlight-bar-hit" data-offset={marker.offset} data-per={marker.offset / marker.size} style={{ left: `${marker.offset / marker.size * 100}%`, background: "green" }}></div>
                            <div className="highlight-bar-hit-content d-none" dangerouslySetInnerHTML={{ __html: marker.textFragment }}></div>
                        </div>)}
                    </div>
                </div>
            </summary>
            <div className="col-12 p-2 border d-flex flex-wrap">
                {(hit.highlight.Texto as HighlightFragment[]).flatMap((frag, i) => [<div key={i} className="pesquisa-sep"></div>, <div key={i} dangerouslySetInnerHTML={{ __html: frag.textFragment }}></div>])}
            </div>
        </details> : ""}
    </article>
}

function SumarioPreview({ sumario, sumarioName }: { sumario: string; sumarioName?: string }) {
    const cleanText = sumario.replace(/<[^>]*>/g, '');
    const isTruncated = cleanText.length > SUMARY_SIZE;
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="col-12 col-lg-8 rounded" style={{ backgroundColor: "var(--secondary-gold)", whiteSpace: "pre-line" }}>
            <b>{sumarioName}:</b>{' '}
            {expanded ? cleanText : cleanText.substring(0, SUMARY_SIZE)}
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