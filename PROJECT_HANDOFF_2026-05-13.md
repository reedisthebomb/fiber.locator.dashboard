# Fiber Locator Dashboard Handoff - 2026-05-13

This file is the current project handoff for the Fiber Locator dashboard for Arkansas One Call / TCW fiber locating work.

## Current Deployment

Update 2026-05-20: login is enabled again on the live cloud dashboard. Auth users and salted password hashes are loaded from `data/dashboard_auth.json`, which remains outside Git and runtime handoffs.

- Primary live server: `root@5.78.214.184`
- Deployed app path: `/opt/onecall-locator-dashboard`
- Systemd service: `onecall-dashboard`
- Dashboard URL: `http://5.78.214.184:8765/`
- Service command:
  - `systemctl status onecall-dashboard`
  - `systemctl restart onecall-dashboard`
- The server currently runs plain HTTP on port `8765`.
- Dashboard login is enabled on the live cloud server when `data/dashboard_auth.json` exists.

## Current Verified State

As of this handoff:

- `onecall-dashboard` is active on the cloud machine.
- The dashboard returns HTTP 200/302 at `http://5.78.214.184:8765/` depending on auth state.
- Unauthenticated `/api/state` returns `401 Login required` when auth is enabled.
- `locatorDefault.enabled` is `true`.
- The deployed server-side default view has state saved.
- Home Assistant live Lovelace dashboard `dashboard-home` has historically had a `Fiber Locator` panel.
- That panel iframe points to `http://192.168.50.231:8765/`.

## Important Files

- `server.py`
  - Ticket loading
  - GeoCall cached detail loading
  - Refresh endpoint
  - Dashboard state persistence
  - Vetro and Vitruvi API endpoints
  - Auth users are loaded from the ignored runtime `data/dashboard_auth.json` file when present
- `index.html`
  - Main UI
  - Locator Default View controls
  - Vetro drawer controls
  - County filter controls
- `static/app.js`
  - Main frontend logic
  - Ticket rendering
  - Map rendering
  - Vetro layer controls
  - Persistent state save/load
  - Locator Default View save/load
- `static/styles.css`
  - Dark dashboard theme
  - Vetro and ticket panel styling
  - Marker shape styling
- `tools/export_outlook_onecall.ps1`
  - Outlook ticket export helper
  - Default lookback is now 4 days
- `tools/fetch_geocall_details_from_fetch.py`
  - Uses a fresh authenticated GeoCall cURL to download ticket detail pages and polygons

## Recent Changes

### County Filtering

- Removed the old server-side county limit that only loaded selected counties.
- Dashboard now loads all current ticket counties.
- Added checkbox county filtering at the top of the page.
- County filter state persists.

Current verified ticket county set from the last full refresh:

- `COLUMBIA`
- `CONWAY`
- `FAULKNER`
- `LONOKE`
- `POPE`
- `UNION`

### Ticket and Polygon Refresh

- A fresh GeoCall authenticated cURL was used for ticket `260512-1856`.
- The GeoCall backfill downloaded all missing detail records.
- Last verified state after backfill:
  - `532` tickets
  - `532` polygons
  - `532` portal pages
  - `0` missing details
- The Outlook export helper now defaults to `-DaysBack 4`.
- The server refresh command also passes `-DaysBack 4`.

### Vetro Layer Controls

The Vetro drawer includes deeper controls for each layer:

- Per-layer toggle
- Per-layer color
- Per-layer opacity
- Per-layer line style or marker shape
- Per-layer line width or marker size
- Per-layer display name
- Per-layer note

Recent marker shape additions:

- `Rectangle`
- `House`

Use cases:

- Handholes can be changed to `Rectangle`.
- Service locations can be changed to `House`.
- SL service locations also include rectangle/house shape choices.

### Locator Default View

Added a top control bar:

- `Locator Default View` toggle
- `Save current` button
- Status text

Behavior:

- If Locator Default View is enabled, every page load applies the saved server-side default state.
- The saved default persists across devices, URLs, and browser sessions.
- Clicking `Save current` stores the current full dashboard state as the new locator default.
- Regular user/default state still saves through `/api/state`.
- Global locator default is stored in `data/dashboard_state.json` under top-level `locator_default`.

Saved state includes:

