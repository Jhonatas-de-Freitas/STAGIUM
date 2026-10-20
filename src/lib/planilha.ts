import { resumirDados, resumoEmLinhas } from "./resumo";

export type Coluna = { titulo: string; chave: string };

export type DadosPlanilha = {
  nomeArquivo: string;
  titulo: string;
  colunas: Coluna[];
  linhas: Record<string, string | number>[];
  informacoes: { rotulo: string; valor: string }[];
};

/**
 * Monta o .xlsx no navegador e dispara o download.
 * A biblioteca é carregada sob demanda para não pesar o primeiro carregamento.
 */
export async function baixarPlanilha(dados: DadosPlanilha) {
  const XLSX = await import("xlsx");

  const cabecalho = dados.colunas.map((c) => c.titulo);
  const corpo = dados.linhas.map((linha) => dados.colunas.map((c) => linha[c.chave] ?? ""));
  const aba = XLSX.utils.aoa_to_sheet([cabecalho, ...corpo]);

  aba["!cols"] = dados.colunas.map((c) => ({
    wch: Math.min(Math.max(c.titulo.length + 4, 12), 40),
  }));
  aba["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: dados.colunas.length - 1, r: dados.linhas.length },
    }),
  };
  aba["!freeze"] = { xSplit: 0, ySplit: 1 };

  const info = XLSX.utils.aoa_to_sheet([
    ["Informações da consulta"],
    ...dados.informacoes.map((i) => [i.rotulo, i.valor]),
  ]);
  info["!cols"] = [{ wch: 26 }, { wch: 90 }];

  const arquivo = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(arquivo, aba, "Dados");
  // resumo automático (totais, por mês, por categoria) quando os dados permitem
  const resumo = resumirDados(dados.colunas, dados.linhas);
  if (resumo) {
    const abaResumo = XLSX.utils.aoa_to_sheet(resumoEmLinhas(resumo));
    abaResumo["!cols"] = [{ wch: 34 }, { wch: 22 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(arquivo, abaResumo, "Resumo");
  }
  XLSX.utils.book_append_sheet(arquivo, info, "Informações");
  XLSX.writeFile(arquivo, dados.nomeArquivo);
}
