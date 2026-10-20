import { Link, createFileRoute } from "@tanstack/react-router";

import { TabelaDePlanos } from "@/components/tabela-de-planos";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Stagium" },
      {
        name: "description",
        content:
          "Planos do Stagium: do Essencial, com 1 sistema, ao Empresa, com seu ERP no catálogo. 14 dias grátis, sem cartão.",
      },
    ],
  }),
  component: Planos,
});

const PERGUNTAS: { pergunta: string; resposta: string }[] = [
  {
    pergunta: "O que conta como uma consulta?",
    resposta:
      "Cada vez que você aprova e o Stagium busca dados no seu sistema. Conversar com a IA, abrir consultas salvas e baixar a planilha de novo não contam.",
  },
  {
    pergunta: "Preciso instalar alguma coisa?",
    resposta:
      "Não. Você usa pelo navegador. Do seu lado, o TI cria um usuário de integração no ERP, só com permissão de leitura.",
  },
  {
    pergunta: "O Stagium altera algo no meu ERP?",
    resposta:
      "Não. Ele só faz consultas de leitura e cada uma aparece na tela antes de rodar. Emitir, criar ou cancelar fica de fora.",
  },
  {
    pergunta: "E se o meu ERP não estiver na lista?",
    resposta:
      "Conte qual é. No plano Empresa entra sem custo extra; nos outros planos há a implantação de sistema sob medida, com pagamento único.",
  },
  {
    pergunta: "Posso cancelar quando quiser?",
    resposta:
      "Sim. O plano mensal não tem fidelidade. No anual, os 2 meses grátis já vêm no preço à vista.",
  },
];

function Planos() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link to="/" className="marca-celula">
            Stagium
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/entrar">Entrar</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/chat">Abrir o Stagium</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="titulo-secao">Planos</h1>
        <p className="mt-3 max-w-[60ch] text-muted-foreground">
          Pague pelo número de sistemas que a sua empresa conecta. Todos os planos são só leitura e
          toda consulta passa pela sua aprovação.
        </p>
        <TabelaDePlanos />

        <section className="mt-20">
          <h2 className="titulo-secao text-3xl">Perguntas sobre os planos</h2>
          <dl className="mt-8 grid gap-x-16 gap-y-8 sm:grid-cols-2">
            {PERGUNTAS.map((p) => (
              <div key={p.pergunta} className="max-w-[48ch]">
                <dt className="titulo-passo">{p.pergunta}</dt>
                <dd className="mt-2 leading-relaxed text-muted-foreground">{p.resposta}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted-foreground sm:px-6">
        Stagium é um produto da HUBx Soluções. Valores em reais.
      </footer>
    </div>
  );
}
