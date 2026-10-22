"""Interface en ligne de commande (argparse)."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

from . import pipeline
from .config import load_config
from .llm import LLM, LLMError
from .quota import Quota, clip_cost
from .state import Store


def _youtube(cfg, args):
    from .youtube import YouTube, credentials

    ycfg = cfg["youtube"]
    creds = credentials(cfg.resolve(ycfg["client_secrets"]), cfg.resolve(ycfg["token_file"]),
                        open_browser=not getattr(args, "no_browser", False))
    return YouTube(creds)


def _sources(store: Store, cfg, args) -> list[str]:
    """Résout les arguments `video` (chemin ou slug) en slugs enregistrés."""
    slugs = []
    for v in args.video:
        if v in store.sources:
            slugs.append(v)
        elif Path(v).exists():
            slugs.append(pipeline.register_source(store, Path(v), args.title))
        else:
            raise SystemExit(f"Ni fichier ni source connue : {v}")
    store.save()
    return slugs


def cmd_transcribe(cfg, store, args):
    for slug in _sources(store, cfg, args):
        pipeline.step_transcribe(cfg, store, slug, args.force)
        store.save()


def cmd_select(cfg, store, args):
    llm = LLM(fallbacks=cfg["claude"]["fallbacks"])
    for slug in _sources(store, cfg, args):
        pipeline.step_select(cfg, store, llm, slug, args.force)
        store.save()
    print(pipeline.cost_report(cfg, llm))


def cmd_cut(cfg, store, args):
    for slug in _sources(store, cfg, args):
        pipeline.step_cut(cfg, store, slug, args.force)


def cmd_titles(cfg, store, args):
    llm = LLM(fallbacks=cfg["claude"]["fallbacks"])
    for slug in _sources(store, cfg, args):
        pipeline.step_titles(cfg, store, llm, slug, args.force)
    print(pipeline.cost_report(cfg, llm))


def cmd_export(cfg, store, args):
    slugs = _sources(store, cfg, args) if args.video else list(store.sources)
    files = pipeline.step_export(cfg, store, slugs)
    for f in files:
        print(f)
    print(f"{len(files)} fichier(s) texte prêts pour YouTube Studio.")


def cmd_tiktok(cfg, store, args):
    slugs = _sources(store, cfg, args) if args.video else list(store.sources)
    files = [f for slug in slugs for f in pipeline.step_tiktok(cfg, store, slug, args.force)]
    if files:
        print(f"{len(files)} vidéo(s) TikTok prêtes dans : {files[0].parent}")
    else:
        print("Aucun clip titré : lance d'abord `run`.")


def cmd_run(cfg, store, args):
    llm = LLM(fallbacks=cfg["claude"]["fallbacks"])
    for slug in _sources(store, cfg, args):
        pipeline.step_transcribe(cfg, store, slug)
        store.save()
        pipeline.step_select(cfg, store, llm, slug)
        store.save()
        pipeline.step_cut(cfg, store, slug)
        pipeline.step_titles(cfg, store, llm, slug)
    print(pipeline.cost_report(cfg, llm))
    if args.upload:
        pipeline.step_upload(cfg, store, _youtube(cfg, args))


def cmd_upload(cfg, store, args):
    yt = None if args.dry_run else _youtube(cfg, args)
    pipeline.step_upload(cfg, store, yt, args.max, args.dry_run)


def cmd_stats(cfg, store, args):
    rows = pipeline.step_stats(cfg, store, _youtube(cfg, args), cfg.resolve(args.csv))
    for r in rows:
        print(f"{r['avg_view_pct']:5.1f} %  {r['avg_view_duration_s']:6.1f} s  "
              f"{r['views']:7d} vues  {r['clip']}  {r['title']}")
    if rows:
        print(f"→ {args.csv}")


def cmd_auth(cfg, store, args):
    _youtube(cfg, args)
    print("Autorisation YouTube enregistrée.")


def cmd_status(cfg, store, args):
    ycfg = cfg["youtube"]
    quota = Quota(store.data["quota"], ycfg)
    per_clip = clip_cost(ycfg)
    print(f"Quota du jour ({quota.day}, heure du Pacifique) : {quota.used}/{quota.limit} "
          f"unités ; {per_clip} par clip → {quota.remaining // per_clip} clip(s) restant(s), "
          f"{quota.limit // per_clip} par jour au maximum.")
    for slug, src in store.sources.items():
        clips = store.clips_of(slug)
        counts: dict[str, int] = {}
        for c in clips:
            counts[c["status"]] = counts.get(c["status"], 0) + 1
        detail = ", ".join(f"{k} : {v}" for k, v in counts.items()) or "aucun clip"
        print(f"- {slug} ({src['title']}) — {detail}")
        for c in clips:
            when = c.get("youtube", {}).get("publish_at", "")
            print(f"    {c['index']:02d} [{c['status']:8}] {c['end'] - c['start']:5.0f} s  "
                  f"score {c['score']:2d}  {when:20}  {c.get('title') or c['hook']}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="clipper",
                                description="Vidéo longue → clips YouTube programmés.")
    p.add_argument("-c", "--config", default="config.yaml")
    p.add_argument("-v", "--verbose", action="store_true")
    sub = p.add_subparsers(dest="command", required=True)

    def with_videos(sp, force=True):
        sp.add_argument("video", nargs="+", help="fichier vidéo ou slug d'une source connue")
        sp.add_argument("--title", help="titre de la vidéo source (sinon nom du fichier)")
        if force:
            sp.add_argument("--force", action="store_true", help="refaire l'étape")
        return sp

    with_videos(sub.add_parser("transcribe", help="Deepgram → phrases horodatées")) \
        .set_defaults(func=cmd_transcribe)
    with_videos(sub.add_parser("select", help="Claude choisit les clips")) \
        .set_defaults(func=cmd_select)
    with_videos(sub.add_parser("cut", help="découpe ffmpeg + .srt")).set_defaults(func=cmd_cut)
    with_videos(sub.add_parser("titles", help="titres, descriptions, miniatures")) \
        .set_defaults(func=cmd_titles)
    run = with_videos(sub.add_parser("run", help="toutes les étapes jusqu'aux miniatures"),
                      force=False)
    run.add_argument("--upload", action="store_true", help="puis publier dans la limite du quota")
    run.add_argument("--no-browser", action="store_true")
    run.set_defaults(func=cmd_run)

    ex = sub.add_parser("export", help="fichiers .txt (titre, description, tags) pour "
                                       "publier à la main dans YouTube Studio")
    ex.add_argument("video", nargs="*", help="sources (toutes par défaut)")
    ex.add_argument("--title", help=argparse.SUPPRESS)
    ex.set_defaults(func=cmd_export)

    tk = sub.add_parser("tiktok", help="versions verticales 9:16 des clips, pour TikTok")
    tk.add_argument("video", nargs="*", help="sources (toutes par défaut)")
    tk.add_argument("--title", help=argparse.SUPPRESS)
    tk.add_argument("--force", action="store_true", help="refaire les vidéos existantes")
    tk.set_defaults(func=cmd_tiktok)

    up = sub.add_parser("upload", help="publier (programmé) les clips prêts, dans le quota")
    up.add_argument("--max", type=int, help="nombre maximal de clips")
    up.add_argument("--dry-run", action="store_true", help="simuler sans appeler YouTube")
    up.add_argument("--no-browser", action="store_true")
    up.set_defaults(func=cmd_upload)

    st = sub.add_parser("stats", help="durée moyenne de visionnage (YouTube Analytics)")
    st.add_argument("--csv", default="state/stats.csv")
    st.add_argument("--no-browser", action="store_true")
    st.set_defaults(func=cmd_stats)

    au = sub.add_parser("auth", help="autoriser l'accès YouTube (OAuth)")
    au.add_argument("--no-browser", action="store_true")
    au.set_defaults(func=cmd_auth)

    sub.add_parser("status", help="état des clips et du quota").set_defaults(func=cmd_status)
    return p


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    for noisy in ("httpx", "httpcore", "googleapiclient.discovery"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    cfg = load_config(args.config)
    store = Store.open(cfg.state_dir)
    try:
        args.func(cfg, store, args)
    except LLMError as e:
        raise SystemExit(f"Erreur Claude : {e}") from e
    finally:
        store.save()
