#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import math
import os
import re
import shlex
import shutil
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen


PBF_RE = re.compile(r"https?://[^\s'\"<>]+\.pbf(?:\?[^\s'\"<>]+)?", re.I)
SKIP_HEADERS = {"host", "connection", "content-length", "accept-encoding"}
DEFAULT_LAYER_IDS = {"17", "26", "28", "42", "43", "654", "659"}


def tile_x_to_lon(x: float, z: int) -> float:
    return x / (2 ** z) * 360.0 - 180.0


def tile_y_to_lat(y: float, z: int) -> float:
    radians = math.atan(math.sinh(math.pi * (1 - 2 * y / (2 ** z))))
    return math.degrees(radians)


def parse_tile_url(url: str) -> dict | None:
    parsed = urlparse(url)
    match = re.search(r"/maps/(\d+)/(\d+)/(\d+)\.pbf$", parsed.path)
    if not match:
        return None
    query = parse_qs(parsed.query)
    layer_id = (query.get("layer_id") or [""])[0]
    mvt_name = (query.get("mvt_name") or [f"lyr_{layer_id}" if layer_id else ""])[0]
    return {
        "url": url,
        "z": int(match.group(1)),
        "x": int(match.group(2)),
        "y": int(match.group(3)),
        "layer_id": str(layer_id or "Unknown"),
        "mvt_name": str(mvt_name or f"lyr_{layer_id}"),
        "host": parsed.netloc,
    }


def clean_headers(headers: dict[str, str]) -> dict[str, str]:
    cleaned = {}
    for key, value in headers.items():
        lowered = key.lower()
        if lowered.startswith(":") or lowered in SKIP_HEADERS:
            continue
        cleaned[key] = value
    cleaned.setdefault("User-Agent", "Mozilla/5.0")
    cleaned.setdefault("Referer", "https://app.vetro.io/")
    return cleaned


def extract_har_entries(text: str) -> list[dict]:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return []
    entries = (((payload or {}).get("log") or {}).get("entries") or [])
    captures = []
    for entry in entries:
        request = entry.get("request") or {}
        url = request.get("url") or ""
        tile = parse_tile_url(url)
        if not tile:
            continue
        headers = {
            str(item.get("name") or ""): str(item.get("value") or "")
            for item in request.get("headers", [])
            if item.get("name")
        }
        content = (entry.get("response") or {}).get("content") or {}
        body = None
        if content.get("text"):
            body_text = str(content.get("text"))
            if content.get("encoding") == "base64":
                body = base64.b64decode(body_text)
            else:
                body = body_text.encode("latin-1", errors="ignore")
        captures.append({**tile, "headers": clean_headers(headers), "body": body})
    return captures


def extract_curl_entries(text: str) -> list[dict]:
    captures = []
    fallback_headers: dict[str, str] = {}
    for match in re.finditer(r"curl\s+((?:\\\n|.)*?)(?=\n\s*curl\s+|\Z)", text, re.S):
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
                    headers[key.strip()] = value.strip()
                index += 2
                continue
            if token in {"-b", "--cookie"} and index + 1 < len(tokens):
                headers["Cookie"] = tokens[index + 1]
                index += 2
                continue
            if token.startswith("http"):
                url = token
            index += 1
        parsed_host = urlparse(url).netloc if url else ""
        if parsed_host == "app.vetro.io" or parsed_host.endswith(".vetro.io"):
            for key, value in headers.items():
                lowered = key.lower()
                if lowered in {"cookie", "authorization"} and value and key not in fallback_headers:
                    fallback_headers[key] = value
        tile = parse_tile_url(url)
        if tile:
            tile_headers = dict(headers)
            if "fibermap.vetro.io" in tile["host"]:
                for key, value in fallback_headers.items():
                    tile_headers.setdefault(key, value)
            captures.append({**tile, "headers": clean_headers(tile_headers), "body": None})
    if captures:
        return captures
    for url in PBF_RE.findall(text):
        tile = parse_tile_url(url)
        if tile:
            captures.append({**tile, "headers": clean_headers({}), "body": None})
    return captures


def unique_captures(captures: list[dict]) -> list[dict]:
    by_url: dict[str, dict] = {}

    def capture_quality(capture: dict) -> tuple[int, int, int]:
        headers = {str(key).lower(): value for key, value in (capture.get("headers") or {}).items()}
        return (
            1 if capture.get("body") else 0,
            1 if headers.get("authorization") else 0,
            1 if headers.get("cookie") else 0,
        )

    for capture in captures:
        key = capture["url"]
        current = by_url.get(key)
        if current is None or capture_quality(capture) > capture_quality(current):
            by_url[key] = capture
    return list(by_url.values())


