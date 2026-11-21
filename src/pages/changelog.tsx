import GenericPage from "@/components/main_pages/genericPageStructure";
import { GetStaticProps } from "next";
import Link from "next/link";
import { useState, useMemo } from "react";
import fs from "fs";
import path from "path";

interface ChangeItem {
    title: string;
    description?: string[];
}

interface ChangeSection {
    type: "Adicionado" | "Melhorado" | "Corrigido" | "Segurança" | "Outro";
    items: ChangeItem[];
}

interface VersionRelease {
    version: string;
    date: string;
    isCurrent?: boolean;
    sections: ChangeSection[];
    rawMarkdown: string;
}

interface ChangelogPageProps {
    releases: VersionRelease[];
    rawFullChangelog: string;
}

export const getStaticProps: GetStaticProps<ChangelogPageProps> = async () => {
    let rawContent = "";
    try {
        const filePath = path.join(process.cwd(), "CHANGELOG.md");
        if (fs.existsSync(filePath)) {
            rawContent = fs.readFileSync(filePath, "utf-8");
        } else {
            const publicPath = path.join(process.cwd(), "public", "CHANGELOG.md");
            if (fs.existsSync(publicPath)) {
                rawContent = fs.readFileSync(publicPath, "utf-8");
            }
        }
    } catch (e) {
        console.error("Erro ao ler CHANGELOG.md:", e);
    }

    const releases = parseChangelog(rawContent);

    return {
        props: {
            releases,
            rawFullChangelog: rawContent,
        },
    };
};

