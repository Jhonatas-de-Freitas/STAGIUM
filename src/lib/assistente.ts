import type { CampoFiltro } from "./executor.servidor";
import type { PeriodoInterpretado } from "./periodo";
import type { DadosPlanilha } from "./planilha";

export type Consulta = {
  id: string;
  sistema: string;
  slug: string;
  entidade: string;
  acao: string;
  metodo: string;
  path: string;
  descricao: string;
  quando_usar?: string;
  filtros?: string[];
  colunas?: string[];
  paginacao?: string;
  fonte?: string;
  campos_filtro?: CampoFiltro[];
};

export type Mensagem = {
  id: string;
  autor: "cliente" | "assistente";
  texto: string;
  propostas?: Consulta[];
  planilha?: DadosPlanilha;
  /** Formulário de filtros e, se faltarem, credenciais para executar a consulta. */
  formulario?: Consulta;
  /** Período reconhecido na pergunta do cliente, para preencher o formulário. */
  periodo?: PeriodoInterpretado;
  /** Filtros já definidos (consulta salva), para preencher o formulário. */
  filtrosIniciais?: Record<string, string>;
  /** O que foi executado para gerar a planilha, para poder salvar a consulta. */
  execucao?: { consultaId: string; filtros: Record<string, string> };
  /** A consulta falhou: a mensagem aparece marcada como erro. */
  erro?: boolean;
};

const identificador = () => Math.random().toString(36).slice(2, 10);

export function mensagem(
  autor: Mensagem["autor"],
  texto: string,
  extra: Partial<Mensagem> = {},
): Mensagem {
  return { id: identificador(), autor, texto, ...extra };
}

/** Lista em português: "A", "A e B", "A, B e C". */
export const listaPt = (itens: string[]) =>
  itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;

/** `sistemas` já com artigo: "o Nomus", "a Qive (Arquivei)". */
export function boasVindas(sistemas: string[]): Mensagem {
  return mensagem(
    "assistente",
    `Olá, eu sou o **Stagium**. Leio a API dos sistemas da sua empresa e trago os dados da operação em planilha. Hoje conheço ${listaPt(sistemas)}.

Me diga o que você precisa, em português. Quando você aprovar a consulta, eu peço as credenciais do seu usuário de integração. Elas nunca passam pela IA e, se você quiser, ficam salvas neste navegador, protegidas por um PIN.

Gostou de uma consulta? Salve-a junto da planilha e rode de novo em **Minhas consultas**.`,
  );
}

/** Monta os dados da planilha a partir do que a API devolveu. */
export function planilhaDaConsulta(
  consulta: Consulta,
  resultado: {
    titulo: string;
    metodo: string;
    path: string;
    colunas: { titulo: string; chave: string }[];
    linhas: Record<string, string | number>[];
    aviso?: string | null;
  },
  filtrosAplicados = "",
): DadosPlanilha {
  return {
    nomeArquivo: `${consulta.id.replace(/\./g, "_")}.xlsx`,
    titulo: `${resultado.titulo} — ${consulta.sistema}`,
    colunas: resultado.colunas,
    linhas: resultado.linhas,
    informacoes: [
      { rotulo: "Sistema", valor: consulta.sistema },
      { rotulo: "Consulta", valor: consulta.id },
      { rotulo: "Chamada", valor: `${resultado.metodo} ${resultado.path}` },
      { rotulo: "Registros", valor: String(resultado.linhas.length) },
      { rotulo: "Consultado em", valor: new Date().toLocaleString("pt-BR") },
      { rotulo: "Documentação", valor: consulta.fonte ?? "" },
      { rotulo: "Filtros aplicados", valor: filtrosAplicados || "nenhum" },
      ...(resultado.aviso ? [{ rotulo: "Ajuste de colunas", valor: resultado.aviso }] : []),
      {
        rotulo: "Observação",
        valor:
          "Dados lidos da API do próprio cliente. Nenhuma credencial fica gravada neste arquivo.",
      },
    ],
  };
}
