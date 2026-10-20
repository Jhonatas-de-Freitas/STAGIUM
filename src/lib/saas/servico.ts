/**
 * Regras de negócio do painel: contas, empresas, acesso, equipe, uso, auditoria e dados.
 * Fala só com a interface Repositorio, então continua valendo quando o banco for o Supabase.
 */
import { TESTE_GRATIS, planoPorId } from "../planos";
import { direitosDaEmpresa, mesAtual, situacaoDeAcesso, verificarLimite, type Recurso } from "./direitos";
import { gerarDadosDemo } from "./demo";
import { repo } from "./repositorio";
import { conferirSenha, gerarHash, gerarSenhaTemporaria, novoId, validarForcaDaSenha } from "./senha";
import type {
  CicloCobranca,
  ConfigPlataforma,
  Conexao,
  Convite,
  Dataset,
  Empresa,
  EventoAuditoria,
  PapelEmpresa,
  RegistroUso,
  Sessao,
  SolicitacaoPlano,
  Usuario,
} from "./tipos";

const DIA = 86_400_000;
const SESSAO_HORAS = 12;
export const emailNormalizado = (e: string) => e.trim().toLowerCase();
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/* ---------------- configuração e primeiro acesso ---------------- */

export async function obterConfig(): Promise<ConfigPlataforma> {
  return (
    (await repo().global<ConfigPlataforma>("config").obter("config")) ?? {
      id: "config",
      cadastroPublico: true,
      diasDeTeste: TESTE_GRATIS.dias,
    }
  );
}
export const salvarConfig = (c: ConfigPlataforma) => repo().global<ConfigPlataforma>("config").salvar(c);

export async function existeSuperadmin(): Promise<boolean> {
  return (await repo().global<Usuario>("usuarios").listar()).some((u) => u.papel === "superadmin");
}

/** Primeiro acesso: quem monta o ambiente cria o administrador da plataforma. */
export async function criarSuperadmin(nome: string, email: string, senha: string): Promise<Usuario> {
  if (await existeSuperadmin()) throw new Error("Já existe um administrador da plataforma.");
  return criarUsuario({ empresaId: null, nome, email, senha, papel: "superadmin" });
}

async function criarUsuario(d: {
  empresaId: string | null;
  nome: string;
  email: string;
  senha: string;
  papel: Usuario["papel"];
  precisaTrocarSenha?: boolean;
}): Promise<Usuario> {
  const email = emailNormalizado(d.email);
  if (!d.nome.trim()) throw new Error("Informe o nome.");
  if (!emailValido(email)) throw new Error("E-mail inválido.");
  const usuarios = repo().global<Usuario>("usuarios");
  if ((await usuarios.listar()).some((u) => u.email === email))
    throw new Error("Já existe uma conta com este e-mail.");
  const u: Usuario = {
    id: novoId("u"),
    empresaId: d.empresaId,
    nome: d.nome.trim(),
    email,
    papel: d.papel,
    senha: await gerarHash(d.senha),
    ativo: true,
    precisaTrocarSenha: d.precisaTrocarSenha ?? false,
    criadoEm: new Date().toISOString(),
    ultimoAcesso: null,
  };
  return usuarios.salvar(u);
}

/* ---------------- sessão ---------------- */

const chaveTentativas = (email: string) => `stagium.saas.v1:tentativas:${email}`;
const MAX_TENTATIVAS = 5;
const JANELA_MS = 10 * 60_000;

function tentativasRecentes(email: string): number[] {
  try {
    const t = JSON.parse(localStorage.getItem(chaveTentativas(email)) ?? "[]") as number[];
    return t.filter((x) => Date.now() - x < JANELA_MS);
  } catch {
    return [];
  }
}
function guardarTentativas(email: string, t: number[]) {
  try {
    if (t.length) localStorage.setItem(chaveTentativas(email), JSON.stringify(t));
    else localStorage.removeItem(chaveTentativas(email));
  } catch {
    /* sem armazenamento */
  }
}

