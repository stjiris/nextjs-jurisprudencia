import { BadgeFromState } from "@/components/BadgeFromState";
import { useKeysFromContext } from "@/contexts/keys";
import { SearchHandlerResponse, SearchHandlerResponseItem } from "@/types/search";
import Link from "next/link";

const MAX_DESCRITORES_LEN = 80;

function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + "…" : text;
}

function showOrOriginal(hit: SearchHandlerResponseItem, key: string): string[] {
    const field = (hit._source as any)?.[key];
    const show = field?.Show;
    if (show && show.length > 0) return show;
    return field?.Original || [];
}

export default function JurisprudenciaTable({ results, searchId }: { results: SearchHandlerResponse; searchId?: string }) {
    const keys = useKeysFromContext().records;
    const searchParam = searchId ? `?search=${searchId}` : "";

    return (
        <div className="table-responsive">
            <table className="table table-hover table-sm align-middle jurisprudencia-table">
                <thead className="table-light">
                    <tr>
                        <th>Processo</th>
                        <th>Data</th>
                        {keys?.["Relator Nome Profissional"]?.active !== false && <th>Relator</th>}
                        {keys?.["Meio Processual"]?.active !== false && <th>Meio Processual</th>}
                        {keys?.Decisão?.active !== false && <th>Decisão</th>}
                        {keys?.Descritores?.active !== false && <th>Descritores</th>}
                        {keys?.STATE?.active && <th>Estado</th>}
                    </tr>
                </thead>
                <tbody>
                    {results.map((hit, i) => (
                        <TableRow key={i} hit={hit} searchParam={searchParam} keys={keys} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TableRow({ hit, searchParam, keys }: { hit: SearchHandlerResponseItem; searchParam: string; keys: any }) {
    const numeroProcesso = hit._source?.["Número de Processo"];
    const data = hit._source?.Data;
    const relator = showOrOriginal(hit, "Relator Nome Profissional").join(" / ");
    const meioProcessual = hit._source?.["Meio Processual"]?.Show?.join(" / ");
    const decisao = showOrOriginal(hit, "Decisão").join(" / ");
    const descritores = showOrOriginal(hit, "Descritores").join(", ");

    const href = hit._source?.ECLI?.startsWith("ECLI:PT:STJ:")
        ? `/ecli/${hit._source.ECLI}${searchParam}`
        : `/${encodeURIComponent(numeroProcesso!)}/${hit._source?.UUID}${searchParam}`;

    return (
        <tr>
            <td>
                <Link href={href} className="text-nowrap">{numeroProcesso}</Link>
            </td>
            <td className="text-nowrap">{data || ""}</td>
            {keys?.["Relator Nome Profissional"]?.active !== false && <td>{relator}</td>}
            {keys?.["Meio Processual"]?.active !== false && <td>{meioProcessual || ""}</td>}
            {keys?.Decisão?.active !== false && <td>{decisao}</td>}
            {keys?.Descritores?.active !== false && (
                <td title={descritores}>{truncate(descritores, MAX_DESCRITORES_LEN)}</td>
            )}
            {keys?.STATE?.active && (
                <td>{hit._source?.STATE ? <BadgeFromState state={hit._source.STATE} /> : ""}</td>
            )}
        </tr>
    );
}
