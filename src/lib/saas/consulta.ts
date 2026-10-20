/**
 * Motor de consulta declarativa sobre um dataset.
 *
 * Dashboards, relatórios, alertas, insights e o chat usam o mesmo `PlanoDeConsulta`.
 * A IA só preenche esse plano (JSON); quem calcula é este arquivo, no navegador do cliente.
 * Assim a IA nunca vê as linhas e nunca executa código.
 */
import { interpretarPeriodo } from "../periodo";
import { colunaPorChave } from "./dados";
import type {
  ColunaDados,
  Dataset,
  Filtro,
  Granularidade,
  Linha,
  Medida,
  PlanoDeConsulta,
  ResultadoConsulta,
  TipoColuna,
} from "./tipos";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const LIMITE_LISTA = 5000;
const LIMITE_AGREGADO = 500;

export type Intervalo = { coluna: string; inicio: string; fim: string; descricao: string };

export const ROTULO_AGREGACAO: Record<string, string> = {
  soma: "Soma de",
  media: "Média de",
  contagem: "Quantidade",
  maximo: "Maior",
  minimo: "Menor",
  distintos: "Distintos de",
};

const isoDe = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dataDeIso = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)), 12);

export function resolverPeriodo(plano: PlanoDeConsulta, hoje = new Date()): Intervalo | null {
  if (!plano.periodo) return null;
  const p = interpretarPeriodo(plano.periodo.expressao, hoje);
  if (!p) return null;
  return { coluna: plano.periodo.coluna, inicio: p.inicio, fim: p.fim, descricao: p.descricao };
}

/** Período do mesmo tamanho, imediatamente antes (para "vs. período anterior"). */
export function periodoAnterior(i: Intervalo): Intervalo {
  const ini = dataDeIso(i.inicio);
  const fim = dataDeIso(i.fim);
  const dias = Math.round((fim.getTime() - ini.getTime()) / 86_400_000) + 1;
  const novoFim = new Date(ini);
  novoFim.setDate(novoFim.getDate() - 1);
  const novoIni = new Date(novoFim);
  novoIni.setDate(novoIni.getDate() - (dias - 1));
  return { coluna: i.coluna, inicio: isoDe(novoIni), fim: isoDe(novoFim), descricao: "período anterior" };
}

function passa(l: Linha, f: Filtro, col: ColunaDados | undefined): boolean {
  const v = l[f.coluna];
  if (f.op === "contem")
    return String(v ?? "").toLowerCase().includes(String(f.valor).toLowerCase());
  if (f.op === "em")
    return Array.isArray(f.valor) && f.valor.map((x) => String(x).toLowerCase()).includes(String(v ?? "").toLowerCase());
  if (v === null || v === undefined) return f.op === "!=";
  const numerico = col && col.tipo !== "texto" && col.tipo !== "data";
  const a = numerico ? Number(v) : String(v).toLowerCase();
  const b = numerico ? Number(f.valor) : String(f.valor).toLowerCase();
  switch (f.op) {
    case "=": return a === b;
    case "!=": return a !== b;
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
    default: return true;
  }
}

function chaveDeGrupo(valor: Linha[string], col: ColunaDados, g?: Granularidade): { ordem: string; rotulo: string } {
  if (valor === null || valor === undefined || valor === "") return { ordem: "~", rotulo: "(vazio)" };
  if (col.tipo === "data" && g) {
    const iso = String(valor);
    if (g === "ano") return { ordem: iso.slice(0, 4), rotulo: iso.slice(0, 4) };
    if (g === "mes")
      return { ordem: iso.slice(0, 7), rotulo: `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}` };
    if (g === "semana") {
      const d = dataDeIso(iso);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const s = isoDe(d);
      return { ordem: s, rotulo: `sem ${s.slice(8, 10)}/${s.slice(5, 7)}` };
    }
    return { ordem: iso, rotulo: `${iso.slice(8, 10)}/${iso.slice(5, 7)}` };
  }
  if (col.tipo === "data") return { ordem: String(valor), rotulo: String(valor).split("-").reverse().join("/") };
  return { ordem: String(valor), rotulo: String(valor) };
}

