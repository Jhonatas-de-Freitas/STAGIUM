# Índice dos sistemas documentados

Gerado em 2026-10-19 por `scripts/gerar_indice.py` a partir das fichas. Não edite à mão: rode o script de novo.

**Totais:** 15 sistemas · 682 endpoints detalhados · 1827 catalogados · 413 executáveis pelo assistente · 269 perguntas de FAQ.

| Sistema | Categoria | Índice | Endpoints (det. + cat.) | Executáveis | Autenticação | Concluído |
|---|---|---|---|---|---|---|
| [Qive (antiga Arquivei) — API de gestão de documentos fiscais](../sistemas/arquivei/ficha.md) | Fiscal (emissor) | 54 | 49 + 30 | 38 | `header_api_key` | 2026-10-14 |
| [Asaas](../sistemas/asaas/ficha.md) | Pagamentos | 78 | 62 + 151 | 27 | `header_api_key` | 2026-09-17 |
| [Bling](../sistemas/bling/ficha.md) | ERP | 64 | 75 + 185 | 32 | `oauth2_refresh_token` | 2026-09-17 |
| [Focus NFe](../sistemas/focus-nfe/ficha.md) | Fiscal (emissor) | 67 | 62 + 66 | 32 | `basic` | 2026-09-17 |
| [Mercado Livre (API de marketplace — site MLB)](../sistemas/mercado-livre/ficha.md) | marketplace | 64 | 36 + 108 | 33 | `oauth2_refresh_token` | 2026-10-14 |
| [Mercado Pago](../sistemas/mercado-pago/ficha.md) | Pagamentos | 82 | 41 + 83 | 25 | `bearer` | 2026-09-17 |
| [NFE.io](../sistemas/nfe-io/ficha.md) | Fiscal (emissor) | 69 | 43 + 142 | 30 | `header_api_key` | 2026-09-18 |
| [Nomus ERP (Nomus ERP Industrial e Nomus Start Industrial)](../sistemas/nomus/ficha.md) | ERP | 29 | 35 + 159 | 31 | `header_api_key` | 2026-10-09 |
| [Pagar.me](../sistemas/pagarme/ficha.md) | Pagamentos | 66 | 62 + 63 | 28 | `basic` | 2026-09-17 |
| [API Pix (arranjo Bacen)](../sistemas/pix-bacen/ficha.md) | Pagamentos (padrão) | 64 | 49 + 3 | 22 | `mtls_oauth2` | 2026-09-17 |
| [PlugNotas (Tecnospeed)](../sistemas/plugnotas/ficha.md) | Fiscal (emissor) | 62 | 90 + 94 | 56 | `header_api_key` | 2026-09-17 |
| [SEFAZ — NF-e e NFC-e (web services oficiais)](../sistemas/sefaz-nfe/ficha.md) | Fiscal (governo) | 43 | 12 + 8 | 5 | `certificado_icp_brasil` | 2026-09-18 |
| [SyGeCom (Sagi, SGR, SGR+, Easy)](../sistemas/sygecom/ficha.md) | ERP | 39 | 16 + 63 | 14 | `login_credenciais` | 2026-09-17 |
| [TOTVS Protheus](../sistemas/totvs-protheus/ficha.md) | ERP | 37 | 27 + 568 | 25 | `basic` | 2026-10-19 |
| [TOTVS WinThor (linha WinThor de Distribuição e Varejo)](../sistemas/totvs-winthor/ficha.md) | ERP | 31 | 23 + 104 | 15 | `login_credenciais` | 2026-10-19 |

## Detalhe por sistema

### Qive (antiga Arquivei) — API de gestão de documentos fiscais

Plataforma de gestão de documentos fiscais e de contas a pagar (Qive, antiga Arquivei): captura automaticamente na SEFAZ e nas prefeituras as NF-e, CT-e, CT-e OS, NFS-e, NFC-e e MDF-e emitidas contra ou pelos CNPJs do cliente, guarda os XMLs, faz manifestação do destinatário e captura boletos e com…