export async function entrar(emailBruto: string, senha: string): Promise<Usuario> {
  const email = emailNormalizado(emailBruto);
  const tentativas = tentativasRecentes(email);
  if (tentativas.length >= MAX_TENTATIVAS)
    throw new Error("Muitas tentativas erradas. Aguarde 10 minutos e tente de novo.");
  const u = (await repo().global<Usuario>("usuarios").listar()).find((x) => x.email === email);
  const ok = u ? await conferirSenha(senha, u.senha) : false;
  if (!u || !ok) {
    guardarTentativas(email, [...tentativas, Date.now()]);
    throw new Error("E-mail ou senha incorretos.");
  }
  if (!u.ativo) throw new Error("Esta conta está desativada. Fale com o administrador da sua empresa.");
  if (u.empresaId) {
    const e = await repo().global<Empresa>("empresas").obter(u.empresaId);
    if (e?.status === "cancelada") throw new Error("Esta empresa cancelou o plano. Fale com a gente para reativar.");
  }
  guardarTentativas(email, []);
  const atualizado = await repo().global<Usuario>("usuarios").salvar({ ...u, ultimoAcesso: new Date().toISOString() });
  await abrirSessao(u);
  await auditar(u.empresaId, atualizado, "login", "Entrou no painel");
  return atualizado;
}

async function abrirSessao(u: Usuario) {
  const agora = Date.now();
  await repo().sessao.gravar({
    usuarioId: u.id,
    criadaEm: new Date(agora).toISOString(),
    expiraEm: new Date(agora + SESSAO_HORAS * 3_600_000).toISOString(),
    personificando: null,
  });
}

/**
 * Conta de demonstração do modo local: empresa fictícia com os dados de exemplo, sem senha.
 * Reaproveita a mesma conta nas próximas vezes. Não existe em produção.
 */
export async function entrarComoDemo(): Promise<Usuario> {
  const empresas = repo().global<Empresa>("empresas");
  const existente = (await empresas.listar()).find((e) => e.origem === "demo");
  if (existente) {
    const dono = (await listarUsuarios(existente.id)).find((u) => u.papel === "dono");
    if (dono) {
      await abrirSessao(dono);
      return dono;
    }
  }
  const agora = new Date();
  const empresa: Empresa = {
    id: novoId("e"),
    nome: "Distribuidora Aurora (demonstração)",
    documento: "",
    planoId: "profissional",
    status: "teste",
    testeAte: new Date(agora.getTime() + 14 * DIA).toISOString(),
    cortesia: false,
    cortesiaAte: null,
    ciclo: "mensal",
    origem: "demo",
    limitesEspeciais: {},
    observacao: "Conta de demonstração criada neste navegador.",
    criadaEm: agora.toISOString(),
  };
  const dono = await criarUsuario({
    empresaId: empresa.id,
    nome: "Visitante",
    email: `demo-${empresa.id}@demonstracao.stagium`,
    senha: gerarSenhaTemporaria() + "9a",
    papel: "dono",
  });
  await empresas.salvar(empresa);
  await repo().daEmpresa<Conexao>(empresa.id, "conexoes").salvar({ id: novoId("x"), slug: "demo", apelido: "Dados de demonstração", criadaEm: agora.toISOString() });
  await abrirSessao(dono);
  return dono;
}

export async function sair() {
  await repo().sessao.gravar(null);
}

export type Contexto = {
  usuario: Usuario;
  /** Empresa cujos dados estão na tela (a do usuário, ou a que o admin está vendo). */
  empresa: Empresa | null;
  personificando: boolean;
};

