import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, KeyRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Aviso, Cabecalho } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { Medidor } from "@/components/painel/medidor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CUSTO_CREDITO_IA_REAIS, PLANOS, planoPorId, type Direitos } from "@/lib/planos";
import { diasRestantes, direitosDaEmpresa, ROTULO_PAPEL } from "@/lib/saas/direitos";
import * as S from "@/lib/saas/servico";
import type { Empresa, EventoAuditoria, RegistroUso, StatusEmpresa, Usuario } from "@/lib/saas/tipos";

export const Route = createFileRoute("/admin/clientes/$id")({ component: Ficha });

const LIMITES: { chave: keyof Pick<Direitos, "sistemas" | "consultasMes" | "usuarios" | "dashboards" | "creditosIaMes" | "relatoriosAgendados" | "alertas">; rotulo: string }[] = [
  { chave: "sistemas", rotulo: "Sistemas" }, { chave: "consultasMes", rotulo: "Consultas/mês" }, { chave: "usuarios", rotulo: "Pessoas" },
  { chave: "dashboards", rotulo: "Dashboards" }, { chave: "creditosIaMes", rotulo: "Créditos de IA/mês" }, { chave: "relatoriosAgendados", rotulo: "Relatórios agendados" }, { chave: "alertas", rotulo: "Alertas" },
];

