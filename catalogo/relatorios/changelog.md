# Changelog do catálogo

## 2026-10-14 — Mercado Livre e Qive (Arquivei) documentados (lote P3)

- **mercado-livre documentado** (índice 64), a pedido do usuário: 36 endpoints detalhados (33 leituras executáveis) e 108 catalogados, 17 perguntas de FAQ. OAuth 2.0 com refresh token de uso único (access 6 h, refresh 6 meses); pedidos, envios, anúncios, estoque/Full, perguntas, reclamações, faturamento e visitas. Relatório em `relatorios/mercado-livre.md`.
- **arquivei documentado como Qive** (índice 54): rebranding confirmado, hosts da API seguem em arquivei.com.br. 49 endpoints detalhados (38 leituras executáveis) e 30 catalogados, 18 perguntas de FAQ. Dois cabeçalhos fixos (`X-API-ID`, `X-API-KEY`), buscas POST com cursor no corpo, sandbox gratuito. Relatório em `relatorios/arquivei.md`.
- Nenhum dos dois roda ainda no site: o executor precisa de OAuth com refresh rotativo (Mercado Livre) e de dois cabeçalhos, leituras POST e XML em Base64 (Qive).
- Manifest: lote P3 criado e concluído; mercado-livre sai do lote 5 e arquivei do lote 20.

## 2026-10-09 — Nomus ERP documentado (lote P2)

- **nomus documentado** (índice 29), adiantado da cauda longa a pedido do usuário: 35 endpoints detalhados (31 leituras executáveis e 4 escritas de referência) e 159 catalogados, 17 perguntas de FAQ. Fontes: coleção Postman oficial (191 requisições) e seção API REST da Central de Ajuda. Relatório em `relatorios/nomus.md`.
- Chave fixa em `Authorization: Basic <chave>` (receita `header_api_key` com prefixo), URL base por cliente, páginas fixas de 50 e limite publicado de 1 requisição a cada 20 s. O executor do site precisa de ajuste para paginar sem parâmetro de tamanho, esperar 20 s e montar filtros dentro do parâmetro `query`.
- Manifest: lote P2 criado e concluído; nomus sai do lote 43 e da cauda longa.

## 2026-09-21 — Passagem do projeto

- O proprietário assume a captação de clientes; a parte técnica passa para outro funcionário.
- `COMECE-AQUI.md` na raiz do repositório: produto, estado atual, mapa do repositório, como rodar, processo de lotes com modelo de instrução para agentes, decisões tomadas, pendências priorizadas e cuidados.
- `scripts/gerar_indice.py` e `relatorios/indice-sistemas.md`: visão única dos 10 sistemas, com índice, endpoints, autenticação, armadilhas e lacunas.
- Manifest: lote P1 (SyGeCom) marcado como concluído.

## 2026-09-18 — Site ligado à IA e ao Sagi

- Site passa a consultar o modelo no servidor (`ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` em variável de ambiente) com o conhecimento gerado do catálogo.
- Escopo do piloto restrito ao Sagi (SyGeCom): 14 consultas executáveis.
- Executor no servidor faz login no Sagi, pagina e devolve as linhas; credenciais pedidas em formulário, mantidas na memória do navegador e nunca enviadas ao modelo.
- Dados fictícios removidos do site.
- Repositório tornado público a pedido do proprietário, após varredura sem nenhuma chave no histórico.

## 2026-09-18 — Lote 3 concluído

- nfe-io (69), plugnotas (62), sefaz-nfe (43). Detalhes em `relatorios/lote-03.md`.
- Catálogo: 10 sistemas concluídos, 512 endpoints detalhados, 858 catalogados e 271 executáveis.
- Novo tipo de autenticação **`certificado_icp_brasil`** (SEFAZ, e futuramente CT-e, MDF-e, eSocial, EFD-Reinf): criado na especificação, aceito pelo validador e recusado com explicação pelo executor, que não faz assinatura XML.
- Site do assistente publicado no repositório (chat em demonstração, com download de planilha). O campo de URL do backend foi retirado da tela por decisão do usuário, até o backend existir.

## 2026-09-17 — SyGeCom (ERP do cliente) e login por usuário e senha

- **sygecom documentado** (índice 39): a hipótese de documentação fechada estava errada — a SyGeCom publica spec OpenAPI 3.0.1 aberta, com 79 operações. 16 endpoints detalhados (14 executáveis) e 63 catalogados.
- Novo tipo de autenticação **`login_credenciais`** na especificação, no validador e no executor: ERPs que autenticam com usuário e senha e devolvem token, com corpo do login descrito por máquina.
- Executor testado com o formato do Sagi: login, token, consulta e planilha; senha errada é recusada antes de qualquer consulta.
- Executor passou a aceitar `base_url` vinda das credenciais, para padrões e instalações sem host fixo.
- Catálogo publicado no GitHub (hubsolucoes/jhow), em `catalogo/`, sem tocar no projeto do Lovable. Script `catalogo/scripts/publicar.sh`.

