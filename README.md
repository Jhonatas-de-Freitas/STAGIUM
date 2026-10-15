# Stagium — assistente de dados (Sagi/SyGeCom, Nomus e Qive)

Chat em que o cliente escolhe o sistema da empresa (hoje **Sagi (SyGeCom)**, **Nomus** ou **Qive (Arquivei)**) e pede, em português, a informação que precisa.
O assistente encontra a consulta certa no catálogo, pede aprovação, solicita as credenciais
do usuário de integração, consulta a API e devolve a planilha (.xlsx).

## Fluxo

1. O cliente pergunta ("produtos cadastrados", "movimentos de estoque da matriz").
2. A IA responde usando o catálogo e indica a consulta, com método, caminho e colunas.
3. O cliente clica em **Executar esta consulta**.
4. Aparece um **formulário** com os filtros e as credenciais do sistema (Sagi: e-mail, senha e endereço; Nomus: chave de integração e endereço; Qive: API ID, API KEY e, opcionalmente, o endereço de testes).
5. O servidor autentica, pagina a consulta e devolve as linhas; a planilha é montada no navegador.
   Sistemas com limite de requisições (Nomus: 1 a cada 20 s) são consultados uma página por chamada:
   o navegador espera o intervalo, mostra o progresso e permite parar e gerar com o que já veio.
   Na Qive as buscas são POST com corpo JSON (filtros e cursor no corpo) e valor, série e natureza
   da nota são lidos do XML em Base64. As consultas que o site oferece por sistema, os rótulos dos
   filtros de corpo e a tradução dos valores ficam em `catalogo/scripts/gerar_conhecimento.py`
   (`CONSULTAS_DO_SITE`, `CORPO_OPCOES`, `TRADUCOES_DE_VALOR`, `TITULOS_DO_SITE`).

## Credenciais e segurança

- As credenciais do cliente ficam **na memória do navegador**, enquanto a aba estiver aberta.
  Vão ao servidor apenas no momento da consulta e **nunca** são enviadas ao modelo de IA,
  gravadas em disco ou registradas em log. O botão "Esquecer credenciais" limpa na hora.
- Se o cliente marcar **"Lembrar neste navegador"**, as credenciais são guardadas
  criptografadas (AES-GCM, chave derivada de um PIN por PBKDF2) no `localStorage` daquele
  computador. O PIN não é guardado; 5 PINs errados apagam o pacote. Nada disso vai ao servidor.
  É proteção de uso diário, não substitui o cofre no servidor com login (pendência no guia).
- **Consultas salvas** guardam só a consulta, os filtros e um nome, também no navegador.
  Períodos como "mês passado" e "este mês" são recalculados a cada execução.
- O cliente **nunca** deve digitar senha no campo de conversa — só no formulário.
- O assistente executa **somente leitura**. Nenhuma operação cria, altera ou cancela nada.
- Para o Sagi, crie um usuário dedicado à integração em *Menu Úteis > Controle de Usuários e
  Senhas > Cadastro de Usuários*, com e-mail preenchido e a opção "Bloquear Acesso ao SAGI
  Mobile" **desmarcada**.

## Chave da IA

A chave fica em variável de ambiente no servidor (no Lovable: Settings → Environment variables):

| Variável | Para quê |
|---|---|
| `ANTHROPIC_API_KEY` | chave da Anthropic (Claude), começa com `sk-ant-api03-` |
| `OPENAI_API_KEY` | alternativa |
| `MODELO_IA` | opcional, troca o modelo |

Nunca coloque a chave em arquivo do repositório: ele sincroniza com o GitHub.

## Como está montado

| Parte | Onde |
|---|---|
| Landing page (`/`) | `src/routes/index.tsx` |
| Interface do chat (`/chat`) | `src/routes/chat.tsx` |
| Grade de planilha (proposta, prévia, landing) | `src/components/grade-planilha.tsx` |
| Contato comercial (WhatsApp) | `src/lib/contato.ts` |
| Conversa com a IA (servidor) | `src/lib/assistente.servidor.ts` |
| Execução na API do cliente (servidor) | `src/lib/executor.servidor.ts` |
| Conhecimento gerado do catálogo | `src/lib/conhecimento.json` |
| Geração da planilha no navegador | `src/lib/planilha.ts` |
| Credenciais salvas com PIN (navegador) | `src/lib/cofre-local.ts` |
| Consultas salvas e período relativo | `src/lib/consultas-salvas.ts` |
| Catálogo completo das APIs | `catalogo/` |

Para regerar o conhecimento (hoje Sagi, Nomus e Qive):

```sh
cd catalogo && .venv/Scripts/python scripts/gerar_conhecimento.py --sistemas sygecom,nomus,arquivei
```

Sem `--sistemas`, entram todos os 11 sistemas documentados (o chat só oferece os que têm receita de execução).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ceb1624d-2966-4683-8d20-f7a7088cccb2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

<!-- sync -->
