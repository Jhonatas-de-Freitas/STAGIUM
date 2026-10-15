import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  Download,
  KeyRound,
  Loader2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Grade } from "@/components/grade-planilha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  boasVindas,
  mensagem,
  planilhaDaConsulta,
  type Consulta,
  type Mensagem,
} from "@/lib/assistente";
import type { CampoFiltro } from "@/lib/executor.servidor";
import { perguntarAoAssistente } from "@/lib/assistente.servidor";
import {
  conexoesConfiguradas,
  executarConsultaReal,
  iniciarConexao,
} from "@/lib/executor.servidor";
import { CHAVE_PENDENTE, CHAVE_STATE, type MensagemConexao } from "@/lib/conexao";
import conhecimento from "@/lib/conhecimento.json";
import { interpretarPeriodo, type PeriodoInterpretado } from "@/lib/periodo";
import { baixarPlanilha, type DadosPlanilha } from "@/lib/planilha";
import {
  PIN_MINIMO,
  abrirCredenciais,
  apagarCredenciaisSalvas,
  salvarCredenciais,
  temCredenciaisSalvas,
} from "@/lib/cofre-local";
import {
  apagarConsultaSalva,
  filtrosParaExecutar,
  listarConsultasSalvas,
  prepararParaSalvar,
  salvarConsulta,
  type ConsultaSalva,
} from "@/lib/consultas-salvas";

const CONSULTAS = conhecimento.consultas as Consulta[];
type CampoCredencial = {
  nome: string;
  rotulo: string;
  segredo: boolean;
  onde_obter: string;
  default?: string;
  /** false: o formulário mostra, mas não exige (ex.: chave de parceiro da Qive). */
  obrigatoria?: boolean;
};

const EXECUCAO = (
  conhecimento as unknown as {
    execucao: Record<
      string,
      {
        auth: {
          credenciais_necessarias: CampoCredencial[];
          /** Conexão pela tela do fornecedor, em vez de credenciais digitadas (ex.: Mercado Livre). */
          conexao?: { tipo: string };
        };
      }
    >;
  }
).execucao;

/** Sistema em que o cliente conecta a conta na tela do fornecedor (OAuth), sem digitar chaves. */
const exigeConexao = (slug: string) => Boolean(EXECUCAO[slug]?.auth.conexao);

/** Credenciais que o cliente informa para consultar um sistema. */
const credenciaisDo = (slug: string) => EXECUCAO[slug]?.auth.credenciais_necessarias ?? [];

const NOMES_CURTOS: Record<string, string> = {
  "mercado-livre": "Mercado Livre",
  sygecom: "Sagi (SyGeCom)",
  nomus: "Nomus",
  arquivei: "Qive (Arquivei)",
};

const obrigatoria = (c: CampoCredencial) => c.obrigatoria !== false;

/** Sistemas que o site consulta de verdade (os que têm receita de execução). */
const SISTEMAS = (conhecimento.sistemas as { slug: string; nome: string }[])
  .filter((s) => EXECUCAO[s.slug])
  .map((s) => ({ slug: s.slug, nome: NOMES_CURTOS[s.slug] ?? s.nome }));

const nomeDo = (slug: string | null | undefined) =>
  SISTEMAS.find((s) => s.slug === slug)?.nome ?? "seu sistema";

/** Sistemas de nome feminino (a Qive); os demais levam "o". */
const FEMININOS = new Set(["arquivei"]);
/** "o Nomus", "a Qive (Arquivei)"; com `de`: "do Nomus", "da Qive (Arquivei)". */
const comArtigo = (slug: string | null | undefined, de = false) =>
  `${de ? "d" : ""}${slug && FEMININOS.has(slug) ? "a" : "o"} ${nomeDo(slug)}`;

const SUGESTOES_POR_SISTEMA: Record<string, string[]> = {
  sygecom: ["Produtos cadastrados", "Movimentos de estoque", "Pedidos de compra", "Clientes"],
  "mercado-livre": [
    "Vendas do mês passado",
    "Anúncios ativos",
    "Perguntas sem resposta",
    "Reclamações deste mês",
  ],
  arquivei: [
    "NF-e recebidas deste mês",
    "Notas emitidas do mês passado",
    "CT-e de fretes deste mês",
    "Boletos a vencer deste mês",
  ],
  nomus: [
    "Contas a receber em aberto",
    "Pedidos de venda do mês passado",
    "Movimentações de estoque",
    "Ordens de produção",
  ],
};

/** Atalhos da primeira tela: os definidos à mão ou as entidades das consultas do sistema. */
function sugestoesDo(slug: string): string[] {
  const definidas = SUGESTOES_POR_SISTEMA[slug];
  if (definidas) return definidas;
  const entidades = CONSULTAS.filter((c) => c.slug === slug).map((c) => c.entidade);
  return Array.from(new Set(entidades)).slice(0, 4);
}

const CHAVE_SISTEMA = "stagium.sistema";

