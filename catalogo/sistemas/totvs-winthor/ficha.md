# TOTVS WinThor — linha WinThor de Distribuição e Varejo

**Slug:** `totvs-winthor` · **Categoria:** `erp_nacional` · **Status:** `documentado`
**Fornecedor:** TOTVS S.A. (CNPJ 53.113.791/0001-22) — <https://www.totvs.com>. Produto mantido pela unidade TOTVS Goiânia (ex-PC Sistemas).
**Índice de integrabilidade:** **31/100** · **Qualidade da doc:** 5/10 · **Consulta:** 2026-10-19

---

## 1. Resumo comercial

### O que é

ERP para distribuidores, atacadistas e varejo, instalado no ambiente do cliente sobre banco Oracle. As integrações passam pelo **WinThor Anywhere (WTA)**, um servidor de aplicação web que o cliente instala num servidor próprio. Cada grupo de APIs é um "serviço" que o TI instala no WTA pela rotina 801 (por exemplo `winthor-pedido-venda`, `winthor-estoque-vtex`, `winthor-filial`).

### O que dá para fazer pela API

As APIs públicas nasceram para **e-commerce e PDV**. Pelo recorte de leitura, que é o que o assistente executa:

| Bloco | O que sai | Endpoint |
|---|---|---|
| **Vendas** | Pedidos por filial e período (janela em dias), com itens, custos, plano de pagamento e, com `viewDocument=true`, número/chave/valor da NF e devoluções | `GET /api/wholesale/v1/orders/list`, `/orders/` |
| **Clientes** | Cadastro completo, endereços, RCA, situação (ativo, bloqueado), contagem | `GET /api/wholesale/v1/customer/list`, `/customer/`, `/customer/list/count` |
| **Produtos** | Cadastro com NCM, fornecedor, marca, departamento, seção, categoria, pesos | `GET /api/purchases/v1/products/` |
| **Preços** | Preço por filial, oferta e vigência, ST/IPI calculados | `GET /api/wholesale/v1/price/list` |
| **Estoque** | Disponível por produto e filial (várias filiais por chamada) | `GET /api/stock-vtex/v1/available/list` |
| **Fiscal** | Lista de NF de saída (número, valor, cliente, chave, situação) e XML da NF-e por pedido | `GET /logistica/apis/v1/nota/buscar`, `/winthor/fiscal/v1/documentosfiscais/nfe/invoiceDocument` |
| **Tabelas** | Filiais, planos de pagamento (prazos), políticas de desconto | `GET /api/branch/v1/`, `/winthor/venda/v0/planos-pagamentos`, `/winthor/precos/v1/politica-desconto` |

**O que não existe:** API pública de **contas a receber, contas a pagar, baixas, extrato ou movimento bancário**. A conciliação bancária, maior dor dos clientes, não é atendida pelas APIs. A TOTVS também **não autoriza** terceiros a usar objetos internos do banco (views, procedures, packages), então ler o Oracle direto não é caminho suportado. Alternativas: pedir a API à TOTVS pela "Central colaborativa" (como a TDN orienta) ou usar exportações das rotinas financeiras do próprio WinThor.

A API também grava (pedidos, cancelamentos, liberação de pedido, clientes, endereços de entrega), mas o assistente só explica e entrega o código.

**Casos de uso de negócio**

| Caso | Valor | Endpoints |
|---|---|---|
| Vendas e faturamento por cliente, produto e filial | Pedidos do período com itens, custos e NF, já com nomes de cliente, produto e filial | `pedido.listar`, `cliente.listar`, `produto.listar`, `empresa.listar.filiais` |
| Posição de estoque e ruptura | Disponível por produto e filial cruzado com fornecedor e vendas recentes | `estoque.listar`, `produto.listar`, `pedido.listar` |
| Preços, ofertas e descontos | Preço por filial com oferta e vigência ao lado das políticas ativas | `produto.listar.precos`, `tabela_auxiliar.listar.politicas_desconto` |
| Conferência de NF emitidas | Número, chave, situação e valor por pedido; XML sob demanda | `nota_fiscal.listar`, `pedido.listar`, `nota_fiscal.baixar_arquivo.xml` |
| Carteira de clientes e prazos | Clientes com RCA, cidade, bloqueio e prazo médio do plano | `cliente.listar`, `tabela_auxiliar.listar.planos_pagamento` |

(ids completos com prefixo `totvs-winthor.`)

### Custo e prazo

