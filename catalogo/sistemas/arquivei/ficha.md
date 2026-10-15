# Qive (antiga Arquivei) — API de gestão de documentos fiscais

> Slug do catálogo: `arquivei` (mantido após o rebranding). Categoria: `fiscal_gateway`.
> Levantamento em **2026-10-14** sobre o Swagger oficial "Qive API" v1.105.0
> (<https://docs.arquivei.com.br/arquivei-apis-swagger/dfe-api.json>), o Portal do Desenvolvedor
> (<https://developers.qive.com.br>), a Central de Ajuda da Qive e os Termos de Uso.
> Nenhuma chamada foi feita à API (sem credenciais).

## 1. Resumo comercial

### O que é

A **Qive** é o novo nome da **Arquivei**: a Central de Ajuda oficial anuncia que "Arquivei agora é Qive", a plataforma foi para
`app.qive.com.br` e o portal de desenvolvedores para `developers.qive.com.br`. A empresa é a Arquivei Serviços On Line Ltda., de São
Carlos (SP). O produto captura automaticamente, na SEFAZ e nas prefeituras, os documentos fiscais emitidos pelos CNPJs do cliente ou
contra eles (NF-e, NFC-e, CT-e, CT-e OS, NFS-e e MDF-e), guarda os XMLs, faz a manifestação do destinatário e, no módulo Gestão de
Pagamentos, captura boletos e comprovantes e os concilia com as notas. **Os endereços técnicos da API não mudaram**: continuam em
`api.arquivei.com.br`, `sandbox-api.arquivei.com.br` e `docs.arquivei.com.br`.

### O que dá para fazer pela API (leitura, que é o que o assistente executa)

- **NF-e recebidas e emitidas** por data de emissão, status, CNPJ, CFOP, finalidade, tags (`POST /v2/dfe/nfe`, API 2.0).
- **CT-e** (com filtro de tomador) e **CT-e OS**; **MDF-e** com totais de carga.
- **NFS-e** prestadas e tomadas, por emissão ou competência, com XML ABRASF padronizado pela Qive.
- **NFC-e emitidas** (rota GET clássica).
- **Eventos**: fila de cancelamentos, cartas de correção e manifestações de NF-e, CT-e e NFS-e; eventos de uma chave.
- **Situação da manifestação do destinatário** por chave.
- **XML** (Base64) de qualquer documento e **PDF** (DANFE, DACTE, DACTE OS, DANFSE) em Base64.
- **Boletos a pagar** com as notas vinculadas, **PDF do boleto** e **comprovantes de pagamento**.
- **Dados públicos de CNPJ** (até 100 por chamada), CNPJs da conta, etiquetas e properties.

Escritas documentadas (o assistente **não** executa; explica e entrega código): manifestação do destinatário de NF-e (assíncrona e
síncrona), evento do tomador em NFS-e nacional, upload de XMLs, configuração de webhooks e, no catálogo secundário, properties,
etiquetas, eventos da reforma tributária, eventos em lote, certificado digital, OCR e LATAM.

### Custo e prazo

- A API é cobrada à parte da assinatura da plataforma, por volume de documentos, **sob proposta** (sem tabela pública). A API Lite é
  vendida em pacotes mensais de requisições não cumulativos. Campos comerciais são voláteis.
- Sandbox **gratuito e self-service**. Produção: credenciais emitidas pela equipe da Qive após a contratação (prazo não publicado).
- MVP de leitura estimado em **40 horas** (premissa em `system.json > esforco_integracao`).

### Índice de integrabilidade — 54/100

| Componente | Pontos | Por quê |
|---|---|---|
| Documentação (20) | 14 | Swagger 2.0 oficial completo e baixável, em português; perde por rotas v1 sem cabeçalhos declarados, grafias divergentes, estrutura do `Document` e fim da paginação não documentados. |
| Sandbox (15) | 12 | Gratuito, self-service, credenciais na hora, notas sintéticas; UAT com dados reais sob pedido. Algumas rotas só em produção. |
| Autenticação (15) | 6 | Par fixo de chaves em cabeçalho, sem OAuth, escopo ou expiração; ganha pela chave de permissão para parceiros. |
| Webhooks (15) | 6 | API nova de endpoints/subscriptions para NF-e, com verificação de URL e reativação; sem formato de corpo, assinatura ou reentrega documentados. |
| Limites e paginação (10) | 7 | Cursor estável, páginas de até 500, cabeçalhos de rate limit e Retry-After; limite numérico por cliente e não publicado. |
| SDKs e comunidade (10) | 2 | Nenhum SDK; o Swagger permite gerar cliente. |
| Acesso sem barreira (10) | 4 | Docs e sandbox abertos; produção exige contratar a API e receber credenciais da Qive. |
| Versionamento (5) | 3 | v1/v2 no caminho e versão no Swagger; sem changelog nem política de depreciação. |

## 2. Ficha técnica

### Autenticação

- Dois cabeçalhos em toda requisição: **`X-API-ID`** e **`X-API-KEY`**. Sem login, sem token temporário, sem OAuth, sem escopos.
- As rotas novas (API 2.0 de busca, boletos, comprovantes, etiquetas, CNPJ e webhooks) exigem também **`X-Use-ApiGateway: always`**.
- O Swagger declara ainda **`X-API-PERMISSION-KEY`** (chave de permissão de parceiro): segundo o FAQ, permite que um parceiro acesse a
  conta do cliente com credenciais próprias, restritas às empresas autorizadas. O procedimento para obtê-la não é documentado.
- Onde obter: **sandbox** no formulário de <https://developers.qive.com.br/sandbox> (credenciais na tela e por e-mail); **produção**
  com a equipe da Qive após a contratação. Novos CNPJs da conta precisam ser liberados para a API pela Qive.
- `execucao_auth` usa `header_api_key` com a extensão `headers_credenciais` (`X-API-ID ← api_id`, `X-API-KEY ← api_key`,
  `X-API-PERMISSION-KEY ← api_permission_key`, opcional), porque a especificação do catálogo só prevê um cabeçalho.

### Ambientes

| Ambiente | URL base | Observação |
|---|---|---|
| Produção | `https://api.arquivei.com.br` | Documentos capturados após a liberação do ambiente; sem busca retroativa anterior à contratação. |
| Sandbox | `https://sandbox-api.arquivei.com.br` | Gratuito, notas sintéticas sem validade jurídica, com o CNPJ do interessado. |
| UAT | sob pedido | Ambiente não produtivo com dados reais. |
| API Lite | `https://lite-api.arquivei.com.br` | Produto separado: XML e status de NF-e por chave, sem certificado, em pacotes de requisições. |

### Limites

- Limite de requisições **definido por cliente** (FAQ do portal), sem número público.
- Respostas v1 trazem `X-RateLimit-Limit` e `X-RateLimit-Remaining`; o **429** traz `Retry-After` (segundos) e `X-RateLimit-Reset`.
- Comprovantes: corpo até 1 MiB, resposta até 60 s, PDF para no máximo 2 identificadores por chamada em produção.

### Paginação

- **API 2.0 (POST)**: cursor opaco no **corpo** (`Paginator`; `paginator` na NFS-e; `next` nos boletos v2), devolvido na raiz da
  resposta (`meta.next` nos boletos). `Limit` padrão e máximo 500 em NF-e, CT-e e CT-e OS (comprovantes: padrão 50, máximo 500;
  a ajuda recomenda blocos de até 100). Fim documentado só em comprovantes (Paginator vazio) e boletos v2 (`meta.next` nulo).
- **API 1.0 (GET)**: `cursor` numérico e fixo por documento (0 reprocessa tudo), `limit` até 50, próximo em `page.next`.
- Boletos v1 e listas de webhooks: `page`/`limit` (webhooks até 200).

### Filtros e datas

- API 2.0: `EmissionDate` (emissão) e `CreatedAt` (entrada na Qive) com `From`/`To` em `AAAA-MM-DD HH:MM:SS`; sem `EmissionDate`, a
  busca de NF-e usa os últimos 30 dias. NFS-e aceita `competence` (`AAAA-MM`).
- API 1.0: só `created_at[from]`/`created_at[to]` — **data de entrada na Qive, não de emissão** —, obrigatórios em par; `cnpj[]`,
  `access_key[]` e `filter` de properties em notação prefixada (`(= processed true)`, `(NOT_EXISTS processed)`).

### Conteúdo e colunas

- XML e PDF sempre em **Base64** dentro do JSON.
- A busca de NF-e não devolve **valor total, série nem natureza da operação**: estão no XML (`infNFe/total/ICMSTot/vNF`, `ide/serie`,
  `ide/natOp`). O catálogo registra esses caminhos em `execucao.colunas_do_xml` como **inferidos** do layout nacional.

### Webhooks

Recentes (Swagger v1.105.0): cadastro de endpoint `https:443` verificado por HEAD com `X-Qive-Webhook: Qive-Webhooks/1.0`, `Secret`
`whsec_...` devolvido uma única vez, subscriptions por CNPJ + `nfe` + `document.received`/`document.canceled`, desativação após 20
falhas consecutivas e reativação. Não documentados: corpo da notificação, uso do Secret para assinar e intervalo de reentrega. O
artigo de ajuda da API ainda diz que não há webhooks.

### Erros

| Status | Quando |
|---|---|
| 400 | Corpo ou parâmetro inválido (comprovantes rejeitam caixa errada de chave); nos webhooks, também cabeçalhos ausentes. |
| 401 | Credencial inválida, respondida pelo gateway: `{"error": "Unauthorized. Invalid X-API-KEY or X-API-ID.", "status": {...}}`. |
| 403 | CNPJ fora dos autorizados (evento de NFS-e, subscription, upload). |
| 404 | Documento/recurso inexistente ou de outra conta (nunca 403). |
| 409 | Webhooks: URL/subscription duplicada, endpoint com subscriptions. |
| 422 | PDFs auxiliares (causa não detalhada); URL de webhook que não respondeu 2xx. |
| 429 | Limite de requisições (Retry-After). |
| 500/502 | Erro interno; 502 nos comprovantes quando o PDF falha. |

Formatos variam por geração de rota: v1 `{"status": {"code", "message"}, "error"}`, API 2.0 `{"code", "message"}`, webhooks e
comprovantes `{"error": {"code", "message", "context"}}`.

### Endpoints canônicos detalhados (49: 38 leituras seguras, 11 escritas)

| Id | Método e caminho | Seguro executar | Paginação |
|---|---|---|---|
| `arquivei.nota_fiscal.listar.nfe` | POST `/v2/dfe/nfe` | sim | cursor |
| `arquivei.nota_fiscal.listar.cte` | POST `/v1/dfe/cte` | sim | cursor |
| `arquivei.nota_fiscal.listar.nfse` | POST `/v1/dfe/nfse` | sim | cursor |
| `arquivei.nota_fiscal.listar.cteos` | POST `/v1/dfe/cteos` | sim | cursor |
| `arquivei.nota_fiscal.listar.mdfe` | POST `/v1/dfe/mdfe` | sim | cursor |
| `arquivei.nota_fiscal.listar.nfe_por_papel` | GET `/v1/nfe/{role}` | sim | cursor |
| `arquivei.nota_fiscal.listar.nfse_por_papel` | GET `/v1/nfse/{role}` | sim | cursor |
| `arquivei.nota_fiscal.listar.nfse_recebidas_v2` | GET `/v2/nfse/received` | sim | cursor |
| `arquivei.nota_fiscal.listar.cte_por_papel` | GET `/v1/cte/{role}` | sim | cursor |
| `arquivei.nota_fiscal.listar.cteos_por_papel` | GET `/v1/cte-os/{role}` | sim | cursor |
| `arquivei.nota_fiscal.listar.nfce_emitidas` | GET `/v1/nfce/emitted` | sim | cursor |
| `arquivei.nota_fiscal.listar.eventos_nfe` | GET `/v1/events/nfe` | sim | cursor |
| `arquivei.nota_fiscal.obter.eventos_nfe` | GET `/v2/nfe/events` | sim | nenhuma |
| `arquivei.nota_fiscal.listar.eventos_cte` | GET `/v2/cte/events` | sim | cursor |
| `arquivei.nota_fiscal.obter.eventos_cte` | GET `/v1/cte/events` | sim | nenhuma |
| `arquivei.nota_fiscal.obter.eventos_cteos` | GET `/v1/cte-os/events` | sim | nenhuma |
| `arquivei.nota_fiscal.listar.eventos_nfse` | GET `/v1/nfse/events` | sim | cursor |
| `arquivei.nota_fiscal.consultar_status.manifestacao_nfe` | GET `/v2/nfe/manifest` | sim | nenhuma |
| `arquivei.nota_fiscal.consultar_status.pedido_manifestacao` | GET `/v1/nfe/manifest/status` | sim | nenhuma |
| `arquivei.nota_fiscal.manifestar.nfe` | POST `/v1/nfe/manifest` | não | — |
| `arquivei.nota_fiscal.manifestar.nfe_sincrona` | POST `/v1/nfe/manifest/sync` | não | — |
| `arquivei.nota_fiscal.manifestar.nfse` | POST `/v1/nfse/event` | não | — |
| `arquivei.nota_fiscal.baixar_arquivo.danfe` | GET `/v1/nfe/danfe` | sim | nenhuma |
| `arquivei.nota_fiscal.baixar_arquivo.dacte` | GET `/v1/cte/dacte` | sim | nenhuma |
| `arquivei.nota_fiscal.baixar_arquivo.dacteos` | GET `/v1/cte-os/dacteos` | sim | nenhuma |
| `arquivei.nota_fiscal.baixar_arquivo.danfse` | GET `/v1/nfse/danfse` | sim | nenhuma |
| `arquivei.empresa.listar` | GET `/v1/company` | sim | nenhuma |
| `arquivei.tabela_auxiliar.listar.properties` | GET `/v1/property` | sim | nenhuma |
| `arquivei.tabela_auxiliar.listar.etiquetas` | POST `/v1/account/tags/list` | sim | nenhuma |
| `arquivei.nota_fiscal.listar.etiquetas_documento` | POST `/v1/dfe/tags/list` | sim | nenhuma |
| `arquivei.conta_pagar.listar.boletos` | POST `/v2/bank-billet/search` | sim | cursor |
| `arquivei.conta_pagar.listar.boletos_v1` | GET `/v1/bank-billet` | sim | page |
| `arquivei.conta_pagar.baixar_arquivo.boleto_pdf` | GET `/v1/bank-billet/{owner}/{digitableLine}/pdf` | sim | nenhuma |
| `arquivei.pagamento.listar.comprovantes` | POST `/v1/receipts/list` | sim | cursor |
| `arquivei.pessoa.obter.cnpj` | GET `/v1/cnpj/{CNPJ}` | sim | nenhuma |
| `arquivei.pessoa.listar.cnpj` | GET `/v1/cnpj` | sim | nenhuma |
| `arquivei.webhook.assinar_webhook.endpoint` | POST `/v1/webhooks/endpoints` | não | — |
| `arquivei.webhook.listar.endpoints` | GET `/v1/webhooks/endpoints` | sim | page |
| `arquivei.webhook.obter.endpoint` | GET `/v1/webhooks/endpoints/{id}` | sim | nenhuma |
| `arquivei.webhook.atualizar.endpoint` | PATCH `/v1/webhooks/endpoints/{id}` | não | — |
| `arquivei.webhook.excluir.endpoint` | DELETE `/v1/webhooks/endpoints/{id}` | não | — |
| `arquivei.webhook.restaurar.endpoint` | POST `/v1/webhooks/endpoints/{id}/reactivate` | não | — |
| `arquivei.webhook.assinar_webhook.subscription` | POST `/v1/webhooks/subscriptions` | não | — |
| `arquivei.webhook.listar.subscriptions` | GET `/v1/webhooks/subscriptions` | sim | page |
| `arquivei.webhook.excluir.subscription` | DELETE `/v1/webhooks/subscriptions/{id}` | não | — |
| `arquivei.webhook.listar.metadata` | GET `/v1/webhooks/metadata` | sim | nenhuma |
| `arquivei.nota_fiscal.criar.upload_nfe` | POST `/v1/nfe/upload` | não | — |
| `arquivei.nota_fiscal.consultar_status.upload_nfe` | GET `/v1/nfe/upload/status` | sim | nenhuma |
| `arquivei.nota_fiscal.criar.upload_dfe` | POST `/v1/dfe/upload` | não | — |

Mais 30 operações catalogadas em `endpoints_secundarios` (properties, flag ERP, upload de CT-e, PDF de OCR, eventos RTC e em lote,
etiquetas, certificado, invoices, utilities, OCR, LATAM, manifestação v1 e as 2 operações da API Lite).

### Notas para o executor do site

1. **Dois cabeçalhos de credencial** (`execucao_auth.headers_credenciais`), mais `X-Use-ApiGateway: always` por endpoint
   (`execucao.headers_fixos`).
2. **Leitura por POST com corpo JSON** (`execucao.metodo_http = POST`, `execucao.corpo_modelo` com `{data_inicial}`/`{data_final}`):
   as principais buscas da API 2.0 são POST.
3. **Cursor no corpo** (`paginacao.local_cursor = "corpo"`), com o próximo valor lido na **raiz** da resposta
   (`origem_proximo = "raiz_da_resposta"`), e não dentro dos itens.
4. **Parâmetros repetidos** com colchetes na query (`cnpj[]`, `access_key[]`, `type[]`) e chaves com colchetes (`created_at[from]`).
5. **Base64**: decodificar o XML para as colunas de valor (`execucao.colunas_do_xml`) e entregar PDFs como arquivo.
6. **429**: ler `Retry-After` (cabeçalho), não o corpo.

## 3. Armadilhas

- Datas: `created_at` (API 1.0) é entrada na Qive; para competência use `EmissionDate` (API 2.0) ou `competence` (NFS-e).
- Sem `EmissionDate`, a busca de NF-e cobre só os últimos 30 dias.
- Grafias diferentes por rota: `Filters/Fields/Paginator` (NF-e), `fields` minúsculo no schema do CT-e, `filters/fields/paginator`
  (NFS-e), `Filter` singular (MDF-e); `Origins` x `Origin`; comprovantes rejeitam caixa errada.
- `OwnerRoles` da NF-e: descrição usa `received`/`emitted`, exemplo do schema usa `receiver`/`emitter`.
- A API não traz notas anteriores à contratação; novos CNPJs dependem de liberação manual.
- NFS-e de prefeitura cancelada após a captura não é retroagida automaticamente (a Qive varre prefeituras duas vezes ao dia).
- A mesma credencial lê e escreve (manifestação, upload): nunca usar fora do executor de leitura.
- Pedir `Xml` em Fields aumenta muito cada página; pedir só quando a planilha precisar de valor/série.

## 4. Conformidade

- Dados pessoais: nomes, CPF/CNPJ, endereços e e-mails nos documentos; dados bancários nos comprovantes. Base legal típica: obrigação
  legal e execução de contrato (LGPD art. 7º, II e V).
- A API não exige certificado do integrador; a captura na SEFAZ usa o certificado que o cliente cadastra na Qive.
- Termos de Uso: <https://qive.com.br/termos-de-uso> (atualizados em 2026-09-30).
- `permite_uso_em_produto_terceiro`: **sim, com condições** — o FAQ oficial admite acesso de parceiros/sistemas de terceiros via chave de
  permissão; os Termos proíbem revenda e uso em benefício de terceiros não autorizados. Usar em nome do próprio cliente e pedir
  confirmação comercial escrita.

## 5. Lacunas

- Dois cabeçalhos de credencial fora do modelo do catálogo (resolvido com extensão; executor precisa suportar).
- Rotas v1 não declaram os cabeçalhos de autenticação no Swagger (aplicados com base no FAQ).
- Fim da paginação da API 2.0 (NF-e, CT-e, CT-e OS, NFS-e, MDF-e) não documentado; formato de `page.next` na API 1.0 ambíguo.
- Valor total/série só no XML; estrutura do `Document` (JSON da nota) não documentada.
- Valores divergentes de `OwnerRoles` e grafias divergentes de chaves.
- Limite de requisições não publicado; `Limit` de NFS-e ausente e de MDF-e sem máximo.
- Webhooks: corpo, assinatura e reentrega não documentados; ajuda diz que não existem.
- Chave de permissão de parceiro sem procedimento documentado.
- Credenciais de produção e preço só via equipe comercial.
- Rotas de CNPJ: exigência de credencial e consumo de cota não claros.

## 6. Onde a confiança é menor

- `execucao.colunas_do_xml` (caminhos do layout nacional, **inferidos**).
- Sinal de fim de paginação da API 2.0 e formato de `page.next` (lógica do catálogo, não da doc).
- Valores de `OwnerRoles` e tolerância a caixa das chaves fora da rota de comprovantes.
- Webhooks, por serem recentes e contraditos pela ajuda.
- Exemplos de resposta: a maioria das rotas não tem exemplo oficial; os do catálogo seguem o schema com dados fictícios.

## 7. Monitoramento

Revisão **mensal** (fiscal). Acompanhar `info.version` do Swagger (1.105.0 em 2026-10-14), o portal developers.qive.com.br e o
artigo de ajuda da API. Não há changelog nem canal público de breaking changes.

## 8. Fontes (consultadas em 2026-10-14)

- Swagger oficial "Qive API" v1.105.0 — <https://docs.arquivei.com.br/arquivei-apis-swagger/dfe-api.json>
- Swagger UI (Arquivei API e Arquivei Lite) — <https://docs.arquivei.com.br/>
- Swagger da API Lite — <https://docs.arquivei.com.br/arquivei-apis-swagger/lite-api.json>
- Portal do Desenvolvedor — <https://developers.qive.com.br/> (docs em <https://developers.qive.com.br/docs/post/v2/dfe/nfe>)
- FAQ do portal — <https://developers.qive.com.br/help>
- Sandbox — <https://developers.qive.com.br/sandbox>
- Ajuda: API Qive — <https://ajuda.qive.com.br/pt-BR/articles/7045413-api-qive-como-integrar-e-automatizar-a-gestao-de-documentos-fiscais>
- Ajuda: Arquivei agora é Qive — <https://ajuda.qive.com.br/pt-BR/articles/9749184-arquivei-agora-e-qive>
- Ajuda: API Lite — <https://ajuda.qive.com.br/pt-BR/articles/16923232-api-lite-entenda-o-que-e-e-como-funciona-a-integracao-via-api>
- Termos de Uso — <https://qive.com.br/termos-de-uso>
