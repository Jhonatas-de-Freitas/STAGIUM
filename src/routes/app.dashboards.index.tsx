import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Cabecalho, Vazio } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { Medidor } from "@/components/painel/medidor";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarDashboard, listarDashboards, removerDashboard } from "@/lib/saas/conteudo";
import { podeFazer } from "@/lib/saas/direitos";
import { modelosDeDashboard } from "@/lib/saas/sugestoes";
import type { Dashboard } from "@/lib/saas/tipos";

export const Route = createFileRoute("/app/dashboards/")({
  head: () => ({ meta: [{ title: "Dashboards — Stagium" }] }),
  component: Dashboards,
});

function Dashboards() {
  const s = useSessao();
  const navegar = useNavigate();
  const [lista, setLista] = useState<Dashboard[] | null>(null);
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [modelo, setModelo] = useState("branco");
  const [apagar, setApagar] = useState<Dashboard | null>(null);
  const modelos = useMemo(() => modelosDeDashboard(s.datasets), [s.datasets]);
  const pode = podeFazer(s.usuario?.papel, "criarDashboards");

  const carregar = useCallback(async () => {
    if (s.empresa) setLista(await listarDashboards(s.empresa.id));
  }, [s.empresa]);
  useEffect(() => { void carregar(); }, [carregar]);

  async function criar() {
    if (!s.empresa || !s.usuario) return;
    try {
      const m = modelos.find((x) => x.nome === modelo);
      const d = await criarDashboard(s.usuario, s.empresa, nome || m?.nome || "Novo dashboard", m?.widgets ?? [], m?.descricao ?? "");
      setNovo(false);
      setNome("");
      await navegar({ to: "/app/dashboards/$id", params: { id: d.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar.");
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Dashboards"
        texto="Painéis montados por você, com os gráficos que importam para a sua empresa. A IA sugere os gráficos; você escolhe."
        acoes={pode && <Button onClick={() => setNovo(true)}><Plus className="mr-2 size-4" />Novo dashboard</Button>}
      />
      {s.direitos && lista && (
        <div className="mb-6 max-w-xs"><Medidor rotulo="Dashboards do plano" usado={lista.length} limite={s.direitos.dashboards} /></div>
      )}
      {lista && lista.length === 0 ? (
        <Vazio
          titulo="Nenhum dashboard ainda"
          texto={s.datasets.length ? "Comece por um modelo pronto (Comercial, Cobrança, Estoque...) ou crie um em branco e adicione os gráficos que a IA sugerir." : "Primeiro coloque dados no painel: use os dados de demonstração, importe uma planilha ou conecte o ERP."}
          acao={pode && s.datasets.length > 0 ? <Button onClick={() => setNovo(true)}>Criar o primeiro dashboard</Button> : <Button asChild variant="outline" className="bg-card"><Link to="/app">Voltar ao início</Link></Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(lista ?? []).map((d) => (
            <article key={d.id} className="folha flex flex-col">
              <Link to="/app/dashboards/$id" params={{ id: d.id }} className="folha-secao flex-1 hover:bg-secondary/50">
                <LayoutDashboard className="size-5 text-muted-foreground" aria-hidden />
                <h2 className="titulo-passo mt-3">{d.nome}</h2>
                {d.descricao && <p className="mt-1 text-sm text-muted-foreground">{d.descricao}</p>}
                <p className="dica mt-3">{d.widgets.length} gráfico(s) · atualizado em {new Date(d.atualizadoEm).toLocaleDateString("pt-BR")}</p>
              </Link>
              {pode && (
                <div className="folha-secao flex justify-end py-2">
                  <Button variant="ghost" size="sm" onClick={() => setApagar(d)}><Trash2 className="mr-1.5 size-4" />Apagar</Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo dashboard</DialogTitle><DialogDescription>Comece de um modelo pronto ou em branco. Depois dá para mudar tudo.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="nome-dash" className="mb-1 block">Nome</Label><Input id="nome-dash" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Diretoria" /></div>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Ponto de partida</legend>
              {[{ nome: "branco", descricao: "Em branco: você escolhe os gráficos." }, ...modelos].map((m) => (
                <label key={m.nome} className={`flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 text-sm ${modelo === m.nome ? "ring-2 ring-[var(--marca)]" : ""}`}>
                  <input type="radio" name="modelo" className="mt-1" checked={modelo === m.nome} onChange={() => setModelo(m.nome)} />
                  <span><strong>{m.nome === "branco" ? "Em branco" : m.nome}</strong><br /><span className="text-muted-foreground">{m.descricao}</span></span>
                </label>
              ))}
            </fieldset>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button><Button onClick={criar}>Criar dashboard</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!apagar} onOpenChange={(a) => !a && setApagar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Apagar "{apagar?.nome}"?</AlertDialogTitle><AlertDialogDescription>O dashboard some para toda a equipe. Os dados não são afetados.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (apagar && s.empresa && s.usuario) { await removerDashboard(s.usuario, s.empresa, apagar); setApagar(null); await carregar(); toast.success("Dashboard apagado."); } }}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
