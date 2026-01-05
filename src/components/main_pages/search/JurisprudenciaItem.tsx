import { useKeysFromContext } from "@/contexts/keys";
import { HighlightFragment, SearchHandlerResponseItem } from "@/types/search";
import { JurisprudenciaDocumentGenericKey } from "@stjiris/jurisprudencia-document";
import Link from "next/link";

const SUMARY_SIZE = 450

export default function JurisprudenciaItem({hit, searchId}:{hit: SearchHandlerResponseItem, searchId?: string}){
    const keys = useKeysFromContext().records;
    const searchParam = searchId ? `?search=${searchId}` : ""
    const numeroProcesso = hit._source?.["Número de Processo"];
    const data = hit._source?.Data;
    const area = hit._source?.Área?.Show;
    const secao = showOrOriginal(hit, "Secção").join(" / ");
    const meioProcessual = hit._source?.["Meio Processual"]?.Show?.join(" / ");
    const relator = showOrOriginal(hit, "Relator Nome Profissional").join(" / ");
    const decisao = showOrOriginal(hit, "Decisão").join(" / ");
    return <article className="row border-top result">
        <div className="col-12 pt-1">
            <div>
                <Link href={hit._source?.ECLI?.startsWith("ECLI:PT:STJ:") ? `/ecli/${hit._source.ECLI}${searchParam}` : `/${encodeURIComponent(numeroProcesso!)}/${hit._source?.UUID}${searchParam}`}>
                    {numeroProcesso}
                </Link>
                {data ? ` - ${data}` : ""}
                {area ? secao ? ` - ${area} - ${secao}` :  ` - ${area}` : ""}
            </div>

            {meioProcessual && <div><b>{keys?.["Meio Processual"].name}:</b> {meioProcessual}</div>}
            {relator && <div><b>{keys?.["Relator Nome Profissional"].name}:</b> {relator}</div>}
            {decisao && <div><b>{keys?.Decisão.name}:</b> {decisao}</div>}
        </div>
        {hit._source?.Sumário && !hit.highlight?.Sumário ? (
            <div className="col-12 col-lg-8">
                <b>{keys?.Sumário.name}:</b>{' '}
                {(() => {
                    const summary = hit.highlight?.Sumário || hit._source.Sumário;
                    const text = typeof summary === 'string' ? summary : summary.join(' ');
                    const cleanText = text.replace(/<[^>]*>/g, '');
                    const isTruncated = cleanText.length > SUMARY_SIZE;
                    return (
                        <>
                            {cleanText.substring(0, SUMARY_SIZE)}
                            {isTruncated && (
                                <>
                                    ...{' '}
                                    <Link href={hit._source?.ECLI?.startsWith("ECLI:PT:STJ:") ? `/ecli/${hit._source.ECLI}${searchParam}` : `/${encodeURIComponent(numeroProcesso!)}/${hit._source?.UUID}${searchParam}`}>
                                        mais...
                                    </Link>
                                </>
                            )}
                        </>
                    );
                })()}
            </div>
        ) : ""}
        {hit._source?.Sumário && hit.highlight?.Sumário ? <details className="col-12">
            <summary className="d-flex align-items-center list-unstyled">
                <span style={{width: "10%", flexShrink: 1}}>
                    <i className="bi bi-caret-downright-fill"></i>
                    <b className="mouse-click">{keys?.Sumário.name}:</b>
                </span>
                {hit.highlight?.["SumárioMarks"] ? <div className="highlight">
                    <div className="highlight-bar" data-key="Sumário">
                        {(hit.highlight.SumárioMarks as HighlightFragment[]).map((marker,i) => <div key={i} className="highlight-bar-hit-parent">
                            <div className="highlight-bar-hit" data-offset={marker.offset} data-per={marker.offset/marker.size} style={{left: `${marker.offset/marker.size*100}%`, background: "green"}}></div>
                            <div className="highlight-bar-hit-content d-none" dangerouslySetInnerHTML={{__html: marker.textFragment}}></div>
                        </div>)}
                    </div>
                </div>:""}
            </summary>
            <div className="col-12 p-2 border pesquisa-sumario" dangerouslySetInnerHTML={{__html: hit.highlight?.Sumário ? hit.highlight?.Sumário : hit._source.Sumário}} />
        </details>:""}
        {hit.highlight?.Texto ? <details className="col-12 d-print-none">
            <summary className="d-flex align-items-center list-unstyled">
                <span style={{width: "10%", flexShrink: 1}}>
                    <i className="bi bi-caret-downright-fill"></i>
                    <b className="mouse-click">{keys?.Texto.name}</b>
                </span>
                <div className="highlight">
                    <div className="highlight-bar" data-key="Texto">
                        {(hit.highlight.Texto as HighlightFragment[]).map((marker, i) => <div key={i} className="highlight-bar-hit-parent">
                            <div className="highlight-bar-hit" data-offset={marker.offset} data-per={marker.offset/marker.size} style={{left: `${marker.offset/marker.size*100}%`, background: "green"}}></div>
                            <div className="highlight-bar-hit-content d-none" dangerouslySetInnerHTML={{__html: marker.textFragment}}></div>
                        </div>)}
                    </div>
                </div>
            </summary>
            <div className="col-12 p-2 border d-flex flex-wrap">
                {(hit.highlight.Texto as HighlightFragment[]).flatMap((frag,i) => [<div key={i} className="pesquisa-sep"></div>,<div key={i} dangerouslySetInnerHTML={{__html: frag.textFragment}}></div>])}
            </div>
        </details> : ""}
    </article>
}

function showOrOriginal(hit: SearchHandlerResponseItem, key: JurisprudenciaDocumentGenericKey){
    let show = hit._source![key]?.Show;
    if( show && show.length > 0 ) return show;
    let original = hit._source![key]?.Original;
    return original || [];
}