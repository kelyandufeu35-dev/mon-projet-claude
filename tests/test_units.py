from datetime import datetime, timezone

import pytest

from clipper import selection
from clipper.llm import FALLBACK_BETA
from clipper.media import build_srt
from clipper.quota import Quota, clip_cost, next_slots, quota_day
from clipper.titles import clean_tags
from clipper.transcribe import build_sentences, deepgram_cost

from conftest import make_sentences


def dg_word(word, start, end, speaker=0):
    return {"word": word.strip(".?!").lower(), "punctuated_word": word,
            "start": start, "end": end, "speaker": speaker, "confidence": 0.99}


def test_build_sentences_splits_on_punctuation_speaker_and_gap():
    words = [dg_word("Bonjour", 0.0, 0.4), dg_word("à", 0.5, 0.6), dg_word("tous.", 0.6, 1.0),
             dg_word("Alors", 1.2, 1.5), dg_word("voilà", 1.6, 2.0),
             dg_word("Oui", 2.1, 2.3, speaker=1),
             dg_word("après", 5.0, 5.3, speaker=1), dg_word("silence", 5.4, 5.8, speaker=1)]
    dg = {"results": {"channels": [{"alternatives": [{"words": words}]}]}}
    s = build_sentences(dg)
    assert [x["text"] for x in s] == ["Bonjour à tous.", "Alors voilà", "Oui", "après silence"]
    assert [x["speaker"] for x in s] == [0, 0, 1, 1]
    assert [x["i"] for x in s] == [0, 1, 2, 3]
    assert s[1]["start"] == 1.2 and s[1]["end"] == 2.0
    assert s[0]["words"][2] == {"w": "tous.", "s": 0.6, "e": 1.0}


def test_format_sentences():
    s = [{"i": 123, "start": 754.2, "speaker": 1, "text": "Salut."},
         {"i": 124, "start": 3725.0, "speaker": 0, "text": "Ok."}]
    assert selection.format_sentences(s) == "[#123 12:34 S1] Salut.\n[#124 1:02:05 S0] Ok."


def test_single_chunk_under_threshold():
    s = make_sentences(100)
    assert selection.chunk_sentences(s, 600_000, 3.2, 40) == [s]


def test_chunks_cover_everything_with_overlap():
    s = make_sentences(300)
    chunks = selection.chunk_sentences(s, 2000, 3.2, 10)
    assert len(chunks) > 1
    assert chunks[0][0]["i"] == 0 and chunks[-1][-1]["i"] == 299
    for a, b in zip(chunks, chunks[1:]):
        assert b[0]["i"] == a[-1]["i"] + 1 - 10  # 10 phrases de recouvrement


def test_validator_reports_each_problem():
    s = make_sentences(100)          # 6 s par phrase
    v = selection.make_validator(s, s[:50], 45, 180)
    ok = {"start": 0, "end": 9, "score": 8, "hook": "", "reason": ""}         # ~60 s
    assert v({"clips": [ok]}) == []
    errors = v({"clips": [
        ok,
        {"start": 5, "end": 15, "score": 7, "hook": "", "reason": ""},      # chevauche
        {"start": 20, "end": 21, "score": 7, "hook": "", "reason": ""},     # trop court
        {"start": 40, "end": 60, "score": 7, "hook": "", "reason": ""},     # hors bloc
        {"start": 30, "end": 25, "score": 7, "hook": "", "reason": ""},     # inversé
        {"start": 30, "end": 39, "score": 11, "hook": "", "reason": ""},    # score
    ]})
    assert len(errors) == 5
    assert "chevauche" in errors[0] and "dure" in errors[1] and "hors de la plage" in errors[2]
    assert "après" in errors[3] and "score" in errors[4]


def test_drop_invalid_and_merge():
    s = make_sentences(100)
    v = selection.make_validator(s, s, 45, 180)
    clips = [{"start": 0, "end": 9, "score": 5}, {"start": 3, "end": 12, "score": 9},
             {"start": 20, "end": 21, "score": 9}, {"start": 40, "end": 50, "score": 7}]
    kept = selection.drop_invalid(clips, v)
    assert [c["start"] for c in kept] == [0, 40]
    merged = selection.merge(clips[:2] + clips[3:], limit=2)
    assert [(c["start"], c["score"]) for c in merged] == [(3, 9), (40, 7)]


def test_srt_is_offset_and_wrapped():
    s = make_sentences(10, seconds=4.0, words_per=8)
    cfg = {"max_chars_per_line": 20, "max_lines": 2, "max_cue_duration_s": 5.0,
           "min_gap_split_s": 0.6}
    srt = build_srt(s, 8.0, 16.0, cfg)
    blocks = srt.strip().split("\n\n")
    assert blocks[0].startswith("1\n00:00:00,000 --> ")
    assert "mot2_0" in blocks[0] and "mot1_" not in srt and "mot4_" not in srt
    for b in blocks:
        lines = b.split("\n")
        assert len(lines) <= 4 and all(len(x) <= 20 for x in lines[2:])


