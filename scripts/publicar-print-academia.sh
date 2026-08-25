#!/usr/bin/env bash
# =============================================================================
# publicar-print-academia.sh — sobe um print de tela do hub para a Academia.
#
#   bash scripts/publicar-print-academia.sh <arquivo.png> <slug>
#   ex.: bash scripts/publicar-print-academia.sh ~/Desktop/inicio.png inicio-mesa
#
# Imprime a linha markdown pronta para colar no manual da aula:
#   ![legenda](https://api.friderandrade.com.br/.../prints/<slug>.png)
#
# 🚨 ANTES DE SUBIR: confira que o print NÃO tem dado de cliente — nome, CPF,
# número de processo, valor. Print de treinamento é distribuído para o time
# inteiro e fica numa URL pública. O que vale para o vídeo vale aqui.
# =============================================================================
set -euo pipefail

IMG="${1:-}"
SLUG="${2:-}"
if [ -z "$IMG" ] || [ -z "$SLUG" ]; then
  echo "uso: bash scripts/publicar-print-academia.sh <arquivo.png> <slug>"; exit 2
fi
[ -f "$IMG" ] || { echo "❌ não achei: $IMG"; exit 2; }

SSH=(ssh -p 22022 -i "$HOME/.ssh/chat_bullq_vps" -o ConnectTimeout=25 root@129.121.49.235)
SCP=(scp -P 22022 -i "$HOME/.ssh/chat_bullq_vps" -o ConnectTimeout=25)
DEST=/var/www/chat-bullq/chat-bullq-api/uploads/assets/academia/prints

"${SSH[@]}" "mkdir -p $DEST"
"${SCP[@]}" "$IMG" "root@129.121.49.235:$DEST/$SLUG.png"
"${SSH[@]}" "chmod 644 $DEST/$SLUG.png"

URL="https://api.friderandrade.com.br/api/v1/uploads/assets/academia/prints/$SLUG.png"
echo
echo "✅ no ar: $URL"
echo
echo "Cole no manual da aula, numa linha só:"
echo
echo "        '![Legenda do print]($URL)',"
