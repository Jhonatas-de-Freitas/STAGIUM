# Especificação operacional do catálogo (para agentes de lote)

Este arquivo consolida as regras do prompt mestre aprovadas pelo usuário em 2026-09-14, mais as decisões da Fase 1. **Todo agente que documentar um sistema deve ler este arquivo inteiro, `taxonomia.json` e a entrada do sistema em `manifest.json` antes de começar.**

Raiz do catálogo: `C:\Users\anton\Downloads\Projetos\jhow\catalogo`

---

## 1. Contexto

**O produto é um assistente de IA em chat que consulta a API do cliente por ele.** Fluxo alvo:

1. O cliente diz qual informação quer ("quero as cobranças pagas de agosto").
2. O assistente procura no catálogo um endpoint do sistema dele que atenda e **propõe**, explicando o que será consultado, com quais filtros e o que virá.
3. Com o "sim" do cliente, o assistente **executa a chamada** com a credencial guardada no cofre do backend, pagina, normaliza o JSON e **devolve a planilha preenchida**.

Decisões do usuário em 2026-09-17:
- **Somente leitura.** O assistente nunca executa criação, emissão, cancelamento, estorno ou qualquer escrita. Sobre escritas, ele explica e entrega código, mas quem executa é o cliente.
- **Credenciais em cofre no backend**, cadastradas pelo cliente em tela própria. Nunca no texto do chat, no prompt, em log ou em arquivo do catálogo.
- **Kits Power Query em standby** (serviço premium futuro): os de Asaas, Focus NFe e Bling ficam como estão; **não produza kit nos próximos sistemas**.

O produto não é uma API para o cliente. O cliente conversa com ele para entender a API do sistema que usa, e o assistente responde com a documentação na ponta da língua e **entrega código pronto**. O catálogo é o conhecimento desse assistente (RAG), então o conteúdo precisa responder bem a perguntas reais: "como emito um boleto no Asaas?", "por que recebo 401 no Bling?", "me dá um Power Query que traga meus pedidos".

O assistente também (1) responde "o que dá para integrar com X", (2) gera código de integração funcional, (3) desenha arquiteturas entre sistemas. ICP: médias e grandes empresas, integradoras, software houses, times de TI e **times de BI/analistas que trabalham em Excel/Power BI**. Cada ficha serve a um vendedor (o que dá, quanto custa, quanto demora), a um desenvolvedor, a um analista de BI e a uma máquina (schema exato). `tools.json` é mantido para um eventual uso futuro do catálogo como servidor MCP.

## 2. Regras de veracidade (não negociáveis)

1. Toda informação técnica vem da **documentação oficial do fornecedor**. Blogs, fóruns e repositórios de terceiros só servem de pista para achar a fonte oficial.
2. **Nunca invente** endpoint, parâmetro, campo, código de erro, rate limit ou preço. Não confirmado → `null` + item em `lacunas[]`.
3. Todo item traz `fonte_url` e `data_consulta` (YYYY-MM-DD). Se a doc tiver versão, `versao_doc`.
4. Informação inferida por padrão de setor → `"confianca": "inferido"`. Default: `"verificado"` — e só use `verificado` para o que você **leu na página oficial nesta sessão**.
5. `lacunas[]` preenchido honestamente. Um endpoint inventado destrói a confiança no produto inteiro.
6. Campos comerciais (preço, limites) têm `volatil: true`.

### 2.1 Chamadas a APIs reais

- Sem credencial válida, prefira testar contra um **mock local** (e encerre o processo do mock ao final).
- Contra a API real, faça **no máximo 3 chamadas com credencial inválida por sistema**, só para confirmar o formato do erro. A Focus NFe bloqueou nosso IP (429) depois de repetidas autenticações falhas, e isso afeta todos os agentes e o usuário.
- Nunca chame operações de escrita em produção.
- Lições do Lote 1 para o Power Query:
  - Com HTTP 401/403, o Excel devolve `Response.Status` nulo; trate com `Record.FieldOrDefault` (veja `scripts/prototipo-ibge/kit/powerquery/01_fnApi.pq`).
  - O Power Query do Excel não expõe cabeçalhos de paginação (`X-Total-Count` etc.); pagine pelo tamanho da página ou por campo do corpo.
- Encerre todo processo que você abrir: Excel, servidor mock, node/python.

## 3. Restrições legais