def test_quota_costs_and_daily_capacity(cfg):
    y = dict(cfg["youtube"], upload_captions=False, playlist_id="PL1")
    assert clip_cost(y) == 1700
    assert 10000 // clip_cost(y) == 5
    assert clip_cost(dict(y, upload_captions=True)) == 2100


def test_quota_day_is_pacific():
    # 06:00 UTC le 23 = 23:00 la veille à Los Angeles.
    assert quota_day(datetime(2026, 10, 23, 6, 0, tzinfo=timezone.utc)) == "2026-10-22"
    ledger = {"2026-10-01": 500, "2026-10-22": 3400}
    q = Quota(ledger, {"quota": {"daily_limit": 10000, "costs": {"videos.insert": 1600}}},
              now=datetime(2026, 10, 23, 6, 0, tzinfo=timezone.utc))
    assert q.used == 3400 and "2026-10-01" not in ledger
    q.spend("videos.insert")
    assert ledger["2026-10-22"] == 5000


def test_next_slots_skip_taken_and_lead_time():
    scfg = {"timezone": "Europe/Paris", "times": ["18:00", "12:00"], "min_lead_minutes": 90}
    now = datetime(2026, 10, 22, 9, 0, tzinfo=timezone.utc)  # 11:00 à Paris
    # 12:00 Paris est trop proche (lead 90 min) ; 18:00 Paris = 16:00 UTC est déjà pris.
    slots = next_slots(3, ["2026-10-22T16:00:00Z"], scfg, now)
    assert slots == ["2026-10-23T10:00:00Z", "2026-10-23T16:00:00Z", "2026-10-24T10:00:00Z"]


def test_clean_tags_dedupes_and_limits():
    tags = clean_tags(["#Podcast", "podcast", "a<b", "x" * 300, "y" * 300], ["défaut"])
    assert tags[:3] == ["défaut", "Podcast", "ab"]
    assert len(",".join(tags)) <= 500


def test_deepgram_cost():
    cfg = {"price_per_min": 0.0043, "diarization_price_per_min": 0.002, "diarize": True}
    assert deepgram_cost(3600, cfg) == pytest.approx(60 * 0.0063)


def test_llm_retries_with_error_feedback(fake_llm):
    s = make_sentences(100)
    bad = {"clips": [{"start": 0, "end": 2, "score": 8, "hook": "h", "reason": "r"}]}
    good = {"clips": [{"start": 0, "end": 9, "score": 8, "hook": "h", "reason": "r"}]}
    llm = fake_llm([bad, good])
    v = selection.make_validator(s, s, 45, 180)
    data, errors = llm.structured(model_cfg={"model": "m", "max_tokens": 10, "effort": "high"},
                                  system="sys", user="u", schema={}, validate=v, max_retries=2)
    assert data == good and errors == []
    first, second = llm.client.calls
    assert "tool_choice" not in first  # forcé = 400 sur Opus 5.5 / Sonnet 5.5
    assert first["output_config"]["format"]["type"] == "json_schema"
    assert first["fallbacks"] == "default" and first["betas"] == [FALLBACK_BETA]
    # Relance en ajout seul : même préfixe, puis réponse + corrections.
    assert second["messages"][0] == first["messages"][0]
    assert [m["role"] for m in second["messages"]] == ["user", "assistant", "user"]
    assert "dure" in second["messages"][2]["content"]
    assert llm.usage["m"].calls == 2


def test_tiktok_ass_layout(cfg):
    from clipper.vertical import build_ass, caption_chunks, hashtag
    s = make_sentences(4, seconds=3.0, words_per=5)
    chunks = caption_chunks([w for x in s for w in x["words"]], max_words=3, max_chars=18)
    assert all(len(c) <= 3 for c in chunks)
    # Une fin de phrase termine toujours un groupe.
    assert all("." not in w["w"] for c in chunks for w in c[:-1])
    ass = build_ass(s, 2.9, 9.0, "Un titre {avec} accolades", cfg["tiktok"])
    assert "PlayResX: 1080" in ass and "PlayResY: 1920" in ass
    assert "&H0000D4FF" in ass                          # jaune #FFD400 en BGR
    assert "Title,,0,0,0,,Un titre (avec)\\Naccolades" in ass   # accolades neutralisées, retour à la ligne
    subs = [l for l in ass.splitlines() if ",Sub," in l]
    assert subs[0].startswith("Dialogue: 1,0:00:00.10,") and "MOT1_0" in subs[0]
    assert "MOT3_" not in ass                           # hors du clip
    assert hashtag("anyme déménagement") == "#anymedemenagement"
