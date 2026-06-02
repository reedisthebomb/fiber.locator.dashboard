from __future__ import annotations

import argparse
import gzip
import html
import json
import hashlib
import mimetypes
import os
import platform
import shutil
import ssl
import re
import shlex
import sys
import subprocess
import xml.etree.ElementTree as ET
import threading
import secrets
import time
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from email import policy
from email.parser import BytesParser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Iterable
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlencode, urlparse
from zoneinfo import ZoneInfo


TICKET_RE = re.compile(r"\b\d{6}-\d{4}\b")
FIELD_RE = re.compile(r"([A-Z0-9 /.'&()]+?)-+\s*\[(.*?)\]", re.S)
REFRESH_LOCK = threading.Lock()
POWERSHELL_EXE = Path("/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe")
REFRESH_STATE = {
    "running": False,
    "started": "",
    "finished": "",
    "success": None,
    "message": "Idle",
    "exit_code": None,
    "logs": [],
}
VETRO_REFRESH_LOCK = threading.Lock()
VETRO_REFRESH_STATE = {
    "running": False,
    "started": "",
    "finished": "",
    "success": None,
    "message": "Idle",
    "exit_code": None,
    "percent": 0,
    "logs": [],
}
ADMIN_GEOCALL_LOCK = threading.Lock()
ADMIN_GEOCALL_CURL_TTL = timedelta(hours=6)
ACTIVE_TICKET_COUNTIES = {"UNION", "COLUMBIA"}
ACTIVE_TICKET_MIN_WORK_BEGIN = date(2026, 5, 8)
AUTH_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
AUTH_SESSIONS: dict[str, dict[str, str]] = {}
STATE_LOCK = threading.Lock()
STATE_FILE: Path | None = None
AUTH_FILE: Path | None = None
AUDIT_LOCK = threading.Lock()
ATTACHMENT_LOCK = threading.Lock()
ONEDRIVE_AUTH_LOCK = threading.Lock()
ONEDRIVE_PENDING_AUTH: dict[str, object] = {}
VETRO_CACHE_LOCK = threading.Lock()
VETRO_RESPONSE_CACHE: dict[str, object] = {"signature": None, "body": b"", "gzip_body": b""}
VITRUVI_CACHE_LOCK = threading.Lock()
VITRUVI_RESPONSE_CACHE: dict[str, object] = {"signature": None, "body": b"", "gzip_body": b""}
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
MICROSOFT_AUTH_BASE = "https://login.microsoftonline.com"
ONEDRIVE_DEFAULT_SCOPE = "offline_access Files.ReadWrite User.Read"
ONEDRIVE_DEFAULT_ROOT = "Fiber Locator Attachments"
ONEDRIVE_MAX_ATTACHMENTS = 80
DASHBOARD_TIME_ZONE = ZoneInfo(os.getenv("DASHBOARD_TIME_ZONE", "America/Chicago"))
AUDIT_VIEW_USERS = {item.strip() for item in os.getenv("AUDIT_VIEW_USERS", "site_owner").split(",") if item.strip()}
SHARED_DASHBOARD_WRITE_USERS = {
    item.strip()
    for item in os.getenv("SHARED_DASHBOARD_WRITE_USERS", "administrator,site_owner").split(",")
    if item.strip()
}
VETRO_LOGIN_URL = os.getenv("VETRO_LOGIN_URL", "https://auth.vetro.io/login?redirect=https://app.vetro.io/fibermap/map")


@dataclass
class Ticket:
    file: str
    subject: str
    sender: str
    email_date: str
    ticket_number: str
    message_type: str
    prepared_date: str
    prepared_time: str
    contractor: str
    caller: str
    company_address: str
    company_city: str
    company_state: str
    company_zip: str
    company_phone: str
    contact: str
    contact_phone: str
    contact_email: str
    work_begin_date: str
    work_begin_time: str
    state: str
    county: str
    place: str
    address: str
    street: str
    nearest_intersection: str
    latitude: float | None
    longitude: float | None
    location_information: str
    work_type: str
    done_for: str
    extent: str
    explosives: str
    white_paint: str
    directional_boring: str
    utilities_notified: list[str]
    portal_ticket_id: str
    portal_url: str
    portal_html_available: bool
    polygon: dict | None
    raw_text: str


@dataclass
class GeoCallDetail:
    ticket_number: str
    ticket_id: str
    source_url: str
    polygon_wkt: str
    portal_html: str


def load_auth_payload(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"users": []}
    except Exception as exc:
        print(f"Skipping auth file {path}: {exc}")
        return {"users": []}
    return payload if isinstance(payload, dict) else {"users": []}


def save_auth_payload(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(path)
    try:
        path.chmod(0o600)
    except OSError:
        pass


def load_auth_users(path: Path) -> dict[str, dict[str, str]]:
    payload = load_auth_payload(path)
    users: dict[str, dict[str, str]] = {}
    for item in payload.get("users", []):
        if not isinstance(item, dict):
            continue
        username = str(item.get("username") or "").strip()
        salt = str(item.get("salt") or "").strip()
        password_hash = str(item.get("password_sha256") or "").strip()
        if username and salt and password_hash:
            users[username] = {
                "salt": salt,
                "password_sha256": password_hash,
                "role": str(item.get("role") or "admin").strip() or "admin",
                "display_name": str(item.get("display_name") or username).strip() or username,
                "profile": item.get("profile") if isinstance(item.get("profile"), dict) else {},
            }
    return users


def auth_password_hash(username: str, password: str, salt: str) -> str:
    value = f"{username}\n{salt}\n{password}".encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def verify_credentials(username: str, password: str, users: dict[str, dict[str, str]]) -> bool:
    record = users.get(username)
    if not record:
        return False
    return auth_password_hash(username, password, record["salt"]) == record["password_sha256"]


def auth_user_role(username: str, users: dict[str, dict[str, str]]) -> str:
    role = str((users.get(username) or {}).get("role") or "admin").strip().lower()
    return "employee" if role == "employee" else "admin"


def clean_profile_text(value: object, max_length: int = 160) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())[:max_length]


def clean_profile_payload(data: dict) -> dict:
    profile = {
        "display_name": clean_profile_text(data.get("display_name") or data.get("displayName"), 120),
        "email": clean_profile_text(data.get("email"), 180),
        "phone": clean_profile_text(data.get("phone"), 80),
        "company": clean_profile_text(data.get("company"), 140),
        "title": clean_profile_text(data.get("title"), 120),
        "address": clean_profile_text(data.get("address"), 220),
    }
    avatar_data = str(data.get("avatar_data") or data.get("avatarData") or "").strip()
    if avatar_data.startswith("data:image/") and len(avatar_data) <= 700_000:
        profile["avatar_data"] = avatar_data
    elif data.get("clear_avatar") or data.get("clearAvatar"):
        profile["avatar_data"] = ""
    return profile


def public_auth_profile(username: str, record: dict | None) -> dict:
    record = record or {}
    profile = record.get("profile") if isinstance(record.get("profile"), dict) else {}
    display_name = clean_profile_text(profile.get("display_name") or record.get("display_name") or username, 120)
    return {
        "username": username,
        "role": auth_user_role(username, {username: record}) if record else "admin",
        "display_name": display_name,
        "email": clean_profile_text(profile.get("email"), 180),
        "phone": clean_profile_text(profile.get("phone"), 80),
        "company": clean_profile_text(profile.get("company"), 140),
        "title": clean_profile_text(profile.get("title"), 120),
        "address": clean_profile_text(profile.get("address"), 220),
        "avatar_data": str(profile.get("avatar_data") or ""),
    }


def update_auth_profile(path: Path, username: str, data: dict) -> tuple[dict | None, str]:
    profile_update = clean_profile_payload(data)
    with STATE_LOCK:
        payload = load_auth_payload(path)
        users = payload.setdefault("users", [])
        if not isinstance(users, list):
            return None, "Auth users file is invalid."
        target = None
        for item in users:
            if isinstance(item, dict) and str(item.get("username") or "") == username:
                target = item
                break
        if target is None:
            return None, "Account not found."
        profile = target.setdefault("profile", {})
        if not isinstance(profile, dict):
            profile = {}
            target["profile"] = profile
        for key, value in profile_update.items():
            if key == "avatar_data" and value == "":
                profile.pop("avatar_data", None)
            elif value or key == "avatar_data":
                profile[key] = value
            elif key in profile:
                profile.pop(key, None)
        if profile.get("display_name"):
            target["display_name"] = profile["display_name"]
        target["profile_updated_at"] = dashboard_now_iso()
        save_auth_payload(path, payload)
        return public_auth_profile(username, target), ""


def create_account_request(path: Path, data: dict, ip: str = "") -> tuple[dict | None, str]:
    profile = clean_profile_payload(data)
    display_name = profile.get("display_name", "")
    email = profile.get("email", "")
    if not display_name:
        return None, "Name is required."
    if not email or "@" not in email:
        return None, "A valid email is required."
    request_record = {
        "id": secrets.token_urlsafe(12),
        "display_name": display_name,
        "email": email,
        "phone": profile.get("phone", ""),
        "company": profile.get("company", ""),
        "title": profile.get("title", ""),
        "address": profile.get("address", ""),
        "message": clean_profile_text(data.get("message"), 500),
        "status": "pending",
        "requested_at": dashboard_now_iso(),
        "request_ip": clean_profile_text(ip, 80),
    }
    with STATE_LOCK:
        payload = load_auth_payload(path)
        requests = payload.setdefault("account_requests", [])
        if not isinstance(requests, list):
            requests = []
            payload["account_requests"] = requests
        for item in requests:
            if (
                isinstance(item, dict)
                and str(item.get("email") or "").strip().lower() == email.lower()
                and str(item.get("status") or "pending") == "pending"
            ):
                item.update({key: value for key, value in request_record.items() if key not in {"id", "requested_at"}})
                save_auth_payload(path, payload)
                return item, ""
        requests.append(request_record)
        save_auth_payload(path, payload)
    return request_record, ""


def auth_token_hash(token: str) -> str:
    return hashlib.sha256(str(token).encode("utf-8")).hexdigest()


def find_employee_invite(token: str) -> dict | None:
    if not AUTH_FILE or not token:
        return None
    payload = load_auth_payload(AUTH_FILE)
    token_hash = auth_token_hash(token)
    for invite in payload.get("employee_invites", []):
        if not isinstance(invite, dict):
            continue
        if invite.get("token_sha256") == token_hash and not invite.get("used_at"):
            return invite
    return None


def complete_employee_invite(token: str, password: str) -> tuple[bool, str, str]:
    if not AUTH_FILE:
        return False, "", "Employee setup is not available."
    password = str(password or "")
    if len(password) < 8:
        return False, "", "Password must be at least 8 characters."
    with STATE_LOCK:
        payload = load_auth_payload(AUTH_FILE)
        token_hash = auth_token_hash(token)
        invite = None
        for item in payload.get("employee_invites", []):
            if isinstance(item, dict) and item.get("token_sha256") == token_hash and not item.get("used_at"):
                invite = item
                break
        if not invite:
            return False, "", "This setup link is invalid or has already been used."
        username = str(invite.get("username") or "").strip()
        if not username:
            return False, "", "This setup link is missing an employee username."
        users = payload.setdefault("users", [])
        if not isinstance(users, list):
            users = []
            payload["users"] = users
        salt = secrets.token_hex(16)
        record = {
            "username": username,
            "display_name": str(invite.get("display_name") or username).strip() or username,
            "role": "employee",
            "salt": salt,
            "password_sha256": auth_password_hash(username, password, salt),
            "created_at": str(invite.get("created_at") or dashboard_now_iso()),
            "password_set_at": dashboard_now_iso(),
        }
        users[:] = [item for item in users if not (isinstance(item, dict) and item.get("username") == username)]
        users.append(record)
        invite["used_at"] = dashboard_now_iso()
        save_auth_payload(AUTH_FILE, payload)
    return True, username, ""


def employee_access_payload(path: Path) -> dict:
    payload = load_auth_payload(path)
    users = []
    for item in payload.get("users", []):
      if not isinstance(item, dict):
        continue
      username = str(item.get("username") or "").strip()
      if not username:
        continue
      users.append({
        "username": username,
        "display_name": str(item.get("display_name") or username).strip() or username,
        "role": str(item.get("role") or "admin").strip() or "admin",
        "created_at": str(item.get("created_at") or ""),
        "password_set_at": str(item.get("password_set_at") or ""),
        "profile": public_auth_profile(username, item),
      })
    invites = []
    for item in payload.get("employee_invites", []):
      if not isinstance(item, dict):
        continue
      username = str(item.get("username") or "").strip()
      if not username:
        continue
      invites.append({
        "username": username,
        "display_name": str(item.get("display_name") or username).strip() or username,
        "created_at": str(item.get("created_at") or ""),
        "created_by": str(item.get("created_by") or ""),
        "used_at": str(item.get("used_at") or ""),
      })
    users.sort(key=lambda item: (item.get("role") != "admin", item.get("display_name", "").lower()))
    invites.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    account_requests = [
        item for item in payload.get("account_requests", [])
        if isinstance(item, dict) and str(item.get("status") or "pending") == "pending"
    ]
    account_requests.sort(key=lambda item: item.get("requested_at", ""), reverse=True)
    return {"users": users, "invites": invites, "account_requests": account_requests}


def create_employee_invite(path: Path, username: str, display_name: str, created_by: str) -> tuple[dict | None, str]:
    username = re.sub(r"[^a-zA-Z0-9_.@-]+", "", str(username or "").strip())
    display_name = str(display_name or username).strip() or username
    if not username:
        return None, "Employee username is required."
    if len(username) > 80:
        return None, "Employee username is too long."
    with STATE_LOCK:
        payload = load_auth_payload(path)
        users = payload.setdefault("users", [])
        if any(isinstance(item, dict) and str(item.get("username") or "") == username for item in users):
            return None, "That username already has an account."
        token = secrets.token_urlsafe(32)
        invite = {
            "username": username,
            "display_name": display_name[:120],
            "role": "employee",
            "token_sha256": auth_token_hash(token),
            "created_at": dashboard_now_iso(),
            "created_by": created_by,
            "used_at": "",
        }
        invites = payload.setdefault("employee_invites", [])
        if not isinstance(invites, list):
            invites = []
            payload["employee_invites"] = invites
        invites[:] = [
            item for item in invites
            if not (isinstance(item, dict) and str(item.get("username") or "") == username and not item.get("used_at"))
        ]
        invites.append(invite)
        save_auth_payload(path, payload)
    public_invite = {key: invite[key] for key in ("username", "display_name", "role", "created_at", "created_by", "used_at")}
    public_invite["token"] = token
    return public_invite, ""


def dashboard_now() -> datetime:
    return datetime.now(DASHBOARD_TIME_ZONE)


def dashboard_now_iso(timespec: str = "seconds") -> str:
    return dashboard_now().isoformat(timespec=timespec)


def geocall_request_cache_dir(data_dir: Path) -> Path:
    return data_dir / "private" / "geocall_requests"


def geocall_saved_curl_path(data_dir: Path) -> Path:
    return geocall_request_cache_dir(data_dir) / "latest_admin_geocall.curl"


def save_admin_geocall_curl(data_dir: Path, curl_text: str) -> Path:
    private_dir = geocall_request_cache_dir(data_dir)
    private_dir.mkdir(parents=True, exist_ok=True)
    path = geocall_saved_curl_path(data_dir)
    path.write_text(curl_text, encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass
    return path


def reusable_admin_geocall_curl(data_dir: Path) -> tuple[Path | None, str]:
    path = geocall_saved_curl_path(data_dir)
    if not path.exists() or not path.is_file():
        return None, "No saved GeoCall cURL is available. Paste a fresh Copy as cURL request."
    try:
        age = dashboard_now() - datetime.fromtimestamp(path.stat().st_mtime, DASHBOARD_TIME_ZONE)
    except OSError:
        return None, "Saved GeoCall cURL could not be read. Paste a fresh Copy as cURL request."
    if age > ADMIN_GEOCALL_CURL_TTL:
        hours = int(ADMIN_GEOCALL_CURL_TTL.total_seconds() // 3600)
        return None, f"Saved GeoCall cURL is older than {hours} hours. Paste a fresh Copy as cURL request."
    return path, ""


def create_auth_session(username: str) -> str:
    token = secrets.token_urlsafe(32)
    AUTH_SESSIONS[token] = {"username": username, "created": dashboard_now_iso()}
    return token


def valid_auth_session(token: str) -> bool:
    record = AUTH_SESSIONS.get(token)
    if not record:
        return False
    try:
        created = datetime.fromisoformat(record["created"])
    except Exception:
        AUTH_SESSIONS.pop(token, None)
        return False
    if created.tzinfo is None:
        created = created.replace(tzinfo=DASHBOARD_TIME_ZONE)
    if (dashboard_now() - created).total_seconds() > AUTH_SESSION_TTL_SECONDS:
        AUTH_SESSIONS.pop(token, None)
        return False
    return True


def auth_session_username(token: str) -> str:
    record = AUTH_SESSIONS.get(token)
    return str(record.get("username") or "") if record else ""

def audit_log_path(data_dir: Path) -> Path:
    return data_dir / "audit_log.jsonl"


def safe_audit_details(value: object) -> object:
    if isinstance(value, dict):
        return {str(key)[:80]: safe_audit_details(item) for key, item in list(value.items())[:80]}
    if isinstance(value, list):
        return [safe_audit_details(item) for item in value[:120]]
    if isinstance(value, (str, int, float, bool)) or value is None:
        text = str(value) if isinstance(value, str) else value
        return text[:500] if isinstance(text, str) else text
    return str(value)[:500]


def write_audit_event(data_dir: Path, event: str, username: str = "", ip: str = "", details: object | None = None) -> None:
    record = {
        "time": dashboard_now_iso(),
        "event": str(event or "event")[:80],
        "username": str(username or "anonymous")[:80],
        "ip": str(ip or "")[:80],
        "details": safe_audit_details(details or {}),
    }
    path = audit_log_path(data_dir)
    with AUDIT_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=True, separators=(",", ":")) + "\n")


