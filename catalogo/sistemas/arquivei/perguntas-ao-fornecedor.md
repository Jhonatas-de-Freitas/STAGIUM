# Perguntas para a Qive (antiga Arquivei) sobre a API

> **Como usar este documento.** Copie do "Contexto" em diante e envie ao atendimento da Qive (chat da plataforma,
> suporte@qive.com.br) ou ao gerente da conta. As perguntas foram reduzidas ao que a documentação pública **não responde**;
> o que ela já responde está em "O que já sabemos", no fim.
>
> Levantamento feito em **2026-10-14** sobre o Swagger oficial "Qive API" v1.105.0
> (<https://docs.arquivei.com.br/arquivei-apis-swagger/dfe-api.json>), o Portal do Desenvolvedor (<https://developers.qive.com.br>)
> e o artigo "API Qive: como integrar e automatizar a gestão de documentos fiscais" da Central de Ajuda.

---

## Contexto (para colar no e-mail)

Somos clientes da Qive e vamos conectar a conta a uma ferramenta de análise de dados (Excel / Power BI e um assistente que gera
planilhas). O uso será **exclusivamente de leitura**: listar NF-e, CT-e, NFS-e e eventos, consultar manifestações, baixar XMLs e
PDFs, boletos e comprovantes. Nenhuma manifestação, upload ou alteração será feita por essa ferramenta.

Já mapeamos o Swagger e o portal. Restam as perguntas abaixo.

---

## 1. Credenciais e acesso de terceiros

1. A ferramenta é de um fornecedor nosso. O FAQ diz que a API pode ser disponibilizada a parceiros por uma **chave de permissão**,
   sem compartilhar nosso ID e chave. Como geramos essa chave? Ela vai no cabeçalho `X-API-PERMISSION-KEY`, junto com o `X-API-ID`
   e o `X-API-KEY` **do parceiro**? Ela pode ser restrita a **somente leitura**?
2. Se usarmos nossas próprias credenciais na ferramenta, isso está de acordo com os Termos de Uso (cláusula de uso corporativo)?
   Podemos receber essa confirmação por escrito?
3. Existe credencial com **escopo de leitura** (sem permissão para manifestar, fazer upload ou mexer em webhooks)?
4. As credenciais **expiram**? Como fazemos a rotação sem derrubar integrações?
5. Há **allowlist de IP** ou outra restrição de origem?

## 2. Cabeçalhos e rotas

6. As rotas GET clássicas (`/v1/nfe/{role}`, `/v1/events/nfe`, `/v1/nfe/danfe`, `/v1/company`...) não declaram `X-API-ID`/`X-API-KEY`
   no Swagger. Confirmam que o mesmo par vale para todas?
7. O cabeçalho `X-Use-ApiGateway: always` pode ser enviado em **todas** as rotas, inclusive nas clássicas, ou só nas que o declaram?
8. As rotas `/v1/cnpj` e `/v1/cnpj/{CNPJ}` exigem as credenciais? Consomem a cota de requisições?

## 3. Paginação e filtros da API 2.0

9. Em `POST /v2/dfe/nfe`, `/v1/dfe/cte`, `/v1/dfe/cteos`, `/v1/dfe/nfse` e `/v1/dfe/mdfe`, como a **última página** é sinalizada:
   `Paginator` vazio, ausente, igual ao anterior ou lista vazia?
10. O cursor `Paginator` é estável se novas notas entrarem durante a extração? Ele expira?
11. Em `OwnerRoles`, os valores corretos são `received`/`emitted` (descrição) ou `receiver`/`emitter` (exemplo do schema)?
12. As chaves do corpo são sensíveis a maiúsculas/minúsculas nessas rotas (`Origins` x `Origin`, `fields` x `Fields`, `from` x `From`
    na NFS-e)?
13. `POST /v1/dfe/nfse` aceita algum parâmetro de **tamanho de página**? Qual é o máximo de `Limit` no MDF-e?
14. Qual o **intervalo máximo** de `EmissionDate` numa busca? Há limite de `Total`?
15. Qual o formato das datas devolvidas em `EmissionDate`/`CreatedAt` (NF-e e CT-e) e o fuso?
16. Existe documentação da estrutura do campo `Document` (nota em JSON)? Ele traz valor total, série e itens?

## 4. Paginação da API 1.0

17. O próximo cursor vem em `page.next` na raiz ou em `data.page.next`? É número ou URL completa?
18. Como identificamos a última página (lista com menos de `limit`, `page.next` vazio)?

## 5. Limites

19. Qual é o **limite de requisições** da nossa conta (quantidade e janela)? Vale por credencial ou por conta? Há rajada?
20. As rotas da API 2.0 também devolvem `X-RateLimit-Limit`/`X-RateLimit-Remaining`?
21. Como é cobrado o excedente de requisições citado nos Termos?

## 6. Webhooks

22. O artigo de ajuda diz que não há webhooks, mas o Swagger v1.105.0 tem a API de endpoints e subscriptions. O recurso está
    disponível em produção para todas as contas?
23. Qual é o **formato do corpo** da notificação e como o `Secret` (`whsec_...`) é usado para **assinar** a entrega (cabeçalho e algoritmo)?
24. Qual a política de **reentrega** (intervalos) antes das 20 falhas que desativam o endpoint? Há previsão para CT-e e NFS-e?

## 7. Dados

25. A API traz notas anteriores à contratação se pedirmos importação retroativa? Como?
26. Cancelamentos de NFS-e de prefeitura feitos após a captura: há previsão de atualização automática?
27. Quanto tempo leva, em média, entre a autorização na SEFAZ e a nota aparecer na API?

---

## O que já sabemos (não precisa responder)

- Autenticação por `X-API-ID` + `X-API-KEY`; rotas novas pedem `X-Use-ApiGateway: always`.
- Produção `https://api.arquivei.com.br`; sandbox `https://sandbox-api.arquivei.com.br`, gratuito e self-service; UAT sob pedido.
- API 2.0 com buscas por POST, filtros no corpo, `Fields` para projeção, `Limit` até 500 e cursor `Paginator`.
- Rotas 1.0 com cursor numérico, `limit` até 50, `created_at` = entrada na Qive.
- XML e PDF em Base64; PDFs em rotas próprias (DANFE, DACTE, DACTE OS, DANFSE).
- 429 com `Retry-After`; limite definido por cliente.
- Preço da API sob proposta; credenciais de produção emitidas pela Qive; novos CNPJs liberados manualmente.
