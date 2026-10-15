# Mercado Livre — ficha de integração (API de marketplace, site MLB)

> Consulta: 2026-10-14, só no portal oficial <https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br>.
> Nenhuma chamada foi feita à API (sem credencial). Arquivos máquina: `system.json`, `endpoints.json`, `openapi.yaml`, `tools.json`, `chunks.jsonl`, `faq.jsonl`.

## 1. Resumo comercial

### O que é
API REST pública do Mercado Livre para vendedores e integradores. Um único host (`https://api.mercadolibre.com`) atende vendas, envios, anúncios, preços, estoque (inclusive Full e multi-origem), perguntas, mensagens, reclamações e devoluções, faturamento das tarifas, notas fiscais do Faturador, visitas e reputação. O acesso a dados da loja é sempre autorizado pelo vendedor via OAuth 2.0.

### O que dá para fazer pela API (leitura, que é o que o Stagium executa)
- **Vendas por período**: `/orders/search` com período por data de criação, confirmação ou última alteração e situação; 12 meses de histórico.
- **Envios**: situação, logística (drop off, coleta, Full, Flex), rastreio, frete do comprador e custo do vendedor, prazo de despacho (SLA) e linha do tempo.
- **Anúncios e estoque**: todos os IDs do vendedor (com scan para mais de 1000), dados em lotes de 20, preço de venda com promoção, estoque por local e no Full (com motivos de indisponibilidade e movimentações).
- **Perguntas**: fila de perguntas sem resposta e tempo médio de resposta.
- **Pós-venda**: reclamações, mediações, cancelamentos e trocas por período; devoluções com situação do dinheiro.
- **Faturamento das tarifas**: períodos (valor e saldo em aberto), faturas, resumo por tipo de cobrança e detalhe venda a venda.
- **Fiscal**: NF-e emitida pelo Faturador Mercado Livre por pedido.
- **Métricas**: visitas por anúncio (até 150 dias) e diárias da loja; reputação com as métricas de 60 dias.

Escritas (publicar, alterar estoque/preço, responder perguntas, mensagens, reembolsos) estão documentadas, mas o assistente nunca executa.

### Custo e prazo
- API sem custo publicado; criar aplicativo é gratuito e imediato no DevCenter (titular com dados validados; no Brasil, 1 aplicativo por conta).
- Os Termos permitem ao Mercado Livre limitar chamadas e eventualmente cobrar pelo excedente.
- Certificação (Developer Partner Program) é opcional e exige GMV mensal de USD 2,5 milhões no Brasil.
- MVP de leitura estimado em **48 horas** (OAuth com conexão do vendedor e cofre com rotação de token, ~12 consultas, paginação offset/scroll, desdobramento de arrays).

### Índice de integrabilidade — 64/100

| Componente | Peso | Pontos | Por quê |
|---|---|---|---|
| Documentação | 20 | 15 | Portal em português, extenso, datado, com exemplos; sem OpenAPI, com exemplos inválidos e contradições pontuais |
| Sandbox | 15 | 7 | Não há sandbox; usuários de teste gratuitos em produção, com restrições |
| Autenticação | 15 | 13 | OAuth 2.0 com PKCE, scopes e permissões por área; refresh de uso único e token de 6 h |
| Webhooks | 15 | 10 | Muitos tópicos, reentrega 1 h e missed_feeds 2 dias; sem assinatura documentada |
| Limites e paginação | 10 | 6 | Paginação documentada (offset, scan, from_id); limite de requisições não publicado; tetos de offset |
| SDKs e comunidade | 10 | 3 | Sem SDK oficial apontado; MCP Server oficial da documentação |
| Acesso sem barreira | 10 | 8 | Self-service e gratuito; titular validado, 1 app por conta, cláusula de dados derivados |
| Versionamento | 5 | 2 | Sem versão; descontinuações frequentes por cabeçalho/parâmetro |

## 2. Ficha técnica

