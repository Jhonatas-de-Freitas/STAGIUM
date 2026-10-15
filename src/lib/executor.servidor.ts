import { createServerFn } from "@tanstack/react-start";

import conhecimento from "./conhecimento.json";

/**
 * Executa uma consulta de LEITURA na API do cliente — só no servidor.
 *
 * As credenciais vêm do navegador a cada chamada e são usadas e descartadas:
 * não são gravadas em disco, não entram em log e nunca vão para o modelo de IA.
 *
 * A receita de cada endpoint (caminho, paginação, colunas) e a de autenticação
 * vêm de conhecimento.json, gerado do catálogo real. Só entram lá leituras marcadas como
 * seguras no catálogo; algumas são buscas por POST (ex.: Qive), que não gravam nada.
 */

type Coluna = { titulo: string; caminho: string; tipo?: string; formato_origem?: string };

type ReceitaEndpoint = {
  metodo: string;
  path: string;
  lista_em: string | null;
  campo_total: string | null;
  paginacao: {
    tipo: string;
    param_pagina?: string | null;
    param_tamanho?: string | null;
    tamanho_max?: number | null;
    param_cursor?: string | null;
    campo_proximo?: string | null;
    fim?: string | null;
    /** 1 quando o deslocamento começa em 1 (ex.: movimentos do Sagi). */
    offset_base?: number;
    /** Primeira página quando a paginação é por número de página (padrão 1). */
    pagina_inicial?: number;
    /** Onde vai o cursor: na query (padrão) ou no corpo JSON (ex.: buscas da Qive). */
    local_cursor?: "query" | "corpo";
    /** "raiz_da_resposta": o próximo cursor vem na resposta, não dentro dos registros. */
    origem_proximo?: string;
    cursor_inicial?: number;
    fim_alternativo?: string;
  };
  filtros: { parametro: string; descricao: string }[];
  campos_filtro?: CampoFiltro[];
  /** Parâmetros obrigatórios enviados sempre com o padrão documentado (ex.: codfor=0). */
  padroes_fixos?: Record<string, string | number | boolean>;
  colunas: Coluna[];
  titulo: string;
  /** Filtros enviados num único parâmetro (ex.: Nomus: query=campo>=valor;campo<=valor). */
  query_composta?: {
    parametro: string;
    periodos: Record<string, string>;
    filial: string | null;
    condicoes: Record<string, string>;
  };
  /** Intervalo mínimo entre requisições exigido pelo sistema (ex.: Nomus: 20 s). */
  intervalo_minimo_s?: number;
  /** Leitura por POST com corpo JSON: modelo com {data_inicial}, {data_final}, {cnpj}. */
  corpo?: {
    modelo: Record<string, unknown>;
    /** Escolhas do formulário: campo -> caminho no corpo e valor enviado por opção. */
    escolhas: Record<string, { caminho: string; valores: Record<string, unknown> }>;
    filial: { caminho: string; modelo: unknown } | null;
  };
  /** Campo com o XML do documento em Base64; colunas "xml:<caminho>" saem de dentro dele. */
  xml?: { campo: string };
  /** Filtros a partir das recomendações do catálogo (ex.: Mercado Livre). */
  recomendacao?: {
    /** Parâmetro -> modelo com {data_inicial}/{data_final} (ex.: data com fuso). */
    parametros_modelo: Record<string, string>;
    /** Parâmetros que levam o id da conta conectada. */
    vendedor: string[];
    /** Parâmetro com o número de dias do período (ex.: visitas por dia). */
    dias: string | null;
    escolhas_query: Record<string, { parametro: string; valores: Record<string, string> }>;
  };
  /** Consulta em duas etapas: a primeira traz ids, a segunda os detalhes em lotes. */
  segunda_etapa?: { endpoint: string; lote: number; parametro: string } | null;
  headers_fixos?: Record<string, string>;
};

export type CampoFiltro = {
  nome: string;
  rotulo: string;
  tipo: "data" | "texto" | "opcao" | "condicao";
  papel:
    | "periodo_inicio"
    | "periodo_fim"
    | "data"
    | "filial"
    | "opcao"
    | "caminho"
    | "condicao"
    | "avancado";
  /** Formato em que a API espera a data (o formulário sempre usa AAAA-MM-DD). */
  formato?: "dd/mm/aaaa";
  obrigatorio: boolean;
  padrao?: string;
  opcoes?: string[];
  dica?: string;
};

type ReceitaAuth = {
  tipo: string;
  header?: string;
  prefixo?: string;
  headers_fixos?: Record<string, string>;
  credenciais_necessarias: {
    nome: string;
    rotulo: string;
    segredo: boolean;
    onde_obter: string;
    obrigatoria?: boolean;
  }[];
  /** OAuth: renovação do acesso (o client_id/secret ficam nos segredos do servidor). */
  token_url?: string;
  /** Conexão pela tela do fornecedor, aberta numa janela (ex.: Mercado Livre). */
  conexao?: { tipo: string; url_autorizacao: string };
  /** Vários cabeçalhos de credencial (ex.: Qive: X-API-ID e X-API-KEY): cabeçalho -> credencial. */
  headers_credenciais?: Record<string, string>;
  base_url_por_ambiente?: Record<string, string | null>;
  login?: {
    metodo: string;
    caminho: string;
    corpo: Record<string, string>;
    campo_token: string;
    prefixo?: string;
  };
};

const EXECUCAO = (
  conhecimento as unknown as {
    execucao: Record<
      string,
      {
        auth: ReceitaAuth;
        endpoints: Record<string, ReceitaEndpoint>;
        /** Valores que a API devolve em inglês e a planilha mostra em português. */
        traducoes?: Record<string, string>;
      }
    >;
  }
).execucao;

const TEMPO_LIMITE = 45_000;
const MAXIMO_PAGINAS = 50;

