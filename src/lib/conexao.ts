/** Chaves do navegador usadas na conexão por autorização (ex.: Mercado Livre). */

/** `state` gerado pela conversa antes de abrir a tela do fornecedor; confere o retorno. */
export const CHAVE_STATE = "stagium.conexao.state";

/** Conexão concluída numa aba (pop-up bloqueado): a conversa pega ao abrir. */
export const CHAVE_PENDENTE = "stagium.conexao.pendente";

/** Mensagem que a janela de retorno envia para a conversa. */
export type MensagemConexao = {
  tipo: "stagium-conexao";
  slug: string;
  state: string;
  credenciais: Record<string, string>;
};
