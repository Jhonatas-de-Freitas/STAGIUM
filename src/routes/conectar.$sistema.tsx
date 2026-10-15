import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { CHAVE_PENDENTE, CHAVE_STATE } from "@/lib/conexao";
import { concluirConexao } from "@/lib/executor.servidor";

/**
 * Retorno da tela de autorização do fornecedor (ex.: Mercado Livre), aberta numa janela pelo chat.
 * Troca o código pelo acesso no servidor, entrega o resultado à conversa (postMessage, mesma
 * origem) e fecha a janela. O `state` confere que o retorno é da conexão que o chat pediu.
 */

export const Route = createFileRoute("/conectar/$sistema")({
  validateSearch: (
    busca: Record<string, unknown>,
  ): { code?: string; state?: string; error?: string } => ({
    ...(typeof busca["code"] === "string" ? { code: busca["code"] } : {}),
    ...(typeof busca["state"] === "string" ? { state: busca["state"] } : {}),
    ...(typeof busca["error"] === "string" ? { error: busca["error"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Conectando — Stagium" }] }),
  component: Conectar,
});

function Conectar() {
  const { sistema } = Route.useParams();
  const { code, state, error } = Route.useSearch();
  const [situacao, setSituacao] = useState<"trabalhando" | "pronto" | "erro">("trabalhando");
  const [mensagem, setMensagem] = useState("");
  const iniciado = useRef(false);

  useEffect(() => {
    // o código só pode ser trocado uma vez: evita a segunda execução do efeito em desenvolvimento
    if (iniciado.current) return;
    iniciado.current = true;

    let esperado: string | null = null;
    try {
      esperado = localStorage.getItem(CHAVE_STATE);
    } catch {
      esperado = null;
    }
    if (error) {
      setSituacao("erro");
      setMensagem(
        "A autorização foi cancelada na tela do fornecedor. Feche esta janela e tente de novo.",
      );
      return;
    }
    if (!code || !state || state !== esperado) {
      setSituacao("erro");
      setMensagem(
        "Este retorno não corresponde a uma conexão iniciada na conversa. Feche esta janela e clique em conectar de novo.",
      );
      return;
    }

    concluirConexao({ data: { slug: sistema, code } })
      .then((credenciais) => {
        try {
          localStorage.removeItem(CHAVE_STATE);
        } catch {
          // sem armazenamento: nada a limpar
        }
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { tipo: "stagium-conexao", slug: sistema, state, credenciais },
            window.location.origin,
          );
          window.close();
          setSituacao("pronto");
          setMensagem("Conta conectada. Pode fechar esta janela e voltar para a conversa.");
          return;
        }
        // sem a janela da conversa (pop-up virou aba): a conversa pega a conexão ao abrir
        try {
          sessionStorage.setItem(CHAVE_PENDENTE, JSON.stringify({ slug: sistema, credenciais }));
        } catch {
          // segue: a pessoa conecta de novo pela conversa
        }
        setSituacao("pronto");
        setMensagem("Conta conectada.");
      })
      .catch((erro: unknown) => {
        setSituacao("erro");
        setMensagem(erro instanceof Error ? erro.message : "Não foi possível concluir a conexão.");
      });
  }, [code, state, error, sistema]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-sm space-y-4 text-center">
        <span className="marca-celula">Stagium</span>
        {situacao === "trabalhando" ? (
          <p
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="size-4 animate-spin" />
            Concluindo a conexão…
          </p>
        ) : (
          <p className={situacao === "erro" ? "text-sm text-destructive" : "text-sm"} role="status">
            {mensagem}
          </p>
        )}
        {situacao === "pronto" && !window.opener && (
          <Link
            to="/chat"
            search={{ sistema }}
            className="inline-block text-sm underline underline-offset-4"
          >
            Voltar para a conversa
          </Link>
        )}
      </div>
    </main>
  );
}
