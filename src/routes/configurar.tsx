import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useSessao } from "@/components/painel/contexto";
import { Campo, PaginaDeAcesso } from "@/components/painel/pagina-de-acesso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as S from "@/lib/saas/servico";

export const Route = createFileRoute("/configurar")({
  head: () => ({ meta: [{ title: "Configurar a plataforma — Stagium" }] }),
  component: Configurar,
});

function Configurar() {
  const s = useSessao();
  const navegar = useNavigate();
  const [livre, setLivre] = useState<boolean | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => { void S.existeSuperadmin().then((x) => setLivre(!x)); }, []);

  if (livre === false) {
    return (
      <PaginaDeAcesso titulo="Plataforma já configurada" texto="Já existe um administrador neste ambiente. Entre com a conta dele.">
        <Button onClick={() => void navegar({ to: "/entrar" })}>Ir para o login</Button>
      </PaginaDeAcesso>
    );
  }
  return (
    <PaginaDeAcesso titulo="Criar o administrador" texto="A conta da equipe Stagium. Com ela você concede acessos, muda planos e abre o painel de qualquer cliente para suporte.">
      <form className="space-y-4" noValidate onSubmit={async (e) => {
        e.preventDefault(); setErro("");
        try { await S.criarSuperadmin(nome, email, senha); await s.entrar(email, senha); void navegar({ to: "/admin" }); }
        catch (err) { setErro(err instanceof Error ? err.message : "Erro."); }
      }}>
        <Campo rotulo="Seu nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></Campo>
        <Campo rotulo="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Campo>
        <Campo rotulo="Senha" dica="Pelo menos 8 caracteres, com letras e números."><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" /></Campo>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" disabled={!nome || !email || !senha}>Criar administrador</Button>
      </form>
    </PaginaDeAcesso>
  );
}
