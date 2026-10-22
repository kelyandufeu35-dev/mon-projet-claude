"""Extraction audio (ffmpeg) + transcription Deepgram Nova-3 en REST."""

from __future__ import annotations

import json
import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Iterator

import httpx

log = logging.getLogger(__name__)

DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"
SENTENCE_END = (".", "!", "?", "…")
# Garde-fous pour garder des phrases assez courtes pour être de bons points de coupe.
MAX_SENTENCE_WORDS = 45
MAX_SENTENCE_GAP_S = 1.5

AUDIO_FORMATS = {
    "opus": ("ogg", "audio/ogg", ["-c:a", "libopus", "-b:a", "48k"]),
    "flac": ("flac", "audio/flac", ["-c:a", "flac"]),
}


def extract_audio(video: Path, out_dir: Path, codec: str = "opus") -> Path:
    ext, _, args = AUDIO_FORMATS[codec]
    out = out_dir / f"audio.{ext}"
    if out.exists():
        return out
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video),
           "-vn", "-ac", "1", "-ar", "16000", *args, str(out)]
    subprocess.run(cmd, check=True)
    return out


def _chunks(path: Path, size: int = 1 << 20) -> Iterator[bytes]:
    with path.open("rb") as f:
        while chunk := f.read(size):
            yield chunk


def call_deepgram(audio: Path, cfg: dict[str, Any], api_key: str) -> dict:
    params = {
        "model": cfg["model"],
        "language": cfg["language"],
        "diarize": str(cfg["diarize"]).lower(),
        "smart_format": str(cfg["smart_format"]).lower(),
        "punctuate": "true",
    }
    mime = AUDIO_FORMATS[cfg["audio_codec"]][1]
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": mime,
        "Content-Length": str(audio.stat().st_size),
    }
    timeout = httpx.Timeout(cfg["timeout_s"], connect=30.0)
    for attempt in range(4):
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(DEEPGRAM_URL, params=params, headers=headers,
                                   content=_chunks(audio))
            resp.raise_for_status()
            return resp.json()
        except (httpx.TransportError, httpx.HTTPStatusError) as e:
            retryable = not isinstance(e, httpx.HTTPStatusError) or (
                e.response.status_code == 429 or e.response.status_code >= 500)
            if not retryable or attempt == 3:
                raise
            delay = 2 ** (attempt + 2)
            log.warning("Deepgram : %s, nouvel essai dans %ss", e, delay)
            time.sleep(delay)
    raise AssertionError("inaccessible")


def build_sentences(dg: dict) -> list[dict]:
    """Regroupe les mots Deepgram en phrases numérotées avec locuteur et mots horodatés."""
    words = dg["results"]["channels"][0]["alternatives"][0].get("words", [])
    sentences: list[dict] = []
    current: list[dict] = []

    def flush() -> None:
        if not current:
            return
        sentences.append({
            "i": len(sentences),
            "start": current[0]["start"],
            "end": current[-1]["end"],
            "speaker": current[0].get("speaker", 0),
            "text": " ".join(w.get("punctuated_word", w["word"]) for w in current),
            "words": [{"w": w.get("punctuated_word", w["word"]),
                       "s": w["start"], "e": w["end"]} for w in current],
        })
        current.clear()

    for w in words:
        if current:
            prev = current[-1]
            if (w.get("speaker", 0) != prev.get("speaker", 0)
                    or w["start"] - prev["end"] > MAX_SENTENCE_GAP_S):
                flush()
        current.append(w)
        token = w.get("punctuated_word", w["word"])
        if token.endswith(SENTENCE_END) or len(current) >= MAX_SENTENCE_WORDS:
            flush()
    flush()
    return sentences


def transcribe(video: Path, out_dir: Path, cfg: dict[str, Any], force: bool = False) -> dict:
    """Renvoie {"duration": s, "sentences": [...]} ; résultat mis en cache dans out_dir."""
    cached = out_dir / "transcript.json"
    if cached.exists() and not force:
        return json.loads(cached.read_text(encoding="utf-8"))
    api_key = os.environ.get("DEEPGRAM_API_KEY")
    if not api_key:
        raise SystemExit("DEEPGRAM_API_KEY n'est pas définie.")
    audio = extract_audio(video, out_dir, cfg["audio_codec"])
    log.info("Transcription Deepgram de %s…", audio.name)
    raw = call_deepgram(audio, cfg, api_key)
    (out_dir / "deepgram.json").write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    duration = float(raw.get("metadata", {}).get("duration", 0.0))
    transcript = {"duration": duration, "sentences": build_sentences(raw)}
    cached.write_text(json.dumps(transcript, ensure_ascii=False), encoding="utf-8")
    return transcript


def deepgram_cost(duration_s: float, cfg: dict[str, Any]) -> float:
    per_min = cfg["price_per_min"] + (cfg["diarization_price_per_min"] if cfg["diarize"] else 0.0)
    return duration_s / 60.0 * per_min
