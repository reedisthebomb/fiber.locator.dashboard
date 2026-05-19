#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import load_geocall_details, load_tickets  # noqa: E402


BASE_URL = "https://geocall.arkonecall.com"


def unescape_js_string(value: str) -> str:
    return bytes(value, "utf-8").decode("unicode_escape")


def clean_headers(headers: dict[str, str]) -> dict[str, str]:
    cleaned = {}
    for key, value in headers.items():
        lowered = key.lower()
        if lowered.startswith("sec-"):
            continue
        if lowered in {"host", "content-length", "connection"}:
            continue
        cleaned[key] = value
    if not any(key.lower() == "cookie" for key in cleaned):
        raise RuntimeError("GeoCall request does not contain a cookie header")
    cleaned.setdefault("Accept", "*/*")
    cleaned.setdefault("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0")
    cleaned.setdefault("X-Requested-With", "XMLHttpRequest")
    return cleaned


def read_fetch_headers(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    headers_match = re.search(r'"headers"\s*:\s*\{(.*?)\}\s*,\s*"body"', text, re.S)
    if not headers_match:
        headers_match = re.search(r"headers\s*:\s*\{(.*?)\}\s*,", text, re.S)
    if not headers_match:
        raise RuntimeError("Could not find headers in saved fetch file")

    headers = {}
    for key, value in re.findall(r'"([^"]+)"\s*:\s*"((?:\\.|[^"])*)"', headers_match.group(1)):
        headers[key] = unescape_js_string(value)
    return clean_headers(headers)


def read_curl_headers(text: str) -> dict[str, str]:
    headers = {}
    cookie_match = re.search(r"(?:^|\s)-b\s+'([^']+)'", text, re.S)
    if not cookie_match:
        cookie_match = re.search(r'(?:^|\s)-b\s+"([^"]+)"', text, re.S)
    if cookie_match:
        headers["Cookie"] = cookie_match.group(1)
    for key, value in re.findall(r"-H\s+'([^:']+):\s*([^']*)'", text, re.S):
        headers[key] = value
    for key, value in re.findall(r'-H\s+"([^:"]+):\s*([^"]*)"', text, re.S):
        headers[key] = value
    return clean_headers(headers)


def fetch_text(url: str, headers: dict[str, str]) -> str:
    request = Request(url, headers=headers)
    with urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_ticket_id(text: str) -> str:
    patterns = [
        r'<record[^>]+ticketId="(\d+)"',
        r"ticketId=[\"'](\d+)[\"']",
        r"<ticketId>(\d+)</ticketId>",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(1)
    raise RuntimeError("No internal ticketId found in lookup response")


def extract_polygon(text: str) -> str:
    match = re.search(r"POLYGON\s*\(\(.*?\)\)", text, re.I | re.S)
    return match.group(0) if match else ""


def lookup_ticket_id(ticket_number: str, headers: dict[str, str]) -> str:
    params = urlencode({"number": ticket_number, "_dc": str(int(time.time() * 1000))})
    url = f"{BASE_URL}/geocall/api/ui/searches/mp-noui-ticket-bynumber/execute?{params}"
    return extract_ticket_id(fetch_text(url, headers))


def fetch_ticket_detail(ticket_number: str, ticket_id: str, headers: dict[str, str]) -> dict:
    url = f"{BASE_URL}/geocall/client/item/ticket/{ticket_id}?pr=true"
    html = fetch_text(url, headers)
    polygon = extract_polygon(html)
    for polygon_url in [
        f"{BASE_URL}/geocall/{ticket_id}?pr=true",
        f"{BASE_URL}/geocall/api/app/ticket/portal/{ticket_id}?pr=true",
        f"{BASE_URL}/geocall/api/app/tickets/portal/{ticket_id}?pr=true",
        f"{BASE_URL}/geocall/ticket/{ticket_id}?pr=true",
        f"{BASE_URL}/geocall/api/app/ticket/{ticket_id}?pr=true",
        f"{BASE_URL}/geocall/api/app/tickets/{ticket_id}?pr=true",
    ]:
        if polygon:
            break
        try:
            polygon = extract_polygon(fetch_text(polygon_url, headers))
        except (HTTPError, URLError, TimeoutError):
            continue
    return {
        "ticketNumber": ticket_number,
        "ticketId": ticket_id,
        "sourceUrl": url,
        "html": html,
        "polygon": polygon,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch GeoCall printable pages and polygons using a fresh browser Copy-as-fetch or cURL request.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--fetch-file", help="Path to a fresh GeoCall browser Copy-as-fetch text file.")
    source.add_argument("--curl-file", help="Path to a fresh GeoCall browser Copy-as-cURL text file.")
    source.add_argument("--curl-stdin", action="store_true", help="Read a fresh GeoCall Copy-as-cURL request from stdin.")
    parser.add_argument("--downloads-dir", default="/mnt/c/Users/reedc/Downloads")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--inbox-dir", default="data/inbox")
    parser.add_argument("--limit", type=int, default=0, help="Maximum missing tickets to fetch. 0 means all missing.")
    parser.add_argument("--include-existing", action="store_true", help="Refetch tickets that already have cached GeoCall pages.")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    if args.fetch_file:
        headers = read_fetch_headers(Path(args.fetch_file))
    elif args.curl_file:
        headers = read_curl_headers(Path(args.curl_file).read_text(encoding="utf-8", errors="replace"))
    else:
        headers = read_curl_headers(sys.stdin.read())
    existing = load_geocall_details(Path(args.downloads_dir), data_dir)
    tickets = load_tickets(Path(args.downloads_dir), data_dir, Path(args.inbox_dir))
    queue = [ticket.ticket_number for ticket in tickets if args.include_existing or ticket.ticket_number not in existing]
    if args.limit > 0:
        queue = queue[: args.limit]

    fetched = []
    failures = []
    for index, ticket_number in enumerate(queue, start=1):
        try:
            print(f"[{index}/{len(queue)}] {ticket_number}")
            ticket_id = lookup_ticket_id(ticket_number, headers)
            fetched.append(fetch_ticket_detail(ticket_number, ticket_id, headers))
        except (HTTPError, URLError, RuntimeError, TimeoutError) as error:
            failures.append(f"{ticket_number}: {error}")
            print(f"  failed: {error}", file=sys.stderr)

    payload = {
        "exportedAt": datetime.now().isoformat(),
        "tickets": fetched,
        "failures": failures,
    }
    if not fetched:
        print(f"No GeoCall detail records fetched. Failures: {len(failures)}")
        return 1 if queue else 0
    data_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output = data_dir / f"arkonecall_ticket_details_refresh_{stamp}.json"
    output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(fetched)} detail record(s) and {len(failures)} failure(s) to {output}")
    return 0 if fetched or not queue else 1


if __name__ == "__main__":
    raise SystemExit(main())
