"""Sélection des clips par Claude à partir de la transcription en phrases numérotées."""

from __future__ import annotations

import logging
from typing import Any

from .llm import LLM

log = logging.getLogger(__name__)

SYSTEM = """Tu es monteur·se pour une chaîne YouTube francophone. On te donne la \
transcription d'une longue vidéo, découpée en phrases numérotées au format \
« [#numéro mm:ss Slocuteur] texte » (h:mm:ss au-delà d'une heure).

Ta mission : repérer les meilleurs extraits à publier comme clips autonomes.
Un clip est une plage continue de phrases, de la phrase `start` à la phrase `end` \
incluses. Donne uniquement des numéros de phrases présents dans la transcription.

Règles :
- durée de chaque clip entre {min_s} et {max_s} secondes ; estime-la avec les \
horodatages (fin ≈ début de la phrase qui suit `end`) ;
- les clips ne se chevauchent pas ;
- `score` de 1 à 10 : potentiel de rétention (10 = on regarde jusqu'au bout) ;
- `hook` : la promesse du clip en une phrase ; `reason` : pourquoi il retient.

Consignes éditoriales :
{guidelines}"""

SCHEMA = {
    "type": "object",
    "properties": {
        "clips": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start": {"type": "integer"},
                    "end": {"type": "integer"},
                    "score": {"type": "integer"},
                    "hook": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["start", "end", "score", "hook", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["clips"],
    "additionalProperties": False,
}


def fmt_time(seconds: float) -> str:
    s = int(seconds)
    h, m, s = s // 3600, s % 3600 // 60, s % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def format_sentences(sentences: list[dict]) -> str:
    return "\n".join(
        f"[#{s['i']} {fmt_time(s['start'])} S{s['speaker']}] {s['text']}" for s in sentences)


def clip_bounds(sentences: list[dict], start: int, end: int) -> tuple[float, float]:
    """Début de la 1re phrase → fin de la dernière (indices globaux)."""
    return sentences[start]["start"], sentences[end]["end"]


def chunk_sentences(sentences: list[dict], max_tokens: int, chars_per_token: float,
                    overlap: int) -> list[list[dict]]:
    """Un seul bloc tant que la transcription tient sous le seuil ; sinon des blocs chevauchants."""
    budget = int(max_tokens * chars_per_token)
    lengths = [len(format_sentences([s])) + 1 for s in sentences]
    if sum(lengths) <= budget:
        return [sentences]
    chunks: list[list[dict]] = []
    start = 0
    while start < len(sentences):
        size, end = 0, start
        while end < len(sentences) and size + lengths[end] <= budget:
            size += lengths[end]
            end += 1
        end = max(end, start + 1)
        chunks.append(sentences[start:end])
        if end >= len(sentences):
            break
        start = max(end - overlap, start + 1)
    return chunks


def make_validator(sentences: list[dict], chunk: list[dict], min_s: float, max_s: float):
    lo, hi = chunk[0]["i"], chunk[-1]["i"]

    def validate(data: dict) -> list[str]:
        errors: list[str] = []
        spans: list[tuple[int, int]] = []
        for n, c in enumerate(data["clips"], 1):
            start, end = c["start"], c["end"]
            if not (lo <= start <= hi and lo <= end <= hi):
                errors.append(f"clip {n} : phrases #{start}–#{end} hors de la plage #{lo}–#{hi}")
                continue
            if start > end:
                errors.append(f"clip {n} : start (#{start}) après end (#{end})")
                continue
            t0, t1 = clip_bounds(sentences, start, end)
            if not min_s <= t1 - t0 <= max_s:
                errors.append(f"clip {n} (#{start}–#{end}) dure {t1 - t0:.0f} s, "
                              f"hors de [{min_s:.0f}, {max_s:.0f}] s")
            if not 1 <= c["score"] <= 10:
                errors.append(f"clip {n} : score {c['score']} hors de 1–10")
            for a, b in spans:
                if start <= b and a <= end:
                    errors.append(f"clip {n} (#{start}–#{end}) chevauche #{a}–#{b}")
            spans.append((start, end))
        return errors

    return validate


def drop_invalid(clips: list[dict], validate) -> list[dict]:
    """Après la dernière relance : on garde les clips valides un par un."""
    kept: list[dict] = []
    for c in clips:
        if not validate({"clips": kept + [c]}):
            kept.append(c)
    return kept


def merge(clips: list[dict], limit: int) -> list[dict]:
    """Fusionne les résultats des blocs : meilleurs scores d'abord, sans chevauchement."""
    kept: list[dict] = []
    for c in sorted(clips, key=lambda c: -c["score"]):
        if all(c["end"] < k["start"] or k["end"] < c["start"] for k in kept):
            kept.append(c)
        if len(kept) == limit:
            break
    return sorted(kept, key=lambda c: c["start"])


def feedback_block(examples: dict[str, list[dict]]) -> str:
    if not examples.get("top") and not examples.get("bottom"):
        return ""

    def lines(items: list[dict]) -> str:
        return "\n".join(
            f"- « {e['title']} » ({e['duration']:.0f} s, {e['views']} vues, "
            f"{e['avg_view_pct']:.0f} % regardés en moyenne)\n  Extrait : {e['excerpt']}"
            for e in items)

    parts = ["<performances_passees>",
             "Résultats réels de clips déjà publiés sur la chaîne (durée moyenne de "
             "visionnage, YouTube Analytics). Inspire-toi de ce qui retient, évite ce qui décroche."]
    if examples.get("top"):
        parts += ["Clips qui retiennent le mieux :", lines(examples["top"])]
    if examples.get("bottom"):
        parts += ["Clips qui retiennent le moins :", lines(examples["bottom"])]
    parts.append("</performances_passees>")
    return "\n".join(parts) + "\n\n"


def select_clips(llm: LLM, transcript: dict, cfg: Any,
                 examples: dict[str, list[dict]] | None = None) -> list[dict]:
    sel, model_cfg = cfg["selection"], cfg["claude"]["selection"]
    sentences = transcript["sentences"]
    min_s, max_s = float(sel["min_duration_s"]), float(sel["max_duration_s"])
    system = SYSTEM.format(min_s=sel["min_duration_s"], max_s=sel["max_duration_s"],
                           guidelines=sel["guidelines"].strip())
    chunks = chunk_sentences(sentences, model_cfg["chunk_threshold_tokens"],
                             model_cfg["chars_per_token"], model_cfg["chunk_overlap_sentences"])
    feedback = feedback_block(examples or {})
    per_chunk = sel["clips_per_video"] if len(chunks) == 1 else max(
        2, -(-sel["clips_per_video"] * 2 // len(chunks)))

    found: list[dict] = []
    for n, chunk in enumerate(chunks, 1):
        label = f"sélection bloc {n}/{len(chunks)}"
        log.info("%s (phrases #%d–#%d)", label, chunk[0]["i"], chunk[-1]["i"])
        user = (f"{feedback}<transcription>\n{format_sentences(chunk)}\n</transcription>\n\n"
                f"Propose jusqu'à {per_chunk} clips, du meilleur au moins bon.")
        validate = make_validator(sentences, chunk, min_s, max_s)
        data, errors = llm.structured(model_cfg=model_cfg, system=system, user=user,
                                      schema=SCHEMA, validate=validate,
                                      max_retries=model_cfg["max_retries"], label=label)
        clips = drop_invalid(data["clips"], validate) if errors else data["clips"]
        if errors:
            log.warning("%s : %d clip(s) écarté(s) après relances",
                        label, len(data["clips"]) - len(clips))
        found.extend(clips)
    return merge(found, sel["clips_per_video"])
