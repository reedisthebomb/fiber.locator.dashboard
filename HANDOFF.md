# Fiber Locator Dashboard Handoff

Updated: 2026-05-30

## Desktop Dashboard Drawer Default - 2026-05-30

- Changed the cloud desktop dashboard so the Vetro, Tickets, and Map layer drawers open shut by default.
- Added ticket-list scroll compaction: once the left ticket list is scrolled down, the layer drawer strip collapses out of the way so more tickets fit on the left side; scrolling back to the top restores the drawer strip.
- Deployed `index.html`, `static/app.js`, `static/styles.css`, and `static/service-worker.js` to `http://5.78.214.184:8765/`, restarted `onecall-dashboard`, and verified the service is active.
- Verification passed with `node --check static/app.js`, `python3 -m py_compile server.py tools/*.py`, local Playwright/Chrome checks for closed drawers and ticket-scroll compaction, and live file/cache-version checks for `20260530114500`.

## APK Install Access - 2026-05-29

- Fixed `/home/linux/codex-home/codex-project` so `cxfiber` switches tmux clients when run from inside an existing tmux session instead of failing with `sessions should be nested with care, unset $TMUX to force`.
- Started a temporary APK download server in tmux session `fiber-apk-server` from `android-auto/app/build/outputs/apk/release` on port `8766`.
- Phone download URL while on the home Wi-Fi/LAN: `http://192.168.50.220:8766/app-release.apk`
- Added live employee auth user `jrclark` with display name `jrclark` for the online dashboard and native Android app. Runtime auth was updated on the cloud server and mirrored locally; no password hash or credential is stored in this handoff.
- ADB wireless install is still blocked until the Android phone is reachable again; old Samsung IP `192.168.50.173` did not answer ping or ADB connect from this host.
- Reworked the native phone app into a login-first field workflow: dashboard login screen, two-section Tickets/Map app shell, due-sorted live ticket list, full ticket detail page without inline action controls, full-page polygon map, and separate Complete Ticket form for actions, locator note, and photo/video uploads through `/api/attachments`.
- Rebuilt release APK successfully after the mobile-app changes. The APK download URL above now serves the updated build. ADB reinstall did not complete because Samsung `100.83.170.79:39165` was offline; do not install to the connected `Z9X` device at `192.168.50.198:5555`.
- Fixed the native app/Android Auto navigation link generation. Ticket navigation now uses Google Maps driving directions URLs in the phone app and `google.navigation:` URIs for Android Auto instead of the previous brittle `geo:` link. Release APK rebuilt successfully and the APK download URL above serves the updated build. Samsung was not connected over ADB; only `Z9X` was connected, so no direct install was attempted.
- Reworked the native Android data flow to use the logged-in profile's effective server state instead of forcing the published employee/mobile state over every login. Live Tickets now mirrors the dashboard's active Union/Columbia scope, selected county filters, search, hidden/archived/protected tickets, and only tickets with no submitted action. Added login `Remember me`; when unchecked the app keeps the session only in memory. Moved Tickets/Map toggles to the top and added VETRO/Vitruvi layer fetch/render support on the map based on the logged-in state. Rebuilt and installed to Samsung `SM_S908U` at `100.83.170.79:41613`. Visual QA was blocked because the phone was on the lock screen.
- Updated the native ticket list to mirror dashboard/mobile card wording and priority coloring: ticket number with status pill, county and due date, work type/message type, work description, address, excavator/caller, and color-coded borders/backgrounds for TCW/DMI, emergency, remark/recall, renewal, due now, next due, and upcoming. Rebuilt and installed successfully to Samsung `SM_S908U` at `100.83.170.79:41613`.
- Updated the native app to use a saved server view named `app view` (also accepts `mobile app view` / `mobile view`) as the authoritative mobile configuration from `/api/state` view presets. Ticket actions/descriptions still overlay from the signed-in effective state so mobile submissions sync back to the server. Added a Refresh button on the first Tickets view to reload tickets, saved view state, and map/layer configuration. Android map rendering now honors saved app-view VETRO/Vitruvi layer selections plus layer colors, opacities, line thicknesses, dashed/dotted line styles, and point marker shapes. Rebuilt and installed successfully to Samsung `SM_S908U` at `100.83.170.79:41613`.
- Updated the native app login/main styling: login now only asks for username/password and always uses the built-in cloud dashboard URL; added `Remember me`; added packaged server logos with James-specific logo selection when the username contains James/Jim and the standard locating logo for all other users; set the Android launcher icon to the standard Fiber Locator logo; converted login and native dashboard surfaces to dark theme. Rebuilt and installed successfully to Samsung `SM_S908U` at `100.83.170.79:41613`.
- Patched native Android usability issues: login logo is larger, ticket detail/completion/map screen state is saved across activity recreation so scrolling a detail page should not dump back to the ticket list, ticket detail and completion forms have extra bottom clearance above Android system navigation, the top Tickets/Map row now includes a `...` overflow menu, overflow menu opens Dig Tickets and Profile through authenticated dashboard WebViews plus Refresh/Log out, and the full-page map has a left-side vertical VETRO opacity slider. Release APK rebuilt successfully at `android-auto/app/build/outputs/apk/release/app-release.apk`; ADB install was not possible because no devices were connected and `100.83.170.79:41613` refused connection.
- Fixed the native Android ticket-count mismatch where James's phone showed about 90 live tickets while the dashboard showed 10. Root cause: the APK used `app view` for map/layer filters and only overlaid shared ticket actions, but it did not overlay the live server hidden/archived/ticket-list checkpoint state. `TicketRepository.mergeState()` now overlays `hiddenTickets`, `archivedTickets`, `ticketListCheckpoint`, and `showHiddenTickets` from the effective server state while still using `app view` for layer styling. Also updated desktop `savedViewStatePayload()` so future saved views include ticket visibility/checkpoint workflow fields. `static/app.js` was deployed to the cloud and `onecall-dashboard` restarted active. Release APK rebuilt successfully, but reinstall is pending because Samsung `100.83.170.79:35957` stopped accepting ADB connections and no open ADB port was reachable.

