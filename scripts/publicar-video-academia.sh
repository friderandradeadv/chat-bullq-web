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

LOCAL_BYTES=$(wc -c < "$MP4" | tr -d ' ')
"${SSH[@]}" "mkdir -p $DEST"
REMOTE_BYTES=$("${SSH[@]}" "stat -c%s $DEST/$SLUG.mp4 2>/dev/null || echo 0")
if [ "$LOCAL_BYTES" = "$REMOTE_BYTES" ]; then
  echo "📦 mp4 já está na VPS com o mesmo tamanho — não reenvio."
else
  echo "📤 enviando $(du -h "$MP4" | cut -f1) para a VPS…"
  "${SCP[@]}" "$MP4" "root@129.121.49.235:$DEST/$SLUG.mp4"
fi
"${SCP[@]}" "$AQUI/legendar-video.mjs" "root@129.121.49.235:/tmp/legendar-video.mjs"

echo "🎧 extraindo áudio e transcrevendo…"
"${SSH[@]}" bash -s <<REMOTE
set -euo pipefail
cd $API
# mono 16 kHz opus: fica pequeno o bastante para caber numa chamada inline.
# -nostdin: sem isto o ffmpeg CONSOME o heredoc que alimenta este bash remoto
# e engole o resto do script (o erro aparece como "Parse error ... 1 given").
ffmpeg -nostdin -y -loglevel error -i "$DEST/$SLUG.mp4" -vn -ac 1 -ar 16000 -c:a libopus -b:a 24k "/tmp/$SLUG.ogg"
echo "   áudio: \$(du -h /tmp/$SLUG.ogg | cut -f1)"
# NÃO sourcear o .env inteiro: ele tem valores com "$" (chave do ASAAS) que o
# shell expande, e com `set -u` isso derruba o script — além de despejar
# segredo no log. Pega só a chave necessária.
export GEMINI_API_KEY="\$(grep -m1 "^GEMINI_API_KEY=" $API/.env | cut -d= -f2-)"
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
# ARQUIVO LOCAL: o mp4 baixado do Gemini cai solto na Mesa. Depois de publicado
# ele já cumpriu o papel aqui, mas o original vale guardar (regerar custa cota).
# Vai para uma pasta única em vez de ficar espalhado pelo Desktop.
ARQUIVO="$HOME/Desktop/VIDEOS ACADEMIA"
mkdir -p "$ARQUIVO"
if [ "$(cd "$(dirname "$MP4")" && pwd)" != "$ARQUIVO" ]; then
  mv "$MP4" "$ARQUIVO/" && echo "📁 original arquivado em ~/Desktop/VIDEOS ACADEMIA/$(basename "$MP4")"
fi

echo
echo "⚠️  Assista com a legenda ligada antes de considerar pronto: a marcação de"
echo "    tempo do Gemini erra em fala rápida, e legenda dessincronizada é pior"
echo "    que legenda nenhuma. O .vtt é texto — dá para corrigir na mão."
