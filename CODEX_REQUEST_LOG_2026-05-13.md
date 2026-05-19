# One Call Locator Dashboard Request Log - 2026-05-13

This file is the current resumable record for the One Call Locator / TCW Fiber dashboard work.
It is meant to be read by the next Codex session on the Kali server.

## Current Known Good State

- Main app is hosted on the Kali machine at `192.168.50.231`.
- Dashboard URL: `http://192.168.50.231:8765/`
- Home Assistant endpoint: `http://192.168.50.183:8123`
- Service name: `onecall-dashboard`
- Active deployment path: `/opt/onecall-locator-dashboard`
- The app is not supposed to be running on the Windows machine.
- The Kali service is currently active and listening on port `8765`.
- The dashboard API currently returns `86` tickets.
- Current county set from the live API: `COLUMBIA`, `UNION`.

## What Was Verified Recently

- The Windows Outlook export helper ran successfully.
- 36 fresh ticket messages were exported from Outlook.
- Those files were synced into the Kali inbox at `/opt/onecall-locator-dashboard/data/inbox`.
- `onecall-dashboard` was restarted on Kali after the sync.
- `/api/tickets` still resolves from the server after the refresh.

## Latest Data Refresh

- Fresh Outlook export ran again from Windows PowerShell.
- 18 additional ticket messages were exported on 2026-05-13.
- The Kali inbox was synced again with the new files.
- The live dashboard ticket count is now 89.
- Counties on the live server remain `COLUMBIA` and `UNION`.
- The Vitruvi source file staged for the layer folder is `vitruvi.export.from.earth.kml`.
- That file was copied into both the Windows project layer folder and the live Kali layer folder.

## Important URLs and Paths

- Dashboard: `http://192.168.50.231:8765/`
- Home Assistant: `http://192.168.50.183:8123`
- Project source on Windows: `/mnt/c/Users/reedc/onecall-locator-dashboard`
- Project on Kali: `/opt/onecall-locator-dashboard`
- Server inbox: `/opt/onecall-locator-dashboard/data/inbox`
- Dashboard state file: `/opt/onecall-locator-dashboard/data/dashboard_state.json`

## User Requests Made During This Session

The user asked for the following, in order or near-order:

- Read all memory and handoff files.
- Make the dashboard work correctly again.
- Keep the work on Kali, not Windows.
- Use Tailscale when needed, but keep the dashboard itself hosted on Kali.
- Keep the dashboard on HTTP instead of HTTPS because HTTPS was causing trouble in the browser and Home Assistant.
- Keep Home Assistant working with the dashboard.
- Make sure the live dashboard state and filters persist.
- Pull fresh tickets from Outlook and upload them into the Kali server inbox.
- Reduce the email lookback to 4 days.
- Remove extra counties and keep only `UNION` and `COLUMBIA`.
- Add archive/hide behavior for tickets.
- Improve map contrast and basemap choices.
- Add Vetro layer shape, opacity, size, note, and name controls.
- Add `SL-` layer controls.
- Persist the locator default view across reloads and devices.
- Make the dashboard usable in Home Assistant.
- Make sure the last requested changes are documented and saved for future Codex sessions.

## Files Updated During This Work

- `HANDOFF.md`
- `PROJECT_HANDOFF_2026-05-13.md`
- `README.md`

## Current Problem State

The server-side dashboard is healthy and the ticket API returns data, but the browser-side display issue the user keeps seeing still needs attention.
The likely next step for the future Codex session is to inspect the live frontend render path and confirm the browser is loading the current `app-20260513-2.js` asset from the Kali server.

## Resume Command

From the Kali machine:

```sh
cd /opt/onecall-locator-dashboard
systemctl status onecall-dashboard
curl -s http://127.0.0.1:8765/api/tickets
```

If the browser still shows the empty/problem state, inspect:

- `index.html`
- `static/app-20260513-2.js`
- the `loadTickets()` path in `static/app.js`

## Notes For Future Codex

- Do not move the service back to Windows.
- Do not reintroduce HTTPS unless the user asks again.
- Do not store cookies, tokens, or passwords in files.
- Keep the handoff concise but explicit so future sessions can recover the working state fast.
