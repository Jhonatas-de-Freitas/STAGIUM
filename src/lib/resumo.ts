import type { Coluna } from "./planilha";

/**
 * Resumo automático de uma consulta: os números que o analista calcularia primeiro na
 * planilha (quantos registros, quanto somam, de quando a quando, como se dividem).
 * Tudo é inferido dos próprios dados, sem depender do sistema de origem.
 */

export type Destaque = { rotulo: string; valor: string };
export type Grupo = { nome: string; quantidade: number; soma: number | null };
export type ResumoDados = {
  destaques: Destaque[];
  /** Coluna de valor usada nas somas (ex.: "Valor total"). */
  colunaValor: string | null;
  porMes: { coluna: string; grupos: Grupo[] } | null;
  porCategoria: { coluna: string; grupos: Grupo[] } | null;
};

type Linha = Record<string, string | number>;

const DATA = /^(\d{4})-(\d{2})-(\d{2})/;
const NOME_DE_VALOR = /valor|total|saldo|pre[cç]o|montante|liquido|líquido/i;
const NOME_DE_DATA = /emiss|venc|data|pedido|movimento|baixa|pagamento|cadastro/i;
const NOME_DE_CATEGORIA =
  /situa|status|filial|tipo|origem|posi|natureza|forma|banco|carteira|uf\b/i;
const NOME_DE_ID = /^(id|c[oó]digo|n[uú]mero|chave|cpf|cnpj|sku|ncm)/i;

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const formatarMoeda = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function preenchidos(linhas: Linha[], chave: string) {
  return linhas.map((l) => l[chave]).filter((v) => v !== undefined && v !== null && v !== "");
}

/** Coluna de valor: numérica e com nome de valor; a primeira que bater, nesta ordem de preferência. */
function escolherValor(colunas: Coluna[], linhas: Linha[]): Coluna | null {
  const numericas = colunas.filter((c) => {
    const v = preenchidos(linhas, c.chave);
    return v.length > 0 && v.filter((x) => typeof x === "number").length / v.length >= 0.9;
  });
  for (const preferido of [/valor total|total/i, /valor/i, /saldo/i, NOME_DE_VALOR]) {
    const achada = numericas.find((c) => preferido.test(c.titulo) && !NOME_DE_ID.test(c.titulo));
    if (achada) return achada;
  }
  return null;
}

function escolherData(colunas: Coluna[], linhas: Linha[]): Coluna | null {
  const datas = colunas.filter((c) => {
    const v = preenchidos(linhas, c.chave);
    return (
      v.length >= Math.max(1, linhas.length * 0.5) &&
      v.filter((x) => typeof x === "string" && DATA.test(x) && !x.startsWith("1900")).length /
        v.length >=
        0.8
    );
  });
  return datas.find((c) => NOME_DE_DATA.test(c.titulo)) ?? datas[0] ?? null;
}

function escolherCategoria(colunas: Coluna[], linhas: Linha[], excluir: Set<string>) {
  const candidatas = colunas
    .filter((c) => !excluir.has(c.chave) && !NOME_DE_ID.test(c.titulo))
    .map((c) => {
      const v = preenchidos(linhas, c.chave);
      const distintos = new Set(v.map(String));
      return { c, v, distintos: distintos.size };
    })
    .filter(
      ({ v, distintos }) =>
        v.length >= linhas.length * 0.7 &&
        distintos >= 2 &&
        distintos <= 12 &&
        v.every((x) => typeof x === "string"),
    );
  return (
    candidatas.find(({ c }) => NOME_DE_CATEGORIA.test(c.titulo))?.c ?? candidatas[0]?.c ?? null
  );
}

function agrupar(
  linhas: Linha[],
  chave: (l: Linha) => string | null,
  valor: Coluna | null,
): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const l of linhas) {
    const nome = chave(l);
    if (!nome) continue;
    const g = mapa.get(nome) ?? { nome, quantidade: 0, soma: valor ? 0 : null };
    g.quantidade += 1;
    if (valor && typeof l[valor.chave] === "number")
      g.soma = (g.soma ?? 0) + Number(l[valor.chave]);
    mapa.set(nome, g);
  }
  return [...mapa.values()];
}

