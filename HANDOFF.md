# Fiber Locator Dashboard Handoff

Updated: 2026-06-18

## Photo Library API And Admin Upload/Export - 2026-06-18

- Added a server-backed photo library for Timestamp Camera evidence photos on the live cloud dashboard. Admin/site-owner users can open Settings -> Photo Library or More -> Location Photos to bulk upload existing photos without needing OneDrive connected.
- Location photo uploads now store files locally under `data/location_photos/files/<photo_id>/`, preserve original watermarked images, extract EXIF GPS when present, accept fallback latitude/longitude, ticket number, location label, address/site, review status, and note metadata, and sort/group exports by ticket/location.
- Added admin/site-owner photo management endpoints: `GET/POST /api/location-photos/settings`, `GET /api/location-photos/export.csv`, `GET /api/location-photos/export.zip`, `POST /api/location-photos/manage`, plus local file serving through `/api/location-photos/file?id=...`.
- Ticket detail and mobile ticket detail now show prior photo history for photos tied to the ticket number or located inside the ticket polygon. When prior photos exist, a bottom `Photo History` button opens the Location Photos page filtered to that ticket/area.
- Existing photo upload paths were preserved: regular ticket attachments still use `/api/attachments`, locator note map-spot attachments still use `/api/locator-notes`, and restoration/in-house related restoration photos still use `/api/restoration-jobs/upload`. Restoration photos were fixed to store locally under `data/restoration_jobs/files/<job_id>/` with `/api/restoration-jobs/file?job=...&id=...`, avoiding the previous OneDrive dependency and undefined upload filename bug.
- Web upload pickers no longer force `capture="environment"`; they allow selecting existing Timestamp Camera photos/videos from gallery/files. Native Android already uses `ACTION_OPEN_DOCUMENT` for existing image/video selection.
- Google Drive research result: current implementation keeps the dashboard server as source of truth and uses ZIP/CSV export for Google Drive. Direct Google Drive sync should use the narrower `drive.file` OAuth scope later if Reed still wants automatic Drive sync, because broad Drive scopes add avoidable verification/policy friction.
- Cache bust bumped to `20260618015500` in `index.html` and `static/service-worker.js`.
- Local verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py tools/export_vetro_google_earth_layers.py`, `node --check static/app.js`, Android `:app:assembleDebug`, local `/api/location-photos` upload, file retrieval, CSV export, ZIP export with `manifest.csv`, and Playwright/Chrome desktop `1366x900` + mobile `390x844` checks showing Location Photos and Settings panel visible with no overflowing controls.
- Deployed to the cloud server `/opt/onecall-locator-dashboard` after backing up previous live files to `data/deploy_backups/20260618015512/`. Live `onecall-dashboard` restarted and is `active`; live hashes match local for `server.py`, `index.html`, `static/app.js`, `static/styles.css`, and `static/service-worker.js`. Public unauthenticated checks correctly redirect `/` to login and return `401 Login required` for `/api/location-photos/settings`.
- Follow-up: Timestamp Camera GPS coordinates are printed on the image watermark, not always stored in EXIF. Added server-side OCR for printed coordinate watermarks. New uploads now try EXIF GPS first, then printed watermark OCR, then manual map coordinates. Added repeatable backfill tool: `python3 tools/backfill_location_photo_ocr.py --data-dir data`.
- Live cloud server has `tesseract-ocr` and `python3-pil` installed for watermark OCR. Ran the backfill on `/opt/onecall-locator-dashboard/data/location_photos/photos.json`; 59 of 60 uploaded photos now have coordinates from the printed watermark. The one remaining unknown is `TimePhoto_20260616_151856.jpg`; visual inspection showed only the date stamp (`Jun 16, 2026 3:18:56 PM`) printed on the photo, with no coordinate line and no EXIF GPS.

## Native Dig Tickets Scroll And Android Auto Smooth Map/Tickets Update - 2026-06-18

- Follow-up native Android fix: the ticket list now preserves scroll position across the 30-second background ticket refresh so employees should no longer get kicked back to the top while reading the list. The Map tab now waits for the dashboard snapshot before rendering if the app just opened, preventing VETRO/layer styling from falling back to default blue before the user manually taps Refresh.
- Bumped native Android to `versionCode 49`, `versionName 0.1.48`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `40e63a55400c80ca1ff7027125ca47e9df469357f9bffaf9513e9d3bddba591a`. Release APK SHA256 `3d45231dd586b390de2b0cf7ed8c05bee34a8db850a40a86117e8b009526ee12`.
- Reed asked that previously requested Android/Android Auto changes not be lost: preserve layer `28` and `42` size boosts, near-transparent Android Auto ticket polygons, high-accuracy location filtering, Dashboard Map, and the same Google Play package.
- Native Android/WebView Dig Tickets layout now keeps the sheet constrained to the phone viewport and gives the ticket table the remaining space as the scroll surface. The table wrapper uses vertical and horizontal scrolling with touch momentum, while the top horizontal scroller stays usable. A Playwright/Chrome CSS fixture verified portrait `390x844` and landscape `844x390` both keep the sheet viewport-sized and allow vertical table scroll plus horizontal table/top-scroll movement.
- Android Auto Tickets now uses one regular `Tickets` tab. The separate TCW tab was removed, TCW/DMI tickets are included in the regular ticket list, and ticket/map colors use dashboard-style status colors with TCW/DMI kept orange.
- Android Auto `Dashboard Map` now disables follow mode and fits the selected ticket polygon/rings when available; if no polygon is present it centers the ticket coordinate. Opening the normal Map tab still starts in live-follow behavior.
- Android Auto map drawing was tuned for smoother pan/zoom: redraws are throttled, offscreen points/paths are skipped, long paths are sampled by zoom level, and VETRO drawing is capped per frame instead of attempting to draw every loaded feature during interaction.
- Bumped native Android to `versionCode 48`, `versionName 0.1.47`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `24c691d0cbcae814f42d712e1b9ec9dd484fc65c83269d680aa3a0254ace4c26`. Release APK SHA256 `0785029d7bfc630b9903d9286af8c5ac557d9436fc1051d68af35f07b27e80b0`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py tools/export_vetro_google_earth_layers.py`, `node --check static/app.js`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 48` / `versionName 0.1.47`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `MAP_TEMPLATES`, and `ACCESS_SURFACE`, plus `apksigner verify --verbose`.
- Device validation note: `adb devices -l` showed no attached devices, and `adb connect 192.168.50.173:42023` failed with `No route to host`, so no live phone/Android Auto runtime smoke test could be completed from this shell for this build.

## Android Auto Polygon Transparency Follow-Up - 2026-06-18

- Reed reported Android Auto polygons were still too dark/thick to see the streets/map beneath them.
- Android Auto ticket polygon rendering now uses a near-invisible fill alpha `2` plus a thin outline alpha `90` / `1.5px`, instead of relying on the previous filled alpha `7`. This keeps polygon boundaries visible while preventing the filled area from washing out the base map.
- Bumped native Android to `versionCode 47`, `versionName 0.1.46`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `a09a05bb55c309b3ac38cd358d87b9bd21a82e025225f205c1c7cca0b455742a`. Release APK SHA256 `d44b39be53a5c15fdf798860aafb23465f888c83cee1d3ef7206388aacf67146`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 47` / `versionName 0.1.46`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `MAP_TEMPLATES`, and `ACCESS_SURFACE`, plus `apksigner verify --verbose`.

## Android Auto Layer 28/42 Size, Polygon Transparency, And Location Accuracy - 2026-06-18

