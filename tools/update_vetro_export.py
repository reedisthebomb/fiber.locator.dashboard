#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
import zipfile
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_BASE = "https://api.vetro.io/v3"


def request_json(url: str, token: str) -> dict:
    request = Request(url, headers={"token": token, "Accept": "application/json"})
    with urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def download_bytes(url: str) -> bytes:
    with urlopen(url, timeout=300) as response:
        return response.read()


def initiate_export(plan_id: str, token: str) -> str:
    data = request_json(f"{API_BASE}/export/plan/{plan_id}", token)
    export_id = data.get("export_id")
    if not export_id:
        raise RuntimeError(f"VETRO did not return export_id: {data}")
    return str(export_id)


def wait_for_download(export_id: str, token: str, timeout_seconds: int, poll_seconds: int) -> str:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        data = request_json(f"{API_BASE}/export/{export_id}", token)
        status = data.get("status", "")
        if status == "COMPLETE" and data.get("download_url"):
            return str(data["download_url"])
        if status in {"FAILED", "ERROR"}:
            raise RuntimeError(f"VETRO export failed: {data}")
        time.sleep(poll_seconds)
    raise TimeoutError(f"Timed out waiting for VETRO export {export_id}")


def is_feature_collection(path: Path) -> bool:
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, json.JSONDecodeError):
        return False
    return data.get("type") == "FeatureCollection" and isinstance(data.get("features"), list)


def layer_id_for(feature: dict, fallback: str) -> str:
    props = feature.get("properties") or {}
    for key in ("layer_id", "Layer_ID", "layerId", "layer"):
        value = props.get(key)
        if value not in (None, ""):
            return str(value)
    x_vetro = feature.get("x-vetro") or props.get("x-vetro") or {}
    value = x_vetro.get("layer_id") or x_vetro.get("layerId")
    return str(value) if value not in (None, "") else fallback


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


def feature_stable_key(feature: dict) -> str | None:
    props = feature.get("properties") or {}
    layer_id = layer_id_for(feature, "Unknown")
    stable_id = props.get("vetro_id") or props.get("ID") or props.get("feature_id") or props.get("id")
    if stable_id in (None, ""):
        return None
    return f"{layer_id}|{stable_id}"


def feature_fallback_key(feature: dict) -> str:
    props = feature.get("properties") or {}
    layer_id = layer_id_for(feature, "Unknown")
    geometry = json.dumps(feature.get("geometry") or {}, sort_keys=True, separators=(",", ":"))
    return f"{layer_id}|{geometry}|{json.dumps(props, sort_keys=True, default=str, separators=(',', ':'))}"


def dedupe_features(features: list[dict]) -> list[dict]:
    keyed: dict[str, dict] = {}
    unkeyed: dict[str, dict] = {}
    for feature in features:
        stable_key = feature_stable_key(feature)
        if stable_key:
            current = keyed.get(stable_key)
            if current is None or feature_detail_score(feature) > feature_detail_score(current):
                keyed[stable_key] = feature
            continue
        unkeyed.setdefault(feature_fallback_key(feature), feature)
    return list(keyed.values()) + list(unkeyed.values())


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


def split_feature_collections(extract_dir: Path, output_dir: Path, replace: bool = False) -> dict:
    layer_features: dict[str, list[dict]] = {}
    source_files = []
    for path in sorted(extract_dir.rglob("*")):
        if path.suffix.lower() not in {".geojson", ".json"} or not is_feature_collection(path):
            continue
        source_files.append(str(path.relative_to(extract_dir)))
        data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
        fallback = path.stem
        for feature in data.get("features", []):
            layer_id = layer_id_for(feature, fallback)
            layer_features.setdefault(layer_id, []).append(feature)

    if not layer_features:
        raise RuntimeError("No GeoJSON FeatureCollection files found in the VETRO export archive")

    incoming_features = [feature for features in layer_features.values() for feature in features]
    existing = [] if replace else read_existing_features(output_dir)
    merged_features = dedupe_features(existing + incoming_features)
    layer_features = {}
    for feature in merged_features:
        layer_id = layer_id_for(feature, "Unknown")
        layer_features.setdefault(layer_id, []).append(feature)

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "source_files": source_files,
        "mode": "replace" if replace else "append_only_merge",
        "existing_feature_count": len(existing),
        "incoming_feature_count": len(incoming_features),
        "layers": {},
    }
    combined_features = []
    for layer_id, features in sorted(layer_features.items(), key=lambda item: (not item[0].isdigit(), int(item[0]) if item[0].isdigit() else item[0])):
        combined_features.extend(features)
        output_name = f"Layer_{layer_id}.geojson"
        output_path = output_dir / output_name
        geojson = {"type": "FeatureCollection", "features": features}
        output_path.write_text(json.dumps(geojson, separators=(",", ":")), encoding="utf-8")
        geometry_counts: dict[str, int] = {}
        for feature in features:
            geometry_type = (feature.get("geometry") or {}).get("type") or "Unknown"
            geometry_counts[geometry_type] = geometry_counts.get(geometry_type, 0) + 1
        manifest["layers"][f"Layer_{layer_id}"] = {
            "feature_count": len(features),
            "geometry_counts": geometry_counts,
            "file": output_name,
            "bytes": output_path.stat().st_size,
        }

    combined_path = output_dir / "vetro_export_combined.geojson"
    combined_path.write_text(json.dumps({"type": "FeatureCollection", "features": combined_features}, separators=(",", ":")), encoding="utf-8")
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Download a VETRO plan export and stage GeoJSON layers for the One Call dashboard.")
    parser.add_argument("--plan-id", default=os.environ.get("VETRO_PLAN_ID"), help="VETRO plan ID. Can also be set with VETRO_PLAN_ID.")
    parser.add_argument("--token-env", default="VETRO_TOKEN", help="Environment variable containing the VETRO API token.")
    parser.add_argument("--output-dir", default="data/layers/vetro_geojson_layers")
    parser.add_argument("--work-dir", default="data/vetro_export_work")
    parser.add_argument("--timeout-seconds", type=int, default=900)
    parser.add_argument("--poll-seconds", type=int, default=2)
    parser.add_argument("--replace", action="store_true", help="Replace existing VETRO layers instead of append-only merging. Default preserves existing features.")
    args = parser.parse_args()

    token = os.environ.get(args.token_env)
    if not token:
        print(f"Missing VETRO token. Set {args.token_env} before running.", file=sys.stderr)
        return 2
    if not args.plan_id:
        print("Missing plan ID. Pass --plan-id or set VETRO_PLAN_ID.", file=sys.stderr)
        return 2

    output_dir = Path(args.output_dir)
    work_dir = Path(args.work_dir)
    archive_path = work_dir / f"vetro_plan_{args.plan_id}.zip"
    extract_dir = work_dir / f"vetro_plan_{args.plan_id}"
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        export_id = initiate_export(args.plan_id, token)
        print(f"Started VETRO export {export_id} for plan {args.plan_id}")
        download_url = wait_for_download(export_id, token, args.timeout_seconds, args.poll_seconds)
        archive_path.write_bytes(download_bytes(download_url))
        if extract_dir.exists():
            shutil.rmtree(extract_dir)
        extract_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive_path) as archive:
            archive.extractall(extract_dir)
        manifest = split_feature_collections(extract_dir, output_dir, replace=args.replace)
    except (HTTPError, URLError, RuntimeError, TimeoutError, zipfile.BadZipFile) as error:
        print(f"VETRO export update failed: {error}", file=sys.stderr)
        return 1

    total = sum(layer["feature_count"] for layer in manifest["layers"].values())
    print(f"Staged {total} VETRO features in {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