export function resumirDados(colunas: Coluna[], linhas: Linha[]): ResumoDados | null {
  if (linhas.length < 2) return null;
  const valor = escolherValor(colunas, linhas);
  const data = escolherData(colunas, linhas);
  const categoria = escolherCategoria(
    colunas,
    linhas,
    new Set([valor?.chave, data?.chave].filter(Boolean) as string[]),
  );

  const destaques: Destaque[] = [
    { rotulo: "Registros", valor: linhas.length.toLocaleString("pt-BR") },
  ];
  if (valor) {
    const numeros = preenchidos(linhas, valor.chave).filter(
      (x): x is number => typeof x === "number",
    );
    const soma = numeros.reduce((a, b) => a + b, 0);
    destaques.push({ rotulo: `Soma de ${valor.titulo}`, valor: formatarMoeda(soma) });
    destaques.push({
      rotulo: "Média por registro",
      valor: formatarMoeda(numeros.length ? soma / numeros.length : 0),
    });
    destaques.push({ rotulo: "Maior valor", valor: formatarMoeda(Math.max(...numeros)) });
  }
  let porMes: ResumoDados["porMes"] = null;
  if (data) {
    const datas = preenchidos(linhas, data.chave)
      .map(String)
      .filter((x) => DATA.test(x) && !x.startsWith("1900"))
      .sort();
    destaques.push({
      rotulo: `Período (${data.titulo})`,
      valor: `${dataBr(datas[0]!)} a ${dataBr(datas[datas.length - 1]!)}`,
    });
    const grupos = agrupar(
      linhas,
      (l) => {
        const m = DATA.exec(String(l[data.chave] ?? ""));
        return m && m[1] !== "1900" ? `${m[1]}-${m[2]}` : null;
      },
      valor,
    ).sort((a, b) => a.nome.localeCompare(b.nome));
    if (grupos.length >= 2 && grupos.length <= 24) {
      porMes = {
        coluna: data.titulo,
        grupos: grupos.map((g) => ({
          ...g,
          nome: `${MESES[Number(g.nome.slice(5)) - 1]}/${g.nome.slice(2, 4)}`,
        })),
      };
    }
  }
  const porCategoria = categoria
    ? {
        coluna: categoria.titulo,
        grupos: agrupar(linhas, (l) => String(l[categoria.chave] ?? "") || null, valor).sort(
          (a, b) => (b.soma ?? b.quantidade) - (a.soma ?? a.quantidade),
        ),
      }
    : null;

  return { destaques, colunaValor: valor?.titulo ?? null, porMes, porCategoria };
}

/** Linhas da aba "Resumo" da planilha. */
export function resumoEmLinhas(resumo: ResumoDados): (string | number)[][] {
  const linhas: (string | number)[][] = [["Resumo da consulta"], []];
  for (const d of resumo.destaques) linhas.push([d.rotulo, d.valor]);
  const tabela = (titulo: string, grupos: Grupo[]) => {
    linhas.push([], [titulo, "Registros", ...(resumo.colunaValor ? [resumo.colunaValor] : [])]);
    for (const g of grupos) {
      linhas.push([
        g.nome,
        g.quantidade,
        ...(g.soma !== null ? [Math.round(g.soma * 100) / 100] : []),
      ]);
    }
  };
  if (resumo.porMes) tabela(`Por mês (${resumo.porMes.coluna})`, resumo.porMes.grupos);
  if (resumo.porCategoria) tabela(`Por ${resumo.porCategoria.coluna}`, resumo.porCategoria.grupos);
  linhas.push([], ["Calculado automaticamente a partir das linhas da aba Dados."]);
  return linhas;
}
