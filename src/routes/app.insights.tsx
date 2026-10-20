import { Link, createFileRoute } from "@tanstack/react-router";
import { BellRing, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Aviso, Cabecalho } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { CartaoInsight } from "@/components/painel/insight-cartao";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIODOS_PADRAO, formatarValor } from "@/lib/saas/consulta";
import { avaliarAlerta, criarAlerta, listarAlertas, removerAlerta, salvarAlerta } from "@/lib/saas/conteudo";
import { medidaPrincipal } from "@/lib/saas/dados";
import { podeFazer } from "@/lib/saas/direitos";
import { gerarInsights, gerarTodosInsights, type Severidade } from "@/lib/saas/insights";
import type { Alerta, PlanoDeConsulta } from "@/lib/saas/tipos";

export const Route = createFileRoute("/app/insights")({
  head: () => ({ meta: [{ title: "Insights — Stagium" }] }),
  component: Insights,
});

const FILTROS: [Severidade | "todos", string][] = [["todos", "Todos"], ["risco", "Riscos"], ["atencao", "Atenção"], ["oportunidade", "Oportunidades"], ["info", "Para saber"]];

function Insights() {
  const s = useSessao();
  const [filtro, setFiltro] = useState<Severidade | "todos">("todos");
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [novo, setNovo] = useState(false);
  const nivel = s.direitos?.insights ?? "basico";
  const lista = useMemo(() => gerarTodosInsights(s.datasets, nivel), [s.datasets, nivel]);
  const totalCompleto = useMemo(() => s.datasets.flatMap((d) => gerarInsights(d)).length, [s.datasets]);
  const visiveis = lista.filter((i) => filtro === "todos" || i.severidade === filtro);

  const carregar = useCallback(async () => { if (s.empresa) setAlertas(await listarAlertas(s.empresa.id)); }, [s.empresa]);
  useEffect(() => { void carregar(); }, [carregar]);
  const estados = useMemo(() => alertas.map((a) => avaliarAlerta(a, s.datasets)), [alertas, s.datasets]);

  if (!s.empresa || !s.usuario || !s.direitos) return null;
  const podeAlertas = podeFazer(s.usuario.papel, "criarDashboards");

  return (
    <>
      <Cabecalho titulo="Insights" texto="Leituras prontas dos seus dados: o que mudou, onde há risco e onde há oportunidade. Atualizadas toda vez que você abre a página." />

      {nivel === "basico" && totalCompleto > lista.length && (
        <div className="mb-6"><Aviso>O seu plano mostra os insights básicos. Há mais {totalCompleto - lista.length} leituras nos seus dados (maiores devedores, clientes que sumiram, vencimentos da semana...). <Link to="/app/plano" className="font-medium underline">Ver planos</Link></Aviso></div>
      )}

      {s.datasets.length === 0 ? (
        <Aviso>Sem dados ainda. Coloque dados no painel (Início) para ver os insights.</Aviso>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
            {FILTROS.map(([v, r]) => (
              <button key={v} type="button" onClick={() => setFiltro(v)} aria-pressed={filtro === v} className={`rounded-full border px-3 py-1 text-sm ${filtro === v ? "bg-foreground text-background" : "bg-card hover:bg-secondary"}`}>{r}</button>
            ))}
          </div>
          {visiveis.length ? <div className="grid gap-3">{visiveis.map((i) => <CartaoInsight key={i.id} insight={i} />)}</div> : <p className="text-sm text-muted-foreground">Nada nesta categoria agora.</p>}
        </>
      )}

      <section className="mt-14" aria-label="Alertas">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="titulo-passo">Alertas</h2>
            <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">Defina um número de atenção ("vencidos acima de R$ 50 mil") e o painel avisa quando ele for passado. O aviso por e-mail chega quando o servidor estiver ligado; por enquanto ele aparece aqui.</p>
          </div>
          {podeAlertas && s.datasets.length > 0 && <Button variant="outline" className="bg-card" onClick={() => setNovo(true)}><Plus className="mr-2 size-4" />Novo alerta</Button>}
        </div>
        {s.direitos.alertas === 0 ? (
          <Aviso>Alertas fazem parte do plano Profissional. <Link to="/app/plano" className="font-medium underline">Ver planos</Link></Aviso>
        ) : estados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alerta criado. Você pode ter até {s.direitos.alertas}.</p>
        ) : (
          <ul className="grid gap-2">
            {estados.map(({ alerta: a, valor, disparado }) => {
              const ds = s.datasets.find((d) => d.id === a.plano.datasetId);
              const tipo = ds?.colunas.find((c) => c.chave === a.plano.medidas?.[0]?.coluna)?.tipo ?? "numero";
              return (
                <li key={a.id} className="folha folha-secao flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <BellRing className="mt-0.5 size-5 shrink-0" style={{ color: disparado ? "var(--ruim)" : "var(--muted-foreground)" }} aria-hidden />
                    <div>
                      <p className="font-medium">{a.nome}</p>
                      <p className="text-sm text-muted-foreground">Avisar quando for {a.condicao === ">" || a.condicao === ">=" ? "maior" : "menor"} que {formatarValor(a.limite, tipo)}. Agora: <strong className="numero-grande text-foreground">{valor === null ? "—" : formatarValor(valor, tipo)}</strong></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm px-2 py-0.5 text-xs font-semibold" style={disparado ? { background: "color-mix(in oklab, var(--ruim) 15%, transparent)", color: "var(--ruim)" } : { background: "var(--secondary)" }}>{!a.ativo ? "Desligado" : disparado ? "Disparado" : "Tudo certo"}</span>
                    {podeAlertas && <>
                      <Button variant="ghost" size="sm" onClick={async () => { await salvarAlerta(s.empresa!, { ...a, ativo: !a.ativo }); await carregar(); }}>{a.ativo ? "Desligar" : "Ligar"}</Button>
                      <Button variant="ghost" size="icon" aria-label={`Apagar ${a.nome}`} onClick={async () => { await removerAlerta(s.empresa!, a.id); await carregar(); }}><Trash2 className="size-4" /></Button>
                    </>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {novo && <NovoAlerta aoFechar={() => setNovo(false)} aoCriar={async () => { setNovo(false); await carregar(); }} />}
    </>
  );
}

function NovoAlerta({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: () => void }) {
  const s = useSessao();
  const [dsId, setDsId] = useState(s.datasets[0]!.id);
  const ds = s.datasets.find((d) => d.id === dsId)!;
  const medida = medidaPrincipal(ds);
  const situ = ds.colunas.find((c) => /situa|status/i.test(c.titulo));
  const valoresSitu = useMemo(() => (situ ? [...new Set(ds.linhas.slice(0, 5000).map((l) => String(l[situ.chave] ?? "")))].filter(Boolean) : []), [ds, situ]);
  const data = ds.colunas.find((c) => c.tipo === "data");
  const [f, setF] = useState({ nome: "", agregacao: "soma", situ: "", periodo: "", cond: ">" as Alerta["condicao"], limite: "" });

  async function criar() {
    if (!s.empresa || !s.usuario) return;
    const plano: PlanoDeConsulta = {
      datasetId: ds.id,
      modo: "agregado",
      ...(f.situ && situ ? { filtros: [{ coluna: situ.chave, op: "=" as const, valor: f.situ }] } : {}),
      ...(f.periodo && data ? { periodo: { coluna: data.chave, expressao: f.periodo } } : {}),
      medidas: [f.agregacao === "contagem" || !medida ? { agregacao: "contagem" as const } : { coluna: medida.chave, agregacao: "soma" as const }],
    };
    try {
      await criarAlerta(s.usuario, s.empresa, { nome: f.nome || "Novo alerta", plano, condicao: f.cond, limite: Number(f.limite.replace(",", ".")), ativo: true });
      toast.success("Alerta criado.");
      aoCriar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar.");
    }
  }
  return (
    <Dialog open onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo alerta</DialogTitle><DialogDescription>Escolha o número a vigiar e o limite.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label className="mb-1 block text-sm">Nome</Label><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Vencidos acima de 50 mil" /></div>
          <div><Label className="mb-1 block text-sm">Base de dados</Label>
            <Select value={dsId} onValueChange={(v) => { setDsId(v); setF((x) => ({ ...x, situ: "", periodo: "" })); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{s.datasets.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="mb-1 block text-sm">Vigiar</Label>
              <Select value={f.agregacao} onValueChange={(v) => setF({ ...f, agregacao: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="soma">{medida ? `Soma de ${medida.titulo}` : "Soma"}</SelectItem><SelectItem value="contagem">Quantidade de registros</SelectItem></SelectContent></Select></div>
            {situ && <div><Label className="mb-1 block text-sm">Só com {situ.titulo.toLowerCase()}</Label>
              <Select value={f.situ || "todas"} onValueChange={(v) => setF({ ...f, situ: v === "todas" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Qualquer</SelectItem>{valoresSitu.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>}
            {data && <div><Label className="mb-1 block text-sm">Período ({data.titulo.toLowerCase()})</Label>
              <Select value={f.periodo || "todo"} onValueChange={(v) => setF({ ...f, periodo: v === "todo" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todo">Todo o histórico</SelectItem>{PERIODOS_PADRAO.map((p) => <SelectItem key={p} value={p}>{p[0]!.toUpperCase() + p.slice(1)}</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="mb-1 block text-sm">Avisar quando for</Label>
              <Select value={f.cond} onValueChange={(v) => setF({ ...f, cond: v as Alerta["condicao"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value=">">Maior que</SelectItem><SelectItem value="<">Menor que</SelectItem></SelectContent></Select></div>
            <div><Label className="mb-1 block text-sm">Limite</Label><Input inputMode="decimal" value={f.limite} onChange={(e) => setF({ ...f, limite: e.target.value })} placeholder="50000" /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={aoFechar}>Cancelar</Button><Button onClick={criar} disabled={!f.limite || Number.isNaN(Number(f.limite.replace(",", ".")))}>Criar alerta</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
