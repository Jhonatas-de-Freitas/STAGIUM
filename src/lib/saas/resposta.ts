/** Texto de resposta do chat: resume o resultado em frases simples, calculado dos próprios números. */
import { formatarValor } from "./consulta";
import type { ColunaDados, ResultadoConsulta } from "./tipos";

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

export function resumirResultado(r: ResultadoConsulta, modo: "agregado" | "lista"): string {
  if (r.linhas.length === 0)
    return `Não encontrei registros${r.descricaoPeriodo ? ` em ${r.descricaoPeriodo}` : ""} com esses filtros.`;
  if (modo === "lista")
    return `${r.linhas.length.toLocaleString("pt-BR")} registros${r.descricaoPeriodo ? ` em ${r.descricaoPeriodo}` : ""}, de ${r.linhasLidas.toLocaleString("pt-BR")} que casaram com os filtros.`;
  const medidas = r.colunas.filter((c) => /^m\d+$/.test(c.chave));
  const grupos = r.colunas.filter((c) => !/^m\d+$/.test(c.chave));
  const m = medidas[0]!;
  const fmt = (v: unknown) => formatarValor(v as number, m.tipo);
  if (grupos.length === 0) {
    return `${m.titulo}: ${fmt(r.linhas[0]![m.chave])}${r.descricaoPeriodo ? ` (${r.descricaoPeriodo})` : ""}, a partir de ${r.linhasLidas.toLocaleString("pt-BR")} registros.`;
  }
  const g = grupos[0]!;
  const soma = r.linhas.reduce((a, l) => a + (Number(l[m.chave]) || 0), 0);
  const ehTempo = /\((dia|semana|mês|ano)\)/.test(g.titulo);
  if (ehTempo && r.linhas.length >= 2) {
    const ord = [...r.linhas].sort((a, b) => Number(b[m.chave]) - Number(a[m.chave]));
    const ult = Number(r.linhas.at(-1)![m.chave]);
    const pen = Number(r.linhas.at(-2)![m.chave]);
    const var_ = pen ? ((ult - pen) / pen) * 100 : 0;
    return `Total no período: ${fmt(soma)}. Maior: ${ord[0]![g.chave]} (${fmt(ord[0]![m.chave])}). Menor: ${ord.at(-1)![g.chave]} (${fmt(ord.at(-1)![m.chave])}). O último ponto está ${var_ >= 0 ? "acima" : "abaixo"} do anterior em ${pct(Math.abs(var_))} (pode estar incompleto se o período ainda não terminou).`;
  }
  const topo = r.linhas[0]!;
  const top3 = r.linhas.slice(0, 3).reduce((a, l) => a + (Number(l[m.chave]) || 0), 0);
  const parte = m.tipo === "numero" || m.tipo === "moeda" ? ` Os 3 primeiros somam ${pct(soma ? (top3 / soma) * 100 : 0)} do total de ${fmt(soma)}.` : "";
  return `${r.linhas.length} ${g.titulo.toLowerCase()}(s). O primeiro é ${topo[g.chave]} com ${fmt(topo[m.chave])}.${parte}`;
}

export const colunasDeMedida = (cols: ColunaDados[]) => cols.filter((c) => /^m\d+$/.test(c.chave));
