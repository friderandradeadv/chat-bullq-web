#!/usr/bin/env bash
# =============================================================================
# publicar-video-academia.sh — põe um vídeo da Academia no ar, com legenda.
#
#   bash scripts/publicar-video-academia.sh <arquivo.mp4> <slug-da-aula>
#   ex.: bash scripts/publicar-video-academia.sh ~/Downloads/mapa.mp4 como-usar
#
# O QUE FAZ:
#   1. envia o mp4 para uploads/assets/academia/ na VPS;
#   2. extrai o áudio com ffmpeg (só existe lá, não no Mac);
#   3. transcreve com Gemini e grava o .vtt ao lado;
#   4. imprime o trecho pronto para colar no content da aula.
#
# POR QUE NA VPS: ffmpeg e GEMINI_API_KEY vivem lá. E o arquivo precisa ficar
# em uploads/assets para ser servido em /api/v1/uploads/assets/... — que é o
# ÚNICO caminho que o player da Academia consegue legendar (o embed do Drive
# não aceita faixa de texto nossa).
# =============================================================================
set -euo pipefail

MP4="${1:-}"
SLUG="${2:-}"
if [ -z "$MP4" ] || [ -z "$SLUG" ]; then
  echo "uso: bash scripts/publicar-video-academia.sh <arquivo.mp4> <slug-da-aula>"; exit 2
fi
[ -f "$MP4" ] || { echo "❌ não achei o arquivo: $MP4"; exit 2; }

SSH=(ssh -p 22022 -i "$HOME/.ssh/chat_bullq_vps" -o ConnectTimeout=25 root@129.121.49.235)
SCP=(scp -P 22022 -i "$HOME/.ssh/chat_bullq_vps" -o ConnectTimeout=25)
API=/var/www/chat-bullq/chat-bullq-api
DEST="$API/uploads/assets/academia"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📤 enviando $(du -h "$MP4" | cut -f1) para a VPS…"
"${SSH[@]}" "mkdir -p $DEST"
"${SCP[@]}" "$MP4" "root@129.121.49.235:$DEST/$SLUG.mp4"
"${SCP[@]}" "$AQUI/legendar-video.mjs" "root@129.121.49.235:/tmp/legendar-video.mjs"

echo "🎧 extraindo áudio e transcrevendo…"
"${SSH[@]}" bash -s <<REMOTE
set -euo pipefail
cd $API
# mono 16 kHz opus: fica pequeno o bastante para caber numa chamada inline.
ffmpeg -y -loglevel error -i "$DEST/$SLUG.mp4" -vn -ac 1 -ar 16000 -c:a libopus -b:a 24k "/tmp/$SLUG.ogg"
echo "   áudio: \$(du -h /tmp/$SLUG.ogg | cut -f1)"
set -a; . $API/.env; set +a
node /tmp/legendar-video.mjs "/tmp/$SLUG.ogg" "$DEST/$SLUG.vtt"
rm -f "/tmp/$SLUG.ogg"
chmod 644 "$DEST/$SLUG.mp4" "$DEST/$SLUG.vtt"
REMOTE

BASE="https://api.friderandrade.com.br/api/v1/uploads/assets/academia"
echo
echo "✅ no ar:"
echo "   $BASE/$SLUG.mp4"
echo "   $BASE/$SLUG.vtt"
echo
echo "Cole na aula '$SLUG', dentro do content:"
echo
cat <<SNIPPET
      video: {
        fonte: 'url',
        url: '$BASE/$SLUG.mp4',
        legendas: '$BASE/$SLUG.vtt',
      },
SNIPPET
echo
echo "⚠️  Assista com a legenda ligada antes de considerar pronto: a marcação de"
echo "    tempo do Gemini erra em fala rápida, e legenda dessincronizada é pior"
echo "    que legenda nenhuma. O .vtt é texto — dá para corrigir na mão."
