#!/usr/bin/env bash
# Reconstruit tout l'audio : timeline -> (voix déjà synthétisée) -> musique + effets + mixage -> AAC normalisé.
# Prérequis Python : numpy, scipy, soundfile (voir README). La voix s'obtient avec scripts/tts.py (kokoro-onnx).
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHON="${PYTHON:-python3}"
node scripts/export-timeline.mjs
"$PYTHON" scripts/make_audio.py
ffmpeg -y -v error -i assets/audio/mix.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -c:a aac -b:a 192k assets/audio/mix.m4a
ffprobe -v error -show_entries stream=codec_name,sample_rate,channels,duration -of default=nw=1 assets/audio/mix.m4a
