# Stagium — assistente de dados (Sagi/SyGeCom, Nomus, Qive, Mercado Livre, WinThor e Protheus)

Chat em que o cliente escolhe o sistema da empresa (hoje **Sagi (SyGeCom)**, **Nomus**, **Qive (Arquivei)**, **Mercado Livre**, **WinThor** ou **Protheus**) e pede, em português, a informação que precisa.
O assistente encontra a consulta certa no catálogo, pede aprovação, solicita as credenciais
do usuário de integração, consulta a API e devolve a planilha (.xlsx).

## Implementações do Jhonatas (branch `Jho`)

Registro do que foi implementado nesta branch, do mais recente para o mais antigo. Nada aqui
está na `main` (que é a que o Lovable publica) até ser revisado e juntado.

| Data | O quê | Onde |
|---|---|---|
| 19/10/2026 | **WinThor e Protheus no catálogo e no chat** (lote P4). Protheus traz o financeiro (contas a receber e a pagar, baixas, movimentos bancários com "só não conciliados", extrato e saldos); WinThor traz pedidos, clientes, produtos, preços e estoque (a API dele não tem financeiro). Executor ganhou senha em MD5, cookie de sessão, Basic com `tenantId`, `where` montado só pelo executor e fim de página por `hasNext`; recusa endereço por IP. | `catalogo/sistemas/totvs-*`, `src/lib/executor.servidor.ts`, `catalogo/relatorios/winthor.md` e `protheus.md` |

## Fluxo

1. O cliente pergunta ("produtos cadastrados", "movimentos de estoque da matriz").
2. A IA responde usando o catálogo e indica a consulta, com método, caminho e colunas.
3. O cliente clica em **Executar esta consulta**.
4. Aparece um **formulário** com os filtros e as credenciais do sistema (Sagi: e-mail, senha e endereço; Nomus: chave de integração e endereço; Qive: API ID, API KEY e, opcionalmente, o endereço de testes; Mercado Livre: botão **Conectar Mercado Livre**, sem chaves digitadas; WinThor: usuário, senha do WinThor Anywhere e endereço; Protheus: usuário, senha, endereço do REST e empresa/filial).
   WinThor e Protheus rodam no servidor de cada cliente: o endereço precisa ter nome de domínio (o servidor do site não chama IP).
   No WinThor o servidor converte a senha no MD5 que o login exige; no Protheus o filtro `where` é montado só pelo executor (datas AAAAMMDD, sem filtro livre).
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

Para regerar o conhecimento (hoje Sagi, Nomus, Qive, Mercado Livre, WinThor e Protheus):

```sh
cd catalogo && .venv/Scripts/python scripts/gerar_conhecimento.py --sistemas sygecom,nomus,arquivei,mercado-livre,totvs-winthor,totvs-protheus
```

Sem `--sistemas`, entram todos os 15 sistemas documentados (o chat só oferece os que têm receita de execução).

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

## Mercado Livre: conexão por autorização (OAuth)

O vendedor não digita chaves: clica em **Conectar Mercado Livre**, entra com a conta principal na
tela do Mercado Livre (numa janela) e autoriza o **aplicativo do Stagium**, que é um só, da HUBx,
para todos os clientes. Cada autorização só enxerga os dados daquele vendedor.

- Segredos no Lovable (More → Cloud → Secrets): `MERCADO_LIVRE_CLIENT_ID` e
  `MERCADO_LIVRE_CLIENT_SECRET`, do aplicativo criado no DevCenter do Mercado Livre. Opcional:
  `MERCADO_LIVRE_REDIRECT_URI` (padrão `https://stagium.lovable.app/conectar/mercado-livre`, que
  precisa ser exatamente o cadastrado no aplicativo).
- Sem esses segredos o Mercado Livre não aparece na escolha de sistema do chat.
- Retorno da autorização: `src/routes/conectar.$sistema.tsx` troca o código pelo acesso no servidor
  e devolve à conversa por `postMessage`; se o pop-up for bloqueado, "Conectar nesta aba".
- O acesso vale 6 h e o refresh token é de uso único: o executor renova e devolve o novo ao
  navegador (`credenciaisNovas`), que regrava no cofre se a pessoa salvou com PIN.
- Consultas no site: vendas, anúncios (duas etapas: ids e depois `/items/bulk` em lotes de 20),
  perguntas, reclamações, reputação e visitas por dia. Faturamento e tarifas ficam de fora.
- Teste local sem o Mercado Livre real: `MERCADO_LIVRE_TOKEN_URL`, `MERCADO_LIVRE_AUTH_URL` e
  `MERCADO_LIVRE_BASE_URL` num `.env.local` (fora do Git) apontando para um servidor simulado.

