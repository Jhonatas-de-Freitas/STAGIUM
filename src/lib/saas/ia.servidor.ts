import { createServerFn } from "@tanstack/react-start";

/**
 * IA do painel — roda SOMENTE no servidor.
 *
 * Recebe a pergunta e o ESQUEMA dos dados (nomes de colunas, tipos e, só para colunas de
 * poucas categorias como "situação", os valores). Nunca recebe linhas de dados, nomes de
 * clientes ou colunas marcadas como dado pessoal. Devolve um PLANO em JSON, que o navegador
 * valida e executa. A IA não calcula nada e não escreve código.
 *
 * Variáveis de ambiente: ANTHROPIC_API_KEY (obrigatória para ligar a IA) e MODELO_IA (opcional).
 */

type Entrada = {
  pergunta: string;
  objetivo: "resposta" | "grafico";
  esquemas: unknown[];
  historico?: { autor: "cliente" | "assistente"; texto: string }[];
};

const INSTRUCOES = `Você é o analista de dados do Stagium, um painel para empresas brasileiras.
O cliente faz uma pergunta em português sobre os dados dele. Você NÃO recebe os dados, só o esquema (colunas e tipos).
Responda SOMENTE com um objeto JSON, sem texto antes ou depois, neste formato:
{
 "titulo": "título curto do resultado",
 "entendi": "uma frase dizendo como você entendeu a pergunta",
 "visual": "kpi" | "barras" | "barras_h" | "linha" | "area" | "pizza" | "tabela",
 "plano": {
   "datasetId": "id de um dos esquemas",
   "modo": "agregado" | "lista",
   "filtros": [{"coluna": "chave", "op": "=" | "!=" | ">" | ">=" | "<" | "<=" | "contem" | "em", "valor": ...}],
   "periodo": {"coluna": "chave de coluna de data", "expressao": "este mês" | "mês passado" | "últimos 30 dias" | "últimos 12 meses" | "este ano" | "próximos 30 dias" | "01/08/2026 a 31/08/2026"},
   "agruparPor": [{"coluna": "chave", "granularidade": "dia"|"semana"|"mes"|"ano" (só para coluna de data)}],
   "medidas": [{"coluna": "chave (omita em contagem)", "agregacao": "soma"|"media"|"contagem"|"maximo"|"minimo"|"distintos"}],
   "colunas": ["chaves, só no modo lista"],
   "ordenarPor": {"campo": "chave (em agregado use m0, m1... para a 1ª, 2ª medida)", "direcao": "asc"|"desc"},
   "limite": número
 }
}
Regras: use apenas chaves de coluna que existem no esquema. "agregado" precisa de medidas; "lista" não. Soma e média só em colunas numero/moeda/percentual. Para ranking use agruparPor + ordenarPor m0 desc + limite. Para evolução no tempo agrupe uma coluna de data com granularidade. Se faltar informação, escolha o mais provável e diga na frase "entendi". Se a pergunta não puder ser respondida com os dados, devolva {"erro": "explicação curta em português"}.`;

function extrairJson(texto: string): unknown {
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini < 0 || fim < ini) throw new Error("A IA não devolveu um JSON.");
  return JSON.parse(texto.slice(ini, fim + 1));
}

export const planejarComIA = createServerFn({ method: "POST" })
  .validator((dados: Entrada) => dados)
  .handler(async ({ data }) => {
    const chave = process.env["ANTHROPIC_API_KEY"];
    if (!chave) return { origem: "sem_chave" as const };
    const modelo = process.env["MODELO_IA"] || "claude-sonnet-5";
    const hoje = new Date().toISOString().slice(0, 10);
    const sistema = `${INSTRUCOES}\n\nHoje é ${hoje}.\nEsquemas disponíveis:\n${JSON.stringify(data.esquemas)}${
      data.objetivo === "grafico" ? "\nO cliente quer UM gráfico para o dashboard dele: prefira visual kpi, barras, barras_h, linha, area ou pizza." : ""
    }`;
    const resposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: modelo,
        max_tokens: 900,
        system: sistema,
        messages: [
          ...(data.historico ?? []).slice(-4).map((m) => ({ role: m.autor === "cliente" ? "user" : "assistant", content: m.texto.slice(0, 600) })),
          { role: "user", content: data.pergunta.slice(0, 800) },
        ],
      }),
    });
    if (!resposta.ok) {
      return { origem: "falhou" as const, motivo: `A IA respondeu ${resposta.status}.` };
    }
    const corpo = (await resposta.json()) as { content: { type: string; text?: string }[] };
    const texto = corpo.content.filter((p) => p.type === "text").map((p) => p.text ?? "").join("\n");
    try {
      return { origem: "ia" as const, resultado: JSON.stringify(extrairJson(texto)) };
    } catch {
      return { origem: "falhou" as const, motivo: "A resposta da IA veio num formato inesperado." };
    }
  });
