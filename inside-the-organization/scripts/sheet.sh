#!/bin/bash
# Planche-contact 2x2 : scripts/sheet.sh out.png a.png b.png c.png d.png
out=$1; shift
ffmpeg -loglevel error -y -i "$1" -i "$2" -i "$3" -i "$4" -filter_complex "[0:v]scale=960:540[a];[1:v]scale=960:540[b];[2:v]scale=960:540[c];[3:v]scale=960:540[d];[a][b][c][d]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0" "$out"
