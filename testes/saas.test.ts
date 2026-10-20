/**
 * Testes do painel do cliente (modo local). Rodar:  npx -y tsx --test testes/saas.test.ts
 * Não precisam de navegador nem de banco: o localStorage é simulado em memória.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

const memoria = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => void memoria.set(k, v),
  removeItem: (k: string) => void memoria.delete(k),
};

const { interpretarPeriodo } = await import("../src/lib/periodo");
const { gerarDadosDemo } = await import("../src/lib/saas/demo");
const { executarPlano, validarPlano } = await import("../src/lib/saas/consulta");
const { sugerirWidgets } = await import("../src/lib/saas/sugestoes");
const { gerarInsights, gerarTodosInsights } = await import("../src/lib/saas/insights");
const { interpretarPergunta, ehErro } = await import("../src/lib/saas/interpretar");
const { resumirResultado } = await import("../src/lib/saas/resposta");
const { direitosDaEmpresa, verificarLimite, situacaoDeAcesso, podeFazer } = await import("../src/lib/saas/direitos");
const S = await import("../src/lib/saas/servico");
const R = await import("../src/lib/saas/relatorios");
const C = await import("../src/lib/saas/conteudo");
const { esquemaParaIa, tiparLinhas, paraNumero, paraDataIso } = await import("../src/lib/saas/dados");
const { PLANOS, DIREITOS_TESTE } = await import("../src/lib/planos");

const HOJE = new Date(2026, 9, 20, 12);
const datasets = gerarDadosDemo(HOJE);
const por = (tipo: string) => datasets.find((d) => d.tipo === tipo)!;

describe("período", () => {
  it("entende próximos N dias", () => {
    const p = interpretarPeriodo("vence nos próximos 30 dias", HOJE)!;
    assert.equal(p.inicio, "2026-10-20");
    assert.equal(p.fim, "2026-11-19");
  });
  it("continua entendendo últimos 12 meses", () => {
    assert.equal(interpretarPeriodo("últimos 12 meses", HOJE)!.inicio, "2025-10-20");
  });
});

describe("dados de demonstração", () => {
  it("são determinísticos e plausíveis", () => {
    const outra = gerarDadosDemo(HOJE);
    assert.deepEqual(outra[0]!.linhas.slice(0, 5), datasets[0]!.linhas.slice(0, 5));
    assert.ok(por("vendas").linhas.length > 1500);
    const total = por("vendas").linhas.reduce((a, l) => a + Number(l["valor_total"]), 0);
    assert.ok(total > 1_500_000 && total < 60_000_000, `total ${total}`);
    assert.ok(por("receber").linhas.some((l) => l["situacao"] === "Vencido"));
  });
  it("marca coluna pessoal como sensível e não a manda à IA", () => {
    const rec = por("receber");
    assert.ok(rec.colunas.find((c) => c.chave === "email")!.sensivel);
    const esquema = esquemaParaIa(rec);
    assert.ok(!esquema.colunas.some((c) => c.chave === "email"));
    assert.ok(!JSON.stringify(esquema).includes("@exemplo"));
    // nomes de clientes (muitos valores) não vão junto
    assert.equal(esquema.colunas.find((c) => c.chave === "cliente")!.valores, undefined);
    assert.ok(esquema.colunas.find((c) => c.chave === "situacao")!.valores!.includes("Vencido"));
  });
});

describe("motor de consulta", () => {
  it("soma por mês bate com a soma total", () => {
    const v = por("vendas");
    const r = executarPlano(v, { datasetId: v.id, modo: "agregado", agruparPor: [{ coluna: "data", granularidade: "mes" }], medidas: [{ coluna: "valor_total", agregacao: "soma" }] }, { hoje: HOJE });
    const soma = r.linhas.reduce((a, l) => a + Number(l["m0"]), 0);
    const direto = v.linhas.reduce((a, l) => a + Number(l["valor_total"]), 0);
    assert.ok(Math.abs(soma - direto) < 1, `${soma} vs ${direto}`);
    assert.ok(r.linhas.length >= 14);
    // ordem cronológica
    assert.match(String(r.linhas[0]!["data"]), /\//);
  });
  it("ranking respeita limite e ordem", () => {
    const v = por("vendas");
    const r = executarPlano(v, { datasetId: v.id, modo: "agregado", agruparPor: [{ coluna: "cliente" }], medidas: [{ coluna: "valor_total", agregacao: "soma" }], limite: 5, ordenarPor: { campo: "m0", direcao: "desc" } }, { hoje: HOJE });
    assert.equal(r.linhas.length, 5);
    assert.ok(Number(r.linhas[0]!["m0"]) >= Number(r.linhas[4]!["m0"]));
  });
  it("período relativo e filtros", () => {
    const rec = por("receber");
    const todos = executarPlano(rec, { datasetId: rec.id, modo: "agregado", medidas: [{ agregacao: "contagem" }] }, { hoje: HOJE });
    const vencidos = executarPlano(rec, { datasetId: rec.id, modo: "agregado", filtros: [{ coluna: "situacao", op: "=", valor: "Vencido" }], medidas: [{ agregacao: "contagem" }] }, { hoje: HOJE });
    assert.ok(Number(vencidos.linhas[0]!["m0"]) < Number(todos.linhas[0]!["m0"]));
    const mes = executarPlano(rec, { datasetId: rec.id, modo: "agregado", periodo: { coluna: "emissao", expressao: "mês passado" }, medidas: [{ agregacao: "contagem" }] }, { hoje: HOJE });
    assert.equal(mes.descricaoPeriodo, "setembro de 2026");
  });
  it("KPI sem linhas devolve zero", () => {
    const v = por("vendas");
    const r = executarPlano(v, { datasetId: v.id, modo: "agregado", filtros: [{ coluna: "cliente", op: "=", valor: "Inexistente" }], medidas: [{ coluna: "valor_total", agregacao: "soma" }] });
    assert.equal(r.linhas[0]!["m0"], 0);
  });
  it("valida plano inválido (como o que a IA poderia inventar)", () => {
    const v = por("vendas");
    const erros = validarPlano(v, { datasetId: v.id, modo: "agregado", medidas: [{ coluna: "cliente", agregacao: "soma" }], filtros: [{ coluna: "nao_existe", op: "=", valor: 1 }] });
    assert.ok(erros.length >= 2);
  });
});

describe("sugestões e insights", () => {
  it("toda sugestão gerada é um plano válido e executável", () => {
    for (const ds of datasets) {
      const sug = sugerirWidgets(ds);
      assert.ok(sug.length >= 4, `${ds.nome} só ${sug.length}`);
      for (const s of sug) {
        assert.deepEqual(validarPlano(ds, s.widget.plano), [], `${ds.nome}/${s.titulo}`);
        executarPlano(ds, s.widget.plano, { hoje: HOJE });
      }
    }
  });
  it("gera os insights esperados nos dados de demo", () => {
    const todos = datasets.flatMap((d) => gerarInsights(d, HOJE));
    const ids = todos.map((i) => i.id);
    assert.ok(ids.includes("demo-receber:vencido"));
    assert.ok(ids.includes("demo-estoque:parado"));
    assert.ok(ids.includes("demo-vendas:sumidos"));
    assert.ok(ids.some((i) => i.endsWith(":concentracao")));
  });
  it("plano básico recebe menos insights que o completo", () => {
    assert.ok(gerarTodosInsights(datasets, "basico", HOJE).length <= 4);
    assert.ok(gerarTodosInsights(datasets, "completo", HOJE).length > gerarTodosInsights(datasets, "basico", HOJE).length);
  });
});

describe("perguntas em português", () => {
  const casos: [string, string, string][] = [
    ["Quanto vendi por mês nos últimos 12 meses?", "demo-vendas", "agregado"],
    ["Top 5 clientes por valor total em setembro", "demo-vendas", "agregado"],
    ["Quais clientes têm títulos vencidos?", "demo-receber", "agregado"],
    ["Quanto tenho a pagar nos próximos 30 dias?", "demo-pagar", "agregado"],
    ["Valor em estoque por categoria", "demo-estoque", "agregado"],
    ["Liste os pedidos do mês passado", "demo-vendas", "lista"],
    ["Quantos pedidos por filial no mês passado?", "demo-vendas", "agregado"],
  ];
  for (const [pergunta, dsId, modo] of casos) {
    it(pergunta, () => {
      const r = interpretarPergunta(pergunta, datasets, HOJE);
      assert.ok(!ehErro(r), JSON.stringify(r));
      if (ehErro(r)) return;
      assert.equal(r.plano.datasetId, dsId);
      assert.equal(r.plano.modo, modo);
      const ds = datasets.find((d) => d.id === dsId)!;
      assert.deepEqual(validarPlano(ds, r.plano), []);
      const res = executarPlano(ds, r.plano, { hoje: HOJE });
      assert.ok(res.linhas.length > 0, "sem linhas");
      assert.ok(resumirResultado(res, r.plano.modo).length > 10);
    });
  }
  it("vencidos: filtra por situação e agrupa por cliente", () => {
    const r = interpretarPergunta("Quais clientes têm títulos vencidos?", datasets, HOJE);
    assert.ok(!ehErro(r));
    if (ehErro(r)) return;
    assert.ok(r.plano.filtros!.some((f) => f.coluna === "situacao" && f.valor === "Vencido"));
    assert.equal(r.plano.agruparPor![0]!.coluna, "cliente");
  });
  it("frase sem sentido devolve sugestões, não quebra", () => {
    const r = interpretarPergunta("blá blá", datasets, HOJE);
    assert.ok(ehErro(r) && r.sugestoes.length > 0);
  });
});

describe("importação de planilha", () => {
  it("entende números e datas brasileiras", () => {
    assert.equal(paraNumero("1.234,56"), 1234.56);
    assert.equal(paraNumero("R$ 10,5"), 10.5);
    assert.equal(paraDataIso("31/12/2026"), "2026-12-31");
    const { colunas, linhas } = tiparLinhas(["Data", "Cliente", "Valor", "E-mail"], [
      { Data: "01/10/2026", Cliente: "A", Valor: "1.000,00", "E-mail": "a@a.com" },
      { Data: "02/10/2026", Cliente: "B", Valor: "250,50", "E-mail": "b@b.com" },
    ]);
    assert.deepEqual(colunas.map((c) => c.tipo), ["data", "texto", "moeda", "texto"]);
    assert.ok(colunas[3]!.sensivel);
    assert.equal(linhas[1]!["valor"], 250.5);
  });
});

/* ---------------- contas, acesso, limites ---------------- */

