import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Aviso, Cabecalho } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { Campo } from "@/components/painel/pagina-de-acesso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { podeFazer } from "@/lib/saas/direitos";
import * as S from "@/lib/saas/servico";
import type { EventoAuditoria } from "@/lib/saas/tipos";

export const Route = createFileRoute("/app/seguranca")({
  head: () => ({ meta: [{ title: "Segurança e auditoria — Stagium" }] }),
  component: Seguranca,
});

const ACOES: Record<string, string> = {
  cadastro: "Cadastro", concessao: "Acesso concedido", senha: "Senha", empresa: "Empresa", plano: "Plano", equipe: "Equipe",
  conexao: "Conexões", dados: "Dados", dashboard: "Dashboards", relatorio: "Relatórios", alerta: "Alertas", lgpd: "LGPD", login: "Acesso",
};

function Seguranca() {
  const s = useSessao();
  const navegar = useNavigate();
  const { empresa, usuario, direitos } = s;
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [filtro, setFiltro] = useState("todas");
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const carregar = useCallback(async () => { if (empresa) setEventos(await S.listarAuditoria(empresa)); }, [empresa]);
  useEffect(() => { void carregar(); }, [carregar]);
  const mostrados = useMemo(() => eventos.filter((e) => filtro === "todas" || e.acao === filtro), [eventos, filtro]);
  if (!empresa || !usuario || !direitos) return null;
  const dono = podeFazer(usuario.papel, "exportarEmpresa");

  async function exportar() {
    const dados = await S.exportarDadosDaEmpresa(usuario!, empresa!);
    const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `stagium-${empresa!.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    await carregar();
  }

  return (
    <>
      <Cabecalho titulo="Segurança e auditoria" texto="Quem fez o quê no painel da sua empresa, a sua senha e os seus direitos sobre os dados (LGPD)." />

      <section className="folha folha-secao mb-8 max-w-md" aria-label="Senha">
        <h2 className="titulo-passo mb-3">Trocar minha senha</h2>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          try { await S.trocarSenha(usuario.id, atual, nova); setAtual(""); setNova(""); toast.success("Senha alterada."); await carregar(); }
          catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); }
        }}>
          <Campo rotulo="Senha atual"><Input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" /></Campo>
          <Campo rotulo="Nova senha" dica="Pelo menos 8 caracteres, com letras e números."><Input type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" /></Campo>
          <Button type="submit" disabled={!atual || !nova}>Trocar senha</Button>
        </form>
      </section>

      <section className="mb-10" aria-label="Auditoria">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="titulo-passo">Histórico de atividades <span className="font-normal text-muted-foreground">(últimos {direitos.auditoriaDias} dias)</span></h2>
          <Select value={filtro} onValueChange={setFiltro}><SelectTrigger className="w-48" aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todos os tipos</SelectItem>{[...new Set(eventos.map((e) => e.acao))].map((a) => <SelectItem key={a} value={a}>{ACOES[a] ?? a}</SelectItem>)}</SelectContent></Select>
        </div>
        {mostrados.length === 0 ? <p className="text-sm text-muted-foreground">Nada registrado neste período.</p> : (
          <div className="grade-rolagem max-h-[28rem]"><table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--grade-cabecalho)] text-left"><tr><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Quem</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">O que aconteceu</th></tr></thead>
            <tbody>{mostrados.slice(0, 300).map((e) => (
              <tr key={e.id} className="border-t align-top"><td className="whitespace-nowrap px-3 py-1.5">{new Date(e.em).toLocaleString("pt-BR")}</td><td className="px-3 py-1.5">{e.usuarioNome}</td><td className="px-3 py-1.5">{ACOES[e.acao] ?? e.acao}</td><td className="px-3 py-1.5">{e.detalhe}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="mb-10" aria-label="LGPD">
        <h2 className="titulo-passo mb-3">Seus dados (LGPD)</h2>
        <div className="folha folha-secao space-y-4">
          <p className="text-sm text-muted-foreground">O Stagium só lê dados do seu ERP, nunca escreve nele. Dados pessoais não são enviados à IA: ela recebe apenas os nomes das colunas. Você pode levar tudo embora ou apagar tudo a qualquer momento.</p>
          <div className="flex flex-wrap gap-3">
            {direitos.exportarDadosEmpresa && dono ? (
              <Button variant="outline" className="bg-card" onClick={() => void exportar()}><Download className="mr-2 size-4" />Baixar todos os dados da empresa (JSON)</Button>
            ) : <p className="text-sm text-muted-foreground">{dono ? "A exportação completa está no plano Profissional ou superior. Para pedir os seus dados em qualquer plano, escreva para a nossa equipe." : "Só o dono da empresa exporta ou apaga os dados."}</p>}
          </div>
          {dono && (
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium" style={{ color: "var(--ruim)" }}>Excluir a empresa e todos os dados</summary>
              <div className="mt-3 space-y-3">
                <Aviso tipo="alerta">Isso apaga a empresa, as pessoas, dashboards, relatórios, bases e o histórico. Não dá para desfazer.</Aviso>
                <Campo rotulo={`Digite "${empresa.nome}" para confirmar`}><Input value={confirma} onChange={(e) => setConfirma(e.target.value)} /></Campo>
                <Button variant="destructive" disabled={confirma !== empresa.nome} onClick={async () => { await S.excluirEmpresa(usuario, empresa); await s.recarregar(); void navegar({ to: "/" }); }}>Excluir tudo</Button>
              </div>
            </details>
          )}
        </div>
      </section>
    </>
  );
}
