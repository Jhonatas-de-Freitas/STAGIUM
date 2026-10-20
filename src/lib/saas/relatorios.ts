/**
 * Relatórios agendados: cálculo da próxima execução, geração do arquivo e histórico.
 *
 * Em modo local o "motor" só roda enquanto o painel está aberto e NÃO envia e-mail (a execução
 * agendada é registrada como "simulado"). Com servidor (Vercel Cron + provedor de e-mail),
 * a mesma função `gerarArquivo` roda lá e o envio passa a ser real.
 */
import { planoPorId, type Frequencia } from "../planos";
import { baixarPlanilha, type DadosPlanilha } from "../planilha";
import { executarPlano, formatarValor, validarPlano } from "./consulta";
import { direitosDaEmpresa, verificarLimite } from "./direitos";
import { repo } from "./repositorio";
import { novoId } from "./senha";
import { auditar, consumir } from "./servico";
import type { Dataset, Empresa, Execucao, Relatorio, Usuario } from "./tipos";

export const ROTULO_FREQUENCIA: Record<Frequencia, string> = {
  diaria: "Todos os dias",
  dias_uteis: "Dias úteis (segunda a sexta)",
  semanal: "Toda semana",
  mensal: "Todo mês",
  trimestral: "A cada trimestre",
};
export const DIAS_DA_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function aplicarHora(d: Date, hora: string): Date {
  const [h, m] = hora.split(":").map(Number);
  const r = new Date(d);
  r.setHours(h || 0, m || 0, 0, 0);
  return r;
}
const ultimoDiaDoMes = (a: number, m: number) => new Date(a, m + 1, 0).getDate();

/** Próxima execução estritamente depois de `depois`. */
export function proximaExecucao(r: Pick<Relatorio, "frequencia" | "hora" | "diaSemana" | "diaMes">, depois: Date): Date {
  const alvo = (d: Date) => aplicarHora(d, r.hora);
  const base = new Date(depois);
  if (r.frequencia === "diaria" || r.frequencia === "dias_uteis") {
    for (let i = 0; i < 9; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      if (r.frequencia === "dias_uteis" && (dow === 0 || dow === 6)) continue;
      const c = alvo(d);
      if (c > depois) return c;
    }
  }
  if (r.frequencia === "semanal") {
    for (let i = 0; i < 9; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      if (d.getDay() !== r.diaSemana) continue;
      const c = alvo(d);
      if (c > depois) return c;
    }
  }
  // mensal e trimestral: dia do mês (0 = último dia); trimestral só em jan/abr/jul/out
  for (let i = 0; i < 16; i++) {
    const mes = new Date(base.getFullYear(), base.getMonth() + i, 1);
    if (r.frequencia === "trimestral" && mes.getMonth() % 3 !== 0) continue;
    const dia = r.diaMes === 0 ? ultimoDiaDoMes(mes.getFullYear(), mes.getMonth()) : Math.min(r.diaMes, ultimoDiaDoMes(mes.getFullYear(), mes.getMonth()));
    const c = alvo(new Date(mes.getFullYear(), mes.getMonth(), dia));
    if (c > depois) return c;
  }
  return alvo(new Date(base.getTime() + 86_400_000));
}

export function descreverAgenda(r: Pick<Relatorio, "frequencia" | "hora" | "diaSemana" | "diaMes">): string {
  const h = `às ${r.hora}`;
  switch (r.frequencia) {
    case "diaria": return `Todos os dias ${h}`;
    case "dias_uteis": return `De segunda a sexta ${h}`;
    case "semanal": return `Toda ${DIAS_DA_SEMANA[r.diaSemana]} ${h}`;
    case "mensal": return r.diaMes === 0 ? `No último dia de cada mês ${h}` : `Todo dia ${r.diaMes} ${h}`;
    case "trimestral": return `${r.diaMes === 0 ? "No último dia" : `No dia ${r.diaMes}`} de jan, abr, jul e out ${h}`;
  }
}

/** A execução agendada já deveria ter acontecido? */
export function estaVencido(r: Relatorio, agora = new Date()): boolean {
  if (!r.ativo) return false;
  const desde = new Date(r.ultimaExecucao ?? r.criadoEm);
  return proximaExecucao(r, desde) <= agora;
}

