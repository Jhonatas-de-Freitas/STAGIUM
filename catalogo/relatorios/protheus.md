# Relatório do agente — TOTVS Protheus (lote P4, 2026-10-19)

```
SISTEMA: totvs-protheus
STATUS: documentado
ENDPOINTS: 27 detalhados + 568 catalogados (547 operações de 121 especificações do TOTVS Developers marcadas como disponíveis no Protheus + 21 serviços da TDN; 17 marcadas como indisponíveis ficaram de fora)
FAQ: 23 perguntas
INDICE: 37 — documentação pública mas espalhada, sem sandbox, sem webhooks, login com usuário e senha do ERP (Basic ou token de 1 h), host diferente em cada cliente, paginação padrão sem rate limit publicado
VALIDADOR: 0 erros, 0 avisos
LACUNAS RELEVANTES: sem host público (https://<servidor>:<porta>/rest; no TOTVS Cloud, https://<ambiente>.protheus.cloudtotvs.com.br:<porta>/rest); versão mínima da LIB para a genericQuery não publicada (instalação antiga pode dar 404); como excluir estornos e baixas canceladas da SE5 não está documentado (somar a SE5 sem esse filtro pode inflar valores); campos customizados, compartilhamento de tabelas, privilégios e dados protegidos variam por cliente; cada requisição consome licença (503 quando falta); sem sandbox, webhooks ou termos de uso para produto de terceiro; chave da NF-e, situação na SEFAZ e valor/custo de estoque não confirmados
MENOR CONFIANÇA: grafia de pagesize/pageSize, parâmetro order e teto de página (inferidos); valores R/P de E5_RECPAG na SE5 (documentados só na FK5); propriedades da API de centro de custo (do schema, sem resposta real); formato de URL do TOTVS Cloud (um exemplo); significado de E5_TIPODOC, E5_MOTBX, E1_SITUACA e F2_TIPO (a planilha mostra os códigos)
SURPRESAS / AJUSTES SUGERIDOS À TAXONOMIA: o TOTVS Developers lista 125 APIs do Protheus, nenhuma de financeiro, fiscal ou estoque; essas leituras vão pela genericQuery (GET /api/framework/v1/genericQuery), oficial e usada pela própria TOTVS no CRM SFA; desde 2025 a conciliação oficial é o Conciliador BackOffice (E5_RECONC marca o movimento conciliado; SIG guarda o extrato importado); entidades sugeridas ContaBancaria (hoje SA6 em TabelaAuxiliar e SE8 em Transacao) e Recebimento
```

## Notas do orquestrador

- **Conferência:** Basic `usuario:senha` em Base64 (TDN 185748452), token de 1 h e refresh de 24 h (465383509) e a genericQuery (`tables`, `fields`, `where` em SQL, resposta com `items`, `remainingRecords`, `protectedDataFields` e `hasNext`) batem com a documentação oficial. A página da genericQuery não cita `page`/`pagesize`: os nomes seguem o guia de APIs TOTVS.
- **Autenticação no site:** tipo `basic` com `basic_campos` (usuário e senha) e o cabeçalho `tenantId` vindo da credencial `tenant_id` (`headers_credenciais`). O modo token (`bearer_alternativo`) ainda não é usado pelos executores.
- **Filtros:** `where` montado pelo executor a partir de `composicao_where`: condições unidas por `" AND "`, datas em AAAAMMDD (`{data_inicial_aaaammdd}`), banco/agência/conta validados (só letras, números, ponto e hífen) e **sem filtro livre**. O executor nunca aceita um `where` pronto vindo do navegador e recusa datas fora do formato.
- **Paginação:** `fim: hasNext_false`. Se o servidor ignorar o número da página e repetir a mesma, o executor para em vez de duplicar linhas.
- **Datas:** a genericQuery devolve datas sem zero à esquerda (`2015-3-3`); a planilha mostra `2015-03-03`.
- **No site:** 20 consultas — contas a receber e a pagar, baixas, movimentos bancários (com "só não conciliados"), extrato importado, saldos bancários, bancos, naturezas, clientes, fornecedores, produtos, saldos de estoque, pedidos de venda (e itens), pedidos de compra, notas de saída e de entrada (e itens) e centros de custo. Ficam de fora a consulta genérica (tabela e where livres), a estrutura de tabela e a filial atual.
- **Testes:** só contra servidores simulados. Nenhuma chamada a um Protheus real.

Arquivos: `sistemas/totvs-protheus/` (system.json, endpoints.json, openapi.yaml, tools.json, chunks.jsonl, faq.jsonl, ficha.md).
