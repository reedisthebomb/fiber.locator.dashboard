from __future__ import annotations

import argparse
import gzip
import html
import json
import hashlib
import mimetypes
import os
import platform
import ssl
import re
import sys
import subprocess
import xml.etree.ElementTree as ET
import threading
import secrets
from dataclasses import asdict, dataclass
from datetime import date, datetime
from email import policy
from email.parser import BytesParser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, quote, unquote, urlparse


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
ACTIVE_TICKET_COUNTIES = {"UNION", "COLUMBIA"}
ACTIVE_TICKET_MIN_WORK_BEGIN = date(2026, 5, 8)
AUTH_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
AUTH_SESSIONS: dict[str, dict[str, str]] = {}
STATE_LOCK = threading.Lock()
STATE_FILE: Path | None = None
ATTACHMENT_LOCK = threading.Lock()
VETRO_CACHE_LOCK = threading.Lock()
VETRO_RESPONSE_CACHE: dict[str, object] = {"signature": None, "body": b"", "gzip_body": b""}


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


def load_auth_users(path: Path) -> dict[str, dict[str, str]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception as exc:
        print(f"Skipping auth file {path}: {exc}")
        return {}

    users: dict[str, dict[str, str]] = {}
    for item in payload.get("users", []):
        if not isinstance(item, dict):
            continue
        username = str(item.get("username") or "").strip()
        salt = str(item.get("salt") or "").strip()
        password_hash = str(item.get("password_sha256") or "").strip()
        if username and salt and password_hash:
            users[username] = {"salt": salt, "password_sha256": password_hash}
    return users


def auth_password_hash(username: str, password: str, salt: str) -> str:
    value = f"{username}\n{salt}\n{password}".encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def verify_credentials(username: str, password: str, users: dict[str, dict[str, str]]) -> bool:
    record = users.get(username)
    if not record:
        return False
    return auth_password_hash(username, password, record["salt"]) == record["password_sha256"]


def create_auth_session(username: str) -> str:
    token = secrets.token_urlsafe(32)
    AUTH_SESSIONS[token] = {"username": username, "created": datetime.now().isoformat()}
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
    if (datetime.now() - created).total_seconds() > AUTH_SESSION_TTL_SECONDS:
        AUTH_SESSIONS.pop(token, None)
        return False
    return True


def auth_session_username(token: str) -> str:
    record = AUTH_SESSIONS.get(token)
    return str(record.get("username") or "") if record else ""


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


def get_dashboard_user_state(username: str) -> dict:
    if not STATE_FILE:
        return {}
    with STATE_LOCK:
        payload = load_dashboard_state(STATE_FILE)
        users = payload.setdefault("users", {})
        state = users.get(username, {})
        return state if isinstance(state, dict) else {}


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


def set_dashboard_user_state(username: str, state: dict) -> dict:
    if not STATE_FILE:
        return {}
    with STATE_LOCK:
        payload = load_dashboard_state(STATE_FILE)
        users = payload.setdefault("users", {})
        users[username] = state if isinstance(state, dict) else {}
        save_dashboard_state(STATE_FILE, payload)
        return users[username]


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
            "saved_at": datetime.now().isoformat(timespec="seconds"),
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
            "saved_at": datetime.now().isoformat(timespec="seconds"),
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
  <title>One Call Dashboard Login</title>
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
  <form class="login" method="post" action="/login">
    <h1>One Call Dashboard</h1>
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
    <div class="hint">Use the dashboard address on the home server after signing in.</div>
  </form>
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


def polygon_wkt_to_geojson(wkt: str) -> dict | None:
    match = re.search(r"POLYGON\s*\(\((.*?)\)\)", wkt or "", re.I | re.S)
    if not match:
        return None

    ring = []
    for pair in match.group(1).split(","):
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
        return None
    if ring[0] != ring[-1]:
        ring.append(ring[0])
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
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
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
    auth_users: dict[str, dict[str, str]]
    state_file: Path | None

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/login":
            if self.is_authenticated():
                self.redirect("/")
                return
            self.send_login_page(parsed)
            return
        if parsed.path == "/logout":
            self.logout()
            return
        if not self.is_authenticated():
            self.unauthorized(parsed)
            return
        if parsed.path == "/api/tickets":
            self.send_tickets()
            return
        if parsed.path == "/api/refresh":
            self.send_refresh_status()
            return
        if parsed.path == "/api/state":
            self.send_state()
            return
        if parsed.path == "/api/employee-dashboard":
            self.send_employee_dashboard()
            return
        if parsed.path == "/api/attachments":
            ticket_number = parse_qs(parsed.query).get("ticket", [""])[0]
            self.send_attachments(ticket_number)
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
        if parsed.path == "/api/portal-html":
            ticket_number = parse_qs(parsed.query).get("ticket", [""])[0]
            self.send_portal_html(ticket_number)
            return
        if parsed.path == "/api/health":
            self.send_json({"ok": True, "time": datetime.now().isoformat()})
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/login":
            self.handle_login()
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
        if parsed.path == "/api/locator-default":
            self.update_locator_default()
            return
        if parsed.path == "/api/employee-dashboard":
            self.update_employee_dashboard()
            return
        if parsed.path == "/api/attachments":
            self.upload_attachment()
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
            self.send_response(302)
            self.send_header("Set-Cookie", f"onecall_auth={token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age={AUTH_SESSION_TTL_SECONDS}")
            self.send_header("Location", next_path)
            self.end_headers()
            return
        body = login_page_html("Invalid username or password", next_path).encode("utf-8")
        self.send_response(401)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def logout(self) -> None:
        cookie = "onecall_auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
        self.send_response(302)
        self.send_header("Set-Cookie", cookie)
        self.send_header("Location", "/login")
        self.end_headers()

    def send_tickets(self) -> None:
        tickets = [asdict(ticket) for ticket in load_tickets(self.downloads_dir, self.data_dir, self.inbox_dir)]
        self.send_json({"tickets": tickets, "downloads_dir": str(self.downloads_dir), "inbox_dir": str(self.inbox_dir)})

    def send_refresh_status(self) -> None:
        self.send_json(REFRESH_STATE)

    def send_state(self) -> None:
        username = self.current_username()
        state = get_dashboard_user_state(username) if username else {}
        self.send_json({
            "ok": True,
            "username": username,
            "state": state,
            "locatorDefault": get_locator_default_state(),
            "employeeDashboard": get_employee_dashboard_state(),
        })

    def send_employee_dashboard(self) -> None:
        self.send_json({"ok": True, "employeeDashboard": get_employee_dashboard_state()})

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
        saved = set_dashboard_user_state(username, state)
        self.send_json({"ok": True, "username": username, "state": saved})

    def update_locator_default(self) -> None:
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
        saved = set_locator_default_state(username, data)
        self.send_json({"ok": True, "username": username, "locatorDefault": saved})

    def update_employee_dashboard(self) -> None:
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
        saved = set_employee_dashboard_state(username, data)
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
        saved_items = []
        target_dir = ticket_attachment_dir(self.data_dir, ticket_number)
        target_dir.mkdir(parents=True, exist_ok=True)
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
                attachment_id = f"{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{secrets.token_hex(4)}"
                stored_name = f"{attachment_id}_{original_name}"
                path = target_dir / stored_name
                file_body = part.get_payload(decode=True) or b""
                path.write_bytes(file_body)
                size = len(file_body)
                content_type = str(part.get_content_type() or mimetypes.guess_type(original_name)[0] or "application/octet-stream")
                item = {
                    "id": attachment_id,
                    "ticket": ticket_number,
                    "original_name": original_name,
                    "stored_name": stored_name,
                    "content_type": content_type,
                    "size": size,
                    "note": note,
                    "uploaded_at": datetime.now().isoformat(timespec="seconds"),
                    "uploaded_by": self.current_username() or "default",
                    "url": f"/api/attachments/file?ticket={quote(ticket_number)}&id={quote(attachment_id)}",
                }
                items.append(item)
                saved_items.append(item)
            save_attachments_index(self.data_dir, index)
        self.send_json({"ok": True, "ticket": ticket_number, "attachments": saved_items})

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
                "started": datetime.now().isoformat(),
                "finished": "",
                "success": None,
                "message": "Starting Outlook export and local sync",
                "exit_code": None,
                "logs": [],
            }
        )
        thread = threading.Thread(target=self._run_refresh_job, daemon=True)
        thread.start()
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
                    "finished": datetime.now().isoformat(),
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
                    "finished": datetime.now().isoformat(),
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
    DashboardHandler.vetro_layers = find_vetro_layers(layers_dir, downloads_dir)
    DashboardHandler.auth_users = {}
    global STATE_FILE
    STATE_FILE = data_dir / "dashboard_state.json"
    DashboardHandler.state_file = STATE_FILE
    handler = lambda *args, **kwargs: DashboardHandler(*args, directory=str(root), **kwargs)
    server = ThreadingHTTPServer((host, port), handler)
    if certfile and keyfile and certfile.exists() and keyfile.exists():
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=str(certfile), keyfile=str(keyfile))
        server.socket = context.wrap_socket(server.socket, server_side=True)
    print(f"One Call dashboard: http://{host}:{port}")
    print("Auth: disabled")
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
