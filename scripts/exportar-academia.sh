#!/usr/bin/env bash
# Gera, a partir do conteúdo da Academia (src/features/academia/content), os arquivos
# que vão para o Drive: as fontes .md do NotebookLM e o documento de prompts.
#
#   bash scripts/exportar-academia.sh
#
# A Academia no hub é a FONTE ÚNICA. Editou manual? rode isto de novo, para o Drive
# não divergir do que o time lê na tela.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
DEST="${1:-/Users/matheusfriderandrade/Library/CloudStorage/GoogleDrive-matheusfrider1@gmail.com/Meu Drive/FRIDER ANDRADE - ADVOGADOS/01. FRIDER ANDRADE | ADVOGADOS/02. TUTORIAIS/01. ESCRITÓRIO/04. ACADEMIA 2026}"

"$AQUI/node_modules/.bin/tsc" \
  "$AQUI"/src/features/academia/content/*.ts \
  "$AQUI"/src/features/academia/types.ts \
  --outDir "$TMP" --module commonjs --target es2020 --skipLibCheck

node "$AQUI/scripts/exportar-academia.js" "$TMP/content/index.js" "$DEST"
rm -rf "$TMP"
echo "→ $DEST"
