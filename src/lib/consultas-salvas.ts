/**
 * Consultas salvas pelo cliente: qual consulta, quais filtros e um nome.
 * Ficam no localStorage deste navegador e nunca guardam credenciais.
 *
 * Período relativo: se as datas escolhidas batem com "mês passado", "este mês" etc.
 * no dia em que a consulta foi salva, guardamos a expressão, e ela é recalculada a cada
 * execução. Datas que não batem com nenhuma expressão ficam fixas.
 */
import type { CampoFiltro } from "./executor.servidor";
import { interpretarPeriodo } from "./periodo";

export type ConsultaSalva = {
  id: string;
  nome: string;
  consultaId: string;
  /** Filtros sem as datas quando o período é relativo. */
  filtros: Record<string, string>;
  /** Expressão de período relativo (ex.: "mês passado") ou null para datas fixas. */
  periodo: string | null;
  criadaEm: string;
};

const CHAVE = "stagium.consultas.v1";

const PERIODOS_RELATIVOS = [
  "hoje",
  "ontem",
  "esta semana",
  "semana passada",
  "este mês",
  "mês passado",
  "últimos 7 dias",
  "últimos 15 dias",
  "últimos 30 dias",
  "últimos 60 dias",
  "últimos 90 dias",
  "este ano",
  "ano passado",
];

export function listarConsultasSalvas(): ConsultaSalva[] {
  try {
    const texto = localStorage.getItem(CHAVE);
    return texto ? (JSON.parse(texto) as ConsultaSalva[]) : [];
  } catch {
    return [];
  }
}

function gravar(lista: ConsultaSalva[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    throw new Error(
      "Este navegador não permite salvar dados (janela anônima ou bloqueio de cookies).",
    );
  }
}

export function salvarConsulta(dados: Omit<ConsultaSalva, "id" | "criadaEm">): ConsultaSalva {
  const nova: ConsultaSalva = {
    ...dados,
    id: Math.random().toString(36).slice(2, 10),
    criadaEm: new Date().toISOString(),
  };
  gravar([nova, ...listarConsultasSalvas()]);
  return nova;
}

export function apagarConsultaSalva(id: string) {
  gravar(listarConsultasSalvas().filter((c) => c.id !== id));
}

/** Desfaz o apagar: devolve a consulta ao lugar dela (mais recentes primeiro). */
export function restaurarConsultaSalva(salva: ConsultaSalva) {
  const lista = listarConsultasSalvas().filter((c) => c.id !== salva.id);
  gravar([...lista, salva].sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)));
}

const papel = (campos: CampoFiltro[], p: CampoFiltro["papel"]) => campos.find((c) => c.papel === p);

/** Decide se o período dos filtros é relativo e tira as datas quando for. */
export function prepararParaSalvar(
  campos: CampoFiltro[],
  filtros: Record<string, string>,
): { filtros: Record<string, string>; periodo: string | null } {
  const inicio = papel(campos, "periodo_inicio");
  const fim = papel(campos, "periodo_fim");
  const data = papel(campos, "data");
  const restantes = { ...filtros };

  if (inicio && fim) {
    const expressao = PERIODOS_RELATIVOS.find((e) => {
      const p = interpretarPeriodo(e);
      return p && p.inicio === filtros[inicio.nome] && p.fim === filtros[fim.nome];
    });
    if (expressao) {
      delete restantes[inicio.nome];
      delete restantes[fim.nome];
      return { filtros: restantes, periodo: expressao };
    }
  } else if (data) {
    const expressao = ["hoje", "ontem"].find(
      (e) => interpretarPeriodo(e)?.fim === filtros[data.nome],
    );
    if (expressao) {
      delete restantes[data.nome];
      return { filtros: restantes, periodo: expressao };
    }
  }
  return { filtros: restantes, periodo: null };
}

/** Filtros prontos para executar hoje, com o período relativo recalculado. */
export function filtrosParaExecutar(
  campos: CampoFiltro[],
  salva: ConsultaSalva,
): Record<string, string> {
  const filtros = { ...salva.filtros };
  const p = salva.periodo ? interpretarPeriodo(salva.periodo) : null;
  if (p) {
    const inicio = papel(campos, "periodo_inicio");
    const fim = papel(campos, "periodo_fim");
    const data = papel(campos, "data");
    if (inicio) filtros[inicio.nome] = p.inicio;
    if (fim) filtros[fim.nome] = p.fim;
    if (data) filtros[data.nome] = p.fim;
  }
  return filtros;
}
