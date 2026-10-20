# Pacotes do Stagium: o que cada um dá direito

Fonte única dos números: `src/lib/planos.ts` (campo `direitos`). O painel do cliente, a área da equipe e a página /planos leem de lá. Preços são **propostas** de 19/10/2026, para revisar com o Tom.

## Matriz de direitos

| Direito | Essencial | Profissional | Empresa |
|---|---|---|---|
| Preço mensal | R$ 297 | R$ 697 | sob consulta |
| Preço anual (2 meses grátis) | R$ 2.970 | R$ 6.970 | sob consulta |
| Sistemas conectados | 1 | 3 | ilimitado (uso justo) |
| Consultas por mês | 300 | 3.000 | ilimitado (uso justo) |
| Pessoas na equipe | 2 | 8 | ilimitado |
| Dashboards | 3 | 15 | ilimitado |
| Gráficos por dashboard | 8 | 16 | 40 |
| Créditos de IA por mês | 100 | 600 | 3.000 |
| Relatórios agendados | 2 | 15 | ilimitado |
| Destinatários por relatório | 2 | 6 | ilimitado |
| Frequências | semanal, mensal | diária, dias úteis, semanal, mensal | todas (inclui trimestral) |
| Formatos | Excel | Excel e CSV | Excel e CSV |
| Insights | básicos | completos | completos |
| Alertas | 0 | 10 | 50 |
| Atualizações dos dados por dia* | 1 | 4 | 24 |
| Envio de planilhas | sim | sim | sim |
| Histórico de auditoria | 30 dias | 90 dias | 365 dias |
| Exportar dados da empresa (LGPD) | não | sim | sim |
| Suporte | e-mail, dia útil | e-mail + ajuda com o usuário de integração | canal direto |

\* Vale quando o servidor estiver ligado (ver FILA-DE-PREPARACAO.md). Hoje a atualização é manual.

Teste grátis (14 dias): recursos do Profissional com tetos baixos (1 sistema, 100 consultas, 2 pessoas, 3 dashboards, 40 créditos de IA, 2 relatórios, 2 alertas, auditoria de 14 dias). Serve para o cliente sentir o valor sem custo alto para nós.

## Como vender cada pacote

**Essencial — "pare de exportar relatório na mão".** Quem: empresa pequena, 1 ERP, 1 ou 2 pessoas no financeiro. Gancho: perguntar em português e receber a planilha pronta; 2 relatórios que chegam sozinhos toda semana ou mês. Objeção comum: "só tenho um sistema". Resposta: é para isso mesmo. Quando ele pedir diário, alerta ou mais gente, vira Profissional.

**Profissional — "o financeiro e a controladoria que vivem de planilha".** Quem: escritório de contabilidade ou empresa média com 2–3 sistemas. Gancho: dashboards montados por ele com sugestão da IA, relatórios diários em dias úteis às 8h, alertas ("avise se o vencido passar de R$ X"), insights completos, auditoria. É o plano de destaque: o teste grátis já mostra os recursos dele.

**Empresa — "tudo isso, sem apertar".** Quem: grupo, rede ou escritório com vários clientes. Gancho: limites altos, 24 atualizações por dia, auditoria de 1 ano, suporte direto, sistema novo no catálogo sob medida. Preço negociado caso a caso (use "Limites especiais" na ficha do cliente).

**Sistema sob medida (avulso):** ERP fora do catálogo, a partir de R$ 1.500, pagamento único. Cada sistema leva cerca de 1 dia de trabalho nosso.

## Custo de IA e margem (estimativa — medir na primeira semana)

Premissas, todas a conferir:
- Preço por milhão de tokens (entrada/saída): Sonnet 5.5 US$ 2 / US$ 10; Haiku 5.5 US$ 0,10 / US$ 0,50.
- Uma pergunta ao chat: ~3.000 tokens de entrada (instruções + esquema das colunas, **sem nenhuma linha de dado**) e ~300 de saída.
- Dólar a R$ 5,50 (atualizar).
- 1 crédito de IA = 1 pergunta ao chat ou 1 pedido de gráfico à IA. Sem chave de IA, o painel usa o interpretador por regras, que custa zero.

Conta: Sonnet ≈ US$ 0,009 por crédito ≈ **R$ 0,05**. Haiku ≈ US$ 0,00045 ≈ **R$ 0,0025** (20 vezes menos). O painel da equipe mostra a estimativa com R$ 0,05 por crédito (constante `CUSTO_CREDITO_IA_REAIS` em planos.ts).

| Plano | Receita/mês | IA no teto (Sonnet) | IA no teto (Haiku) | Taxa de pagamento (~3,5%) | Sobra antes de pessoas e infra |
|---|---|---|---|---|---|
| Essencial | R$ 297 | R$ 5 | R$ 0,25 | R$ 10 | ~R$ 282 |
| Profissional | R$ 697 | R$ 30 | R$ 1,50 | R$ 24 | ~R$ 643 |
| Empresa (exemplo R$ 1.800) | R$ 1.800 | R$ 150 | R$ 7,50 | R$ 63 | ~R$ 1.587 |

Custo fixo estimado: Vercel Pro (~US$ 20) + Supabase Pro (~US$ 25) ≈ **R$ 250/mês**, pago por 1 único Essencial. Provedor de e-mail (quando ligar o envio de relatórios): começa grátis, depois alguns dólares.

Conclusões honestas:
1. A IA **não é o problema**: no teto de uso ela come no máximo ~10% do Essencial no pior caso, e menos de 1% se usarmos Haiku para perguntas simples.
2. O custo real é **tempo de gente**: implantação (usuário de integração, primeiro dashboard), suporte e documentar ERP novo. Se cada cliente novo gasta 3 horas nossas, o Essencial só se paga com volume ou com setup cobrado.
3. Sugestão a discutir com o Tom: cobrar **taxa de implantação** (ex.: R$ 500 no Essencial, R$ 1.200 no Profissional) ou deixar o anual como padrão (2 meses grátis já embutem o desconto).
4. Comissão do Tom não está nesta conta: definir percentual e se incide sobre o setup.
5. Nada disso foi medido com uso real. Depois do primeiro piloto, trocar as premissas por números reais (a API devolve os tokens usados em cada chamada).
