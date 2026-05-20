# One Call Locator Dashboard

Local and home-server dashboard for Arkansas One Call ticket work.

This project combines:

- Outlook ticket exports
- GeoCall printable pages and polygons
- Vetro fiber layers
- ticket hiding, filtering, and review state
- server-side Locator Default View persistence
- searchable active and historical dig-ticket views

## Project Overview

The full write-up is in [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

That file is the best starting point for the architecture, workflow, persistence model, deployment notes, and the current project state.

Daily operating notes are in [OPERATIONS.md](OPERATIONS.md). The complete script and data-flow breakdown is in [WORKFLOW_BREAKDOWN.md](WORKFLOW_BREAKDOWN.md).

## Run Locally

```sh
python3 server.py
```

Open:

```text
http://127.0.0.1:8765
```

Dashboard login is enabled when `data/dashboard_auth.json` exists on the server. Runtime auth files are intentionally ignored by Git.

## Live Target

Latest known live cloud dashboard:

```text
http://5.78.214.184:8765/
```

Older home-server deployment notes are still retained here:

```text
deploy/HOME_SERVER.md
```

Current Home Assistant endpoint:

```text
http://192.168.50.183:8123
```

## Ticket Export Flow

The Outlook export helper keeps the dashboard inbox current without saving Outlook credentials, cookies, or session tokens in the repo.

```powershell
cd C:\Users\reedc\onecall-locator-dashboard
powershell -ExecutionPolicy Bypass -File .\tools\export_outlook_onecall.ps1 -DaysBack 4 -IncludeRead
```

To sync into the server inbox during the same run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\export_outlook_onecall.ps1 -DaysBack 4 -IncludeRead -SyncToServer -ServerHost 192.168.50.231
```

If Outlook and the WSL server share the same machine, use the local server sync path:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\export_outlook_onecall.ps1 -DaysBack 4 -IncludeRead -SyncToLocalServer
```

## GeoCall Detail Export

The dashboard can use cached GeoCall printable pages and polygons from exported JSON files.

Use the browser-console helper in a logged-in GeoCall session:

```text
tools/geocall_detail_export_console.js
```

If you have a fresh DevTools `Copy as fetch` file, the server can use it once to fetch missing portal pages and polygons:

```sh
cd /opt/onecall-locator-dashboard
python3 tools/fetch_geocall_details_from_fetch.py --fetch-file "path-to-fetch-file.txt"
```

## Map Layers

- `Vetro layer` supports layer toggles, search, plan/build/placement/status/geometry/fiber filters, and independent styling.
- Vetro layer controls include color, opacity, size, point shape, line style, custom layer name, and layer note.
- Vetro point shapes include circle, square, rectangle, diamond, pin, and house.
- `SL-` service-location records have dedicated controls and styling.
- Ticket polygons and map markers are styled separately from the ticket list.

The old Vitruvi overlay has been removed completely from the app surface and server API. Keep future layer work focused on One Call tickets, GeoCall polygons, Vetro fiber data, and optional public map overlays.

## Refresh

The page refresh button now runs the server-side refresh flow instead of only redrawing the browser.

That flow updates:

1. Outlook exports
2. server inbox sync
3. ticket reload
4. layer redraw

## Vetro Export Refresh

Do not store VETRO tokens in the repo.

```sh
export VETRO_TOKEN='your-token'
python3 tools/update_vetro_export.py --plan-id 462
```

## Notes

- The app is designed to be usable from multiple devices with the same login.
- Hidden tickets, layer selections, and map state persist.
- Locator Default View can save the current server-wide default view for every device.
- This GitHub repository should be updated after each meaningful project change.
- Runtime ticket data, tokens, auth files, and customer payloads stay outside Git.
