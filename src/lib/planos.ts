/**
 * Planos e valores mostrados na landing e em /planos.
 * Valores de lançamento propostos em 19/10/2026 — revisar com o comercial antes de divulgar.
 * Para mudar preço ou item, edite só este arquivo.
 */

export type Frequencia = "semanal" | "mensal" | "diaria" | "dias_uteis" | "trimestral";
export type FormatoRelatorio = "xlsx" | "csv";

/**
 * O que cada pacote dá direito. `null` = sem limite (uso justo).
 * Esta é a ÚNICA fonte da verdade: o painel do cliente, o painel do admin, a página de
 * planos e a futura cobrança leem daqui. Para mudar um limite, mude só aqui.
 */
export type Direitos = {
  sistemas: number | null;
  consultasMes: number | null;
  usuarios: number | null;
  dashboards: number | null;
  widgetsPorDashboard: number | null;
  /** Cada pergunta ao chat dos dados e cada pedido de gráfico à IA gasta 1 crédito. */
  creditosIaMes: number | null;
  relatoriosAgendados: number | null;
  destinatariosPorRelatorio: number | null;
  frequenciasRelatorio: Frequencia[];
  formatosRelatorio: FormatoRelatorio[];
  insights: "basico" | "completo";
  alertas: number;
  /** Quantas vezes por dia os dados do ERP são atualizados (quando o servidor estiver ativo). */
  atualizacoesPorDia: number;
  uploadPlanilhas: boolean;
  auditoriaDias: number;
  exportarDadosEmpresa: boolean;
  suporte: string;
};

export type Plano = {
  id: string;
  nome: string;
  /** Preço mensal em reais; null = sob consulta. */
  mensal: number | null;
  resumo: string;
  itens: string[];
  /** Itens que ainda não existem no produto aparecem marcados como "em breve". */
  emBreve?: string[];
  destaque?: boolean;
  chamada: string;
  direitos: Direitos;
};

/** Desconto do pagamento anual: 2 meses grátis (paga 10, usa 12). */
export const MESES_PAGOS_NO_ANUAL = 10;

export const TESTE_GRATIS = {
  dias: 14,
  texto:
    "14 dias grátis com o painel completo (dashboards, chat, insights e relatórios agendados) e 1 sistema, sem cartão. Você só precisa do usuário de integração do seu ERP.",
};

/** Estimativa de custo de IA por crédito (Sonnet 5.5, ~3 mil tokens de entrada e 300 de saída). Ver docs/PACOTES.md. */
export const CUSTO_CREDITO_IA_REAIS = 0.05;