- **Não copie a documentação literalmente.** Descrições próprias, schemas estruturados, exemplos autorais, sempre com link. Nomes de campos/paths/enums são fatos técnicos e devem ser exatos; frases descritivas devem ser reescritas.
- Nenhuma credencial, token, certificado ou dado pessoal real. Placeholders óbvios: `<<SEU_CLIENT_ID>>`, `<<SUA_API_KEY>>`. CPF/CNPJ de exemplo: use `00000000000` / `00000000000191` ou valores explicitamente de teste publicados pelo fornecedor (marcar). E-mails: `@example.com`.
- `conformidade`: dado pessoal (LGPD), dado sensível, base legal típica, certificado digital (A1/A3), homologação/autorização regulatória (Bacen, ANS, SEFAZ), residência de dados, `termos_uso_url`, `permite_uso_em_produto_terceiro` (sim/nao/indefinido).

## 4. Vocabulário canônico

Definido em `taxonomia.json` v1.2 — use TODOS os blocos `entidades*` e `acoes*` (o validador os carrega automaticamente). Destaques: v1.1 trouxe `encerrar`, `manifestar`, `restaurar`, `liquidar`, `Recebivel`, `Deposito`, `OrdemProducao`, `Anuncio`; v1.2 trouxe `Relatorio`, `Contestacao`, `Cartao`, `Plano`, `LocationPagamento` e a ação `desvincular`. **Use somente nomes existentes lá.** Se um endpoint não couber, NÃO crie entidade: registre em `lacunas[]` com a sugestão de extensão e use a mais próxima com `observacao`.

Convenções:
- `id` do endpoint: `<slug>.<entidade_snake_case>.<acao>[.<qualificador>]` — ex.: `asaas.cobranca.criar`, `asaas.cobranca.obter.pix_qrcode`, `focus-nfe.nota_fiscal.emitir.nfe`. Entidade em snake_case: `ContaReceber` → `conta_receber`, `NotaFiscal` → `nota_fiscal`, `TabelaAuxiliar` → `tabela_auxiliar`.
- Nome da ferramenta MCP: o `id` com `.` → `__` e `-` preservado. Ex.: `focus-nfe__nota_fiscal__emitir__nfe`. Precisa casar com `^[a-zA-Z0-9_-]{1,64}$`.
- Assinatura **recorrente** = `Assinatura`. Assinatura **eletrônica** = `Contrato`/`Documento` com ação `enviar`/`assinar`.

## 5. Arquivos por sistema — `sistemas/<slug>/`

| Arquivo | Conteúdo |
|---|---|
| `system.json` | Schema da seção 6 |
| `endpoints.json` | `{"sistema": "<slug>", "data_consulta": "...", "endpoints": [ ...seção 7... ], "endpoints_secundarios": [ ... ]}` |
| `openapi.yaml` | OpenAPI **3.1.0**, reconstruído; `operationId` = id canônico com `.`→`__`; `x-confianca` em toda operação; `x-fonte-url` em toda operação; `servers` com produção e sandbox |
| `tools.json` | `{"sistema": "<slug>", "tools": [ {name, title, description, inputSchema, annotations:{readOnlyHint, destructiveHint, idempotentHint, openWorldHint:true}} ]}` — um tool por endpoint detalhado. `inputSchema` JSON Schema 2020-12 com `type: object`. `description` escrita para um LLM decidir **quando** usar (e quando NÃO usar), mencionando pré-requisitos. readOnly/destructive devem seguir a ação na taxonomia |
| `chunks.jsonl` | Um chunk por endpoint detalhado (nunca dividir). Linha: `{"id": "<id>", "texto": "...", "metadata": {"sistema","categoria","entidade_canonica","acao_canonica","metodo","path","id","fonte_url","data_consulta","confianca"}}`. `texto` com 400–900 tokens (~1.800–4.000 caracteres em português), **autocontido**: nome do sistema, base URL, como autenticar, método+path, parâmetros principais, exemplo resumido, erros comuns, pré-requisitos, armadilhas |
| `faq.jsonl` | **Perguntas que um cliente faria no chat**, uma por linha: `{"id": "<slug>.faq.<n>", "pergunta": "...", "variacoes": ["..."], "resposta": "...", "codigo": {"linguagem": "python|typescript|curl|power_query_m|null", "conteudo": "..."}, "endpoints_relacionados": ["<id>"], "tipo": "como_fazer | erro_comum | conceito | limite_custo | ambiente", "fonte_url": "...", "data_consulta": "...", "confianca": "verificado|inferido"}`. Mínimo 12 por sistema documentado, cobrindo: primeiros passos/autenticação, erros mais comuns (401/403/422/429 e erros de negócio), sandbox x produção, paginação, webhooks, pelo menos 2 perguntas sobre extrair dados para análise (o que dá para puxar, com quais filtros e limites) e as tarefas de negócio mais pedidas. Resposta autoral, em português, 80–400 palavras |
| `ficha.md` | Versão humana: resumo comercial (o que dá pra fazer, custo, prazo, índice de integrabilidade com justificativa), depois técnica (auth, ambientes, limites, webhooks, tabela de endpoints canônicos, armadilhas, lacunas, fontes) |

