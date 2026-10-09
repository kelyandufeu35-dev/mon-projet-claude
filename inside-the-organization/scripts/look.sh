#!/bin/bash
# Usage : scripts/look.sh t1 t2 t3 t4   -> /tmp/shots/look.png (planche 2x2)
cd "$(dirname "$0")/.."
node scripts/build.mjs 2>&1 | grep -i -E "error" 
rm -f /tmp/shots/L_*.png
args=()
for t in "$@"; do args+=("$t"); done
node scripts/shoot.mjs --out /tmp/shots "${args[@]}" 2>&1 | grep -v -E "^/tmp" 
files=()
for t in "$@"; do files+=("/tmp/shots/t$(printf '%06.2f' "$t").png"); done
scripts/sheet.sh /tmp/shots/look.png "${files[@]}"
