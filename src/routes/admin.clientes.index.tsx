import { Link, createFileRoute } from "@tanstack/react-router";
import { Copy, KeyRound, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Cabecalho, Vazio } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { Campo } from "@/components/painel/pagina-de-acesso";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PLANOS, TESTE_GRATIS, planoPorId } from "@/lib/planos";
import { diasRestantes } from "@/lib/saas/direitos";
import * as S from "@/lib/saas/servico";
import type { Empresa } from "@/lib/saas/tipos";

export const Route = createFileRoute("/admin/clientes/")({ component: Clientes });

export function rotuloDaSituacao(e: Empresa) {
  if (e.status === "teste") return `Teste · ${Math.max(0, diasRestantes(e.testeAte) ?? 0)}d`;
  if (e.status === "ativa") return e.cortesia ? "Cortesia" : "Ativa";
  return e.status === "suspensa" ? "Suspensa" : "Cancelada";
}

function Clientes() {
  const sessao = useSessao();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("todos");
  const [novo, setNovo] = useState(false);
  const carregar = useCallback(async () => setEmpresas((await S.listarEmpresas()).filter((e) => e.origem !== "demo")), []);
  useEffect(() => { void carregar(); }, [carregar]);
  const lista = useMemo(() => empresas.filter((e) => (status === "todos" || e.status === status) && e.nome.toLowerCase().includes(busca.toLowerCase())), [empresas, busca, status]);

  return (
    <>
      <Cabecalho titulo="Clientes" texto="Todas as empresas com acesso ao painel." acoes={<Button onClick={() => setNovo(true)}><Plus className="mr-2 size-4" />Conceder acesso</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="w-64" placeholder="Buscar empresa" aria-label="Buscar empresa" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-44" aria-label="Situação"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas as situações</SelectItem><SelectItem value="teste">Em teste</SelectItem><SelectItem value="ativa">Ativas</SelectItem><SelectItem value="suspensa">Suspensas</SelectItem><SelectItem value="cancelada">Canceladas</SelectItem></SelectContent></Select>
      </div>
      {lista.length === 0 ? <Vazio titulo="Nenhum cliente por aqui" texto="Conceda um acesso de teste, pago ou cortesia para começar." acao={<Button onClick={() => setNovo(true)}>Conceder acesso</Button>} /> : (
        <div className="grade-rolagem"><table className="w-full text-sm">
          <thead className="bg-[var(--grade-cabecalho)] text-left"><tr><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Plano</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Criada em</th></tr></thead>
          <tbody>{lista.map((e) => <tr key={e.id} className="border-t"><td className="px-3 py-2"><Link to="/admin/clientes/$id" params={{ id: e.id }} className="font-medium underline">{e.nome}</Link></td><td className="px-3 py-2">{planoPorId(e.planoId).nome}{e.ciclo === "anual" && " (anual)"}</td><td className="px-3 py-2">{rotuloDaSituacao(e)}</td><td className="px-3 py-2">{e.origem === "concedido" ? "Concedido" : "Cadastro"}</td><td className="px-3 py-2">{new Date(e.criadaEm).toLocaleDateString("pt-BR")}</td></tr>)}</tbody>
        </table></div>
      )}
      {novo && sessao.usuario && <ConcederAcesso aoFechar={() => { setNovo(false); void carregar(); }} />}
    </>
  );
}

function ConcederAcesso({ aoFechar }: { aoFechar: () => void }) {
  const { usuario } = useSessao();
  const [f, setF] = useState({ empresa: "", documento: "", nome: "", email: "", planoId: "profissional", tipo: "teste" as "teste" | "pago" | "cortesia", dias: String(TESTE_GRATIS.dias), ciclo: "mensal" as "mensal" | "anual", observacao: "" });
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<{ empresa: Empresa; email: string; senha: string } | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/entrar`;

  async function criar() {
    setErro("");
    try {
      const dias = Number(f.dias.replace(/\D/g, "")) || undefined;
      const r = await S.concederAcesso(usuario!, {
        empresa: f.empresa, documento: f.documento, responsavelNome: f.nome, responsavelEmail: f.email, planoId: f.planoId, tipo: f.tipo,
        ...(f.tipo !== "pago" && dias ? { dias } : {}), ciclo: f.ciclo, observacao: f.observacao,
      });
      setFeito({ empresa: r.empresa, email: r.usuario.email, senha: r.senhaTemporaria });
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro."); }
  }
  const texto = feito ? `Acesso ao Stagium\nEndereço: ${link}\nE-mail: ${feito.email}\nSenha temporária: ${feito.senha}\n(você vai criar a sua senha no primeiro acesso)` : "";

  return (
    <Dialog open onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-w-lg">
        {feito ? (
          <>
            <DialogHeader><DialogTitle>Acesso criado para {feito.empresa.nome}</DialogTitle><DialogDescription>Copie e envie agora. Por segurança, a senha temporária não aparece de novo (dá para gerar outra na ficha do cliente).</DialogDescription></DialogHeader>
            <pre className="whitespace-pre-wrap rounded-md border bg-secondary p-3 text-sm">{texto}</pre>
            <DialogFooter><Button variant="outline" className="bg-card" onClick={async () => { await navigator.clipboard?.writeText(texto).catch(() => undefined); toast.success("Copiado."); }}><Copy className="mr-2 size-4" />Copiar</Button><Button onClick={aoFechar}>Concluir</Button></DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader><DialogTitle>Conceder acesso</DialogTitle><DialogDescription>Cria a empresa e o usuário dono, com senha temporária.</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Campo rotulo="Empresa"><Input value={f.empresa} onChange={(e) => set({ empresa: e.target.value })} /></Campo></div>
              <Campo rotulo="Responsável"><Input value={f.nome} onChange={(e) => set({ nome: e.target.value })} autoComplete="off" /></Campo>
              <Campo rotulo="E-mail do responsável"><Input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} autoComplete="off" /></Campo>
              <div><span className="mb-1.5 block text-sm font-medium">Plano</span><Select value={f.planoId} onValueChange={(v) => set({ planoId: v })}><SelectTrigger aria-label="Plano"><SelectValue /></SelectTrigger><SelectContent>{PLANOS.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select></div>
              <div><span className="mb-1.5 block text-sm font-medium">Tipo de acesso</span><Select value={f.tipo} onValueChange={(v) => set({ tipo: v as typeof f.tipo, dias: v === "teste" ? String(TESTE_GRATIS.dias) : "" })}><SelectTrigger aria-label="Tipo de acesso"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="teste">Teste grátis</SelectItem><SelectItem value="pago">Plano pago</SelectItem><SelectItem value="cortesia">Cortesia (sem cobrança)</SelectItem></SelectContent></Select></div>
              {f.tipo !== "pago" && <Campo rotulo={f.tipo === "teste" ? "Dias de teste" : "Dias de cortesia"} dica={f.tipo === "cortesia" ? "Vazio = sem prazo." : undefined}><Input inputMode="numeric" value={f.dias} onChange={(e) => set({ dias: e.target.value })} /></Campo>}
              {f.tipo === "pago" && <div><span className="mb-1.5 block text-sm font-medium">Ciclo</span><Select value={f.ciclo} onValueChange={(v) => set({ ciclo: v as typeof f.ciclo })}><SelectTrigger aria-label="Ciclo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="anual">Anual (2 meses grátis)</SelectItem></SelectContent></Select></div>}
              <div className="sm:col-span-2"><Campo rotulo="Observação interna (opcional)"><Input value={f.observacao} onChange={(e) => set({ observacao: e.target.value })} placeholder="Ex.: indicação do Tom, piloto com o escritório X" /></Campo></div>
            </div>
            {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
            <DialogFooter><Button variant="outline" className="bg-card" onClick={aoFechar}>Cancelar</Button><Button onClick={() => void criar()} disabled={!f.empresa || !f.nome || !f.email}><KeyRound className="mr-2 size-4" />Criar acesso</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
