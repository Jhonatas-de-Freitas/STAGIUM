import { ArrowDown, ArrowUp, Plus, ShieldAlert, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Direitos, Frequencia } from "@/lib/planos";
import { PERIODOS_PADRAO, executarPlano } from "@/lib/saas/consulta";
import { DIAS_DA_SEMANA, ROTULO_FREQUENCIA, colunasSensiveisNoRelatorio, descreverAgenda, errosDoRelatorio, proximaExecucao } from "@/lib/saas/relatorios";
import type { Dataset, Empresa, Filtro, Operador, Relatorio } from "@/lib/saas/tipos";

import { TabelaDeResultado } from "./grafico";

const TODAS_FREQ: Frequencia[] = ["diaria", "dias_uteis", "semanal", "mensal", "trimestral"];
const OPERADORES: [Operador, string][] = [["=", "é igual a"], ["!=", "é diferente de"], ["contem", "contém"], [">", "maior que"], ["<", "menor que"]];
const maiuscula = (t: string) => t[0]!.toUpperCase() + t.slice(1);

export function EditorDeRelatorio({
  inicial,
  datasets,
  empresa,
  direitos,
  aoSalvar,
  aoFechar,
}: {
  inicial: Relatorio;
  datasets: Dataset[];
  empresa: Empresa;
  direitos: Direitos;
  aoSalvar: (r: Relatorio) => Promise<void>;
  aoFechar: () => void;
}) {
  const [r, setR] = useState<Relatorio>(inicial);
  const [email, setEmail] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const ds = datasets.find((d) => d.id === r.plano.datasetId) ?? datasets[0]!;
  const colunasVisiveis = r.plano.colunas ?? [];
  const dataCols = ds.colunas.filter((c) => c.tipo === "data");
  const mudarPlano = (p: Partial<Relatorio["plano"]>) => setR((x) => ({ ...x, plano: { ...x.plano, ...p } }));
  const sensiveis = colunasSensiveisNoRelatorio(ds, r);

  const previa = useMemo(() => {
    try { return executarPlano(ds, { ...r.plano, limite: 8 }); } catch { return null; }
  }, [ds, r.plano]);
  const proxima = useMemo(() => proximaExecucao(r, new Date()), [r.frequencia, r.hora, r.diaSemana, r.diaMes]);

  function mudarDataset(id: string) {
    const novo = datasets.find((d) => d.id === id)!;
    setR((x) => ({ ...x, plano: { datasetId: id, modo: "lista", colunas: novo.colunas.filter((c) => !c.sensivel).map((c) => c.chave), filtros: [] } }));
  }
  function alternarColuna(chave: string, marcada: boolean) {
    const atual = r.plano.colunas ?? [];
    mudarPlano({ colunas: marcada ? [...atual, chave] : atual.filter((c) => c !== chave) });
  }
  function mover(chave: string, d: number) {
    const l = [...colunasVisiveis];
    const i = l.indexOf(chave);
    const j = i + d;
    if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j]!, l[i]!];
    mudarPlano({ colunas: l });
  }
  const filtros = r.plano.filtros ?? [];
  const setFiltro = (i: number, f: Partial<Filtro>) => mudarPlano({ filtros: filtros.map((x, k) => (k === i ? ({ ...x, ...f } as Filtro) : x)) });
  function addEmail() {
    const novos = email.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!novos.length) return;
    setR((x) => ({ ...x, destinatarios: [...new Set([...x.destinatarios, ...novos])] }));
    setEmail("");
  }

  async function salvar() {
    const e = errosDoRelatorio(empresa, r, ds);
    setErros(e);
    if (e.length) return;
    setSalvando(true);
    try { await aoSalvar(r); } catch (err) { setErros([err instanceof Error ? err.message : "Não foi possível salvar."]); } finally { setSalvando(false); }
  }

  const limDest = direitos.destinatariosPorRelatorio;
  return (
    <Dialog open onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{inicial.nome ? "Editar relatório" : "Novo relatório agendado"}</DialogTitle>
          <DialogDescription>Escolha os dados, as colunas e quando o arquivo deve ser gerado e enviado.</DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-8 [&>section]:min-w-0">
          <section className="space-y-3" aria-label="Dados">
            <h3 className="titulo-passo">1. O que entra</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label htmlFor="rel-nome" className="mb-1 block text-sm">Nome do relatório</Label><Input id="rel-nome" value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value })} placeholder="Ex.: Títulos vencidos da semana" /></div>
              <div><Label className="mb-1 block text-sm">Base de dados</Label>
                <Select value={ds.id} onValueChange={mudarDataset}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{datasets.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="mb-1 block text-sm">Período dos dados</Label>
                <div className="flex gap-2">
                  <Select value={r.plano.periodo?.expressao ?? "todo"} onValueChange={(v) => mudarPlano({ periodo: v === "todo" ? undefined : { coluna: r.plano.periodo?.coluna ?? dataCols[0]?.chave ?? "", expressao: v } })}>
                    <SelectTrigger aria-label="Período"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="todo">Todo o histórico</SelectItem>{PERIODOS_PADRAO.map((p) => <SelectItem key={p} value={p}>{maiuscula(p)}</SelectItem>)}</SelectContent>
                  </Select>
                  {r.plano.periodo && dataCols.length > 1 && (
                    <Select value={r.plano.periodo.coluna} onValueChange={(v) => mudarPlano({ periodo: { ...r.plano.periodo!, coluna: v } })}>
                      <SelectTrigger aria-label="Coluna de data do período"><SelectValue /></SelectTrigger>
                      <SelectContent>{dataCols.map((c) => <SelectItem key={c.chave} value={c.chave}>por {c.titulo.toLowerCase()}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>

            <fieldset>
              <legend className="mb-1 text-sm font-medium">Colunas do arquivo <span className="font-normal text-muted-foreground">({colunasVisiveis.length} de {ds.colunas.length})</span></legend>
              <div className="mb-2 flex gap-2 text-xs">
                <button type="button" className="underline" onClick={() => mudarPlano({ colunas: ds.colunas.filter((c) => !c.sensivel).map((c) => c.chave) })}>Todas (sem dados pessoais)</button>
                <button type="button" className="underline" onClick={() => mudarPlano({ colunas: [] })}>Limpar</button>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {ds.colunas.map((c) => (
                  <label key={c.chave} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm">
                    <Checkbox checked={colunasVisiveis.includes(c.chave)} onCheckedChange={(v) => alternarColuna(c.chave, v === true)} />
                    <span className="flex-1 truncate">{c.titulo}</span>
                    {c.sensivel && <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--atencao)" }}><ShieldAlert className="size-3.5" />pessoal</span>}
                  </label>
                ))}
              </div>
              {sensiveis.length > 0 && <p className="mt-2 rounded-md border border-[var(--atencao)] p-2 text-xs">Atenção: {sensiveis.map((c) => c.titulo).join(", ")} {sensiveis.length > 1 ? "são dados pessoais" : "é dado pessoal"} (LGPD). Mande só para quem precisa ver e tire a coluna se não for necessária.</p>}
              {colunasVisiveis.length > 1 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs text-muted-foreground">Ordem das colunas no arquivo</p>
                  <ol className="flex flex-wrap gap-1.5">
                    {colunasVisiveis.map((k, i) => (
                      <li key={k} className="flex items-center gap-0.5 rounded-md border bg-card py-0.5 pl-2 text-xs">
                        {ds.colunas.find((c) => c.chave === k)?.titulo}
                        <button type="button" aria-label="Mover para antes" disabled={i === 0} onClick={() => mover(k, -1)} className="p-1 disabled:opacity-30"><ArrowUp className="size-3 -rotate-90" /></button>
                        <button type="button" aria-label="Mover para depois" disabled={i === colunasVisiveis.length - 1} onClick={() => mover(k, 1)} className="p-1 disabled:opacity-30"><ArrowDown className="size-3 -rotate-90" /></button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2"><Label className="mb-1 block text-sm">Ordenar por</Label>
                <div className="flex gap-2">
                  <Select value={r.plano.ordenarPor?.campo ?? "nenhuma"} onValueChange={(v) => mudarPlano({ ordenarPor: v === "nenhuma" ? undefined : { campo: v, direcao: r.plano.ordenarPor?.direcao ?? "desc" } })}>
                    <SelectTrigger aria-label="Ordenar por"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="nenhuma">Ordem original</SelectItem>{ds.colunas.filter((c) => colunasVisiveis.includes(c.chave)).map((c) => <SelectItem key={c.chave} value={c.chave}>{c.titulo}</SelectItem>)}</SelectContent>
                  </Select>
                  {r.plano.ordenarPor && (
                    <Select value={r.plano.ordenarPor.direcao} onValueChange={(v) => mudarPlano({ ordenarPor: { ...r.plano.ordenarPor!, direcao: v as "asc" | "desc" } })}>
                      <SelectTrigger className="w-40" aria-label="Direção"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="desc">Maior primeiro</SelectItem><SelectItem value="asc">Menor primeiro</SelectItem></SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div><Label htmlFor="rel-lim" className="mb-1 block text-sm">Máximo de linhas</Label><Input id="rel-lim" inputMode="numeric" value={r.plano.limite ?? ""} placeholder="Todas" onChange={(e) => mudarPlano({ limite: e.target.value ? Math.max(1, Number(e.target.value.replace(/\D/g, ""))) : undefined })} /></div>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">Filtros</p>
              {filtros.map((f, i) => {
                const col = ds.colunas.find((c) => c.chave === f.coluna);
                const valores = col?.tipo === "texto" && !col.sensivel ? [...new Set(ds.linhas.slice(0, 4000).map((l) => String(l[col.chave] ?? "")))].filter(Boolean).slice(0, 13) : [];
                return (
                  <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
                    <Select value={f.coluna} onValueChange={(v) => setFiltro(i, { coluna: v, valor: "" })}><SelectTrigger className="w-44" aria-label="Coluna do filtro"><SelectValue /></SelectTrigger><SelectContent>{ds.colunas.filter((c) => !c.sensivel).map((c) => <SelectItem key={c.chave} value={c.chave}>{c.titulo}</SelectItem>)}</SelectContent></Select>
                    <Select value={f.op} onValueChange={(v) => setFiltro(i, { op: v as Operador })}><SelectTrigger className="w-36" aria-label="Condição"><SelectValue /></SelectTrigger><SelectContent>{OPERADORES.map(([v, t]) => <SelectItem key={v} value={v}>{t}</SelectItem>)}</SelectContent></Select>
                    {valores.length > 0 && valores.length <= 12 && (f.op === "=" || f.op === "!=") ? (
                      <Select value={String(f.valor)} onValueChange={(v) => setFiltro(i, { valor: v })}><SelectTrigger className="w-44" aria-label="Valor"><SelectValue placeholder="Escolha" /></SelectTrigger><SelectContent>{valores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
                    ) : (
                      <Input className="w-44" aria-label="Valor" value={String(f.valor ?? "")} onChange={(e) => setFiltro(i, { valor: col && col.tipo !== "texto" && col.tipo !== "data" && e.target.value !== "" && !Number.isNaN(Number(e.target.value.replace(",", "."))) ? Number(e.target.value.replace(",", ".")) : e.target.value })} placeholder={col?.tipo === "data" ? "AAAA-MM-DD" : "valor"} />
                    )}
                    <Button variant="ghost" size="icon" aria-label="Remover filtro" onClick={() => mudarPlano({ filtros: filtros.filter((_, k) => k !== i) })}><X className="size-4" /></Button>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" className="bg-card" onClick={() => mudarPlano({ filtros: [...filtros, { coluna: ds.colunas.find((c) => !c.sensivel)!.chave, op: "=", valor: "" }] })}><Plus className="mr-1.5 size-4" />Adicionar filtro</Button>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">Prévia (primeiras 8 linhas)</p>
              {previa && colunasVisiveis.length ? <TabelaDeResultado resultado={previa} max={8} /> : <p className="text-sm text-muted-foreground">Escolha pelo menos uma coluna.</p>}
              {previa && <p className="dica mt-1">{previa.linhasLidas.toLocaleString("pt-BR")} registros hoje com estes filtros.</p>}
            </div>
          </section>

          <section className="space-y-3" aria-label="Quando">
            <h3 className="titulo-passo">2. Quando gerar</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label className="mb-1 block text-sm">Frequência</Label>
                <Select value={r.frequencia} onValueChange={(v) => setR({ ...r, frequencia: v as Frequencia })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TODAS_FREQ.map((f) => { const ok = direitos.frequenciasRelatorio.includes(f); return <SelectItem key={f} value={f} disabled={!ok}>{ROTULO_FREQUENCIA[f]}{ok ? "" : " (plano superior)"}</SelectItem>; })}</SelectContent>
                </Select></div>
              <div><Label htmlFor="rel-hora" className="mb-1 block text-sm">Horário (Brasília)</Label><Input id="rel-hora" type="time" value={r.hora} onChange={(e) => setR({ ...r, hora: e.target.value })} /></div>
              {r.frequencia === "semanal" && (
                <div><Label className="mb-1 block text-sm">Dia da semana</Label>
                  <Select value={String(r.diaSemana)} onValueChange={(v) => setR({ ...r, diaSemana: Number(v) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DIAS_DA_SEMANA.map((d, i) => <SelectItem key={d} value={String(i)}>{maiuscula(d)}</SelectItem>)}</SelectContent></Select></div>
              )}
              {(r.frequencia === "mensal" || r.frequencia === "trimestral") && (
                <div><Label className="mb-1 block text-sm">Dia do mês</Label>
                  <Select value={String(r.diaMes)} onValueChange={(v) => setR({ ...r, diaMes: Number(v) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Último dia do mês</SelectItem>{Array.from({ length: 28 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Dia {i + 1}</SelectItem>)}</SelectContent></Select></div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{descreverAgenda(r)}. Próxima geração: <strong className="text-foreground">{proxima.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</strong>.</p>
          </section>

          <section className="space-y-3" aria-label="Entrega">
            <h3 className="titulo-passo">3. Como entregar</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label className="mb-1 block text-sm">Formato do arquivo</Label>
                <Select value={r.formato} onValueChange={(v) => setR({ ...r, formato: v as Relatorio["formato"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="xlsx">Excel (.xlsx)</SelectItem><SelectItem value="csv" disabled={!direitos.formatosRelatorio.includes("csv")}>CSV{direitos.formatosRelatorio.includes("csv") ? "" : " (plano superior)"}</SelectItem></SelectContent></Select></div>
              {r.formato === "xlsx" && (
                <label className="flex items-center gap-3 self-end pb-2 text-sm"><Switch checked={r.incluirResumo} onCheckedChange={(v) => setR({ ...r, incluirResumo: v })} />Incluir aba de resumo (totais e gráficos em barras)</label>
              )}
            </div>
            <div>
              <Label htmlFor="rel-email" className="mb-1 block text-sm">Destinatários {limDest !== null && <span className="font-normal text-muted-foreground">(até {limDest})</span>}</Label>
              <div className="flex flex-wrap gap-1.5">
                {r.destinatarios.map((d) => <span key={d} className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pl-3 pr-1 text-xs">{d}<button type="button" aria-label={`Remover ${d}`} className="rounded-full p-1 hover:bg-secondary" onClick={() => setR({ ...r, destinatarios: r.destinatarios.filter((x) => x !== d) })}><X className="size-3" /></button></span>)}
              </div>
              <div className="mt-2 flex gap-2">
                <Input id="rel-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addEmail(); } }} placeholder="nome@empresa.com.br" />
                <Button variant="outline" className="bg-card" onClick={addEmail} disabled={!email.trim()}>Adicionar</Button>
              </div>
            </div>
            <div><Label htmlFor="rel-assunto" className="mb-1 block text-sm">Assunto do e-mail</Label><Input id="rel-assunto" value={r.assunto} onChange={(e) => setR({ ...r, assunto: e.target.value })} placeholder={r.nome || "Relatório"} /></div>
            <div><Label htmlFor="rel-msg" className="mb-1 block text-sm">Mensagem</Label><Textarea id="rel-msg" rows={2} value={r.mensagem} onChange={(e) => setR({ ...r, mensagem: e.target.value })} placeholder="Segue o relatório de hoje." /></div>
            <p className="dica">O envio automático por e-mail entra quando o servidor estiver ligado. Até lá, o painel gera o arquivo no horário (com o painel aberto) e registra no histórico; você também pode baixar na hora com "Executar agora".</p>
          </section>
        </div>

        {erros.length > 0 && <ul role="alert" className="list-disc space-y-0.5 pl-5 text-sm text-destructive">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
        <DialogFooter className="gap-2">
          <label className="mr-auto flex items-center gap-2 text-sm"><Switch checked={r.ativo} onCheckedChange={(v) => setR({ ...r, ativo: v })} />Agendamento ativo</label>
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar relatório"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
