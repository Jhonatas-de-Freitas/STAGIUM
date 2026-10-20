# TOTVS Protheus

ERP da TOTVS S.A. para médias e grandes empresas, instalado no servidor de cada cliente ou no TOTVS Cloud. Consulta da documentação oficial em 2026-10-19 (TDN e TOTVS Developers).

## Resumo comercial

**O que dá para fazer.** Ler, com a credencial de um usuário do próprio Protheus, praticamente qualquer dado do ERP para planilha: contas a receber e a pagar, baixas (recebimentos e pagamentos efetivos), movimentos bancários com a marca de conciliação, extrato bancário importado, saldos bancários, clientes, fornecedores, produtos, saldos de estoque, pedidos de venda e de compra e notas fiscais de entrada e saída. A leitura de negócio passa pela API genérica oficial **genericQuery** (`GET /api/framework/v1/genericQuery`), que consulta tabelas do Protheus com filtro SQL, paginação e as mesmas permissões da tela. Há também APIs padrão TOTVS de cadastro (cliente/fornecedor, centro de custo) e serviços para descobrir filiais e campos.

**Conciliação bancária** (a maior dor dos clientes): dá para montar as três pontas — movimentos do ERP (SE5, com `E5_RECONC` preenchido quando conciliado), linhas do extrato importado (SIG) e saldo do sistema por data (SE8) — por conta e período. Conciliar continua sendo feito no Protheus (Conciliador BackOffice).

**Custo.** Sem preço público de API: faz parte do Protheus licenciado. Cada requisição consome licença TOTVS I (por thread ou, no modo por demanda, por requisição; sem licença livre a API responde 503). O custo real costuma ser o do TI/parceiro para publicar o REST com HTTPS.

**Prazo.** MVP de leitura em ~40 horas de desenvolvimento, desde que o REST do cliente já esteja publicado e acessível. Publicar o REST (firewall, HTTPS, VPN) depende do TI do cliente e costuma ser o gargalo.

**Índice de integrabilidade: 37/100.**

| Componente | Pontos | Por quê |
|---|---|---|
| Documentação (20) | 11 | TDN extenso e público, 125 especificações OpenAPI no TOTVS Developers; mas fragmentado, com páginas em rascunho e sem API padrão para financeiro/fiscal/estoque. |
| Sandbox (15) | 2 | Não existe sandbox; testes só em homologação do próprio cliente. |
| Autenticação (15) | 8 | Token JWT com refresh e JWKS, além de Basic; mas é usuário/senha do ERP, sem client credentials nem escopos. |
| Webhooks (15) | 0 | Nenhum webhook para terceiros. |
| Limites e paginação (10) | 6 | page/pageSize + hasNext (e remainingRecords na genericQuery); sem rate limit nem teto publicados. |
| SDKs e comunidade (10) | 3 | Sem SDK externo; especificações no GitHub oficial. |
| Acesso sem barreira (10) | 4 | Docs abertas; barreira operacional (licença, REST publicado, usuário). |
| Versionamento (5) | 3 | Versão no caminho e DTs por LIB, mas comportamento varia por release, LIB e customização. |

## Técnica

### Endereço

Não há host público. A URL base é a do serviço REST do cliente: `https://<servidor>:<porta>/rest` (porta no socket do REST e caminho na chave `URL` da seção `[HTTPURI]` do appserver.ini). No TOTVS Cloud, um exemplo oficial usa `https://<ambiente>.protheus.cloudtotvs.com.br:<porta>/rest`. Guarde sem barra no fim: no REST 2.0 barras extras dão 404 (em HTML).

### Autenticação

- **Basic:** `Authorization: Basic base64(usuario:senha)` em toda chamada, com um usuário do Protheus.
- **Bearer (recomendado pela TOTVS):** `POST /api/oauth2/v1/token?grant_type=password` com `username` e `password` em cabeçalhos (o TOTVS Developers mostra na query string). Resposta: `access_token` (JWT, `expires_in` 3600), `refresh_token` (24 h), `scope` "default", `token_type` "Bearer", `hasMFA`. Renovação: `grant_type=refresh_token&refresh_token=...`. Prazos fixos.
- **tenantId** (cabeçalho): `<grupo de empresas>,<filial>`. Sem ele, com `PrepareIn=All`, a requisição cai numa empresa qualquer. Usuário sem acesso à filial recebe 401.
- Desde a 12.1.33 o REST exige autenticação por padrão; desde a 12.24.10 não dá para desligar. genericQuery, genericList e BasicProtheusServices só funcionam com `Security=1`.

**Para o executor do site** (`execucao_auth.tipo = basic`): o cliente informa `usuario`, `senha`, `base_url` e `tenant_id`. O executor atual não monta Basic usuário:senha nem envia `tenantId`; o login do Protheus também não cabe em `login_credenciais` (credenciais em cabeçalhos, sem corpo). Ver `execucao_auth.suporte_executor_atual`.

