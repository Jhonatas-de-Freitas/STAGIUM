# Perguntas para o Mercado Livre sobre a API (integração somente leitura)

> **Como usar este documento.** Copie do "Contexto" em diante e envie pelo canal de suporte para integradores do
> Mercado Livre (<https://developers.mercadolivre.com.br/pt_br/suporte-para-integradores>).
> As perguntas foram reduzidas ao que a documentação pública **não responde**. O que ela já responde está em
> "O que já sabemos", no fim.
>
> Levantamento feito em **2026-10-14** sobre o portal <https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br>.

---

## Contexto (para colar na mensagem)

Somos uma empresa que oferece a vendedores do Mercado Livre um assistente de análise que lê os dados da conta do
próprio vendedor (vendas, envios, anúncios, estoque, perguntas, reclamações e faturamento de tarifas) e entrega
planilhas para ele mesmo. O uso é **exclusivamente de leitura** (somente GET; não pedimos o scope write), por meio de um
aplicativo nosso no DevCenter que cada vendedor autoriza via OAuth. Restam as dúvidas abaixo.

---

## 1. Termos de uso

1. A cláusula 5.4 dos Termos do Programa de Desenvolvedores exige autorização expressa para usar o Conteúdo de forma a
   obter estatísticas de vendas, de desempenho ou informações de um usuário específico. Relatórios e planilhas com os
   dados **do próprio vendedor, entregues apenas a ele**, se enquadram nessa cláusula? Se sim, como pedimos a autorização?
2. Alguns clientes preferem criar o próprio aplicativo (desenvolvimento in-house) e nos dar acesso. Os Termos dizem que as
   chaves de acesso são confidenciais e podem ser revogadas se reveladas a terceiros. É permitido que o vendedor nos
   entregue client_id, client_secret e refresh_token do aplicativo dele, ou o único modelo aceito é o aplicativo do
   integrador autorizado pelo vendedor?
3. Podemos manter cópia dos dados lidos (cache) para gerar planilhas de meses anteriores, respeitando a atualização de
   24 horas da cláusula 5.3? Há prazo máximo de retenção?

## 2. Limites de requisição

4. Qual é o limite de requisições por aplicação (Client ID) e por endpoint para `/orders/search`, `/items/bulk`,
   `/users/{id}/items/search`, `/shipments/{id}` e `/post-purchase/v1/claims/search`? Qual a janela (minuto/hora)?
5. O 429 traz cabeçalho `Retry-After` ou outro indicador de quanto esperar?
6. Nos relatórios de faturamento o 429 é "bloqueio preventivo por IP". Como nosso servidor atende vários vendedores a
   partir do mesmo IP, o limite é por IP ou por IP + usuário? Qual o número?
7. O campo `max_requests_per_hour` de `/applications/{app_id}` é o limite efetivo da aplicação?

## 3. Pedidos

8. Qual é o valor máximo de `limit` e de `offset` em `/orders/search`? Existe modo scroll para pedidos?
9. A doc diz que, buscando como vendedor, a busca "continua a filtrar os pedidos cancelados". Os cancelados são omitidos
   por padrão? Com `order.status=cancelled` eles aparecem?
10. O limite de 12 meses vale para `/orders/{id}` também ou só para a busca?

## 4. Anúncios, perguntas e envios

11. `/items/bulk` mantém o limite de 20 IDs por chamada do multiget antigo?
12. `/questions/search` aceita filtro por data? Qual o `limit` máximo?
13. Em `/orders/{order_id}/shipments`, a vista atual (objeto único / `list_all`) já foi descontinuada? Qual é o formato
    definitivo a usar a partir de agora?

## 5. Reclamações e faturamento

14. Em `/post-purchase/v1/claims/search`, o valor de `type` para devoluções é `return` (tabela) ou `returns` (exemplos)?
15. O detalhe `/billing/integration/periods/key/{key}/group/ML/details` devolve `total` e `last_id` na raiz junto de
    `results`? Pode publicar um exemplo completo do envelope?

## 6. OAuth e notificações

16. Por quanto tempo o `code` recebido no redirect_uri vale antes da troca por token?
17. As notificações têm algum mecanismo de assinatura ou segredo para validar a origem, além da lista de IPs?

---

## O que já sabemos (não precisa responder)

- OAuth 2.0 authorization code; access token de 6 h; refresh token de 6 meses, uso único, rotativo; scopes read, write,
  offline_access; autorização só pela conta administradora.
- Sem sandbox; usuários de teste (até 10) em produção.
- `/users/me` dá o seller_id; `/orders/search` filtra por `order.date_created/closed/last_updated.from/to` (só a hora).
- `/users/{id}/items/search`: limit até 100, scan + scroll_id (5 min) acima de 1000.
- Reclamações: limit até 100, offset + limit < 10000, `range` com milissegundos.
- Faturamento: key = AAAA-MM-01, limit até 1000, from_id/last_id, uma consulta por dia.
- Webhooks: reentrega por 1 h, `missed_feeds` por 2 dias, resposta em 500 ms.
- `/shipments` exige `x-format-new: true` desde 2025-10-12 e não devolve mais `order_id`.
