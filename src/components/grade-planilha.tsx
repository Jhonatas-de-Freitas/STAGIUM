import type { CSSProperties } from "react";

/** Letra da coluna como no Excel: A, B, …, Z, AA, AB… */
export function letraDaColuna(indice: number): string {
  let letra = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  }
  return letra;
}

/** Inteiros como vêm; decimais com ao menos duas casas (1.234,50), como valores em reais. */
const numeroBr = (n: number) =>
  Number.isInteger(n)
    ? n.toLocaleString("pt-BR")
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/**
 * Pedaço de planilha: letras das colunas, números das linhas e a linha de títulos.
 * Sem linhas de dados, mostra uma linha vazia (é a proposta, antes de consultar).
 */
export function Grade({
  descricao,
  titulos,
  chaves = [],
  linhas = [],
}: {
  descricao: string;
  titulos: string[];
  chaves?: string[];
  linhas?: Record<string, string | number>[];
}) {
  return (
    <div className="grade-rolagem">
      <table className={linhas.length > 0 ? "grade grade-preenche" : "grade"}>
        <caption className="sr-only">{descricao}</caption>
        <thead>
          <tr>
            <th className="grade-linha" aria-hidden />
            {titulos.map((_, c) => (
              <th key={c} className="grade-letra" aria-hidden>
                {letraDaColuna(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="grade-linha mono">1</th>
            {titulos.map((t) => (
              <th key={t} scope="col" className="grade-titulo">
                {t}
              </th>
            ))}
          </tr>
          {linhas.length === 0 ? (
            <tr>
              <th className="grade-linha mono">2</th>
              {titulos.map((t) => (
                <td key={t} className="grade-vazia" />
              ))}
            </tr>
          ) : (
            linhas.map((linha, l) => (
              <tr key={l} style={{ "--i": l } as CSSProperties}>
                <th className="grade-linha mono">{l + 2}</th>
                {chaves.map((k) => {
                  const valor = linha[k];
                  return (
                    <td
                      key={k}
                      title={valor === undefined ? "" : String(valor)}
                      className={typeof valor === "number" ? "mono grade-numero" : "mono"}
                    >
                      {typeof valor === "number" ? numeroBr(valor) : (valor ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
