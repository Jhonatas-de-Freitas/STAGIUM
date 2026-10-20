/**
 * Senha com PBKDF2-SHA256 (WebCrypto). Serve para o modo local de teste.
 * Em produção quem guarda e confere a senha é o Supabase Auth; este arquivo sai de cena.
 */
import type { SenhaHash } from "./tipos";

const ITERACOES = 210_000;

const paraBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const deBase64 = (t: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(t), (c) => c.charCodeAt(0));

async function derivar(senha: string, sal: Uint8Array<ArrayBuffer>, iteracoes: number) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sal, iterations: iteracoes, hash: "SHA-256" },
    base,
    256,
  );
  return paraBase64(new Uint8Array(bits));
}

export async function gerarHash(senha: string): Promise<SenhaHash> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return { sal: paraBase64(sal), hash: await derivar(senha, sal, ITERACOES), iteracoes: ITERACOES };
}

export async function conferirSenha(senha: string, guardada: SenhaHash): Promise<boolean> {
  const calculado = await derivar(senha, deBase64(guardada.sal), guardada.iteracoes);
  // comparação em tempo constante
  if (calculado.length !== guardada.hash.length) return false;
  let dif = 0;
  for (let i = 0; i < calculado.length; i++) dif |= calculado.charCodeAt(i) ^ guardada.hash.charCodeAt(i);
  return dif === 0;
}

export const SENHA_MINIMA = 8;

/** Mensagem de erro em português ou null se a senha serve. */
export function validarForcaDaSenha(senha: string): string | null {
  if (senha.length < SENHA_MINIMA) return `Use pelo menos ${SENHA_MINIMA} caracteres.`;
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return "Misture letras e números.";
  return null;
}

/** Senha temporária legível (sem 0/O, 1/l/I). */
export function gerarSenhaTemporaria(): string {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const numeros = "23456789";
  const sorteio = (alfabeto: string, n: number) =>
    Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => alfabeto[x % alfabeto.length]).join("");
  return `${sorteio(letras, 4)}-${sorteio(numeros, 3)}-${sorteio(letras, 4)}`;
}

export function novoId(prefixo = ""): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return prefixo + Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10);
}