- **Pasta:** `catalogo/sistemas/arquivei/` — ficha humana em `ficha.md`
- **API:** REST · produção `https://api.arquivei.com.br` · sandbox `https://sandbox-api.arquivei.com.br`
- **Autenticação para o executor:** `header_api_key`
- **Índice de integrabilidade:** 54
- **Endpoints:** 49 detalhados, 30 catalogados, 38 executáveis, 18 perguntas de FAQ
- **Armadilhas:**
  - Buscas da API 2.0 são POST com corpo JSON (não GET): o executor precisa mandar corpo e paginar pelo cursor no corpo.
  - Duas autenticações em dois cabeçalhos (X-API-ID e X-API-KEY) e, nas rotas novas, o cabeçalho fixo X-Use-ApiGateway: always.
  - Rotas GET clássicas só filtram por created_at, que é a data de ENTRADA na Qive, não a de emissão.
- **Lacunas principais:**
  - A especificação do catálogo prevê um único cabeçalho de credencial em header_api_key. A Qive exige X-API-ID e X-API-KEY. Foi usado o campo de extensã…
  - As buscas não devolvem valor total nem série como campo; é preciso ler o XML (Base64). O campo Document (NF-e em JSON) não tem estrutura documentada.
  - O cabeçalho X-API-PERMISSION-KEY está declarado em securityDefinitions, mas nenhuma operação o usa explicitamente e não há guia de como o parceiro o…

### Asaas

Instituição de pagamento que oferece via API REST v3 cobranças por boleto, Pix e cartão, assinaturas recorrentes, parcelamentos, split, transferências Pix/TED, pagamento de contas, NFS-e, subcontas (BaaS) e webhooks, com sandbox gratuito.

- **Pasta:** `catalogo/sistemas/asaas/` — ficha humana em `ficha.md`
- **API:** REST · produção `https://api.asaas.com/v3` · sandbox `https://api-sandbox.asaas.com/v3`
- **Autenticação para o executor:** `header_api_key`
- **Índice de integrabilidade:** 78
- **Endpoints:** 62 detalhados, 151 catalogados, 27 executáveis, 18 perguntas de FAQ
- **Armadilhas:**
  - Sem idempotência na API: timeouts em POST podem duplicar cobranças/transferências — usar externalReference e consultar antes de repetir.
  - Webhook só é confirmado com HTTP 200 exato (201/204 contam como falha); 15 falhas interrompem a fila e eventos somem após 14 dias.
  - Token de webhook é estático (sem HMAC): validar asaas-access-token e, se possível, IPs de origem.
- **Lacunas principais:**
  - Nenhum mecanismo de idempotência (header ou campo) documentado para POSTs de cobrança/transferência/pagamento.

### Bling

ERP em nuvem para pequenas e médias empresas (vendas, estoque, fiscal, financeiro, logística e integração com marketplaces), com API REST v3 autenticada por OAuth 2.0.

- **Pasta:** `catalogo/sistemas/bling/` — ficha humana em `ficha.md`
- **API:** REST · produção `https://api.bling.com.br/Api/v3` · sandbox `não há`
- **Autenticação para o executor:** `oauth2_refresh_token`
- **Índice de integrabilidade:** 64
- **Endpoints:** 75 detalhados, 185 catalogados, 32 executáveis, 18 perguntas de FAQ
- **Armadilhas:**
  - Só existe OAuth authorization code: integrações 'robôs' e Power BI precisam de um processo que guarde e renove o refresh_token (30 dias).
  - code expira em 1 minuto e é de uso único; reutilizar revoga o usuário.
  - Header enable-jwt: 1 deve ir na obtenção/renovação e nas chamadas; token opaco está descontinuado e JWT tem até ~3.000 caracteres.
- **Lacunas principais:**
  - Não há sandbox; o servidor 'ambiente de teste da documentação' (developer.bling.com.br/api/bling) não tem uso documentado.
  - A referência v3 não tem endpoint de cancelamento, carta de correção ou inutilização de NF-e/NFC-e (só cancelamento de NFS-e). Nem consulta de status…

### Focus NFe

Gateway REST/JSON que assina e transmite documentos fiscais eletrônicos (NF-e, NFC-e, NFS-e municipal e Nacional, CT-e, MDF-e, NFCom, DC-e) para SEFAZ, prefeituras e Ambiente Nacional, e que também captura NF-e, CT-e e NFS-e Nacional emitidas contra o CNPJ do cliente.

