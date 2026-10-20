import { Link } from "@tanstack/react-router";
import { AlertOctagon, AlertTriangle, Info, TrendingUp } from "lucide-react";

import type { Insight, Severidade } from "@/lib/saas/insights";

const VISUAL: Record<Severidade, { rotulo: string; Icone: typeof Info; cor: string }> = {
  risco: { rotulo: "Risco", Icone: AlertOctagon, cor: "var(--ruim)" },
  atencao: { rotulo: "Atenção", Icone: AlertTriangle, cor: "var(--atencao)" },
  oportunidade: { rotulo: "Oportunidade", Icone: TrendingUp, cor: "var(--bom)" },
  info: { rotulo: "Para saber", Icone: Info, cor: "var(--muted-foreground)" },
};

export function CartaoInsight({ insight, comChat = true }: { insight: Insight; comChat?: boolean }) {
  const v = VISUAL[insight.severidade];
  return (
    <article className="folha flex flex-col">
      <div className="flex items-start gap-3 p-4">
        <v.Icone className="mt-0.5 size-5 shrink-0" style={{ color: v.cor }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold" style={{ color: v.cor }}>{v.rotulo} · {insight.datasetNome}</p>
          <h3 className="mt-0.5 text-base font-semibold leading-snug">{insight.titulo}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{insight.texto}</p>
          {comChat && insight.pergunta && (
            <Link to="/app/chat" search={{ q: insight.pergunta }} className="mt-3 inline-block text-sm font-medium underline">
              Perguntar mais ao chat
            </Link>
          )}
        </div>
        {insight.destaque && <p className="numero-grande hidden shrink-0 text-xl font-semibold sm:block">{insight.destaque}</p>}
      </div>
    </article>
  );
}
