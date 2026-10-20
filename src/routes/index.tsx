import { Link, createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { FluxoPlanilhas } from "@/components/fluxo-planilhas";
import { PassoAPasso } from "@/components/passo-a-passo";
import { PlanilhaDeExemplos, type GrupoDeExemplos } from "@/components/planilha-de-exemplos";
import { TabelaDePlanos } from "@/components/tabela-de-planos";
import { Button } from "@/components/ui/button";
import { linkWhatsApp } from "@/lib/contato";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stagium — não exporte, só peça" },
      {
        name: "description",
        content:
          "Pergunte em português o que precisa do ERP da sua empresa (hoje Protheus, WinThor, Sagi, Nomus, Qive e Mercado Livre). O Stagium encontra a consulta certa, pede sua aprovação, lê os dados pela API e devolve a planilha .xlsx.",
      },
      { property: "og:title", content: "Stagium" },
      {
        property: "og:description",
        content: "Não exporte, só peça. A IA que transforma perguntas em planilhas do seu ERP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

/** Exemplos que valem para qualquer ERP; na conversa o cliente diz qual sistema usa. */
const EXEMPLOS: GrupoDeExemplos[] = [
  {
    area: "Financeiro",
    perguntas: [
      "Contas a receber em aberto deste mês",
      "Contas a pagar desta semana",
      "Pagamentos a fornecedores no mês passado",
    ],
  },
  {
    area: "Vendas e compras",
    perguntas: [
      "Pedidos de venda de setembro",
      "Pedidos de compra deste mês",
      "Clientes cadastrados",
    ],
  },
  {
    area: "Estoque e produção",
    perguntas: [
      "Movimentações de estoque do mês passado",
      "Produtos cadastrados",
      "Ordens de produção desta semana",
    ],
  },
  {
    area: "Fiscal",
    perguntas: [
      "Notas fiscais emitidas em setembro",
      "Notas recebidas de fornecedores no mês passado",
    ],
  },
];

const GARANTIAS: { titulo: string; texto: string }[] = [
  {
    titulo: "Não altera nada no seu ERP",
    texto: "Não emite, não cria e não cancela. O Stagium só usa consultas de leitura.",
  },
  {
    titulo: "Nada roda sem você",
    texto: "Cada consulta aparece na tela antes e só é executada quando você aprova.",
  },
  {
    titulo: "A senha não passa pela IA",
    texto:
      "As credenciais vão num formulário separado e nunca chegam à IA. Se você quiser, ficam salvas só no seu navegador, protegidas por um PIN.",
  },
  {
    titulo: "Toda planilha diz de onde veio",
    texto: "Uma aba registra o sistema, a consulta, os filtros, o total de registros e a data.",
  },
];

function BotoesContato({
  invertido = false,
  centro = false,
}: {
  invertido?: boolean;
  centro?: boolean;
}) {
  const whatsapp = linkWhatsApp();
  return (
    <div className={`flex flex-wrap items-center gap-3 ${centro ? "justify-center" : ""}`}>
      <Button
        asChild
        size="lg"
        className={
          invertido
            ? "bg-marca text-foreground hover:bg-marca/85"
            : centro
              ? "border-[1.5px] border-foreground bg-marca text-foreground hover:bg-marca/80"
              : ""
        }
      >
        <Link to="/chat">Testar agora</Link>
      </Button>
      {whatsapp && (
        <Button
          asChild
          size="lg"
          variant="outline"
          className={
            invertido
              ? "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              : "bg-card"
          }
        >
          <a href={whatsapp} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-2 size-4" />
            Falar no WhatsApp
          </a>
        </Button>
      )}
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <span className="marca-celula">Stagium</span>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/planos">Planos</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/chat">Abrir o Stagium</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Topo: perguntas entram, planilhas saem */}
        <section className="overflow-hidden">
          <div className="mx-auto w-full max-w-4xl px-4 pt-14 text-center sm:px-6 sm:pt-16">
            <h1 className="titulo-hero">
              Não exporte,
              <br />
              <em>só peça.</em>
            </h1>
            <p className="mx-auto mt-9 max-w-[34ch] text-lg leading-relaxed sm:text-xl">
              A IA que lê o seu ERP e transforma perguntas em planilhas prontas.
            </p>
            <div className="mt-8">
              <BotoesContato centro />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Hoje com Protheus, WinThor, Sagi (SyGeCom), Nomus, Qive e Mercado Livre. Só leitura,
              sempre com a sua aprovação.
            </p>
          </div>
          <FluxoPlanilhas />
        </section>

        {/* Como funciona: as quatro etapas, com as peças reais da conversa */}
        <section className="border-t bg-card/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="titulo-secao">Como funciona</h2>
            <p className="mt-3 max-w-[60ch] text-muted-foreground">
              Quatro etapas na mesma conversa. Você decide; o Stagium faz o trabalho de ir buscar.
            </p>
            <PassoAPasso />
          </div>
        </section>

        {/* O que pedir: planilha de exemplos; a pergunta escolhida abre a conversa já escrita */}
        <section className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="titulo-secao">O que você pode pedir</h2>
            <p className="mt-3 max-w-[60ch] text-muted-foreground">
              Escolha uma pergunta e peça. Na conversa você diz qual ERP a sua empresa usa e ajusta
              o período como quiser.
            </p>
            <PlanilhaDeExemplos grupos={EXEMPLOS} />
          </div>
        </section>

        {/* Garantias */}
        <section className="border-t bg-card/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="titulo-secao">Só leitura, sempre com a sua aprovação</h2>
            <dl className="mt-10 grid gap-x-16 gap-y-10 sm:grid-cols-2">
              {GARANTIAS.map((g) => (
                <div key={g.titulo} className="max-w-[44ch]">
                  <dt className="titulo-passo">{g.titulo}</dt>
                  <dd className="mt-2 leading-relaxed text-muted-foreground">{g.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Planos: os mesmos cartões da página /planos */}
        <section className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="titulo-secao">Planos</h2>
            <p className="mt-3 max-w-[60ch] text-muted-foreground">
              Pague pelo número de sistemas conectados. Comece com 14 dias grátis.{" "}
              <Link to="/planos" className="underline underline-offset-4">
                Ver detalhes e perguntas
              </Link>
              .
            </p>
            <TabelaDePlanos />
          </div>
        </section>

        {/* Fechamento */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="titulo-secao max-w-[22ch]">
              Comece pelo relatório que mais dá trabalho hoje.
            </h2>
            <p className="mt-4 max-w-[58ch] leading-relaxed text-primary-foreground/75">
              Escolha uma informação que a sua equipe pede toda semana e peça ao Stagium. Hoje ele
              trabalha com Protheus, WinThor, Sagi (SyGeCom), Nomus, Qive e Mercado Livre; se a sua
              empresa usa outro sistema, conte qual.
            </p>
            <div className="mt-8">
              <BotoesContato invertido />
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted-foreground sm:px-6">
        Stagium é um produto da HUBx Soluções.
      </footer>
    </div>
  );
}