### 5.1 Kit pronto — `sistemas/<slug>/kit/` — EM STANDBY (não produzir)

> Decisão de 2026-09-17: o kit vira serviço premium futuro. Asaas, Focus NFe e Bling já têm o seu e são mantidos. **Nos demais sistemas, não gere `kit/` nem planilha.** A seção continua aqui como referência de quando for retomada.

**Objetivo:** a empresa recebe o kit, preenche **somente** as credenciais e o ambiente, e o código funciona sem nenhuma outra edição. Todo placeholder `<<...>>` fica exclusivamente nos arquivos de configuração. (VBA está fora do escopo por decisão do usuário em 2026-09-17.)

```
kit/
  README.md                    # passo a passo em português: o que preencher, onde obter cada credencial no painel do fornecedor,
                               # como usar no Excel / Power BI / Python / Node, como trocar sandbox→produção, cuidados de segurança
  powerquery/
    00_Parametros.pq           # EXCEL: lê credenciais e ambiente da tabela "tbConfig" da aba Config
                               # via Excel.CurrentWorkbook(){[Name="tbConfig"]}[Content] e devolve um record com os valores
    00_Parametros_PowerBI.pq   # POWER BI: mesmo record, com valores vindos de parâmetros do Power BI (placeholders <<...>>)
    01_fnApi.pq                # função genérica: base URL pelo Ambiente, autenticação, paginação com List.Generate, erro legível
    10_<Entidade>.pq           # uma consulta por listagem útil para BI (ex.: 10_Cobrancas.pq, 11_Clientes.pq): só leitura, colunas tipadas
    tbConfig.json              # conteúdo inicial da tabela tbConfig: {"linhas": [{"Chave": "Ambiente", "Valor": "sandbox", "Descricao": "..."}, ...]}
                               # credenciais com Valor = "<<...>>"; é lido pelo gerador de planilha (scripts/gerar_planilha.ps1)
    Config_layout.md           # versão legível da tabela tbConfig (colunas Chave | Valor | Descricao): chave, descrição, exemplo, obrigatória?
  python/
    .env.example               # ÚNICO lugar com credenciais
    cliente.py                 # cliente (auth, retry, paginação, erros) + exemplos em if __name__ == "__main__"
  typescript/
    .env.example
    cliente.ts                 # mesmo papel, com fetch nativo (Node 18+)
```

Convenções do Power Query (o gerador de planilha depende delas):
- O nome da consulta é o nome do arquivo sem prefixo numérico e sem extensão (`01_fnApi.pq` → `fnApi`, `10_Cobrancas.pq` → `Cobrancas`, `00_Parametros.pq` → `Parametros`). As consultas se referenciam por esses nomes.
- `tbConfig` tem as colunas `Chave`, `Valor` e `Descricao`. Chaves padrão: `Ambiente` (`sandbox` ou `producao`), mais as credenciais do sistema (ex.: `ApiKey`, `ClientId`, `ClientSecret`, `RefreshToken`) e filtros opcionais (`DataInicial`, `DataFinal`, no formato AAAA-MM-DD).
- Estrutura validada em 2026-09-17 no Excel 365 (protótipo em `scripts/prototipo-ibge/kit`, siga-o como modelo):
  - `Parametros` lê a `tbConfig`, e `fnApi` usa `Parametros[Chave]`.
  - As consultas de entidade chamam `fnApi(...)`.
  - O Formula.Firewall é resolvido pelo gerador, que grava na planilha a opção de ignorar níveis de privacidade (`Queries.FastCombine`). Não tente contornar o firewall de outro jeito.