function tipoDaMedida(m: Medida, col: ColunaDados | undefined): TipoColuna {
  if (m.agregacao === "contagem" || m.agregacao === "distintos") return "numero";
  return col?.tipo === "moeda" || col?.tipo === "percentual" ? col.tipo : "numero";
}

export function tituloDaMedida(m: Medida, ds: Pick<Dataset, "colunas">): string {
  if (m.rotulo) return m.rotulo;
  const col = m.coluna ? colunaPorChave(ds, m.coluna) : undefined;
  if (m.agregacao === "contagem") return col ? `Quantidade de ${col.titulo}` : "Quantidade";
  return `${ROTULO_AGREGACAO[m.agregacao]} ${col?.titulo ?? ""}`.trim();
}

/** Erros do plano em português; lista vazia = pode executar. Também protege contra plano vindo da IA. */
export function validarPlano(ds: Dataset, p: PlanoDeConsulta): string[] {
  const erros: string[] = [];
  const existe = (k: string) => !!colunaPorChave(ds, k);
  if (p.modo !== "agregado" && p.modo !== "lista") erros.push("Modo de consulta inválido.");
  for (const f of p.filtros ?? []) if (!existe(f.coluna)) erros.push(`Coluna do filtro não existe: ${f.coluna}.`);
  if (p.periodo) {
    const c = colunaPorChave(ds, p.periodo.coluna);
    if (!c || c.tipo !== "data") erros.push("O período precisa de uma coluna de data.");
    if (!interpretarPeriodo(p.periodo.expressao)) erros.push(`Período não reconhecido: "${p.periodo.expressao}".`);
  }
  if (p.modo === "agregado") {
    if (!p.medidas?.length) erros.push("Falta escolher o que calcular (soma, quantidade...).");
    for (const m of p.medidas ?? []) {
      if (m.agregacao !== "contagem" && !m.coluna) erros.push("Falta a coluna da medida.");
      if (m.coluna && !existe(m.coluna)) erros.push(`Coluna da medida não existe: ${m.coluna}.`);
      const c = m.coluna ? colunaPorChave(ds, m.coluna) : undefined;
      if (c && ["soma", "media"].includes(m.agregacao) && !["numero", "moeda", "percentual"].includes(c.tipo))
        erros.push(`Não dá para somar ou tirar média de "${c.titulo}".`);
    }
    if ((p.agruparPor?.length ?? 0) > 2) erros.push("No máximo 2 agrupamentos.");
    for (const g of p.agruparPor ?? []) if (!existe(g.coluna)) erros.push(`Coluna de agrupamento não existe: ${g.coluna}.`);
  } else {
    for (const c of p.colunas ?? []) if (!existe(c)) erros.push(`Coluna não existe: ${c}.`);
  }
  return erros;
}

