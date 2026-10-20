/**
 * Conjuntos de dados do cliente: inferência de tipos de coluna e importação de planilha.
 * Funciona para qualquer origem (ERP sincronizado, planilha enviada, dados de demonstração).
 */
import type { ColunaDados, Dataset, Linha, TipoColuna } from "./tipos";

const SENSIVEL = /cpf|cnpj|e-?mail|telefone|celular|fone|whats|endere[cç]o|\brg\b|nascimento|chave pix|\bpix\b|conta banc/i;
const NOME_MOEDA = /valor|pre[cç]o|total|saldo|custo|montante|receita|despesa|faturamento|desconto|juros|multa|ticket/i;
const NOME_PERCENTUAL = /percent|%|margem|taxa/i;

export const slugDeColuna = (titulo: string) =>
  titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "coluna";

/** "1.234,56" → 1234.56; "12,5%" → 12.5; devolve null se não for número. */
export function paraNumero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let t = v.trim().replace(/^R\$\s*/i, "").replace(/%$/, "").trim();
  if (!t || !/^-?[\d.,\s]+$/.test(t)) return null;
  t = t.replace(/\s/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if ((t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "31/12/2026" ou "2026-12-31..." → "2026-12-31"; null se não for data. */
export function paraDataIso(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    return `${y}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v !== "string") return null;
  const t = v.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return iso[1] === "1900" ? null : `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (br) return `${br[3]}-${br[2]!.padStart(2, "0")}-${br[1]!.padStart(2, "0")}`;
  return null;
}

export function inferirColunas(titulos: string[], linhas: Record<string, unknown>[]): ColunaDados[] {
  const usadas = new Set<string>();
  return titulos.map((titulo) => {
    let chave = slugDeColuna(titulo);
    while (usadas.has(chave)) chave += "_2";
    usadas.add(chave);
    const valores = linhas
      .map((l) => l[titulo])
      .filter((v) => v !== null && v !== undefined && v !== "");
    const amostra = valores.slice(0, 400);
    const parte = (f: (v: unknown) => unknown) =>
      amostra.length ? amostra.filter((v) => f(v) !== null).length / amostra.length : 0;
    let tipo: TipoColuna = "texto";
    if (parte(paraDataIso) >= 0.85) tipo = "data";
    else if (parte(paraNumero) >= 0.9 && !/^(id|c[oó]digo|n[uú]mero|cpf|cnpj|nf|pedido|documento)/i.test(titulo)) {
      tipo = NOME_PERCENTUAL.test(titulo) ? "percentual" : NOME_MOEDA.test(titulo) ? "moeda" : "numero";
    }
    return { chave, titulo, tipo, sensivel: SENSIVEL.test(titulo) || undefined };
  });
}

export type ResultadoImportacao = {
  colunas: ColunaDados[];
  linhas: Linha[];
  truncado: boolean;
  totalOriginal: number;
};

export const MAX_LINHAS_IMPORTACAO = 20_000;
export const MAX_BYTES_IMPORTACAO = 5 * 1024 * 1024;

/** Converte linhas cruas (título → valor) em linhas tipadas, já com as chaves do dataset. */
export function tiparLinhas(
  titulos: string[],
  cruas: Record<string, unknown>[],
): { colunas: ColunaDados[]; linhas: Linha[] } {
  const colunas = inferirColunas(titulos, cruas);
  const linhas = cruas.map((cru) => {
    const l: Linha = {};
    colunas.forEach((c, i) => {
      const v = cru[titulos[i]!];
      if (v === null || v === undefined || v === "") l[c.chave] = null;
      else if (c.tipo === "data") l[c.chave] = paraDataIso(v);
      else if (c.tipo === "texto") l[c.chave] = String(v);
      else l[c.chave] = paraNumero(v);
    });
    return l;
  });
  return { colunas, linhas };
}

/** Lê .xlsx, .xls ou .csv enviado pelo cliente (no navegador, sem subir para servidor). */
export async function lerPlanilha(arquivo: File): Promise<ResultadoImportacao> {
  if (arquivo.size > MAX_BYTES_IMPORTACAO)
    throw new Error(`O arquivo tem ${(arquivo.size / 1048576).toFixed(1)} MB. O limite é 5 MB.`);
  const XLSX = await import("xlsx");
  const buffer = await arquivo.arrayBuffer();
  const livro = XLSX.read(buffer, { type: "array", cellDates: true, raw: false, dateNF: "yyyy-mm-dd" });
  const aba = livro.Sheets[livro.SheetNames[0]!];
  if (!aba) throw new Error("A planilha está vazia.");
  const cruas = XLSX.utils.sheet_to_json<Record<string, unknown>>(aba, { defval: null, raw: false });
  if (cruas.length === 0) throw new Error("Não encontrei linhas de dados. A primeira linha deve ter os títulos das colunas.");
  const titulos = Object.keys(cruas[0]!).filter((t) => !t.startsWith("__EMPTY"));
  if (titulos.length === 0) throw new Error("Não encontrei títulos de coluna na primeira linha.");
  const cortadas = cruas.slice(0, MAX_LINHAS_IMPORTACAO);
  const { colunas, linhas } = tiparLinhas(titulos, cortadas);
  return { colunas, linhas, truncado: cruas.length > cortadas.length, totalOriginal: cruas.length };
}

/** Escolhe a "medida principal" (valor em reais) e a "data principal" de um dataset. */
export function medidaPrincipal(ds: Pick<Dataset, "colunas">): ColunaDados | null {
  const m = ds.colunas.filter((c) => c.tipo === "moeda");
  const pref = [/valor total|total/i, /valor/i, /saldo/i, /.*/];
  for (const p of pref) {
    const achou = m.find((c) => p.test(c.titulo));
    if (achou) return achou;
  }
  return ds.colunas.find((c) => c.tipo === "numero") ?? null;
}

export function dataPrincipal(ds: Pick<Dataset, "colunas">): ColunaDados | null {
  const d = ds.colunas.filter((c) => c.tipo === "data");
  return d.find((c) => /emiss|data|pedido|movimento|lan[cç]/i.test(c.titulo)) ?? d[0] ?? null;
}

export const colunaPorChave = (ds: Pick<Dataset, "colunas">, chave: string) =>
  ds.colunas.find((c) => c.chave === chave);

/** Resumo do esquema, sem nenhuma linha de dado. É só isto que pode ir à IA. */
export function esquemaParaIa(ds: Dataset) {
  return {
    id: ds.id,
    nome: ds.nome,
    descricao: ds.descricao,
    linhas: ds.linhas.length,
    colunas: ds.colunas
      .filter((c) => !c.sensivel)
      .map((c) => {
        const distintos = new Set<string>();
        if (c.tipo === "texto") {
          for (const l of ds.linhas) {
            if (l[c.chave] != null) distintos.add(String(l[c.chave]));
            if (distintos.size > 12) break;
          }
        }
        return {
          chave: c.chave,
          titulo: c.titulo,
          tipo: c.tipo,
          // só categorias pequenas (situação, filial...) têm os valores enviados; nomes de clientes não
          valores: c.tipo === "texto" && distintos.size <= 12 ? [...distintos] : undefined,
        };
      }),
  };
}