export async function obterContexto(): Promise<Contexto | null> {
  const s = await repo().sessao.obter();
  if (!s) return null;
  const usuario = await repo().global<Usuario>("usuarios").obter(s.usuarioId);
  if (!usuario || !usuario.ativo) return null;
  const alvo = usuario.papel === "superadmin" ? s.personificando : usuario.empresaId;
  const empresa = alvo ? await repo().global<Empresa>("empresas").obter(alvo) : null;
  return { usuario, empresa, personificando: usuario.papel === "superadmin" && !!s.personificando };
}

export async function personificar(empresaId: string | null) {
  const s = await repo().sessao.obter();
  if (!s) return;
  const u = await repo().global<Usuario>("usuarios").obter(s.usuarioId);
  if (u?.papel !== "superadmin") throw new Error("Só a equipe Stagium pode ver como cliente.");
  const nova: Sessao = { ...s, personificando: empresaId };
  await repo().sessao.gravar(nova);
  if (empresaId) await auditar(empresaId, u, "suporte", "Equipe Stagium abriu o painel para suporte");
}

export async function trocarSenha(usuarioId: string, atual: string | null, nova: string) {
  const erro = validarForcaDaSenha(nova);
  if (erro) throw new Error(erro);
  const col = repo().global<Usuario>("usuarios");
  const u = await col.obter(usuarioId);
  if (!u) throw new Error("Conta não encontrada.");
  if (atual !== null && !(await conferirSenha(atual, u.senha))) throw new Error("A senha atual está incorreta.");
  const salvo = await col.salvar({ ...u, senha: await gerarHash(nova), precisaTrocarSenha: false });
  await auditar(u.empresaId, salvo, "senha", "Trocou a senha");
}

/* ---------------- empresas e acesso ---------------- */

export type DadosCadastro = {
  empresa: string;
  documento?: string;
  nome: string;
  email: string;
  senha: string;
  planoId?: string;
};

/** Cadastro feito pelo próprio cliente: começa no teste grátis. */
export async function cadastrarEmpresa(d: DadosCadastro): Promise<{ empresa: Empresa; usuario: Usuario }> {
  const config = await obterConfig();
  if (!config.cadastroPublico) throw new Error("O cadastro público está fechado. Peça um convite à nossa equipe.");
  const erro = validarForcaDaSenha(d.senha);
  if (erro) throw new Error(erro);
  if (!d.empresa.trim()) throw new Error("Informe o nome da empresa.");
  const agora = new Date();
  const empresa: Empresa = {
    id: novoId("e"),
    nome: d.empresa.trim(),
    documento: (d.documento ?? "").trim(),
    planoId: d.planoId && ["essencial", "profissional", "empresa"].includes(d.planoId) ? d.planoId : "profissional",
    status: "teste",
    testeAte: new Date(agora.getTime() + config.diasDeTeste * DIA).toISOString(),
    cortesia: false,
    cortesiaAte: null,
    ciclo: "mensal",
    origem: "cadastro",
    limitesEspeciais: {},
    observacao: "",
    criadaEm: agora.toISOString(),
  };
  const usuario = await criarUsuario({ empresaId: empresa.id, nome: d.nome, email: d.email, senha: d.senha, papel: "dono" });
  await repo().global<Empresa>("empresas").salvar(empresa);
  await auditar(empresa.id, usuario, "cadastro", `Empresa criada (teste de ${config.diasDeTeste} dias)`);
  return { empresa, usuario };
}

export type ConcessaoDeAcesso = {
  empresa: string;
  documento?: string;
  responsavelNome: string;
  responsavelEmail: string;
  planoId: string;
  /** teste: N dias grátis; pago: plano ativo e cobrado; cortesia: ativo sem cobrança. */
  tipo: "teste" | "pago" | "cortesia";
  dias?: number;
  ciclo?: CicloCobranca;
  observacao?: string;
};

