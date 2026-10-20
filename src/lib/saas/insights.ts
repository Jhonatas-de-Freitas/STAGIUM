/**
 * Insights automáticos: leituras prontas dos dados, em português, com número e ação.
 * São regras determinísticas (sem IA): rápidas, de custo zero e explicáveis. A IA entra
 * quando o cliente clica em "Perguntar ao chat" para aprofundar.
 */
import { formatarCompacto } from "./consulta";
import { dataPrincipal, medidaPrincipal } from "./dados";
import { perfilDoDataset } from "./sugestoes";
import type { Dataset, Linha, PlanoDeConsulta } from "./tipos";

export type Severidade = "risco" | "atencao" | "oportunidade" | "info";

export type Insight = {
  id: string;
  datasetId: string;
  datasetNome: string;
  severidade: Severidade;
  titulo: string;
  texto: string;
  destaque?: string;
  /** Pergunta pronta para o chat aprofundar. */
  pergunta?: string;
  plano?: PlanoDeConsulta;
  /** Só aparece no plano com insights completos. */
  completo: boolean;
};

const isoDe = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const somarDias = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const reais = (n: number) => formatarCompacto(n, "moeda");
const pct = (n: number) => `${Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
const soma = (ls: Linha[], k: string) => ls.reduce((a, l) => a + (Number(l[k]) || 0), 0);

export function gerarInsights(ds: Dataset, hoje = new Date()): Insight[] {
  const out: Insight[] = [];
  const perfil = perfilDoDataset(ds);
  const medida = medidaPrincipal(ds);
  const data = dataPrincipal(ds);
  const nome = ds.nome;
  const add = (i: Omit<Insight, "datasetId" | "datasetNome" | "id"> & { id: string }) =>
    out.push({ ...i, id: `${ds.id}:${i.id}`, datasetId: ds.id, datasetNome: nome });
  const hojeIso = isoDe(hoje);

  // linhas que contam (sem cancelados)
  const validas = ds.linhas.filter((l) =>
    perfil.filtroPadrao.every((f) => String(l[f.coluna] ?? "") !== String(f.valor)),
  );

  /* ---- genéricos: variação, concentração, picos ---- */
  if (medida && data && ds.tipo !== "estoque") {
    const ini30 = isoDe(somarDias(hoje, -29));
    const ini60 = isoDe(somarDias(hoje, -59));
    const atual = validas.filter((l) => String(l[data.chave]) >= ini30 && String(l[data.chave]) <= hojeIso);
    const anterior = validas.filter((l) => String(l[data.chave]) >= ini60 && String(l[data.chave]) < ini30);
    const a = soma(atual, medida.chave);
    const b = soma(anterior, medida.chave);
    if (b > 0 && atual.length >= 5) {
      const v = ((a - b) / b) * 100;
      if (Math.abs(v) >= 8) {
        const sobe = v > 0;
        add({
          id: "variacao",
          severidade: sobe ? "oportunidade" : "atencao",
          titulo: `${medida.titulo} ${sobe ? "subiu" : "caiu"} ${pct(v)} em 30 dias`,
          texto: `Nos últimos 30 dias: ${reais(a)}. Nos 30 dias anteriores: ${reais(b)}. ${sobe ? "Vale entender o que puxou e repetir." : "Confira quais clientes, produtos ou filiais perderam ritmo."}`,
          destaque: `${sobe ? "+" : "−"}${pct(v)}`,
          pergunta: `O que explica a variação de ${medida.titulo.toLowerCase()} nos últimos 30 dias?`,
          completo: false,
        });
      }
    }
    // concentração
    const rank = perfil.rankings[0];
    if (rank) {
      const ini90 = isoDe(somarDias(hoje, -89));
      const rec = validas.filter((l) => String(l[data.chave]) >= ini90);
      const por = new Map<string, number>();
      for (const l of rec) por.set(String(l[rank.chave] ?? ""), (por.get(String(l[rank.chave] ?? "")) ?? 0) + (Number(l[medida.chave]) || 0));
      const total = [...por.values()].reduce((x, y) => x + y, 0);
      const top = [...por.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
      const part = total > 0 ? (top.reduce((x, y) => x + y[1], 0) / total) * 100 : 0;
      if (part >= 40 && por.size >= 6)
        add({
          id: "concentracao",
          severidade: part >= 55 ? "atencao" : "info",
          titulo: `3 ${rank.titulo.toLowerCase()}s respondem por ${pct(part)} do total`,
          texto: `Nos últimos 90 dias, ${top.map((t) => t[0]).join(", ")} somam ${reais(top.reduce((x, y) => x + y[1], 0))} de ${reais(total)}. ${part >= 55 ? "Perder um deles abala o caixa: vale diversificar e acompanhar de perto." : "Fique de olho: a carteira está ficando concentrada."}`,
          destaque: pct(part),
          pergunta: `Como está a concentração por ${rank.titulo.toLowerCase()} nos últimos 90 dias?`,
          completo: false,
        });
    }
    // melhor mês
    const meses = new Map<string, number>();
    for (const l of validas) {
      const k = String(l[data.chave]).slice(0, 7);
      if (k >= isoDe(somarDias(hoje, -365)).slice(0, 7) && k < hojeIso.slice(0, 7)) meses.set(k, (meses.get(k) ?? 0) + (Number(l[medida.chave]) || 0));
    }
    if (meses.size >= 6) {
      const ord = [...meses.entries()].sort((x, y) => y[1] - x[1]);
      const [mk, mv] = ord[0]!;
      const media = [...meses.values()].reduce((x, y) => x + y, 0) / meses.size;
      add({
        id: "melhor-mes",
        severidade: "info",
        titulo: `Melhor mês dos últimos 12: ${mk.slice(5)}/${mk.slice(0, 4)}`,
        texto: `${reais(mv)}, ${pct(((mv - media) / media) * 100)} acima da média mensal (${reais(media)}). Use como meta de referência.`,
        destaque: reais(mv),
        completo: true,
      });
    }
  }

  /* ---- contas a receber / a pagar ---- */
  const situ = ds.colunas.find((c) => /situa|status/i.test(c.titulo));
  const venc = ds.colunas.find((c) => /vencimento/i.test(c.titulo));
  if ((ds.tipo === "receber" || ds.tipo === "pagar") && medida && situ && venc) {
    const vencidas = ds.linhas.filter((l) => l[situ.chave] === "Vencido");
    const abertas = ds.linhas.filter((l) => l[situ.chave] === "Em aberto");
    const tv = soma(vencidas, medida.chave);
    const ta = soma(abertas, medida.chave) + tv;
    const receber = ds.tipo === "receber";
    if (vencidas.length) {
      add({
        id: "vencido",
        severidade: ta > 0 && tv / ta > 0.15 ? "risco" : "atencao",
        titulo: `${reais(tv)} ${receber ? "vencidos a receber" : "vencidas a pagar"}`,
        texto: `${vencidas.length} títulos passaram do vencimento, ${pct(ta ? (tv / ta) * 100 : 0)} de tudo que está em aberto. ${receber ? "Quanto mais demora a cobrança, menor a chance de receber." : "Pague ou renegocie para evitar multa e juros."}`,
        destaque: reais(tv),
        pergunta: receber ? "Quais clientes têm títulos vencidos e de quanto?" : "Quais fornecedores têm contas vencidas e de quanto?",
        plano: { datasetId: ds.id, modo: "lista", filtros: [{ coluna: situ.chave, op: "=", valor: "Vencido" }], ordenarPor: { campo: medida.chave, direcao: "desc" }, limite: 50 },
        completo: false,
      });
      const quem = ds.colunas.find((c) => (receber ? /cliente/i : /fornecedor/i).test(c.titulo));
      if (quem) {
        const por = new Map<string, number>();
        for (const l of vencidas) por.set(String(l[quem.chave]), (por.get(String(l[quem.chave])) ?? 0) + (Number(l[medida.chave]) || 0));
        const [nomeTop, valorTop] = [...por.entries()].sort((x, y) => y[1] - x[1])[0]!;
        if (tv > 0 && valorTop / tv >= 0.15)
          add({
            id: "maior-devedor",
            severidade: "atencao",
            titulo: `${nomeTop} é ${receber ? "o maior devedor" : "o maior valor vencido"}: ${reais(valorTop)}`,
            texto: `${pct((valorTop / tv) * 100)} de tudo que está vencido. ${receber ? "Comece a cobrança por aqui." : "Priorize a negociação com este fornecedor."}`,
            destaque: reais(valorTop),
            pergunta: `Quais títulos de ${nomeTop} estão vencidos?`,
            completo: true,
          });
      }
      const velhos = vencidas.filter((l) => String(l[venc.chave]) < isoDe(somarDias(hoje, -60)));
      if (velhos.length)
        add({
          id: "vencido-60",
          severidade: "risco",
          titulo: `${velhos.length} títulos vencidos há mais de 60 dias (${reais(soma(velhos, medida.chave))})`,
          texto: receber ? "Acima de 60 dias a chance de receber cai muito. Considere protesto, acordo ou provisão para perda." : "Atrasos longos geram negativação e cortes de fornecimento.",
          destaque: reais(soma(velhos, medida.chave)),
          completo: true,
        });
    }
    const prox = abertas.filter((l) => String(l[venc.chave]) >= hojeIso && String(l[venc.chave]) <= isoDe(somarDias(hoje, 7)));
    if (prox.length)
      add({
        id: "proximos-7",
        severidade: "info",
        titulo: `${reais(soma(prox, medida.chave))} ${receber ? "a receber" : "a pagar"} nos próximos 7 dias`,
        texto: `${prox.length} títulos vencem na semana. ${receber ? "Avise os clientes para evitar atraso." : "Garanta saldo em conta para estes pagamentos."}`,
        destaque: reais(soma(prox, medida.chave)),
        completo: true,
      });
    // atraso médio dos pagos
    const pago = ds.colunas.find((c) => /pagamento|pagto/i.test(c.titulo));
    if (receber && pago) {
      const atrasos = ds.linhas
        .filter((l) => l[pago.chave] && l[venc.chave])
        .map((l) => (new Date(String(l[pago.chave])).getTime() - new Date(String(l[venc.chave])).getTime()) / 86_400_000);
      if (atrasos.length > 30) {
        const m = atrasos.reduce((x, y) => x + y, 0) / atrasos.length;
        if (m >= 2)
          add({
            id: "atraso-medio",
            severidade: "info",
            titulo: `Clientes pagam em média ${m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias depois do vencimento`,
            texto: "Considere isso no fluxo de caixa: o dinheiro entra depois do que o vencimento promete.",
            destaque: `${m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`,
            completo: true,
          });
      }
    }
  }

  /* ---- estoque ---- */
  if (ds.tipo === "estoque" && medida) {
    const ult = ds.colunas.find((c) => /[uú]ltima sa[ií]da/i.test(c.titulo));
    if (ult) {
      const limite = isoDe(somarDias(hoje, -90));
      const parados = ds.linhas.filter((l) => l[ult.chave] && String(l[ult.chave]) < limite);
      const total = soma(ds.linhas, medida.chave);
      if (parados.length)
        add({
          id: "parado",
          severidade: "atencao",
          titulo: `${reais(soma(parados, medida.chave))} parados há mais de 90 dias`,
          texto: `${parados.length} itens sem saída, ${pct(total ? (soma(parados, medida.chave) / total) * 100 : 0)} do valor em estoque. Promoção, devolução ao fornecedor ou ajuste de compra liberam caixa.`,
          destaque: reais(soma(parados, medida.chave)),
          pergunta: "Quais produtos estão sem saída há mais de 90 dias?",
          plano: { datasetId: ds.id, modo: "lista", filtros: [{ coluna: ult.chave, op: "<", valor: limite }], ordenarPor: { campo: medida.chave, direcao: "desc" }, limite: 50 },
          completo: false,
        });
    }
  }

  /* ---- vendas: clientes que sumiram, cancelamentos ---- */
  if (ds.tipo === "vendas" && medida && data) {
    const cli = ds.colunas.find((c) => /cliente/i.test(c.titulo));
    if (cli) {
      const ultima = new Map<string, string>();
      const antes = new Map<string, number>();
      for (const l of validas) {
        const k = String(l[cli.chave]);
        const d = String(l[data.chave]);
        if (d > (ultima.get(k) ?? "")) ultima.set(k, d);
        if (d >= isoDe(somarDias(hoje, -240)) && d < isoDe(somarDias(hoje, -60))) antes.set(k, (antes.get(k) ?? 0) + (Number(l[medida.chave]) || 0));
      }
      const sumidos = [...ultima.entries()]
        .filter(([k, d]) => d < isoDe(somarDias(hoje, -60)) && (antes.get(k) ?? 0) > 0)
        .sort((x, y) => (antes.get(y[0]) ?? 0) - (antes.get(x[0]) ?? 0));
      if (sumidos.length) {
        const [n0] = sumidos[0]!;
        add({
          id: "sumidos",
          severidade: "risco",
          titulo: `${sumidos.length} ${sumidos.length === 1 ? "cliente parou" : "clientes pararam"} de comprar há mais de 60 dias`,
          texto: `O maior é ${n0}, que comprou ${reais(antes.get(n0)!)} nos 6 meses anteriores. Um contato do vendedor agora custa menos do que conquistar um cliente novo.`,
          destaque: reais(sumidos.reduce((a, [k]) => a + (antes.get(k) ?? 0), 0)),
          pergunta: `Quando ${n0} comprou pela última vez e o que costumava comprar?`,
          completo: true,
        });
      }
    }
    const sit = ds.colunas.find((c) => /situa|status/i.test(c.titulo));
    if (sit) {
      const ini = isoDe(somarDias(hoje, -89));
      const rec = ds.linhas.filter((l) => String(l[data.chave]) >= ini);
      const canc = rec.filter((l) => /cancel/i.test(String(l[sit.chave] ?? "")));
      const taxa = rec.length ? (canc.length / rec.length) * 100 : 0;
      if (taxa >= 5)
        add({
          id: "cancelamento",
          severidade: "atencao",
          titulo: `${pct(taxa)} dos pedidos foram cancelados em 90 dias`,
          texto: `${canc.length} cancelamentos somam ${reais(soma(canc, medida.chave))}. Descubra o motivo mais comum (preço, prazo, falta de estoque).`,
          destaque: pct(taxa),
          completo: true,
        });
    }
  }

  const peso: Record<Severidade, number> = { risco: 0, atencao: 1, oportunidade: 2, info: 3 };
  return out.sort((a, b) => peso[a.severidade] - peso[b.severidade]);
}

export function gerarTodosInsights(datasets: Dataset[], nivel: "basico" | "completo", hoje = new Date()): Insight[] {
  const todos = datasets.flatMap((d) => gerarInsights(d, hoje));
  const peso: Record<Severidade, number> = { risco: 0, atencao: 1, oportunidade: 2, info: 3 };
  todos.sort((a, b) => peso[a.severidade] - peso[b.severidade]);
  return nivel === "completo" ? todos : todos.filter((i) => !i.completo).slice(0, 4);
}