def read_audit_events(data_dir: Path, limit: int = 300) -> list[dict]:
    path = audit_log_path(data_dir)
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return []
    events = []
    for line in lines[-max(1, min(50000, limit)):]:
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(item, dict):
            events.append(item)
    return list(reversed(events))


def summarize_state_change(existing: dict, incoming: dict) -> dict:
    details: dict[str, object] = {}
    for key in ("hiddenTickets", "archivedTickets"):
        if key not in incoming:
            continue
        before = set(map(str, existing.get(key) if isinstance(existing.get(key), list) else []))
        after = set(map(str, incoming.get(key) if isinstance(incoming.get(key), list) else []))
        added = sorted(after - before)
        removed = sorted(before - after)
        if added or removed:
            details[key] = {"added": added[:60], "removed": removed[:60], "count": len(after)}
    if "ticketActions" in incoming and isinstance(incoming.get("ticketActions"), dict):
        before_actions = normalize_ticket_actions_state(existing.get("ticketActions"))
        after_actions = normalize_ticket_actions_state(incoming.get("ticketActions"))
        changed = sorted(ticket for ticket in (set(before_actions) | set(after_actions)) if before_actions.get(ticket) != after_actions.get(ticket))
        if changed:
            details["ticketActions"] = {
                "changed": changed[:80],
                "changed_count": len(changed),
            }
    for key in ("mapStyle", "ticketSearch", "showHiddenTickets", "countyFilterAll"):
        if key in incoming and existing.get(key) != incoming.get(key):
            details[key] = {"from": existing.get(key), "to": incoming.get(key)}
    changed_keys = sorted(key for key in incoming if existing.get(key) != incoming.get(key))
    if changed_keys:
        details["changedKeys"] = changed_keys[:120]
    return details


def load_dashboard_state(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"users": {}}
    except Exception as exc:
        print(f"Skipping dashboard state file {path}: {exc}")
        return {"users": {}}
    if not isinstance(payload, dict):
        return {"users": {}}
    users = payload.get("users")
    if not isinstance(users, dict):
        payload["users"] = {}
    return payload


def save_dashboard_state(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(path)


def safe_file_component(value: str, fallback: str = "file") -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", str(value or "").strip()).strip("._")
    return cleaned[:140] or fallback


def attachments_root(data_dir: Path) -> Path:
    return data_dir / "attachments"


def attachments_index_path(data_dir: Path) -> Path:
    return attachments_root(data_dir) / "attachments.json"


def load_attachments_index(data_dir: Path) -> dict:
    path = attachments_index_path(data_dir)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"tickets": {}}
    except Exception as exc:
        print(f"Skipping attachments index {path}: {exc}")
        return {"tickets": {}}
    if not isinstance(payload, dict):
        return {"tickets": {}}
    tickets = payload.get("tickets")
    if not isinstance(tickets, dict):
        payload["tickets"] = {}
    return payload


