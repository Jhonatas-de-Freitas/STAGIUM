# Relatório do agente — Qive (antiga Arquivei) (lote 20, 2026-10-14)

```
SISTEMA: arquivei
STATUS: documentado
ENDPOINTS: 49 detalhados + 30 catalogados
FAQ: 18 perguntas
INDICE: 54 — Swagger oficial completo e sandbox gratuito self-service, mas par fixo de chaves sem escopo, webhooks recentes sem assinatura documentada, limite por cliente não publicado e credenciais de produção só via equipe comercial
VALIDADOR: 0 erros, 3 avisos (e-mails institucionais de suporte da própria Qive, suporte@qive.com.br e suporte@arquivei.com.br, citados como canal oficial; mantidos de propósito)
LACUNAS RELEVANTES: autenticação em dois cabeçalhos fora do modelo de execucao_auth (resolvido com a extensão headers_credenciais); rotas GET v1 não declaram X-API-ID/X-API-KEY no Swagger; fim da paginação da API 2.0 (NF-e, CT-e, CT-e OS, NFS-e, MDF-e) não documentado; formato de page.next na API 1.0 ambíguo (número x URL); valor total e série da NF-e só no XML (Base64) e campo Document sem estrutura; OwnerRoles divergente (received x receiver); grafias de chaves divergentes entre rotas; limite de requisições sem número público; webhooks sem formato de corpo, assinatura ou reentrega e contraditos pela ajuda; chave de permissão de parceiro sem procedimento; credenciais de produção e preço só sob proposta
MENOR CONFIANÇA: execucao.colunas_do_xml (caminhos vNF, serie, vTPrest, ValorServicos inferidos do layout nacional, marcados inferido); regra de parada da paginação nas rotas POST e GET v1 (lógica do catálogo); valores de OwnerRoles; exemplos de resposta (a maioria das rotas não tem exemplo oficial; os do catálogo seguem o schema com dados fictícios); nenhuma chamada real feita (sem credencial)
SURPRESAS / AJUSTES SUGERIDOS À TAXONOMIA: rebranding confirmado (Arquivei agora é Qive) mas hosts da API continuam em arquivei.com.br; webhooks apareceram no Swagger v1.105.0 enquanto a ajuda diz que não existem; entidade EventoFiscal sugerida para filas de eventos (hoje NotaFiscal com qualificador eventos_*); explicitar em ContaPagar que inclui "boleto a pagar capturado" (boletos com notas foram mapeados em ContaPagar e comprovantes em Pagamento); a especificação 6.1 deveria prever múltiplos cabeçalhos de credencial (headers_credenciais) e leituras por POST com corpo
```

## Notas para o orquestrador

- **Nome:** atual **Qive**, anterior **Arquivei** (fonte: <https://ajuda.qive.com.br/pt-BR/articles/9749184-arquivei-agora-e-qive>).
  `developers.arquivei.com.br` redireciona para `developers.qive.com.br`; o Swagger já se chama "Qive API". O slug ficou `arquivei`
  e o `system.json` traz `nome_atual`, `nome_anterior` e o bloco `rebranding`. Razão social: Arquivei Serviços On Line Ltda.
- **Autenticação:** dois cabeçalhos fixos, `X-API-ID` e `X-API-KEY` (credenciais `api_id` e `api_key`), mais `X-API-PERMISSION-KEY`
  opcional (`api_permission_key`, cenário de parceiro). Como a seção 6.1 só prevê um `header`, usei `tipo: header_api_key`,
  `header: X-API-KEY` e a extensão `headers_credenciais` (mapa cabeçalho → nome da credencial). `X-Use-ApiGateway: always` é exigido
  pelas rotas novas e está em `execucao.headers_fixos` de cada endpoint.
- **Onde o cliente obtém:** sandbox no formulário de <https://developers.qive.com.br/sandbox> (credenciais na tela e por e-mail,
  base `https://sandbox-api.arquivei.com.br`); produção emitida pela equipe da Qive após contratar a API (base `https://api.arquivei.com.br`).
  Não há tela self-service documentada para produção.