## Outlook Export And GeoCall Refresh - 2026-05-29

- Uploaded the newest `/home/linux/device-imports/dmi-tablet/windows/outlook-exports/onecall-export-now.zip` to the cloud server inbox at `/opt/onecall-locator-dashboard/data/inbox`.
- The export contained 106 ticket text files; checksum sync added 20 ticket files and updated 3 existing files, raising the live inbox to 883 unique ticket files with max ZIP ticket `260528-1963`.
- Used a fresh one-time GeoCall copied cURL request from Reed to fetch 20 missing live ticket details plus explicit ticket `260529-0724`.
- The copied cURL/cookie was stored only in temporary `/tmp` files during the fetch and was deleted afterward.
- Live verification after restart showed 1,583 tickets, 1,583 detail records, 1,583 printable pages, 1,583 polygons, 0 duplicate ticket numbers, max ticket `260529-0724`, and ticket `260529-0724` loads as a Union ticket with page and polygon data.

## Native Android Phone App - 2026-05-29

- Expanded `android-auto/app` from Android Auto setup-only into a native phone app while keeping the Android Auto `CarAppService` in the same package.
- The phone app now has native `Tickets`, `Live Map`, and `Settings` tabs.
- `Tickets` loads `/api/state` and `/api/tickets`, applies the published `employee_dashboard` mobile state where enabled, overlays shared `ticketActions`, respects hidden tickets/search, hides tickets whose submitted action removes them from the dashboard, and displays open tickets in a mobile-native card list.
- Ticket detail includes the same submitted action set as the live dashboard: Located, Locate delayed, Clear, Ticket canceled, In conflict, Cannot locate, Partially located, and Excavation started.
- Saving ticket actions from Android posts timestamped `ticketActions` / `ticketActionUpdatedAt` back to `/api/state`, using the same server merge path the web dashboard uses, so dashboard and Android changes reconcile by latest timestamp. The native ticket list also refreshes every 30 seconds while foregrounded so web-dashboard action changes flow back into Android.
- `Live Map` opens the authenticated cloud `/mobile` dashboard in an in-app WebView so the saved mobile view, Mapbox/VETRO/map layers, and cloud-rendered field controls match the live dashboard exactly.
- `Settings` saves dashboard URL, username/password, and optional auth cookie, then refreshes the dashboard session through `/login`.
- Verified local builds:
  - Debug APK: `android-auto/app/build/outputs/apk/debug/app-debug.apk`
  - Release APK: `android-auto/app/build/outputs/apk/release/app-release.apk`
  - Release AAB: `android-auto/app/build/outputs/bundle/release/app-release.aab`