export function modeloVazio(ds: Dataset, quem: Usuario): Relatorio {
  return {
    id: novoId("r"),
    nome: "",
    plano: { datasetId: ds.id, modo: "lista", colunas: ds.colunas.filter((c) => !c.sensivel).map((c) => c.chave), periodo: undefined, filtros: [] },
    formato: "xlsx",
    incluirResumo: true,
    frequencia: "semanal",
    hora: "08:00",
    diaSemana: 1,
    diaMes: 1,
    destinatarios: [quem.email],
    assunto: "",
    mensagem: "",
    ativo: true,
    criadoPor: quem.id,
    criadoEm: new Date().toISOString(),
    ultimaExecucao: null,
  };
}

export function errosDoRelatorio(e: Empresa, r: Relatorio, ds: Dataset | undefined): string[] {
  const erros: string[] = [];
  const d = direitosDaEmpresa(e);
  if (!r.nome.trim()) erros.push("Dê um nome ao relatório.");
  if (!ds) erros.push("Escolha a base de dados.");
  else {
    erros.push(...validarPlano(ds, r.plano));
    if (!r.plano.colunas?.length) erros.push("Escolha pelo menos uma coluna.");
  }
  if (!/^\d{2}:\d{2}$/.test(r.hora)) erros.push("Informe o horário (HH:MM).");
  if (!d.frequenciasRelatorio.includes(r.frequencia))
    erros.push(`A frequência "${ROTULO_FREQUENCIA[r.frequencia]}" não está no plano ${planoPorId(e.planoId).nome}.`);
  if (!d.formatosRelatorio.includes(r.formato)) erros.push(`O formato ${r.formato.toUpperCase()} não está no seu plano.`);
  if (r.destinatarios.length === 0) erros.push("Informe pelo menos um destinatário.");
  if (r.destinatarios.some((m) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m))) erros.push("Há um e-mail inválido nos destinatários.");
  if (d.destinatariosPorRelatorio !== null && r.destinatarios.length > d.destinatariosPorRelatorio)
    erros.push(`Seu plano permite até ${d.destinatariosPorRelatorio} destinatários por relatório.`);
  return erros;
}

/** Colunas pessoais incluídas no relatório (aviso de LGPD). */
export function colunasSensiveisNoRelatorio(ds: Dataset, r: Relatorio) {
  return ds.colunas.filter((c) => c.sensivel && r.plano.colunas?.includes(c.chave));
}

export function gerarArquivo(ds: Dataset, r: Relatorio, hoje = new Date()): DadosPlanilha & { linhasTotal: number } {
  const res = executarPlano(ds, r.plano, { hoje });
  const linhas = res.linhas.map((l) =>
    Object.fromEntries(
      res.colunas.map((c) => [c.chave, c.tipo === "data" ? formatarValor(l[c.chave], "data") : (l[c.chave] ?? "")]),
    ),
  ) as Record<string, string | number>[];
  const slug = r.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "relatorio";
  return {
    nomeArquivo: `${slug}-${hoje.toISOString().slice(0, 10)}.${r.formato}`,
    titulo: r.nome,
    colunas: res.colunas.map((c) => ({ titulo: c.titulo, chave: c.chave })),
    linhas,
    semResumo: !r.incluirResumo,
    informacoes: [
      { rotulo: "Relatório", valor: r.nome },
      { rotulo: "Base de dados", valor: ds.nome },
      { rotulo: "Período", valor: res.descricaoPeriodo ?? "todo o histórico" },
      { rotulo: "Registros", valor: String(linhas.length) },
      { rotulo: "Gerado em", valor: hoje.toLocaleString("pt-BR") },
      { rotulo: "Gerado por", valor: "Stagium — painel do cliente" },
    ],
    linhasTotal: linhas.length,
  };
}

