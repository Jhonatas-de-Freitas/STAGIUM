import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { pedirPlano } from "@/lib/saas/assistente-dados";
import { PERIODOS_PADRAO, validarPlano } from "@/lib/saas/consulta";
import { dataPrincipal, medidaPrincipal } from "@/lib/saas/dados";
import { ehErro, exemplosDePerguntas } from "@/lib/saas/interpretar";
import { novoId } from "@/lib/saas/senha";
import { sugerirWidgets } from "@/lib/saas/sugestoes";
import type { Agregacao, Dataset, Granularidade, PlanoDeConsulta, TipoVisual, Widget } from "@/lib/saas/tipos";

import { useSessao } from "./contexto";
import { WidgetView } from "./grafico";

const VISUAIS: [TipoVisual, string][] = [
  ["kpi", "Número"], ["barras", "Barras"], ["barras_h", "Ranking"], ["linha", "Linha"], ["area", "Área"], ["pizza", "Pizza"], ["tabela", "Tabela"],
];
const AGREGACOES: [Agregacao, string][] = [["soma", "Soma"], ["media", "Média"], ["contagem", "Quantidade"], ["maximo", "Maior"], ["minimo", "Menor"], ["distintos", "Valores distintos"]];
const GRANULARIDADES: [Granularidade, string][] = [["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"], ["ano", "Ano"]];

type Novo = Omit<Widget, "id">;