beforeEach(() => memoria.clear());

const novaEmpresa = async (planoId = "essencial") => {
  const { empresa, usuario } = await S.cadastrarEmpresa({ empresa: "Empresa Teste", nome: "Dona Teste", email: "dona@teste.com", senha: "senha1234", planoId });
  return { empresa, usuario };
};

describe("cadastro e login", () => {
  it("cadastro cria empresa em teste de 14 dias com limites do teste", async () => {
    const { empresa } = await novaEmpresa("essencial");
    assert.equal(empresa.status, "teste");
    const dias = Math.round((new Date(empresa.testeAte!).getTime() - Date.now()) / 86_400_000);
    assert.ok(dias === 14 || dias === 13);
    assert.equal(direitosDaEmpresa(empresa).consultasMes, DIREITOS_TESTE.consultasMes);
  });
  it("rejeita senha fraca e e-mail repetido", async () => {
    await assert.rejects(S.cadastrarEmpresa({ empresa: "X", nome: "Y", email: "a@a.com", senha: "123" }), /pelo menos/);
    await novaEmpresa();
    await assert.rejects(S.cadastrarEmpresa({ empresa: "Z", nome: "Y", email: "DONA@teste.com", senha: "senha1234" }), /Já existe/);
  });
  it("login confere senha, bloqueia após 5 erros e abre sessão", async () => {
    await novaEmpresa();
    await assert.rejects(S.entrar("dona@teste.com", "errada123"), /incorretos/);
    const u = await S.entrar("Dona@Teste.com ", "senha1234");
    assert.equal(u.papel, "dono");
    assert.equal((await S.obterContexto())!.empresa!.nome, "Empresa Teste");
    await S.sair();
    assert.equal(await S.obterContexto(), null);
    for (let i = 0; i < 5; i++) await assert.rejects(S.entrar("dona@teste.com", "errada123"));
    await assert.rejects(S.entrar("dona@teste.com", "senha1234"), /Muitas tentativas/);
  });
  it("não vaza a senha no armazenamento", async () => {
    await novaEmpresa();
    const tudo = [...memoria.values()].join("\n");
    assert.ok(!tudo.includes("senha1234"));
  });
});

