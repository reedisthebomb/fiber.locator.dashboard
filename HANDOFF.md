# Fiber Locator Dashboard Handoff

Updated: 2026-06-01

## Current Stop Point - 2026-06-01 19:20 CDT

- Follow-up native app TCW dashboard mode - 2026-06-02:
  - Added a persistent native Android dashboard mode under the `...` menu: `One-Calls Done For TCW` / `Main Dashboard`.
  - Main native ticket list and map now exclude TCW/DMI/Computer Works/Dirt Moves work.
  - Native `One-Calls Done For TCW` mode lists only TCW/DMI/Computer Works/Dirt Moves tickets that are not past their due day, and the map uses the same selected-mode ticket set.
  - TCW ticket detail is read-only in that mode and does not show the `Complete ticket` action.
  - Release bumped to `versionCode 12` / `versionName 0.1.11`.
  - APK SHA256: `0522c8eff1054a50ebc36177c9615db1044f3a98500b9758f2c4f8bd8728bd5e`
  - AAB SHA256: `e5d92ca2fd4a47d8dea928b84e092a4335a7601ef55ace45102f6534f741582d`
  - Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`, `/home/linux/Android/Sdk/build-tools/36.0.0/aapt dump badging`, compiled manifest check for `FiberLocatorCarAppService` with POI/IOT categories, and `/home/linux/Android/Sdk/build-tools/36.0.0/apksigner verify --verbose`.

- Follow-up native app map location / Android Auto crash fix - 2026-06-01 21:50 CDT:
  - Follow-up Android Auto crash root-cause fix - 2026-06-01 22:58 CDT:
    - Follow-up Android Auto current-car crash fix - 2026-06-01 23:10 CDT:
      - Follow-up Android Auto info/navigation/map pin update - 2026-06-01 23:25 CDT:
        - Follow-up Android Auto marker label crash fix - 2026-06-01 23:35 CDT:
          - Reed reported 0.1.9 was updated, connected, and crashing in the car.
          - Phone was still connected at `192.168.50.184:39649`; confirmed Play-installed `versionCode 10` / `versionName 0.1.9`.
          - Current 0.1.9 Android Auto crash was `IllegalArgumentException: Marker label cannot contain more than 3 characters` from `PlaceMarker.Builder.setLabel` in `TicketListScreen.ticketMapTemplate()`.
          - Changed Auto map marker labels to strict 3-character-or-less codes: `EMG`, `TCW`, `REC`, `REN`, `DUE`, `NXT`, `UP`, or `TKT`. Longer ticket details remain in list row text.
          - Release bumped to `versionCode 11` / `versionName 0.1.10`.
          - APK SHA256: `85d29bd9fcdb6cbcbe2f736651ef777f7c51a849c11bf3a5042b7f0e793bd5c2`
          - AAB SHA256: `1b0a30dfdcdc066696e1eedc5be8a371a38cc3d6f05ee7edd0f46dc34b6fdc46`
          - Verification passed: Gradle `:app:assembleRelease :app:bundleRelease`, `aapt dump badging`, compiled manifest check for `FiberLocatorCarAppService` with POI/IOT categories, `apksigner verify --verbose`, and source grep confirming `ForegroundCarColorSpan`, `SpannableString`, `ListTemplate.addAction(refresh)`, and `setCurrentLocationEnabled` are absent.
        - Reed reported 0.1.8 opens and shows tickets, but tickets have too little information, no useful color coding, and the only action is Navigate, which says navigation unavailable.
        - Changed Android Auto navigation URI from `google.navigation:` to the Android CarContext-supported `geo:` format for both coordinate and address destinations.
        - Reintroduced `PlaceListMapTemplate` without the previously crashing current-location toggle or custom refresh action. It now shows mapped tickets as Android Auto map pins when coordinates are available.
        - Added safe marker color coding through `PlaceMarker` colors and plain-text priority/due badges in row titles/status; no `ForegroundCarColorSpan` text spans are used.
        - Enriched Auto ticket rows/details with location, due, work/type, contractor/done-for, and contact information while keeping row counts conservative for Auto host limits.
        - Release bumped to `versionCode 10` / `versionName 0.1.9`.
        - APK SHA256: `37651c5ef231a4066df0d4f3ba6a14bb107140300eebb31a590a2b6b086d3c03`
        - AAB SHA256: `30f41e7dd6e149e0a0e8168e6c42f5522ca7a628ddb27d9f6adb064936338d81`
        - Verification passed: Gradle `:app:assembleRelease :app:bundleRelease`, `aapt dump badging`, compiled manifest check for `FiberLocatorCarAppService` with POI/IOT categories, `apksigner verify --verbose`, and source grep confirming `ForegroundCarColorSpan`, `SpannableString`, `ListTemplate.addAction(refresh)`, `setCurrentLocationEnabled`, and `setTimeout(startLocation` are absent.
      - Reconnected to Reed's phone at `192.168.50.184:39649` while Android Auto was failing in the car.
      - Confirmed the phone had Play-installed `versionCode 8` / `versionName 0.1.7`.
      - Current 0.1.7 Android Auto crash was `IllegalArgumentException: CarSpan type is not allowed: ForegroundCarColorSpan` from `TicketListScreen.onGetTemplate()` / `Row.Builder.setTitle`.
      - Removed `ForegroundCarColorSpan` / `SpannableString` usage from Android Auto ticket title and status text. Auto ticket rows now use plain text labels like `Emergency`, `Recall`, `Due now`, etc.
      - Release bumped to `versionCode 9` / `versionName 0.1.8`.
      - APK SHA256: `75b99a67a55721e1c39bd86e52cde8648a80648542182b37bf39a963008256c0`
      - AAB SHA256: `f18601e0e44da1c8a1d3f06776a4dc567f4a95e232f17dd69584a1473922101f`
      - Verification passed: Gradle `:app:assembleRelease :app:bundleRelease`, `aapt dump badging`, compiled manifest check for `FiberLocatorCarAppService` with POI/IOT categories, `apksigner verify --verbose`, and source grep confirming `ForegroundCarColorSpan`, `SpannableString`, `ListTemplate.addAction(refresh)`, `PlaceListMapTemplate`, `setCurrentLocationEnabled`, and `setTimeout(startLocation` are absent.
    - Connected Reed's Samsung `SM_S906U` over wireless ADB at `192.168.50.173:45943`.
    - Confirmed Play-installed Fiber Locator was `versionCode 7` / `versionName 0.1.6`, installed by `com.android.vending`, and the Android Auto `FiberLocatorCarAppService` was visible to package-manager service queries.
    - Pulled phone crash records from Dropbox. Actual Android Auto crash was `IllegalArgumentException: Action list exceeded max number of 0 actions with custom titles` from `TicketListScreen.onGetTemplate()` at the `ListTemplate.addAction(refresh)` line.
    - Removed the custom `Refresh` action from the Android Auto `ListTemplate`; the ticket list now uses only the allowed app-icon header action.
    - Release bumped to `versionCode 8` / `versionName 0.1.7`.
    - APK SHA256: `1566355ea022c50006590e82c5ecd2660d7b78a6a32032f0e503cdfacc186e5a`
    - AAB SHA256: `e24b0abc7ddc290a3bebab56a25420c729e51c208e5b4ce86ef50acbf0e5e7eb`
    - Verification passed: Gradle `:app:assembleRelease :app:bundleRelease`, `aapt dump badging`, compiled manifest check for `FiberLocatorCarAppService` with POI/IOT categories, `apksigner verify --verbose`, and source grep confirming `ListTemplate.addAction(refresh)`, `PlaceListMapTemplate`, `setCurrentLocationEnabled`, and `setTimeout(startLocation` are absent.
    - Local install over Play copy was blocked by Android signature mismatch, which is expected for a Google Play distributed app signed by Play App Signing. To test 0.1.7 locally before Play, uninstall the Play copy first or upload the AAB to Internal testing.
  - Native phone map now opens with location tracking off. The map location button says `Location off` until Reed turns it on manually, and leaving the WebView clears the watch.
  - Selecting `See on dashboard map` from a ticket no longer auto-starts GPS; location only starts from the map toggle.
  - Android Auto `Live tickets` was changed from `PlaceListMapTemplate` with `setCurrentLocationEnabled(true)` to a plain stable `ListTemplate` with ticket rows, ticket detail, refresh, and navigation. This removes the most likely Auto launch crash path while keeping the Auto workflow usable.
  - Android Auto service icon now uses `@drawable/fiber_locator_logo`, matching the main app logo instead of the launcher mipmap fallback.
  - Release bumped to `versionCode 7` / `versionName 0.1.6`.
  - APK SHA256: `06b56489fc8bb7093973bc5c30e59419eca5c08d128c38a92539f43451d15e2c`
  - AAB SHA256: `6c00745a035675ede059a0fe4b6c9b186bb397f9b6c190b89e21e5b9d2c6d53e`
  - Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`, `/home/linux/Android/Sdk/build-tools/36.0.0/aapt dump badging`, compiled manifest check for `FiberLocatorCarAppService` with POI/IOT categories, `/home/linux/Android/Sdk/build-tools/36.0.0/apksigner verify --verbose`, source grep confirming `PlaceListMapTemplate`, `setCurrentLocationEnabled`, and `setTimeout(startLocation` are absent.
  - ADB had no connected devices, so real Android Auto head-unit launch testing still needs the Play-installed 0.1.6 build on Reed's phone/car.

- Follow-up Admin Console log export - 2026-06-01 20:00 CDT:
  - Added `Download Excel` to the App and Dashboard Log page in Admin Console for admin/site_owner activity-log users.
  - The Excel download uses the same complete `/api/audit?limit=50000` log data as the CSV/JSON buttons and saves as `.xls`.
  - Deployed `index.html` and `static/app.js` to the cloud dashboard, restarted `onecall-dashboard`, and verified the deployed files contain the Excel button/handler.
  - Verification passed: `node --check static/app.js`, `python3 -m py_compile server.py tools/*.py`, live `onecall-dashboard` active, and unauthenticated `/api/state` still returns `401 Login required`.

- Follow-up employee dashboard/native menu cleanup - 2026-06-01 19:45 CDT:
  - Employee-mode web dashboard now hides Admin Console from the menu and removes VETRO refresh/update controls plus VETRO opacity from the left Vetro drawer. Ticket opacity remains available under Tickets.
  - Renamed the TCW dashboard menu/mode label to `One-Calls Done For TCW`.
  - Added a `Satellite` toggle on the web dashboard map for every profile; it switches to Mapbox Satellite Streets and back to the prior street map.
  - Removed the browser mobile Dig Tickets tab and removed Dig Tickets from the native Android app overflow menu.
  - Native ticket details no longer show the extra `View map of this ticket` button; the remaining map button is renamed `See on dashboard map`.
  - Release bumped to `versionCode 6` / `versionName 0.1.5`.
  - APK SHA256: `695c942b2367479c91ed1e7360efd9580a25287cb0fd3260ad4db8442a888c6b`
  - AAB SHA256: `39dff6c7541d443cdbf0f9dd7140a7ccb4ebf701daf766645fbda0c9011766e9`
  - Verification passed: `node --check static/app.js`, `python3 -m py_compile server.py tools/*.py`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`, `aapt dump badging`, `apksigner verify`, live `onecall-dashboard` active, live unauthenticated `/api/state` returns `401`, and cloud APK checksum matches local.

- Follow-up native app location toggle - 2026-06-01 19:30 CDT:
  - Map location now remains auto-started when opening the native map, but the map `Locate` button toggles location tracking off and back on.
  - Tapping a ticket polygon or marker stops location tracking before opening the ticket, so the ticket can be viewed without the map continuing to follow location.
  - Release bumped to `versionCode 5` / `versionName 0.1.4`.
  - APK SHA256: `e7ff46a0f0ddd89ad974521cc0a9f2be99c7696ca02ddccaa16c775397e4af20`
  - AAB SHA256: `f5b503c8d38fbb4deff742b39ded8171eefa1c87e70ee88b9642117a3a1d3951`
  - Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`, `aapt dump badging`, and `apksigner verify`.

- Completed Reed's browser dashboard/native Android edit batch and deployed runtime web/server files to `https://fiber-locator.5-78-214-184.sslip.io/`; `onecall-dashboard` restarted active.
- Web/PWA cleanup: removed visible browser web-app install/download/open-mobile-app controls, stopped service-worker registration, made `/mobile` redirect to `/`, and left "mobile app" reserved for the native Google Play app.
- Dashboard changes: reusable private GeoCall cURL cache for Admin Console ticket fetches, right-side action description before submit, Yes/No attachment prompt, emphasized left ticket-date headers, web live-location controls removed, darker due-later green, more transparent polygon fills, Live Tickets filtered to currently visible tickets with no submitted actions, Excel-like sticky Dig Tickets header/first column, and `Marked By` state saved from the submitting username.
- Added `TCW Dashboard` menu mode. Normal dashboard excludes TCW/DMI/Computer Works/Dirt Moves tickets; TCW mode shows those tickets read-only through their due day, exposes ticket-page links on due day, flags due-today TCW tickets red for reporting review, and supports manual clear for those review flags. Automatic outside-locator reporting detection is limited by currently available cached GeoCall data.
- Native app changes: release bumped to `versionCode 4` / `versionName 0.1.3`; foreground map location starts when the map opens, remembered WebView geolocation grants reduce repeat prompts, the map follows/pans with location, selected tickets keep their ticket color instead of forced red, polygon fill is more transparent, due-later green is darker, Mapbox satellite-streets toggle added on the left side of the map, Update Tickets button shows updating/progress, and action label is now `Caller canceled ticket`.
- Android Auto metadata now includes both `POI` and `IOT` categories in the same app package. Local build/package checks pass, but actual launcher visibility still needs testing from the Play-installed Internal testing build on the phone/car because Android Auto has previously filtered sideloaded/local builds.
- Current artifacts:
  - APK: `android-auto/app/build/outputs/apk/release/app-release.apk`
  - AAB for Google Play: `android-auto/app/build/outputs/bundle/release/app-release.aab`
  - APK SHA256: `e601e5c190beb716b75ed9424962887aba49516b9d68aba2b4b595cec2229320`
  - AAB SHA256: `59c790dccc0e67de473905712c0458c055fc3465c2343c25845f407842edd5d0`
  - Cloud APK download checksum was verified against local build: `https://fiber-locator.5-78-214-184.sslip.io/android-auto/app/build/outputs/apk/release/app-release.apk`
- Verification passed:
  - `node --check static/app.js`
  - `python3 -m py_compile server.py tools/*.py`
  - live cloud `python3 -m py_compile server.py tools/*.py`
  - `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`
  - `/home/linux/Android/Sdk/build-tools/36.0.0/aapt dump badging android-auto/app/build/outputs/apk/release/app-release.apk`
  - `/home/linux/Android/Sdk/build-tools/36.0.0/apksigner verify --verbose --print-certs android-auto/app/build/outputs/apk/release/app-release.apk`
  - live `GET /` login redirect/page smoke with system Chrome and no console errors
  - live unauthenticated `/api/state` returns `401 Login required`
  - live `/mobile` returns `302 /`
- Google Play next step: upload `android-auto/app/build/outputs/bundle/release/app-release.aab` to Internal testing and test Android Auto from the Play-installed app.

## Current Stop Point - 2026-06-01 10:42 CDT

- Reconnect note at 2026-06-01 11:47 CDT: latest APK/AAB are built after the ticket-count fix. Upload `android-auto/app/build/outputs/bundle/release/app-release.aab` to Google Play Internal testing next. Current release is `versionCode 3`, `versionName 0.1.2`.
  - APK SHA256: `d796a4b335daba2b33e772d7e71f8176c11f4b10a9d63404d0285cd134ebf4c0`
  - AAB SHA256: `0a9b65e27331b427c231db4b88a2b963dced9d269494378d1bd07d16265a5a16`
  - Direct APK link checksum was verified against local build: `http://192.168.50.220:8766/app-release.apk`
- Follow-up fix: APK ticket list was showing too many tickets because `TicketRepository` had stopped applying saved-view `hiddenTickets`, `archivedTickets`, and checkpoint exclusions. Restored those filters and bumped Android release to `versionCode 3` / `versionName 0.1.2`; this is the next AAB to upload to Play Console.
- Reed clarified the wording rule: `mobile app` always means the native Android APK. `Dashboard` or `web page dashboard` means the browser dashboard. Do not treat future `mobile app` requests as the web `/mobile` view.
- Google Play context recorded: Reed has a Google Play developer account and the Fiber Locator app exists in Play Console for Internal testing/review. Native app changes should culminate in an AAB upload to the Internal testing track, not just a local APK rebuild.
- Android Auto is part of the same Android package/app (`com.fiberlocator.auto`) through `FiberLocatorCarAppService`; it is not a separate Play Console app. The same AAB upload updates the phone app and includes Android Auto.
- Android Auto current scope: color-coded live ticket list, ticket details, and Navigate action. Full dashboard-style map/layer/polygon rendering on the car screen needs a later custom Android for Cars map/navigation phase and stricter Play review testing.
- Added release workflow notes at `docs/GOOGLE_PLAY_RELEASE.md`.
- Latest browser dashboard changes are deployed to `https://fiber-locator.5-78-214-184.sslip.io/`; `onecall-dashboard` was restarted and verified active.
- Latest native APK/AAB were rebuilt and verified locally:
  - APK: `android-auto/app/build/outputs/apk/release/app-release.apk`
  - AAB for Google Play upload: `android-auto/app/build/outputs/bundle/release/app-release.aab`
  - APK SHA256: `3905468f5dbd3a837a6cc9562837dfbca5546ee5253870d9c4bfd61e796e93ee`
  - AAB SHA256: `88c8929614567cd41e1bec0ae7a2ffc3407987c52e45b39b87cc48e5948a9663`
- APK download links serving the current build:
  - LAN: `http://192.168.50.220:8766/app-release.apk`
  - Cloud HTTPS: `https://fiber-locator.5-78-214-184.sslip.io/android-auto/app/build/outputs/apk/release/app-release.apk`
- Google Play has not been updated yet. The next Play Console step is to upload the AAB at `android-auto/app/build/outputs/bundle/release/app-release.aab` through a new release.
- Local verification already passed after the latest changes:
  - `node --check static/app.js`
  - `python3 -m py_compile server.py tools/*.py`
  - `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`
  - `/home/linux/Android/Sdk/build-tools/36.0.0/apksigner verify --verbose android-auto/app/build/outputs/apk/release/app-release.apk`
- Worktree is still dirty with prior project changes; do not reset or discard user/project edits.

## Shared Field View, Logs, And Mobile Map - 2026-06-01

- Reed clarified that future references to `mobile app` mean the native Android APK only. `Dashboard` or `web page dashboard` means the browser dashboard.
- Follow-up: normal tickets now fall back to due-date colors instead of going uncolored when they are not recall/second-request purple. The browser dashboard and native APK parse GeoCall long-form work dates plus ISO/slash dates for due-date coloring.
- Tightened the purple ticket priority logic on the web dashboard and native Android app so purple is only for recall, second request, or 24-hour priority wording. Plain `REMARK` text no longer triggers purple styling.
- Added an employee dashboard default save button for shared-dashboard admins. As of 2026-06-02, this top dashboard button only saves the browser employee dashboard state; native app VETRO styling is saved from the `App VETRO Style` editor.
- Removed the Admin Console `Publish current dashboard to mobile app` card and added an `App and Dashboard Log` button/page with CSV and JSON downloads.
- Live tickets now keep delayed-locate tickets visible while hiding tickets with submitted actions that remove them from the dashboard.
- Removed the native Android fullscreen map opacity slider and added a tap-to-measure tool.

## Admin Console And Basemap Cleanup - 2026-06-01

- Added an admin-only console entry in the website menu for `administrator` and `site_owner`. Employees are blocked in the UI and server-side APIs.
- Moved shared/mobile configuration and employee invite/account-request visibility under the Admin Console.
- Added an Admin Console tool to paste one or more One Call ticket numbers plus a fresh Arkansas One Call GeoCall Copy-as-cURL request. The server runs the existing GeoCall detail fetcher for those explicit tickets, loads printable pages/polygons into the dashboard cache, deletes the pasted cURL file afterward, and returns fetched/missing ticket lists.
- Removed Google basemap options from the dashboard basemap list and web basemap resolver. The native Android map already used non-Google basemap styles; Google Maps ticket navigation links were left unchanged because they are not basemap options.
- Deployed `server.py`, `index.html`, `static/app.js`, `static/styles.css`, and `static/service-worker.js` to `https://fiber-locator.5-78-214-184.sslip.io/`, restarted `onecall-dashboard`, and verified the service is active. Local checks passed with `python3 -m py_compile server.py tools/*.py`, `node --check static/app.js`, and Android `:app:assembleRelease`.

## HTTPS And Android Account/Profile Prep - 2026-06-01

- Deployed Caddy on the cloud host and issued a trusted certificate for `https://fiber-locator.5-78-214-184.sslip.io/`.
- Rebound `onecall-dashboard` to `127.0.0.1:8765`; public traffic now enters through Caddy on ports `80` and `443`, and direct public `http://5.78.214.184:8765/` is closed.
- Added HTTPS-aware secure cookies, HSTS/security headers, public account-request API, and authenticated account-profile API to `server.py`.
- Updated the Android app default dashboard URL to the HTTPS hostname.
- Added native Android account request and profile editor screens. Account creation is a request flow, not open self-registration, so an admin still controls live ticket access.
- Rebuilt release artifacts at `android-auto/app/build/outputs/apk/release/app-release.apk` and `android-auto/app/build/outputs/bundle/release/app-release.aab`.
- Follow-up fix: the Admin Console employee-login card now has a constrained viewport height, and the active employee/account lists scroll inside the card instead of pushing off-screen.

## Outlook Export And GeoCall Refresh - 2026-05-31

- Uploaded the newest DMI tablet Outlook export `/home/linux/device-imports/dmi-tablet/windows/outlook-exports/onecall-export-now.zip` to the cloud server inbox at `/opt/onecall-locator-dashboard/data/inbox`.
- The export contained 73 unique ticket text files; checksum sync raised the live inbox from 883 to 899 ticket files.
- Used Reed's fresh one-time GeoCall copied cURL request to fetch the 15 missing exported `260529-*` details, explicit ticket `260529-1101`, and the remaining delivered tickets from the 2026-05-29 DIRTMOVE audit list through `260529-1594`.
- The copied cURL/cookie was used only in temporary `/tmp` files during the fetch and was deleted afterward.
- Live verification after restart showed 1,630 unique tickets, 1,630 printable pages, 1,630 polygons, max ticket `260529-1594`, and all 48 DIRTMOVE audit tickets present with page and polygon data.

## Desktop Dashboard Drawer Default - 2026-05-30

- Changed the cloud desktop dashboard so the Vetro, Tickets, and Map layer drawers open shut by default.
- Added ticket-list scroll compaction: once the left ticket list is scrolled down, the layer drawer strip collapses out of the way so more tickets fit on the left side; scrolling back to the top restores the drawer strip.
- Deployed `index.html`, `static/app.js`, `static/styles.css`, and `static/service-worker.js` to `http://5.78.214.184:8765/`, restarted `onecall-dashboard`, and verified the service is active.
- Verification passed with `node --check static/app.js`, `python3 -m py_compile server.py tools/*.py`, local Playwright/Chrome checks for closed drawers and ticket-scroll compaction, and live file/cache-version checks for `20260530114500`.

## APK Install Access - 2026-05-29

- 2026-05-31 resume verification: rebuilt the native Android release APK successfully with `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease`. Verified `app-release.apk` is `8.5M`, package `com.fiberlocator.auto`, `versionName=0.1.0`, `targetSdkVersion=36`, and includes coarse/fine location permissions. The LAN APK server still serves the fresh file at `http://192.168.50.220:8766/app-release.apk`. No ADB device was attached; known old wireless-debugging ports refused or timed out. ADB mDNS discovery found no services, and bounded scans of `192.168.50.172`, `100.118.189.70`, and `100.83.170.79` found no open ADB port, so direct phone install is still pending a current wireless-debugging endpoint or browser install.
- 2026-05-31 live/service verification: `python3 -m py_compile server.py tools/*.py` and `node --check static/app.js` passed locally. Live `onecall-dashboard` on `5.78.214.184` is active under systemd, and unauthenticated `/api/state` and `/api/tickets` return `401` as expected.
- 2026-05-30 follow-up: added foreground location support to the native Android map. The APK now declares coarse/fine location, requests runtime permission from the map WebView, uses a secure synthetic WebView origin for the generated map when the dashboard is still HTTP, and adds an on-demand `Locate me` button with a live marker plus accuracy circle. GPS tracking starts only after tapping `Locate me` and stops when toggled off or leaving the WebView, so it does not add background polling.
- Release APK rebuilt successfully at `android-auto/app/build/outputs/apk/release/app-release.apk`; the existing APK server is serving the updated file at `http://192.168.50.220:8766/app-release.apk`. No ADB device was attached during this rebuild, so phone install is still via browser download unless wireless debugging is reconnected.
- Installed the rebuilt location-permission APK over wireless ADB to `100.118.189.70:36153`; `com.fiberlocator.auto` reports `versionName=0.1.0`, `targetSdk=36`, and `lastUpdateTime=2026-05-30 05:34:17`.
- The live cloud dashboard itself is still plain HTTP at `http://5.78.214.184:8765/`; HTTPS on the actual network connection still requires deploying a valid certificate/domain or TLS reverse proxy. The Android map workaround is enough for WebView geolocation permission, but it is not a replacement for full server TLS.
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

## 2026-06-02 VETRO App Style Editor

- The VETRO drawer now has an `App VETRO Style` editor for admin/site_owner use.
- Clicking a VETRO feature on the map selects that feature's layer in the editor and opens the drawer.
- The editor updates the existing VETRO layer color, style, size, and opacity overrides, then `Save to app view` publishes those same settings to the native app shared view.
- VETRO point markers can now be sized down to `4`, including customer points, handholes, network points, and flower pots.
- After saving the app view, refresh tickets in the native app so the field map picks up the changed layer sizing.

## 2026-06-02 Fiber Locator Logo Replacement

- Reed uploaded the new Fiber Locator logo to `uploads/logo/fiber-locator-new-logo.png`.
- Replaced the default web/dashboard logo, touch icons, favicon PNG, and native Android/Android Auto drawable with the uploaded logo. James-specific logo remains unchanged.
- Adjusted the dashboard and browser mobile header logo slots from wide TCW proportions to square logo proportions.
- Rebuilt native Android release as `versionCode 13` / `versionName 0.1.12`.
- Current AAB for Google Play upload: `android-auto/app/build/outputs/bundle/release/app-release.aab`.

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
