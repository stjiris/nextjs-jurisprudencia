import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const AI_SEARCH_QUERY_STORAGE_KEY = "ai-search-query";

export default function AiSearchForm() {
    const [query, setQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        try {
            const storedQuery = window.localStorage.getItem(AI_SEARCH_QUERY_STORAGE_KEY);
            if (storedQuery !== null) {
                setQuery(storedQuery);
            }
        } catch {
            // Ignore storage access errors and fall back to in-memory state.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(AI_SEARCH_QUERY_STORAGE_KEY, query);
        } catch {
            // Ignore storage access errors and keep the input functional.
        }
    }, [query]);

    const handleAiSearch = async (e?: React.SyntheticEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${router.basePath}/api/ai-search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ naturalLanguageQuery: query })
            });

            if (!response.ok) {
                throw new Error("Erro na pesquisa gerada por IA.");
            }

            const data = await response.json();
            
            if (data && typeof data === "object") {
                const newParams = new URLSearchParams(window.location.search);
                
                // Limpa o q atual para não submeter lixo com os novos filtros, se a IA propôs coisas novas
                if (Object.keys(data).length > 0) {
                     newParams.delete("q");
                }
                 newParams.delete("page");

                Object.keys(data).forEach(key => {
                    // Ignora chaves irrelevantes que o LLM possa por acaso devolver a pensar que é o root (ex: recommendedSearchString isolado)
                    if (key === "recommendedSearchString") {
                       newParams.set("q", data[key]);
                    } else if (data[key]) {
                       newParams.set(key, data[key]);
                    }
                });

                window.location.assign(`${router.basePath}/pesquisa?${newParams.toString()}`);
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="card m-1 mt-3 rounded-0 border-primary">
            <div className="card-header bg-primary text-white py-1">
                <i className="bi bi-robot"></i> Pergunta à IA
            </div>
            <div className="card-body p-2">
                <div className="ai-search-form">
                    <textarea 
                        className="form-control form-control-sm mb-2 rounded-0"
                        rows={3}
                        placeholder="Ex: Procuro decisões do tribunal de Coimbra onde tenha havido indemnização superior a 50 mil euros."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAiSearch(e);
                            }
                        }}
                    ></textarea>
                    
                    <button 
                        type="button" 
                        onClick={handleAiSearch}
                        className="btn btn-primary btn-sm w-100 rounded-0"
                        disabled={isLoading || !query.trim()}
                    >
                        {isLoading ? (
                            <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> A pensar...</>
                        ) : "Pesquisar"}
                    </button>
                    
                    {error && <div className="text-danger small mt-2">{error}</div>}
                </div>
            </div>
        </div>
    );
}