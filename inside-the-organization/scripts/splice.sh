#!/bin/bash
# Remplace des fenêtres vidéo du master par des segments re-rendus (scripts/render-segment.mjs), audio du master conservé.
# Usage : scripts/splice.sh master.mp4 out.mp4 seg1.mp4 début1 fin1 [seg2.mp4 début2 fin2 ...]   (fenêtres croissantes, en secondes)
set -e
M=$1; OUT=$2; shift 2
inputs=(-i "$M"); filt=""; parts=""; prev=0; i=0
while [ $# -ge 3 ]; do
  S=$1; a=$2; b=$3; shift 3; i=$((i+1)); inputs+=(-i "$S")
  filt+="[0:v]trim=$prev:$a,setpts=PTS-STARTPTS[m$i];[$i:v]setpts=PTS-STARTPTS[s$i];"
  parts+="[m$i][s$i]"; prev=$b
done
filt+="[0:v]trim=start=$prev,setpts=PTS-STARTPTS[mend];"
parts+="[mend]"; n=$((2*i+1))
ffmpeg -loglevel error -y "${inputs[@]}" -filter_complex "${filt}${parts}concat=n=$n:v=1:a=0[v]" \
  -map "[v]" -map 0:a -c:v libx264 -crf 15 -preset slow -pix_fmt yuv420p -r 30 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a copy -movflags +faststart "$OUT"
echo "épissé : $OUT"
