import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Building2, ClipboardList, LayoutGrid, Settings, Tags } from "lucide-react";

import { Casca, type ItemDeMenu } from "@/components/painel/casca";
import { useGuarda, useSessao } from "@/components/painel/contexto";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Equipe Stagium" }] }),
  component: LayoutAdmin,
});

const ITENS: ItemDeMenu[] = [
  { to: "/admin", rotulo: "Visão geral", icone: LayoutGrid, exato: true },
  { to: "/admin/clientes", rotulo: "Clientes", icone: Building2 },
  { to: "/admin/solicitacoes", rotulo: "Pedidos de plano", icone: ClipboardList },
  { to: "/admin/planos", rotulo: "Pacotes e direitos", icone: Tags },
  { to: "/admin/configuracoes", rotulo: "Configurações", icone: Settings },
];

function LayoutAdmin() {
  const pronto = useGuarda("admin");
  const s = useSessao();
  if (!pronto || !s.usuario) return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando...</div>;
  return (
    <Casca itens={ITENS} area="admin">
      <Outlet />
    </Casca>
  );
}
