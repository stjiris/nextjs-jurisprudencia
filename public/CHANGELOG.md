# Registo de Alterações (Changelog) — STJ Jurisprudência

Todas as alterações relevantes, novas funcionalidades, melhorias de ergonomia e correções introduzidas na plataforma web de Jurisprudência do Supremo Tribunal de Justiça (STJ) encontram-se documentadas neste ficheiro.

O formato baseia-se nas diretrizes de [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e adere ao versionamento semântico [Semantic Versioning (SemVer)](https://semver.org/).

---

## [0.4.0] - 2026-11-21

### Adicionado
- **Tabela de Resultados em Formato Folha de Cálculo ("à la folha de excel"):**
  - Implementada na visualização de resultados de pesquisa em modo administrador (`JurisprudenciaTable.tsx`), permitindo a visualização densa de 1 acórdão por linha e atributos por coluna.
  - Ordenação interativa e bidirecional (ascendente e descendente) por clique no cabeçalho em todas as colunas: Processo, Data (ordenação cronológica de datas portuguesas DD/MM/AAAA), Relator, Meio Processual, Decisão, Descritores e Estado.
  - Linha de filtros instantâneos por coluna (`showFilters`), permitindo filtrar por texto em cada campo em tempo real sem recarregar a página.
  - Coluna inicial fixa `#` com numeração sequencial de linhas (metadado de posição 1, 2, 3...) não editável nem ordenável, orientando o utilizador sobre o número de resultados e a posição atual perante ordenações.
  - Exportação direta dos resultados apresentados para ficheiro Excel/CSV com codificação UTF-8 com BOM (compatível nativamente com Microsoft Excel sem problemas de acentuação).
- **Importação Manual de Acórdãos por Ficheiro (.docx / .pdf):**
  - Adicionada funcionalidade de arrastar e largar (*drag-and-drop*) de ficheiros de acórdãos na página de criação manual (`/editar/criar`).
  - Extração automática de metadados: número de processo, data, relator, secção judicial, descritores e meio processual a partir do nome do ficheiro e do corpo do documento.
  - Extração automática de imagens embutidas no `.docx` para `/images/` preservando os identificadores visuais do acórdão.
- **Página Dedicada e Acesso ao Registo de Alterações (Changelog):**
  - Página `/changelog` acessível a todos os utilizadores através do link da versão no diálogo "Sobre" e no painel de administração.
  - Disponibilização do ficheiro em formato Markdown bruto `/CHANGELOG.md` para integração e consulta direta.
- **Páginas de Erro Personalizadas e Diagnóstico Explícito:**
  - Criação de páginas de erro 404 (Página Não Encontrada) e 500 (Erro Interno do Servidor) alinhadas com a identidade visual do STJ.
  - Mensagens de erro humanas e descritivas nas operações de publicação, eliminação, restauro e comunicação com APIs.
- **Sincronização Manual na Pesquisa (Admin):**
  - Adicionado botão de sincronização com o SharePoint e ambientes externos diretamente na barra de ferramentas de pesquisa para utilizadores autenticados.

### Melhorado
- **Reformulação do Modal de Pesquisas Guardadas:**
  - Alteração do título para "Pesquisas Guardadas" e remoção do bloco de destaque azul, unificando a experiência numa tabela compacta.
  - A pesquisa atual com parâmetros é apresentada imediatamente na primeira linha como sugestão de gravação com botão "Guardar".
  - Renomeação da ação de recuperação para "Pesquisar".
  - Edição direta e imediata (*inline*) do nome da pesquisa com atualização automática.
  - Agrupamento coerente dos botões "Exportar Histórico (.json)" e "Importar Histórico (.json)" no rodapé da caixa.
- **Comunicação Jurisprudência ↔ Anonimizador:**
  - Envio de parâmetro `returnUrl` para o módulo de anonimização, garantindo que o utilizador regressa exatamente à página do acórdão em tratamento com os campos pré-preenchidos após a conclusão.
- **Navegação do Editor de Acórdãos:**
  - Correção do botão "Guardar e Voltar" em `/editar/[id]` e `/editar/criar` com estado de carregamento e confirmação visual antes do redirecionamento.
- **Normalização e Desduplicação de Secções Judiciais:**
  - Deduplicação e canonicalização das secções nos filtros e agregações do Elasticsearch, resolvendo a duplicidade da "3ª Secção" em modo administrador.
  - Suporte resiliente a números de processo formatados com barra ou hífen na sincronização e importação.

---

## [0.3.0] - 2026-11-18

### Adicionado
- **Motor de Exportação Institucional para Microsoft Word (.docx):**
  - Geração de boletins em formato `.docx` de alta fidelidade visual via Pandoc HTML/Markdown.
  - Caixa delimitadora unificada com metadados do acórdão (Processo, Data, Relator, Descritores e Decisão).
  - Índice alfabético de descritores no início do boletim com correspondência de secções.
- **Boletim Composto de Múltiplas Pesquisas Guardadas:**
  - Capacidade de selecionar várias sessões guardadas e agregá-las num único boletim temático unificado.
- **Armazenamento Seguro de Sessões de Pesquisa:**
  - Validação de integridade criptográfica SHA-256 no carregamento de históricos de pesquisa armazenados localmente no browser.

### Corrigido
- Sanitização de termos de pesquisa e nomes de secções contendo parênteses nas consultas do Elasticsearch.
- Importação e validação de descritores descontinuados e resolução resiliente de relatores.

---

## [0.2.0] - 2026-10-21

### Adicionado
- **Motor de Geração de PDF via XeLaTeX:**
  - Criação de modelos institucionais do STJ com painel de juízes, compilações anuais e paginação sem páginas em branco.
- **Resiliência para Demonstração Offline:**
  - Suporte a cache e respostas pré-carregadas para utilização em ambientes de homologação sem ligação direta ao servidor central.

### Corrigido
- Ajuste de estilo e alinhamento do botão "Ver como Boletim" na barra de pesquisa.
- Correção de escape de barras e carateres especiais em números de processo no Elasticsearch.

---

## [0.1.0] - 2026-09-30

### Adicionado
- Lançamento inicial da plataforma web STJ Jurisprudência em Next.js e TypeScript.
- Pesquisa de texto livre sobre o acervo do STJ com realce de termos (*highlighting*).
- Resolução e roteamento por identificadores ECLI e número de processo.
- Painel de administração para gestão de estados de publicação (público, preparação, importação, privado, eliminado).
- Filtros multifacetados por secção, área jurídica, relator, meio processual e intervalo de datas.
