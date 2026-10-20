/**
 * MD5 em TypeScript puro, sem depender de node:crypto: o servidor do site roda em ambiente
 * de borda, onde o Web Crypto não oferece MD5.
 *
 * Uso único: sistemas que exigem a senha em hash no login (ex.: WinThor, que pede o MD5 em
 * maiúsculas da senha em maiúsculas). Não serve para guardar senha nem para nada de segurança.
 */

const DESLOCAMENTOS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const CONSTANTES = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32),
);

export function md5(texto: string): string {
  const dados = new TextEncoder().encode(texto);
  const bits = dados.length * 8;
  // mensagem + 0x80 + zeros até 56 mod 64 + tamanho em bits (64 bits, little-endian)
  const tamanho = (((dados.length + 8) >> 6) + 1) * 64;
  const bloco = new Uint8Array(tamanho);
  bloco.set(dados);
  bloco[dados.length] = 0x80;
  const visao = new DataView(bloco.buffer);
  visao.setUint32(tamanho - 8, bits >>> 0, true);
  visao.setUint32(tamanho - 4, Math.floor(bits / 2 ** 32), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let inicio = 0; inicio < tamanho; inicio += 64) {
    const m = Array.from({ length: 16 }, (_, j) => visao.getUint32(inicio + j * 4, true));
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const soma = (a + f + CONSTANTES[i]! + m[g]!) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((soma << DESLOCAMENTOS[i]!) | (soma >>> (32 - DESLOCAMENTOS[i]!)))) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0]
    .map((palavra) =>
      [0, 8, 16, 24].map((s) => ((palavra >>> s) & 0xff).toString(16).padStart(2, "0")).join(""),
    )
    .join("");
}
