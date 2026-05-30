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


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import build_vitruvi_payload, find_vitruvi_layers  # noqa: E402


PALETTE = ["#f97316", "#22c55e", "#38bdf8", "#eab308", "#a855f7", "#ef4444", "#14b8a6", "#f43f5e"]

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


def clean_id(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("_")
    if cleaned:
        return cleaned[:80]
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def normalize_hex_color(value: object) -> str | None:
    raw = str(value or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", raw):
        return raw.lower()
    if re.fullmatch(r"[0-9a-fA-F]{6}", raw):
        return f"#{raw.lower()}"
    return None


def js_palette_color(layer_id: str) -> str:
    hash_value = 0
    for char in str(layer_id):
        hash_value = ((hash_value * 31) + ord(char)) & 0xFFFFFFFF
    return PALETTE[hash_value % len(PALETTE)]


def clamp_number(value: object, minimum: float, maximum: float, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if not number == number:
        return fallback
    return min(maximum, max(minimum, number))


def kml_color(hex_color: str, opacity: float) -> str:
    color = normalize_hex_color(hex_color) or "#ffffff"
    alpha = round(clamp_number(opacity, 0, 1, 1) * 255)
    red = color[1:3]
    green = color[3:5]
    blue = color[5:7]
    return f"{alpha:02x}{blue}{green}{red}"


def layer_id(feature: dict[str, Any]) -> str:
    props = feature.get("properties") or {}
    for key in ("vitruvi_layer", "vitruvi_layer_label", "category_name", "geojson_layer", "Category", "category"):
        value = props.get(key)
        if value not in (None, ""):
            return str(value)
    return "Vitruvi"


def layer_default_name(layer: dict[str, Any], layer_key: str) -> str:
    label = layer.get("label")
    return str(label or layer_key)


def load_state(path: Path | None, user: str) -> dict[str, Any]:
    if not path or not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "users" in data:
        user_state = data.get("users", {}).get(user, {})
        return user_state if isinstance(user_state, dict) else {}
    return data if isinstance(data, dict) else {}


def geometry_type_by_layer(features: list[dict[str, Any]]) -> dict[str, str]:
    result: dict[str, str] = {}
    for feature in features:
        key = layer_id(feature)
        geometry_type = (feature.get("geometry") or {}).get("type") or ""
        if key not in result and geometry_type:
            result[key] = geometry_type
    return result


def style_for_layer(layer_key: str, geometry_type: str, state: dict[str, Any]) -> dict[str, Any]:
    colors = state.get("vitruviLayerColorOverrides") or {}
    sizes = state.get("vitruviLayerSizeOverrides") or {}
    opacities = state.get("vitruviLayerOpacityOverrides") or {}
    styles = state.get("vitruviLayerStyleOverrides") or {}
    default_opacity = clamp_number(state.get("vitruviOpacity"), 0, 1, 0.82)
    is_line = geometry_type.startswith("Line")
    color = normalize_hex_color(colors.get(layer_key)) or js_palette_color(layer_key)
    size = clamp_number(sizes.get(layer_key), 1 if is_line else 7, 10 if is_line else 28, 3 if is_line else 11)
    opacity = clamp_number(opacities.get(layer_key), 0, 1, default_opacity)
    raw_style = str(styles.get(layer_key) or ("solid" if is_line else "circle"))
    if is_line and raw_style not in {"solid", "dashed", "dotted"}:
        raw_style = "solid"
    if not is_line and raw_style not in POINT_ICONS:
        raw_style = "circle"
    return {"color": color, "size": size, "opacity": opacity, "style": raw_style, "is_line": is_line}


def coordinates_text(coords: list[Any]) -> str:
    parts = []
    for coordinate in coords:
        if len(coordinate) < 2:
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
    if geometry_type == "GeometryCollection":
        parts = [geometry_kml(item, indent + "  ") for item in geometry.get("geometries") or []]
        return f"{indent}<MultiGeometry>\n" + "\n".join(item for item in parts if item) + f"\n{indent}</MultiGeometry>"
    return ""


def description_html(feature: dict[str, Any], layer_name: str, style: dict[str, Any]) -> str:
    props = feature.get("properties") or {}
    preferred = [
        ("Layer", layer_name),
        ("Style", style["style"]),
        ("Color", style["color"]),
        ("Opacity", f"{round(style['opacity'] * 100)}%"),
        ("Size", style["size"]),
        ("Label", props.get("label")),
        ("Category", props.get("category_name") or props.get("vitruvi_layer_label") or props.get("category")),
        ("Status", props.get("vitruvi_status") or props.get("status")),
        ("Region", props.get("region_name") or props.get("Region")),
        ("Address", props.get("full_address") or props.get("Address")),
        ("Vitruvi ID", props.get("vitruvi_id") or props.get("ID") or props.get("id")),
        ("UID", props.get("uid") or props.get("vetro_id")),
        ("Length", props.get("planned_length") or props.get("total_length") or props.get("shape__len")),
        ("Note", props.get("note") or props.get("comments") or props.get("description")),
        ("Source", props.get("source_file")),
    ]
    rows = [
        f"<tr><th>{text(label)}</th><td>{text(value)}</td></tr>"
        for label, value in preferred
        if value not in (None, "")
    ]
    return "<![CDATA[<table>" + "".join(rows) + "</table>]]>"


def feature_name(feature: dict[str, Any], fallback: str) -> str:
    props = feature.get("properties") or {}
    for key in ("label", "feature_id", "vitruvi_id", "name", "Name", "uid"):
        value = props.get(key)
        if value not in (None, ""):
            return str(value)
    return fallback


def style_kml(style_id: str, style: dict[str, Any]) -> str:
    line_color = kml_color(style["color"], style["opacity"])
    fill_color = kml_color(style["color"], style["opacity"] * 0.32)
    icon_href = POINT_ICONS.get(style["style"], POINT_ICONS["circle"])
    scale = max(0.55, min(1.8, float(style["size"]) / 11))
    return f"""    <Style id="{text(style_id)}">
      <LineStyle><color>{line_color}</color><width>{float(style["size"]):.1f}</width></LineStyle>
      <PolyStyle><color>{fill_color}</color></PolyStyle>
      <IconStyle><color>{line_color}</color><scale>{scale:.2f}</scale><Icon><href>{text(icon_href)}</href></Icon></IconStyle>
    </Style>"""


def kml_document(payload: dict[str, Any], state: dict[str, Any], source_label: str) -> tuple[str, int]:
    features = list(payload.get("features") or [])
    selected = state.get("vitruviLayerFilterSelected")
    if isinstance(selected, list) and selected:
        selected_set = {str(item) for item in selected}
        features = [feature for feature in features if layer_id(feature) in selected_set]
    search = str(state.get("vitruviSearch") or "").strip().lower()
    if search:
        features = [feature for feature in features if search in json.dumps(feature.get("properties") or {}, default=str).lower()]

    geometry_by_layer = geometry_type_by_layer(payload.get("features") or [])
    aliases = state.get("vitruviLayerNameOverrides") or {}
    notes = state.get("vitruviLayerNoteOverrides") or {}
    layer_meta = {str(item.get("id")): item for item in payload.get("metadata", {}).get("layers", [])}
    layer_keys = sorted({layer_id(feature) for feature in features}, key=lambda key: layer_default_name(layer_meta.get(key, {}), key))
    style_by_layer = {key: style_for_layer(key, geometry_by_layer.get(key, ""), state) for key in layer_keys}
    style_ids = {key: f"vitruvi_{clean_id(key)}" for key in layer_keys}
    styles = [style_kml(style_ids[key], style_by_layer[key]) for key in layer_keys]
    folders = []
    for key in layer_keys:
        layer_features = [feature for feature in features if layer_id(feature) == key]
        layer_name = str(aliases.get(key) or layer_default_name(layer_meta.get(key, {}), key))
        note = str(notes.get(key) or "")
        placemarks = []
        for feature in layer_features:
            geometry = geometry_kml(feature.get("geometry") or {})
            if not geometry:
                continue
            placemarks.append(
                "      <Placemark>\n"
                f"        <name>{text(feature_name(feature, layer_name))}</name>\n"
                f"        <styleUrl>#{text(style_ids[key])}</styleUrl>\n"
                f"        <description>{description_html(feature, layer_name, style_by_layer[key])}</description>\n"
                f"{geometry}\n"
                "      </Placemark>"
            )
        folders.append(
            "    <Folder>\n"
            f"      <name>{text(layer_name)}</name>\n"
            f"      <description>{text(note)}</description>\n"
            + "\n".join(placemarks)
            + "\n    </Folder>"
        )
    generated_at = datetime.now().isoformat(timespec="seconds")
    kml = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Vitruvi Layers - Google Earth</name>
    <description>Generated {text(generated_at)} from {text(source_label)}. Includes {len(features)} Vitruvi features across {len(layer_keys)} layers. KML keeps colors, opacity, names, notes, widths, and closest Google Earth point icons.</description>
{chr(10).join(styles)}
{chr(10).join(folders)}
  </Document>
</kml>
"""
    return kml, len(features)


def write_kmz(kml_path: Path, kmz_path: Path) -> None:
    with zipfile.ZipFile(kmz_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(kml_path, arcname="doc.kml")


def main() -> int:
    parser = argparse.ArgumentParser(description="Export the dashboard Vitruvi owner layer to Google Earth KML/KMZ.")
    parser.add_argument("--layers-dir", default="data/layers")
    parser.add_argument("--downloads-dir", default=str(Path.home() / "Downloads"))
    parser.add_argument("--state", default="data/dashboard_state.json")
    parser.add_argument("--state-user", default="site_owner")
    parser.add_argument("--output", default="Google Earth/Vitruvi Layers.kml")
    parser.add_argument("--no-kmz", action="store_true", help="Only write KML; skip the compressed KMZ copy.")
    args = parser.parse_args()

    layers = find_vitruvi_layers(Path(args.layers_dir), Path(args.downloads_dir))
    if not layers:
        print(f"No Vitruvi source found in {args.layers_dir} or {args.downloads_dir}", file=sys.stderr)
        return 1

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    state = load_state(Path(args.state), args.state_user)
    payload = build_vitruvi_payload(layers)
    kml, exported_count = kml_document(payload, state, ", ".join(str(path) for path in layers))
    output.write_text(kml, encoding="utf-8")
    print(f"Source files: {', '.join(str(path) for path in layers)}")
    print(f"Loaded Vitruvi features: {len(payload.get('features') or [])}")
    print(f"Exported Vitruvi features: {exported_count}")
    print(f"Google Earth KML: {output}")
    if not args.no_kmz:
        kmz_path = output.with_suffix(".kmz")
        write_kmz(output, kmz_path)
        print(f"Google Earth KMZ: {kmz_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