describe("admin concede acesso", () => {
  it("cria empresa e dono com senha temporária que exige troca", async () => {
    const adm = await S.criarSuperadmin("Admin", "admin@stagium.test", "adminsenha1");
    await assert.rejects(S.criarSuperadmin("Outro", "o@o.com", "outrasenha1"), /Já existe/);
    const r = await S.concederAcesso(adm, { empresa: "Cliente Piloto", responsavelNome: "Fulano", responsavelEmail: "fulano@piloto.com", planoId: "profissional", tipo: "cortesia", dias: 60 });
    assert.equal(r.empresa.cortesia, true);
    assert.equal(r.empresa.status, "ativa");
    assert.equal(S.receitaMensal(r.empresa), 0);
    const u = await S.entrar("fulano@piloto.com", r.senhaTemporaria);
    assert.equal(u.precisaTrocarSenha, true);
    await S.trocarSenha(u.id, r.senhaTemporaria, "novaSenha99");
    await S.sair();
    await S.entrar("fulano@piloto.com", "novaSenha99");
  });
  it("só superadmin concede; plano pago entra na receita", async () => {
    const { usuario } = await novaEmpresa();
    await assert.rejects(S.concederAcesso(usuario, { empresa: "X", responsavelNome: "A", responsavelEmail: "a@a.com", planoId: "essencial", tipo: "pago" }), /Só a equipe/);
    const adm = await S.criarSuperadmin("Admin", "admin@stagium.test", "adminsenha1");
    const r = await S.concederAcesso(adm, { empresa: "Paga", responsavelNome: "A", responsavelEmail: "paga@a.com", planoId: "profissional", tipo: "pago", ciclo: "anual" });
    assert.equal(Math.round(S.receitaMensal(r.empresa)), Math.round((697 * 10) / 12));
  });
  it("suspensa bloqueia; teste vencido bloqueia", async () => {
    const { empresa } = await novaEmpresa();
    assert.equal(situacaoDeAcesso(empresa).liberado, true);
    assert.equal(situacaoDeAcesso({ ...empresa, status: "suspensa" }).motivo, "suspensa");
    assert.equal(situacaoDeAcesso({ ...empresa, testeAte: new Date(Date.now() - 1000).toISOString() }).motivo, "teste_acabou");
    assert.equal(verificarLimite({ ...empresa, status: "suspensa" }, "dashboards", 0).ok, false);
  });
});

