#!/bin/bash
# Usage : scripts/pshots.sh <sortie.png> <t_scène1> <t_scène2> ...  (temps de SCÈNE ; +HOOK ajouté) -> planche portrait
cd "$(dirname "$0")/.."
out=$1; shift
HOOK=$(node -e "console.log(require('./data/narration.json').hook.duration)")
rm -rf /tmp/pshots; args=()
for t in "$@"; do args+=("$(python3 -c "print($t+$HOOK)")"); done
node scripts/shoot.mjs --portrait --out /tmp/pshots "${args[@]}" | grep -v -E "^/tmp"
python3 - "$out" <<'PY'
import sys,glob
from PIL import Image
fs=sorted(glob.glob('/tmp/pshots/t*.png'))
n=len(fs); w=int(2000/n) if n>0 else 400; h=int(w*16/9)
ims=[Image.open(f).resize((w,h)) for f in fs]
sh=Image.new('RGB',(w*n,h)); x=0
for i in ims: sh.paste(i,(x,0)); x+=w
sh.save(sys.argv[1]); print(sys.argv[1], [f[-10:-4] for f in fs])
PY
