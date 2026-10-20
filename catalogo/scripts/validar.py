"""Validador da Definition of Done de um sistema do catálogo.

Uso (a partir da raiz do catálogo):
    .venv\\Scripts\\python scripts\\validar.py <slug> [<slug> ...]
    .venv\\Scripts\\python scripts\\validar.py --todos

Sai com código 1 se houver qualquer erro.
"""
import json
import re
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from openapi_spec_validator import validate as validar_openapi

RAIZ = Path(__file__).resolve().parent.parent
TAXO = json.loads((RAIZ / "taxonomia.json").read_text(encoding="utf-8"))

ENTIDADES = {e["nome"] for e in TAXO["entidades"]}
ACOES = {a["nome"]: a for a in TAXO["acoes"]}
for chave, bloco in TAXO.items():
    if chave.startswith("entidades_extensao_"):
        ENTIDADES |= {e["nome"] for e in bloco["itens"]}
    if chave.startswith("acoes_extensao_"):
        ACOES.update({a["nome"]: a for a in bloco["itens"]})
CAMPOS = {c["nome"] for c in TAXO["campos_canonicos"]}
ENUMS = TAXO["enums"]

METODOS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
CHAVES_SISTEMA = [
    "slug", "nome", "categoria", "fornecedor", "descricao_curta", "status", "api", "autenticacao",
    "ambiente_testes", "limites", "webhooks", "erros", "sdks_oficiais", "comercial", "conformidade",
    "esforco_integracao", "casos_uso_negocio", "indice_integrabilidade", "qualidade_doc",
    "monitoramento", "lacunas", "fontes",
]
CHAVES_ENDPOINT = [
    "id", "entidade_canonica", "acao_canonica", "nome_fornecedor", "metodo", "path", "descricao",
    "quando_usar", "auth_requerida", "parametros", "request_exemplo", "response_sucesso", "erros",
    "idempotente", "pre_requisitos", "snippets", "execucao", "confianca", "fonte_url", "data_consulta",
]
TIPOS_AUTH_EXEC = {"header_api_key", "bearer", "basic", "oauth2_client_credentials",
                   "oauth2_refresh_token", "mtls_oauth2", "login_credenciais",
                   "certificado_icp_brasil", "nenhum"}
TIPOS_PAGINACAO = {"offset", "page", "cursor", "versao", "nenhuma"}
# transformações do marcador {credencial|nome} no corpo do login (executores do site e da CLI)
TRANSFORMACOES_LOGIN = {"md5_maiusculo"}
CHAVES_META_CHUNK = [
    "sistema", "categoria", "entidade_canonica", "acao_canonica", "metodo", "path", "id",
    "fonte_url", "data_consulta", "confianca",
]
DATA_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TOOL_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")