- Wireless ADB install is pending because Samsung `192.168.50.173` was not reachable from this host during the final install attempt (`adb devices` empty, ping failed, no known prior wireless-debug ports open). Re-enable Wireless debugging on each phone, pair/connect, then install the debug or release APK with `adb install -r`.

## Android Auto Prototype And Mapbox Basemaps - 2026-05-29

- Added `android-auto/`, a native Android companion app scaffold for Android Auto using the Android for Cars App Library as a POI/template app.
- The current prototype has a phone setup screen for the dashboard URL and credentials, loads `/api/tickets`, shows a `Live tickets` list in Android Auto, opens ticket details, and sends selected tickets to navigation with `CarContext.ACTION_NAVIGATE`.
- Built the debug APK successfully at `android-auto/app/build/outputs/apk/debug/app-debug.apk` with `gradle assembleDebug`.
- Installed the Android build toolchain on this Dell host: OpenJDK 17, Android command-line tools under `~/Android/Sdk`, and Gradle 8.10.2 under `~/.local/gradle/`.
- No Android phone was connected over `adb` during the build, so the APK has not yet been installed on Reed's phone or tested on Ford Sync 4.
- Added the existing Vetro-captured Mapbox public token to the live cloud server's private `/opt/onecall-locator-dashboard/.env` as `MAPBOX_ACCESS_TOKEN`, restarted `onecall-dashboard`, and verified the service is active. Do not commit or print the token.
- Follow-up install: paired Wireless debugging to Reed's Samsung `SM_S906U` at `192.168.50.173`, installed the debug APK, and confirmed `com.fiberlocator.auto` is present.
- Follow-up Android Auto visibility fix: added `androidx.car.app.MAP_TEMPLATES` and `androidx.car.app.ACCESS_SURFACE`, moved the list screen to `PlaceListMapTemplate` for mapped tickets, added explicit service label/icon metadata, and installed with installer package `com.android.vending`.
- Follow-up compatibility attempt: declared both `androidx.car.app.category.POI` and `androidx.car.app.category.IOT`; Android package manager now finds Fiber Locator in both POI and IOT `CarAppService` queries.
- Follow-up media visibility test: added `android-auto/media-test/`, a minimal Android Auto media app with `MediaBrowserService`; Android package manager finds it next to Spotify/YouTube media services, but Android Auto still does not show it in Customize Launcher.
- Follow-up release build: created ignored local upload signing files under `android-auto/local.properties` and `android-auto/fiber-locator-upload.jks`, then built release artifacts at `android-auto/app/build/outputs/bundle/release/app-release.aab` and `android-auto/app/build/outputs/apk/release/app-release.apk`. The release APK was installed cleanly on the Samsung, is not debuggable, reports installer `com.android.vending`, and still does not appear in Customize Launcher.
- Follow-up DHU setup: installed Android Auto Desktop Head Unit (`extras;google;auto`) plus `libc++1` and `xvfb`. DHU launches and connects to forwarded `tcp:5277`, but the phone disconnects immediately unless Android Auto's phone-side `Start head unit server` is active.
- Checked for local Play Console upload tooling/credentials; none are configured on this Dell host (`fastlane`, Play service-account JSON, and Google Play publishing config were not present).
- Remaining blocker: Android Auto's `Customize launcher` UI on the Samsung still does not list Fiber Locator even though package-manager discovery works for POI/IOT and media-test services. Current evidence points to Android Auto/Gearhead filtering locally installed packages before they reach the launcher UI; the next meaningful step is Play Console Internal Testing/Internal App Sharing with `app-release.aab` from a signed-in Play Console account.

