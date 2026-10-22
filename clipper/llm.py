"""Appel Claude commun : sortie JSON contrainte par schéma, validation Python, relances.

Le tool_choice forcé ("any"/"tool") renvoie une 400 sur Claude Opus 5.5 et Sonnet 5.5.
On obtient la même garantie avec les sorties structurées (output_config.format) :
le JSON respecte le schéma, puis un validateur Python vérifie la sémantique
(indices existants, durées…) et renvoie les erreurs à Claude dans le même fil.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Callable

import anthropic

log = logging.getLogger(__name__)

FALLBACK_BETA = "server-side-fallback-2026-07-01"

# validate(data) -> liste d'erreurs lisibles (vide = OK).
Validator = Callable[[dict], list[str]]


class LLMError(RuntimeError):
    pass


@dataclass
class Usage:
    input_tokens: int = 0
    cache_write_tokens: int = 0
    cache_read_tokens: int = 0
    output_tokens: int = 0
    calls: int = 0

    def add(self, u: Any) -> None:
        self.calls += 1
        self.input_tokens += u.input_tokens or 0
        self.cache_write_tokens += getattr(u, "cache_creation_input_tokens", 0) or 0
        self.cache_read_tokens += getattr(u, "cache_read_input_tokens", 0) or 0
        self.output_tokens += u.output_tokens or 0

    def cost(self, price_in: float, price_out: float) -> float:
        # Écriture de cache = 1,25 × entrée ; lecture = 0,1 × entrée.
        tokens_in = (self.input_tokens + 1.25 * self.cache_write_tokens
                     + 0.1 * self.cache_read_tokens)
        return (tokens_in * price_in + self.output_tokens * price_out) / 1e6


@dataclass
class LLM:
    client: anthropic.Anthropic = field(default_factory=anthropic.Anthropic)
    fallbacks: str | None = "default"
    usage: dict[str, Usage] = field(default_factory=dict)

    def structured(self, *, model_cfg: dict, system: str, user: str, schema: dict,
                   validate: Validator | None = None, max_retries: int = 0,
                   label: str = "") -> tuple[dict, list[str]]:
        """Renvoie (données, erreurs restantes après la dernière relance)."""
        messages: list[dict] = [{"role": "user", "content": user}]
        usage = self.usage.setdefault(model_cfg["model"], Usage())
        errors: list[str] = []
        for attempt in range(max_retries + 1):
            message = self._call(model_cfg, system, messages, schema)
            usage.add(message.usage)
            data = _parse(message)
            errors = validate(data) if validate else []
            if not errors:
                return data, []
            log.warning("%s : %d erreur(s) de validation (essai %d/%d)",
                        label, len(errors), attempt + 1, max_retries + 1)
            # Historique en ajout seul : on renvoie la réponse telle quelle
            # (blocs de réflexion compris) puis les corrections demandées.
            messages.append({"role": "assistant", "content": message.content})
            messages.append({"role": "user", "content": (
                "Ta réponse contient des erreurs :\n- " + "\n- ".join(errors)
                + "\n\nRenvoie la liste complète corrigée, au même format.")})
        return data, errors

    def _call(self, model_cfg: dict, system: str, messages: list[dict], schema: dict):
        kwargs: dict[str, Any] = dict(
            model=model_cfg["model"],
            max_tokens=model_cfg["max_tokens"],
            system=system,
            messages=messages,
            thinking={"type": "adaptive"},
            output_config={"effort": model_cfg["effort"],
                           "format": {"type": "json_schema", "schema": schema}},
            # Cache automatique du préfixe : les relances relisent la transcription en cache.
            cache_control={"type": "ephemeral"},
        )
        if self.fallbacks:
            kwargs.update(fallbacks=self.fallbacks, betas=[FALLBACK_BETA])
        try:
            with self.client.beta.messages.stream(**kwargs) as stream:
                message = stream.get_final_message()
        except anthropic.BadRequestError as e:
            raise LLMError(f"Requête refusée par l'API : {e.message}") from e
        except anthropic.AuthenticationError as e:
            raise LLMError("Clé Anthropic invalide ou absente (ANTHROPIC_API_KEY).") from e
        if message.stop_reason == "refusal":
            details = message.stop_details
            raise LLMError(f"Refus du modèle ({details.category if details else 'inconnu'}).")
        if message.stop_reason == "max_tokens":
            raise LLMError("Réponse tronquée : augmente max_tokens dans config.yaml.")
        return message


def _parse(message: Any) -> dict:
    text = "".join(b.text for b in message.content if b.type == "text")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise LLMError(f"JSON invalide renvoyé par le modèle : {e}") from e
