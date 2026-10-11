#!/usr/bin/env bash
# Mise au format TikTok (1080x1920) d'un film 16:9 : image entière au centre, fond flouté. Aucun recadrage.
# Usage : tools/export-9x16.sh [entrée.mp4] [sortie.mp4]
set -euo pipefail
IN="${1:-pilot/renders/final/final.mp4}"
OUT="${2:-tiktok/out/pilote-9x16.mp4}"
mkdir -p "$(dirname "$OUT")"
ffmpeg -v error -y -i "$IN" -filter_complex "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=45,eq=brightness=-0.12:saturation=1.1[bg];[b]scale=1080:-2:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]" \
  -map "[v]" -map 0:a -c:v libx264 -preset slow -b:v 5200k -maxrate 8000k -bufsize 12000k -r 24 -c:a aac -b:a 128k -movflags +faststart "$OUT"
