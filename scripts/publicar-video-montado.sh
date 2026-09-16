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
"${SCP[@]}" -q "$FRAMES/cenas.tsv" "$VPS:/tmp/frames-$SLUG/cenas.tsv"

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
# MOVIMENTO: o concat puro dá corte seco entre slides, que num vídeo de
# 3 minutos parece apresentacao de PowerPoint. O filtro abaixo faz cada
# quadro entrar com um leve zoom continuo (efeito Ken Burns discreto) e
# dissolve de um para o outro. E sutil de proposito: chamar atencao para a
# transicao tiraria a atencao do que esta sendo dito.
# 🚨 O MOVIMENTO SE FAZ CENA A CENA, NUNCA NO CONCAT INTEIRO.
# Duas tentativas morreram antes desta: zoompan aplicado sobre o concat
# demuxer bufferiza o filme todo e o kernel da VPS matou o ffmpeg por falta
# de memoria (2,1 GB de 3,9 GB — confirmado em dmesg). Primeiro com upscale
# para 4K, depois sem ele: morreu igual, porque o problema e o buffer do
# concat, nao a resolucao.
#
# Aqui cada PNG vira um mp4 curto, com seu proprio zoom lento, e so entao os
# trechos sao emendados. Cada processo dura segundos e ocupa pouca memoria.
# Mais lento no total, mas cabe numa VPS que roda o hub ao lado.
cd /tmp/frames-$SLUG
: > trechos.txt
i=0
while read -r arq seg; do
  [ -f "\$arq" ] || continue
  out=\$(printf 'cena%03d.mp4' "\$i")
  quadros=\$(awk "BEGIN{printf \"%d\", \$seg * 30}")
  [ "\$quadros" -lt 2 ] && quadros=2
  ffmpeg -nostdin -y -loglevel error -loop 1 -i "\$arq" -t "\$seg" \
    -vf "zoompan=z='min(zoom+0.00025,1.03)':d=\$quadros:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 21 -r 30 -threads 2 "\$out"
  echo "file '\$out'" >> trechos.txt
  ultimo="\$arq"
  i=\$((i+1))
done < cenas.tsv

# 🚨 A SOMA DAS CENAS PODE SER MENOR QUE O AUDIO.
# A duracao do roteiro e escrita a mao a partir do .vtt, e o .vtt termina na
# ultima fala — o mp4 do Gemini costuma ter 3 a 4 segundos de sobra depois
# disso. Com o concat antigo isso nao aparecia (o ultimo quadro repetido
# preenchia); com uma cena por vez, o video simplesmente acabava antes e a
# narracao seguia sobre nada. Aqui a ultima imagem se estende ate cobrir.
SOMA=\$(awk '{s+=\$2} END{printf "%.3f", s}' cenas.tsv)
FALTA=\$(awk "BEGIN{d=\$DUR-\$SOMA; if(d<0)d=0; printf \"%.3f\", d+1.0}")
if awk "BEGIN{exit !(\$FALTA > 0.2)}"; then
  echo "   estendendo a ultima cena em \${FALTA}s para cobrir o audio"
  ffmpeg -nostdin -y -loglevel error -loop 1 -i "\$ultimo" -t "\$FALTA" \
    -vf "scale=1920:1080,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 21 -r 30 -threads 2 cena_fim.mp4
  echo "file 'cena_fim.mp4'" >> trechos.txt
fi

# emenda os trechos e casa com o audio original, cortando pela duracao dele
ffmpeg -nostdin -y -loglevel error \
  -f concat -safe 0 -i trechos.txt \
  -i "$DEST/$SLUG.gemini.mp4" \
  -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 128k -t "\$DUR" \
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
