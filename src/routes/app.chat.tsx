import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Download, LayoutDashboard, Send, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Cabecalho, Vazio } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { GraficoDeResultado, TabelaDeResultado } from "@/components/painel/grafico";
import { Medidor } from "@/components/painel/medidor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { pedirPlano } from "@/lib/saas/assistente-dados";
import { executarPlano, validarPlano } from "@/lib/saas/consulta";
import { listarDashboards, novoWidget, salvarDashboard } from "@/lib/saas/conteudo";
import { podeFazer } from "@/lib/saas/direitos";
import { ehErro, exemplosDePerguntas } from "@/lib/saas/interpretar";
import { arquivoDeResultado, baixarArquivo } from "@/lib/saas/relatorios";
import { resumirResultado } from "@/lib/saas/resposta";
import { repo } from "@/lib/saas/repositorio";
import { novoId } from "@/lib/saas/senha";
import * as S from "@/lib/saas/servico";
import type { Dashboard, MensagemChat, RegistroUso } from "@/lib/saas/tipos";

export const Route = createFileRoute("/app/chat")({
  validateSearch: (b: Record<string, unknown>) => (typeof b["q"] === "string" ? { q: b["q"] as string } : {}) as { q?: string },
  head: () => ({ meta: [{ title: "Perguntar aos dados — Stagium" }] }),
  component: Chat,
});

