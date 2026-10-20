import { Link } from "@tanstack/react-router";
import { Check, Clock } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { linkWhatsApp } from "@/lib/contato";
import {
  MESES_PAGOS_NO_ANUAL,
  PLANOS,
  SISTEMA_SOB_MEDIDA,
  TESTE_GRATIS,
  formatarReais,
  type Plano,
} from "@/lib/planos";

function Preco({ plano, anual }: { plano: Plano; anual: boolean }) {
  if (plano.mensal === null) {
    return <p className="titulo-secao text-3xl">Sob consulta</p>;
  }
  const mensal = anual ? (plano.mensal * MESES_PAGOS_NO_ANUAL) / 12 : plano.mensal;
  return (
    <div>
      <p className="titulo-secao text-4xl">
        {formatarReais(Math.round(mensal))}
        <span className="ml-1 text-base text-muted-foreground">/mês</span>
      </p>
      <p className="dica mt-1">
        {anual
          ? `${formatarReais(plano.mensal * MESES_PAGOS_NO_ANUAL)} por ano, à vista`
          : "cobrado mês a mês, sem fidelidade"}
      </p>
    </div>
  );
}

function Chamada({ plano }: { plano: Plano }) {
  const whatsapp = linkWhatsApp();
  if (plano.mensal === null && whatsapp) {
    return (
      <Button asChild variant="outline" className="w-full bg-card">
        <a href={whatsapp} target="_blank" rel="noreferrer">
          {plano.chamada}
        </a>
      </Button>
    );
  }
  return (
    <Button
      asChild
      variant={plano.destaque ? "default" : "outline"}
      className={plano.destaque ? "w-full" : "w-full bg-card"}
    >
      <Link to="/chat">{plano.mensal === null ? "Testar agora" : plano.chamada}</Link>
    </Button>
  );
}

/** Cartões de planos com a troca mensal/anual. Usado na landing e em /planos. */
export function TabelaDePlanos() {
  const [anual, setAnual] = useState(false);
  return (
    <div className="mt-10">
      <div
        className="inline-flex rounded-md border bg-card p-1 text-sm"
        role="radiogroup"
        aria-label="Forma de pagamento"
      >
        {[
          { valor: false, rotulo: "Mensal" },
          { valor: true, rotulo: "Anual · 2 meses grátis" },
        ].map((o) => (
          <button
            key={o.rotulo}
            type="button"
            role="radio"
            aria-checked={anual === o.valor}
            onClick={() => setAnual(o.valor)}
            className={`rounded px-3 py-1.5 ${anual === o.valor ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {PLANOS.map((p) => (
          <article
            key={p.id}
            className={`folha flex flex-col ${p.destaque ? "ring-2 ring-[var(--marca)]" : ""}`}
          >
            <div className="folha-secao">
              <div className="flex items-center justify-between gap-2">
                <h3 className="titulo-bloco text-2xl">{p.nome}</h3>
                {p.destaque && (
                  <span className="rounded-sm bg-marca px-2 py-0.5 text-xs font-semibold">
                    Mais escolhido
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.resumo}</p>
              <div className="mt-5">
                <Preco plano={p} anual={anual} />
              </div>
            </div>
            <div className="folha-secao flex flex-1 flex-col">
              <ul className="space-y-2 text-sm">
                {p.itens.map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {i}
                  </li>
                ))}
                {(p.emBreve ?? []).map((i) => (
                  <li key={i} className="flex gap-2 text-muted-foreground">
                    <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      {i} <span className="text-xs">(em breve)</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                <Chamada plano={p} />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <p>
          <span className="font-semibold text-foreground">Teste grátis.</span> {TESTE_GRATIS.texto}
        </p>
        <p>
          <span className="font-semibold text-foreground">Sistema sob medida.</span>{" "}
          {SISTEMA_SOB_MEDIDA.texto} {formatarReais(SISTEMA_SOB_MEDIDA.aPartirDe)}.
        </p>
      </div>
    </div>
  );
}
