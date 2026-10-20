# Relatório do agente — TOTVS WinThor (lote P4, 2026-10-19)

```
SISTEMA: totvs-winthor
STATUS: documentado
ENDPOINTS: 23 detalhados + 104 catalogados
FAQ: 18 perguntas
INDICE: 31 — documentação pública na TDN e sem custo extra para quem tem licença, mas sem sandbox nem webhooks, login com senha em MD5 e sessão em cookie, API só no servidor do cliente e cobrindo só o que o e-commerce precisa (nada de financeiro)
VALIDADOR: 0 erros, 0 avisos
LACUNAS RELEVANTES: não há API pública de contas a receber, contas a pagar, baixas, extrato ou movimento bancário (a conciliação bancária não é atendida); a TOTVS não autoriza terceiros a usar objetos internos do banco (TDN 746503236); nome e atributos do cookie de sessão não publicados; exemplos oficiais em http://IP:porta; pedidos sem daysOfSearch trazem só 15 dias e sem saleOrigin só pedidos web; produtos, estoque e preços dependem de "Enviar para E-commerce" (só o estoque documenta callOrigin=WSH); rate limit, tamanho máximo de página e formato do erro de login não publicados; sem sandbox
MENOR CONFIANÇA: envelope {first, items, hasNext} de pedido.listar e cliente.listar (inferido das outras listas do serviço); Bearer nas rotas /api/... (o transporte documentado é o cookie); se /logistica/apis/v1/nota/buscar traz todas as notas ou só as de roteirização; método HTTP de algumas rotas catalogadas do PDV Omni e do WSH
SURPRESAS / AJUSTES SUGERIDOS À TAXONOMIA: GET /pedidovenda/liberacaopedido grava no banco (marcado como não executável); artigo da Central de 2024 diz que o WTA "não possui APIs", contra a TDN (prevaleceu a TDN); entidades sugeridas TabelaPreco (hoje Produto/listar.precos) e ServicoIntegracao (hoje Empresa/consultar_status)
```

## Notas do orquestrador

- **Conferência:** login (TDN 644722134: senha em MD5 maiúsculo da senha em maiúsculas, token em cookie, 4 h), pedidos (632099891: `orders/list`, `daysOfSearch` padrão 15, `saleOrigin`, `viewDocument`), estoque (632097669: `branchId` obrigatório, `callOrigin=WSH`) e a política de objetos internos (746503236) batem com a documentação oficial.
- **Autenticação:** `login_credenciais` com `{senha|md5_maiusculo}` e `repassar_cookies: true`. O cliente digita a senha normal; o executor (site e CLI) calcula o MD5 e reenvia o cookie da sessão junto com o Bearer.
- **Paginação:** `fim: hasNext_false` nas listas com `items`; sem o campo, vale a página incompleta.
- **No site:** 7 consultas (pedidos, clientes, produtos, preços, estoque, filiais, planos de pagamento). Filial obrigatória onde a API exige `branchId`; origem do pedido e "Todos / só e-commerce" no estoque viram opções com rótulo em português; pedidos levam `viewDocument=true` e o campo "Alterados nos últimos (dias)".
- **Rede:** o servidor do site (Cloudflare) não chama IP direto. O WTA precisa ser publicado com nome de domínio, de preferência com HTTPS. O executor recusa endereço por IP com mensagem clara.
- **Testes:** só contra servidores simulados (site e CLI). Nenhuma chamada a WTA real.

Arquivos: `sistemas/totvs-winthor/` (system.json, endpoints.json, openapi.yaml, tools.json, chunks.jsonl, faq.jsonl, ficha.md).
