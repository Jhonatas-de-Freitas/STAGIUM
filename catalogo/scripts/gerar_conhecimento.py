"""Gera o conhecimento do assistente do site a partir do catálogo.

Lê `sistemas/*/system.json` e `endpoints.json` e escreve `src/lib/conhecimento.json`
na raiz do projeto: um recorte enxuto, suficiente para o modelo responder com precisão
sem carregar o catálogo inteiro no prompt.

Uso (a partir da raiz do catálogo):
    .venv\\Scripts\\python scripts\\gerar_conhecimento.py
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ.parent / "src" / "lib" / "conhecimento.json"
LIMITE_DESCRICAO = 240


def curto(texto, limite=LIMITE_DESCRICAO):
    texto = " ".join(str(texto or "").split())
    return texto if len(texto) <= limite else texto[: limite - 1].rstrip() + "…"


ENUMS_VISIVEIS = {"tipo", "status", "status_pedido"}


def rotulo_condicao(descricao):
    """'Só títulos ainda não baixados. O campo...' -> 'Só títulos ainda não baixados'."""
    import re
    primeira = re.split(r"[.:;]", str(descricao or ""), maxsplit=1)[0]
    return curto(re.sub(r"\s*\([^)]*\)", "", primeira).strip(), 70)


# Consultas que o site oferece, por sistema. Sistemas fora daqui oferecem todas as leituras
# seguras. Na Qive ficam de fora as que não viram planilha (PDF, webhooks, consulta por chave)
# e as filas de eventos, que não têm filtro de data.
CONSULTAS_DO_SITE = {
    "arquivei": {
        "arquivei.nota_fiscal.listar.nfe",
        "arquivei.nota_fiscal.listar.cte",
        "arquivei.nota_fiscal.listar.cteos",
        "arquivei.nota_fiscal.listar.nfse",
        "arquivei.nota_fiscal.listar.mdfe",
        "arquivei.conta_pagar.listar.boletos",
        "arquivei.pagamento.listar.comprovantes",
        "arquivei.empresa.listar",
    },
}

# Título da planilha das consultas do site, quando o nome do fornecedor é técnico demais.
TITULOS_DO_SITE = {
    "arquivei.nota_fiscal.listar.nfe": "Notas fiscais (NF-e)",
    "arquivei.nota_fiscal.listar.cte": "Conhecimentos de transporte (CT-e)",
    "arquivei.nota_fiscal.listar.cteos": "CT-e OS",
    "arquivei.nota_fiscal.listar.nfse": "Notas fiscais de serviço (NFS-e)",
    "arquivei.nota_fiscal.listar.mdfe": "Manifestos de carga (MDF-e)",
    "arquivei.conta_pagar.listar.boletos": "Boletos",
    "arquivei.pagamento.listar.comprovantes": "Comprovantes de pagamento",
    "arquivei.empresa.listar": "Empresas da conta",
}

# Filtros que vão no corpo JSON e que o formulário oferece como escolha. É decisão de
# interface do site (rótulos em português e valor enviado), por isso fica aqui e não no catálogo.
_SITUACAO_DFE = {"rotulo": "Situação", "tipo": "opcao", "obrigatorio": False,
                 "valores": {"Autorizadas": "authorized", "Canceladas": "canceled"}}
CORPO_OPCOES = {
    "arquivei.nota_fiscal.listar.nfe": [
        {"nome": "papel", "caminho": "Filters.OwnerRoles", "rotulo": "Notas", "tipo": "opcao",
         "obrigatorio": True, "padrao": "Recebidas",
         "valores": {"Recebidas": ["received"], "Emitidas": ["emitted"],
                     "Como transportadora": ["transporter"]}},
        {"nome": "situacao", "caminho": "Filters.Status", **_SITUACAO_DFE},
    ],
    "arquivei.nota_fiscal.listar.cte": [
        {"nome": "tomador", "caminho": "Filters.IsTaker", "tipo": "condicao",
         "rotulo": "Só os CT-e tomados pela empresa (fretes que ela paga)", "valor": True},
        {"nome": "situacao", "caminho": "Filters.Status", **_SITUACAO_DFE},
    ],
    "arquivei.nota_fiscal.listar.cteos": [
        {"nome": "situacao", "caminho": "Filters.Status", **_SITUACAO_DFE},
    ],
    "arquivei.nota_fiscal.listar.nfse": [
        {"nome": "papel", "caminho": "filters.ownerRoles", "rotulo": "Serviços", "tipo": "opcao",
         "obrigatorio": True, "padrao": "Tomados",
         "valores": {"Tomados": ["taker"], "Prestados": ["emitter"]}},
        {"nome": "sem_canceladas", "caminho": "filters.isCanceled", "tipo": "condicao",
         "rotulo": "Excluir as canceladas", "valor": "false"},
    ],
    "arquivei.nota_fiscal.listar.mdfe": [
        {"nome": "situacao", "caminho": "Filter.Status", "rotulo": "Situação", "tipo": "opcao",
         "obrigatorio": False,
         "valores": {"Autorizados": ["authorized"], "Encerrados": ["closed"],
                     "Cancelados": ["canceled"]}},
    ],
    "arquivei.conta_pagar.listar.boletos": [
        {"nome": "situacao", "caminho": "status", "rotulo": "Situação", "tipo": "opcao",
         "obrigatorio": False,
         "valores": {"Em aberto": "open", "Vencidos": "overdue", "Pagos": "paid",
                     "Cancelados": "canceled"}},
    ],
}


# Valores que a API devolve em inglês e a planilha mostra em português, por sistema.
TRADUCOES_DE_VALOR = {
    "arquivei": {
        "authorized": "Autorizada", "canceled": "Cancelada", "closed": "Encerrada",
        "received": "Recebida", "emitted": "Emitida", "transporter": "Transportadora",
        "taker": "Tomada", "emitter": "Prestada", "intermediate": "Intermediária",
        "open": "Em aberto", "overdue": "Vencido", "paid": "Pago", "blocked": "Bloqueado",
        "high": "Alta", "medium": "Média", "low": "Baixa",
        "manual": "Manual", "automatico": "Automático",
    },
}


def titulo_limpo(titulo):
    """'Situação (authorized/canceled)' -> 'Situação': a lista de valores em inglês sai do título,
    porque a planilha já mostra os valores traduzidos."""
    import re
    return re.sub(r"\s*\((?:[a-z_]+(?:/|,\s*))+[a-z_]+\)$", "", str(titulo or "")).strip()


def planejar_corpo(endpoint):
    """Leituras feitas por POST com corpo JSON (ex.: buscas da Qive).

    O catálogo traz `execucao.corpo_modelo` com {data_inicial}/{data_final} e, às vezes, {cnpj}.
    O formulário pergunta o período (obrigatório quando o modelo usa datas), o CNPJ da empresa
    (opcional; sem ele o executor tira do corpo o que ficou com {cnpj}) e as escolhas de CORPO_OPCOES.
    O campo do XML em Base64 entra na lista de campos pedidos quando há colunas do XML.
    """
    ex = endpoint.get("execucao") or {}
    modelo = ex.get("corpo_modelo")
    if not isinstance(modelo, dict):
        return [], None
    modelo = json.loads(json.dumps(modelo))
    texto = json.dumps(modelo)
    campos = []
    if "{data_inicial}" in texto:
        campos.append({"nome": "data_inicial", "rotulo": "Data inicial", "tipo": "data",
                       "papel": "periodo_inicio", "obrigatorio": True})
        campos.append({"nome": "data_final", "rotulo": "Data final", "tipo": "data",
                       "papel": "periodo_fim", "obrigatorio": True})
    filial = next((f for f in ex.get("filtros_recomendados") or []
                   if f.get("papel") == "filial" and "{cnpj}" in str(f.get("expressao"))), None)
    if filial or "{cnpj}" in texto:
        campos.append({"nome": "cnpj", "rotulo": "CNPJ da empresa", "tipo": "texto", "papel": "filial",
                       "obrigatorio": False, "padrao": "",
                       "dica": "Só números. Vazio traz todas as empresas da conta."})
    escolhas = {}
    for o in CORPO_OPCOES.get(endpoint["id"], []):
        if o["tipo"] == "condicao":
            campos.append({"nome": o["nome"], "rotulo": o["rotulo"], "tipo": "condicao",
                           "papel": "condicao", "obrigatorio": False})
            escolhas[o["nome"]] = {"caminho": o["caminho"], "valores": {"1": o["valor"]}}
        else:
            campos.append({"nome": o["nome"], "rotulo": o["rotulo"], "tipo": "opcao", "papel": "opcao",
                           "obrigatorio": o["obrigatorio"], "opcoes": list(o["valores"]),
                           "padrao": o.get("padrao", "")})
            escolhas[o["nome"]] = {"caminho": o["caminho"], "valores": o["valores"]}
    # pede o XML quando há colunas a extrair dele
    xml = planejar_xml(endpoint)
    if xml:
        for chave in ("Fields", "fields"):
            if isinstance(modelo.get(chave), list) and xml["campo"] not in modelo[chave]:
                modelo[chave].append(xml["campo"])
    receita = {
        "modelo": modelo,
        "escolhas": escolhas,
        "filial": ({"caminho": filial["parametro"], "modelo": json.loads(filial["expressao"])}
                   if filial and filial["parametro"] not in json.dumps(modelo) else None),
    }
    return campos, receita


def planejar_xml(endpoint):
    """Colunas lidas de dentro do XML em Base64 (ex.: valor total e série da NF-e na Qive)."""
    ex = endpoint.get("execucao") or {}
    xml = ex.get("colunas_do_xml") or {}
    b64 = ex.get("conteudo_base64") or []
    if not xml.get("colunas") or not b64:
        return None
    return {"campo": b64[0]["campo"],
            "colunas": [{"titulo": c["titulo"], "caminho_xml": c["caminho_xml"], "tipo": c.get("tipo")}
                        for c in xml["colunas"]]}


def credenciais_do_site(auth):
    """Sem credencial de endereço, mas com produção e testes conhecidos: o formulário oferece o
    endereço já preenchido com o de produção, para o cliente poder usar o de testes."""
    auth = json.loads(json.dumps(auth or {}))
    creds = auth.get("credenciais_necessarias") or []
    ambientes = auth.get("base_url_por_ambiente") or {}
    if ambientes.get("producao") and ambientes.get("sandbox") and not any(c.get("nome") == "base_url" for c in creds):
        creds.append({"nome": "base_url", "rotulo": "Endereço da API", "segredo": False,
                      "obrigatoria": False, "default": ambientes["producao"],
                      "onde_obter": f"Já vem com o endereço de produção. Para testar com credenciais de "
                                    f"sandbox, troque por {ambientes['sandbox']}"})
        auth["credenciais_necessarias"] = creds
    return auth


def planejar_query_composta(endpoint):
    """Filtros que a API recebe dentro de um único parâmetro (ex.: Nomus: query=campo>=valor;...).

    O catálogo descreve cada filtro em execucao.filtros_recomendados com uma `expressao` e os
    marcadores {data_inicial}, {data_final} e {id_empresa}. O formulário pergunta o período
    (obrigatório: sem recorte a extração varre a base inteira), por qual data filtrar, a empresa,
    as condições fixas que começam com "Só" e um filtro adicional livre.
    """
    filtros = [f for f in ((endpoint.get("execucao") or {}).get("filtros_recomendados") or [])
               if f.get("expressao")]
    if not filtros:
        return [], None
    parametro = filtros[0].get("parametro") or "query"
    periodos = {}
    for f in filtros:
        if f.get("papel") == "periodo" and "{data_inicial}" in f["expressao"]:
            campo = f.get("campo") or f["expressao"].split(">=")[0]
            rotulo = curto(str(f.get("descricao") or campo).split(":")[0].replace("Recorte por ", ""), 40)
            periodos[rotulo[:1].upper() + rotulo[1:]] = f["expressao"]
    filial = next((f["expressao"] for f in filtros
                   if f.get("papel") == "filial" and "{id_empresa}" in f["expressao"]), None)
    condicoes = {}
    for i, f in enumerate(filtros):
        if f.get("papel") == "opcao" and "<" not in f["expressao"].replace("<=", "")                 and str(f.get("descricao") or "").startswith("Só "):
            condicoes[f"condicao_{i}"] = {"rotulo": rotulo_condicao(f.get("descricao")), "expressao": f["expressao"]}

    campos = []
    if periodos:
        campos.append({"nome": "data_inicial", "rotulo": "Data inicial", "tipo": "data",
                       "papel": "periodo_inicio", "obrigatorio": True})
        campos.append({"nome": "data_final", "rotulo": "Data final", "tipo": "data",
                       "papel": "periodo_fim", "obrigatorio": True})
        if len(periodos) > 1:
            campos.append({"nome": "periodo_por", "rotulo": "Filtrar o período por", "tipo": "opcao",
                           "papel": "opcao", "obrigatorio": True, "opcoes": list(periodos),
                           "padrao": next(iter(periodos))})
    if filial:
        campos.append({"nome": "id_empresa", "rotulo": "Empresa (id)", "tipo": "texto", "papel": "filial",
                       "obrigatorio": False, "padrao": "",
                       "dica": "Id da empresa no ERP (consulta Empresas). Vazio traz todas."})
    for nome, cond in condicoes.items():
        campos.append({"nome": nome, "rotulo": cond["rotulo"], "tipo": "condicao", "papel": "condicao",
                       "obrigatorio": False})
    campos.append({"nome": "filtro_adicional", "rotulo": "Filtro adicional (opcional)", "tipo": "texto",
                   "papel": "avancado", "obrigatorio": False, "padrao": "",
                   "dica": "Na sintaxe do sistema, ex.: idPessoa==123. Junta-se aos filtros acima."})
    receita = {"parametro": parametro, "periodos": periodos, "filial": filial,
               "condicoes": {n: c["expressao"] for n, c in condicoes.items()}}
    return campos, receita


def planejar_filtros(endpoint, paginacao):
    """Decide, a partir dos parâmetros documentados, o que o site pergunta e o que envia sozinho.

    - Período (par de datas inicial/final), data de referência e filial viram campos do formulário.
    - Enums de tipo e situação viram listas de opções.
    - Parâmetros OBRIGATÓRIOS com padrão documentado são enviados sozinhos (ex.: codfor=0, "todos").
      Padrões de parâmetros opcionais NÃO são enviados: alguns restringem o resultado
      (ex.: ecommerce=true em produtos).
    """
    params_pag = {paginacao.get("param_pagina"), paginacao.get("param_tamanho"), paginacao.get("param_cursor")}
    campos, fixos, offset_base = [], {}, 0

    for p in endpoint.get("parametros", []):
        nome, local = p.get("nome", ""), p.get("local")
        descricao = str(p.get("descricao") or "").lower()
        if local == "path":
            # parâmetro no próprio endereço (ex.: /saldo/fornecedores/{id}): sempre perguntado
            campos.append({"nome": nome, "rotulo": curto(p.get("descricao"), 60) or nome, "tipo": "texto",
                           "papel": "caminho", "obrigatorio": True, "padrao": "",
                           "dica": "Obrigatório: faz parte do endereço da consulta."})
            continue
        if local != "query":
            continue
        if any(f.get("expressao") and f.get("parametro") == nome
               for f in ((endpoint.get("execucao") or {}).get("filtros_recomendados") or [])):
            continue  # tratado por planejar_query_composta
        if nome in params_pag:
            if paginacao.get("tipo") == "offset" and nome == paginacao.get("param_pagina") and "base 1" in descricao:
                offset_base = 1
            continue
        baixo = nome.lower()
        obrigatorio = bool(p.get("obrigatorio"))
        padrao = p.get("default")

        if p.get("tipo") == "date" and any(t in baixo for t in ("inicial", "inicio")):
            campos.append({"nome": nome, "rotulo": "Data inicial", "tipo": "data", "papel": "periodo_inicio",
                           "obrigatorio": obrigatorio})
        elif p.get("tipo") == "date" and any(t in baixo for t in ("final", "fim")):
            campos.append({"nome": nome, "rotulo": "Data final", "tipo": "data", "papel": "periodo_fim",
                           "obrigatorio": obrigatorio})
        elif p.get("tipo") == "date":
            campo = {"nome": nome, "rotulo": "Data de referência", "tipo": "data", "papel": "data",
                     "obrigatorio": obrigatorio}
            if "dd/mm" in str(p.get("formato") or ""):
                campo["formato"] = "dd/mm/aaaa"
            campos.append(campo)
        elif baixo == "filial":
            campos.append({"nome": nome, "rotulo": "Filial", "tipo": "texto", "papel": "filial",
                           "obrigatorio": obrigatorio, "padrao": padrao if padrao not in (None, "") else "",
                           "dica": curto(p.get("descricao"), 90)})
        elif p.get("enum") and (baixo in ENUMS_VISIVEIS or (obrigatorio and padrao in (None, ""))):
            campos.append({"nome": nome, "rotulo": "Tipo" if baixo == "tipo" else "Situação", "tipo": "opcao",
                           "papel": "opcao", "obrigatorio": obrigatorio,
                           "opcoes": [str(o) for o in p["enum"]],
                           "padrao": str(padrao) if padrao not in (None, "") else "",
                           "dica": curto(p.get("descricao"), 90)})
        elif obrigatorio and padrao not in (None, ""):
            fixos[nome] = padrao

    return campos, fixos, offset_base


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    # --sistemas slug1,slug2 limita o conhecimento (útil para pilotos)
    filtro = None
    if "--sistemas" in sys.argv:
        filtro = set(sys.argv[sys.argv.index("--sistemas") + 1].split(","))
    sistemas, consultas, escritas, execucao = [], [], [], {}

    for pasta in sorted((RAIZ / "sistemas").iterdir()):
        arq_sistema, arq_endpoints = pasta / "system.json", pasta / "endpoints.json"
        if not (arq_sistema.is_file() and arq_endpoints.is_file()):
            continue
        s = json.loads(arq_sistema.read_text(encoding="utf-8"))
        if s.get("status") != "documentado" or (filtro and s["slug"] not in filtro):
            continue
        execucao[s["slug"]] = {"auth": credenciais_do_site(s.get("execucao_auth")), "endpoints": {},
                               **({"traducoes": TRADUCOES_DE_VALOR[s["slug"]]}
                                  if s["slug"] in TRADUCOES_DE_VALOR else {})}
        do_site = CONSULTAS_DO_SITE.get(s["slug"])
        auth = s.get("execucao_auth") or {}
        sistemas.append({
            "slug": s["slug"],
            "nome": s["nome"],
            "categoria": s["categoria"],
            "descricao": curto(s.get("descricao_curta")),
            "estilo": (s.get("api") or {}).get("estilo"),
            "autenticacao": auth.get("tipo"),
            "credenciais": [c.get("nome") for c in auth.get("credenciais_necessarias") or []],
            "sandbox": bool((s.get("ambiente_testes") or {}).get("sandbox")),
            "indice_integrabilidade": (s.get("indice_integrabilidade") or {}).get("score"),
            "armadilhas": [curto(a, 160) for a in (s.get("esforco_integracao") or {}).get("principais_armadilhas", [])[:4]],
            "lacunas": [curto(l.get("descricao"), 160) for l in (s.get("lacunas") or [])[:4]],
        })

        doc = json.loads(arq_endpoints.read_text(encoding="utf-8"))
        for e in doc.get("endpoints", []):
            ex = e.get("execucao") or {}
            base = {
                "id": e["id"],
                "sistema": s["nome"],
                "slug": s["slug"],
                "entidade": e["entidade_canonica"],
                "acao": e["acao_canonica"],
                "metodo": e["metodo"],
                "path": e["path"],
                "descricao": curto(e.get("descricao")),
                "fonte": e.get("fonte_url"),
            }
            if ex.get("seguro_para_executar") and do_site is not None and e["id"] not in do_site:
                continue  # leitura que o site não oferece (ver CONSULTAS_DO_SITE)
            if ex.get("seguro_para_executar"):
                base["quando_usar"] = curto(e.get("quando_usar"), 180)
                base["filtros"] = [f.get("parametro") for f in (ex.get("filtros_recomendados") or [])][:8]
                xml = planejar_xml(e)
                colunas = [{**c, "titulo": titulo_limpo(c.get("titulo"))}
                           for c in (ex.get("colunas_sugeridas") or [])
                           if not (xml and c.get("caminho") == xml["campo"])]
                # do XML, só o que a resposta da API ainda não traz (valor, série, natureza...)
                ja_tem = {c["titulo"].lower() for c in colunas}
                colunas += [{"titulo": c["titulo"], "caminho": "xml:" + c["caminho_xml"], "tipo": c["tipo"]}
                            for c in (xml["colunas"] if xml else []) if c["titulo"].lower() not in ja_tem]
                base["colunas"] = [c.get("titulo") for c in colunas][:18]
                base["paginacao"] = (ex.get("paginacao") or {}).get("tipo")
                consultas.append(base)
                # receita completa para o executor do servidor
                paginacao = ex.get("paginacao") or {}
                campos_filtro, padroes_fixos, offset_base = planejar_filtros(e, paginacao)
                if offset_base:
                    paginacao = {**paginacao, "offset_base": offset_base}
                campos_corpo, corpo = planejar_corpo(e)
                campos_query, query_composta = ([], None) if corpo else planejar_query_composta(e)
                campos_filtro = campos_filtro + campos_query + campos_corpo
                base["campos_filtro"] = campos_filtro
                limite = ex.get("limite_requisicoes") or {}
                execucao[s["slug"]]["endpoints"][e["id"]] = {
                    "metodo": e["metodo"], "path": e["path"],
                    "lista_em": ex.get("lista_em"), "campo_total": ex.get("campo_total"),
                    "paginacao": paginacao,
                    "filtros": ex.get("filtros_recomendados") or [],
                    "campos_filtro": campos_filtro,
                    "padroes_fixos": padroes_fixos,
                    "colunas": colunas,
                    "titulo": TITULOS_DO_SITE.get(e["id"]) or curto(e.get("nome_fornecedor") or e.get("descricao"), 80),
                    **({"corpo": corpo} if corpo else {}),
                    **({"xml": {"campo": xml["campo"]}} if xml else {}),
                    **({"headers_fixos": ex["headers_fixos"]} if ex.get("headers_fixos") else {}),
                    **({"query_composta": query_composta} if query_composta else {}),
                    **({"intervalo_minimo_s": limite["intervalo_minimo_s"]}
                       if limite.get("intervalo_minimo_s") else {}),
                }
            else:
                base["motivo_nao_executa"] = curto(ex.get("motivo_inseguro"), 160)
                escritas.append(base)

    conhecimento = {
        "gerado_em": __import__("datetime").date.today().isoformat(),
        "origem": "catalogo/ — documentado a partir das APIs oficiais",
        "sistemas": sistemas,
        "consultas": consultas,
        "escritas": escritas,
        "execucao": execucao,
    }
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(conhecimento, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tamanho = DESTINO.stat().st_size / 1024
    print(f"{DESTINO}: {len(sistemas)} sistemas, {len(consultas)} consultas, "
          f"{len(escritas)} operações de escrita — {tamanho:.0f} KB")
    if filtro:
        print("filtrado para:", ", ".join(sorted(filtro)))


if __name__ == "__main__":
    main()