## Latest Live Update - 2026-05-28 Live Tickets Page

- Added a `Live tickets` page under the dashboard options menu for all profiles.
- The page shows dashboard-visible tickets that have no submitted ticket action yet, sorted from soonest due to furthest away.
- Selecting a live ticket opens a readable detail panel with ticket info, locate links, notes, raw text, attachments, and the existing submitted-action controls.
- Submitting an action from the Live tickets page removes that ticket from the live list through the normal shared `ticketActions` workflow.
- Deployed `index.html`, `static/app.js`, `static/styles.css`, and `static/service-worker.js` to `http://5.78.214.184:8765/`, restarted `onecall-dashboard`, and verified the service is active. Unauthenticated browser checks reach the login page as expected.

## Vitruvi Google Earth Export - 2026-05-28

- Added `tools/export_vitruvi_google_earth.py` to export the owner Vitruvi GeoJSON layer into Google Earth KML/KMZ while preserving dashboard-style layer colors, opacity, width/size, aliases, notes, and closest available point icons.
- Generated local files at `Google Earth/Vitruvi Layers.kml` and `Google Earth/Vitruvi Layers.kmz`.
- Export verification: `20,725` Vitruvi placemarks, `16` layer folders, and `16` KML styles from `data/layers/vitruvi_site_owner.geojson`.
- Deployed the exporter to the cloud server and regenerated from live saved dashboard state at `Google Earth/Vitruvi Layers live-regenerated.kml` and `Google Earth/Vitruvi Layers live-regenerated.kmz`; this live-state export contains `6,925` currently selected Vitruvi features.
- Removed the Vitruvi drawer from the dashboard page and stopped the app from auto-loading/rendering Vitruvi for `site_owner`, so Vitruvi no longer appears on the Fiber Locator map surface.
- Deployed `index.html`, `static/app.js`, `tools/export_vitruvi_google_earth.py`, and the Google Earth export folder to `http://5.78.214.184:8765/`, restarted `onecall-dashboard`, and verified the service is active. Unauthenticated live checks redirect to `/login` as expected.
- Verification passed with `python3 -m py_compile server.py tools/*.py`, `node --check static/app.js`, live `systemctl is-active onecall-dashboard`, and live file checks confirming `vitruviDrawer` is absent and the new app cache key is present.

## Map Measuring Tool - 2026-05-28

- Added a shared point-to-point measuring tool to the desktop dashboard map and mobile field map for all profiles, including employee mode.
- Desktop map now has `Measure`, `Clear`, and distance status controls under the map search bar; mobile field map has matching controls in the map toolbar.
- Clicking two map points draws a dashed measurement line, numbered point markers, a segment distance label, and a total distance readout; `Clear` removes the measurement while leaving the tool ready for another measurement.
- Follow-up fix: while Measure is active, ticket polygons stay faintly visible but no longer select/open tickets; clicking on a polygon adds a measurement point instead.
- Follow-up unit change: measuring now stays in feet at every distance by default; desktop and mobile maps include a Feet/Miles selector, and miles are shown only when `Miles` is selected.
- Local verification passed with `node --check static/app.js`, `python3 -m py_compile server.py tools/*.py`, and Playwright/Chrome interaction checks on desktop and mobile viewports.

## James-Only Logo - 2026-05-28