export const Route = createFileRoute("/chat")({
  validateSearch: (busca: Record<string, unknown>): { pergunta?: string; sistema?: string } => ({
    ...(typeof busca["pergunta"] === "string" ? { pergunta: busca["pergunta"].slice(0, 300) } : {}),
    ...(typeof busca["sistema"] === "string" && SISTEMAS.some((s) => s.slug === busca["sistema"])
      ? { sistema: busca["sistema"] }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Conversa — Stagium" },
      {
        name: "description",
        content:
          "Pergunte em português o que precisa do ERP da sua empresa. O Stagium encontra a consulta certa, executa na API e devolve a planilha pronta.",
      },
      { property: "og:title", content: "Stagium" },
      { property: "og:description", content: "Pergunte, aprove e receba os dados em planilha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

/** Negrito simples (**texto**), código (`texto`) e quebras de linha. */
function Texto({ conteudo }: { conteudo: string }) {
  return (
    <>
      {conteudo.split("\n").map((linha, i) => (
        <p key={i} className={linha ? "" : "h-2"}>
          {linha.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((parte, j) => {
            if (parte.startsWith("**") && parte.endsWith("**")) {
              return (
                <strong key={j} className="font-semibold">
                  {parte.slice(2, -2)}
                </strong>
              );
            }
            if (parte.startsWith("`") && parte.endsWith("`")) {
              return (
                <code key={j} className="mono rounded-sm bg-muted px-1 py-0.5 text-[0.85em]">
                  {parte.slice(1, -1)}
                </code>
              );
            }
            return <span key={j}>{parte}</span>;
          })}
        </p>
      ))}
    </>
  );
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");
/** Data local em AAAA-MM-DD (toISOString usaria UTC e viraria o dia à noite no Brasil). */
const dataLocal = (d: Date) =>
  `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

function padraoDoCampo(c: CampoFiltro, sugerido?: PeriodoInterpretado): string {
  if (sugerido) {
    if (c.papel === "periodo_inicio") return sugerido.inicio;
    if (c.papel === "periodo_fim" || c.papel === "data") return sugerido.fim;
  }
  const hoje = new Date();
  if (c.papel === "periodo_inicio") {
    return dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  }
  if (c.papel === "periodo_fim") return dataLocal(hoje);
  return c.padrao ?? "";
}

/** Resumo legível dos filtros, para o chat e para a aba Informações da planilha. */
function resumirFiltros(consulta: Consulta, filtros: Record<string, string>): string {
  return (consulta.campos_filtro ?? [])
    .filter((c) => filtros[c.nome])
    .map((c) => {
      const v = filtros[c.nome] ?? "";
      if (c.tipo === "condicao") return c.rotulo;
      return `${c.rotulo}: ${c.tipo === "data" ? v.split("-").reverse().join("/") : v}`;
    })
    .join(" · ");
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Período de uma consulta salva, como aparece na lista. */
function descreverPeriodo(consulta: Consulta | undefined, salva: ConsultaSalva): string {
  if (salva.periodo) return `Período: ${salva.periodo} (recalculado a cada vez)`;
  const campos = consulta?.campos_filtro ?? [];
  const inicio = campos.find((c) => c.papel === "periodo_inicio");
  const fim = campos.find((c) => c.papel === "periodo_fim");
  if (inicio && fim && salva.filtros[inicio.nome] && salva.filtros[fim.nome]) {
    return `Período fixo: ${dataBr(salva.filtros[inicio.nome]!)} a ${dataBr(salva.filtros[fim.nome]!)}`;
  }
  return "";
}

const LINHAS_NA_PREVIA = 6;

function PreviaPlanilha({
  planilha,
  aoBaixar,
  nomeSugerido,
  aoSalvar,
}: {
  planilha: DadosPlanilha;
  aoBaixar: () => void;
  nomeSugerido?: string;
  aoSalvar?: (nome: string) => boolean;
}) {
  const restantes = planilha.linhas.length - LINHAS_NA_PREVIA;
  const [nomeando, setNomeando] = useState(false);
  const [nome, setNome] = useState(nomeSugerido ?? "");
  const [salva, setSalva] = useState(false);
  return (
    <div className="mt-4 overflow-hidden rounded-md border bg-card">
      <p className="px-4 pt-3 pb-2 text-sm font-semibold">{planilha.titulo}</p>
      <Grade
        descricao={`Primeiras linhas de ${planilha.titulo}`}
        titulos={planilha.colunas.map((c) => c.titulo)}
        chaves={planilha.colunas.map((c) => c.chave)}
        linhas={planilha.linhas.slice(0, LINHAS_NA_PREVIA)}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Button size="sm" onClick={aoBaixar}>
          <Download className="mr-2 size-4" />
          Baixar planilha (.xlsx)
        </Button>
        {aoSalvar && !salva && !nomeando && (
          <Button size="sm" variant="outline" onClick={() => setNomeando(true)}>
            <Bookmark className="mr-2 size-4" />
            Salvar esta consulta
          </Button>
        )}
        {salva && (
          <span className="flex items-center gap-1.5 text-sm">
            <BookmarkCheck className="size-4" />
            Consulta salva
          </span>
        )}
        <p className="text-xs text-muted-foreground">
          {restantes > 0
            ? `Mostrando ${LINHAS_NA_PREVIA} de ${planilha.linhas.length.toLocaleString("pt-BR")} linhas. A planilha traz todas.`
            : `${planilha.linhas.length} ${planilha.linhas.length === 1 ? "linha" : "linhas"}, ${planilha.colunas.length} colunas.`}
        </p>
      </div>
      {nomeando && aoSalvar && (
        <form
          className="flex flex-wrap items-end gap-2 border-t px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim() && aoSalvar(nome.trim())) {
              setSalva(true);
              setNomeando(false);
            }
          }}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor={`nome-${planilha.nomeArquivo}`} className="text-xs">
              Nome da consulta
            </Label>
            <Input
              id={`nome-${planilha.nomeArquivo}`}
              value={nome}
              maxLength={80}
              autoFocus
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={!nome.trim()}>
            Salvar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setNomeando(false)}>
            Cancelar
          </Button>
        </form>
      )}
    </div>
  );
}

function FormularioConsulta({
  consulta,
  credenciais,
  pedirCredenciais,
  credenciaisSalvas,
  aoMudarCofre,
  aoGuardarPin,
  periodoSugerido,
  filtrosIniciais,
  aoConfirmar,
  ocupado,
}: {
  consulta: Consulta;
  credenciais: Record<string, string>;
  pedirCredenciais: boolean;
  /** Há credenciais criptografadas neste navegador (pede só o PIN). */
  credenciaisSalvas: boolean;
  aoMudarCofre: () => void;
  /** PIN usado ou criado nesta sessão: permite regravar o acesso renovado (OAuth) no cofre. */
  aoGuardarPin: (pin: string) => void;
  periodoSugerido?: PeriodoInterpretado;
  filtrosIniciais?: Record<string, string>;
  aoConfirmar: (
    cred: Record<string, string>,
    filtros: Record<string, string>,
    consulta: Consulta,
  ) => void;
  ocupado: boolean;
}) {
  const camposFiltro = consulta.campos_filtro ?? [];
  const CREDENCIAIS = credenciaisDo(consulta.slug);
  const [filtros, setFiltros] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      camposFiltro.map((c) => [
        c.nome,
        filtrosIniciais?.[c.nome] ?? padraoDoCampo(c, periodoSugerido),
      ]),
    ),
  );
  const [cred, setCred] = useState<Record<string, string>>(() =>
    Object.fromEntries(CREDENCIAIS.map((c) => [c.nome, credenciais[c.nome] ?? c.default ?? ""])),
  );

  const [usarOutras, setUsarOutras] = useState(false);
  const [pin, setPin] = useState("");
  const [lembrar, setLembrar] = useState(false);
  const [pinNovo, setPinNovo] = useState("");
  const [erroPin, setErroPin] = useState("");
  const [abrindo, setAbrindo] = useState(false);
  const modoPin = pedirCredenciais && credenciaisSalvas && !usarOutras;
  const conexao = exigeConexao(consulta.slug);
  const [conectado, setConectado] = useState<Record<string, string> | null>(null);
  const [conectando, setConectando] = useState(false);
  /** Endereço da tela de autorização quando o navegador bloqueia a janela: conectar nesta aba. */
  const [linkNaAba, setLinkNaAba] = useState("");
  const stateConexao = useRef("");

  // a janela de autorização devolve o acesso por postMessage (mesma origem, mesmo state)
  useEffect(() => {
    if (!conexao) return;
    const ouvir = (evento: MessageEvent) => {
      const dados = evento.data as MensagemConexao | undefined;
      if (evento.origin !== window.location.origin || dados?.tipo !== "stagium-conexao") return;
      if (
        dados.slug !== consulta.slug ||
        !stateConexao.current ||
        dados.state !== stateConexao.current
      )
        return;
      setConectado(dados.credenciais);
      setConectando(false);
      setErroPin("");
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, [conexao, consulta.slug]);

  async function conectar() {
    setErroPin("");
    const state = crypto.randomUUID();
    stateConexao.current = state;
    try {
      localStorage.setItem(CHAVE_STATE, state);
    } catch {
      // sem armazenamento: o retorno não terá como conferir; a conexão falha com aviso
    }
    // a janela abre já no clique (senão o navegador bloqueia) e recebe o endereço depois
    const janela = window.open("about:blank", "stagium-conexao", "width=520,height=720");
    setConectando(true);
    try {
      const resposta = await iniciarConexao({ data: { slug: consulta.slug, state } });
      if (!resposta.configurado) {
        janela?.close();
        setConectando(false);
        setErroPin(
          `${nomeDo(consulta.slug)} ainda não está configurado no Stagium (faltam ${resposta.faltam} no servidor). Avise a HUBx.`,
        );
        return;
      }
      if (!janela) {
        setConectando(false);
        setLinkNaAba(resposta.url);
        setErroPin(
          "O navegador bloqueou a janela de conexão. Permita pop-ups para este site e clique de novo, ou conecte nesta aba.",
        );
        return;
      }
      janela.location.href = resposta.url;
    } catch (erro) {
      janela?.close();
      setConectando(false);
      setErroPin(erro instanceof Error ? erro.message : "Não consegui abrir a conexão.");
    }
  }

  const inicio = camposFiltro.find((c) => c.papel === "periodo_inicio");
  const fim = camposFiltro.find((c) => c.papel === "periodo_fim");
  const dataInicio = inicio ? (filtros[inicio.nome] ?? "") : "";
  const dataFim = fim ? (filtros[fim.nome] ?? "") : "";
  const periodoInvertido = dataInicio !== "" && dataFim !== "" && dataInicio > dataFim;
  const faltaFiltro = camposFiltro.some((c) => c.obrigatorio && !filtros[c.nome]?.trim());
  const faltaCredencial = modoPin
    ? pin.length < PIN_MINIMO
    : pedirCredenciais &&
      ((conexao ? !conectado : CREDENCIAIS.some((c) => obrigatoria(c) && !cred[c.nome]?.trim())) ||
        (lembrar && pinNovo.length < PIN_MINIMO));

  async function confirmar() {
    setErroPin("");
    if (!pedirCredenciais) {
      aoConfirmar(credenciais, filtros, consulta);
      return;
    }
    setAbrindo(true);
    try {
      if (modoPin) {
        const abertas = await abrirCredenciais(consulta.slug, pin);
        aoGuardarPin(pin);
        aoConfirmar(abertas, filtros, consulta);
        return;
      }
      const enviar = conexao ? (conectado ?? {}) : cred;
      if (lembrar) {
        await salvarCredenciais(consulta.slug, enviar, pinNovo);
        aoGuardarPin(pinNovo);
        aoMudarCofre();
        toast.success(
          conexao ? "Conexão salva neste navegador" : "Credenciais salvas neste navegador",
          {
            description: "Da próxima vez, é só digitar o PIN.",
          },
        );
      }
      aoConfirmar(enviar, filtros, consulta);
    } catch (erro) {
      setErroPin(erro instanceof Error ? erro.message : "Não consegui abrir as credenciais.");
      aoMudarCofre();
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <div className="mt-4 rounded-md border bg-card p-4">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void confirmar();
        }}
      >
        {camposFiltro.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              Filtros da consulta
            </legend>
            {periodoSugerido && camposFiltro.some((c) => c.tipo === "data") && (
              <p className="text-xs text-muted-foreground">
                Período preenchido a partir da sua pergunta: <b>{periodoSugerido.descricao}</b>.
                Ajuste se precisar.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {camposFiltro.map((c) =>
                c.tipo === "condicao" ? (
                  <label key={c.nome} className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--foreground)]"
                      checked={filtros[c.nome] === "1"}
                      onChange={(e) =>
                        setFiltros((f) => ({ ...f, [c.nome]: e.target.checked ? "1" : "" }))
                      }
                    />
                    {c.rotulo}
                  </label>
                ) : (
                  <div
                    key={c.nome}
                    className={c.papel === "avancado" ? "space-y-1 sm:col-span-2" : "space-y-1"}
                  >
                    <Label htmlFor={`filtro-${c.nome}`} className="text-xs">
                      {c.rotulo}
                      {c.obrigatorio ? " *" : ""}
                    </Label>
                    {c.tipo === "opcao" ? (
                      <select
                        id={`filtro-${c.nome}`}
                        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                        value={filtros[c.nome] ?? ""}
                        onChange={(e) => setFiltros((f) => ({ ...f, [c.nome]: e.target.value }))}
                      >
                        {!c.obrigatorio && <option value="">Todas</option>}
                        {(c.opcoes ?? []).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={`filtro-${c.nome}`}
                        type={c.tipo === "data" ? "date" : "text"}
                        value={filtros[c.nome] ?? ""}
                        onChange={(e) => setFiltros((f) => ({ ...f, [c.nome]: e.target.value }))}
                        placeholder={
                          c.papel === "filial" && consulta.slug === "sygecom"
                            ? "TODAS ou o código da filial"
                            : ""
                        }
                      />
                    )}
                    {c.dica && c.tipo !== "data" && (
                      <p className="text-[11px] leading-snug text-muted-foreground">{c.dica}</p>
                    )}
                  </div>
                ),
              )}
            </div>
            {periodoInvertido && (
              <p className="text-xs text-destructive">A data inicial é posterior à data final.</p>
            )}
          </fieldset>
        )}

        {modoPin && (
          <fieldset className="space-y-3">
            <legend className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-muted-foreground" />
              Credenciais salvas neste navegador
            </legend>
            <div className="max-w-xs space-y-1">
              <Label htmlFor={`pin-${consulta.id}`} className="text-xs">
                PIN
              </Label>
              <Input
                id={`pin-${consulta.id}`}
                type="password"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="text-xs underline underline-offset-4"
              onClick={() => setUsarOutras(true)}
            >
              Usar outras credenciais
            </button>
          </fieldset>
        )}

        {pedirCredenciais && !modoPin && (
          <fieldset className="space-y-3">
            <legend className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-muted-foreground" />
              {conexao
                ? `Conta ${comArtigo(consulta.slug, true)}`
                : "Credenciais do seu usuário de integração"}
            </legend>
            {conexao ? (
              conectado ? (
                <p className="text-sm">
                  Conta conectada
                  {conectado["user_id"] ? ` (vendedor ${conectado["user_id"]})` : ""}. O acesso fica
                  só neste navegador e nunca vai para a IA.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Abre a tela {comArtigo(consulta.slug, true)} numa janela. Entre com a conta
                    principal do vendedor e autorize o Stagium a ler os dados. Você pode revogar a
                    qualquer momento na própria conta.
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={() => void conectar()}>
                    {conectando ? "Abrir a janela de novo" : `Conectar ${nomeDo(consulta.slug)}`}
                  </Button>
                  {linkNaAba && (
                    <p className="text-xs">
                      <a href={linkNaAba} className="underline underline-offset-4">
                        Conectar nesta aba
                      </a>{" "}
                      <span className="text-muted-foreground">
                        (a conversa recomeça, mas a conta volta conectada)
                      </span>
                    </p>
                  )}
                  {conectando && (
                    <p className="text-xs text-muted-foreground" role="status">
                      Aguardando a autorização na janela {comArtigo(consulta.slug, true)}…
                    </p>
                  )}
                </div>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                Usadas apenas na consulta e nunca enviadas à IA.
              </p>
            )}
            {!conexao &&
              CREDENCIAIS.map((c) => (
                <div key={c.nome} className="space-y-1">
                  <Label htmlFor={`cred-${c.nome}`} className="text-xs">
                    {c.rotulo}
                    {obrigatoria(c) ? "" : " (opcional)"}
                  </Label>
                  <Input
                    id={`cred-${c.nome}`}
                    type={c.segredo ? "password" : "text"}
                    autoComplete={c.segredo ? "current-password" : "off"}
                    value={cred[c.nome] ?? ""}
                    onChange={(e) => setCred((atual) => ({ ...atual, [c.nome]: e.target.value }))}
                    placeholder={c.default ?? ""}
                  />
                  <p className="text-[11px] leading-snug text-muted-foreground">{c.onde_obter}</p>
                </div>
              ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--foreground)]"
                checked={lembrar}
                onChange={(e) => setLembrar(e.target.checked)}
              />
              Lembrar neste navegador
            </label>
            {lembrar && (
              <div className="max-w-xs space-y-1">
                <Label htmlFor={`pin-novo-${consulta.id}`} className="text-xs">
                  Crie um PIN (mínimo {PIN_MINIMO} caracteres)
                </Label>
                <Input
                  id={`pin-novo-${consulta.id}`}
                  type="password"
                  autoComplete="new-password"
                  value={pinNovo}
                  onChange={(e) => setPinNovo(e.target.value)}
                />
                <p className="text-[11px] leading-snug text-muted-foreground">
                  As credenciais ficam criptografadas só neste computador. Para usar, você digita o
                  PIN; ele não fica guardado. Use só em computador de uso próprio.
                </p>
              </div>
            )}
          </fieldset>
        )}

        {erroPin && <p className="text-sm text-destructive">{erroPin}</p>}

        <Button
          type="submit"
          size="sm"
          disabled={faltaFiltro || faltaCredencial || periodoInvertido || ocupado || abrindo}
        >
          Consultar {comArtigo(consulta.slug)}
        </Button>
      </form>
    </div>
  );
}

function Index() {
  const [mensagens, setMensagens] = useState<Mensagem[]>(() => [
    boasVindas(SISTEMAS.filter((s) => !exigeConexao(s.slug)).map((s) => comArtigo(s.slug))),
  ]);
  const { pergunta: perguntaInicial, sistema: sistemaDaUrl } = Route.useSearch();
  const [sistema, setSistema] = useState<string | null>(
    sistemaDaUrl ?? (SISTEMAS.length === 1 ? SISTEMAS[0]!.slug : null),
  );
  const [pergunta, setPergunta] = useState(perguntaInicial ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [paginando, setPaginando] = useState(false);
  const pararPaginas = useRef(false);
  const [iaLigada, setIaLigada] = useState(true);
  // credenciais em memória e cofres salvos, por sistema
  const [credPorSistema, setCredPorSistema] = useState<Record<string, Record<string, string>>>({});
  const [cofres, setCofres] = useState<Record<string, boolean>>({});
  const [salvas, setSalvas] = useState<ConsultaSalva[]>([]);
  const [painelAberto, setPainelAberto] = useState(false);
  /** Sistemas por autorização ainda sem o aplicativo configurado: ficam fora da escolha. */
  const [semAplicativo, setSemAplicativo] = useState<Set<string>>(
    () => new Set(SISTEMAS.filter((s) => exigeConexao(s.slug)).map((s) => s.slug)),
  );
  const sistemasVisiveis = SISTEMAS.filter((s) => !semAplicativo.has(s.slug));
  const fim = useRef<HTMLDivElement>(null);
  /** PIN usado nesta aba, por sistema: só em memória, para regravar o acesso renovado. */
  const pinsDaSessao = useRef<Record<string, string>>({});

  const credenciaisDe = (slug: string) => credPorSistema[slug] ?? {};
  const temCredenciaisDe = (slug: string) =>
    exigeConexao(slug)
      ? Boolean(credenciaisDe(slug)["refresh_token"] || credenciaisDe(slug)["access_token"])
      : credenciaisDo(slug).length > 0 &&
        credenciaisDo(slug).every((c) => !obrigatoria(c) || credenciaisDe(slug)[c.nome]);
  const temCredenciais = sistema ? temCredenciaisDe(sistema) : false;
  const credenciaisSalvas = sistema ? Boolean(cofres[sistema]) : false;
  const lerCofres = () =>
    setCofres(Object.fromEntries(SISTEMAS.map((s) => [s.slug, temCredenciaisSalvas(s.slug)])));

  function escolherSistema(slug: string, avisar = true) {
    setSistema(slug);
    try {
      localStorage.setItem(CHAVE_SISTEMA, slug);
    } catch {
      // sem armazenamento: vale só nesta aba
    }
    if (avisar) {
      const exemplos = sugestoesDo(slug)
        .slice(0, 3)
        .map((e) => `"${e.toLowerCase()}"`);
      setMensagens((atual) => [
        ...atual,
        mensagem("cliente", `Uso ${comArtigo(slug)}.`),
        mensagem(
          "assistente",
          `Certo, vou consultar ${comArtigo(slug)}. O que você precisa?` +
            (exemplos.length > 0 ? ` Por exemplo: ${exemplos.join(", ")}.` : ""),
        ),
      ]);
    }
  }

  // O navegador só existe no cliente: lê o que estiver salvo depois de montar.
  useEffect(() => {
    lerCofres();
    setSalvas(listarConsultasSalvas());
    conexoesConfiguradas()
      .then((prontas) => {
        const faltam = new Set(
          Object.entries(prontas)
            .filter(([, pronta]) => !pronta)
            .map(([slug]) => slug),
        );
        setSemAplicativo(faltam);
        const visiveis = SISTEMAS.filter((s) => !faltam.has(s.slug));
        // a boas-vindas cita só os sistemas que dá para usar agora
        setMensagens((atual) =>
          atual.length > 0
            ? [
                { ...boasVindas(visiveis.map((s) => comArtigo(s.slug))), id: atual[0]!.id },
                ...atual.slice(1),
              ]
            : atual,
        );
      })
      .catch(() => undefined);
    // conexão concluída numa aba (pop-up bloqueado): pega o acesso deixado pela página de retorno
    try {
      const pendente = sessionStorage.getItem(CHAVE_PENDENTE);
      if (pendente) {
        sessionStorage.removeItem(CHAVE_PENDENTE);
        const { slug, credenciais } = JSON.parse(pendente) as MensagemConexao;
        setCredPorSistema((atual) => ({ ...atual, [slug]: credenciais }));
        toast.success(`Conta ${comArtigo(slug, true)} conectada`);
      }
    } catch {
      // sem armazenamento: a pessoa conecta de novo pelo formulário
    }
    if (!sistemaDaUrl && SISTEMAS.length > 1) {
      try {
        const lembrado = localStorage.getItem(CHAVE_SISTEMA);
        if (lembrado && SISTEMAS.some((s) => s.slug === lembrado)) setSistema(lembrado);
      } catch {
        // sem armazenamento: o cliente escolhe na conversa
      }
    }
  }, []);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, ocupado]);

  async function enviar(texto: string) {
    const limpo = texto.trim();
    if (!limpo || ocupado) return;
    if (!sistema) {
      toast.message("Escolha primeiro o sistema que a sua empresa usa.");
      return;
    }

    setMensagens((atual) => [...atual, mensagem("cliente", limpo)]);
    setPergunta("");
    setEtapa(`Procurando a consulta certa no catálogo ${comArtigo(sistema, true)}…`);
    setOcupado(true);

    try {
      const resposta = await perguntarAoAssistente({
        data: {
          pergunta: limpo,
          historico: mensagens.map(({ autor, texto: t }) => ({ autor, texto: t })),
          sistema,
        },
      });

      setIaLigada(resposta.origem === "ia");
      const propostas = CONSULTAS.filter(
        (c) => c.slug === sistema && resposta.resposta.includes(c.id),
      );
      const periodo = interpretarPeriodo(limpo);
      setMensagens((atual) => [
        ...atual,
        mensagem(
          "assistente",
          resposta.resposta,
          propostas.length > 0 ? { propostas, ...(periodo ? { periodo } : {}) } : {},
        ),
      ]);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : "falha desconhecida";
      toast.error("A IA não respondeu", { description: motivo });
      setMensagens((atual) => [
        ...atual,
        mensagem("assistente", `Não consegui responder agora: ${motivo}`),
      ]);
    } finally {
      setOcupado(false);
    }
  }

  function aprovar(consulta: Consulta, periodo?: PeriodoInterpretado) {
    setMensagens((atual) => [
      ...atual,
      mensagem("cliente", `Pode executar: ${consulta.descricao.slice(0, 60)}`),
    ]);
    const temFiltros = (consulta.campos_filtro ?? []).length > 0;
    const prontas = temCredenciaisDe(consulta.slug);
    if (prontas && !temFiltros) {
      void executar(credenciaisDe(consulta.slug), {}, consulta);
      return;
    }
    const partes = [
      temFiltros ? "escolha os filtros" : "",
      prontas
        ? ""
        : cofres[consulta.slug]
          ? "digite o PIN das credenciais salvas"
          : "informe as credenciais do usuário de integração",
    ].filter(Boolean);
    const frase = partes.join(" e ");
    setMensagens((atual) => [
      ...atual,
      mensagem("assistente", frase.charAt(0).toUpperCase() + frase.slice(1) + ".", {
        formulario: consulta,
        ...(periodo ? { periodo } : {}),
      }),
    ]);
  }

  async function executar(
    cred: Record<string, string>,
    filtros: Record<string, string>,
    consulta: Consulta,
  ) {
    setCredPorSistema((atual) => ({ ...atual, [consulta.slug]: cred }));
    setEtapa(`Consultando ${comArtigo(consulta.slug)} e montando a planilha…`);
    setOcupado(true);
    const resumo = resumirFiltros(consulta, filtros);
    const nome = comArtigo(consulta.slug);
    const noSistema = `n${comArtigo(consulta.slug)}`;
    const maximo = 1000;
    let credAtual = cred;
    pararPaginas.current = false;
    try {
      // Sistemas com limite de requisições devolvem uma página por chamada (continuar=true):
      // o navegador espera o intervalo pedido e busca a próxima, mostrando o progresso.
      let pagina = 0;
      let chaveEmBase64 = false;
      let interrompida = false;
      const linhas: Record<string, string | number>[] = [];
      const colunas: { titulo: string; chave: string }[] = [];
      let parcial: Awaited<ReturnType<typeof executarConsultaReal>> | null = null;
      for (;;) {
        parcial = await executarConsultaReal({
          data: {
            endpointId: consulta.id,
            credenciais: credAtual,
            filtros,
            maximo,
            pagina,
            chaveEmBase64,
          },
        });
        chaveEmBase64 = parcial.chaveEmBase64;
        // OAuth: o acesso foi renovado e o anterior deixou de valer; guarda o novo
        if (parcial.credenciaisNovas) {
          credAtual = { ...credAtual, ...parcial.credenciaisNovas };
          const atualizadas = credAtual;
          setCredPorSistema((atual) => ({ ...atual, [consulta.slug]: atualizadas }));
          const pinSessao = pinsDaSessao.current[consulta.slug];
          if (pinSessao) {
            void salvarCredenciais(consulta.slug, atualizadas, pinSessao)
              .then(lerCofres)
              .catch(() => undefined);
          }
        }
        linhas.push(...parcial.linhas);
        for (const c of parcial.colunas) {
          if (!colunas.some((x) => x.chave === c.chave)) colunas.push(c);
        }
        if (!parcial.continuar || linhas.length >= maximo) break;
        if (pararPaginas.current) {
          interrompida = true;
          break;
        }
        setPaginando(true);
        pagina = parcial.proximaPagina;
        for (let falta = Math.ceil(parcial.esperarSegundos); falta > 0; falta -= 1) {
          if (pararPaginas.current) break;
          setEtapa(
            `${linhas.length.toLocaleString("pt-BR")} registros até agora. ` +
              `${nome.charAt(0).toUpperCase()}${nome.slice(1)} libera uma consulta a cada poucos segundos: próxima página em ${falta} s.`,
          );
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (pararPaginas.current) {
          interrompida = true;
          break;
        }
        setEtapa(`Buscando a página ${pagina + 1} ${noSistema}…`);
      }
      const resultado = {
        ...parcial!,
        colunas,
        linhas: linhas.slice(0, maximo),
        aviso:
          [
            parcial!.aviso,
            interrompida
              ? `Consulta interrompida a seu pedido com ${linhas.length} registros; pode haver mais ${noSistema}.`
              : "",
            linhas.length >= maximo
              ? `Parei em ${maximo} registros. Para trazer o restante, divida o período.`
              : "",
          ]
            .filter(Boolean)
            .join(" ") || null,
      };
      const planilha = planilhaDaConsulta(consulta, resultado, resumo);
      setMensagens((atual) => [
        ...atual,
        mensagem(
          "assistente",
          resultado.linhas.length > 0
            ? `Pronto. ${resultado.linhas.length} registros de **${resultado.titulo}**.` +
                (resumo ? `\nFiltros: ${resumo}.` : "") +
                (resultado.aviso
                  ? `

Observação: ${resultado.aviso}`
                  : "")
            : `A consulta funcionou, mas ${comArtigo(consulta.slug)} não devolveu nenhum registro para **${resultado.titulo}**` +
                (resumo ? ` com os filtros ${resumo}` : "") +
                ". Tente ampliar o período ou trocar a filial — ou o usuário de integração não tem acesso a esses dados.",
          resultado.linhas.length > 0
            ? { planilha, execucao: { consultaId: consulta.id, filtros } }
            : {},
        ),
      ]);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : "falha desconhecida";
      toast.error(`Não consegui consultar ${comArtigo(consulta.slug)}`, { description: motivo });
      // Esquece os segredos desta conversa para o formulário pedi-los de novo, em vez de
      // repetir a tentativa com os mesmos; mantém o que não é segredo (ex.: endereço da API).
      const conexaoFalhou = exigeConexao(consulta.slug) && /autoriza|conect/i.test(motivo);
      const semSegredos = Object.fromEntries(
        credenciaisDo(consulta.slug)
          .filter((c) => !c.segredo && cred[c.nome])
          .map((c) => [c.nome, cred[c.nome]!]),
      );
      if (!exigeConexao(consulta.slug) || conexaoFalhou) {
        setCredPorSistema((atual) => ({ ...atual, [consulta.slug]: semSegredos }));
      }
      setMensagens((atual) => [
        ...atual,
        mensagem(
          "assistente",
          `Não deu certo: ${motivo}\n\n` +
            (exigeConexao(consulta.slug)
              ? conexaoFalhou
                ? "**Conecte a conta de novo e tente novamente.**"
                : "**Tente novamente.**"
              : "**Confira as credenciais e tente novamente.**") +
            " Deixei o formulário abaixo com os mesmos filtros." +
            (cofres[consulta.slug]
              ? " Se as credenciais salvas estiverem desatualizadas, clique em “Usar outras credenciais” e salve as novas."
              : ""),
          { formulario: consulta, filtrosIniciais: filtros },
        ),
      ]);
    } finally {
      setOcupado(false);
      setPaginando(false);
    }
  }

  function salvarDaMensagem(m: Mensagem, nome: string): boolean {
    const consulta = CONSULTAS.find((c) => c.id === m.execucao?.consultaId);
    if (!consulta || !m.execucao) return false;
    try {
      const preparado = prepararParaSalvar(consulta.campos_filtro ?? [], m.execucao.filtros);
      salvarConsulta({ nome, consultaId: consulta.id, ...preparado });
      setSalvas(listarConsultasSalvas());
      toast.success("Consulta salva", {
        description: preparado.periodo
          ? `O período "${preparado.periodo}" é recalculado a cada vez.`
          : "Abra em Minhas consultas para rodar de novo.",
      });
      return true;
    } catch (erro) {
      toast.error("Não consegui salvar", {
        description: erro instanceof Error ? erro.message : "falha desconhecida",
      });
      return false;
    }
  }

  function rodarSalva(salva: ConsultaSalva) {
    const consulta = CONSULTAS.find((c) => c.id === salva.consultaId);
    if (!consulta) {
      toast.error("Esta consulta não existe mais no catálogo", { description: salva.nome });
      return;
    }
    setPainelAberto(false);
    if (consulta.slug !== sistema) escolherSistema(consulta.slug, false);
    const filtros = filtrosParaExecutar(consulta.campos_filtro ?? [], salva);
    setMensagens((atual) => [
      ...atual,
      mensagem("cliente", `Rodar consulta salva: **${salva.nome}**`),
    ]);
    if (temCredenciaisDe(consulta.slug)) {
      void executar(credenciaisDe(consulta.slug), filtros, consulta);
      return;
    }
    setMensagens((atual) => [
      ...atual,
      mensagem(
        "assistente",
        cofres[consulta.slug]
          ? "Digite o PIN das credenciais salvas para rodar."
          : "Informe as credenciais do usuário de integração para rodar.",
        { formulario: consulta, filtrosIniciais: filtros },
      ),
    ]);
  }

  function nomeSugerido(m: Mensagem): string {
    const consulta = CONSULTAS.find((c) => c.id === m.execucao?.consultaId);
    if (!consulta || !m.execucao || !m.planilha) return "";
    const titulo = m.planilha.titulo.split(" — ")[0] ?? m.planilha.titulo;
    const { periodo } = prepararParaSalvar(consulta.campos_filtro ?? [], m.execucao.filtros);
    return periodo ? `${titulo} (${periodo})` : titulo;
  }

  async function baixar(m: Mensagem) {
    if (!m.planilha) return;
    try {
      await baixarPlanilha(m.planilha);
      toast.success("Planilha gerada", { description: m.planilha.nomeArquivo });
    } catch (erro) {
      toast.error("Não consegui gerar a planilha", {
        description: erro instanceof Error ? erro.message : "falha desconhecida",
      });
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-5">
          <h1>
            <Link to="/" className="marca-celula" aria-label="Stagium, página inicial">
              Stagium
            </Link>
          </h1>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setPainelAberto(true)}
            >
              <Bookmark className="mr-1 size-3.5" />
              Minhas consultas{salvas.length > 0 ? ` (${salvas.length})` : ""}
            </Button>
            {sistema && SISTEMAS.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                title="Trocar o sistema consultado"
                onClick={() => setSistema(null)}
              >
                Sistema: {nomeDo(sistema)}
              </Button>
            )}
            {sistema && (temCredenciais || credenciaisSalvas) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setCredPorSistema((atual) => ({ ...atual, [sistema]: {} }));
                  apagarCredenciaisSalvas(sistema);
                  lerCofres();
                  toast.success(`Credenciais ${comArtigo(sistema, true)} apagadas deste navegador`);
                }}
              >
                Esquecer credenciais
              </Button>
            )}
            <span className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${iaLigada ? "bg-emerald-600" : "bg-muted-foreground/50"}`}
                aria-hidden
              />
              {iaLigada ? "IA conectada" : "IA desligada"}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="flex flex-col gap-7">
          {mensagens.map((m) =>
            m.autor === "cliente" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-md bg-primary px-4 py-2.5 text-[0.9375rem] leading-relaxed text-primary-foreground">
                  <Texto conteudo={m.texto} />
                </div>
              </div>
            ) : (
              <div key={m.id} className="max-w-full">
                <div className="max-w-[65ch] space-y-1 text-[0.9375rem] leading-relaxed">
                  <Texto conteudo={m.texto} />
                </div>

                {m.propostas && m.propostas.length > 0 && (
                  <div className="mt-4 flex flex-col gap-3">
                    {m.propostas.map((consulta, indice) => (
                      <div key={consulta.id} className="overflow-hidden rounded-md border bg-card">
                        <div className="px-4 pt-3 pb-3">
                          <p className="text-sm leading-snug font-medium">{consulta.descricao}</p>
                          <p className="mono mt-1 text-xs text-muted-foreground">
                            {consulta.metodo} {consulta.path}
                          </p>
                        </div>
                        {consulta.colunas && consulta.colunas.length > 0 && (
                          <Grade
                            descricao={`Colunas que a planilha vai trazer: ${consulta.colunas.join(", ")}`}
                            titulos={consulta.colunas}
                          />
                        )}
                        <div className="px-4 py-3">
                          <Button
                            size="sm"
                            variant={indice === 0 ? "default" : "outline"}
                            disabled={ocupado}
                            onClick={() => aprovar(consulta, m.periodo)}
                          >
                            Executar esta consulta
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {m.formulario && (
                  <FormularioConsulta
                    consulta={m.formulario}
                    credenciais={credenciaisDe(m.formulario.slug)}
                    pedirCredenciais={!temCredenciaisDe(m.formulario.slug)}
                    credenciaisSalvas={Boolean(cofres[m.formulario.slug])}
                    aoMudarCofre={lerCofres}
                    aoGuardarPin={(pin) => {
                      pinsDaSessao.current[m.formulario!.slug] = pin;
                    }}
                    {...(m.periodo ? { periodoSugerido: m.periodo } : {})}
                    {...(m.filtrosIniciais ? { filtrosIniciais: m.filtrosIniciais } : {})}
                    ocupado={ocupado}
                    aoConfirmar={(cred, filtros, consulta) =>
                      void executar(cred, filtros, consulta)
                    }
                  />
                )}

                {m.planilha && (
                  <PreviaPlanilha
                    planilha={m.planilha}
                    aoBaixar={() => void baixar(m)}
                    {...(m.execucao
                      ? {
                          nomeSugerido: nomeSugerido(m),
                          aoSalvar: (nome: string) => salvarDaMensagem(m, nome),
                        }
                      : {})}
                  />
                )}
              </div>
            ),
          )}

          {ocupado && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" />
                {etapa}
              </p>
              {paginando && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    pararPaginas.current = true;
                    setEtapa("Parando e montando a planilha com o que já veio…");
                  }}
                >
                  Parar e gerar com o que veio
                </Button>
              )}
            </div>
          )}
          <div ref={fim} />
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 pt-3 pb-4">
          {!sistema ? (
            <div className="mb-3">
              <p className="mb-2 text-sm font-medium">Qual sistema a sua empresa usa?</p>
              <div className="flex flex-wrap gap-2">
                {sistemasVisiveis.map((sis) => (
                  <Button key={sis.slug} size="sm" onClick={() => escolherSistema(sis.slug)}>
                    {sis.nome}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            mensagens.length <= 3 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {salvas
                  .filter((salva) => salva.consultaId.startsWith(sistema + "."))
                  .slice(0, 4)
                  .map((salva) => (
                    <Button
                      key={salva.id}
                      size="sm"
                      className="max-w-full"
                      onClick={() => rodarSalva(salva)}
                      disabled={ocupado}
                    >
                      <Bookmark className="mr-1.5 size-3.5" />
                      <span className="truncate">{salva.nome}</span>
                    </Button>
                  ))}
                {sugestoesDo(sistema).map((sug) => (
                  <Button
                    key={sug}
                    variant="outline"
                    size="sm"
                    className="bg-card"
                    onClick={() => void enviar(sug)}
                    disabled={ocupado}
                  >
                    {sug}
                  </Button>
                ))}
              </div>
            )
          )}
          <form
            className="flex items-end gap-2 rounded-md border border-input bg-card p-1.5 focus-within:border-foreground"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(pergunta);
            }}
          >
            <Textarea
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar(pergunta);
                }
              }}
              placeholder={
                sistema
                  ? `O que você precisa ${comArtigo(sistema, true)}?`
                  : "Escolha o sistema acima"
              }
              aria-label="Sua pergunta"
              rows={1}
              className="max-h-40 min-h-10 resize-none border-0 bg-transparent px-2.5 py-2 text-[0.9375rem] shadow-none focus-visible:ring-0 focus-visible:shadow-none focus-visible:outline-none"
            />
            <Button
              type="submit"
              size="icon"
              className="size-10 shrink-0"
              disabled={ocupado || !pergunta.trim() || !sistema}
            >
              <ArrowUp className="size-4" />
              <span className="sr-only">Enviar pergunta</span>
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Só consultas de leitura, sempre com a sua aprovação. Nunca digite senha aqui na
            conversa: as credenciais vão no formulário.
          </p>
        </div>
      </div>
      <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Minhas consultas</SheetTitle>
            <SheetDescription>
              Salvas neste navegador. As credenciais nunca ficam aqui.
            </SheetDescription>
          </SheetHeader>
          {salvas.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Nenhuma consulta salva ainda. Depois de gerar uma planilha, use “Salvar esta consulta”
              para rodar de novo com um clique.
            </p>
          ) : (
            <ul className="mt-6 divide-y border-y">
              {salvas.map((salva) => {
                const consulta = CONSULTAS.find((c) => c.id === salva.consultaId);
                const periodo = descreverPeriodo(consulta, salva);
                const outros = consulta
                  ? resumirFiltros(
                      consulta,
                      Object.fromEntries(
                        Object.entries(salva.filtros).filter(
                          ([k]) =>
                            !(consulta.campos_filtro ?? []).some(
                              (c) => c.nome === k && c.tipo === "data",
                            ),
                        ),
                      ),
                    )
                  : "";
                return (
                  <li key={salva.id} className="py-4">
                    <p className="font-medium">{salva.nome}</p>
                    {SISTEMAS.length > 1 && consulta && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {nomeDo(consulta.slug)}
                      </p>
                    )}
                    {periodo && <p className="mt-1 text-xs text-muted-foreground">{periodo}</p>}
                    {outros && <p className="mt-0.5 text-xs text-muted-foreground">{outros}</p>}
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" disabled={ocupado} onClick={() => rodarSalva(salva)}>
                        Rodar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          apagarConsultaSalva(salva.id);
                          setSalvas(listarConsultasSalvas());
                        }}
                      >
                        <Trash2 className="mr-1.5 size-3.5" />
                        Apagar
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
