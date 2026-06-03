const fs = require('fs');

const contentAiSearchForm = `import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AiSearchForm() {
    const [query, setQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleAiSearch = async (e?: React.SyntheticEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/api/ai-search", 
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ naturalLanguageQuery: query })
                }
            );

            if (!response.ok) {
                throw new Error("Erro na pesquisa gerada por IA.");
            }

            const data = await response.json();
            
            if (data.recommendedSearchString) {
                const newParams = new URLSearchParams(searchParams.toString());
                newParams.set("q", data.recommendedSearchString);
                router.push(\`?\${newParams.toString()}\`);
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
}`;

fs.writeFileSync("src/components/main_pages/search/AiSearchForm.tsx", contentAiSearchForm);
const contentAiSearchNode = fs.readFileSync("src/pages/api/ai-search.ts", "utf8");
fs.writeFileSync("src/pages/api/ai-search.ts", contentAiSearchNode.replace(/const SYSTEM_PROMPT = `[\s\S]*?`;/, `const SYSTEM_PROMPT = \`
És um especialista em bases de dados Elasticsearch e Direito.
O utilizador vai explicar em linguagem natural o que quer procurar numa base de jurisprudência.
A tua tarefa é traduzir o seu pedido para uma string de query (lucen/query_string) válida e otimizada ou devolver os parâmetros ideais sugeridos.
Tens as seguintes propriedades do documento disponíveis (onde "Texto" e "Sumário" são campos textuais p/ match natural):

- Campos de filtragem exata: Número de Processo, ECLI, Tipo, Secção, Área, Decisão.
- Usa o operando AND explicitamente para condições restritas.

Devolve APENAS um documento JSON neste formato, sem texto Markdown em volta:
{ "recommendedSearchString": string }
\`;`));
