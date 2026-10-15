# Comece aqui — passagem do projeto

Guia para quem assume a parte técnica do projeto a partir de 21/09/2026. O proprietário segue responsável pela **captação de clientes**; o desenvolvimento, o catálogo e o piloto passam para você.

Leia este arquivo inteiro antes de mexer em qualquer coisa. Ele leva uns 15 minutos e evita repetir erros que já custaram tempo.

---

## 1. O que é o produto

O produto se chama **Stagium** (nome definido em 08/10/2026). É um **assistente de IA em chat** para empresas brasileiras. O cliente pergunta em português o que precisa do sistema que usa ("cobranças pagas em agosto", "movimentos de estoque da matriz"); o assistente:

1. encontra no catálogo a consulta certa na API daquele sistema;
2. mostra o que vai consultar e pede aprovação;
3. pede as credenciais do usuário de integração, num formulário (nunca no chat);
4. executa a consulta, pagina e devolve a planilha `.xlsx`.

Ele **só lê**. Nunca emite nota, cria cobrança ou cancela nada. Para escrita, explica e entrega código, e quem executa é o cliente.

O valor está no **catálogo**: a documentação das APIs de cada sistema, convertida para um formato que a IA consulta e que o executor sabe chamar.

## 2. Onde estamos

| Item | Situação |
|---|---|
| Sistemas documentados | **11** — Asaas, Bling, Focus NFe, Mercado Pago, NFE.io, Nomus, Pagar.me, Pix (Bacen), PlugNotas, SEFAZ, SyGeCom (Sagi) |
| Endpoints | 547 detalhados, 1.017 catalogados, **302 executáveis** pelo assistente (Nomus: 35, 159 e 31) |
| Site (chat) | No ar em stagium.lovable.app; o cliente escolhe **Sagi, Nomus ou Qive** |
| Executor no servidor | Funciona. Testado contra servidor local no formato do Sagi; **ainda não rodou contra a API real** |
| IA no site | Código pronto; **depende da variável `ANTHROPIC_API_KEY`** no Lovable |
| Piloto | Cliente atual do proprietário, usa **Sagi (SyGeCom)** |
| Planejamento | 147 sistemas mapeados em `catalogo/manifest.json`; próximo é o Lote 4 |

Índice completo, com armadilhas e lacunas de cada sistema: [`catalogo/relatorios/indice-sistemas.md`](catalogo/relatorios/indice-sistemas.md).

## 3. Mapa do repositório

```
jhow/
├── COMECE-AQUI.md              ← este arquivo
├── README.md                   ← o site: como ligar a IA, segurança, estrutura
├── src/                        ← site (TanStack Start + React, publicado pelo Lovable)
│   ├── routes/index.tsx        ← landing page (stagium.lovable.app)
│   ├── routes/chat.tsx         ← tela do chat (/chat)
│   ├── lib/contato.ts          ← número do WhatsApp da landing
│   └── lib/
│       ├── assistente.servidor.ts  ← conversa com a IA (servidor)
│       ├── executor.servidor.ts    ← consulta a API do cliente (servidor)
│       ├── conhecimento.json       ← gerado do catálogo — NÃO editar à mão
│       ├── cofre-local.ts          ← credenciais salvas com PIN (só no navegador)
│       ├── consultas-salvas.ts     ← consultas salvas, período relativo
│       └── planilha.ts             ← monta o .xlsx no navegador
└── catalogo/                   ← o ativo principal
    ├── ESPECIFICACAO.md        ← regras de como documentar um sistema (LEIA)
    ├── manifest.json           ← fila de sistemas, status e decisões
    ├── taxonomia.json          ← vocabulário canônico (v1.2)
    ├── glossario_br.json       ← termos fiscais, bancários e logísticos
    ├── sistemas/<slug>/        ← um sistema por pasta
    │   ├── ficha.md            ← versão humana (comece por aqui em cada sistema)
    │   ├── system.json         ← dados do sistema, autenticação, lacunas, índice
    │   ├── endpoints.json      ← cada endpoint, com parâmetros e bloco de execução
    │   ├── openapi.yaml        ← OpenAPI 3.1 reconstruído
    │   ├── tools.json          ← definições de ferramenta MCP
    │   ├── chunks.jsonl        ← textos para busca da IA (um por endpoint)
    │   ├── faq.jsonl           ← perguntas típicas de cliente, com resposta
    │   └── kit/                ← kits Power Query (só Asaas, Focus, Bling — em standby)
    ├── scripts/
    │   ├── validar.py          ← confere a Definition of Done de um sistema
    │   ├── executar.py         ← executor de linha de comando (buscar/detalhar/puxar)
    │   ├── reclassificar.py    ← aplica mudança de taxonomia em todo o catálogo
    │   ├── gerar_conhecimento.py ← gera src/lib/conhecimento.json
    │   ├── gerar_indice.py     ← gera relatorios/indice-sistemas.md
    │   └── publicar.sh         ← commit + pull --rebase + push, com trava de segurança
    ├── mapeamentos/            ← histórico das reclassificações de taxonomia
    └── relatorios/             ← lotes, changelog, arquitetura, índice
```