export function executarPlano(
  ds: Dataset,
  plano: PlanoDeConsulta,
  opcoes: { hoje?: Date; intervalo?: Intervalo | null } = {},
): ResultadoConsulta {
  const intervalo = opcoes.intervalo === undefined ? resolverPeriodo(plano, opcoes.hoje) : opcoes.intervalo;
  const filtros = plano.filtros ?? [];
  const porChave = new Map(ds.colunas.map((c) => [c.chave, c]));

  const linhas = ds.linhas.filter((l) => {
    if (intervalo) {
      const d = l[intervalo.coluna];
      if (typeof d !== "string" || d < intervalo.inicio || d > intervalo.fim) return false;
    }
    return filtros.every((f) => passa(l, f, porChave.get(f.coluna)));
  });
  const base = { linhasLidas: linhas.length, descricaoPeriodo: intervalo?.descricao };

  /* ---- lista ---- */
  if (plano.modo === "lista") {
    const chaves = plano.colunas?.length ? plano.colunas : ds.colunas.map((c) => c.chave);
    const colunas = chaves.map((k) => porChave.get(k)).filter((c): c is ColunaDados => !!c);
    let saida = linhas;
    if (plano.ordenarPor) {
      const { campo, direcao } = plano.ordenarPor;
      const f = direcao === "asc" ? 1 : -1;
      saida = [...linhas].sort((a, b) => {
        const x = a[campo];
        const y = b[campo];
        if (x === y) return 0;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        return (x < y ? -1 : 1) * f;
      });
    }
    const lim = Math.min(plano.limite ?? LIMITE_LISTA, LIMITE_LISTA);
    saida = saida.slice(0, lim).map((l) => Object.fromEntries(chaves.map((k) => [k, l[k] ?? null])));
    return { colunas, linhas: saida, ...base };
  }

  /* ---- agregado ---- */
  const medidas = plano.medidas ?? [];
  const grupos = plano.agruparPor ?? [];
  const colunasGrupo = grupos.map((g) => porChave.get(g.coluna)!);
  type Acc = { chaves: { ordem: string; rotulo: string }[]; n: number[]; soma: number[]; max: number[]; min: number[]; dist: Set<string>[] };
  const mapa = new Map<string, Acc>();
  for (const l of linhas) {
    const ks = grupos.map((g, i) => chaveDeGrupo(l[g.coluna] ?? null, colunasGrupo[i]!, g.granularidade));
    const id = ks.map((k) => k.ordem).join("\u0001");
    let a = mapa.get(id);
    if (!a) {
      a = {
        chaves: ks,
        n: medidas.map(() => 0),
        soma: medidas.map(() => 0),
        max: medidas.map(() => -Infinity),
        min: medidas.map(() => Infinity),
        dist: medidas.map(() => new Set<string>()),
      };
      mapa.set(id, a);
    }
    medidas.forEach((m, i) => {
      if (m.agregacao === "contagem" && !m.coluna) {
        a!.n[i]!++;
        return;
      }
      const v = m.coluna ? l[m.coluna] : null;
      if (v === null || v === undefined || v === "") return;
      if (m.agregacao === "contagem") a!.n[i]!++;
      else if (m.agregacao === "distintos") a!.dist[i]!.add(String(v));
      else {
        const x = Number(v);
        if (Number.isNaN(x)) return;
        a!.n[i]!++;
        a!.soma[i]! += x;
        a!.max[i] = Math.max(a!.max[i]!, x);
        a!.min[i] = Math.min(a!.min[i]!, x);
      }
    });
  }

  const colunas: ColunaDados[] = [
    ...colunasGrupo.map((c, i) => ({
      chave: c.chave,
      titulo: grupos[i]!.granularidade && c.tipo === "data" ? `${c.titulo} (${{ dia: "dia", semana: "semana", mes: "mês", ano: "ano" }[grupos[i]!.granularidade!]})` : c.titulo,
      tipo: (c.tipo === "data" ? "texto" : c.tipo) as TipoColuna,
    })),
    ...medidas.map((m, i) => ({
      chave: `m${i}`,
      titulo: tituloDaMedida(m, ds),
      tipo: tipoDaMedida(m, m.coluna ? porChave.get(m.coluna) : undefined),
    })),
  ];

  let resultado = [...mapa.values()].map((a) => {
    const linha: Linha = {};
    grupos.forEach((g, i) => (linha[g.coluna] = a.chaves[i]!.rotulo));
    medidas.forEach((m, i) => {
      const v =
        m.agregacao === "contagem" ? a.n[i]!
        : m.agregacao === "distintos" ? a.dist[i]!.size
        : m.agregacao === "soma" ? a.soma[i]!
        : m.agregacao === "media" ? (a.n[i]! ? a.soma[i]! / a.n[i]! : 0)
        : m.agregacao === "maximo" ? (Number.isFinite(a.max[i]!) ? a.max[i]! : 0)
        : Number.isFinite(a.min[i]!) ? a.min[i]! : 0;
      linha[`m${i}`] = Math.round(v * 100) / 100;
    });
    return { linha, ordem: a.chaves.map((k) => k.ordem).join("\u0001") };
  });

  // sem agrupamento e sem linhas: ainda devolve uma linha zerada (KPI vazio mostra 0)
  if (grupos.length === 0 && resultado.length === 0) {
    const linha: Linha = {};
    medidas.forEach((_, i) => (linha[`m${i}`] = 0));
    resultado = [{ linha, ordem: "" }];
  }

  const temData = grupos.some((g, i) => colunasGrupo[i]!.tipo === "data");
  if (plano.ordenarPor) {
    const { campo, direcao } = plano.ordenarPor;
    const f = direcao === "asc" ? 1 : -1;
    resultado.sort((a, b) => {
      const x = a.linha[campo];
      const y = b.linha[campo];
      if (x === y) return 0;
      return ((x ?? 0) < (y ?? 0) ? -1 : 1) * f;
    });
  } else if (temData) {
    resultado.sort((a, b) => (a.ordem < b.ordem ? -1 : a.ordem > b.ordem ? 1 : 0));
  } else if (medidas.length) {
    resultado.sort((a, b) => Number(b.linha["m0"] ?? 0) - Number(a.linha["m0"] ?? 0));
  }
  const lim = Math.min(plano.limite ?? LIMITE_AGREGADO, LIMITE_AGREGADO);
  return { colunas, linhas: resultado.slice(0, lim).map((r) => r.linha), ...base };
}

