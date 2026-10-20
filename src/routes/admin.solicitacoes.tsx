import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Cabecalho, Vazio } from "@/components/painel/casca";
import { Button } from "@/components/ui/button";
import { planoPorId } from "@/lib/planos";
import * as S from "@/lib/saas/servico";
import type { Empresa, SolicitacaoPlano } from "@/lib/saas/tipos";

export const Route = createFileRoute("/admin/solicitacoes")({ component: Solicitacoes });

function Solicitacoes() {
  const [lista, setLista] = useState<SolicitacaoPlano[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, Empresa>>({});
  const carregar = useCallback(async () => {
    setLista((await S.listarSolicitacoes()).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)));
    setEmpresas(Object.fromEntries((await S.listarEmpresas()).map((e) => [e.id, e])));
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  const abertas = lista.filter((x) => !x.atendidaEm);
  const feitas = lista.filter((x) => x.atendidaEm);
  const Linha = (p: SolicitacaoPlano) => (
    <article key={p.id} className="folha folha-secao flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-medium"><Link to="/admin/clientes/$id" params={{ id: p.empresaId }} className="underline">{empresas[p.empresaId]?.nome ?? "Empresa removida"}</Link> quer o plano {planoPorId(p.planoDesejado).nome}</p>
        {p.mensagem && <p className="mt-1 text-sm text-muted-foreground">“{p.mensagem}”</p>}
        <p className="dica mt-1">Pedido em {new Date(p.criadaEm).toLocaleString("pt-BR")}{p.atendidaEm && ` · atendido em ${new Date(p.atendidaEm).toLocaleDateString("pt-BR")}`}</p>
      </div>
      {!p.atendidaEm && <Button variant="outline" className="bg-card" onClick={async () => { await S.atenderSolicitacao(p.id); await carregar(); toast.success("Marcado como atendido."); }}>Marcar como atendido</Button>}
    </article>
  );
  return (
    <>
      <Cabecalho titulo="Pedidos de plano" texto="Clientes que pediram para assinar ou mudar de plano. Combine o pagamento, depois altere o plano na ficha do cliente." />
      {abertas.length === 0 ? <Vazio titulo="Nenhum pedido aberto" texto="Quando um cliente pedir um plano em Plano e cobrança, aparece aqui." /> : <div className="grid gap-3">{abertas.map(Linha)}</div>}
      {feitas.length > 0 && <><h2 className="titulo-passo mb-3 mt-10">Atendidos</h2><div className="grid gap-3">{feitas.slice(0, 20).map(Linha)}</div></>}
    </>
  );
}