function valor(dado: unknown, expr: string | null): unknown {
  if (!expr || expr === "[]") return dado;
  let atual: unknown = dado;
  for (const parte of expr.split(".")) {
    if (atual && typeof atual === "object" && !Array.isArray(atual)) {
      atual = (atual as Record<string, unknown>)[parte];
    } else {
      return undefined;
    }
  }
  return atual;
}

async function comLimite(url: string, init: RequestInit) {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE);
  try {
    return await fetch(url, { ...init, signal: controle.signal });
  } finally {
    clearTimeout(relogio);
  }
}

/** Nomes usuais do campo de token, normalizados (minúsculas, sem _ ou -). */
const NOMES_DE_TOKEN = new Set([
  "token",
  "accesstoken",
  "jwt",
  "idtoken",
  "bearer",
  "authorization",
]);
const normalizarChave = (chave: string) => chave.toLowerCase().replace(/[_-]/g, "");

/**
 * Procura o token na resposta do login.
 * Tenta o caminho do catálogo e, se não achar, varre a resposta atrás dos nomes usuais —
 * sistemas brasileiros variam muito aqui (token na raiz, dentro de `data`, dentro de `user[0]`).
 */
function procurarToken(
  corpo: unknown,
  caminhoPreferido: string | null,
  profundidade = 0,
): string | null {
  if (profundidade === 0 && caminhoPreferido) {
    const direto = valor(corpo, caminhoPreferido);
    if (typeof direto === "string" && direto.length > 10) return direto;
  }
  if (profundidade > 4 || corpo === null || typeof corpo !== "object") return null;

  if (Array.isArray(corpo)) {
    for (const item of corpo.slice(0, 5)) {
      const achado = procurarToken(item, null, profundidade + 1);
      if (achado) return achado;
    }
    return null;
  }

  const registro = corpo as Record<string, unknown>;
  for (const [chave, v] of Object.entries(registro)) {
    if (typeof v === "string" && v.length > 10 && NOMES_DE_TOKEN.has(normalizarChave(chave))) {
      return v;
    }
  }
  for (const v of Object.values(registro)) {
    const achado = procurarToken(v, null, profundidade + 1);
    if (achado) return achado;
  }
  return null;
}

type Registro = Record<string, unknown>;

const ehRegistro = (v: unknown): v is Registro =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Encontra a lista de registros na resposta.
 * Usa o caminho do catálogo; se ele apontar para um "envelope" (ex.: { data: [...] })
 * em vez da lista, procura dentro dele o primeiro array de objetos.
 */
function extrairLista(corpo: unknown, listaEm: string | null): Registro[] {
  const alvo = valor(corpo, listaEm);
  const candidatos = [alvo, corpo];
  for (const c of candidatos) {
    // lista de valores simples (ex.: CNPJs da conta na Qive): cada valor vira uma linha em "$"
    if (Array.isArray(c) && c.length > 0 && c.every((v) => v === null || typeof v !== "object")) {
      return c.map((v) => ({ $: v }));
    }
    if (Array.isArray(c)) return c.filter(ehRegistro);
    if (ehRegistro(c)) {
      const interno = Object.values(c).find(
        (v) => Array.isArray(v) && v.length > 0 && v.every(ehRegistro),
      );
      if (Array.isArray(interno)) return interno as Registro[];
    }
  }
  return ehRegistro(alvo) ? [alvo] : [];
}

const normalizarCampo = (nome: string) => nome.toLowerCase().replace(/[_\-\s]/g, "");

/** Lê o campo pelo caminho exato; se não existir, tenta ignorando maiúsculas e separadores. */
function valorFlexivel(registro: Registro, caminho: string): unknown {
  const exato = valor(registro, caminho);
  if (exato !== undefined || caminho.includes(".")) return exato;
  const alvo = normalizarCampo(caminho);
  const chave = Object.keys(registro).find((k) => normalizarCampo(k) === alvo);
  return chave === undefined ? undefined : registro[chave];
}

type ColunaSaida = { titulo: string; caminho: string };

/**
 * Decide as colunas da planilha sem nunca descartar dado:
 * mantém as colunas do catálogo que trouxeram valor e acrescenta os campos reais
 * da resposta que nenhuma coluna cobriu. Devolve um aviso quando o catálogo não bateu.
 */
function resolverColunas(
  documentadas: ColunaSaida[],
  registros: Registro[],
): { colunas: ColunaSaida[]; aviso: string | null } {
  if (registros.length === 0) return { colunas: documentadas, aviso: null };

  const amostra = registros.slice(0, 50);
  const temValor = (caminho: string) =>
    amostra.some((r) => {
      const v = valorFlexivel(r, caminho);
      return v !== undefined && v !== null && v !== "";
    });

  const usadas = documentadas.filter((c) => temValor(c.caminho));
  const faltantes = documentadas.filter((c) => !usadas.includes(c)).map((c) => c.caminho);

  const reais = Array.from(new Set(amostra.flatMap((r) => Object.keys(r))));
  const cobertos = new Set(
    usadas.map((c) => normalizarCampo(c.caminho.split(".")[0] ?? c.caminho)),
  );
  const extras = reais
    .filter((k) => !cobertos.has(normalizarCampo(k)))
    .map((k) => ({ titulo: k, caminho: k }));

  const colunas = [...usadas, ...extras];
  let aviso: string | null = null;
  if (usadas.length === 0) {
    aviso =
      `Nenhuma coluna do catálogo bateu com a resposta; usei os campos reais (${reais.join(", ")}). ` +
      "Envie esta lista para ajustar o catálogo.";
  } else if (faltantes.length > 0) {
    aviso = `Colunas do catálogo sem valor na resposta: ${faltantes.join(", ")}.`;
  }
  return { colunas, aviso };
}

