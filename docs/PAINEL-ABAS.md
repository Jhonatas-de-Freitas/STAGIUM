# Abas do painel

O que o cliente vê depois de se cadastrar ou receber acesso. Modo atual: **local** (tudo fica no navegador, para testar sem banco). "Precisa de servidor" marca o que só fica completo com Supabase e Vercel.

## Área do cliente (`/app`)

| Aba | Para que serve | Quem vê | Limites do plano | Situação |
|---|---|---|---|---|
| Início | Resumo, atalhos, alertas disparados, passos para começar | todos | — | pronto |
| Dashboards | Monta o próprio painel de gráficos. A IA sugere gráficos pelas colunas da base; dá para pedir em uma frase ou montar à mão. Compara com o período anterior | todos veem; dono, admin, analista criam | nº de dashboards e de gráficos | pronto |
| Insights | Achados automáticos nos dados (picos, quedas, concentração, vencidos). Cada um leva ao chat para investigar. Alertas com limite (ex.: "vencido > R$ X") | todos | insights básico/completo; nº de alertas | pronto |
| Perguntar aos dados | Chat sobre os dados do cliente. A IA só devolve um plano de consulta; quem executa é o painel. Dá para guardar a resposta como gráfico ou agendá-la como relatório | dono, admin, analista | créditos de IA | pronto |
| Relatórios agendados | Escolhe base, período, colunas (e a ordem), filtros, frequência, horário, dia, formato e destinatários. "Executar agora" baixa o arquivo; histórico de execuções | dono, admin, analista | nº de relatórios, frequências, formatos, destinatários, consultas | pronto; envio por e-mail precisa de servidor |
| Meus dados | Bases disponíveis, envio de planilha .xlsx/.csv, marcação de coluna com dado pessoal | dono, admin, analista | — | pronto |
| Conexões com ERPs | Lista os 6 sistemas do catálogo, liga a demonstração | dono, admin | nº de sistemas | pronto; sincronização automática precisa de servidor |
| Consultar o ERP ao vivo | O chat atual (/chat) que consulta a API do ERP e baixa a planilha | todos | — | pronto |
| Equipe | Convites por link, papéis (dono, admin, analista, leitor), desativar pessoas | dono, admin | nº de pessoas | pronto; convite por e-mail precisa de servidor |
| Plano e cobrança | Plano atual, dias de teste, uso do mês, comparação, pedido de mudança | dono, admin | — | pronto; cobrança automática precisa de provedor |
| Segurança e auditoria | Quem fez o quê, troca de senha, exportar e excluir dados (LGPD) | dono, admin; exportar/excluir só dono | dias de auditoria; exportação a partir do Profissional | pronto |

## Área da equipe Stagium (`/admin`)

| Aba | Para que serve |
|---|---|
| Visão geral | Receita mensal, clientes por situação, testes acabando, pedidos de plano |
| Clientes | Lista com busca; **Conceder acesso** (teste, pago ou cortesia) cria a empresa e o dono com senha temporária |
| Ficha do cliente | Muda plano, situação e ciclo; estende teste; limites especiais; gera senha temporária; **Ver como cliente** (suporte, com faixa e registro na auditoria); exclui empresa (LGPD) |
| Pedidos de plano | Fila do que os clientes pediram; marcar como atendido |
| Pacotes e direitos | A matriz de direitos, para consulta na venda |
| Configurações | Cadastro aberto ao público; dias de teste |

Primeiro acesso do ambiente: abrir `/configurar` e criar o administrador da plataforma.

## Como testar sem banco

1. `npx -y bun@1.3.1 run dev`, abrir `/configurar` e criar o administrador.
2. Em Clientes, **Conceder acesso**; copiar o e-mail e a senha temporária.
3. Sair, entrar como o cliente, criar a senha, ativar a demonstração em Conexões com ERPs.
4. Ou, na tela Entrar, o botão de demonstração cria uma empresa fictícia já pronta.

Os dados ficam no `localStorage` do navegador. Limpar os dados do site zera tudo.
