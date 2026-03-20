#!/bin/bash
# NaLinha — Deploy com cache busting automatico
# Uso: ./deploy.sh "mensagem do commit"
# Atualiza ?v=X em todos os HTML, bumpa o SW, comita e faz push

set -e
cd "$(dirname "$0")"

# Gerar versao baseada em timestamp (ex: 20260320091500)
VERSION=$(date +%Y%m%d%H%M%S)
SHORT_V=$(date +%m%d%H%M)

echo "=== NaLinha Deploy ==="
echo "Versao: $VERSION"

# 1. Atualizar ?v=XXXX em todos os HTMLs para JS e CSS
echo "[1/4] Atualizando cache busting em HTMLs..."
for f in *.html; do
  # JS: supabase.js?v=X → supabase.js?v=NOVO
  sed -i -E "s/\.js(\?v=[0-9a-zA-Z]+)?\"/.js?v=$SHORT_V\"/g" "$f"
  # CSS: style.css?v=X → style.css?v=NOVO
  sed -i -E "s/\.css(\?v=[0-9a-zA-Z]+)?\"/.css?v=$SHORT_V\"/g" "$f"
done

# 2. Atualizar CACHE_NAME no service worker
echo "[2/4] Atualizando Service Worker..."
sed -i -E "s/const CACHE_NAME = 'nalinha-v[0-9]+';/const CACHE_NAME = 'nalinha-v$VERSION';/" sw.js

# 3. Git commit + push
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
  git merge dev
  git push
  git checkout dev
fi

echo ""
echo "=== Deploy concluido! ==="
echo "Versao: $SHORT_V"
echo "Cache SW: nalinha-v$VERSION"
echo "Todos os clientes vao atualizar automaticamente."
