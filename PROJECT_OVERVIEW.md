# One Call Locator Dashboard Project Overview

## What This Project Is

This project is the operator dashboard for Arkansas One Call work. It turns exported ticket emails, GeoCall printable pages, GeoCall polygons, and Vetro fiber layers into one working map and ticket review surface.

The goal is practical, not decorative:

- pull new tickets from Outlook
- keep the server inbox updated
- show the exact work description and location information
- load printable GeoCall pages and polygons
- let the map be filtered, hidden, and tuned at the layer level
- preserve the exact dashboard state across refreshes and across devices
- keep the deployment portable for local use, Kali home-server use, and Tailscale access

## Current Repository Location

```text
/mnt/c/Users/reedc/onecall-locator-dashboard
```

Deployed home-server copy:

```text
/opt/onecall-locator-dashboard
```

Home server:

```text
192.168.50.231
```

## Runtime

Local run:

```sh
cd /mnt/c/Users/reedc/onecall-locator-dashboard
python3 server.py
```

Home server service:

```text
onecall-dashboard
```

Default port:

```text
8765
```

## Core Data Flow

1. Outlook contains Arkansas One Call emails.
2. `tools/export_outlook_onecall.ps1` exports those messages into ticket text files.
3. The dashboard server reads those exports from the configured inbox directory.
4. GeoCall printable pages and polygons are fetched or cached separately.
5. The dashboard combines tickets, polygons, Vetro fiber data, and public map overlays into one interface.
6. The refresh button on the page triggers the Outlook export plus server sync.

## Ticket Sources

The dashboard reads ticket exports from:

```text
C:\Users\reedc\Downloads
```

and on the server side from:

```text
/opt/onecall-locator-dashboard/data/inbox
```

The parser extracts:

- ticket number
- message type
- prepared date and time
- contractor, caller, contact
- phone and email
- work begin date and time
- county, place, street, intersection
- latitude and longitude
- `LOCATION INFORMATION`
- work type
- extent
- directional boring
- white paint
- notified utilities
- raw email text

## GeoCall Integration

GeoCall is used for two separate things:

- cached printable ticket pages
- ticket polygons

The dashboard never stores cookies or session tokens in the project. Fresh browser-authenticated fetches are used transiently when needed.

The current UI exposes:

- ticket page links
- polygon presence
- printable page presence
- cached GeoCall page access from the ticket detail panel

## Map Layers

### One Call Tickets

Tickets appear as map points and polygons. The point and polygon styles can be adjusted separately, and the page can hide tickets individually or by group.

### Vetro

Vetro is the richest overlay in the dashboard. It supports:

- layer toggles
- layer search
- layer color
- layer opacity
- layer size
- point shape and line style
- layer name alias
- layer note
- plan filters
- build filters
- placement filters
- status filters
- geometry filters
- fiber capacity filters
- route and point filters
- service-location controls for `SL-` features

Vetro layers are sourced from the staged GeoJSON layer export when available, then from fallback layer files.

## State Persistence

Dashboard state is no longer browser-only.

It now persists per logged-in user through the server so the same settings follow the login across browsers and devices.

Persisted state includes:

- hidden tickets
- visible ticket search text
- county filter
- selected ticket
- map position and zoom
- Vetro visibility and filters
- Vetro layer styling overrides
- Vetro layer aliases and notes
- SL shape/color/size/label settings
- polygon color and opacity
- map tile opacity

## Refresh Flow

The page refresh button now triggers the live update flow instead of only redrawing the page.

It runs:

1. Outlook export
2. local inbox sync
3. dashboard refresh
4. data reload in the browser

This is the main operational path for keeping the dashboard current.

## Security And Access

The server uses login protection for the dashboard when auth is enabled.

The current deployment supports:

- local access on the host
- LAN access
- Tailscale access
- optional HTTPS

Access should stay limited to the dashboard machine unless the user intentionally exposes more.

## Project Layout

Important files:

- `server.py` - Python server, parsers, refresh flow, GeoCall and state APIs
- `static/app.js` - dashboard state, rendering, filters, layer controls
- `static/styles.css` - page styling
- `tools/export_outlook_onecall.ps1` - Outlook export helper
- `tools/refresh_onecall_server.py` - server refresh workflow
- `tools/fetch_geocall_details_from_fetch.py` - authenticated GeoCall detail fetch helper
- `tools/geocall_detail_export_console.js` - browser-console export helper
- `HANDOFF.md` - project handoff and operational notes
- `deploy/onecall-dashboard.service` - systemd service file
- `deploy/HOME_SERVER.md` - home server deployment notes

## Deployment Notes

The home server deployment lives on the Kali machine at `192.168.50.231` under `/opt/onecall-locator-dashboard`.

The service is expected to run as:

```text
/usr/bin/python3 /opt/onecall-locator-dashboard/server.py --host 0.0.0.0 --port 8765
```

The project also uses Tailscale Serve for tailnet access.

## What To Preserve

When making future changes, keep these invariants intact:

- the exact work description must stay visible
- hidden tickets must stay hideable and restorable
- layer settings must persist
- the refresh button must keep the Outlook export flow
- no cookies or session tokens should be saved in the repo
- the dashboard should stay useful on the actual server, not only in one browser
- the Vitruvi overlay should stay removed unless the user explicitly asks to rebuild it

## Publishing Status

This private repository is the main project brain. Update it when app code, deployment process, ticket ingestion, or operational rules change.