/** Nomes dos campos da resposta, para diagnóstico — sem os valores. */
function camposDe(corpo: unknown): string {
  if (Array.isArray(corpo)) return `lista com ${corpo.length} item(ns)`;
  if (corpo && typeof corpo === "object")
    return Object.keys(corpo as object).join(", ") || "nenhum";
  return typeof corpo;
}

/** Dica extra quando o sistema recusa a credencial (o que costuma dar errado em cada um). */
const DICAS_CREDENCIAL: Record<string, string> = {
  arquivei:
    " Na Qive, confira o API ID e a API KEY; credenciais de testes (sandbox) só funcionam no endereço de testes.",
  sygecom:
    " No Sagi, veja também se a opção 'Bloquear Acesso ao SAGI Mobile' está desmarcada no cadastro do usuário de integração.",
};

const credencialRecusada = (slug: string) =>
  new Error("Credenciais recusadas pelo sistema." + (DICAS_CREDENCIAL[slug] ?? ""));

const prefixoAmbiente = (slug: string) => slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");

/**
 * Aplicativo OAuth do Stagium para o sistema (ex.: MERCADO_LIVRE_CLIENT_ID,
 * MERCADO_LIVRE_CLIENT_SECRET e, opcional, MERCADO_LIVRE_REDIRECT_URI nos segredos do Lovable).
 */
function aplicativoOAuth(slug: string) {
  const p = prefixoAmbiente(slug);
  return {
    variaveis: `${p}_CLIENT_ID e ${p}_CLIENT_SECRET`,
    clientId: process.env[`${p}_CLIENT_ID`] ?? "",
    clientSecret: process.env[`${p}_CLIENT_SECRET`] ?? "",
    redirectUri: process.env[`${p}_REDIRECT_URI`] || `https://stagium.lovable.app/conectar/${slug}`,
    /** Só para teste local contra um servidor simulado; em produção vale o endereço do catálogo. */
    tokenUrl: process.env[`${p}_TOKEN_URL`] ?? "",
    authUrl: process.env[`${p}_AUTH_URL`] ?? "",
  };
}

/**
 * Pede um acesso novo ao fornecedor: troca o código da autorização ou renova pelo refresh token.
 * O refresh token do Mercado Livre é de uso único: a resposta traz o próximo, que o navegador
 * guarda no lugar do anterior.
 */
async function pedirTokenOAuth(
  slug: string,
  auth: ReceitaAuth,
  campos: Record<string, string>,
  userIdAnterior = "",
): Promise<Record<string, string>> {
  const app = aplicativoOAuth(slug);
  const tokenUrl = app.tokenUrl || auth.token_url;
  if (!app.clientId || !app.clientSecret || !tokenUrl) {
    throw new Error(
      `Este sistema ainda não está configurado no Stagium: faltam os segredos ${app.variaveis} no servidor.`,
    );
  }
  const resposta = await comLimite(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: app.clientId,
      client_secret: app.clientSecret,
      ...campos,
    }).toString(),
  });
  const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resposta.ok || typeof dados["access_token"] !== "string") {
    if (resposta.status >= 400 && resposta.status < 500) {
      throw new Error(
        "A autorização da conta não vale mais (expirou, foi revogada ou a senha da conta mudou). Conecte a conta de novo.",
      );
    }
    throw new Error(`A renovação do acesso respondeu HTTP ${resposta.status}.`);
  }
  const validade = Number(dados["expires_in"] ?? 21600);
  return {
    access_token: String(dados["access_token"]),
    refresh_token: String(dados["refresh_token"] ?? campos["refresh_token"] ?? ""),
    user_id: String(dados["user_id"] ?? userIdAnterior),
    expira_em: String(Date.now() + validade * 1000),
  };
}