/** Admin da plataforma concede acesso: cria empresa e dono com senha temporária (mostrada uma vez). */
export async function concederAcesso(
  quem: Usuario,
  c: ConcessaoDeAcesso,
): Promise<{ empresa: Empresa; usuario: Usuario; senhaTemporaria: string }> {
  if (quem.papel !== "superadmin") throw new Error("Só a equipe Stagium concede acesso.");
  if (!c.empresa.trim()) throw new Error("Informe o nome da empresa.");
  const agora = new Date();
  const dias = Math.max(1, Math.round(c.dias ?? (c.tipo === "teste" ? TESTE_GRATIS.dias : 0)));
  const empresa: Empresa = {
    id: novoId("e"),
    nome: c.empresa.trim(),
    documento: (c.documento ?? "").trim(),
    planoId: planoPorId(c.planoId).id,
    status: c.tipo === "teste" ? "teste" : "ativa",
    testeAte: c.tipo === "teste" ? new Date(agora.getTime() + dias * DIA).toISOString() : null,
    cortesia: c.tipo === "cortesia",
    cortesiaAte: c.tipo === "cortesia" && c.dias ? new Date(agora.getTime() + dias * DIA).toISOString() : null,
    ciclo: c.ciclo ?? "mensal",
    origem: "concedido",
    limitesEspeciais: {},
    observacao: c.observacao ?? "",
    criadaEm: agora.toISOString(),
  };
  const senhaTemporaria = gerarSenhaTemporaria();
  const usuario = await criarUsuario({
    empresaId: empresa.id,
    nome: c.responsavelNome,
    email: c.responsavelEmail,
    senha: senhaTemporaria,
    papel: "dono",
    precisaTrocarSenha: true,
  });
  await repo().global<Empresa>("empresas").salvar(empresa);
  await auditar(empresa.id, quem, "concessao", `Acesso concedido: ${c.tipo}, plano ${planoPorId(c.planoId).nome}`);
  return { empresa, usuario, senhaTemporaria };
}

export async function redefinirSenhaTemporaria(quem: Usuario, usuarioId: string): Promise<string> {
  if (quem.papel !== "superadmin") throw new Error("Só a equipe Stagium redefine senhas.");
  const col = repo().global<Usuario>("usuarios");
  const u = await col.obter(usuarioId);
  if (!u) throw new Error("Conta não encontrada.");
  const temp = gerarSenhaTemporaria();
  await col.salvar({ ...u, senha: await gerarHash(temp), precisaTrocarSenha: true });
  await auditar(u.empresaId, quem, "senha", `Senha temporária gerada para ${u.email}`);
  return temp;
}

export async function alterarEmpresa(quem: Usuario, id: string, mudancas: Partial<Empresa>): Promise<Empresa> {
  if (quem.papel !== "superadmin") throw new Error("Só a equipe Stagium altera o plano.");
  const col = repo().global<Empresa>("empresas");
  const e = await col.obter(id);
  if (!e) throw new Error("Empresa não encontrada.");
  const novo = { ...e, ...mudancas, id: e.id };
  await col.salvar(novo);
  const resumo = Object.keys(mudancas).join(", ");
  await auditar(id, quem, "empresa", `Dados da empresa alterados: ${resumo}`);
  return novo;
}

export const estenderTeste = (quem: Usuario, e: Empresa, dias: number) => {
  const base = e.testeAte && new Date(e.testeAte) > new Date() ? new Date(e.testeAte) : new Date();
  return alterarEmpresa(quem, e.id, { status: "teste", testeAte: new Date(base.getTime() + dias * DIA).toISOString() });
};

export async function listarEmpresas(): Promise<Empresa[]> {
  return (await repo().global<Empresa>("empresas").listar()).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}
export const obterEmpresa = (id: string) => repo().global<Empresa>("empresas").obter(id);
export async function listarUsuarios(empresaId?: string | null): Promise<Usuario[]> {
  const todos = await repo().global<Usuario>("usuarios").listar();
  return empresaId === undefined ? todos : todos.filter((u) => u.empresaId === empresaId);
}