- **Paginação:** API 2.0 por POST com cursor opaco no corpo (`Paginator`/`paginator`/`next`) e próximo valor na raiz da resposta;
  `Limit` até 500. API 1.0 por GET com `cursor` numérico na query, `limit` até 50, próximo em `page.next`. Extensões no bloco
  `paginacao`: `local_cursor`, `origem_proximo`, `cursor_inicial`, `fim_alternativo`.
- **Limites:** por cliente, sem número; 429 com `Retry-After` e `X-RateLimit-Reset` (cabeçalhos).
- **Leituras seguras:** 38 (NF-e, CT-e, CT-e OS, NFS-e, NFC-e, MDF-e, eventos, manifestação, PDFs, empresas, etiquetas, boletos,
  comprovantes, CNPJ, webhooks em leitura, status de upload). Escritas documentadas e nunca seguras: 11.
- **permite_uso_em_produto_terceiro:** `sim` com condições (FAQ oficial admite parceiros via chave de permissão; Termos proíbem revenda
  e uso em benefício de terceiros não autorizados). Recomenda-se confirmação comercial por escrito.
- **Fontes lidas:** Swagger principal inteiro (78 operações, 179 definições), Swagger da API Lite, páginas e FAQ do portal, artigos de
  ajuda (API Qive, rebranding, API Lite, Domínio, gestão de usuários) e Termos de Uso. Nenhuma chamada à API da Qive.

### Entrada sugerida para o manifesto (não editei `manifest.json`)

```json
{
  "slug": "arquivei",
  "nome": "Qive (antiga Arquivei)",
  "status": "documentado",
  "data_documentacao": "2026-10-14",
  "endpoints_detalhados": 49,
  "endpoints_secundarios": 30,
  "leituras_seguras": 38,
  "faq": 18,
  "indice_integrabilidade": 54,
  "hipoteses_validadas": ["rebranding para Qive confirmado; hosts da API seguem em arquivei.com.br"]
}
```

### O que o executor do site (`src/lib/executor.servidor.ts`) precisa ganhar

1. **Vários cabeçalhos de credencial**: ler `execucao_auth.headers_credenciais` e montar `X-API-ID` e `X-API-KEY` (e
   `X-API-PERMISSION-KEY` se cadastrada). Hoje `header_api_key` monta um cabeçalho só.
2. **Cabeçalhos fixos por endpoint**: mesclar `execucao.headers_fixos` (`X-Use-ApiGateway: always`) aos de autenticação.
3. **Leitura por POST com corpo**: hoje `fetch` vai sem `body`. Enviar `execucao.corpo_modelo` como JSON, trocando
   `{data_inicial}`/`{data_final}` pelos filtros (formato `AAAA-MM-DD`, o modelo já acrescenta `00:00:00`/`23:59:59`).
4. **Cursor no corpo e na raiz**: quando `paginacao.local_cursor = "corpo"`, gravar o cursor no corpo (não na query) e lê-lo de
   `campo_proximo` na raiz da resposta (`origem_proximo = "raiz_da_resposta"`), não do maior valor dentro dos itens como faz hoje;
   parar quando vier vazio, nulo ou repetido.
5. **Cursor numérico vindo de `page.next`** nas rotas GET v1, tratando o caso de vir como URL (extrair o parâmetro `cursor`), com
   `cursor_inicial = 0`.
6. **Parâmetros repetidos com colchetes** (`cnpj[]`, `access_key[]`, `type[]`) e chaves com colchetes (`created_at[from]`):
   `URLSearchParams.append` por valor.
7. **429 por cabeçalho**: ler `Retry-After` (segundos) em vez de `tempoAteLiberar` no corpo.
8. **Base64**: opção para decodificar o XML (`execucao.conteudo_base64`) e extrair `colunas_do_xml` (valor total, série), e para
   devolver PDFs como arquivo em vez de linha de planilha.
9. **Parâmetro de caminho `{role}`**: usar `path_params` padrão (ex.: `received`) quando o usuário não escolher.

Arquivos: `sistemas/arquivei/` (system.json, endpoints.json, openapi.yaml, tools.json, chunks.jsonl, faq.jsonl, ficha.md,
perguntas-ao-fornecedor.md) e este relatório.
