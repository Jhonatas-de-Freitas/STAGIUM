import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Aviso, Cabecalho } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { MatrizDePlanos } from "@/components/painel/matriz-planos";
import { Medidor } from "@/components/painel/medidor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MESES_PAGOS_NO_ANUAL, PLANOS, formatarReais, planoPorId } from "@/lib/planos";
import { listarAlertas, listarDashboards } from "@/lib/saas/conteudo";
import { diasRestantes } from "@/lib/saas/direitos";
import { listarRelatorios } from "@/lib/saas/relatorios";
import * as S from "@/lib/saas/servico";
import type { RegistroUso, SolicitacaoPlano } from "@/lib/saas/tipos";

export const Route = createFileRoute("/app/plano")({
  head: () => ({ meta: [{ title: "Plano e cobrança — Stagium" }] }),
  component: PlanoECobranca,
});

function PlanoECobranca() {
  const s = useSessao();
  const { empresa, usuario, direitos } = s;
  const [uso, setUso] = useState<RegistroUso | null>(null);
  const [cont, setCont] = useState({ dashboards: 0, relatorios: 0, alertas: 0, usuarios: 0, sistemas: 0 });
  const [pedido, setPedido] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pedidos, setPedidos] = useState<SolicitacaoPlano[]>([]);

  const carregar = useCallback(async () => {
    if (!empresa) return;
    const [u, d, r, a, us, c, sol] = await Promise.all([
      S.lerUso(empresa.id), listarDashboards(empresa.id), listarRelatorios(empresa.id), listarAlertas(empresa.id),
      S.listarUsuarios(empresa.id), S.listarConexoes(empresa.id), S.listarSolicitacoes(),
    ]);
    setUso(u);
    setCont({ dashboards: d.length, relatorios: r.filter((x) => x.ativo).length, alertas: a.length, usuarios: us.filter((x) => x.ativo).length, sistemas: c.filter((x) => x.slug !== "demo").length });
    setPedidos(sol.filter((x) => x.empresaId === empresa.id && !x.atendidaEm));
  }, [empresa]);
  useEffect(() => { void carregar(); }, [carregar]);
  if (!empresa || !usuario || !direitos) return null;

  const plano = planoPorId(empresa.planoId);
  const dias = diasRestantes(empresa.testeAte);
  const anual = plano.mensal !== null ? plano.mensal * MESES_PAGOS_NO_ANUAL : null;
  const situacao = empresa.status === "teste" ? `Teste grátis${dias !== null ? ` · ${dias > 0 ? `${dias} dia(s) restantes` : "termina hoje"}` : ""}`
    : empresa.cortesia ? "Acesso de cortesia" : empresa.status === "ativa" ? "Ativo" : empresa.status === "suspensa" ? "Suspenso" : "Cancelado";

  async function pedir() {
    try {
      await S.solicitarMudancaDePlano(usuario!, empresa!, pedido!, msg);
      toast.success("Pedido enviado. A nossa equipe fala com você em até 1 dia útil.");
      setPedido(null); setMsg(""); await carregar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro."); }
  }

  return (
    <>
      <Cabecalho titulo="Plano e cobrança" texto="O que o seu plano inclui, quanto você já usou neste mês e como mudar de plano." />
      <section className="folha folha-secao mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">{empresa.status === "teste" ? "Teste grátis" : `Plano ${plano.nome}`}</h2>
            <p className="mt-1 text-muted-foreground">{situacao}{empresa.status === "teste" && ` · recursos do ${PLANOS[1]!.nome}, com limites menores`}</p>
          </div>
          <div className="text-right">
            {empresa.cortesia ? <p className="text-lg font-semibold">Sem cobrança</p> : plano.mensal !== null ? (
              <>
                <p className="numero-grande text-2xl font-semibold">{formatarReais(plano.mensal)}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                {anual !== null && <p className="text-xs text-muted-foreground">ou {formatarReais(anual)}/ano (2 meses grátis)</p>}
              </>
            ) : <p className="text-lg font-semibold">Sob consulta</p>}
          </div>
        </div>
        {empresa.status === "teste" && <p className="mt-3 text-sm">Gostou? Peça o plano abaixo antes do fim do teste. Seus dashboards, relatórios e dados continuam todos aqui.</p>}
      </section>

      <section className="mb-10" aria-label="Uso">
        <h2 className="titulo-passo mb-4">Uso neste mês</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Medidor rotulo="Consultas ao ERP e relatórios" usado={uso?.consultas ?? 0} limite={direitos.consultasMes} />
          <Medidor rotulo="Créditos de IA" usado={uso?.creditosIa ?? 0} limite={direitos.creditosIaMes} />
          <Medidor rotulo="Dashboards" usado={cont.dashboards} limite={direitos.dashboards} />
          <Medidor rotulo="Relatórios ativos" usado={cont.relatorios} limite={direitos.relatoriosAgendados} />
          <Medidor rotulo="Alertas" usado={cont.alertas} limite={direitos.alertas} />
          <Medidor rotulo="Pessoas na equipe" usado={cont.usuarios} limite={direitos.usuarios} />
          <Medidor rotulo="Sistemas conectados" usado={cont.sistemas} limite={direitos.sistemas} />
        </div>
        <p className="dica mt-3">As consultas e os créditos zeram todo mês. Perguntar ao chat gasta crédito de IA; gerar um relatório gasta uma consulta.</p>
      </section>

      <section className="mb-10" aria-label="Comparar planos">
        <h2 className="titulo-passo mb-4">Comparar planos</h2>
        <MatrizDePlanos {...(empresa.status === "teste" ? {} : { destacar: plano.id })} />
      </section>

      <section className="mb-10" aria-label="Mudar de plano">
        <h2 className="titulo-passo mb-4">Mudar de plano</h2>
        {pedidos.length > 0 && <div className="mb-4"><Aviso>Você já pediu {pedidos.map((p) => planoPorId(p.planoDesejado).nome).join(", ")}. Nossa equipe vai entrar em contato.</Aviso></div>}
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANOS.map((p) => {
            const atual = p.id === plano.id && empresa.status !== "teste";
            return (
              <article key={p.id} className="folha folha-secao flex flex-col justify-between gap-3">
                <div><h3 className="font-semibold">{p.nome}</h3><p className="numero-grande text-lg">{p.mensal === null ? "Sob consulta" : `${formatarReais(p.mensal)}/mês`}</p><p className="mt-1 text-sm text-muted-foreground">{p.resumo}</p></div>
                <Button variant={atual ? "outline" : "default"} className={atual ? "bg-card" : ""} disabled={atual} onClick={() => setPedido(p.id)}>{atual ? "Plano atual" : empresa.status === "teste" ? "Assinar" : "Pedir mudança"}</Button>
              </article>
            );
          })}
        </div>
        {pedido && (
          <div className="folha folha-secao mt-4">
            <h3 className="font-semibold">Pedir o plano {planoPorId(pedido).nome}</h3>
            <Textarea className="mt-2" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Conte o que você precisa (opcional): quantos sistemas, quantas pessoas, prazo..." aria-label="Mensagem" />
            <div className="mt-3 flex gap-2"><Button onClick={() => void pedir()}>Enviar pedido</Button><Button variant="ghost" onClick={() => setPedido(null)}>Cancelar</Button></div>
          </div>
        )}
      </section>

      <section aria-label="Pagamento">
        <h2 className="titulo-passo mb-3">Forma de pagamento e notas fiscais</h2>
        <Aviso>A cobrança automática (cartão, Pix ou boleto) e as notas fiscais ainda não estão ligadas neste ambiente. Hoje a nossa equipe combina o pagamento com você depois do pedido e libera o plano no mesmo dia.</Aviso>
      </section>
    </>
  );
}
