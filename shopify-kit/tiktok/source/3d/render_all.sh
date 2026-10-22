#!/bin/bash
# Rendu final des 5 plans (540×960, 8 échantillons + débruitage).
B=$(dirname "$0")
cd "$B"
for s in drop macro roll trio hero; do
  rm -rf "final/$s"; mkdir -p "final/$s"
  ./venv/bin/python anim.py $s "$B/final/$s" 8 540 > "final/$s.log" 2>&1
  echo "$s $(ls final/$s | wc -l) images"
done
