import { Link, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Menu, LogOut } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { planoPorId } from "@/lib/planos";
import { diasRestantes, ROTULO_PAPEL } from "@/lib/saas/direitos";
import { personificar } from "@/lib/saas/servico";

import { useSessao } from "./contexto";

export type ItemDeMenu = {
  to: string;
  rotulo: string;
  icone: ComponentType<{ className?: string }>;
  exato?: boolean;
};

function Menu_({ itens, aoClicar }: { itens: ItemDeMenu[]; aoClicar?: () => void }) {
  return (
    <nav className="painel-nav flex flex-col gap-0.5" aria-label="Menu principal">
      {itens.map((i) => (
        <Link key={i.to} to={i.to} activeOptions={{ exact: !!i.exato }} onClick={aoClicar}>
          <i.icone className="size-4 shrink-0" />
          {i.rotulo}
        </Link>
      ))}
    </nav>
  );
}

function Faixas() {
  const s = useSessao();
  if (s.personificando && s.empresa) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--marca)] px-4 py-2 text-sm text-black">
        <span>
          Você está vendo o painel de <strong>{s.empresa.nome}</strong> como equipe Stagium. Tudo o que fizer fica
          registrado.
        </span>
        <Button
          size="sm"
          variant="outline"
          className="border-black/40 bg-transparent"
          onClick={async () => {
            await personificar(null);
            await s.recarregar();
            window.location.assign("/admin");
          }}
        >
          Voltar ao admin
        </Button>
      </div>
    );
  }
  if (s.empresa?.status === "teste" && s.empresa.testeAte && s.acesso?.liberado) {
    const d = diasRestantes(s.empresa.testeAte) ?? 0;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary px-4 py-2 text-sm">
        <span>
          Teste grátis: <strong>{d <= 0 ? "último dia" : `${d} ${d === 1 ? "dia" : "dias"} restantes`}</strong>. Os
          limites do teste são menores que os do plano.
        </span>
        <Button asChild size="sm" variant="outline" className="bg-card">
          <Link to="/app/plano">Ver planos</Link>
        </Button>
      </div>
    );
  }
  return null;
}

/** Casca das áreas logadas: menu lateral, faixa de aviso e rodapé do usuário. */
export function Casca({
  itens,
  area,
  children,
}: {
  itens: ItemDeMenu[];
  area: "cliente" | "admin";
  children: ReactNode;
}) {
  const s = useSessao();
  const [aberto, setAberto] = useState(false);
  const caminho = useRouterState({ select: (r) => r.location.pathname });
  void caminho;

  const rodape = (
    <div className="mt-auto border-t pt-4 text-sm">
      <p className="truncate font-semibold" title={s.usuario?.nome}>{s.usuario?.nome}</p>
      <p className="truncate text-xs text-muted-foreground" title={s.usuario?.email}>{s.usuario?.email}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {ROTULO_PAPEL[s.usuario?.papel ?? ""] ?? ""}
        {area === "cliente" && s.empresa ? ` · ${s.empresa.nome}` : ""}
      </p>
      {area === "cliente" && s.empresa && (
        <p className="mt-1 text-xs text-muted-foreground">
          Plano {planoPorId(s.empresa.planoId).nome}
          {s.empresa.status === "teste" ? " (teste)" : s.empresa.cortesia ? " (cortesia)" : ""}
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 w-full justify-start px-2"
        onClick={async () => {
          await s.sair();
          window.location.assign("/entrar");
        }}
      >
        <LogOut className="mr-2 size-4" /> Sair
      </Button>
    </div>
  );

  const marca = (
    <Link to={area === "admin" ? "/admin" : "/app"} className="mb-6 block">
      <span className="marca-celula">Stagium</span>
      {area === "admin" && <span className="ml-3 text-xs text-muted-foreground">equipe</span>}
    </Link>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Faixas />
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card p-4 lg:flex">
          {marca}
          <Menu_ itens={itens} />
          {rodape}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
            <Link to={area === "admin" ? "/admin" : "/app"}>
              <span className="marca-celula !text-base">Stagium</span>
            </Link>
            <Sheet open={aberto} onOpenChange={setAberto}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col p-4">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                {marca}
                <Menu_ itens={itens} aoClicar={() => setAberto(false)} />
                {rodape}
              </SheetContent>
            </Sheet>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function Cabecalho({ titulo, texto, acoes }: { titulo: string; texto?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="titulo-secao">{titulo}</h1>
        {texto && <p className="mt-2 max-w-[62ch] text-muted-foreground">{texto}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Aviso({ tipo = "info", children }: { tipo?: "info" | "alerta"; children: ReactNode }) {
  return (
    <div
      role="status"
      className={`flex gap-3 rounded-md border p-3 text-sm ${tipo === "alerta" ? "border-[var(--atencao)] bg-[color-mix(in_oklab,var(--atencao)_12%,transparent)]" : "bg-secondary"}`}
    >
      {tipo === "alerta" && <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="folha p-10 text-center">
      <p className="titulo-passo">{titulo}</p>
      <p className="mx-auto mt-2 max-w-[52ch] text-sm text-muted-foreground">{texto}</p>
      {acao && <div className="mt-5 flex flex-wrap justify-center gap-2">{acao}</div>}
    </div>
  );
}
