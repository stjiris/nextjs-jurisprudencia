# Instruções e Documentação Técnica: Boletins de Jurisprudência do STJ

Este documento descreve detalhadamente todas as melhorias e adaptações implementadas no módulo de **Boletins de Jurisprudência do Supremo Tribunal de Justiça (STJ)**, em conformidade com as orientações da **Dra. Cátia Costa Santos** (Juíza de Direito | Assessoria Social do STJ), comunicadas pelo **Prof. José Borbinha**, e com base nos modelos oficiais fornecidos:
1. `2025_Secção Social_Boletim anual.docx` (Compilação anual da 4.ª Secção - Social)
2. `Cível.2026-02.docx` (Boletim mensal das 1.ª, 2.ª e 7.ª Secções - Cíveis)
3. `Criminal 2026-06.docx` (Boletim mensal das 3.ª e 5.ª Secções - Criminais)

---

## 1. Resumo das Alterações Realizadas

| Requisito / Funcionalidade | Implementação Técnica | Ficheiros Principais |
| :--- | :--- | :--- |
| **Logótipo e Cabeçalho Oficial** | Extração e inclusão do logótipo institucional em alta resolução (`stj-logo.png`) e cabeçalho dinâmico por Secção/Área. | `public/stj-logo.png`, `stj-logo.png`, `src/core/boletim-util.ts` |
| **Links Diretos (Permalinks)** | Geração de permalink clicável para cada acórdão no formato `https://juris.stj.pt/${proc}/${uuid}`. | `src/core/boletim-util.ts`, `src/pages/api/boletim/[[...filters]].ts` |
| **Composição do Colectivo de Juízes** | Extrator algorítmico inteligente (`extractColectivo`) que identifica o Relator (com `(Relator)` / `(Relatora)`) e todos os Juízes Adjuntos a partir das assinaturas do acórdão. | `src/core/boletim-util.ts` |
| **Índice Alfabético por Tema / Descritor** | Compilação e ordenação de todos os descritores de A a Z com referências cruzadas e hiperligações internas bidirecionais. | `src/core/boletim-util.ts`, `src/pages/api/boletim/[[...filters]].ts` |
| **Boletim Anual & Cadernos Temáticos** | Suporte a seleção de "Ano Inteiro" e filtros opcionais por descritor/pesquisa para gerar Cadernos Temáticos. | `src/pages/boletim.tsx`, `src/pages/api/boletim/count.ts` |
| **Renderização HTML e PDF Robusta** | HTML autónomo com CSS para impressão padrão A4 (margens STJ 2.5cm/3.0cm) e integração contínua com Pandoc + XeLaTeX. | `src/core/boletim-util.ts`, `src/pages/api/boletim/[[...filters]].ts` |

---

## 2. Detalhes de Cada Componente

