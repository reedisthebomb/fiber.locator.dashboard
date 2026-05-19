#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import load_tickets  # noqa: E402


def copy_matching(source_dir: Path, target_dir: Path, patterns: list[str]) -> int:
    target_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for pattern in patterns:
        for source in sorted(source_dir.glob(pattern)):
            if not source.is_file():
                continue
            target = target_dir / source.name
            if target.exists() and target.stat().st_size == source.stat().st_size and int(target.stat().st_mtime) >= int(source.stat().st_mtime):
                continue
            shutil.copy2(source, target)
            copied += 1
    return copied


def count_loaded(downloads_dir: Path, data_dir: Path, inbox_dir: Path) -> tuple[int, int, int]:
    tickets = load_tickets(downloads_dir, data_dir, inbox_dir)
    with_polygons = sum(1 for ticket in tickets if ticket.polygon)
    with_pages = sum(1 for ticket in tickets if ticket.portal_html_available)
    return len(tickets), with_polygons, with_pages


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh the One Call server inbox/cache from local Windows exports.")
    parser.add_argument("--downloads-dir", default="/mnt/c/Users/reedc/Downloads")
    parser.add_argument("--onedrive-downloads-dir", default="/mnt/c/Users/reedc/OneDrive/Downloads")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--inbox-dir", default="data/inbox")
    parser.add_argument("--curl-file", default="", help="Optional fresh GeoCall Copy-as-cURL file to pull missing polygons.")
    parser.add_argument("--restart-service", action="store_true", help="Restart onecall-dashboard with systemctl after syncing.")
    args = parser.parse_args()

    downloads_dir = Path(args.downloads_dir)
    onedrive_downloads_dir = Path(args.onedrive_downloads_dir)
    data_dir = Path(args.data_dir)
    inbox_dir = Path(args.inbox_dir)

    ticket_copied = copy_matching(downloads_dir, inbox_dir, ["Arkansas One Call Ticket *.txt", "Arkansas One Call Ticket *.eml"])
    detail_copied = copy_matching(downloads_dir, data_dir, ["arkonecall_ticket_details*.json"])
    if onedrive_downloads_dir.exists():
        detail_copied += copy_matching(onedrive_downloads_dir, data_dir, ["arkonecall_ticket_details*.json"])

    if args.curl_file:
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "tools" / "fetch_geocall_details_from_fetch.py"),
                "--curl-file",
                args.curl_file,
                "--downloads-dir",
                str(downloads_dir),
                "--data-dir",
                str(data_dir),
                "--inbox-dir",
                str(inbox_dir),
            ],
            check=False,
        )
        if result.returncode != 0:
            print("GeoCall fetch did not complete. The saved browser session may be expired.")

    total, with_polygons, with_pages = count_loaded(downloads_dir, data_dir, inbox_dir)
    print(f"Ticket files copied: {ticket_copied}")
    print(f"GeoCall detail files copied: {detail_copied}")
    print(f"Dashboard tickets loaded: {total}")
    print(f"Tickets with polygons: {with_polygons}")
    print(f"Tickets with printable pages: {with_pages}")

    if args.restart_service:
        subprocess.run(["systemctl", "restart", "onecall-dashboard"], check=True)
        print("Restarted onecall-dashboard")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
