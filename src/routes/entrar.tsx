import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Campo, PaginaDeAcesso } from "@/components/painel/pagina-de-acesso";
import { useSessao } from "@/components/painel/contexto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as S from "@/lib/saas/servico";

export const Route = createFileRoute("/entrar")({
  head: () => ({ meta: [{ title: "Entrar — Stagium" }] }),
  component: Entrar,
});

function Entrar() {
  const s = useSessao();
  const navegar = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [semAdmin, setSemAdmin] = useState(false);
  const [cadastroAberto, setCadastroAberto] = useState(true);

  useEffect(() => {
    void S.existeSuperadmin().then((x) => setSemAdmin(!x));
    void S.obterConfig().then((c) => setCadastroAberto(c.cadastroPublico));
  }, []);

  useEffect(() => {
    if (!s.carregando && s.usuario) void navegar({ to: s.usuario.papel === "superadmin" && !s.personificando ? "/admin" : "/app" });
  }, [s.carregando, s.usuario, s.personificando, navegar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await s.entrar(email, senha);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  async function demo() {
    try {
      await S.entrarComoDemo();
      await s.recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir a demonstração.");
    }
  }

  return (
    <PaginaDeAcesso
      titulo="Entrar"
      texto="Acesse o painel da sua empresa."
      rodape={
        <div className="space-y-2">
          {cadastroAberto && (
            <p>
              Ainda não tem conta? <Link to="/cadastro" className="font-medium text-foreground underline">Comece o teste grátis</Link>.
            </p>
          )}
          {semAdmin && (
            <p>
              Primeira vez neste ambiente? <Link to="/configurar" className="font-medium text-foreground underline">Configure o administrador da plataforma</Link>.
            </p>
          )}
        </div>
      }
    >
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo rotulo="E-mail">
          <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Campo>
        <Campo rotulo="Senha">
          <Input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </Campo>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="w-full" disabled={enviando || !email || !senha}>
          {enviando ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <div className="mt-8 border-t pt-6">
        <p className="text-sm text-muted-foreground">Quer só olhar? Abra uma empresa fictícia com dados de exemplo, sem cadastro.</p>
        <Button variant="outline" className="mt-3 w-full bg-card" onClick={demo}>
          Explorar com dados de demonstração
        </Button>
      </div>
    </PaginaDeAcesso>
  );
}
