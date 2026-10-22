"""Versions verticales 9:16 (TikTok) : fond flou, titre en haut, sous-titres incrustés."""

from __future__ import annotations

import re
import subprocess
import textwrap
import unicodedata
from pathlib import Path
from typing import Any

W, H = 1080, 1920
SENTENCE_END = (".", "!", "?", "…")


def _ass_time(t: float) -> str:
    cs = max(0, round(t * 100))
    h, cs = divmod(cs, 360_000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _ass_color(hex_rgb: str) -> str:
    """#RRGGBB → &H00BBGGRR (ordre inversé propre au format ASS)."""
    r, g, b = hex_rgb[1:3], hex_rgb[3:5], hex_rgb[5:7]
    return f"&H00{b}{g}{r}".upper()


def _ass_text(text: str) -> str:
    return text.replace("\\", "/").replace("{", "(").replace("}", ")")


def caption_chunks(words: list[dict], max_words: int, max_chars: int,
                   max_gap: float = 0.6) -> list[list[dict]]:
    """Groupes de quelques mots pour des sous-titres dynamiques."""
    chunks: list[list[dict]] = []
    for w in words:
        cur = chunks[-1] if chunks else None
        if (cur and len(cur) < max_words
                and len(" ".join(x["w"] for x in cur + [w])) <= max_chars
                and w["s"] - cur[-1]["e"] <= max_gap
                and not cur[-1]["w"].endswith(SENTENCE_END + (",",))):
            cur.append(w)
        else:
            chunks.append([w])
    return chunks


def build_ass(sentences: list[dict], clip_start: float, clip_end: float, title: str,
              cfg: dict[str, Any]) -> str:
    font, sub, ttl = cfg["font"], cfg["subtitles"], cfg["title"]
    duration = clip_end - clip_start
    words = [w for s in sentences for w in s["words"]
             if w["s"] >= clip_start - 0.05 and w["e"] <= clip_end + 0.05]
    lines = [
        "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}",
        "WrapStyle: 0", "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        # Sous-titres : ancrés par le haut juste sous la vidéo, loin des boutons TikTok.
        f"Style: Sub,{font},{sub['font_size']},{_ass_color(sub['color'])},&H000000FF,"
        f"&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,{sub['outline']},2,8,80,80,"
        f"{sub['top_y']},1",
        # Titre : ancré par le bas juste au-dessus de la vidéo, quel que soit son nombre de lignes.
        f"Style: Title,{font},{ttl['font_size']},{_ass_color(ttl['color'])},&H000000FF,"
        f"&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,{ttl['outline']},2,2,70,70,"
        f"{H - ttl['bottom_y']},1",
        "", "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    if title and ttl["enabled"]:
        wrapped = r"\N".join(textwrap.wrap(_ass_text(title), ttl["chars_per_line"]))
        lines.append(f"Dialogue: 0,{_ass_time(0)},{_ass_time(duration)},Title,,0,0,0,,{wrapped}")
    if sub["enabled"]:
        chunks = caption_chunks(words, sub["max_words"], sub["max_chars"])
        for n, chunk in enumerate(chunks):
            start = chunk[0]["s"] - clip_start
            end = chunk[-1]["e"] - clip_start
            if n + 1 < len(chunks):  # reste affiché jusqu'au groupe suivant si le silence est court
                nxt = chunks[n + 1][0]["s"] - clip_start
                end = nxt if nxt - end < 0.4 else end
            text = _ass_text(" ".join(w["w"] for w in chunk))
            if sub["uppercase"]:
                text = text.upper()
            lines.append(f"Dialogue: 1,{_ass_time(start)},{_ass_time(end)},Sub,,0,0,0,,{text}")
    return "\n".join(lines) + "\n"


def render_vertical(clip: Path, ass: Path, out: Path, cut_cfg: dict[str, Any]) -> None:
    """Clip 16:9 → 1080×1920 : fond agrandi et flouté, vidéo entière au centre, texte ASS."""
    graph = (
        "[0:v]split=2[bg][fg];"
        # Flou calculé en petite résolution : beaucoup plus rapide, rendu identique.
        f"[bg]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,"
        f"boxblur=10:2,eq=brightness=-0.22:saturation=0.85,scale={W}:{H},setsar=1[bgb];"
        f"[fg]scale={W}:-2,setsar=1[fgs];"
        f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2,ass={ass.name}[v]"
    )
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(clip.resolve()),
           "-filter_complex", graph, "-map", "[v]", "-map", "0:a:0?",
           "-c:v", "libx264", "-preset", cut_cfg["preset"], "-crf", str(cut_cfg["crf"]),
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", cut_cfg["audio_bitrate"],
           "-movflags", "+faststart", str(out.resolve())]
    # Le filtre ass lit un chemin relatif : on évite l'échappement des chemins Windows (C:\…).
    subprocess.run(cmd, check=True, cwd=ass.parent)


def hashtag(tag: str) -> str:
    tag = unicodedata.normalize("NFKD", tag).encode("ascii", "ignore").decode()
    return "#" + re.sub(r"[^A-Za-z0-9]", "", tag).lower()


def caption_text(clip: dict, cfg: dict[str, Any]) -> str:
    tags: list[str] = []
    for t in [hashtag(t) for t in clip.get("tags", [])] + cfg["extra_hashtags"]:
        if len(t) > 1 and t not in tags:
            tags.append(t)
    return f"{clip['title']}\n\n{' '.join(tags[:cfg['max_hashtags']])}"
