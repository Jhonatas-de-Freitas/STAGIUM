/**
 * Interpreta o período escrito em português na pergunta do cliente.
 *
 * Feito por regras, e não pelo modelo de IA, de propósito: data errada gera planilha
 * errada sem ninguém perceber. Quando não reconhece o período, devolve null e o
 * formulário fica com o padrão (mês corrente) para o cliente ajustar.
 */

export type PeriodoInterpretado = {
  inicio: string; // AAAA-MM-DD
  fim: string; // AAAA-MM-DD
  descricao: string; // como apareceu para o cliente, ex.: "agosto de 2026"
};

const MESES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const NOMES_MESES = MESES.map((m) => (m === "marco" ? "março" : m));

const dois = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const dia = (ano: number, mes: number, d: number) => new Date(ano, mes, d);
const ultimoDia = (ano: number, mes: number) => new Date(ano, mes + 1, 0);
const menor = (a: Date, b: Date) => (a < b ? a : b);
const br = (d: Date) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;

function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

function periodo(inicio: Date, fim: Date, descricao: string): PeriodoInterpretado {
  return { inicio: iso(inicio), fim: iso(fim), descricao };
}

/** Ano de um mês citado sem ano: se o mês ainda não chegou, é o do ano passado. */
function anoDoMes(mes: number, hoje: Date) {
  return mes > hoje.getMonth() ? hoje.getFullYear() - 1 : hoje.getFullYear();
}

function dataDe(dd: string, mm: string, aaaa: string | undefined, hoje: Date): Date | null {
  const d = Number(dd);
  const m = Number(mm) - 1;
  let a = aaaa ? Number(aaaa) : hoje.getFullYear();
  if (aaaa && aaaa.length === 2) a = 2000 + a;
  const data = dia(a, m, d);
  // rejeita datas impossíveis (31/02 vira março no JavaScript)
  return data.getMonth() === m && data.getDate() === d ? data : null;
}