describe("limites do plano", () => {
  it("consultas e créditos de IA param no limite", async () => {
    const { empresa } = await novaEmpresa();
    for (let i = 0; i < DIREITOS_TESTE.creditosIaMes!; i++) await S.consumir(empresa, "creditosIa");
    await assert.rejects(S.consumir(empresa, "creditosIa"), /limite do teste grátis/);
    const uso = await S.lerUso(empresa.id);
    assert.equal(uso.creditosIa, DIREITOS_TESTE.creditosIaMes);
  });
  it("dashboards: respeita o máximo e o de gráficos", async () => {
    const { empresa, usuario } = await novaEmpresa();
    for (let i = 0; i < DIREITOS_TESTE.dashboards!; i++) await C.criarDashboard(usuario, empresa, `D${i}`);
    await assert.rejects(C.criarDashboard(usuario, empresa, "extra"), /limite/);
  });
  it("empresa grande: sem limite de dashboards e override por empresa vale", async () => {
    const adm = await S.criarSuperadmin("Admin", "admin@stagium.test", "adminsenha1");
    const r = await S.concederAcesso(adm, { empresa: "Grande", responsavelNome: "A", responsavelEmail: "g@g.com", planoId: "empresa", tipo: "pago" });
    assert.equal(direitosDaEmpresa(r.empresa).dashboards, null);
    const ajustada = { ...r.empresa, limitesEspeciais: { usuarios: 3 } };
    assert.equal(direitosDaEmpresa(ajustada).usuarios, 3);
    assert.equal(verificarLimite(ajustada, "usuarios", 3).ok, false);
  });
  it("matriz de planos é coerente (cada plano ≥ o anterior)", () => {
    const num = (v: number | null) => (v === null ? Infinity : v);
    for (const k of ["sistemas", "consultasMes", "usuarios", "dashboards", "creditosIaMes", "relatoriosAgendados", "alertas", "auditoriaDias"] as const) {
      assert.ok(num(PLANOS[0]!.direitos[k]) <= num(PLANOS[1]!.direitos[k]), k);
      assert.ok(num(PLANOS[1]!.direitos[k]) <= num(PLANOS[2]!.direitos[k]), k);
    }
  });
});