/** Monta os cabeçalhos de autenticação conforme a receita do catálogo. */
async function autenticar(
  slug: string,
  auth: ReceitaAuth,
  credenciais: Record<string, string>,
  base: string,
  chaveEmBase64 = false,
) {
  const cabecalhos: Record<string, string> = {
    Accept: "application/json",
    ...(auth.headers_fixos ?? {}),
  };

  if (auth.tipo === "login_credenciais" && auth.login) {
    const corpo: Record<string, string> = {};
    for (const [campo, modelo] of Object.entries(auth.login.corpo)) {
      corpo[campo] = modelo.replace(
        /\{([a-z0-9_]+)\}/g,
        (_, chave: string) => credenciais[chave] ?? "",
      );
    }
    const resposta = await comLimite(base + auth.login.caminho, {
      method: auth.login.metodo,
      headers: { ...cabecalhos, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (resposta.status === 401 || resposta.status === 403) throw credencialRecusada(slug);
    if (!resposta.ok) {
      throw new Error(`O login respondeu HTTP ${resposta.status}.`);
    }
    const texto = await resposta.text();
    let dadosLogin: unknown = null;
    try {
      dadosLogin = JSON.parse(texto);
    } catch {
      throw new Error(
        `O login respondeu HTTP ${resposta.status}, mas o conteúdo não é JSON (começa com "${texto.slice(0, 60)}"). ` +
          "Confira o endereço da API: um endereço errado costuma devolver página HTML.",
      );
    }

    // alguns sistemas devolvem o token em cabeçalho, não no corpo
    const doCabecalho = resposta.headers.get("authorization") ?? resposta.headers.get("x-token");
    const token = procurarToken(dadosLogin, auth.login.campo_token) ?? doCabecalho;

    if (!token) {
      throw new Error(
        `O login funcionou (HTTP ${resposta.status}), mas não encontrei o token na resposta. ` +
          `Campos recebidos: ${camposDe(dadosLogin)}. ` +
          "Mande essa lista para quem cuida do catálogo: é só ajustar o nome do campo do token.",
      );
    }
    cabecalhos["Authorization"] =
      (auth.login.prefixo ?? "Bearer ") + String(token).replace(/^Bearer\s+/i, "");
    return cabecalhos;
  }

  if (auth.tipo === "oauth2_refresh_token") {
    cabecalhos["Authorization"] = "Bearer " + (credenciais["access_token"] ?? "");
    return cabecalhos;
  }

  if (auth.tipo === "header_api_key" && auth.headers_credenciais) {
    for (const [cabecalho, nome] of Object.entries(auth.headers_credenciais)) {
      const valorCredencial = (credenciais[nome] ?? "").trim();
      if (valorCredencial) cabecalhos[cabecalho] = (auth.prefixo ?? "") + valorCredencial;
    }
    return cabecalhos;
  }

  if (auth.tipo === "header_api_key" && auth.header) {
    const nome = auth.credenciais_necessarias[0]?.nome ?? "api_key";
    const chave = (credenciais[nome] ?? "").trim();
    cabecalhos[auth.header] = (auth.prefixo ?? "") + (chaveEmBase64 ? btoa(chave) : chave);
    return cabecalhos;
  }

  throw new Error(`Autenticação '${auth.tipo}' ainda não é executada pelo assistente.`);
}

type Entrada = {
  endpointId: string;
  credenciais: Record<string, string>;
  filtros?: Record<string, string>;
  maximo?: number;
  /**
   * Sistemas com limite de requisições (intervalo_minimo_s): o navegador pede uma página por
   * chamada, espera o intervalo e pede a próxima. Começa em 0.
   */
  pagina?: number;
  /** Devolvido pela primeira chamada quando o sistema só aceitou a chave em Base64. */
  chaveEmBase64?: boolean;
};

/**
 * Converte número que veio como texto. Só usa a leitura brasileira ("1.234,56") quando o
 * catálogo diz que a coluna vem assim; senão, ponto é separador decimal.
 */
function numeroDeTexto(v: unknown, formato: string): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (formato.includes("pt-BR")) {
    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(t) || /^-?\d+(,\d+)?$/.test(t)) {
      return Number(t.replace(/\./g, "").replace(",", "."));
    }
    return v;
  }
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : v;
}

const TIPOS_NUMERICOS = new Set(["decimal", "integer", "number", "money", "numero"]);

/**
 * Preenche o modelo do corpo trocando {marcadores}. O que depende de um marcador sem valor
 * (ex.: {cnpj} vazio) sai do corpo, em vez de ir como texto vazio.
 */
function preencherModelo(modelo: unknown, trocas: Record<string, string>): unknown {
  if (typeof modelo === "string") {
    let vazio = false;
    const texto = modelo.replace(/\{([a-z_]+)\}/g, (_, chave: string) => {
      const v = trocas[chave];
      if (!v) vazio = true;
      return v ?? "";
    });
    return vazio ? undefined : texto;
  }
  if (Array.isArray(modelo)) {
    const itens = modelo.map((v) => preencherModelo(v, trocas)).filter((v) => v !== undefined);
    return modelo.length > 0 && itens.length === 0 ? undefined : itens;
  }
  if (modelo && typeof modelo === "object") {
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(modelo)) {
      const preenchido = preencherModelo(v, trocas);
      if (preenchido !== undefined) saida[k] = preenchido;
    }
    return Object.keys(modelo).length > 0 && Object.keys(saida).length === 0 ? undefined : saida;
  }
  return modelo;
}

/** Grava `valor` em "A.B.C" dentro do objeto, criando os níveis que faltarem. */
function definirCaminho(alvo: Record<string, unknown>, caminho: string, novo: unknown) {
  const partes = caminho.split(".");
  let atual = alvo;
  for (const parte of partes.slice(0, -1)) {
    if (!atual[parte] || typeof atual[parte] !== "object") atual[parte] = {};
    atual = atual[parte] as Record<string, unknown>;
  }
  atual[partes.at(-1)!] = novo;
}