/** Janela para incluir gráficos no dashboard: sugeridos pela IA, pedido em texto ou montado à mão. */
export function ConstrutorDeGrafico({
  aberto,
  aoFechar,
  datasets,
  aoAdicionar,
  restante,
}: {
  aberto: boolean;
  aoFechar: () => void;
  datasets: Dataset[];
  aoAdicionar: (w: Novo[]) => void | Promise<void>;
  /** Quantos gráficos ainda cabem no dashboard (limite do plano). */
  restante: number | null;
}) {
  const s = useSessao();
  const [dsId, setDsId] = useState(datasets[0]?.id ?? "");
  const ds = datasets.find((d) => d.id === dsId) ?? datasets[0];
  const sugestoes = useMemo(() => (ds ? sugerirWidgets(ds) : []), [ds]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [verTodas, setVerTodas] = useState(false);

  /* pedir à IA */
  const [pedido, setPedido] = useState("");
  const [gerando, setGerando] = useState(false);
  const [gerado, setGerado] = useState<{ widget: Novo; entendi: string; aviso?: string; usouIa: boolean } | null>(null);
  const [erroPedido, setErroPedido] = useState("");

  /* à mão */
  const medida0 = ds ? medidaPrincipal(ds) : null;
  const data0 = ds ? dataPrincipal(ds) : null;
  const [mao, setMao] = useState({ titulo: "", visual: "barras" as TipoVisual, agregacao: "soma" as Agregacao, medida: "", grupo: "", gran: "mes" as Granularidade, periodo: "", colunaData: "", limite: "10" });
  const maoMedida = mao.medida || medida0?.chave || "";
  const maoData = mao.colunaData || data0?.chave || "";
  const planoMao: PlanoDeConsulta | null = ds
    ? {
        datasetId: ds.id,
        modo: mao.visual === "tabela" ? "lista" : "agregado",
        ...(mao.visual === "tabela"
          ? { colunas: ds.colunas.filter((c) => !c.sensivel).slice(0, 7).map((c) => c.chave), ordenarPor: maoData ? { campo: maoData, direcao: "desc" as const } : undefined, limite: Number(mao.limite) || 10 }
          : {
              medidas: [{ ...(mao.agregacao !== "contagem" ? { coluna: maoMedida } : {}), agregacao: mao.agregacao }],
              ...(mao.grupo ? { agruparPor: [{ coluna: mao.grupo, ...(ds.colunas.find((c) => c.chave === mao.grupo)?.tipo === "data" ? { granularidade: mao.gran } : {}) }] } : {}),
              ...(mao.grupo && ds.colunas.find((c) => c.chave === mao.grupo)?.tipo !== "data" ? { limite: Number(mao.limite) || 10, ordenarPor: { campo: "m0", direcao: "desc" as const } } : {}),
            }),
        ...(mao.periodo && maoData ? { periodo: { coluna: maoData, expressao: mao.periodo } } : {}),
      }
    : null;
  const erroMao = ds && planoMao ? validarPlano(ds, planoMao)[0] : "";

  function limiteOk(qtd: number) {
    if (restante !== null && qtd > restante) {
      toast.error(restante === 0 ? "Este dashboard já tem o máximo de gráficos do seu plano." : `Seu plano deixa incluir mais ${restante} gráfico(s) neste dashboard.`);
      return false;
    }
    return true;
  }

  async function adicionarMarcados() {
    const itens = sugestoes.filter((x) => marcados.has(x.id)).map((x) => x.widget);
    if (!itens.length || !limiteOk(itens.length)) return;
    await aoAdicionar(itens);
    setMarcados(new Set());
    aoFechar();
  }

  async function gerar() {
    if (!s.empresa || !s.usuario) return;
    setGerando(true);
    setErroPedido("");
    setGerado(null);
    try {
      const r = await pedirPlano(pedido, "grafico", datasets, s.empresa, s.usuario);
      if (ehErro(r.resultado)) setErroPedido(r.resultado.erro);
      else {
        const p = r.resultado;
        setGerado({ widget: { titulo: p.titulo, visual: p.visual, plano: p.plano, largura: p.visual === "kpi" || p.visual === "pizza" ? 1 : 2 }, entendi: p.entendi, ...(r.aviso ? { aviso: r.aviso } : {}), usouIa: r.usouIa });
      }
      await s.recarregar();
    } catch (e) {
      setErroPedido(e instanceof Error ? e.message : "Não foi possível gerar.");
    } finally {
      setGerando(false);
    }
  }

  if (!ds) return null;
  const mostradas = verTodas ? sugestoes : sugestoes.slice(0, 6);
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar gráficos</DialogTitle>
          <DialogDescription>Veja o que a IA sugere para os seus dados, peça em uma frase ou monte do seu jeito.</DialogDescription>
        </DialogHeader>
        {datasets.length > 1 && (
          <div className="max-w-xs">
            <Label className="mb-1 block text-sm">Base de dados</Label>
            <Select value={ds.id} onValueChange={(v) => { setDsId(v); setMarcados(new Set()); setGerado(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{datasets.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <Tabs defaultValue="sugeridos">
          <TabsList>
            <TabsTrigger value="sugeridos">Sugeridos</TabsTrigger>
            <TabsTrigger value="pedir">Pedir em uma frase</TabsTrigger>
            <TabsTrigger value="mao">Montar à mão</TabsTrigger>
          </TabsList>

          <TabsContent value="sugeridos" className="space-y-4">
            <p className="text-sm text-muted-foreground">Escolhidos pelo tipo de cada coluna da base "{ds.nome}". Marque os que quiser.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {mostradas.map((x) => (
                <div key={x.id} className="space-y-2">
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox className="mt-0.5" checked={marcados.has(x.id)} onCheckedChange={(v) => setMarcados((m) => { const n = new Set(m); if (v === true) n.add(x.id); else n.delete(x.id); return n; })} />
                    <span><strong>{x.titulo}</strong><br /><span className="text-muted-foreground">{x.porque}</span></span>
                  </label>
                  <WidgetView widget={{ ...x.widget, id: x.id, largura: 1 }} datasets={datasets} />
                </div>
              ))}
            </div>
            {sugestoes.length > 6 && <Button variant="ghost" size="sm" onClick={() => setVerTodas((v) => !v)}>{verTodas ? "Ver menos" : `Ver as outras ${sugestoes.length - 6} sugestões`}</Button>}
            <div className="sticky -bottom-6 -mb-6 flex items-center justify-between gap-3 border-t bg-background pb-6 pt-3">
              <span className="text-sm text-muted-foreground">{marcados.size} selecionado(s){restante !== null ? ` · cabem mais ${restante} neste dashboard` : ""}</span>
              <Button disabled={marcados.size === 0} onClick={adicionarMarcados}>Adicionar ao dashboard</Button>
            </div>
          </TabsContent>

          <TabsContent value="pedir" className="space-y-3">
            <Label htmlFor="pedido">O que você quer ver?</Label>
            <Textarea id="pedido" rows={2} value={pedido} maxLength={300} onChange={(e) => setPedido(e.target.value)} placeholder="Ex.: faturamento por vendedor neste mês" />
            <div className="flex flex-wrap gap-2">
              {exemplosDePerguntas([ds]).slice(0, 4).map((e) => <button key={e} type="button" onClick={() => setPedido(e)} className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-secondary">{e}</button>)}
            </div>
            <Button onClick={gerar} disabled={gerando || pedido.trim().length < 6}><Sparkles className="mr-2 size-4" />{gerando ? "Pensando..." : "Gerar gráfico"}</Button>
            <p className="dica">Cada pedido que usa a IA gasta 1 crédito do mês. A IA recebe só os nomes das colunas, nunca os seus dados.</p>
            {erroPedido && <p role="alert" className="text-sm text-destructive">{erroPedido}</p>}
            {gerado && (
              <div className="space-y-3">
                <p className="text-sm"><strong>Entendi assim:</strong> {gerado.entendi}</p>
                {gerado.aviso && <p className="text-xs text-muted-foreground">{gerado.aviso}</p>}
                <WidgetView widget={{ ...gerado.widget, id: "prev" }} datasets={datasets} />
                <Button onClick={async () => { if (limiteOk(1)) { await aoAdicionar([gerado.widget]); setGerado(null); aoFechar(); } }}>Adicionar ao dashboard</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mao" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label className="mb-1 block text-sm">Tipo de gráfico</Label>
                <Select value={mao.visual} onValueChange={(v) => setMao((m) => ({ ...m, visual: v as TipoVisual }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VISUAIS.map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}</SelectContent></Select></div>
              {mao.visual !== "tabela" && (<>
                <div><Label className="mb-1 block text-sm">O que calcular</Label>
                  <Select value={mao.agregacao} onValueChange={(v) => setMao((m) => ({ ...m, agregacao: v as Agregacao }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{AGREGACOES.map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}</SelectContent></Select></div>
                {mao.agregacao !== "contagem" && (
                  <div><Label className="mb-1 block text-sm">De qual coluna</Label>
                    <Select value={maoMedida} onValueChange={(v) => setMao((m) => ({ ...m, medida: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ds.colunas.filter((c) => !c.sensivel).map((c) => <SelectItem key={c.chave} value={c.chave}>{c.titulo}</SelectItem>)}</SelectContent></Select></div>)}
                <div><Label className="mb-1 block text-sm">Agrupar por</Label>
                  <Select value={mao.grupo || "nenhum"} onValueChange={(v) => setMao((m) => ({ ...m, grupo: v === "nenhum" ? "" : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nenhum">Nada (um número só)</SelectItem>{ds.colunas.filter((c) => !c.sensivel && (c.tipo === "texto" || c.tipo === "data")).map((c) => <SelectItem key={c.chave} value={c.chave}>{c.titulo}</SelectItem>)}</SelectContent></Select></div>
                {ds.colunas.find((c) => c.chave === mao.grupo)?.tipo === "data" && (
                  <div><Label className="mb-1 block text-sm">Por</Label>
                    <Select value={mao.gran} onValueChange={(v) => setMao((m) => ({ ...m, gran: v as Granularidade }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GRANULARIDADES.map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}</SelectContent></Select></div>)}
              </>)}
              <div><Label className="mb-1 block text-sm">Período</Label>
                <Select value={mao.periodo || "todo"} onValueChange={(v) => setMao((m) => ({ ...m, periodo: v === "todo" ? "" : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todo">Todo o histórico</SelectItem>{PERIODOS_PADRAO.map((p) => <SelectItem key={p} value={p}>{p[0]!.toUpperCase() + p.slice(1)}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="mb-1 block text-sm">Título</Label><Input value={mao.titulo} onChange={(e) => setMao((m) => ({ ...m, titulo: e.target.value }))} placeholder="Opcional" /></div>
            </div>
            {erroMao ? <p className="text-sm text-destructive">{erroMao}</p> : planoMao && (
              <WidgetView widget={{ id: "mao", titulo: mao.titulo || "Prévia", visual: mao.visual, plano: planoMao, largura: 2 }} datasets={datasets} />
            )}
            <Button disabled={!!erroMao} onClick={async () => { if (planoMao && limiteOk(1)) { await aoAdicionar([{ titulo: mao.titulo || "Novo gráfico", visual: mao.visual, plano: planoMao, largura: mao.visual === "kpi" || mao.visual === "pizza" ? 1 : 2 }]); aoFechar(); } }}>Adicionar ao dashboard</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export { novoId };