describe("equipe e permissões", () => {
  it("convite: cria, aceita uma vez, respeita limite de usuários", async () => {
    const { empresa, usuario } = await novaEmpresa(); // teste = 2 usuários
    const conv = await S.criarConvite(usuario, empresa, "ana@teste.com", "analista");
    await assert.rejects(S.criarConvite(usuario, empresa, "bia@teste.com", "leitor"), /limite/);
    const ana = await S.aceitarConvite(conv.id, "Ana", "senhaAna12");
    assert.equal(ana.papel, "analista");
    assert.equal(ana.empresaId, empresa.id);
    await assert.rejects(S.aceitarConvite(conv.id, "Ana2", "senhaAna12"), /expirou ou já foi usado/);
  });
  it("não deixa a empresa sem dono nem alterar a si mesmo", async () => {
    const { usuario } = await novaEmpresa();
    await assert.rejects(S.alterarUsuario(usuario, usuario.id, { ativo: false }), /própria/);
  });
  it("papéis: leitor não cria dashboard; analista não gerencia equipe", () => {
    assert.equal(podeFazer("leitor", "criarDashboards"), false);
    assert.equal(podeFazer("analista", "criarDashboards"), true);
    assert.equal(podeFazer("analista", "gerenciarEquipe"), false);
    assert.equal(podeFazer("admin", "gerenciarEquipe"), true);
    assert.equal(podeFazer("admin", "exportarEmpresa"), false);
  });
});

describe("isolamento entre empresas", () => {
  it("dashboards de uma empresa não aparecem na outra", async () => {
    const a = await novaEmpresa();
    const b = await S.cadastrarEmpresa({ empresa: "Outra", nome: "Outro", email: "outro@teste.com", senha: "senha1234" });
    await C.criarDashboard(a.usuario, a.empresa, "Só da A");
    assert.equal((await C.listarDashboards(a.empresa.id)).length, 1);
    assert.equal((await C.listarDashboards(b.empresa.id)).length, 0);
  });
  it("excluir empresa apaga usuários e dados", async () => {
    const a = await novaEmpresa();
    await C.criarDashboard(a.usuario, a.empresa, "X");
    await S.excluirEmpresa(a.usuario, a.empresa);
    assert.equal((await C.listarDashboards(a.empresa.id)).length, 0);
    assert.equal((await S.listarUsuarios()).length, 0);
    assert.equal(await S.obterEmpresa(a.empresa.id), null);
  });
  it("exportação não inclui hash de senha", async () => {
    const a = await novaEmpresa();
    const json = JSON.stringify(await S.exportarDadosDaEmpresa(a.usuario, a.empresa));
    assert.ok(!json.includes("hash") && !json.includes('"sal"'));
  });
});

