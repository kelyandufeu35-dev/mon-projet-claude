"""Bout en bout sur une vraie vidéo ffmpeg, avec Claude et YouTube simulés."""

import json
import subprocess
from pathlib import Path

import pytest
from PIL import Image

from clipper import pipeline
from clipper.media import probe_duration
from clipper.quota import quota_day
from clipper.state import TITLED, UPLOADED, Store

from conftest import make_sentences


class FakeYouTube:
    def __init__(self, fail_thumbnail_once=False):
        self.calls = []
        self.fail_thumbnail_once = fail_thumbnail_once

    def upload(self, video, meta, publish_at, ycfg):
        assert Path(video).exists()
        self.calls.append(("upload", meta["title"], publish_at))
        return f"vid{len(self.calls)}"

    def set_thumbnail(self, video_id, image):
        if self.fail_thumbnail_once:
            self.fail_thumbnail_once = False
            raise RuntimeError("réseau")
        self.calls.append(("thumbnail", video_id))

    def add_to_playlist(self, video_id, playlist_id):
        self.calls.append(("playlist", video_id, playlist_id))

    def upload_captions(self, video_id, srt, language, name):
        assert Path(srt).read_text().startswith("1\n")
        self.calls.append(("captions", video_id))

    def video_metrics(self, ids, start, end):
        return {vid: {"views": 1000, "avg_view_duration": 30.0 + n, "avg_view_pct": 40.0 + n}
                for n, vid in enumerate(ids)}


@pytest.fixture
def prepared(cfg, test_video):
    store = Store.open(cfg.state_dir)
    slug = pipeline.register_source(store, test_video, "Ma longue vidéo")
    sentences = make_sentences(33)  # 6 s par phrase → 198 s
    (cfg.source_dir(slug) / "transcript.json").write_text(
        json.dumps({"duration": 198.0, "sentences": sentences}))
    return store, slug


def selection_reply():
    return {"clips": [
        {"start": 1, "end": 8, "score": 7, "hook": "h1", "reason": "r"},
        {"start": 10, "end": 18, "score": 9, "hook": "h2", "reason": "r"},
        {"start": 20, "end": 28, "score": 6, "hook": "h3", "reason": "r"},
    ]}


def titles_reply(n):
    return {"items": [{"clip": k, "title": f"Titre {k}", "description": "Desc.",
                       "tags": ["podcast", "interview"], "thumbnail_text": "Choc total"}
                      for k in range(1, n + 1)]}


def test_full_pipeline(cfg, prepared, fake_llm):
    store, slug = prepared
    cfg.raw["youtube"]["playlist_id"] = "PL123"
    llm = fake_llm([selection_reply(), titles_reply(3)])

    clips = pipeline.step_select(cfg, store, llm, slug)
    assert [c["id"] for c in clips] == [f"{slug}-01", f"{slug}-02", f"{slug}-03"]
    assert clips[0]["start"] == 6.0 and clips[0]["excerpt"].startswith("mot1_0")
    system = llm.client.calls[0]["system"]
    assert "45" in system and "180" in system
    assert "[#1 00:06 S1] mot1_0" in llm.client.calls[0]["messages"][0]["content"]

    pipeline.step_cut(cfg, store, slug)
    c1 = store.clips[f"{slug}-01"]
    expected = (c1["end"] + 0.40) - (c1["start"] - 0.15)
    assert probe_duration(Path(c1["video"])) == pytest.approx(expected, abs=0.08)
    assert Path(c1["srt"]).read_text().startswith("1\n00:00:00,150 --> ")

    pipeline.step_titles(cfg, store, llm, slug)
    assert all(c["status"] == TITLED for c in store.clips_of(slug))
    assert "Ma longue vidéo" in c1["description"]
    with Image.open(c1["thumbnail"]) as im:
        assert im.size == (1280, 720)
    info = Path(c1["video"]).with_suffix(".txt").read_bytes().decode("utf-8")
    assert info.startswith("TITRE\r\nTitre 1\r\n\r\nDESCRIPTION\r\nDesc.")
    assert "podcast, interview" in info and "Miniature : 01.jpg" in info
    assert len(pipeline.step_export(cfg, store, [slug])) == 3

    tiktok = pipeline.step_tiktok(cfg, store, slug)
    assert len(tiktok) == 3 and tiktok[0].name == "01.mp4"
    size = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                           "stream=width,height", "-of", "csv=p=0", str(tiktok[0])],
                          capture_output=True, text=True, check=True).stdout.strip()
    assert size == "1080,1920"
    assert probe_duration(tiktok[0]) == pytest.approx(expected, abs=0.08)
    caption = tiktok[0].with_suffix(".txt").read_text(encoding="utf-8")
    assert caption.startswith("Titre 1\n\n#podcast #interview #clip")

    # 3 clips × 2100 unités (insert + miniature + playlist + sous-titres) : on en publie 3
    # le jour même seulement si le quota le permet (10000 // 2100 = 4).
    yt = FakeYouTube()
    pipeline.step_upload(cfg, store, yt)
    assert all(c["status"] == UPLOADED for c in store.clips_of(slug))
    assert sum(store.data["quota"].values()) == 3 * 2100
    publish = [c["youtube"]["publish_at"] for c in store.clips_of(slug)]
    assert len(set(publish)) == 3 and publish == sorted(publish)
    assert [k[0] for k in yt.calls[:4]] == ["upload", "thumbnail", "playlist", "captions"]

    rows = pipeline.step_stats(cfg, store, yt, cfg.state_dir / "stats.csv")
    assert len(rows) == 3 and (cfg.state_dir / "stats.csv").exists()