function Resposta({ m, onAdicionar, onAgendar }: { m: MensagemChat; onAdicionar: () => void; onAgendar: () => void }) {
  const s = useSessao();
  const ds = s.datasets.find((d) => d.id === m.plano?.datasetId);
  const calc = useMemo(() => {
    if (!ds || !m.plano) return null;
    if (validarPlano(ds, m.plano).length) return null;
    return executarPlano(ds, m.plano);
  }, [ds, m.plano]);
  if (!m.plano || !m.visual) return <p className="whitespace-pre-line">{m.texto}</p>;
  if (!ds || !calc) return <p className="text-muted-foreground">Esta resposta usava uma base que não está mais disponível.</p>;
  const modo = m.plano.modo;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{m.texto}</p>
      <p className="font-semibold">{m.titulo}</p>
      <p>{resumirResultado(calc, modo)}</p>
      <div className="rounded-md border bg-card p-3">
        {m.visual === "kpi" || m.visual === "tabela" || calc.linhas.length === 0 ? (
          <TabelaDeResultado resultado={calc} max={50} />
        ) : (
          <GraficoDeResultado resultado={calc} visual={m.visual} altura={240} />
        )}
      </div>
      {m.visual !== "tabela" && m.visual !== "kpi" && calc.linhas.length > 0 && (
        <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Ver os números</summary><div className="mt-2"><TabelaDeResultado resultado={calc} max={30} /></div></details>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="bg-card" onClick={async () => { await baixarArquivo(arquivoDeResultado(m.titulo ?? "consulta", ds, calc)); }}><Download className="mr-1.5 size-4" />Baixar planilha</Button>
        {podeFazer(s.usuario?.papel, "criarDashboards") && <Button size="sm" variant="outline" className="bg-card" onClick={onAdicionar}><LayoutDashboard className="mr-1.5 size-4" />Adicionar a um dashboard</Button>}
        {podeFazer(s.usuario?.papel, "agendarRelatorios") && modo === "lista" && <Button size="sm" variant="outline" className="bg-card" onClick={onAgendar}><CalendarClock className="mr-1.5 size-4" />Agendar como relatório</Button>}
      </div>
    </div>
  );
}

function Chat() {
  const s = useSessao();
  const { q } = Route.useSearch();
  const [msgs, setMsgs] = useState<MensagemChat[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [uso, setUso] = useState<RegistroUso | null>(null);
  const [paraDash, setParaDash] = useState<MensagemChat | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const fim = useRef<HTMLDivElement>(null);
  const enviadaDaUrl = useRef(false);
  const empresa = s.empresa;
  const usuario = s.usuario;

  const col = useCallback(() => repo().daEmpresa<MensagemChat & { id: string }>(empresa!.id, "chat"), [empresa]);
  useEffect(() => {
    if (!empresa) return;
    void col().listar().then((l) => setMsgs(l.sort((a, b) => a.em.localeCompare(b.em)).slice(-60)));
    void S.lerUso(empresa.id).then(setUso);
  }, [empresa, col]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [msgs, pensando]);

  const guardar = useCallback(async (novas: MensagemChat[]) => {
    const atual = await col().listar();
    await col().substituirTudo([...atual, ...novas].slice(-120) as (MensagemChat & { id: string })[]);
  }, [col]);

  const enviar = useCallback(async (pergunta: string) => {
    if (!empresa || !usuario || !pergunta.trim() || pensando) return;
    const minha: MensagemChat = { id: novoId("m"), autor: "cliente", texto: pergunta.trim(), em: new Date().toISOString() };
    setMsgs((m) => [...m, minha]);
    setTexto("");
    setPensando(true);
    try {
      const r = await pedirPlano(minha.texto, "resposta", s.datasets, empresa, usuario, msgs.slice(-4));
      let resposta: MensagemChat;
      if (ehErro(r.resultado)) {
        resposta = { id: novoId("m"), autor: "assistente", em: new Date().toISOString(), texto: `${r.resultado.erro}${r.resultado.sugestoes.length ? `\n\nExperimente, por exemplo:\n• ${r.resultado.sugestoes.join("\n• ")}` : ""}` };
      } else {
        resposta = { id: novoId("m"), autor: "assistente", em: new Date().toISOString(), texto: `Entendi assim: ${r.resultado.entendi}${r.aviso ? `\n${r.aviso}` : ""}`, plano: r.resultado.plano, visual: r.resultado.visual, titulo: r.resultado.titulo, origem: r.resultado.origem };
      }
      setMsgs((m) => [...m, resposta]);
      await guardar([minha, resposta]);
      await S.auditar(empresa.id, usuario, "chat", `Perguntou: ${minha.texto.slice(0, 120)}`);
      setUso(await S.lerUso(empresa.id));
      await s.recarregar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível responder.";
      setMsgs((m) => [...m, { id: novoId("m"), autor: "assistente", em: new Date().toISOString(), texto: msg }]);
    } finally {
      setPensando(false);
    }
  }, [empresa, usuario, pensando, s, msgs, guardar]);

  useEffect(() => {
    if (q && empresa && usuario && s.datasets.length && !enviadaDaUrl.current) {
      enviadaDaUrl.current = true;
      void enviar(q);
    }
  }, [q, empresa, usuario, s.datasets.length, enviar]);

  if (!empresa || !usuario || !s.direitos) return null;
  if (!podeFazer(usuario.papel, "usarChat")) return <Vazio titulo="Seu perfil só visualiza" texto="Peça ao administrador da empresa para mudar seu perfil para Analista se precisar perguntar aos dados." />;
  if (!s.datasets.length)
    return <Vazio titulo="Ainda não há dados para perguntar" texto="Coloque dados no painel: use os dados de demonstração, importe uma planilha ou conecte um ERP." acao={<Button asChild><Link to="/app">Voltar ao início</Link></Button>} />;

  async function abrirDashboards(m: MensagemChat) {
    setDashboards(await listarDashboards(empresa!.id));
    setParaDash(m);
  }
  async function colocarEm(d: Dashboard) {
    if (!paraDash?.plano || !paraDash.visual) return;
    try {
      await salvarDashboard(usuario!, empresa!, { ...d, widgets: [...d.widgets, novoWidget({ titulo: paraDash.titulo ?? "Resultado do chat", visual: paraDash.visual, plano: paraDash.plano, largura: paraDash.visual === "kpi" || paraDash.visual === "pizza" ? 1 : 2 })] }, `Adicionou um gráfico do chat a "${d.nome}"`);
      toast.success(`Adicionado a "${d.nome}".`);
      setParaDash(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível adicionar.");
    }
  }
  function agendar(m: MensagemChat) {
    try { sessionStorage.setItem("stagium.relatorio.rascunho", JSON.stringify({ plano: m.plano, nome: m.titulo })); } catch { /* sem armazenamento */ }
    window.location.assign("/app/relatorios?novo=1");
  }

  return (
    <>
      <Cabecalho titulo="Perguntar aos dados" texto="Escreva em português o que você quer saber sobre a sua empresa. A resposta vem em números, gráfico e planilha." />
      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <section aria-label="Conversa" className="min-w-0">
          <div className="folha min-h-[22rem]">
            <div className="space-y-5 p-4" aria-live="polite">
              {msgs.length === 0 && (
                <div>
                  <p className="font-semibold">Comece por uma destas perguntas</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {exemplosDePerguntas(s.datasets).slice(0, 8).map((e) => <button key={e} type="button" onClick={() => void enviar(e)} className="rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-secondary">{e}</button>)}
                  </div>
                </div>
              )}
              {msgs.map((m) => (
                <div key={m.id} className={m.autor === "cliente" ? "flex justify-end" : ""}>
                  <div className={m.autor === "cliente" ? "max-w-[85%] rounded-lg bg-foreground px-3 py-2 text-sm text-background" : "w-full text-sm"}>
                    {m.autor === "cliente" ? m.texto : <Resposta m={m} onAdicionar={() => void abrirDashboards(m)} onAgendar={() => agendar(m)} />}
                  </div>
                </div>
              ))}
              {pensando && <p className="text-sm text-muted-foreground">Analisando seus dados...</p>}
              <div ref={fim} />
            </div>
          </div>
          <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void enviar(texto); }}>
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={400} aria-label="Sua pergunta" placeholder="Ex.: quais clientes têm títulos vencidos?" className="bg-card" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(texto); } }} />
            <Button type="submit" disabled={pensando || !texto.trim()} aria-label="Enviar"><Send className="size-4" /></Button>
          </form>
        </section>

        <aside className="space-y-4 text-sm">
          <div className="folha folha-secao space-y-3">
            <Medidor rotulo="Créditos de IA" usado={uso?.creditosIa ?? 0} limite={s.direitos.creditosIaMes} />
          </div>
          <p className="flex gap-2 text-muted-foreground"><Sparkles className="mt-0.5 size-4 shrink-0" />A IA recebe só os nomes das colunas, nunca os seus dados. Quando ela não está disponível, o modo básico responde perguntas mais simples, sem gastar crédito.</p>
          {msgs.length > 0 && <Button variant="ghost" size="sm" onClick={async () => { await col().substituirTudo([]); setMsgs([]); }}><Trash2 className="mr-1.5 size-4" />Limpar conversa</Button>}
        </aside>
      </div>

      <Dialog open={!!paraDash} onOpenChange={(a) => !a && setParaDash(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar a um dashboard</DialogTitle><DialogDescription>Escolha onde este gráfico vai ficar.</DialogDescription></DialogHeader>
          {dashboards.length === 0 ? <p className="text-sm text-muted-foreground">Você ainda não tem dashboards. Crie o primeiro em Dashboards.</p> : (
            <div className="grid gap-2">{dashboards.map((d) => <Button key={d.id} variant="outline" className="justify-between bg-card" onClick={() => void colocarEm(d)}>{d.nome}<span className="text-xs text-muted-foreground">{d.widgets.length} gráfico(s)</span></Button>)}</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