SEGREDOS = [
    (re.compile(r"eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}"), "JWT com cara de real"),
    (re.compile(r"-----BEGIN (RSA |EC |ENCRYPTED )?PRIVATE KEY-----"), "chave privada"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS access key"),
    (re.compile(r"\bsk_(live|test)_[A-Za-z0-9]{16,}"), "secret key estilo sk_"),
    (re.compile(r"\$aact_[A-Za-z0-9_\-]{20,}"), "chave Asaas com cara de real"),
    (re.compile(r"\b(ghp|gho|xox[baprs])[-_][A-Za-z0-9-]{20,}"), "token GitHub/Slack"),
]


def snake(nome: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", nome).lower()


def cpf_valido(d: str) -> bool:
    if len(d) != 11 or len(set(d)) == 1:
        return False
    for n in (9, 10):
        s = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        if (s * 10 % 11) % 10 != int(d[n]):
            return False
    return True


class Relatorio:
    def __init__(self, slug):
        self.slug, self.erros, self.avisos = slug, [], []

    def erro(self, msg):
        self.erros.append(msg)

    def aviso(self, msg):
        self.avisos.append(msg)


def carregar_json(caminho: Path, r: Relatorio):
    if not caminho.exists():
        r.erro(f"arquivo ausente: {caminho.name}")
        return None
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        r.erro(f"{caminho.name}: JSON inválido ({e})")
        return None


def validar_sistema(s, r: Relatorio):
    for k in CHAVES_SISTEMA:
        if k not in s:
            r.erro(f"system.json: chave ausente '{k}'")
    if s.get("slug") != r.slug:
        r.erro(f"system.json: slug '{s.get('slug')}' difere da pasta '{r.slug}'")
    if s.get("categoria") not in ENUMS["categoria"]:
        r.erro(f"system.json: categoria inválida '{s.get('categoria')}'")
    if s.get("status") not in ENUMS["status_sistema"]:
        r.erro(f"system.json: status inválido '{s.get('status')}'")
    estilo = (s.get("api") or {}).get("estilo")
    if estilo and estilo not in ENUMS["estilo_api"]:
        r.erro(f"system.json: api.estilo inválido '{estilo}'")
    for t in (s.get("autenticacao") or {}).get("tipos", []):
        if t not in ENUMS["auth"]:
            r.erro(f"system.json: tipo de auth fora do enum '{t}'")
    conf = s.get("conformidade") or {}
    if conf.get("permite_uso_em_produto_terceiro") not in ENUMS["permite_uso_em_produto_terceiro"]:
        r.erro("system.json: conformidade.permite_uso_em_produto_terceiro inválido")
    if not conf.get("termos_uso_url"):
        r.aviso("system.json: conformidade.termos_uso_url vazio")
    if (s.get("comercial") or {}).get("volatil") is not True:
        r.erro("system.json: comercial.volatil deve ser true")
    comp = (s.get("esforco_integracao") or {}).get("complexidade")
    if comp not in ENUMS["complexidade"]:
        r.erro(f"system.json: esforco_integracao.complexidade inválida '{comp}'")
    idx = s.get("indice_integrabilidade") or {}
    comps = idx.get("componentes") or {}
    pesos_esperados = {"documentacao": 20, "sandbox": 15, "autenticacao": 15, "webhooks": 15,
                       "limites_paginacao": 10, "sdks_comunidade": 10, "acesso_sem_barreira": 10, "versionamento": 5}
    soma = 0
    for nome, peso in pesos_esperados.items():
        c = comps.get(nome)
        if not isinstance(c, dict):
            r.erro(f"system.json: componente do índice ausente '{nome}'")
            continue
        p = c.get("pontos")
        if not isinstance(p, (int, float)) or p < 0 or p > peso:
            r.erro(f"system.json: índice.{nome}.pontos fora de 0..{peso}")
        else:
            soma += p
        if not c.get("justificativa"):
            r.erro(f"system.json: índice.{nome} sem justificativa")
    if comps and abs(soma - (idx.get("score") or 0)) > 0.01:
        r.erro(f"system.json: score {idx.get('score')} != soma dos componentes {soma}")
    mon = s.get("monitoramento") or {}
    if mon.get("frequencia_revisao_sugerida") not in ("mensal", "trimestral"):
        r.erro("system.json: monitoramento.frequencia_revisao_sugerida deve ser mensal|trimestral")
    if s.get("status") == "documentado":
        ex = s.get("execucao_auth")
        if not isinstance(ex, dict):
            r.erro("system.json: execucao_auth ausente (necessário para o executor)")
        else:
            if ex.get("tipo") not in TIPOS_AUTH_EXEC:
                r.erro(f"system.json: execucao_auth.tipo inválido '{ex.get('tipo')}'")
            creds = ex.get("credenciais_necessarias")
            if not isinstance(creds, list) or (not creds and ex.get("tipo") != "nenhum"):
                r.erro("system.json: execucao_auth.credenciais_necessarias vazio")
            for c in creds or []:
                for k in ("nome", "rotulo", "segredo", "onde_obter"):
                    if k not in c:
                        r.erro(f"system.json: credencial '{c.get('nome')}' sem '{k}'")
            if "base_url_por_ambiente" not in ex:
                r.erro("system.json: execucao_auth.base_url_por_ambiente ausente")
            if ex.get("tipo") == "login_credenciais":
                log = ex.get("login")
                if not isinstance(log, dict):
                    r.erro("system.json: execucao_auth.login ausente (necessário para login_credenciais)")
                else:
                    for k in ("metodo", "caminho", "corpo", "campo_token"):
                        if not log.get(k):
                            r.erro(f"system.json: execucao_auth.login.{k} ausente")
                    nomes = {c.get("nome") for c in creds or []}
                    achados = [m for val in (log.get("corpo") or {}).values()
                               for m in re.findall(r"\{([a-z0-9_]+)(?:\|([a-z0-9_]+))?\}", str(val))]
                    for m in sorted({nome for nome, _ in achados} - nomes):
                        r.erro(f"system.json: login.corpo usa marcador '{m}' fora de credenciais_necessarias")
                    for t in sorted({t for _, t in achados if t} - TRANSFORMACOES_LOGIN):
                        r.erro(f"system.json: login.corpo usa transformação desconhecida '{t}'")
    fontes = s.get("fontes") or []
    if not fontes:
        r.erro("system.json: fontes[] vazio")
    for f in fontes:
        if not str(f.get("url", "")).startswith("http"):
            r.erro(f"system.json: fonte sem url válida: {f}")
        if not DATA_RE.match(str(f.get("data_consulta", ""))):
            r.erro(f"system.json: fonte sem data_consulta ISO: {f.get('url')}")
    if not isinstance(s.get("lacunas"), list):
        r.erro("system.json: lacunas deve ser lista")
    elif not s["lacunas"]:
        r.aviso("system.json: lacunas[] vazio — confirme que realmente não há buracos")


def validar_endpoints(doc, sistema, r: Relatorio):
    if not isinstance(doc, dict) or "endpoints" not in doc:
        r.erro("endpoints.json: esperado objeto com chave 'endpoints'")
        return []
    eps = doc["endpoints"]
    ids = set()
    for i, e in enumerate(eps):
        ref = e.get("id", f"#{i}")
        for k in CHAVES_ENDPOINT:
            if k not in e:
                r.erro(f"{ref}: chave ausente '{k}'")
        if ref in ids:
            r.erro(f"{ref}: id duplicado")
        ids.add(ref)
        ent, acao = e.get("entidade_canonica"), e.get("acao_canonica")
        if ent not in ENTIDADES:
            r.erro(f"{ref}: entidade_canonica '{ent}' não existe na taxonomia")
        if acao not in ACOES:
            r.erro(f"{ref}: acao_canonica '{acao}' não existe na taxonomia")
        if ent in ENTIDADES and acao in ACOES:
            padrao = re.compile(rf"^{re.escape(r.slug)}\.{snake(ent)}\.{acao}(\.[a-z0-9_]+)?$")
            if not padrao.match(str(ref)):
                r.erro(f"{ref}: id não segue '<slug>.{snake(ent)}.{acao}[.qualificador]'")
        if str(e.get("metodo", "")).upper() not in METODOS:
            r.erro(f"{ref}: método inválido '{e.get('metodo')}'")
        if e.get("confianca") not in ("verificado", "inferido"):
            r.erro(f"{ref}: confianca inválida '{e.get('confianca')}'")
        if not str(e.get("fonte_url", "")).startswith("http"):
            r.erro(f"{ref}: fonte_url ausente/inválida")
        if not DATA_RE.match(str(e.get("data_consulta", ""))):
            r.erro(f"{ref}: data_consulta não ISO")
        for p in e.get("parametros", []):
            cc = p.get("campo_canonico")
            if cc and cc not in CAMPOS:
                r.erro(f"{ref}: parâmetro '{p.get('nome')}' aponta campo_canonico inexistente '{cc}'")
            if p.get("local") not in ("path", "query", "header", "body"):
                r.erro(f"{ref}: parâmetro '{p.get('nome')}' com local inválido '{p.get('local')}'")
        ex = e.get("execucao")
        if not isinstance(ex, dict):
            r.erro(f"{ref}: bloco 'execucao' ausente (seção 7.1)")
        elif acao in ACOES:
            seguro = ex.get("seguro_para_executar")
            if not isinstance(seguro, bool):
                r.erro(f"{ref}: execucao.seguro_para_executar deve ser booleano")
            elif seguro != ACOES[acao]["readOnlyHint"]:
                r.erro(f"{ref}: execucao.seguro_para_executar={seguro} diverge da ação '{acao}' "
                       f"(readOnly={ACOES[acao]['readOnlyHint']}); só leitura é executável")
            if seguro is False and not ex.get("motivo_inseguro"):
                r.erro(f"{ref}: execucao.motivo_inseguro obrigatório quando não é seguro executar")
            if seguro:
                pag = ex.get("paginacao") or {}
                if pag.get("tipo") not in TIPOS_PAGINACAO:
                    r.erro(f"{ref}: execucao.paginacao.tipo inválido '{pag.get('tipo')}'")
                if "lista_em" not in ex:
                    r.erro(f"{ref}: execucao.lista_em ausente (use null para resposta de item único)")
                cols = ex.get("colunas_sugeridas") or []
                if not cols:
                    r.erro(f"{ref}: execucao.colunas_sugeridas vazio")
                for c in cols:
                    if not c.get("caminho") or not c.get("titulo"):
                        r.erro(f"{ref}: coluna sugerida sem caminho/titulo: {c}")
        snips = e.get("snippets") or {}
        for lang in ("curl", "python", "typescript"):  # VBA adiado por decisão do usuário (2026-09-17)
            if not snips.get(lang):
                r.aviso(f"{ref}: snippet '{lang}' vazio")
        if "power_query_m" not in snips:
            r.erro(f"{ref}: snippets.power_query_m ausente (use null em ações de escrita)")
        elif acao in ACOES:
            leitura = ACOES[acao]["readOnlyHint"]
            m = snips.get("power_query_m")
            # Kits Power Query estão em standby desde 2026-09-17: ausência de M não é mais aviso.
            if not leitura and m:
                r.erro(f"{ref}: Power Query M em ação de escrita '{acao}' — o refresh repetiria a operação; use null e VBA")
            if m and "Web.Contents" not in m:
                r.aviso(f"{ref}: Power Query M sem Web.Contents")
        if not e.get("erros"):
            r.aviso(f"{ref}: nenhum erro documentado")
    for i, e in enumerate(doc.get("endpoints_secundarios", [])):
        for k in ("nome", "metodo", "path", "descricao", "confianca", "fonte_url"):
            if k not in e:
                r.erro(f"endpoints_secundarios[{i}]: chave ausente '{k}'")
        if e.get("confianca") != "catalogado_nao_detalhado":
            r.erro(f"endpoints_secundarios[{i}]: confianca deve ser 'catalogado_nao_detalhado'")
    if sistema and sistema.get("status") == "documentado" and not eps:
        r.erro("endpoints.json: status 'documentado' mas nenhum endpoint detalhado")
    return eps


def validar_openapi_yaml(caminho: Path, eps, r: Relatorio):
    if not caminho.exists():
        r.erro("arquivo ausente: openapi.yaml")
        return
    try:
        spec = yaml.safe_load(caminho.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        r.erro(f"openapi.yaml: YAML inválido ({e})")
        return
    if not str(spec.get("openapi", "")).startswith("3.1"):
        r.erro("openapi.yaml: versão deve ser 3.1.x")
    try:
        validar_openapi(spec)
    except Exception as e:  # noqa: BLE001 — queremos a mensagem de qualquer falha do validador
        r.erro(f"openapi.yaml: falhou na validação OpenAPI ({str(e).splitlines()[0][:300]})")
    op_ids = set()
    for path, itens in (spec.get("paths") or {}).items():
        for metodo, op in (itens or {}).items():
            if metodo.upper() not in METODOS or not isinstance(op, dict):
                continue
            oid = op.get("operationId")
            if not oid:
                r.erro(f"openapi.yaml: {metodo.upper()} {path} sem operationId")
            op_ids.add(oid)
            if op.get("x-confianca") not in ENUMS["confianca"]:
                r.erro(f"openapi.yaml: {oid} sem x-confianca válido")
            if not op.get("x-fonte-url"):
                r.aviso(f"openapi.yaml: {oid} sem x-fonte-url")
    for e in eps:
        esperado = str(e.get("id", "")).replace(".", "__")
        if esperado not in op_ids:
            r.erro(f"openapi.yaml: operação ausente para {e.get('id')} (operationId esperado '{esperado}')")


def validar_tools(doc, eps, r: Relatorio):
    if doc is None:
        return
    tools = doc.get("tools") if isinstance(doc, dict) else None
    if not isinstance(tools, list):
        r.erro("tools.json: esperado objeto com lista 'tools'")
        return
    por_nome = {}
    for t in tools:
        nome = t.get("name", "")
        if not TOOL_RE.match(nome):
            r.erro(f"tools.json: nome inválido '{nome}'")
        if nome in por_nome:
            r.erro(f"tools.json: nome duplicado '{nome}'")
        por_nome[nome] = t
        desc = t.get("description", "")
        if len(desc) < 80:
            r.aviso(f"tools.json: {nome} com description curta ({len(desc)} chars) — o LLM precisa saber quando usar")
        schema = t.get("inputSchema")
        if not isinstance(schema, dict) or schema.get("type") != "object":
            r.erro(f"tools.json: {nome} inputSchema deve ser objeto com type=object")
        else:
            try:
                Draft202012Validator.check_schema(schema)
            except Exception as e:  # noqa: BLE001
                r.erro(f"tools.json: {nome} inputSchema inválido ({str(e).splitlines()[0][:200]})")
        ann = t.get("annotations") or {}
        for k in ("readOnlyHint", "destructiveHint"):
            if not isinstance(ann.get(k), bool):
                r.erro(f"tools.json: {nome} sem annotations.{k} booleano")
    for e in eps:
        nome = str(e.get("id", "")).replace(".", "__")
        t = por_nome.get(nome)
        if not t:
            r.erro(f"tools.json: ferramenta ausente para {e.get('id')} ('{nome}')")
            continue
        acao = ACOES.get(e.get("acao_canonica"))
        ann = t.get("annotations") or {}
        if acao and ann.get("readOnlyHint") != acao["readOnlyHint"]:
            r.aviso(f"tools.json: {nome} readOnlyHint={ann.get('readOnlyHint')} diverge da ação '{acao['nome']}' — justificar")
        if acao and acao["destructiveHint"] and ann.get("destructiveHint") is not True:
            r.erro(f"tools.json: {nome} ação '{acao['nome']}' é destrutiva; destructiveHint deve ser true")
    extras = set(por_nome) - {str(e.get("id", "")).replace(".", "__") for e in eps}
    for x in sorted(extras):
        r.erro(f"tools.json: ferramenta sem endpoint correspondente '{x}'")


def validar_chunks(caminho: Path, eps, r: Relatorio):
    if not caminho.exists():
        r.erro("arquivo ausente: chunks.jsonl")
        return
    ids_ep = {e.get("id") for e in eps}
    vistos = set()
    for n, linha in enumerate(caminho.read_text(encoding="utf-8").splitlines(), 1):
        if not linha.strip():
            continue
        try:
            c = json.loads(linha)
        except json.JSONDecodeError:
            r.erro(f"chunks.jsonl linha {n}: JSON inválido")
            continue
        meta = c.get("metadata") or {}
        for k in CHAVES_META_CHUNK:
            if meta.get(k) in (None, ""):
                r.erro(f"chunks.jsonl linha {n}: metadata.{k} ausente")
        cid = meta.get("id") or c.get("id")
        if cid not in ids_ep:
            r.erro(f"chunks.jsonl linha {n}: chunk órfão '{cid}'")
        if cid in vistos:
            r.erro(f"chunks.jsonl linha {n}: mais de um chunk para '{cid}' (não dividir endpoint)")
        vistos.add(cid)
        texto = c.get("texto", "")
        tokens_aprox = len(texto) / 4.2
        if tokens_aprox < 400 or tokens_aprox > 900:
            r.aviso(f"chunks.jsonl {cid}: ~{int(tokens_aprox)} tokens (alvo 400–900)")
        if meta.get("path") and meta["path"] not in texto:
            r.aviso(f"chunks.jsonl {cid}: texto não menciona o path — chunk pode não ser autocontido")
    for faltando in sorted(ids_ep - vistos):
        r.erro(f"chunks.jsonl: endpoint sem chunk '{faltando}'")


TIPOS_FAQ = {"como_fazer", "erro_comum", "conceito", "limite_custo", "ambiente"}
LINGUAGENS_FAQ = {"python", "typescript", "curl", "power_query_m", None}


def validar_faq(caminho: Path, eps, sistema, r: Relatorio):
    if not caminho.exists():
        r.erro("arquivo ausente: faq.jsonl")
        return
    ids_ep = {e.get("id") for e in eps}
    vistos, total, bi = set(), 0, 0
    for n, linha in enumerate(caminho.read_text(encoding="utf-8").splitlines(), 1):
        if not linha.strip():
            continue
        total += 1
        try:
            f = json.loads(linha)
        except json.JSONDecodeError:
            r.erro(f"faq.jsonl linha {n}: JSON inválido")
            continue
        fid = f.get("id", f"linha {n}")
        if not re.match(rf"^{re.escape(r.slug)}\.faq\.\d+$", str(fid)):
            r.erro(f"faq.jsonl {fid}: id deve ser '{r.slug}.faq.<n>'")
        if fid in vistos:
            r.erro(f"faq.jsonl {fid}: id duplicado")
        vistos.add(fid)
        for k in ("pergunta", "resposta", "tipo", "fonte_url", "data_consulta", "confianca"):
            if not f.get(k):
                r.erro(f"faq.jsonl {fid}: '{k}' ausente")
        if f.get("tipo") and f["tipo"] not in TIPOS_FAQ:
            r.erro(f"faq.jsonl {fid}: tipo inválido '{f['tipo']}'")
        if f.get("confianca") and f["confianca"] not in ("verificado", "inferido"):
            r.erro(f"faq.jsonl {fid}: confianca inválida")
        if f.get("data_consulta") and not DATA_RE.match(str(f["data_consulta"])):
            r.erro(f"faq.jsonl {fid}: data_consulta não ISO")
        for rel in f.get("endpoints_relacionados") or []:
            if rel not in ids_ep:
                r.erro(f"faq.jsonl {fid}: endpoint relacionado inexistente '{rel}'")
        codigo = f.get("codigo") or {}
        if codigo.get("linguagem") not in LINGUAGENS_FAQ:
            r.erro(f"faq.jsonl {fid}: linguagem de código inválida '{codigo.get('linguagem')}'")
        if codigo.get("linguagem") in ("power_query_m", "vba"):
            bi += 1
        palavras = len(str(f.get("resposta", "")).split())
        if palavras < 80 or palavras > 400:
            r.aviso(f"faq.jsonl {fid}: resposta com {palavras} palavras (alvo 80–400)")
    if sistema and sistema.get("status") == "documentado" and total < 12:
        r.erro(f"faq.jsonl: {total} perguntas (mínimo 12 para sistema documentado)")


KIT_OBRIGATORIOS = [
    "README.md",
    "powerquery/00_Parametros.pq",
    "powerquery/00_Parametros_PowerBI.pq",
    "powerquery/01_fnApi.pq",
    "powerquery/Config_layout.md",
    "powerquery/tbConfig.json",
    "python/.env.example",
    "python/cliente.py",
    "typescript/.env.example",
    "typescript/cliente.ts",
]
# arquivos onde placeholders de credencial são permitidos
KIT_CONFIG = {"powerquery/00_Parametros.pq", "powerquery/00_Parametros_PowerBI.pq", "powerquery/tbConfig.json",
              "python/.env.example", "typescript/.env.example",
              "powerquery/Config_layout.md", "README.md"}


def validar_kit(pasta: Path, sistema, r: Relatorio):
    """Kit está em standby desde 2026-09-17: só é validado se existir."""
    kit = pasta / "kit"
    if not kit.exists():
        return
    pq = (sistema or {}).get("kit_power_query") or {}
    pq_inviavel = pq.get("viavel") is False
    if pq_inviavel and len(str(pq.get("motivo", ""))) < 40:
        r.erro("system.json: kit_power_query.viavel=false exige 'motivo' explicando a limitação")
    for rel in KIT_OBRIGATORIOS:
        if pq_inviavel and rel.startswith("powerquery/") and rel != "powerquery/Config_layout.md":
            continue
        if not (kit / rel).is_file():
            r.erro(f"kit: arquivo ausente {rel}")
    if not kit.exists():
        return
    consultas = list((kit / "powerquery").glob("1*_*.pq")) if (kit / "powerquery").is_dir() else []
    if not consultas and not pq_inviavel:
        r.erro("kit: nenhuma consulta de entidade em powerquery/1x_<Entidade>.pq")
    cfg = kit / "powerquery" / "tbConfig.json"
    if cfg.is_file():
        try:
            linhas = json.loads(cfg.read_text(encoding="utf-8"))["linhas"]
            chaves = {l["Chave"] for l in linhas if all(k in l for k in ("Chave", "Valor", "Descricao"))}
            if len(chaves) != len(linhas):
                r.erro("kit/powerquery/tbConfig.json: toda linha precisa de Chave, Valor e Descricao, sem chave repetida")
            if "Ambiente" not in chaves:
                r.erro("kit/powerquery/tbConfig.json: chave 'Ambiente' obrigatória")
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            r.erro(f"kit/powerquery/tbConfig.json: formato inválido ({e}); esperado {{\"linhas\": [{{Chave, Valor, Descricao}}]}}")
    for arq in kit.rglob("*"):
        if not arq.is_file():
            continue
        rel = arq.relative_to(kit).as_posix()
        texto = arq.read_text(encoding="utf-8", errors="ignore")
        if rel not in KIT_CONFIG and re.search(r"<<[A-Z0-9_ ]+>>", texto):
            r.erro(f"kit/{rel}: placeholder de credencial fora dos arquivos de configuração")
        # Web.Contents com Content = requisição com corpo (POST). Só é aceitável para obter token OAuth na função base.
        if rel.endswith(".pq") and re.search(r"Content\s*=", texto):
            if rel == "powerquery/01_fnApi.pq":
                r.aviso(f"kit/{rel}: requisição com corpo — confirme que é só a obtenção de token")
            else:
                r.erro(f"kit/{rel}: Power Query com corpo de requisição (escrita) — o refresh repetiria a operação")
    varrer_segredos(kit, r, recursivo=True)


def varrer_segredos(pasta: Path, r: Relatorio, recursivo: bool = False):
    if not pasta.exists():
        return
    for arq in (pasta.rglob("*") if recursivo else pasta.iterdir()):
        if not arq.is_file():
            continue
        texto = arq.read_text(encoding="utf-8", errors="ignore")
        for regex, rotulo in SEGREDOS:
            for m in regex.finditer(texto):
                r.erro(f"{arq.name}: possível segredo ({rotulo}): {m.group(0)[:24]}…")
        for m in re.finditer(r"(?<!\d)(\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?!\d)", texto):
            digitos = re.sub(r"\D", "", m.group(1))
            if cpf_valido(digitos):
                r.aviso(f"{arq.name}: CPF com dígito verificador válido '{m.group(1)}' — confirme que é valor de teste público")
        for m in re.finditer(r"[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})", texto):
            dominio = m.group(1).lower()
            if not dominio.startswith("example.") and not dominio.endswith(".example") and dominio != "example.com":
                r.aviso(f"{arq.name}: e-mail fora de example.com '{m.group(0)}' — confirme que não é dado real")


def validar(slug: str) -> Relatorio:
    r = Relatorio(slug)
    pasta = RAIZ / "sistemas" / slug
    if not pasta.is_dir():
        r.erro(f"pasta inexistente: {pasta}")
        return r
    sistema = carregar_json(pasta / "system.json", r)
    if sistema:
        validar_sistema(sistema, r)
    endpoints_doc = carregar_json(pasta / "endpoints.json", r)
    eps = validar_endpoints(endpoints_doc, sistema, r) if endpoints_doc is not None else []
    validar_openapi_yaml(pasta / "openapi.yaml", eps, r)
    validar_tools(carregar_json(pasta / "tools.json", r), eps, r)
    validar_chunks(pasta / "chunks.jsonl", eps, r)
    validar_faq(pasta / "faq.jsonl", eps, sistema, r)
    validar_kit(pasta, sistema, r)
    ficha = pasta / "ficha.md"
    if not ficha.exists() or ficha.stat().st_size < 500:
        r.erro("ficha.md ausente ou muito curta")
    varrer_segredos(pasta, r)
    return r


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(2)
    if args == ["--todos"]:
        args = sorted(p.name for p in (RAIZ / "sistemas").iterdir() if p.is_dir())
    total_erros = 0
    for slug in args:
        r = validar(slug)
        total_erros += len(r.erros)
        print(f"\n=== {slug}: {len(r.erros)} erros, {len(r.avisos)} avisos ===")
        for e in r.erros:
            print(f"  ERRO  {e}")
        for a in r.avisos:
            print(f"  AVISO {a}")
    sys.exit(1 if total_erros else 0)


if __name__ == "__main__":
    main()
