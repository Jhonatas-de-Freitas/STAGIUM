/** Barra de uso de um limite do plano (ex.: 120 de 300 consultas). */
export function Medidor({ rotulo, usado, limite, sufixo = "" }: { rotulo: string; usado: number; limite: number | null; sufixo?: string }) {
  const pct = limite ? Math.min(100, (usado / limite) * 100) : 0;
  const alto = limite !== null && pct >= 90;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{rotulo}</span>
        <span className="numero-grande text-xs text-muted-foreground">
          {usado.toLocaleString("pt-BR")}
          {limite === null ? " · sem limite" : ` de ${limite.toLocaleString("pt-BR")}`}
          {sufixo}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={usado} aria-valuemax={limite ?? undefined} aria-label={rotulo}>
        <div className="h-full rounded-full" style={{ width: limite === null ? "6%" : `${Math.max(pct, usado > 0 ? 3 : 0)}%`, background: alto ? "var(--ruim)" : "var(--foreground)", opacity: limite === null ? 0.25 : 1 }} />
      </div>
      {alto && <p className="mt-1 text-xs" style={{ color: "var(--ruim)" }}>Perto do limite do plano.</p>}
    </div>
  );
}