- Gere a planilha com `scripts/gerar_planilha.ps1 -Kit sistemas/<slug>/kit -Saida saida/<Nome>.xlsx`. Se tiver credencial de sandbox pública ou de teste, rode também `scripts/testar_planilha.ps1`; caso contrário, registre em lacunas que o refresh não foi testado com a API real.
- `Web.Contents` com URL base fixa por ambiente e `RelativePath`/`Query`/`Headers`, para o refresh funcionar no Power BI.
- Só leitura: nenhuma consulta de entidade pode enviar corpo de requisição. `fnApi` só pode usar `Content` para obter token OAuth.

Regras:
- **Ambiente padrão = sandbox/homologação.** Trocar para produção é uma linha na tabela; o README avisa sobre o risco.
- OAuth2 (authorization code + refresh): Python/TS implementam a troca e a renovação do token; o README explica como obter o primeiro código de autorização. No Power Query, avalie com honestidade o que é viável (ex.: a renovação a cada refresh pode invalidar o refresh token anterior) e documente a limitação e a alternativa (ex.: script Python agendado que mantém o token atualizado na tabela). Não invente suporte.
- Certificado digital (mTLS/ICP-Brasil): Python/TS apontam arquivo + senha no .env. O Power Query não envia certificado cliente. Se **nenhuma** leitura do sistema funcionar sem mTLS:
  - declare em `system.json`: `"kit_power_query": {"viavel": false, "motivo": "<explicação>", "alternativa": "<ex.: script Python que grava CSV/Excel lido pelo Power Query>"}`;
  - o kit dispensa as consultas `.pq` e a planilha, mas mantém `powerquery/Config_layout.md` descrevendo a alternativa;
  - o `cliente.py` deve oferecer a exportação para CSV/XLSX usada pela alternativa.
  Nos demais casos, use `"kit_power_query": {"viavel": true}`.
- Segurança no README: não compartilhar a planilha com credenciais preenchidas, preferir parâmetros do Power BI e cofre de segredos, usar chave com o menor privilégio possível.
- O kit deve ser coerente com `endpoints.json` (mesmos paths, parâmetros e campos) e só usar endpoints documentados.
- Cubra as leituras dos casos de uso de negócio da ficha; não é preciso uma consulta por endpoint secundário.

## 6. `system.json`

