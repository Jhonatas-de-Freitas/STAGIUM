import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { letraDaColuna } from "@/components/grade-planilha";
import { Button } from "@/components/ui/button";

export type GrupoDeExemplos = { area: string; perguntas: string[] };

/**
 * "O que você pode pedir" da landing, como uma planilha: cada área é uma coluna, cada
 * pergunta é uma célula. Clicar seleciona a célula e a barra de fórmulas leva a pergunta
 * para a conversa. Em telas estreitas vira lista de links, que cabe melhor.
 */
export function PlanilhaDeExemplos({ grupos }: { grupos: GrupoDeExemplos[] }) {
  const [selecao, setSelecao] = useState({ coluna: 0, linha: 0 });
  const linhas = Math.max(...grupos.map((g) => g.perguntas.length));
  const pergunta = grupos[selecao.coluna]?.perguntas[selecao.linha] ?? "";
  // linha 1 da planilha é a dos títulos; as perguntas começam na 2
  const endereco = `${letraDaColuna(selecao.coluna)}${selecao.linha + 2}`;

  return (
    <>
      <div className="mt-10 hidden overflow-hidden rounded-md border bg-card md:block">
        <div className="flex items-center gap-3 border-b px-3 py-2.5">
          <span className="mono w-11 shrink-0 border-r pr-3 text-center text-xs text-muted-foreground">
            {endereco}
          </span>
          <span className="fx shrink-0 text-muted-foreground" aria-hidden>
            fx
          </span>
          <p className="min-w-0 flex-1 truncate text-[0.9375rem]" aria-live="polite">
            {pergunta}
          </p>
          <Button asChild size="sm">
            <Link to="/chat" search={{ pergunta }}>
              Pedir esta planilha
            </Link>
          </Button>
        </div>
        <table className="grade grade-texto grade-exemplos w-full table-fixed">
          <caption className="sr-only">
            Exemplos de perguntas por área. Escolha uma célula e use o botão Pedir esta planilha.
          </caption>
          <thead>
            <tr>
              <th className="grade-linha" aria-hidden />
              {grupos.map((g, c) => (
                <th key={g.area} className="grade-letra" aria-hidden>
                  {letraDaColuna(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="grade-linha mono" aria-hidden>
                1
              </th>
              {grupos.map((g) => (
                <th key={g.area} scope="col" className="grade-titulo">
                  {g.area}
                </th>
              ))}
            </tr>
            {Array.from({ length: linhas }, (_, l) => (
              <tr key={l}>
                <th className="grade-linha mono" aria-hidden>
                  {l + 2}
                </th>
                {grupos.map((g, c) => {
                  const texto = g.perguntas[l];
                  const marcada = selecao.coluna === c && selecao.linha === l;
                  return (
                    <td key={g.area} className="celula-exemplo">
                      {texto && (
                        <button
                          type="button"
                          aria-pressed={marcada}
                          onClick={() => setSelecao({ coluna: c, linha: l })}
                        >
                          {texto}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 md:hidden">
        {grupos.map((grupo) => (
          <div key={grupo.area}>
            <h3 className="text-sm font-semibold">{grupo.area}</h3>
            <ul className="mt-3 space-y-2">
              {grupo.perguntas.map((p) => (
                <li key={p}>
                  <Link
                    to="/chat"
                    search={{ pergunta: p }}
                    className="link-pergunta text-[0.9375rem]"
                  >
                    {p}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
