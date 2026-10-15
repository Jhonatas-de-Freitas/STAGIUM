#!/usr/bin/env bash
# Publica o estado atual do catálogo no GitHub (hubsolucoes/STAGIUM; antes hubsolucoes/jhow).
#
# Uso (a partir da raiz do projeto jhow):
#   bash catalogo/scripts/publicar.sh "mensagem do commit"
#
# Antes de enviar, traz o que houver de novo no remoto (o Lovable também escreve nele)
# e reaplica as alterações locais por cima, para não sobrescrever nada.
set -euo pipefail

MENSAGEM="${1:-Atualiza catálogo de APIs}"
cd "$(dirname "$0")/../.."

# Segurança: nada de credencial, planilha gerada ou ambiente Python
if git status --porcelain | grep -qE "catalogo/(credenciais/[^L]|\.venv/|saida/)"; then
    echo "ABORTADO: há arquivos sensíveis fora do .gitignore. Verifique 'git status'." >&2
    exit 1
fi

git add catalogo
if git diff --cached --quiet; then
    echo "Nada para publicar."
    exit 0
fi

git -c user.name="Claude (Catálogo APIs)" -c user.email="bi.admin@hubxsolucoes.com" \
    commit -q -m "$MENSAGEM

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

git pull --rebase -q origin main
git push -q origin main
echo "Publicado: $(git log --oneline -1)"
