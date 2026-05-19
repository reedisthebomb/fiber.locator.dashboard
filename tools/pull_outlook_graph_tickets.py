#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


GRAPH_BASE = "https://graph.microsoft.com/v1.0"
AUTH_BASE = "https://login.microsoftonline.com"
DEFAULT_SCOPE = "offline_access Mail.Read User.Read"
TICKET_RE = re.compile(r"\b\d{6}-\d{4}\b")
ONECALL_RE = re.compile(r"Arkansas One Call|AR One Call|811|geocall@arkonecall\.com", re.I)


class GraphError(RuntimeError):
    pass


def request_json(method: str, url: str, *, token: str = "", data: dict[str, str] | None = None) -> dict:
    body = None
    headers = {"Accept": "application/json"}
    if data is not None:
        body = urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=45) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise GraphError(f"{method} {url} failed: HTTP {exc.code}: {detail}") from exc
    return json.loads(raw) if raw else {}


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_private_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass


def token_url(tenant: str) -> str:
    return f"{AUTH_BASE}/{tenant}/oauth2/v2.0/token"


def refresh_access_token(client_id: str, tenant: str, scope: str, cache_path: Path) -> str | None:
    cache = load_json(cache_path)
    refresh_token = cache.get("refresh_token")
    if not refresh_token:
        return None
    payload = request_json(
        "POST",
        token_url(tenant),
        data={
            "client_id": client_id,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "scope": scope,
        },
    )
    payload["saved_at"] = dt.datetime.now(dt.UTC).isoformat()
    save_private_json(cache_path, payload)
    return payload.get("access_token")


def device_code_login(client_id: str, tenant: str, scope: str, cache_path: Path) -> str:
    device = request_json(
        "POST",
        f"{AUTH_BASE}/{tenant}/oauth2/v2.0/devicecode",
        data={"client_id": client_id, "scope": scope},
    )
    print(device.get("message") or f"Open {device.get('verification_uri')} and enter {device.get('user_code')}")
    interval = int(device.get("interval") or 5)
    expires_at = time.time() + int(device.get("expires_in") or 900)
    while time.time() < expires_at:
        time.sleep(interval)
        try:
            payload = request_json(
                "POST",
                token_url(tenant),
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    "client_id": client_id,
                    "device_code": device["device_code"],
                },
            )
        except GraphError as exc:
            text = str(exc)
            if "authorization_pending" in text:
                continue
            if "slow_down" in text:
                interval += 5
                continue
            raise
        payload["saved_at"] = dt.datetime.now(dt.UTC).isoformat()
        save_private_json(cache_path, payload)
        access_token = payload.get("access_token")
        if not access_token:
            raise GraphError("Device login succeeded but no access token was returned.")
        return access_token
    raise GraphError("Device login expired before authorization completed.")