function baixarCsv(d: DadosPlanilha) {
  const esc = (v: string | number) => {
    const t = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const corpo = [d.colunas.map((c) => esc(c.titulo)).join(";"), ...d.linhas.map((l) => d.colunas.map((c) => esc(l[c.chave] ?? "")).join(";"))].join("\r\n");
  const blob = new Blob(["﻿" + corpo], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = d.nomeArquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function baixarArquivo(d: DadosPlanilha) {
  if (d.nomeArquivo.endsWith(".csv")) baixarCsv(d);
  else await baixarPlanilha(d);
}

/* ---------------- persistência e execução ---------------- */

export async function listarRelatorios(empresaId: string) {
  return repo().daEmpresa<Relatorio>(empresaId, "relatorios").listar();
}
export async function listarExecucoes(empresaId: string) {
  return (await repo().daEmpresa<Execucao>(empresaId, "execucoes").listar()).sort((a, b) => b.em.localeCompare(a.em));
}

export async function salvarRelatorio(quem: Usuario, e: Empresa, r: Relatorio, ds: Dataset | undefined) {
  const erros = errosDoRelatorio(e, r, ds);
  if (erros.length) throw new Error(erros[0]);
  const col = repo().daEmpresa<Relatorio>(e.id, "relatorios");
  const todos = await col.listar();
  const existente = todos.find((x) => x.id === r.id);
  if (!existente || (!existente.ativo && r.ativo)) {
    const ativos = todos.filter((x) => x.ativo && x.id !== r.id).length;
    const lim = verificarLimite(e, "relatoriosAgendados", ativos);
    if (!lim.ok) throw new Error(lim.mensagem);
  }
  await col.salvar(r);
  await auditar(e.id, quem, "relatorio", `${existente ? "Alterou" : "Criou"} o relatório "${r.nome}"`);
}

export async function removerRelatorio(quem: Usuario, e: Empresa, r: Relatorio) {
  await repo().daEmpresa<Relatorio>(e.id, "relatorios").remover(r.id);
  await auditar(e.id, quem, "relatorio", `Apagou o relatório "${r.nome}"`);
}

/** Roda o relatório agora. Manual baixa o arquivo; agendado só registra (sem envio de e-mail no modo local). */
export async function executarRelatorio(
  quem: Usuario,
  e: Empresa,
  r: Relatorio,
  ds: Dataset,
  origem: "manual" | "agendada",
): Promise<Execucao> {
  let status: Execucao["status"] = "ok";
  let mensagem = "";
  let linhas = 0;
  try {
    await consumir(e, "consultas", 1);
    const arquivo = gerarArquivo(ds, r);
    linhas = arquivo.linhasTotal;
    if (origem === "manual") {
      await baixarArquivo(arquivo);
      mensagem = `Arquivo ${arquivo.nomeArquivo} gerado e baixado.`;
    } else {
      status = "simulado";
      mensagem = `Arquivo gerado. O envio para ${r.destinatarios.join(", ")} acontece quando o servidor de e-mail estiver ligado.`;
    }
  } catch (err) {
    status = "erro";
    mensagem = err instanceof Error ? err.message : "Falha ao gerar o relatório.";
  }
  const ex: Execucao = {
    id: novoId("x"),
    relatorioId: r.id,
    nomeRelatorio: r.nome,
    em: new Date().toISOString(),
    origem,
    status,
    linhas,
    destinatarios: r.destinatarios,
    mensagem,
  };
  const exec = repo().daEmpresa<Execucao>(e.id, "execucoes");
  const hist = await exec.listar();
  await exec.substituirTudo([...hist, ex].slice(-300));
  await repo().daEmpresa<Relatorio>(e.id, "relatorios").salvar({ ...r, ultimaExecucao: ex.em });
  await auditar(e.id, quem, "relatorio", `${origem === "manual" ? "Executou" : "Execução agendada de"} "${r.nome}" (${status})`);
  return ex;
}

/** Executa os relatórios que já passaram do horário (enquanto o painel está aberto). */
export async function rodarVencidos(quem: Usuario, e: Empresa, datasets: Dataset[]): Promise<Execucao[]> {
  const feitos: Execucao[] = [];
  for (const r of await listarRelatorios(e.id)) {
    if (!estaVencido(r)) continue;
    const ds = datasets.find((d) => d.id === r.plano.datasetId);
    if (!ds) continue;
    feitos.push(await executarRelatorio(quem, e, r, ds, "agendada"));
  }
  return feitos;
}

/** Planilha a partir de um resultado qualquer (resposta do chat, gráfico). */
export function arquivoDeResultado(titulo: string, ds: Dataset, res: ReturnType<typeof executarPlano>, hoje = new Date()): DadosPlanilha {
  const slug = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "consulta";
  return {
    nomeArquivo: `${slug}-${hoje.toISOString().slice(0, 10)}.xlsx`,
    titulo,
    colunas: res.colunas.map((c) => ({ titulo: c.titulo, chave: c.chave })),
    linhas: res.linhas.map((l) =>
      Object.fromEntries(res.colunas.map((c) => [c.chave, c.tipo === "data" ? formatarValor(l[c.chave], "data") : (l[c.chave] ?? "")])),
    ) as Record<string, string | number>[],
    informacoes: [
      { rotulo: "Consulta", valor: titulo },
      { rotulo: "Base de dados", valor: ds.nome },
      { rotulo: "Período", valor: res.descricaoPeriodo ?? "todo o histórico" },
      { rotulo: "Registros", valor: String(res.linhas.length) },
      { rotulo: "Gerado em", valor: hoje.toLocaleString("pt-BR") },
    ],
  };
}
