import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronLeft, Columns3, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Cabecalho, Vazio } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { ConstrutorDeGrafico } from "@/components/painel/construtor";
import { WidgetView } from "@/components/painel/grafico";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { novoWidget, salvarDashboard } from "@/lib/saas/conteudo";
import { PERIODOS_PADRAO } from "@/lib/saas/consulta";
import { podeFazer } from "@/lib/saas/direitos";
import { repo } from "@/lib/saas/repositorio";
import type { Dashboard, Widget } from "@/lib/saas/tipos";

export const Route = createFileRoute("/app/dashboards/$id")({
  head: () => ({ meta: [{ title: "Dashboard — Stagium" }] }),
  component: VerDashboard,
});

function VerDashboard() {
  const { id } = Route.useParams();
  const s = useSessao();
  const [d, setD] = useState<Dashboard | null | undefined>(undefined);
  const [periodo, setPeriodo] = useState("padrao");
  const [construtor, setConstrutor] = useState(false);
  const [renomear, setRenomear] = useState<string | null>(null);
  const pode = podeFazer(s.usuario?.papel, "criarDashboards");

  const carregar = useCallback(async () => {
    if (!s.empresa) return;
    const x = await repo().daEmpresa<Dashboard>(s.empresa.id, "dashboards").obter(id);
    setD(x);
    if (x) setPeriodo(x.periodoPadrao);
  }, [s.empresa, id]);
  useEffect(() => { void carregar(); }, [carregar]);

  async function gravar(novo: Dashboard, auditoria?: string) {
    if (!s.empresa || !s.usuario) return;
    try {
      setD(await salvarDashboard(s.usuario, s.empresa, novo, auditoria));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  if (d === undefined) return <p className="text-muted-foreground">Carregando...</p>;
  if (d === null)
    return <Vazio titulo="Dashboard não encontrado" texto="Ele pode ter sido apagado por alguém da equipe." acao={<Button asChild variant="outline" className="bg-card"><Link to="/app/dashboards">Ver dashboards</Link></Button>} />;

  const mover = (i: number, delta: number) => {
    const w = [...d.widgets];
    const j = i + delta;
    if (j < 0 || j >= w.length) return;
    [w[i], w[j]] = [w[j]!, w[i]!];
    void gravar({ ...d, widgets: w });
  };
  const largura = (i: number) => {
    const w = [...d.widgets];
    const atual = w[i]!;
    w[i] = { ...atual, largura: ((atual.largura % 3) + 1) as Widget["largura"] };
    void gravar({ ...d, widgets: w });
  };

  return (
    <>
      <Link to="/app/dashboards" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Dashboards</Link>
      <Cabecalho
        titulo={d.nome}
        {...(d.descricao ? { texto: d.descricao } : {})}
        acoes={
          <>
            <Select value={periodo} onValueChange={(v) => { setPeriodo(v); if (pode) void gravar({ ...d, periodoPadrao: v }); }}>
              <SelectTrigger className="w-48 bg-card" aria-label="Período do dashboard"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="padrao">Período de cada gráfico</SelectItem>
                {PERIODOS_PADRAO.map((p) => <SelectItem key={p} value={p}>{p[0]!.toUpperCase() + p.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            {pode && <Button variant="outline" className="bg-card" onClick={() => setRenomear(d.nome)}><Pencil className="mr-2 size-4" />Renomear</Button>}
            {pode && <Button onClick={() => setConstrutor(true)}><Plus className="mr-2 size-4" />Adicionar gráfico</Button>}
          </>
        }
      />
      {d.widgets.length === 0 ? (
        <Vazio titulo="Este dashboard está vazio" texto="Adicione gráficos: a IA sugere os mais úteis para os seus dados e você escolhe quais ficam." acao={pode && <Button onClick={() => setConstrutor(true)}>Ver sugestões da IA</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {d.widgets.map((w, i) => (
            <WidgetView
              key={w.id}
              widget={w}
              datasets={s.datasets}
              periodo={periodo}
              {...(pode ? {
                onRemover: () => void gravar({ ...d, widgets: d.widgets.filter((x) => x.id !== w.id) }, `Removeu o gráfico "${w.titulo}" de "${d.nome}"`),
                acoes: (
                  <>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover para antes" title="Mover para antes"><ArrowLeft className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => mover(i, 1)} disabled={i === d.widgets.length - 1} aria-label="Mover para depois" title="Mover para depois"><ArrowRight className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => largura(i)} aria-label="Mudar largura" title="Mudar largura"><Columns3 className="size-4" /></Button>
                  </>
                ),
              } : {})}
            />
          ))}
        </div>
      )}
      <ConstrutorDeGrafico
        aberto={construtor}
        aoFechar={() => setConstrutor(false)}
        datasets={s.datasets}
        restante={s.direitos?.widgetsPorDashboard == null ? null : Math.max(0, s.direitos.widgetsPorDashboard - d.widgets.length)}
        aoAdicionar={async (novos) => {
          await gravar({ ...d, widgets: [...d.widgets, ...novos.map(novoWidget)] }, `Adicionou ${novos.length} gráfico(s) a "${d.nome}"`);
          toast.success(`${novos.length} gráfico(s) adicionado(s).`);
        }}
      />
      <Dialog open={renomear !== null} onOpenChange={(a) => !a && setRenomear(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear dashboard</DialogTitle></DialogHeader>
          <Input value={renomear ?? ""} onChange={(e) => setRenomear(e.target.value)} aria-label="Nome do dashboard" />
          <DialogFooter><Button onClick={() => { if (renomear?.trim()) void gravar({ ...d, nome: renomear.trim() }, `Renomeou o dashboard para "${renomear.trim()}"`); setRenomear(null); }}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
