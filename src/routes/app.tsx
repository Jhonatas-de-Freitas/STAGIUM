import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import {
  CalendarClock,
  CreditCard,
  Database,
  Home,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Plug,
  ShieldCheck,
  TerminalSquare,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Aviso, Casca, type ItemDeMenu } from "@/components/painel/casca";
import { useGuarda, useSessao } from "@/components/painel/contexto";
import { Campo } from "@/components/painel/pagina-de-acesso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { podeFazer } from "@/lib/saas/direitos";
import { rodarVencidos } from "@/lib/saas/relatorios";
import * as S from "@/lib/saas/servico";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Painel — Stagium" }] }),
  component: LayoutApp,
});

const MOTIVOS: Record<string, { titulo: string; texto: string }> = {
  suspensa: { titulo: "Acesso suspenso", texto: "O acesso desta empresa está suspenso. Fale com a nossa equipe para regularizar; seus dados continuam guardados." },
  cancelada: { titulo: "Plano cancelado", texto: "Esta empresa cancelou o plano. Fale com a nossa equipe para reativar." },
  teste_acabou: { titulo: "O teste grátis acabou", texto: "Seus dados continuam guardados. Escolha um plano para voltar a usar o painel." },
  cortesia_acabou: { titulo: "O acesso de cortesia terminou", texto: "Escolha um plano para continuar usando o painel." },
};

function TrocaObrigatoria() {
  const s = useSessao();
  const [nova, setNova] = useState("");
  const [erro, setErro] = useState("");
  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="titulo-secao text-3xl">Crie a sua senha</h1>
      <p className="mt-2 text-muted-foreground">Você entrou com uma senha temporária. Escolha uma senha só sua para continuar.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await S.trocarSenha(s.usuario!.id, null, nova);
            await s.recarregar();
            toast.success("Senha criada.");
          } catch (err) {
            setErro(err instanceof Error ? err.message : "Erro ao trocar a senha.");
          }
        }}
      >
        <Campo rotulo="Nova senha" dica="Pelo menos 8 caracteres, com letras e números."><Input type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" /></Campo>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" disabled={!nova}>Salvar senha</Button>
      </form>
    </div>
  );
}

function LayoutApp() {
  const pronto = useGuarda("cliente");
  const s = useSessao();
  const caminho = useRouterState({ select: (r) => r.location.pathname });

  // motor local de agendamento: roda os relatórios vencidos enquanto o painel está aberto
  useEffect(() => {
    if (!pronto || !s.usuario || !s.empresa || !s.acesso?.liberado || !podeFazer(s.usuario.papel, "agendarRelatorios") || s.personificando) return;
    const { usuario, empresa, datasets } = s;
    let vivo = true;
    const rodar = async () => {
      try {
        const feitos = await rodarVencidos(usuario, empresa, datasets);
        if (vivo && feitos.length) toast.info(`${feitos.length} relatório(s) agendado(s) foram gerados. Veja em Relatórios.`);
      } catch {
        /* a próxima rodada tenta de novo */
      }
    };
    void rodar();
    const t = setInterval(rodar, 60_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [pronto, s.usuario?.id, s.empresa?.id, s.acesso?.liberado, s.datasets, s.personificando]);

  if (!pronto || !s.usuario) return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando...</div>;

  const p = s.usuario.papel;
  const itens: ItemDeMenu[] = [
    { to: "/app", rotulo: "Início", icone: Home, exato: true },
    { to: "/app/dashboards", rotulo: "Dashboards", icone: LayoutDashboard },
    { to: "/app/insights", rotulo: "Insights", icone: Lightbulb },
    ...(podeFazer(p, "usarChat") ? [{ to: "/app/chat", rotulo: "Perguntar aos dados", icone: MessageSquare }] : []),
    ...(podeFazer(p, "agendarRelatorios") ? [{ to: "/app/relatorios", rotulo: "Relatórios agendados", icone: CalendarClock }] : []),
    ...(podeFazer(p, "importarDados") ? [{ to: "/app/dados", rotulo: "Meus dados", icone: Database }] : []),
    ...(podeFazer(p, "conectarSistemas") ? [{ to: "/app/conexoes", rotulo: "Conexões com ERPs", icone: Plug }] : []),
    ...(podeFazer(p, "gerenciarEquipe") ? [{ to: "/app/equipe", rotulo: "Equipe", icone: Users }] : []),
    ...(podeFazer(p, "verPlano") ? [{ to: "/app/plano", rotulo: "Plano e cobrança", icone: CreditCard }] : []),
    ...(podeFazer(p, "verAuditoria") ? [{ to: "/app/seguranca", rotulo: "Segurança e auditoria", icone: ShieldCheck }] : []),
    { to: "/chat", rotulo: "Consultar o ERP ao vivo", icone: TerminalSquare },
  ];

  const bloqueado = s.acesso && !s.acesso.liberado && !caminho.startsWith("/app/plano");
  return (
    <Casca itens={itens} area="cliente">
      {s.usuario.precisaTrocarSenha && !s.personificando ? (
        <TrocaObrigatoria />
      ) : bloqueado ? (
        <div className="mx-auto max-w-lg py-16 text-center">
          <h1 className="titulo-secao text-3xl">{MOTIVOS[s.acesso!.motivo]?.titulo}</h1>
          <p className="mt-3 text-muted-foreground">{MOTIVOS[s.acesso!.motivo]?.texto}</p>
          {podeFazer(p, "verPlano") && (
            <Button className="mt-6" onClick={() => window.location.assign("/app/plano")}>Ver planos</Button>
          )}
        </div>
      ) : (
        <>
          {!s.empresa && <Aviso tipo="alerta">Sua conta não está ligada a nenhuma empresa. Fale com a nossa equipe.</Aviso>}
          <Outlet />
        </>
      )}
    </Casca>
  );
}
