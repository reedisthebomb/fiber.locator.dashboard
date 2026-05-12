# One Call Locator Dashboard Handoff

Updated: 2026-05-12

## Purpose

This project is the working dashboard for Arkansas One Call locating. It turns Outlook ticket exports, GeoCall pages and polygons, Vitruvi layers, and Vetro fiber layers into one operational map and ticket workflow.

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
- overlays Vitruvi and Vetro layers
- preserves hidden tickets, filters, and map state per logged-in user
- serves the app locally, on LAN, and through Tailscale

The refresh button on the page triggers the server-side Outlook export and reload flow.

## Important Files

- `server.py`
  - ticket parsing
  - GeoCall detail serving
  - refresh endpoint
  - per-user dashboard state API
  - auth and HTTPS support

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

Vitruvi provides:

- category-based features
- point and line features
- color and opacity controls

Vetro provides:

- layer-level filtering
- service-location rows beginning with `SL-`
- per-layer color, opacity, size, shape/style, name, and note controls

## Persistence

State now follows the login, not just the browser.

Persisted items include:

- hidden tickets
- visible search text
- county filter
- selected ticket
- map center and zoom
- Vitruvi visibility and filters
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
