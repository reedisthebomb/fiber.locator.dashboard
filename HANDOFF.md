# One Call Locator Dashboard Handoff

Updated: 2026-05-20

Latest detailed continuation file:

```text
PROJECT_HANDOFF_2026-05-13.md
```

## Purpose

This project is the working dashboard for Arkansas One Call locating. It turns Outlook ticket exports, GeoCall pages and polygons, Vetro fiber layers, and public map overlays into one operational map and ticket workflow.

## Project Roots

```text
/mnt/c/Users/reedc/onecall-locator-dashboard
```

Deployed home server:

```text
/opt/onecall-locator-dashboard
```

Home server address:

```text
192.168.50.231
```

Current Home Assistant endpoint:

```text
http://192.168.50.183:8123
```

Local run:

```sh
cd /mnt/c/Users/reedc/onecall-locator-dashboard
python3 server.py
```

## Current Operating Model

The dashboard now:

- exports new tickets from Outlook
- syncs them into the server inbox
- reads the server inbox and builds the ticket list
- loads GeoCall printable pages and polygons when cached
- overlays Vetro layers and optional public address/parcel map data
- preserves hidden tickets, filters, and map state
- supports a server-side Locator Default View that loads across devices
- allows Vetro per-layer names, notes, colors, opacity, size, line style, and marker shape
- includes rectangle and house Vetro marker shapes
- serves the app locally, on LAN, and through Tailscale

The refresh button on the page triggers the server-side Outlook export and reload flow.

Dashboard login is enabled on the live cloud server when `data/dashboard_auth.json` exists. User records and password hashes stay only in that ignored runtime file.

Home Assistant `dashboard-home` has a One Call Locator iframe pointed at:

```text
http://192.168.50.231:8765/
```

## Important Files

- `server.py`
  - ticket parsing
  - GeoCall detail serving
  - refresh endpoint
  - login/session enforcement
  - per-user dashboard state API
  - dashboard serving and state persistence

- `static/app.js`
  - ticket list and ticket details
  - map rendering
  - layer controls
  - persistent filters and settings
  - per-user state save and restore

- `static/styles.css`
  - dashboard layout and layer control presentation

- `tools/export_outlook_onecall.ps1`
  - Outlook export and sync helper

- `tools/refresh_onecall_server.py`
  - server refresh workflow helper

- `tools/fetch_geocall_details_from_fetch.py`
  - one-time GeoCall detail fetch helper from a fresh browser-authenticated fetch file

- `tools/geocall_detail_export_console.js`
  - browser-console export helper for GeoCall printable pages and polygons

- `deploy/onecall-dashboard.service`
  - home-server systemd service

- `deploy/HOME_SERVER.md`
  - home-server deployment notes

- `PROJECT_OVERVIEW.md`
  - full project write-up and architecture summary

## Current Data Shape

Tickets are read from Outlook-exported text files and `.eml` sources. The parser extracts:

- ticket number
- message type
- prepared date and time
- contractor, caller, contact
- address and intersection fields
- county and place
- latitude and longitude
- `LOCATION INFORMATION`
- work type and work description
- extent, white paint, directional boring
- notified utilities
- raw email text

GeoCall detail data provides:

- printable page HTML
- polygon geometry

Vetro provides:

- layer-level filtering
- service-location rows beginning with `SL-`
- per-layer color, opacity, size, shape/style, name, and note controls

## Persistence

State now follows the login, not just the browser.

When login is enabled and the `administrator` state is empty, the server falls back to the old `default` state so existing saved views continue to load after auth is turned on.

Persisted items include:

- hidden tickets
- visible search text
- county filter
- selected ticket
- map center and zoom
- Vetro visibility and filters
- Vetro layer styling overrides
- Vetro layer aliases and notes
- SL shape, color, size, and labels
- polygon and tile opacity controls

## Deployment Notes

The home server deployment has been kept aligned with the Windows source copy.

The active service is:

```text
onecall-dashboard
```

The dashboard is reachable through:

- local loopback on the server
- the LAN address when exposed
- Tailscale when configured

## Operational Rules

- Do not save cookies, session tokens, or raw auth headers in the repo.
- Keep the exact locate/work description visible.
- Preserve hidden ticket behavior and per-ticket review flow.
- Keep the refresh flow working end to end.
- Keep the dashboard useful on more than one device.

## Known Current State

The project is in a working state on the home server. The current outstanding gap is GitHub publishing access from this session, not the dashboard itself.

## Important User Preferences

- User wants hands-on artifact-building, not generic instructions.
- Keep moving when intent is clear.
- The exact locate/work comment is critical.
- Clickable ticket number/page access is important.
- The map should combine 811 ticket polygons with Vetro fiber layers and optional public map overlays.
- The old Vitruvi overlay is intentionally removed from the current app and should not be restored without a direct user request.
- Union and Columbia counties are the service area to prioritize.
- Do not preserve or publish old cookies/session tokens.

## Next Session Resume

Last verified state:

- The Windows-side Outlook export helper is present at `tools/export_outlook_onecall.ps1`.
- It was run successfully from Windows PowerShell with:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\export_outlook_onecall.ps1 -DaysBack 4 -IncludeRead
```

- That run exported 121 ticket `.txt` files into `C:\Users\reedc\Downloads`.
- The Kali server copy is staged at `/opt/onecall-locator-dashboard`.
- The server inbox was synced with the exported files at `/opt/onecall-locator-dashboard/data/inbox`.
- The server inbox contained 156 `Arkansas One Call Ticket *.txt` files after the copy.
- Known good spot checks in the server inbox:
  - `Arkansas One Call Ticket 260501-0303.txt`
  - `Arkansas One Call Ticket 260430-1233.txt`

Resume path:

1. If new Outlook mail needs to be pulled, run the PowerShell export on the Windows machine, not on Kali.
2. Copy the exported `Arkansas One Call Ticket *.txt` files into `/opt/onecall-locator-dashboard/data/inbox`.
3. Refresh the dashboard so `/api/tickets` picks up the new files.

Do not store Outlook or GeoCall credentials in files. Use the existing export helper and browser-session-based GeoCall flow only.
