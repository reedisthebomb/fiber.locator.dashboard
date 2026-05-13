# One Call Locator Dashboard

Local and home-server dashboard for Arkansas One Call ticket work.

This project combines:

- Outlook ticket exports
- GeoCall printable pages and polygons
- Vetro fiber layers
- Vitruvi utility layers
- ticket hiding, filtering, and review state
- server-side Locator Default View persistence

## Project Overview

The full write-up is in [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

That file is the best starting point for the architecture, workflow, persistence model, deployment notes, and the current project state.

## Run Locally

```sh
python3 server.py
```

Open:

```text
http://127.0.0.1:8765
```

Dashboard login is currently disabled by request.

## Home Server

Deployment notes:

```text
deploy/HOME_SERVER.md
```

Current home-server target:

```text
192.168.50.231
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

- `Vitruvi layer` supports category and status filtering, single-color mode, and opacity control.
- `Vetro layer` supports layer toggles, search, plan/build/placement/status/geometry/fiber filters, and independent styling.
- Vetro layer controls include color, opacity, size, point shape, line style, custom layer name, and layer note.
- Vetro point shapes include circle, square, rectangle, diamond, pin, and house.
- `SL-` service-location records have dedicated controls and styling.
- Ticket polygons and map markers are styled separately from the ticket list.

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
- The project is intended to stay private until you decide otherwise.
