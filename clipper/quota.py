"""Comptabilité du quota YouTube Data v3 et créneaux de publication programmée."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Iterable
from zoneinfo import ZoneInfo

# Le quota YouTube est remis à zéro à minuit, heure du Pacifique.
PACIFIC = ZoneInfo("America/Los_Angeles")


def quota_day(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    return now.astimezone(PACIFIC).date().isoformat()


def steps_for_clip(ycfg: dict[str, Any]) -> list[str]:
    steps = ["videos.insert", "thumbnails.set"]
    if ycfg.get("playlist_id"):
        steps.append("playlistItems.insert")
    if ycfg.get("upload_captions"):
        steps.append("captions.insert")
    return steps


def clip_cost(ycfg: dict[str, Any]) -> int:
    costs = ycfg["quota"]["costs"]
    return sum(costs[s] for s in steps_for_clip(ycfg))


class Quota:
    """Unités consommées aujourd'hui, persistées dans la base d'état."""

    def __init__(self, ledger: dict[str, int], ycfg: dict[str, Any], now: datetime | None = None):
        self.ledger = ledger
        self.costs = ycfg["quota"]["costs"]
        self.limit = ycfg["quota"]["daily_limit"]
        self.day = quota_day(now)
        # On ne garde qu'une semaine d'historique.
        for old in [d for d in ledger if d < (date.fromisoformat(self.day) - timedelta(7)).isoformat()]:
            del ledger[old]

    @property
    def used(self) -> int:
        return self.ledger.get(self.day, 0)

    @property
    def remaining(self) -> int:
        return self.limit - self.used

    def can(self, units: int) -> bool:
        return units <= self.remaining

    def spend(self, method: str) -> None:
        # Comptée à la tentative : Google facture aussi les requêtes en échec.
        self.ledger[self.day] = self.used + self.costs[method]


def next_slots(n: int, taken: Iterable[str], scfg: dict[str, Any],
               now: datetime | None = None) -> list[str]:
    """Les n prochains créneaux libres, au format RFC 3339 UTC attendu par publishAt."""
    tz = ZoneInfo(scfg["timezone"])
    now = (now or datetime.now(timezone.utc)).astimezone(tz)
    earliest = now + timedelta(minutes=scfg["min_lead_minutes"])
    taken_set = set(taken)
    times = sorted(time.fromisoformat(t) for t in scfg["times"])
    slots: list[str] = []
    day = now.date()
    while len(slots) < n:
        for t in times:
            local = datetime.combine(day, t, tzinfo=tz)
            iso = local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            if local >= earliest and iso not in taken_set:
                slots.append(iso)
                if len(slots) == n:
                    break
        day += timedelta(days=1)
    return slots
