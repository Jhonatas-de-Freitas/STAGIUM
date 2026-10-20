/**
 * Regras de plano: quanto a empresa pode usar e o que está liberado.
 * Quem decide é planos.ts; aqui só se junta plano + teste + ajustes combinados com a empresa.
 */
import { DIREITOS_TESTE, planoPorId, type Direitos } from "../planos";
import type { Empresa } from "./tipos";

export type Recurso =
  | "sistemas"
  | "consultasMes"
  | "usuarios"
  | "dashboards"
  | "widgetsPorDashboard"
  | "creditosIaMes"
  | "relatoriosAgendados"
  | "destinatariosPorRelatorio"
  | "alertas";

export const NOME_DO_RECURSO: Record<Recurso, string> = {
  sistemas: "sistemas conectados",
  consultasMes: "consultas no mês",
  usuarios: "pessoas na equipe",
  dashboards: "dashboards",
  widgetsPorDashboard: "gráficos por dashboard",
  creditosIaMes: "créditos de IA no mês",
  relatoriosAgendados: "relatórios agendados",
  destinatariosPorRelatorio: "destinatários por relatório",
  alertas: "alertas",
};

export const diasRestantes = (iso: string | null, agora = new Date()) =>
  iso ? Math.ceil((new Date(iso).getTime() - agora.getTime()) / 86_400_000) : null;

/** O acesso está liberado hoje? Explica o motivo quando não está. */
export function situacaoDeAcesso(
  e: Empresa,
  agora = new Date(),
): { liberado: boolean; motivo: "ok" | "suspensa" | "cancelada" | "teste_acabou" | "cortesia_acabou" } {
  if (e.status === "suspensa") return { liberado: false, motivo: "suspensa" };
  if (e.status === "cancelada") return { liberado: false, motivo: "cancelada" };
  if (e.status === "teste" && e.testeAte && new Date(e.testeAte) < agora)
    return { liberado: false, motivo: "teste_acabou" };
  if (e.cortesia && e.cortesiaAte && new Date(e.cortesiaAte) < agora)
    return { liberado: false, motivo: "cortesia_acabou" };
  return { liberado: true, motivo: "ok" };
}

export function direitosDaEmpresa(e: Empresa): Direitos {
  const base = e.status === "teste" ? DIREITOS_TESTE : planoPorId(e.planoId).direitos;
  return { ...base, ...e.limitesEspeciais };
}

export type ResultadoLimite = {
  ok: boolean;
  limite: number | null;
  usado: number;
  mensagem: string;
};

/** Pode usar mais `quantidade` deste recurso? `usado` é o que já foi usado. */
export function verificarLimite(
  e: Empresa,
  recurso: Recurso,
  usado: number,
  quantidade = 1,
): ResultadoLimite {
  const acesso = situacaoDeAcesso(e);
  if (!acesso.liberado)
    return { ok: false, limite: 0, usado, mensagem: "O acesso desta empresa está bloqueado." };
  const limite = direitosDaEmpresa(e)[recurso] as number | null;
  if (limite === null) return { ok: true, limite, usado, mensagem: "" };
  const ok = usado + quantidade <= limite;
  const plano = e.status === "teste" ? "do teste grátis" : `do plano ${planoPorId(e.planoId).nome}`;
  return {
    ok,
    limite,
    usado,
    mensagem: ok
      ? ""
      : `Você chegou ao limite ${plano}: ${limite.toLocaleString("pt-BR")} ${NOME_DO_RECURSO[recurso]}. Para continuar, mude de plano em Plano e cobrança.`,
  };
}

export const mesAtual = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Quem pode o quê dentro da empresa. */
export const PODE = {
  verPainel: ["dono", "admin", "analista", "leitor"],
  criarDashboards: ["dono", "admin", "analista"],
  usarChat: ["dono", "admin", "analista"],
  agendarRelatorios: ["dono", "admin", "analista"],
  importarDados: ["dono", "admin", "analista"],
  conectarSistemas: ["dono", "admin"],
  gerenciarEquipe: ["dono", "admin"],
  verPlano: ["dono", "admin"],
  verAuditoria: ["dono", "admin"],
  exportarEmpresa: ["dono"],
} as const;

export type Permissao = keyof typeof PODE;
export const podeFazer = (papel: string | undefined, p: Permissao) =>
  !!papel && (papel === "superadmin" || (PODE[p] as readonly string[]).includes(papel));

export const ROTULO_PAPEL: Record<string, string> = {
  dono: "Dono",
  admin: "Administrador",
  analista: "Analista",
  leitor: "Leitor",
  superadmin: "Equipe Stagium",
};

export const DESCRICAO_PAPEL: Record<string, string> = {
  dono: "Tudo, inclusive plano, equipe e exclusão dos dados da empresa.",
  admin: "Conecta sistemas, gerencia a equipe e vê a auditoria.",
  analista: "Monta dashboards, pergunta ao chat, agenda relatórios e importa planilhas.",
  leitor: "Só visualiza os dashboards e insights.",
};