- Hidden tickets
- Show hidden setting
- Search text
- County filters
- Vitruvi settings
- Vetro visibility
- Vetro selected layers
- Vetro plan/status/fiber/placement/route/point/geometry/build filters
- Vetro per-layer colors
- Vetro per-layer names
- Vetro per-layer notes
- Vetro per-layer sizes
- Vetro per-layer opacity
- Vetro SL settings
- Ticket polygon color/opacity
- Map opacity
- Selected ticket
- Map view

### Dashboard Access

- Dashboard username/password access is enabled on the live cloud server when the ignored runtime auth file exists.
- Auth users are loaded from `data/dashboard_auth.json`, outside Git.
- The session cookie omits `Secure` on plain HTTP so login works at `http://5.78.214.184:8765/`, while still using `HttpOnly` and `SameSite=Lax`.
- Existing saved views are preserved by falling back from `administrator` to `users.default` until the admin user saves its own state.

### Home Assistant

Current Home Assistant endpoint:

- `http://192.168.50.183:8123`

Home Assistant live config path discovered on Kali:

- `/home/kali/ha-live`

Relevant HA helper scripts:

- `/home/kali/ha-live/ha_ws_call.py`
- `/home/kali/ha-live/save_lovelace_dashboard.py`
- `/home/kali/ha-live/check_lovelace_dashboard.py`

The live Lovelace dashboard `dashboard-home` was updated through the HA websocket save helper.

Current One Call panel entry:

```json
{
  "title": "Fiber Locator",
  "path": "one-call",
  "icon": "mdi:map",
  "type": "panel",
  "theme": "Hemma",
  "cards": [
    {
      "type": "iframe",
      "url": "http://192.168.50.231:8765/",
      "aspect_ratio": "220%"
    }
  ],
  "show_icon_and_title": true
}
```

If Home Assistant still does not show the iframe, first open `http://192.168.50.231:8765/` directly in the same browser and confirm the dashboard loads there.

If HA is reached through Tailscale, keep the tailnet path aligned with the HTTP dashboard URL and avoid stale HTTPS iframe entries.

## Operational Commands

Validate locally:

```bash
cd /mnt/c/Users/reedc/onecall-locator-dashboard
python3 -m py_compile server.py
node --check static/app.js
```

Deploy selected changed files to Kali:

```bash
cd /mnt/c/Users/reedc/onecall-locator-dashboard
tar czf /tmp/onecall-dashboard-update.tgz server.py index.html static/app.js static/styles.css PROJECT_HANDOFF_2026-05-13.md
scp /tmp/onecall-dashboard-update.tgz kali@192.168.50.231:/tmp/onecall-dashboard-update.tgz
ssh kali@192.168.50.231
cd /opt/onecall-locator-dashboard
sudo tar xzf /tmp/onecall-dashboard-update.tgz -C /opt/onecall-locator-dashboard
sudo python3 -m py_compile server.py
sudo node --check static/app.js
sudo systemctl restart onecall-dashboard
systemctl is-active onecall-dashboard
```

Check dashboard:

```bash
curl -s -o /tmp/onecall.html -w 'http=%{http_code}\n' http://127.0.0.1:8765/
curl -s http://127.0.0.1:8765/api/state
```

Check Home Assistant live dashboard:

```bash
python3 /home/kali/ha-live/check_lovelace_dashboard.py dashboard-home
python3 /home/kali/ha-live/ha_ws_call.py '{"type":"lovelace/config","url_path":"dashboard-home"}'
```

## GitHub

Repository requested by user:

```text
https://github.com/reedisthebomb/fiber.locator.dashboard.git
```

The Windows source folder did not have `.git` metadata when this handoff was written. If pushing from this folder, initialize or clone the repo first, then commit only intended project files. Avoid committing generated caches, secrets, cookies, auth files, or ticket data unless the user explicitly wants that data in GitHub.

Recommended `.gitignore` coverage:

```gitignore
__pycache__/
*.pyc
data/
*.bak-*
*.tmp
```

## Do Not Commit Secrets

Do not commit:

- Kali password
- Dashboard auth files
- GeoCall cookies or cURL headers
- VETRO API tokens
- Outlook credentials
- Home Assistant auth files
- TLS private keys

## Next Useful Checks

- Confirm Home Assistant iframe renders after browser accepts the dashboard certificate.
- Confirm `Save current` on Locator Default View stores exactly the user-selected Vetro filters.
- Confirm handhole layer can be set to `Rectangle`.
- Confirm service location layer can be set to `House`.
- Confirm the refresh button pulls Outlook tickets and GeoCall polygons with the 4-day lookback.
