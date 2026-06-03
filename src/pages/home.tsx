import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import Link from 'next/link';
import Image from "next/image";
import logoname from '../../public/images/PT-logoLogo-STJ.png';

export default function Home() {
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState<Array<{ text: string; type: string; docCount: number; totalOccurrences: number }>>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const router = useRouter();

    const handleSearch = (e?: React.FormEvent, override?: string, filterKey?: string) => {
        if (e) e.preventDefault();

        const term = (override ?? searchTerm).trim();
        if (term) {
            if (filterKey) {
                router.push(`/pesquisa?${encodeURIComponent(filterKey)}=${encodeURIComponent(term)}`);
            } else {
                router.push(`/pesquisa?q=${encodeURIComponent(term)}`);
            }
        } else {
            router.push('/pesquisa');
        }
    };

    const fetchSuggestions = async (query: string): Promise<Array<{ text: string; type: string; docCount: number; totalOccurrences: number }>> => {
        try {
            const response = await fetch(`/jurisprudencia/api/autocomplete?q=${encodeURIComponent(query)}`);
            
            console.log("A chamar API em:", response.url); // Adiciona isto para confirmarmos na consola

            if (!response.ok) {
                console.error("Erro na resposta da API:", response.status);
                return [];
            }
            const data = await response.json();
            return Array.isArray(data)
                ? data.filter((item) => item && typeof item.text === "string" && typeof item.type === "string" && typeof item.docCount === "number" && typeof item.totalOccurrences === "number")
                : [];
        } catch (error) {
            console.error("Erro no fetch:", error);
            return [];
        }
    };

    const applySuggestion = (suggestion: { text: string; type: string; docCount: number; totalOccurrences: number }) => {
        setSearchTerm(suggestion.text);
        setShowSuggestions(false);
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
        const filterKey = suggestion.type !== "q" ? suggestion.type : undefined;
        handleSearch(undefined, formatSuggestion(suggestion.text), filterKey);
    };

    useEffect(() => {
        const trimmed = searchTerm.trim();
        if (trimmed.length < 3) {
            setSuggestions([]);
            setShowSuggestions(false);
            setActiveSuggestionIndex(-1);
            return;
        }

        const timeoutId = window.setTimeout(async () => {
            const next = await fetchSuggestions(trimmed);
            setSuggestions(next);
            setShowSuggestions(next.length > 0);
            setActiveSuggestionIndex(-1);
        }, 300);

        return () => window.clearTimeout(timeoutId);
    }, [searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions || suggestions.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
            event.preventDefault();
            applySuggestion(suggestions[activeSuggestionIndex]);
        } else if (event.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const formatSuggestion = (value: string) => {
        const lower = value.toLocaleLowerCase("pt-PT");
        return lower ? lower[0].toLocaleUpperCase("pt-PT") + lower.slice(1) : value;
    };

    const suggestionBaseStyle: React.CSSProperties = {
        transition: "background-color 0.15s ease, color 0.15s ease"
    };

    const activeSuggestionStyle: React.CSSProperties = {
        backgroundColor: "#f1f3f4",
        color: "#202124",
        borderColor: "#f1f3f4"
    };

    return (
        <div className="google-homepage">
            <Head>
                <title>Jurisprudência STJ - Início</title>
            </Head>

            <main className="google-main">
                <div className="text-center d-flex flex-column align-items-center google-branding">
                    <Image
                        src={logoname}
                        alt="Logótipo STJ"
                        height={110}
                        width={280}
                        priority
                    />
                    <h2 className="fancy-font home-title">
                        Jurisprudência
                    </h2>
                </div>

                <div className="w-100 px-3 home-search-wrapper">
                    <form onSubmit={handleSearch}>
                        <div className="mb-4 search-container" style={{ position: "relative" }} ref={containerRef}>
                            <div className="input-group input-group-lg overflow-hidden google-search-shell">
                                <span className="input-group-text bg-white border-0 ps-3">
                                    <i className="bi bi-search home-search-icon"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-0 py-2 ps-2 home-search-input"
                                    placeholder="Pesquise na jurisprudência..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onFocus={() => setShowSuggestions(suggestions.length > 0 && searchTerm.trim().length >= 3)}
                                    onKeyDown={handleKeyDown}
                                />
                            </div>

                            {showSuggestions && searchTerm.trim().length >= 3 && suggestions.length > 0 && (
                                <ul
                                    className="list-group position-absolute w-100 mt-1 shadow-sm google-suggestions"
                                    style={{ top: "100%", left: 0, zIndex: 1000, maxHeight: "360px", overflowY: "auto" }}
                                >
                                    {suggestions.map((item, index) => (
                                        <li
                                            key={`${item.type}-${item.text}-${index}`}
                                            className={`list-group-item list-group-item-action d-flex align-items-center justify-content-between ${index === activeSuggestionIndex ? "active" : ""}`}
                                            style={{
                                                ...suggestionBaseStyle,
                                                ...(index === activeSuggestionIndex ? activeSuggestionStyle : {})
                                            }}
                                            onMouseDown={() => applySuggestion(item)}
                                            onMouseEnter={() => setActiveSuggestionIndex(index)}
                                        >
                                            <span className="d-flex align-items-center gap-2">
                                                <i className="bi bi-search google-suggestion-icon"></i>
                                                <span>{formatSuggestion(item.text)}</span>
                                                <span className="badge bg-light text-muted border">{item.type}</span>
                                            </span>
                                            <span className="text-muted small">{item.docCount} processos | {item.totalOccurrences} ocorrências</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="d-flex justify-content-center gap-3 google-actions">
                            <Link
                                href="/pesquisa"
                                className="btn google-btn"
                            >
                                Pesquisa Avançada
                            </Link>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}