- Added Reed's uploaded logo image from the DMI tablet imports as `static/james-fiber-locator-logo.png`.
- When the logged-in username is `james`, the desktop header logo, mobile header logo, and profile avatar switch to the uploaded James logo; other profiles keep the normal TCW/logo behavior.
- Added a `Log out` button to the profile editor opened from the profile circle; it sends the user through the existing `/logout` route and returns them to `/login`.
- Deployed `index.html`, `static/app.js`, `static/styles.css`, and `static/james-fiber-locator-logo.png` to `http://5.78.214.184:8765/`, restarted `onecall-dashboard`, and verified the service is active and the live image URL returns `200 OK`.

## VETRO Capture Import Fix - 2026-05-28

- Fixed the VETRO capture refresh hang that left the UI at `88%`.
- Root cause: the dashboard launched `tools/import_vetro_tiles_from_capture.py` with stdout/stderr pipes but did not drain them while the importer was running. The importer printed many tile lines, filled the pipe, and blocked after writing layer files.
- Server fix: VETRO refresh jobs now spool stdout/stderr to ignored files under `data/private/vetro_refresh_logs/` and tail those files after the child process exits.
- Importer fix: duplicate VETRO tile URLs now prefer the capture entry with embedded body, authorization, or cookie headers instead of keeping the first unauthenticated duplicate.
- Imported the newest usable saved capture, `data/private/vetro_captures/vetro_capture_20260528T112847Z.txt`, into `data/layers/vetro_geojson_layers`.
- Result: 7 VETRO layer files, 40,599 total features, 14 failed tile requests, source manifest updated to the newest capture, and `onecall-dashboard` restarted active.

## Latest Live Update - 2026-05-25

- Restored the desktop/admin dashboard to the regular left control rail plus full right-side map layout.
- The Vetro and Tickets drawers open by default in the left rail, while the rail remains collapsible.
- Ticket selection no longer rebuilds the full ticket list; it updates the selected card, redraws map styling, opens the detail panel, and opens a Leaflet popup for the selected ticket.
- Deployed to `http://5.78.214.184:8765/` and restarted `onecall-dashboard`; unauthenticated live checks still redirect to `/login` or return `401 Login required` as expected.
- Added a `site_owner`-only Vitruvi overlay from `data/layers/vitruvi_site_owner.geojson`; `/api/vitruvi` requires login and returns data only for `site_owner`.
- The chosen Vitruvi source is the deduped 20,725-feature Google Earth combined GeoJSON also found on Kali at `/home/kali/Downloads/vitruvi_google_earth_combined.geojson`.

## Outlook Export Upload - 2026-05-26

- Uploaded `/home/linux/device-imports/dmi-tablet/windows/outlook-exports/onecall-export-now.zip` into the live server inbox at `/opt/onecall-locator-dashboard/data/inbox`.
- The export contained 630 unique ticket text files; 23 were new to the live inbox and 2 existing files were updated by checksum sync.
- Live inbox verification after upload: 630 files, 630 unique ticket IDs, max ticket `260522-1200`, no duplicate filenames.
- Authenticated live API verification after upload: `/api/tickets` returned 1,329 tickets, 1,329 unique `ticket_number` values, max ticket `260522-1200`, with no duplicate ticket numbers.

## Outlook Export And GeoCall Refresh - 2026-05-27

- Uploaded `/home/linux/device-imports/dmi-tablet/windows/outlook-exports/onecall-export-now.zip` into the live server inbox at `/opt/onecall-locator-dashboard/data/inbox`.
- The export contained 684 unique ticket text files; 54 were new to the live inbox and 2 existing files were updated by checksum sync.
- Used a fresh one-time GeoCall copied cURL request from Reed to fetch 55 ticket detail records: the 54 new export tickets plus explicit ticket `260527-1217`.
- The copied cURL/cookie was stored only in temporary `/tmp` files during the fetch and was deleted afterward.
- Live loader verification after refresh: 1,384 tickets, 1,384 unique ticket numbers, 1,361 tickets with printable pages/polygons, max ticket `260527-1217`.
- All 55 fetched ticket IDs were present after refresh with printable page and polygon data; no duplicate ticket numbers were found.

## Outlook Export And GeoCall Refresh - 2026-05-28

