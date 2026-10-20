import { ArrowDown, ArrowUp, Minus, Table2, BarChart3, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  comPeriodo,
  executarPlano,
  formatarCompacto,
  formatarValor,
  periodoAnterior,
  resolverPeriodo,
  validarPlano,
} from "@/lib/saas/consulta";
import type { ColunaDados, Dataset, ResultadoConsulta, TipoColuna, TipoVisual, Widget } from "@/lib/saas/tipos";

export function useMontado() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

const cor = (i: number) => `var(--serie-${(i % 8) + 1})`;
const tinta = { fill: "var(--muted-foreground)", fontSize: 11 };

type Series = {
  categorias: string[];
  series: { chave: string; nome: string; tipo: TipoColuna }[];
  dados: Record<string, string | number>[];
};

const MAX_SERIES = 6;

/** Transforma o resultado em formato de gráfico: categorias no eixo e uma ou mais séries. */
export function paraSeries(r: ResultadoConsulta): Series {
  const medidas = r.colunas.filter((c) => /^m\d+$/.test(c.chave));
  const grupos = r.colunas.filter((c) => !/^m\d+$/.test(c.chave));
  if (grupos.length === 0) {
    return { categorias: [], series: medidas.map((m) => ({ chave: m.chave, nome: m.titulo, tipo: m.tipo })), dados: [] };
  }
  const g1 = grupos[0]!;
  if (grupos.length >= 2 && medidas[0]) {
    const g2 = grupos[1]!;
    const m = medidas[0];
    const totais = new Map<string, number>();
    for (const l of r.linhas) totais.set(String(l[g2.chave]), (totais.get(String(l[g2.chave])) ?? 0) + Number(l[m.chave] ?? 0));
    const top = [...totais.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const mantidas = top.slice(0, MAX_SERIES);
    const temOutros = top.length > MAX_SERIES;
    const categorias: string[] = [];
    const mapa = new Map<string, Record<string, string | number>>();
    for (const l of r.linhas) {
      const c = String(l[g1.chave]);
      if (!mapa.has(c)) {
        mapa.set(c, { nome: c });
        categorias.push(c);
      }
      const serie = mantidas.includes(String(l[g2.chave])) ? String(l[g2.chave]) : "Outros";
      const alvo = mapa.get(c)!;
      alvo[serie] = Number(alvo[serie] ?? 0) + Number(l[m.chave] ?? 0);
    }
    const nomes = [...mantidas, ...(temOutros ? ["Outros"] : [])];
    return { categorias, series: nomes.map((n) => ({ chave: n, nome: n, tipo: m.tipo })), dados: categorias.map((c) => ({ nome: c, ...Object.fromEntries(nomes.map((n) => [n, mapa.get(c)![n] ?? 0])) })) };
  }
  return {
    categorias: r.linhas.map((l) => String(l[g1.chave])),
    series: medidas.map((m) => ({ chave: m.chave, nome: m.titulo, tipo: m.tipo })),
    dados: r.linhas.map((l) => ({ nome: String(l[g1.chave]), ...Object.fromEntries(medidas.map((m) => [m.chave, Number(l[m.chave] ?? 0)])) })),
  };
}

function Dica({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string; payload?: { nome?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-sm">
      {(label ?? payload[0]?.payload?.nome) && <p className="mb-1 font-semibold">{label ?? payload[0]?.payload?.nome}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="numero-grande ml-auto pl-3 font-semibold">{(p as { value?: number; payload?: { __tipo?: TipoColuna } }).value?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
        </p>
      ))}
    </div>
  );
}

function CortaTexto({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const t = String(payload?.value ?? "");
  return (
    <text x={x} y={y} dy={4} textAnchor="end" style={tinta}>
      {t.length > 20 ? `${t.slice(0, 19)}…` : t}
    </text>
  );
}

export function GraficoDeResultado({ resultado, visual, altura = 260 }: { resultado: ResultadoConsulta; visual: TipoVisual; altura?: number }) {
  const montado = useMontado();
  const s = useMemo(() => paraSeries(resultado), [resultado]);
  if (!montado) return <div style={{ height: altura }} aria-hidden />;
  if (!s.dados.length) return <p className="py-10 text-center text-sm text-muted-foreground">Sem dados para este gráfico.</p>;
  const tipo = s.series[0]?.tipo ?? "numero";
  const eixo = (v: number) => formatarCompacto(v, tipo);
  const varias = s.series.length >= 2;
  const comum = { data: s.dados, margin: { top: 8, right: 12, bottom: 0, left: 0 } };
  const grade = <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />;
  const empilhar = varias ? { stackId: "a", stroke: "var(--card)", strokeWidth: 2 } : {};
  const legenda = varias ? <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} /> : null;

  let corpo: ReactNode;
  if (visual === "pizza") {
    const base = s.dados.slice(0, 7).map((d) => ({ nome: String(d["nome"]), valor: Number(d[s.series[0]!.chave] ?? 0) }));
    const resto = s.dados.slice(7).reduce((a, d) => a + Number(d[s.series[0]!.chave] ?? 0), 0);
    const dados = resto > 0 ? [...base, { nome: "Outros", valor: resto }] : base;
    corpo = (
      <PieChart>
        <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius="52%" outerRadius="82%" stroke="var(--card)" strokeWidth={2} paddingAngle={0}>
          {dados.map((_, i) => (
            <Cell key={i} fill={cor(i)} />
          ))}
        </Pie>
        <Tooltip content={<Dica />} />
        <Legend iconType="square" layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    );
  } else if (visual === "barras_h") {
    corpo = (
      <BarChart {...comum} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={eixo} tick={tinta} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="nome" width={140} tick={<CortaTexto />} axisLine={false} tickLine={false} interval={0} />
        <Tooltip content={<Dica />} cursor={{ fill: "var(--secondary)" }} />
        {legenda}
        {s.series.map((x, i) => (
          <Bar key={x.chave} dataKey={x.chave} name={x.nome} fill={cor(i)} radius={[0, 4, 4, 0]} maxBarSize={22} {...empilhar} />
        ))}
      </BarChart>
    );
  } else if (visual === "barras") {
    corpo = (
      <BarChart {...comum}>
        {grade}
        <XAxis dataKey="nome" tick={tinta} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={eixo} tick={tinta} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<Dica />} cursor={{ fill: "var(--secondary)" }} />
        {legenda}
        {s.series.map((x, i) => (
          <Bar key={x.chave} dataKey={x.chave} name={x.nome} fill={cor(i)} radius={[4, 4, 0, 0]} maxBarSize={32} {...empilhar} />
        ))}
      </BarChart>
    );
  } else if (visual === "area" && !varias) {
    corpo = (
      <AreaChart {...comum}>
        {grade}
        <XAxis dataKey="nome" tick={tinta} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={eixo} tick={tinta} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<Dica />} />
        <Area type="monotone" dataKey={s.series[0]!.chave} name={s.series[0]!.nome} stroke={cor(0)} strokeWidth={2} fill={cor(0)} fillOpacity={0.14} dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} />
      </AreaChart>
    );
  } else {
    corpo = (
      <LineChart {...comum}>
        {grade}
        <XAxis dataKey="nome" tick={tinta} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={eixo} tick={tinta} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<Dica />} />
        {legenda}
        {s.series.map((x, i) => (
          <Line key={x.chave} type="monotone" dataKey={x.chave} name={x.nome} stroke={cor(i)} strokeWidth={2} dot={s.dados.length <= 18 ? { r: 3, stroke: "var(--card)", strokeWidth: 2 } : false} activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }} />
        ))}
      </LineChart>
    );
  }
  return (
    <div role="img" aria-label={`Gráfico com ${s.dados.length} pontos. Use o botão Tabela para ver os números.`} style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        {corpo as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export function TabelaDeResultado({ resultado, max = 100 }: { resultado: ResultadoConsulta; max?: number }) {
  const colunas = resultado.colunas;
  const linhas = resultado.linhas.slice(0, max);
  if (!linhas.length) return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum registro.</p>;
  const numero = (c: ColunaDados) => c.tipo === "numero" || c.tipo === "moeda" || c.tipo === "percentual";
  return (
    <div className="grade-rolagem max-h-96 overflow-y-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-[var(--grade-cabecalho)]">
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} className={`whitespace-nowrap border-b px-3 py-2 font-semibold ${numero(c) ? "text-right" : "text-left"}`}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b last:border-0">
              {colunas.map((c) => (
                <td key={c.chave} className={`whitespace-nowrap px-3 py-1.5 ${numero(c) ? "numero-grande text-right" : ""}`}>
                  {formatarValor(l[c.chave], c.tipo)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {resultado.linhas.length > max && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Mostrando {max} de {resultado.linhas.length.toLocaleString("pt-BR")}. A planilha baixada tem todas.
        </p>
      )}
    </div>
  );
}

function Kpi({ r, widget, anterior }: { r: ResultadoConsulta; widget: Widget; anterior: ResultadoConsulta | null }) {
  const c = r.colunas.find((x) => /^m\d+$/.test(x.chave));
  if (!c) return null;
  const v = Number(r.linhas[0]?.[c.chave] ?? 0);
  let delta: ReactNode = null;
  if (anterior) {
    const a = Number(anterior.linhas[0]?.[c.chave] ?? 0);
    if (a === 0 && v === 0) delta = null;
    else if (a === 0) delta = <span className="text-muted-foreground">sem base no período anterior</span>;
    else {
      const p = ((v - a) / Math.abs(a)) * 100;
      const Icone = Math.abs(p) < 0.5 ? Minus : p > 0 ? ArrowUp : ArrowDown;
      delta = (
        <span className="inline-flex items-center gap-1">
          <Icone className="size-3.5" aria-hidden />
          <span className="font-semibold">{p > 0 ? "+" : ""}{p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
          <span className="text-muted-foreground">vs. {periodoTexto(widget)} anterior ({formatarCompacto(a, c.tipo)})</span>
        </span>
      );
    }
  }
  return (
    <div className="py-1">
      <p className="numero-grande text-4xl font-semibold leading-none" title={formatarValor(v, c.tipo)}>
        {c.tipo === "moeda" || Math.abs(v) >= 1e5 ? formatarCompacto(v, c.tipo) : formatarValor(v, c.tipo)}
      </p>
      <p className="mt-2 text-xs">{delta}</p>
      {r.descricaoPeriodo && <p className="dica mt-1">{r.descricaoPeriodo}</p>}
    </div>
  );
}
const periodoTexto = (w: Widget) => (w.plano.periodo ? "período" : "período");

export type OpcoesWidget = {
  widget: Widget;
  datasets: Dataset[];
  /** Período escolhido no topo do dashboard ("padrao" mantém o de cada gráfico). */
  periodo?: string;
  onRemover?: () => void;
  acoes?: ReactNode;
};

export function WidgetView({ widget, datasets, periodo, onRemover, acoes }: OpcoesWidget) {
  const [tabela, setTabela] = useState(false);
  const ds = datasets.find((d) => d.id === widget.plano.datasetId);
  const calculo = useMemo(() => {
    if (!ds) return { erro: "A base de dados deste gráfico não está mais disponível." } as const;
    const plano = comPeriodo(widget.plano, periodo ?? null);
    const erros = validarPlano(ds, plano);
    if (erros.length) return { erro: erros[0]! } as const;
    const intervalo = resolverPeriodo(plano);
    const resultado = executarPlano(ds, plano, { intervalo });
    const anterior = widget.comparar && intervalo ? executarPlano(ds, plano, { intervalo: periodoAnterior(intervalo) }) : null;
    return { resultado, anterior } as const;
  }, [ds, widget, periodo]);

  const larg = widget.largura === 3 ? "lg:col-span-3" : widget.largura === 2 ? "lg:col-span-2" : "";
  return (
    <section className={`folha ${larg} flex flex-col`} aria-label={widget.titulo}>
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{widget.titulo}</h3>
        <div className="flex shrink-0 items-center gap-1">
          {acoes}
          {widget.visual !== "kpi" && widget.visual !== "tabela" && (
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setTabela((t) => !t)} aria-pressed={tabela} aria-label={tabela ? "Ver gráfico" : "Ver como tabela"} title={tabela ? "Ver gráfico" : "Ver como tabela"}>
              {tabela ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
            </Button>
          )}
          {onRemover && (
            <Button variant="ghost" size="icon" className="size-7" onClick={onRemover} aria-label={`Remover ${widget.titulo}`} title="Remover do dashboard">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </header>
      <div className="flex-1 p-4">
        {"erro" in calculo ? (
          <p className="text-sm text-muted-foreground">{calculo.erro}</p>
        ) : widget.visual === "kpi" ? (
          <Kpi r={calculo.resultado} widget={widget} anterior={calculo.anterior} />
        ) : widget.visual === "tabela" || tabela ? (
          <TabelaDeResultado resultado={calculo.resultado} max={widget.plano.limite ?? 50} />
        ) : (
          <GraficoDeResultado resultado={calculo.resultado} visual={widget.visual} altura={widget.largura === 1 ? 230 : 260} />
        )}
      </div>
    </section>
  );
}