- **Pasta:** `catalogo/sistemas/focus-nfe/` — ficha humana em `ficha.md`
- **API:** REST · produção `https://api.focusnfe.com.br` · sandbox `https://homologacao.focusnfe.com.br`
- **Autenticação para o executor:** `basic`
- **Índice de integrabilidade:** 67
- **Endpoints:** 62 detalhados, 66 catalogados, 32 executáveis, 17 perguntas de FAQ
- **Armadilhas:**
  - A API não calcula tributos: CST/CSOSN, bases e alíquotas devem vir corretas do seu sistema.
  - Emissão de NF-e, NFS-e, CT-e e MDF-e é assíncrona (202): é preciso consultar ou usar webhook; NFC-e é síncrona.
  - A ref fica presa ao documento depois de autorizado (mesmo cancelado): nova nota exige nova ref.
- **Lacunas principais:**
  - O limite de 100 créditos/min e os cabeçalhos Rate-Limit-* só constam na doc legada (repositório oficial FocusNFe/api-doc, último commit 2026-05-28).…
  - Não encontrados na documentação.

### Mercado Livre (API de marketplace — site MLB)

API REST pública do Mercado Livre para vendedores e integradores: pedidos, packs, envios (Mercado Envios, Full, Flex), anúncios, preços, estoque, perguntas, reclamações/devoluções, faturamento de tarifas, notas fiscais do Faturador, visitas e reputação. Um host para tudo (https://api.mercadolibre.c…

- **Pasta:** `catalogo/sistemas/mercado-livre/` — ficha humana em `ficha.md`
- **API:** REST · produção `https://api.mercadolibre.com` · sandbox `não há`
- **Autenticação para o executor:** `oauth2_refresh_token`
- **Índice de integrabilidade:** 64
- **Endpoints:** 36 detalhados, 108 catalogados, 33 executáveis, 17 perguntas de FAQ
- **Armadilhas:**
  - refresh_token de uso único: duas renovações simultâneas para a mesma conta derrubam a conexão; serialize a renovação e grave o novo valor antes de us…
  - Access token dura só 6 horas; Power Query não consegue manter a rotação do refresh_token sozinho.
  - Quem autoriza tem de ser o administrador da conta; colaborador gera invalid_operator_user_id.
- **Lacunas principais:**
  - O executor do site (src/lib/executor.servidor.ts) só executa header_api_key e login_credenciais. Para o Mercado Livre falta: tipo oauth2_refresh_toke…
  - Os Termos permitem aplicativos de terceiros autorizados pelo vendedor, mas a cláusula 5.4 exige autorização expressa do Mercado Livre para usar o con…
  - Não há número publicado de requisições por minuto/hora (só 500 rpm na mensageria e max_requests_per_hour no recurso do aplicativo, com 18000 no exemp…

### Mercado Pago

Instituição de pagamento do grupo Mercado Livre. API REST única (api.mercadopago.com) para receber por Pix, boleto, cartão e conta Mercado Pago, com checkout hospedado (Checkout Pro), checkout transparente (Orders API / Payments API), assinaturas recorrentes, cofre de cartões, maquininhas Point, OA…

- **Pasta:** `catalogo/sistemas/mercado-pago/` — ficha humana em `ficha.md`
- **API:** REST · produção `https://api.mercadopago.com` · sandbox `https://api.mercadopago.com`
- **Autenticação para o executor:** `bearer`
- **Índice de integrabilidade:** 82
- **Endpoints:** 41 detalhados, 83 catalogados, 25 executáveis, 17 perguntas de FAQ
- **Armadilhas:**
  - A mesma base URL serve teste e produção — só o prefixo do Access Token (TEST- x APP_USR-) muda o ambiente. Um token trocado em deploy manda cobrança…
  - Existem duas APIs vivas para o mesmo problema: a Orders API (recomendada para integrações novas de Checkout Transparente) e a Payments API (que conti…
  - X-Idempotency-Key é obrigatório em POST /v1/payments. Retry sem a mesma chave duplica o pagamento.
- **Lacunas principais:**
  - O Mercado Pago não publica o número de requisições permitidas por minuto/hora em nenhuma página da referência ou dos guias. A existência do limite es…
  - O limite máximo de 'limit' em /v1/payments/search, /v1/orders/search, /checkout/preferences/search, /preapproval/search e /merchant_orders/search não…

### NFE.io

Gateway fiscal brasileiro que emite NFS-e, NF-e e NFC-e por API REST, captura documentos recebidos (NF-e, CT-e e NFS-e) pela distribuição da SEFAZ/ADN e ainda vende consultas cadastrais (CNPJ, CPF, CEP e NF-e na SEFAZ). Nasceu focado em NFS-e municipal e é onde tem a maior cobertura de prefeituras.

- **Pasta:** `catalogo/sistemas/nfe-io/` — ficha humana em `ficha.md`
- **API:** REST · produção `https://api.nfse.io` · sandbox `https://api.nfse.io`
- **Autenticação para o executor:** `header_api_key`
- **Índice de integrabilidade:** 69
- **Endpoints:** 43 detalhados, 142 catalogados, 30 executáveis, 17 perguntas de FAQ
- **Armadilhas:**
  - Duas chaves e quatro famílias de host: Chave de Dados nos subdomínios *.api.nfe.io (consultas) e Chave de Nota Fiscal em api.nfe.io (NFS-e) e api.nfs…
  - api.nfe.io e api.nfse.io são hosts DIFERENTES com nomes quase idênticos — é a troca de letra que mais gera 404/401 em integração nova.
  - 401 volta com corpo vazio: não há mensagem de erro para logar, só o status e o x-request-id.
- **Lacunas principais:**
  - A página de planos cobre só NFS-e. Não há preço público de NF-e, NFC-e, captura fiscal (NFe/CTe Inbound e NFS-e Inbound), consultas de CNPJ/CPF/CEP n…

### Nomus ERP (Nomus ERP Industrial e Nomus Start Industrial)

ERP para indústria (engenharia, PCP, MRP II, chão de fábrica, estoque, compras, vendas, fiscal e financeiro), em duas versões: Nomus ERP Industrial (médias e grandes, multiempresa, nuvem ou servidor dedicado) e Nomus Start Industrial (pequenas no Simples, só nuvem). Expõe uma API REST + JSON por cl…

- **Pasta:** `catalogo/sistemas/nomus/` — ficha humana em `ficha.md`
- **API:** REST · produção `—` · sandbox `não há`
- **Autenticação para o executor:** `header_api_key`
- **Índice de integrabilidade:** 29
- **Endpoints:** 35 detalhados, 159 catalogados, 31 executáveis, 17 perguntas de FAQ
- **Armadilhas:**
  - Limite de 1 requisição a cada 20 segundos: 1.000 registros (20 páginas) levam cerca de 7 minutos. Sempre recorte por período e empresa.
  - Página fixa de 50 registros, sem parâmetro de tamanho; sem o parâmetro pagina vêm só os 50 mais recentes.
  - Filtro numa linguagem própria dentro do parâmetro query (campo>=valor;campo<=valor); datas em yyyy-MM-ddTHH:mm:ss, mas a resposta devolve dd/mm/aaaa.
- **Lacunas principais:**
  - A Central de Ajuda diz que o cabeçalho é 'Basic' seguido da chave 'em Base64', e o exemplo publicado é um texto Base64 truncado. A coleção Postman en…
  - A URL base é por cliente (endereço do ERP + contexto + /rest). A coleção usa https://empresa.nomus.com.br/empresa/rest e o artigo de etiquetas usa ht…
  - O comparativo oficial fixa 1 requisição a cada 20 segundos e a coleção descreve um bloqueio 'após uma certa quantidade total de requisições'. Não se…

### Pagar.me

Provedor de serviços de pagamento e gateway do grupo Stone. A Core API v5 (REST/JSON) cobre pedidos e cobranças por cartão de crédito e débito, boleto, Pix, voucher e dinheiro, tokenização de cartões, carteira de clientes, planos e assinaturas com faturas, link de pagamento/checkout hospedado, rece…

- **Pasta:** `catalogo/sistemas/pagarme/` — ficha humana em `ficha.md`
- **API:** REST · produção `https://api.pagar.me/core/v5` · sandbox `https://api.pagar.me/core/v5`
- **Autenticação para o executor:** `basic`
- **Índice de integrabilidade:** 66
- **Endpoints:** 62 detalhados, 63 catalogados, 28 executáveis, 19 perguntas de FAQ
- **Armadilhas:**
  - Valores são SEMPRE inteiros em centavos (R$ 149,90 = 14990). Enviar 149.90 cobra R$ 1,49.
  - Cartão recusado não é erro HTTP: vem 200 com status failed e o motivo em last_transaction.acquirer_return_code (padrão ABECS desde 28/08/2026).
  - Teste e produção compartilham a MESMA URL; o ambiente vem do prefixo da chave. Trocar sk_test_ por sk_ em produção é a única mudança — e um erro aqui…
- **Lacunas principais:**
  - A documentação não descreve assinatura HMAC, header de token nem IPs de origem para validar a autenticidade das notificações. Sem isso, qualquer um q…
  - O envelope da resposta de GET /core/v5/settlements não aparece preenchido no exemplo oficial, então não foi possível confirmar se os registros vêm em…
  - A referência publica a simulação de antecipação como GET com payment_date obrigatório, mas a página de mudanças informa que desde 28/08/2026 a rota p…

### API Pix (arranjo Bacen)

Padrão de API do arranjo Pix definido pelo Banco Central: cobranças imediatas (cob), com vencimento (cobv), em lote (lotecobv), locations de QR dinâmico (loc), consulta de Pix recebidos e devoluções, webhooks e Pix Automático (rec, solicrec, cobr). Não é um fornecedor: quem expõe a API é cada PSP r…

- **Pasta:** `catalogo/sistemas/pix-bacen/` — ficha humana em `ficha.md`
- **API:** REST · produção `—` · sandbox `não há`
- **Autenticação para o executor:** `mtls_oauth2`
- **Índice de integrabilidade:** 64
- **Endpoints:** 49 detalhados, 3 catalogados, 22 executáveis, 18 perguntas de FAQ
- **Armadilhas:**
  - Não existe base URL do padrão: cada PSP publica a sua (produção e homologação) e o major v2 aparece no path. Toda a configuração tem de ser parametri…
  - mTLS em tudo: o certificado precisa ir também na chamada do token, e o token fica vinculado ao thumbprint do certificado — trocar de certificado sem…
  - txid é do recebedor, tem 26 a 35 caracteres alfanuméricos e é único por CPF/CNPJ do recebedor para sempre: não dá para reaproveitar nem depois de can…
- **Lacunas principais:**
  - O padrão não define base URL: os servers da spec são exemplos (pix.example.com). Cada PSP publica a sua para produção e homologação, e a posição do /…
  - Não encontrei sandbox, mock ou coleção de testes oficial do Bacen para a API Pix (a organização bacen no GitHub só tem quickstart para o DICT, restri…
  - Ficaram null porque o padrao nao define nenhum host: sem a URL base e a URL de token do PSP escolhido, o executor nao consegue montar chamada nenhuma…

### PlugNotas (Tecnospeed)

Gateway REST/JSON da TecnoSpeed que emite, consulta, cancela e baixa NFS-e (municipal e Ambiente Nacional), NF-e, NFC-e, NFCom e MDF-e, além de importar as NF-e emitidas contra o CNPJ do cliente (Notas Destinadas/DF-e). Não emite CT-e.

- **Pasta:** `catalogo/sistemas/plugnotas/` — ficha humana em `ficha.md`
- **API:** REST · produção `https://api.plugnotas.com.br` · sandbox `https://api.sandbox.plugnotas.com.br`
- **Autenticação para o executor:** `header_api_key`
- **Índice de integrabilidade:** 62
- **Endpoints:** 90 detalhados, 94 catalogados, 56 executáveis, 20 perguntas de FAQ
- **Armadilhas:**
  - A API não calcula tributos por você: CST/CSOSN, bases e alíquotas precisam sair corretos do seu sistema (há uma calculadora interna cuja versão é con…
  - Não existe emissão de CT-e/CT-e OS no PlugNotas — quem precisa de conhecimento de transporte tem de usar outro produto da TecnoSpeed ou outro gateway.
  - 'Produção' e 'homologação' não são bases diferentes: a base é sempre api.plugnotas.com.br e o ambiente fiscal vem da flag {documento}.config.producao…
- **Lacunas principais:**
  - Nenhum limite de requisições por minuto/hora é publicado e nenhuma resposta real trouxe cabeçalhos de rate limit. Sem isso, não dá para dimensionar p…
  - Preços, franquias e forma de cobrança não são publicados. A documentação confirma que importação de XML e sincronização de NFS-e Nacional consomem fr…
  - O PlugNotas não tem rotas de CT-e. A TecnoSpeed vende componentes de CT-e separados (repositórios Componente-CTe e Componente-CTeOS no GitHub oficial…

### SEFAZ — NF-e e NFC-e (web services oficiais)

Conjunto de web services SOAP 1.2 dos autorizadores estaduais (SEFAZ da UF, SVRS, SVAN), dos autorizadores de contingência (SVC-AN, SVC-RS) e do Ambiente Nacional, usados para autorizar, consultar, cancelar, corrigir, inutilizar e distribuir NF-e (modelo 55) e NFC-e (modelo 65). Acesso exclusivamen…

- **Pasta:** `catalogo/sistemas/sefaz-nfe/` — ficha humana em `ficha.md`
- **API:** SOAP · produção `Não existe base URL única. Cada autorizador publica a sua. Exemplo de referência usado neste catálogo (SVRS, NF-e modelo 55, produção): https://nfe.svrs.rs.gov.br` · sandbox `Ambiente de homologação, também por autorizador. Exemplo de referência (SVRS, NF-e modelo 55): https://nfe-homologacao.svrs.rs.gov.br`
- **Autenticação para o executor:** `certificado_icp_brasil`
- **Índice de integrabilidade:** 43
- **Endpoints:** 12 detalhados, 8 catalogados, 5 executáveis, 15 perguntas de FAQ
- **Armadilhas:**
  - Não existe base URL única: as URLs variam por UF, por ambiente (produção/homologação) e por modelo (NF-e 55 x NFC-e 65). Um integrador nacional preci…
  - Certificado A1 x A3: só o A1 (arquivo .pfx/.p12) permite integração servidor a servidor desassistida. O A3 fica em token/smartcard, exige PIN e não e…
  - O certificado tem dois papéis distintos: transmissão (TLS mútuo, precisa de Extended Key Usage 'Autenticação Cliente') e assinatura do XML (XML-DSig…
- **Lacunas principais:**
  - Nenhum valor do enum da especificação (header_api_key, bearer, basic, oauth2_client_credentials, oauth2_refresh_token, mtls_oauth2, login_credenciais…
  - Não existe base URL única e não conseguimos confirmar nesta sessão, em fonte oficial, as URLs de homologação de todos os 27 autorizadores nem as URLs…

### SyGeCom (Sagi, SGR, SGR+, Easy)

ERP vertical para gestão de resíduos e reciclagem (linha Easy, SGR, SGR+ e Sagi) com pesagem integrada a balança, compra e venda de material, estoque, fiscal, financeiro, logística de coletas e caçambas, contratos de exportação e MTR. Expõe a API REST 'API SAGI' em https://api.sagierp.com.br/api/v1…

- **Pasta:** `catalogo/sistemas/sygecom/` — ficha humana em `ficha.md`
- **API:** REST · produção `https://api.sagierp.com.br/api/v1` · sandbox `não há`
- **Autenticação para o executor:** `login_credenciais`
- **Índice de integrabilidade:** 39
- **Endpoints:** 16 detalhados, 63 catalogados, 14 executáveis, 17 perguntas de FAQ
- **Armadilhas:**
  - Três (na prática quatro) convenções de paginação diferentes na mesma API: limit/offset, limit/page, limite_por_pagina/pagina e page/pageSize. Escreve…
  - Em GET /movimentos o offset começa em 1, não em 0: offset=1 com limit=10 devolve os 10 primeiros registros.
  - Várias rotas respondem 204 sem corpo quando não há resultado, em vez de lista vazia. Cliente HTTP que faz response.json() direto quebra.
- **Lacunas principais:**
  - A spec manda enviar "homol": true no login para gerar token de homologação e avisa que o token só funciona no ambiente em que foi gerado, mas não pub…
  - https://api.sagierp.com.br/api/v1 é o host do Swagger oficial e é o que a spec implica (servers: /api/v1, relativo). Não está publicado se toda insta…
  - Não há termos de uso de API publicados. A página oficial de liberação já teve um passo de 'Contrato de Consentimento para Compartilhamento de Dados'…

### TOTVS Protheus

ERP da TOTVS para médias e grandes empresas, instalado no servidor de cada cliente ou no TOTVS Cloud. Expõe um serviço REST no próprio servidor (https://<servidor>:<porta>/rest), com autenticação por usuário e senha do Protheus (Basic ou token Bearer de 1 hora), escolha de empresa e filial pelo cab…

- **Pasta:** `catalogo/sistemas/totvs-protheus/` — ficha humana em `ficha.md`
- **API:** REST · produção `—` · sandbox `não há`
- **Autenticação para o executor:** `basic`
- **Índice de integrabilidade:** 37
- **Endpoints:** 27 detalhados, 568 catalogados, 25 executáveis, 23 perguntas de FAQ
- **Armadilhas:**
  - Não há host público: o REST do cliente precisa estar publicado (HTTPS, firewall/VPN) para um serviço na nuvem alcançá-lo.
  - Sem o cabeçalho tenantId e com PrepareIn=All, a resposta pode vir de outra empresa do grupo.
  - Datas no where são texto AAAAMMDD: enviar AAAA-MM-DD compara errado e devolve dados incorretos sem erro.
- **Lacunas principais:**
  - Não existe URL pública: cada cliente tem o seu servidor, porta e caminho, e o REST pode nem estar exposto à internet. O cliente precisa informar a UR…
  - O executor do site não monta Basic usuário:senha nem envia o cabeçalho tenantId, e o login_credenciais atual manda corpo JSON, enquanto o token do Pr…
  - Os filtros da genericQuery vão num único parâmetro SQL (where), unidos por ' AND ', com datas AAAAMMDD. O mecanismo atual de filtro composto do site…

### TOTVS WinThor (linha WinThor de Distribuição e Varejo)

ERP da TOTVS para distribuidores, atacadistas e varejo, instalado no ambiente do cliente (banco Oracle). Expõe APIs REST/JSON pelo WinThor Anywhere (WTA), no endereço http://<IP>:<porta> da própria instalação, com login por usuário e senha em MD5 que devolve um token JWT de 4 horas guardado em cook…

- **Pasta:** `catalogo/sistemas/totvs-winthor/` — ficha humana em `ficha.md`
- **API:** REST · produção `—` · sandbox `não há`
- **Autenticação para o executor:** `login_credenciais`
- **Índice de integrabilidade:** 31
- **Endpoints:** 23 detalhados, 104 catalogados, 15 executáveis, 18 perguntas de FAQ
- **Armadilhas:**
  - Não há API pública de contas a receber, contas a pagar, baixas ou movimento bancário: a maior dor (conciliação) não é atendida.
  - A TOTVS não autoriza ler objetos internos do banco (views, procedures, packages); ler o Oracle direto tira o cliente do suporte.
  - A senha vai em MD5 maiúsculo da senha em maiúsculas; o hash vale como senha.
- **Lacunas principais:**
  - Não existe API pública de contas a receber, contas a pagar, baixas, extrato ou movimento bancário. A árvore 'APIs Integrações WinThor' (40 páginas) e…
  - A TDN diz que o token fica em cookie, mas não publica nome, caminho, domínio nem flags do cookie. O envio por Authorization: Bearer só aparece docume…
  - Todos os exemplos usam http://host:porta. Não há documentação de HTTPS no WTA. Expor o WTA à internet em http trafegaria o hash da senha e o token em…
