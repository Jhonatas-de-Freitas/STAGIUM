/**
 * Entende uma pergunta em português e a transforma num PlanoDeConsulta, por regras.
 * É o "modo básico" do chat: grátis, instantâneo e previsível. Com a IA ligada, o plano
 * vem do modelo (ia.servidor.ts); se ele falhar, este arquivo é a rede de segurança.
 */
import { interpretarPeriodo } from "../periodo";
import { expressaoDoPeriodo, tituloDaMedida } from "./consulta";
import { dataPrincipal, medidaPrincipal } from "./dados";
import { perfilDoDataset } from "./sugestoes";
import type { ColunaDados, Dataset, Filtro, Granularidade, Medida, PlanoDeConsulta, TipoVisual } from "./tipos";

export type PlanoInterpretado = {
  plano: PlanoDeConsulta;
  visual: TipoVisual;
  titulo: string;
  /** "Entendi assim:" — transparência para o cliente conferir. */
  entendi: string;
  origem: "regras" | "ia";
};

export type ErroInterpretacao = { erro: string; sugestoes: string[] };

export const normalizar = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function pluraisDe(titulo: string): string[] {
  const t = normalizar(titulo).replace(/\(.*?\)/g, "").trim();
  const base = t.split(/\s+/)[0]!;
  return [...new Set([t, base, `${base}s`, `${base}es`, base.replace(/or$/, "ores"), base.replace(/ao$/, "oes")])].filter((x) => x.length >= 3);
}

const PALAVRAS_DATASET: Record<string, RegExp> = {
  vendas: /vend|fatur|pedido|comprou|compra|ticket|receita/,
  receber: /receber|inadimpl|cobranca|devend|deve\b|devedor|titulo|duplicata/,
  pagar: /pagar|fornecedor|despesa|conta de|boleto a pagar/,
  estoque: /estoque|saldo|parado|giro|prateleira/,
};

function escolherDataset(t: string, datasets: Dataset[]): Dataset | null {
  let melhor: { ds: Dataset; pts: number } | null = null;
  for (const ds of datasets) {
    let pts = 0;
    if (PALAVRAS_DATASET[ds.tipo]?.test(t)) pts += 4;
    if (t.includes(normalizar(ds.nome))) pts += 5;
    for (const c of ds.colunas) {
      const [completo, ...resto] = pluraisDe(c.titulo);
      if (completo && new RegExp(`\\b${completo}\\b`).test(t)) pts += completo.includes(" ") ? 2 : 0.5;
      else if (resto.some((p) => new RegExp(`\\b${p}\\b`).test(t))) pts += 0.5;
    }
    if (!melhor || pts > melhor.pts) melhor = { ds, pts };
  }
  return melhor?.ds ?? null;
}

function granularidade(t: string): Granularidade | null {
  if (/\b(por mes|mensal|mensais|mes a mes|cada mes|evolucao|ao longo)\b/.test(t)) return "mes";
  if (/\b(por dia|diari[oa]s?|dia a dia|cada dia)\b/.test(t)) return "dia";
  if (/\b(por semana|semanal|semanais|cada semana)\b/.test(t)) return "semana";
  if (/\b(por ano|anual|anuais|cada ano)\b/.test(t)) return "ano";
  return null;
}

function achar(ds: Dataset, t: string, quais: ColunaDados[], depoisDe?: RegExp): ColunaDados | null {
  if (depoisDe && !depoisDe.test(t)) return null;
  const trecho = depoisDe ? t.slice(t.search(depoisDe)) : t;
  let melhor: { c: ColunaDados; pos: number } | null = null;
  for (const c of quais) {
    for (const p of pluraisDe(c.titulo)) {
      const m = new RegExp(`\\b${p}\\b`).exec(trecho);
      if (m && (!melhor || m.index < melhor.pos)) melhor = { c, pos: m.index };
    }
  }
  return melhor?.c ?? null;
}