/** Substitui a expressão de período de um plano (filtro de período do dashboard). */
export function comPeriodo(plano: PlanoDeConsulta, expressao: string | null): PlanoDeConsulta {
  if (!plano.periodo || !expressao || expressao === "padrao") return plano;
  return { ...plano, periodo: { ...plano.periodo, expressao } };
}

/* ---------- formatação ---------- */

export function formatarValor(v: Linha[string] | undefined, tipo: TipoColuna): string {
  if (v === null || v === undefined || v === "") return "—";
  if (tipo === "moeda") return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (tipo === "percentual") return `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (tipo === "numero") return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (tipo === "data") return String(v).slice(0, 10).split("-").reverse().join("/");
  return String(v);
}

/** Valor curto para eixos e KPIs: 1,2 mi, 340 mil. */
export function formatarCompacto(n: number, tipo: TipoColuna): string {
  const abs = Math.abs(n);
  const prefixo = tipo === "moeda" ? "R$ " : "";
  if (abs >= 1e9) return `${prefixo}${(n / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`;
  if (abs >= 1e6) return `${prefixo}${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1e4) return `${prefixo}${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `${prefixo}${n.toLocaleString("pt-BR", { maximumFractionDigits: tipo === "moeda" ? 0 : 1 })}`;
}

/* ---------- períodos ---------- */

export const PERIODOS_PADRAO = [
  "hoje",
  "ontem",
  "esta semana",
  "semana passada",
  "este mês",
  "mês passado",
  "últimos 7 dias",
  "últimos 15 dias",
  "últimos 30 dias",
  "últimos 60 dias",
  "últimos 90 dias",
  "últimos 6 meses",
  "últimos 12 meses",
  "este ano",
  "ano passado",
  "próximos 7 dias",
  "próximos 30 dias",
  "próximos 60 dias",
] as const;

const brData = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Converte um período já interpretado numa expressão que continua valendo amanhã
 * ("mês passado") ou, se não houver equivalente, em datas fixas ("01/08/2026 a 31/08/2026").
 */
export function expressaoDoPeriodo(p: { inicio: string; fim: string }, hoje = new Date()): string {
  const achada = PERIODOS_PADRAO.find((e) => {
    const x = interpretarPeriodo(e, hoje);
    return x && x.inicio === p.inicio && x.fim === p.fim;
  });
  return achada ?? `${brData(p.inicio)} a ${brData(p.fim)}`;
}