- **Custo da API:** não há preço separado. A TDN informa que o WTA não tem custo adicional para quem licencia o WinThor (acesso restrito ao perfil licenciado).
- **Liberação:** sem aprovação de parceiro. O TI do cliente instala os serviços no WTA, cria o usuário de integração e expõe o endereço.
- **Prazo de MVP de leitura:** cerca de **40 horas**, a maior parte em infraestrutura do cliente (serviços na rotina 801, usuário, rede/HTTPS) e em validar as marcações de e-commerce dos cadastros.

### Índice de integrabilidade — 31/100

| Componente | Pontos | Justificativa |
|---|---|---|
| Documentação | 8/20 | TDN pública com mapeamento campo a campo para as tabelas e coleções Postman; espalhada em ~40 páginas, sem OpenAPI, envelopes omitidos, foco em e-commerce, nada de financeiro. |
| Sandbox | 2/15 | Não há; testar na base de homologação do cliente. |
| Autenticação | 5/15 | Usuário e senha em MD5, JWT de 4 h carregado em cookie sem nome publicado, sem refresh nem escopos; exemplos em http. |
| Webhooks | 1/15 | Nenhum para terceiros; o WSH é hub local. |
| Limites e paginação | 5/10 | page/pageSize + hasNext, rotas /count, filtros lastChange; sem rate limit nem tamanho máximo publicados; pedidos com janela padrão de 15 dias. |
| SDKs e comunidade | 2/10 | Só coleções Postman antigas. |
| Acesso sem barreira | 5/10 | Doc aberta; exige ser cliente, instalar serviços e expor o servidor. |
| Versionamento | 3/5 | v0/v1 no caminho e versão mínima por recurso; sem changelog. |

---

## 2. Ficha técnica

### Autenticação

1. `POST {base}/winthor/autenticacao/v1/login` com `{"login": "<usuário>", "senha": "<MD5 maiúsculo da senha em maiúsculas>"}`. Exemplo publicado: `Totvs@123` → `TOTVS@123` → `29F7F1E7DF1C2500C86561185392F280`.
2. Resposta `{"accessToken": "<JWT>"}`; o WTA grava a sessão em **cookie** (nome não publicado). Validade: **4 horas**. Sem refresh token.
3. Demais rotas com a sessão. Sem ela: **403** (`UNK-ERR` / "The current Subject is not authenticated").
4. `GET /winthor/autenticacao/v1/logout` encerra.

Usuário dedicado (rotina 528) com acesso na rotina 530 às rotinas 801, 810, 812 e 814. Não há perfil somente leitura documentado.

### Receita para o executor (`execucao_auth`)

| Campo | Valor |
|---|---|
| tipo | `login_credenciais` |
| login | `POST /winthor/autenticacao/v1/login`, corpo `{"login": "{usuario}", "senha": "{senha|md5_maiusculo}"}`, `repassar_cookies: true`, `campo_token: accessToken` |
| credenciais | `usuario`, `senha` (segredo; a senha normal do WTA, o executor calcula o MD5), `base_url` (endereço do WTA com nome de domínio; o servidor do site não chama IP) |
| headers_fixos | `Accept` e `Content-Type: application/json` (o XML da NF-e responde 406 sem eles) |
| transporte | cookie da sessão (documentado) + `Authorization: Bearer` (documentado só na liberação de pedido) |

**O executor atual suporta** (site e CLI): calcula o MD5 da senha no login (`md5_maiusculo`), reenvia os cookies da sessão (`repassar_cookies`) junto com o Bearer e encerra a paginação por `hasNext` (`hasNext_false`, com a página incompleta como reserva). Testado em 2026-10-19 só contra mocks locais, nunca contra um WTA real. Pré-requisito de rede: o WTA precisa estar publicado com nome de domínio, porque o servidor do site não chama IP direto.

### Ambientes

Sem sandbox nem host público. Base = `http://<IP do WTA>:<porta>` (parâmetros 2851 e 2849 da rotina 132; porta em `org.ops4j.pax.web.cfg`). Exemplos oficiais usam 8181, 8889 e 8282. Acesso externo exige que o TI externalize IP e porta; recomendação: HTTPS/VPN e liberação só do IP do backend.

### Limites e paginação

- Envelope `{first, items, hasNext}`; `page`/`pageSize` (planos usam `pagina`/`tamanho`). Padrão de 10 em clientes; máximo não publicado (usar 100).
- Carga incremental por `lastChange`. Pedidos: `daysOfSearch` (padrão **15 dias**) e `saleOrigin` (padrão **W**, só web).
- Rate limit não publicado; o WTA divide CPU e memória com o ERP.
- Datas vazias chegam como `1900-01-01T00:00:00`.

### Webhooks

Não há para terceiros. O WinThor Smart Hub (rotina 2650) é um integrador local com fluxos agendados e uma API que recebe eventos. Use consulta periódica com `lastChange`.