- Uploaded `/home/linux/device-imports/dmi-tablet/windows/outlook-exports/onecall-export-now.zip` into the live server inbox at `/opt/onecall-locator-dashboard/data/inbox`.
- The export contained 780 unique ticket text files; checksum sync added 96 ticket files to the live inbox, raising the inbox to 780 unique ticket IDs with max ZIP ticket `260527-1505`.
- Used a fresh one-time GeoCall copied cURL request from Reed to fetch 121 detail records: 118 missing live ticket details plus explicit tickets `260527-1531`, `260527-1598`, and `260527-1767`.
- The copied cURL/cookie was stored only in temporary `/tmp` files during the fetch and was deleted afterward.
- Live loader verification after refresh: 1,482 tickets, 1,482 unique ticket numbers, 1,482 printable pages, 1,482 polygons, 0 missing details, max ticket `260527-1767`.
- Verified explicit tickets `260527-1531`, `260527-1598`, and `260527-1767` all load with printable page and polygon data.
- Follow-up lookup added explicit ticket `260527-2272`; live verification after restart showed 1,483 tickets, 1,483 detail records, 0 missing details, max ticket `260527-2272`, and the ticket loads with printable page and polygon data.
- Follow-up upload at 2026-05-28 15:07 synced a new 826-ticket Outlook export from the DMI tablet; checksum sync added 46 files and updated 2 files in the live inbox, raising the inbox to 826 unique ticket IDs with max ZIP ticket `260527-2231`.
- Used a fresh one-time GeoCall copied cURL request from Reed to fetch 43 missing live ticket details plus explicit ticket `260528-1427`.
- Live verification after restart showed 1,527 tickets, 1,527 detail records, 1,527 printable pages, 1,527 polygons, 0 missing details, max ticket `260528-1427`, and ticket `260528-1427` loads with printable page and polygon data. The temporary copied cURL file was deleted afterward.
- Follow-up fix: the uploaded Outlook ZIP did not contain any `260528-*` ticket emails; it ended at `260527-2231`, and the 43 newly added email tickets were outside the active Union/Columbia county scope. Ticket `260528-1427` existed only as a GeoCall detail fallback, so a minimal inbox ticket file was generated from the cached GeoCall detail and `server.py` was updated to parse GeoCall long-form work dates. Live verification now shows `260528-1427` as an active Columbia ticket with page and polygon data.
- Follow-up upload at 2026-05-28 20:30 synced a new 862-ticket Outlook export from the DMI tablet; checksum sync added 35 files and updated 2 files in the live inbox, raising the inbox to 862 unique ticket IDs with max ZIP ticket `260528-1498`.
- Used a fresh one-time GeoCall copied cURL request from Reed to fetch 34 missing live ticket details plus explicit ticket `260528-1685`; `260528-1685` was not in the Outlook ZIP, so a minimal inbox ticket file was generated from the cached GeoCall detail.
- Live verification after restart showed 1,562 tickets, 1,562 detail records, 1,562 printable pages, 1,562 polygons, 0 missing details, max ticket `260528-1685`. Emergency ticket `260528-1498` is present as an active Union ticket with page and polygon data. The temporary copied cURL file was deleted afterward.

Latest detailed continuation file:

```text
PROJECT_HANDOFF_2026-05-13.md
```

## Purpose

This project is the Fiber Locator dashboard for Arkansas One Call locating. It turns Outlook ticket exports, GeoCall pages and polygons, Vetro fiber layers, and public map overlays into one operational map and ticket workflow.

## Project Roots

```text
/mnt/c/Users/reedc/onecall-locator-dashboard
```

Deployed cloud server:

```text
/opt/onecall-locator-dashboard
```

Current live cloud address:

```text
http://5.78.214.184:8765/
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

Home Assistant `dashboard-home` has historically used a Fiber Locator iframe pointed at the older LAN target:

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

The project is in a working state on the live cloud server. The GitHub repository is `reedisthebomb/fiber.locator.dashboard`.

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