```json
{
  "slug": "", "nome": "", "categoria": "<enum taxonomia>",
  "fornecedor": { "razao_social": null, "pais": "BR", "site": "" },
  "descricao_curta": "",
  "porte_alvo": ["media", "grande"],
  "verticais": [],
  "status": "documentado | acesso_restrito | sem_api | descontinuada",
  "api": {
    "estilo": "REST | SOAP | GraphQL | gRPC | RPC-sobre-HTTP | arquivo/EDI",
    "base_urls": { "producao": "", "sandbox": "" },
    "versao_atual": "", "politica_versionamento": "",
    "formatos": ["json"], "spec_oficial_url": null, "openapi_disponivel": false
  },
  "autenticacao": {
    "tipos": ["<enum auth>"], "fluxo_resumido": "", "escopos_permissoes": [],
    "expiracao_token": "", "renovacao": "", "ip_allowlist_obrigatorio": false
  },
  "execucao_auth": {
    "tipo": "header_api_key | bearer | basic | oauth2_client_credentials | oauth2_refresh_token | mtls_oauth2 | login_credenciais | certificado_icp_brasil | nenhum",
    "header": "access_token",
    "prefixo": "",
    "usuario_basic_e_a_credencial": false,
    "headers_fixos": { "enable-jwt": "1" },
    "token_url": null,
    "credenciais_necessarias": [
      { "nome": "api_key", "rotulo": "Chave de API", "segredo": true, "onde_obter": "Painel > Integrações > Chaves de API", "obrigatoria": true }
    ],
    "base_url_por_ambiente": { "sandbox": "", "producao": "" },
    "login": {
      "metodo": "POST",
      "caminho": "/login",
      "corpo": { "email": "{usuario_email}", "password": "{senha}", "origem": "API" },
      "campo_token": "token",
      "prefixo": "Bearer ",
      "expira_em": null
    },
    "observacao": ""
  },
  "ambiente_testes": { "sandbox": true, "como_obter": "", "custo": "", "dados_ficticios": true },
  "limites": {
    "rate_limit": "", "janela": "", "burst": "",
    "paginacao": { "estilo": "offset | cursor | page", "tamanho_max": null },
    "tamanho_max_payload": "", "timeout_recomendado": "", "politica_retry": "",
    "idempotencia": { "suportada": false, "header": null },
    "volatil": true
  },
  "webhooks": {
    "suportados": true, "eventos": [], "verificacao_assinatura": "",
    "politica_reentrega": "", "requer_endpoint_publico": true
  },
  "erros": { "formato": "", "codigos_principais": [] },
  "sdks_oficiais": [],
  "comercial": {
    "modelo_acesso": "aberto | plano_pago | programa_parceiro | sob_contrato",
    "custo_api": "", "exige_homologacao": false, "tempo_medio_aprovacao": "", "volatil": true
  },
  "conformidade": {
    "trafega_dado_pessoal": true, "dado_sensivel": false, "base_legal_tipica": "",
    "exige_certificado_digital": false, "regulador": null, "residencia_dados": null,
    "termos_uso_url": "", "permite_uso_em_produto_terceiro": "indefinido"
  },
  "esforco_integracao": {
    "complexidade": "baixa | media | alta | muito_alta",
    "horas_estimadas_mvp": null, "principais_armadilhas": []
  },
  "casos_uso_negocio": [
    { "titulo": "", "dor_resolvida": "", "endpoints_envolvidos": [], "valor_percebido": "" }
  ],
  "indice_integrabilidade": {
    "score": 0,
    "componentes": {
      "documentacao": { "peso": 20, "pontos": 0, "justificativa": "" },
      "sandbox": { "peso": 15, "pontos": 0, "justificativa": "" },
      "autenticacao": { "peso": 15, "pontos": 0, "justificativa": "" },
      "webhooks": { "peso": 15, "pontos": 0, "justificativa": "" },
      "limites_paginacao": { "peso": 10, "pontos": 0, "justificativa": "" },
      "sdks_comunidade": { "peso": 10, "pontos": 0, "justificativa": "" },
      "acesso_sem_barreira": { "peso": 10, "pontos": 0, "justificativa": "" },
      "versionamento": { "peso": 5, "pontos": 0, "justificativa": "" }
    }
  },
  "qualidade_doc": { "nota": 0, "observacoes": "" },
  "monitoramento": { "changelog_url": null, "canal_breaking_changes": null, "frequencia_revisao_sugerida": "mensal | trimestral" },
  "lacunas": [ { "campo": "", "descricao": "", "impacto": "baixo | medio | alto" } ],
  "fontes": [ { "url": "", "titulo": "", "data_consulta": "" } ]
}
```

`score` = soma dos `pontos` (cada um ≤ `peso`). `qualidade_doc.nota` de 0 a 10. Horas estimadas de MVP são julgamento — explique a premissa em `esforco_integracao`.

### 6.1 `execucao_auth` — receita de autenticação legível por máquina

O executor do produto monta a chamada a partir deste bloco, sem ler texto livre.

`certificado_icp_brasil` é o padrão das integrações com o governo (SEFAZ, CT-e, MDF-e, eSocial, EFD-Reinf): certificado A1/A3 no canal TLS **e** assinatura XML (XML-DSig) no próprio documento. Credenciais: `certificado_pem`, `chave_privada_pem`, `senha_certificado` e, quando o host varia por UF, `base_url`. Declare em `observacao` o elemento que precisa ser assinado. **O executor não executa esse tipo**: ele exige assinatura XML e, em geral, credenciamento estadual — os endpoints ficam com `seguro_para_executar: false` e o assistente entrega o código, sem executar.