def capture_stats(captures: list[dict]) -> dict:
    stats = {
        "tile_count": len(captures),
        "embedded_body_count": sum(1 for capture in captures if capture.get("body")),
        "auth_header_count": sum(1 for capture in captures if any(str(key).lower() == "authorization" for key in (capture.get("headers") or {}))),
        "cookie_header_count": sum(1 for capture in captures if any(str(key).lower() == "cookie" for key in (capture.get("headers") or {}))),
        "layer_counts": {},
        "ready_for_import": False,
    }
    for capture in captures:
        layer_id = capture["layer_id"]
        stats["layer_counts"][layer_id] = stats["layer_counts"].get(layer_id, 0) + 1
    stats["ready_for_import"] = bool(captures) and (
        stats["embedded_body_count"] > 0
        or stats["auth_header_count"] > 0
        or stats["cookie_header_count"] > 0
    )
    return stats


def read_capture(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="replace")
    captures = extract_har_entries(text) or extract_curl_entries(text)
    return unique_captures(captures)


def download_tile(capture: dict) -> bytes:
    if capture.get("body"):
        return capture["body"]
    request = Request(capture["url"], headers=capture.get("headers") or {})
    with urlopen(request, timeout=90) as response:
        return response.read()


def transform_point(point: list[float], tile: dict, extent: int) -> list[float]:
    return [
        tile_x_to_lon(tile["x"] + (float(point[0]) / extent), tile["z"]),
        tile_y_to_lat(tile["y"] + (float(point[1]) / extent), tile["z"]),
    ]


def transform_coords(coords, tile: dict, extent: int):
    if not isinstance(coords, list):
        return coords
    if len(coords) >= 2 and all(isinstance(value, (int, float)) for value in coords[:2]):
        return transform_point(coords, tile, extent)
    return [transform_coords(item, tile, extent) for item in coords]


def normalize_props(props: dict, tile: dict, vector_layer: str) -> dict:
    normalized = {str(key): value for key, value in (props or {}).items()}
    normalized.setdefault("layer_id", tile["layer_id"])
    normalized.setdefault("Layer_ID", tile["layer_id"])
    normalized.setdefault("vector_layer", vector_layer)
    normalized.setdefault("mvt_name", tile["mvt_name"])
    normalized.setdefault("source_tile", f"{tile['z']}/{tile['x']}/{tile['y']}")
    if "ID" in normalized and "feature_id" not in normalized:
        normalized["feature_id"] = normalized["ID"]
    if "Street Address" in normalized and "street_address" not in normalized:
        normalized["street_address"] = normalized["Street Address"]
    return normalized


def feature_key(feature: dict) -> str:
    props = feature.get("properties") or {}
    stable_id = props.get("vetro_id") or props.get("ID") or props.get("feature_id") or ""
    geometry = json.dumps(feature.get("geometry") or {}, sort_keys=True, separators=(",", ":"))
    return f"{props.get('layer_id')}|{stable_id}|{geometry}"


def stable_feature_id(feature: dict) -> str:
    props = feature.get("properties") or {}
    stable_id = props.get("vetro_id") or props.get("ID") or props.get("feature_id") or props.get("id")
    return str(stable_id or "")


def feature_geometry_type(feature: dict) -> str:
    return str((feature.get("geometry") or {}).get("type") or "")


def is_fragmented_geometry(feature: dict) -> bool:
    return feature_geometry_type(feature) in {"LineString", "MultiLineString", "Polygon", "MultiPolygon"}


def feature_has_display_id(feature: dict) -> bool:
    props = feature.get("properties") or {}
    return bool(props.get("ID") or props.get("feature_id") or props.get("label") or props.get("Name"))


def new_fragment_allowed(feature: dict) -> bool:
    return is_fragmented_geometry(feature) and feature_has_display_id(feature) and source_zoom(feature) >= 13


def stable_feature_key(feature: dict) -> str | None:
    if is_fragmented_geometry(feature):
        return None
    props = feature.get("properties") or {}
    stable_id = stable_feature_id(feature)
    if not stable_id:
        return None
    return f"{props.get('layer_id')}|{stable_id}"


def source_zoom(feature: dict) -> int:
    source_tile = str((feature.get("properties") or {}).get("source_tile") or "")
    try:
        return int(source_tile.split("/", 1)[0])
    except (TypeError, ValueError):
        return -1


