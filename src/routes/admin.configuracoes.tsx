import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Cabecalho } from "@/components/painel/casca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import * as S from "@/lib/saas/servico";
import type { ConfigPlataforma } from "@/lib/saas/tipos";

export const Route = createFileRoute("/admin/configuracoes")({ component: Configuracoes });

function Configuracoes() {
  const [c, setC] = useState<ConfigPlataforma | null>(null);
  useEffect(() => { void S.obterConfig().then(setC); }, []);
  if (!c) return null;
  return (
    <>
      <Cabecalho titulo="Configurações da plataforma" />
      <div className="folha folha-secao max-w-xl space-y-5">
        <label className="flex items-start gap-3 text-sm"><Switch checked={c.cadastroPublico} onCheckedChange={(v) => setC({ ...c, cadastroPublico: v })} /><span><strong>Cadastro aberto ao público</strong><br /><span className="text-muted-foreground">Desligado: só entra quem a equipe convidar ou conceder acesso.</span></span></label>
        <label className="block text-sm"><strong>Dias de teste grátis</strong><Input className="mt-1 w-28" inputMode="numeric" value={c.diasDeTeste} onChange={(e) => setC({ ...c, diasDeTeste: Math.min(90, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)) })} /></label>
        <Button onClick={async () => { await S.salvarConfig(c); toast.success("Configurações salvas."); }}>Salvar</Button>
      </div>
    </>
  );
}