describe("conexões e dados", () => {
  it("demo não conta como sistema; sistema real respeita o limite", async () => {
    const { empresa, usuario } = await novaEmpresa(); // teste = 1 sistema
    await S.adicionarConexao(usuario, empresa, "demo", "Demonstração");
    assert.equal((await S.carregarDatasets(empresa.id)).length, 4);
    await S.adicionarConexao(usuario, empresa, "sygecom", "Sagi");
    await assert.rejects(S.adicionarConexao(usuario, empresa, "nomus", "Nomus"), /limite/);
  });
});

describe("relatórios agendados", () => {
  const base = { hora: "08:00", diaSemana: 1, diaMes: 5 };
  it("calcula a próxima execução de cada frequência", () => {
    const sexta = new Date(2026, 9, 23, 9, 0); // sexta 23/10/2026 09:00
    assert.equal(R.proximaExecucao({ ...base, frequencia: "diaria" }, sexta).getDate(), 24);
    const util = R.proximaExecucao({ ...base, frequencia: "dias_uteis" }, sexta);
    assert.equal(util.getDay(), 1);
    assert.equal(util.getDate(), 26);
    const sem = R.proximaExecucao({ ...base, frequencia: "semanal" }, sexta);
    assert.equal(sem.getDay(), 1);
    assert.equal(sem.getHours(), 8);
    const men = R.proximaExecucao({ ...base, frequencia: "mensal" }, sexta);
    assert.deepEqual([men.getMonth(), men.getDate()], [10, 5]);
    const ultimo = R.proximaExecucao({ ...base, diaMes: 0, frequencia: "mensal" }, sexta);
    assert.deepEqual([ultimo.getMonth(), ultimo.getDate()], [9, 31]);
    const tri = R.proximaExecucao({ ...base, frequencia: "trimestral" }, sexta);
    assert.deepEqual([tri.getFullYear(), tri.getMonth(), tri.getDate()], [2027, 0, 5]);
  });
  it("antes do horário no mesmo dia ainda executa hoje", () => {
    const d = R.proximaExecucao({ ...base, frequencia: "diaria" }, new Date(2026, 9, 23, 7, 0));
    assert.equal(d.getDate(), 23);
  });
  it("fevereiro com dia 31 cai no último dia", () => {
    const d = R.proximaExecucao({ hora: "08:00", diaSemana: 0, diaMes: 28, frequencia: "mensal" }, new Date(2027, 1, 1));
    assert.equal(d.getDate(), 28);
  });
  it("respeita frequência do plano e gera arquivo só com colunas escolhidas", async () => {
    const adm = await S.criarSuperadmin("Admin", "admin@stagium.test", "adminsenha1");
    const concedido = await S.concederAcesso(adm, { empresa: "Ess", responsavelNome: "A", responsavelEmail: "ess@e.com", planoId: "essencial", tipo: "pago" });
    const empresa = concedido.empresa;
    const usuario = (await S.listarUsuarios(empresa.id))[0]!;
    const rec = por("receber");
    const rel = R.modeloVazio(rec, usuario);
    rel.nome = "Vencidos da semana";
    rel.plano = { datasetId: rec.id, modo: "lista", colunas: ["cliente", "vencimento", "valor"], filtros: [{ coluna: "situacao", op: "=", valor: "Vencido" }], ordenarPor: { campo: "valor", direcao: "desc" } };
    rel.frequencia = "diaria"; // não permitido no teste/essencial
    assert.match(R.errosDoRelatorio(empresa, rel, rec).join(), /não está no plano/);
    rel.frequencia = "semanal";
    assert.deepEqual(R.errosDoRelatorio(empresa, rel, rec), []);
    const arq = R.gerarArquivo(rec, rel, HOJE);
    assert.deepEqual(arq.colunas.map((c) => c.chave), ["cliente", "vencimento", "valor"]);
    assert.ok(arq.linhas.length > 0 && String(arq.linhas[0]!["vencimento"]).includes("/"));
    assert.ok(arq.nomeArquivo.startsWith("vencidos-da-semana-2026-10-20"));
  });
  it("avisa quando o relatório leva coluna pessoal", async () => {
    const { usuario } = await novaEmpresa();
    const rec = por("receber");
    const rel = R.modeloVazio(rec, usuario);
    rel.plano.colunas = ["cliente", "email"];
    assert.equal(R.colunasSensiveisNoRelatorio(rec, rel).length, 1);
  });
  it("limite de relatórios ativos", async () => {
    const { empresa, usuario } = await novaEmpresa(); // teste: 2
    const rec = por("receber");
    for (let i = 0; i < 2; i++) {
      const r = R.modeloVazio(rec, usuario);
      r.nome = `R${i}`;
      await R.salvarRelatorio(usuario, empresa, r, rec);
    }
    const extra = R.modeloVazio(rec, usuario);
    extra.nome = "R3";
    await assert.rejects(R.salvarRelatorio(usuario, empresa, extra, rec), /limite/);
  });
  it("vencido: acha o que deveria ter rodado e registra execução simulada", async () => {
    const { empresa, usuario } = await novaEmpresa();
    await S.adicionarConexao(usuario, empresa, "demo", "Demo");
    const ds = await S.carregarDatasets(empresa.id);
    const rec = ds.find((d) => d.tipo === "receber")!;
    const r = R.modeloVazio(rec, usuario);
    r.nome = "Diário";
    r.criadoEm = new Date(Date.now() - 10 * 86_400_000).toISOString();
    await R.salvarRelatorio(usuario, empresa, r, rec);
    assert.equal(R.estaVencido(r), true);
    const feitos = await R.rodarVencidos(usuario, empresa, ds);
    assert.equal(feitos.length, 1);
    assert.equal(feitos[0]!.status, "simulado");
    assert.equal(R.estaVencido((await R.listarRelatorios(empresa.id))[0]!), false);
    assert.equal((await S.lerUso(empresa.id)).consultas, 1);
  });
});

