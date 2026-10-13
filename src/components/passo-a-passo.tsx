import type { ReactNode } from "react";
import { Bookmark, Download, KeyRound, SlidersHorizontal } from "lucide-react";

import { Grade } from "@/components/grade-planilha";

/**
 * "Como funciona" da landing: as quatro etapas com as peças reais da conversa
 * (pergunta, proposta, formulário e planilha). É ilustração: nada aqui é clicável.
 */

const COLUNAS = ["Cliente", "Vencimento", "Valor (R$)", "Saldo (R$)"];
const LINHAS: Record<string, string | number>[] = [
  ["Metalúrgica Andrade", "03/09/2026", 4820.35, 4820.35],
  ["Plásticos Serra Azul", "08/09/2026", 12350.42, 6175.21],
  ["Usinagem Bom Jesus", "15/09/2026", 2190.18, 2190.18],
  ["Embalagens Litoral", "22/09/2026", 7640.75, 7640.75],
].map((linha) => Object.fromEntries(COLUNAS.map((c, i) => [c, linha[i]!])));

/** Botão desenhado: mostra como é na conversa, sem ser um controle de verdade. */
function BotaoFalso({ children, contorno = false }: { children: ReactNode; contorno?: boolean }) {
  return (
    <span
      className={
        "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium " +
        (contorno ? "border border-input bg-card" : "bg-primary text-primary-foreground")
      }
    >
      {children}
    </span>
  );
}

function CampoFalso({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{rotulo}</p>
      <p className="mono rounded-md border border-input bg-card px-3 py-1.5 text-sm">{valor}</p>
    </div>
  );
}

const PASSOS: { titulo: string; texto: string; peca: ReactNode }[] = [
  {
    titulo: "Você pergunta",
    texto: "Escreva como pediria a um analista. O período é lido direto da frase.",
    peca: (
      <div className="flex justify-end">
        <p className="max-w-[90%] rounded-md bg-primary px-4 py-2.5 text-[0.9375rem] text-primary-foreground">
          Contas a receber em aberto do mês passado
        </p>
      </div>
    ),
  },
  {
    titulo: "O Stagium propõe",
    texto:
      "Antes de buscar qualquer coisa, ele mostra qual consulta vai usar e quais colunas a planilha terá.",
    peca: (
      <div className="overflow-hidden rounded-md border bg-card">
        <p className="px-4 pt-3 pb-3 text-sm leading-snug font-medium">
          Lista as contas a receber, com cliente, vencimento, valor e saldo.
        </p>
        <Grade descricao="Colunas que a planilha vai trazer" titulos={COLUNAS} />
        <div className="px-4 py-3">
          <BotaoFalso>Executar esta consulta</BotaoFalso>
        </div>
      </div>
    ),
  },
  {
    titulo: "Você aprova e informa o acesso",
    texto:
      "Os filtros já vêm preenchidos. As credenciais vão neste formulário, nunca na conversa, e não chegam à IA.",
    peca: (
      <div className="space-y-4 rounded-md border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          Filtros da consulta
        </p>
        <div className="grid grid-cols-2 gap-3">
          <CampoFalso rotulo="Data inicial" valor="01/09/2026" />
          <CampoFalso rotulo="Data final" valor="30/09/2026" />
        </div>
        <p className="flex items-center gap-2 text-sm">
          <span className="flex size-4 items-center justify-center rounded-[3px] bg-primary text-[10px] leading-none text-primary-foreground">
            ✓
          </span>
          Só títulos ainda não baixados
        </p>
        <p className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="size-4 text-muted-foreground" />
          Credenciais salvas neste navegador
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <CampoFalso rotulo="PIN" valor="••••" />
          </div>
          <BotaoFalso>Consultar</BotaoFalso>
        </div>
      </div>
    ),
  },
  {
    titulo: "A planilha chega",
    texto:
      "Você confere as primeiras linhas, baixa o .xlsx completo e pode salvar a consulta para rodar de novo.",
    peca: (
      <div className="overflow-hidden rounded-md border bg-card">
        <p className="px-4 pt-3 pb-2 text-sm font-semibold">Contas a receber</p>
        <Grade
          descricao="Primeiras linhas da planilha de contas a receber"
          titulos={COLUNAS}
          chaves={COLUNAS}
          linhas={LINHAS}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <BotaoFalso>
            <Download className="mr-2 size-3.5" />
            Baixar planilha (.xlsx)
          </BotaoFalso>
          <BotaoFalso contorno>
            <Bookmark className="mr-2 size-3.5" />
            Salvar esta consulta
          </BotaoFalso>
          <span className="text-xs text-muted-foreground">Mostrando 4 de 132 linhas.</span>
        </div>
      </div>
    ),
  },
];

export function PassoAPasso() {
  return (
    <>
      <ol className="passos mt-10">
        {PASSOS.map((passo, i) => (
          <li key={passo.titulo} className="passo">
            <span className="passo-numero mono" aria-hidden>
              {i + 1}
            </span>
            <div className="passo-texto">
              <h3 className="titulo-passo">{passo.titulo}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{passo.texto}</p>
            </div>
            {/* a peça é só para ver (nada focável dentro); leitores de tela ficam com o texto */}
            <div className="passo-peca" aria-hidden>
              {passo.peca}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">Ilustração com dados fictícios.</p>
    </>
  );
}
