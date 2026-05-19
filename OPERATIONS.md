# Fiber Locator Dashboard Operations

Updated: 2026-05-19

This repository is the main project brain for the private Fiber Locator dashboard. Every meaningful code, deployment, data-flow, or process change should be committed here so the project can be resumed from any device without relying on scattered handoff files.

## Current Production Target

The current live dashboard target from the latest handoff is:

```text
http://5.78.214.184:8765/
```

Older Kali/home-server notes are still useful background, but the cloud target should be revalidated first before new production work.

## What The App Does

The dashboard supports:

- Arkansas One Call ticket parsing from Outlook exports and server inbox files
- GeoCall printable-page and polygon cache display
- active ticket map markers and ticket polygons
- Vetro fiber layer display, filtering, styling, naming, notes, and service-location controls
- public address/parcel map overlays when zoomed in
- hidden tickets, action status, ticket descriptions, selected ticket, map position, profile, and layer settings persisted by the server
- Dig Tickets sheet view with current-ticket search and historical-ticket search
- mobile view with synced search and ticket review controls

The old Vitruvi overlay has been removed from the app UI and server API.

## Persistence Model

Browser storage is used for fast local startup, but the important dashboard state is also posted to the server through `/api/state`.

Persisted state includes:

- hidden and archived tickets
- ticket action checkboxes and ticket descriptions
- current search text
- county filter
- selected ticket
- map center and zoom
- Vetro visibility, filters, layer styles, aliases, notes, size, color, and opacity
- service-location marker shape, size, color, opacity, and label settings
- map style, map opacity, ticket opacity, and polygon styling
- profile name, role, and avatar data
- Locator Default View when enabled

When multiple devices use the same server login, server-backed state is the source of truth. Avoid adding new browser-only settings unless they are explicitly temporary.

## Ticket And History Data

Runtime data is intentionally excluded from Git because it can contain customer data, auth material, and private ticket details.

Expected runtime locations:

```text
data/inbox/
data/history/
data/attachments/
data/dashboard_state.json
data/private/
data/layers/
```

The Dig Tickets page reads historical ticket JSON from:

```text
/data/history/to_date_dig_tickets_history.json
```

The Excel source link points at:

```text
/data/history/to.date.dig.tickets.history.xlsx
```

Keep those files on the live server, not in Git.

## Refresh Flow

The page Refresh button calls `/api/refresh`.

The server-side refresh workflow is intended to:

1. pull new Outlook tickets with the Graph or Windows export helper
2. sync ticket text files into the server inbox
3. rebuild the dashboard ticket list
4. keep GeoCall detail cache available when exported or fetched separately
5. let the browser reload the latest ticket payload

Latest known blocker from the cloud handoff: the cloud refresh job needs a first-run Microsoft device-code login because the token cache was missing at:

```text
/opt/onecall-locator-dashboard/data/private/outlook_graph_token.json
```

Do not commit token caches or auth files.

## Development Run

Basic local run:

```sh
python3 server.py
```

Use a real data directory when testing against imported or production-like data:

```sh
python3 server.py --host 127.0.0.1 --port 8765 --data-dir /path/to/data --inbox-dir /path/to/data/inbox --layers-dir /path/to/data/layers
```

Open:

```text
http://127.0.0.1:8765/
```

## GitHub Rule

After every substantial change:

1. run `python3 -m py_compile server.py`
2. run `node --check static/app.js`
3. verify the app in a browser or with an HTTP smoke test
4. update `README.md`, `PROJECT_OVERVIEW.md`, `HANDOFF.md`, or this file when behavior/process changes
5. commit and push to the private GitHub repository

Do not commit:

- `data/`
- Outlook exports
- GeoCall cookies, copied fetch headers, tokens, or session files
- Vetro tokens
- TLS private keys
- generated cache files with customer/ticket payloads
