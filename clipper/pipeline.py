"""Étapes du pipeline, chacune idempotente : on peut relancer sans refaire le travail fait."""

from __future__ import annotations

import csv
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from . import media, vertical
from .config import Config, slugify
from .llm import LLM
from .quota import Quota, clip_cost, next_slots, steps_for_clip
from .selection import clip_bounds, select_clips
from .state import CUT, SELECTED, TITLED, UPLOADED, Store
from .titles import clip_text, generate_titles
from .transcribe import deepgram_cost, transcribe

log = logging.getLogger(__name__)


def parse_utc(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def register_source(store: Store, video: Path, title: str | None) -> str:
    video = video.resolve()
    for slug, src in store.sources.items():
        if src["path"] == str(video):
            if title:
                src["title"] = title
            return slug
    base = slug = slugify(video.stem)
    n = 2
    while slug in store.sources:
        slug, n = f"{base}-{n}", n + 1
    store.sources[slug] = {"path": str(video), "title": title or video.stem,
                           "added_at": datetime.now(timezone.utc).isoformat()}
    return slug


def load_transcript(cfg: Config, slug: str) -> dict:
    path = cfg.source_dir(slug) / "transcript.json"
    if not path.exists():
        raise SystemExit(f"Pas de transcription pour « {slug} » : lance d'abord `transcribe`.")
    return json.loads(path.read_text(encoding="utf-8"))


def step_transcribe(cfg: Config, store: Store, slug: str, force: bool = False) -> dict:
    src = store.sources[slug]
    transcript = transcribe(Path(src["path"]), cfg.source_dir(slug), cfg["deepgram"], force)
    cost = deepgram_cost(transcript["duration"], cfg["deepgram"])
    src.update(duration=transcript["duration"], sentences=len(transcript["sentences"]),
               deepgram_cost_usd=round(cost, 4))
    log.info("Transcription : %d phrases, %.0f min, ~%.3f $",
             len(transcript["sentences"]), transcript["duration"] / 60, cost)
    return transcript


def feedback_examples(cfg: Config, store: Store) -> dict[str, list[dict]]:
    fcfg = cfg["selection"]["feedback"]
    if not fcfg["enabled"]:
        return {}
    cutoff = datetime.now(timezone.utc) - timedelta(days=fcfg["min_age_days"])
    rated = [c for c in store.clips.values()
             if c.get("metrics") and c["metrics"]["views"] >= fcfg["min_views"]
             and parse_utc(c["youtube"]["publish_at"]) <= cutoff]
    if len(rated) < 2:
        return {}
    rated.sort(key=lambda c: -c["metrics"]["avg_view_pct"])
    k_top = min(fcfg["top_k"], len(rated) // 2)
    k_bot = min(fcfg["bottom_k"], len(rated) - k_top)

    def ex(c: dict) -> dict:
        return {"title": c.get("title", ""), "duration": c["end"] - c["start"],
                "views": c["metrics"]["views"], "avg_view_pct": c["metrics"]["avg_view_pct"],
                "excerpt": c.get("excerpt", "")[:fcfg["excerpt_chars"]]}

    return {"top": [ex(c) for c in rated[:k_top]],
            "bottom": [ex(c) for c in rated[len(rated) - k_bot:]] if k_bot else []}


def step_select(cfg: Config, store: Store, llm: LLM, slug: str, force: bool = False) -> list[dict]:
    existing = store.clips_of(slug)
    if existing and not force:
        log.info("Sélection déjà faite pour « %s » (%d clips), --force pour refaire.",
                 slug, len(existing))
        return existing
    if any(c["status"] == UPLOADED for c in existing):
        raise SystemExit("Des clips de cette source sont déjà publiés : sélection non refaite.")
    for c in existing:
        del store.clips[c["id"]]
    transcript = load_transcript(cfg, slug)
    sentences = transcript["sentences"]
    picked = select_clips(llm, transcript, cfg, feedback_examples(cfg, store))
    clips = []
    for n, p in enumerate(picked, 1):
        start, end = clip_bounds(sentences, p["start"], p["end"])
        clip = {"id": f"{slug}-{n:02d}", "source": slug, "index": n, "status": SELECTED,
                "start_sentence": p["start"], "end_sentence": p["end"],
                "start": start, "end": end, "score": p["score"],
                "hook": p["hook"], "reason": p["reason"]}
        clip["excerpt"] = clip_text(sentences, clip)
        store.clips[clip["id"]] = clip
        clips.append(clip)
    log.info("%d clips retenus pour « %s ».", len(clips), slug)
    return clips


def step_cut(cfg: Config, store: Store, slug: str, force: bool = False) -> None:
    src = store.sources[slug]
    video = Path(src["path"])
    duration = media.probe_duration(video)
    sentences = load_transcript(cfg, slug)["sentences"]
    out_dir = cfg.source_dir(slug) / "clips"
    out_dir.mkdir(exist_ok=True)
    for clip in store.clips_of(slug):
        if clip["status"] == UPLOADED or (clip["status"] != SELECTED and not force):
            continue
        start, end = media.padded_bounds(clip["start"], clip["end"], cfg["cut"], duration)
        out = out_dir / f"{clip['index']:02d}.mp4"
        log.info("Découpe %s : %.2f → %.2f s", out.name, start, end)
        media.cut(video, out, start, end, cfg["cut"])
        srt = out.with_suffix(".srt")
        srt.write_text(media.build_srt(sentences, start, end, cfg["subtitles"]), encoding="utf-8")
        clip.update(status=CUT, video=str(out), srt=str(srt), cut_start=start, cut_end=end)
        store.save()


def step_titles(cfg: Config, store: Store, llm: LLM, slug: str, force: bool = False) -> None:
    src = store.sources[slug]
    todo = [c for c in store.clips_of(slug)
            if c["status"] == CUT or (force and c["status"] == TITLED)]
    if not todo:
        return
    sentences = load_transcript(cfg, slug)["sentences"]
    metas = generate_titles(llm, todo, sentences, src["title"], cfg, feedback_examples(cfg, store))
    tmp = cfg.source_dir(slug) / "frames"
    tmp.mkdir(exist_ok=True)
    for clip in todo:
        meta = metas.get(clip["index"])
        if not meta:
            log.warning("Pas de métadonnées pour %s, ignoré.", clip["id"])
            continue
        clip.update(meta)
        frame = media.best_frame(Path(clip["video"]), tmp, cfg["thumbnail"]["candidates"])
        thumb = Path(clip["video"]).with_suffix(".jpg")
        media.render_thumbnail(frame, meta["thumbnail_text"], thumb, cfg["thumbnail"])
        clip.update(thumbnail=str(thumb), status=TITLED)
        write_info_file(clip, cfg["youtube"])
        log.info("%s : « %s »", clip["id"], meta["title"])
    store.save()


def _mmss(seconds: float) -> str:
    s = int(round(seconds))
    return f"{s // 60}:{s % 60:02d}"


def write_info_file(clip: dict, ycfg: dict) -> Path:
    """NN.txt à côté du clip : tout ce qu'il faut copier-coller dans YouTube Studio."""
    video = Path(clip["video"])
    duration = clip["end"] - clip["start"]
    text = "\n".join([
        "TITRE", clip["title"], "",
        "DESCRIPTION", clip["description"].strip(), "",
        "TAGS", ", ".join(clip["tags"]), "",
        "FICHIERS",
        f"Vidéo : {video.name}",
        f"Miniature : {video.with_suffix('.jpg').name}",
        f"Sous-titres : {video.with_suffix('.srt').name} (langue : {ycfg['caption_name']})", "",
        f"Durée : {_mmss(duration)} (extrait de {_mmss(clip['start'])} à "
        f"{_mmss(clip['end'])} dans la vidéo source)",
        f"Score Claude : {clip['score']}/10 · {clip['hook']}", "",
    ])
    out = video.with_suffix(".txt")
    # Fins de ligne Windows pour le Bloc-notes.
    out.write_text(text, encoding="utf-8", newline="\r\n")
    return out


def step_tiktok(cfg: Config, store: Store, slug: str, force: bool = False) -> list[Path]:
    """Version 9:16 de chaque clip titré, avec sa légende TikTok (NN.txt)."""
    tcfg = cfg["tiktok"]
    sentences = load_transcript(cfg, slug)["sentences"]
    out_dir = cfg.source_dir(slug) / "tiktok"
    out_dir.mkdir(exist_ok=True)
    done = []
    for clip in store.clips_of(slug):
        if not clip.get("title") or not clip.get("video"):
            continue
        out = out_dir / f"{clip['index']:02d}.mp4"
        if out.exists() and not force:
            done.append(out)
            continue
        ass = out.with_suffix(".ass")
        ass.write_text(vertical.build_ass(sentences, clip["cut_start"], clip["cut_end"],
                                          clip["title"], tcfg), encoding="utf-8")
        log.info("TikTok %s…", out.name)
        vertical.render_vertical(Path(clip["video"]), ass, out, cfg["cut"])
        out.with_suffix(".txt").write_text(vertical.caption_text(clip, tcfg) + "\n",
                                           encoding="utf-8", newline="\r\n")
        clip["tiktok"] = str(out)
        store.save()
        done.append(out)
    return done


def step_export(cfg: Config, store: Store, slugs: list[str]) -> list[Path]:
    return [write_info_file(c, cfg["youtube"]) for slug in slugs for c in store.clips_of(slug)
            if c.get("title") and c.get("video")]


def _resume_steps(clip: dict, ycfg: dict) -> list[str]:
    done = set(clip.get("youtube", {}).get("done", []))
    return [s for s in steps_for_clip(ycfg) if s not in done]


def step_upload(cfg: Config, store: Store, yt: Any, max_clips: int | None = None,
                dry_run: bool = False) -> None:
    ycfg = cfg["youtube"]
    ledger = store.data["quota"]
    quota = Quota(dict(ledger) if dry_run else ledger, ycfg)
    costs = ycfg["quota"]["costs"]
    # D'abord les clips partiellement publiés (miniature, playlist… en attente).
    partial = [c for c in store.clips_with_status(UPLOADED) if _resume_steps(c, ycfg)]
    pending = partial + store.clips_with_status(TITLED)
    if max_clips is not None:
        pending = pending[:max_clips]
    taken = [c["youtube"]["publish_at"] for c in store.clips_with_status(UPLOADED)]
    slots = iter(next_slots(sum(c["status"] == TITLED for c in pending), taken,
                            ycfg["schedule"]))
    per_clip = clip_cost(ycfg)
    log.info("Quota : %d/%d unités utilisées aujourd'hui (jour Pacifique %s), "
             "%d par clip → %d nouveau(x) clip(s) possible(s).", quota.used, quota.limit,
             quota.day, per_clip, quota.remaining // per_clip)

    for clip in pending:
        steps = _resume_steps(clip, ycfg)
        need = sum(costs[s] for s in steps)
        if not quota.can(need):
            log.info("Quota insuffisant pour %s (%d unités nécessaires, %d restantes) : "
                     "suite demain.", clip["id"], need, quota.remaining)
            break
        if clip["status"] == TITLED:
            # Nouveau créneau à chaque tentative : un créneau d'un essai raté peut être passé.
            publish_at = next(slots)
        else:
            publish_at = clip["youtube"]["publish_at"]
        if dry_run:
            for step in steps:
                quota.spend(step)
            log.info("[simulation] %s → %s (%s)", clip["id"], publish_at, ", ".join(steps))
            continue
        yinfo = clip.setdefault("youtube", {})
        yinfo.setdefault("done", [])
        yinfo["publish_at"] = publish_at
        for step in steps:
            quota.spend(step)
            store.save()
            if step == "videos.insert":
                yinfo["video_id"] = yt.upload(Path(clip["video"]), clip, publish_at, ycfg)
                clip["status"] = UPLOADED
            elif step == "thumbnails.set":
                yt.set_thumbnail(yinfo["video_id"], Path(clip["thumbnail"]))
            elif step == "playlistItems.insert":
                yt.add_to_playlist(yinfo["video_id"], ycfg["playlist_id"])
            elif step == "captions.insert":
                yt.upload_captions(yinfo["video_id"], Path(clip["srt"]),
                                   ycfg["default_language"], ycfg["caption_name"])
            yinfo["done"].append(step)
            store.save()
        log.info("Publié %s → https://youtu.be/%s (en ligne le %s)",
                 clip["id"], yinfo["video_id"], publish_at)


def step_stats(cfg: Config, store: Store, yt: Any, csv_path: Path) -> list[dict]:
    clips = [c for c in store.clips.values() if c.get("youtube", {}).get("video_id")]
    if not clips:
        log.info("Aucun clip publié.")
        return []
    today = datetime.now(timezone.utc).date()
    start = min(parse_utc(c["youtube"]["publish_at"]).date() for c in clips)
    metrics = yt.video_metrics([c["youtube"]["video_id"] for c in clips], start, today)
    rows = []
    for c in clips:
        m = metrics.get(c["youtube"]["video_id"])
        if m:
            c["metrics"] = {**m, "fetched_at": datetime.now(timezone.utc).isoformat()}
        m = c.get("metrics", {})
        rows.append({"clip": c["id"], "video_id": c["youtube"]["video_id"],
                     "title": c.get("title", ""), "publish_at": c["youtube"]["publish_at"],
                     "duration_s": round(c["end"] - c["start"]), "score_claude": c["score"],
                     "views": m.get("views", 0),
                     "avg_view_duration_s": round(m.get("avg_view_duration", 0), 1),
                     "avg_view_pct": round(m.get("avg_view_pct", 0), 1)})
    rows.sort(key=lambda r: -r["avg_view_pct"])
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    store.save()
    return rows


def cost_report(cfg: Config, llm: LLM) -> str:
    prices = {cfg["claude"][k]["model"]: cfg["claude"][k] for k in ("selection", "titles")}
    lines = []
    for model, usage in llm.usage.items():
        p = prices[model]
        total_in = usage.input_tokens + usage.cache_write_tokens + usage.cache_read_tokens
        lines.append(f"{model} : {usage.calls} appel(s), {total_in} tokens en entrée "
                     f"(dont {usage.cache_read_tokens} lus en cache), {usage.output_tokens} en "
                     f"sortie → ~{usage.cost(p['price_in'], p['price_out']):.3f} $")
    return "\n".join(lines)
