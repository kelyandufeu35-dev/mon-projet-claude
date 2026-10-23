#!/usr/bin/env sh
# Convertit l'enregistrement du navigateur (WebM) en MP4 H.264/AAC accepté partout (TikTok, iPhone).
# Usage : tools/webm-vers-mp4.sh enregistrement.webm [sortie.mp4]
# Dépendance : ffmpeg.
set -e
in="$1"
out="${2:-${in%.*}.mp4}"
[ -f "$in" ] || { echo "Usage : $0 fichier.webm [sortie.mp4]"; exit 1; }
# MediaRecorder produit une cadence variable : on la fixe à 60 i/s et on recale le son sur l'image.
ffmpeg -y -i "$in" -vf "fps=60,scale=1080:1920:flags=lanczos" -c:v libx264 -preset medium -crf 18 \
  -pix_fmt yuv420p -c:a aac -b:a 192k -af aresample=async=1 -movflags +faststart "$out"
echo "✓ $out"
