/**
 * Sugestão de gráficos: olha as colunas do dataset e propõe os visuais que um analista
 * montaria primeiro. Funciona sem IA (regras). Com IA ligada, o cliente ainda pode pedir
 * "quero ver X por Y" em texto livre (ia.servidor.ts) e o resultado cai no mesmo formato.
 */
import { dataPrincipal, medidaPrincipal } from "./dados";
import { novoId } from "./senha";
import type { ColunaDados, Dataset, Filtro, PlanoDeConsulta, TipoVisual, Widget } from "./tipos";

export type Sugestao = {
  id: string;
  titulo: string;
  /** Por que vale a pena, em linguagem simples. */
  porque: string;
  prioridade: number;
  widget: Omit<Widget, "id">;
};

type Perfil = {
  medida: ColunaDados | null;
  data: ColunaDados | null;
  /** Poucas categorias (até 8): bom para pizza e barras. */
  categorias: ColunaDados[];
  /** Muitos valores distintos (clientes, produtos): bom para ranking. */
  rankings: ColunaDados[];
  filtroPadrao: Filtro[];
};

export function perfilDoDataset(ds: Dataset): Perfil {
  const amostra = ds.linhas.slice(0, 3000);
  const distintos = (c: ColunaDados) => new Set(amostra.map((l) => l[c.chave]).filter((v) => v != null)).size;
  const textos = ds.colunas.filter((c) => c.tipo === "texto" && !c.sensivel);
  const categorias: ColunaDados[] = [];
  const rankings: ColunaDados[] = [];
  for (const c of textos) {
    const n = distintos(c);
    if (n >= 2 && n <= 8) categorias.push(c);
    else if (n > 8 && n <= Math.max(amostra.length * 0.6, 9) && !/^(id|c[oó]digo|n[uú]mero|pedido|documento|nf)/i.test(c.titulo)) rankings.push(c);
  }
  // se há coluna de situação com "cancelado", os números padrão ignoram esses registros
  const filtroPadrao: Filtro[] = [];
  const situacao = textos.find((c) => /situa|status/i.test(c.titulo));
  if (situacao) {
    const vals = new Set(amostra.map((l) => String(l[situacao.chave] ?? "")));
    const cancel = [...vals].find((v) => /cancel/i.test(v));
    if (cancel) filtroPadrao.push({ coluna: situacao.chave, op: "!=", valor: cancel });
  }
  return { medida: medidaPrincipal(ds), data: dataPrincipal(ds), categorias, rankings, filtroPadrao };
}

const novo = (
  s: Omit<Sugestao, "id" | "widget"> & { visual: TipoVisual; plano: PlanoDeConsulta; largura?: 1 | 2 | 3; comparar?: boolean },
): Sugestao => ({
  id: novoId("s"),
  titulo: s.titulo,
  porque: s.porque,
  prioridade: s.prioridade,
  widget: { titulo: s.titulo, visual: s.visual, plano: s.plano, largura: s.largura ?? (s.visual === "kpi" ? 1 : 2), comparar: s.comparar },
});