### Ambientes

Sem sandbox. Homologação, quando existe, é outro ambiente do próprio cliente. Teste com usuário só de leitura, período curto e `pagesize` pequeno.

### Leitura: genericQuery

`GET /api/framework/v1/genericQuery?tables=SE1&fields=e1_num,e1_vencrea,e1_saldo&where=E1_VENCREA >= '20260801' AND E1_VENCREA <= '20260831'&page=1&pagesize=100`

- `tables` (obrigatório), `fields`, `where` (SQL), `FromQry` (JOIN explícito com nome físico), `filialFilter` e `deletedFilter` (padrão true), `page`, `pagesize`, `order`.
- Resposta: `items` (chaves = nome do campo em minúsculas), `hasNext`, `remainingRecords`, `protectedDataFields`, `nivelFields`.
- **Datas no where são texto AAAAMMDD** entre aspas simples (o Protheus grava datas como texto). No retorno vêm como AAAA-MM-DD.
- Valida privilégios, nível de campo e dados protegidos (LGPD): campos ocultos aparecem em `protectedDataFields`.
- Com várias tabelas, a junção tem de ir no `where` ou no `FromQry`; sem ela, produto cartesiano.

### Limites

Sem rate limit publicado; vazão depende de `Instances`, licenças e banco do cliente. Padrão TOTVS: page 1 e 10 itens; teto de página não documentado (use 100). Requisição acima de 1 MB exige `MAXSTRINGSIZE`; URL abaixo de 2.000 caracteres. Retry só em 502/503/504.

### Webhooks

Não há. Integrações por evento (EAI, Smartlink) são configuradas dentro do ERP para produtos TOTVS. Sincronização por consulta periódica.

### Erros

APIs no padrão TTALK: `{code, message, detailedMessage, helpUrl, details[]}`. 401 (credencial, token vencido, filial do tenantId sem acesso), 404 (endereço ou serviço inexistente; HTML no REST 2.0), 409 (token), 503 (sem licença).

### Endpoints detalhados (27)

| id | Método e caminho | O que traz |
|---|---|---|
| `totvs-protheus.autenticacao.autenticar` | POST /api/oauth2/v1/token (password) | Token Bearer de 1 h |
| `totvs-protheus.autenticacao.autenticar.refresh_token` | POST /api/oauth2/v1/token (refresh_token) | Renova tokens |
| `totvs-protheus.empresa.obter.filial_atual` | GET /api/framework/v1/basicProtheusServices/xfilial | Teste de conexão; filial efetiva por tabela |
| `totvs-protheus.tabela_auxiliar.obter.campos_tabela` | GET .../basicProtheusServices/fwformstructview | Campos, títulos e customizações de uma tabela |
| `totvs-protheus.conta_receber.listar` | GET genericQuery, tables=SE1 | Títulos a receber |
| `totvs-protheus.conta_pagar.listar` | GET genericQuery, tables=SE2 | Títulos a pagar |
| `totvs-protheus.pagamento.listar.baixas` | GET genericQuery, tables=SE5 | Recebimentos e pagamentos efetivos |
| `totvs-protheus.transacao.listar.movimentos_bancarios` | GET genericQuery, tables=SE5 | Movimentos por conta com marca de conciliação |
| `totvs-protheus.transacao.listar.extrato_bancario` | GET genericQuery, tables=SIG | Extrato bancário importado |
| `totvs-protheus.transacao.listar.saldos_bancarios` | GET genericQuery, tables=SE8 | Saldo por conta e data |
| `totvs-protheus.tabela_auxiliar.listar.bancos` | GET genericQuery, tables=SA6 | Contas bancárias |
| `totvs-protheus.plano_contas.listar.naturezas` | GET genericQuery, tables=SED | Naturezas financeiras |
| `totvs-protheus.cliente.listar` | GET genericQuery, tables=SA1 | Clientes |
| `totvs-protheus.fornecedor.listar` | GET genericQuery, tables=SA2 | Fornecedores |
| `totvs-protheus.produto.listar` | GET genericQuery, tables=SB1 | Produtos |
| `totvs-protheus.estoque.listar.saldos` | GET genericQuery, tables=SB2 | Saldos por produto e armazém |
| `totvs-protheus.pedido.listar.venda` | GET genericQuery, tables=SC5 | Pedidos de venda (cabeçalho) |
| `totvs-protheus.pedido.listar.venda_itens` | GET genericQuery, tables=SC6 | Itens de pedido de venda |
| `totvs-protheus.pedido.listar.compra` | GET genericQuery, tables=SC7 | Pedidos de compra por item |
| `totvs-protheus.nota_fiscal.listar.saida` | GET genericQuery, tables=SF2 | NF de saída (cabeçalho) |
| `totvs-protheus.nota_fiscal.listar.saida_itens` | GET genericQuery, tables=SD2 | Itens das NF de saída |
| `totvs-protheus.nota_fiscal.listar.entrada` | GET genericQuery, tables=SF1 | NF de entrada (cabeçalho) |
| `totvs-protheus.nota_fiscal.listar.entrada_itens` | GET genericQuery, tables=SD1 | Itens das NF de entrada |
| `totvs-protheus.cliente.listar.customer_vendor` | GET /api/crm/v1/customerVendor/1 | Clientes (API padrão TOTVS) |
| `totvs-protheus.fornecedor.listar.customer_vendor` | GET /api/crm/v1/customerVendor/2 | Fornecedores (API padrão TOTVS) |
| `totvs-protheus.centro_custo.listar` | GET /api/ctb/v1/costcenters | Centros de custo (API padrão TOTVS) |
| `totvs-protheus.tabela_auxiliar.listar.consulta_generica` | GET /api/framework/v1/genericQuery | Consulta livre a qualquer tabela |

