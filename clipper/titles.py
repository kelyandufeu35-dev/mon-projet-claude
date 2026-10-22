"""Titres, descriptions, tags et texte de miniature (Claude Sonnet), un appel par vidéo source."""

from __future__ import annotations

from typing import Any

from .llm import LLM

SYSTEM = """Tu écris les métadonnées YouTube de clips extraits d'une vidéo francophone.
Pour chaque clip :
- `title` : titre accrocheur et honnête, en français, {max_title} caractères maximum, \
sans guillemets décoratifs, sans « < » ni « > », pas tout en majuscules ;
- `description` : 2 à 4 phrases qui donnent envie de regarder, sans « < » ni « > » ;
- `tags` : 5 à 12 mots-clés de recherche (sans #) ;
- `thumbnail_text` : 2 à 5 mots percutants incrustés sur la miniature, \
{max_thumb} caractères maximum, complémentaires du titre (ne le répète pas).
Les titres des différents clips doivent être variés dans leur forme."""

SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "clip": {"type": "integer"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "thumbnail_text": {"type": "string"},
                },
                "required": ["clip", "title", "description", "tags", "thumbnail_text"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}

TAGS_MAX_CHARS = 500  # limite YouTube, virgules comprises


def clip_text(sentences: list[dict], clip: dict) -> str:
    return " ".join(s["text"] for s in sentences[clip["start_sentence"]:clip["end_sentence"] + 1])


def make_validator(clip_numbers: set[int], max_title: int, max_thumb: int):
    def validate(data: dict) -> list[str]:
        errors = []
        seen = {it["clip"] for it in data["items"]}
        if missing := clip_numbers - seen:
            errors.append(f"clips manquants : {sorted(missing)}")
        for it in data["items"]:
            n = it["clip"]
            if n not in clip_numbers:
                errors.append(f"clip {n} inconnu")
            if not it["title"].strip() or len(it["title"]) > max_title:
                errors.append(f"clip {n} : titre vide ou > {max_title} caractères")
            if any(ch in it["title"] + it["description"] for ch in "<>"):
                errors.append(f"clip {n} : « < » et « > » sont interdits par YouTube")
            if len(it["thumbnail_text"]) > max_thumb:
                errors.append(f"clip {n} : thumbnail_text > {max_thumb} caractères")
        return errors

    return validate


def clean_tags(tags: list[str], extra: list[str]) -> list[str]:
    out: list[str] = []
    for tag in [*extra, *tags]:
        tag = tag.replace("<", "").replace(">", "").replace(",", " ").strip().lstrip("#")
        if not tag or tag.lower() in (t.lower() for t in out):
            continue
        if len(",".join(out + [tag])) > TAGS_MAX_CHARS:
            break
        out.append(tag)
    return out


def generate_titles(llm: LLM, clips: list[dict], sentences: list[dict], source_title: str,
                    cfg: Any, examples: dict[str, list[dict]] | None = None) -> dict[int, dict]:
    tcfg, model_cfg = cfg["titles"], cfg["claude"]["titles"]
    max_title, max_thumb = tcfg["max_title_chars"], cfg["thumbnail"]["max_chars"]
    system = SYSTEM.format(max_title=max_title, max_thumb=max_thumb)

    parts = [f"Vidéo source : « {source_title} »\n"]
    if examples and examples.get("top"):
        parts.append("Titres de clips passés qui ont le mieux retenu le public :")
        parts += [f"- {e['title']} ({e['avg_view_pct']:.0f} % regardés)" for e in examples["top"]]
        parts.append("")
    for c in clips:
        parts.append(f'<clip numero="{c["index"]}" duree="{c["end"] - c["start"]:.0f}s">\n'
                     f"Accroche repérée : {c['hook']}\n{clip_text(sentences, c)}\n</clip>")
    user = "\n".join(parts)

    numbers = {c["index"] for c in clips}
    validate = make_validator(numbers, max_title, max_thumb)
    data, _ = llm.structured(model_cfg=model_cfg, system=system, user=user, schema=SCHEMA,
                             validate=validate, max_retries=2, label="titres")

    footer = tcfg["description_footer"].format(source_title=source_title)
    result: dict[int, dict] = {}
    for it in data["items"]:
        if it["clip"] not in numbers:
            continue
        title = it["title"].replace("<", "").replace(">", "").strip()[:max_title]
        desc = it["description"].replace("<", "").replace(">", "").strip()
        result[it["clip"]] = {
            "title": title,
            "description": (desc + footer)[:5000],
            "tags": clean_tags(it["tags"], tcfg["default_tags"]),
            "thumbnail_text": it["thumbnail_text"].strip()[:max_thumb],
        }
    return result
