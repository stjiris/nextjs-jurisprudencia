import { NextApiRequest, NextApiResponse } from 'next';
import LoggerApi from '@/core/logger-api';

const SYSTEM_PROMPT = `
És um especialista em bases de dados Elasticsearch e Direito.
O utilizador vai explicar em linguagem natural o que quer procurar numa base de jurisprudência.
A tua tarefa é traduzir o seu pedido para uma listagem de parâmetros válidos para filtragem.
As propriedades/filtros disponíveis na base de dados são exatamente os seguintes:
q (Para texto livre/genérico e queries complexas Lucene)
Número de Processo
ECLI
Meio Processual
Secção
Área
Decisão
Relator Nome Profissional
Tribunal
Descritores

- O campo 'q' destina-se a pesquisas por texto contextual ou texto livre sobre tudo.
- Os restantes campos destinam-se a extrair entidades (Nomes, Tribunais, Áreas) e filtrá-las especificamente.
- Exemplo: Para "Quero processos de burla relatados por Mário", deves devolver:
{ "q": "burla", "Relator Nome Profissional": "Mário" }
- Exemplo: Para "acórdãos sobre indemnização na área social com votação unânime", deves devolver:
{ "q": "indemnização", "Área": "Área Social", "Votação": "Unanimidade" }

Devolve APENAS um documento JSON com os pares chave/valor dos campos que identificaste da query. Não envies texto Markdown em volta do JSON.
`;

const FIELD_ALIASES: Record<string, string> = {
    "numero processo": "Número de Processo",
    "numero de processo": "Número de Processo",
    "n de processo": "Número de Processo",
    relator: "Relator Nome Profissional",
    "relator nome": "Relator Nome Profissional",
    "relator nome profissional": "Relator Nome Profissional",
    descritor: "Descritores",
    descritores: "Descritores",
    area: "Área",
    decisao: "Decisão",
    votacao: "Votação",
    tipo: "Meio Processual",
    "meio processual": "Meio Processual",
    meioprocessual: "Meio Processual",
};

function normalizeFieldKey(key: string) {
    return key
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function normalizeAiPayload(payload: Record<string, any>) {
    return Object.entries(payload).reduce<Record<string, any>>((acc, [key, value]) => {
        const normalizedKey = FIELD_ALIASES[normalizeFieldKey(key)] || key;
        if (value !== undefined && value !== null && value !== "") {
            acc[normalizedKey] = value;
        }
        return acc;
    }, {});
}

export default LoggerApi(async function aiSearchHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { naturalLanguageQuery } = req.body;
  if (!naturalLanguageQuery) return res.status(400).json({ error: 'Query em falta.' });

  try {
      const formData = new FormData();
      formData.append("channel_id", "cmpfi8l7javpzi601sqgkc95r");
      // Thread aleatória para não chocar com outros pedidos se for guardado histórico
      formData.append("thread_id", "search-" + Date.now()); 
      formData.append("user_info", "{}");
      formData.append("message", SYSTEM_PROMPT + "\n\nPedido do utilizador:\n" + naturalLanguageQuery);

      const response = await fetch("https://api.iaedu.pt/agent-chat/api/v1/agent/cmoss7l0f658oko01vk2egfpg/stream", {
          method: "POST",
          headers: {
              "x-api-key": "sk-usr-cxx7wrjfo1u0cg71jjs4zjc26n9obj9yxx",
              // Nota: O fetch trata automaticamente do "Content-Type" com o limite (boundary) quando usamos FormData, 
              // forçar "multipart/form-data" manualmente aqui estraga o limite.
          },
          body: formData
      });

      if (!response.ok) {
          throw new Error('API respondeu com ' + response.status);
      }

      // Conforme o endpoint ser /stream, teríamos de ver formato,
      // mas vamos assumir provisoriamente que recebe texto normal via parse ou NDJSON.
      const textResponse = await response.text();
      let aiText = "";
      let parsedData: any = {};
      
      try {
          // O endpoint é um stream NDJSON. Encontrar a linha final com type "message"
          const lines = textResponse.split('\n').filter(line => line.trim().length > 0);
          
          for (const line of lines) {
              try {
                  const chunk = JSON.parse(line);
                  if (chunk.type === "message" && chunk.content?.content) {
                      aiText = chunk.content.content; 
                      break; 
                  }
              } catch (e) {}
          }

          if (aiText) {
              // Limpar markdown residual que a IA possa ter gerado (ex: ```json ... ```)
              const match = aiText.match(/\{[\s\S]*?\}/);
              if (match) {
                  parsedData = normalizeAiPayload(JSON.parse(match[0]));
              }
          }
      } catch (e) {
          console.error("Erro no processamento dos chunks NDJSON:", e);
      }
      
      return res.status(200).json(parsedData);

  } catch (error) {
      console.error("AI Search Error:", error);
      return res.status(500).json({ error: 'Erro de comunicação com a IA.' });
  }
});