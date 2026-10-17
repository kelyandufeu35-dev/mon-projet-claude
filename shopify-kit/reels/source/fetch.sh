#!/bin/bash
# Télécharge les photos produits (CDN Shopify) et les convertit en JPG.
cd "$(dirname "$0")/img" || exit 1
C=https://cdn.shopify.com/s/files/1/0988/6951/0477/files
get(){ curl -fsS -o "$1.src" "$C/$2" && ffmpeg -loglevel error -y -i "$1.src" -q:v 2 "$1.jpg" && rm "$1.src" && echo "ok $1"; }
get puzzle   Sf16cdb1d6ad944b69dbd66b91cb1a03cJ.webp
get canne    S4a7f7e0770264678999cd3fb080c9a6bf.webp
get peluche  HTB1Z7QUcoWF3KVjSZPhq6xclXXav.webp
get balle    balle-pattoune-chat.jpg
get garnir   S84ea22b691c04b5cbfea1d21fee312ca5.webp
get gamelle  S533db8aede824dc99ae2c4691b61fcbem.webp
get brosse   S795471ee870e4949a0244b9b0987c1fea.webp
get peigne   S271fc71a64b94712b20b5fd779f4ac31A.webp
get kit      Sda29096ebb63487c98942051563fb21aG.webp
