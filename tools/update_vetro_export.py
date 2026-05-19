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


def split_feature_collections(extract_dir: Path, output_dir: Path) -> dict:
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

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = {"source_files": source_files, "layers": {}}
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
        manifest = split_feature_collections(extract_dir, output_dir)
    except (HTTPError, URLError, RuntimeError, TimeoutError, zipfile.BadZipFile) as error:
        print(f"VETRO export update failed: {error}", file=sys.stderr)
        return 1

    total = sum(layer["feature_count"] for layer in manifest["layers"].values())
    print(f"Staged {total} VETRO features in {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