`login_credenciais` é o fluxo de ERPs que autenticam com usuário e senha e devolvem um token: preencha o sub-bloco `login` com o método, o caminho (relativo à base URL ou absoluto), o corpo — usando `{nome_da_credencial}` como marcador, substituído pelo valor vindo do cofre — e `campo_token`, o caminho em notação de ponto até o token na resposta. Quando o sistema exige a credencial transformada, use `{nome_da_credencial|transformacao}`; o cliente digita o valor normal e o executor converte. Transformações aceitas (validador e executores): `md5_maiusculo` — MD5 em maiúsculas do valor passado para maiúsculas (WinThor). Se o sistema guarda a sessão em cookie, marque `"repassar_cookies": true` no `login`: os executores reenviam os cookies do login em todas as consultas, além do token. Só use este tipo quando não houver OAuth; o usuário do ERP deve ser dedicado à integração e com o menor conjunto de permissões. `credenciais_necessarias` é exatamente o que o cliente cadastra no cofre do backend: use nomes estáveis (`api_key`, `token`, `client_id`, `client_secret`, `refresh_token`, `access_token`, `certificado_pem`, `chave_privada_pem`, `senha_certificado`). Em padrões de arranjo e sistemas on-premise, onde o host não é fixo, entram também como credenciais de configuração: `base_url`, `token_url` e `escopos`. Nenhum valor real entra aqui.

## 7. Endpoint (item de `endpoints[]`)

```json
{
  "id": "", "entidade_canonica": "", "acao_canonica": "",
  "nome_fornecedor": "", "metodo": "GET|POST|PUT|PATCH|DELETE", "path": "",
  "descricao": "", "quando_usar": "",
  "auth_requerida": [], "escopos": [],
  "parametros": [
    { "nome": "", "local": "path | query | header | body", "tipo": "string | integer | number | boolean | object | array | date | datetime | decimal",
      "obrigatorio": true, "formato": "", "enum": [], "default": null, "min": null, "max": null, "regex": null,
      "descricao": "", "campo_canonico": null, "observacao_br": "" }
  ],
  "request_exemplo": {},
  "response_sucesso": { "status": 200, "schema_resumido": {}, "exemplo": {} },
  "erros": [ { "status": 400, "codigo": "", "mensagem": "", "causa_provavel": "", "como_resolver": "" } ],
  "efeitos_colaterais": "", "idempotente": false, "custo_rate_limit": 1,
  "paginacao": null, "webhooks_relacionados": [], "endpoints_relacionados": [],
  "pre_requisitos": [],
  "snippets": { "curl": "", "python": "", "typescript": "", "power_query_m": "" },
  "snippets_observacao": "",
  "confianca": "verificado | inferido",
  "fonte_url": "", "data_consulta": ""
}
```

- Body aninhado: use `nome` com notação de ponto (`customer.address.zipCode`) ou `tipo: object` com `descricao` apontando o schema; seja exato.
- `campo_canonico` deve existir em `taxonomia.json > campos_canonicos` ou ser `null`.
- Snippets: funcionais, com tratamento de erro e retry simples quando fizer sentido; Python com `requests`/`httpx`, TypeScript com `fetch`. Placeholders para credenciais.
- **`power_query_m`** (Excel/Power BI):
  - **Somente para ações de leitura** (`readOnlyHint: true` na taxonomia: listar, obter, consultar_status, baixar_arquivo, calcular, validar). O Power Query reexecuta a consulta a cada atualização, então uma operação de escrita (criar/emitir/cancelar/estornar...) seria repetida e poderia duplicar cobrança ou nota. Para ações de escrita, `power_query_m: null` e `snippets_observacao` explica o motivo e aponta os snippets Python/TypeScript.
  - Use `Web.Contents(baseUrl, [RelativePath=..., Query=..., Headers=...])`, com a base fixa e o caminho em `RelativePath`, para o refresh funcionar no serviço do Power BI.
  - Implemente a paginação completa com `List.Generate`, tratando o fim da paginação conforme a API. Converta para tabela com `Table.FromRecords` ou `Table.ExpandRecordColumn` e tipagem das colunas principais.
  - Credencial como parâmetro (`<<SUA_API_KEY>>`), com comentário recomendando parâmetro do Power Query e não texto fixo.
  - Se a API exigir OAuth2 com refresh, certificado cliente (mTLS/ICP-Brasil) ou assinatura de requisição, diga em `snippets_observacao` se o Power Query é viável, e com que limitação.
- `snippets_observacao`: pré-requisitos e limitações do código (dependências, limites do Power Query, certificado). Pode ser `""`.
- **Cobertura:** todos os endpoints das entidades canônicas suportadas + autenticação + webhooks. Se a API tiver >80 endpoints, detalhe CRUD das entidades canônicas + auth + webhooks e liste os demais em `endpoints_secundarios[]`: `{nome, metodo, path, descricao, entidade_canonica, acao_canonica, confianca: "catalogado_nao_detalhado", fonte_url}`.


