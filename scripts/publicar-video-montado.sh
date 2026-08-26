#!/usr/bin/env bash
# Troca o vídeo do Gemini pelo nosso: mantém a NARRAÇÃO dele, descarta o visual.
#
# Entra: os quadros que o montar-video-academia.py gerou em /tmp/academia-frames
#        e o mp4 original (para extrair o áudio).
# Sai:   <slug>.mp4 novo em uploads/assets/academia/ na VPS, no lugar do antigo.
#
# O .vtt NÃO é tocado: a narração é a mesma, então os tempos continuam valendo.
# É justamente por isso que este caminho não gasta cota — nada é regerado.
set -euo pipefail

SLUG="${1:?uso: publicar-video-montado.sh <slug> [mp4-original]}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMES="/tmp/academia-frames"
DEST="/var/www/chat-bullq/chat-bullq-api/uploads/assets/academia"
VPS="root@129.121.49.235"
SSH=(ssh -p 22022 -i "$HOME/.ssh/chat_bullq_vps" -o ConnectTimeout=25 "$VPS")
SCP=(scp -P 22022 -i "$HOME/.ssh/chat_bullq_vps" -o ConnectTimeout=25)

[ -f "$FRAMES/lista.txt" ] || { echo "sem quadros — rode montar-video-academia.py $SLUG antes."; exit 1; }

echo "📤 enviando $(ls "$FRAMES"/*.png | wc -l | tr -d ' ') quadros…"
"${SSH[@]}" "rm -rf /tmp/frames-$SLUG && mkdir -p /tmp/frames-$SLUG"
"${SCP[@]}" -q "$FRAMES"/*.png "$VPS:/tmp/frames-$SLUG/"
# o concat guarda caminho absoluto; reescrevo para o diretório da VPS
sed "s|$FRAMES|/tmp/frames-$SLUG|g" "$FRAMES/lista.txt" > /tmp/lista-$SLUG.txt
"${SCP[@]}" -q "/tmp/lista-$SLUG.txt" "$VPS:/tmp/frames-$SLUG/lista.txt"

echo "🎬 montando na VPS (áudio do original, vídeo nosso)…"
"${SSH[@]}" bash -s <<EOF
set -euo pipefail
cd /tmp/frames-$SLUG
ORIG="$DEST/$SLUG.mp4"
[ -f "\$ORIG" ] || { echo "não achei \$ORIG na VPS"; exit 1; }
# guardo o do Gemini antes de sobrescrever — regerar custaria cota
[ -f "$DEST/$SLUG.gemini.mp4" ] || cp "\$ORIG" "$DEST/$SLUG.gemini.mp4"
# -shortest NAO basta: o concat exige repetir o ultimo quadro, e essa repeticao
# entrou como ~15s de imagem parada sem som na primeira tentativa. Corto pela
# duracao medida do audio, que e a fonte da verdade — a narracao manda.
DUR=\$(ffprobe -v error -select_streams a:0 -show_entries stream=duration -of csv=p=0 "$DEST/$SLUG.gemini.mp4")
echo "   audio do original: \${DUR}s"
ffmpeg -nostdin -y -loglevel error \
  -f concat -safe 0 -i lista.txt \
  -i "$DEST/$SLUG.gemini.mp4" \
  -map 0:v -map 1:a \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 128k -t "\$DUR" \
  /tmp/frames-$SLUG/saida.mp4
mv /tmp/frames-$SLUG/saida.mp4 "\$ORIG"
chmod 644 "\$ORIG"
echo "   duração: \$(ffprobe -v error -show_entries format=duration -of csv=p=0 "\$ORIG")s"
echo "   tamanho: \$(du -h "\$ORIG" | cut -f1)"
rm -rf /tmp/frames-$SLUG
EOF

echo
echo "✅ no ar (mesma URL, o player nem percebe):"
echo "   https://api.friderandrade.com.br/api/v1/uploads/assets/academia/$SLUG.mp4"
echo "   o .vtt segue valendo — a narração não mudou."
echo "   o vídeo do Gemini ficou guardado como $SLUG.gemini.mp4"