export const PLANOS: Plano[] = [
  {
    id: "essencial",
    nome: "Essencial",
    mensal: 297,
    resumo: "Para a empresa que quer parar de exportar relatório na mão.",
    itens: [
      "Painel próprio com login para até 2 pessoas",
      "1 sistema conectado (ERP, fiscal ou marketplace)",
      "Até 300 consultas por mês e planilha .xlsx com aba de resumo",
      "3 dashboards com gráficos sugeridos pela IA",
      "Chat para perguntar sobre os seus dados (100 créditos de IA por mês)",
      "2 relatórios agendados (semanal ou mensal)",
      "Insights automáticos básicos",
      "Suporte por e-mail em dia útil",
    ],
    chamada: "Começar o teste",
    direitos: {
      sistemas: 1,
      consultasMes: 300,
      usuarios: 2,
      dashboards: 3,
      widgetsPorDashboard: 8,
      creditosIaMes: 100,
      relatoriosAgendados: 2,
      destinatariosPorRelatorio: 2,
      frequenciasRelatorio: ["semanal", "mensal"],
      formatosRelatorio: ["xlsx"],
      insights: "basico",
      alertas: 0,
      atualizacoesPorDia: 1,
      uploadPlanilhas: true,
      auditoriaDias: 30,
      exportarDadosEmpresa: false,
      suporte: "E-mail em dia útil",
    },
  },
  {
    id: "profissional",
    nome: "Profissional",
    mensal: 697,
    resumo: "Para o financeiro e a controladoria que vivem de planilha.",
    itens: [
      "Tudo do Essencial, com até 8 pessoas na equipe",
      "Até 3 sistemas conectados e 3.000 consultas por mês",
      "15 dashboards, com até 16 gráficos cada",
      "600 créditos de IA por mês para o chat e para montar gráficos",
      "15 relatórios agendados (diário, dias úteis, semanal, mensal), com escolha de colunas, horário e até 6 destinatários",
      "Insights completos e até 10 alertas",
      "Histórico de auditoria de 90 dias e exportação dos dados da empresa",
      "Ajuda para criar o usuário de integração no seu ERP",
      "Suporte por WhatsApp em horário comercial",
    ],
    emBreve: [
      "Envio automático dos relatórios por e-mail",
      "Atualização dos dados do ERP várias vezes ao dia",
      "Cofre de credenciais no servidor",
    ],
    destaque: true,
    chamada: "Começar o teste",
    direitos: {
      sistemas: 3,
      consultasMes: 3000,
      usuarios: 8,
      dashboards: 15,
      widgetsPorDashboard: 16,
      creditosIaMes: 600,
      relatoriosAgendados: 15,
      destinatariosPorRelatorio: 6,
      frequenciasRelatorio: ["diaria", "dias_uteis", "semanal", "mensal"],
      formatosRelatorio: ["xlsx", "csv"],
      insights: "completo",
      alertas: 10,
      atualizacoesPorDia: 4,
      uploadPlanilhas: true,
      auditoriaDias: 90,
      exportarDadosEmpresa: true,
      suporte: "WhatsApp em horário comercial",
    },
  },
  {
    id: "empresa",
    nome: "Empresa",
    mensal: null,
    resumo: "Para grupos com vários CNPJs, ERPs ou exigência de auditoria.",
    itens: [
      "Tudo do Profissional, sem limite de pessoas, sistemas, dashboards e relatórios",
      "3.000 créditos de IA por mês e 50 alertas",
      "Relatórios trimestrais e atualização de dados de hora em hora",
      "Auditoria de 12 meses: quem consultou o quê",
      "Seu ERP no catálogo, se ainda não estiver",
      "Contrato com SLA e termo de proteção de dados",
      "Atendimento dedicado na implantação",
    ],
    emBreve: ["Login único da empresa (SSO)"],
    chamada: "Falar com a gente",
    direitos: {
      sistemas: null,
      consultasMes: null,
      usuarios: null,
      dashboards: null,
      widgetsPorDashboard: 40,
      creditosIaMes: 3000,
      relatoriosAgendados: null,
      destinatariosPorRelatorio: 25,
      frequenciasRelatorio: ["diaria", "dias_uteis", "semanal", "mensal", "trimestral"],
      formatosRelatorio: ["xlsx", "csv"],
      insights: "completo",
      alertas: 50,
      atualizacoesPorDia: 24,
      uploadPlanilhas: true,
      auditoriaDias: 365,
      exportarDadosEmpresa: true,
      suporte: "Atendimento dedicado e SLA em contrato",
    },
  },
];

/** Durante o teste grátis: recursos do Profissional, com tetos baixos para limitar custo. */
export const DIREITOS_TESTE: Direitos = {
  ...PLANOS[1]!.direitos,
  sistemas: 1,
  consultasMes: 100,
  usuarios: 2,
  dashboards: 3,
  creditosIaMes: 40,
  relatoriosAgendados: 2,
  destinatariosPorRelatorio: 2,
  alertas: 2,
  auditoriaDias: 14,
  exportarDadosEmpresa: false,
  suporte: "E-mail em dia útil",
};

export const planoPorId = (id: string): Plano => PLANOS.find((p) => p.id === id) ?? PLANOS[0]!;

/** Sistema novo no catálogo para quem não está em nenhum plano Empresa. */
export const SISTEMA_SOB_MEDIDA = {
  aPartirDe: 1500,
  texto:
    "Seu ERP ainda não está na lista? Documentamos a API dele e liberamos no Stagium. Pagamento único, a partir de",
};

export const formatarReais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