### Erros

| Status | Quando |
|---|---|
| 403 | Sem sessão ou token vencido (`UNK-ERR`) ou usuário sem permissão (`{"mensagem": ..., "erros": []}`) |
| 404 | HTML do Jetty: serviço não instalado no WTA ou porta errada; cliente não encontrado por CPF/CNPJ |
| 406 | XML da NF-e sem `Accept`/`Content-Type` JSON |
| 400 | `order` inválido em clientes; `onlyProductsSupplierCode` sem `supplierCode` |
| 422/500 | Liberação de pedido com dados inválidos / erro interno |

Validações de negócio vêm como `{"code": "WT-PV-000000", "message", "detailedMessage", "details": []}`.

### Endpoints canônicos detalhados (23)

| id | Método e caminho | Serviço WTA | Executa? |
|---|---|---|---|
| `totvs-winthor.autenticacao.autenticar` | `POST /winthor/autenticacao/v1/login` | WTA | não (login) |
| `totvs-winthor.autenticacao.autenticar.logout` | `GET /winthor/autenticacao/v1/logout` | WTA | não |
| `totvs-winthor.pedido.listar` | `GET /api/wholesale/v1/orders/list` | winthor-pedido-venda | sim |
| `totvs-winthor.pedido.obter` | `GET /api/wholesale/v1/orders/` | winthor-pedido-venda | sim |
| `totvs-winthor.cliente.listar` | `GET /api/wholesale/v1/customer/list` | winthor-pedido-venda | sim |
| `totvs-winthor.cliente.obter` | `GET /api/wholesale/v1/customer/` | winthor-pedido-venda | sim |
| `totvs-winthor.cliente.listar.contagem` | `GET /api/wholesale/v1/customer/list/count` | winthor-pedido-venda | sim |
| `totvs-winthor.produto.listar` | `GET /api/purchases/v1/products/` | winthor-compras-produto | sim |
| `totvs-winthor.produto.listar.precos` | `GET /api/wholesale/v1/price/list` | winthor-pedido-venda | sim |
| `totvs-winthor.estoque.listar` | `GET /api/stock-vtex/v1/available/list` | winthor-estoque-vtex | sim |
| `totvs-winthor.estoque.obter` | `GET /api/stock-vtex/v1/available/{branchId}/{productId}` | winthor-estoque-vtex | sim |
| `totvs-winthor.empresa.listar.filiais` | `GET /api/branch/v1/` | winthor-filial | sim |
| `totvs-winthor.tabela_auxiliar.listar.planos_pagamento` | `GET /winthor/venda/v0/planos-pagamentos` | winthor-venda | sim |
| `totvs-winthor.tabela_auxiliar.listar.politicas_desconto` | `GET /winthor/precos/v1/politica-desconto` | winthor-integracao-preco | sim |
| `totvs-winthor.nota_fiscal.listar` | `GET /logistica/apis/v1/nota/buscar` | winthor-logistica-apis | sim |
| `totvs-winthor.nota_fiscal.baixar_arquivo.xml` | `GET /winthor/fiscal/v1/documentosfiscais/nfe/invoiceDocument` | winthor-fiscal | sim |
| `totvs-winthor.empresa.consultar_status.saude` | `GET /api/wholesale/v1/health` (sem login) | winthor-pedido-venda | sim |
| `totvs-winthor.pedido.criar` | `POST /api/wholesale/v1/orders/` | winthor-pedido-venda | não |
| `totvs-winthor.pedido.cancelar` | `DELETE /api/wholesale/v1/orders/` | winthor-pedido-venda | não |
| `totvs-winthor.pedido.autorizar.liberacao` | `GET /pedidovenda/liberacaopedido` (**escreve**) | winthor-pedido-venda | não |
| `totvs-winthor.cliente.criar` | `POST /api/wholesale/v1/customer/` | winthor-pedido-venda | não |
| `totvs-winthor.cliente.atualizar` | `PUT /api/wholesale/v1/customer/` | winthor-pedido-venda | não |
| `totvs-winthor.endereco.criar.entrega` | `POST /api/wholesale/v1/customer/deliveryAddress` | winthor-pedido-venda | não |

Mais 104 rotas catalogadas em `endpoints_secundarios` (SKUs, departamentos, seções, categorias, marcas, tributação e preços do PDV Omni, logística Coleta Entrega e TRE, WSH, APIs de saúde, APIs padrão TOTVS com WinThor como produto e o web service SOAP da rotina 2699).

