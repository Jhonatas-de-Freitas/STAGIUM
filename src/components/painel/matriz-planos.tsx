import { PLANOS, type Direitos } from "@/lib/planos";

const n = (v: number | null) => (v === null ? "Sem limite*" : v.toLocaleString("pt-BR"));
const sn = (v: boolean) => (v ? "Incluído" : "—");

export const LINHAS_DA_MATRIZ: { rotulo: string; valor: (d: Direitos) => string }[] = [
  { rotulo: "Sistemas conectados", valor: (d) => n(d.sistemas) },
  { rotulo: "Consultas por mês", valor: (d) => n(d.consultasMes) },
  { rotulo: "Pessoas na equipe", valor: (d) => n(d.usuarios) },
  { rotulo: "Dashboards", valor: (d) => n(d.dashboards) },
  { rotulo: "Gráficos por dashboard", valor: (d) => n(d.widgetsPorDashboard) },
  { rotulo: "Créditos de IA por mês", valor: (d) => n(d.creditosIaMes) },
  { rotulo: "Relatórios agendados", valor: (d) => n(d.relatoriosAgendados) },
  { rotulo: "Destinatários por relatório", valor: (d) => n(d.destinatariosPorRelatorio) },
  { rotulo: "Frequências", valor: (d) => d.frequenciasRelatorio.join(", ").replace("dias_uteis", "dias úteis").replace("diaria", "diária") },
  { rotulo: "Formatos", valor: (d) => d.formatosRelatorio.join(" e ").toUpperCase() },
  { rotulo: "Insights", valor: (d) => (d.insights === "completo" ? "Completos" : "Básicos") },
  { rotulo: "Alertas", valor: (d) => (d.alertas === 0 ? "—" : d.alertas.toLocaleString("pt-BR")) },
  { rotulo: "Atualizações dos dados por dia", valor: (d) => d.atualizacoesPorDia.toLocaleString("pt-BR") },
  { rotulo: "Envio de planilhas", valor: (d) => sn(d.uploadPlanilhas) },
  { rotulo: "Histórico de auditoria", valor: (d) => `${d.auditoriaDias} dias` },
  { rotulo: "Exportar dados da empresa", valor: (d) => sn(d.exportarDadosEmpresa) },
  { rotulo: "Suporte", valor: (d) => d.suporte },
];

/** Tabela "o que cada pacote dá direito". Usada no painel do cliente e na área da equipe. */
export function MatrizDePlanos({ destacar }: { destacar?: string }) {
  return (
    <div className="grade-rolagem">
      <table className="w-full text-sm">
        <thead className="bg-[var(--grade-cabecalho)] text-left">
          <tr>
            <th className="px-3 py-2">Direito</th>
            {PLANOS.map((p) => (
              <th key={p.id} className="px-3 py-2">{p.nome}{destacar === p.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(atual)</span>}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINHAS_DA_MATRIZ.map((l) => (
            <tr key={l.rotulo} className="border-t">
              <th scope="row" className="px-3 py-1.5 text-left font-normal text-muted-foreground">{l.rotulo}</th>
              {PLANOS.map((p) => <td key={p.id} className="px-3 py-1.5">{l.valor(p.direitos)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted-foreground">* Sem limite fixo, com uso justo combinado em contrato.</p>
    </div>
  );
}
