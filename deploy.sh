#!/bin/bash
# LoadPro — Deploy com cache busting automatico
# Uso: ./deploy.sh "mensagem do commit"

set -e
cd "$(dirname "$0")"

VERSION=$(date +%Y%m%d%H%M%S)
SHORT_V=$(date +%m%d%H%M)

echo "=== LoadPro Deploy ==="
echo "Versao: $VERSION"

# 1. Cache busting nos HTMLs
echo "[1/4] Atualizando cache busting..."
for f in *.html personal/*.html aluno/*.html; do
  [ -f "$f" ] || continue
  sed -i -E "s/\.js(\?v=[0-9a-zA-Z]+)?\"/.js?v=$SHORT_V\"/g" "$f"
  sed -i -E "s/\.css(\?v=[0-9a-zA-Z]+)?\"/.css?v=$SHORT_V\"/g" "$f"
done

# 2. Atualizar CACHE_NAME no SW + versao no console
echo "[2/4] Atualizando Service Worker e versao..."
[ -f sw.js ] && sed -i -E "s/const CACHE_NAME = 'loadpro-v[0-9]+';/const CACHE_NAME = 'loadpro-v$VERSION';/" sw.js
sed -i -E "s/const _LP_VER = 'loadpro-[0-9]+';/const _LP_VER = 'loadpro-$SHORT_V';/" js/auth.js

# 3. Git commit
echo "[3/4] Commitando..."
MSG="${1:-deploy: cache busting v$SHORT_V}"
git add -A
git commit -m "$MSG

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>" || echo "Nada pra comitar"

# 4. Push dev + merge main
echo "[4/4] Publicando..."
git push
CURRENT=$(git branch --show-current)
if [ "$CURRENT" = "dev" ]; then
  git checkout main
  git merge dev --no-edit
  git push
  git checkout dev
fi

echo ""
echo "=== LoadPro atualizado e no ar! ==="
echo "Versao: $SHORT_V"

# Fechar itens no DM Stack automaticamente pelo commit message
DMS_KW="${2:-}"
if [ -z "$DMS_KW" ]; then
  DMS_KW=$(echo "$MSG" | tr '[:upper:]' '[:lower:]' | \
    grep -oE '[a-záàâãéèêíïóôõöúüç-]{5,}' | \
    grep -vE '^(cache|busting|deploy|versao|fixes|update|remove|corrige|corrigir|adiciona|adicionar|atualiza|atualizar|insere|inserir)$' | \
    head -1)
fi
if [ -n "$DMS_KW" ]; then
  bash "$HOME/dms-resolve.sh" "$DMS_KW" "LOADPRO"
fi
