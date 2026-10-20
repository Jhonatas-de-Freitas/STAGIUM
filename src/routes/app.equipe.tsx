import { createFileRoute } from "@tanstack/react-router";
import { Copy, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Cabecalho } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { Medidor } from "@/components/painel/medidor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DESCRICAO_PAPEL, ROTULO_PAPEL } from "@/lib/saas/direitos";
import * as S from "@/lib/saas/servico";
import type { Convite, PapelEmpresa, Usuario } from "@/lib/saas/tipos";

export const Route = createFileRoute("/app/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Stagium" }] }),
  component: Equipe,
});

const PAPEIS: PapelEmpresa[] = ["admin", "analista", "leitor", "dono"];

function Equipe() {
  const s = useSessao();
  const { empresa, usuario, direitos } = s;
  const [pessoas, setPessoas] = useState<Usuario[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<PapelEmpresa>("analista");
  const carregar = useCallback(async () => {
    if (!empresa) return;
    setPessoas(await S.listarUsuarios(empresa.id));
    setConvites(await S.listarConvites(empresa.id));
  }, [empresa]);
  useEffect(() => { void carregar(); }, [carregar]);
  if (!empresa || !usuario || !direitos) return null;
  const link = (c: Convite) => `${window.location.origin}/convite/${c.id}`;
  const falha = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro.");

  async function convidar() {
    try {
      const c = await S.criarConvite(usuario!, empresa!, email, papel);
      setEmail("");
      await carregar();
      await navigator.clipboard?.writeText(link(c)).catch(() => undefined);
      toast.success("Convite criado. O link foi copiado: envie para a pessoa.");
    } catch (e) { falha(e); }
  }
  async function mudar(u: Usuario, m: { papel?: PapelEmpresa; ativo?: boolean }) {
    try { await S.alterarUsuario(usuario!, u.id, m); await carregar(); } catch (e) { falha(e); }
  }

  return (
    <>
      <Cabecalho titulo="Equipe" texto="Quem da sua empresa acessa o painel, e o que cada pessoa pode fazer." />
      <div className="mb-8 max-w-sm"><Medidor rotulo="Pessoas ativas + convites" usado={pessoas.filter((p) => p.ativo).length + convites.length} limite={direitos.usuarios} /></div>

      <section className="folha folha-secao mb-8" aria-label="Convidar">
        <h2 className="titulo-passo mb-3">Convidar pessoa</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">E-mail<Input className="mt-1 w-72" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com.br" /></label>
          <div><span className="mb-1 block text-sm">Papel</span>
            <Select value={papel} onValueChange={(v) => setPapel(v as PapelEmpresa)}><SelectTrigger className="w-48" aria-label="Papel"><SelectValue /></SelectTrigger><SelectContent>{PAPEIS.map((p) => <SelectItem key={p} value={p}>{ROTULO_PAPEL[p]}</SelectItem>)}</SelectContent></Select></div>
          <Button onClick={() => void convidar()} disabled={!email.trim()}><UserPlus className="mr-2 size-4" />Criar convite</Button>
        </div>
        <p className="dica mt-2">{DESCRICAO_PAPEL[papel]} O convite vale 7 dias e vira um link para a pessoa criar a própria senha.</p>
        {convites.length > 0 && (
          <ul className="mt-4 space-y-2">
            {convites.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                <span>{c.email} · {ROTULO_PAPEL[c.papel]} · expira em {new Date(c.expiraEm).toLocaleDateString("pt-BR")}</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={async () => { await navigator.clipboard?.writeText(link(c)).catch(() => undefined); toast.success("Link copiado."); }}><Copy className="mr-1.5 size-4" />Copiar link</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await S.cancelarConvite(c.id); await carregar(); }}>Cancelar</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="titulo-passo mb-3">Pessoas</h2>
      <div className="grade-rolagem"><table className="w-full text-sm">
        <thead className="bg-[var(--grade-cabecalho)] text-left"><tr><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Papel</th><th className="px-3 py-2">Último acesso</th><th className="px-3 py-2">Situação</th></tr></thead>
        <tbody>
          {pessoas.map((p) => {
            const eu = p.id === usuario.id;
            return (
              <tr key={p.id} className="border-t align-middle">
                <td className="px-3 py-2"><div className="font-medium">{p.nome}{eu && " (você)"}</div><div className="text-xs text-muted-foreground">{p.email}</div></td>
                <td className="px-3 py-2">
                  {eu ? ROTULO_PAPEL[p.papel] : (
                    <Select value={p.papel} onValueChange={(v) => void mudar(p, { papel: v as PapelEmpresa })}><SelectTrigger className="w-40" aria-label={`Papel de ${p.nome}`}><SelectValue /></SelectTrigger><SelectContent>{PAPEIS.map((r) => <SelectItem key={r} value={r}>{ROTULO_PAPEL[r]}</SelectItem>)}</SelectContent></Select>
                  )}
                </td>
                <td className="px-3 py-2">{p.ultimoAcesso ? new Date(p.ultimoAcesso).toLocaleString("pt-BR") : "Nunca entrou"}</td>
                <td className="px-3 py-2">{eu ? "Ativo" : <Button size="sm" variant="outline" className="bg-card" onClick={() => void mudar(p, { ativo: !p.ativo })}>{p.ativo ? "Desativar" : "Reativar"}</Button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </>
  );
}