## 2026-09-17 — Taxonomia v1.2 e início do Lote 3

- `taxonomia.json` 1.2.0, aprovada pelo usuário: entidades `Relatorio`, `Contestacao`, `Cartao`, `Plano` e `LocationPagamento`; ação `desvincular`; descrição de `Endereco` ampliada para incluir endereço cadastrado de cliente.
- Reclassificação aplicada em 4 sistemas (mapeamentos em `mapeamentos/v1_2_*.json`), com backup da v1.1 no scratchpad:
  - Pix: os 8 endpoints de location viraram `LocationPagamento`, e os 2 DELETE de vínculo passaram de `excluir` para `desvincular` (deixam de ser marcados como destrutivos);
  - Pagar.me: cartões e tokens viraram `Cartao`, planos viraram `Plano`, disputas viraram `Contestacao`;
  - Mercado Pago: relatórios de liberação e de dinheiro em conta viraram `Relatorio`, contestações viraram `Contestacao`, cartões e planos idem;
  - Asaas: chargebacks viraram `Contestacao`; tokenização e pré-autorização viraram `Cartao`.
- Distribuição resultante: Relatorio 20, Cartao 15, Plano 13, Contestacao 10, LocationPagamento 8.
- Validador: 0 erros nos 6 sistemas.
- SyGeCom (ERP do cliente do usuário) entrou como prioritário, fora da fila: o usuário informou a API do Sagi (api.sagierp.com.br).
- Lote 3 iniciado com NFE.io e PlugNotas; SEFAZ segurada para não repetir o estouro de limite de uso.

## 2026-09-17 — Lote 2 concluído

- pix-bacen (64), pagarme (66), mercado-pago (82). Detalhes em `relatorios/lote-02.md`.
- Catálogo: 6 sistemas, 351 endpoints detalhados, 166 executáveis pelo assistente.
- Lote 1 complementado com `execucao_auth` e bloco `execucao` em todos os endpoints.
- Validador: removidos os avisos de Power Query, obsoletos com os kits em standby; `base_url`, `token_url` e `escopos` viram nomes estáveis de credencial (padrões sem host fixo, como o Pix).
- Executor: passou a aceitar leitura via POST, paginação por versão e lista na raiz; limite de 500 páginas por consulta.
- Incidente: dois agentes no mesmo sistema (pagarme) depois que um agente caído voltou a rodar ao receber mensagem. Arquivos íntegros; regra nova de conferir agentes ativos antes de relançar.

## 2026-09-17 — Produto passa a executar a consulta pelo cliente

- Nova direção: o assistente pergunta o que o cliente quer, acha o endpoint, pede aprovação, **executa a consulta com a credencial do cliente** e devolve a planilha preenchida. Detalhes em `relatorios/arquitetura-execucao.md`.
- Decisões do usuário: **somente leitura**; **credenciais em cofre no backend**; **kits Power Query em standby** (serviço premium futuro; Asaas, Focus NFe e Bling ficam como estão e não se produz kit novo).
- Especificação: seção 6.1 (`execucao_auth`) e seção 7.1 (bloco `execucao` por endpoint, com lista, paginação, filtros e colunas).
- Validador: exige os dois blocos e recusa `seguro_para_executar` divergente da ação canônica. FAQ não exige mais perguntas com código Power Query.
- `scripts/executar.py`: protótipo com buscar/detalhar/puxar, testado contra servidor local — 23 registros em 3 páginas, planilha com aba de informações, recusa de escrita e erro claro com credencial inválida.
- `credenciais/` criada, protegida por `.gitignore`, com instruções.
- Lote 2 e a complementação do Lote 1 caíram por limite de uso da sessão às 14h5x; retomados às 15h.

## 2026-09-17 — Taxonomia v1.1 e reclassificação do Lote 1

- `taxonomia.json` 1.1.0, aprovada pelo usuário:
  - ações `encerrar`, `manifestar`, `restaurar` e `liquidar`;
  - entidades `Recebivel`, `Deposito`, `OrdemProducao` e `Anuncio`;
  - subtipos fiscais `nfsen`, `cte_os`, `nfcom`, `dce` e `nfgas`.
- `scripts/reclassificar.py` troca ids e classificação em todos os arquivos de um sistema (mapeamentos em `mapeamentos/v1_1_*.json`). Backup da versão 1.0 no scratchpad da sessão.
- Ids renomeados:
  - `focus-nfe.nota_fiscal.atualizar.encerrar_mdfe` → `focus-nfe.nota_fiscal.encerrar.mdfe`
  - `focus-nfe.nota_fiscal.emitir.manifesto_nfe_recebida` → `focus-nfe.nota_fiscal.manifestar.nfe_recebida`
  - `bling.estoque.listar.depositos` → `bling.deposito.listar`
  - `bling.pagamento.criar.baixa_receber` → `bling.conta_receber.liquidar`
  - `bling.pagamento.criar.baixa_pagar` → `bling.conta_pagar.liquidar`