export function interpretarPeriodo(
  pergunta: string,
  hoje: Date = new Date(),
): PeriodoInterpretado | null {
  const t = normalizar(pergunta);
  const hojeZero = dia(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const DATA = String.raw`(\d{1,2})/(\d{1,2})(?:/(\d{4}|\d{2}))?`;

  // 1. intervalo explícito: "de 01/08 a 15/08", "entre 01/08/2026 e 15/09/2026"
  const intervalo = new RegExp(
    String.raw`(?:de|entre|desde)?\s*${DATA}\s*(?:a|ate|e|-)\s*${DATA}`,
  ).exec(t);
  if (intervalo) {
    const [, d1, m1, a1, d2, m2, a2] = intervalo;
    const fim = dataDe(d2!, m2!, a2, hoje);
    let inicio = dataDe(d1!, m1!, a1 ?? a2, hoje);
    if (inicio && fim && inicio > fim && !a1) {
      inicio = dataDe(d1!, m1!, String(fim.getFullYear() - 1), hoje);
    }
    if (inicio && fim && inicio <= fim) {
      return periodo(inicio, fim, `${br(inicio)} a ${br(fim)}`);
    }
  }

  // 2. data única: "em 15/08/2026", "dia 15/08"
  const unica = new RegExp(DATA).exec(t);
  if (unica) {
    const data = dataDe(unica[1]!, unica[2]!, unica[3], hoje);
    if (data) return periodo(data, data, br(data));
  }

  // 3. dias relativos
  if (/\bhoje\b/.test(t)) return periodo(hojeZero, hojeZero, "hoje");
  if (/\bontem\b/.test(t)) {
    const ontem = dia(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
    return periodo(ontem, ontem, "ontem");
  }

  // 3b. "próximos N dias/semanas/meses" (contas a vencer, previsões)
  const proximos = /\bproxim[oa]s? (\d{1,3}) (dias?|semanas?|mes(?:es)?)\b/.exec(t);
  if (proximos) {
    const n = Number(proximos[1]);
    const unidade = proximos[2]!;
    const fim = new Date(hojeZero);
    if (unidade.startsWith("dia")) fim.setDate(fim.getDate() + n);
    else if (unidade.startsWith("semana")) fim.setDate(fim.getDate() + n * 7);
    else fim.setMonth(fim.getMonth() + n);
    return periodo(hojeZero, fim, `próximos ${n} ${unidade}`);
  }

  // 4. "últimos N dias/semanas/meses"
  const ultimos = /\bultim[oa]s? (\d{1,3}) (dias?|semanas?|mes(?:es)?)\b/.exec(t);
  if (ultimos) {
    const n = Number(ultimos[1]);
    const unidade = ultimos[2]!;
    const inicio = new Date(hojeZero);
    if (unidade.startsWith("dia")) inicio.setDate(inicio.getDate() - (n - 1));
    else if (unidade.startsWith("semana")) inicio.setDate(inicio.getDate() - (n * 7 - 1));
    else inicio.setMonth(inicio.getMonth() - n);
    return periodo(inicio, hojeZero, `últimos ${n} ${unidade}`);
  }

  // 5. semanas (segunda a domingo)
  const segundaDaSemana = (d: Date) => {
    const r = new Date(d);
    r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
    return r;
  };
  if (/\b(semana passada|ultima semana|semana anterior)\b/.test(t)) {
    const inicio = segundaDaSemana(hojeZero);
    inicio.setDate(inicio.getDate() - 7);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 6);
    return periodo(inicio, fim, "semana passada");
  }
  if (/\b(esta|nesta|essa|nessa|desta|dessa) semana\b/.test(t)) {
    return periodo(segundaDaSemana(hojeZero), hojeZero, "esta semana");
  }

  // 6. meses relativos
  if (/\b(mes passado|ultimo mes|mes anterior)\b/.test(t)) {
    const a = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear();
    const m = (hoje.getMonth() + 11) % 12;
    return periodo(dia(a, m, 1), ultimoDia(a, m), `${NOMES_MESES[m]} de ${a}`);
  }
  if (/\b(este|neste|esse|nesse|deste|desse) mes\b|\bmes atual\b|\bdo mes\b/.test(t)) {
    return periodo(dia(hoje.getFullYear(), hoje.getMonth(), 1), hojeZero, "este mês");
  }

  // 7. meses por nome: "agosto", "agosto de 2025", "de agosto a setembro"
  const nomeMes = MESES.join("|");
  const faixaMeses = new RegExp(
    String.raw`\b(${nomeMes})(?:\s+(?:de\s+)?(\d{4}))?\s+(?:a|ate)\s+(${nomeMes})(?:\s+(?:de\s+)?(\d{4}))?\b`,
  ).exec(t);
  if (faixaMeses) {
    const m1 = MESES.indexOf(faixaMeses[1]!);
    const m2 = MESES.indexOf(faixaMeses[3]!);
    const a2 = faixaMeses[4] ? Number(faixaMeses[4]) : anoDoMes(m2, hoje);
    const a1 = faixaMeses[2] ? Number(faixaMeses[2]) : m1 <= m2 ? a2 : a2 - 1;
    const inicio = dia(a1, m1, 1);
    const fim = menor(ultimoDia(a2, m2), hojeZero);
    if (inicio <= fim) {
      return periodo(inicio, fim, `${NOMES_MESES[m1]} a ${NOMES_MESES[m2]} de ${a2}`);
    }
  }
  const mes = new RegExp(String.raw`\b(${nomeMes})(?:\s+(?:de\s+)?|/)?(\d{4})?\b`).exec(t);
  if (mes) {
    const m = MESES.indexOf(mes[1]!);
    const a = mes[2] ? Number(mes[2]) : anoDoMes(m, hoje);
    const inicio = dia(a, m, 1);
    const fim = menor(ultimoDia(a, m), hojeZero);
    if (inicio <= fim) return periodo(inicio, fim, `${NOMES_MESES[m]} de ${a}`);
  }

  // 8. trimestres e semestres: "primeiro trimestre", "2º trimestre de 2025", "segundo semestre"
  const ordinal: Record<string, number> = {
    primeiro: 1,
    "1o": 1,
    "1": 1,
    segundo: 2,
    "2o": 2,
    "2": 2,
    terceiro: 3,
    "3o": 3,
    "3": 3,
    quarto: 4,
    "4o": 4,
    "4": 4,
  };
  const parte =
    /\b(primeiro|segundo|terceiro|quarto|[1-4]o?)\s*(trimestre|semestre)(?:\s+(?:de\s+)?(\d{4}))?\b/.exec(
      t.replace(/º/g, "o"),
    );
  if (parte) {
    const n = ordinal[parte[1]!]!;
    const meses = parte[2] === "trimestre" ? 3 : 6;
    if (n * meses <= 12) {
      const mInicio = (n - 1) * meses;
      const mFim = mInicio + meses - 1;
      let a = parte[3] ? Number(parte[3]) : hoje.getFullYear();
      if (!parte[3] && mInicio > hoje.getMonth()) a -= 1;
      const fim = menor(ultimoDia(a, mFim), hojeZero);
      return periodo(dia(a, mInicio, 1), fim, `${parte[1]} ${parte[2]} de ${a}`);
    }
  }

  // 9. anos: "este ano", "ano passado", "em 2025"
  if (/\b(este|neste|esse|nesse|deste|desse) ano\b|\bano atual\b/.test(t)) {
    return periodo(dia(hoje.getFullYear(), 0, 1), hojeZero, `${hoje.getFullYear()}`);
  }
  if (/\b(ano passado|ultimo ano|ano anterior)\b/.test(t)) {
    const a = hoje.getFullYear() - 1;
    return periodo(dia(a, 0, 1), dia(a, 11, 31), `${a}`);
  }
  const ano = /\b(?:em|de|do ano|ano de)\s+(20\d{2})\b/.exec(t);
  if (ano) {
    const a = Number(ano[1]);
    if (a <= hoje.getFullYear()) {
      return periodo(dia(a, 0, 1), menor(dia(a, 11, 31), hojeZero), `${a}`);
    }
  }

  return null;
}
