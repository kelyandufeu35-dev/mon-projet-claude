"""YouTube Data v3 (upload programmé, miniature, playlist, sous-titres) et Analytics v2."""

from __future__ import annotations

import logging
import random
import time
from datetime import date
from pathlib import Path
from typing import Any, Callable

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

log = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    # Miniatures, playlists et sous-titres (captions.insert exige force-ssl).
    "https://www.googleapis.com/auth/youtube.force-ssl",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]
RETRYABLE_STATUS = {500, 502, 503, 504}
CHUNK_SIZE = 16 * 1024 * 1024


def credentials(client_secrets: Path, token_file: Path, open_browser: bool = True) -> Credentials:
    creds = None
    if token_file.exists():
        creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)
    if creds and creds.valid:
        return creds
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    else:
        if not client_secrets.exists():
            raise SystemExit(f"Fichier OAuth introuvable : {client_secrets} "
                             "(Google Cloud Console → Identifiants → ID client OAuth « Bureau »).")
        flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets), SCOPES)
        creds = flow.run_local_server(port=0, open_browser=open_browser)
    token_file.parent.mkdir(parents=True, exist_ok=True)
    token_file.write_text(creds.to_json(), encoding="utf-8")
    return creds


def _with_retries(fn: Callable[[], Any], what: str, attempts: int = 5) -> Any:
    for attempt in range(attempts):
        try:
            return fn()
        except HttpError as e:
            if e.resp.status not in RETRYABLE_STATUS or attempt == attempts - 1:
                raise
            err: Exception = e
        except (ConnectionError, TimeoutError, OSError) as e:
            if attempt == attempts - 1:
                raise
            err = e
        delay = 2 ** attempt + random.random()
        log.warning("%s : %s, nouvel essai dans %.0fs", what, err, delay)
        time.sleep(delay)


class YouTube:
    def __init__(self, creds: Credentials):
        self.api = build("youtube", "v3", credentials=creds, cache_discovery=False)
        self.analytics = build("youtubeAnalytics", "v2", credentials=creds, cache_discovery=False)

    def upload(self, video: Path, meta: dict[str, Any], publish_at: str,
               ycfg: dict[str, Any]) -> str:
        body = {
            "snippet": {
                "title": meta["title"],
                "description": meta["description"],
                "tags": meta["tags"],
                "categoryId": ycfg["category_id"],
                "defaultLanguage": ycfg["default_language"],
                "defaultAudioLanguage": ycfg["default_language"],
            },
            "status": {
                # publishAt n'est accepté que pour une vidéo privée ; YouTube la
                # rend publique automatiquement à l'heure dite.
                "privacyStatus": "private",
                "publishAt": publish_at,
                "selfDeclaredMadeForKids": ycfg["made_for_kids"],
            },
        }
        media = MediaFileUpload(str(video), mimetype="video/mp4", chunksize=CHUNK_SIZE,
                                resumable=True)
        request = self.api.videos().insert(part="snippet,status", body=body, media_body=media)
        response = None
        while response is None:
            status, response = _with_retries(request.next_chunk, "upload")
            if status:
                log.info("  upload %s : %d %%", video.name, status.progress() * 100)
        return response["id"]

    def set_thumbnail(self, video_id: str, image: Path) -> None:
        media = MediaFileUpload(str(image), mimetype="image/jpeg")
        _with_retries(lambda: self.api.thumbnails().set(videoId=video_id, media_body=media)
                      .execute(), "miniature")

    def add_to_playlist(self, video_id: str, playlist_id: str) -> None:
        body = {"snippet": {"playlistId": playlist_id,
                            "resourceId": {"kind": "youtube#video", "videoId": video_id}}}
        _with_retries(lambda: self.api.playlistItems().insert(part="snippet", body=body)
                      .execute(), "playlist")

    def upload_captions(self, video_id: str, srt: Path, language: str, name: str) -> None:
        body = {"snippet": {"videoId": video_id, "language": language, "name": name}}
        media = MediaFileUpload(str(srt), mimetype="application/octet-stream")
        _with_retries(lambda: self.api.captions().insert(part="snippet", body=body,
                                                         media_body=media).execute(),
                      "sous-titres")

    def video_metrics(self, video_ids: list[str], start: date, end: date) -> dict[str, dict]:
        """views, averageViewDuration (s), averageViewPercentage par vidéo."""
        out: dict[str, dict] = {}
        for k in range(0, len(video_ids), 200):
            batch = video_ids[k:k + 200]
            resp = _with_retries(lambda: self.analytics.reports().query(
                ids="channel==MINE", startDate=start.isoformat(), endDate=end.isoformat(),
                metrics="views,averageViewDuration,averageViewPercentage",
                dimensions="video", filters="video==" + ",".join(batch),
                maxResults=len(batch)).execute(), "analytics")
            cols = [h["name"] for h in resp.get("columnHeaders", [])]
            for row in resp.get("rows", []):
                r = dict(zip(cols, row))
                out[r["video"]] = {"views": int(r["views"]),
                                   "avg_view_duration": float(r["averageViewDuration"]),
                                   "avg_view_pct": float(r["averageViewPercentage"])}
        return out