function Ficha() {
  const { id } = Route.useParams();
  const s = useSessao();
  const navegar = useNavigate();
  const [e, setE] = useState<Empresa | null | undefined>(undefined);
  const [pessoas, setPessoas] = useState<Usuario[]>([]);
  const [uso, setUso] = useState<RegistroUso | null>(null);
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [obs, setObs] = useState("");
  const [lim, setLim] = useState<Record<string, string>>({});
  const [temp, setTemp] = useState<{ email: string; senha: string } | null>(null);

  const carregar = useCallback(async () => {
    const emp = await S.obterEmpresa(id);
    setE(emp ?? null);
    if (!emp) return;
    setObs(emp.observacao);
    setLim(Object.fromEntries(LIMITES.map((l) => [l.chave, emp.limitesEspeciais[l.chave] !== undefined ? String(emp.limitesEspeciais[l.chave]) : ""])));
    setPessoas(await S.listarUsuarios(emp.id));
    setUso(await S.lerUso(emp.id));
    setEventos((await S.listarAuditoria(emp)).slice(0, 12));
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);

  if (e === undefined) return null;
  if (e === null) return <Aviso tipo="alerta">Empresa não encontrada. <Link to="/admin/clientes" className="underline">Voltar</Link></Aviso>;
  const quem = s.usuario!;
  const d = direitosDaEmpresa(e);
  const plano = planoPorId(e.planoId);
  const falha = (x: unknown) => toast.error(x instanceof Error ? x.message : "Erro.");
  const mudar = async (m: Partial<Empresa>, ok = "Salvo.") => { try { await S.alterarEmpresa(quem, e.id, m); await carregar(); toast.success(ok); } catch (x) { falha(x); } };

  async function salvarLimites() {
    const especiais: Partial<Direitos> = {};
    for (const l of LIMITES) {
      const v = (lim[l.chave] ?? "").trim().toLowerCase();
      if (v === "") continue;
      (especiais as Record<string, number | null>)[l.chave] = v === "ilimitado" ? null : Number(v.replace(/\D/g, ""));
    }
    await mudar({ limitesEspeciais: especiais }, "Limites especiais salvos.");
  }
  async function verComoCliente() {
    await S.personificar(e!.id);
    await s.recarregar();
    void navegar({ to: "/app" });
  }

  return (
    <>
      <Cabecalho titulo={e.nome} texto={`${e.documento || "Sem documento"} · cliente desde ${new Date(e.criadaEm).toLocaleDateString("pt-BR")} · ${e.origem === "concedido" ? "acesso concedido" : "cadastro próprio"}`}
        acoes={<Button onClick={() => void verComoCliente()}><Eye className="mr-2 size-4" />Ver como cliente</Button>} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="folha folha-secao space-y-4" aria-label="Plano e situação">
          <h2 className="titulo-passo">Plano e situação</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><span className="mb-1 block text-sm">Plano</span><Select value={e.planoId} onValueChange={(v) => void mudar({ planoId: v })}><SelectTrigger aria-label="Plano"><SelectValue /></SelectTrigger><SelectContent>{PLANOS.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select></div>
            <div><span className="mb-1 block text-sm">Situação</span><Select value={e.status} onValueChange={(v) => void mudar({ status: v as StatusEmpresa, ...(v === "ativa" ? { testeAte: null } : {}) })}><SelectTrigger aria-label="Situação"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="teste">Teste grátis</SelectItem><SelectItem value="ativa">Ativa</SelectItem><SelectItem value="suspensa">Suspensa</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select></div>
            <div><span className="mb-1 block text-sm">Ciclo</span><Select value={e.ciclo} onValueChange={(v) => void mudar({ ciclo: v as Empresa["ciclo"] })}><SelectTrigger aria-label="Ciclo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="anual">Anual</SelectItem></SelectContent></Select></div>
            <div><span className="mb-1 block text-sm">Cobrança</span><Select value={e.cortesia ? "cortesia" : "paga"} onValueChange={(v) => void mudar({ cortesia: v === "cortesia", ...(v === "paga" ? { cortesiaAte: null } : {}) })}><SelectTrigger aria-label="Cobrança"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="paga">Cobrada</SelectItem><SelectItem value="cortesia">Cortesia</SelectItem></SelectContent></Select></div>
          </div>
          <p className="text-sm text-muted-foreground">
            {e.status === "teste" ? `Teste termina em ${Math.max(0, diasRestantes(e.testeAte) ?? 0)} dia(s).` : e.cortesia ? (e.cortesiaAte ? `Cortesia até ${new Date(e.cortesiaAte).toLocaleDateString("pt-BR")}.` : "Cortesia sem prazo.") : `${plano.nome}, ${S.receitaMensal(e) ? `receita de ${S.receitaMensal(e).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês` : "sem receita"}.`}
          </p>
          {(e.status === "teste" || e.status === "suspensa") && (
            <div className="flex flex-wrap gap-2"><span className="self-center text-sm">Estender teste:</span>{[7, 14, 30].map((n) => <Button key={n} size="sm" variant="outline" className="bg-card" onClick={async () => { try { await S.estenderTeste(quem, e, n); await carregar(); toast.success(`+${n} dias.`); } catch (x) { falha(x); } }}>+{n} dias</Button>)}</div>
          )}
          <div><span className="mb-1 block text-sm">Observação interna</span><Textarea rows={2} value={obs} onChange={(x) => setObs(x.target.value)} onBlur={() => obs !== e.observacao && void mudar({ observacao: obs })} /></div>
        </section>

        <section className="folha folha-secao space-y-4" aria-label="Uso">
          <h2 className="titulo-passo">Uso neste mês</h2>
          <Medidor rotulo="Consultas" usado={uso?.consultas ?? 0} limite={d.consultasMes} />
          <Medidor rotulo="Créditos de IA" usado={uso?.creditosIa ?? 0} limite={d.creditosIaMes} />
          <p className="dica">Custo estimado de IA: ~{((uso?.creditosIa ?? 0) * CUSTO_CREDITO_IA_REAIS).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (R$ 0,05 por crédito, estimativa no pior caso).</p>
        </section>

        <section className="folha folha-secao space-y-3 lg:col-span-2" aria-label="Limites especiais">
          <h2 className="titulo-passo">Limites especiais (negociação)</h2>
          <p className="text-sm text-muted-foreground">Vazio = vale o limite do plano ({plano.nome}). Escreva um número, ou "ilimitado".</p>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {LIMITES.map((l) => <label key={l.chave} className="block text-sm">{l.rotulo}<Input className="mt-1" value={lim[l.chave] ?? ""} placeholder={String(plano.direitos[l.chave] ?? "ilimitado")} onChange={(x) => setLim({ ...lim, [l.chave]: x.target.value })} /></label>)}
          </div>
          <Button variant="outline" className="bg-card" onClick={() => void salvarLimites()}>Salvar limites</Button>
        </section>

        <section className="lg:col-span-2" aria-label="Pessoas">
          <h2 className="titulo-passo mb-3">Pessoas</h2>
          {temp && <div className="mb-3"><Aviso>Nova senha temporária de {temp.email}: <code className="font-mono font-semibold">{temp.senha}</code>. Copie agora, ela não aparece de novo.</Aviso></div>}
          <div className="grade-rolagem"><table className="w-full text-sm"><thead className="bg-[var(--grade-cabecalho)] text-left"><tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Papel</th><th className="px-3 py-2">Último acesso</th><th className="px-3 py-2">Ações</th></tr></thead>
            <tbody>{pessoas.map((p) => <tr key={p.id} className="border-t"><td className="px-3 py-2"><div className="font-medium">{p.nome}{!p.ativo && " (inativo)"}</div><div className="text-xs text-muted-foreground">{p.email}</div></td><td className="px-3 py-2">{ROTULO_PAPEL[p.papel]}</td><td className="px-3 py-2">{p.ultimoAcesso ? new Date(p.ultimoAcesso).toLocaleString("pt-BR") : "Nunca"}</td>
              <td className="px-3 py-2"><Button size="sm" variant="ghost" onClick={async () => { try { setTemp({ email: p.email, senha: await S.redefinirSenhaTemporaria(quem, p.id) }); await carregar(); } catch (x) { falha(x); } }}><KeyRound className="mr-1.5 size-4" />Nova senha temporária</Button></td></tr>)}</tbody></table></div>
        </section>

        <section className="lg:col-span-2" aria-label="Atividade">
          <h2 className="titulo-passo mb-3">Atividade recente</h2>
          {eventos.length === 0 ? <p className="text-sm text-muted-foreground">Sem atividade registrada.</p> : <ul className="space-y-1 text-sm">{eventos.map((x) => <li key={x.id} className="border-b py-1"><span className="text-muted-foreground">{new Date(x.em).toLocaleString("pt-BR")}</span> · {x.usuarioNome}: {x.detalhe}</li>)}</ul>}
        </section>

        <section className="lg:col-span-2" aria-label="Zona de risco">
          <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium" style={{ color: "var(--ruim)" }}>Excluir empresa e todos os dados</summary>
            <p className="my-3 text-sm text-muted-foreground">Use para pedido de exclusão (LGPD). Apaga pessoas, dashboards, relatórios, bases e histórico. Não dá para desfazer.</p>
            <Button variant="destructive" onClick={async () => { if (!window.confirm(`Excluir ${e.nome} definitivamente?`)) return; await S.excluirEmpresa(quem, e); void navegar({ to: "/admin/clientes" }); }}>Excluir definitivamente</Button></details>
        </section>
      </div>
    </>
  );
}
