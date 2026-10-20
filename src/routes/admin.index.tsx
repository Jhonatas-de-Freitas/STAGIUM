import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Cabecalho, Vazio } from "@/components/painel/casca";
import { diasRestantes } from "@/lib/saas/direitos";
import { PLANOS, formatarReais, planoPorId } from "@/lib/planos";
import * as S from "@/lib/saas/servico";
import type { Empresa, SolicitacaoPlano } from "@/lib/saas/tipos";

export const Route = createFileRoute("/admin/")({ component: Visao });

const ROTULO_STATUS: Record<Empresa["status"], string> = { teste: "Em teste", ativa: "Ativas", suspensa: "Suspensas", cancelada: "Canceladas" };

function Visao() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [pedidos, setPedidos] = useState<SolicitacaoPlano[]>([]);
  useEffect(() => {
    void S.listarEmpresas().then((e) => setEmpresas(e.filter((x) => x.origem !== "demo")));
    void S.listarSolicitacoes().then((x) => setPedidos(x.filter((p) => !p.atendidaEm)));
  }, []);
  const mrr = empresas.reduce((t, e) => t + S.receitaMensal(e), 0);
  const pagantes = empresas.filter((e) => S.receitaMensal(e) > 0);
  const acabando = empresas.filter((e) => e.status === "teste" && (diasRestantes(e.testeAte) ?? 99) <= 3);
  const porStatus = (st: Empresa["status"]) => empresas.filter((e) => e.status === st).length;
  const porPlano = PLANOS.map((p) => ({ p, n: pagantes.filter((e) => e.planoId === p.id).length }));

  return (
    <>
      <Cabecalho titulo="Visão geral" texto="Como está a base de clientes hoje." />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao rotulo="Receita mensal (MRR)" valor={formatarReais(mrr)} nota={`${pagantes.length} cliente(s) pagante(s)`} />
        {(["teste", "ativa", "suspensa"] as const).map((st) => <Cartao key={st} rotulo={ROTULO_STATUS[st]} valor={String(porStatus(st))} nota={st === "ativa" ? `${empresas.filter((e) => e.cortesia).length} de cortesia` : undefined} />)}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Atenção">
          <h2 className="titulo-passo mb-3">Precisa de atenção</h2>
          {acabando.length === 0 && pedidos.length === 0 ? <p className="text-sm text-muted-foreground">Nada urgente.</p> : (
            <ul className="space-y-2">
              {pedidos.length > 0 && <li className="folha folha-secao text-sm"><Link to="/admin/solicitacoes" className="font-medium underline">{pedidos.length} pedido(s) de mudança de plano</Link> aguardando resposta.</li>}
              {acabando.map((e) => <li key={e.id} className="folha folha-secao text-sm"><Link to="/admin/clientes/$id" params={{ id: e.id }} className="font-medium underline">{e.nome}</Link>: o teste termina em {Math.max(0, diasRestantes(e.testeAte) ?? 0)} dia(s). Hora de ligar.</li>)}
            </ul>
          )}
        </section>
        <section aria-label="Receita por plano">
          <h2 className="titulo-passo mb-3">Clientes pagantes por plano</h2>
          <ul className="space-y-2">
            {porPlano.map(({ p, n }) => <li key={p.id} className="flex justify-between border-b py-1.5 text-sm"><span>{p.nome}</span><span className="numero-grande">{n} · {p.mensal === null ? "sob consulta" : formatarReais(n * p.mensal)}</span></li>)}
          </ul>
        </section>
      </div>

      <section className="mt-10" aria-label="Últimos cadastros">
        <h2 className="titulo-passo mb-3">Últimos cadastros</h2>
        {empresas.length === 0 ? <Vazio titulo="Nenhum cliente ainda" texto="Conceda o primeiro acesso em Clientes, ou divulgue o link do cadastro." /> : (
          <div className="grade-rolagem"><table className="w-full text-sm"><thead className="bg-[var(--grade-cabecalho)] text-left"><tr><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Plano</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2">Criada em</th></tr></thead>
            <tbody>{empresas.slice(0, 8).map((e) => <tr key={e.id} className="border-t"><td className="px-3 py-1.5"><Link to="/admin/clientes/$id" params={{ id: e.id }} className="font-medium underline">{e.nome}</Link></td><td className="px-3 py-1.5">{planoPorId(e.planoId).nome}</td><td className="px-3 py-1.5">{e.status === "teste" ? `Teste (${Math.max(0, diasRestantes(e.testeAte) ?? 0)}d)` : e.cortesia ? "Cortesia" : e.status}</td><td className="px-3 py-1.5">{new Date(e.criadaEm).toLocaleDateString("pt-BR")}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </>
  );
}

function Cartao({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string | undefined }) {
  return <div className="folha folha-secao"><p className="text-sm text-muted-foreground">{rotulo}</p><p className="numero-grande mt-1 text-3xl font-semibold">{valor}</p>{nota && <p className="dica mt-1">{nota}</p>}</div>;
}