### Autenticação (OAuth 2.0 authorization code)
1. Aplicativo no DevCenter: redirect URI HTTPS fixo, permissões funcionais (Vendas e envios, Faturamento, Comunicação pré e pós-venda, Métricas, Publicação e sincronização) e scopes `read` + `offline_access` (o `write` não é necessário para o Stagium).
2. Vendedor (conta **administradora**; colaborador dá `invalid_operator_user_id`) abre `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=...&redirect_uri=...` (state recomendado, PKCE opcional).
3. Backend troca o `code` em `POST https://api.mercadolibre.com/oauth/token` (form-urlencoded).
4. `Authorization: Bearer <access_token>` em cada chamada. Access token: **6 horas**. Refresh token: **6 meses**, **uso único**, só o último vale; cada renovação devolve um novo.
5. Tokens caem antes se o vendedor trocar a senha, revogar o aplicativo, se o Client Secret for renovado ou após 4 meses sem uso.

`execucao_auth.tipo = oauth2_refresh_token`. Credenciais: `client_id`, `client_secret`, `refresh_token` (e `access_token` opcional). **Modelo recomendado**: aplicativo único do Stagium (client_id/secret da plataforma) e o cliente só autoriza pelo redirect; o refresh_token de cada vendedor fica no cofre. Pedir ao cliente o client_secret do aplicativo dele colide com os Termos (chaves são confidenciais e podem ser revogadas se reveladas).

### seller_id
`GET /users/me` → `id` (também vem como `user_id` na resposta do token). É usado em: `seller` (/orders/search), `/users/{id}/items/search`, `seller_id` (/questions/search e operações do Full), `players.user_id` (reclamações), `/users/{id}/items_visits/...`, `/users/{id}/invoices/...`, `/users/{id}/questions/response_time`. Ids novos passam de Int32.

### Ambientes
Sem sandbox. Uma URL só. Testes com até 10 usuários de teste por conta (`POST /users/test_user`), transações só entre eles; usuário de teste inativo 60 dias é removido.

### Limites
- Sem número global publicado; controle por Client ID e por endpoint (FAQ oficial). 429 `local_rate_limited` → backoff exponencial com jitter.
- Mensageria pós-venda: 500 rpm para leitura e 500 rpm para escrita.
- `/applications/{id}` expõe `max_requests_per_hour` (18000 no exemplo).
- Faturamento: 429 é bloqueio preventivo **por IP**; uma consulta por dia, sem paralelismo.

### Paginação
| Recurso | Estilo | Página | Observação |
|---|---|---|---|
| `/orders/search` | offset/limit | 50 nos exemplos (máx. não publicado) | total em `paging.total`; filtro de data só considera a hora |
| `/users/{id}/items/search` | offset/limit ou scan | padrão 50, máx. 100 | acima de 1000 só com `search_type=scan` + `scroll_id` (5 min); devolve só IDs |
| `/items/bulk` | lote | até 20 IDs | `attributes=body.campo,...` |
| `/questions/search` | offset/limit ou scan | 50 nos exemplos | total na raiz; sem filtro de data |
| `/post-purchase/v1/claims/search` | offset/limit | padrão 30, máx. 100 | offset+limit < 10000; período por `range` com milissegundos |
| Faturamento (details) | from_id/last_id ou offset | até 1000 | offset máx. 10.000 |
| Operações do Full | scroll | até 1000 | janela máx. 60 dias, últimos 12 meses |

### Datas e números
Respostas ISO 8601 com fuso (`-04:00` em muitos exemplos), UTC (`Z`/`+00:00`) em envios, visitas e devoluções, e **sem fuso** no faturamento. Filtros: pedidos `2026-08-01T00:00:00.000-03:00`; reclamações `range=date_created:after:2026-08-01T00:00:00.000-0300,before:...`; visitas e Full `AAAA-MM-DD`. Valores em reais, número JSON com ponto (não centavos).

