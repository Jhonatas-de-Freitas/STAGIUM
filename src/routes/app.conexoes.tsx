import { Link, createFileRoute } from "@tanstack/react-router";
import { Plug, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Aviso, Cabecalho } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { Medidor } from "@/components/painel/medidor";
import { Button } from "@/components/ui/button";
import conhecimento from "@/lib/conhecimento.json";
import * as S from "@/lib/saas/servico";
import type { Conexao } from "@/lib/saas/tipos";

export const Route = createFileRoute("/app/conexoes")({
  head: () => ({ meta: [{ title: "Conexões com ERPs — Stagium" }] }),
  component: Conexoes,
});

type SistemaCat = { slug: string; nome: string; categoria: string; descricao: string };
const SISTEMAS = (conhecimento as unknown as { sistemas: SistemaCat[] }).sistemas;

function Conexoes() {
  const s = useSessao();
  const [lista, setLista] = useState<Conexao[]>([]);
  const { empresa, usuario, direitos } = s;
  const carregar = useCallback(async () => { if (empresa) setLista(await S.listarConexoes(empresa.id)); }, [empresa]);
  useEffect(() => { void carregar(); }, [carregar]);
  if (!empresa || !usuario || !direitos) return null;
  const reais = lista.filter((c) => c.slug !== "demo");
  const temDemo = lista.some((c) => c.slug === "demo");

  async function agir(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); await carregar(); await s.recarregarDados(); toast.success(ok); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro."); }
  }

  return (
    <>
      <Cabecalho titulo="Conexões com ERPs" texto="Os sistemas que a sua empresa usa. Hoje você já pode consultar o ERP ao vivo; a sincronização automática (para dashboards e relatórios usarem dados do ERP) entra quando o servidor estiver ligado." />
      <div className="mb-6 max-w-sm"><Medidor rotulo="Sistemas conectados" usado={reais.length} limite={direitos.sistemas} /></div>
      <div className="mb-8"><Aviso>Por segurança, as credenciais do seu ERP não ficam neste painel. No modo de teste elas são informadas na hora, em "Consultar o ERP ao vivo", e ficam só no seu navegador. No servidor elas passam a ficar num cofre criptografado.</Aviso></div>

      <section className="folha folha-secao mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Dados de demonstração</h2><p className="text-sm text-muted-foreground">Vendas, contas a receber e a pagar e estoque de uma empresa fictícia (Distribuidora Aurora). Bom para testar tudo sem conectar nada.</p></div>
          {temDemo ? (
            <Button variant="outline" className="bg-card" onClick={() => void agir(() => S.removerConexao(usuario, empresa, lista.find((c) => c.slug === "demo")!.id), "Demonstração desativada.")}>Desativar</Button>
          ) : (
            <Button onClick={() => void agir(() => S.adicionarConexao(usuario, empresa, "demo", "Demonstração"), "Demonstração ativada.")}>Ativar demonstração</Button>
          )}
        </div>
      </section>

      <h2 className="titulo-passo mb-3">Sistemas disponíveis</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {SISTEMAS.map((sis) => {
          const con = reais.find((c) => c.slug === sis.slug);
          return (
            <article key={sis.slug} className="folha folha-secao flex flex-col justify-between gap-3">
              <div><div className="flex items-center gap-2"><Plug className="size-4 text-muted-foreground" aria-hidden /><h3 className="font-semibold">{sis.nome}</h3></div><p className="mt-1 text-sm text-muted-foreground">{sis.categoria}</p></div>
              <div className="flex flex-wrap gap-2">
                {con ? (
                  <>
                    <Button asChild size="sm"><Link to="/chat">Consultar ao vivo</Link></Button>
                    <Button size="sm" variant="ghost" aria-label={`Remover ${sis.nome}`} onClick={() => void agir(() => S.removerConexao(usuario, empresa, con.id), "Conexão removida.")}><Trash2 className="mr-1.5 size-4" />Remover</Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" className="bg-card" onClick={() => void agir(() => S.adicionarConexao(usuario, empresa, sis.slug, sis.nome), `${sis.nome} adicionado.`)}>Adicionar</Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="dica mt-6">Seu ERP não está na lista? Documentamos a API dele e liberamos para você. Fale com a nossa equipe.</p>
    </>
  );
}
