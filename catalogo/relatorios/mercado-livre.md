# Relatório do agente — Mercado Livre (lote 5, 2026-10-14)

```
SISTEMA: mercado-livre
STATUS: documentado
ENDPOINTS: 36 detalhados + 108 catalogados
FAQ: 17 perguntas
INDICE: 64 — doc oficial extensa em português e OAuth 2.0 completo, mas sem sandbox (usuários de teste em produção), sem limite de requisições publicado, webhooks sem assinatura, sem SDK oficial e descontinuações frequentes
VALIDADOR: 0 erros, 0 avisos
LACUNAS RELEVANTES: executor sem OAuth com refresh rotativo, cabeçalhos por endpoint, scroll no corpo e consultas em duas etapas; cláusula 5.4 dos Termos (estatísticas derivadas) e modelo "cliente entrega client_secret" sem posição explícita; limite numérico de requisições e Retry-After não publicados; máximo de limit/offset de /orders/search e sentido de "continua a filtrar os cancelados"; 429 do faturamento por IP (executor compartilhado); perguntas sem filtro de data; vista de /orders/{id}/shipments em transição; webhooks sem assinatura
MENOR CONFIANÇA: viabilidade do Power Query (FAQ 13, inferido); envelope total/last_id do detalhe de faturamento ML; limite de 100 em perguntas e de 20 IDs em /items/bulk tirados de seções vizinhas; leitura dos Termos não é parecer jurídico; nenhuma chamada real feita (sem credencial)
SURPRESAS / AJUSTES SUGERIDOS À TAXONOMIA: entidade TarifaMarketplace (hoje Transacao.listar.tarifas e ContaPagar para períodos/faturas); Metrica (visitas, tempo de resposta, reputação, hoje em Anuncio/Mensagem/Empresa com qualificador); Pergunta (hoje Mensagem.listar.perguntas); Devolucao (hoje Contestacao.obter.devolucao)
```

## Notas para o orquestrador

- **Autenticação:** `execucao_auth.tipo = oauth2_refresh_token`, header `Authorization`, prefixo `Bearer `, `token_url = https://api.mercadolibre.com/oauth/token` (POST form-urlencoded: grant_type=refresh_token, client_id, client_secret, refresh_token). Access token 6 h (`expires_in` 21600); refresh token 6 meses, **uso único e rotativo** (só o último vale). Credenciais: `client_id`, `client_secret`, `refresh_token` (+ `access_token` opcional). Modelo recomendado: aplicativo do Stagium; o cliente só autoriza pelo redirect `https://auth.mercadolivre.com.br/authorization` com a conta administradora (colaborador dá `invalid_operator_user_id`), e o cofre guarda o refresh_token de cada vendedor. Scopes necessários: `read` + `offline_access` (não pedir `write`); permissões funcionais Vendas e envios, Faturamento, Comunicação pré e pós-venda, Métricas, Publicação e sincronização.
- **seller_id:** `GET /users/me` → `id` (também `user_id` na resposta do token).
- **URL base:** única, `https://api.mercadolibre.com`; sem sandbox.
- **Paginação:** offset/limit na maioria (pedidos 50 nos exemplos, anúncios até 100, reclamações até 100 com offset+limit < 10000, faturamento até 1000); scan + `scroll_id` (5 min) para anúncios e perguntas acima de 1000; `paging.scroll` nas operações do Full; `from_id`/`last_id` no faturamento.
- **Limites:** sem número global; 429 `local_rate_limited` com backoff + jitter; mensageria 500 rpm; faturamento 429 por IP e uma consulta por dia.
- **Cabeçalhos por endpoint:** `x-format-new: true` em `/shipments/*`, `X-New-Domain: true` em `/orders/{id}/shipments` (em `execucao.headers`).
- **Filtros de período:** em `filtros_recomendados` com `papel` (`periodo_inicio`, `periodo_fim`, `periodo`) e `modelo` (ex.: `{data_inicial}T00:00:00.000-03:00`; `range=date_created:after:...,before:...` nas reclamações). Usei `modelo` e não `expressao` de propósito, para o `gerar_conhecimento.py` não montar `query_composta` no estilo Nomus.
- **Termos:** `permite_uso_em_produto_terceiro = sim`, com as condições registradas (aplicativo próprio, chaves confidenciais, cláusula 5.4 a confirmar, sem sublicenciar, cópias mínimas atualizadas a cada 24 h).
- **Fontes lidas:** 68 páginas do portal (texto extraído do HTML servidor), incluindo os Termos completos. Nenhuma chamada à API do Mercado Livre.

