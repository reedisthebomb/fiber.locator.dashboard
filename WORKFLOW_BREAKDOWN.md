# One Call Dashboard Workflow Breakdown

This document maps the moving parts of the One Call / Fiber Locator dashboard: what each script does, where runtime data lives, and how a ticket gets from Outlook into the browser map.

## High-Level Flow

1. Arkansas One Call emails arrive in Outlook or Microsoft Graph.
2. Ticket emails are exported into text files named `Arkansas One Call Ticket <ticket>.txt`.
3. The server reads ticket files from `data/inbox/` plus any configured downloads directory.
4. `server.py` parses ticket fields, loads cached GeoCall pages and polygons, loads Vetro GeoJSON layers, and serves the browser app.
5. `static/app.js` renders the ticket list, map markers, polygons, Vetro layers, Dig Tickets views, search controls, admin/employee profile behavior, and saved state.
6. Browser actions save state back to `data/dashboard_state.json` through `/api/state`.
7. Production runs under systemd as `onecall-dashboard`.

Runtime data is intentionally outside Git. The tracked repo contains code, docs, service templates, and helper scripts only.

## Runtime Directories

- `data/inbox/`: exported Outlook or Graph ticket text files.
- `data/history/`: historical Dig Tickets JSON and spreadsheet files.
- `data/attachments/`: uploaded or linked ticket attachment metadata.
- `data/private/`: token caches, including Microsoft Graph refresh-token cache.
- `data/layers/`: Vetro exports and staged GeoJSON layer files.
- `data/dashboard_state.json`: server-backed user, default-view, and employee-dashboard state.
- `data/dashboard_auth.json`: optional runtime login users and password hashes.

The entire `data/` tree is ignored by Git because it can contain ticket details, customer data, auth records, tokens, cookies, map exports, and operational state.

## Main Server

`server.py` is the application backend and static-file server.

Core responsibilities:

- parses Arkansas One Call text and EML tickets
- extracts ticket number, county, place, address, coordinates, caller, contractor, work details, utilities, and raw text
- limits active-ticket behavior to the configured service counties and work-begin date
- loads cached GeoCall detail exports and attaches printable pages/polygons to tickets
- loads Vetro KML/GeoJSON layers and serves normalized GeoJSON from `/api/vetro`
- serves map config from `/api/map-config`
- exposes tickets through `/api/tickets`
- accepts and returns server-backed dashboard state through `/api/state`
- saves Locator Default View and Employee Dashboard snapshots inside the state file
- handles login when `data/dashboard_auth.json` is present
- runs `/api/refresh`, which starts the configured Outlook/Graph refresh workflow
- stores ticket attachments and attachment index data under `data/attachments/`

Important runtime behavior:

- If auth users are loaded, the root app and API routes require a valid login session.
- Session tokens live in memory and browser cookies only.
- Password hashes are read from the ignored runtime auth file.
- If a named user has no saved state yet, the server can fall back to the old `default` state so existing views are not lost.

## Browser App

`static/app.js` is the main frontend controller.

It handles:

- loading tickets, Vetro data, map config, and saved state
- Leaflet map setup and base map switching
- ticket list rendering, selected-ticket details, broad search, map search, and county filters
- current-ticket markers and GeoCall polygons
- Vetro layer filters, search, aliases, notes, colors, opacity, shape, size, and line style
- `SL-` service-location controls
- Dig Tickets sheet and historical ticket search/export tools
- admin profile and employee profile behavior
- server-backed state save/restore
- Locator Default View and Employee Dashboard save confirmation
- mobile layout controls

`static/styles.css` owns the visual layout, responsive behavior, panels, map overlays, ticket cards, forms, and mobile presentation.

`index.html` loads Leaflet, optional browser libraries, the stylesheet, and `static/app.js`.

## Outlook Export Script

`tools/export_outlook_onecall.ps1` is the Windows Outlook COM export path.

Use it when Outlook desktop is available on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\export_outlook_onecall.ps1 -DaysBack 4 -IncludeRead
```

What it does:

- opens the local Outlook inbox through COM
- walks recent messages newest-first
- filters to messages containing an Arkansas One Call style ticket number and One Call markers
- writes each ticket to `Arkansas One Call Ticket <ticket>.txt`
- optionally syncs exported files over SSH/SCP to a server inbox with `-SyncToServer`
- optionally copies files into a WSL/local server inbox with `-SyncToLocalServer`

Inputs:

- `-DaysBack`
- `-OutputDir`
- `-IncludeRead`
- `-SyncToServer`
- `-ServerUser`
- `-ServerHost`
- `-ServerPort`
- `-ServerInboxDir`
- `-SyncToLocalServer`
- `-LocalServerInboxDir`

It does not store Outlook credentials.

## Microsoft Graph Export Script

`tools/pull_outlook_graph_tickets.py` is the server-side Microsoft Graph path.

Use it when the server should pull Outlook mail directly:

```sh
OUTLOOK_GRAPH_CLIENT_ID=your-public-client-id \
python3 tools/pull_outlook_graph_tickets.py --device-code --output-dir data/inbox
```

After the first device-code login, future runs can refresh from the token cache:

```sh
python3 tools/pull_outlook_graph_tickets.py --output-dir data/inbox
```

What it does:

- uses Microsoft Graph device-code auth for first setup
- stores the Microsoft token response in an ignored private JSON cache
- refreshes access tokens from the refresh token on later runs
- reads recent mail from the configured folder
- converts HTML bodies to text when needed
- filters messages to Arkansas One Call ticket content
- writes ticket files into `data/inbox/`

Important env/config:

- `OUTLOOK_GRAPH_CLIENT_ID`
- `OUTLOOK_GRAPH_TENANT`
- `OUTLOOK_GRAPH_SCOPE`
- `OUTLOOK_DAYS_BACK`
- `OUTLOOK_INCLUDE_READ`
- `OUTLOOK_GRAPH_FOLDER`
- `OUTLOOK_TICKET_OUTPUT_DIR`
- `OUTLOOK_GRAPH_TOKEN_CACHE`

Token caches must stay under `data/private/` or another ignored private path.

## Server Refresh Helper

`tools/refresh_onecall_server.py` is the local/server refresh consolidator.

Typical use:

```sh
python3 tools/refresh_onecall_server.py \
  --downloads-dir /opt/onecall-locator-dashboard/data/inbox \
  --data-dir /opt/onecall-locator-dashboard/data \
  --inbox-dir /opt/onecall-locator-dashboard/data/inbox