export function sugerirWidgets(ds: Dataset): Sugestao[] {
  const p = perfilDoDataset(ds);
  const { medida, data, categorias, rankings, filtroPadrao } = p;
  const id = ds.id;
  const out: Sugestao[] = [];
  const periodo = (expressao: string, coluna = data?.chave) =>
    coluna ? { coluna, expressao } : undefined;
  const nm = medida?.titulo.toLowerCase() ?? "valor";

  if (medida && data) {
    out.push(novo({
      titulo: `${medida.titulo} no mês`,
      porque: "O número que o dono olha primeiro, já comparado com o período anterior.",
      prioridade: 100,
      visual: "kpi",
      comparar: true,
      plano: { datasetId: id, modo: "agregado", filtros: filtroPadrao, periodo: periodo("este mês"), medidas: [{ coluna: medida.chave, agregacao: "soma" }] },
    }));
    out.push(novo({
      titulo: `${medida.titulo} por mês`,
      porque: "Mostra se a empresa está crescendo, estável ou caindo, e quais meses foram fortes.",
      prioridade: 95,
      visual: "area",
      largura: 3,
      plano: { datasetId: id, modo: "agregado", filtros: filtroPadrao, periodo: periodo("últimos 12 meses"), agruparPor: [{ coluna: data.chave, granularidade: "mes" }], medidas: [{ coluna: medida.chave, agregacao: "soma" }] },
    }));
    out.push(novo({
      titulo: "Registros nos últimos 30 dias",
      porque: "Mede o ritmo da operação: quantos lançamentos entraram.",
      prioridade: 60,
      visual: "kpi",
      comparar: true,
      plano: { datasetId: id, modo: "agregado", filtros: filtroPadrao, periodo: periodo("últimos 30 dias"), medidas: [{ agregacao: "contagem" }] },
    }));
    out.push(novo({
      titulo: `Média de ${nm} por registro`,
      porque: "Se a média sobe ou desce, o perfil da operação mudou, mesmo com o total estável.",
      prioridade: 58,
      visual: "kpi",
      comparar: true,
      plano: { datasetId: id, modo: "agregado", filtros: filtroPadrao, periodo: periodo("últimos 30 dias"), medidas: [{ coluna: medida.chave, agregacao: "media" }] },
    }));
  }

  if (medida) {
    for (const c of rankings.slice(0, 3)) {
      out.push(novo({
        titulo: `Maiores ${c.titulo.toLowerCase()}s por ${nm}`,
        porque: `Mostra quem concentra o resultado. Se poucos ${c.titulo.toLowerCase()}s respondem por quase tudo, há risco de dependência.`,
        prioridade: 85 - rankings.indexOf(c) * 5,
        visual: "barras_h",
        plano: { datasetId: id, modo: "agregado", filtros: filtroPadrao, periodo: data ? periodo("últimos 90 dias") : undefined, agruparPor: [{ coluna: c.chave }], medidas: [{ coluna: medida.chave, agregacao: "soma" }], limite: 10 },
      }));
    }
    for (const c of categorias.slice(0, 3)) {
      const fatias = c.titulo.toLowerCase();
      out.push(novo({
        titulo: `${medida.titulo} por ${fatias}`,
        porque: `Como o total se divide por ${fatias}.`,
        prioridade: 75 - categorias.indexOf(c) * 4,
        visual: /situa|status/i.test(c.titulo) ? "barras" : "pizza",
        largura: 1,
        plano: { datasetId: id, modo: "agregado", filtros: filtroPadrao, periodo: data ? periodo("últimos 90 dias") : undefined, agruparPor: [{ coluna: c.chave }], medidas: [{ coluna: medida.chave, agregacao: "soma" }] },
      }));
    }
  }

  /* ---- por tipo de base ---- */
  const col = (re: RegExp) => ds.colunas.find((c) => re.test(c.titulo));
  const situ = col(/situa|status/i);
  const venc = col(/vencimento/i);
  if ((ds.tipo === "receber" || ds.tipo === "pagar") && medida && situ && venc) {
    const verbo = ds.tipo === "receber" ? "a receber" : "a pagar";
    out.push(novo({
      titulo: `Vencido ${verbo}`,
      porque: ds.tipo === "receber" ? "Dinheiro que já devia ter entrado. É o primeiro número da cobrança." : "Contas que já passaram do vencimento: multa e juros correndo.",
      prioridade: 99,
      visual: "kpi",
      plano: { datasetId: id, modo: "agregado", filtros: [{ coluna: situ.chave, op: "=", valor: "Vencido" }], medidas: [{ coluna: medida.chave, agregacao: "soma" }] },
    }));
    out.push(novo({
      titulo: `Vence nos próximos 30 dias (${verbo})`,
      porque: "Previsão de caixa do próximo mês.",
      prioridade: 97,
      visual: "kpi",
      plano: { datasetId: id, modo: "agregado", filtros: [{ coluna: situ.chave, op: "=", valor: "Em aberto" }], periodo: { coluna: venc.chave, expressao: "próximos 30 dias" }, medidas: [{ coluna: medida.chave, agregacao: "soma" }] },
    }));
    const quem = col(ds.tipo === "receber" ? /cliente/i : /fornecedor/i);
    if (quem)
      out.push(novo({
        titulo: ds.tipo === "receber" ? "Quem mais está devendo" : "Maiores contas vencidas por fornecedor",
        porque: ds.tipo === "receber" ? "Lista para a cobrança começar pelos maiores valores." : "Quem cobrar ou negociar primeiro.",
        prioridade: 96,
        visual: "barras_h",
        plano: { datasetId: id, modo: "agregado", filtros: [{ coluna: situ.chave, op: "=", valor: "Vencido" }], agruparPor: [{ coluna: quem.chave }], medidas: [{ coluna: medida.chave, agregacao: "soma" }], limite: 10 },
      }));
    out.push(novo({
      titulo: `Vencimentos por mês (${verbo})`,
      porque: "Mostra os meses em que o dinheiro entra ou sai, para planejar o caixa.",
      prioridade: 80,
      visual: "barras",
      largura: 2,
      plano: { datasetId: id, modo: "agregado", filtros: [{ coluna: situ.chave, op: "!=", valor: "Pago" }], agruparPor: [{ coluna: venc.chave, granularidade: "mes" }], medidas: [{ coluna: medida.chave, agregacao: "soma" }] },
    }));
  }
  if (ds.tipo === "estoque" && medida) {
    const prod = col(/produto/i);
    if (prod)
      out.push(novo({
        titulo: "Produtos com mais dinheiro parado em estoque",
        porque: "Estoque é dinheiro guardado em prateleira. Aqui estão os maiores valores.",
        prioridade: 92,
        visual: "barras_h",
        plano: { datasetId: id, modo: "agregado", agruparPor: [{ coluna: prod.chave }], medidas: [{ coluna: medida.chave, agregacao: "soma" }], limite: 10 },
      }));
    const ult = col(/[uú]ltima sa[ií]da/i);
    if (ult)
      out.push(novo({
        titulo: "Itens há mais tempo sem sair",
        porque: "Produtos sem movimento são candidatos a promoção ou devolução ao fornecedor.",
        prioridade: 90,
        visual: "tabela",
        largura: 3,
        plano: { datasetId: id, modo: "lista", colunas: ds.colunas.filter((c) => !c.sensivel).slice(0, 6).map((c) => c.chave), ordenarPor: { campo: ult.chave, direcao: "asc" }, limite: 10 },
      }));
  }
  if (ds.tipo === "vendas" && medida && data) {
    const prod = rankings.find((c) => /produto/i.test(c.titulo));
    const cat = col(/categoria/i);
    if (prod && cat)
      out.push(novo({
        titulo: "Categoria e produto: onde está a venda",
        porque: "Compara categorias mês a mês e ajuda a ver o que está ganhando espaço.",
        prioridade: 70,
        visual: "linha",
        largura: 3,
        plano: { datasetId: id, modo: "agregado", filtros: filtroPadrao, periodo: periodo("últimos 12 meses"), agruparPor: [{ coluna: data.chave, granularidade: "mes" }, { coluna: cat.chave }], medidas: [{ coluna: medida.chave, agregacao: "soma" }] },
      }));
  }

  if (data) {
    out.push(novo({
      titulo: "Últimos lançamentos",
      porque: "Confere o que acabou de entrar, direto na fonte.",
      prioridade: 40,
      visual: "tabela",
      largura: 3,
      plano: { datasetId: id, modo: "lista", colunas: ds.colunas.filter((c) => !c.sensivel).slice(0, 6).map((c) => c.chave), ordenarPor: { campo: data.chave, direcao: "desc" }, limite: 10 },
    }));
  }
  return out.sort((a, b) => b.prioridade - a.prioridade);
}

/** Dashboards prontos para o cliente começar (um por tipo de dado). */
export function modelosDeDashboard(datasets: Dataset[]): { nome: string; descricao: string; widgets: Omit<Widget, "id">[] }[] {
  const modelos: { nome: string; descricao: string; widgets: Omit<Widget, "id">[] }[] = [];
  const nomes: Record<string, [string, string]> = {
    vendas: ["Comercial", "Faturamento, evolução mensal, clientes e produtos que mais vendem."],
    receber: ["Cobrança", "Vencidos, previsão de recebimento e quem mais deve."],
    pagar: ["Contas a pagar", "Vencidas, próximas e despesas por categoria."],
    estoque: ["Estoque", "Valor parado e itens sem movimento."],
  };
  for (const ds of datasets) {
    const n = nomes[ds.tipo];
    if (!n) continue;
    const s = sugerirWidgets(ds).slice(0, 7);
    if (s.length) modelos.push({ nome: n[0], descricao: n[1], widgets: s.map((x) => x.widget) });
  }
  return modelos;
}
