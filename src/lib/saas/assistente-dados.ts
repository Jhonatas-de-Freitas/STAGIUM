/**
 * Ponte entre o painel e a IA: tenta a IA (gasta 1 crédito) e, se ela não estiver ligada,
 * acabar o crédito ou errar, cai no modo básico por regras (grátis).
 */
import { executarPlano, validarPlano } from "./consulta";
import { verificarLimite } from "./direitos";
import { esquemaParaIa } from "./dados";
import { planejarComIA } from "./ia.servidor";
import { ehErro, interpretarPergunta, type ErroInterpretacao, type PlanoInterpretado } from "./interpretar";
import { consumir, lerUso } from "./servico";
import type { Dataset, Empresa, MensagemChat, PlanoDeConsulta, TipoVisual, Usuario } from "./tipos";

const VISUAIS: TipoVisual[] = ["kpi", "barras", "barras_h", "linha", "area", "pizza", "tabela"];

export type RespostaDoAssistente = {
  resultado: PlanoInterpretado | ErroInterpretacao;
  usouIa: boolean;
  /** Explica ao cliente por que caiu no modo básico, quando for o caso. */
  aviso?: string;
};

export async function pedirPlano(
  pergunta: string,
  objetivo: "resposta" | "grafico",
  datasets: Dataset[],
  empresa: Empresa,
  _usuario: Usuario,
  historico: MensagemChat[] = [],
): Promise<RespostaDoAssistente> {
  const basico = (aviso?: string): RespostaDoAssistente => ({
    resultado: interpretarPergunta(pergunta, datasets),
    usouIa: false,
    ...(aviso ? { aviso } : {}),
  });

  const uso = await lerUso(empresa.id);
  const lim = verificarLimite(empresa, "creditosIaMes", uso.creditosIa);
  if (!lim.ok) return basico("Seus créditos de IA do mês acabaram. Respondi no modo básico, que entende perguntas mais simples.");

  let bruto: Awaited<ReturnType<typeof planejarComIA>>;
  try {
    bruto = await planejarComIA({
      data: {
        pergunta,
        objetivo,
        esquemas: datasets.map(esquemaParaIa),
        historico: historico.map((m) => ({ autor: m.autor, texto: m.texto })),
      },
    });
  } catch {
    return basico("Não consegui falar com a IA agora. Respondi no modo básico.");
  }
  if (bruto.origem === "sem_chave") return basico("A IA não está ligada neste ambiente. Respondi no modo básico.");
  if (bruto.origem === "falhou") return basico(`${bruto.motivo} Respondi no modo básico.`);

  let dados: { erro?: string; titulo?: string; entendi?: string; visual?: string; plano?: PlanoDeConsulta };
  try {
    dados = JSON.parse(bruto.resultado);
  } catch {
    return basico("A resposta da IA veio num formato inesperado. Respondi no modo básico.");
  }
  await consumir(empresa, "creditosIa", 1);
  if (dados.erro) return { resultado: { erro: String(dados.erro), sugestoes: [] }, usouIa: true };
  const ds = datasets.find((d) => d.id === dados.plano?.datasetId);
  if (!ds || !dados.plano || validarPlano(ds, dados.plano).length) {
    return { ...basico("A IA propôs uma consulta que não bate com os seus dados. Usei o modo básico."), usouIa: true };
  }
  const visual = VISUAIS.includes(dados.visual as TipoVisual) ? (dados.visual as TipoVisual) : dados.plano.modo === "lista" ? "tabela" : "barras";
  return {
    resultado: {
      plano: dados.plano,
      visual,
      titulo: String(dados.titulo ?? "Resultado").slice(0, 120),
      entendi: String(dados.entendi ?? "").slice(0, 300),
      origem: "ia",
    },
    usouIa: true,
  };
}

export { ehErro, executarPlano };
