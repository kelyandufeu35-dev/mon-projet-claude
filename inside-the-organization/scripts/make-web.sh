#!/bin/bash
# Version « web » allégée (≈ 40 Mo) : H.264 CRF élevé + normalisation de volume à -16 LUFS.
# Usage : scripts/make-web.sh in.mp4 out.mp4 [crf]
set -e
ffmpeg -loglevel error -y -i "$1" -c:v libx264 -crf "${3:-24}" -preset slow -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -af "loudnorm=I=-16:TP=-1.5:LRA=8" -c:a aac -b:a 160k -movflags +faststart "$2"
ls -la "$2"