def test_upload_stops_at_quota_and_resumes_partial(cfg, prepared, fake_llm):
    store, slug = prepared
    cfg.raw["youtube"].update(playlist_id=None, upload_captions=False)  # 1700 / clip
    llm = fake_llm([selection_reply(), titles_reply(3)])
    pipeline.step_select(cfg, store, llm, slug)
    pipeline.step_cut(cfg, store, slug)
    pipeline.step_titles(cfg, store, llm, slug)
    day = quota_day()
    store.data["quota"][day] = 10000 - 1700 - 100  # place pour un seul clip

    pipeline.step_upload(cfg, store, FakeYouTube(), dry_run=True)
    assert store.data["quota"][day] == 10000 - 1800  # la simulation ne consomme rien
    assert all(c["status"] == TITLED for c in store.clips_of(slug))

    yt = FakeYouTube(fail_thumbnail_once=True)
    with pytest.raises(RuntimeError):
        pipeline.step_upload(cfg, store, yt)
    c1 = store.clips_of(slug)[0]
    assert c1["status"] == UPLOADED and c1["youtube"]["done"] == ["videos.insert"]

    # Relance : seule la miniature est refaite, pas un second upload.
    pipeline.step_upload(cfg, store, yt)
    assert [k[0] for k in yt.calls] == ["upload", "thumbnail"]
    # 1600 (upload) + 50 (miniature en échec, facturée quand même) + 50 (miniature).
    assert store.data["quota"][day] == 10000 - 100 - 1700 + 1600 + 50 + 50
    assert [c["status"] for c in store.clips_of(slug)] == [UPLOADED, TITLED, TITLED]


def test_feedback_examples_reach_the_prompt(cfg, prepared, fake_llm):
    store, slug = prepared
    for n, pct in enumerate([70.0, 20.0, 50.0]):
        store.clips[f"old-{n}"] = {
            "id": f"old-{n}", "source": "old", "index": n, "status": UPLOADED,
            "start": 0, "end": 60, "score": 5, "title": f"Ancien {pct:.0f}",
            "excerpt": "texte", "youtube": {"publish_at": "2026-01-01T10:00:00Z"},
            "metrics": {"views": 500, "avg_view_duration": 30, "avg_view_pct": pct}}
    llm = fake_llm([selection_reply()])
    pipeline.step_select(cfg, store, llm, slug)
    prompt = llm.client.calls[0]["messages"][0]["content"]
    assert prompt.index("Ancien 70") < prompt.index("Ancien 20")
    assert "retiennent le mieux" in prompt and "retiennent le moins" in prompt
