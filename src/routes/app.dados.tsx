import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Aviso, Cabecalho, Vazio } from "@/components/painel/casca";
import { useSessao } from "@/components/painel/contexto";
import { TabelaDeResultado } from "@/components/painel/grafico";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { lerPlanilha } from "@/lib/saas/dados";
import { executarPlano } from "@/lib/saas/consulta";
import { novoId } from "@/lib/saas/senha";
import * as S from "@/lib/saas/servico";
import type { Dataset } from "@/lib/saas/tipos";

export const Route = createFileRoute("/app/dados")({
  head: () => ({ meta: [{ title: "Meus dados — Stagium" }] }),
  component: MeusDados,
});

const FONTE = { demo: "Demonstração", planilha: "Planilha enviada", erp: "ERP" } as const;

function MeusDados() {
  const s = useSessao();
  const entrada = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [lendo, setLendo] = useState(false);
  const { empresa, usuario, direitos } = s;
  if (!empresa || !usuario || !direitos) return null;

  async function enviar(arquivo: File) {
    setLendo(true);
    try {
      const r = await lerPlanilha(arquivo);
      const ds: Dataset = {
        id: novoId("d"),
        nome: nome.trim() || arquivo.name.replace(/\.[^.]+$/, ""),
        descricao: `Planilha ${arquivo.name}`,
        tipo: "generico",
        fonte: "planilha",
        colunas: r.colunas,
        linhas: r.linhas,
        atualizadoEm: new Date().toISOString(),
      };
      await S.importarDataset(usuario!, empresa!, ds);
      await s.recarregarDados();
      setNome("");
      setAberto(ds.id);
      toast.success(`${r.linhas.length.toLocaleString("pt-BR")} linhas importadas.${r.truncado ? ` O arquivo tinha ${r.totalOriginal.toLocaleString("pt-BR")}; entraram as primeiras.` : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }
  async function alternarSensivel(ds: Dataset, chave: string, valor: boolean) {
    const colunas = ds.colunas.map((c) => (c.chave === chave ? { ...c, sensivel: valor || undefined } : c));
    await S.importarDataset(usuario!, empresa!, { ...ds, colunas });
    await s.recarregarDados();
  }

  return (
    <>
      <Cabecalho titulo="Meus dados" texto="As bases que alimentam dashboards, insights, chat e relatórios. Envie uma planilha ou use os dados de demonstração." />
      {direitos.uploadPlanilhas ? (
        <div className="folha folha-secao mb-8">
          <h2 className="titulo-passo mb-3">Enviar planilha (.xlsx ou .csv)</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">Nome da base (opcional)<Input className="mt-1 w-64" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Pedidos 2026" /></label>
            <input ref={entrada} type="file" accept=".xlsx,.xls,.csv" className="sr-only" id="arq" onChange={(e) => e.target.files?.[0] && void enviar(e.target.files[0])} />
            <Button disabled={lendo} onClick={() => entrada.current?.click()}><Upload className="mr-2 size-4" />{lendo ? "Lendo..." : "Escolher arquivo"}</Button>
          </div>
          <p className="dica mt-2">Até 5 MB e 20 mil linhas. A primeira linha deve ter os títulos. O arquivo é lido no seu navegador. Colunas com CPF, CNPJ, e-mail, telefone e endereço são marcadas como dados pessoais automaticamente.</p>
        </div>
      ) : (
        <div className="mb-8"><Aviso>O envio de planilhas não está incluído no seu plano.</Aviso></div>
      )}

      {s.datasets.length === 0 ? (
        <Vazio titulo="Nenhuma base ainda" texto="Envie uma planilha acima ou ative os dados de demonstração em Conexões com ERPs." />
      ) : (
        <div className="grid gap-3">
          {s.datasets.map((ds) => {
            const abre = aberto === ds.id;
            const previa = abre ? executarPlano(ds, { datasetId: ds.id, modo: "lista", colunas: ds.colunas.slice(0, 8).map((c) => c.chave), limite: 8 }) : null;
            return (
              <article key={ds.id} className="folha folha-secao">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{ds.nome}</h2>
                    <p className="text-sm text-muted-foreground">{FONTE[ds.fonte]} · {ds.linhas.length.toLocaleString("pt-BR")} linhas · {ds.colunas.length} colunas · atualizada em {new Date(ds.atualizadoEm).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="bg-card" onClick={() => setAberto(abre ? null : ds.id)}>{abre ? "Fechar" : "Ver colunas"}</Button>
                    {ds.fonte === "planilha" && (
                      <Button variant="ghost" size="icon" aria-label={`Apagar ${ds.nome}`} onClick={async () => { if (!window.confirm(`Apagar a base "${ds.nome}"? Dashboards e relatórios que usam esta base deixam de funcionar.`)) return; await S.removerDataset(usuario, empresa, ds.id); await s.recarregarDados(); }}><Trash2 className="size-4" /></Button>
                    )}
                  </div>
                </div>
                {abre && previa && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-medium">Colunas</p>
                      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {ds.colunas.map((c) => (
                          <label key={c.chave} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm">
                            <span className="flex-1 truncate">{c.titulo} <span className="text-xs text-muted-foreground">({c.tipo})</span></span>
                            {ds.fonte === "planilha" ? (
                              <span className="flex items-center gap-1.5 text-xs"><Checkbox checked={!!c.sensivel} onCheckedChange={(v) => void alternarSensivel(ds, c.chave, v === true)} aria-label={`${c.titulo} é dado pessoal`} />pessoal</span>
                            ) : c.sensivel ? <ShieldAlert className="size-3.5" style={{ color: "var(--atencao)" }} aria-label="dado pessoal" /> : null}
                          </label>
                        ))}
                      </div>
                      <p className="dica mt-2">Dado pessoal não é enviado à IA e aparece com aviso ao montar relatórios.</p>
                    </div>
                    <div><p className="mb-2 text-sm font-medium">Primeiras linhas</p><TabelaDeResultado resultado={previa} max={8} /></div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