- Reed asked for Android Auto VETRO layer `28` hand holes and layer `42` network points/flower pots to be a little bigger while keeping other layer styling/colors unchanged; layer `28` remains forced square and layer `42` remains forced circle on the car map.
- Android Auto car rendering now gives layers `28` and `42` a car-map-only `+4.0` size boost. Existing car-map size handling for layers `17` and `654` remains unchanged at `+2.5`; all saved dashboard/app colors and style filters still come from the published app/mobile state.
- Ticket polygon fill on the Android Auto map was reduced again from alpha `14` to alpha `7` so the base map remains easier to see through.
- Researched Android location guidance and switched the Android Auto map from raw `LocationManager` GPS/network listeners to Google Play Services Fused Location Provider high-accuracy updates with `waitForAccurateLocation`, 1-second target updates, 500ms minimum updates, 1m minimum distance, and filtering for stale, mock, low-accuracy, or physically implausible jump fixes. This should reduce the temporary off-road/out-of-area jumps Reed saw while keeping the map in live follow mode.
- Added `com.google.android.gms:play-services-location:21.3.0` and bumped native Android to `versionCode 46`, `versionName 0.1.45`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `964c2c8d27b9e836cbb359a35544e6138f5196bebf6c389f3d898a8882db1947`. Release APK SHA256 `dc9ad520b4c1e8d7d699e7f27fc293b3ba2306d33838ffd999f790b9ebb19289`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 46` / `versionName 0.1.45`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `MAP_TEMPLATES`, and `ACCESS_SURFACE`, plus `apksigner verify --verbose`. No ADB device was connected, so no live phone/DHU visual pass was run from this shell.

## Android Auto Ticket Dashboard Map Action - 2026-06-17

- Reed asked for an Android Auto ticket-detail option to go to the ticket on the Fiber Locator dashboard map, not only `Navigate with Google Maps`.
- `TicketDetailScreen` now shows two actions: `Dashboard Map` and `Google Maps`. `Dashboard Map` pushes `CarLiveMapScreen` with the selected ticket as focus; the map centers on that ticket at close zoom and disables live-follow until the user taps `Follow` again. If the ticket has no coordinates, Android Auto shows a toast instead of opening the map.
- Bumped native Android to `versionCode 45`, `versionName 0.1.44`. Current release AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `0d50dc4a139aa99238904add4662406307a75800e3d31955c4825b14bfe46fe5`. Release APK SHA256 `3bd2839606ade4d2d7c4ca213fd609f8aa5a1d976ec2a3d5d411c0af09e13c71`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py`, `:app:assembleDebug`, `:app:assembleRelease`, `:app:bundleRelease`, `aapt dump badging` showing `versionCode 45` / `versionName 0.1.44`, `MAP_TEMPLATES`, and `ACCESS_SURFACE`, plus `apksigner verify --verbose`. Reed said the phone was no longer connected over ADB at request time, so no device/DHU visual check was run for this build.

## Android Auto VETRO Layer Size And Layer 17 Follow-Up - 2026-06-17

- Reed reported Android Auto was still missing VETRO layer 17 and asked for layers 28, 42, and 654 to be a couple points larger; if possible, layer 28 should be square and layer 42 circle.
- Android Auto VETRO loading now canonicalizes layer IDs before filtering, so values like `17`, `Layer_17`, and `layer_17` match the same selected layer. This is intended to fix layer 17 still not appearing when the API/property name includes a `Layer_` prefix.
- Android Auto car rendering now applies a car-map-only `+2.5` size boost to layers `17`, `28`, `42`, and `654`. For point features, layer `28` is forced to square and layer `42` is forced to circle. Other saved dashboard/app colors, line styles, filters, and service-location styling remain intact.
- Bumped native Android to `versionCode 44`, `versionName 0.1.43`. Current release AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `9f89ec134235725516af084ecb67d74f1d1b20704ed74da1a347d3a791b9da4b`. Release APK SHA256 `936a13719fddd117f310d9f4175a1958475b5f4cc3b098cad7d26d780e2d784f`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py`, `:app:assembleDebug`, `:app:assembleRelease`, `:app:bundleRelease`, `aapt dump badging` showing `versionCode 44` / `versionName 0.1.43`, `MAP_TEMPLATES`, and `ACCESS_SURFACE`, plus `apksigner verify --verbose`. Reed said the phone is no longer connected over ADB, so no device/DHU visual check was run for this build.

## Android Auto Layer 17 And Screenshot Pass - 2026-06-17

- Reed confirmed the Google Play-installed `versionCode 42` / `versionName 0.1.41` build was working but reported Android Auto was missing VETRO layer 17 and wanted VETRO layers darker/opaque while ticket polygons remain easy to see through.
- Captured current Play-installed phone screenshots before code changes under `/home/linux/fiber.locator.dashboard/screenshots/android-current-20260617-142257/`: `01-phone-tickets.png`, `02-phone-ticket-detail-retake.png`, `03-phone-map.png`, and `04-phone-menu-retake.png` are the best current phone-app screenshots for Google Play/GitHub. Older duplicate/missed-tap captures remain in the folder.
- Android Auto screenshot attempts: the phone is connected at `192.168.50.173:35959`, Android Auto virtual displays are visible in `dumpsys display`, and DHU can connect headlessly. Android blocks direct `screencap -d` / `screenrecord --display-id` capture of those protected virtual displays from ADB, so no usable Android Auto PNG was captured from this shell.
- Android Auto VETRO fix: removed the `loadVetroMapFeatures` 30k feature stop and removed the draw loop's old 18k feature cutoff, so layer 17 should not disappear just because earlier layers filled the feature cap. Car rendering now still uses the same published app/mobile filters, colors, sizes, line styles, point shapes, and service-location styling from the dashboard/app view, but it clamps VETRO opacity to near-opaque/darker for car readability. Ticket polygon fill remains very light.
- Bumped native Android to `versionCode 43`, `versionName 0.1.42`. Current release AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `7c8a8c55d17ac7943247d7477f3351405ecee6074b93e1831a5d8de0d505aa10`. Release APK SHA256 `da26a43d1acdf8cfcb594897f9b891a9c24a128f4566a00cf49e511df9c7a52c`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py`, `:app:assembleDebug`, `:app:assembleRelease`, `:app:bundleRelease`, `aapt dump badging` showing `versionCode 43` / `versionName 0.1.42`, `MAP_TEMPLATES`, and `ACCESS_SURFACE`, plus `apksigner verify --verbose`.

## Android Auto Map Tune And PiP Measure Fix - 2026-06-17

