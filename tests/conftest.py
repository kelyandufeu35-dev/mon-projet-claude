import json
import shutil
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from clipper.config import load_config
from clipper.llm import LLM

ROOT = Path(__file__).resolve().parent.parent


def make_sentences(n: int, seconds: float = 6.0, words_per: int = 6) -> list[dict]:
    """Phrases synthétiques régulières : la phrase i couvre [i*seconds, (i+1)*seconds - 0.2]."""
    out = []
    for i in range(n):
        start = i * seconds
        step = (seconds - 0.2) / words_per
        words = [{"w": f"mot{i}_{k}" + ("." if k == words_per - 1 else ""),
                  "s": round(start + k * step, 3), "e": round(start + (k + 1) * step - 0.05, 3)}
                 for k in range(words_per)]
        out.append({"i": i, "start": words[0]["s"], "end": words[-1]["e"], "speaker": i % 2,
                    "text": " ".join(w["w"] for w in words), "words": words})
    return out


@pytest.fixture
def cfg(tmp_path):
    shutil.copy(ROOT / "config.yaml", tmp_path / "config.yaml")
    config = load_config(tmp_path / "config.yaml")
    config.raw["cut"]["preset"] = "ultrafast"
    config.raw["thumbnail"]["candidates"] = 4
    return config


class FakeStream:
    def __init__(self, message):
        self.message = message

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get_final_message(self):
        return self.message


class FakeClient:
    """Imite client.beta.messages.stream : renvoie les réponses JSON données, dans l'ordre."""

    def __init__(self, responses: list[dict]):
        self.responses = list(responses)
        self.calls: list[dict] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream))

    def _stream(self, **kwargs):
        # Copie superficielle : la liste messages continue d'être modifiée après l'appel.
        self.calls.append({**kwargs, "messages": list(kwargs["messages"])})
        payload = self.responses.pop(0)
        usage = SimpleNamespace(input_tokens=1000, output_tokens=200,
                                cache_creation_input_tokens=0, cache_read_input_tokens=0)
        message = SimpleNamespace(
            content=[SimpleNamespace(type="text", text=json.dumps(payload))],
            stop_reason="end_turn", stop_details=None, usage=usage)
        return FakeStream(message)


@pytest.fixture
def fake_llm():
    def factory(responses):
        return LLM(client=FakeClient(responses), fallbacks="default")
    return factory


@pytest.fixture(scope="session")
def test_video(tmp_path_factory):
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg absent")
    path = tmp_path_factory.mktemp("video") / "source.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                    "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=200",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=200",
                    "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
                    str(path)], check=True)
    return path
