import { BadgeFromState } from "@/components/BadgeFromState";
import { useKeysFromContext } from "@/contexts/keys";
import { SearchHandlerResponse, SearchHandlerResponseItem } from "@/types/search";
import Link from "next/link";
import { useState, useMemo } from "react";

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

function parsePtDate(dateStr?: string): number {
    if (!dateStr) return 0;
    const parts = dateStr.trim().split(/[\/\-]/);
    if (parts.length === 3) {
        if (parts[2].length === 4) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            return new Date(y, m, d).getTime();
        }
        if (parts[0].length === 4) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            return new Date(y, m, d).getTime();
        }
    }
    const t = Date.parse(dateStr);
    return isNaN(t) ? 0 : t;
}

type SortColumn = "processo" | "data" | "relator" | "meio" | "decisao" | "descritores" | "estado";
type SortDirection = "asc" | "desc";

type RowData = {
    hit: SearchHandlerResponseItem;
    numeroProcesso: string;
    data: string;
    relator: string;
    meioProcessual: string;
    decisao: string;
    descritores: string;
    estado: string;
    href: string;
    ecli: string;
};

export default function JurisprudenciaTable({ results, searchId }: { results: SearchHandlerResponse; searchId?: string }) {
    const keys = useKeysFromContext().records;
    const searchParam = searchId ? `?search=${searchId}` : "";

    // Spreadsheet state: Sorting, Column Filters & Visibility
    const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [showFilters, setShowFilters] = useState(true);
    const [filters, setFilters] = useState<Record<string, string>>({
        processo: "",
        data: "",
        relator: "",
        meio: "",
        decisao: "",
        descritores: "",
        estado: "",
    });

    const rows: RowData[] = useMemo(() => {
        return results.map(hit => {
            const numeroProcesso = hit._source?.["Número de Processo"] || "";
            const data = hit._source?.Data || "";
            const relator = showOrOriginal(hit, "Relator Nome Profissional").join(" / ");
            const meioProcessual = hit._source?.["Meio Processual"]?.Show?.join(" / ") || "";
            const decisao = showOrOriginal(hit, "Decisão").join(" / ");
            const descritores = showOrOriginal(hit, "Descritores").join(", ");
            const estado = hit._source?.STATE || "";
            const ecli = hit._source?.ECLI || "";

            const href = ecli?.startsWith("ECLI:PT:STJ:")
                ? `/ecli/${ecli}${searchParam}`
                : `/${encodeURIComponent(numeroProcesso)}/${hit._source?.UUID}${searchParam}`;

            return {
                hit,
                numeroProcesso,
                data,
                relator,
                meioProcessual,
                decisao,
                descritores,
                estado,
                href,
                ecli,
            };
        });
    }, [results, searchParam]);

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            if (sortDirection === "asc") {
                setSortDirection("desc");
            } else {
                setSortColumn(null);
                setSortDirection("asc");
            }
        } else {
            setSortColumn(column);
            setSortDirection("asc");
        }
    };

    const handleFilterChange = (col: string, val: string) => {
        setFilters(prev => ({ ...prev, [col]: val }));
    };

    const clearAllFilters = () => {
        setFilters({
            processo: "",
            data: "",
            relator: "",
            meio: "",
            decisao: "",
            descritores: "",
            estado: "",
        });
    };

    const isFiltered = Object.values(filters).some(v => v.trim().length > 0);

    // Apply column filtering
    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (filters.processo && !r.numeroProcesso.toLowerCase().includes(filters.processo.toLowerCase())) return false;
            if (filters.data && !r.data.toLowerCase().includes(filters.data.toLowerCase())) return false;
            if (filters.relator && !r.relator.toLowerCase().includes(filters.relator.toLowerCase())) return false;
            if (filters.meio && !r.meioProcessual.toLowerCase().includes(filters.meio.toLowerCase())) return false;
            if (filters.decisao && !r.decisao.toLowerCase().includes(filters.decisao.toLowerCase())) return false;
            if (filters.descritores && !r.descritores.toLowerCase().includes(filters.descritores.toLowerCase())) return false;
            if (filters.estado && r.estado !== filters.estado) return false;
            return true;
        });
    }, [rows, filters]);

    // Apply column sorting
    const sortedRows = useMemo(() => {
        if (!sortColumn) return filteredRows;

        return [...filteredRows].sort((a, b) => {
            let res = 0;
            if (sortColumn === "data") {
                res = parsePtDate(a.data) - parsePtDate(b.data);
            } else if (sortColumn === "processo") {
                res = a.numeroProcesso.localeCompare(b.numeroProcesso, "pt", { numeric: true, sensitivity: "base" });
            } else if (sortColumn === "relator") {
                res = a.relator.localeCompare(b.relator, "pt", { sensitivity: "base" });
            } else if (sortColumn === "meio") {
                res = a.meioProcessual.localeCompare(b.meioProcessual, "pt", { sensitivity: "base" });
            } else if (sortColumn === "decisao") {
                res = a.decisao.localeCompare(b.decisao, "pt", { sensitivity: "base" });
            } else if (sortColumn === "descritores") {
                res = a.descritores.localeCompare(b.descritores, "pt", { sensitivity: "base" });
            } else if (sortColumn === "estado") {
                res = a.estado.localeCompare(b.estado, "pt", { sensitivity: "base" });
            }
            return sortDirection === "asc" ? res : -res;
        });
    }, [filteredRows, sortColumn, sortDirection]);

    const exportToCsv = () => {
        const headers = ["#", "Processo", "Data", "Relator", "Meio Processual", "Decisão", "Descritores", "Estado", "ECLI"];
        const csvLines = [headers.join(";")];
        for (let i = 0; i < sortedRows.length; i++) {
            const r = sortedRows[i];
            const line = [
                i + 1,
                `"${r.numeroProcesso.replace(/"/g, '""')}"`,
                `"${r.data.replace(/"/g, '""')}"`,
                `"${r.relator.replace(/"/g, '""')}"`,
                `"${r.meioProcessual.replace(/"/g, '""')}"`,
                `"${r.decisao.replace(/"/g, '""')}"`,
                `"${r.descritores.replace(/"/g, '""')}"`,
                `"${r.estado.replace(/"/g, '""')}"`,
                `"${r.ecli.replace(/"/g, '""')}"`,
            ];
            csvLines.push(line.join(";"));
        }
        const blob = new Blob(["\uFEFF" + csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `jurisprudencia_admin_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const renderSortIcon = (col: SortColumn) => {
        if (sortColumn !== col) {
            return <i className="bi bi-arrow-down-up opacity-25 ms-1" style={{ fontSize: "0.75rem" }}></i>;
        }
        return sortDirection === "asc" ? (
            <i className="bi bi-sort-down ms-1 text-primary fw-bold"></i>
        ) : (
            <i className="bi bi-sort-up ms-1 text-primary fw-bold"></i>
        );
    };

    return (
        <div className="mb-3">
            {/* Spreadsheet Toolbar */}
            <div className="d-flex flex-wrap align-items-center justify-content-between p-2 mb-2 bg-light border rounded">
                <div className="d-flex align-items-center gap-2">
                    <span className="small text-muted fw-semibold">
                        <i className="bi bi-table me-1"></i>
                        Folha de Acórdãos:
                    </span>
                    <span className="badge bg-white text-dark border">
                        {sortedRows.length} de {results.length} acórdão(s)
                    </span>
                    {isFiltered && (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2 d-inline-flex align-items-center gap-1"
                            onClick={clearAllFilters}
                            style={{ height: "24px", fontSize: "0.78rem" }}
                            title="Limpar todos os filtros por coluna"
                        >
                            <i className="bi bi-x-circle"></i> Limpar Filtros
                        </button>
                    )}
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        className={`btn btn-sm py-0 px-2 d-inline-flex align-items-center gap-1 ${showFilters ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setShowFilters(!showFilters)}
                        style={{ height: "24px", fontSize: "0.78rem" }}
                        title="Alternar filtros rápidos por coluna"
                    >
                        <i className="bi bi-funnel"></i>
                        <span>{showFilters ? "Ocultar Filtros" : "Filtrar por Coluna"}</span>
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-success py-0 px-2 d-inline-flex align-items-center gap-1"
                        onClick={exportToCsv}
                        style={{ height: "24px", fontSize: "0.78rem" }}
                        title="Descarregar tabela em formato Excel / CSV"
                    >
                        <i className="bi bi-file-earmark-excel"></i>
                        <span>Exportar (.csv)</span>
                    </button>
                </div>
            </div>

            {/* Excel-like Table */}
            <div className="table-responsive border rounded shadow-sm">
                <table className="table table-bordered table-hover table-sm align-middle mb-0 jurisprudencia-table" style={{ fontSize: "0.85rem" }}>
                    <thead className="table-light text-nowrap">
                        <tr>
                            <th
                                style={{ width: "48px", minWidth: "44px" }}
                                className="text-center bg-light text-muted user-select-none py-2"
                                title="Número da Linha (Metadado de Posição)"
                            >
                                #
                            </th>
                            <th
                                className="user-select-none py-2"
                                style={{ cursor: "pointer", width: "16%" }}
                                onClick={() => handleSort("processo")}
                                title="Ordenar por Processo"
                            >
                                Processo {renderSortIcon("processo")}
                            </th>
                            <th
                                className="user-select-none py-2"
                                style={{ cursor: "pointer", width: "10%" }}
                                onClick={() => handleSort("data")}
                                title="Ordenar por Data"
                            >
                                Data {renderSortIcon("data")}
                            </th>
                            {keys?.["Relator Nome Profissional"]?.active !== false && (
                                <th
                                    className="user-select-none py-2"
                                    style={{ cursor: "pointer", width: "16%" }}
                                    onClick={() => handleSort("relator")}
                                    title="Ordenar por Relator"
                                >
                                    Relator {renderSortIcon("relator")}
                                </th>
                            )}
                            {keys?.["Meio Processual"]?.active !== false && (
                                <th
                                    className="user-select-none py-2"
                                    style={{ cursor: "pointer", width: "14%" }}
                                    onClick={() => handleSort("meio")}
                                    title="Ordenar por Meio Processual"
                                >
                                    Meio Processual {renderSortIcon("meio")}
                                </th>
                            )}
                            {keys?.Decisão?.active !== false && (
                                <th
                                    className="user-select-none py-2"
                                    style={{ cursor: "pointer", width: "16%" }}
                                    onClick={() => handleSort("decisao")}
                                    title="Ordenar por Decisão"
                                >
                                    Decisão {renderSortIcon("decisao")}
                                </th>
                            )}
                            {keys?.Descritores?.active !== false && (
                                <th
                                    className="user-select-none py-2"
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleSort("descritores")}
                                    title="Ordenar por Descritores"
                                >
                                    Descritores {renderSortIcon("descritores")}
                                </th>
                            )}
                            {keys?.STATE?.active && (
                                <th
                                    className="user-select-none py-2 text-center"
                                    style={{ cursor: "pointer", width: "100px" }}
                                    onClick={() => handleSort("estado")}
                                    title="Ordenar por Estado"
                                >
                                    Estado {renderSortIcon("estado")}
                                </th>
                            )}
                        </tr>

                        {/* Excel Filter Inputs Row */}
                        {showFilters && (
                            <tr className="bg-light border-bottom">
                                <th className="p-1 text-center text-muted" style={{ fontSize: "0.75rem" }} title="Linha de Filtros das Colunas">
                                    <i className="bi bi-funnel"></i>
                                </th>
                                <th className="p-1">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm py-0 px-1"
                                        style={{ fontSize: "0.78rem", height: "24px" }}
                                        placeholder="Filtrar proc..."
                                        value={filters.processo}
                                        onChange={(e) => handleFilterChange("processo", e.target.value)}
                                    />
                                </th>
                                <th className="p-1">
                                    <input
                                        type="text"
                                        className="form-control form-control-sm py-0 px-1"
                                        style={{ fontSize: "0.78rem", height: "24px" }}
                                        placeholder="Filtrar data..."
                                        value={filters.data}
                                        onChange={(e) => handleFilterChange("data", e.target.value)}
                                    />
                                </th>
                                {keys?.["Relator Nome Profissional"]?.active !== false && (
                                    <th className="p-1">
                                        <input
                                            type="text"
                                            className="form-control form-control-sm py-0 px-1"
                                            style={{ fontSize: "0.78rem", height: "24px" }}
                                            placeholder="Filtrar relator..."
                                            value={filters.relator}
                                            onChange={(e) => handleFilterChange("relator", e.target.value)}
                                        />
                                    </th>
                                )}
                                {keys?.["Meio Processual"]?.active !== false && (
                                    <th className="p-1">
                                        <input
                                            type="text"
                                            className="form-control form-control-sm py-0 px-1"
                                            style={{ fontSize: "0.78rem", height: "24px" }}
                                            placeholder="Filtrar meio..."
                                            value={filters.meio}
                                            onChange={(e) => handleFilterChange("meio", e.target.value)}
                                        />
                                    </th>
                                )}
                                {keys?.Decisão?.active !== false && (
                                    <th className="p-1">
                                        <input
                                            type="text"
                                            className="form-control form-control-sm py-0 px-1"
                                            style={{ fontSize: "0.78rem", height: "24px" }}
                                            placeholder="Filtrar decisão..."
                                            value={filters.decisao}
                                            onChange={(e) => handleFilterChange("decisao", e.target.value)}
                                        />
                                    </th>
                                )}
                                {keys?.Descritores?.active !== false && (
                                    <th className="p-1">
                                        <input
                                            type="text"
                                            className="form-control form-control-sm py-0 px-1"
                                            style={{ fontSize: "0.78rem", height: "24px" }}
                                            placeholder="Filtrar descritor..."
                                            value={filters.descritores}
                                            onChange={(e) => handleFilterChange("descritores", e.target.value)}
                                        />
                                    </th>
                                )}
                                {keys?.STATE?.active && (
                                    <th className="p-1">
                                        <select
                                            className="form-select form-select-sm py-0 px-1"
                                            style={{ fontSize: "0.78rem", height: "24px" }}
                                            value={filters.estado}
                                            onChange={(e) => handleFilterChange("estado", e.target.value)}
                                        >
                                            <option value="">Todos</option>
                                            <option value="público">público</option>
                                            <option value="preparação">preparação</option>
                                            <option value="importação">importação</option>
                                            <option value="privado">privado</option>
                                            <option value="eliminado">eliminado</option>
                                        </select>
                                    </th>
                                )}
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {sortedRows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-4 text-muted">
                                    <i className="bi bi-funnel text-muted fs-4 d-block mb-1"></i>
                                    Nenhum acórdão corresponde aos filtros aplicados na tabela.
                                    {isFiltered && (
                                        <div className="mt-2">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={clearAllFilters}
                                            >
                                                Limpar Filtros das Colunas
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            sortedRows.map((row, i) => (
                                <TableRow key={row.hit._source?.UUID || i} row={row} keys={keys} index={i + 1} />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function TableRow({ row, keys, index }: { row: RowData; keys: any; index: number }) {
    return (
        <tr>
            <td className="text-center text-muted bg-light border-end fw-semibold user-select-none" style={{ width: "48px", fontSize: "0.82rem" }}>
                {index}
            </td>
            <td className="fw-semibold">
                <Link href={row.href} className="text-decoration-none text-nowrap">
                    {row.numeroProcesso}
                </Link>
            </td>
            <td className="text-nowrap text-muted">{row.data}</td>
            {keys?.["Relator Nome Profissional"]?.active !== false && <td>{row.relator}</td>}
            {keys?.["Meio Processual"]?.active !== false && <td>{row.meioProcessual}</td>}
            {keys?.Decisão?.active !== false && <td>{row.decisao}</td>}
            {keys?.Descritores?.active !== false && (
                <td title={row.descritores}>{truncate(row.descritores, MAX_DESCRITORES_LEN)}</td>
            )}
            {keys?.STATE?.active && (
                <td className="text-center">{row.estado ? <BadgeFromState state={row.estado as any} /> : ""}</td>
            )}
        </tr>
    );
}
