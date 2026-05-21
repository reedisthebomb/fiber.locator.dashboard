#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import load_tickets, ticket_is_active_scope  # noqa: E402


COUNTY_STYLES = {
    "UNION": "union",
    "COLUMBIA": "columbia",
}


def text(value: object) -> str:
    return html.escape(str(value or "").strip())


def coordinates_text(ring: list[list[float]]) -> str:
    return " ".join(f"{lon:.7f},{lat:.7f},0" for lon, lat in ring)


def polygon_kml(geometry: dict) -> str:
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates") or []
    polygons = []
    if geometry_type == "Polygon":
        polygons = [coordinates]
    elif geometry_type == "MultiPolygon":
        polygons = coordinates
    parts = []
    for polygon in polygons:
        if not polygon:
            continue
        outer = polygon[0]
        if len(outer) < 4:
            continue
        parts.append(
            "        <Polygon>\n"
            "          <tessellate>1</tessellate>\n"
            "          <outerBoundaryIs>\n"
            "            <LinearRing>\n"
            f"              <coordinates>{coordinates_text(outer)}</coordinates>\n"
            "            </LinearRing>\n"
            "          </outerBoundaryIs>\n"
            "        </Polygon>"
        )
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    return "        <MultiGeometry>\n" + "\n".join(parts) + "\n        </MultiGeometry>"


def point_kml(ticket) -> str:
    if ticket.latitude is None or ticket.longitude is None:
        return ""
    return (
        "        <Point>\n"
        f"          <coordinates>{ticket.longitude:.7f},{ticket.latitude:.7f},0</coordinates>\n"
        "        </Point>"
    )


def description_html(ticket) -> str:
    fields = [
        ("Ticket", ticket.ticket_number),
        ("Message type", ticket.message_type),
        ("County", ticket.county),
        ("Place", ticket.place),
        ("Address", ticket.address or ticket.street),
        ("Nearest intersection", ticket.nearest_intersection),
        ("Work begins", " ".join(item for item in [ticket.work_begin_date, ticket.work_begin_time] if item)),
        ("Contractor", ticket.contractor),
        ("Caller", ticket.caller),
        ("Contact", ticket.contact),
        ("Contact phone", ticket.contact_phone),
        ("Done for", ticket.done_for),
        ("Work type", ticket.work_type),
        ("Extent", ticket.extent),
        ("White paint", ticket.white_paint),
        ("Directional boring", ticket.directional_boring),
        ("Location information", ticket.location_information),
        ("Utilities notified", ", ".join(ticket.utilities_notified)),
        ("GeoCall page", ticket.portal_url),
        ("Source file", Path(ticket.file).name),
    ]
    rows = []
    for label, value in fields:
        if value in (None, ""):
            continue
        escaped_value = text(value)
        if label == "GeoCall page" and escaped_value:
            escaped_value = f'<a href="{escaped_value}">{escaped_value}</a>'
        rows.append(f"<tr><th>{text(label)}</th><td>{escaped_value}</td></tr>")
    return "<![CDATA[<table>" + "".join(rows) + "</table>]]>"


def ticket_placemark(ticket) -> str:
    style = COUNTY_STYLES.get(ticket.county.strip().upper(), "other")
    geometries = []
    if ticket.polygon:
        polygon = polygon_kml(ticket.polygon)
        if polygon:
            geometries.append(polygon)
    point = point_kml(ticket)
    if point:
        geometries.append(point)
    if not geometries:
        return ""
    if len(geometries) == 1:
        geometry = geometries[0]
    else:
        geometry = "        <MultiGeometry>\n" + "\n".join(geometries) + "\n        </MultiGeometry>"
    name_bits = [ticket.ticket_number, ticket.county, ticket.place]
    name = " - ".join(bit for bit in name_bits if bit)
    return (
        "      <Placemark>\n"
        f"        <name>{text(name)}</name>\n"
        f"        <styleUrl>#{style}</styleUrl>\n"
        f"        <description>{description_html(ticket)}</description>\n"
        f"{geometry}\n"
        "      </Placemark>"
    )


def kml_document(tickets: list, source_label: str) -> str:
    generated_at = datetime.now().isoformat(timespec="seconds")
    placemarks = [ticket_placemark(ticket) for ticket in tickets]
    placemarks = [item for item in placemarks if item]
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Arkansas One Call Tickets - Google Earth</name>
    <description>Generated {text(generated_at)} from {text(source_label)}. Includes {len(placemarks)} ticket placemarks.</description>
    <Style id="union">
      <LineStyle><color>ff00ffff</color><width>2</width></LineStyle>
      <PolyStyle><color>3300ffff</color></PolyStyle>
      <IconStyle><scale>0.8</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png</href></Icon></IconStyle>
    </Style>
    <Style id="columbia">
      <LineStyle><color>ff00a5ff</color><width>2</width></LineStyle>
      <PolyStyle><color>3300a5ff</color></PolyStyle>
      <IconStyle><scale>0.8</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/orange-circle.png</href></Icon></IconStyle>
    </Style>
    <Style id="other">
      <LineStyle><color>ffffffff</color><width>2</width></LineStyle>
      <PolyStyle><color>22ffffff</color></PolyStyle>
      <IconStyle><scale>0.7</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/wht-circle.png</href></Icon></IconStyle>
    </Style>
    <Folder>
      <name>Tickets</name>
{chr(10).join(placemarks)}
    </Folder>
  </Document>
</kml>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Export loaded Arkansas One Call tickets to a Google Earth KML file.")
    parser.add_argument("--downloads-dir", default="data/inbox")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--inbox-dir", default="data/inbox")
    parser.add_argument("--output", default="Google Earth/Arkansas One Call Tickets.kml")
    parser.add_argument("--active-only", action="store_true", help="Export only tickets in the active dashboard service scope.")
    args = parser.parse_args()

    downloads_dir = Path(args.downloads_dir)
    data_dir = Path(args.data_dir)
    inbox_dir = Path(args.inbox_dir)
    output = Path(args.output)

    tickets = load_tickets(downloads_dir, data_dir, inbox_dir)
    if args.active_only:
        tickets = [ticket for ticket in tickets if ticket_is_active_scope(ticket)]
    tickets = sorted(tickets, key=lambda ticket: (ticket.county, ticket.place, ticket.ticket_number))

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(kml_document(tickets, str(inbox_dir)), encoding="utf-8")

    with_polygons = sum(1 for ticket in tickets if ticket.polygon)
    with_points = sum(1 for ticket in tickets if ticket.latitude is not None and ticket.longitude is not None)
    print(f"Exported tickets: {len(tickets)}")
    print(f"Tickets with polygons: {with_polygons}")
    print(f"Tickets with latitude/longitude: {with_points}")
    print(f"Google Earth KML: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
