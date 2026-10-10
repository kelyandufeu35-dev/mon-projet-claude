#!/bin/bash
# Découpe une vidéo en parties aux frontières de scènes (ré-encodage H.264 + courts fondus audio).
# Usage : scripts/split-parts.sh in.mp4 dossier_sortie préfixe début1 fin1 [début2 fin2 ...]   (secondes vidéo)
# Exemple (TikTok en 3 parties) : scripts/split-parts.sh video/mcdonalds-inside-the-organization-tiktok.mp4 /tmp/parts mcdo-tiktok 0 35 35 65 65 98.5
set -e
IN=$1; OUT=$2; PRE=$3; shift 3; mkdir -p "$OUT"
N=$(( $# / 2 )); i=0
while [ $# -ge 2 ]; do
  a=$1; b=$2; shift 2; i=$((i+1)); d=$(python3 -c "print(round($b-$a,3))")
  ffmpeg -loglevel error -y -ss "$a" -i "$IN" -t "$d" \
    -c:v libx264 -crf 22 -preset medium -pix_fmt yuv420p -r 30 \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -af "afade=t=in:d=0.08,afade=t=out:st=$(python3 -c "print(round($d-0.15,3))"):d=0.15" -c:a aac -b:a 160k -movflags +faststart \
    "$OUT/${PRE}-partie-${i}-sur-${N}.mp4"
  ls -la "$OUT/${PRE}-partie-${i}-sur-${N}.mp4"
done