function parseChangelog(markdown: string): VersionRelease[] {
    const releases: VersionRelease[] = [];
    const lines = markdown.split(/\r?\n/);

    let currentRelease: VersionRelease | null = null;
    let currentSection: ChangeSection | null = null;
    let currentItem: ChangeItem | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for version header: ## [0.4.0] - 2026-11-21
        const versionMatch = line.match(/^##\s+\[(.*?)\](?:\s*-\s*(.*?))?$/);
        if (versionMatch) {
            if (currentRelease) {
                if (currentSection && currentItem) {
                    currentSection.items.push(currentItem);
                    currentItem = null;
                }
                if (currentSection) {
                    currentRelease.sections.push(currentSection);
                    currentSection = null;
                }
                releases.push(currentRelease);
            }
            const version = versionMatch[1];
            const date = versionMatch[2] || "";
            currentRelease = {
                version,
                date,
                isCurrent: releases.length === 0,
                sections: [],
                rawMarkdown: line,
            };
            continue;
        }

        if (!currentRelease) continue;

        currentRelease.rawMarkdown += "\n" + line;

        // Check for section header: ### Adicionado, ### Melhorado, etc.
        const sectionMatch = line.match(/^###\s+(.*)$/);
        if (sectionMatch) {
            if (currentSection && currentItem) {
                currentSection.items.push(currentItem);
                currentItem = null;
            }
            if (currentSection) {
                currentRelease.sections.push(currentSection);
            }
            const secName = sectionMatch[1].trim() as any;
            currentSection = {
                type: ["Adicionado", "Melhorado", "Corrigido", "Segurança"].includes(secName)
                    ? secName
                    : "Outro",
                items: [],
            };
            continue;
        }

        if (!currentSection) continue;

        // Check for top-level bullet item: - **Item Title**: or - Item Title
        const itemMatch = line.match(/^-\s+(?:\*\*(.*?)\*\*:?|\*(.*?)\*:?|(.*))$/);
        if (itemMatch) {
            if (currentItem) {
                currentSection.items.push(currentItem);
            }
            const title = (itemMatch[1] || itemMatch[2] || itemMatch[3] || "").trim();
            currentItem = {
                title,
                description: [],
            };
            continue;
        }

        // Sub-bullet or continuation line: "  - Subitem" or "  Description"
        if (currentItem) {
            const subMatch = line.match(/^\s+-\s+(.*)$/);
            if (subMatch) {
                currentItem.description = currentItem.description || [];
                currentItem.description.push(subMatch[1].trim());
            } else if (line.trim().length > 0 && !line.startsWith("#")) {
                currentItem.description = currentItem.description || [];
                currentItem.description.push(line.trim());
            }
        }
    }

    if (currentRelease) {
        if (currentSection && currentItem) {
            currentSection.items.push(currentItem);
        }
        if (currentSection) {
            currentRelease.sections.push(currentSection);
        }
        releases.push(currentRelease);
    }

    return releases;
}

export default function ChangelogPage({ releases, rawFullChangelog }: ChangelogPageProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedType, setSelectedType] = useState<string>("todos");
    const [showRaw, setShowRaw] = useState(false);

    const filteredReleases = useMemo(() => {
        if (!searchTerm && selectedType === "todos") return releases;
        const q = searchTerm.toLowerCase();

        return releases
            .map(rel => {
                const filteredSections = rel.sections
                    .filter(sec => selectedType === "todos" || sec.type === selectedType)
                    .map(sec => {
                        const filteredItems = sec.items.filter(item => {
                            if (!searchTerm) return true;
                            const inTitle = item.title.toLowerCase().includes(q);
                            const inDesc = item.description?.some(d => d.toLowerCase().includes(q));
                            return inTitle || inDesc;
                        });
                        return { ...sec, items: filteredItems };
                    })
                    .filter(sec => sec.items.length > 0);

                return {
                    ...rel,
                    sections: filteredSections,
                };
            })
            .filter(rel => rel.sections.length > 0 || (!searchTerm && selectedType === "todos"));
    }, [releases, searchTerm, selectedType]);

    const getBadgeClass = (type: ChangeSection["type"]) => {
        switch (type) {
            case "Adicionado":
                return "bg-success text-white";
            case "Melhorado":
                return "bg-primary text-white";
            case "Corrigido":
                return "bg-warning text-dark";
            case "Segurança":
                return "bg-danger text-white";
            default:
                return "bg-secondary text-white";
        }
    };

    const getBadgeIcon = (type: ChangeSection["type"]) => {
        switch (type) {
            case "Adicionado":
                return "bi-plus-circle-fill";
            case "Melhorado":
                return "bi-lightning-charge-fill";
            case "Corrigido":
                return "bi-check-circle-fill";
            case "Segurança":
                return "bi-shield-check";
            default:
                return "bi-tag";
        }
    };

    return (
        <GenericPage title="Registo de Alterações | Supremo Tribunal de Justiça">
            <div className="container py-3" style={{ maxWidth: "1050px" }}>
                {/* Banner de Cabeçalho */}
                <div className="card shadow-sm border-0 mb-4 bg-white">
                    <div className="card-body p-4 border-start border-4 border-primary">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <h3 className="m-0 fw-bold text-dark">Registo de Alterações</h3>
                                    <span className="badge bg-primary px-2 py-1 fs-6">
                                        v{releases[0]?.version || "0.4.0"}
                                    </span>
                                </div>
                                <p className="text-muted m-0">
                                    Histórico cronológico decrescente de versões, novas funcionalidades, melhorias de ergonomia e correções na plataforma de Jurisprudência do STJ.
                                </p>
                            </div>
                            <div className="d-flex gap-2 flex-wrap">
                                <a
                                    href="/CHANGELOG.md"
                                    download="CHANGELOG.md"
                                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm"
                                    title="Descarregar ficheiro Markdown bruto"
                                >
                                    <i className="bi bi-download"></i>
                                    <span>Descarregar .md</span>
                                </a>
                                <button
                                    type="button"
                                    className={`btn btn-sm d-flex align-items-center gap-1 shadow-sm ${showRaw ? "btn-dark" : "btn-outline-dark"}`}
                                    onClick={() => setShowRaw(!showRaw)}
                                >
                                    <i className="bi bi-filetype-md"></i>
                                    <span>{showRaw ? "Ocultar Texto Bruto" : "Ver Markdown"}</span>
                                </button>
                                <Link
                                    href="/pesquisa"
                                    className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
                                >
                                    <i className="bi bi-search"></i>
                                    <span>Ir para Pesquisa</span>
                                </Link>
                            </div>
                        </div>

                        {/* Barra de Filtro Rápido */}
                        <div className="row mt-3 pt-3 border-top g-2 align-items-center">
                            <div className="col-12 col-md-6">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-light border-end-0">
                                        <i className="bi bi-search text-muted"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0"
                                        placeholder="Pesquisar nestas notas de lançamento (ex: excel, boletim, filtros, docx)..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <button
                                            className="btn btn-outline-secondary border-start-0"
                                            onClick={() => setSearchTerm("")}
                                        >
                                            <i className="bi bi-x-lg"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="col-12 col-md-6 d-flex gap-1 justify-content-md-end flex-wrap">
                                {["todos", "Adicionado", "Melhorado", "Corrigido"].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        className={`btn btn-sm py-0 px-2 rounded-pill ${
                                            selectedType === type
                                                ? "btn-secondary text-white fw-semibold"
                                                : "btn-outline-secondary"
                                        }`}
                                        style={{ fontSize: "0.8rem" }}
                                        onClick={() => setSelectedType(type)}
                                    >
                                        {type === "todos" ? "Todos os Tipos" : type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exibição do Markdown Bruto caso solicitado */}
                {showRaw && (
                    <div className="card shadow-sm border-0 mb-4">
                        <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-2">
                            <span className="small font-monospace">CHANGELOG.md (Conteúdo Integral)</span>
                            <a
                                href="/CHANGELOG.md"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-outline-light py-0 px-2"
                                style={{ fontSize: "0.75rem" }}
                            >
                                Abrir em Nova Aba <i className="bi bi-box-arrow-up-right ms-1"></i>
                            </a>
                        </div>
                        <div className="card-body p-0">
                            <pre
                                className="m-0 p-3 bg-light text-dark font-monospace"
                                style={{
                                    fontSize: "0.85rem",
                                    maxHeight: "350px",
                                    overflowY: "auto",
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {rawFullChangelog}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Lista de Versões */}
                <div className="timeline-container">
                    {filteredReleases.length === 0 ? (
                        <div className="card shadow-sm p-4 text-center text-muted">
                            <i className="bi bi-funnel fs-2 mb-2 d-block text-secondary"></i>
                            Nenhuma alteração encontrada para os filtros selecionados.
                        </div>
                    ) : (
                        filteredReleases.map((release, rIdx) => (
                            <div key={rIdx} className="card shadow-sm border-0 mb-4">
                                <div className="card-header bg-light d-flex flex-wrap justify-content-between align-items-center py-3 border-bottom">
                                    <div className="d-flex align-items-center gap-2">
                                        <h5 className="m-0 fw-bold text-dark font-monospace">
                                            v{release.version}
                                        </h5>
                                        {release.isCurrent && (
                                            <span className="badge bg-success-subtle text-success border border-success px-2 py-1" style={{ fontSize: "0.75rem" }}>
                                                Versão Atual em Produção
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-muted small d-flex align-items-center gap-1">
                                        <i className="bi bi-calendar3"></i>
                                        <span>{release.date || "Data não especificada"}</span>
                                    </div>
                                </div>
                                <div className="card-body p-4">
                                    {release.sections.map((sec, sIdx) => (
                                        <div key={sIdx} className="mb-4 last-mb-0">
                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                <span className={`badge ${getBadgeClass(sec.type)} d-flex align-items-center gap-1 px-2 py-1`} style={{ fontSize: "0.78rem" }}>
                                                    <i className={`bi ${getBadgeIcon(sec.type)}`}></i>
                                                    {sec.type}
                                                </span>
                                            </div>
                                            <ul className="list-group list-group-flush border-start ms-2 ps-3">
                                                {sec.items.map((item, iIdx) => (
                                                    <li key={iIdx} className="list-group-item bg-transparent px-0 py-2 border-0">
                                                        <div className="fw-semibold text-dark">
                                                            {item.title}
                                                        </div>
                                                        {item.description && item.description.length > 0 && (
                                                            <ul className="text-muted small ps-3 mt-1 mb-0" style={{ listStyleType: "circle" }}>
                                                                {item.description.map((desc, dIdx) => (
                                                                    <li key={dIdx} className="py-1">
                                                                        {desc}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Rodapé Informativo */}
                <div className="card shadow-sm border-0 mt-4 bg-light">
                    <div className="card-body p-3 text-center text-muted small">
                        <span>
                            Documento gerido conforme as diretrizes institucionais do Supremo Tribunal de Justiça e padrões de Engenharia de Software.
                        </span>
                        <div className="mt-1">
                            <Link href="/CHANGELOG.md" target="_blank" className="text-decoration-none text-primary me-3">
                                <i className="bi bi-file-text me-1"></i>Aceder a CHANGELOG.md (TXT/MD)
                            </Link>
                            <Link href="/" className="text-decoration-none text-secondary">
                                <i className="bi bi-house me-1"></i>Página Inicial STJ Jurisprudência
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </GenericPage>
    );
}