### Webhooks
Configurados no DevCenter (URL + tópicos): `orders_v2`, `shipments`, `items`, `items_prices`, `questions`, `messages`, `post_purchase` (claims, claims_actions), `invoices`, `stock-location`, `user_products`, `payments`, `public_offers`, entre outros. POST curto com `resource`; o integrador faz GET no recurso. Responder 200 em até 500 ms; reentrega por 1 hora (8 tentativas); `GET /missed_feeds` guarda 2 dias. Sem assinatura documentada (há lista de IPs de origem). Aplicações com mais de 80% de erro têm as notificações desativadas.

### Erros
`401` token inválido/expirado; `403` permissão (inclui `PA_UNAUTHORIZED_RESULT_FROM_POLICIES` quando falta permissão funcional), IP, usuário inativo, app bloqueado; `429` excesso; `206` conteúdo parcial (pedidos com `X-Content-Missing`, faturamento); OAuth: `invalid_grant`, `invalid_client`, `invalid_scope`, `unsupported_grant_type`, `invalid_operator_user_id`, `unauthorized_application`.

### Endpoints canônicos detalhados (36: 33 leituras seguras + 3 que o assistente nunca executa)

| Id | Método e caminho | Paginação | Executável |
|---|---|---|---|
| mercado-livre.autenticacao.autenticar | POST /oauth/token | — | não (credencial) |
| mercado-livre.empresa.obter.usuario_atual | GET /users/me | — | sim |
| mercado-livre.empresa.obter | GET /users/{user_id} | — | sim |
| mercado-livre.pedido.listar | GET /orders/search | offset | sim |
| mercado-livre.pedido.obter | GET /orders/{order_id} | — | sim |
| mercado-livre.pedido.obter.descontos | GET /orders/{order_id}/discounts | — | sim |
| mercado-livre.pedido.obter.pack | GET /packs/{pack_id} | — | sim |
| mercado-livre.envio.listar.pedido | GET /orders/{order_id}/shipments | — | sim |
| mercado-livre.envio.obter | GET /shipments/{shipment_id} | — | sim |
| mercado-livre.envio.obter.custos | GET /shipments/{shipment_id}/costs | — | sim |
| mercado-livre.envio.consultar_status.historico | GET /shipments/{shipment_id}/history | — | sim |
| mercado-livre.envio.consultar_status.sla | GET /shipments/{shipment_id}/sla | — | sim |
| mercado-livre.anuncio.listar | GET /users/{user_id}/items/search | scroll (scan) | sim |
| mercado-livre.anuncio.listar.bulk | GET /items/bulk | lotes de 20 | sim |
| mercado-livre.anuncio.obter | GET /items/{item_id} | — | sim |
| mercado-livre.anuncio.obter.preco_venda | GET /items/{item_id}/sale_price | — | sim |
| mercado-livre.anuncio.calcular.custos_venda | GET /sites/{site_id}/listing_prices | — | sim |
| mercado-livre.anuncio.atualizar | PUT /items/{item_id} | — | não (escrita) |
| mercado-livre.estoque.obter | GET /user-products/{user_product_id}/stock | — | sim |
| mercado-livre.estoque.obter.fulfillment | GET /inventories/{inventory_id}/stock/fulfillment | — | sim |
| mercado-livre.estoque.listar.operacoes_fulfillment | GET /stock/fulfillment/operations/search | scroll | sim |
| mercado-livre.mensagem.listar.perguntas | GET /questions/search | offset | sim |
| mercado-livre.mensagem.obter.tempo_resposta | GET /users/{user_id}/questions/response_time | — | sim |
| mercado-livre.mensagem.enviar.resposta | POST /answers | — | não (escrita) |
| mercado-livre.contestacao.listar | GET /post-purchase/v1/claims/search | offset | sim |
| mercado-livre.contestacao.obter | GET /post-purchase/v1/claims/{claim_id} | — | sim |
| mercado-livre.contestacao.obter.devolucao | GET /post-purchase/v2/claims/{claim_id}/returns | — | sim |
| mercado-livre.conta_pagar.listar | GET /billing/integration/monthly/periods | offset | sim |
| mercado-livre.conta_pagar.listar.documentos | GET /billing/integration/periods/key/{key}/documents | offset | sim |
| mercado-livre.conta_pagar.obter.resumo | GET /billing/integration/periods/key/{key}/summary/details | — | sim |
| mercado-livre.transacao.listar.tarifas | GET /billing/integration/periods/key/{key}/group/ML/details | offset (ou from_id) | sim |
| mercado-livre.transacao.listar.tarifas_por_pedido | GET /billing/integration/group/ML/order/details | lotes de 60 | sim |
| mercado-livre.anuncio.obter.visitas | GET /items/visits | 1 por chamada | sim |
| mercado-livre.anuncio.listar.visitas_diarias | GET /users/{user_id}/items_visits/time_window | — | sim |
| mercado-livre.nota_fiscal.obter.pedido | GET /users/{user_id}/invoices/orders/{order_id} | — | sim |
| mercado-livre.webhook.listar.perdidas | GET /missed_feeds | offset | sim |

