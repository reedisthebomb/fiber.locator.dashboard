#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any


PALETTE = ["#2563eb", "#f97316", "#22c55e", "#38bdf8", "#eab308", "#a855f7", "#ef4444", "#14b8a6"]

POINT_ICONS = {
    "circle": "http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png",
    "square": "http://maps.google.com/mapfiles/kml/shapes/placemark_square.png",
    "rectangle": "http://maps.google.com/mapfiles/kml/shapes/placemark_square.png",
    "diamond": "http://maps.google.com/mapfiles/kml/shapes/target.png",
    "pin": "http://maps.google.com/mapfiles/kml/pushpin/wht-pushpin.png",
    "house": "http://maps.google.com/mapfiles/kml/shapes/homegardenbusiness.png",
}


def text(value: object) -> str:
    return html.escape(str(value or "").strip())


def clean_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_. -]+", "_", str(value or "")).strip(" ._")
    return cleaned[:96] or hashlib.sha1(str(value).encode("utf-8")).hexdigest()[:12]


def normalize_hex_color(value: object) -> str | None:
    raw = str(value or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", raw):
        return raw.lower()
    if re.fullmatch(r"[0-9a-fA-F]{6}", raw):
        return f"#{raw.lower()}"
    return None


def palette_color(layer_id: str) -> str:
    hash_value = 0
    for char in str(layer_id):
        hash_value = ((hash_value * 31) + ord(char)) & 0xFFFFFFFF
    return PALETTE[hash_value % len(PALETTE)]


def clamp_number(value: object, minimum: float, maximum: float, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if number != number:
        return fallback
    return min(maximum, max(minimum, number))


def kml_color(hex_color: str, opacity: float) -> str:
    color = normalize_hex_color(hex_color) or "#ffffff"
    alpha = round(clamp_number(opacity, 0, 1, 1) * 255)
    red = color[1:3]
    green = color[3:5]
    blue = color[5:7]
    return f"{alpha:02x}{blue}{green}{red}"


def load_state(path: Path | None, user: str) -> dict[str, Any]:
    if not path or not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "users" in data:
        user_state = data.get("users", {}).get(user, {})
        return user_state if isinstance(user_state, dict) else {}
    return data if isinstance(data, dict) else {}


def layer_id_from_path(path: Path) -> str:
    match = re.search(r"Layer_([^./]+)", path.stem)
    return match.group(1) if match else path.stem


def first_geometry_type(features: list[dict[str, Any]]) -> str:
    for feature in features:
        geometry_type = str((feature.get("geometry") or {}).get("type") or "")
        if geometry_type:
            return geometry_type
    return ""


def style_for_layer(layer_id: str, geometry_type: str, state: dict[str, Any]) -> dict[str, Any]:
    colors = state.get("vetroLayerColorOverrides") or {}
    sizes = state.get("vetroLayerSizeOverrides") or {}
    opacities = state.get("vetroLayerOpacityOverrides") or {}
    styles = state.get("vetroLayerStyleOverrides") or {}
    default_opacity = clamp_number(state.get("vetroOpacity"), 0, 1, 0.72)
    is_line = geometry_type.startswith("Line") or geometry_type.startswith("MultiLine")
    color = normalize_hex_color(colors.get(layer_id)) or palette_color(layer_id)
    size = clamp_number(sizes.get(layer_id), 1 if is_line else 5, 14 if is_line else 30, 3 if is_line else 10)
    opacity = clamp_number(opacities.get(layer_id), 0, 1, default_opacity)
    raw_style = str(styles.get(layer_id) or ("solid" if is_line else "circle"))
    if is_line and raw_style not in {"solid", "dashed", "dotted"}:
        raw_style = "solid"
    if not is_line and raw_style not in POINT_ICONS:
        raw_style = "circle"
    return {"color": color, "size": size, "opacity": opacity, "style": raw_style, "is_line": is_line}


def coordinates_text(coords: list[Any]) -> str:
    parts = []
    for coordinate in coords:
        if not isinstance(coordinate, list) or len(coordinate) < 2:
            continue
        lon, lat = coordinate[:2]
        alt = coordinate[2] if len(coordinate) > 2 else 0
        parts.append(f"{float(lon):.7f},{float(lat):.7f},{float(alt):.2f}")
    return " ".join(parts)


def geometry_kml(geometry: dict[str, Any], indent: str = "        ") -> str:
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates") or []
    if geometry_type == "Point" and len(coordinates) >= 2:
        lon, lat = coordinates[:2]
        alt = coordinates[2] if len(coordinates) > 2 else 0
        return f"{indent}<Point><coordinates>{float(lon):.7f},{float(lat):.7f},{float(alt):.2f}</coordinates></Point>"
    if geometry_type == "MultiPoint":
        parts = [geometry_kml({"type": "Point", "coordinates": point}, indent + "  ") for point in coordinates]
        return f"{indent}<MultiGeometry>\n" + "\n".join(item for item in parts if item) + f"\n{indent}</MultiGeometry>"
    if geometry_type == "LineString":
        return (
            f"{indent}<LineString>\n"
            f"{indent}  <tessellate>1</tessellate>\n"
            f"{indent}  <coordinates>{coordinates_text(coordinates)}</coordinates>\n"
            f"{indent}</LineString>"
        )
    if geometry_type == "MultiLineString":
        parts = [geometry_kml({"type": "LineString", "coordinates": line}, indent + "  ") for line in coordinates]
        return f"{indent}<MultiGeometry>\n" + "\n".join(item for item in parts if item) + f"\n{indent}</MultiGeometry>"
    if geometry_type == "Polygon":
        if not coordinates:
            return ""
        outer = coordinates[0]
        inner = coordinates[1:]
        inner_kml = "".join(
            f"\n{indent}  <innerBoundaryIs><LinearRing><coordinates>{coordinates_text(ring)}</coordinates></LinearRing></innerBoundaryIs>"
            for ring in inner
            if ring
        )
        return (
            f"{indent}<Polygon>\n"
            f"{indent}  <tessellate>1</tessellate>\n"
            f"{indent}  <outerBoundaryIs><LinearRing><coordinates>{coordinates_text(outer)}</coordinates></LinearRing></outerBoundaryIs>"
            f"{inner_kml}\n"
            f"{indent}</Polygon>"
        )
    if geometry_type == "MultiPolygon":
        parts = [geometry_kml({"type": "Polygon", "coordinates": polygon}, indent + "  ") for polygon in coordinates]
        return f"{indent}<MultiGeometry>\n" + "\n".join(item for item in parts if item) + f"\n{indent}</MultiGeometry>"
    return ""


def feature_name(feature: dict[str, Any], fallback: str) -> str:
    props = feature.get("properties") or {}
    for key in ("Street_Address", "street_address", "Name", "name", "feature_id", "ID", "id", "vetro_id"):
        value = props.get(key)
        if value not in (None, ""):
            return str(value)
    return fallback


def description_html(feature: dict[str, Any], layer_name: str, style: dict[str, Any]) -> str:
    props = feature.get("properties") or {}
    preferred = [
        ("Layer", layer_name),
        ("Style", style["style"]),
        ("Color", style["color"]),
        ("Opacity", f"{round(style['opacity'] * 100)}%"),
        ("Size", style["size"]),
        ("ID", props.get("ID") or props.get("feature_id") or props.get("vetro_id") or props.get("id")),
        ("Name", props.get("Name") or props.get("name")),
        ("Address", props.get("Street_Address") or props.get("street_address")),
        ("Status", props.get("Status") or props.get("status")),
        ("Plan", props.get("plan")),
        ("Build", props.get("build_status") or props.get("Build_Status")),
        ("Placement", props.get("placement") or props.get("Placement")),
        ("Source tile", props.get("source_tile")),
    ]
    rows = [
        f"<tr><th>{text(label)}</th><td>{text(value)}</td></tr>"
        for label, value in preferred
        if value not in (None, "")
    ]
    return "<![CDATA[<table>" + "".join(rows) + "</table>]]>"


def style_kml(style_id: str, style: dict[str, Any]) -> str:
    line_color = kml_color(style["color"], style["opacity"])
    fill_color = kml_color(style["color"], style["opacity"] * 0.28)
    icon_href = POINT_ICONS.get(style["style"], POINT_ICONS["circle"])
    scale = max(0.55, min(1.9, float(style["size"]) / 10))
    return f"""    <Style id="{text(style_id)}">
      <LineStyle><color>{line_color}</color><width>{float(style["size"]):.1f}</width></LineStyle>
      <PolyStyle><color>{fill_color}</color></PolyStyle>
      <IconStyle><color>{line_color}</color><scale>{scale:.2f}</scale><Icon><href>{text(icon_href)}</href></Icon></IconStyle>
    </Style>"""


def kml_document(layer_name: str, features: list[dict[str, Any]], style: dict[str, Any], source_label: str) -> tuple[str, int]:
    style_id = f"vetro_{clean_name(layer_name)}"
    placemarks = []
    for feature in features:
        geometry = geometry_kml(feature.get("geometry") or {})
        if not geometry:
            continue
        placemarks.append(
            "      <Placemark>\n"
            f"        <name>{text(feature_name(feature, layer_name))}</name>\n"
            f"        <styleUrl>#{text(style_id)}</styleUrl>\n"
            f"        <description>{description_html(feature, layer_name, style)}</description>\n"
            f"{geometry}\n"
            "      </Placemark>"
        )
    generated_at = datetime.now().isoformat(timespec="seconds")
    kml = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>{text(layer_name)}</name>
    <description>Generated {text(generated_at)} from {text(source_label)}. Includes {len(placemarks)} VETRO features. Each file is separate so Google Earth can style the layer independently.</description>
{style_kml(style_id, style)}
    <Folder>
      <name>{text(layer_name)}</name>
{chr(10).join(placemarks)}
    </Folder>
  </Document>
</kml>
"""
    return kml, len(placemarks)


def write_kmz(kml_path: Path, kmz_path: Path) -> None:
    with zipfile.ZipFile(kmz_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(kml_path, arcname="doc.kml")


def main() -> int:
    parser = argparse.ArgumentParser(description="Export VETRO GeoJSON layers as separate Google Earth KML/KMZ files.")
    parser.add_argument("--input-dir", default="data/layers/vetro_geojson_layers")
    parser.add_argument("--state", default="data/dashboard_state.json")
    parser.add_argument("--state-user", default="site_owner")
    parser.add_argument("--output-dir", default="")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    layer_paths = sorted(input_dir.glob("Layer_*.geojson"), key=lambda path: int(layer_id_from_path(path)) if layer_id_from_path(path).isdigit() else layer_id_from_path(path))
    if not layer_paths:
        print(f"No Layer_*.geojson files found in {input_dir}", file=sys.stderr)
        return 1

    output_dir = Path(args.output_dir) if args.output_dir else Path("data/exports/google_earth") / f"vetro_layers_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    output_dir.mkdir(parents=True, exist_ok=True)
    state = load_state(Path(args.state), args.state_user)
    names = state.get("vetroLayerNameOverrides") or {}
    manifest: dict[str, Any] = {"source_dir": str(input_dir), "exported_at": datetime.now().isoformat(timespec="seconds"), "layers": {}}
    for path in layer_paths:
        layer_id = layer_id_from_path(path)
        payload = json.loads(path.read_text(encoding="utf-8"))
        features = [feature for feature in payload.get("features") or [] if isinstance(feature, dict)]
        layer_name = str(names.get(layer_id) or f"VETRO Layer {layer_id}")
        style = style_for_layer(layer_id, first_geometry_type(features), state)
        kml, placemark_count = kml_document(layer_name, features, style, str(path))
        base = f"Layer_{clean_name(layer_id)}"
        kml_path = output_dir / f"{base}.kml"
        kmz_path = output_dir / f"{base}.kmz"
        kml_path.write_text(kml, encoding="utf-8")
        write_kmz(kml_path, kmz_path)
        manifest["layers"][f"Layer_{layer_id}"] = {
            "name": layer_name,
            "feature_count": placemark_count,
            "kml": kml_path.name,
            "kmz": kmz_path.name,
            "kmz_bytes": kmz_path.stat().st_size,
            "style": style,
        }
        print(f"Layer_{layer_id}: {placemark_count} feature(s) -> {kmz_path}")
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    print(f"Manifest: {manifest_path}")
    print(f"Output directory: {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