/** Receita recorrente mensal estimada (ignora teste, cortesia e suspensas; anual vira 10/12). */
export function receitaMensal(e: Empresa): number {
  if (e.status !== "ativa" || e.cortesia) return 0;
  const p = planoPorId(e.planoId);
  if (p.mensal === null) return 0;
  return e.ciclo === "anual" ? (p.mensal * 10) / 12 : p.mensal;
}

/* ---------------- solicitações de plano ---------------- */

export async function solicitarMudancaDePlano(quem: Usuario, e: Empresa, planoDesejado: string, mensagem: string) {
  const s: SolicitacaoPlano = {
    id: novoId("p"),
    empresaId: e.id,
    planoDesejado,
    mensagem: mensagem.trim(),
    criadaEm: new Date().toISOString(),
    atendidaEm: null,
  };
  await repo().global<SolicitacaoPlano>("solicitacoes").salvar(s);
  await auditar(e.id, quem, "plano", `Pediu mudança para o plano ${planoPorId(planoDesejado).nome}`);
  return s;
}
export const listarSolicitacoes = () => repo().global<SolicitacaoPlano>("solicitacoes").listar();
export async function atenderSolicitacao(id: string) {
  const col = repo().global<SolicitacaoPlano>("solicitacoes");
  const s = await col.obter(id);
  if (s) await col.salvar({ ...s, atendidaEm: new Date().toISOString() });
}

/* ---------------- equipe e convites ---------------- */

export async function criarConvite(quem: Usuario, empresa: Empresa, email: string, papel: PapelEmpresa): Promise<Convite> {
  const usuarios = await listarUsuarios(empresa.id);
  const pendentes = (await repo().global<Convite>("convites").listar()).filter(
    (c) => c.empresaId === empresa.id && !c.usadoEm && new Date(c.expiraEm) > new Date(),
  );
  const lim = verificarLimite(empresa, "usuarios", usuarios.filter((u) => u.ativo).length + pendentes.length);
  if (!lim.ok) throw new Error(lim.mensagem);
  const mail = emailNormalizado(email);
  if (!emailValido(mail)) throw new Error("E-mail inválido.");
  if ((await listarUsuarios()).some((u) => u.email === mail)) throw new Error("Já existe uma conta com este e-mail.");
  const convite: Convite = {
    id: novoId("c") + novoId(),
    empresaId: empresa.id,
    email: mail,
    papel,
    criadoPor: quem.id,
    criadoEm: new Date().toISOString(),
    expiraEm: new Date(Date.now() + 7 * DIA).toISOString(),
    usadoEm: null,
  };
  await repo().global<Convite>("convites").salvar(convite);
  await auditar(empresa.id, quem, "equipe", `Convidou ${mail} como ${papel}`);
  return convite;
}

export async function obterConvite(codigo: string): Promise<Convite | null> {
  const c = await repo().global<Convite>("convites").obter(codigo);
  if (!c || c.usadoEm || new Date(c.expiraEm) < new Date()) return null;
  return c;
}
export async function listarConvites(empresaId: string): Promise<Convite[]> {
  return (await repo().global<Convite>("convites").listar()).filter(
    (c) => c.empresaId === empresaId && !c.usadoEm && new Date(c.expiraEm) > new Date(),
  );
}
export const cancelarConvite = (codigo: string) => repo().global<Convite>("convites").remover(codigo);

export async function aceitarConvite(codigo: string, nome: string, senha: string): Promise<Usuario> {
  const c = await obterConvite(codigo);
  if (!c) throw new Error("Este convite expirou ou já foi usado. Peça um novo.");
  const erro = validarForcaDaSenha(senha);
  if (erro) throw new Error(erro);
  const u = await criarUsuario({ empresaId: c.empresaId, nome, email: c.email, senha, papel: c.papel });
  await repo().global<Convite>("convites").salvar({ ...c, usadoEm: new Date().toISOString() });
  await auditar(c.empresaId, u, "equipe", "Aceitou o convite e entrou na equipe");
  return u;
}

