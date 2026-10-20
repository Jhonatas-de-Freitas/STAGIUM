/**
 * Tipos do painel do cliente (SaaS).
 *
 * No modo local tudo fica no navegador (repositorio-local.ts). Quando houver banco
 * (Supabase), só a implementação do repositório muda; estes tipos continuam iguais.
 */
import type { Direitos, Frequencia, FormatoRelatorio } from "../planos";

export type PapelEmpresa = "dono" | "admin" | "analista" | "leitor";
export type Papel = PapelEmpresa | "superadmin";

export type StatusEmpresa = "teste" | "ativa" | "suspensa" | "cancelada";
export type CicloCobranca = "mensal" | "anual";
export type OrigemEmpresa = "cadastro" | "concedido" | "demo";

export type Empresa = {
  id: string;
  nome: string;
  documento: string;
  planoId: string;
  status: StatusEmpresa;
  /** Fim do teste grátis (ISO). Só vale enquanto status = "teste". */
  testeAte: string | null;
  /** Acesso concedido sem cobrança (parceiro, piloto, cortesia). */
  cortesia: boolean;
  /** Fim da cortesia (ISO) ou null para sem prazo. */
  cortesiaAte: string | null;
  ciclo: CicloCobranca;
  origem: OrigemEmpresa;
  /** Sobrescreve limites do plano só para esta empresa (negociação comercial). */
  limitesEspeciais: Partial<Direitos>;
  observacao: string;
  criadaEm: string;
};

export type SenhaHash = { sal: string; hash: string; iteracoes: number };

export type Usuario = {
  id: string;
  /** null = administrador da plataforma (nós). */
  empresaId: string | null;
  nome: string;
  email: string;
  papel: Papel;
  senha: SenhaHash;
  ativo: boolean;
  precisaTrocarSenha: boolean;
  criadoEm: string;
  ultimoAcesso: string | null;
};

export type Convite = {
  /** Código que vai no link do convite. */
  id: string;
  empresaId: string;
  email: string;
  papel: PapelEmpresa;
  criadoPor: string;
  criadoEm: string;
  expiraEm: string;
  usadoEm: string | null;
};

export type Sessao = {
  usuarioId: string;
  criadaEm: string;
  expiraEm: string;
  /** Admin da plataforma vendo o painel de um cliente (suporte). */
  personificando: string | null;
};

export type SolicitacaoPlano = {
  id: string;
  empresaId: string;
  planoDesejado: string;
  mensagem: string;
  criadaEm: string;
  atendidaEm: string | null;
};

export type ConfigPlataforma = {
  id: "config";
  cadastroPublico: boolean;
  diasDeTeste: number;
};

/* ---------- dados do cliente ---------- */

export type TipoColuna = "texto" | "numero" | "moeda" | "data" | "percentual";

export type ColunaDados = {
  chave: string;
  titulo: string;
  tipo: TipoColuna;
  /** Dado pessoal (CPF, e-mail, telefone...): não vai à IA nem entra em relatório sem aviso. */
  sensivel?: boolean | undefined;
};

export type Linha = Record<string, string | number | null>;

export type TipoDataset = "vendas" | "receber" | "pagar" | "estoque" | "generico";

export type Dataset = {
  id: string;
  nome: string;
  descricao: string;
  tipo: TipoDataset;
  fonte: "demo" | "planilha" | "erp";
  sistema?: string | undefined;
  colunas: ColunaDados[];
  linhas: Linha[];
  atualizadoEm: string;
};

/* ---------- consulta declarativa (a IA nunca escreve código, só preenche isto) ---------- */

export type Agregacao = "soma" | "media" | "contagem" | "maximo" | "minimo" | "distintos";
export type Operador = "=" | "!=" | ">" | ">=" | "<" | "<=" | "contem" | "em";
export type Granularidade = "dia" | "semana" | "mes" | "ano";

export type Filtro = { coluna: string; op: Operador; valor: string | number | (string | number)[] };
export type Medida = { coluna?: string | undefined; agregacao: Agregacao; rotulo?: string | undefined };
export type Agrupamento = { coluna: string; granularidade?: Granularidade | undefined };

export type PlanoDeConsulta = {
  datasetId: string;
  modo: "agregado" | "lista";
  filtros?: Filtro[] | undefined;
  /** Período relativo ("mês passado") aplicado a uma coluna de data. */
  periodo?: { coluna: string; expressao: string } | undefined;
  agruparPor?: Agrupamento[] | undefined;
  medidas?: Medida[] | undefined;
  colunas?: string[] | undefined;
  ordenarPor?: { campo: string; direcao: "asc" | "desc" } | undefined;
  limite?: number | undefined;
};

export type ResultadoConsulta = {
  colunas: ColunaDados[];
  linhas: Linha[];
  /** Linhas que casaram com os filtros antes de agrupar. */
  linhasLidas: number;
  descricaoPeriodo?: string | undefined;
};

export type TipoVisual = "kpi" | "barras" | "barras_h" | "linha" | "area" | "pizza" | "tabela";

export type Widget = {
  id: string;
  titulo: string;
  visual: TipoVisual;
  plano: PlanoDeConsulta;
  /** Largura em colunas (de 3). */
  largura: 1 | 2 | 3;
  /** KPI: compara com o período anterior do mesmo tamanho. */
  comparar?: boolean | undefined;
};

export type Dashboard = {
  id: string;
  nome: string;
  descricao: string;
  widgets: Widget[];
  periodoPadrao: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type Relatorio = {
  id: string;
  nome: string;
  plano: PlanoDeConsulta;
  formato: FormatoRelatorio;
  incluirResumo: boolean;
  frequencia: Frequencia;
  /** HH:MM, horário de Brasília. */
  hora: string;
  /** 0 = domingo ... 6 = sábado (semanal). */
  diaSemana: number;
  /** 1..28 ou 0 = último dia do mês (mensal/trimestral). */
  diaMes: number;
  destinatarios: string[];
  assunto: string;
  mensagem: string;
  ativo: boolean;
  criadoPor: string;
  criadoEm: string;
  ultimaExecucao: string | null;
};

export type Execucao = {
  id: string;
  relatorioId: string;
  nomeRelatorio: string;
  em: string;
  origem: "manual" | "agendada";
  /** "simulado": o envio por e-mail só existe quando o servidor estiver ativo. */
  status: "ok" | "simulado" | "erro";
  linhas: number;
  destinatarios: string[];
  mensagem: string;
};

export type Alerta = {
  id: string;
  nome: string;
  plano: PlanoDeConsulta;
  condicao: ">" | "<" | ">=" | "<=";
  limite: number;
  ativo: boolean;
  criadoPor: string;
  criadoEm: string;
};

export type Conexao = {
  id: string;
  /** slug do catálogo, ou "demo" para os dados de demonstração. */
  slug: string;
  apelido: string;
  criadaEm: string;
};

export type EventoAuditoria = {
  id: string;
  em: string;
  usuarioId: string;
  usuarioNome: string;
  acao: string;
  detalhe: string;
};

export type MensagemChat = {
  id: string;
  autor: "cliente" | "assistente";
  texto: string;
  em: string;
  plano?: PlanoDeConsulta | undefined;
  visual?: TipoVisual | undefined;
  titulo?: string | undefined;
  origem?: "ia" | "regras" | undefined;
};

export type RegistroUso = { id: string; mes: string; consultas: number; creditosIa: number };
