import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Cabecalho, Vazio } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { WidgetView } from "@/components/painel/grafico";
import { CartaoInsight } from "@/components/painel/insight-cartao";
import { Medidor } from "@/components/painel/medidor";
import { Button } from "@/components/ui/button";
import { podeFazer } from "@/lib/saas/direitos";
import { gerarTodosInsights } from "@/lib/saas/insights";
import * as S from "@/lib/saas/servico";
import { sugerirWidgets } from "@/lib/saas/sugestoes";
import type { RegistroUso, Widget } from "@/lib/saas/tipos";
import { listarDashboards } from "@/lib/saas/conteudo";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Início — Stagium" }] }),
  component: Inicio,
});

function Inicio() {
  const s = useSessao();
  const [uso, setUso] = useState<RegistroUso | null>(null);
  const [qtdDash, setQtdDash] = useState(0);
  const empresa = s.empresa;

  useEffect(() => {
    if (!empresa) return;
    void S.lerUso(empresa.id).then(setUso);
    void listarDashboards(empresa.id).then((d) => setQtdDash(d.length));
  }, [empresa]);

  const destaques = useMemo<Omit<Widget, "id">[]>(() => {
    const kpis: Omit<Widget, "id">[] = [];
    for (const ds of s.datasets) {
      const k = sugerirWidgets(ds).find((x) => x.widget.visual === "kpi" && x.prioridade >= 95);
      if (k) kpis.push({ ...k.widget, titulo: `${ds.nome}: ${k.widget.titulo.toLowerCase()}` });
    }
    return kpis.slice(0, 4);
  }, [s.datasets]);

  const insights = useMemo(() => (s.direitos ? gerarTodosInsights(s.datasets, s.direitos.insights).slice(0, 3) : []), [s.datasets, s.direitos]);

  if (!empresa || !s.usuario || !s.direitos) return null;
  const primeiro = s.usuario.nome.split(" ")[0];
  const pode = podeFazer(s.usuario.papel, "conectarSistemas");

  async function usarDemo() {
    try {
      await S.adicionarConexao(s.usuario!, empresa!, "demo", "Dados de demonstração");
      await s.recarregarDados();
      toast.success("Dados de demonstração conectados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível conectar.");
    }
  }

  return (
    <>
      <Cabecalho titulo={`Olá, ${primeiro}`} texto={`Este é o painel de ${empresa.nome}. Aqui ficam seus números, avisos e atalhos.`} />

      {s.datasets.length === 0 ? (
        <Vazio
          titulo="Ainda não há dados no painel"
          texto="Escolha como começar: veja tudo funcionando com uma empresa de exemplo, importe uma planilha sua ou conecte o ERP."
          acao={
            <>
              <Button onClick={usarDemo}>Explorar com dados de demonstração</Button>
              {podeFazer(s.usuario.papel, "importarDados") && <Button asChild variant="outline" className="bg-card"><Link to="/app/dados">Importar uma planilha</Link></Button>}
              {pode && <Button asChild variant="outline" className="bg-card"><Link to="/app/conexoes">Conectar meu ERP</Link></Button>}
            </>
          }
        />
      ) : (
        <div className="space-y-10">
          {destaques.length > 0 && (
            <section aria-label="Números do momento">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {destaques.map((w, i) => (
                  <WidgetView key={i} widget={{ ...w, id: `k${i}`, largura: 1 }} datasets={s.datasets} />
                ))}
              </div>
            </section>
          )}

          <section aria-label="Insights em destaque">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="titulo-passo">O que merece atenção</h2>
              <Link to="/app/insights" className="text-sm underline">Ver todos</Link>
            </div>
            {insights.length ? (
              <div className="grid gap-3">{insights.map((i) => <CartaoInsight key={i.id} insight={i} />)}</div>
            ) : (
              <p className="text-sm text-muted-foreground">Nada fora do normal nos seus dados agora.</p>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="folha lg:col-span-2" aria-label="Atalhos">
              <div className="folha-secao">
                <h2 className="titulo-passo">Por onde continuar</h2>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button asChild variant="outline" className="h-auto justify-start whitespace-normal bg-card py-3 text-left"><Link to="/app/dashboards">{qtdDash ? `Abrir meus ${qtdDash} dashboards` : "Montar meu primeiro dashboard"}</Link></Button>
                  {podeFazer(s.usuario.papel, "usarChat") && <Button asChild variant="outline" className="h-auto justify-start whitespace-normal bg-card py-3 text-left"><Link to="/app/chat">Perguntar algo aos meus dados</Link></Button>}
                  {podeFazer(s.usuario.papel, "agendarRelatorios") && <Button asChild variant="outline" className="h-auto justify-start whitespace-normal bg-card py-3 text-left"><Link to="/app/relatorios">Agendar um relatório</Link></Button>}
                  <Button asChild variant="outline" className="h-auto justify-start whitespace-normal bg-card py-3 text-left"><Link to="/chat">Buscar dado novo no ERP</Link></Button>
                </div>
              </div>
            </section>
            {podeFazer(s.usuario.papel, "verPlano") && (
              <section className="folha" aria-label="Uso do mês">
                <div className="folha-secao space-y-4">
                  <h2 className="titulo-passo">Uso do mês</h2>
                  <Medidor rotulo="Consultas" usado={uso?.consultas ?? 0} limite={s.direitos.consultasMes} />
                  <Medidor rotulo="Créditos de IA" usado={uso?.creditosIa ?? 0} limite={s.direitos.creditosIaMes} />
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