### Entrada sugerida para o manifesto (não editei)

```json
"status": "concluido",
"concluido_em": "2026-10-14",
"endpoints_detalhados": 36,
"endpoints_catalogados": 108,
"faq": 17,
"indice_integrabilidade": 64,
"validador": "0 erros, 0 avisos",
"execucao": {"completo_em": "2026-10-14", "endpoints_executaveis": 33, "endpoints_total": 36},
"pendencias": [
  "executor precisa do tipo oauth2_refresh_token com refresh_token rotativo gravado de forma atômica e sem renovação concorrente",
  "cabeçalhos por endpoint (x-format-new em /shipments, X-New-Domain em /orders/{id}/shipments)",
  "seller_id de /users/me injetado nos filtros papel=vendedor e no caminho {user_id}",
  "gerar_conhecimento não monta os filtros de período do ML (order.date_created.from/to, range das reclamações)",
  "scroll lido no corpo (scroll_id, paging.scroll) e listas de strings (IDs de anúncios)",
  "consultas em duas etapas: IDs -> /items/bulk (20 por lote); pedidos -> tarifas por pedido (60 por lote)",
  "sem sandbox: teste de leitura na conta real do vendedor, só GET",
  "limite de requisições não publicado; faturamento com 429 por IP",
  "cláusula 5.4 dos Termos (estatísticas derivadas) a confirmar com o Mercado Livre"
]
```

### O que o executor do site precisa ganhar para rodar estas leituras

1. **`oauth2_refresh_token`** em `autenticar()`: ler `client_id`, `client_secret` e `refresh_token` do cofre; se não houver `access_token` válido, POST form-urlencoded em `token_url`; gravar o novo `refresh_token` e o `access_token` (com validade de `expires_in`) **antes** de usar; trava por conta para não renovar em paralelo; no 401, renovar uma vez e repetir. Como o refresh é rotativo, a credencial não pode ser "usada e descartada" como hoje: o executor precisa devolver ao cofre o valor novo.
2. **Cabeçalhos por endpoint** (`execucao.headers`) somados aos `headers_fixos`.
3. **Vendedor**: guardar o `seller_id` da conexão (de `/users/me` ou do `user_id` do token) e preencher `seller`, `seller_id`, `players.user_id` e `{user_id}`.
4. **Períodos**: montar os parâmetros de data a partir de `filtros_recomendados[].papel/modelo` (o planejador atual só reconhece parâmetros `date` com nome inicial/final).
5. **Paginação por cursor no corpo**: usar `campo_proximo` como caminho na resposta (`scroll_id`, `paging.scroll`) em vez de procurar o maior valor nos registros; tratar `parametros_fixos` (`search_type=scan`).
6. **Listas de valores simples**: `extrairLista` hoje descarta strings; `lista_de_valores_simples: true` (IDs de anúncios) precisa virar linhas com uma coluna.
7. **Duas etapas e lotes**: `segunda_etapa`/`lote_de_ids` (IDs → `/items/bulk` em 20; pedidos → `/billing/.../order/details` em 60; visitas 1 por chamada).
8. **429**: backoff exponencial com jitter (não abortar na primeira) e, no faturamento, serializar por IP.

Arquivos: `sistemas/mercado-livre/` (system.json, endpoints.json, openapi.yaml, tools.json, chunks.jsonl, faq.jsonl, ficha.md, perguntas-ao-fornecedor.md).