def coordinate_score(coords) -> int:
    if not isinstance(coords, list):
        return 0
    if len(coords) >= 2 and all(isinstance(value, (int, float)) for value in coords[:2]):
        return 1
    return sum(coordinate_score(item) for item in coords)


def feature_detail_score(feature: dict) -> tuple[int, int, int]:
    geometry = feature.get("geometry") or {}
    geometry_bytes = len(json.dumps(geometry, separators=(",", ":")))
    return (source_zoom(feature), coordinate_score(geometry.get("coordinates")), geometry_bytes)


def geometry_signature(feature: dict) -> str:
    return json.dumps(feature.get("geometry") or {}, sort_keys=True, separators=(",", ":"))


def dedupe_features(features: list[dict]) -> list[dict]:
    keyed: dict[str, dict] = {}
    unkeyed: dict[str, dict] = {}
    fragmented: dict[str, list[dict]] = {}
    for feature in features:
        props = feature.get("properties") or {}
        stable_id = stable_feature_id(feature)
        if is_fragmented_geometry(feature) and stable_id:
            fragmented.setdefault(f"{props.get('layer_id')}|{stable_id}", []).append(feature)
            continue
        stable_key = stable_feature_key(feature)
        if stable_key:
            current = keyed.get(stable_key)
            if current is None or feature_detail_score(feature) > feature_detail_score(current):
                keyed[stable_key] = feature
            continue
        fallback_key = feature_key(feature)
        unkeyed.setdefault(fallback_key, feature)
    cleaned_fragments: list[dict] = []
    for items in fragmented.values():
        if len(items) == 1:
            cleaned_fragments.extend(items)
            continue
        exact_by_geometry: dict[str, dict] = {}
        for feature in items:
            geometry_key = geometry_signature(feature)
            current = exact_by_geometry.get(geometry_key)
            if current is None or feature_detail_score(feature) > feature_detail_score(current):
                exact_by_geometry[geometry_key] = feature
        cleaned_fragments.extend(exact_by_geometry.values())
    return list(keyed.values()) + cleaned_fragments + list(unkeyed.values())


def read_existing_features(output_dir: Path) -> list[dict]:
    if not output_dir.exists():
        return []
    features = []
    for path in sorted(output_dir.glob("Layer_*.geojson")):
        try:
            data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
        except (OSError, json.JSONDecodeError):
            continue
        if data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
            continue
        features.extend(feature for feature in data["features"] if isinstance(feature, dict))
    return features


def group_features_by_layer(features: list[dict]) -> dict[str, list[dict]]:
    layer_features: dict[str, list[dict]] = {}
    for feature in features:
        layer_id = str((feature.get("properties") or {}).get("layer_id") or "Unknown")
        layer_features.setdefault(layer_id, []).append(feature)
    return layer_features


def decode_tile(tile_bytes: bytes, tile: dict) -> list[dict]:
    import mapbox_vector_tile

    decoded = mapbox_vector_tile.decode(tile_bytes, default_options={"y_coord_down": True})
    features = []
    for vector_layer, layer_data in decoded.items():
        layer_features = layer_data.get("features", []) if isinstance(layer_data, dict) else []
        extent = int(layer_data.get("extent") or 4096) if isinstance(layer_data, dict) else 4096
        for item in layer_features:
            geometry = item.get("geometry") or {}
            geometry_type = geometry.get("type")
            coords = geometry.get("coordinates")
            if not geometry_type or coords in (None, []):
                continue
            props = normalize_props(item.get("properties") or {}, tile, vector_layer)
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": {
                    "type": geometry_type,
                    "coordinates": transform_coords(coords, tile, extent),
                },
            })
    return features


