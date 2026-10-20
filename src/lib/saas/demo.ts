/**
 * Dados de demonstração: uma distribuidora fictícia, gerada por sorteio com semente fixa.
 * Serve para testar o painel sem ERP e para a empresa explorar antes de conectar o dela.
 * Nomes, valores e e-mails são inventados.
 */
import type { ColunaDados, Dataset, Linha } from "./tipos";

function prng(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const somarDias = (base: Date, dias: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d;
};
const arred = (n: number) => Math.round(n * 100) / 100;

const CLIENTES = [
  "Mercadinho São José", "Empório Boa Vista", "Supermercado Estrela", "Armazém do Vale",
  "Padaria Pão Quente", "Restaurante Sabor Caseiro", "Hotel Recanto Verde", "Lanchonete Ponto Certo",
  "Rede Compre Bem", "Atacado Central", "Mini Mercado Aurora", "Cantina Dona Rosa",
  "Mercado Três Irmãos", "Bar do Largo", "Pizzaria Forno a Lenha", "Clube Atlético Municipal",
  "Escola Pequeno Aprendiz", "Hospital Santa Clara", "Cozinha Industrial Nutri", "Café Esquina Doce",
  "Quitanda da Praça", "Sacolão Bom Preço", "Churrascaria Gaúcha", "Buffet Festa Feliz",
  "Mercearia Nova Era", "Casa de Carnes Real", "Pousada Mar Azul", "Lojão do Povo",
  "Distribuidora Norte Sul", "Minimercado Esperança", "Empório Grãos & Cia", "Restaurante Raízes",
  "Sorveteria Gelato Bom", "Frigorífico Pampa", "Mercado Sol Nascente", "Cooperativa Vida Boa",
  "Refeitório Metalúrgica Alfa", "Lanches da Vila", "Supermercado Preço Justo", "Tabacaria Central",
];
const VENDEDORES = ["Carla Mendes", "Rafael Souza", "Juliana Prado", "Marcos Teixeira", "Patrícia Lima"];
const FILIAIS = ["Matriz", "Filial Norte", "Filial Sul"];
const PAGAMENTOS = ["Boleto", "Pix", "Cartão", "Prazo 30 dias"];
const PRODUTOS: [string, string, number, number][] = [
  ["Água mineral 500 ml (fardo 12)", "Bebidas", 14, 22],
  ["Refrigerante cola 2 L (fardo 6)", "Bebidas", 28, 41],
  ["Suco de uva integral 1 L", "Bebidas", 9, 15],
  ["Cerveja lata 350 ml (cx 12)", "Bebidas", 33, 48],
  ["Arroz tipo 1 5 kg", "Mercearia", 21, 31],
  ["Feijão carioca 1 kg (fardo 10)", "Mercearia", 52, 78],
  ["Óleo de soja 900 ml (cx 20)", "Mercearia", 96, 131],
  ["Açúcar refinado 1 kg (fardo 10)", "Mercearia", 34, 49],
  ["Café torrado 500 g (fardo 10)", "Mercearia", 118, 162],
  ["Macarrão espaguete 500 g (fardo 20)", "Mercearia", 41, 60],
  ["Detergente líquido 500 ml (cx 24)", "Limpeza", 29, 44],
  ["Água sanitária 2 L (fardo 6)", "Limpeza", 17, 26],
  ["Desinfetante 1 L (cx 12)", "Limpeza", 36, 54],
  ["Sabão em pó 1 kg (cx 10)", "Limpeza", 62, 91],
  ["Papel higiênico 12 rolos (fardo 8)", "Higiene", 70, 102],
  ["Sabonete 90 g (cx 36)", "Higiene", 38, 57],
  ["Creme dental 90 g (cx 12)", "Higiene", 27, 40],
  ["Queijo muçarela 4 kg (peça)", "Frios", 142, 196],
  ["Presunto fatiado 3 kg", "Frios", 75, 108],
  ["Iogurte natural 170 g (cx 24)", "Frios", 31, 47],
];
const BANCOS = ["Banco do Brasil", "Bradesco", "Itaú", "Caixa", "Sicredi"];
const FORNECEDORES: [string, string][] = [
  ["Indústria Alimentos Vale Verde", "Mercadorias"], ["Bebidas Serra Azul", "Mercadorias"],
  ["Limpeza Total Atacado", "Mercadorias"], ["Transportes Rápido Sul", "Frete"],
  ["Energia Elétrica Regional", "Despesas fixas"], ["Imobiliária Centro (aluguel)", "Despesas fixas"],
  ["Telecom Conecta", "Despesas fixas"], ["Combustíveis Estrada Boa", "Frota"],
  ["Oficina Mecânica Torque", "Frota"], ["Contabilidade Exata", "Serviços"],
  ["Seguradora Proteção", "Serviços"], ["Embalagens Pack Mais", "Mercadorias"],
];

function escolher<T>(r: () => number, lista: T[], pesos?: number[]): T {
  if (!pesos) return lista[Math.floor(r() * lista.length)]!;
  const total = pesos.reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (let i = 0; i < lista.length; i++) {
    x -= pesos[i]!;
    if (x <= 0) return lista[i]!;
  }
  return lista[lista.length - 1]!;
}

const emailDe = (nome: string) =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") +
  "@exemplo.com.br";

function vendas(hoje: Date): Dataset {
  const r = prng(20261019);
  const colunas: ColunaDados[] = [
    { chave: "data", titulo: "Data", tipo: "data" },
    { chave: "pedido", titulo: "Pedido", tipo: "texto" },
    { chave: "cliente", titulo: "Cliente", tipo: "texto" },
    { chave: "vendedor", titulo: "Vendedor", tipo: "texto" },
    { chave: "produto", titulo: "Produto", tipo: "texto" },
    { chave: "categoria", titulo: "Categoria", tipo: "texto" },
    { chave: "filial", titulo: "Filial", tipo: "texto" },
    { chave: "pagamento", titulo: "Forma de pagamento", tipo: "texto" },
    { chave: "quantidade", titulo: "Quantidade", tipo: "numero" },
    { chave: "preco", titulo: "Preço unitário", tipo: "moeda" },
    { chave: "valor_total", titulo: "Valor total", tipo: "moeda" },
    { chave: "situacao", titulo: "Situação", tipo: "texto" },
  ];
  // clientes grandes pesam mais; o último deixa de comprar há ~70 dias (para o insight de perda)
  const pesos = CLIENTES.map((_, i) => (i < 3 ? 14 : i < 8 ? 4 : 1));
  const perdido = CLIENTES[5]!;
  const linhas: Linha[] = [];
  const dias = 430;
  let numero = 1000;
  for (let d = dias; d >= 0; d--) {
    const dia = somarDias(hoje, -d);
    const dow = dia.getDay();
    if (dow === 0) continue;
    const crescimento = 1 + ((dias - d) / dias) * 0.35;
    const sazonal = 1 + 0.25 * Math.sin(((dia.getMonth() + 1) / 12) * Math.PI * 2 - 1.2);
    const n = Math.round((dow === 6 ? 3 : 7) * crescimento * sazonal * (0.6 + r() * 0.9));
    for (let k = 0; k < n; k++) {
      let cliente = escolher(r, CLIENTES, pesos);
      if (cliente === perdido && d < 70) cliente = CLIENTES[1]!;
      const [produto, categoria, , tabela] = escolher(r, PRODUTOS);
      const qtd = Math.max(1, Math.round(1 + r() * (cliente === CLIENTES[0] ? 36 : 16)));
      const preco = arred(tabela * (0.94 + r() * 0.1));
      const sit = r() < 0.035 ? "Cancelado" : d < 3 && r() < 0.3 ? "Pendente" : "Faturado";
      linhas.push({
        data: iso(dia),
        pedido: `PV-${++numero}`,
        cliente,
        vendedor: VENDEDORES[(CLIENTES.indexOf(cliente) + dia.getDate()) % VENDEDORES.length]!,
        produto,
        categoria,
        filial: escolher(r, FILIAIS, [6, 3, 2]),
        pagamento: escolher(r, PAGAMENTOS, [4, 4, 2, 3]),
        quantidade: qtd,
        preco,
        valor_total: arred(qtd * preco),
        situacao: sit,
      });
    }
  }
  return {
    id: "demo-vendas",
    nome: "Vendas",
    descricao: "Pedidos de venda dos últimos 14 meses (dados fictícios).",
    tipo: "vendas",
    fonte: "demo",
    colunas,
    linhas,
    atualizadoEm: hoje.toISOString(),
  };
}

function receber(hoje: Date): Dataset {
  const r = prng(777);
  const colunas: ColunaDados[] = [
    { chave: "documento", titulo: "Documento", tipo: "texto" },
    { chave: "cliente", titulo: "Cliente", tipo: "texto" },
    { chave: "email", titulo: "E-mail de cobrança", tipo: "texto", sensivel: true },
    { chave: "emissao", titulo: "Emissão", tipo: "data" },
    { chave: "vencimento", titulo: "Vencimento", tipo: "data" },
    { chave: "valor", titulo: "Valor", tipo: "moeda" },
    { chave: "valor_pago", titulo: "Valor pago", tipo: "moeda" },
    { chave: "data_pagto", titulo: "Data do pagamento", tipo: "data" },
    { chave: "banco", titulo: "Banco", tipo: "texto" },
    { chave: "situacao", titulo: "Situação", tipo: "texto" },
  ];
  const linhas: Linha[] = [];
  const pesos = CLIENTES.map((_, i) => (i < 3 ? 10 : i < 8 ? 3 : 1));
  for (let i = 0; i < 640; i++) {
    const emissao = somarDias(hoje, -Math.floor(r() * 300) + 20);
    const venc = somarDias(emissao, escolher(r, [15, 30, 45], [2, 6, 2]));
    const cliente = escolher(r, CLIENTES, pesos);
    const valor = arred(300 + Math.pow(r(), 2.2) * 24000);
    // clientes específicos pagam atrasado: gera "vencido" concentrado
    const devedor = cliente === CLIENTES[3] || cliente === CLIENTES[9];
    const pago = venc < hoje ? r() > (devedor ? 0.55 : 0.1) : r() > 0.9;
    const atraso = pago ? Math.floor(r() * (devedor ? 25 : 6)) - 2 : 0;
    const dataPagto = pago ? somarDias(venc, atraso) : null;
    const pagoEfetivo = dataPagto && dataPagto <= hoje;
    linhas.push({
      documento: `NF-${20000 + i}`,
      cliente,
      email: emailDe(cliente),
      emissao: iso(emissao),
      vencimento: iso(venc),
      valor,
      valor_pago: pagoEfetivo ? valor : 0,
      data_pagto: pagoEfetivo ? iso(dataPagto!) : null,
      banco: escolher(r, BANCOS, [4, 3, 3, 2, 1]),
      situacao: pagoEfetivo ? "Pago" : venc < hoje ? "Vencido" : "Em aberto",
    });
  }
  return {
    id: "demo-receber",
    nome: "Contas a receber",
    descricao: "Títulos a receber, pagos, em aberto e vencidos (dados fictícios).",
    tipo: "receber",
    fonte: "demo",
    colunas,
    linhas,
    atualizadoEm: hoje.toISOString(),
  };
}

function pagar(hoje: Date): Dataset {
  const r = prng(4242);
  const colunas: ColunaDados[] = [
    { chave: "fornecedor", titulo: "Fornecedor", tipo: "texto" },
    { chave: "categoria", titulo: "Categoria", tipo: "texto" },
    { chave: "emissao", titulo: "Emissão", tipo: "data" },
    { chave: "vencimento", titulo: "Vencimento", tipo: "data" },
    { chave: "valor", titulo: "Valor", tipo: "moeda" },
    { chave: "data_pagto", titulo: "Data do pagamento", tipo: "data" },
    { chave: "situacao", titulo: "Situação", tipo: "texto" },
  ];
  const linhas: Linha[] = [];
  for (let i = 0; i < 420; i++) {
    const [fornecedor, categoria] = escolher(r, FORNECEDORES, [8, 6, 4, 4, 3, 3, 2, 3, 2, 2, 1, 3]);
    const emissao = somarDias(hoje, -Math.floor(r() * 330) + 25);
    const venc = somarDias(emissao, escolher(r, [10, 20, 30, 45], [1, 3, 6, 2]));
    const base = categoria === "Mercadorias" ? 9000 : categoria === "Despesas fixas" ? 2600 : 1400;
    const valor = arred(base * (0.5 + r() * 1.1));
    const paga = venc < hoje ? r() > 0.04 : r() > 0.93;
    linhas.push({
      fornecedor,
      categoria,
      emissao: iso(emissao),
      vencimento: iso(venc),
      valor,
      data_pagto: paga ? iso(venc <= hoje ? venc : hoje) : null,
      situacao: paga ? "Pago" : venc < hoje ? "Vencido" : "Em aberto",
    });
  }
  return {
    id: "demo-pagar",
    nome: "Contas a pagar",
    descricao: "Contas a pagar por fornecedor e categoria (dados fictícios).",
    tipo: "pagar",
    fonte: "demo",
    colunas,
    linhas,
    atualizadoEm: hoje.toISOString(),
  };
}

function estoque(hoje: Date): Dataset {
  const r = prng(9001);
  const colunas: ColunaDados[] = [
    { chave: "produto", titulo: "Produto", tipo: "texto" },
    { chave: "categoria", titulo: "Categoria", tipo: "texto" },
    { chave: "filial", titulo: "Filial", tipo: "texto" },
    { chave: "saldo", titulo: "Saldo (unidades)", tipo: "numero" },
    { chave: "custo", titulo: "Custo unitário", tipo: "moeda" },
    { chave: "valor_estoque", titulo: "Valor em estoque", tipo: "moeda" },
    { chave: "preco", titulo: "Preço de venda", tipo: "moeda" },
    { chave: "ultima_saida", titulo: "Última saída", tipo: "data" },
  ];
  const linhas: Linha[] = [];
  for (const [produto, categoria, custo, preco] of PRODUTOS) {
    for (const filial of FILIAIS) {
      const parado = r() < 0.16;
      const saldo = Math.round(parado ? 30 + r() * 140 : 8 + r() * 120);
      linhas.push({
        produto,
        categoria,
        filial,
        saldo,
        custo,
        valor_estoque: arred(saldo * custo),
        preco,
        ultima_saida: iso(somarDias(hoje, -(parado ? 95 + Math.floor(r() * 120) : Math.floor(r() * 25)))),
      });
    }
  }
  return {
    id: "demo-estoque",
    nome: "Estoque",
    descricao: "Saldo e valor em estoque por produto e filial (dados fictícios).",
    tipo: "estoque",
    fonte: "demo",
    colunas,
    linhas,
    atualizadoEm: hoje.toISOString(),
  };
}

export function gerarDadosDemo(hoje = new Date()): Dataset[] {
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
  return [vendas(h), receber(h), pagar(h), estoque(h)];
}