- Reed reported the Android Auto ticket polygons were too dark to see the base map, follow mode was not zooming close enough, the base map should load faster if possible, `Fit` was unnecessary, +/- zoom would be useful, and the native phone app's map measure toolbar covered too much of Picture-in-Picture.
- Android Auto map changes: ticket polygon fill alpha reduced to a very light shade, follow mode now targets zoom `18`, manual zoom range now reaches `20`, startup keeps follow mode active even if it temporarily centers on work before a location fix arrives, `Fit`/`Refresh` actions were replaced with `+`/`-`, Mapbox raster tiles request 256px tiles, tile loading uses a 4-thread tile executor, cache size increased to 192 tiles, and tile timeouts were shortened.
- Native phone map PiP change: `applyPictureInPictureChrome(...)` now toggles a WebView `body.pip-mode` class, and the embedded map CSS hides `.measure` while PiP is active so the measure toolbar does not cover the floating map.
- Bumped native Android to `versionCode 42`, `versionName 0.1.41`. Current release AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `e2978fbc6411b22ef20d84348af9f2627702045d60f859dd9cf36c184c2f0d72`. Release APK SHA256 `e6d0f23f2f42d7c49340af473ede9d8df32e2be444b94e0a1f314ee4eda88d97`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py`, `:app:assembleDebug`, `:app:assembleRelease`, `:app:bundleRelease`, `aapt dump badging` showing `versionCode 42` / `versionName 0.1.41`, `MAP_TEMPLATES`, and `ACCESS_SURFACE`, plus `apksigner verify --verbose`.
- Live device pairing succeeded after Reed provided pairing port `35289` and code `271138`; the usable ADB connection is `192.168.50.173:36291` on Samsung `SM_S906U`. `adb install -r android-auto/app/build/outputs/apk/release/app-release.apk` is blocked because the phone has the Google Play-installed `versionCode 41` / `versionName 0.1.40` package signed by Play (`installerPackageName=com.android.vending`, package signature token `c22a40ae`), while the local release APK is signed with the Fiber Locator upload/local key (`c468ca81732c166865fccdb8979f5ea73c7e4e4b49db96279fa7ce5e51ea8396`). Do not uninstall the Play build unless Reed approves the possible app-data/login impact, or upload `0.1.41` through Play Internal testing and update from Play.
- Current-device evidence: launching the installed Play build works and loads the ticket list; reference screenshots captured at `/tmp/fiber-locator-current-phone.png` and `/tmp/fiber-locator-current-phone-after-wait.png`. Desktop Head Unit exists at `/home/linux/Android/Sdk/extras/google/auto/desktop-head-unit`; normal UI mode fails in this headless shell with `SDL_CreateWindowRenderer failed`, while `SDL_VIDEODRIVER=dummy ... -h -a 192.168.50.173:36291` connects headlessly but does not produce a usable visual screenshot.

## Android Auto Map Parity Fix - 2026-06-17

- Reed tested the first Android Auto map build and reported it loaded layers but had no base map, too many/non-matching layers, no phone-map styling parity, no same live-follow behavior, and no obvious return to tickets.
- `CarLiveMapScreen` now draws raster base-map tiles behind overlays instead of the previous schematic grid. It maps the saved dashboard/app base-map style to Mapbox raster style tiles when a Mapbox token is available from `/api/map-config`, and falls back to matching public OSM/Esri/Carto tile families where needed.
- Android Auto VETRO rendering now uses the same published app/mobile state for layer filters and styling: `vetroVisible`, layer/plan/build/placement/status/geometry/fiber/route/point filters, `vetroSearch`, per-layer colors, styles, sizes, opacities, and service-location shape/color/outline/size/opacity. This replaces the earlier hardcoded VETRO colors and broad layer rendering.
- Live location now follows by default on the Android Auto map. `Follow`/`Following` recenters on the phone location; panning disables follow; `Fit` zooms to work tickets. The map screen action strip now includes `Tickets` to return directly to the ticket tabs.
- Bumped native Android to `versionCode 41`, `versionName 0.1.40`. Current release AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `bc9af2fb2c6f166cba543f957adcd7b5c871f4f3863387b273da9deaa8cfb601`. Release APK SHA256 `8b18016b24fa45f685e6f5c85e9191a63f86ec7ebd58cf28dc6a3eb59939b7ef`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py`, `:app:assembleDebug`, `:app:assembleRelease`, `:app:bundleRelease`, `aapt dump badging` showing `versionCode 41` / `versionName 0.1.40`, packaged manifest showing `MAP_TEMPLATES`, `ACCESS_SURFACE`, and Android Auto `CarAppService`, plus `apksigner verify --verbose`. No attached Android Auto/DHU device was visible to `adb devices` in this shell for interactive car-screen validation.

## Android Auto Live Map Tab - 2026-06-17

- Researched the current Android for Cars map path and implemented the supported approach: Android Auto cannot reuse the phone WebView map for a driving template, so the app now uses Car App Library map templates plus `ACCESS_SURFACE` and a `SurfaceCallback` to draw operational map content directly on the car display.
- Added a `Map` tab to `TicketListScreen`. Selecting it pushes `CarLiveMapScreen`, which uses `MapWithContentTemplate` on Car API 7+ and falls back to a clear message on older hosts.
- `CarLiveMapScreen` loads the same dashboard-filtered ticket snapshot as the phone app, locator notes, and VETRO features from `/api/vetro`, then draws ticket polygons, ticket markers, locator notes, VETRO point/line/polygon features, and live phone location onto the Android Auto map surface. Controls include `Refresh`, `Fit`, `+`, `-`, host pan mode, pinch/scroll callbacks where supported, and tapping near a ticket opens ticket detail.
- Added `MapFeature` and `TicketRepository.loadVetroMapFeatures(...)` for lightweight Android Auto VETRO rendering. The loader respects `vetroVisible` and selected VETRO layer filters from the published app/mobile state, and samples long paths to keep car rendering responsive.
- Bumped native Android to `versionCode 40`, `versionName 0.1.39`. Current release AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `029f2608f6c2c44cbde66f5694c44955d562fbe0a6356cbd26ed5483bbbe521d`. Release APK SHA256 `0b480960ac27fab5b1965be08925fd5506b27c7805c9c34fb6897ec3f6209a91`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py`, `:app:assembleDebug`, `:app:assembleRelease`, `:app:bundleRelease`, `aapt dump badging` showing `versionCode 40` / `versionName 0.1.39`, packaged manifest showing `MAP_TEMPLATES`, `ACCESS_SURFACE`, and the Android Auto `CarAppService`, plus `apksigner verify --verbose`. No physical Android Auto/DHU device was attached in this shell for interactive map validation.

## Native Android Map Picture-in-Picture - 2026-06-17

- Added Android Picture-in-Picture support to the native phone app map screen instead of a `SYSTEM_ALERT_WINDOW` overlay. Android docs describe PiP as the supported system floating-window mode for navigation and caution against using system alert windows for PiP-like behavior.
- `MainActivity` now declares PiP support and resizeability in the manifest, sets 16:9 PiP params with source-rect hints, enables Android 12+ auto-enter from the map, enters PiP on Home/user-leave for older supported devices, and hides app chrome/nav while in PiP.
- The native map WebView now shows a small inward-arrow shrink button in the upper-left corner. Tapping it calls `FiberLocator.enterPictureInPicture()` and keeps the current map view floating above other apps. Android's standard PiP controls handle tap-to-expand/full-screen.
- Bumped native Android to `versionCode 39`, `versionName 0.1.38`. Current release AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `887ea6809852f5009cfd3853613ffa022b89600f1888c926dd93bedd7280d3a2`. Release APK SHA256 `6d04be1e0c53f1d99a7bf24cfebb137015226ea756426de64a8521afad20f34a`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py`, `:app:assembleDebug`, `:app:assembleRelease`, `:app:bundleRelease`, `aapt dump badging` showing `versionCode 39` / `versionName 0.1.38`, `aapt dump xmltree` showing `supportsPictureInPicture=true` and `resizeableActivity=true`, and `apksigner verify --verbose`.

## Live VETRO Duplicate Cleanup - 2026-06-16

- Reed reported that a DevTools VETRO capture doubled dashboard layers. Live cloud counts confirmed duplication after `vetro_capture_20260616T151206Z.txt`: `Layer_17` had jumped to `25851`, `Layer_654` to `21595`, and `Layer_659` to `4`.
- Repaired live `/opt/onecall-locator-dashboard/data/layers/vetro_geojson_layers` from the latest good baseline `data/layers/backups/vetro_geojson_layers.backup-1781622774`, preserving only genuinely new stable IDs from today's doubled folder. Current counts after repair: `Layer_17 14083`, `Layer_26 1167`, `Layer_28 6210`, `Layer_42 6863`, `Layer_43 12`, `Layer_654 13970`, `Layer_659 2`.
- Safety backups of the doubled state are on the live host at `data/layers/backups/vetro_geojson_layers.doubled-before-repair-20260616T162019Z` and `data/layers/backups/vetro_geojson_layers.swapped-doubled-20260616T162019Z`.
- Patched and deployed `tools/import_vetro_tiles_from_capture.py` so append-only capture merges skip incoming features whose stable VETRO ID already exists in the current layer set. This keeps older full-coverage baseline fragments and appends only new stable features, preventing the same duplicate-layer failure on future captures.
- Verification: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py` passed locally and on the live host; `onecall-dashboard` restarted and is `active`; public `https://fiber-locator.5-78-214-184.sslip.io/` returns `200`; unauthenticated `/api/vetro` returns expected `401 Login required`.

