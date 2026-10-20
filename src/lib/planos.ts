/**
 * Planos e valores mostrados na landing e em /planos.
 * Valores de lançamento propostos em 19/10/2026 — revisar com o comercial antes de divulgar.
 * Para mudar preço ou item, edite só este arquivo.
 */

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
};

/** Desconto do pagamento anual: 2 meses grátis (paga 10, usa 12). */
export const MESES_PAGOS_NO_ANUAL = 10;

export const TESTE_GRATIS = {
  dias: 14,
  texto:
    "14 dias grátis com 1 sistema, sem cartão. Você só precisa do usuário de integração do seu ERP.",
};

export const PLANOS: Plano[] = [
  {
    id: "essencial",
    nome: "Essencial",
    mensal: 297,
    resumo: "Para a empresa que quer parar de exportar relatório na mão.",
    itens: [
      "1 sistema conectado (ERP, fiscal ou marketplace)",
      "Até 300 consultas por mês",
      "Planilha .xlsx com aba de resumo automático",
      'Consultas salvas com período relativo ("mês passado")',
      "Credenciais salvas no navegador com PIN",
      "Suporte por e-mail em dia útil",
    ],
    chamada: "Começar o teste",
  },
  {
    id: "profissional",
    nome: "Profissional",
    mensal: 697,
    resumo: "Para o financeiro e a controladoria que vivem de planilha.",
    itens: [
      "Até 3 sistemas conectados",
      "Consultas ilimitadas (uso justo)",
      "Tudo do Essencial",
      "Ajuda para criar o usuário de integração no seu ERP",
      "Suporte por WhatsApp em horário comercial",
    ],
    emBreve: ["Consultas agendadas que chegam por e-mail", "Cofre de credenciais no servidor"],
    destaque: true,
    chamada: "Começar o teste",
  },
  {
    id: "empresa",
    nome: "Empresa",
    mensal: null,
    resumo: "Para grupos com vários CNPJs, ERPs ou exigência de auditoria.",
    itens: [
      "Sistemas e CNPJs sem limite",
      "Seu ERP no catálogo, se ainda não estiver",
      "Contrato com SLA e termo de proteção de dados",
      "Atendimento dedicado na implantação",
    ],
    emBreve: ["Login por usuário com registro de quem consultou o quê"],
    chamada: "Falar com a gente",
  },
];

/** Sistema novo no catálogo para quem não está em nenhum plano Empresa. */
export const SISTEMA_SOB_MEDIDA = {
  aPartirDe: 1500,
  texto:
    "Seu ERP ainda não está na lista? Documentamos a API dele e liberamos no Stagium. Pagamento único, a partir de",
};

export const formatarReais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
