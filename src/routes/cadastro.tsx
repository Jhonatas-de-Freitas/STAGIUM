import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useSessao } from "@/components/painel/contexto";
import { Campo, PaginaDeAcesso } from "@/components/painel/pagina-de-acesso";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PLANOS, TESTE_GRATIS, planoPorId } from "@/lib/planos";
import * as S from "@/lib/saas/servico";

export const Route = createFileRoute("/cadastro")({
  validateSearch: (b: Record<string, unknown>) => (typeof b["plano"] === "string" ? { plano: b["plano"] as string } : {}) as { plano?: string },
  head: () => ({ meta: [{ title: "Criar conta — Stagium" }, { name: "description", content: "Comece 14 dias grátis. Sem cartão." }] }),
  component: Cadastro,
});

function Cadastro() {
  const s = useSessao();
  const { plano: planoPedido } = Route.useSearch();
  const navegar = useNavigate();
  const [f, setF] = useState({ empresa: "", documento: "", nome: "", email: "", senha: "", plano: planoPedido && PLANOS.some((p) => p.id === planoPedido) ? planoPedido : "profissional" });
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aberto, setAberto] = useState(true);
  const mudar = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    void S.obterConfig().then((c) => setAberto(c.cadastroPublico));
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await S.cadastrarEmpresa({ empresa: f.empresa, documento: f.documento, nome: f.nome, email: f.email, senha: f.senha, planoId: f.plano });
      await s.entrar(f.email, f.senha);
      await navegar({ to: "/app" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto)
    return (
      <PaginaDeAcesso titulo="Cadastro fechado" texto="No momento só entram clientes por convite da nossa equipe. Fale com a gente para receber o seu acesso.">
        <Button asChild variant="outline" className="bg-card"><Link to="/entrar">Já tenho conta</Link></Button>
      </PaginaDeAcesso>
    );

  return (
    <PaginaDeAcesso
      titulo="Criar conta"
      texto={`${TESTE_GRATIS.dias} dias grátis, sem cartão. Você escolhe o plano agora só para ver o que cada um inclui; a cobrança só começa se você decidir assinar.`}
      rodape={<p>Já tem conta? <Link to="/entrar" className="font-medium text-foreground underline">Entrar</Link></p>}
    >
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo rotulo="Nome da empresa"><Input value={f.empresa} onChange={mudar("empresa")} required /></Campo>
        <Campo rotulo="CNPJ (opcional)"><Input value={f.documento} onChange={mudar("documento")} inputMode="numeric" /></Campo>
        <Campo rotulo="Seu nome"><Input value={f.nome} onChange={mudar("nome")} autoComplete="name" required /></Campo>
        <Campo rotulo="Seu e-mail"><Input type="email" value={f.email} onChange={mudar("email")} autoComplete="username" required /></Campo>
        <Campo rotulo="Senha" dica="Pelo menos 8 caracteres, com letras e números."><Input type="password" value={f.senha} onChange={mudar("senha")} autoComplete="new-password" required /></Campo>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Plano que quero conhecer</legend>
          <div className="grid gap-2">
            {PLANOS.map((p) => (
              <label key={p.id} className={`flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 text-sm ${f.plano === p.id ? "ring-2 ring-[var(--marca)]" : ""}`}>
                <input type="radio" name="plano" className="mt-1" checked={f.plano === p.id} onChange={() => setF((x) => ({ ...x, plano: p.id }))} />
                <span><strong>{p.nome}</strong> — <span className="text-muted-foreground">{p.resumo}</span></span>
              </label>
            ))}
          </div>
          <p className="dica mt-1">Durante o teste valem os limites do teste, com os recursos do Profissional. Plano escolhido: {planoPorId(f.plano).nome}.</p>
        </fieldset>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={aceite} onCheckedChange={(v) => setAceite(v === true)} className="mt-0.5" />
          <span>Concordo em usar o Stagium só para ler dados que minha empresa tem direito de acessar, e entendo que ele nunca altera nada nos meus sistemas.</span>
        </label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="w-full" disabled={enviando || !aceite || !f.empresa || !f.nome || !f.email || !f.senha}>
          {enviando ? "Criando..." : "Criar conta e começar o teste"}
        </Button>
      </form>
    </PaginaDeAcesso>
  );
}
