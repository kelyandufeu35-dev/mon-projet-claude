"""Découpe ffmpeg (libx264, précise à la frame), sous-titres .srt et miniatures."""

from __future__ import annotations

import subprocess
import textwrap
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def probe_duration(video: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(video)],
        check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def padded_bounds(start: float, end: float, cfg: dict, duration: float) -> tuple[float, float]:
    return max(0.0, start - cfg["pad_before_s"]), min(duration, end + cfg["pad_after_s"])


def cut(video: Path, out: Path, start: float, end: float, cfg: dict[str, Any]) -> None:
    # -ss avant -i + réencodage : recherche rapide ET coupe exacte à la frame.
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", str(video),
           "-t", f"{end - start:.3f}", "-map", "0:v:0", "-map", "0:a:0?",
           "-c:v", "libx264", "-preset", cfg["preset"], "-crf", str(cfg["crf"]),
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", cfg["audio_bitrate"],
           "-movflags", "+faststart", str(out)]
    subprocess.run(cmd, check=True)


# --- Sous-titres -------------------------------------------------------------

def _srt_time(t: float) -> str:
    ms = max(0, round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_srt(sentences: list[dict], clip_start: float, clip_end: float,
              cfg: dict[str, Any]) -> str:
    """Sous-titres recalés sur le début du clip, à partir des mots horodatés Deepgram."""
    max_chars = cfg["max_chars_per_line"] * cfg["max_lines"]
    words = [w for s in sentences for w in s["words"]
             if w["s"] >= clip_start - 0.05 and w["e"] <= clip_end + 0.05]
    cues: list[list[dict]] = []
    for w in words:
        cur = cues[-1] if cues else None
        if cur:
            text_len = len(" ".join(x["w"] for x in cur + [w]))
            if (text_len <= max_chars and w["e"] - cur[0]["s"] <= cfg["max_cue_duration_s"]
                    and w["s"] - cur[-1]["e"] <= cfg["min_gap_split_s"]
                    and not cur[-1]["w"].endswith((".", "!", "?", "…"))):
                cur.append(w)
                continue
        cues.append([w])

    blocks = []
    for n, cue in enumerate(cues, 1):
        text = "\n".join(textwrap.wrap(" ".join(w["w"] for w in cue),
                                       cfg["max_chars_per_line"])[:cfg["max_lines"]])
        start = cue[0]["s"] - clip_start
        end = cue[-1]["e"] - clip_start
        if n < len(cues):  # pas de chevauchement avec le sous-titre suivant
            end = min(end, cues[n][0]["s"] - clip_start)
        blocks.append(f"{n}\n{_srt_time(start)} --> {_srt_time(end)}\n{text}\n")
    return "\n".join(blocks)


# --- Miniatures --------------------------------------------------------------

def sharpness(img: Image.Image) -> float:
    """Variance des contours, pénalisée pour les images trop sombres ou trop claires."""
    gray = img.convert("L")
    gray.thumbnail((480, 270))
    edges = ImageStat.Stat(gray.filter(ImageFilter.FIND_EDGES)).var[0]
    brightness = ImageStat.Stat(gray).mean[0]
    penalty = 0.3 if brightness < 40 or brightness > 220 else 1.0
    return edges * penalty


def extract_frame(video: Path, t: float, out: Path) -> Path:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(video),
                    "-frames:v", "1", "-q:v", "2", str(out)], check=True)
    return out


def best_frame(clip: Path, tmp_dir: Path, candidates: int) -> Image.Image:
    duration = probe_duration(clip)
    # On évite les 10 % de début et de fin (transitions, bouches ouvertes).
    times = [duration * (0.1 + 0.8 * k / max(1, candidates - 1)) for k in range(candidates)]
    best, best_score = None, -1.0
    for k, t in enumerate(times):
        path = extract_frame(clip, t, tmp_dir / f"frame_{k:02d}.jpg")
        img = Image.open(path)
        img.load()
        score = sharpness(img)
        if score > best_score:
            best, best_score = img, score
        path.unlink()
    assert best is not None
    return best


def _font(cfg: dict, size: int) -> ImageFont.FreeTypeFont:
    paths = [cfg["font_path"]] if cfg.get("font_path") else FONT_CANDIDATES
    for p in paths:
        if p and Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)


def cover(img: Image.Image, width: int, height: int) -> Image.Image:
    scale = max(width / img.width, height / img.height)
    img = img.convert("RGB").resize((round(img.width * scale), round(img.height * scale)),
                                    Image.LANCZOS)
    left, top = (img.width - width) // 2, (img.height - height) // 2
    return img.crop((left, top, left + width, top + height))


def render_thumbnail(frame: Image.Image, text: str, out: Path, cfg: dict[str, Any]) -> Path:
    w, h = cfg["width"], cfg["height"]
    img = cover(frame, w, h)
    text = text.upper() if cfg["uppercase"] else text
    draw = ImageDraw.Draw(img)
    margin = int(w * 0.05)
    size = cfg["font_size"]
    # On réduit la police jusqu'à tenir sur 2 lignes dans la largeur.
    while True:
        font = _font(cfg, size)
        avg = font.getlength("M") * 0.62
        lines = textwrap.wrap(text, max(4, int((w - 2 * margin) / avg)))
        widest = max((font.getlength(line) for line in lines), default=0)
        if (len(lines) <= 2 and widest <= w - 2 * margin) or size <= 40:
            break
        size -= 6
    line_h = int(size * 1.1)
    block_h = line_h * len(lines)
    y = margin if cfg["position"] == "top" else h - margin - block_h
    for line in lines:
        x = (w - font.getlength(line)) / 2
        draw.text((x, y), line, font=font, fill=cfg["text_color"],
                  stroke_width=cfg["stroke_width"], stroke_fill=cfg["stroke_color"])
        y += line_h
    quality = 92
    while True:  # YouTube refuse les miniatures de plus de 2 Mo
        img.save(out, "JPEG", quality=quality, optimize=True)
        if out.stat().st_size < 2 * 1024 * 1024 or quality <= 50:
            return out
        quality -= 10