export async function alterarUsuario(quem: Usuario, alvoId: string, mudancas: { papel?: PapelEmpresa; ativo?: boolean }) {
  const col = repo().global<Usuario>("usuarios");
  const alvo = await col.obter(alvoId);
  if (!alvo || alvo.empresaId !== quem.empresaId && quem.papel !== "superadmin") throw new Error("Pessoa não encontrada.");
  if (alvo.id === quem.id && (mudancas.ativo === false || mudancas.papel)) throw new Error("Você não pode alterar a própria permissão ou desativar a si mesmo.");
  const donos = (await listarUsuarios(alvo.empresaId)).filter((u) => u.papel === "dono" && u.ativo);
  if (alvo.papel === "dono" && donos.length <= 1 && (mudancas.ativo === false || (mudancas.papel && mudancas.papel !== "dono")))
    throw new Error("A empresa precisa de pelo menos um dono ativo.");
  if (mudancas.ativo === true && alvo.empresaId) {
    const empresa = await obterEmpresa(alvo.empresaId);
    const ativos = (await listarUsuarios(alvo.empresaId)).filter((u) => u.ativo).length;
    if (empresa) {
      const lim = verificarLimite(empresa, "usuarios", ativos);
      if (!lim.ok) throw new Error(lim.mensagem);
    }
  }
  const salvo = await col.salvar({ ...alvo, ...mudancas });
  await auditar(alvo.empresaId, quem, "equipe", `${alvo.email}: ${mudancas.papel ? `papel → ${mudancas.papel}` : mudancas.ativo ? "reativado" : "desativado"}`);
  return salvo;
}

/* ---------------- uso e limites ---------------- */

async function registroDoMes(empresaId: string): Promise<RegistroUso> {
  const mes = mesAtual();
  const col = repo().daEmpresa<RegistroUso>(empresaId, "uso");
  return (await col.obter(mes)) ?? { id: mes, mes, consultas: 0, creditosIa: 0 };
}

export const lerUso = registroDoMes;

/** Gasta consultas ou créditos de IA. Lança erro em português se passar do limite do plano. */
export async function consumir(empresa: Empresa, tipo: "consultas" | "creditosIa", quantidade = 1): Promise<RegistroUso> {
  const reg = await registroDoMes(empresa.id);
  const recurso: Recurso = tipo === "consultas" ? "consultasMes" : "creditosIaMes";
  const lim = verificarLimite(empresa, recurso, reg[tipo], quantidade);
  if (!lim.ok) throw new Error(lim.mensagem);
  const novo = { ...reg, [tipo]: reg[tipo] + quantidade };
  await repo().daEmpresa<RegistroUso>(empresa.id, "uso").salvar(novo);
  return novo;
}

/* ---------------- auditoria ---------------- */

export async function auditar(empresaId: string | null, quem: Pick<Usuario, "id" | "nome">, acao: string, detalhe: string) {
  if (!empresaId) return;
  try {
    const col = repo().daEmpresa<EventoAuditoria>(empresaId, "auditoria");
    const lista = await col.listar();
    const ev: EventoAuditoria = { id: novoId("a"), em: new Date().toISOString(), usuarioId: quem.id, usuarioNome: quem.nome, acao, detalhe };
    // mantém só os últimos 1.500 eventos para não estourar o espaço do navegador
    await col.substituirTudo([...lista, ev].slice(-1500));
  } catch {
    /* auditoria nunca pode derrubar a ação do usuário */
  }
}

export async function listarAuditoria(empresa: Empresa): Promise<EventoAuditoria[]> {
  const dias = direitosDaEmpresa(empresa).auditoriaDias;
  const corte = Date.now() - dias * DIA;
  return (await repo().daEmpresa<EventoAuditoria>(empresa.id, "auditoria").listar())
    .filter((e) => new Date(e.em).getTime() >= corte)
    .sort((a, b) => b.em.localeCompare(a.em));
}

