import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Copy, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Aviso, Cabecalho, Vazio } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { EditorDeRelatorio } from "@/components/painel/editor-relatorio";
import { Medidor } from "@/components/painel/medidor";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { podeFazer } from "@/lib/saas/direitos";
import { descreverAgenda, executarRelatorio, listarExecucoes, listarRelatorios, modeloVazio, proximaExecucao, removerRelatorio, salvarRelatorio } from "@/lib/saas/relatorios";
import { novoId } from "@/lib/saas/senha";
import type { Execucao, PlanoDeConsulta, Relatorio } from "@/lib/saas/tipos";

export const Route = createFileRoute("/app/relatorios")({
  validateSearch: (b: Record<string, unknown>) => (b["novo"] === "1" || b["novo"] === 1 ? { novo: 1 } : {}) as { novo?: number },
  head: () => ({ meta: [{ title: "Relatórios agendados — Stagium" }] }),
  component: Relatorios,
});

const STATUS: Record<Execucao["status"], { r: string; cor: string }> = {
  ok: { r: "Baixado", cor: "var(--bom)" },
  simulado: { r: "Gerado (envio pendente)", cor: "var(--atencao)" },
  erro: { r: "Erro", cor: "var(--ruim)" },
};

function Relatorios() {
  const s = useSessao();
  const { novo } = Route.useSearch();
  const [lista, setLista] = useState<Relatorio[]>([]);
  const [hist, setHist] = useState<Execucao[]>([]);
  const [editando, setEditando] = useState<Relatorio | null>(null);
  const empresa = s.empresa;
  const usuario = s.usuario;
  const pode = podeFazer(usuario?.papel, "agendarRelatorios");

  const carregar = useCallback(async () => {
    if (!empresa) return;
    setLista(await listarRelatorios(empresa.id));
    setHist((await listarExecucoes(empresa.id)).slice(0, 15));
  }, [empresa]);
  useEffect(() => { void carregar(); }, [carregar]);

  // rascunho vindo do chat ("Agendar como relatório")
  useEffect(() => {
    if (!novo || !usuario || !s.datasets.length) return;
    try {
      const t = sessionStorage.getItem("stagium.relatorio.rascunho");
      if (!t) return;
      sessionStorage.removeItem("stagium.relatorio.rascunho");
      const { plano, nome } = JSON.parse(t) as { plano: PlanoDeConsulta; nome?: string };
      const ds = s.datasets.find((d) => d.id === plano.datasetId);
      if (!ds) return;
      const base = modeloVazio(ds, usuario);
      setEditando({ ...base, nome: nome ?? "", plano: { ...plano, modo: "lista", colunas: plano.colunas ?? base.plano.colunas ?? [] } });
    } catch { /* rascunho inválido */ }
  }, [novo, usuario, s.datasets]);

  if (!empresa || !usuario || !s.direitos) return null;
  const d = s.direitos;
  const ativos = lista.filter((r) => r.ativo).length;

  async function salvar(r: Relatorio) {
    await salvarRelatorio(usuario!, empresa!, r, s.datasets.find((x) => x.id === r.plano.datasetId));
    setEditando(null);
    await carregar();
    toast.success("Relatório salvo.");
  }
  async function executar(r: Relatorio) {
    const ds = s.datasets.find((x) => x.id === r.plano.datasetId);
    if (!ds) { toast.error("A base de dados deste relatório não existe mais."); return; }
    const ex = await executarRelatorio(usuario!, empresa!, r, ds, "manual");
    await carregar();
    if (ex.status === "erro") toast.error(ex.mensagem);
    else toast.success(ex.mensagem);
  }

  return (
    <>
      <Cabecalho
        titulo="Relatórios agendados"
        texto="Escolha os dados, as colunas, o horário e quem recebe. O arquivo é gerado sozinho, sem ninguém precisar exportar planilha."
        acoes={pode && s.datasets.length > 0 && <Button onClick={() => setEditando(modeloVazio(s.datasets[0]!, usuario))}><Plus className="mr-2 size-4" />Novo relatório</Button>}
      />
      <div className="mb-6 grid max-w-xl gap-4 sm:grid-cols-2">
        <Medidor rotulo="Relatórios ativos" usado={ativos} limite={d.relatoriosAgendados} />
        <p className="self-end text-xs text-muted-foreground">Frequências do seu plano: {d.frequenciasRelatorio.join(", ").replace("dias_uteis", "dias úteis").replace("diaria", "diária")}.</p>
      </div>
      <div className="mb-6"><Aviso>O envio por e-mail ainda não está ligado neste ambiente. O painel gera os arquivos nos horários marcados (enquanto estiver aberto), registra no histórico e deixa você baixar na hora.</Aviso></div>

      {s.datasets.length === 0 ? (
        <Vazio titulo="Sem dados para agendar" texto="Primeiro coloque dados no painel." acao={<Button asChild variant="outline" className="bg-card"><Link to="/app">Voltar ao início</Link></Button>} />
      ) : lista.length === 0 ? (
        <Vazio titulo="Nenhum relatório agendado" texto="Exemplo: todo dia útil às 8h, a lista de títulos vencidos para o financeiro. Crie o primeiro." acao={pode && <Button onClick={() => setEditando(modeloVazio(s.datasets[0]!, usuario))}>Criar relatório</Button>} />
      ) : (
        <div className="grid gap-3">
          {lista.map((r) => {
            const ds = s.datasets.find((x) => x.id === r.plano.datasetId);
            return (
              <article key={r.id} className="folha folha-secao flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><CalendarClock className="size-4 text-muted-foreground" aria-hidden /><h2 className="font-semibold">{r.nome}</h2></div>
                  <p className="mt-1 text-sm text-muted-foreground">{descreverAgenda(r)} · {r.formato.toUpperCase()} · {ds?.nome ?? "base removida"} · {r.plano.colunas?.length ?? 0} colunas</p>
                  <p className="dica mt-0.5">Para {r.destinatarios.join(", ")}{r.ativo ? ` · próxima: ${proximaExecucao(r, new Date(r.ultimaExecucao ?? Date.now())).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : " · pausado"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {pode && <Switch checked={r.ativo} aria-label={`Agendamento de ${r.nome}`} onCheckedChange={async (v) => { try { await salvarRelatorio(usuario, empresa, { ...r, ativo: v }, ds); await carregar(); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro."); } }} />}
                  <Button variant="ghost" size="sm" onClick={() => void executar(r)}><Download className="mr-1.5 size-4" />Executar agora</Button>
                  {pode && <>
                    <Button variant="ghost" size="icon" aria-label={`Editar ${r.nome}`} onClick={() => setEditando(r)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Duplicar ${r.nome}`} onClick={() => setEditando({ ...r, id: novoId("r"), nome: `${r.nome} (cópia)`, ultimaExecucao: null, criadoEm: new Date().toISOString() })}><Copy className="size-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Apagar ${r.nome}`} onClick={async () => { await removerRelatorio(usuario, empresa, r); await carregar(); }}><Trash2 className="size-4" /></Button>
                  </>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hist.length > 0 && (
        <section className="mt-12" aria-label="Histórico">
          <h2 className="titulo-passo mb-3">Últimas execuções</h2>
          <div className="grade-rolagem"><table className="w-full text-sm">
            <thead className="bg-[var(--grade-cabecalho)] text-left"><tr><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Relatório</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Linhas</th><th className="px-3 py-2">Situação</th></tr></thead>
            <tbody>{hist.map((h) => (
              <tr key={h.id} className="border-t align-top">
                <td className="whitespace-nowrap px-3 py-1.5">{new Date(h.em).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-1.5">{h.nomeRelatorio}</td>
                <td className="px-3 py-1.5">{h.origem === "manual" ? "Manual" : "Agendada"}</td>
                <td className="numero-grande px-3 py-1.5">{h.linhas.toLocaleString("pt-BR")}</td>
                <td className="px-3 py-1.5"><span className="font-medium" style={{ color: STATUS[h.status].cor }}>{STATUS[h.status].r}</span><br /><span className="text-xs text-muted-foreground">{h.mensagem}</span></td>
              </tr>))}</tbody>
          </table></div>
        </section>
      )}

      {editando && <EditorDeRelatorio inicial={editando} datasets={s.datasets} empresa={empresa} direitos={d} aoSalvar={salvar} aoFechar={() => setEditando(null)} />}
    </>
  );
}