## 4. Como rodar

### Catálogo (Python)

```sh
cd catalogo
python -m venv .venv
.venv/Scripts/python -m pip install pyyaml jsonschema openapi-spec-validator openpyxl requests
.venv/Scripts/python scripts/validar.py --todos        # os 10 devem dar 0 erros
.venv/Scripts/python scripts/executar.py buscar "movimentos de estoque" --sistema sygecom
```

No Windows, rode Python com `PYTHONUTF8=1` quando o script tiver acentos na saída.

### Site

```sh
bun install
bun run dev          # abre em http://localhost:8080 (ou a próxima porta livre)
bun run build        # precisa passar antes de qualquer push
```

Sem `ANTHROPIC_API_KEY` o chat abre, mas avisa que a IA está desligada.

**Aviso:** `bun run lint` acusa milhares de erros de fim de linha (CRLF) nos arquivos originais do Lovable. É efeito do Git no Windows, não do código. Rode o lint só nos arquivos que você alterar.

## 5. Como continuar documentando sistemas

O trabalho é feito com **Claude Code**, um agente por sistema, em lotes de três. O processo que funcionou:

1. **Leia** `catalogo/ESPECIFICACAO.md` inteiro. Ele é a lei: formatos, regras de veracidade, bloco de execução, o que o validador exige.
2. **Pegue o próximo lote** em `manifest.json` (hoje: Lote 4 — Omie, Tiny, Conta Azul) e marque como `em_andamento`.
3. **Lance um agente por sistema** com o modelo de instrução abaixo. No máximo três ao mesmo tempo — cinco em paralelo já estouraram o limite de uso uma vez.
4. **Confira você mesmo** quando cada agente terminar:
   - `validar.py <slug>` com 0 erros;
   - sorteie 4 ou 5 endpoints e confira o caminho na documentação oficial;
   - leia a seção "menor confiança" do relatório do agente.
5. **Atualize** o `manifest.json`, escreva `relatorios/lote-NN.md` e registre no `changelog.md`.
6. **Regere** os derivados: `gerar_indice.py` e, se o sistema for entrar no site, `gerar_conhecimento.py`.
7. **Publique** com `bash catalogo/scripts/publicar.sh "mensagem"`.

### Modelo de instrução para o agente

> Você é um arquiteto de integrações sênior do ecossistema brasileiro, cético por padrão ("não encontrei" é melhor que inventar). Documente o sistema **<NOME>** (slug `<slug>`, categoria `<categoria>`) no catálogo em `catalogo/`.
> Leia antes, por completo: `ESPECIFICACAO.md`, `taxonomia.json` e a entrada do sistema em `manifest.json`. Use `sistemas/asaas/` como referência de qualidade.
> Escreva apenas em `sistemas/<slug>/`: system.json (com `execucao_auth`), endpoints.json (com bloco `execucao` em todo endpoint detalhado), openapi.yaml, tools.json, chunks.jsonl, faq.jsonl, ficha.md. Não produza kit nem planilha.
> Fonte: só documentação oficial do fornecedor, com `fonte_url` e `data_consulta`. Procure antes versão Markdown das páginas, `llms.txt` ou spec OpenAPI oficial.
> Regra 2.1: no máximo 3 chamadas com credencial inválida à API real; nunca escrita em produção; encerre todo processo que abrir.
> Salve cada arquivo assim que concluir. Rode `validar.py <slug>` até 0 erros. Responda no formato da seção 11 da especificação.

## 6. Decisões já tomadas (não reabra sem motivo)

