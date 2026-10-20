import { createFileRoute } from "@tanstack/react-router";

import { Cabecalho } from "@/components/painel/casca";
import { MatrizDePlanos } from "@/components/painel/matriz-planos";
import { DIREITOS_TESTE, PLANOS, TESTE_GRATIS, formatarReais } from "@/lib/planos";

export const Route = createFileRoute("/admin/planos")({ component: Pacotes });

function Pacotes() {
  return (
    <>
      <Cabecalho titulo="Pacotes e direitos" texto="O que cada plano dá direito. É a mesma tabela que o painel do cliente usa para liberar e bloquear recursos." />
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {PLANOS.map((p) => (
          <article key={p.id} className="folha folha-secao">
            <h2 className="font-semibold">{p.nome}</h2>
            <p className="numero-grande text-xl">{p.mensal === null ? "Sob consulta" : `${formatarReais(p.mensal)}/mês`}</p>
            <p className="mt-2 text-sm text-muted-foreground">{p.resumo}</p>
          </article>
        ))}
      </div>
      <MatrizDePlanos />
      <section className="mt-8">
        <h2 className="titulo-passo mb-2">Teste grátis ({TESTE_GRATIS.dias} dias)</h2>
        <p className="text-sm text-muted-foreground">Recursos do Profissional, com tetos baixos: {DIREITOS_TESTE.sistemas} sistema, {DIREITOS_TESTE.consultasMes} consultas, {DIREITOS_TESTE.usuarios} pessoas, {DIREITOS_TESTE.dashboards} dashboards, {DIREITOS_TESTE.creditosIaMes} créditos de IA, {DIREITOS_TESTE.relatoriosAgendados} relatórios.</p>
        <p className="dica mt-3">Para mudar um pacote, edite apenas src/lib/planos.ts. Para negociar algo só com um cliente, use "Limites especiais" na ficha dele.</p>
      </section>
    </>
  );
}
