'use client';

import React, { useState, useEffect } from "react";
import { getSavedSessions } from "@/core/session-saves";

export default function SavedSessionsQuickButtons({ className = "" }: { className?: string }) {
    const [savedSessionsCount, setSavedSessionsCount] = useState(0);

    useEffect(() => {
        const updateCount = () => {
            setSavedSessionsCount(getSavedSessions().length);
        };
        updateCount();
        window.addEventListener("storage", updateCount);
        window.addEventListener("juris-sessions-updated", updateCount);
        return () => {
            window.removeEventListener("storage", updateCount);
            window.removeEventListener("juris-sessions-updated", updateCount);
        };
    }, []);

    return (
        <div className={`d-inline-flex align-items-center gap-1 ${className}`}>
            <button
                type="button"
                className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                style={{
                    height: "21px",
                    fontSize: "0.75rem",
                    padding: "0 6px",
                    lineHeight: 1,
                    borderRadius: "3px"
                }}
                data-bs-toggle="modal"
                data-bs-target="#modal-saved-sessions"
                title="Guardar parâmetros atuais da pesquisa no browser (Save File com Hash SHA-256)"
            >
                <i className="bi bi-bookmark-plus-fill" style={{ fontSize: "0.72rem" }}></i>
                <span>Guardar</span>
            </button>
            <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                style={{
                    height: "21px",
                    fontSize: "0.75rem",
                    padding: "0 6px",
                    lineHeight: 1,
                    borderRadius: "3px"
                }}
                data-bs-toggle="modal"
                data-bs-target="#modal-saved-sessions"
                title="Ver e carregar histórico de pesquisas guardadas no navegador"
            >
                <i className="bi bi-clock-history" style={{ fontSize: "0.72rem" }}></i>
                <span>Histórico</span>
                {savedSessionsCount > 0 && (
                    <span
                        className="badge bg-secondary ms-1"
                        style={{ fontSize: "0.6rem", padding: "1px 3px", lineHeight: 1 }}
                    >
                        {savedSessionsCount}
                    </span>
                )}
            </button>
        </div>
    );
}
