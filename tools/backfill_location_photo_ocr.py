#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import server  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill Timestamp Camera printed coordinates for location photos.")
    parser.add_argument("--data-dir", default="data", help="Dashboard data directory.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum photos to process.")
    parser.add_argument("--force", action="store_true", help="Reprocess photos that already have coordinates.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write photos.json.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir)
    payload = server.load_location_photos(data_dir)
    photos = payload.get("photos", [])
    if not isinstance(photos, list):
        print(json.dumps({"ok": False, "message": "photos.json does not contain a photos list"}))
        return 1

    scanned = 0
    updated = 0
    missing_files = 0
    failed = 0
    for item in photos:
        if not isinstance(item, dict):
            continue
        existing_lat = server.optional_float(item.get("lat"))
        existing_lng = server.optional_float(item.get("lng"))
        if not args.force and existing_lat is not None and existing_lng is not None:
            continue
        photo_id = server.safe_file_component(str(item.get("id") or ""), "")
        stored_name = server.safe_file_component(str(item.get("stored_name") or ""), "")
        if not photo_id or not stored_name:
            failed += 1
            continue
        photo_path = server.location_photo_dir(data_dir, photo_id) / stored_name
        if not photo_path.exists():
            missing_files += 1
            continue
        scanned += 1
        if args.limit and scanned > args.limit:
            scanned -= 1
            break
        result = server.extract_printed_timestamp_location(photo_path.read_bytes())
        lat = server.optional_float(result.get("lat"))
        lng = server.optional_float(result.get("lng"))
        if lat is None or lng is None:
            if result.get("text"):
                item["watermark_text"] = str(result.get("text") or "")[:1000]
            failed += 1
            continue
        item["lat"] = lat
        item["lng"] = lng
        item["coordinate_source"] = "timestamp_camera_watermark"
        current_source = str(item.get("coordinate_source") or "")
        if result.get("address") and (not str(item.get("address") or "").strip() or current_source in {"unknown", "timestamp_camera_watermark"}):
            item["address"] = server.clean_profile_text(result.get("address"), 220)
        if result.get("text"):
            item["watermark_text"] = str(result.get("text") or "")[:1000]
        item["folder_name"] = server.photo_group_folder_name(
            str(item.get("ticket") or ""),
            str(item.get("location_label") or ""),
            lat,
            lng,
        )
        updated += 1

    if updated and not args.dry_run:
        server.save_location_photos(data_dir, payload)
    print(json.dumps({
        "ok": True,
        "dryRun": bool(args.dry_run),
        "scanned": scanned,
        "updated": updated,
        "failed": failed,
        "missingFiles": missing_files,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