def html_to_text(value: str) -> str:
    text = re.sub(r"<script.*?</script>", " ", value or "", flags=re.I | re.S)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    lines = [re.sub(r"[ \t]+", " ", html.unescape(line)).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def person_text(value: dict | None) -> str:
    email = (value or {}).get("emailAddress") or {}
    name = email.get("name") or ""
    address = email.get("address") or ""
    if name and address:
        return f"{name} <{address}>"
    return name or address


def recipients_text(values: list[dict] | None) -> str:
    return "; ".join(person_text(item) for item in values or [] if person_text(item))


def message_body_text(message: dict) -> str:
    body = message.get("body") or {}
    content = body.get("content") or ""
    if (body.get("contentType") or "").lower() == "html":
        return html_to_text(content)
    return content


def graph_messages(token: str, days_back: int, include_read: bool, folder: str) -> list[dict]:
    since = (dt.datetime.now(dt.UTC) - dt.timedelta(days=days_back)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    filters = [f"receivedDateTime ge {since}"]
    if not include_read:
        filters.append("isRead eq false")
    query = {
        "$top": "50",
        "$select": "id,subject,from,receivedDateTime,toRecipients,isRead,body",
        "$orderby": "receivedDateTime desc",
        "$filter": " and ".join(filters),
    }
    encoded = urlencode(query, safe="(),$")
    url = f"{GRAPH_BASE}/me/mailFolders/{folder}/messages?{encoded}"
    messages: list[dict] = []
    while url:
        payload = request_json("GET", url, token=token)
        messages.extend(payload.get("value") or [])
        url = payload.get("@odata.nextLink")
    return messages


def ticket_file_content(message: dict, body: str) -> str:
    return "\r\n".join(
        [
            f"Subject: {message.get('subject') or ''}",
            f"From: {person_text(message.get('from'))}",
            f"Date: {message.get('receivedDateTime') or ''}",
            f"To: {recipients_text(message.get('toRecipients'))}",
            "",
            body,
        ]
    )


def write_ticket_files(messages: list[dict], output_dir: Path) -> tuple[int, int]:
    output_dir.mkdir(parents=True, exist_ok=True)
    exported = 0
    skipped = 0
    seen: set[str] = set()
    for message in messages:
        subject = message.get("subject") or ""
        body = message_body_text(message)
        haystack = f"{subject}\n{person_text(message.get('from'))}\n{body}"
        match = TICKET_RE.search(haystack)
        if not match or not ONECALL_RE.search(haystack):
            skipped += 1
            continue
        ticket_number = match.group(0)
        if ticket_number in seen:
            skipped += 1
            continue
        seen.add(ticket_number)
        path = output_dir / f"Arkansas One Call Ticket {ticket_number}.txt"
        content = ticket_file_content(message, body)
        if path.exists() and path.read_text(encoding="utf-8-sig", errors="replace") == content:
            skipped += 1
            continue
        path.write_text(content, encoding="utf-8")
        exported += 1
        print(f"Exported {ticket_number} -> {path}")
    return exported, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="Pull Arkansas One Call ticket emails from Outlook/Microsoft Graph.")
    parser.add_argument("--client-id", default=os.environ.get("OUTLOOK_GRAPH_CLIENT_ID", ""))
    parser.add_argument("--tenant", default=os.environ.get("OUTLOOK_GRAPH_TENANT", "consumers"))
    parser.add_argument("--scope", default=os.environ.get("OUTLOOK_GRAPH_SCOPE", DEFAULT_SCOPE))
    parser.add_argument("--days-back", type=int, default=int(os.environ.get("OUTLOOK_DAYS_BACK", "7")))
    parser.add_argument("--output-dir", default=os.environ.get("OUTLOOK_TICKET_OUTPUT_DIR", "data/inbox"))
    parser.add_argument("--token-cache", default=os.environ.get("OUTLOOK_GRAPH_TOKEN_CACHE", "data/private/outlook_graph_token.json"))
    parser.add_argument("--folder", default=os.environ.get("OUTLOOK_GRAPH_FOLDER", "inbox"))
    parser.add_argument("--include-read", action="store_true", default=os.environ.get("OUTLOOK_INCLUDE_READ", "1") != "0")
    parser.add_argument("--device-code", action="store_true", help="Run first-time Microsoft device-code authorization.")
    args = parser.parse_args()

    if not args.client_id:
        print("OUTLOOK_GRAPH_CLIENT_ID is required. Create a Microsoft public-client app and set it in .env.", file=sys.stderr)
        return 2

    token_cache = Path(args.token_cache)
    access_token = refresh_access_token(args.client_id, args.tenant, args.scope, token_cache)
    if not access_token:
        if not args.device_code:
            print(f"No Outlook token cache found at {token_cache}. Run this script once with --device-code.", file=sys.stderr)
            return 3
        access_token = device_code_login(args.client_id, args.tenant, args.scope, token_cache)

    messages = graph_messages(access_token, args.days_back, args.include_read, args.folder)
    exported, skipped = write_ticket_files(messages, Path(args.output_dir))
    print(f"Graph messages checked: {len(messages)}")
    print(f"Ticket files exported or updated: {exported}")
    print(f"Messages skipped or unchanged: {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