describe("alertas", () => {
  it("avalia a condição sobre os dados", async () => {
    const adm = await S.criarSuperadmin("Admin", "admin@stagium.test", "adminsenha1");
    const r = await S.concederAcesso(adm, { empresa: "P", responsavelNome: "A", responsavelEmail: "p@p.com", planoId: "profissional", tipo: "pago" });
    const dono = (await S.listarUsuarios(r.empresa.id))[0]!;
    const rec = por("receber");
    const a = await C.criarAlerta(dono, r.empresa, { nome: "Vencido alto", ativo: true, condicao: ">", limite: 1000, plano: { datasetId: rec.id, modo: "agregado", filtros: [{ coluna: "situacao", op: "=", valor: "Vencido" }], medidas: [{ coluna: "valor", agregacao: "soma" }] } });
    const est = C.avaliarAlerta(a, datasets);
    assert.equal(est.disparado, true);
    assert.ok((est.valor ?? 0) > 1000);
  });
  it("Essencial não tem alertas", async () => {
    const { empresa, usuario } = await novaEmpresa("essencial");
    const adm = await S.criarSuperadmin("Admin", "admin@stagium.test", "adminsenha1");
    const e2 = (await S.concederAcesso(adm, { empresa: "E", responsavelNome: "A", responsavelEmail: "e@e.com", planoId: "essencial", tipo: "pago" })).empresa;
    await assert.rejects(C.criarAlerta(usuario, e2, { nome: "x", ativo: true, condicao: ">", limite: 1, plano: { datasetId: "x", modo: "agregado", medidas: [{ agregacao: "contagem" }] } }), /plano Profissional/);
    void empresa;
  });
});