### 2.1. Extração do Colectivo de Juízes (`extractColectivo`)
Nos acórdãos do STJ, os juízes que compõem a conferência assinam no fecho da decisão. O algoritmo em [src/core/boletim-util.ts](file:///c:/Users/shueb/OneDrive/Documentos/Tese/nextjs-jurisprudencia/src/core/boletim-util.ts) analisa os últimos blocos textuais para extrair:
- **Relator**: Normaliza o nome do relator profissional ou completo e apõe a menção `(Relator)` ou `(Relatora)` (com deteção automática de género em nomes portugueses caso omitido).
- **Juízes Adjuntos**: Extrai todos os juízes adjuntos que intervieram na decisão através de três padrões:
  1. Linhas subsequentes à linha do Relator (ex: `Júlio Gomes`, `José Eduardo Sapateiro`, `Albertina Pereira`).
  2. Bloco precedido de `Adjuntos:` ou `Os Adjuntos:`.
  3. Fórmulas de conformidade eletrónica nos termos do art. 153.º, n.º 1 do CPC (ex: *"Atesto que os Senhores Juízes Conselheiros adjuntos [Nome 1] e [Nome 2] votaram em conformidade..."*).
- **Limpeza de Nomes**: Remove automaticamente títulos honoríficos (`Juiz Conselheiro`, `Desembargador`, `Dra.`, etc.), números de ordem (`1.º Adjunto:`) e menções acessórias (`(com declaração de voto)`, `(vencido)`, `(assinado digitalmente)`).

### 2.2. Geração de Links Diretos Públicos (`generatePermalink`)
- Para cada acórdão é gerada a hiperligação direta para o portal de jurisprudência do STJ:
  `https://juris.stj.pt/${encodeURIComponent(proc)}/${uuid}`
- Caso o acórdão ainda não tenha UUID atribuído, é gerado o fallback seguro de pesquisa pública:
  `https://juris.stj.pt/pesquisa?N%C3%BAmero+de+Processo=${encodeURIComponent(proc)}`
- Todos os links são clicáveis tanto no HTML como no PDF gerado.

### 2.3. Índice Alfabético por Tema / Descritor (`buildDescriptorIndex`)
- Constrói o índice remissivo final, coligindo todos os descritores dos acórdãos incluídos.
- Aplica a ordenação alfabética com regras ortográficas da língua portuguesa (`localeCompare("pt-PT")`).
- Agrupa por letras capitais (A, B, C, ...).
- Em HTML, cada entrada do índice possui ligação ancorada direta `<a href="#entry-X">` para o acórdão correspondente, permitindo navegação instantânea.
- Em LaTeX/PDF, é gerada uma secção final não numerada com referências cruzadas a cada processo e entrada.

### 2.4. Estilos de Impressão e Layout A4 Oficial
O template HTML inclui regras `@media print` e `@page` que replicam as especificações dos documentos DOCX oficiais:
- Tamanho de página: **A4** (210mm x 297mm).
- Margens oficiais: Superior **2.5 cm**, Inferior **2.5 cm**, Esquerda **3.0 cm**, Direita **2.5 cm**.
- Tipografia: Serifada padrão tribunal (*Times New Roman*, *Georgia*).
- Quebras de página controladas: `page-break-inside: avoid` nas entradas dos acórdãos e `page-break-before: always` antes do Índice Remissivo.
- O logótipo institucional do STJ é embutido diretamente como Base64 no HTML, garantindo que o ficheiro pode ser visualizado, gravado localmente ou impresso sem depender de servidores externos ou ligações de rede.

### 2.5. Melhorias na Interface do Utilizador (`src/pages/boletim.tsx`)
- **Secção / Área**: Apresentação de rótulos claros para as secções:
  - *Área Social* $\rightarrow$ `Secção Social (4.ª Secção)`
  - *Área Cível* $\rightarrow$ `Secções Cíveis (1.ª, 2.ª e 7.ª Secções)`
  - *Área Criminal* $\rightarrow$ `Secções Criminais (3.ª e 5.ª Secções)`
  - *Contencioso* $\rightarrow$ `Secção de Contencioso`
- **Período**: Adicionada a opção `"Ano Inteiro (Boletim Anual)"` no seletor de mês.
- **Cadernos Temáticos**: Adicionado campo opcional para filtrar por Descritor/Tema específico.
- **Ações no Iframe**: Botão para impressão direta (`window.print()`) e abertura em novo separador.
- **Preservação de UI/UX**: Todas as alterações integraram-se harmoniosamente no design original da aplicação.

---

## 3. Estrutura de Ficheiros Modificados e Criados

```text
nextjs-jurisprudencia/
├── public/
│   ├── stj-logo.png               # Logótipo oficial STJ (31 KB)
│   └── stj-cover.jpeg              # Fotografia da fachada do STJ para capa anual
├── stj-logo.png                   # Logótipo na raiz para compilação XeLaTeX/Pandoc
├── src/
│   ├── core/
│   │   ├── boletim-util.ts        # Módulo central: Colectivo, Índice, Permalinks e HTML/MD
│   │   ├── excel.ts               # Correção de tipagem estrita
│   │   ├── keys.ts                # Correção de tipagem estrita
│   │   └── track-search.ts        # Correção de tipagem estrita
│   ├── components/
│   │   └── searchForm.tsx         # Compatibilidade de tipos de roteamento Next.js
│   └── pages/
│       ├── boletim.tsx            # Interface com seleção anual, cadernos temáticos e impressão
│       ├── admin/users.tsx        # Correção de tipagem estrita
│       └── api/
│           ├── searchId.ts        # Correção de tipagem estrita
│           └── boletim/
│               ├── count.ts       # Endpoint de contagem com suporte anual e descritores
│               └── [[...filters]].ts # Endpoint de geração com ordenação, colectivo e índice
├── qa-boletim-suite.js            # Suite de testes automatizados com 27 asserções
└── INSTRUCOES_BOLETIM_STJ.md       # Este documento de instruções
```

---

## 4. Instruções de Verificação e Testes

### 4.1. Execução da Suite de Testes do Boletim
Para verificar a integridade de todas as funções e validações de normalização, extração e indexação:
```powershell
node qa-boletim-suite.js
```
*Resultado esperado:* **27 PASSOU / 0 FALHOU**.

### 4.2. Verificação de Tipos TypeScript
```powershell
npx tsc --noEmit
```
*Resultado esperado:* Saída limpa com código 0 (sem erros de tipagem).

### 4.3. Compilação de Produção Next.js
```powershell
npm run build
```
*Resultado esperado:* Compilação bem-sucedida de todas as rotas e páginas.

### 4.4. Execução Local em Modo de Desenvolvimento
```powershell
npm run dev
```
Aceder no navegador a: `http://localhost:3000/boletim` para pré-visualizar e descarregar os boletins.
