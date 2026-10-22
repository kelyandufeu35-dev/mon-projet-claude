"""Base d'état JSON : sources, clips, consommation de quota."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

# Cycle de vie d'un clip.
SELECTED, CUT, TITLED, UPLOADED = "selected", "cut", "titled", "uploaded"


class Store:
    def __init__(self, path: Path):
        self.path = path
        if path.exists():
            self.data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
        else:
            self.data = {}
        self.data.setdefault("sources", {})
        self.data.setdefault("clips", {})
        self.data.setdefault("quota", {})

    @classmethod
    def open(cls, state_dir: Path) -> "Store":
        state_dir.mkdir(parents=True, exist_ok=True)
        return cls(state_dir / "db.json")

    def save(self) -> None:
        # Écriture atomique : on ne corrompt jamais la base en cas d'interruption.
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self.path)

    @property
    def sources(self) -> dict[str, dict]:
        return self.data["sources"]

    @property
    def clips(self) -> dict[str, dict]:
        return self.data["clips"]

    def clips_of(self, slug: str) -> list[dict]:
        clips = [c for c in self.clips.values() if c["source"] == slug]
        return sorted(clips, key=lambda c: c["index"])

    def clips_with_status(self, status: str) -> list[dict]:
        clips = [c for c in self.clips.values() if c["status"] == status]
        return sorted(clips, key=lambda c: (c["source"], c["index"]))
