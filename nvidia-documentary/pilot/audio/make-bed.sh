#!/usr/bin/env bash
# Design sonore de la scène pilote (32 s), synthétisé de façon déterministe avec ffmpeg.
# Aucune bibliothèque sonore externe : tout est généré par des expressions mathématiques.
#   0-8 s    nappe grave + souffle léger (macro)
#   8-16 s   montée, impulsions de données (plongée dans la puce), impact à ~15,4 s (sortie)
#   16-29 s  air de salle + ronronnement de ventilateurs qui montent
#   29-32 s  accord de clôture sous le titre
set -euo pipefail
D=32
OUT="${1:-assets/bed.wav}"
mkdir -p "$(dirname "$OUT")"
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "sine=f=55:d=$D:sample_rate=48000" \
  -f lavfi -i "sine=f=82.5:d=$D:sample_rate=48000" \
  -f lavfi -i "sine=f=110:d=$D:sample_rate=48000" \
  -f lavfi -i "anoisesrc=color=pink:amplitude=0.5:seed=7:d=$D:sample_rate=48000" \
  -f lavfi -i "aevalsrc='0.9*sin(2*PI*120*t)+0.5*sin(2*PI*240.7*t)+0.3*sin(2*PI*361.9*t)':d=$D:s=48000" \
  -f lavfi -i "aevalsrc='(1-lt(mod(t*9.3+0.37*floor(t*3),1),0.06)*0)*sin(2*PI*(1500+700*mod(floor(t*9.3+0.37*floor(t*3))*7,5))*t)*lt(mod(t*9.3+0.37*floor(t*3),1),0.06)*(1-mod(t*9.3+0.37*floor(t*3),1)/0.06)*between(t,9.4,15.2)':d=$D:s=48000" \
  -f lavfi -i "aevalsrc='0.9*sin(2*PI*(60+420*exp(-5*(t-15.4)))*(t-15.4))*exp(-2.2*(t-15.4))*gte(t,15.4)':d=$D:s=48000" \
  -f lavfi -i "anoisesrc=color=white:amplitude=0.5:seed=11:d=$D:sample_rate=48000" \
  -f lavfi -i "aevalsrc='0.5*sin(2*PI*220*t)+0.4*sin(2*PI*329.63*t)+0.35*sin(2*PI*440*t)+0.25*sin(2*PI*659.25*t)':d=$D:s=48000" \
  -filter_complex "
    [0]volume='0.55+0.25*sin(2*PI*t*0.11)':eval=frame[a0];
    [1]volume='0.30*(0.6+0.4*sin(2*PI*t*0.07+1))':eval=frame[a1];
    [2]volume='0.12*between(t,6,17)*(1+0.3*sin(2*PI*t*0.2))+0.10*gt(t,17)':eval=frame[a2];
    [3]highpass=f=180,lowpass=f=2400,volume='0.10+0.20*between(t,8,15.2)*(t-8)/7+0.34*gt(t,16)*min(1,(t-16)/8)':eval=frame[a3];
    [4]lowpass=f=900,volume='0.12*gt(t,17)*min(1,(t-17)/6)':eval=frame[a4];
    [5]volume=0.20,lowpass=f=6000[a5];
    [6]lowpass=f=1200,volume=0.8[a6];
    [7]highpass=f=1500,lowpass=f=9000,volume='0.35*between(t,7.2,9.6)*(t-7.2)/2.4+0.45*between(t,15.4,17.6)*exp(-1.6*(t-15.4))':eval=frame[a7];
    [8]volume='0.20*gt(t,28.6)*min(1,(t-28.6)/1.4)':eval=frame[a8];
    [a0][a1][a2][a3][a4][a5][a6][a7][a8]amix=inputs=9:normalize=0,
      lowpass=f=14000,
      volume=0.8,alimiter=limit=0.7:level=disabled,
      afade=t=in:st=0:d=1.6,afade=t=out:st=30.2:d=1.8,
      asplit[l][r];
    [l]anull[L];
    [r]adelay=14[R];
    [L][R]amerge=inputs=2,aformat=sample_fmts=s16:channel_layouts=stereo
  " -t $D -ar 48000 "$OUT"
echo "écrit : $OUT"
