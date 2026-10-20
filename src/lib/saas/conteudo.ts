/** Dashboards e alertas do cliente: criação com checagem de limite do plano. */
import { executarPlano } from "./consulta";
import { verificarLimite, direitosDaEmpresa } from "./direitos";
import { repo } from "./repositorio";
import { novoId } from "./senha";
import { auditar } from "./servico";
import type { Alerta, Dashboard, Dataset, Empresa, PlanoDeConsulta, Usuario, Widget } from "./tipos";

export const listarDashboards = async (empresaId: string) =>
  (await repo().daEmpresa<Dashboard>(empresaId, "dashboards").listar()).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));

export async function criarDashboard(
  quem: Usuario,
  e: Empresa,
  nome: string,
  widgets: Omit<Widget, "id">[] = [],
  descricao = "",
): Promise<Dashboard> {
  const col = repo().daEmpresa<Dashboard>(e.id, "dashboards");
  const lim = verificarLimite(e, "dashboards", (await col.listar()).length);
  if (!lim.ok) throw new Error(lim.mensagem);
  const max = direitosDaEmpresa(e).widgetsPorDashboard;
  const agora = new Date().toISOString();
  const d: Dashboard = {
    id: novoId("d"),
    nome: nome.trim() || "Novo dashboard",
    descricao,
    widgets: widgets.slice(0, max ?? widgets.length).map((w) => ({ ...w, id: novoId("w") })),
    periodoPadrao: "padrao",
    criadoPor: quem.id,
    criadoEm: agora,
    atualizadoEm: agora,
  };
  await col.salvar(d);
  await auditar(e.id, quem, "dashboard", `Criou o dashboard "${d.nome}"`);
  return d;
}

export async function salvarDashboard(quem: Usuario, e: Empresa, d: Dashboard, auditoria?: string): Promise<Dashboard> {
  const max = direitosDaEmpresa(e).widgetsPorDashboard;
  if (max !== null && d.widgets.length > max)
    throw new Error(`Seu plano permite até ${max} gráficos por dashboard. Remova algum ou mude de plano.`);
  const salvo = { ...d, atualizadoEm: new Date().toISOString() };
  await repo().daEmpresa<Dashboard>(e.id, "dashboards").salvar(salvo);
  if (auditoria) await auditar(e.id, quem, "dashboard", auditoria);
  return salvo;
}

export async function removerDashboard(quem: Usuario, e: Empresa, d: Dashboard) {
  await repo().daEmpresa<Dashboard>(e.id, "dashboards").remover(d.id);
  await auditar(e.id, quem, "dashboard", `Apagou o dashboard "${d.nome}"`);
}

export const novoWidget = (w: Omit<Widget, "id">): Widget => ({ ...w, id: novoId("w") });

/* ---------------- alertas ---------------- */

export const listarAlertas = (empresaId: string) => repo().daEmpresa<Alerta>(empresaId, "alertas").listar();

export async function criarAlerta(quem: Usuario, e: Empresa, a: Omit<Alerta, "id" | "criadoEm" | "criadoPor">): Promise<Alerta> {
  const col = repo().daEmpresa<Alerta>(e.id, "alertas");
  const lim = verificarLimite(e, "alertas", (await col.listar()).length);
  if (!lim.ok) throw new Error(direitosDaEmpresa(e).alertas === 0 ? "Alertas fazem parte do plano Profissional. Mude de plano em Plano e cobrança." : lim.mensagem);
  const novo: Alerta = { ...a, id: novoId("l"), criadoEm: new Date().toISOString(), criadoPor: quem.id };
  await col.salvar(novo);
  await auditar(e.id, quem, "alerta", `Criou o alerta "${a.nome}"`);
  return novo;
}
export const salvarAlerta = (e: Empresa, a: Alerta) => repo().daEmpresa<Alerta>(e.id, "alertas").salvar(a);
export const removerAlerta = (e: Empresa, id: string) => repo().daEmpresa<Alerta>(e.id, "alertas").remover(id);

export type EstadoAlerta = { alerta: Alerta; valor: number | null; disparado: boolean };

export function avaliarAlerta(a: Alerta, datasets: Dataset[]): EstadoAlerta {
  const ds = datasets.find((d) => d.id === a.plano.datasetId);
  if (!ds || !a.ativo) return { alerta: a, valor: null, disparado: false };
  const r = executarPlano(ds, a.plano);
  const valor = Number(r.linhas[0]?.["m0"] ?? 0);
  const disparado = { ">": valor > a.limite, "<": valor < a.limite, ">=": valor >= a.limite, "<=": valor <= a.limite }[a.condicao];
  return { alerta: a, valor, disparado };
}

export const planoDeMedidaUnica = (p: PlanoDeConsulta) => p.modo === "agregado" && (p.medidas?.length ?? 0) === 1 && !p.agruparPor?.length;