function decodificarBase64(texto: string): string {
  const bytes = Uint8Array.from(atob(texto.replace(/\s/g, "")), (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Primeiro elemento <nome> (com ou sem prefixo de namespace) e o que há dentro dele. */
function elementoXml(trecho: string, nome: string): string | null {
  const tag = escaparRegex(nome);
  const achado = new RegExp(
    `<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`,
  ).exec(trecho);
  return achado ? achado[1]! : null;
}

/**
 * Lê um valor do XML por um caminho como "nfeProc/NFe/infNFe/total/ICMSTot/vNF".
 * Tolera níveis que não existem no XML guardado (ex.: sem nfeProc) e aceita alternativa
 * no formato "dest/CNPJ (ou dest/CPF)". Caminhos do catálogo marcados "(ABRASF)" também valem.
 */
function lerXml(xml: string, caminho: string): string {
  const limpo = caminho.replace(/^\(ABRASF\)\s*/, "");
  const alternativa = /^(.*?)\s*\(ou\s+([^)]+)\)\s*$/.exec(limpo);
  const caminhos = [alternativa ? alternativa[1]! : limpo];
  if (alternativa) {
    const fim = alternativa[2]!.split("/");
    caminhos.push(caminhos[0]!.split("/").slice(0, -fim.length).concat(fim).join("/"));
  }
  for (const c of caminhos) {
    const partes = c.split("/").map((p) => p.trim().split(" ")[0]!);
    let trecho: string | null = xml;
    for (const [i, parte] of partes.entries()) {
      const dentro = elementoXml(trecho!, parte);
      if (dentro !== null) trecho = dentro;
      else if (i === partes.length - 1) trecho = null;
    }
    if (trecho !== null && !trecho.includes("<")) return trecho.trim();
  }
  return "";
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Lista de itens (ex.: itens de uma venda) em texto legível: "2× Camiseta; 1× Boné".
 * Quando não há título e quantidade, devolve null e a célula mostra o JSON.
 */
function resumirItens(lista: unknown[]): string | null {
  const partes = lista.map((item) => {
    if (!ehRegistro(item)) return null;
    const dentro = ehRegistro(item["item"]) ? item["item"] : item;
    const titulo = dentro["title"] ?? dentro["titulo"] ?? dentro["name"];
    const quantidade = item["quantity"] ?? item["quantidade"];
    if (typeof titulo !== "string") return null;
    return typeof quantidade === "number" ? `${quantidade}× ${titulo}` : titulo;
  });
  return partes.every((p) => p !== null) && partes.length > 0 ? partes.join("; ") : null;
}
const isoParaBr = (iso: string) => iso.split("-").reverse().join("/");

/** Núcleo da execução, isolado da camada de servidor para poder ser testado. */
export async function consultarSistema(data: Entrada) {
  {
    const slug = Object.keys(EXECUCAO).find((s) => data.endpointId.startsWith(s + "."));
    const sistema = slug ? EXECUCAO[slug] : undefined;
    const receita = sistema?.endpoints[data.endpointId];

    if (!sistema || !receita) {
      throw new Error(`Consulta não disponível para execução: ${data.endpointId}`);
    }

    // OAuth: usa o acesso guardado enquanto vale; perto de vencer, renova antes de consultar
    let credenciais = data.credenciais;
    let credenciaisNovas: Record<string, string> | null = null;
    const oauth = sistema.auth.tipo === "oauth2_refresh_token";
    if (oauth) {
      if (!credenciais["refresh_token"] && !credenciais["access_token"]) {
        throw new Error("Conecte a conta antes de consultar.");
      }
      const vence = Number(credenciais["expira_em"] || 0);
      if (!credenciais["access_token"] || vence < Date.now() + 120_000) {
        credenciaisNovas = await pedirTokenOAuth(
          slug!,
          sistema.auth,
          { grant_type: "refresh_token", refresh_token: credenciais["refresh_token"] ?? "" },
          credenciais["user_id"] ?? "",
        );
        credenciais = { ...credenciais, ...credenciaisNovas };
      }
    }

    const base = (
      credenciais["base_url"] ||
      // só para teste local contra servidor simulado (ex.: MERCADO_LIVRE_BASE_URL)
      process.env[`${prefixoAmbiente(slug!)}_BASE_URL`] ||
      sistema.auth.base_url_por_ambiente?.["producao"] ||
      ""
    ).replace(/\/$/, "");
    if (!base) throw new Error("Endereço da API não informado.");

    // filtros: valida obrigatórios antes de autenticar, para não gastar login à toa
    const campos = receita.campos_filtro ?? [];
    const informados = Object.fromEntries(
      Object.entries(data.filtros ?? {}).filter(([, v]) => String(v ?? "").trim() !== ""),
    );
    const faltando = campos
      .filter((c) => c.obrigatorio && !informados[c.nome])
      .map((c) => c.rotulo);
    if (faltando.length > 0) {
      throw new Error(`Preencha os filtros obrigatórios: ${faltando.join(", ")}.`);
    }
    const inicio = campos.find((c) => c.papel === "periodo_inicio");
    const fim = campos.find((c) => c.papel === "periodo_fim");
    if (inicio && fim && informados[inicio.nome] && informados[fim.nome]) {
      if (String(informados[inicio.nome]) > String(informados[fim.nome])) {
        throw new Error("A data inicial é posterior à data final.");
      }
    }

    // parâmetros de caminho (ex.: /saldo/fornecedores/{id}) saem da query e entram no endereço
    let caminho = receita.path;
    if (caminho.includes("{user_id}")) {
      if (!credenciais["user_id"])
        throw new Error("A conta conectada não informou o id. Conecte de novo.");
      caminho = caminho.replace("{user_id}", encodeURIComponent(credenciais["user_id"]));
    }
    for (const c of campos.filter((c) => c.papel === "caminho")) {
      caminho = caminho.replace(`{${c.nome}}`, encodeURIComponent(String(informados[c.nome])));
      delete informados[c.nome];
    }
    for (const c of campos) {
      if (c.formato === "dd/mm/aaaa" && informados[c.nome]) {
        informados[c.nome] = isoParaBr(String(informados[c.nome]));
      }
    }

    // filtros que vão juntos num parâmetro só (período, empresa, condições e filtro livre)
    const qc = receita.query_composta;
    if (qc) {
      const partes: string[] = [];
      const ini = informados["data_inicial"];
      const fimP = informados["data_final"];
      if (ini && fimP) {
        const porRotulo = informados["periodo_por"];
        const modelo =
          (porRotulo && qc.periodos[String(porRotulo)]) || Object.values(qc.periodos)[0];
        if (modelo) {
          partes.push(
            modelo.replace("{data_inicial}", String(ini)).replace("{data_final}", String(fimP)),
          );
        }
      }
      if (qc.filial && informados["id_empresa"]) {
        partes.push(qc.filial.replace("{id_empresa}", String(informados["id_empresa"]).trim()));
      }
      for (const [nome, expressao] of Object.entries(qc.condicoes)) {
        if (informados[nome]) partes.push(expressao);
      }
      if (informados["filtro_adicional"])
        partes.push(String(informados["filtro_adicional"]).trim());
      for (const c of campos.filter((c) => c.nome in informados && c.papel !== "caminho")) {
        if (
          ["periodo_inicio", "periodo_fim", "filial", "condicao", "avancado"].includes(c.papel) ||
          c.nome === "periodo_por"
        ) {
          delete informados[c.nome];
        }
      }
      if (partes.length > 0) informados[qc.parametro] = partes.join(";");
    }

    // filtros por recomendação do catálogo: período no modelo do fornecedor, conta conectada, opções
    const rec = receita.recomendacao;
    if (rec) {
      const ini = String(informados["data_inicial"] ?? "");
      const fimD = String(informados["data_final"] ?? "");
      const escolhidos: Record<string, string> = {};
      for (const [parametro, modelo] of Object.entries(rec.parametros_modelo)) {
        if (
          (modelo.includes("{data_inicial}") && !ini) ||
          (modelo.includes("{data_final}") && !fimD)
        )
          continue;
        escolhidos[parametro] = modelo
          .replace(/\{data_inicial\}/g, ini)
          .replace(/\{data_final\}/g, fimD);
      }
      for (const parametro of rec.vendedor) escolhidos[parametro] = credenciais["user_id"] ?? "";
      if (rec.dias && ini && fimD) {
        escolhidos[rec.dias] = String(
          Math.round((Date.parse(fimD) - Date.parse(ini)) / 86_400_000) + 1,
        );
      }
      for (const [nome, escolha] of Object.entries(rec.escolhas_query)) {
        const opcao = informados[nome];
        if (opcao && escolha.valores[String(opcao)] !== undefined) {
          escolhidos[escolha.parametro] = escolha.valores[String(opcao)]!;
        }
      }
      for (const c of campos) delete informados[c.nome];
      Object.assign(informados, escolhidos);
    }

    // leitura por POST: o formulário preenche o corpo JSON e nada disso vai na query
    let corpoBase: Record<string, unknown> | null = null;
    if (receita.corpo) {
      const trocas: Record<string, string> = {
        data_inicial: String(informados["data_inicial"] ?? ""),
        data_final: String(informados["data_final"] ?? ""),
        cnpj: String(informados["cnpj"] ?? "").replace(/\D/g, ""),
      };
      corpoBase = (preencherModelo(receita.corpo.modelo, trocas) ?? {}) as Record<string, unknown>;
      for (const [nome, escolha] of Object.entries(receita.corpo.escolhas)) {
        const opcao = informados[nome];
        if (opcao && escolha.valores[String(opcao)] !== undefined) {
          definirCaminho(corpoBase, escolha.caminho, escolha.valores[String(opcao)]);
        }
      }
      if (receita.corpo.filial && trocas["cnpj"]) {
        const filial = preencherModelo(receita.corpo.filial.modelo, trocas);
        if (filial !== undefined) definirCaminho(corpoBase, receita.corpo.filial.caminho, filial);
      }
      for (const c of campos) if (c.papel !== "caminho") delete informados[c.nome];
    }

    const consultaBase: Record<string, string> = {};
    for (const [k, v] of Object.entries(receita.padroes_fixos ?? {})) consultaBase[k] = String(v);
    for (const [k, v] of Object.entries(informados)) consultaBase[k] = String(v);

    let chaveEmBase64 = Boolean(data.chaveEmBase64);
    let cabecalhos = await autenticar(slug!, sistema.auth, credenciais, base, chaveEmBase64);
    let renovouNoErro = false;
    const podeTentarBase64 =
      sistema.auth.tipo === "header_api_key" && sistema.auth.prefixo === "Basic ";
    const porPagina = Boolean(receita.intervalo_minimo_s);

    const maximo = Math.min(data.maximo ?? 1000, 5000);
    const pag = receita.paginacao ?? { tipo: "nenhuma" };
    const tamanho = Math.min(pag.tamanho_max ?? 100, maximo);
    const linhas: Record<string, unknown>[] = [];
    let pagina = porPagina ? Math.max(0, data.pagina ?? 0) : 0;
    let cursor: string | number | null = pag.cursor_inicial ?? null;
    let continuar = false;
    let esperarSegundos = 0;
    let esperas429 = 0;
    const cursorNoCorpo = pag.local_cursor === "corpo";

    while (pagina < MAXIMO_PAGINAS) {
      const parametros = new URLSearchParams(consultaBase);
      if (pag.tipo === "offset" && pag.param_pagina && pag.param_tamanho) {
        parametros.set(pag.param_pagina, String(linhas.length + (pag.offset_base ?? 0)));
        parametros.set(pag.param_tamanho, String(tamanho));
      } else if (pag.tipo === "page" && pag.param_pagina) {
        // alguns sistemas têm tamanho fixo e nenhum parâmetro de tamanho (ex.: Nomus, 50)
        parametros.set(pag.param_pagina, String(pagina + (pag.pagina_inicial ?? 1)));
        if (pag.param_tamanho) parametros.set(pag.param_tamanho, String(tamanho));
      } else if (
        (pag.tipo === "cursor" || pag.tipo === "versao") &&
        cursor !== null &&
        pag.param_cursor &&
        !cursorNoCorpo
      ) {
        parametros.set(pag.param_cursor, String(cursor));
      }

      const consulta = parametros.toString();
      const endereco = base + caminho + (consulta ? `?${consulta}` : "");
      const corpoPedido = corpoBase
        ? {
            ...corpoBase,
            ...(cursorNoCorpo && cursor !== null && pag.param_cursor
              ? { [pag.param_cursor]: cursor }
              : {}),
          }
        : null;
      const pedir = () =>
        comLimite(endereco, {
          method: receita.metodo,
          headers: {
            ...cabecalhos,
            ...(receita.headers_fixos ?? {}),
            ...(corpoPedido ? { "Content-Type": "application/json" } : {}),
          },
          ...(corpoPedido ? { body: JSON.stringify(corpoPedido) } : {}),
        });
      let resposta = await pedir();

      // a documentação do Nomus fala em chave "em Base64", mas a coleção oficial envia crua:
      // tenta crua; se recusar na primeira chamada, tenta uma única vez em Base64
      if (
        (resposta.status === 401 || resposta.status === 403) &&
        podeTentarBase64 &&
        !chaveEmBase64 &&
        linhas.length === 0
      ) {
        chaveEmBase64 = true;
        cabecalhos = await autenticar(slug!, sistema.auth, credenciais, base, true);
        resposta = await pedir();
      }
      // OAuth: acesso recusado no meio do caminho -> renova uma vez e repete
      if (resposta.status === 401 && oauth && !renovouNoErro && !credenciaisNovas) {
        renovouNoErro = true;
        credenciaisNovas = await pedirTokenOAuth(
          slug!,
          sistema.auth,
          { grant_type: "refresh_token", refresh_token: credenciais["refresh_token"] ?? "" },
          credenciais["user_id"] ?? "",
        );
        credenciais = { ...credenciais, ...credenciaisNovas };
        cabecalhos = await autenticar(slug!, sistema.auth, credenciais, base);
        resposta = await pedir();
      }

      if (resposta.status === 401 || resposta.status === 403) throw credencialRecusada(slug!);
      if (resposta.status === 429 && !porPagina) {
        // espera curta pedida pelo sistema (Retry-After): aguarda e repete a mesma página
        const pedida = Number(resposta.headers.get("retry-after") ?? "");
        if (Number.isFinite(pedida) && pedida > 0 && pedida <= 20 && esperas429 < 3) {
          esperas429 += 1;
          await esperar(pedida * 1000);
          continue;
        }
        if (!(pedida > 0) && esperas429 < 2) {
          // sem Retry-After (ex.: Mercado Livre): espera 2 s, depois 4 s
          esperas429 += 1;
          await esperar(2000 * esperas429);
          continue;
        }
        throw new Error(
          "O sistema pediu para aguardar (limite de requisições atingido)" +
            (Number.isFinite(pedida) && pedida > 0 ? `: tente de novo em ${pedida} s.` : "."),
        );
      }
      if (resposta.status === 429) {
        let espera = receita.intervalo_minimo_s ?? 0;
        try {
          const corpo429 = (await resposta.json()) as { tempoAteLiberar?: number };
          if (typeof corpo429.tempoAteLiberar === "number") espera = corpo429.tempoAteLiberar;
        } catch {
          // sem corpo: usa o intervalo documentado
        }
        if (!porPagina) {
          throw new Error("O sistema pediu para aguardar (limite de requisições atingido).");
        }
        // devolve sem linhas: o navegador espera e pede a mesma página de novo
        continuar = true;
        esperarSegundos = Math.max(espera, 1);
        break;
      }
      if (!resposta.ok) {
        throw new Error(`A API respondeu HTTP ${resposta.status}.`);
      }
      if (resposta.status === 204) break;

      const corpo = await resposta.json();
      const itens = extrairLista(corpo, receita.lista_em);
      // XML em Base64: lê as colunas "xml:..." e descarta o conteúdo bruto da planilha
      if (receita.xml) {
        const doXml = receita.colunas.filter((c) => c.caminho.startsWith("xml:"));
        for (const item of itens) {
          const bruto = valorFlexivel(item, receita.xml.campo);
          if (typeof bruto === "string" && bruto) {
            try {
              const xml = decodificarBase64(bruto);
              for (const c of doXml) item[c.caminho] = lerXml(xml, c.caminho.slice(4));
            } catch {
              // XML ilegível: as colunas do XML ficam vazias nesta linha
            }
          }
          for (const chave of Object.keys(item)) {
            if (normalizarCampo(chave) === normalizarCampo(receita.xml.campo)) delete item[chave];
          }
        }
      }
      linhas.push(...itens);

      let acabou = pag.tipo === "nenhuma" || itens.length === 0 || linhas.length >= maximo;
      if (!acabou && pag.fim === "pagina_incompleta" && itens.length < tamanho) acabou = true;
      if (!acabou && pag.fim === "hasMore_false" && !valor(corpo, "hasMore")) acabou = true;
      if (
        !acabou &&
        (pag.fim === "total_atingido" || pag.fim_alternativo === "total_atingido") &&
        receita.campo_total
      ) {
        const total = Number(valor(corpo, receita.campo_total));
        if (Number.isFinite(total) && total > 0 && linhas.length >= total) acabou = true;
      }
      if (!acabou && pag.tipo === "cursor" && pag.origem_proximo === "raiz_da_resposta") {
        // próximo cursor vem na resposta (no corpo ou como endereço com ?cursor=)
        let proximo = valor(corpo, pag.campo_proximo ?? null) as unknown;
        if (typeof proximo === "string" && /^https?:\/\//.test(proximo) && pag.param_cursor) {
          proximo = new URL(proximo).searchParams.get(pag.param_cursor);
        }
        if (
          proximo === null ||
          proximo === undefined ||
          proximo === "" ||
          (proximo === cursor && pag.fim !== "lista_vazia")
        ) {
          acabou = true;
        } else cursor = proximo as string | number;
      } else if (!acabou && (pag.tipo === "versao" || pag.tipo === "cursor")) {
        const campo = pag.campo_proximo ?? "versao";
        const valores = itens
          .map((i) => valor(i, campo))
          .filter((v): v is number | string => v !== undefined && v !== null);
        if (valores.length === 0) acabou = true;
        else cursor = valores.reduce((a, b) => (Number(a) > Number(b) ? a : b));
      }
      if (acabou) break;
      pagina += 1;
      if (porPagina) {
        // uma página por chamada: o navegador espera o intervalo e pede a próxima
        continuar = true;
        esperarSegundos = receita.intervalo_minimo_s ?? 0;
        break;
      }
      await new Promise((r) => setTimeout(r, 350));
    }

    let registros: Registro[] = linhas.slice(0, maximo) as Registro[];
    let receitaSaida = receita;
    // duas etapas (ex.: anúncios): a primeira trouxe ids; a segunda busca os dados em lotes
    if (receita.segunda_etapa) {
      const etapa = sistema.endpoints[receita.segunda_etapa.endpoint];
      if (!etapa) throw new Error("A segunda etapa desta consulta não está disponível.");
      const ids = registros
        .map((r) => valorFlexivel(r, "$") ?? valorFlexivel(r, "id"))
        .filter((v) => v !== undefined && v !== null && v !== "")
        .map(String);
      const detalhes: Registro[] = [];
      const lote = Math.max(1, receita.segunda_etapa.lote);
      for (let i = 0, tentativas = 0; i < ids.length;) {
        const consultaLote = new URLSearchParams(
          Object.fromEntries(
            Object.entries(etapa.padroes_fixos ?? {}).map(([k, v]) => [k, String(v)]),
          ),
        );
        consultaLote.set(receita.segunda_etapa.parametro, ids.slice(i, i + lote).join(","));
        const r = await comLimite(`${base}${etapa.path}?${consultaLote}`, {
          method: "GET",
          headers: { ...cabecalhos, ...(etapa.headers_fixos ?? {}) },
        });
        if (r.status === 429 && tentativas < 3) {
          tentativas += 1;
          await esperar(2000 * tentativas);
          continue;
        }
        if (!r.ok) throw new Error(`A API respondeu HTTP ${r.status} ao buscar os detalhes.`);
        for (const d of extrairLista(await r.json(), etapa.lista_em)) {
          // envelope do lote ({ code, body }): o código HTTP de cada item não vai para a planilha
          if (ehRegistro(d["body"])) delete d["code"];
          detalhes.push(d);
        }
        i += lote;
        tentativas = 0;
      }
      registros = detalhes;
      receitaSaida = etapa;
    }
    const { colunas, aviso } = resolverColunas(receitaSaida.colunas, registros);

    const numericas = new Map(
      receitaSaida.colunas
        .filter((c) => TIPOS_NUMERICOS.has(String(c.tipo)))
        .map((c) => [c.caminho, c.formato_origem ?? ""] as const),
    );

    return {
      titulo: receita.titulo,
      metodo: receita.metodo,
      path: receita.path,
      aviso,
      /** Há mais páginas: chame de novo com `pagina` depois de `esperarSegundos`. */
      continuar,
      proximaPagina: pagina,
      esperarSegundos,
      chaveEmBase64,
      /** Acesso renovado nesta chamada (OAuth): o navegador guarda no lugar do anterior. */
      credenciaisNovas,
      colunas: colunas.map((c) => ({ titulo: c.titulo, chave: c.caminho })),
      linhas: registros.map((linha) => {
        const saida: Record<string, string | number> = {};
        for (const c of colunas) {
          const bruto = valorFlexivel(linha, c.caminho);
          const formato = numericas.get(c.caminho);
          const lido = formato === undefined ? bruto : numeroDeTexto(bruto, formato);
          const v = typeof lido === "string" ? (sistema.traducoes?.[lido] ?? lido) : lido;
          saida[c.caminho] =
            v === null || v === undefined
              ? ""
              : typeof v === "boolean"
                ? v
                  ? "Sim"
                  : "Não"
                : Array.isArray(v) && v.every((x) => x === null || typeof x !== "object")
                  ? v.join(", ")
                  : Array.isArray(v) && resumirItens(v) !== null
                    ? resumirItens(v)!
                    : typeof v === "object"
                      ? JSON.stringify(v)
                      : (v as string | number);
        }
        return saida;
      }),
    };
  }
}

/**
 * Conexão por autorização na tela do fornecedor (ex.: Mercado Livre): devolve o endereço da tela,
 * com o client_id do aplicativo do Stagium e o `state` gerado pelo navegador.
 */
export const iniciarConexao = createServerFn({ method: "POST" })
  .validator((dados: { slug: string; state: string }) => dados)
  .handler(async ({ data }) => {
    const auth = EXECUCAO[data.slug]?.auth;
    if (!auth?.conexao) throw new Error("Este sistema não usa conexão por autorização.");
    const app = aplicativoOAuth(data.slug);
    if (!app.clientId || !app.clientSecret) {
      return { configurado: false as const, url: "", faltam: app.variaveis };
    }
    const url = new URL(app.authUrl || auth.conexao.url_autorizacao);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", app.clientId);
    url.searchParams.set("redirect_uri", app.redirectUri);
    url.searchParams.set("state", data.state);
    return { configurado: true as const, url: url.toString(), faltam: "" };
  });

/**
 * Sistemas por autorização e se o aplicativo do Stagium já está configurado (segredos no
 * servidor). O chat esconde os que ainda não estão, para ninguém escolher e dar com erro.
 */
export const conexoesConfiguradas = createServerFn({ method: "GET" }).handler(async () =>
  Object.fromEntries(
    Object.entries(EXECUCAO)
      .filter(([, sistema]) => sistema.auth.conexao)
      .map(([slug]) => {
        const app = aplicativoOAuth(slug);
        return [slug, Boolean(app.clientId && app.clientSecret)];
      }),
  ),
);

/** Troca o código devolvido pela tela de autorização pelo acesso da conta (só no servidor). */
export const concluirConexao = createServerFn({ method: "POST" })
  .validator((dados: { slug: string; code: string }) => dados)
  .handler(async ({ data }) => {
    const auth = EXECUCAO[data.slug]?.auth;
    if (!auth?.conexao) throw new Error("Este sistema não usa conexão por autorização.");
    return pedirTokenOAuth(data.slug, auth, {
      grant_type: "authorization_code",
      code: data.code,
      redirect_uri: aplicativoOAuth(data.slug).redirectUri,
    });
  });

export const executarConsultaReal = createServerFn({ method: "POST" })
  .validator((dados: Entrada) => dados)
  .handler(async ({ data }) => consultarSistema(data));

/** Credenciais que o cliente precisa entregar para uma consulta (sem valores). */
export function credenciaisNecessarias(slug: string) {
  return EXECUCAO[slug]?.auth.credenciais_necessarias ?? [];
}
