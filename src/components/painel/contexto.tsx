import { useNavigate } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Direitos } from "@/lib/planos";
import { direitosDaEmpresa, situacaoDeAcesso } from "@/lib/saas/direitos";
import * as S from "@/lib/saas/servico";
import type { Dataset, Empresa, Usuario } from "@/lib/saas/tipos";

type Acesso = ReturnType<typeof situacaoDeAcesso>;

type Sessao = {
  carregando: boolean;
  usuario: Usuario | null;
  /** Empresa cujos dados estão na tela. */
  empresa: Empresa | null;
  personificando: boolean;
  direitos: Direitos | null;
  acesso: Acesso | null;
  datasets: Dataset[];
  recarregar: () => Promise<void>;
  recarregarDados: () => Promise<void>;
  entrar: (email: string, senha: string) => Promise<Usuario>;
  sair: () => Promise<void>;
};

const Ctx = createContext<Sessao | null>(null);

export function ProvedorDePainel({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [personificando, setPersonificando] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  const recarregarDados = useCallback(async () => {
    const ctx = await S.obterContexto();
    setDatasets(ctx?.empresa ? await S.carregarDatasets(ctx.empresa.id) : []);
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const ctx = await S.obterContexto();
      setUsuario(ctx?.usuario ?? null);
      setEmpresa(ctx?.empresa ?? null);
      setPersonificando(ctx?.personificando ?? false);
      setDatasets(ctx?.empresa ? await S.carregarDatasets(ctx.empresa.id) : []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const valor = useMemo<Sessao>(
    () => ({
      carregando,
      usuario,
      empresa,
      personificando,
      direitos: empresa ? direitosDaEmpresa(empresa) : null,
      acesso: empresa ? situacaoDeAcesso(empresa) : null,
      datasets,
      recarregar,
      recarregarDados,
      entrar: async (email, senha) => {
        const u = await S.entrar(email, senha);
        await recarregar();
        return u;
      },
      sair: async () => {
        await S.sair();
        await recarregar();
      },
    }),
    [carregando, usuario, empresa, personificando, datasets, recarregar, recarregarDados],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao(): Sessao {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSessao fora do ProvedorDePainel");
  return c;
}

/** Redireciona quem não pode estar aqui. Devolve true quando já pode renderizar. */
export function useGuarda(exige: "cliente" | "admin"): boolean {
  const s = useSessao();
  const navegar = useNavigate();
  const ok =
    !s.carregando &&
    !!s.usuario &&
    (exige === "admin" ? s.usuario.papel === "superadmin" : s.usuario.papel !== "superadmin" || s.personificando);
  useEffect(() => {
    if (s.carregando) return;
    if (!s.usuario) void navegar({ to: "/entrar" });
    else if (exige === "admin" && s.usuario.papel !== "superadmin") void navegar({ to: "/app" });
    else if (exige === "cliente" && s.usuario.papel === "superadmin" && !s.personificando) void navegar({ to: "/admin" });
  }, [s.carregando, s.usuario, s.personificando, exige, navegar]);
  return ok;
}