```

What it does:

- copies matching exported ticket files into the inbox
- copies GeoCall detail export JSON files into `data/`
- optionally runs the GeoCall fetch helper with a fresh copied request
- loads tickets through `server.py` to report ticket count, polygon count, and printable-page count
- can restart `onecall-dashboard` when passed `--restart-service`

This script is useful after a manual Windows export, after copying files from another machine, or inside a systemd refresh job.

## GeoCall Browser Console Export

`tools/geocall_detail_export_console.js` is a manual browser-session export helper.

Use it while logged in at the GeoCall portal. Paste it into DevTools Console, enter ticket numbers, and it downloads a JSON file containing printable ticket HTML and polygon text when present.

What it does:

- uses the active browser session only
- looks up GeoCall internal ticket IDs by ticket number
- fetches printable ticket pages
- extracts `POLYGON((...))` geometry from the response when present
- downloads `arkonecall_ticket_details_<stamp>.json`

It does not write or persist cookies.

## GeoCall Fetch Replay Helper

`tools/fetch_geocall_details_from_fetch.py` is a one-time missing-detail fetcher using a fresh copied browser request.

Use it with a recent DevTools `Copy as fetch` or `Copy as cURL` request:

```sh
python3 tools/fetch_geocall_details_from_fetch.py \
  --fetch-file path-to-copy-as-fetch.txt \
  --data-dir data \
  --inbox-dir data/inbox
```

What it does:

- reads headers from a copied browser request
- requires a cookie header in that copied request
- uses those headers only for the current run
- finds tickets that are missing cached GeoCall details
- looks up internal GeoCall ticket IDs
- fetches printable pages and polygons
- writes a timestamped `arkonecall_ticket_details_refresh_<stamp>.json` file under `data/`

Copied requests can contain cookies. Keep those files out of Git and delete them when finished.

## Vetro Export Refresh

`tools/update_vetro_export.py` downloads and stages Vetro plan exports.

Use:

```sh
export VETRO_TOKEN=your-token
python3 tools/update_vetro_export.py --plan-id 462
```

What it does:

- calls the Vetro export API for the requested plan
- polls until the export is complete
- downloads the export ZIP
- extracts GeoJSON feature collections
- splits features into per-layer `Layer_<id>.geojson` files
- writes a combined GeoJSON file
- writes a manifest with feature counts and geometry counts
- stages everything under `data/layers/vetro_geojson_layers/` by default

Important env/config:

- `VETRO_TOKEN`
- `VETRO_PLAN_ID`
- `--output-dir`
- `--work-dir`

The Vetro token, ZIP downloads, extracted exports, and staged layer data are runtime data and stay outside Git.

## Systemd Services

`deploy/onecall-dashboard.service` runs the web dashboard:

```text
/usr/bin/python3 /opt/onecall-locator-dashboard/server.py --host 0.0.0.0 --port 8765
```

It loads optional environment variables from:

```text
/opt/onecall-locator-dashboard/.env
```

`deploy/onecall-dashboard-refresh.service` runs a oneshot refresh:

1. `tools/pull_outlook_graph_tickets.py`
2. `tools/refresh_onecall_server.py`

`deploy/onecall-dashboard-refresh.timer` schedules that refresh every 10 minutes after boot.

The real `.env` file belongs on the server and must not be committed. `deploy/onecall-env.example` documents the expected variable names.

## Production Deployment Pattern

The normal cloud deployment pattern is:

```sh
rsync -az --delete \
  --exclude data \
  --exclude __pycache__ \
  ./ root@5.78.214.184:/opt/onecall-locator-dashboard/
ssh root@5.78.214.184 'cd /opt/onecall-locator-dashboard && python3 -m py_compile server.py'
ssh root@5.78.214.184 'systemctl restart onecall-dashboard && systemctl is-active onecall-dashboard'
```

Then smoke test:

```sh
curl -I http://5.78.214.184:8765/
curl -s http://5.78.214.184:8765/api/tickets
```

If auth is enabled, unauthenticated API routes should return an auth failure and browser testing should include a real login.

## GitHub Publishing Boundary

Safe to track:

- Python server code
- frontend code
- styles
- systemd unit templates
- example environment variable names
- docs and handoff files

Do not track:

- `data/`
- `.env`
- Outlook exports
- Graph token cache files
- GeoCall copied fetch/cURL files
- GeoCall cookies or browser headers
- Vetro tokens
- Vetro downloaded ZIPs or extracted customer network layers
- dashboard auth files
- TLS private keys
- raw ticket/customer payloads

