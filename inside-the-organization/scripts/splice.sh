#!/bin/bash
# Remplace deux segments vidéo du master par des segments re-rendus (scripts/render-segment.mjs), audio du master conservé.
# Usage : scripts/splice.sh master.mp4 A.mp4 51.4 56.3 B.mp4 85.5 93.5 out.mp4
set -e
M=$1; A=$2; a0=$3; a1=$4; B=$5; b0=$6; b1=$7; OUT=$8
ffmpeg -loglevel error -y -i "$M" -i "$A" -i "$B" -filter_complex "
[0:v]trim=0:$a0,setpts=PTS-STARTPTS[v0];
[1:v]setpts=PTS-STARTPTS[v1];
[0:v]trim=$a1:$b0,setpts=PTS-STARTPTS[v2];
[2:v]setpts=PTS-STARTPTS[v3];
[v0][v1][v2][v3]concat=n=4:v=1:a=0[v]" \
  -map "[v]" -map 0:a -c:v libx264 -crf 15 -preset slow -pix_fmt yuv420p -r 30 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a copy -movflags +faststart "$OUT"
echo "épissé : $OUT"