| Data | Decisão |
|---|---|
| 14/09 | Catálogo verificável: só fonte oficial; o que não se confirma vira lacuna, nunca suposição |
| 17/09 | Produto é **chat**, não API; o catálogo é a base de conhecimento dele |
| 17/09 | **Somente leitura**: o assistente nunca executa escrita |
| 17/09 | Credenciais nunca passam pelo chat nem vão ao modelo de IA |
| 17/09 | Kits Power Query em **standby** (serviço premium futuro); VBA fora do escopo |
| 17/09 | Taxonomias v1.1 e v1.2 aprovadas; sistemas antigos reclassificados |
| 17–18/09 | Novos tipos de autenticação: `login_credenciais` (ERPs com usuário e senha, 17/09) e `certificado_icp_brasil` (SEFAZ e afins, que o executor recusa, 18/09) |
| 18/09 | Site restrito ao Sagi para o piloto |
| 09/10 | **Nomus** documentado (31 consultas de leitura) e liberado no site ao lado do Sagi; chat passa a perguntar o sistema da empresa |
| 14/10 | **Mercado Livre** e **Qive (Arquivei)** documentados; repositório renomeado para hubsolucoes/STAGIUM |
| 15/10 | **Qive** liberada no chat com 8 consultas (NF-e, CT-e, CT-e OS, NFS-e, MDF-e, boletos, comprovantes, empresas); filas de eventos, PDFs e webhooks ficam de fora |
| 18/09 | Repositório tornado **público** a pedido do proprietário |
| 08/10 | Produto passa a se chamar **Stagium**; site em stagium.lovable.app (landing na raiz, chat em /chat) |
| 08/10 | Credenciais podem ser salvas **no navegador, criptografadas com PIN**; consultas salvas com período relativo |

## 7. Pendências, em ordem de prioridade

1. **Revogar as chaves de IA que circularam no chat** (uma da OpenAI e uma da Anthropic, ambas enviadas em 18/09). Gere novas e **só** as coloque na variável de ambiente do Lovable. Nenhuma está no repositório — isso foi verificado em todo o histórico.
2. **Configurar `ANTHROPIC_API_KEY`** no Lovable (Settings → Environment variables) com a chave nova.
3. **Rodar o piloto do Sagi com credencial real.** O cliente precisa criar um usuário de integração em *Menu Úteis > Controle de Usuários e Senhas > Cadastro de Usuários*, com e-mail preenchido e **"Bloquear Acesso ao SAGI Mobile" desmarcada**. As perguntas a enviar à SyGeCom estão em `catalogo/sistemas/sygecom/perguntas-ao-fornecedor.md` (URL de homologação, host da instalação, limite de requisições, autorização de uso).
4. ~~Filtros no executor do site~~ **Feito em 08/10:** período, data de referência, filial e tipo/situação aparecem num formulário na conversa; o catálogo gera os filtros de cada consulta (`gerar_conhecimento.py`). O período também é lido da pergunta ("agosto", "semana passada", "de 01/08 a 15/08", "primeiro trimestre") por regras em `src/lib/periodo.ts`, sem depender do modelo.
5. **Cofre de credenciais no servidor.** Hoje a credencial fica na memória do navegador ou, se o cliente quiser, salva no próprio navegador com PIN (`src/lib/cofre-local.ts`). Para usar em vários computadores, ou para cliente com auditoria (financeiro, saúde), o cofre no servidor com login precisa existir antes.
6. **Endpoint `POST /sql-query` do Sagi:** decidir se o assistente pode usar. É o mais poderoso para relatório e o mais sensível em proteção de dados.
7. **Taxonomia v1.3**, proposta no Lote 3 e pendente de decisão: `Disponibilidade`, `CertificadoDigital`, `AssinaturaDistribuicao`, ações `testar` e `sincronizar`.
8. **Revisar Focus NFe, PlugNotas e NFE.io** para os códigos de rejeição de 4 posições da reforma tributária (NT 2025.002-RTC).
9. **Lote 4:** Omie, Tiny, Conta Azul.
10. **Busca da IA:** hoje o recorte do catálogo que vai ao modelo é escolhido por palavra-chave. Com muitos sistemas, vai precisar de busca semântica.

## 8. Cuidados que já custaram caro

- **Bloqueio de IP:** um agente chamou a API da Focus NFe várias vezes com token falso e o IP foi bloqueado. Daí a regra 2.1.
- **Agentes duplicados:** um agente que cai por limite de uso volta a rodar se receber mensagem. Antes de relançar um sistema, confira na lista de agentes que o anterior não está ativo.
- **Lovable fora de sincronia:** às vezes ele não pega o último commit. Se o site não refletir a mudança, um commit pequeno força a sincronização.
- **Repositório público:** qualquer chave commitada vaza na hora. `publicar.sh` recusa o envio se detectar credencial ou planilha fora do `.gitignore`, mas a atenção é sua.
- **Números nos relatórios:** calcule a partir do `manifest.json`, nunca de memória. Já houve total errado corrigido depois.

## 9. Fora do repositório

| O quê | Onde |
|---|---|
| Projeto Lovable (espelho do repositório) | `https://lovable.dev/projects/ceb1624d-2966-4683-8d20-f7a7088cccb2` |
| Apresentação comercial (12 slides) | artefato "Assistente de Dados", no Claude do proprietário |
| Roteiro da reunião comercial | artefato "Roteiro da Reunião", no Claude do proprietário |

Peça ao proprietário acesso ao projeto Lovable e aos dois artefatos, se precisar editá-los.
