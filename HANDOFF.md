# Fiber Locator Dashboard Handoff

Updated: 2026-06-25

## Android Auto Moving Map Tilt - 2026-06-25

- Follow-up cleanup on 2026-06-26: removed the fake tilt/pseudo-3D perspective from `CarLiveMapScreen`. Android Auto live map is now a clean 2D canvas renderer again: no Y scale, no skew, no pitch anchor, no warped ticket polygons/VETRO/notes. Heading-up rotation remains, and the map falls back to north-up when stopped, too slow, or missing a usable GPS bearing.
- Removed the custom canvas HUD that said `Fiber live map`, leaving one concise Android Auto template status row: `Live Map` plus ticket/note/fiber/follow mode counts. Removed the inactive Android Auto day/night label/path from this renderer for stability. Mapbox tile requests now use `tiles/512` for sharper basemap imagery while preserving the existing saved Mapbox style/token routing and tile cache.
- Rebuilt native Android/Android Auto release as `versionCode 82`, `versionName 0.1.81`. Current Play AAB: `android-auto/app/build/outputs/bundle/release/app-release.aab`; SHA256 `707ce672c6369cc3177b1f88567cdbe24246dcd772c745b8a2ff41da90f6dc62`.
- Verification passed: requested `./gradlew -p android-auto assembleDebug` could not run because this repo has no checked-in `gradlew`; equivalent documented command `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug` passed. Full `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle test assembleRelease bundleRelease` passed; `aapt dump badging` confirmed package `com.fiberlocator.auto`, `versionCode 82`, `versionName 0.1.81`; `apksigner verify --verbose` passed v2 signing.
- Superseded 2026-06-25 note: an earlier pass added a pseudo-tilt moving camera. That behavior was removed on 2026-06-26; keep the clean 2D heading-up renderer unless Reed explicitly asks for a true map-engine pitch later.
- The remaining useful parts from that earlier pass are still kept: heading-up bearing smoothing, VETRO loading after the base ticket map, double-tap/pinch zoom support, selected VETRO detail popups, and speed-aware follow zoom.
- Rebuilt native Android/Android Auto release as `versionCode 81`, `versionName 0.1.80`. Current Play AAB: `android-auto/app/build/outputs/bundle/release/app-release.aab`; SHA256 `8d7f6d8413b18d358e80d4a6214b013bbcdd25f7f031ab9e752a78dbb39f8b8c`.
- Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle test assembleRelease bundleRelease`; `aapt dump badging` confirmed package `com.fiberlocator.auto`, `versionCode 81`, `versionName 0.1.80`; `apksigner verify --verbose` passed v2 signing.

## Attachment Photo Location Recheck - 2026-06-26

- Added a shared server-side uploaded-photo location resolver used by ticket attachment mirroring and general Location Photos uploads. Source order is valid EXIF GPS, captured device GPS fields from upload/capture when present, printed Timestamp Camera GPS/address and filename/address recovery, then ticket geometry only as a fallback when the photo has no valid photo-derived location.
- New and edited photos now carry compatibility fields (`lat`, `lng`, `coordinate_source`) plus canonical metadata: `photo_lat`, `photo_lon`, `photo_location_source`, `photo_location_confidence`, `photo_location_checked_at`, and `photo_location_issue`.
- Coordinate validation now rejects invalid world coordinates, `0,0`, and coordinates outside the Arkansas operating bounds. Web map photo markers only draw for valid Arkansas coordinates; invalid/missing photos remain visible in the review/admin lists.
- Added `tools/recheck_attachment_photo_locations.py` for idempotent dry-run/apply rechecks of existing ticket attachment photo mirrors. It writes JSON and CSV reports under `data/location_photos/recheck_reports/`, preserves manual coordinates unless `--force-overwrite-manual` is used, and only applies higher-confidence fixes or missing/invalid metadata repairs.
- Local dry-run found no local attachment-photo records because the real data is on the live server. After syncing this code live, run: `python3 tools/recheck_attachment_photo_locations.py --data-dir data --downloads-dir data --inbox-dir data` from `/opt/onecall-locator-dashboard`.
- Live apply was run from `/opt/onecall-locator-dashboard`: `148` attachment-photo mirrors checked, `129` coordinate/metadata updates applied, `57` higher-confidence EXIF placements recovered, `91` photos marked as ticket-fallback/manual-review, `0` missing files, `0` missing mirrors. Backup before apply: `data/location_photos/photos.before-attachment-photo-recheck-20260626002926.json`; apply report: `data/location_photos/recheck_reports/attachment_photo_recheck_20260626002926.json` and `.csv`.
- Post-apply dry-run confirmed idempotence: `148` checked, `129` already correct, `0` remaining coordinate fixes, `91` still needing manual review because they are fallback-derived. Post-check report: `data/location_photos/recheck_reports/attachment_photo_recheck_20260626003014.json` and `.csv`.
- Added `tests/test_photo_location.py`; verification passed locally with `python3 -m unittest tests.test_photo_location`, `python3 -m py_compile server.py tools/*.py tests/*.py`, `node --check static/app.js static/service-worker.js`, and the Android Gradle build above. Web cache-bust/service-worker cache version is `20260626002209`.

## Ticket Attachment Photos Mirror To Map - 2026-06-25

- Ticket attachment uploads now mirror image files into the Location Photos index at upload time. This makes photos attached from the ticket workflow show as location-photo map markers immediately, using the same marker layer as general Location Photos uploads.
- Attachment image placement uses the same Arkansas-only priority path as general uploads: EXIF GPS, Timestamp Camera printed coordinates, printed address geocode, filename/address geocode, then a ticket-site fallback when the image is attached to a known ticket. Non-image attachments remain regular ticket attachments only.
- Ticket attachment photo placement now treats the ticket area as the sanity boundary. If an uploaded attachment image has coordinates more than `2.5` miles from the ticket area, the marker falls back to the ticket location and the mismatch is noted.
- General Location Photos uploads now also try filename/address geocoding for photos with address-like filenames, even when they are not attached to a ticket. If a ticket number is present, the ticket-site fallback still applies only after better photo/address sources fail.
- The ticket attachment upload response now includes `location_photos`, and the web client merges those records into the current map photo list before the full refresh. Web cache-bust/service-worker cache version is `20260625100109`.
- The web map now groups multiple photos at exactly the same coordinate into a numbered photo marker that opens a selectable list, instead of making stacked photos look like a single unmarked picture.
- Ticket address display now prefers the locate street/site address before any generic `address` field, reducing cases where caller/excavator addresses appear as the locate address.
- Added and ran `tools/backfill_ticket_attachment_location_photos.py` on live data. Ticket `260625-0131` had `8` pre-change image attachments mirrored to Location Photos at `33.225058, -92.660246`; backup before that write: `/opt/onecall-locator-dashboard/data/location_photos/photos.before-ticket-attachment-photo-backfill-20260625091602.json`.
- Ran the same backfill for all remaining older ticket image attachments: `126` additional images mirrored, `0` skipped for missing ticket location, backup before the full write: `/opt/onecall-locator-dashboard/data/location_photos/photos.before-ticket-attachment-photo-backfill-20260625092122.json`. Post-check: `722` total Location Photos, `134` ticket-attachment mirrors, `134` unique attachment IDs, `0` duplicate attachment IDs, and a final dry-run found `0` remaining unmirrored ticket image attachments.
- Follow-up repair moved those same `8` ticket `260625-0131` attachment photo markers from the ticket fallback point to filename-derived address points: `3` photos at `1338 North Madison Avenue` and `5` photos at `1404 North Madison Avenue`. Backup before repair: `/opt/onecall-locator-dashboard/data/location_photos/photos.before-ticket-attachment-photo-backfill-20260625100243.json`.
- Reprocessed all rejected/unknown/needs-review Location Photos with the expanded process. `183` candidates checked, `20` additional photos placed from filename addresses, `163` left for manual review, backup before write: `/opt/onecall-locator-dashboard/data/location_photos/photos.before-watermark-backfill-20260625102237.json`. Post-check: `filename_address_reread=20`, `filename_address_attachment_repair=8`, and `needs_review_or_rejected=163`.
- Deployed `server.py`, `index.html`, `static/app.js`, `static/styles.css`, `static/service-worker.js`, and the backfill tools to `/opt/onecall-locator-dashboard`; restarted `onecall-dashboard` and confirmed it is active. Verification passed: local and live `python3 -m py_compile server.py tools/*.py`, local `node --check static/app.js static/service-worker.js`, public HTTPS `/`, `/static/app.js?v=20260625100109`, `/static/styles.css?v=20260625100109`, and `/static/service-worker.js` returned `200`.
- Follow-up fix after Reed could not open a grouped photo circle labeled `11`: cluster markers now use Leaflet's div-icon class, a larger `34px` hit target, high z-index offset, click/touch popup opening, and a tooltip. Web cache-bust/service-worker cache version is `20260625110836`; local checks and live public `/`, `/static/app.js?v=20260625110836`, and `/static/styles.css?v=20260625110836` returned `200`; `onecall-dashboard` is active.
- Follow-up opacity tweak: normal location-photo circle markers now render at `40%` stroke/fill opacity, and grouped photo count circles use `40%` background/border opacity while preserving brighter hover/selection states. Web cache-bust/service-worker cache version is `20260625132810`; local checks and live public `/`, `/static/app.js?v=20260625132810`, and `/static/styles.css?v=20260625132810` returned `200`; `onecall-dashboard` is active.
- Follow-up per Reed preference: removed the visible big/count photo bubbles from dashboard marker rendering. Exact-overlap photo groups now render as tiny `20%` opacity circle markers that still open the selectable photo list on click/touch; single photo markers also rest at `20%` opacity and brighten only on hover. Web cache-bust/service-worker cache version is `20260625142111`.

## Location Photo Timestamp Watermark Reread - 2026-06-24

- Improved the location-photo coordinate parser for Timestamp Camera style printed watermarks. The OCR parser now prioritizes the second printed line as the likely coordinate line and ignores harmless trailing letters stuck onto latitude/longitude numbers.
- Future uploads still enforce the Arkansas-only coordinate gate. If EXIF is bad, the server can now recover more coordinates from the printed bottom-corner watermark, then try to geocode the printed address in Arkansas, before sending the photo to manual review.
- Added `tools/backfill_location_photo_watermarks.py` for dry-run/apply rereads of existing location photos that are missing coordinates, marked `unknown`, `rejected_outside_arkansas`, or `needs_review`.
- Ran the live apply backfill against `/opt/onecall-locator-dashboard/data`: `195` candidate photos checked, `12` repaired from watermark OCR, `0` missing files, and `183` left unchanged for manual review. Backup before write: `/opt/onecall-locator-dashboard/data/location_photos/photos.before-watermark-backfill-20260624070248.json`.
- Follow-up address fallback rerun checked the remaining `183` candidates. It fixed `0` by printed-address geocoding because none had readable printed address text that geocoded inside Arkansas. No new backup was created because no photo-index write was needed. Geocoding now uses IPv4-only, time-bounded Nominatim calls to avoid the Dell/live host hanging on bad IPv6 routes.
- Deployed `server.py` and `tools/backfill_location_photo_watermarks.py` to `/opt/onecall-locator-dashboard`, restarted `onecall-dashboard`, and confirmed it is active. Verification passed: local and live `python3 -m py_compile server.py tools/*.py`, live limited dry-run, full live apply, post-count check, and public HTTPS `/` returned `200`.

## Mapbox Basemaps, Photo Review Queue, And Field Permissions - 2026-06-23

- Added more Mapbox basemap choices to the web dashboard selector: Standard, Standard Satellite, Satellite Streets + Traffic, Traffic Day, and Traffic Night, while keeping existing Streets/Outdoors/Light/Dark/Satellite/Navigation styles. Native Android and Android Auto now recognize those saved style keys too.
- Location Photos now has an explicit `Needs location review` approval list. It includes newly uploaded photos with missing/unknown/rejected coordinates and existing photos already in that category, including photos with no usable lat/lng. Map or coordinate fixes mark the photo reviewed.
- Local photo upload now generates server-side JPEG thumbnails when Pillow is available. The web list and map popups use `thumbnail_url` plus `loading="lazy"` and fall back to the original file if thumbnailing fails.
- Employee accounts now have field-work permission for location photo settings/export/metadata edits and restoration job create/edit/complete/upload flows without being given admin-console/shared-dashboard write privileges.
- Long utility pages opened from the three-dot menu now have scrollable panels and small bottom footers, so the user can tell when the bottom has been reached.
- Web cache-bust/service-worker cache version is `20260623232500`. Android release rebuilt as `versionCode 79`, `versionName 0.1.78`; AAB SHA256 `81caf080b70421b393a23ae3a310fede15a7b29d7c1b49ddd83d8575480cedda`; release APK SHA256 `120b4b6e1ad68f2c3bd369da00dc46b2bd669398b50cdaa0f6095bc3115dcf77`.
- Verification passed locally: `node --check static/app.js`, `python3 -m py_compile server.py tools/*.py`, Gradle `test assembleRelease bundleRelease`, `aapt dump badging`, `apksigner verify`, and Playwright smoke against `127.0.0.1:8879` for the Location Photos review filter, Mapbox options, and mobile footer. Browser plugin was not available, so regular Playwright was used.

## VETRO Address Labels And Feature Detail Popups - 2026-06-23

- Added zoom-gated VETRO address labels for service-location/customer point features on the web dashboard, native Android WebView map, and Android Auto canvas map. Labels use real address fields only, are hidden until zoom 17+, and are styled as small white text on a black background with a yellow halo/border.
- Web dashboard VETRO/Vitruvi features now bind full property popups while keeping the existing layer style drawer and locator-note behavior. Mapbox 3D VETRO/Vitruvi layers also get clickable feature popups and matching small address labels.
- Native Android map VETRO/Vitruvi layers now bind full feature popups in Leaflet and Mapbox 3D. Android Auto now keeps selected VETRO features on tap and draws a compact feature-info card with priority fields plus additional raw properties that fit safely on the head unit.
- Bumped web cache-bust/service worker to `20260623170500` and native Android to `versionCode 77`, `versionName 0.1.76`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `970ccb0bec5a11d5eff07ddaffc8f752cc792e6cd344253cffa4a4c99682004f`. Release APK SHA256 `242b6d0b1e86020ef0729f7272c8263128ff357f852a4e146435d07bd462a16c`.
- Deployed `index.html`, `static/app.js`, `static/styles.css`, `static/service-worker.js`, Android source/version files, APK/AAB artifacts, `PLAY_UPLOAD_COMMAND.txt`, and `docs/GOOGLE_PLAY_RELEASE.md` to `/opt/onecall-locator-dashboard`; live backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260623T171800Z-vetro-label-feature-info`.
- Verification passed: local `node --check static/app.js`, local and live `python3 -m py_compile server.py tools/*.py`, local Playwright smoke test against `127.0.0.1:8877` with no console/page errors, Gradle `test assembleRelease bundleRelease`, `aapt dump badging` showing version 77 / 0.1.76, `apksigner verify --verbose`, remote hashes matching local, `onecall-dashboard` active, public service-worker `200`, and public APK/AAB downloads `200` with matching SHA256. Authenticated zoomed-in label/popup behavior still needs manual logged-in browser and Play-installed app confirmation.

## Photo Address Editing And Layer Selection Priority - 2026-06-23

- Web dashboard photo markers now enlarge on hover and return to their normal subtle circle when the pointer leaves. Marker clicks still open the photo viewer and keep priority over ticket polygons.
- Location photo manual moves now save the new latitude/longitude and attempt to reverse-geocode the address. The editor supports address-first placement with selectable Arkansas address suggestions from `/api/map-search?limit=...`; coordinate edits can reverse-fill the address through `/api/reverse-geocode`.
- Location photo uploads merge returned photo records into the in-memory map immediately, then refresh the full photo library. Ticket attachment file selection now starts upload immediately after the file picker returns, without a second confirm/upload click, and refreshes location-photo markers afterward.
- VETRO and Vitruvi layers on the web dashboard, mobile map, restoration map, and in-house map now render in a high-priority Leaflet pane above ticket polygons and stop click propagation before polygon handlers can select the ticket polygon underneath.
- Native Android app ticket detail now loads ticket-attached location photos from `/api/location-photos` and shows them under the ticket. Selecting a photo opens a zoomable/pannable WebView image viewer. The native Android map also renders VETRO/Vitruvi in a higher pane. Android Auto canvas taps now test VETRO features before ticket polygons and show a car toast with the selected layer/feature.
- Bumped web cache-bust to `20260623154500` and rebuilt native Android as `versionCode 76`, `versionName 0.1.75`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `f2b35c5cb42aa96a6e56a4573e41647a9a10cc0851d731505d558765cf607d57`. Release APK SHA256 `c5abb022e5b746ca01422435ce9e779241e534d1d7cd7084883c7c486acb768e`.
- Deployed `server.py`, `index.html`, `static/app.js`, `static/service-worker.js`, Android source/version files, APK/AAB artifacts, `PLAY_UPLOAD_COMMAND.txt`, and `docs/GOOGLE_PLAY_RELEASE.md` to `/opt/onecall-locator-dashboard`; live backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260623T154500Z-photo-address-vetro-priority`.
- Verification passed: local `node --check static/app.js`, local and live `python3 -m py_compile server.py tools/*.py`, Gradle `:app:assembleRelease :app:bundleRelease`, remote hashes matching local for deployed files/artifacts, `onecall-dashboard` restarted and active, public HTTPS `200` for `/`, `/static/app.js?v=20260623154500`, `/static/service-worker.js`, and the current AAB, plus a system-Chrome Playwright login-page smoke check with no console warnings/errors. Authenticated map hover/click flows still need manual browser/on-device confirmation with a logged-in session.

## Location Photo Marker Tap Priority - 2026-06-23

- Web dashboard photo circles now render in a dedicated Leaflet `locationPhotoMarkersPane` above ticket polygons, using a shared canvas renderer and `L.DomEvent.stop(...)` on marker click. Tapping a photo circle on the dashboard opens the photo viewer instead of selecting the polygon underneath.
- The native Android app dashboard map now fetches `/api/location-photos`, draws location-photo circles in a higher Leaflet `photoPane`, and opens an in-map photo preview popup with the image, ticket/location/address detail, and an `Open photo` link. Photo marker clicks stop the original event so ticket polygons underneath do not receive the tap.
- Bumped the web cache-bust to `20260623133000` and rebuilt the native app as `versionCode 75`, `versionName 0.1.74`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `ffd90b5a6a554eab01d00324ba24eca2ee77a65b05af41d080e79d32dfae78da`. Release APK SHA256 `5a5a18c32590b263dc4462f26830dfbe0860eb015d8b90eee4390d5288b9e333`.
- Deployed `index.html`, `static/app.js`, `static/service-worker.js`, Android `build.gradle`, Android `MainActivity.java`, current APK/AAB artifacts, `PLAY_UPLOAD_COMMAND.txt`, and `docs/GOOGLE_PLAY_RELEASE.md` to `/opt/onecall-locator-dashboard`; live backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260623T133000Z-photo-marker-tap-priority`.
- Verification passed: local `node --check static/app.js`, local and live `python3 -m py_compile server.py tools/*.py`, Gradle `:app:assembleRelease :app:bundleRelease`, remote hashes matching local for all deployed files/artifacts, `onecall-dashboard` restarted and active, and public HTTPS returned `200` for `/`, `/static/app.js?v=20260623133000`, `/static/service-worker.js`, and the current AAB.

## Android Auto Heading-Up Live Map - 2026-06-23

- Added Google-Maps-style heading-up follow mode to the Android Auto live map without replacing the existing renderer or changing the saved dashboard styling. While following and moving faster than `1.5 m/s`, the map uses fused-location GPS bearing, smooths bearing changes, and rotates the base tiles, VETRO layers, ticket polygons, locator notes, ticket pins, and current-location arrow together around the vehicle.
- Added a compact north compass on the map surface. The normal top action strip now has `Tickets`, `Follow/Following`, and `North`/`Heading`; the map action strip remains only the built-in `Action.PAN` for Android Auto host compatibility. No zoom buttons were added; double-tap/pinch zoom remains the supported zoom path.
- Follow-up fix after Reed saw Android Auto stuck on `Loading tickets...`: Android Auto now starts directly on `CarLiveMapScreen` instead of blocking on `TicketListScreen`; the root map's `Tickets` action opens the ticket list; the ticket list also shows an `Open live map` row during loading/errors; native API GET timeout is now `20s` with an `8s` connect timeout so slow dashboard calls fail over to cache or visible errors faster instead of waiting for the old `180s` read timeout.
- Live ADB diagnosis on Reed's Samsung `SM-S906U` at `192.168.50.173:37879` showed the Play-installed `versionCode 71`, `versionName 0.1.70` build was installed by `com.android.vending`, had `MAP_TEMPLATES`, `ACCESS_SURFACE`, fine/coarse location, and `INTERNET` granted, and Android Auto could discover `FiberLocatorCarAppService`. The Android Auto crash was an app heap OOM while stringifying the huge `/api/vetro` response for SharedPreferences caching: `TicketRepository.cacheJson()` from `loadVetroMapFeatures()`.
- Added server endpoint `/api/vetro-car` for Android Auto. It uses the same VETRO source layers, keeps only native-renderer/filter properties, simplifies line/ring coordinates, and leaves the existing web `/api/vetro` endpoint unchanged. Native Android Auto now requests `/api/vetro-car`, does not cache any VETRO endpoint in SharedPreferences, paints tickets/location/map first, and loads VETRO asynchronously so VETRO failure cannot crash the car app.
- Bumped native Android to `versionCode 72`, `versionName 0.1.71`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `4db5f623898238360d79c430bb2544787c6af4a9485ae5913182dd1fc1e1d696`. Release APK SHA256 `e7230e6394114942e942fb6d3ee27850fc90335f77d65e870ee5d516960625fc`.
- Deployed `server.py` and current Android release artifacts to `root@5.78.214.184:/opt/onecall-locator-dashboard`; backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260623T155912Z-android-auto-vetro-car`. Remote `server.py`, AAB, and APK hashes match local; `onecall-dashboard` restarted and is active; public AAB/APK downloads match local SHA256; unauthenticated `/api/vetro-car` returns expected `401 Login required`.
- Verification passed: local and live `python3 -m py_compile server.py tools/*.py`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle -p android-auto :app:compileDebugJavaWithJavac`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle -p android-auto :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing version 72 / 0.1.71, and `apksigner verify --verbose`. Phone app diagnostic launch of the current Play `0.1.70` build stayed running with WebView drawing and no filtered `AndroidRuntime` crash after launch. The `0.1.71` Android Auto fix still needs Google Play Internal testing upload/install before head-unit runtime validation.
- Follow-up: Reed reported Play had already used `versionCode 71`, then asked for Android Auto map gesture zoom. Built fresh `versionCode 74`, `versionName 0.1.73` after restoring double-tap zoom and anchoring pinch zoom around the gesture focus point, including while heading-up rotation is active. Current Play upload AAB SHA256 is `35488fb91b5adf17a7fd82c0e8a8f85f61b9f9f88b8d694b7123fa802fff6e55`; release APK SHA256 is `7b0adb03fbd1a19e388cc24104e58603b21f0fb1061682c9263f928c1102f6b3`. Cloud AAB/APK and public AAB download hashes match local. Verification passed: Gradle `:app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing version 74 / 0.1.73, and `apksigner verify --verbose`.

## Admin Account Invites And GeoCall Progress Bar - 2026-06-23

- Admin Console account setup now supports both employee and admin setup links. The existing setup-link form is now labeled `Account setup links` and includes an `Account type` selector with `Employee` and `Admin`.
- Setup links now carry the selected role through the auth invite. When an admin invite is completed, the created account gets role `admin`; employee invites still create role `employee`.
- The setup page is role-aware, so admin links show admin setup wording instead of hardcoded employee wording.
- GeoCall ticket fetch now runs as a background job with server-side progress state. The Admin Console polls `/api/admin/geocall-fetch?job=<id>` and shows a progress bar, percentage, current ticket, and running log while pages/polygons are being fetched.
- Deployed `server.py`, `index.html`, `static/app.js`, and `static/styles.css` to `/opt/onecall-locator-dashboard`; live backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260623T142558Z-admin-invite-progress`.
- Verification passed: local `python3 -m py_compile server.py tools/*.py`, local `node --check static/app.js`, local Playwright/System Chrome admin-console smoke test with no page or console errors, live remote Python compile, live hashes matching local for deployed files, `onecall-dashboard` active, and public HTTPS `/` returned `200`.

## Admin GeoCall Large Batch Fetch Limit - 2026-06-23

- Raised the admin console GeoCall ticket fetch limit from `75` tickets to `1,000` tickets so Reed can paste large Outlook ticket-number exports directly into the dashboard.
- Added named server constants for the limit and timeout. Large batches now get a scaled subprocess timeout up to `3,600` seconds instead of the old fixed `240` second timeout.
- Updated the admin console text to say `Paste up to 1,000 ticket numbers` and warn that large batches can take several minutes.
- Deployed `server.py` and `index.html` to `/opt/onecall-locator-dashboard`; live backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260623T134343Z-admin-geocall-1000`.
- Verification passed: local and live `python3 -m py_compile server.py tools/*.py`, local `node --check static/app.js`, live hashes match local for `server.py` and `index.html`, `onecall-dashboard` restarted and is active, public HTTPS `/` returns `200`, and live Python confirms `ADMIN_GEOCALL_MAX_TICKETS == 1000`.

## Web Dashboard Field Cockpit / GIS Improvement Pass - 2026-06-23

- Added a research-informed field cockpit to the web dashboard: open, due today, next due, high risk, needs attention, and photo counters now appear above the ticket queue and act as quick filters through the existing search flow.
- Added client-side ticket risk and quality scoring without replacing Reed's existing color-coded priority system. Existing TCW/DMI orange, emergency red, remark purple, renewal blue, due-date, actioned, and map polygon color logic are preserved.
- Ticket cards now show compact risk, photo, note, and quality chips. The selected-ticket detail now shows a risk/due summary, quality checks, and an evidence timeline before the longer raw ticket fields.
- Added desktop map workflow controls for preset views (`Locate`, `Fiber`, `Photos`, `Restoration`) plus Google Maps route buttons for selected and due tickets with coordinates. The planner is hidden on narrow screens to avoid crowding the existing mobile map/detail layout.
- Verification passed locally: `node --check static/app.js`, `python3 -m py_compile server.py tools/*.py`, and Playwright with system Chrome against `127.0.0.1:8877` in desktop and mobile viewports. Browser smoke checks rendered the cockpit/planner/ticket risk badges with no page or console errors. Local auth was disabled only for the test run with `--auth-file /tmp/fiber-dashboard-noauth.json`.
- Deployed `index.html`, `static/app.js`, `static/styles.css`, `static/service-worker.js`, `HANDOFF.md`, and `docs/WEB_DASHBOARD_GIS_IMPROVEMENT_IDEAS.md` to `/opt/onecall-locator-dashboard`; live backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260623T121956Z-web-field-cockpit`. Live hashes match local for the deployed web files, remote `python3 -m py_compile server.py tools/*.py` passed, `onecall-dashboard` restarted and is active, and public HTTPS returned `200` for `/`, `/static/app.js?v=20260623072000`, and `/static/styles.css?v=20260623072000`.

## Android Auto Visibility / Recent Ticket Restore - 2026-06-22

- Reed reported the Play-installed Android Auto app was not showing up at all and that one or two tickets disappeared from the mobile web dashboard.
- Phone verification showed `com.fiberlocator.auto` was Play-installed as `versionCode 68`, `versionName 0.1.67`, installer `com.android.vending`, with the Play signature, and Android package manager could still discover `FiberLocatorCarAppService`. Android Auto/Gearhead still had a same-day failure history entry, so version 69 restores the manifest app/service icons back to `@mipmap/ic_launcher` / `@mipmap/ic_launcher_round`, matching the icon form used before the visibility regression.
- Bumped native Android to `versionCode 69`, `versionName 0.1.68`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `9eba65444154a56395a504a5fb04e60654020b3b332ea37134e897941b5b65c6`. Release APK SHA256 `b3090884c0f6684a2e7a663eceee8b1843d85184d63632929922126979f53fb4`.
- Restored four tickets that were marked `clear` today and therefore disappeared from normal active dashboard views: `260619-1080`, `260622-0467`, `260622-0646`, and `260622-0774`. Backup before the state edit: `/opt/onecall-locator-dashboard/data/deploy_backups/20260622T141000Z-restore-recent-clear-tickets/dashboard_state.json`.
- Verification passed: live state confirms those four tickets have no action, are not hidden, and are not archived; `onecall-dashboard` restarted and is active; Gradle `assembleRelease bundleRelease` passed; `aapt dump badging` shows version 69 / 0.1.68; `apksigner verify --verbose` passed; compiled manifest check shows `FiberLocatorCarAppService`, `MAP_TEMPLATES`, `ACCESS_SURFACE`, POI, and IOT are present.

## Android Auto Follow Button / Play-Only Install Correction - 2026-06-22

- Reed reported the Android Auto map opened but did not show a Follow/Following button, actions could still throw errors, and later the app no longer appeared in Android Auto after local ADB sideload testing.
- Important correction: Android Auto must be tested from the Google Play installed build. Direct ADB sideload can install the phone package but Android Auto/Gearhead may hide or filter it, and it also uses the local upload-key signature instead of Play App Signing.
- Added a conservative `Follow` / `Following` top action on the Android Auto live map while keeping the host-safe template: top actions are `Tickets` and `Follow/Following`; map action strip remains built-in `Action.PAN`; tapping a ticket now highlights/centers it on the surface without forcing a selected-ticket pane/template rebuild.
- Fixed native Android login when `Remember me` is unchecked. The prior flow saved an empty password before calling login, so the current sign-in attempt could fail. The app now keeps the entered password in memory for the current process only and still avoids persisting it when Remember Me is off.
- Bumped native Android to `versionCode 68`, `versionName 0.1.67`; built release APK/AAB locally. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `49c6bb40e6556b9061600e40dd7f53219c82b0eb83e27eda1a17d09baf5d30f6`. Release APK SHA256 `8168434a85520d67424532e31651f8fe011184a18b7caea1077b60c7065fc8e9`.
- Deployed Android source/artifacts and Play upload notes to `/opt/onecall-locator-dashboard`; backup path: `/opt/onecall-locator-dashboard/data/deploy_backups/20260622T135500Z-android-auto-follow-login-play-v68`. Live SSH and public HTTPS hashes match local for both APK and AAB, and `onecall-dashboard` is active.
- The local ADB-sideloaded package was uninstalled from Reed's connected phone so Google Play can reinstall/update `com.fiberlocator.auto` without signature conflict. Next runtime verification must be from Google Play Internal testing / Play-installed app.
- Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle -p android-auto assembleRelease bundleRelease`, `aapt dump badging` showing `versionCode 68` / `versionName 0.1.67`, `apksigner verify --verbose`, live SSH hashes, public HTTPS hashes, and ADB package check showing the sideloaded `com.fiberlocator.auto` package removed.

## Android Auto Safe Template Recovery - 2026-06-22

- Reed reported that after the icon-action crash fix, Android Auto would not open the app at all and immediately showed `Fiber Locator has encountered an unexpected error`.
- Removed the risky custom icon actions/resources entirely and restored the live map template to the known-safe Android Auto pattern: top action strip only has `Tickets`, and the map action strip only uses built-in `Action.PAN`.
- Kept the underlying map-rendering improvements from the prior pass: selected ticket focus/highlight, VETRO zoom-aware declutter/path simplification, cached GET fallback, and location accuracy/heading drawing.
- Bumped native Android to `versionCode 66`, `versionName 0.1.65`; deployed Android `build.gradle`, `CarLiveMapScreen.java`, removed live `ic_auto_*.xml` resources, and rebuilt APK/AAB to `/opt/onecall-locator-dashboard`. Backup path: `/opt/onecall-locator-dashboard/data/deploy_backups/20260622T154000Z-android-auto-map-safe-template-recovery`.
- Verification passed: `python3 -m py_compile server.py tools/*.py`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 66` / `versionName 0.1.65`, `apksigner verify --verbose`, live SSH hashes matching local for source/APK/AAB, public APK/AAB returning `200`, and `onecall-dashboard` active.
- Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `7a1833f25d132ca79b0e1651cf76e316057e34d1df908e7313c7ea9113507e02`. Release APK SHA256 `745def046dda4c169b7ec4a3b15a9d8ce80c20f5d489a3cb159350a199ea10fa`.

## Android Auto Live Map Crash Fix - 2026-06-22

- Reed reported Android Auto live map opened with an error and closed the app after the map-control changes.
- Likely runtime cause was Android Auto host template validation rejecting multiple text-label actions on the map/action strips. Gradle build does not catch this class of host validation issue.
- Converted the map controls and secondary top actions to icon actions with accessibility titles, leaving only `Tickets` as the text label action. Added vector drawables for refresh, day/night, follow, work area, zoom in/out, located, and review.
- Bumped native Android to `versionCode 65`, `versionName 0.1.64`; deployed Android `build.gradle`, `CarLiveMapScreen.java`, new `ic_auto_*.xml` drawable icons, and rebuilt APK/AAB to `/opt/onecall-locator-dashboard`. Backup path: `/opt/onecall-locator-dashboard/data/deploy_backups/20260622T152800Z-android-auto-map-icon-action-crash-fix`.
- Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 65` / `versionName 0.1.64`, `apksigner verify --verbose`, live SSH hashes matching local for source/icons/APK/AAB, public APK/AAB returning `200`, and `onecall-dashboard` active.
- Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `b70e00700d7463ab002cc2d9f2b07c88e8059578431f795a921ad332ab2c4227`. Release APK SHA256 `30b406ccd6c1ae84b77b306d2e8a162d307feb1a1d37e9ba41fe94d9d58a9229`.

## Android Auto Map Workflow / Performance / Offline Pass - 2026-06-22

- Implemented Reed's requested Android Auto improvements 3 through 7, holding off on location-photo/note context and any MapLibre/Google Maps SDK rewrite.
- Selected-ticket workflow: tapping a ticket marker or polygon now selects/focuses the ticket instead of immediately opening detail. The selected ticket is highlighted on the map and the pane exposes `Navigate` and `Detail`; the top strip switches to `Located` and `Review` actions for the selected ticket.
- VETRO readability/performance: added zoom-aware VETRO feature visibility so major lines remain available earlier and service/drop point clutter waits until closer zoom; path simplification is more aggressive at low zoom.
- Offline/poor-signal fallback: Android `TicketRepository` now caches successful GET responses for state, tickets, locator notes, VETRO, and map config in SharedPreferences and falls back to the cached response for up to 7 days when a GET fails. Map status displays `cached` when any cached payload was used.
- Location marker: current location now draws an accuracy ring and a heading arrow when bearing/speed are available.
- Bumped native Android to `versionCode 64`, `versionName 0.1.63`; deployed Android `build.gradle`, `CarLiveMapScreen.java`, `TicketRepository.java`, and rebuilt APK/AAB to `/opt/onecall-locator-dashboard`. Backup path: `/opt/onecall-locator-dashboard/data/deploy_backups/20260622T151500Z-android-auto-map-workflow-performance-offline-location`.
- Verification passed: `python3 -m py_compile server.py tools/*.py`, live `python3 -m py_compile server.py`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 64` / `versionName 0.1.63`, `apksigner verify --verbose`, live SSH hashes matching local for source/APK/AAB, public APK/AAB returning `200`, and `onecall-dashboard` active.
- Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `81d6b5fcc88c9cc5c6b9ac4a4ab7088fb81bd17c71e086a5281e0985e7078ca8`. Release APK SHA256 `ce26423ab7c1f91c451e162447199b7b99e9afccdd43d6e35e1e64567ae241b7`.

## Android Auto Map Controls And Manual Night Mode - 2026-06-22

- Reed wanted Android Auto day/night mode controlled by a button instead of following the head unit, plus car-safe map controls except Layers.
- Updated `CarLiveMapScreen` so the map starts in Day mode and uses a `Night` / `Day` action to manually toggle night tiles/colors. It no longer auto-switches from head-unit dark mode or solar time.
- Added Android Auto map controls: `Follow`/`Following`, `Work`, `+`, `-`, plus top actions for `Refresh`, `Night`/`Day`, and `Tickets`.
- Bumped native Android to `versionCode 63`, `versionName 0.1.62`; deployed Android `build.gradle`, `CarLiveMapScreen.java`, and rebuilt APK/AAB to `/opt/onecall-locator-dashboard`. Backup path: `/opt/onecall-locator-dashboard/data/deploy_backups/20260622T143500Z-android-auto-map-controls-night-toggle`.
- Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 63` / `versionName 0.1.62`, `apksigner verify --verbose`, live SSH hashes matching local for source/APK/AAB, public APK/AAB returning `200`, and `onecall-dashboard` active.
- Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `a1df10eb269a119f15134334379d55dadf8d814046f5c08688c473000a80f7a3`. Release APK SHA256 `c4bb2e7fef97ff6e7d144f880e59384c8142e013cf52970925de08d73bfc6be4`.

## Arkansas-Only Location Photo Coordinates - 2026-06-22

- Reed reported uploaded location photos plotting in the ocean or outside Arkansas. Added a backend Arkansas-only coordinate gate for location photos, using `33.0..36.55` latitude and `-94.7..-89.55` longitude.
- Future photo uploads now accept only Arkansas-valid coordinates from EXIF, Timestamp Camera OCR, or manual fallback. If EXIF is outside Arkansas, upload falls through to OCR/manual; if no source is Arkansas-valid, the photo is saved without a plotted coordinate and marked `needs_review` instead of being placed wrong.
- Manual photo edits through `/api/location-photos/manage` now reject coordinates outside Arkansas with `Photo coordinates must be inside Arkansas.`
- Deployed `server.py` to `/opt/onecall-locator-dashboard`; backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260622T141500Z-arkansas-photo-coordinate-rule/server.py`.
- Cleaned the live photo index after backing it up to `/opt/onecall-locator-dashboard/data/location_photos/photos.before-arkansas-coordinate-cleanup-20260622T141500Z.json`. Cleared 44 existing out-of-Arkansas plotted coordinate pairs, preserved them as `rejected_lat` / `rejected_lng`, set `coordinate_source` to `rejected_outside_arkansas`, and marked those photos `needs_review`.
- Verification passed: local and live `python3 -m py_compile server.py`; live `onecall-dashboard` active; live `photos.json` has 425 photos, 273 mapped, 152 unmapped, 44 rejected outside Arkansas, and `0` mapped photos outside Arkansas.

## Location Photo Editor / Viewer - 2026-06-22

- Added a shared web location-photo viewer/editor usable from dashboard map popups, ticket photo summaries, and the Location Photos page. Photos can now be viewed fit-to-screen, edited for ticket/label/address/status/note/coordinates, geocoded through `/api/map-search`, moved by clicking the dashboard/photo map, and dragged directly on the Location Photos map.
- Android WebView photo handling was improved with overview/wide-viewport and built-in pinch zoom settings. Native Android was bumped to `versionCode 62`, `versionName 0.1.61`.
- Web cache-bust/service-worker cache version is `20260622133000`.
- Deployed `index.html`, `static/app.js`, `static/styles.css`, `static/service-worker.js`, Android `build.gradle`, Android `MainActivity.java`, and rebuilt release APK/AAB to `/opt/onecall-locator-dashboard`; backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260622T133000Z-location-photos-editor`.
- Verification passed: `python3 -m py_compile server.py tools/*.py`, `node --check static/app.js`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 62` / `versionName 0.1.61`, `apksigner verify --verbose`, live SSH hashes matching local for deployed web/source/APK/AAB files, no root-level stray static files, public cache-busted JS/CSS/service-worker/APK/AAB returning `200`, and `onecall-dashboard` active.
- Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `a806520d052f28efb17cf32ad35603b91ebf48b23b954450976daa793dfb11de`. Release APK SHA256 `1b55fa53c046ded138a677cef5862408992443b8444d24f1be17b975187c6111`.

## App View VETRO Filter Repair - 2026-06-21

- Reed reported duplicate-looking VETRO layers on the locator web interface and app.
- Verified live VETRO layer files were not duplicated: `Layer_17 13399`, `Layer_26 8544`, `Layer_28 7130`, `Layer_42 7507`, `Layer_43 58`, `Layer_654 13541`, `Layer_659 2`, with `0` duplicate stable-ID groups on every layer.
- Root cause was saved view state, not layer geometry: the live `app view` and `appew2` presets were missing VETRO filter keys, so app/saved-view loading could fall back to the full VETRO set while `locator_default` and `employee_dashboard` were correctly filtered.
- Backed up live state before edits to `/opt/onecall-locator-dashboard/data/dashboard_state.before-app-vetro-filter-repair-20260621T215809Z.json` and `/opt/onecall-locator-dashboard/data/dashboard_state.before-appish-vetro-filter-repair-20260621T215833Z.json`.
- Copied only VETRO filter keys from `locator_default` into the app-related presets. Style keys were preserved; no color/size/opacity reset was performed.
- Verification after repair: `locator_default`, `employee_dashboard`, `app view`, and `appew2` all show the same filtered VETRO count of `50121` features: `Layer_17 13399`, `Layer_42 7507`, `Layer_28 7130`, `Layer_654 13541`, `prefix:SL 1165`, `Layer_26 7379`; excluded full-set layers `Layer_43 58` and `Layer_659 2` no longer leak into the app presets.
- Deployed code already had the permanent allowlist guardrail (`VIEW_PRESET_STATE_KEYS.update(VETRO_VIEW_FILTER_KEYS)` and `strip_vetro_view_filters()` preserving state), so this was a live state repair only. `onecall-dashboard` restarted and is `active`; unauthenticated public checks returned expected `/login` redirect for `/` and `401` for `/api/vetro`.

## High-Definition VETRO Capture Merge - 2026-06-19

- Reed asked for the best/highest-definition available geometry pieces from the fresh VETRO curl capture to be saved permanently across every dashboard VETRO layer.
- Replayed the authenticated VETRO tile capture transiently and decoded 371 tile requests across layers 17, 26, 28, 42, 43, 654, and 659. The replay decoded 23,182 tile features from 242 nonempty tiles.
- Built a staged high-definition merge by stable VETRO/feature ID. For same-ID line/polygon pieces, the merge prefers highest zoom but merges same-ID pieces at that zoom first so clipped high-zoom tile fragments do not replace a more complete saved geometry.
- Deployed the staged layer folder to the live host. Live backup before replacement: `/opt/onecall-locator-dashboard/data/layers/backups/vetro_geojson_layers.before-highdef-capture-20260619T203213Z`.
- Live counts after deployment: `Layer_17 13399`, `Layer_26 8544`, `Layer_28 7130`, `Layer_42 7507`, `Layer_43 58`, `Layer_654 13541`, `Layer_659 2`.
- Updated high-definition feature counts tagged with `highdef_capture_update=2026-06-19`: `Layer_17 3223`, `Layer_26 328`, `Layer_28 963`, `Layer_42 2029`, `Layer_43 3`, `Layer_654 2470`, `Layer_659 0`.
- Verification passed: all live layer files read cleanly, duplicate stable-ID groups are `0` on every layer, `onecall-dashboard` restarted and is `active`.
- Temporary replay/staging folders and the temporary MVT Python virtualenv under `/tmp` were removed after deployment to avoid filling the session/host. VETRO cookie/session data was used only transiently and was not written into repo files or handoff notes.
- Follow-up zoomed capture from `data/private/vetro_captures/fresh-zoomed-curls.txt` was processed the same day. The capture had 1,620 authenticated VETRO tile requests; replay decoded 30,922 features from 773 nonempty tiles with 0 tile failures.
- The zoomed high-definition merge replaced 11,924 same-stable-ID features in place, added 0 features, kept 1,418 existing live geometries where the zoomed capture looked less complete, and kept layer counts unchanged.
- Live backup before the zoomed replacement: `/opt/onecall-locator-dashboard/data/layers/backups/vetro_geojson_layers.before-zoomed-highdef-capture-20260619T224336Z`.
- Live zoomed high-definition feature tags after deployment: `Layer_17 3972`, `Layer_26 428`, `Layer_28 1569`, `Layer_42 2785`, `Layer_43 4`, `Layer_654 3165`, `Layer_659 1`.
- Zoomed deploy verification passed: live counts remained `Layer_17 13399`, `Layer_26 8544`, `Layer_28 7130`, `Layer_42 7507`, `Layer_43 58`, `Layer_654 13541`, `Layer_659 2`; duplicate stable-ID groups were `0` on every layer; `onecall-dashboard` restarted and is `active`.
- The uploaded 129 MB curl capture, temporary staged layers, and temporary MVT Python virtualenv were deleted after verification to avoid filling the session/host. VETRO cookie/session data was not written into repo files or handoff notes.

## Targeted VETRO Layer 654 Repair For D-00047616 - 2026-06-19

- Reed reported that construction route `D-00047616` / VETRO ID `daa56150-e601-4e64-985f-753b479376a9` was only partially showing, with nearby Layer 654 features showing similar partial fragments.
- Verified the issue was not caused by the earlier fragment cleanup: the live Layer 654 file and the pre-cleanup backup both had `563` nearby features in the checked neighborhood, with `0` nearby removals.
- Replayed Reed's authenticated z17 tile captures transiently and decoded only Layer 654 tiles around `/maps/17/31790..31792/52691..52692`.
- Staged a same-stable-ID-only geometry repair: replaced 7 shorter Layer 654 geometries with longer z17 geometries, added 0 features, and kept Layer 654 count unchanged at `13541`.
- `D-00047616` now has two longer z17 segments: `e374f761-2bf6-4436-b1a8-41280395a3c9` is about `64.0m`, and `daa56150-e601-4e64-985f-753b479376a9` is about `55.45m`; both are sourced from tile `17/31791/52691`.
- Live backup before replacement: `/opt/onecall-locator-dashboard/data/layers/backups/Layer_654.before-d00047616-targeted-.geojson`.
- Verification passed: live Layer 654 count `13541`, duplicate stable-ID groups `0`, `onecall-dashboard` restarted and is `active`, and public HTTPS returned the expected unauthenticated redirect (`302`).
- Note: VETRO cookie/session data was used only transiently for tile replay and was not written into repo files or handoff notes.

## Live VETRO Fragment Cleanup - 2026-06-19

- Reed asked to update VETRO without losing or duplicating layers and to fix old fragments.
- Added `tools/cleanup_vetro_fragments.py`, which groups VETRO features by stable layer/feature ID and merges old split line/polygon fragments with Shapely, while preserving one best property record.
- Cleaned the live VETRO layer folder from a local copy of the current deployed baseline, then synced the cleaned folder back to `/opt/onecall-locator-dashboard/data/layers/vetro_geojson_layers`.
- Live backup before replacement: `/opt/onecall-locator-dashboard/data/layers/backups/vetro_geojson_layers.before-fragment-cleanup-20260619T194957Z`.
- Cleanup removed 1,116 old duplicate fragments total: Layer 17 went from `14084` to `13397`; Layer 654 went from `13970` to `13541`. Layers 26, 28, 42, 43, and 659 kept the same counts.
- Verified live counts and duplicate stable-ID groups after deploy: `Layer_17 13397 / dup groups 0`, `Layer_26 8542 / 0`, `Layer_28 7130 / 0`, `Layer_42 7507 / 0`, `Layer_43 58 / 0`, `Layer_654 13541 / 0`, `Layer_659 2 / 0`.
- Verification passed: `python3 -m py_compile tools/cleanup_vetro_fragments.py tools/import_vetro_tiles_from_capture.py server.py` locally and on the live host, `onecall-dashboard` restarted and is `active`, and public `https://fiber-locator.5-78-214-184.sslip.io/` returned `200`.
- Note: the pasted VETRO session/cookie was used only transiently for attempted replay validation and was not written into repo files or handoff notes. The full replay update was stopped before deployment because serial tile replay was too slow; no live layers were touched until after the fragment-cleaned staged folder was validated.

## Android Auto Map Conservative Template And Dashboard Photo Markers - 2026-06-19

- Reed reported Android Auto still closed every time the map was opened. Researched current Android Auto action-strip/template constraints: map templates can allow up to 4 actions, but only one label button per template, and map action strips should be limited to map-control actions. The prior toggle attempts added unsupported/too-many label interactions.
- Fixed `CarLiveMapScreen` to use a conservative template: one normal `Tickets` label action, `Action.PAN` as the only map action-strip item, no clickable pane rows, and no day/night toggle action. The Android Auto map is forced to daytime style by returning `false` from `isNightMap()`, removing the host dark-mode issue without adding another car-template interaction.
- Bumped native Android to `versionCode 61`, `versionName 0.1.60`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `f7e058cf301b88ca1a01e92c6b57f20ef511304955f3d0f286c4937cfa24077e`. Release APK SHA256 `b6389f13d17a72ea72bb00b2f4fd880b3de0b9f9a01582d69e16e23742decd33`.
- Added main dashboard map markers for stored Location Photos. Photos with saved coordinates now render as tiny low-opacity white/dark dots in a separate layer below ticket markers, so they stay discreet and do not cover ticket/VETRO layers.
- Clicking a photo marker opens a compact popup with a thumbnail, metadata, editable latitude/longitude fields, `Save location`, `Move on map`, and `Open`. `Move on map` arms the next dashboard map click as the corrected photo coordinate. The existing `/api/location-photos/manage` endpoint now accepts validated `lat`/`lng` updates and marks the coordinate source as `manual_adjusted`.
- Web cache bust/service-worker cache version is `20260619144500`.
- Deployed `server.py`, `index.html`, `static/app.js`, `static/styles.css`, `static/service-worker.js`, changed Android Auto source, and rebuilt APK/AAB to `root@5.78.214.184:/opt/onecall-locator-dashboard`; backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260619T150839Z-map-crash-photo-markers`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py tools/export_vetro_google_earth_layers.py`, `node --check static/app.js`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 61` / `versionName 0.1.60`, `apksigner verify --verbose`, live SSH hashes matching local for web/source/APK/AAB, live remote Python compile, `onecall-dashboard` active, public APK/AAB returning `200` with matching SHA256, and public `/` / cache-busted JS returning `200` (unauthenticated JS body redirects to login, while SSH hash verifies the protected static file).
- Device validation note: `adb devices -l` showed no attached devices, so no live Android Auto crash-log or visual runtime validation could be completed from this shell. Local browser smoke testing reached the login page without frontend errors; authenticated dashboard visual testing was not possible without a browser login session.

## Android Auto Map Toggle Crash Fix - 2026-06-19

- Reed reported Android Auto closed/failed when opening the map after the manual day/night toggle build.
- Likely cause: the `0.1.56` build placed a regular text action in the Android Auto map action strip alongside `Action.PAN`. Android Auto map action strips are stricter than the normal action strip and can reject unsupported actions/templates at runtime.
- Fixed `CarLiveMapScreen` by restoring the map action strip to `Action.PAN` only. The day/night override remains available as a normal selectable row in the map content pane labeled `Day map` / `Night map`, which avoids the map-template action-strip constraint.
- Bumped native Android to `versionCode 58`, `versionName 0.1.57`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `eec7d8275036d66da56e9c348bfcf1b2a0d753264a4e7ee5032c375d1e552579`. Release APK SHA256 `a7a2a2375c3c60ec438f4d571e500ea709b113b81ddc25e65a5cfb3a9896cd60`.
- Deployed changed Android Auto source and rebuilt APK/AAB to `root@5.78.214.184:/opt/onecall-locator-dashboard`; backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260619T140107Z-android-auto-map-toggle-pane-fix`.
- Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 58` / `versionName 0.1.57`, `apksigner verify --verbose`, live SSH hashes matching local for source/APK/AAB, public APK/AAB returning `200` with matching SHA256, and `onecall-dashboard` active.
- Device validation note: `adb devices -l` showed no attached devices, so no live Android Auto crash-log or visual runtime validation could be completed from this shell.
- Follow-up correction: Reed noted version code `58` was already used. Bumped the same crash-fix build to `versionCode 59`, `versionName 0.1.58`, rebuilt, and deployed the new APK/AAB. Current Play upload AAB SHA256 is `1169eff2e2b5f535e303612344d11f74211ffd1f5ef16f7304216cf61c852393`; release APK SHA256 is `0a46e09c8285d4a845acd2dc648275973048018ecc98081dc26c35ea82734649`. Live backup before the version-only artifact update is `/opt/onecall-locator-dashboard/data/deploy_backups/20260619T143543Z-android-auto-version-59`. Verification passed: `aapt dump badging` showed `versionCode 59` / `versionName 0.1.58`, Gradle build passed, APK signature verified, live hashes matched local, public APK/AAB returned `200` with matching SHA256, and `onecall-dashboard` remained active.

## Android Auto Manual Day/Night Map Toggle - 2026-06-19

- Reed reported the Android Auto map still showed `Fiber night map` during daytime and asked for a small toggle to switch back and forth.
- Added a manual day/night override to `CarLiveMapScreen`. The map action strip now includes a `Day map` / `Night map` button next to pan mode. Tapping it flips the Android Auto map between the normal daytime basemap and the dark night basemap, overriding the host dark-mode value for that map screen.
- Bumped native Android to `versionCode 57`, `versionName 0.1.56`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `ad854d666fcf0f9b6e7fb7be3cf49a1006dbc2d4141b7935de8498850f7ba626`. Release APK SHA256 `e025b91df8312a23b40e61c8ac593ca724f57940401af008427dbc287ef370be`.
- Deployed changed Android Auto source and rebuilt APK/AAB to `root@5.78.214.184:/opt/onecall-locator-dashboard`; backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260619T133610Z-android-auto-map-toggle`.
- Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 57` / `versionName 0.1.56`, `apksigner verify --verbose`, live SSH hashes matching local for source/APK/AAB, public APK/AAB returning `200` with matching SHA256, and `onecall-dashboard` active.
- Device validation note: `adb devices -l` showed no attached devices, so no live Android Auto runtime visual test could be completed from this shell.

## Android Auto Night Map Daytime Revert Fix - 2026-06-19

- Reed reported the Android Auto map stayed dark during daytime after the automatic night-mode change.
- Root cause: the Android Auto renderer used `CarContext.isDarkMode()` plus a custom civil-twilight fallback. The fallback could keep the dark tile style active even when the car/phone host was no longer in night mode.
- Fixed `CarLiveMapScreen.isNightMap()` to use only Android Auto host dark mode (`getCarContext().isDarkMode()`). When the host is not in dark mode, the map immediately returns to the saved normal/published daytime basemap style.
- Bumped native Android to `versionCode 56`, `versionName 0.1.55`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `5de47010c70a73310f0ad9ebaa56546a9588190a4eab9f709e02a3343e6f86f1`. Release APK SHA256 `c4d9a5f3a82f3829c8fb2961d09bbb1167a0c37ba840c15e73c606bab5a5c07f`.
- Deployed changed Android Auto source and rebuilt APK/AAB to `root@5.78.214.184:/opt/onecall-locator-dashboard`; backup path is `/opt/onecall-locator-dashboard/data/deploy_backups/20260619T132123Z-android-auto-night-mode`.
- Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 56` / `versionName 0.1.55`, `apksigner verify --verbose`, live SSH hashes matching local for source/APK/AAB, public APK/AAB returning `200` with matching SHA256, and `onecall-dashboard` active.

## Android Auto Automatic Night Map Mode - 2026-06-18

- Reed asked for Android Auto live map night mode that automatically switches to a dark, sleek, fast map style at dusk.
- Researched Android Auto/day-night handling and kept the implementation inside the existing custom `SurfaceCallback` renderer for speed. The car map now uses Android Auto host dark mode first via `CarContext.isDarkMode()`, with a lightweight civil-twilight dusk/dawn fallback based on current location or map center when host dark mode is not already active.
- Night mode switches the Android Auto tile style to Mapbox `navigation-night-v1` when the dashboard Mapbox token is available, otherwise Carto `dark_all` raster tiles. This avoids adding a new rendering SDK and keeps the existing 4-thread tile loading/cache path.
- Tile cache keys now include the effective day/night style and the cache is cleared when day/night mode flips, preventing stale day tiles from remaining after dusk. The HUD changes from `Fiber live map` to `Fiber night map`, and the base canvas/grid colors use darker night-safe contrast.
- Bumped native Android to `versionCode 55`, `versionName 0.1.54`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `491e139f29cdfb2ef323dd0f8a5a0e2cd899f04429fed0d31b557e766c3e28ac`. Release APK SHA256 `16ee43c27b0c7debccd6022194ed87f0cfad482535c0b37f45daa6864dd3b8da`.
- Deployed changed Android Auto source and rebuilt APK/AAB to `/opt/onecall-locator-dashboard`; backup path is `data/deploy_backups/20260618T155800Z`. Live AAB/APK hashes match local and public AAB returns `200`.
- Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 55` / `versionName 0.1.54`, and `apksigner verify --verbose`.
- Device validation note: `adb devices -l` showed no attached devices, and `adb connect 192.168.50.173:42023` failed with `No route to host`, so no live Android Auto runtime visual test could be completed from this shell.

## Native Android Live GeoCall And Tap-To-Call Ticket Detail - 2026-06-18

- Reed asked for every native Android ticket detail to include an `Open Live GeoCall` button like the web dashboard, so employees can see the up-to-the-minute Arkansas One Call/GeoCall page and positive response status. Reed also asked for ticket phone numbers to be blue tap-to-call links.
- Native Android ticket detail now adds `Open Live GeoCall` between `Navigate with Google Maps` and `See on dashboard map`. It opens `ticket.portalUrl` when available, and falls back to the cached dashboard `/api/portal-html?ticket=...` page when only cached portal HTML exists. The button is present on every ticket detail and disabled only when no portal source is available.
- Native Android contact/company phone fields now render as blue clickable phone rows. Tapping uses Android `ACTION_DIAL` with a `tel:` URI so it opens the dialer without requiring phone-call permission.
- Bumped native Android to `versionCode 54`, `versionName 0.1.53`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `153ac9c1bcc08c38f39a5cea5dc70a586e002eb1c36d8644a9290c32df892d6b`. Release APK SHA256 `f502143a7015f0da7360de1d1b4b0099580e0103835cc00f385c06cf665d8237`.
- Deployed changed Android source and rebuilt APK/AAB to `/opt/onecall-locator-dashboard`; backup path is `data/deploy_backups/20260618T153300Z`. Live AAB/APK hashes match local and public AAB returns `200`.
- Verification passed: `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 54` / `versionName 0.1.53`, and `apksigner verify --verbose`.
- Device validation note: `adb devices -l` showed no attached devices, and `adb connect 192.168.50.173:42023` failed with `No route to host`, so no live phone runtime test could be completed from this shell.

## Ticket Completion Photo Upload Local Storage Fix - 2026-06-18

- Reed reported native Android completion submits fail whenever pictures are attached, showing `HTTP failed` or prior timeout behavior, while separately uploading photos with a ticket number works.
- Root cause: regular `/api/attachments` still required OneDrive auth/folder upload and returned `409`/`502` when OneDrive was not connected or slow. Native Android also used short `8s` connect / `12s` read timeouts for upload requests.
- Fixed `/api/attachments` to save regular ticket attachments locally on the cloud server under `data/attachments/<ticket>/`, with metadata in `data/attachments/attachments.json`, and local file links through `/api/attachments/file?ticket=...&id=...`. Existing old OneDrive attachment records still redirect to their stored OneDrive URL if present.
- Updated dashboard upload status text from `Saving OneDrive folder link...` to `Saving attachment links...`.
- Updated native Android `TicketRepository` upload networking to use `15s` connect / `180s` read timeout and to surface the server JSON `message` if a non-2xx upload response occurs.
- Bumped native Android to `versionCode 53`, `versionName 0.1.52`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `e9e397851c5facc34cdd13893fa4f7f8b63b9524c687ef938834f70c1b260e83`. Release APK SHA256 `b0c855914f74fd6313b1019b78a29bffca7fea15ce9968a8c5324791b08d5ee0`.
- Web cache bust/service-worker cache version is `20260618151032`. Deployed `server.py`, `index.html`, `static/app.js`, `static/service-worker.js`, changed Android source, and rebuilt APK/AAB to `/opt/onecall-locator-dashboard`; backup path is `data/deploy_backups/20260618T151032Z`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py tools/export_vetro_google_earth_layers.py`, `node --check static/app.js`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 53` / `versionName 0.1.52`, `apksigner verify --verbose`, live service restart with `onecall-dashboard` active, live hashes matching local for deployed files/artifacts, and public cache-busted JS/service-worker/AAB returning `200`.
- Device validation note: `adb devices -l` showed no attached devices, and `adb connect 192.168.50.173:42023` failed with `No route to host`, so no live phone runtime upload test could be completed from this shell.

## Native Android Submit Progress, Dashboard Map Hold, Android Auto Polygon Tune - 2026-06-18

- Reed asked for a native Android completion-submit progress bar, slightly darker/larger Android Auto ticket polygon outlines with a little more interior shade, the native map measure control moved away from the phone navigation area, the native `See on dashboard map` action to stay on the dashboard map until manually leaving, and Location Photos to be scrollable like the In-house Locate page.
- Native Android completion now shows an in-form indeterminate progress bar and `Submitting ticket...` status after `Submit ticket` is pressed; action checkboxes, note input, upload button, and submit are disabled until the save finishes or an error restores the form.
- Native Android `See on dashboard map` now opens a dedicated `dashboard-map` screen at `/?dashboardTicket=<ticket>`, stores that screen in last-view state, and re-focuses the dashboard map on the selected ticket after the WebView loads instead of returning to ticket detail automatically.
- Android Auto ticket polygon rendering changed from fill alpha `6` / outline `1.5px` alpha `115` to fill alpha `10` / outline `2.5px` alpha `150`.
- Web dashboard mobile measure control now sits higher on small screens, away from lower Android navigation controls. Location Photos now uses its own scroll container with touch momentum, and the web cache bust/service-worker cache version is `20260618131149`.
- Bumped native Android to `versionCode 51`, `versionName 0.1.50`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `d0496ed9b23beac4e482a25c1b875737bbc3a23c6309beae9be2e2c794ea062b`. Release APK SHA256 `4713c30561cfa0c331b6a5fe277a251b78d4eb6b6e8c762f7bad751528245ef4`.
- Deployed `index.html`, `static/app.js`, `static/styles.css`, `static/service-worker.js`, changed Android source files, and the rebuilt APK/AAB to `/opt/onecall-locator-dashboard`; backup path is `data/deploy_backups/20260618T131149Z`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py tools/export_vetro_google_earth_layers.py`, `node --check static/app.js`, `/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:assembleDebug :app:assembleRelease :app:bundleRelease`, `aapt dump badging` showing `versionCode 51` / `versionName 0.1.50`, `apksigner verify --verbose`, live service restart with `onecall-dashboard` active, live SSH hashes matching local for deployed files/artifacts, and public cache-busted JS/CSS/service-worker returning `200`.
- Device validation note: `adb devices -l` showed no attached devices, and `adb connect 192.168.50.173:42023` failed with `No route to host`, so no live phone/Android Auto runtime visual test could be completed from this shell for this build.
- Correction after Reed clarified terminology: `See on dashboard map` should open the native live map/job map, not the web dashboard page. Reverted the button to `showMap(ticket)`, removed the temporary `dashboard-map` native restore state, and added polygon-bound focusing so a ticket with polygon data but no single coordinate still opens on the job area. Bumped native Android to `versionCode 52`, `versionName 0.1.51`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `4acfad9844c4d4c50b3a98b7f0b83607af05a357c8135a0611f336f4006334b4`. Release APK SHA256 `5d1c1b528b8b0ffd82021af9172bc8e6c38a6a697cd546e6cb01a849711e995e`. Deployed corrected Android source/artifacts to live host backup path `data/deploy_backups/20260618T132900Z`; live AAB/APK hashes match local.

## In-House Locate Lookup Upgrade - 2026-06-18

- Reed asked for the In-house Locate process to be easier and searchable by utility number, layer number, handhole/flower-pot IDs, VETRO IDs, addresses, and coordinates, with details filled in where possible.
- Added `/api/in-house-lookup`, which ranks typed coordinates, current One Call tickets, VETRO features/properties, and address geocoder results into one normalized result list. VETRO/ticket matches come from local server data first; public address lookup is only used as a fallback.
- The In-house Locate page now has a `Find ticket, utility ID, VETRO ID, handhole, flower pot, address, coordinates` lookup box beside the map. Selecting a result fills available address/place/county/title/utilities/scope/lat/lng fields and moves the map marker. The Android app uses this through its existing `/#in-house-requests` WebView route.
- Deployed `server.py`, `index.html`, `static/app.js`, and `static/styles.css` to the cloud server with cache-bust `20260618170500`; backup path is `data/deploy_backups/20260618T170354Z`.
- Verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py tools/export_vetro_google_earth_layers.py`, `node --check static/app.js`, live remote SHA256 hashes match local for the deployed files, and `onecall-dashboard` is active. Live SSH data checks returned coordinate, ticket, and VETRO matches against 7 VETRO layer files and 1870 tickets. Local Playwright/Google Chrome rendered `/#in-house-requests`, selected a coordinate lookup result, and confirmed address/lat/lng/map status updated.
- Follow-up: fixed the In-house Locate page scroll trap by making the view its own vertical scroll container on desktop and mobile. Added local file/photo uploads to created in-house requests through `/api/in-house-requests/upload` and `/api/in-house-requests/file`; row-level upload controls now show uploaded file links without using OneDrive. Deployed `server.py`, `index.html`, `static/app.js`, `static/styles.css`, and `static/service-worker.js` with cache-bust/cache version `20260618172500`; backup path is `data/deploy_backups/20260618T172624Z`.
- Follow-up verification passed: `python3 -m py_compile server.py tools/import_vetro_tiles_from_capture.py tools/export_vetro_google_earth_layers.py`, `node --check static/app.js`, local Playwright/Google Chrome mobile viewport verified `#inHouseRequestsView` scrolls from `0` to `1596` and a test file upload appears as a link, live hashes match local for all deployed files, public cache-busted JS/CSS/service-worker return `200`, unauthenticated upload returns expected `401 Login required`, and `onecall-dashboard` is active.

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
- Follow-up correction: the first OCR parser was too permissive and accepted partial/wrong watermark reads, which placed some photos outside the work area. Added service-area coordinate validation, direction cleanup, and slash/colon decimal recovery so bad reads are rejected instead of saved. Reprocessed live photos from originals: 61 of 67 now have valid local coordinates, 6 remain unknown, and 0 are outside service bounds. Live backup before strict repair: `data/location_photos/photos.before_strict_ocr_20260618.json`.

## Native Dig Tickets Scroll And Android Auto Smooth Map/Tickets Update - 2026-06-18

- Follow-up Android Auto polygon visibility tweak: locate ticket polygon fill alpha increased from `2` to `6`, outline alpha from `90` to `115`, keeping the previous low-transparency approach but making boundaries/fill a little easier to see on the car map.
- Bumped native Android to `versionCode 50`, `versionName 0.1.49`. Current Play upload AAB: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `2a03ecf477bfd6a57a93a5c233a4642d63603b1bc14e20845a2a6918835a601e`. Release APK SHA256 `919decab96e29f4adc07833f83a6178038fdf9f2be11af9e5c9b4205cee0a1f3`.
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

## VETRO Layer Fragment Cleanup - 2026-06-18

- Reed asked to check the VETRO/petrol layers for fragmentation and ensure future captures only add coverage or replace lower-quality features.
- Live audit showed the June 18 capture import had inflated line layers with low-zoom anonymous fragments: before cleanup counts were `Layer_17 24961`, `Layer_26 10903`, `Layer_28 7141`, `Layer_42 7513`, `Layer_43 67`, `Layer_654 32305`, `Layer_659 192`.
- Rebuilt live VETRO layers from the clean June 16 baseline `data/layers/backups/vetro_geojson_layers.backup-1781789922`, preserving baseline line coverage, keeping point additions, accepting only named high-zoom new line fragments, and rejecting low-quality anonymous line fragments.
- Live cleaned counts are `Layer_17 14084`, `Layer_26 8542`, `Layer_28 7130`, `Layer_42 7507`, `Layer_43 58`, `Layer_654 13970`, `Layer_659 2`. Backup of the inflated pre-cleanup live folder: `data/layers/backups/vetro_geojson_layers.before-fragment-cleanup-20260618T143804Z`.
- Hardened `tools/import_vetro_tiles_from_capture.py`: append-only imports now skip exact existing geometry, skip same-ID existing line fragments, reject low-quality anonymous line fragments, allow named high-zoom line additions, and replace existing non-fragment point features only when the new feature has a higher detail score.
- Verification: `python3 -m py_compile tools/import_vetro_tiles_from_capture.py`; synthetic merge test confirmed low-quality line fragments are rejected, named high-zoom lines are kept, and point replacements prefer higher detail. Live `/api/vetro` returns `401 Login required` unauthenticated, which confirms the route is active behind auth.
- Follow-up live capture import used Reed's fresh VETRO tile paste as a transient `/tmp` capture on the cloud host and deleted it immediately after import. The append-only merge decoded 98 tile requests with zero failures, replaced `5` lower-quality non-fragment records, skipped `881` exact geometries and `32134` existing IDs, and kept counts unchanged at `Layer_17 14084`, `Layer_26 8542`, `Layer_28 7130`, `Layer_42 7507`, `Layer_43 58`, `Layer_654 13970`, `Layer_659 2`; backup path is `data/layers/backups/vetro_geojson_layers.backup-1781794169`.

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

## 2026-06-23 VETRO Selection, Labels, And Photo Viewer

- Web VETRO/Vitruvi feature clicks now explicitly open the feature popup and keep selection priority above ticket polygons. The popup includes full detail rows plus `Add photo`, `Restoration ticket`, and `Locator note` actions.
- The web `Add photo` action opens Location Photos with the selected feature address/lat/lon/layer metadata prefilled. `Restoration ticket` opens a new restoration job modal prefilled from the feature.
- Service/customer address labels are smaller, 80% opacity, and zoom-gated to close-in inspection (`minzoom`/Leaflet threshold 18) on web, native Android, and Android Auto.
- Android native map location photo markers are about 50% opacity and open a fixed bottom photo sheet with a contained image, `Open full`, `Edit / add photos`, and `Close` actions instead of an oversized map popup.
- `/api/vetro-car` now preserves address/note property keys so Android Auto can render service/customer labels from the compact car feed.
- Release artifact rebuilt for Google Play: `versionCode 78`, `versionName 0.1.77`, AAB `android-auto/app/build/outputs/bundle/release/app-release.aab`, SHA256 `19b821c693097339c0370d0277ca5564084d5055944a532cfd8e06fd181cf6c5`.
- Verification: `node --check static/app.js`, `python3 -m py_compile server.py tools/*.py`, Gradle `test assembleRelease bundleRelease`, `aapt dump badging`, `apksigner verify`. A local Playwright smoke confirmed a VETRO test feature popup opens with details/actions; the Browser plugin was not available, so regular Playwright was used.

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