/* ---------------- conexões e dados ---------------- */

export async function listarConexoes(empresaId: string): Promise<Conexao[]> {
  return repo().daEmpresa<Conexao>(empresaId, "conexoes").listar();
}

export async function adicionarConexao(quem: Usuario, empresa: Empresa, slug: string, apelido: string): Promise<Conexao> {
  const conexoes = await listarConexoes(empresa.id);
  if (conexoes.some((c) => c.slug === slug)) throw new Error("Este sistema já está conectado.");
  if (slug !== "demo") {
    const lim = verificarLimite(empresa, "sistemas", conexoes.filter((c) => c.slug !== "demo").length);
    if (!lim.ok) throw new Error(lim.mensagem);
  }
  const c: Conexao = { id: novoId("x"), slug, apelido: apelido.trim() || slug, criadaEm: new Date().toISOString() };
  await repo().daEmpresa<Conexao>(empresa.id, "conexoes").salvar(c);
  await auditar(empresa.id, quem, "conexao", `Conectou ${apelido || slug}`);
  return c;
}

export async function removerConexao(quem: Usuario, empresa: Empresa, id: string) {
  await repo().daEmpresa<Conexao>(empresa.id, "conexoes").remover(id);
  await auditar(empresa.id, quem, "conexao", "Removeu uma conexão");
}

/** Dados da empresa: demonstração (gerada na hora, não ocupa espaço) + planilhas importadas. */
export async function carregarDatasets(empresaId: string): Promise<Dataset[]> {
  const [conexoes, guardados] = await Promise.all([
    listarConexoes(empresaId),
    repo().daEmpresa<Dataset>(empresaId, "datasets").listar(),
  ]);
  const demo = conexoes.some((c) => c.slug === "demo") ? gerarDadosDemo() : [];
  return [...demo, ...guardados];
}

export async function importarDataset(quem: Usuario, empresa: Empresa, ds: Dataset) {
  await repo().daEmpresa<Dataset>(empresa.id, "datasets").salvar(ds);
  await auditar(empresa.id, quem, "dados", `Importou a planilha "${ds.nome}" (${ds.linhas.length} linhas)`);
}
export async function removerDataset(quem: Usuario, empresa: Empresa, id: string) {
  await repo().daEmpresa<Dataset>(empresa.id, "datasets").remover(id);
  await auditar(empresa.id, quem, "dados", "Apagou uma base de dados importada");
}

/* ---------------- LGPD ---------------- */

/** Tudo que a empresa tem, em JSON (portabilidade). Sem hashes de senha. */
export async function exportarDadosDaEmpresa(quem: Usuario, empresa: Empresa) {
  const nomes = ["dashboards", "relatorios", "execucoes", "alertas", "conexoes", "datasets", "uso", "auditoria"] as const;
  const dados: Record<string, unknown> = {};
  for (const n of nomes) dados[n] = await repo().daEmpresa(empresa.id, n).listar();
  const usuarios = (await listarUsuarios(empresa.id)).map(({ senha: _s, ...resto }) => resto);
  await auditar(empresa.id, quem, "lgpd", "Exportou os dados da empresa");
  return { exportadoEm: new Date().toISOString(), empresa, usuarios, ...dados };
}

export async function excluirEmpresa(quem: Usuario, empresa: Empresa) {
  if (quem.papel !== "superadmin" && !(quem.papel === "dono" && quem.empresaId === empresa.id))
    throw new Error("Só o dono da empresa pode excluir os dados.");
  const usuarios = await listarUsuarios(empresa.id);
  for (const u of usuarios) await repo().global<Usuario>("usuarios").remover(u.id);
  await repo().apagarDadosDaEmpresa(empresa.id);
  await repo().global<Empresa>("empresas").remover(empresa.id);
  await repo().sessao.gravar(null);
}

export { situacaoDeAcesso };