Outras 108 operações lidas nas mesmas páginas estão em `endpoints.json > endpoints_secundarios` (feedback, notas do pedido, itens/pagamentos/prazos do envio, variações, preços, promoções, mensagens, ações em reclamações, download de faturas e relatórios, notas em lote, tabelas auxiliares, gestão do aplicativo).

### Notas para o executor do site (`src/lib/executor.servidor.ts`)
- **Auth**: novo tipo `oauth2_refresh_token`: POST form-urlencoded em `token_url`, gravar `access_token` + **novo** `refresh_token` no cofre de forma atômica, trava por conta (sem renovação paralela), renovar uma vez no 401. Hoje o executor só faz `header_api_key` e `login_credenciais`.
- **Cabeçalhos por endpoint**: `execucao.headers` (`x-format-new: true` em `/shipments/*`; `X-New-Domain: true` em `/orders/{id}/shipments`).
- **Vendedor**: filtros com `papel: "vendedor"` ou caminho `{user_id}` recebem o `id` de `/users/me` (guardar no cofre junto da conexão).
- **Período**: os filtros de data vêm em `filtros_recomendados` com `papel` (`periodo_inicio`/`periodo_fim`/`periodo`) e `modelo`; o `gerar_conhecimento.py` só reconhece parâmetros `date` com nome inicial/final, então hoje não monta `order.date_created.from/to` nem o `range` das reclamações.
- **Paginação**: offset funciona; o scroll (`scroll_id` de anúncios, `paging.scroll` do Full) é lido no corpo, não nos registros como o executor faz hoje; `results` de anúncios é lista de strings (o `extrairLista` descarta não-objetos).
- **Duas etapas**: anúncios (IDs → `/items/bulk` em lotes de 20) e tarifas por pedido (lotes de 60).
- **Arrays**: `order_items`, `payments`, `sales_info`, `players` vêm como JSON na coluna; para uma linha por item é preciso desdobrar.

## 3. Armadilhas
1. Refresh token de uso único: renovações concorrentes derrubam a conexão.
2. Token de 6 horas; Power Query não mantém a rotação sozinho.
3. Só a conta administradora autoriza.
4. Sem sandbox; usuário de teste não pode interagir com conta real.
5. Busca de anúncios devolve só IDs; acima de 1000, scan com scroll de 5 minutos.
6. `/shipments` exige `x-format-new: true` e não traz mais `order_id`.
7. Pedidos só dos últimos 12 meses; filtro de data por hora; máximo do `limit` não publicado.
8. GET de mensagens pós-venda marca como lidas (use `mark_as_read=false`).
9. Faturamento só para conciliação, 1 vez por dia, 429 por IP; período ≠ mês civil; datas sem fuso.
10. Datas em três formatos de fuso; reclamações exigem milissegundos.
11. Muitas descontinuações datadas (`/items?ids=` até 25/10/2026, vista atual de `/orders/{id}/shipments`, `price` e `condition` em `/items`).

