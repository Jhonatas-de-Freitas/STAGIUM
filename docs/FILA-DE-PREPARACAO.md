# Fila de preparação

Ordem pensada para chegar ao primeiro cliente pagante com segurança. Itens marcados [pronto] já existem em modo local.

## Fase 0 — feito neste branch (modo local, sem banco)
- [pronto] Login, empresa, papéis, convites, troca obrigatória de senha, bloqueio por tentativas
- [pronto] Pacotes com direitos por plano, limites aplicados no painel, limites especiais por cliente
- [pronto] Dashboards com sugestão de gráficos, chat sobre os dados, insights, alertas
- [pronto] Relatórios agendados com colunas, filtros, horário, frequência (motor local com o painel aberto)
- [pronto] Área da equipe: conceder acesso, ficha do cliente, suporte "ver como cliente", pedidos de plano
- [pronto] LGPD básica: colunas pessoais fora da IA, exportar e excluir dados, auditoria

## Fase 1 — antes do primeiro cliente real (depende de contas novas)
1. **Conta nova do negócio** no Supabase (Pro) e na Vercel (Pro). Não usar a conta "Devora" nem a da BRN. Combinar com o Tom a mudança de Lovable para Vercel.
2. **Banco com separação por empresa (RLS)**: trocar só o `Repositorio` local pelo do Supabase; as telas não mudam. Tabelas: empresas, usuarios, dashboards, relatorios, execucoes, alertas, uso, auditoria, datasets.
3. **Autenticação de verdade** (Supabase Auth): senha com hash no servidor, recuperação por e-mail, 2 fatores para dono e equipe.
4. **Cofre de credenciais no servidor**, criptografado (chave fora do banco). Hoje elas ficam só no navegador. É a parte mais sensível (LGPD).
5. **Chave de IA** (`ANTHROPIC_API_KEY`) no servidor, revogando as duas que vazaram no chat.
6. **E-mail transacional** (Resend ou similar): convites, senha, e envio dos relatórios.

## Fase 2 — o que faz o produto valer a mensalidade
7. **Sincronização com o ERP**: tarefa agendada (Vercel Cron) que consulta a API respeitando o limite de cada ERP (Nomus: 1 chamada a cada 20 s) e grava no banco; dashboards leem do banco, não do ERP.
8. **Execução real dos relatórios agendados** pelo servidor, no horário, mesmo com o painel fechado, enviando por e-mail.
9. **Cobrança**: escolher Asaas, Mercado Pago ou Stripe; assinatura mensal e anual, nota fiscal, bloqueio automático por inadimplência (a situação "suspensa" já existe).
10. **Medir custo real** de IA e infra por cliente e revisar preços e taxa de implantação.
11. **Primeiro piloto** com autorização escrita, usuário só de leitura e endereço com domínio e HTTPS.

## Fase 3 — mais possibilidades (ordenadas por retorno provável)
- **Haiku para perguntas simples** e Sonnet só para as difíceis: corta o custo de IA em ~20 vezes.
- **Painel do contador (multi-empresa)**: um escritório de contabilidade vê vários clientes dele num só login. Combina com o canal do Tom e com o plano Empresa.
- **Resumo semanal por e-mail** ("o que mudou nos seus números"), gerado pelos insights.
- **Metas e comparação**: meta mensal por indicador e semáforo.
- **Conciliação bancária assistida** (Protheus e Sagi): cruzar extrato e títulos.
- **Exportar para PDF** e agendar relatório em PDF.
- **Compartilhar dashboard por link** somente leitura, com validade.
- **Marca própria (white-label)** para escritórios que revendem.
- **Mais ERPs no catálogo**: Tiny, Omie e Conta Azul já têm documentação (faltam OAuth por cliente e credenciais no corpo da requisição).
- **Aviso por WhatsApp** dos alertas.
- **Entrada com Google/Microsoft** (SSO) para o plano Empresa.
- **API pública** para clientes grandes puxarem os próprios dados.
- **Base de conhecimento e vídeos curtos** de onboarding dentro do painel.

## Riscos a lembrar sempre
- Preços ainda são placeholders. Não divulgar antes de revisar com o Tom.
- Nenhum ERP novo (Protheus, WinThor, Tiny...) foi testado contra ambiente real.
- Credenciais reais de clientes circularam no WhatsApp: pedir a troca. Repo público: nada de chave no commit.