def write_outputs(features: list[dict], output_dir: Path, backup_dir: Path | None, source: Path, failures: list[str], replace: bool = False) -> dict:
    existing_count = 0
    existing_by_layer: dict[str, list[dict]] = {}
    skipped_existing_ids = 0
    skipped_exact_geometry = 0
    skipped_low_quality_fragments = 0
    replaced_lower_quality = 0
    if not replace:
        existing = read_existing_features(output_dir)
        existing_count = len(existing)
        existing_by_layer = group_features_by_layer(existing)
        merged_features = list(existing)
        existing_stable_ids = {
            f"{(feature.get('properties') or {}).get('layer_id')}|{stable_feature_id(feature)}"
            for feature in existing
            if stable_feature_id(feature)
        }
        existing_feature_keys = {feature_key(feature) for feature in existing}
        existing_geometry_keys = {geometry_signature(feature) for feature in existing}
        existing_replaceable_index = {
            f"{(feature.get('properties') or {}).get('layer_id')}|{stable_feature_id(feature)}": index
            for index, feature in enumerate(merged_features)
            if stable_feature_id(feature) and not is_fragmented_geometry(feature)
        }
        new_fragments_by_id: dict[str, list[dict]] = {}
        for feature in features:
            props = feature.get("properties") or {}
            stable_id = stable_feature_id(feature)
            stable_key = f"{props.get('layer_id')}|{stable_id}" if stable_id else ""
            geometry_key = geometry_signature(feature)
            if geometry_key in existing_geometry_keys:
                skipped_exact_geometry += 1
                continue
            if stable_id and stable_key in existing_stable_ids:
                replace_index = existing_replaceable_index.get(stable_key)
                if (
                    replace_index is not None
                    and not is_fragmented_geometry(feature)
                    and feature_detail_score(feature) > feature_detail_score(merged_features[replace_index])
                ):
                    merged_features[replace_index] = feature
                    existing_geometry_keys.add(geometry_key)
                    replaced_lower_quality += 1
                else:
                    skipped_existing_ids += 1
                continue
            if stable_id and is_fragmented_geometry(feature):
                if new_fragment_allowed(feature):
                    new_fragments_by_id.setdefault(stable_key, []).append(feature)
                else:
                    skipped_low_quality_fragments += 1
                continue
            if not stable_id and feature_key(feature) in existing_feature_keys:
                skipped_exact_geometry += 1
                continue
            merged_features.append(feature)
            if stable_id:
                existing_stable_ids.add(stable_key)
            existing_feature_keys.add(feature_key(feature))
            existing_geometry_keys.add(geometry_key)
        for fragment_group in new_fragments_by_id.values():
            max_zoom = max(source_zoom(feature) for feature in fragment_group)
            seen_fragment_geometry: set[str] = set()
            for feature in fragment_group:
                geometry_key = geometry_signature(feature)
                if source_zoom(feature) != max_zoom or geometry_key in seen_fragment_geometry or geometry_key in existing_geometry_keys:
                    skipped_low_quality_fragments += 1
                    continue
                seen_fragment_geometry.add(geometry_key)
                existing_geometry_keys.add(geometry_key)
                merged_features.append(feature)
        features = merged_features
    layer_features = group_features_by_layer(dedupe_features(features))
    if not layer_features:
        raise RuntimeError("No VETRO features were decoded from the capture")

    coverage_guardrails: dict[str, dict[str, int | str]] = {}
    if not replace:
        for layer_id, existing_items in sorted(existing_by_layer.items()):
            merged_count = len(layer_features.get(layer_id, []))
            existing_layer_count = len(existing_items)
            if merged_count < existing_layer_count:
                layer_features[layer_id] = existing_items
                coverage_guardrails[f"Layer_{layer_id}"] = {
                    "kept": "existing_layer",
                    "existing_count": existing_layer_count,
                    "merged_count": merged_count,
                }

    tmp_dir = output_dir.with_name(f"{output_dir.name}.tmp-{int(time.time())}")
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "source_capture": str(source),
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "failures": failures,
        "mode": "replace" if replace else "append_only_merge",
        "existing_feature_count": existing_count,
        "quality_guardrails": {
            "skipped_existing_ids": skipped_existing_ids,
            "skipped_exact_geometry": skipped_exact_geometry,
            "skipped_low_quality_fragments": skipped_low_quality_fragments,
            "replaced_lower_quality": replaced_lower_quality,
        },
        "coverage_guardrails": coverage_guardrails,
        "layers": {},
    }
    combined = []
    for layer_id, items in sorted(layer_features.items(), key=lambda item: (not item[0].isdigit(), int(item[0]) if item[0].isdigit() else item[0])):
        combined.extend(items)
        geometry_counts: dict[str, int] = {}
        for feature in items:
            geometry_type = (feature.get("geometry") or {}).get("type") or "Unknown"
            geometry_counts[geometry_type] = geometry_counts.get(geometry_type, 0) + 1
        path = tmp_dir / f"Layer_{layer_id}.geojson"
        path.write_text(json.dumps({"type": "FeatureCollection", "features": items}, separators=(",", ":")), encoding="utf-8")
        manifest["layers"][f"Layer_{layer_id}"] = {
            "feature_count": len(items),
            "geometry_counts": geometry_counts,
            "file": path.name,
            "bytes": path.stat().st_size,
        }
    (tmp_dir / "vetro_capture_combined.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": combined}, separators=(",", ":")), encoding="utf-8")
    (tmp_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")

    if output_dir.exists() and backup_dir:
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_path = backup_dir / f"{output_dir.name}.backup-{int(time.time())}"
        shutil.move(str(output_dir), str(backup_path))
    elif output_dir.exists():
        shutil.rmtree(output_dir)
    shutil.move(str(tmp_dir), str(output_dir))
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Import VETRO/FiberMap layers from logged-in HAR or Copy-as-cURL tile captures.")
    parser.add_argument("--capture-file", required=True)
    parser.add_argument("--output-dir", default="data/layers/vetro_geojson_layers")
    parser.add_argument("--backup-dir", default="data/layers/backups")
    parser.add_argument("--layer-id", action="append", default=[], help="Layer ID to include. Defaults to known VETRO layers.")
    parser.add_argument("--dry-run", action="store_true", help="Only parse the capture and report tile counts.")
    parser.add_argument("--allow-unauthenticated-replay", action="store_true", help="Try replaying URL-only tile captures even without embedded bodies or credentials.")
    parser.add_argument("--replace", action="store_true", help="Replace existing VETRO layers instead of append-only merging. Default preserves existing features.")
    args = parser.parse_args()

    capture_path = Path(args.capture_file)
    captures = read_capture(capture_path)
    selected_ids = set(args.layer_id or DEFAULT_LAYER_IDS)
    captures = [capture for capture in captures if capture["layer_id"] in selected_ids]
    print(f"Found {len(captures)} VETRO tile request(s) in {capture_path}")
    by_layer: dict[str, int] = {}
    for capture in captures:
        by_layer[capture["layer_id"]] = by_layer.get(capture["layer_id"], 0) + 1
    print("Tile requests by layer:", json.dumps(dict(sorted(by_layer.items())), sort_keys=True))
    stats = capture_stats(captures)
    print("Capture readiness:", json.dumps({key: stats[key] for key in ("embedded_body_count", "auth_header_count", "cookie_header_count", "ready_for_import")}, sort_keys=True))
    if args.dry_run:
        return 0 if captures else 1
    if not captures:
        print("No VETRO tile requests found in capture.", file=sys.stderr)
        return 1
    if not stats["ready_for_import"] and not args.allow_unauthenticated_replay:
        print(
            "Capture has tile URLs but no embedded PBF bodies and no Cookie/Authorization headers. "
            "Export HAR with content and sensitive data, or copy a VETRO .pbf request as cURL with cookies.",
            file=sys.stderr,
        )
        return 1

    preflight_tile: tuple[dict, bytes] | None = None
    if not stats["embedded_body_count"] and captures:
        try:
            preflight_tile = (captures[0], download_tile(captures[0]))
        except HTTPError as error:
            if getattr(error, "code", None) == 401:
                print(
                    "No features decoded because the first VETRO tile replay returned 401 Unauthorized. "
                    "Capture fresh VETRO tile traffic while logged in, using HAR with content/sensitive data or Copy as cURL with current cookies.",
                    file=sys.stderr,
                )
                return 1
            preflight_tile = None
        except (URLError, TimeoutError, OSError, ValueError):
            preflight_tile = None

    features = []
    failures = []
    for index, capture in enumerate(captures, start=1):
        try:
            if preflight_tile and capture["url"] == preflight_tile[0]["url"]:
                tile_bytes = preflight_tile[1]
                preflight_tile = None
            else:
                tile_bytes = download_tile(capture)
            tile_features = decode_tile(tile_bytes, capture)
            features.extend(tile_features)
            print(f"[{index}/{len(captures)}] layer {capture['layer_id']} {capture['z']}/{capture['x']}/{capture['y']}: {len(tile_features)} feature(s)")
        except (HTTPError, URLError, TimeoutError, RuntimeError, OSError, ValueError) as error:
            failures.append(f"{capture['url']}: {error}")
            print(f"[{index}/{len(captures)}] failed: {error}", file=sys.stderr)

    if not features:
        if failures and all("401" in failure or "Unauthorized" in failure for failure in failures):
            print(
                "No features decoded because every VETRO tile replay returned 401 Unauthorized. "
                "Capture fresh VETRO tile traffic while logged in, using HAR with content/sensitive data or Copy as cURL with current cookies.",
                file=sys.stderr,
            )
        else:
            print(f"No features decoded. Failures: {len(failures)}", file=sys.stderr)
        return 1
    manifest = write_outputs(features, Path(args.output_dir), Path(args.backup_dir) if args.backup_dir else None, capture_path, failures, replace=args.replace)
    total = sum(item["feature_count"] for item in manifest["layers"].values())
    print(f"Imported {total} VETRO feature(s) into {args.output_dir}")
    if failures:
        print(f"Completed with {len(failures)} failed tile request(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
