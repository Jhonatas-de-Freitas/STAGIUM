import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Moldura das telas de entrar, cadastro e convite. */
export function PaginaDeAcesso({ titulo, texto, children, rodape }: { titulo: string; texto?: string; children?: ReactNode; rodape?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link to="/" className="marca-celula">
            Stagium
          </Link>
          <Link to="/planos" className="text-sm text-muted-foreground hover:text-foreground">
            Planos
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-14 sm:px-0">
        <h1 className="titulo-secao text-4xl">{titulo}</h1>
        {texto && <p className="mt-3 text-muted-foreground">{texto}</p>}
        <div className="mt-8">{children}</div>
        {rodape && <div className="mt-8 text-sm text-muted-foreground">{rodape}</div>}
        <p className="mt-10 border-t pt-4 text-xs text-muted-foreground">
          Modo de teste local: contas e dados ficam somente neste navegador. Ao conectar o banco de dados, eles passam a ficar no
          servidor, com separação por empresa.
        </p>
      </main>
    </div>
  );
}

export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string | undefined; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{rotulo}</span>
      {children}
      {dica && <span className="dica block">{dica}</span>}
    </label>
  );
}