export function interpretarPergunta(
  pergunta: string,
  datasets: Dataset[],
  hoje = new Date(),
): PlanoInterpretado | ErroInterpretacao {
  const t = normalizar(pergunta);
  const ds = escolherDataset(t, datasets);
  if (!ds) return { erro: "Ainda não há dados para consultar. Importe uma planilha ou use os dados de demonstração.", sugestoes: [] };

  const perfil = perfilDoDataset(ds);
  const medidaPadrao = medidaPrincipal(ds);
  const dataPadrao = dataPrincipal(ds);
  const textos = ds.colunas.filter((c) => c.tipo === "texto" && !c.sensivel);
  const numericas = ds.colunas.filter((c) => ["numero", "moeda", "percentual"].includes(c.tipo));

  /* período */
  const p = interpretarPeriodo(pergunta, hoje);
  const venceu = /venc|a receber|a pagar/.test(t) && ds.colunas.find((c) => /vencimento/i.test(c.titulo));
  const colData = (venceu && venceu.tipo === "data" ? venceu : dataPadrao) ?? null;
  const periodo = p && colData ? { coluna: colData.chave, expressao: expressaoDoPeriodo(p, hoje) } : undefined;

  /* filtros por situação e por valores citados */
  const filtros: Filtro[] = [];
  const situ = ds.colunas.find((c) => /situa|status/i.test(c.titulo));
  const querCancelado = /cancel/.test(t);
  if (situ) {
    const valores = new Set(ds.linhas.slice(0, 4000).map((l) => String(l[situ.chave] ?? "")));
    const mapa: [RegExp, RegExp][] = [
      [/vencid|atrasad|inadimpl/, /^vencid/i],
      [/em aberto|abert[oa]s?|a receber|a pagar|pendente/, /abert|pendent/i],
      [/\bpag[oa]s?\b|quitad|recebid/, /^pag/i],
      [/cancel/, /cancel/i],
      [/faturad/, /fatur/i],
    ];
    for (const [re, valRe] of mapa) {
      const v = re.test(t) && [...valores].find((x) => valRe.test(x));
      if (v) {
        filtros.push({ coluna: situ.chave, op: "=", valor: v });
        break;
      }
    }
  }
  if (!filtros.some((f) => f.coluna === situ?.chave) && !querCancelado) filtros.push(...perfil.filtroPadrao);
  for (const c of textos) {
    if (c === situ) continue;
    const valores = [...new Set(ds.linhas.slice(0, 4000).map((l) => l[c.chave]).filter((v): v is string => typeof v === "string"))];
    if (valores.length > 80) continue;
    const citados = valores.filter((v) => {
      const nv = normalizar(v);
      if (nv.length >= 4 && t.includes(nv)) return true;
      const primeiro = nv.split(" ")[0]!;
      return valores.length > 6 && primeiro.length >= 4 && new RegExp(`\\b${primeiro}\\b`).test(t) && valores.filter((x) => normalizar(x).startsWith(primeiro)).length === 1;
    });
    if (citados.length === 1) filtros.push({ coluna: c.chave, op: "=", valor: citados[0]! });
    else if (citados.length > 1) filtros.push({ coluna: c.chave, op: "em", valor: citados });
  }

  /* o que calcular */
  const querContagem = /\b(quantos|quantas|numero de|n[o°º] de|contagem|qtd de)\b/.test(t) || /quantidade de (pedidos|titulos|notas|lancamentos|clientes|registros)/.test(t);
  const querMedia = /\b(media|medio|ticket)\b/.test(t);
  const querMaximo = /\b(maior|mais alto)\b/.test(t) && /\b(valor|pedido|titulo|venda)\b/.test(t) && !/\bmaiores\b/.test(t);
  const colunaCitada = achar(ds, t, numericas);
  const medidaCol = colunaCitada ?? medidaPadrao;
  const medida: Medida = querContagem || !medidaCol ? { agregacao: "contagem", rotulo: "Quantidade" }
    : { coluna: medidaCol.chave, agregacao: querMedia ? "media" : querMaximo ? "maximo" : "soma" };

  /* agrupamentos */
  const gran = granularidade(t);
  const agrupar: { coluna: string; granularidade?: Granularidade }[] = [];
  const porDim = achar(ds, t, textos, /\b(por|de cada|cada|quais|top \d+|maiores|menores|ranking)\b/);
  if (gran && colData) agrupar.push({ coluna: dataPadrao?.chave ?? colData.chave, granularidade: gran });
  if (porDim && !filtros.some((f) => f.coluna === porDim.chave && f.op === "=")) agrupar.push({ coluna: porDim.chave });
  else if (!porDim && /\b(por situacao|por status)\b/.test(t) && situ) agrupar.push({ coluna: situ.chave });

  const topN = /(?:top|maiores|menores|principais|melhores|piores)\s*(\d{1,3})/.exec(t);
  const querRanking = /\b(top|maiores|menores|principais|melhores|piores|ranking)\b/.test(t);
  const querMenores = /\b(menores|piores|menos)\b/.test(t);
  const querLista = !agrupar.length && /\b(liste|listar|lista|mostre|mostrar|detalh|exiba|quais|todos os|todas as)\b/.test(t) && !querContagem && !querMedia;

  const dsNome = ds.nome.toLowerCase();
  const periodoTxt = p ? ` em ${p.descricao}` : "";

  if (querLista) {
    const cols = ds.colunas.filter((c) => !c.sensivel).slice(0, 8).map((c) => c.chave);
    const ordem = querRanking && medidaCol ? medidaCol.chave : colData?.chave;
    return {
      plano: {
        datasetId: ds.id, modo: "lista", filtros, periodo, colunas: cols,
        ordenarPor: ordem ? { campo: ordem, direcao: querMenores ? "asc" : "desc" } : undefined,
        limite: topN ? Number(topN[1]) : 200,
      },
      visual: "tabela",
      titulo: `Lista de ${dsNome}${periodoTxt}`,
      entendi: `Lista de ${dsNome}${periodoTxt}${filtros.length ? ` com ${filtros.length} filtro(s)` : ""}, ordenada por ${ordem ? ds.colunas.find((c) => c.chave === ordem)?.titulo : "data"}.`,
      origem: "regras",
    };
  }

  // pergunta que só pede ranking de uma coluna sem medida clara ("quais clientes mais compraram")
  const semPista = !agrupar.length && !querContagem && !querMedia && !colunaCitada && !/\b(total|quanto|soma|valor|fatur|vend|receb|gast|pag)/.test(t);
  if (semPista) {
    return {
      erro: "Não consegui entender qual número você quer ver. Diga o que calcular e, se quiser, por qual coluna agrupar.",
      sugestoes: exemplosDePerguntas(datasets).slice(0, 4),
    };
  }

  const grupos = agrupar.slice(0, 2);
  const limite = grupos.some((g) => !g.granularidade) ? (topN ? Number(topN[1]) : querRanking || grupos.length ? 10 : undefined) : undefined;
  const plano: PlanoDeConsulta = {
    datasetId: ds.id,
    modo: "agregado",
    filtros,
    periodo,
    agruparPor: grupos.length ? grupos : undefined,
    medidas: [medida],
    ordenarPor: grupos.some((g) => !g.granularidade) ? { campo: "m0", direcao: querMenores ? "asc" : "desc" } : undefined,
    limite,
  };
  const temTempo = grupos.some((g) => g.granularidade);
  const visual: TipoVisual = !grupos.length ? "kpi"
    : temTempo && grupos.length === 2 ? "linha"
    : temTempo ? (gran === "mes" || gran === "ano" ? "barras" : "linha")
    : /particip|proporc|distribui|percentual|pizza|fatia/.test(t) ? "pizza"
    : "barras_h";

  const nomeMedida = tituloDaMedida(medida, ds);
  const porTxt = grupos.map((g) => {
    const c = ds.colunas.find((x) => x.chave === g.coluna)!;
    return g.granularidade ? `por ${{ dia: "dia", semana: "semana", mes: "mês", ano: "ano" }[g.granularidade]}` : `por ${c.titulo.toLowerCase()}`;
  });
  return {
    plano,
    visual,
    titulo: `${nomeMedida}${porTxt.length ? ` ${porTxt.join(" e ")}` : ""}${periodoTxt}`,
    entendi: `${nomeMedida}${porTxt.length ? ` ${porTxt.join(" e ")}` : ""}${periodoTxt}, na base ${dsNome}${filtros.length ? `, com ${filtros.length} filtro(s)` : ""}.`,
    origem: "regras",
  };
}

export const ehErro = (r: PlanoInterpretado | ErroInterpretacao): r is ErroInterpretacao => "erro" in r;

export function exemplosDePerguntas(datasets: Dataset[]): string[] {
  const tipos = new Set(datasets.map((d) => d.tipo));
  const ex: string[] = [];
  if (tipos.has("vendas")) ex.push("Quanto vendi por mês nos últimos 12 meses?", "Top 10 clientes por valor total em setembro", "Faturamento por vendedor este mês", "Quantos pedidos por filial no mês passado?");
  if (tipos.has("receber")) ex.push("Quais clientes têm títulos vencidos?", "Quanto tenho a receber nos próximos 30 dias?");
  if (tipos.has("pagar")) ex.push("Contas a pagar vencidas por fornecedor", "Quanto tenho a pagar nos próximos 7 dias?");
  if (tipos.has("estoque")) ex.push("Valor em estoque por categoria", "Top 10 produtos por valor em estoque");
  if (!ex.length) ex.push("Total por mês", "Quantos registros no mês passado?");
  return ex;
}