## Native Android Map Persistence And 3D Tilt - 2026-06-15

- Follow-up 9: Reed reported the Android app showed too many/duplicated-looking VETRO layers while the admin dashboard styling looked correct. Root cause was server-side app/employee/view-preset normalization dropping VETRO filter keys, so the app could receive style settings without the selected layer/plan filters and fall back to showing all VETRO features. Server now preserves VETRO filter keys in app/default/employee/view preset state. Live state was backed up at `/opt/onecall-locator-dashboard/data/dashboard_state.before-vetro-filter-preserve-20260615162544.json`, then the current `locator_default` VETRO filter keys were copied into `employee_dashboard` and the `app view` preset. Verified style keys were unchanged for `locator_default`, `employee_dashboard`, and `app view`; only filter keys changed.
- Follow-up 8: Reed reported that ticket polygons showed in 3D but VETRO/Vitruvi layers disappeared on both web and Android. Live browser diagnostics showed `mismatched image size` errors during generated Mapbox icon registration, before VETRO/Vitruvi GeoJSON sources were created. Web and Android now add 3D sources even while Mapbox style tiles/icons are still settling, catch source/icon failures independently, and pass generated point icons as `ImageData` so saved point shapes and service-location labels can render in 3D.
- Bumped web cache bust to `20260615213000` in `index.html` and `static/service-worker.js`.
- Bumped native Android version to `versionCode 38`, `versionName 0.1.37`. Current Play upload artifact: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `75e617461ebfd6dc02433af0f06ab4d20f3eb2f1f02489566779efab6de868ae`.
- Follow-up 7: Reed reported Android 3D basemap looked good but all layers disappeared again. Patched the Android WebView 3D retry loop so it no longer stops after ticket layers only; it now keeps retrying until ticket, note, VETRO, and Vitruvi 3D sources exist, with up to 45 seconds of attempts after style load. VETRO/Vitruvi add failures are caught independently so one failed overlay attempt does not kill later retries.
- Bumped native Android version to `versionCode 36`, `versionName 0.1.35`. Current Play upload artifact: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `122ce923b3185072209e2e50aca5030b09663232d61cbddbc7f256d184675d10`.
- Follow-up 6: Reed confirmed 3D maps work but VETRO point shapes and service-location labels were lost in 3D. Patched web and Android 3D VETRO/Vitruvi point rendering to use generated Mapbox symbol icons for saved shapes (`circle`, `square`, `diamond`, `pin`, `house`) instead of generic circle layers. Service-location points now use the dedicated service-location shape/color/outline/size/opacity settings and carry `ID`/`feature_id` labels when `vetroSlLabels` is enabled.
- Bumped web cache bust to `20260615193000` in `index.html` and `static/service-worker.js`.
- Bumped native Android version to `versionCode 35`, `versionName 0.1.34`. Current Play upload artifact: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `807d57e1f0aad809d548e1eeda310007a8b5ab6ccf5f60eb4251043189334bde`.
- Follow-up 5: researched Mapbox Standard, Google Photorealistic 3D Tiles, and MapTiler 3D buildings. Mapbox Standard was tried first but did not complete style loading reliably in live headless verification, so the final implementation uses the reliable Mapbox `streets-v12` regular base map and `satellite-streets-v12` alternate map, with an explicit `fill-extrusion` `map3d-buildings` layer from the Mapbox `composite/building` vector source. This gives the regular-map 3D building/house-shape view Reed asked for while preserving ticket, locator note, VETRO, and Vitruvi overlays.
- Bumped web cache bust to `20260615191000` in `index.html` and `static/service-worker.js`.
- Bumped native Android version to `versionCode 34`, `versionName 0.1.33`. Current Play upload artifact: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `bb1cfa33fd55aa61288ae4931d67f4b9bb140eca5fcf0032cd4266b6f9bdd0bb`.
- Follow-up 2: fixed the Android 3D blank-overlay regression by making the Mapbox overlay setup defensive, replacing the risky solid-line filter expression, and adding a dedicated 3D user-location GeoJSON source/layer. The 3D view now keeps ticket overlays, VETRO/Vitruvi overlays, and live location when switching from 2D to 3D.
- Added the same 3D controls to the web dashboard: `3D` toggle, Mapbox satellite-streets/streets switch, tilt up/down, and rotate. The web 3D overlay reuses `visibleTickets()`, `filteredVetroGeojson()`, `filteredVitruviGeojson()`, ticket colors, VETRO layer filters/styles/colors/sizes/opacities, Vitruvi layer filters/styles/colors/sizes/opacities, locator notes, and live location.
- Follow-up 3: fixed the web and Android 3D layer-loss bug by scheduling overlay/terrain refreshes from Mapbox `load`, `style.load`, `styledata`, and `idle` events, plus guarded retries through 5 seconds after style rebuilds. Live Playwright proved the web 3D basemap loads, ticket/note/VETRO/Vitruvi 3D sources/layers are added, tilt changes pitch from `60` to `70`, and style switching to streets reattaches overlays.
- Follow-up 4: Reed reported web 3D still looked flat and Android 3D still had no overlays. Web now hides the Leaflet 2D map while 3D is enabled and raises the Mapbox 3D canvas/control z-index so the tilt view is visually on top; follow-up browser testing caught and fixed the missing `#map` element registry entry, made the hidden Mapbox container explicitly full-size with a forced resize, made the dynamic Mapbox GL loader remove failed scripts and retry instead of hanging after a failed request, and pinned `#map3d.mapboxgl-map` to absolute positioning so Mapbox GL CSS cannot push the canvas below the visible map. Android now keeps retrying 3D overlay setup for up to 30 seconds and only marks overlays loaded after ticket/note sources and core ticket layers exist.
- Bumped web cache bust to `20260615181500` in `index.html` and `static/service-worker.js`.
- Bumped native Android version to `versionCode 32`, `versionName 0.1.31`. Current Play upload artifact: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `f45eded795a5c16ab28abb9173a8605dfacdc55f0fd211123d67cc412ad5a560`.
- Deployed `index.html`, `static/app.js`, `static/styles.css`, `static/service-worker.js`, and the rebuilt Android APK/AAB to `/opt/onecall-locator-dashboard`, restarted `onecall-dashboard`, and verified service `active`. Live SSH hashes match local for the web files and Android artifacts; public HTTPS hashes match local for `app-release.aab` and `app-release.apk`. Unauthenticated `/` and `/static/app.js` correctly redirect to `/login`.
- Verification passed for follow-up 3: `node --check static/app.js`, `python3 -m py_compile server.py tools/*.py`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `/home/linux/Android/Sdk/build-tools/36.0.0/aapt dump badging`, `/home/linux/Android/Sdk/build-tools/36.0.0/apksigner verify --verbose`, live SSH SHA256 checks, public APK/AAB SHA256 checks, and HTTPS Playwright 3D verification against `https://fiber-locator.5-78-214-184.sslip.io`.
- Follow-up: patched the 3D Mapbox view so VETRO/Vitruvi use the same saved dashboard/mobile state as the 2D map: layer visibility filters, VETRO attribute filters, Vitruvi selected layers, per-layer colors, line styles, point shapes, sizes, and opacities. Added a 3D style button to switch between Mapbox satellite-streets and Mapbox streets so Reed can choose either satellite context or a base-map view with street names/addresses.
- Bumped native Android version to `versionCode 27`, `versionName 0.1.26`. Current Play upload artifact: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `cee4a24d7b1b3d4afb25a0da81fd20158606e9c86d08005d131af7cc80e08a52`.
- Copied the rebuilt `0.1.26` release APK/AAB to the live host. Live SSH and public HTTPS SHA256 checks match local for both `app-release.aab` and `app-release.apk`; `onecall-dashboard` is active.
- Verification passed for the follow-up: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`, `/home/linux/Android/Sdk/build-tools/36.0.0/aapt dump badging`, `/home/linux/Android/Sdk/build-tools/36.0.0/apksigner verify --verbose`, live SSH SHA256 checks, and public HTTPS SHA256 checks.
- Patched the native Android phone app so the last screen is stored in `SharedPreferences`; if the user leaves the app on the map, locks the phone, pockets it, or reopens after process recreation, startup restores the map instead of defaulting to the ticket list.
- Added map-camera persistence from the embedded map WebView through `FiberLocator.saveMapCamera(...)`: center latitude/longitude, zoom, bearing, pitch, and 2D/3D mode are saved after map movement and restored before the app falls back to fitting all tickets.
- Added a `3D` map control backed by Mapbox GL JS inside the existing Android WebView. It uses `/api/map-config` for the live `MAPBOX_ACCESS_TOKEN`, loads `mapbox://styles/mapbox/satellite-streets-v12`, enables Mapbox terrain, and adds ticket polygons/points, locator notes, VETRO, and Vitruvi overlays. If the token is missing, the existing Leaflet map remains available and the 3D button reports `No 3D`.
- Bumped native Android version to `versionCode 26`, `versionName 0.1.25`. Current Play upload artifact: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `743a327cb44a0d1408db0c9d7e9923fef61af20924c7ebb7f9b8a0f898126043`.
- Copied the rebuilt release APK/AAB to `/opt/onecall-locator-dashboard/android-auto/app/build/outputs/...` on the live host. Live `MAPBOX_ACCESS_TOKEN` is set and `onecall-dashboard` is active. Public HTTPS checksums match local for `https://fiber-locator.5-78-214-184.sslip.io/android-auto/app/build/outputs/bundle/release/app-release.aab` and `https://fiber-locator.5-78-214-184.sslip.io/android-auto/app/build/outputs/apk/release/app-release.apk`.
- Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`, `/home/linux/Android/Sdk/build-tools/36.0.0/aapt dump badging`, `/home/linux/Android/Sdk/build-tools/36.0.0/apksigner verify --verbose`, live SSH SHA256 checks, and public HTTPS SHA256 checks.

## VETRO Capture Import Guardrails - 2026-06-12

- Investigated Reed's report that `Update VETRO` capture import keeps failing. Latest live capture `data/private/vetro_captures/vetro_capture_20260612T122308Z.txt` had 273 VETRO tile requests across layers 17, 26, 28, 42, 43, 654, and 659, but replaying the first tile returned `401 Unauthorized`; the capture has cookies but no embedded tile bodies, so the VETRO login/cookies are stale for server-side replay.
- Current live layer counts remained intact after the failed import: `Layer_17 13402`, `Layer_26 1155`, `Layer_28 6210`, `Layer_42 6863`, `Layer_43 12`, `Layer_654 13550`, `Layer_659 2`.
- Patched `tools/import_vetro_tiles_from_capture.py` so stale-cookie captures fail fast on the first 401 with a clear fresh-login/fresh-capture message instead of spending minutes replaying every tile.
- Added append-only coverage guardrails: existing VETRO layer files are read before merge, duplicate non-line features keep the higher-detail/source-zoom geometry, exact duplicate geometries are deduped, one `Layer_*.geojson` file is written per layer, and append-only imports cannot reduce an existing layer's feature count. Whole replacement still requires explicit `--replace`.
- Patched `server.py` so a capture replay 401 reports `VETRO login expired...` and exposes the VETRO login link instead of a generic import failure.
- Deployed `server.py` and `tools/import_vetro_tiles_from_capture.py` to `/opt/onecall-locator-dashboard`, compiled them on the live host, restarted `onecall-dashboard`, and verified service `active`.
- Verification: `python3 -m py_compile server.py tools/*.py`, synthetic importer guardrail test, live dry-run of the latest capture, live fast-fail replay of the stale capture, and post-replay layer counts unchanged.
- Added `tools/export_vetro_google_earth_layers.py` to export current VETRO GeoJSON layers as separate Google Earth KML/KMZ files. Generated live exports at `/opt/onecall-locator-dashboard/data/exports/google_earth/vetro_layers_20260612/`, copied them back to the Dell workspace at `Google Earth/VETRO Layers 20260612/`, and created bundle `Google Earth/VETRO Layers 20260612 KMZ Bundle.zip`.

## TCW/DMI Ticket Unification - 2026-06-11

- Removed the separate `One-Calls Done For TCW` dashboard/app mode. TCW/DMI/Computer Works/Dirt Moves tickets now stay in the normal ticket list on the web dashboard and in the native Android app.
- Kept the existing TCW/DMI orange priority/color rules intact, including the rule that completed/actioned TCW tickets stay orange instead of switching to the normal actioned red map styling.
- Follow-up cleanup on 2026-06-12: web dashboard, map, metrics, field-open list, and native Android now exclude TCW/DMI tickets whose due/work-begin date is before the current day; Dig Tickets still reads from the full scoped ticket set, so those older TCW records remain available there.
- Live cleanup archived 175 old TCW/DMI tickets due before 2026-06-12 in `data/dashboard_state.json` across shared workflow, user states, employee dashboard state, and locator default state. Backup: `/opt/onecall-locator-dashboard/data/dashboard_state.before-old-tcw-archive-20260612T064211Z.json`.
- The same live audit left 30 current/future TCW/DMI tickets eligible to show from 2026-06-12 forward.
- Web ticket detail now always renders the same action/description/upload controls for TCW tickets as regular tickets; removed the old read-only/review-cleared TCW hook.
- Native Android now forces the saved dashboard mode back to `main`, removes the TCW menu options, includes TCW tickets in the regular list, and shows `Complete ticket` for TCW tickets.
- Web cache-bust bumped to `20260612014500`; deployed `index.html`, `static/app.js`, native Android source/version files, and the version 25 APK/AAB to `/opt/onecall-locator-dashboard`, restarted `onecall-dashboard`, verified service `active`, live `/` and `/static/app.js?v=20260612014500` return `200`, and remote artifact hashes match local.
- Verification: `node --check static/app.js`, `python3 -m py_compile server.py tools/*.py`, local Playwright/system Chrome mocked TCW+regular ticket flow, and `gradle :app:assembleDebug :app:bundleRelease`.
- Current Android release: `versionCode 25` / `versionName 0.1.24`.
- Current debug APK: `android-auto/app/build/outputs/apk/debug/app-debug.apk`, SHA256 `aa560f5e4bfad60db77888246e6192ccb4afb94b1da513fdbc7e65d7701961cc`.
- Current release AAB: `android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `55211609081bd16bf6f0308346162c2ed196a83fe891d5e0c0af7370646dfef0`.
- Copied the current APK/AAB to the matching `/opt/onecall-locator-dashboard/android-auto/...` paths on the live host and verified the remote hashes match local.

## In-House Request Map And Edit Flow - 2026-06-10

- In-house Locate Requests now has a request-location map beside the form on desktop and first in the flow on mobile.
- Latitude/longitude fields update the marker immediately; address/place/county typing debounces through the existing `/api/map-search`; map clicks and `Use center` write exact coordinates back into the form.
- Existing in-house requests load into a list below the form with `Edit` buttons. Editing reuses the existing `/api/in-house-requests` POST path and preserves the request ID, so saved edits continue to show as `IHR-...` dashboard tickets.
- Updated `index.html`, `static/app.js`, and `static/styles.css`; bumped app/styles asset versions to `20260610220000`.
- Verification: `python3 -m py_compile server.py tools/*.py`, `node --check static/app.js`, local Playwright/system Chrome desktop submit-edit-save flow, and mobile viewport map-order/coordinate update check.
- Deployed targeted assets to `root@5.78.214.184:/opt/onecall-locator-dashboard/`, corrected the static paths, removed accidental root-level `app.js`/`styles.css` from the first upload, restarted `onecall-dashboard`, verified service `active`, and checked live `200` responses for `/`, `/static/app.js?v=20260610220000`, and `/static/styles.css?v=20260610220000`.
- Follow-up fix: address/place/county typing now forces a fresh `/api/map-search` even when lat/lng are already filled, and in-house request searches default to `Arkansas, USA`; deployed `static/app.js` plus `index.html` cache-bust `20260610221500`, restarted cloud service, and verified active.
- Follow-up fix: the in-house request map now renders the same filtered/styled VETRO overlay as the dashboard when the dashboard VETRO toggle is on; deployed `static/app.js` plus `index.html` cache-bust `20260610223000`, restarted cloud service, and verified active.
- Follow-up fix: the in-house request map now uses the same selected dashboard base map style, including satellite/hybrid/Mapbox/MapLibre layer handling; this also applies in the Android app because `In-house Locate Requests` opens the same `/#in-house-requests` WebView route. Deployed `static/app.js` plus `index.html` cache-bust `20260610224500`, restarted cloud service, and verified active.
- Performance cleanup pass: removed eager MapLibre CSS/JS script tags from `index.html` and lazy-load MapLibre only when a MapLibre/vector base map is selected; deferred VETRO layer/control loading when VETRO is off until the VETRO drawer/toggle or VETRO-backed view needs it; added `content-visibility` containment for heavier secondary views. Deployed `index.html`, `static/app.js`, and `static/styles.css` with cache-bust `20260610230000`, restarted cloud service, and verified active plus live `200` responses for `/`, app JS, and CSS.

## Restoration Dashboard And In-House Request Flow - 2026-06-10

- Restoration Jobs is now a dashboard-style web page: priority/due-date grouped list, filters, map, selected job detail panel, and a separate `Add restoration ticket` modal form instead of the form occupying the main page.
- Added a separate `In-house Locate Requests` page whose only purpose is submitting an internal locate request form. Submitted requests persist under ignored runtime data at `data/in_house_requests/requests.json`.
- Open in-house requests are emitted from `/api/tickets` as synthetic dashboard tickets with `IHR-...` ticket numbers, `IN-HOUSE LOCATE` message type, due date/time, county/address/scope/utilities, and show on the normal locator dashboard and native Android ticket list.
- Android native menu now includes `In-house Locate Requests` and opens the web-backed `/#in-house-requests` page. Restoration remains a separate web-backed `/#restoration` page.
- Installed local Gradle 8.10.2 under `/home/linux/.local/gradle/gradle-8.10.2` because the repo has no wrapper and Ubuntu apt only offered obsolete Gradle 4.4.1.
- Verification: `python3 -m py_compile server.py`, `node --check static/app.js`, Playwright form-only in-house request submit -> normal dashboard ticket visibility, `gradle :app:assembleDebug`, and `gradle :app:bundleRelease`.
- Deployed `server.py`, `index.html`, `static/app.js`, `static/styles.css`, `static/service-worker.js`, Android `MainActivity.java`, and rebuilt APK/AAB to `/opt/onecall-locator-dashboard`; restarted `onecall-dashboard` and verified active.
- Current Android release: `versionCode 23` / `versionName 0.1.22`.
- Current Google Play AAB: `android-auto/app/build/outputs/bundle/release/app-release.aab`.
- AAB SHA256: `b6f7cb0885fa67981ec2d30ee24a05b60e45262f18c810fbd2143315a04f7a19`.
- Debug APK SHA256: `8bec9504a37e7b4e8bf95a537e0495aed925b270980c7c228545a9ae48abc160`.

## Ticket Clear/Hide Persistence Fix - 2026-06-10

- Fixed a stale-save race that could make cleared, hidden, or archived tickets appear again after refresh or after another dashboard/mobile session saved older state.
- `hiddenTickets` and `archivedTickets` now have per-ticket timestamp maps (`hiddenTicketUpdatedAt`, `archivedTicketUpdatedAt`) and are merged through the shared ticket workflow, matching the existing timestamp protection for ticket action checkboxes.
- Follow-up fix: removed an old hardcoded `CURRENT_DASHBOARD_TICKET_RELEASE` / `releaseTicketsFromSuppression` path in `static/app.js` that was stripping `located`, `clear`, hidden, and archived state from a specific ticket list every time tickets reloaded. This was the direct cause of cleared tickets returning when the admin console fetched/updated tickets.
- Admin GeoCall fetch and the main ticket refresh now force-save current ticket workflow state before requesting ticket updates, so newly cleared/located tickets are persisted before the ticket list reloads.
- Deployed targeted production updates for `server.py` and `static/app.js` to `/opt/onecall-locator-dashboard`, restarted `onecall-dashboard`, and verified the service is active.
- Verification run locally: `python3 -m py_compile server.py`, `node --check static/app.js`, and a focused Python merge check for stale/newer visibility saves. Production host compiled `server.py`; production lacks `node`, so JS syntax was checked locally before deploy.

## Restoration Jobs And Priority Sheet - 2026-06-08

- Added a server-backed Restoration Jobs page at `/#restoration` with its own map, job form, searchable job sheet, status tracking, and restoration photo upload controls.
- Restoration jobs persist in ignored runtime data under `data/restoration_jobs/jobs.json`. Employees can create/update jobs and upload submitted/completed photos; admin/site-owner users can also set priority, schedule, and assigned employee.
- Restoration photos use the existing Microsoft Graph OneDrive connection and store folders under `Fiber Locator Attachments/Restoration Jobs/<ticket-number-or-job-id>/`, keeping storage replaceable through the server-side OneDrive configuration.
- Dig Tickets sheet now has an admin-controlled Priority column (`low`, `medium`, `high`, `emergency`) persisted in dashboard state, with row/map color treatment and marked-by behavior still preserved for completed dig-ticket actions.
- Native Android menu now opens the web-backed Restoration Jobs page through `/#restoration`, matching the existing Dig Tickets web sheet route.
- Rebuilt native Android release as `versionCode 21` / `versionName 0.1.20`.
- Current AAB for Google Play upload: `android-auto/app/build/outputs/bundle/release/app-release.aab`.
- AAB SHA256: `aa5368e2b17c65f726e8f0c0364995a4ef18472e2b884833f305f216a75917b8`.

## Logo Refresh, Native Contrast, And App Release - 2026-06-06

- Used Reed's uploaded PNGs from `/home/linux/linux/Downloads`: `Finalapplocator.png` is now the launcher/adaptive foreground image for the phone app and Android Auto service, and `Finallandscapelocator.png` is now the in-app native logo plus the web/login/header Fiber Locator logo beside the existing TCW logo.
- Kept the TCW logo in the web header/mobile header; only the Fiber Locator secondary logo changed.
- Native Android completion and locator-note forms now use light panels, dark text, visible light inputs, and larger/tinted action checkboxes so the completion boxes, category selector, and description field are readable.
- Web/mobile locator-note modal was also lightened, web action checkboxes were enlarged, and locator-note map flags were reduced to near-transparent opacity (`0.08` for ordinary notes, capped around `0.12` for layer-linked notes). Popup details still show on click.
- Server public static allowlist now includes the new app/landscape logo PNGs and the Play-upload AAB. This fixed the live login page initially rendering a broken image because unauthenticated static PNG requests were redirecting to `/login`.
- Deployed `server.py`, `index.html`, `manifest.webmanifest`, `static/app.js`, `static/styles.css`, `static/service-worker.js`, the new logo PNGs, native Android source/resource files, and the release APK/AAB to `/opt/onecall-locator-dashboard`; restarted `onecall-dashboard` and verified active.
- Release bumped to `versionCode 20` / `versionName 0.1.19`.
- Current AAB for Google Play upload: `android-auto/app/build/outputs/bundle/release/app-release.aab`.
- APK SHA256: `850cf08c06faff7911752276376c32f84f590dad32f50bbd1e3f85068ceadd0a`
- AAB SHA256: `fb05f94dcd8e1fa3f21d6b9d085b553123cb6986d30c1e6d40e6c19703fa4209`
- Live AAB URL verified with the same SHA256: `https://fiber-locator.5-78-214-184.sslip.io/android-auto/app/build/outputs/bundle/release/app-release.aab`
- Verification passed: `python3 -m py_compile server.py tools/*.py`, `node --check static/app.js`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:compileReleaseJavaWithJavac`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`, `/home/linux/Android/Sdk/build-tools/36.0.0/aapt dump badging`, `/home/linux/Android/Sdk/build-tools/36.0.0/apksigner verify --verbose`, live HTTPS `/login` rendered desktop/mobile screenshots with the landscape logo decoded at `1672x941`, live logo PNG returned full body, live `/api/state` returned expected unauthenticated `401`, and live `onecall-dashboard` is active.

## Cloud Loading Fix - 2026-06-06

- Investigated Reed's report that the cloud dashboard/app was not loading or was loading very slowly.
- Cloud host health was good: `onecall-dashboard` active, load near `0.00`, memory about `7.0 GiB` available, root disk about `3%` used.
- Found the new landscape logo PNG was too heavy for initial page load: live transfer was `2.3 MB` and took up to about `16s` from the Dell check.
- Rebuilt optimized PNG copies from the uploaded originals, leaving `/home/linux/linux/Downloads/Finalapplocator.png` and `/home/linux/linux/Downloads/Finallandscapelocator.png` untouched:
  - web/native landscape logo: `720x405`, about `650 KB`
  - square app/launcher foreground: `384x384`, about `338 KB`
- Rebuilt and redeployed Android release artifacts after image optimization. Final release remains `versionCode 20` / `versionName 0.1.19`.
- Final APK SHA256: `850cf08c06faff7911752276376c32f84f590dad32f50bbd1e3f85068ceadd0a`
- Final AAB SHA256: `fb05f94dcd8e1fa3f21d6b9d085b553123cb6986d30c1e6d40e6c19703fa4209`
- Final AAB size is about `3.0 MB` and is still at `android-auto/app/build/outputs/bundle/release/app-release.aab`.
- Bumped web app shell cache from `20260603104500` to `20260606230200` in `index.html` and `static/service-worker.js` so clients pull the current JS/CSS instead of stale cached files.
- Changed `send_json()` to emit compact JSON and gzip responses when the browser advertises gzip, reducing authenticated API payload cost for endpoints such as `/api/tickets` and `/api/state`.
- Deployed `server.py`, `index.html`, `manifest.webmanifest`, `static/service-worker.js`, optimized logo PNGs, Android drawables, and final APK/AAB to `/opt/onecall-locator-dashboard`; restarted `onecall-dashboard` and verified active.
- Live checks after fix: `/login` returned `200` in about `0.44s`; optimized landscape logo returned `200` with `665355` bytes and later about `0.74s`; unauthenticated `/api/state` returned expected `401`; authenticated live logs showed `GET /static/styles.css?v=20260606230200 200`, `GET /static/app.js?v=20260606230200 200`, `GET /api/tickets 200`, `GET /api/vetro 200`, and `POST /api/state 200`.

## VETRO Line Fragment Investigation - 2026-06-05

- Investigated Reed's report that VETRO line layers sometimes stop and pick back up on the map.
- Root cause found in `tools/import_vetro_tiles_from_capture.py`: `dedupe_features()` collapsed same-ID line features down to one "best" vector-tile fragment. VETRO line features are clipped into multiple tile fragments with the same ID, so this can create visible gaps.
- Patched the importer so `LineString`, `MultiLineString`, `Polygon`, and `MultiPolygon` features dedupe by exact geometry instead of stable ID. Point layers still dedupe by stable ID.
- Deployed the patched importer to `/opt/onecall-locator-dashboard/tools/import_vetro_tiles_from_capture.py` on the cloud host and verified it compiles.
- Live evidence before rebuild: current line layers had no multi-fragment stable IDs (`Layer_17`: 13,393 features / 0 IDs with multiple fragments; `Layer_654`: 13,541 / 0; `Layer_659`: 2 / 0), confirming the importer had flattened tile fragments.
- Tried rebuilding from latest saved capture `vetro_capture_20260603T193457Z.txt`, but replay returned repeated `401 Unauthorized` responses because the saved VETRO auth was expired. The import was stopped before the write step; live manifest stayed at `2026-06-03T19:37:49Z`, and `onecall-dashboard` remained active.
- Next step to repair the visible gaps: capture fresh logged-in VETRO tile traffic with embedded response bodies or current Cookie/Authorization headers, then run the VETRO refresh/import again. The fixed importer should preserve same-ID line fragments on that next import.
- Follow-up after Reed's browser froze while uploading a large copied-cURL capture:
  - `server.py` and `tools/import_vetro_tiles_from_capture.py` now accept VETRO Cookie/Authorization fallback headers from any `*.vetro.io` copied-cURL request, so captures where API calls have the cookie and later `.pbf` tile calls omit it can still import.
  - The DevTools capture file picker in `static/app.js` no longer dumps the selected file into the textarea; it keeps the file selected and posts raw text directly to `/api/vetro-capture`.
  - Capture upload limit raised from 8 MB to 50 MB for site_owner uploads.
  - Deployed `server.py`, `static/app.js`, and `tools/import_vetro_tiles_from_capture.py` to the cloud host, restarted `onecall-dashboard`, and verified active. Live synthetic parser check confirmed a `fibermap.vetro.io` cookie can authorize a later tile request with no tile-local cookie.
- Reed reported the VETRO layers looked doubled after the fresh import. Root cause: the corrected line-fragment import ran in append-only merge mode, so old high-zoom single retained features and fresh lower-zoom tile fragments were both displayed.
  - Cleaned the live VETRO layer directory by keeping one coherent tile zoom bucket per line/polygon VETRO ID, preferring the fresh fragment bucket where both old named records and fresh anonymous tile fragments existed. Point layers were left one-feature-per-ID.
  - Live cleaned layer counts: `Layer_17` 13,604, `Layer_26` 1,142, `Layer_28` 6,210, `Layer_42` 6,863, `Layer_43` 12, `Layer_654` 13,689, `Layer_659` 2; total 41,522.
  - Duplicate audit after cleanup: exact duplicate extras are `0` in every layer; intentional multi-fragment line IDs remain (`Layer_17` 207 IDs, max 3 fragments; `Layer_654` 148 IDs, max 2 fragments).
  - Backed up the doubled live layer directory to `data/layers/backups/vetro_geojson_layers.doubled-before-clean-20260605T192419Z` on the cloud host.
  - Updated and redeployed `tools/import_vetro_tiles_from_capture.py` so future imports use the same single-zoom-bucket cleanup policy and should not reintroduce cross-zoom doubled line overlays.
  - Restarted `onecall-dashboard`; service verified active and public dashboard returned `200`.
- Reed then reported many previously visible layers/features were missing. Root cause: the cleanup preferred fresh anonymous tile fragments over older named/full-coverage line records for existing VETRO IDs, restoring duplication but losing older coverage.
  - Rebuilt live VETRO as a safer hybrid: restored June 3 full-coverage baseline `data/layers/backups/vetro_geojson_layers.backup-1780684904`, then added only genuinely new feature IDs from the cleaned June 5 live set.
  - New live counts: `Layer_17` 13,395, `Layer_26` 1,142, `Layer_28` 6,210, `Layer_42` 6,863, `Layer_43` 12, `Layer_654` 13,541, `Layer_659` 2; total 41,165.
  - Live audit after restore: every layer has one feature per stable ID and exact duplicate extras are `0`.
  - Backed up the too-aggressive cleaned set to `data/layers/backups/vetro_geojson_layers.cleaned-too-aggressive-20260605T194132Z`.
  - Updated and redeployed `tools/import_vetro_tiles_from_capture.py` again: for fragmented line/polygon IDs that already have named/display-ID records, keep the best named record; only use single-zoom fragment buckets when no named baseline exists. This favors preserving full older coverage over replacing existing IDs with partial fresh tile fragments.

## Current Stop Point - 2026-06-03

- Android Auto TCW tab and app icon fix - 2026-06-05:
  - Android Auto now defaults to a `Locates` tab and keeps TCW/DMI tickets under a separate `TCW` tab so TCW rows do not appear before locate tickets.
  - Android Auto min car API is now `6` for `TabTemplate` support.
  - Restored the manifest application/service icons to the original launcher resources (`@mipmap/ic_launcher` / `@mipmap/ic_launcher_round`) without changing the in-app login/header logo drawables.
  - Release bumped to `versionCode 19` / `versionName 0.1.18`.
  - Current AAB for Google Play upload: `android-auto/app/build/outputs/bundle/release/app-release.aab`.
  - APK SHA256: `d64037ab0aa0dd032cd889230c1b4598403f231f1fac58e8e14658c3f6ac74a1`
  - AAB SHA256: `5c3520b4fe1d9f7ada503f6c897de0dd4c91e8aeeb5aa002c39655fd37418371`
  - Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:compileReleaseJavaWithJavac`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`, `aapt dump badging`, `aapt dump xmltree`, `aapt dump resources`, and `apksigner verify --verbose`.

- Follow-up native app locator notes - 2026-06-03:
  - Native Android now loads `/api/locator-notes` during the normal dashboard refresh.
  - Native and web maps show locator notes as dim colored flags only; no always-visible label/title text appears while panning. Category, target, text, attachments, creator, and timestamp show only after clicking or in ticket detail.
  - Native map has an `Add note` control; tap it, then tap a map spot, ticket, VETRO feature, or Vitruvi feature to save the same target fields as the web modal. Category, text, and optional photo/video attachments are supported.
  - Opening the map from a ticket associates the new locator note with that ticket. Notes that fall inside a ticket polygon are also shown as attached locator notes on the ticket.
  - Web dashboard assets were deployed to the cloud host and `onecall-dashboard` restarted active.
  - Release bumped to `versionCode 18` / `versionName 0.1.17`.
  - APK SHA256: `0367726bedf990a4fbd0292f070cf75467f0f4756237bb95623d79a75e819315`
  - AAB SHA256: `d02a85f9921d7a2e85eba3b5f9a638ca62334f355340edd22b13f1d82e24aa97`
  - Current AAB for Google Play upload: `android-auto/app/build/outputs/bundle/release/app-release.aab`.
  - Verification passed: `python3 -m py_compile server.py tools/*.py`, `node --check static/app.js`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:compileReleaseJavaWithJavac`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleRelease :app:bundleRelease`, `/home/linux/Android/Sdk/build-tools/36.0.0/aapt dump badging`, and `/home/linux/Android/Sdk/build-tools/36.0.0/apksigner verify --verbose`.

## Prior Stop Point - 2026-06-01 19:20 CDT

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

## 2026-06-15 3D VETRO/Vitruvi Source Fix

- Root cause: generated Mapbox shape image registration could throw `mismatched image size` in 3D mode; that happened before VETRO/Vitruvi GeoJSON sources were added, so ticket polygons showed but VETRO/Vitruvi layers did not.
- Web and native Android now add 3D sources while Mapbox style assets are still settling, catch source/icon failures independently, and pass generated point icons as `ImageData` so VETRO point shapes and service-location labels can render in 3D.
- Web cache bumped to `20260615213000`.
- Native Android rebuilt as `versionCode 38` / `versionName 0.1.37`.
- Release AAB: `android-auto/app/build/outputs/bundle/release/app-release.aab`.
- AAB SHA256: `75e617461ebfd6dc02433af0f06ab4d20f3eb2f1f02489566779efab6de868ae`.
- Release APK SHA256: `bb95b238607664a2224d4fc4bda1293f152a662335c1ada4578f628d7b476d54`.

## 2026-06-10 Android Play Version Bump

- Google Play rejected the previous upload because `versionCode 23` had already been used.
- Bumped the native Android package to `versionCode 24` / `versionName 0.1.23`.
- Rebuilt release AAB: `android-auto/app/build/outputs/bundle/release/app-release.aab`.
- AAB SHA256: `31fc3901d6867c37538eacf9ffae8c5377ea5293064512e1c333b11495a93beb`.
- Rebuilt debug APK: `android-auto/app/build/outputs/apk/debug/app-debug.apk`.
- Debug APK SHA256: `e96967b42dbaff9206276f7e90a24e57a843765c8af455bb53287d0cd8a6e6c8`.
- Updated `PLAY_UPLOAD_COMMAND.txt` with the new SCP command and filename `fiber-locator-0.1.23.aab`.
- This local shell did not have `/opt/onecall-locator-dashboard` mounted/present and `onecall-dashboard` was inactive, so only the repo-local Android artifacts were refreshed in this turn.

## 2026-06-10 VETRO View Consistency

- Saved views, locator default state, and employee/mobile shared state now strip VETRO feature-selection filters (`vetroLayerFilterSelected`, plan/build/status/etc., and `vetroSearch`) while preserving VETRO styling overrides such as color, shape/style, size, opacity, names, and notes.
- Native Android app view merging now takes VETRO feature filters from the effective dashboard state instead of stale App View state, so the mobile app should show the same VETRO feature set as the active dashboard view while still using app-published styling.
- Live cloud deploy completed to `/opt/onecall-locator-dashboard`; `onecall-dashboard` restarted active behind Caddy at `https://fiber-locator.5-78-214-184.sslip.io`.
- Android release rebuilt as `versionCode 23` / `versionName 0.1.22`; current AAB path remains `android-auto/app/build/outputs/bundle/release/app-release.aab`.

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

## 2026-06-02 Android Auto Map Crash Fix

- ADB logcat on Reed's Android Auto connection showed `PlaceListMapTemplate` crashing with `All non-browsable rows must have a distance span attached to either its title or texts`.
- Android Auto ticket map rows now include a `DistanceSpan` on the status line, using the phone's last known location when available.
- Rebuilt native Android release as `versionCode 14` / `versionName 0.1.13`.
- Current AAB for Google Play upload: `android-auto/app/build/outputs/bundle/release/app-release.aab`.
- Direct ADB install over the Play-installed copy failed because the Play copy is signed by Google Play and does not match the local upload-key signature; upload the AAB through Google Play, or uninstall the Play copy before local sideload testing.

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
