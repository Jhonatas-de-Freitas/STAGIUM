import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useSessao } from "@/components/painel/contexto";
import { Campo, PaginaDeAcesso } from "@/components/painel/pagina-de-acesso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROTULO_PAPEL } from "@/lib/saas/direitos";
import * as S from "@/lib/saas/servico";
import type { Convite, Empresa } from "@/lib/saas/tipos";

export const Route = createFileRoute("/convite/$codigo")({
  head: () => ({ meta: [{ title: "Convite — Stagium" }] }),
  component: AceitarConvite,
});

function AceitarConvite() {
  const { codigo } = Route.useParams();
  const s = useSessao();
  const navegar = useNavigate();
  const [convite, setConvite] = useState<Convite | null | undefined>(undefined);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    void S.obterConvite(codigo).then(async (c) => {
      setConvite(c);
      if (c) setEmpresa(await S.obterEmpresa(c.empresaId));
    });
  }, [codigo]);

  if (convite === undefined) return <PaginaDeAcesso titulo="Convite">Carregando...</PaginaDeAcesso>;
  if (!convite)
    return (
      <PaginaDeAcesso titulo="Convite inválido" texto="Este convite expirou ou já foi usado. Peça um novo para quem convidou você." />
    );

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      const u = await S.aceitarConvite(codigo, nome, senha);
      await s.entrar(u.email, senha);
      await navegar({ to: "/app" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível aceitar o convite.");
    }
  }

  return (
    <PaginaDeAcesso titulo="Você foi convidado" texto={`${empresa?.nome ?? "Uma empresa"} convidou ${convite.email} como ${ROTULO_PAPEL[convite.papel]}.`}>
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo rotulo="Seu nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} required /></Campo>
        <Campo rotulo="Crie uma senha" dica="Pelo menos 8 caracteres, com letras e números."><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required /></Campo>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="w-full" disabled={!nome || !senha}>Entrar na equipe</Button>
      </form>
    </PaginaDeAcesso>
  );
}
