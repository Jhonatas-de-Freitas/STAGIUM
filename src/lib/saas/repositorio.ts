/**
 * Camada de armazenamento do painel.
 *
 * O resto do código só fala com a interface `Repositorio`. Hoje a única implementação é a
 * local (localStorage, para testar sem banco). Quando o Supabase existir, cria-se
 * `repositorio-supabase.ts` com a mesma interface e troca-se em `definirRepositorio`.
 * Toda a separação por empresa (RLS) passa a ser feita pelo banco.
 */
import type { Sessao } from "./tipos";

export interface Colecao<T extends { id: string }> {
  listar(): Promise<T[]>;
  obter(id: string): Promise<T | null>;
  salvar(item: T): Promise<T>;
  remover(id: string): Promise<void>;
  substituirTudo(itens: T[]): Promise<void>;
}

export type NomeGlobal = "empresas" | "usuarios" | "convites" | "solicitacoes" | "config";
export type NomeDaEmpresa =
  | "dashboards"
  | "relatorios"
  | "execucoes"
  | "alertas"
  | "conexoes"
  | "datasets"
  | "chat"
  | "uso"
  | "auditoria";

export interface Repositorio {
  global<T extends { id: string }>(nome: NomeGlobal): Colecao<T>;
  daEmpresa<T extends { id: string }>(empresaId: string, nome: NomeDaEmpresa): Colecao<T>;
  sessao: { obter(): Promise<Sessao | null>; gravar(s: Sessao | null): Promise<void> };
  /** Apaga todos os dados da empresa (direito de exclusão, LGPD). */
  apagarDadosDaEmpresa(empresaId: string): Promise<void>;
}

/* ---------------- implementação local ---------------- */

const PREFIXO = "stagium.saas.v1";
const NOMES_EMPRESA: NomeDaEmpresa[] = [
  "dashboards",
  "relatorios",
  "execucoes",
  "alertas",
  "conexoes",
  "datasets",
  "chat",
  "uso",
  "auditoria",
];

function ler<T>(chave: string): T[] {
  try {
    const t = localStorage.getItem(chave);
    return t ? (JSON.parse(t) as T[]) : [];
  } catch {
    return [];
  }
}

function gravar(chave: string, itens: unknown[]) {
  try {
    localStorage.setItem(chave, JSON.stringify(itens));
  } catch (e) {
    const cheio = e instanceof DOMException && e.name === "QuotaExceededError";
    throw new Error(
      cheio
        ? "O espaço do navegador acabou. Apague uma planilha importada ou dados antigos e tente de novo."
        : "Este navegador não permite salvar dados (janela anônima ou bloqueio de cookies).",
    );
  }
}

function colecaoLocal<T extends { id: string }>(chave: string): Colecao<T> {
  return {
    async listar() {
      return ler<T>(chave);
    },
    async obter(id) {
      return ler<T>(chave).find((i) => i.id === id) ?? null;
    },
    async salvar(item) {
      const lista = ler<T>(chave);
      const i = lista.findIndex((x) => x.id === item.id);
      if (i >= 0) lista[i] = item;
      else lista.push(item);
      gravar(chave, lista);
      return item;
    },
    async remover(id) {
      gravar(
        chave,
        ler<T>(chave).filter((i) => i.id !== id),
      );
    },
    async substituirTudo(itens) {
      gravar(chave, itens);
    },
  };
}

export const repositorioLocal: Repositorio = {
  global: (nome) => colecaoLocal(`${PREFIXO}:g:${nome}`),
  daEmpresa: (empresaId, nome) => colecaoLocal(`${PREFIXO}:e:${empresaId}:${nome}`),
  sessao: {
    async obter() {
      try {
        const t = localStorage.getItem(`${PREFIXO}:sessao`);
        if (!t) return null;
        const s = JSON.parse(t) as Sessao;
        return new Date(s.expiraEm).getTime() > Date.now() ? s : null;
      } catch {
        return null;
      }
    },
    async gravar(s) {
      try {
        if (s) localStorage.setItem(`${PREFIXO}:sessao`, JSON.stringify(s));
        else localStorage.removeItem(`${PREFIXO}:sessao`);
      } catch {
        /* sem armazenamento: a sessão vale só até recarregar */
      }
    },
  },
  async apagarDadosDaEmpresa(empresaId) {
    try {
      for (const n of NOMES_EMPRESA) localStorage.removeItem(`${PREFIXO}:e:${empresaId}:${n}`);
    } catch {
      /* nada a apagar */
    }
  },
};

let atual: Repositorio = repositorioLocal;
export const repo = (): Repositorio => atual;
export const definirRepositorio = (r: Repositorio) => {
  atual = r;
};