def save_attachments_index(data_dir: Path, payload: dict) -> None:
    path = attachments_index_path(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(path)


def ticket_attachment_dir(data_dir: Path, ticket_number: str) -> Path:
    return attachments_root(data_dir) / safe_file_component(ticket_number, "ticket")


class GraphRequestError(RuntimeError):
    def __init__(self, message: str, status: int = 0, payload: dict | None = None):
        super().__init__(message)
        self.status = status
        self.payload = payload or {}


def private_json_path(data_dir: Path, filename: str) -> Path:
    return data_dir / "private" / filename


def load_private_json(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def save_private_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(path)
    try:
        path.chmod(0o600)
    except OSError:
        pass


def vetro_capture_dir(data_dir: Path) -> Path:
    return data_dir / "private" / "vetro_captures"


def vetro_capture_urls(content: str) -> list[str]:
    urls = set(re.findall(r"https?://[^\s'\"<>]+", content or ""))
    return sorted(url for url in urls if ".pbf" in url.lower() or "tile" in url.lower() or "vector" in url.lower())


def analyze_vetro_capture(content: str) -> dict:
    stats: dict[str, object] = {
        "pbf_url_count": 0,
        "vetro_tile_count": 0,
        "mapbox_pbf_count": 0,
        "embedded_body_count": 0,
        "auth_header_count": 0,
        "cookie_header_count": 0,
        "status_counts": {},
        "layer_counts": {},
        "ready_for_import": False,
        "capture_warning": "",
    }

    def add_status(status: object) -> None:
        if status in (None, ""):
            return
        status_key = str(status)
        status_counts = stats["status_counts"]
        assert isinstance(status_counts, dict)
        status_counts[status_key] = status_counts.get(status_key, 0) + 1

    def add_layer(url: str) -> None:
        match = re.search(r"[?&]layer_id=([^&]+)", url)
        if not match:
            return
        layer_id = unquote(match.group(1))
        layer_counts = stats["layer_counts"]
        assert isinstance(layer_counts, dict)
        layer_counts[layer_id] = layer_counts.get(layer_id, 0) + 1

    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        payload = None

    if isinstance(payload, dict) and isinstance(((payload.get("log") or {}).get("entries")), list):
        for entry in (payload.get("log") or {}).get("entries", []):
            request_data = entry.get("request") or {}
            url = str(request_data.get("url") or "")
            if ".pbf" not in url.lower():
                continue
            stats["pbf_url_count"] = int(stats["pbf_url_count"]) + 1
            is_vetro_tile = "fibermap.vetro.io" in url and "/maps/" in url
            if is_vetro_tile:
                stats["vetro_tile_count"] = int(stats["vetro_tile_count"]) + 1
                add_layer(url)
            elif "api.mapbox.com" in url:
                stats["mapbox_pbf_count"] = int(stats["mapbox_pbf_count"]) + 1
            content_data = (entry.get("response") or {}).get("content") or {}
            if content_data.get("text") and is_vetro_tile:
                stats["embedded_body_count"] = int(stats["embedded_body_count"]) + 1
            add_status((entry.get("response") or {}).get("status"))
            for header in request_data.get("headers", []):
                name = str(header.get("name") or "").lower()
                if name == "authorization" and is_vetro_tile:
                    stats["auth_header_count"] = int(stats["auth_header_count"]) + 1
                elif name == "cookie" and is_vetro_tile:
                    stats["cookie_header_count"] = int(stats["cookie_header_count"]) + 1
    else:
        curl_blocks = list(re.finditer(r"curl\s+((?:\\\n|.)*?)(?=\n\s*curl\s+|\Z)", content or "", re.S))
        fallback_headers: dict[str, str] = {}
        saw_vetro_curl = False
        for match in curl_blocks:
            block = "curl " + match.group(1).replace("\\\n", " ")
            try:
                tokens = shlex.split(block)
            except ValueError:
                continue
            url = ""
            headers: dict[str, str] = {}
            index = 1
            while index < len(tokens):
                token = tokens[index]
                if token in {"-H", "--header"} and index + 1 < len(tokens):
                    raw = tokens[index + 1]
                    if ":" in raw:
                        key, value = raw.split(":", 1)
                        headers[key.strip().lower()] = value.strip()
                    index += 2
                    continue
                if token in {"-b", "--cookie"} and index + 1 < len(tokens):
                    headers["cookie"] = tokens[index + 1]
                    index += 2
                    continue
                if token.startswith("http"):
                    url = token
                index += 1
            parsed = urlparse(url)
            if parsed.netloc == "app.vetro.io":
                for key in ("cookie", "authorization"):
                    if headers.get(key):
                        fallback_headers.setdefault(key, headers[key])
            if ".pbf" not in url.lower():
                continue
            stats["pbf_url_count"] = int(stats["pbf_url_count"]) + 1
            if "fibermap.vetro.io" in url and "/maps/" in url:
                saw_vetro_curl = True
                stats["vetro_tile_count"] = int(stats["vetro_tile_count"]) + 1
                add_layer(url)
                if headers.get("authorization") or fallback_headers.get("authorization"):
                    stats["auth_header_count"] = int(stats["auth_header_count"]) + 1
                if headers.get("cookie") or fallback_headers.get("cookie"):
                    stats["cookie_header_count"] = int(stats["cookie_header_count"]) + 1
            elif "api.mapbox.com" in url:
                stats["mapbox_pbf_count"] = int(stats["mapbox_pbf_count"]) + 1
        if not curl_blocks or not saw_vetro_curl:
            for url in re.findall(r"https?://[^\s'\"<>]+\.pbf(?:\?[^\s'\"<>]+)?", content or "", re.I):
                stats["pbf_url_count"] = int(stats["pbf_url_count"]) + 1
                if "fibermap.vetro.io" in url and "/maps/" in url:
                    stats["vetro_tile_count"] = int(stats["vetro_tile_count"]) + 1
                    add_layer(url)
                elif "api.mapbox.com" in url:
                    stats["mapbox_pbf_count"] = int(stats["mapbox_pbf_count"]) + 1

    ready = int(stats["vetro_tile_count"]) > 0 and (
        int(stats["embedded_body_count"]) > 0
        or int(stats["auth_header_count"]) > 0
        or int(stats["cookie_header_count"]) > 0
    )
    stats["ready_for_import"] = ready
    if int(stats["vetro_tile_count"]) <= 0:
        stats["capture_warning"] = "No VETRO map tile requests were found. Filter Network for .pbf, pan the VETRO map, then export again."
    elif not ready:
        stats["capture_warning"] = (
            "This capture has VETRO tile URLs, but no embedded tile bodies and no Cookie/Authorization headers. "
            "Export HAR with content and sensitive data, or copy a VETRO .pbf request as cURL with cookies."
        )
    return stats


def latest_vetro_capture_path(data_dir: Path) -> Path | None:
    capture_dir = vetro_capture_dir(data_dir)
    captures = sorted(capture_dir.glob("vetro_capture_*.txt"), key=lambda path: path.stat().st_mtime, reverse=True)
    return captures[0] if captures else None


def onedrive_client_id() -> str:
    return os.environ.get("ONEDRIVE_GRAPH_CLIENT_ID") or os.environ.get("OUTLOOK_GRAPH_CLIENT_ID", "")


def onedrive_tenant() -> str:
    return os.environ.get("ONEDRIVE_GRAPH_TENANT") or os.environ.get("OUTLOOK_GRAPH_TENANT", "consumers")


def onedrive_scope() -> str:
    return os.environ.get("ONEDRIVE_GRAPH_SCOPE", ONEDRIVE_DEFAULT_SCOPE)


def onedrive_token_cache_path(data_dir: Path) -> Path:
    return Path(os.environ.get("ONEDRIVE_GRAPH_TOKEN_CACHE") or private_json_path(data_dir, "onedrive_graph_token.json"))


def onedrive_root_folder_name() -> str:
    return os.environ.get("ONEDRIVE_ATTACHMENTS_ROOT", ONEDRIVE_DEFAULT_ROOT).strip() or ONEDRIVE_DEFAULT_ROOT


def onedrive_link_scope() -> str:
    return os.environ.get("ONEDRIVE_LINK_SCOPE", "anonymous").strip() or "anonymous"


def microsoft_token_url() -> str:
    return f"{MICROSOFT_AUTH_BASE}/{onedrive_tenant()}/oauth2/v2.0/token"


def graph_request_json(
    method: str,
    url: str,
    *,
    token: str = "",
    payload: dict | None = None,
    form: dict[str, str] | None = None,
    timeout: int = 45,
) -> dict:
    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if form is not None:
        body = urlencode(form).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib_request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib_request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            detail = {"error": {"message": raw}}
        message = detail.get("error", {}).get("message") if isinstance(detail.get("error"), dict) else raw
        code = detail.get("error", {}).get("code") if isinstance(detail.get("error"), dict) else ""
        raise GraphRequestError(f"{method} {url} failed: HTTP {exc.code}: {code} {message}".strip(), exc.code, detail) from exc
    except URLError as exc:
        raise GraphRequestError(f"{method} {url} failed: {exc}") from exc


def onedrive_refresh_access_token(data_dir: Path) -> str | None:
    cache_path = onedrive_token_cache_path(data_dir)
    cache = load_private_json(cache_path)
    refresh_token = str(cache.get("refresh_token") or "")
    if not refresh_token:
        return None
    client_id = onedrive_client_id()
    if not client_id:
        return None
    payload = graph_request_json(
        "POST",
        microsoft_token_url(),
        form={
            "client_id": client_id,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "scope": onedrive_scope(),
        },
    )
    payload["saved_at"] = dashboard_now_iso()
    save_private_json(cache_path, payload)
    return str(payload.get("access_token") or "")


def onedrive_access_token(data_dir: Path) -> str:
    token = onedrive_refresh_access_token(data_dir)
    if token:
        return token
    raise GraphRequestError("OneDrive is not connected. Connect an account from Settings first.", 401)


def onedrive_me(token: str) -> dict:
    return graph_request_json("GET", f"{GRAPH_BASE}/me", token=token)


def onedrive_path_url(path_parts: list[str]) -> str:
    encoded = quote("/".join(path_parts), safe="/")
    return f"{GRAPH_BASE}/me/drive/root:/{encoded}:"


def onedrive_get_path(token: str, path_parts: list[str]) -> dict | None:
    try:
        return graph_request_json("GET", onedrive_path_url(path_parts), token=token)
    except GraphRequestError as exc:
        if exc.status == 404:
            return None
        raise


def onedrive_create_child_folder(token: str, parent_id: str, name: str) -> dict:
    return graph_request_json(
        "POST",
        f"{GRAPH_BASE}/me/drive/items/{quote(parent_id)}/children",
        token=token,
        payload={
            "name": name,
            "folder": {},
            "@microsoft.graph.conflictBehavior": "fail",
        },
    )


def onedrive_ensure_folder_path(token: str, path_parts: list[str]) -> dict:
    parent = graph_request_json("GET", f"{GRAPH_BASE}/me/drive/root", token=token)
    current_path: list[str] = []
    for part in path_parts:
        clean = str(part or "").strip()
        if not clean:
            continue
        current_path.append(clean)
        existing = onedrive_get_path(token, current_path)
        if existing:
            parent = existing
            continue
        try:
            parent = onedrive_create_child_folder(token, str(parent["id"]), clean)
        except GraphRequestError as exc:
            if exc.status != 409:
                raise
            existing = onedrive_get_path(token, current_path)
            if not existing:
                raise
            parent = existing
    return parent


def onedrive_create_folder_link(token: str, folder_id: str, fallback_url: str = "") -> str:
    try:
        payload = graph_request_json(
            "POST",
            f"{GRAPH_BASE}/me/drive/items/{quote(folder_id)}/createLink",
            token=token,
            payload={
                "type": "view",
                "scope": onedrive_link_scope(),
            },
        )
        link = payload.get("link") if isinstance(payload, dict) else {}
        return str(link.get("webUrl") or fallback_url or "")
    except GraphRequestError:
        return fallback_url


def onedrive_upload_bytes(token: str, folder_id: str, filename: str, file_body: bytes) -> dict:
    safe_name = safe_file_component(filename, "attachment")
    session = graph_request_json(
        "POST",
        f"{GRAPH_BASE}/me/drive/items/{quote(folder_id)}:/{quote(safe_name)}:/createUploadSession",
        token=token,
        payload={"item": {"@microsoft.graph.conflictBehavior": "replace"}},
    )
    upload_url = str(session.get("uploadUrl") or "")
    if not upload_url:
        raise GraphRequestError("OneDrive did not return an upload session URL.")
    total = len(file_body)
    chunk_size = 320 * 1024 * 10
    offset = 0
    result: dict = {}
    while offset < total or (total == 0 and offset == 0):
        end = min(offset + chunk_size, total) - 1
        chunk = file_body[offset : end + 1] if total else b""
        headers = {
            "Content-Length": str(len(chunk)),
            "Content-Range": f"bytes {offset}-{end}/{total}" if total else "bytes 0-0/0",
        }
        req = urllib_request.Request(upload_url, data=chunk, headers=headers, method="PUT")
        try:
            with urllib_request.urlopen(req, timeout=120) as response:
                raw = response.read().decode("utf-8")
                result = json.loads(raw) if raw else {}
                status = response.status
        except HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            raise GraphRequestError(f"OneDrive upload failed: HTTP {exc.code}: {raw}", exc.code) from exc
        if status in {200, 201}:
            return result
        offset = end + 1
        if total == 0:
            break
    return result


def summarize_ticket_attachments(index: dict, ticket_number: str) -> dict:
    items = index.get("tickets", {}).get(ticket_number, [])
    if not isinstance(items, list):
        items = []
    folder_url = ""
    folder_name = ticket_number
    for item in reversed(items):
        if not isinstance(item, dict):
            continue
        folder_url = str(item.get("folder_url") or folder_url)
        folder_name = str(item.get("folder_name") or folder_name)
        if folder_url:
            break
    return {
        "count": len(items),
        "folder_url": folder_url,
        "folder_name": folder_name,
    }


def get_dashboard_user_state(username: str) -> dict:
    if not STATE_FILE:
        return {}
    with STATE_LOCK:
        payload = load_dashboard_state(STATE_FILE)
        users = payload.setdefault("users", {})
        state = users.get(username, {})
        if not isinstance(state, dict) and username != "default":
            state = users.get("default", {})
        elif not state and username != "default":
            state = users.get("default", {})
        return state if isinstance(state, dict) else {}


TICKET_WORKFLOW_KEYS = {
    "ticketActions",
    "ticketActionUpdatedAt",
    "ticketDescriptions",
    "ticketMarkedBy",
}


def ticket_workflow_from_state(state: dict) -> dict:
    if not isinstance(state, dict):
        return {}
    workflow = {}
    if "ticketActions" in state:
        workflow["ticketActions"] = normalize_ticket_actions_state(state.get("ticketActions"))
    if "ticketActionUpdatedAt" in state:
        workflow["ticketActionUpdatedAt"] = normalize_ticket_action_timestamps(state.get("ticketActionUpdatedAt"))
    if "ticketDescriptions" in state and isinstance(state.get("ticketDescriptions"), dict):
        descriptions = {}
        for ticket_number, description in state.get("ticketDescriptions", {}).items():
            text = str(description or "").strip()
            if text:
                descriptions[str(ticket_number)] = text
        workflow["ticketDescriptions"] = descriptions
    if "ticketMarkedBy" in state and isinstance(state.get("ticketMarkedBy"), dict):
        marked_by = {}
        for ticket_number, username in state.get("ticketMarkedBy", {}).items():
            text = str(username or "").strip()
            if text:
                marked_by[str(ticket_number)] = text[:120]
        workflow["ticketMarkedBy"] = marked_by
    return workflow


def merge_ticket_workflow(existing: dict, incoming: dict) -> dict:
    merged = dict(existing if isinstance(existing, dict) else {})
    merged_actions, merged_timestamps = merge_ticket_actions(merged, incoming if isinstance(incoming, dict) else {})
    merged["ticketActions"] = merged_actions
    merged["ticketActionUpdatedAt"] = merged_timestamps
    if isinstance(incoming, dict) and "ticketDescriptions" in incoming:
        merged["ticketDescriptions"] = ticket_workflow_from_state(incoming).get("ticketDescriptions", {})
    elif "ticketDescriptions" in merged:
        merged["ticketDescriptions"] = ticket_workflow_from_state(merged).get("ticketDescriptions", {})
    if isinstance(incoming, dict) and "ticketMarkedBy" in incoming:
        merged["ticketMarkedBy"] = ticket_workflow_from_state(incoming).get("ticketMarkedBy", {})
    elif "ticketMarkedBy" in merged:
        merged["ticketMarkedBy"] = ticket_workflow_from_state(merged).get("ticketMarkedBy", {})
    return merged


def get_shared_ticket_workflow(payload: dict) -> dict:
    shared = ticket_workflow_from_state(payload.get("ticket_workflow", {}))
    users = payload.get("users", {})
    if isinstance(users, dict):
        for state in users.values():
            shared = merge_ticket_workflow(shared, ticket_workflow_from_state(state if isinstance(state, dict) else {}))
    employee_state = payload.get("employee_dashboard", {})
    if isinstance(employee_state, dict):
        shared = merge_ticket_workflow(shared, ticket_workflow_from_state(employee_state.get("state", {})))
    return shared


def overlay_shared_ticket_workflow(state: dict, payload: dict) -> dict:
    merged = dict(state if isinstance(state, dict) else {})
    merged.update(get_shared_ticket_workflow(payload))
    return merged


def get_effective_dashboard_state(username: str, role: str = "admin") -> dict:
    if not STATE_FILE:
        return {}
    with STATE_LOCK:
        payload = load_dashboard_state(STATE_FILE)
        users = payload.setdefault("users", {})
        user_state = users.get(username, {})
        if not isinstance(user_state, dict) and username != "default":
            user_state = users.get("default", {})
        elif not user_state and username != "default":
            user_state = users.get("default", {})
        if not isinstance(user_state, dict):
            user_state = {}
        if role != "employee":
            return overlay_shared_ticket_workflow(user_state, payload)
        employee_state = payload.get("employee_dashboard", {})
        base_state = employee_state.get("state", {}) if isinstance(employee_state, dict) and employee_state.get("enabled") else {}
        if not isinstance(base_state, dict):
            base_state = {}
        employee_writable_keys = {
            "hiddenTickets",
            "archivedTickets",
            "ticketActions",
            "ticketActionUpdatedAt",
            "ticketDescriptions",
            "ticketMarkedBy",
            "ticketListCheckpoint",
            "showHiddenTickets",
            "ticketSearch",
            "vetroOpacity",
            "ticketOpacity",
            "mapStyle",
            "baseMapStyle",
            "baseMap",
            "mapView",
            "selectedTicketNumber",
        }
        writable_state = {key: value for key, value in user_state.items() if key in employee_writable_keys}
        return overlay_shared_ticket_workflow(merge_dashboard_user_state(base_state, writable_state), payload)


def filter_employee_user_state(state: dict) -> dict:
    if not isinstance(state, dict):
        return {}
    employee_writable_keys = {
        "hiddenTickets",
        "archivedTickets",
        "ticketActions",
        "ticketActionUpdatedAt",
        "ticketDescriptions",
        "ticketMarkedBy",
        "ticketListCheckpoint",
        "showHiddenTickets",
        "ticketSearch",
        "vetroOpacity",
        "ticketOpacity",
        "mapStyle",
        "baseMapStyle",
        "baseMap",
        "mapView",
        "selectedTicketNumber",
    }
    return {key: value for key, value in state.items() if key in employee_writable_keys}


def get_locator_default_state() -> dict:
    if not STATE_FILE:
        return {"enabled": False, "state": {}}
    with STATE_LOCK:
        payload = load_dashboard_state(STATE_FILE)
        default_state = payload.get("locator_default", {})
        if not isinstance(default_state, dict):
            return {"enabled": False, "state": {}}
        state = default_state.get("state", {})
        return {
            "enabled": bool(default_state.get("enabled", False)),
            "state": state if isinstance(state, dict) else {},
            "saved_at": str(default_state.get("saved_at") or ""),
            "saved_by": str(default_state.get("saved_by") or ""),
        }


def get_employee_dashboard_state() -> dict:
    if not STATE_FILE:
        return {"enabled": False, "state": {}}
    with STATE_LOCK:
        payload = load_dashboard_state(STATE_FILE)
        employee_state = payload.get("employee_dashboard", {})
        if not isinstance(employee_state, dict):
            return {"enabled": False, "state": {}}
        state = employee_state.get("state", {})
        return {
            "enabled": bool(employee_state.get("enabled", False)),
            "state": state if isinstance(state, dict) else {},
            "saved_at": str(employee_state.get("saved_at") or ""),
            "saved_by": str(employee_state.get("saved_by") or ""),
        }


VIEW_PRESET_STATE_KEYS = {
    "showHiddenTickets",
    "ticketSearch",
    "countyFilterAll",
    "countyFilterSelected",
    "vetroVisible",
    "vetroLayerFilterSelected",
    "vetroPlanFilterSelected",
    "vetroBuildFilterSelected",
    "vetroPlacementFilterSelected",
    "vetroStatusFilterSelected",
    "vetroGeometryFilterSelected",
    "vetroFiberFilterSelected",
    "vetroRouteFilterSelected",
    "vetroPointFilterSelected",
    "vetroLayerColorOverrides",
    "vetroLayerStyleOverrides",
    "vetroLayerNameOverrides",
    "vetroLayerNoteOverrides",
    "vetroLayerSizeOverrides",
    "vetroLayerOpacityOverrides",
    "vetroSlVisible",
    "vetroSlShape",
    "vetroSlColor",
    "vetroSlOutlineColor",
    "vetroSlOpacity",
    "vetroSlSize",
    "vetroSlLabels",
    "vetroSearch",
    "vetroColor",
    "vetroOpacity",
    "polygonOpacity",
    "ticketOpacity",
    "mapStyle",
    "baseMapStyle",
    "baseMap",
    "mapView",
}


def normalize_view_state(state: dict) -> dict:
    if not isinstance(state, dict):
        return {}
    return {key: value for key, value in state.items() if key in VIEW_PRESET_STATE_KEYS}


def normalize_view_preset(item: dict) -> dict:
    if not isinstance(item, dict):
        return {}
    state = item.get("state", {})
    name = str(item.get("name") or "").strip()[:80]
    if not name:
        return {}
    preset_id = safe_file_component(str(item.get("id") or name), "view")
    return {
        "id": preset_id,
        "name": name,
        "state": normalize_view_state(state),
        "saved_at": str(item.get("saved_at") or ""),
        "saved_by": str(item.get("saved_by") or ""),
    }


def get_view_presets() -> list[dict]:
    if not STATE_FILE:
        return []
    with STATE_LOCK:
        payload = load_dashboard_state(STATE_FILE)
        raw_presets = payload.get("view_presets", [])
        presets: list[dict] = []
        if isinstance(raw_presets, list):
            for item in raw_presets:
                preset = normalize_view_preset(item)
                if preset:
                    presets.append(preset)
        default_state = payload.get("locator_default", {})
        if isinstance(default_state, dict):
            state = default_state.get("state", {})
            if isinstance(state, dict) and state and not any(item["id"] == "current-default" for item in presets):
                presets.insert(0, {
                    "id": "current-default",
                    "name": "Current default",
                    "state": state,
                    "saved_at": str(default_state.get("saved_at") or ""),
                    "saved_by": str(default_state.get("saved_by") or ""),
                })
        return presets


def set_dashboard_user_state(username: str, state: dict) -> dict:
    if not STATE_FILE:
        return {}
    with STATE_LOCK:
        payload = load_dashboard_state(STATE_FILE)
        users = payload.setdefault("users", {})
        existing = users.get(username, {})
        incoming = state if isinstance(state, dict) else {}
        workflow_update = ticket_workflow_from_state(incoming)
        if workflow_update:
            payload["ticket_workflow"] = merge_ticket_workflow(get_shared_ticket_workflow(payload), workflow_update)
        user_update = {key: value for key, value in incoming.items() if key not in TICKET_WORKFLOW_KEYS}
        users[username] = dict(existing if isinstance(existing, dict) else {})
        users[username].update(user_update)
        for key in TICKET_WORKFLOW_KEYS:
            users[username].pop(key, None)
        save_dashboard_state(STATE_FILE, payload)
        return overlay_shared_ticket_workflow(users[username], payload)


def normalize_ticket_actions_state(value: object) -> dict:
    if not isinstance(value, dict):
        return {}
    normalized = {}
    for ticket_number, actions in value.items():
        if isinstance(actions, list):
            selected = [str(action) for action in actions if action]
            if selected:
                normalized[str(ticket_number)] = selected
    return normalized


def normalize_ticket_action_timestamps(value: object) -> dict:
    if not isinstance(value, dict):
        return {}
    normalized = {}
    for ticket_number, updated_at in value.items():
        try:
            timestamp = float(updated_at)
        except (TypeError, ValueError):
            continue
        if timestamp > 0:
            normalized[str(ticket_number)] = timestamp
    return normalized


def merge_ticket_actions(existing: dict, incoming: dict) -> tuple[dict, dict]:
    existing_actions = normalize_ticket_actions_state(existing.get("ticketActions"))
    incoming_actions = normalize_ticket_actions_state(incoming.get("ticketActions"))
    existing_timestamps = normalize_ticket_action_timestamps(existing.get("ticketActionUpdatedAt"))
    incoming_timestamps = normalize_ticket_action_timestamps(incoming.get("ticketActionUpdatedAt"))
    merged_actions = dict(existing_actions)
    merged_timestamps = dict(existing_timestamps)
    ticket_numbers = set(existing_actions) | set(incoming_actions) | set(existing_timestamps) | set(incoming_timestamps)
    for ticket_number in ticket_numbers:
        if ticket_number not in incoming_timestamps:
            if ticket_number in existing_actions:
                continue
            if ticket_number in incoming_actions:
                merged_actions[ticket_number] = incoming_actions[ticket_number]
            continue
        incoming_time = incoming_timestamps.get(ticket_number, 0)
        existing_time = existing_timestamps.get(ticket_number, 0)
        if incoming_time >= existing_time:
            if ticket_number in incoming_actions:
                merged_actions[ticket_number] = incoming_actions[ticket_number]
            else:
                merged_actions.pop(ticket_number, None)
            merged_timestamps[ticket_number] = incoming_time
    return merged_actions, merged_timestamps


def merge_dashboard_user_state(existing: dict, incoming: dict) -> dict:
    merged = dict(existing)
    merged.update(incoming)
    merged_actions, merged_timestamps = merge_ticket_actions(existing, incoming)
    merged["ticketActions"] = merged_actions
    merged["ticketActionUpdatedAt"] = merged_timestamps
    return merged


def set_view_preset(username: str, payload_update: dict) -> dict:
    if not STATE_FILE:
        return {}
    with STATE_LOCK:
        payload = load_dashboard_state(STATE_FILE)
        raw_presets = payload.get("view_presets", [])
        presets = []
        if isinstance(raw_presets, list):
            presets = [preset for preset in (normalize_view_preset(item) for item in raw_presets) if preset]
        name = str(payload_update.get("name") or "").strip()[:80] or "Saved view"
        state = payload_update.get("state", {})
        state = normalize_view_state(state)
        preset_id = safe_file_component(str(payload_update.get("id") or name), "view")
        saved = {
            "id": preset_id,
            "name": name,
            "state": state,
            "saved_at": dashboard_now_iso(),
            "saved_by": username,
        }
        presets = [preset for preset in presets if preset["id"] != preset_id and preset["name"].lower() != name.lower()]
        presets.append(saved)
        payload["view_presets"] = sorted(presets, key=lambda item: item["name"].lower())
        save_dashboard_state(STATE_FILE, payload)
        return saved


def set_locator_default_state(username: str, payload_update: dict) -> dict:
    if not STATE_FILE:
        return {"enabled": False, "state": {}}
    with STATE_LOCK:
        payload = load_dashboard_state(STATE_FILE)
        current = payload.get("locator_default", {})
        if not isinstance(current, dict):
            current = {}
        enabled = bool(payload_update.get("enabled", current.get("enabled", False)))
        state = payload_update.get("state", current.get("state", {}))
        if not isinstance(state, dict):
            state = {}
        saved = {
            "enabled": enabled,
            "state": state,
            "saved_at": dashboard_now_iso(),
            "saved_by": username,
        }
        payload["locator_default"] = saved
        save_dashboard_state(STATE_FILE, payload)
        return saved


def set_employee_dashboard_state(username: str, payload_update: dict) -> dict:
    if not STATE_FILE:
        return {"enabled": False, "state": {}}
    with STATE_LOCK:
        payload = load_dashboard_state(STATE_FILE)
        current = payload.get("employee_dashboard", {})
        if not isinstance(current, dict):
            current = {}
        enabled = bool(payload_update.get("enabled", current.get("enabled", False)))
        state = payload_update.get("state", current.get("state", {}))
        if not isinstance(state, dict):
            state = {}
        saved = {
            "enabled": enabled,
            "state": state,
            "saved_at": dashboard_now_iso(),
            "saved_by": username,
        }
        payload["employee_dashboard"] = saved
        save_dashboard_state(STATE_FILE, payload)
        return saved


def login_page_html(message: str = "", next_path: str = "/") -> str:
    message_html = f'<div class="login-message">{html.escape(message)}</div>' if message else ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fiber Locator Login</title>
  <link rel="icon" type="image/png" href="/favicon.ico?v=20260522170500">
  <link rel="shortcut icon" type="image/png" href="/favicon.ico?v=20260522170500">
  <link rel="apple-touch-icon" href="/static/fiberlocatorfinal.png?v=20260522170500">
  <style>
    body {{
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Arial, Helvetica, sans-serif;
      background:
        radial-gradient(circle at center, rgba(13, 17, 23, 0.08), #0d1117 76%),
        url("/static/fiberlocatorfinal.png?v=20260522170500") center / min(92vmin, 820px) no-repeat,
        #0d1117;
      color: #f8fbff;
    }}
    .login-shell {{
      display: grid;
      gap: 12px;
      justify-items: center;
      width: min(420px, calc(100vw - 32px));
    }}
    .login-app-logo {{
      display: none;
      width: 150px;
      height: 150px;
      object-fit: contain;
      border-radius: 30px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 16px 42px rgba(0, 0, 0, 0.42);
    }}
    .login {{
      position: relative;
      overflow: hidden;
      justify-self: center;
      align-self: center;
      transform: translate(-150px, 112px);
      width: 100%;
      padding: 24px;
      border: 1px solid rgba(226, 239, 255, 0.18);
      border-radius: 8px;
      background: rgba(8, 13, 24, 0.24);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32);
      backdrop-filter: blur(0.5px);
    }}
    @media (max-width: 560px) {{
      body {{
        background: #0d1117;
      }}
      .login-shell {{
        align-self: center;
      }}
      .login-app-logo {{
        display: block;
      }}
      .login {{
        transform: none;
      }}
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 22px;
      color: #ffffff;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.65);
    }}
    p {{
      margin: 0 0 14px;
      color: #dcecff;
      font-size: 13px;
      line-height: 1.35;
      text-shadow: 0 1px 5px rgba(0, 0, 0, 0.75);
    }}
    label {{
      display: grid;
      gap: 6px;
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 700;
      color: #f8fbff;
      text-shadow: 0 1px 5px rgba(0, 0, 0, 0.75);
    }}
    input {{
      height: 36px;
      padding: 0 10px;
      border: 1px solid #31415a;
      border-radius: 6px;
      background: rgba(11, 18, 32, 0.94);
      color: #f8fbff;
      font: inherit;
    }}
    button {{
      width: 100%;
      height: 38px;
      border: 1px solid #263244;
      border-radius: 6px;
      background: #1a7f49;
      color: #f8fbff;
      font: inherit;
      font-weight: 700;
    }}
    .login-message {{
      margin: 0 0 12px;
      color: #b3261e;
      font-size: 13px;
      font-weight: 700;
    }}
    .hint {{
      margin-top: 14px;
      color: #dcecff;
      font-size: 12px;
      text-shadow: 0 1px 5px rgba(0, 0, 0, 0.75);
    }}
  </style>
</head>
<body>
  <main class="login-shell">
    <img class="login-app-logo" src="/static/fiberlocatorfinal.png?v=20260522170500" alt="Fiber Locator">
    <form class="login" method="post" action="/login">
      <h1>Fiber Locator</h1>
      <p>Sign in to view tickets, Vetro layers, and refresh data.</p>
      {message_html}
      <input type="hidden" name="next" value="{html.escape(next_path)}">
      <label>
        Username
        <input name="username" autocomplete="username" required>
      </label>
      <label>
        Password
        <input name="password" type="password" autocomplete="current-password" required>
      </label>
      <button type="submit">Log in</button>
      <div class="hint">Use the Fiber Locator dashboard address after signing in.</div>
    </form>
  </main>
</body>
</html>"""


def employee_setup_page_html(token: str, message: str = "", username: str = "") -> str:
    invite = find_employee_invite(token)
    display_name = username or str((invite or {}).get("display_name") or (invite or {}).get("username") or "employee")
    message_html = f'<div class="login-message">{html.escape(message)}</div>' if message else ""
    disabled = "" if invite else " disabled"
    intro = "Create your password to open the Fiber Locator employee dashboard." if invite else "This employee setup link is invalid or has already been used."
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Employee Setup</title>
  <link rel="icon" type="image/png" href="/favicon.ico?v=20260522170500">
  <link rel="shortcut icon" type="image/png" href="/favicon.ico?v=20260522170500">
  <link rel="apple-touch-icon" href="/static/fiberlocatorfinal.png?v=20260522170500">
  <style>
    body {{
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Arial, Helvetica, sans-serif;
      background: #0d1117;
      color: #e5eef6;
    }}
    .login {{
      width: min(420px, calc(100vw - 32px));
      padding: 24px;
      border: 1px solid #263244;
      border-radius: 8px;
      background: #111827;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 22px;
    }}
    p {{
      margin: 0 0 14px;
      color: #a4b0bd;
      font-size: 13px;
      line-height: 1.35;
    }}
    label {{
      display: grid;
      gap: 6px;
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 700;
    }}
    input {{
      height: 36px;
      padding: 0 10px;
      border: 1px solid #263244;
      border-radius: 6px;
      background: #172033;
      color: #e5eef6;
      font: inherit;
    }}
    button {{
      width: 100%;
      height: 38px;
      border: 1px solid #263244;
      border-radius: 6px;
      background: #1a7f49;
      color: #f8fbff;
      font: inherit;
      font-weight: 700;
    }}
    button:disabled {{
      opacity: 0.45;
    }}
    .login-message {{
      margin: 0 0 12px;
      color: #b3261e;
      font-size: 13px;
      font-weight: 700;
    }}
    .hint {{
      margin-top: 14px;
      color: #a4b0bd;
      font-size: 12px;
    }}
  </style>
</head>
<body>
  <form class="login" method="post" action="/employee-setup">
    <h1>Employee Dashboard</h1>
    <p>{html.escape(intro)}</p>
    {message_html}
    <input type="hidden" name="token" value="{html.escape(token)}">
    <label>
      Username
      <input name="username" value="{html.escape(display_name)}" readonly>
    </label>
    <label>
      Password
      <input name="password" type="password" autocomplete="new-password" minlength="8" required{disabled}>
    </label>
    <label>
      Confirm password
      <input name="confirm" type="password" autocomplete="new-password" minlength="8" required{disabled}>
    </label>
    <button type="submit"{disabled}>Create password</button>
    <div class="hint">After setup, use this password on the normal Fiber Locator login page.</div>
  </form>
</body>
</html>"""


def privacy_policy_page_html() -> str:
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fiber Locator Privacy Policy</title>
  <style>
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #f8fafc; }
    main { max-width: 780px; margin: 0 auto; padding: 32px 18px 48px; line-height: 1.55; }
    h1 { margin: 0 0 8px; font-size: 30px; }
    h2 { margin-top: 28px; font-size: 18px; }
    p, li { font-size: 15px; }
  </style>
</head>
<body>
  <main>
    <h1>Fiber Locator Privacy Policy</h1>
    <p><strong>Effective date:</strong> 2026-06-01</p>
    <p>Fiber Locator is a private field-work application for authorized locating crews. The app connects to the Fiber Locator dashboard to help users review assigned One Call tickets, view ticket maps, submit completion information, and upload supporting field attachments.</p>
    <h2>Information The App Handles</h2>
    <ul>
      <li>Account login information, such as username and password.</li>
      <li>Session cookies used to keep authorized users signed in.</li>
      <li>Ticket workflow information, including ticket numbers, ticket details, ticket status, locate actions, notes, and timestamps.</li>
      <li>User-selected photos or videos uploaded as ticket attachments.</li>
      <li>Device location permission for the map's optional Locate me feature.</li>
      <li>Profile information entered by the user, such as name, email, phone, company, title, address, and profile photo.</li>
    </ul>
    <p>The current Locate me feature is used to show the user's position on the in-app map. It is not uploaded to the Fiber Locator dashboard by the current Android app build.</p>
    <h2>How Information Is Used</h2>
    <p>Information is used to provide the app's field workflow, including authentication, account access review, profile management, ticket review, map display, ticket completion, attachment upload, and dashboard synchronization.</p>
    <h2>Sharing</h2>
    <p>Fiber Locator does not sell user data. Data is used for the private Fiber Locator dashboard workflow and is not intended for public sharing.</p>
    <p>The app may load map tiles or related map resources from configured map providers to display map backgrounds and field context.</p>
    <h2>Data Retention</h2>
    <p>Ticket workflow data, account records, profile details, and attachments are retained according to the Fiber Locator dashboard's operational needs. Authorized administrators may remove or correct records when required.</p>
    <h2>Security</h2>
    <p>Access to live ticket data requires an authorized Fiber Locator account. The production dashboard connection uses HTTPS for login, ticket sync, notes, profile updates, and attachments.</p>
    <h2>Contact</h2>
    <p>For privacy or account questions, contact the Fiber Locator administrator at the support email provided in the Google Play listing.</p>
  </main>
</body>
</html>"""


def kml_text(parent: ET.Element, tag: str) -> str:
    node = parent.find(f".//{{*}}{tag}")
    return (node.text or "").strip() if node is not None else ""


def parse_kml_description(value: str) -> dict[str, str]:
    props = {}
    for line in (value or "").splitlines():
        if ":" not in line:
            continue
        key, item = line.split(":", 1)
        props[key.strip().lower().replace(" ", "_")] = item.strip()
    return props


def parse_kml_coordinates(value: str) -> list[list[float]]:
    coordinates = []
    for chunk in re.split(r"\s+", (value or "").strip()):
        if not chunk:
            continue
        parts = chunk.split(",")
        if len(parts) < 2:
            continue
        try:
            coordinates.append([float(parts[0]), float(parts[1])])
        except ValueError:
            continue
    return coordinates


def kml_to_geojson(path: Path) -> dict:
    root = ET.fromstring(path.read_text(encoding="utf-8", errors="replace"))
    features = []
    for placemark in root.findall(".//{*}Placemark"):
        name = kml_text(placemark, "name")
        description = kml_text(placemark, "description")
        props = parse_kml_description(description)
        props.update(
            {
                "label": name,
                "name": name,
                "source_file": str(path),
                "description": description,
            }
        )

        geometry = None
        point = placemark.find(".//{*}Point/{*}coordinates")
        line = placemark.find(".//{*}LineString/{*}coordinates")
        polygon = placemark.find(".//{*}Polygon//{*}outerBoundaryIs/{*}LinearRing/{*}coordinates")

        if point is not None:
            coords = parse_kml_coordinates(point.text or "")
            if coords:
                geometry = {"type": "Point", "coordinates": coords[0]}
        elif line is not None:
            coords = parse_kml_coordinates(line.text or "")
            if len(coords) >= 2:
                geometry = {"type": "LineString", "coordinates": coords}
        elif polygon is not None:
            coords = parse_kml_coordinates(polygon.text or "")
            if len(coords) >= 3:
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                geometry = {"type": "Polygon", "coordinates": [coords]}

        if geometry:
            features.append({"type": "Feature", "properties": props, "geometry": geometry})
    return {"type": "FeatureCollection", "features": features}


def count_kml_placemarks(path: Path) -> int:
    try:
        return path.read_text(encoding="utf-8", errors="ignore").lower().count("<placemark")
    except OSError:
        return 0


def find_vetro_layers(*search_dirs: Path) -> list[Path]:
    for search_dir in search_dirs:
        if not search_dir.exists():
            continue
        geojson_dir = search_dir / "vetro_geojson_layers"
        if geojson_dir.exists():
            layers = sorted(geojson_dir.glob("Layer_*.geojson"))
            if layers:
                return layers
        layers = sorted(search_dir.glob("Layer_*.geojson"))
        if layers:
            return layers
        layers = sorted(search_dir.glob("vetro_clean_corrected_by_layer_5k_part*.kml"))
        if layers:
            return layers
    return []


def find_vitruvi_layers(*search_dirs: Path) -> list[Path]:
    candidates = [
        "vitruvi_site_owner.geojson",
        "vitruvi_google_earth_combined.geojson",
        "Vitruvi Export GIS_20250927-070959.geojson",
        "vitruvi_layers_corrected.geojson",
        "vitruvi.export.from.earth.kml",
    ]
    for search_dir in search_dirs:
        if not search_dir.exists():
            continue
        for name in candidates:
            path = search_dir / name
            if path.exists():
                return [path]
        matches = sorted(search_dir.glob("vitruvi*.geojson"), key=lambda item: item.stat().st_size if item.exists() else 0, reverse=True)
        if matches:
            return [matches[0]]
    return []


def read_geojson(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    if data.get("type") == "FeatureCollection":
        return data
    if data.get("type") == "Feature":
        return {"type": "FeatureCollection", "features": [data]}
    return {"type": "FeatureCollection", "features": []}


def first_prop(props: dict, *names: str) -> str:
    for name in names:
        if name in props and props[name] not in (None, ""):
            return str(props[name])
    lowered = {str(key).lower(): value for key, value in props.items()}
    for name in names:
        value = lowered.get(name.lower())
        if value not in (None, ""):
            return str(value)
    return ""


def normalize_vetro_feature(feature: dict, source_file: str) -> dict:
    props = dict(feature.get("properties") or {})
    layer_id = first_prop(props, "layer_id", "Layer_ID")
    vector_layer = first_prop(props, "vector_layer", "Vector_layer")
    props.setdefault("source_file", source_file)
    if layer_id:
        props["layer_id"] = layer_id
        props.setdefault("Layer_ID", layer_id)
    if vector_layer:
        props["vector_layer"] = vector_layer
    for canonical, aliases in {
        "plan": ("plan", "Plan"),
        "plan_id": ("plan_id", "Plan_ID"),
        "status_id": ("status_id", "Status_ID"),
        "build": ("Build", "build"),
        "placement": ("Placement", "placement"),
        "vetro_id": ("vetro_id", "Vetro_ID"),
        "feature_id": ("ID", "id", "Name", "name", "TT_ID", "Global_ID_TT"),
        "street_address": ("Street_Address", "Street Address", "street_address"),
    }.items():
        value = first_prop(props, *aliases)
        if value:
            props[canonical] = value
    feature["properties"] = props
    return feature


def normalize_vitruvi_feature(feature: dict, source_file: str) -> dict:
    props = dict(feature.get("properties") or {})
    props.setdefault("source_file", source_file)
    category_name = first_prop(props, "category_name", "geojson_layer", "Category_Name", "Category name")
    category = first_prop(props, "category", "Category", "category_id", "Category_ID")
    status = first_prop(props, "status", "Status")
    layer_id = category_name or category or first_prop(props, "Layer", "layer") or "Vitruvi"
    props["vitruvi_layer"] = layer_id
    props["vitruvi_layer_label"] = category_name or (f"Category {category}" if category else layer_id)
    if category:
        props["vitruvi_category"] = category
    if status:
        props["vitruvi_status"] = status
    for canonical, aliases in {
        "vitruvi_id": ("vitruvi_id", "ID", "id"),
        "feature_id": ("uid", "vetro_id", "label", "name", "Name"),
        "region_name": ("region_name", "Region"),
        "full_address": ("full_address", "address", "Address"),
        "planned_length": ("planned_length", "total_length", "shape__len"),
    }.items():
        value = first_prop(props, *aliases)
        if value:
            props[canonical] = value
    feature["properties"] = props
    return feature


def vetro_metadata(features: list[dict], sources: list[str]) -> dict:
    layers: dict[str, dict] = {}
    facets = {
        "plans": {},
        "builds": {},
        "placements": {},
        "statuses": {},
        "geometry_types": {},
    }
    for feature in features:
        props = feature.get("properties") or {}
        geometry_type = (feature.get("geometry") or {}).get("type") or "Unknown"
        layer_id = str(props.get("layer_id") or "Unknown")
        layer = layers.setdefault(
            layer_id,
            {"id": layer_id, "label": f"Layer {layer_id}", "feature_count": 0, "geometry_counts": {}},
        )
        layer["feature_count"] += 1
        layer["geometry_counts"][geometry_type] = layer["geometry_counts"].get(geometry_type, 0) + 1
        for facet_name, prop_name in [
            ("plans", "plan"),
            ("builds", "build"),
            ("placements", "placement"),
            ("statuses", "status_id"),
        ]:
            value = props.get(prop_name)
            if value not in (None, ""):
                value = str(value)
                facets[facet_name][value] = facets[facet_name].get(value, 0) + 1
        facets["geometry_types"][geometry_type] = facets["geometry_types"].get(geometry_type, 0) + 1
    return {
        "sources": sources,
        "feature_count": len(features),
        "layers": sorted(layers.values(), key=lambda item: (item["id"] == "Unknown", int(item["id"]) if item["id"].isdigit() else item["id"])),
        "facets": {key: dict(sorted(value.items())) for key, value in facets.items()},
    }


def vetro_layer_signature(paths: list[Path]) -> tuple[tuple[str, int, int], ...]:
    signature = []
    for path in paths:
        if not path.exists():
            continue
        stat = path.stat()
        signature.append((str(path), stat.st_mtime_ns, stat.st_size))
    return tuple(signature)


def build_vetro_payload(paths: list[Path]) -> dict:
    features = []
    sources = []
    for path in paths:
        if not path.exists():
            continue
        sources.append(str(path))
        if path.suffix.lower() == ".geojson":
            geojson = read_geojson(path)
        else:
            geojson = kml_to_geojson(path)
        for feature in geojson["features"]:
            features.append(normalize_vetro_feature(feature, path.name))
    return {"type": "FeatureCollection", "features": features, "metadata": vetro_metadata(features, sources)}


def get_vetro_response(paths: list[Path]) -> tuple[bytes, bytes]:
    signature = vetro_layer_signature(paths)
    with VETRO_CACHE_LOCK:
        if VETRO_RESPONSE_CACHE["signature"] == signature:
            return VETRO_RESPONSE_CACHE["body"], VETRO_RESPONSE_CACHE["gzip_body"]
        payload = build_vetro_payload(paths)
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        gzip_body = gzip.compress(body, compresslevel=6)
        VETRO_RESPONSE_CACHE.update({"signature": signature, "body": body, "gzip_body": gzip_body})
        return body, gzip_body


def vitruvi_metadata(features: list[dict], sources: list[str]) -> dict:
    layers: dict[str, dict] = {}
    statuses: dict[str, int] = {}
    geometry_types: dict[str, int] = {}
    for feature in features:
        props = feature.get("properties") or {}
        geometry_type = (feature.get("geometry") or {}).get("type") or "Unknown"
        layer_id = str(props.get("vitruvi_layer") or "Vitruvi")
        label = str(props.get("vitruvi_layer_label") or layer_id)
        layer = layers.setdefault(layer_id, {"id": layer_id, "label": label, "feature_count": 0, "geometry_counts": {}})
        layer["feature_count"] += 1
        layer["geometry_counts"][geometry_type] = layer["geometry_counts"].get(geometry_type, 0) + 1
        status = props.get("vitruvi_status")
        if status not in (None, ""):
            status = str(status)
            statuses[status] = statuses.get(status, 0) + 1
        geometry_types[geometry_type] = geometry_types.get(geometry_type, 0) + 1
    return {
        "sources": sources,
        "feature_count": len(features),
        "layers": sorted(layers.values(), key=lambda item: (-item["feature_count"], item["label"])),
        "facets": {
            "statuses": dict(sorted(statuses.items())),
            "geometry_types": dict(sorted(geometry_types.items())),
        },
    }


def build_vitruvi_payload(paths: list[Path]) -> dict:
    features = []
    sources = []
    seen = set()
    for path in paths:
        if not path.exists():
            continue
        sources.append(str(path))
        geojson = read_geojson(path) if path.suffix.lower() == ".geojson" else kml_to_geojson(path)
        for feature in geojson["features"]:
            if not feature.get("geometry"):
                continue
            normalized = normalize_vitruvi_feature(feature, path.name)
            props = normalized.get("properties") or {}
            geometry = normalized.get("geometry") or {}
            stable_id = first_prop(props, "uid", "vetro_id", "vitruvi_id", "feature_id", "label", "ID", "id")
            dedupe_key = (
                str(props.get("vitruvi_layer") or ""),
                stable_id,
                json.dumps(geometry, sort_keys=True, separators=(",", ":")),
            )
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            features.append(normalized)
    return {"type": "FeatureCollection", "features": features, "metadata": vitruvi_metadata(features, sources)}


def get_vitruvi_response(paths: list[Path]) -> tuple[bytes, bytes]:
    signature = vetro_layer_signature(paths)
    with VITRUVI_CACHE_LOCK:
        if VITRUVI_RESPONSE_CACHE["signature"] == signature:
            return VITRUVI_RESPONSE_CACHE["body"], VITRUVI_RESPONSE_CACHE["gzip_body"]
        payload = build_vitruvi_payload(paths)
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        gzip_body = gzip.compress(body, compresslevel=6)
        VITRUVI_RESPONSE_CACHE.update({"signature": signature, "body": body, "gzip_body": gzip_body})
        return body, gzip_body


def clear_vetro_response_cache() -> None:
    with VETRO_CACHE_LOCK:
        VETRO_RESPONSE_CACHE.update({"signature": None, "body": b"", "gzip_body": b""})


def text_from_email(path: Path) -> tuple[dict[str, str], str]:
    message = BytesParser(policy=policy.default).parsebytes(path.read_bytes())
    headers = {
        "subject": message.get("subject", ""),
        "from": message.get("from", ""),
        "date": message.get("date", ""),
        "to": message.get("to", ""),
    }

    chunks: list[str] = []
    for part in message.walk():
        if part.get_content_maintype() == "multipart":
            continue
        if part.get_content_type() in {"text/plain", "text/html"}:
            content = part.get_content()
            if part.get_content_type() == "text/html":
                content = re.sub(r"<[^>]+>", " ", content)
            chunks.append(content)
    return headers, "\n".join(chunks)


def text_from_ticket_text(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    headers = {"subject": path.stem, "from": "", "date": "", "to": ""}
    body_lines = []
    in_headers = True
    for line in text.splitlines():
        if in_headers and not line.strip():
            in_headers = False
            continue
        if in_headers and ":" in line:
            key, value = line.split(":", 1)
            normalized = key.strip().lower()
            if normalized in {"subject", "from", "date", "to"}:
                headers[normalized] = value.strip()
                continue
        body_lines.append(line)
    body = "\n".join(body_lines).strip() or text
    return headers, body


def normalize_key(key: str) -> str:
    return re.sub(r"\s+", " ", key.strip(" -\r\n\t").upper())


def extract_fields(text: str) -> dict[str, list[str]]:
    fields: dict[str, list[str]] = {}
    for key, value in FIELD_RE.findall(text):
        fields.setdefault(normalize_key(key), []).append(re.sub(r"\s+", " ", value.strip()))
    return fields


def first(fields: dict[str, list[str]], key: str, index: int = 0) -> str:
    values = fields.get(key, [])
    if index < len(values):
        return values[index]
    return ""


def first_float(fields: dict[str, list[str]], key: str) -> float | None:
    value = first(fields, key)
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def extract_prepared(text: str) -> tuple[str, str]:
    match = re.search(r"PREPARED-+\[(.*?)\]\s+AT\s+\[(.*?)\]", text, re.I | re.S)
    if not match:
        return "", ""
    return match.group(1).strip(), match.group(2).strip()


def extract_work_begin(text: str) -> tuple[str, str]:
    match = re.search(r"WORK TO BEGIN-+\[(.*?)\]\s+AT\s+\[(.*?)\]", text, re.I | re.S)
    if not match:
        return "", ""
    return match.group(1).strip(), match.group(2).strip()


def extract_street(text: str) -> str:
    match = re.search(r"STREET-+\[(.*?)\]\[(.*?)\]\[(.*?)\]\[(.*?)\]", text, re.I | re.S)
    if not match:
        return first(extract_fields(text), "STREET")
    pieces = [re.sub(r"\s+", " ", part.strip()) for part in match.groups() if part.strip()]
    return " ".join(pieces)


def extract_utilities(text: str) -> list[str]:
    marker = re.search(r"UTILITIES NOTIFIED-+", text, re.I)
    if not marker:
        return []
    tail = text[marker.end() :]
    tail = tail.split("MEMBERS NOTIFIED", 1)[0]
    tail = tail.split("END OF", 1)[0]
    lines = [line.strip() for line in tail.splitlines()]
    utilities: list[str] = []
    for line in lines:
        if not line or set(line) <= {"-", " "}:
            continue
        if line.upper().startswith(("CODE ", "NAME ")):
            continue
        for code, name in re.findall(r"\b([A-Z0-9]{3,12})\s+([A-Z0-9 &'./()-]{3,}?)(?=\s{2,}[A-Z0-9]{3,12}\s+|$)", line):
            utilities.append(f"{code.strip()} {name.strip()}")
    return utilities


def polygon_ring_to_coordinates(value: str) -> list[list[float]]:
    ring = []
    for pair in value.split(","):
        parts = pair.strip().split()
        if len(parts) < 2:
            continue
        try:
            lon = float(parts[0])
            lat = float(parts[1])
        except ValueError:
            continue
        ring.append([lon, lat])
    if len(ring) < 3:
        return []
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def polygon_wkt_to_geojson(wkt: str) -> dict | None:
    value = html.unescape(wkt or "").strip()
    match = re.search(r"^POLYGON\s*\(\((.*?)\)\)\s*$", value, re.I | re.S)
    if match:
        ring = polygon_ring_to_coordinates(match.group(1))
        if not ring:
            return None
        return {"type": "Polygon", "coordinates": [ring]}

    match = re.search(r"^MULTIPOLYGON\s*\(\s*(.*?)\s*\)\s*$", value, re.I | re.S)
    if match:
        rings = re.findall(r"\(\((.*?)\)\)", match.group(1), re.S)
        polygons = []
        for ring_text in rings:
            ring = polygon_ring_to_coordinates(ring_text)
            if ring:
                polygons.append([ring])
        if not polygons:
            return None
        return {"type": "MultiPolygon", "coordinates": polygons}

    match = re.search(r"POLYGON\s*\(\((.*?)\)\)", value, re.I | re.S)
    if not match:
        return None
    ring = polygon_ring_to_coordinates(match.group(1))
    if not ring:
        return None
    return {"type": "Polygon", "coordinates": [ring]}


def html_to_plain_text(value: str) -> str:
    text = re.sub(r"<script.*?</script>", " ", value or "", flags=re.I | re.S)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def portal_value(text: str, label: str, next_labels: Iterable[str]) -> str:
    label_pattern = re.escape(label) + r":?\s*"
    next_pattern = "|".join(re.escape(item) + r":?" for item in next_labels)
    pattern = label_pattern + rf"(.*?)(?=\s+(?:{next_pattern})|$)"
    match = re.search(pattern, text, re.I | re.S)
    return match.group(1).strip() if match else ""


def portal_detail_to_ticket(detail: GeoCallDetail) -> Ticket:
    text = html_to_plain_text(detail.portal_html)
    labels = [
        "Compliance",
        "By",
        "Source",
        "Hours Notice",
        "Type",
        "Date",
        "Latitude",
        "Longitude",
        "Phone",
        "Contact",
        "Contact Email",
        "Caller Name",
        "Caller Phone",
        "Caller Email",
        "Callback",
        "State",
        "County",
        "Place",
        "Work Date",
        "Done For",
        "Street",
        "Intersection",
        "Extent",
        "Explosives",
        "Directional Boring",
        "Whitelined",
        "Driving Directions",
        "Remarks",
        "Positive Response Status",
    ]
    ticket_number = detail.ticket_number or (TICKET_RE.search(text).group(0) if TICKET_RE.search(text) else "")
    coords = re.findall(r"\b(-?\d{1,3}\.\d+)\s+(-?\d{1,3}\.\d+)\b", text)
    latitude = longitude = None
    if coords:
        try:
            latitude, longitude = float(coords[0][0]), float(coords[0][1])
        except ValueError:
            pass

    company_match = re.search(r"Company Information\s+(.*?)\s+Phone:", text, re.I | re.S)
    contractor = company_match.group(1).strip() if company_match else ""
    if contractor:
        contractor = contractor.split("  ")[0].strip()

    return Ticket(
        file=f"GeoCall cache {detail.ticket_id}",
        subject=f"GeoCall Ticket {ticket_number}",
        sender="GeoCall cached page",
        email_date="",
        ticket_number=ticket_number,
        message_type=portal_value(text, "Type", labels),
        prepared_date=portal_value(text, "Date", labels),
        prepared_time="",
        contractor=contractor,
        caller=portal_value(text, "Caller Name", labels),
        company_address="",
        company_city="",
        company_state="",
        company_zip="",
        company_phone=portal_value(text, "Phone", labels),
        contact=portal_value(text, "Contact", labels),
        contact_phone="",
        contact_email=portal_value(text, "Contact Email", labels),
        work_begin_date=portal_value(text, "Work Date", labels),
        work_begin_time="",
        state=portal_value(text, "State", labels),
        county=portal_value(text, "County", labels),
        place=portal_value(text, "Place", labels),
        address="",
        street=portal_value(text, "Street", labels),
        nearest_intersection=portal_value(text, "Intersection", labels),
        latitude=latitude,
        longitude=longitude,
        location_information=portal_value(text, "Driving Directions", labels),
        work_type=portal_value(text, "Type", labels),
        done_for=portal_value(text, "Done For", labels),
        extent=portal_value(text, "Extent", labels),
        explosives=portal_value(text, "Explosives", labels),
        white_paint=portal_value(text, "Whitelined", labels),
        directional_boring=portal_value(text, "Directional Boring", labels),
        utilities_notified=[],
        portal_ticket_id=detail.ticket_id,
        portal_url=f"https://geocall.arkonecall.com/geocall/client/item/ticket/{detail.ticket_id}?pr=true",
        portal_html_available=bool(detail.portal_html),
        polygon=polygon_wkt_to_geojson(detail.polygon_wkt),
        raw_text=text,
    )


def parse_ticket(path: Path) -> Ticket:
    if path.suffix.lower() == ".eml":
        headers, text = text_from_email(path)
    else:
        headers, text = text_from_ticket_text(path)
    fields = extract_fields(text)
    ticket_match = TICKET_RE.search(headers["subject"]) or TICKET_RE.search(text)
    prepared_date, prepared_time = extract_prepared(text)
    work_begin_date, work_begin_time = extract_work_begin(text)

    return Ticket(
        file=str(path),
        subject=headers["subject"],
        sender=headers["from"],
        email_date=headers["date"],
        ticket_number=ticket_match.group(0) if ticket_match else "",
        message_type=first(fields, "MESSAGE TYPE"),
        prepared_date=prepared_date,
        prepared_time=prepared_time,
        contractor=first(fields, "CONTRACTOR"),
        caller=first(fields, "CALLER"),
        company_address=first(fields, "ADDRESS"),
        company_city=first(fields, "CITY"),
        company_state=first(fields, "STATE"),
        company_zip=first(fields, "ZIP"),
        company_phone=first(fields, "PHONE"),
        contact=first(fields, "CONTACT"),
        contact_phone=first(fields, "PHONE", 1),
        contact_email=first(fields, "EMAIL"),
        work_begin_date=work_begin_date,
        work_begin_time=work_begin_time,
        state=first(fields, "STATE", 1),
        county=first(fields, "COUNTY"),
        place=first(fields, "PLACE"),
        address=first(fields, "ADDRESS", 1),
        street=extract_street(text),
        nearest_intersection=first(fields, "NEAREST INTERSECTION"),
        latitude=first_float(fields, "LATITUDE"),
        longitude=first_float(fields, "LONGITUDE"),
        location_information=first(fields, "LOCATION INFORMATION"),
        work_type=first(fields, "WORK TYPE"),
        done_for=first(fields, "DONE FOR"),
        extent=first(fields, "EXTENT"),
        explosives=first(fields, "EXPLOSIVES"),
        white_paint=first(fields, "WHITE PAINT"),
        directional_boring=first(fields, "DIRECTIONAL BORING"),
        utilities_notified=extract_utilities(text),
        portal_ticket_id="",
        portal_url="",
        portal_html_available=False,
        polygon=None,
        raw_text=text,
    )


def read_geocall_export(path: Path) -> list[GeoCallDetail]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Skipping GeoCall export {path}: {exc}")
        return []

    if isinstance(payload, dict):
        items = payload.get("tickets", [])
    elif isinstance(payload, list):
        items = payload
    else:
        items = []

    details = []
    for item in items:
        if not isinstance(item, dict):
            continue
        ticket_number = str(item.get("ticketNumber") or item.get("ticket_number") or "")
        ticket_id = str(item.get("ticketId") or item.get("ticket_id") or "")
        if not ticket_number or not ticket_id:
            continue
        details.append(
            GeoCallDetail(
                ticket_number=ticket_number,
                ticket_id=ticket_id,
                source_url=str(item.get("sourceUrl") or item.get("source_url") or ""),
                polygon_wkt=html.unescape(str(item.get("polygon") or "")),
                portal_html=str(item.get("html") or item.get("portalHtml") or item.get("portal_html") or ""),
            )
        )
    return details


def load_geocall_details(downloads_dir: Path, data_dir: Path) -> dict[str, GeoCallDetail]:
    details: dict[str, GeoCallDetail] = {}
    paths = list(downloads_dir.glob("arkonecall_ticket_details*.json"))
    paths += list(data_dir.glob("arkonecall_ticket_details*.json"))
    for path in sorted(paths):
        for detail in read_geocall_export(path):
            details[detail.ticket_number] = detail
    return details


def parse_ticket_date(value: str) -> date | None:
    value = (value or "").strip()
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%B %d, %Y %I:%M %p", "%b %d, %Y %I:%M %p", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def ticket_is_active_scope(ticket: Ticket) -> bool:
    if ticket.county.strip().upper() not in ACTIVE_TICKET_COUNTIES:
        return False
    work_begin = parse_ticket_date(ticket.work_begin_date)
    if not work_begin:
        return False
    return work_begin >= ACTIVE_TICKET_MIN_WORK_BEGIN


def load_tickets(downloads_dir: Path, data_dir: Path, inbox_dir: Path) -> list[Ticket]:
    geocall_details = load_geocall_details(downloads_dir, data_dir)
    paths = []
    for source_dir in [downloads_dir, inbox_dir]:
        if not source_dir.exists():
            continue
        paths += sorted(source_dir.glob("Arkansas One Call Ticket *.eml"))
        paths += sorted(source_dir.glob("Arkansas One Call Ticket *.txt"))
    tickets = []
    seen = set()
    for path in paths:
        try:
            ticket = parse_ticket(path)
        except Exception as exc:
            print(f"Skipping {path}: {exc}")
            continue
        if not ticket.ticket_number or ticket.ticket_number in seen:
            continue
        detail = geocall_details.get(ticket.ticket_number)
        if detail:
            ticket.portal_ticket_id = detail.ticket_id
            ticket.portal_url = f"https://geocall.arkonecall.com/geocall/client/item/ticket/{detail.ticket_id}?pr=true"
            ticket.portal_html_available = bool(detail.portal_html)
            ticket.polygon = polygon_wkt_to_geojson(detail.polygon_wkt)
        tickets.append(ticket)
        seen.add(ticket.ticket_number)
    existing = {ticket.ticket_number for ticket in tickets}
    for detail in geocall_details.values():
        if detail.ticket_number in existing or not detail.portal_html:
            continue
        ticket = portal_detail_to_ticket(detail)
        tickets.append(ticket)
    return tickets


class DashboardHandler(SimpleHTTPRequestHandler):
    downloads_dir: Path
    data_dir: Path
    inbox_dir: Path
    vetro_layers: list[Path]
    vitruvi_layers: list[Path]
    layers_dir: Path
    auth_users: dict[str, dict[str, str]]
    state_file: Path | None

    def do_HEAD(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/privacy-policy":
            body = privacy_policy_page_html().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return
        if parsed.path == "/mobile":
            self.redirect("/")
            return
        super().do_HEAD()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path in {"/favicon.ico", "/manifest.webmanifest", "/static/service-worker.js", "/static/fiberlocatorfinal.png", "/static/fiberlocatorwhitebackgroud.png", "/android-auto/app/build/outputs/apk/release/app-release.apk"}:
            self.send_public_asset(parsed.path)
            return
        if parsed.path == "/privacy-policy":
            self.send_privacy_policy()
            return
        if parsed.path == "/login":
            if self.is_authenticated():
                self.redirect("/")
                return
            self.send_login_page(parsed)
            return
        if parsed.path.startswith("/employee-setup/"):
            token = parsed.path.rsplit("/", 1)[-1]
            self.send_employee_setup_page(token)
            return
        if parsed.path == "/logout":
            self.logout()
            return
        if not self.is_authenticated():
            self.unauthorized(parsed)
            return
        if parsed.path == "/mobile":
            self.redirect("/")
            return
        if parsed.path == "/":
            self.audit_event("page_view", {"path": parsed.path})
        if parsed.path == "/api/tickets":
            self.send_tickets()
            return
        if parsed.path == "/api/refresh":
            self.send_refresh_status()
            return
        if parsed.path == "/api/state":
            self.send_state()
            return
        if parsed.path == "/api/view-presets":
            self.send_view_presets()
            return
        if parsed.path == "/api/employee-dashboard":
            self.send_employee_dashboard()
            return
        if parsed.path == "/api/audit":
            self.send_audit_events()
            return
        if parsed.path == "/api/employees":
            self.send_employee_access()
            return
        if parsed.path == "/api/account/profile":
            self.send_account_profile()
            return
        if parsed.path == "/api/map-config":
            self.send_map_config()
            return
        if parsed.path == "/api/map-search":
            query = parse_qs(parsed.query).get("q", [""])[0]
            self.send_map_search(query)
            return
        if parsed.path == "/api/attachments":
            ticket_number = parse_qs(parsed.query).get("ticket", [""])[0]
            self.send_attachments(ticket_number)
            return
        if parsed.path == "/api/onedrive/status":
            self.send_onedrive_status()
            return
        if parsed.path == "/api/attachments/file":
            query = parse_qs(parsed.query)
            ticket_number = query.get("ticket", [""])[0]
            attachment_id = query.get("id", [""])[0]
            self.send_attachment_file(ticket_number, attachment_id)
            return
        if parsed.path.startswith("/data/history/"):
            self.send_history_file(parsed.path)
            return
        if parsed.path == "/api/vetro":
            self.send_vetro()
            return
        if parsed.path == "/api/vitruvi":
            self.send_vitruvi()
            return
        if parsed.path == "/api/vetro-refresh":
            self.send_vetro_refresh_status()
            return
        if parsed.path == "/api/portal-html":
            ticket_number = parse_qs(parsed.query).get("ticket", [""])[0]
            self.send_portal_html(ticket_number)
            return
        if parsed.path == "/api/health":
            self.send_json({"ok": True, "time": dashboard_now_iso()})
            return
        super().do_GET()

    def send_public_asset(self, path: str) -> None:
        original_path = self.path
        self.path = "/static/fiberlocatorfinal.png" if path == "/favicon.ico" else path
        try:
            super().do_GET()
        finally:
            self.path = original_path

    def send_privacy_policy(self) -> None:
        body = privacy_policy_page_html().encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/login":
            self.handle_login()
            return
        if parsed.path == "/employee-setup":
            self.handle_employee_setup()
            return
        if parsed.path == "/api/account/request":
            self.create_account_access_request()
            return
        if not self.is_authenticated():
            self.unauthorized(parsed)
            return
        if parsed.path == "/api/refresh":
            self.start_refresh()
            return
        if parsed.path == "/api/state":
            self.update_state()
            return
        if parsed.path == "/api/view-presets":
            self.update_view_preset()
            return
        if parsed.path == "/api/locator-default":
            self.update_locator_default()
            return
        if parsed.path == "/api/employee-dashboard":
            self.update_employee_dashboard()
            return
        if parsed.path == "/api/audit":
            self.receive_audit_event()
            return
        if parsed.path == "/api/employees/invite":
            self.create_employee_access_invite()
            return
        if parsed.path == "/api/admin/geocall-fetch":
            self.admin_fetch_geocall_tickets()
            return
        if parsed.path == "/api/account/profile":
            self.update_account_profile()
            return
        if parsed.path == "/api/vetro-refresh":
            self.start_vetro_refresh()
            return
        if parsed.path == "/api/vetro-capture":
            self.save_vetro_capture()
            return
        if parsed.path == "/api/attachments":
            self.upload_attachment()
            return
        if parsed.path == "/api/onedrive/device-code":
            self.start_onedrive_device_code()
            return
        if parsed.path == "/api/onedrive/complete-device-code":
            self.complete_onedrive_device_code()
            return
        self.send_error(404, "Unknown endpoint")

    def is_authenticated(self) -> bool:
        if not self.auth_users:
            return True
        cookie_header = self.headers.get("Cookie", "")
        match = re.search(r"(?:^|;\s*)onecall_auth=([^;]+)", cookie_header)
        if not match:
            return False
        token = match.group(1).strip()
        return valid_auth_session(token)

    def current_username(self) -> str:
        if not self.auth_users:
            return "default"
        cookie_header = self.headers.get("Cookie", "")
        match = re.search(r"(?:^|;\s*)onecall_auth=([^;]+)", cookie_header)
        if not match:
            return ""
        return auth_session_username(match.group(1).strip())

    def current_user_role(self) -> str:
        return auth_user_role(self.current_username(), self.auth_users)

    def client_ip(self) -> str:
        forwarded = self.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
        return str(self.client_address[0] if self.client_address else "")

    def audit_event(self, event: str, details: object | None = None, username: str | None = None) -> None:
        try:
            write_audit_event(self.data_dir, event, username if username is not None else self.current_username(), self.client_ip(), details)
        except Exception as exc:
            print(f"Unable to write audit event: {exc}")

    def can_write_shared_dashboard(self, username: str) -> bool:
        if not self.auth_users:
            return True
        return username in SHARED_DASHBOARD_WRITE_USERS

    def request_origin(self) -> str:
        proto = self.headers.get("X-Forwarded-Proto", "http").split(",", 1)[0].strip() or "http"
        host = self.headers.get("Host", "")
        return f"{proto}://{host}" if host else ""

    def shared_dashboard_write_denied(self, username: str, target: str) -> None:
        self.audit_event("shared_dashboard_write_denied", {"target": target}, username=username)
        self.send_response(403)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": False, "message": "Shared dashboard write access denied"}).encode("utf-8"))

    def redirect(self, location: str) -> None:
        self.send_response(302)
        self.send_header("Location", location)
        self.end_headers()

    def unauthorized(self, parsed) -> None:
        if parsed.path.startswith("/api/"):
            self.send_response(401)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Login required"}).encode("utf-8"))
            return
        self.redirect(f"/login?next={quote(parsed.path or '/', safe='/')}")

    def send_login_page(self, parsed) -> None:
        next_path = parse_qs(parsed.query).get("next", ["/"])[0] or "/"
        body = login_page_html("", next_path).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_employee_setup_page(self, token: str, message: str = "") -> None:
        invite = find_employee_invite(token)
        username = str((invite or {}).get("username") or "")
        body = employee_setup_page_html(token, message, username).encode("utf-8")
        self.send_response(200 if invite else 404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_login(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        payload = self.rfile.read(content_length).decode("utf-8", errors="replace")
        form = parse_qs(payload)
        username = (form.get("username", [""])[0] or "").strip()
        password = form.get("password", [""])[0] or ""
        next_path = form.get("next", ["/"])[0] or "/"
        if not str(next_path).startswith("/"):
            next_path = "/"
        if verify_credentials(username, password, self.auth_users):
            token = create_auth_session(username)
            self.audit_event("login_success", {"next": next_path}, username=username)
            self.send_response(302)
            self.send_header("Set-Cookie", self.auth_cookie(token, AUTH_SESSION_TTL_SECONDS))
            self.send_header("Location", next_path)
            self.end_headers()
            return
        self.audit_event("login_failed", {"username": username, "next": next_path}, username=username or "unknown")
        body = login_page_html("Invalid username or password", next_path).encode("utf-8")
        self.send_response(401)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_employee_setup(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        payload = self.rfile.read(content_length).decode("utf-8", errors="replace")
        form = parse_qs(payload)
        token = (form.get("token", [""])[0] or "").strip()
        password = form.get("password", [""])[0] or ""
        confirm = form.get("confirm", [""])[0] or ""
        if password != confirm:
            self.audit_event("employee_setup_failed", {"reason": "password_mismatch"}, username="employee_setup")
            body = employee_setup_page_html(token, "Passwords do not match.").encode("utf-8")
            self.send_response(400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        ok, username, message = complete_employee_invite(token, password)
        if not ok:
            self.audit_event("employee_setup_failed", {"reason": message}, username="employee_setup")
            body = employee_setup_page_html(token, message).encode("utf-8")
            self.send_response(400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.__class__.auth_users = load_auth_users(AUTH_FILE) if AUTH_FILE else self.auth_users
        token_value = create_auth_session(username)
        self.audit_event("employee_setup_completed", {}, username=username)
        self.send_response(302)
        self.send_header("Set-Cookie", self.auth_cookie(token_value, AUTH_SESSION_TTL_SECONDS))
        self.send_header("Location", "/")
        self.end_headers()

    def logout(self) -> None:
        self.audit_event("logout", {})
        self.send_response(302)
        self.send_header("Set-Cookie", self.auth_cookie("", 0))
        self.send_header("Location", "/login")
        self.end_headers()

    def auth_cookie(self, token: str, max_age: int) -> str:
        forwarded_proto = self.headers.get("X-Forwarded-Proto", "").split(",", 1)[0].strip().lower()
        secure = "; Secure" if isinstance(self.request, ssl.SSLSocket) or forwarded_proto == "https" else ""
        return f"onecall_auth={token}; HttpOnly{secure}; SameSite=Lax; Path=/; Max-Age={max_age}"

    def send_tickets(self) -> None:
        with ATTACHMENT_LOCK:
            attachment_index = load_attachments_index(self.data_dir)
        tickets = []
        polygon_count = 0
        missing_polygon_count = 0
        for ticket in load_tickets(self.downloads_dir, self.data_dir, self.inbox_dir):
            item = asdict(ticket)
            if ticket.polygon:
                polygon_count += 1
                item["polygon_status"] = "loaded"
            else:
                missing_polygon_count += 1
                item["polygon_status"] = "missing_geocall_cache"
            item["attachment_summary"] = summarize_ticket_attachments(attachment_index, ticket.ticket_number)
            tickets.append(item)
        self.send_json({
            "tickets": tickets,
            "downloads_dir": str(self.downloads_dir),
            "inbox_dir": str(self.inbox_dir),
            "polygon_summary": {
                "loaded": polygon_count,
                "missing": missing_polygon_count,
                "total": len(tickets),
            },
        })

    def send_refresh_status(self) -> None:
        self.send_json(REFRESH_STATE)

    def send_state(self) -> None:
        username = self.current_username()
        role = self.current_user_role() if username else "admin"
        state = get_effective_dashboard_state(username, role) if username else {}
        profile = public_auth_profile(username, self.auth_users.get(username) or {}) if username else {}
        self.send_json({
            "ok": True,
            "username": username,
            "role": role,
            "displayName": str(profile.get("display_name") or username),
            "profile": profile,
            "state": state,
            "locatorDefault": get_locator_default_state(),
            "viewPresets": get_view_presets(),
            "employeeDashboard": get_employee_dashboard_state(),
        })

    def send_view_presets(self) -> None:
        self.send_json({"ok": True, "viewPresets": get_view_presets()})

    def send_employee_dashboard(self) -> None:
        self.send_json({"ok": True, "employeeDashboard": get_employee_dashboard_state()})

    def send_audit_events(self) -> None:
        username = self.current_username()
        if username not in AUDIT_VIEW_USERS and not self.can_write_shared_dashboard(username):
            self.send_response(403)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Activity access denied"}).encode("utf-8"))
            return
        raw_limit = parse_qs(urlparse(self.path).query).get("limit", ["300"])[0]
        try:
            limit = int(raw_limit)
        except (TypeError, ValueError):
            limit = 300
        self.send_json({"ok": True, "events": read_audit_events(self.data_dir, limit)})

    def receive_audit_event(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        payload = self.rfile.read(content_length).decode("utf-8", errors="replace")
        try:
            data = json.loads(payload) if payload else {}
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        event = str(data.get("event") or "client_event")
        details = data.get("details") if isinstance(data.get("details"), dict) else {}
        self.audit_event(event, details)
        self.send_json({"ok": True})

    def send_employee_access(self) -> None:
        username = self.current_username()
        if not username or not self.can_write_shared_dashboard(username) or not AUTH_FILE:
            self.shared_dashboard_write_denied(username, "employees")
            return
        payload = employee_access_payload(AUTH_FILE)
        self.send_json({"ok": True, **payload})

    def create_employee_access_invite(self) -> None:
        username = self.current_username()
        if not username or not self.can_write_shared_dashboard(username) or not AUTH_FILE:
            self.shared_dashboard_write_denied(username, "employees")
            return
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        payload = self.rfile.read(content_length).decode("utf-8", errors="replace")
        try:
            data = json.loads(payload) if payload else {}
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        invite, message = create_employee_invite(
            AUTH_FILE,
            str(data.get("username") or ""),
            str(data.get("display_name") or ""),
            username,
        )
        if not invite:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": message or "Unable to create invite"}).encode("utf-8"))
            return
        invite_url = f"{self.request_origin()}/employee-setup/{quote(str(invite.pop('token')), safe='')}"
        self.__class__.auth_users = load_auth_users(AUTH_FILE)
        self.audit_event("employee_invite_created", {"username": invite.get("username")}, username=username)
        self.send_json({"ok": True, "invite": invite, "invite_url": invite_url, **employee_access_payload(AUTH_FILE)})

    def admin_fetch_geocall_tickets(self) -> None:
        username = self.current_username()
        if not username or not self.can_write_shared_dashboard(username):
            self.shared_dashboard_write_denied(username, "admin_geocall_fetch")
            return
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0 or content_length > 1_200_000:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Ticket fetch request is empty or too large."}).encode("utf-8"))
            return
        payload = self.rfile.read(content_length).decode("utf-8", errors="replace")
        try:
            data = json.loads(payload) if payload else {}
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        raw_tickets = str(data.get("ticket_numbers") or data.get("ticketNumbers") or "")
        ticket_numbers = []
        seen = set()
        for ticket_number in TICKET_RE.findall(raw_tickets):
            if ticket_number in seen:
                continue
            seen.add(ticket_number)
            ticket_numbers.append(ticket_number)
        if not ticket_numbers:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Enter at least one valid ticket number like 260529-1101."}).encode("utf-8"))
            return
        if len(ticket_numbers) > 75:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Fetch 75 or fewer tickets at a time."}).encode("utf-8"))
            return
        curl_text = str(data.get("curl") or data.get("curlText") or "").strip()
        if curl_text and "-H" not in curl_text and "-b" not in curl_text:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Paste a valid GeoCall Copy as cURL request, or leave cURL blank to reuse the saved one."}).encode("utf-8"))
            return
        if not ADMIN_GEOCALL_LOCK.acquire(blocking=False):
            self.send_response(409)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "A GeoCall ticket fetch is already running."}).encode("utf-8"))
            return
        curl_path = None
        used_saved_curl = False
        try:
            root = Path(__file__).resolve().parent
            if curl_text:
                curl_path = save_admin_geocall_curl(self.data_dir, curl_text)
            else:
                curl_path, message = reusable_admin_geocall_curl(self.data_dir)
                used_saved_curl = True
                if not curl_path:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": False, "message": message}).encode("utf-8"))
                    return
            command = [
                sys.executable,
                str(root / "tools" / "fetch_geocall_details_from_fetch.py"),
                "--curl-file",
                str(curl_path),
                "--downloads-dir",
                str(self.downloads_dir),
                "--data-dir",
                str(self.data_dir),
                "--inbox-dir",
                str(self.inbox_dir),
            ]
            for ticket_number in ticket_numbers:
                command += ["--ticket-number", ticket_number]
            process = subprocess.run(command, cwd=str(root), text=True, capture_output=True, timeout=240, check=False)
            tickets = load_tickets(self.downloads_dir, self.data_dir, self.inbox_dir)
            loaded = {ticket.ticket_number: ticket for ticket in tickets}
            fetched = [ticket for ticket in ticket_numbers if ticket in loaded and (loaded[ticket].polygon or loaded[ticket].portal_html_available)]
            missing = [ticket for ticket in ticket_numbers if ticket not in fetched]
            self.audit_event(
                "admin_geocall_fetch",
                {"requested": len(ticket_numbers), "fetched": len(fetched), "missing": missing[:20], "exit_code": process.returncode, "reused_saved_curl": used_saved_curl},
                username=username,
            )
            self.send_json({
                "ok": process.returncode == 0 or bool(fetched),
                "requested": ticket_numbers,
                "fetched": fetched,
                "missing": missing,
                "exit_code": process.returncode,
                "stdout": process.stdout[-4000:],
                "stderr": process.stderr[-4000:],
                "reused_saved_curl": used_saved_curl,
                "message": f"Fetched {len(fetched)} of {len(ticket_numbers)} requested ticket(s){' using saved GeoCall cURL' if used_saved_curl else ''}.",
            })
        except subprocess.TimeoutExpired:
            self.send_response(504)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "GeoCall fetch timed out. Try fewer tickets or a fresher cURL."}).encode("utf-8"))
        finally:
            ADMIN_GEOCALL_LOCK.release()

    def create_account_access_request(self) -> None:
        if not AUTH_FILE:
            self.send_response(503)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Account requests are not enabled."}).encode("utf-8"))
            return
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        payload = self.rfile.read(content_length).decode("utf-8", errors="replace")
        try:
            data = json.loads(payload) if payload else {}
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        request_record, message = create_account_request(AUTH_FILE, data, self.client_ip())
        if not request_record:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": message or "Unable to submit account request."}).encode("utf-8"))
            return
        self.audit_event("account_request_created", {"email": request_record.get("email")}, username="account_request")
        self.send_json({"ok": True, "message": "Account request submitted.", "request": request_record})

    def send_account_profile(self) -> None:
        username = self.current_username()
        if not username:
            self.send_response(401)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Login required"}).encode("utf-8"))
            return
        self.send_json({"ok": True, "profile": public_auth_profile(username, self.auth_users.get(username) or {})})

    def update_account_profile(self) -> None:
        username = self.current_username()
        if not username or not AUTH_FILE:
            self.send_response(401)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Login required"}).encode("utf-8"))
            return
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        payload = self.rfile.read(content_length).decode("utf-8", errors="replace")
        try:
            data = json.loads(payload) if payload else {}
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        profile, message = update_auth_profile(AUTH_FILE, username, data)
        if not profile:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": message or "Unable to update profile."}).encode("utf-8"))
            return
        self.__class__.auth_users = load_auth_users(AUTH_FILE)
        self.audit_event("account_profile_saved", {"fields": sorted(clean_profile_payload(data).keys())}, username=username)
        self.send_json({"ok": True, "profile": profile})

    def update_state(self) -> None:
        username = self.current_username()
        if not username:
            self.send_response(401)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Login required"}).encode("utf-8"))
            return
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        payload = self.rfile.read(content_length).decode("utf-8", errors="replace")
        try:
            state = json.loads(payload) if payload else {}
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Invalid JSON"}).encode("utf-8"))
            return
        if not isinstance(state, dict):
            state = {}
        if self.current_user_role() == "employee":
            state = filter_employee_user_state(state)
        existing = get_dashboard_user_state(username)
        change_details = summarize_state_change(existing if isinstance(existing, dict) else {}, state)
        saved = set_dashboard_user_state(username, state)
        if change_details:
            self.audit_event("dashboard_state_saved", change_details, username=username)
        self.send_json({"ok": True, "username": username, "state": saved})

    def update_view_preset(self) -> None:
        username = self.current_username()
        if not username:
            self.send_response(401)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Login required"}).encode("utf-8"))
            return
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        payload = self.rfile.read(content_length).decode("utf-8", errors="replace")
        try:
            data = json.loads(payload) if payload else {}
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Invalid JSON"}).encode("utf-8"))
            return
        if not isinstance(data, dict):
            data = {}
        saved = set_view_preset(username, data)
        self.audit_event("view_saved", {"name": saved.get("name"), "id": saved.get("id")}, username=username)
        self.send_json({"ok": True, "username": username, "savedView": saved, "viewPresets": get_view_presets()})

    def update_locator_default(self) -> None:
        username = self.current_username()
        if not username:
            self.send_response(401)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Login required"}).encode("utf-8"))
            return
        if not self.can_write_shared_dashboard(username):
            self.shared_dashboard_write_denied(username, "locator_default")
            return
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        payload = self.rfile.read(content_length).decode("utf-8", errors="replace")
        try:
            data = json.loads(payload) if payload else {}
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Invalid JSON"}).encode("utf-8"))
            return
        if not isinstance(data, dict):
            data = {}
        saved = set_locator_default_state(username, data)
        self.audit_event("locator_default_saved", {"enabled": saved.get("enabled")}, username=username)
        self.send_json({"ok": True, "username": username, "locatorDefault": saved})

    def update_employee_dashboard(self) -> None:
        username = self.current_username()
        if not username:
            self.send_response(401)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Login required"}).encode("utf-8"))
            return
        if not self.can_write_shared_dashboard(username):
            self.shared_dashboard_write_denied(username, "employee_dashboard")
            return
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        payload = self.rfile.read(content_length).decode("utf-8", errors="replace")
        try:
            data = json.loads(payload) if payload else {}
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Invalid JSON"}).encode("utf-8"))
            return
        if not isinstance(data, dict):
            data = {}
        saved = set_employee_dashboard_state(username, data)
        self.audit_event("employee_dashboard_saved", {"enabled": saved.get("enabled")}, username=username)
        self.send_json({"ok": True, "username": username, "employeeDashboard": saved})

    def send_attachments(self, ticket_number: str) -> None:
        ticket_number = str(ticket_number or "").strip()
        if not TICKET_RE.fullmatch(ticket_number):
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Valid ticket number required"}).encode("utf-8"))
            return
        with ATTACHMENT_LOCK:
            index = load_attachments_index(self.data_dir)
            items = index.get("tickets", {}).get(ticket_number, [])
            if not isinstance(items, list):
                items = []
        self.send_json({"ok": True, "ticket": ticket_number, "attachments": items})

    def send_onedrive_status(self) -> None:
        client_id = onedrive_client_id()
        payload = {
            "ok": True,
            "configured": bool(client_id),
            "connected": False,
            "account": None,
            "rootFolder": onedrive_root_folder_name(),
            "message": "",
        }
        if not client_id:
            payload["message"] = "Set ONEDRIVE_GRAPH_CLIENT_ID in the server .env file."
            self.send_json(payload)
            return
        try:
            token = onedrive_refresh_access_token(self.data_dir)
            if token:
                me = onedrive_me(token)
                payload["connected"] = True
                payload["account"] = {
                    "displayName": str(me.get("displayName") or ""),
                    "userPrincipalName": str(me.get("userPrincipalName") or me.get("mail") or ""),
                    "id": str(me.get("id") or ""),
                }
                payload["message"] = "OneDrive is connected."
            else:
                payload["message"] = "OneDrive is configured but not connected."
        except GraphRequestError as exc:
            payload["message"] = str(exc)
        self.send_json(payload)

    def start_onedrive_device_code(self) -> None:
        client_id = onedrive_client_id()
        if not client_id:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Set ONEDRIVE_GRAPH_CLIENT_ID in the server .env file first."}).encode("utf-8"))
            return
        try:
            device = graph_request_json(
                "POST",
                f"{MICROSOFT_AUTH_BASE}/{onedrive_tenant()}/oauth2/v2.0/devicecode",
                form={"client_id": client_id, "scope": onedrive_scope()},
            )
        except GraphRequestError as exc:
            self.send_response(502)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": str(exc)}).encode("utf-8"))
            return
        with ONEDRIVE_AUTH_LOCK:
            ONEDRIVE_PENDING_AUTH.clear()
            ONEDRIVE_PENDING_AUTH.update({
                "device_code": device.get("device_code"),
                "expires_at": time.time() + int(device.get("expires_in") or 900),
            })
        self.send_json({
            "ok": True,
            "message": device.get("message") or "",
            "verificationUri": device.get("verification_uri") or device.get("verification_uri_complete") or "",
            "userCode": device.get("user_code") or "",
            "expiresIn": int(device.get("expires_in") or 900),
            "interval": int(device.get("interval") or 5),
        })

    def complete_onedrive_device_code(self) -> None:
        with ONEDRIVE_AUTH_LOCK:
            device_code = str(ONEDRIVE_PENDING_AUTH.get("device_code") or "")
            expires_at = float(ONEDRIVE_PENDING_AUTH.get("expires_at") or 0)
        if not device_code or time.time() > expires_at:
            self.send_response(410)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "OneDrive sign-in expired. Start again from Settings."}).encode("utf-8"))
            return
        try:
            payload = graph_request_json(
                "POST",
                microsoft_token_url(),
                form={
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    "client_id": onedrive_client_id(),
                    "device_code": device_code,
                },
            )
        except GraphRequestError as exc:
            error = exc.payload.get("error")
            code = str(error.get("code") or "") if isinstance(error, dict) else ""
            if "authorization_pending" in str(exc) or code == "authorization_pending":
                self.send_response(202)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "pending": True, "message": "Waiting for Microsoft sign-in approval."}).encode("utf-8"))
                return
            if "slow_down" in str(exc) or code == "slow_down":
                self.send_response(202)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "pending": True, "message": "Microsoft asked us to poll more slowly."}).encode("utf-8"))
                return
            self.send_response(502)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": str(exc)}).encode("utf-8"))
            return
        payload["saved_at"] = dashboard_now_iso()
        save_private_json(onedrive_token_cache_path(self.data_dir), payload)
        with ONEDRIVE_AUTH_LOCK:
            ONEDRIVE_PENDING_AUTH.clear()
        account = {}
        try:
            account = onedrive_me(str(payload.get("access_token") or ""))
        except GraphRequestError:
            pass
        self.send_json({
            "ok": True,
            "connected": True,
            "account": {
                "displayName": str(account.get("displayName") or ""),
                "userPrincipalName": str(account.get("userPrincipalName") or account.get("mail") or ""),
            },
        })

    def send_attachment_file(self, ticket_number: str, attachment_id: str) -> None:
        ticket_number = str(ticket_number or "").strip()
        attachment_id = safe_file_component(attachment_id, "")
        if not TICKET_RE.fullmatch(ticket_number) or not attachment_id:
            self.send_error(400, "Valid ticket and attachment id required")
            return
        with ATTACHMENT_LOCK:
            index = load_attachments_index(self.data_dir)
            items = index.get("tickets", {}).get(ticket_number, [])
            item = next((entry for entry in items if isinstance(entry, dict) and entry.get("id") == attachment_id), None)
        if not item:
            self.send_error(404, "Attachment not found")
            return
        if item.get("provider") == "onedrive" and item.get("url"):
            self.redirect(str(item.get("url")))
            return
        filename = safe_file_component(str(item.get("stored_name") or ""), "")
        path = ticket_attachment_dir(self.data_dir, ticket_number) / filename
        try:
            resolved_root = ticket_attachment_dir(self.data_dir, ticket_number).resolve()
            resolved_path = path.resolve()
        except OSError:
            self.send_error(404, "Attachment not found")
            return
        if resolved_root not in resolved_path.parents or not resolved_path.exists():
            self.send_error(404, "Attachment not found")
            return
        content_type = str(item.get("content_type") or mimetypes.guess_type(str(resolved_path))[0] or "application/octet-stream")
        body = resolved_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Disposition", f'inline; filename="{safe_file_component(str(item.get("original_name") or filename))}"')
        self.end_headers()
        self.wfile.write(body)

    def send_history_file(self, request_path: str) -> None:
        filename = Path(unquote(request_path)).name
        if not filename or filename in {".", ".."}:
            self.send_error(404, "History file not found")
            return
        path = (self.data_dir / "history" / filename).resolve()
        try:
            history_root = (self.data_dir / "history").resolve()
        except OSError:
            self.send_error(404, "History file not found")
            return
        if history_root not in path.parents or not path.exists() or not path.is_file():
            self.send_error(404, "History file not found")
            return
        body = path.read_bytes()
        content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def upload_attachment(self) -> None:
        content_type = self.headers.get("Content-Type", "")
        if not content_type.lower().startswith("multipart/form-data"):
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "multipart/form-data required"}).encode("utf-8"))
            return
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(content_length)
        message = BytesParser(policy=policy.default).parsebytes(
            f"Content-Type: {content_type}\nMIME-Version: 1.0\n\n".encode("utf-8") + body
        )
        fields: dict[str, str] = {}
        file_parts = []
        for part in message.iter_parts():
            disposition = part.get_content_disposition()
            if disposition != "form-data":
                continue
            name = part.get_param("name", header="content-disposition")
            filename = part.get_filename()
            if filename:
                file_parts.append(part)
            elif name:
                try:
                    fields[str(name)] = str(part.get_content() or "")
                except Exception:
                    fields[str(name)] = part.get_payload(decode=True).decode("utf-8", errors="replace")
        ticket_number = str(fields.get("ticket", "") or "").strip()
        note = str(fields.get("note", "") or "").strip()
        if not TICKET_RE.fullmatch(ticket_number):
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Valid ticket number required"}).encode("utf-8"))
            return
        if len(file_parts) > ONEDRIVE_MAX_ATTACHMENTS:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": f"Select {ONEDRIVE_MAX_ATTACHMENTS} attachments or fewer."}).encode("utf-8"))
            return
        try:
            token = onedrive_access_token(self.data_dir)
            folder = onedrive_ensure_folder_path(token, [onedrive_root_folder_name(), ticket_number])
            folder_id = str(folder.get("id") or "")
            folder_url = onedrive_create_folder_link(token, folder_id, str(folder.get("webUrl") or ""))
        except GraphRequestError as exc:
            self.send_response(409 if exc.status == 401 else 502)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": str(exc)}).encode("utf-8"))
            return
        saved_items = []
        with ATTACHMENT_LOCK:
            index = load_attachments_index(self.data_dir)
            tickets = index.setdefault("tickets", {})
            items = tickets.setdefault(ticket_number, [])
            if not isinstance(items, list):
                items = []
                tickets[ticket_number] = items
            for part in file_parts:
                original_name = safe_file_component(part.get_filename() or "", "")
                if not original_name:
                    continue
                attachment_id = f"{dashboard_now().strftime('%Y%m%d%H%M%S%f')}_{secrets.token_hex(4)}"
                file_body = part.get_payload(decode=True) or b""
                size = len(file_body)
                content_type = str(part.get_content_type() or mimetypes.guess_type(original_name)[0] or "application/octet-stream")
                try:
                    drive_item = onedrive_upload_bytes(token, folder_id, original_name, file_body)
                except GraphRequestError as exc:
                    self.send_response(502)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": False, "message": str(exc), "uploaded": saved_items}).encode("utf-8"))
                    return
                item = {
                    "id": attachment_id,
                    "ticket": ticket_number,
                    "provider": "onedrive",
                    "original_name": original_name,
                    "stored_name": "",
                    "drive_item_id": str(drive_item.get("id") or ""),
                    "content_type": content_type,
                    "size": size,
                    "note": note,
                    "uploaded_at": dashboard_now_iso(),
                    "uploaded_by": self.current_username() or "default",
                    "url": str(drive_item.get("webUrl") or f"/api/attachments/file?ticket={quote(ticket_number)}&id={quote(attachment_id)}"),
                    "folder_url": folder_url,
                    "folder_name": ticket_number,
                    "folder_id": folder_id,
                }
                items.append(item)
                saved_items.append(item)
            save_attachments_index(self.data_dir, index)
            summary = summarize_ticket_attachments(index, ticket_number)
        self.audit_event("attachments_uploaded", {"ticket": ticket_number, "count": len(saved_items), "note": bool(note)})
        self.send_json({"ok": True, "ticket": ticket_number, "attachments": saved_items, "attachment_summary": summary})

    def start_refresh(self) -> None:
        if not REFRESH_LOCK.acquire(blocking=False):
            self.send_response(409)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Refresh already running"}).encode("utf-8"))
            return

        REFRESH_STATE.update(
            {
                "running": True,
                "started": dashboard_now_iso(),
                "finished": "",
                "success": None,
                "message": "Starting Outlook export and local sync",
                "exit_code": None,
                "logs": [],
            }
        )
        thread = threading.Thread(target=self._run_refresh_job, daemon=True)
        thread.start()
        self.audit_event("ticket_refresh_started", {})
        self.send_json({"ok": True, "running": True, "message": "Refresh started"})

    def _run_refresh_job(self) -> None:
        try:
            root = Path(__file__).resolve().parent
            commands: list[list[str]] = []
            if platform.system().lower() == "windows":
                powershell = str(POWERSHELL_EXE) if POWERSHELL_EXE.exists() else "powershell.exe"
                commands.append(
                    [
                        powershell,
                        "-ExecutionPolicy",
                        "Bypass",
                        "-File",
                        r"C:\Users\reedc\onecall-locator-dashboard\tools\export_outlook_onecall.ps1",
                        "-DaysBack",
                        "4",
                        "-IncludeRead",
                        "-SyncToLocalServer",
                    ]
                )
            else:
                commands.append(
                    [
                        sys.executable,
                        str(root / "tools" / "pull_outlook_graph_tickets.py"),
                        "--output-dir",
                        str(self.inbox_dir),
                    ]
                )
            commands.append(
                [
                    sys.executable,
                    str(root / "tools" / "refresh_onecall_server.py"),
                    "--downloads-dir",
                    str(self.inbox_dir),
                    "--data-dir",
                    str(self.data_dir),
                    "--inbox-dir",
                    str(self.inbox_dir),
                ]
            )
            exit_code = 0
            for command in commands:
                REFRESH_STATE["message"] = "Running: " + " ".join(command[:3]) if command else "Running refresh"
                env = os.environ.copy()
                env.setdefault("OUTLOOK_TICKET_OUTPUT_DIR", str(self.inbox_dir))
                env.setdefault("OUTLOOK_GRAPH_TOKEN_CACHE", str(self.data_dir / "private" / "outlook_graph_token.json"))
                result = subprocess.run(command, check=False, capture_output=True, text=True, env=env)
                if result.stdout.strip():
                    REFRESH_STATE["logs"].append({"command": command[0], "stream": "stdout", "text": result.stdout[-4000:]})
                if result.stderr.strip():
                    REFRESH_STATE["logs"].append({"command": command[0], "stream": "stderr", "text": result.stderr[-4000:]})
                REFRESH_STATE["logs"].append(
                    {
                        "command": command[0],
                        "exit_code": result.returncode,
                    }
                )
                if result.returncode != 0:
                    exit_code = result.returncode
                    break
            refreshed_tickets = load_tickets(self.downloads_dir, self.data_dir, self.inbox_dir)
            REFRESH_STATE.update(
                {
                    "running": False,
                    "finished": dashboard_now_iso(),
                    "success": exit_code == 0,
                    "message": "Refresh complete" if exit_code == 0 else "Refresh failed",
                    "exit_code": exit_code,
                    "counts": {
                        "tickets": len(refreshed_tickets),
                        "polygons": sum(1 for ticket in refreshed_tickets if ticket.polygon),
                        "pages": sum(1 for ticket in refreshed_tickets if ticket.portal_html_available),
                    },
                }
            )
        except Exception as exc:
            REFRESH_STATE.update(
                {
                    "running": False,
                    "finished": dashboard_now_iso(),
                    "success": False,
                    "message": f"Refresh failed: {exc}",
                }
            )
        finally:
            REFRESH_LOCK.release()

    def send_vetro(self) -> None:
        if not self.vetro_layers:
            self.send_error(404, "Vetro layers not found")
            return
        body, gzip_body = get_vetro_response(self.vetro_layers)
        accepts_gzip = "gzip" in self.headers.get("Accept-Encoding", "").lower()
        response_body = gzip_body if accepts_gzip else body
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_body)))
        if accepts_gzip:
            self.send_header("Content-Encoding", "gzip")
        self.end_headers()
        self.wfile.write(response_body)

    def send_vitruvi(self) -> None:
        username = self.current_username()
        if username != "site_owner":
            self.audit_event("vitruvi_access_denied", {}, username=username)
            self.send_response(403)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Vitruvi is only available to site_owner"}).encode("utf-8"))
            return
        if not self.vitruvi_layers:
            self.send_error(404, "Vitruvi layers not found")
            return
        body, gzip_body = get_vitruvi_response(self.vitruvi_layers)
        accepts_gzip = "gzip" in self.headers.get("Accept-Encoding", "").lower()
        response_body = gzip_body if accepts_gzip else body
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_body)))
        if accepts_gzip:
            self.send_header("Content-Encoding", "gzip")
        self.end_headers()
        self.wfile.write(response_body)

    def send_vetro_refresh_status(self) -> None:
        self.send_json(VETRO_REFRESH_STATE)

    def start_vetro_refresh(self) -> None:
        refresh_mode = "api" if os.environ.get("VETRO_TOKEN", "").strip() else "capture"
        capture_path = latest_vetro_capture_path(self.data_dir) if refresh_mode == "capture" else None
        if refresh_mode == "capture" and not capture_path:
            VETRO_REFRESH_STATE.update(
                {
                    "running": False,
                    "started": dashboard_now_iso(),
                    "finished": dashboard_now_iso(),
                    "success": False,
                    "message": "VETRO login required. Open VETRO, capture fresh tile traffic, then save the DevTools capture.",
                    "exit_code": None,
                    "percent": 100,
                    "logs": [],
                    "auth_required": True,
                    "vetro_login_url": VETRO_LOGIN_URL,
                }
            )
            self.audit_event("vetro_refresh_failed", {"message": VETRO_REFRESH_STATE["message"]})
            self.send_response(409)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, **VETRO_REFRESH_STATE}).encode("utf-8"))
            return
        if refresh_mode == "capture" and capture_path:
            capture_stats = analyze_vetro_capture(capture_path.read_text(encoding="utf-8", errors="replace"))
            if not capture_stats.get("ready_for_import"):
                message = str(capture_stats.get("capture_warning") or "The latest VETRO capture cannot be imported.")
                VETRO_REFRESH_STATE.update(
                    {
                        "running": False,
                        "started": dashboard_now_iso(),
                        "finished": dashboard_now_iso(),
                        "success": False,
                        "message": message,
                        "exit_code": None,
                        "percent": 100,
                        "logs": [{"capture": capture_path.name, "stats": capture_stats}],
                        "auth_required": True,
                        "vetro_login_url": VETRO_LOGIN_URL,
                    }
                )
                self.audit_event("vetro_refresh_failed", {"message": message, "capture": capture_path.name, "stats": capture_stats})
                self.send_response(409)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, **VETRO_REFRESH_STATE}).encode("utf-8"))
                return
        if not VETRO_REFRESH_LOCK.acquire(blocking=False):
            self.send_response(409)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "VETRO refresh already running"}).encode("utf-8"))
            return
        VETRO_REFRESH_STATE.update(
            {
                "running": True,
                "started": dashboard_now_iso(),
                "finished": "",
                "success": None,
                "message": "Starting VETRO capture import" if refresh_mode == "capture" else "Starting VETRO export",
                "exit_code": None,
                "percent": 5,
                "logs": [],
                "auth_required": False,
                "vetro_login_url": "",
            }
        )
        thread = threading.Thread(target=self._run_vetro_refresh_job, args=(refresh_mode, capture_path), daemon=True)
        thread.start()
        self.audit_event("vetro_refresh_started", {"mode": refresh_mode, "capture": capture_path.name if capture_path else ""})
        self.send_json({"ok": True, "running": True, "message": VETRO_REFRESH_STATE["message"], "percent": 5})

    def save_vetro_capture(self) -> None:
        username = self.current_username()
        if username != "site_owner":
            self.audit_event("vetro_capture_denied", {}, username=username)
            self.send_response(403)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "VETRO capture access denied"}).encode("utf-8"))
            return
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0 or content_length > 8_000_000:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Capture must be between 1 byte and 8 MB"}).encode("utf-8"))
            return
        raw = self.rfile.read(content_length).decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"content": raw}
        content = str(payload.get("content") or "")
        if not content.strip():
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Capture content is required"}).encode("utf-8"))
            return
        capture_dir = vetro_capture_dir(self.data_dir)
        capture_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        content_path = capture_dir / f"vetro_capture_{stamp}.txt"
        meta_path = capture_dir / f"vetro_capture_{stamp}.json"
        urls = vetro_capture_urls(content)
        capture_stats = analyze_vetro_capture(content)
        content_path.write_text(content, encoding="utf-8")
        meta = {
            "saved_at": dashboard_now_iso(),
            "saved_by": username,
            "bytes": len(content.encode("utf-8")),
            "pbf_url_count": sum(1 for url in urls if ".pbf" in url.lower()),
            "candidate_url_count": len(urls),
            "capture_file": content_path.name,
            **capture_stats,
        }
        meta_path.write_text(json.dumps(meta, indent=2, sort_keys=True), encoding="utf-8")
        for path in (content_path, meta_path):
            try:
                path.chmod(0o600)
            except OSError:
                pass
        self.audit_event("vetro_capture_saved", {key: meta[key] for key in ("bytes", "pbf_url_count", "candidate_url_count")}, username=username)
        self.send_json({"ok": True, **meta})

    def _run_vetro_refresh_job(self, refresh_mode: str = "api", capture_path: Path | None = None) -> None:
        try:
            root = Path(__file__).resolve().parent
            if refresh_mode == "capture":
                if not capture_path:
                    raise RuntimeError("No VETRO capture file is available")
                capture_python = self.data_dir / "vitruvi_refresh_venv" / "bin" / "python"
                python_exe = str(capture_python if capture_python.exists() else Path(sys.executable))
                command = [
                    python_exe,
                    str(root / "tools" / "import_vetro_tiles_from_capture.py"),
                    "--capture-file",
                    str(capture_path),
                    "--output-dir",
                    str(self.layers_dir / "vetro_geojson_layers"),
                    "--backup-dir",
                    str(self.layers_dir / "backups"),
                ]
                VETRO_REFRESH_STATE.update({"message": "Importing VETRO tiles from capture", "percent": 12})
            else:
                command = [
                    sys.executable,
                    str(root / "tools" / "update_vetro_export.py"),
                    "--output-dir",
                    str(self.layers_dir / "vetro_geojson_layers"),
                    "--work-dir",
                    str(self.data_dir / "vetro_export_work"),
                ]
                VETRO_REFRESH_STATE.update({"message": "Requesting VETRO export", "percent": 12})
            env = os.environ.copy()
            env.setdefault("VETRO_PLAN_ID", "462")
            log_dir = self.data_dir / "private" / "vetro_refresh_logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            stamp = dashboard_now().strftime("%Y%m%dT%H%M%SZ")
            stdout_path = log_dir / f"vetro_refresh_{stamp}.stdout.log"
            stderr_path = log_dir / f"vetro_refresh_{stamp}.stderr.log"

            def tail_text(path: Path, limit: int = 4000) -> str:
                try:
                    with path.open("rb") as handle:
                        size = path.stat().st_size
                        handle.seek(max(0, size - limit))
                        return handle.read().decode("utf-8", errors="replace")
                except OSError:
                    return ""

            with stdout_path.open("w", encoding="utf-8") as stdout_file, stderr_path.open("w", encoding="utf-8") as stderr_file:
                process = subprocess.Popen(command, stdout=stdout_file, stderr=stderr_file, text=True, cwd=str(root), env=env)
                while process.poll() is None:
                    message = "VETRO capture import running" if refresh_mode == "capture" else "VETRO export running"
                    VETRO_REFRESH_STATE.update({"message": message, "percent": min(88, int(VETRO_REFRESH_STATE.get("percent") or 12) + 4)})
                    time.sleep(2)

            stdout = tail_text(stdout_path)
            stderr = tail_text(stderr_path)
            if stdout.strip():
                VETRO_REFRESH_STATE["logs"].append({"stream": "stdout", "text": stdout})
            if stderr.strip():
                VETRO_REFRESH_STATE["logs"].append({"stream": "stderr", "text": stderr})
            VETRO_REFRESH_STATE["logs"].append({"command": command[0], "exit_code": process.returncode})
            if process.returncode == 0:
                self.__class__.vetro_layers = find_vetro_layers(self.layers_dir, self.downloads_dir)
                clear_vetro_response_cache()
                VETRO_REFRESH_STATE.update(
                    {
                        "running": False,
                        "finished": dashboard_now_iso(),
                        "success": True,
                        "message": "VETRO capture import completed" if refresh_mode == "capture" else "VETRO refresh completed",
                        "exit_code": 0,
                        "percent": 100,
                        "layer_files": len(self.__class__.vetro_layers),
                        "auth_required": False,
                        "vetro_login_url": "",
                    }
                )
            else:
                VETRO_REFRESH_STATE.update(
                    {
                        "running": False,
                        "finished": dashboard_now_iso(),
                        "success": False,
                        "message": "VETRO capture import failed" if refresh_mode == "capture" else "VETRO refresh failed",
                        "exit_code": process.returncode,
                        "percent": 100,
                        "auth_required": False,
                        "vetro_login_url": "",
                    }
                )
        except Exception as exc:
            VETRO_REFRESH_STATE.update(
                {
                    "running": False,
                    "finished": dashboard_now_iso(),
                    "success": False,
                    "message": f"VETRO refresh failed: {exc}",
                    "percent": 100,
                    "auth_required": False,
                    "vetro_login_url": "",
                }
            )
        finally:
            VETRO_REFRESH_LOCK.release()

    def send_map_config(self) -> None:
        self.send_json({
            "mapboxAccessToken": os.environ.get("MAPBOX_ACCESS_TOKEN", ""),
        })

    def send_map_search(self, query: str) -> None:
        query = query.strip()
        if not query:
            self.send_error(400, "Search text is required")
            return
        url = f"https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q={quote(query)}"
        geocode_request = urllib_request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "fiber-locator-dashboard/1.0",
            },
        )
        try:
            with urllib_request.urlopen(geocode_request, timeout=12) as response:
                results = json.loads(response.read().decode("utf-8", errors="replace"))
        except HTTPError as exc:
            self.send_error(exc.code, "Map search failed")
            return
        except (OSError, URLError, json.JSONDecodeError):
            self.send_error(502, "Map search failed")
            return
        if not results:
            self.send_json({"ok": False, "message": "No map search result found", "query": query})
            return
        result = results[0]
        try:
            latitude = float(result.get("lat"))
            longitude = float(result.get("lon"))
        except (TypeError, ValueError):
            self.send_error(502, "Map search returned invalid coordinates")
            return
        self.send_json({
            "ok": True,
            "query": query,
            "name": result.get("display_name", ""),
            "latitude": latitude,
            "longitude": longitude,
        })

    def send_portal_html(self, ticket_number: str) -> None:
        details = load_geocall_details(self.downloads_dir, self.data_dir)
        detail = details.get(ticket_number)
        if not detail or not detail.portal_html:
            self.send_error(404, "No cached GeoCall page for ticket")
            return
        body = detail.portal_html.encode("utf-8", errors="replace")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, value: object) -> None:
        body = json.dumps(value, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        if self.headers.get("X-Forwarded-Proto", "").split(",", 1)[0].strip().lower() == "https":
            self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        super().end_headers()


def run(
    host: str,
    port: int,
    downloads_dir: Path,
    data_dir: Path,
    inbox_dir: Path,
    layers_dir: Path,
    auth_file: Path,
    certfile: Path | None = None,
    keyfile: Path | None = None,
) -> None:
    root = Path(__file__).parent
    DashboardHandler.downloads_dir = downloads_dir
    DashboardHandler.data_dir = data_dir
    DashboardHandler.inbox_dir = inbox_dir
    DashboardHandler.layers_dir = layers_dir
    DashboardHandler.vetro_layers = find_vetro_layers(layers_dir, downloads_dir)
    DashboardHandler.vitruvi_layers = find_vitruvi_layers(layers_dir, downloads_dir)
    DashboardHandler.auth_users = load_auth_users(auth_file)
    global STATE_FILE, AUTH_FILE
    STATE_FILE = data_dir / "dashboard_state.json"
    AUTH_FILE = auth_file
    DashboardHandler.state_file = STATE_FILE
    handler = lambda *args, **kwargs: DashboardHandler(*args, directory=str(root), **kwargs)
    server = ThreadingHTTPServer((host, port), handler)
    if certfile and keyfile and certfile.exists() and keyfile.exists():
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=str(certfile), keyfile=str(keyfile))
        server.socket = context.wrap_socket(server.socket, server_side=True)
    print(f"One Call dashboard: http://{host}:{port}")
    print(f"Auth: {'enabled' if DashboardHandler.auth_users else 'disabled'}")
    print(f"State file: {STATE_FILE}")
    if certfile and keyfile:
        print(f"TLS cert: {certfile}")
    print(f"Reading emails from: {downloads_dir}")
    print(f"Reading portable ticket inbox from: {inbox_dir}")
    print(f"Reading GeoCall detail exports from: {downloads_dir} and {data_dir}")
    if DashboardHandler.vetro_layers:
        if DashboardHandler.vetro_layers[0].suffix.lower() == ".geojson":
            vetro_count = 0
            for path in DashboardHandler.vetro_layers:
                try:
                    vetro_count += len(read_geojson(path)["features"])
                except (OSError, json.JSONDecodeError):
                    pass
            count_label = f"{vetro_count} features"
        else:
            vetro_count = sum(count_kml_placemarks(path) for path in DashboardHandler.vetro_layers)
            count_label = f"{vetro_count} placemarks"
        print(f"Reading Vetro layers ({len(DashboardHandler.vetro_layers)} file(s), {count_label})")
    else:
        print(f"No Vetro KML layers found in: {layers_dir} or {downloads_dir}")
    if DashboardHandler.vitruvi_layers:
        vitruvi_count = 0
        for path in DashboardHandler.vitruvi_layers:
            try:
                vitruvi_count += len(read_geojson(path)["features"]) if path.suffix.lower() == ".geojson" else count_kml_placemarks(path)
            except (OSError, json.JSONDecodeError):
                pass
        print(f"Reading Vitruvi owner layer ({len(DashboardHandler.vitruvi_layers)} file(s), {vitruvi_count} features)")
    else:
        print(f"No Vitruvi owner layer found in: {layers_dir} or {downloads_dir}")
    server.serve_forever()


def main() -> None:
    root = Path(__file__).parent
    default_data_dir = root / "data"
    parser = argparse.ArgumentParser(description="Arkansas One Call locator dashboard")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--downloads-dir", default="/mnt/c/Users/reedc/Downloads")
    parser.add_argument("--data-dir", default=str(default_data_dir))
    parser.add_argument("--inbox-dir", default=str(default_data_dir / "inbox"))
    parser.add_argument("--layers-dir", default=str(default_data_dir / "layers"))
    parser.add_argument("--auth-file", default=str(default_data_dir / "dashboard_auth.json"))
    parser.add_argument("--certfile", default="")
    parser.add_argument("--keyfile", default="")
    args = parser.parse_args()
    run(
        args.host,
        args.port,
        Path(args.downloads_dir),
        Path(args.data_dir),
        Path(args.inbox_dir),
        Path(args.layers_dir),
        Path(args.auth_file),
        Path(args.certfile) if args.certfile else None,
        Path(args.keyfile) if args.keyfile else None,
    )


if __name__ == "__main__":
    main()