**As 5 leituras mais úteis para planilha:** `pedido.listar` (com `viewDocument=true`), `estoque.listar`, `cliente.listar`, `produto.listar`, `produto.listar.precos`.

---

## 3. Armadilhas

1. Não há financeiro na API; não prometa conciliação, aging ou fluxo de caixa.
2. Ler o banco Oracle direto contraria a política da TOTVS e tira o cliente do suporte.
3. Senha em MD5 maiúsculo da senha em maiúsculas; o hash vale como senha.
4. Sessão em cookie de 4 h; clientes HTTP sem cookie jar precisam reenviar o cookie.
5. Pedidos: sem `daysOfSearch` só 15 dias; sem `saleOrigin` só pedidos web; `branchId` obrigatório.
6. Produtos, estoque e preços dependem de "Enviar para E-commerce"; no estoque, `callOrigin=WSH` tira essa restrição.
7. 404 em HTML = serviço não instalado no WTA (ver rotina 812).
8. `GET /pedidovenda/liberacaopedido` grava no banco.
9. Grafias do fornecedor: `finalCostumer`, `suppierId`.
10. Exemplos em http: exponha o WTA só com HTTPS/VPN.

## 4. Conformidade

Trafega dados pessoais de clientes e consumidores (CPF/CNPJ, e-mail, telefone, endereço, data de nascimento em dados de consumidor). Dados ficam no servidor do cliente. Sem certificado digital na API. A TOTVS apresenta as APIs como a forma de integrar com terceiros; não há termos de API específicos. Política de objetos internos: <https://tdn.totvs.com/pages/releaseview.action?pageId=746503236>.

## 5. Lacunas

- **Financeiro inexistente** (contas a receber/pagar, baixas, movimento bancário) — impacto alto.
- **Transporte do token**: cookie sem nome publicado; Bearer só documentado na liberação — alto.
- **TLS**: só exemplos em http — alto.
- **Escopo de pedidos**: origem padrão W, 15 dias, interação daysOfSearch × lastChange não explicada — alto.
- **Restrição de e-commerce** em produtos e preços sem forma documentada de remover — alto.
- Envelope de pedidos e clientes inferido; tamanho máximo de página e rate limit não publicados; lista de NF sem filtro de data; formato do erro de login não publicado; sem sandbox; sem webhooks.

## 6. Onde a confiança é menor

- `lista_em: items` de `pedido.listar` e `cliente.listar` (inferido do padrão do mesmo serviço).
- Envio do token em `Authorization: Bearer` nas rotas `/api/...` (inferido; o documentado é cookie).
- Escopo da lista de NF da integração TRE (todas as notas ou só as roteirizáveis).
- Métodos HTTP de algumas rotas catalogadas do PDV Omni e do WSH (marcados em `observacao`).

## 7. Monitoramento

Revisão **trimestral**. Sem changelog: acompanhar a versão das páginas da TDN (API REST do Confluence `https://tdn.totvs.com/rest/api/content/<id>?expand=version`) a partir da raiz `573185595`, e as versões dos serviços instalados no WTA do cliente (rotina 812).

## 8. Fontes (consultadas em 2026-10-19)

- TDN — APIs Integrações WinThor (raiz): <https://tdn.totvs.com/pages/releaseview.action?pageId=573185595>
- Central — WINT - Como realizar integração com terceiros: <https://centraldeatendimento.totvs.com/hc/pt-br/articles/15615773269655-WINT-Como-realizar-integra%C3%A7%C3%A3o-com-terceiros>
- TDN — Login/Logout Token: <https://tdn.totvs.com/pages/releaseview.action?pageId=644722134> · Geração de token: <https://tdn.totvs.com/pages/releaseview.action?pageId=741845526>
- TDN — Parametrizações WTA: <https://tdn.totvs.com/pages/releaseview.action?pageId=738243139>
- TDN — Pedido (632099891), Clientes (632097966), Produtos (632096738), Preço (632108371), Estoque (632097669), Filiais (683349868), Planos de Pagamento (699812479), Política de desconto (885390869), NF XML (650007958), TRE Notas Fiscais (1011570009), Saúde (1036755549), Liberação de Pedido (1062879116), Endereço de entrega (728640605), WSH (680973675), PDV Omni (770952459), Objetos internos (746503236), Instalar WTA (272708475)
- Coleção Postman oficial "API Vendas OFFICIAL" (anexo da TDN)
- Central — porta do WTA (360025106212, 360050873054), rotina 2699 (360026666351), rotina 1296 (12801337558551), integração de pedidos via API (40916341521687)
- TOTVS Developers <https://api.totvs.com.br/> e repositório oficial <https://github.com/totvs/ttalk-standard-message>