Mais 568 operações catalogadas sem detalhe em `endpoints_secundarios`: 547 operações de 121 especificações do TOTVS Developers marcadas como disponíveis no Protheus (CRM, MRP, RH/eSocial, agro, varejo, GFE, framework) e 21 serviços do TDN (genericList, genericRecords, demais BasicProtheusServices, JWKS, invalidateToken, FWRestModel, EAI, Rebate).

### Armadilhas

1. REST precisa estar publicado pelo TI; sem isso nada funciona de fora.
2. Sempre envie `tenantId`.
3. Datas AAAAMMDD no where; AAAA-MM-DD devolve dados errados sem erro.
4. Situação de pedido/título/nota não é campo único (ex.: pedido = C5_NOTA, C5_LIBEROK, C5_BLQ, C6_QTDENT, C6_BLQ).
5. Títulos RA/NCC/abatimentos entram positivos; o BI oficial os trata como negativos.
6. SE5 mistura baixas, transferências e estornos; a regra oficial de exclusão de estornos não está documentada.
7. Campos e tabelas mudam por cliente (campos de usuário, compartilhamento, privilégios, dados protegidos).
8. A credencial é um usuário do ERP: crie um só de leitura; ele também poderia gravar.
9. Cada requisição consome licença.

### Lacunas principais

- URL por cliente e exposição de rede (alto).
- Executor do site sem Basic usuário:senha, sem `tenantId` e sem montagem de `where` com ` AND ` e datas AAAAMMDD (alto).
- LIB mínima da genericQuery não informada (alto).
- Regra de exclusão de estornos na SE5 (alto); `R/P` em E5_RECPAG inferido do FK5 (médio).
- Teto de `pagesize`, grafia `pagesize`/`pageSize` e parâmetro `order` não confirmados (médio).
- Valores de códigos (E5_TIPODOC, E5_MOTBX, E1_SITUACA, F2_TIPO...) não tabelados (médio).
- Chave de acesso da NF-e, status SEFAZ e valor/custo de estoque não confirmados em campos (médio).
- Sem sandbox e sem webhooks; uso em produto de terceiro sem posição publicada (alto).

### Onde a confiança é menor

- `pagesize`, `order` e teto de página (inferidos do guia TOTVS e da classe FWAdapterBaseV2).
- E5_RECPAG com R/P na SE5 (documentado para FK5).
- Grafia das propriedades da API de centro de custo (do schema oficial, sem resposta real).
- Formato TOTVS Cloud da URL (a partir de um exemplo da documentação).

### Fontes principais

- Token: https://tdn.totvs.com/pages/viewpage.action?pageId=465383509
- Basic: https://tdn.totvs.com/pages/viewpage.action?pageId=185748452
- Configuração do REST: https://tdn.totvs.com/pages/viewpage.action?pageId=185747842
- tenantId: https://tdn.totvs.com/display/framework/02.+REST+com+ERP+Microsiga+Protheus e https://tdn.totvs.com/pages/viewpage.action?pageId=502457209
- genericQuery: https://tdn.totvs.com/display/public/framework/GenericQuery
- FWAdapterBaseV2: https://tdn.totvs.com/display/public/framework/09.+FWAdapterBaseV2
- BasicProtheusServices: https://tdn.totvs.com/display/public/framework/BasicProtheusServices
- Campos (SA1, SB1, SB2, SC5, SC6, SF1, SD1, SF2, SD2, SE1): https://tdn.totvs.com/pages/viewpage.action?pageId=782309164
- Campos financeiros (SE1, SE2, SE5, SE8, SA6, SED): https://tdn.totvs.com/pages/viewpage.action?pageId=240976375
- Conciliador BackOffice: https://tdn.totvs.com/pages/viewpage.action?pageId=753654798
- Licença do REST: https://tdn.totvs.com/pages/viewpage.action?pageId=527852596
- TOTVS Developers: https://api.totvs.com.br/ e https://github.com/totvs/ttalk-standard-message/tree/master/jsonschema/apis

Lista completa em `system.json > fontes`.
