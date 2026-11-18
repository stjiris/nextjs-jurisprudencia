'use client';

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    SearchSessionSave,
    getSavedSessions,
    saveSession,
    deleteSavedSession,
    getLastSession,
    verifySaveIntegrity,
    exportSavesToJsonFile,
    importSavesFromJsonString
} from "@/core/session-saves";

interface SavedSessionsModalProps {
    id?: string;
    onSessionLoaded?: () => void;
}

export default function SavedSessionsModal({ id = "modal-saved-sessions", onSessionLoaded }: SavedSessionsModalProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [mounted, setMounted] = useState(false);
    const [hasActiveSearchParams, setHasActiveSearchParams] = useState(false);
    const [saves, setSaves] = useState<SearchSessionSave[]>([]);
    const [lastSession, setLastSession] = useState<SearchSessionSave | null>(null);
    const [integrityMap, setIntegrityMap] = useState<Record<string, boolean>>({});
    const [customName, setCustomName] = useState("");
    const [selectedSaveIds, setSelectedSaveIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "danger" | "info" } | null>(null);
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

    const refreshData = async () => {
        const list = getSavedSessions();
        setSaves(list);
        setLastSession(getLastSession());

        // Asynchronously verify integrity of all saves
        const checks: Record<string, boolean> = {};
        for (const item of list) {
            checks[item.id] = await verifySaveIntegrity(item);
        }
        setIntegrityMap(checks);
    };

    useEffect(() => {
        setMounted(true);
        refreshData();
        setHasActiveSearchParams(typeof window !== "undefined" && window.location.search.length > 1);

        // Listen for modal show event to refresh data
        const modalEl = document.getElementById(id);
        if (modalEl) {
            const handleShow = () => {
                refreshData();
                setHasActiveSearchParams(typeof window !== "undefined" && window.location.search.length > 1);
                setFeedbackMsg(null);
            };
            modalEl.addEventListener("show.bs.modal", handleShow);
            return () => modalEl.removeEventListener("show.bs.modal", handleShow);
        }
    }, [id]);

    const handleSaveCurrent = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const currentSp = typeof window !== "undefined" ? window.location.search : (searchParams ? searchParams.toString() : "");
            const currentPath = typeof window !== "undefined" ? window.location.pathname : "/pesquisa";
            const newSave = await saveSession(customName, currentSp, currentPath);
            setCustomName("");
            setFeedbackMsg({ text: `Pesquisa "${newSave.name}" guardada com sucesso!`, type: "success" });
            await refreshData();
        } catch (err) {
            console.error(err);
            setFeedbackMsg({ text: "Erro ao guardar pesquisa no browser.", type: "danger" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadSave = (save: SearchSessionSave) => {
        const rawQs = (save.queryString || "").replace(/^\?+/, "");
        const dest = `${save.pathname || "/pesquisa"}${rawQs ? `?${rawQs}` : ""}`;
        
        // Close bootstrap modal if open and clean up backdrop
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
        if (confirm(`Tens a certeza que desejas eliminar do histórico "${name}"?`)) {
            deleteSavedSession(saveId);
            setFeedbackMsg({ text: `Pesquisa removida do histórico.`, type: "info" });
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
        a.download = `save_${sanitized}_${new Date().toISOString().slice(0, 10)}.json`;
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
                setFeedbackMsg({ text: `${res.imported} pesquisa(s) importada(s) para o histórico com sucesso!`, type: "success" });
            } else {
                setFeedbackMsg({ text: "Nenhuma pesquisa válida encontrada no ficheiro.", type: "danger" });
            }
            await refreshData();
        } catch (err) {
            console.error(err);
            setFeedbackMsg({ text: "Erro ao ler ficheiro JSON.", type: "danger" });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    if (!mounted) return null;

    return (
        <div className="modal fade" id={id} tabIndex={-1} aria-labelledby={`${id}-label`} aria-hidden="true">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
                <div className="modal-content shadow-lg border-0">
                    <div className="modal-header bg-light border-bottom">
                        <div className="d-flex align-items-center gap-2">
                            <div className="bg-primary text-white rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                                <i className="bi bi-clock-history fs-5"></i>
                            </div>
                            <div>
                                <h5 className="modal-title m-0 fw-bold" id={`${id}-label`}>
                                    Histórico de Pesquisas
                                </h5>
                                <small className="text-muted">
                                    Pesquisas guardadas localmente no browser com hash de integridade SHA-256 (sem conta)
                                </small>
                            </div>
                        </div>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                    </div>

                    <div className="modal-body p-3 p-md-4">
                        {feedbackMsg && (
                            <div className={`alert alert-${feedbackMsg.type} alert-dismissible fade show py-2`} role="alert">
                                <small className="fw-medium">{feedbackMsg.text}</small>
                                <button type="button" className="btn-close py-2" onClick={() => setFeedbackMsg(null)}></button>
                            </div>
                        )}

                        {/* Save Current Search Form */}
                        <div className="card border-primary border-opacity-25 bg-primary bg-opacity-10 mb-3">
                            <div className="card-body p-3">
                                <h6 className="fw-semibold text-primary d-flex align-items-center gap-2 mb-2">
                                    <i className="bi bi-bookmark-plus-fill"></i>
                                    Guardar Pesquisa Atual
                                </h6>
                                <form onSubmit={handleSaveCurrent} className="row g-2 align-items-center">
                                    <div className="col-12 col-sm-8">
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            placeholder="Nome da pesquisa (ex.: Pesquisa de Tese - Danos Morais)"
                                            value={customName}
                                            onChange={(e) => setCustomName(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-12 col-sm-4">
                                        <button
                                            type="submit"
                                            className="btn btn-sm btn-primary w-100 fw-medium d-flex align-items-center justify-content-center gap-1"
                                            disabled={isSaving}
                                        >
                                            <i className="bi bi-save2"></i>
                                            <span>Guardar no Histórico</span>
                                        </button>
                                    </div>
                                    {!hasActiveSearchParams && (
                                        <div className="col-12">
                                            <small className="text-muted d-block" style={{ fontSize: "0.78rem" }}>
                                                <i className="bi bi-info-circle me-1"></i>
                                                Nota: Neste momento nenhum filtro específico está ativo na página; será guardado o estado global.
                                            </small>
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>

                        {/* Last Session Restore Quick Card */}
                        {lastSession && (
                            <div className="card bg-body-tertiary border mb-3">
                                <div className="card-body p-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                                    <div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="badge bg-secondary text-white">
                                                <i className="bi bi-clock-history me-1"></i>
                                                Última Atividade
                                            </span>
                                            <small className="text-muted">
                                                {new Date(lastSession.updatedAt).toLocaleString("pt-PT")}
                                            </small>
                                        </div>
                                        <div className="mt-1">
                                            <span className="fw-medium small">
                                                {lastSession.summary?.queryText ? `Termo: "${lastSession.summary.queryText}"` : "Pesquisa por filtros"}
                                            </span>
                                            {lastSession.summary?.dateRange && (
                                                <span className="badge bg-light text-dark border ms-2">
                                                    {lastSession.summary.dateRange}
                                                </span>
                                            )}
                                            {lastSession.summary?.filterCount ? (
                                                <span className="badge bg-light text-dark border ms-1">
                                                    {lastSession.summary.filterCount} filtro(s)
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                                        onClick={() => handleLoadSave(lastSession)}
                                    >
                                        <i className="bi bi-arrow-counterclockwise"></i>
                                        <span>Restaurar Última Pesquisa</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Saved Slots Header */}
                        <div className="d-flex align-items-center justify-content-between mb-2 mt-3">
                            <h6 className="fw-bold m-0 d-flex align-items-center gap-2">
                                <i className="bi bi-collection"></i>
                                Pesquisas no Histórico ({saves.length})
                            </h6>
                            {saves.length > 0 && (
                                <div className="d-flex align-items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline-primary btn-sm py-0 px-2"
                                        onClick={handleSelectAll}
                                        title="Selecionar ou desmarcar todas para o Boletim Composto"
                                    >
                                        <i className="bi bi-check2-all me-1"></i>
                                        {selectedSaveIds.length === saves.length ? "Desmarcar Todas" : "Selecionar Todas"}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm py-0 px-2"
                                        onClick={() => exportSavesToJsonFile()}
                                        title="Descarregar histórico de pesquisas em formato JSON"
                                    >
                                        <i className="bi bi-box-arrow-up me-1"></i>
                                        Exportar (.json)
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Composite Bulletin Action Banner */}
                        {selectedSaveIds.length > 0 && (
                            <div className="alert alert-primary d-flex flex-wrap align-items-center justify-content-between p-2 mb-3 gap-2 border-primary-subtle shadow-sm">
                                <div className="d-flex align-items-center gap-2">
                                    <i className="bi bi-journals fs-5 text-primary"></i>
                                    <div>
                                        <span className="fw-bold">{selectedSaveIds.length}</span> {selectedSaveIds.length === 1 ? "pesquisa selecionada" : "pesquisas selecionadas"}
                                        <span className="text-muted small ms-1">(para Boletim Composto)</span>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setSelectedSaveIds([])}
                                    >
                                        Limpar
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

                        {/* Saved Slots List */}
                        {saves.length === 0 ? (
                            <div className="text-center py-5 border rounded bg-light">
                                <i className="bi bi-inbox text-muted fs-1 d-block mb-2"></i>
                                <h6 className="fw-semibold text-muted">Nenhuma pesquisa no histórico ainda</h6>
                                <p className="text-muted small mb-0 max-w-md mx-auto px-3">
                                    Pesquisa com os filtros ou termos pretendidos e clica em <b>&quot;Guardar Pesquisa&quot;</b> para adicionares ao teu histórico.
                                </p>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-2">
                                {saves.map((save) => {
                                    const isValid = integrityMap[save.id] ?? true;
                                    const isSelected = selectedSaveIds.includes(save.id);
                                    return (
                                        <div key={save.id} className={`card border shadow-sm ${isSelected ? 'border-primary bg-primary bg-opacity-10' : ''}`}>
                                            <div className="card-body p-3">
                                                <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                                                    <div className="d-flex align-items-start gap-2 flex-grow-1">
                                                        <div className="form-check pt-1">
                                                            <input
                                                                type="checkbox"
                                                                className="form-check-input"
                                                                id={`check-save-${save.id}`}
                                                                checked={isSelected}
                                                                onChange={() => toggleSelectSave(save.id)}
                                                                title="Selecionar para o Boletim Composto"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label htmlFor={`check-save-${save.id}`} className="fw-bold mb-1 text-dark d-block user-select-none" style={{ cursor: "pointer" }}>
                                                                {save.name}
                                                            </label>
                                                        <div className="d-flex flex-wrap align-items-center gap-2 text-muted small mb-2">
                                                            <span>
                                                                <i className="bi bi-calendar-event me-1"></i>
                                                                {new Date(save.createdAt).toLocaleDateString("pt-PT", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                    year: "numeric",
                                                                    hour: "2-digit",
                                                                    minute: "2-digit"
                                                                })}
                                                            </span>
                                                            <span>•</span>
                                                            {/* Cryptographic SHA-256 Integrity Tag */}
                                                            {isValid ? (
                                                                <span
                                                                    className="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1"
                                                                    title={`Hash SHA-256 verificado: ${save.hash}`}
                                                                >
                                                                    <i className="bi bi-shield-check"></i>
                                                                    Integridade OK ({save.hash.slice(0, 8)}...)
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    className="badge bg-danger-subtle text-danger border border-danger-subtle d-inline-flex align-items-center gap-1"
                                                                    title="O hash guardado não coincide com os parâmetros (possível adulteração)"
                                                                >
                                                                    <i className="bi bi-shield-exclamation"></i>
                                                                    Integridade Inválida
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Summary badges */}
                                                        <div className="d-flex flex-wrap gap-1">
                                                            {save.summary?.queryText && (
                                                                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle">
                                                                    <i className="bi bi-search me-1"></i>
                                                                    &quot;{save.summary.queryText}&quot;
                                                                </span>
                                                            )}
                                                            {save.summary?.dateRange && (
                                                                <span className="badge bg-secondary bg-opacity-10 text-secondary border">
                                                                    <i className="bi bi-calendar3 me-1"></i>
                                                                    {save.summary.dateRange}
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
                                                    </div>
                                                </div>

                                                    {/* Actions */}
                                                    <div className="d-flex align-items-center gap-1 ms-auto">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-primary fw-medium d-flex align-items-center gap-1"
                                                            onClick={() => handleLoadSave(save)}
                                                            title="Carregar esta pesquisa na página"
                                                        >
                                                            <i className="bi bi-arrow-right-circle"></i>
                                                            <span>Carregar</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-secondary"
                                                            onClick={() => handleExportSingle(save)}
                                                            title="Descarregar ficheiro .json individual"
                                                        >
                                                            <i className="bi bi-download"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => handleDelete(save.id, save.name)}
                                                            title="Eliminar do histórico"
                                                        >
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="modal-footer bg-light border-top d-flex flex-wrap justify-content-between">
                        <div>
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
                            >
                                <i className="bi bi-upload"></i>
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
