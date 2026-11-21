'use client';

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    SearchSessionSave,
    getSavedSessions,
    saveSession,
    deleteSavedSession,
    updateSessionName,
    exportSavesToJsonFile,
    importSavesFromJsonString,
    parseSearchParamsToRecord,
    buildParamsSummary
} from "@/core/session-saves";

interface SavedSessionsModalProps {
    id?: string;
    onSessionLoaded?: () => void;
}

export default function SavedSessionsModal({ id = "modal-saved-sessions", onSessionLoaded }: SavedSessionsModalProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [mounted, setMounted] = useState(false);
    const [saves, setSaves] = useState<SearchSessionSave[]>([]);
    const [selectedSaveIds, setSelectedSaveIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "danger" | "info" } | null>(null);
    const [editingNames, setEditingNames] = useState<Record<string, string>>({});
    
    // Active search suggestion state
    const [currentSearchSuggestion, setCurrentSearchSuggestion] = useState<{
        hasActive: boolean;
        cleanQs: string;
        currentPath: string;
        params: Record<string, string[]>;
        summary: SearchSessionSave["summary"];
        isAlreadySaved: boolean;
    } | null>(null);
    const [suggestionName, setSuggestionName] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const toggleSelectSave = (saveId: string) => {
        setSelectedSaveIds(prev =>
            prev.includes(saveId) ? prev.filter(x => x !== saveId) : [...prev, saveId]
        );
    };

    const handleSelectAll = () => {
        if (selectedSaveIds.length === saves.length) {
            setSelectedSaveIds([]);
        } else {
            setSelectedSaveIds(saves.map(s => s.id));
        }
    };

    const handleGenerateCompositeBoletim = (targetFormat: "html" | "docx" = "html") => {
        const selected = saves.filter(s => selectedSaveIds.includes(s.id));
        if (selected.length === 0) return;
        const payload = selected.map(s => ({
            id: s.id,
            name: s.name,
            qs: s.queryString
        }));
        const url = `/api/boletim/pesquisa/composto?format=${targetFormat}&sessions=${encodeURIComponent(JSON.stringify(payload))}`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    const checkActiveSearch = (currentSaves: SearchSessionSave[]) => {
        if (typeof window === "undefined") return;
        const currentSp = window.location.search || "";
        const currentPath = window.location.pathname || "/pesquisa";
        const cleanQs = currentSp.replace(/^\?+/, "");
        const params = parseSearchParamsToRecord(cleanQs);
        const summary = buildParamsSummary(params);

        // Consider active if query text, date range, or any criteria filter is active
        const hasActive = Boolean(
            summary.queryText ||
            (summary.filterCount && summary.filterCount > 0) ||
            summary.dateRange ||
            Object.keys(params).some(k => !["page", "rpp", "sort"].includes(k))
        );

        const isAlreadySaved = currentSaves.some(
            s => (s.queryString || "").replace(/^\?+/, "") === cleanQs
        );

        setCurrentSearchSuggestion({
            hasActive,
            cleanQs,
            currentPath,
            params,
            summary,
            isAlreadySaved
        });

        if (hasActive && !isAlreadySaved) {
            const defaultName = summary.queryText
                ? `Pesquisa: "${summary.queryText}"`
                : (summary.filterCount > 0)
                    ? `Pesquisa (${summary.filterCount} filtro${summary.filterCount > 1 ? "s" : ""})`
                    : `Pesquisa de Acórdãos`;
            setSuggestionName(defaultName);
        }
    };

    const refreshData = () => {
        const list = getSavedSessions();
        setSaves(list);
        checkActiveSearch(list);
    };

    useEffect(() => {
        setMounted(true);
        refreshData();

        const modalEl = document.getElementById(id);
        if (modalEl) {
            const handleShow = () => {
                refreshData();
                setFeedbackMsg(null);
            };
            modalEl.addEventListener("show.bs.modal", handleShow);
            return () => modalEl.removeEventListener("show.bs.modal", handleShow);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleSaveSuggestion = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!currentSearchSuggestion || !currentSearchSuggestion.hasActive) return;

        setIsSaving(true);
        try {
            const newSave = await saveSession(
                suggestionName,
                currentSearchSuggestion.cleanQs,
                currentSearchSuggestion.currentPath
            );
            setFeedbackMsg({ text: `Pesquisa "${newSave.name}" guardada com sucesso!`, type: "success" });
            const list = getSavedSessions();
            setSaves(list);
            checkActiveSearch(list);
        } catch (err) {
            console.error(err);
            setFeedbackMsg({ text: "Erro ao guardar pesquisa.", type: "danger" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleNameChange = (id: string, newName: string) => {
        setEditingNames(prev => ({ ...prev, [id]: newName }));
    };

    const handleNameBlur = (id: string, currentOriginal: string) => {
        const draft = editingNames[id]?.trim();
        if (draft && draft !== currentOriginal) {
            updateSessionName(id, draft);
            refreshData();
            setFeedbackMsg({ text: `Nome da pesquisa atualizado para "${draft}".`, type: "info" });
        }
    };

    const handleLoadSave = (save: SearchSessionSave) => {
        const rawQs = (save.queryString || "").replace(/^\?+/, "");
        const dest = `${save.pathname || "/pesquisa"}${rawQs ? `?${rawQs}` : ""}`;

        // Close modal cleanly
        if (typeof window !== "undefined") {
            const modalEl = document.getElementById(id);
            if (modalEl && (window as any).bootstrap) {
                const modalInstance = (window as any).bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }
            document.querySelectorAll(".modal-backdrop").forEach(el => el.remove());
            document.body.classList.remove("modal-open");
            document.body.style.removeProperty("overflow");
            document.body.style.removeProperty("padding-right");

            if (onSessionLoaded) onSessionLoaded();
            window.location.assign(dest);
        }
    };

    const handleDelete = (saveId: string, name: string) => {
        if (confirm(`Tem a certeza que pretende eliminar "${name}" das pesquisas guardadas?`)) {
            deleteSavedSession(saveId);
            setFeedbackMsg({ text: `Pesquisa eliminada.`, type: "info" });
            refreshData();
        }
    };

    const handleExportSingle = (save: SearchSessionSave) => {
        const payload = {
            version: "1.0",
            app: "nextjs-jurisprudencia",
            exportedAt: new Date().toISOString(),
            saves: [save],
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const sanitized = save.name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
        a.download = `pesquisa_${sanitized}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const res = await importSavesFromJsonString(text);
            if (res.imported > 0) {
                setFeedbackMsg({ text: `${res.imported} pesquisa(s) importada(s) com sucesso!`, type: "success" });
            } else {
                setFeedbackMsg({ text: "Nenhuma pesquisa válida encontrada no ficheiro.", type: "danger" });
            }
            refreshData();
        } catch (err) {
            console.error(err);
            setFeedbackMsg({ text: "Erro ao ler ficheiro JSON.", type: "danger" });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    if (!mounted) return null;

    const showSuggestionRow = currentSearchSuggestion && currentSearchSuggestion.hasActive && !currentSearchSuggestion.isAlreadySaved;
    const hasAnyRows = showSuggestionRow || saves.length > 0;

    return (
        <div className="modal fade" id={id} tabIndex={-1} aria-labelledby={`${id}-label`} aria-hidden="true">
            <div className="modal-dialog modal-xl modal-dialog-scrollable">
                <div className="modal-content shadow-lg border-0">
                    {/* Header: Pesquisas Guardadas */}
                    <div className="modal-header bg-light border-bottom py-3">
                        <div className="d-flex align-items-center gap-2">
                            <div className="bg-primary text-white rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: 38, height: 38 }}>
                                <i className="bi bi-bookmarks fs-5"></i>
                            </div>
                            <div>
                                <h5 className="modal-title m-0 fw-bold" id={`${id}-label`}>
                                    Pesquisas Guardadas
                                </h5>
                                <small className="text-muted">
                                    Gestão das suas pesquisas guardadas localmente no navegador (sem necessidade de conta)
                                </small>
                            </div>
                        </div>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                    </div>

                    <div className="modal-body p-3">
                        {feedbackMsg && (
                            <div className={`alert alert-${feedbackMsg.type} alert-dismissible fade show py-2 mb-3`} role="alert">
                                <small className="fw-medium">{feedbackMsg.text}</small>
                                <button type="button" className="btn-close py-2" onClick={() => setFeedbackMsg(null)}></button>
                            </div>
                        )}

                        {/* Composite Bulletin Action Banner */}
                        {selectedSaveIds.length > 0 && (
                            <div className="alert alert-primary d-flex flex-wrap align-items-center justify-content-between p-2 mb-3 gap-2 border-primary-subtle shadow-sm">
                                <div className="d-flex align-items-center gap-2">
                                    <i className="bi bi-journals fs-5 text-primary"></i>
                                    <div>
                                        <span className="fw-bold">{selectedSaveIds.length}</span> {selectedSaveIds.length === 1 ? "pesquisa selecionada" : "pesquisas selecionadas"}
                                        <span className="text-muted small ms-1">(para emissão do Boletim Composto)</span>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setSelectedSaveIds([])}
                                    >
                                        Limpar Seleção
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                                        onClick={() => handleGenerateCompositeBoletim("html")}
                                        title="Visualizar o Boletim Composto das pesquisas selecionadas"
                                    >
                                        <i className="bi bi-file-earmark-text"></i>
                                        <span>Ver Boletim Composto</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-success d-flex align-items-center gap-1"
                                        onClick={() => handleGenerateCompositeBoletim("docx")}
                                        title="Descarregar o Boletim Composto em Microsoft Word (.docx)"
                                    >
                                        <i className="bi bi-file-earmark-word"></i>
                                        <span>Word (.docx)</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Spreadsheet-like Table View */}
                        {!hasAnyRows ? (
                            <div className="text-center py-5 border rounded bg-light">
                                <i className="bi bi-bookmarks text-muted fs-1 d-block mb-2"></i>
                                <h6 className="fw-semibold text-muted">Ainda não existem pesquisas guardadas</h6>
                                <p className="text-muted small mb-0 px-3">
                                    Execute uma pesquisa com termos ou filtros na barra de pesquisa para poder guardá-la aqui.
                                </p>
                            </div>
                        ) : (
                            <div className="table-responsive border rounded shadow-sm">
                                <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.875rem" }}>
                                    <thead className="table-light border-bottom text-muted">
                                        <tr>
                                            <th style={{ width: "45px", minWidth: "40px" }} className="text-center py-2 text-muted fw-bold user-select-none" title="Número da Linha (Metadado de Posição)">
                                                #
                                            </th>
                                            <th style={{ width: "40px" }} className="text-center py-2">
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    checked={saves.length > 0 && selectedSaveIds.length === saves.length}
                                                    onChange={handleSelectAll}
                                                    title="Selecionar ou desmarcar todas para Boletim Composto"
                                                    disabled={saves.length === 0}
                                                />
                                            </th>
                                            <th style={{ width: "32%", minWidth: "220px" }} className="py-2">
                                                Nome da Pesquisa (editável)
                                            </th>
                                            <th style={{ width: "15%", minWidth: "120px" }} className="py-2">
                                                Data
                                            </th>
                                            <th className="py-2">
                                                Critérios / Filtros
                                            </th>
                                            <th style={{ width: "170px" }} className="text-end py-2 pe-3">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Row #1: Active Search Suggestion (if currently has unsaved active search) */}
                                        {showSuggestionRow && (
                                            <tr className="table-primary table-opacity-10">
                                                <td className="text-center text-muted fw-bold bg-light border-end user-select-none" style={{ width: "45px", fontSize: "0.82rem" }}>
                                                    1
                                                </td>
                                                <td className="text-center">
                                                    <span className="badge bg-primary text-white" title="Pesquisa ativa atualmente na página">
                                                        Nova
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="input-group input-group-sm">
                                                        <span className="input-group-text bg-white border-primary text-primary">
                                                            <i className="bi bi-pencil-fill" style={{ fontSize: "0.75rem" }}></i>
                                                        </span>
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-sm border-primary fw-semibold"
                                                            value={suggestionName}
                                                            onChange={(e) => setSuggestionName(e.target.value)}
                                                            placeholder="Nome para esta pesquisa..."
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    handleSaveSuggestion();
                                                                }
                                                            }}
                                                            title="Nome sugerido para guardar os filtros atuais"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="text-muted small text-nowrap">
                                                    <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle">
                                                        <i className="bi bi-clock me-1"></i>Agora
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="d-flex flex-wrap gap-1 align-items-center">
                                                        {currentSearchSuggestion.summary.queryText && (
                                                            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle">
                                                                <i className="bi bi-search me-1"></i>&quot;{currentSearchSuggestion.summary.queryText}&quot;
                                                            </span>
                                                        )}
                                                        {currentSearchSuggestion.summary.dateRange && (
                                                            <span className="badge bg-secondary bg-opacity-10 text-secondary border">
                                                                <i className="bi bi-calendar3 me-1"></i>{currentSearchSuggestion.summary.dateRange}
                                                            </span>
                                                        )}
                                                        {currentSearchSuggestion.summary.filtersPreview?.map((f, fi) => (
                                                            <span key={fi} className="badge bg-light text-dark border">
                                                                {f}
                                                            </span>
                                                        ))}
                                                        {(currentSearchSuggestion.summary.filterCount || 0) > (currentSearchSuggestion.summary.filtersPreview?.length || 0) && (
                                                            <span className="badge bg-light text-muted border">
                                                                +{(currentSearchSuggestion.summary.filterCount || 0) - (currentSearchSuggestion.summary.filtersPreview?.length || 0)} mais
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-end pe-3">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-success fw-medium d-inline-flex align-items-center gap-1 shadow-sm px-2"
                                                        onClick={() => handleSaveSuggestion()}
                                                        disabled={isSaving}
                                                        title="Guardar esta pesquisa na sua lista"
                                                    >
                                                        <i className="bi bi-bookmark-plus"></i>
                                                        <span>{isSaving ? "A guardar…" : "Guardar"}</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        )}

                                        {/* Saved Sessions Rows */}
                                        {saves.map((save, idx) => {
                                            const isSelected = selectedSaveIds.includes(save.id);
                                            const currentDisplayVal = editingNames[save.id] ?? save.name;
                                            const rowNum = showSuggestionRow ? idx + 2 : idx + 1;
                                            return (
                                                <tr key={save.id} className={isSelected ? "table-active" : ""}>
                                                    <td className="text-center text-muted fw-bold bg-light border-end user-select-none" style={{ width: "45px", fontSize: "0.82rem" }}>
                                                        {rowNum}
                                                    </td>
                                                    <td className="text-center">
                                                        <input
                                                            type="checkbox"
                                                            className="form-check-input"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectSave(save.id)}
                                                            title="Selecionar para Boletim Composto"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-sm border-0 bg-transparent px-1 fw-bold text-dark w-100"
                                                            value={currentDisplayVal}
                                                            onChange={(e) => handleNameChange(save.id, e.target.value)}
                                                            onBlur={() => handleNameBlur(save.id, save.name)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    (e.target as HTMLInputElement).blur();
                                                                }
                                                            }}
                                                            title="Clique diretamente para renomear esta pesquisa"
                                                        />
                                                    </td>
                                                    <td className="text-muted small text-nowrap">
                                                        {new Date(save.createdAt).toLocaleDateString("pt-PT", {
                                                            day: "2-digit",
                                                            month: "2-digit",
                                                            year: "numeric"
                                                        })}{" "}
                                                        <span className="text-black-50">
                                                            {new Date(save.createdAt).toLocaleTimeString("pt-PT", {
                                                                hour: "2-digit",
                                                                minute: "2-digit"
                                                            })}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex flex-wrap gap-1 align-items-center">
                                                            {save.summary?.queryText && (
                                                                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle">
                                                                    <i className="bi bi-search me-1"></i>&quot;{save.summary.queryText}&quot;
                                                                </span>
                                                            )}
                                                            {save.summary?.dateRange && (
                                                                <span className="badge bg-secondary bg-opacity-10 text-secondary border">
                                                                    <i className="bi bi-calendar3 me-1"></i>{save.summary.dateRange}
                                                                </span>
                                                            )}
                                                            {save.summary?.filtersPreview?.map((f, fi) => (
                                                                <span key={fi} className="badge bg-light text-dark border">
                                                                    {f}
                                                                </span>
                                                            ))}
                                                            {(save.summary?.filterCount || 0) > (save.summary?.filtersPreview?.length || 0) && (
                                                                <span className="badge bg-light text-muted border">
                                                                    +{(save.summary?.filterCount || 0) - (save.summary?.filtersPreview?.length || 0)} mais
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="text-end pe-3 text-nowrap">
                                                        <div className="btn-group btn-group-sm">
                                                            <button
                                                                type="button"
                                                                className="btn btn-primary fw-medium d-inline-flex align-items-center gap-1"
                                                                onClick={() => handleLoadSave(save)}
                                                                title="Executar e aplicar esta pesquisa na página"
                                                            >
                                                                <i className="bi bi-search"></i>
                                                                <span>Pesquisar</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-secondary"
                                                                onClick={() => handleExportSingle(save)}
                                                                title="Descarregar esta pesquisa em formato JSON"
                                                            >
                                                                <i className="bi bi-download"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-danger"
                                                                onClick={() => handleDelete(save.id, save.name)}
                                                                title="Eliminar esta pesquisa guardada"
                                                            >
                                                                <i className="bi bi-trash"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Footer: Exportar Histórico and Importar Histórico side by side */}
                    <div className="modal-footer bg-light border-top d-flex flex-wrap justify-content-between py-2">
                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                onClick={() => exportSavesToJsonFile()}
                                disabled={saves.length === 0}
                                title="Descarregar todo o histórico de pesquisas num único ficheiro JSON"
                            >
                                <i className="bi bi-box-arrow-up"></i>
                                <span>Exportar Histórico (.json)</span>
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImportFile}
                                accept=".json"
                                style={{ display: "none" }}
                            />
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                onClick={() => fileInputRef.current?.click()}
                                title="Importar pesquisas a partir de ficheiro JSON"
                            >
                                <i className="bi bi-box-arrow-in-down"></i>
                                <span>Importar Histórico (.json)</span>
                            </button>
                        </div>
                        <button type="button" className="btn btn-sm btn-secondary" data-bs-dismiss="modal">
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