- Endpoints secundários reclassificados:
  - Asaas: 15 (restore → `restaurar`; antecipações → `Recebivel`; escrow e encerramento de subconta → `encerrar`);
  - Bling: 17 (anúncios, depósitos, ordens de produção).
- Removidas as notas e a lacuna que diziam "a taxonomia não tem…". Nomes de função nos snippets do Bling alinhados aos novos ids.
- Validador: 0 erros nos três sistemas.

## 2026-09-17 — Ajuste de visão do produto

- O produto é um **assistente de IA em chat**, que explica a API do sistema do cliente e entrega código. O catálogo é a base de conhecimento dele.
- Código por endpoint passa a incluir **Power Query M** (só em ações de leitura, porque o refresh reexecuta a consulta) e **VBA** (todas as ações), além de cURL/Python/TypeScript. Novo campo `snippets_observacao`.
- Novo arquivo por sistema: `faq.jsonl`, com no mínimo 12 perguntas de chat e pelo menos 2 com código de BI. `tools.json` mantido por decisão do usuário.
- `validar.py` agora checa M (inclusive bloqueando M em ação de escrita), VBA e FAQ.
- **Kit pronto por sistema** (`sistemas/<slug>/kit/`, seção 5.1 da especificação), com versões Power Query, VBA, Python e TypeScript. A empresa preenche só as credenciais e o ambiente, que fica em sandbox por padrão. O validador exige os arquivos do kit, bloqueia credencial fora dos arquivos de configuração e bloqueia escrita em Power Query.
- **VBA removido do escopo** (decisão do usuário).
- **Planilha Excel com Power Query gerada automaticamente:**
  - `scripts/gerar_planilha.ps1` monta o `.xlsx` via Excel com as abas LEIA-ME e Config (tabela `tbConfig`), mais uma aba por consulta.
  - `scripts/testar_planilha.ps1` simula o uso: preenche a Config e executa Atualizar Tudo.
  - Protótipo com a API pública do IBGE: 27 UFs carregadas depois de preencher só a Config.
  - Formula.Firewall: sem ajuste o refresh falha; com a config lida dentro da função, o Excel exige que o usuário configure privacidade. Solução adotada: `Queries.FastCombine = true` gravado no arquivo.
- Lote 1 foi interrompido sem arquivos salvos. Os agentes foram retomados com a especificação nova.
- **Lote 1 concluído:** asaas (78), focus-nfe (67), bling (64). Detalhes em `relatorios/lote-01.md`.
- Especificação: nova regra 2.1 sobre chamadas a APIs reais, criada depois do bloqueio de IP pela Focus NFe.
- Protótipo `fnApi`: passa a tratar o status nulo que o Excel devolve em 401/403.

## 2026-09-14 — Fase 1 (Taxonomia) e início do Lote 1

- Plano aprovado pelo usuário; lotes rodam com 1 agente por sistema em paralelo.
- `taxonomia.json` v1.0.0:
  - 27 entidades originais + 5 de extensão: Autenticacao, Webhook, Empresa, TabelaAuxiliar, Endereco.
  - 12 ações originais + 8 de extensão: excluir, calcular, enviar, validar, corrigir, inutilizar, assinar, autenticar.
  - 62 campos canônicos brasileiros.
- Desambiguação: `Assinatura` = recorrência; assinatura eletrônica = `Contrato`/`Documento` com ação `enviar`/`assinar`.
- Nome de ferramenta MCP = id canônico com `.` trocado por `__`, para compatibilidade com clientes que exigem `^[a-zA-Z0-9_-]{1,64}$`.
- `glossario_br.json`: 54 termos, marcados `verificado: false` até conferência na fonte oficial.
- `ESPECIFICACAO.md`: regras consolidadas para os agentes de lote.
- `scripts/validar.py`: verifica automaticamente a Definition of Done — schemas, taxonomia, OpenAPI 3.1, JSON Schema das tools, chunks e varredura de segredos. Roda no venv `.venv`.
- Lote 1 (asaas, focus-nfe, bling) em andamento.

## 2026-09-14 — Fase 0 (Planejamento)

- Criado `manifest.json` v0.1.0: 146 sistemas em 4 ondas e 43 lotes — 126 em lotes de 3 (lotes 1–42) + 20 na cauda longa (lote 43, a ser quebrado depois). JSON validado: sem slugs duplicados e todo sistema está em algum lote.
- Scores de prioridade são **estimativas de planejamento** (`confianca: inferido`) e serão revisados com evidência ao fim de cada lote.
- Incluídos fora da lista original: Stark Bank, Unico, Transfeera, Cora, Superlógica, Hotmart, iFood, Olist.
- Fusões propostas: Gov.br Login + Assina; Pix como padrão de referência para PSPs.
- Status: aguardando aprovação para iniciar a Fase 1 (taxonomia + glossário).