### 7.1 Bloco `execucao` (obrigatório em todo endpoint detalhado)

O assistente **executa a chamada na API do cliente** e devolve os dados em planilha. Para isso o endpoint precisa ser descritível por máquina, sem depender de texto livre:

```json
"execucao": {
  "seguro_para_executar": true,
  "motivo_inseguro": null,
  "lista_em": "data",
  "campo_total": null,
  "paginacao": {
    "tipo": "offset | page | cursor | versao | nenhuma",
    "param_pagina": "offset",
    "param_tamanho": "limit",
    "tamanho_max": 100,
    "param_cursor": null,
    "campo_proximo": null,
    "fim": "pagina_incompleta | hasMore_false | hasNext_false | sem_proximo_cursor | total_atingido"
  },
  "filtros_recomendados": [
    { "parametro": "dateCreated[ge]", "descricao": "recorte por período; evita puxar a base inteira" }
  ],
  "colunas_sugeridas": [
    { "caminho": "id", "titulo": "ID", "tipo": "string" },
    { "caminho": "customer.name", "titulo": "Cliente", "tipo": "string" },
    { "caminho": "value", "titulo": "Valor", "tipo": "decimal" }
  ]
}
```

Regras:
- `seguro_para_executar` é `true` só para leitura sem efeito colateral (ações com `readOnlyHint: true` na taxonomia). Qualquer escrita é `false` com `motivo_inseguro` preenchido.
- `fim: hasNext_false` encerra quando a resposta traz `hasNext: false`; se o campo não vier, vale a página incompleta.
- `lista_em` é o caminho em notação de ponto até o array de registros (`null` quando a resposta é um objeto único). `[]` para array na raiz.
- `colunas_sugeridas`: de 5 a 15 campos que um analista quer ver na planilha, com caminho exato na resposta. Use `campo_canonico` quando existir.
- Tudo aqui é fato da documentação. Sem confirmação → `null` + `lacunas[]`.

## 8. Índice de integrabilidade (0–100)

| Componente | Peso |
|---|---|
| Qualidade e completude da documentação oficial | 20 |
| Sandbox gratuito e self-service | 15 |
| Autenticação moderna (OAuth2/JWT vs. chave estática/SOAP) | 15 |
| Webhooks com assinatura e reentrega | 15 |
| Rate limits e paginação adequados a carga real | 10 |
| SDKs oficiais e comunidade ativa | 10 |
| Acesso sem barreira comercial | 10 |
| Estabilidade e política de versionamento | 5 |

## 9. Sistemas com acesso restrito

Se a doc exigir contrato/NDA/credencial de parceiro, não force: `status: "acesso_restrito"`, documente o que é público (visão geral, modelo de parceria, contato, termos), `endpoints: []` ou apenas os endpoints publicamente documentados, e explique em `lacunas[]`. Ainda gere todos os arquivos (tools/chunks podem estar vazios; `openapi.yaml` com `paths: {}` é válido).

## 10. Definition of Done — autoverificação

Rodar, a partir da raiz do catálogo:

```
.venv\Scripts\python scripts\validar.py <slug>
```

O script precisa terminar com **0 erros**. Avisos devem ser lidos e resolvidos ou justificados. Além do script, declarar:
- [ ] Todo campo técnico tem `fonte_url` e `data_consulta`.
- [ ] Nada sem fonte — ou marcado `inferido`.
- [ ] Nenhum trecho copiado literalmente da documentação.
- [ ] `lacunas[]` honesto.
- [ ] Onde a confiança é menor e por quê.

## 11. Relatório do agente ao orquestrador

Ao terminar, responder **somente** com:

```
SISTEMA: <slug>
STATUS: documentado | acesso_restrito | sem_api | descontinuada
ENDPOINTS: N detalhados + N catalogados
FAQ: N perguntas
INDICE: <score> — <justificativa em 1 linha>
VALIDADOR: <n erros> erros, <n avisos> avisos (resumo dos avisos)
LACUNAS RELEVANTES: ...
MENOR CONFIANÇA: ...
SURPRESAS / AJUSTES SUGERIDOS À TAXONOMIA: ...
```

## 12. Manutenção

`monitoramento` obrigatório: changelog/release notes, canal de breaking changes, frequência (mensal para pagamentos, fiscal e bancos; trimestral para o resto).
