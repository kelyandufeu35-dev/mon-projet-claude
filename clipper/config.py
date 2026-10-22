"""Chargement de config.yaml et chemins de travail."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass
class Config:
    raw: dict[str, Any]
    root: Path

    def __getitem__(self, key: str) -> Any:
        return self.raw[key]

    @property
    def work_dir(self) -> Path:
        return self.root / self.raw["paths"]["work_dir"]

    @property
    def state_dir(self) -> Path:
        return self.root / self.raw["paths"]["state_dir"]

    def source_dir(self, slug: str) -> Path:
        path = self.work_dir / slug
        path.mkdir(parents=True, exist_ok=True)
        return path

    def resolve(self, path: str) -> Path:
        p = Path(path)
        return p if p.is_absolute() else self.root / p


def load_config(path: str | Path = "config.yaml") -> Config:
    path = Path(path).resolve()
    with path.open(encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    return Config(raw=raw, root=path.parent)


def slugify(text: str, max_len: int = 60) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text[:max_len].rstrip("-") or "video"