## 4. Conformidade
- Dado pessoal: ids e apelidos de compradores, endereço de entrega (após pagamento), dados fiscais (CPF/CNPJ no billing-info e na NF-e), mensagens. Sem dado sensível.
- Papéis (Termos, cláusula 6): vendedor = controlador; Stagium = operador.
- `permite_uso_em_produto_terceiro`: **sim**, com condições — aplicativo próprio do integrador autorizado pelo vendedor, chaves confidenciais, sem sublicenciar a API, sem armazenar dados de cartão, cópias mínimas e atualizadas a cada 24 h, autorização expressa do Mercado Livre para estatísticas derivadas (cláusula 5.4, a confirmar para relatórios do próprio vendedor), notificação de vulnerabilidade em 24 h e auditorias.
- Nome do aplicativo não pode conter "mercado", "livre", "pagamento", "envios" ou "crédito".
- Termos: <https://developers.mercadolivre.com.br/pt_br/termos-e-condicoes>.

## 5. Lacunas
- Executor sem suporte a OAuth com refresh rotativo, cabeçalhos por endpoint, scroll no corpo e consultas em duas etapas (alto).
- Cláusula 5.4 (estatísticas derivadas) e modelo "cliente entrega client_secret" sem posição explícita (alto).
- Limite numérico de requisições não publicado; sem Retry-After documentado (alto).
- Máximo de `limit`/`offset` em `/orders/search` não publicado; sentido de "continua a filtrar os pedidos cancelados" (médio).
- Sem assinatura em webhooks (médio). 429 do faturamento por IP afeta executor compartilhado (médio).
- Perguntas sem filtro de data e sem máximo de `limit` declarado (médio).
- Vista atual de `/orders/{id}/shipments` em transição (médio).
- Validade do `code` OAuth, envelope completo do detalhe de faturamento, `type` return x returns, limite de 20 em `/items/bulk` (baixo).
- Taxonomia: tarifas do marketplace, métricas, perguntas e devoluções sem entidade própria (baixo).

## 6. Onde a confiança é menor
- Viabilidade do Power Query (FAQ 13) é dedução a partir da rotação do refresh token (`inferido`).
- Envelope `results`/`last_id`/`total` do detalhe de faturamento ML: `results` e `last_id` estão no texto e no exemplo de boas práticas; `total` é inferido das demais rotas de billing.
- Máximo de 100 por página em perguntas e de 20 IDs em `/items/bulk` vêm de seções vizinhas.
- Interpretação dos Termos é leitura do texto, não parecer jurídico.

## 7. Monitoramento
Mensal. Novidades: <https://developers.mercadolivre.com.br/devcenter/news/>; comunicados por API: `GET /communications/notices` (token do titular do aplicativo).

## 8. Fontes (consulta 2026-10-14)
Autenticação e Autorização; Crie uma aplicação; Permissões funcionais; Gerencie seu aplicativo; Desenvolvimento in-house; Realização de testes; Boas práticas; Gerenciar IPs; Erro 403; FAQ Rate limit / 429; FAQ Billing info; Consulta de usuários; Usuários e Aplicativos; Reputação de vendedores; Gerenciar orders; Pedidos e opiniões; Packs; Envios; Status e rastreamento; Busca de itens; Publicar produtos; Sincronização de publicações; Preços; Custos por vender; Estoque distribuído; Estoque multi-origem; Envios Fulfillment; Perguntas e respostas; Mensagens pós-venda; Reclamações; Devoluções; Boas práticas e Relatórios de faturamento; Provisões; Relatórios de pagamentos; Baixar documento legal; Notas fiscais; Visitas; Notificações; Termos e Condições; Developer Partner Program; MCP Server. Links completos em `system.json > fontes`.
