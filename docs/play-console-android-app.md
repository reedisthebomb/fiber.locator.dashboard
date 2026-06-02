# Fiber Locator Play Console Setup

Updated: 2026-06-01

This checklist is for publishing the phone/tablet Android app first. Android Auto should be handled as a later release path after the normal Android listing and internal test are working.

## Current Android Artifact

- App name: `Fiber Locator`
- Package name: `com.fiberlocator.auto`
- Version code: `1`
- Version name: `0.1.0`
- Minimum SDK: `28`
- Target SDK: `36`
- Upload bundle: `android-auto/app/build/outputs/bundle/release/app-release.aab`
- Local install APK: `android-auto/app/build/outputs/apk/release/app-release.apk`

The release AAB was rebuilt on 2026-06-01 with:

```sh
cd /home/linux/fiber.locator.dashboard/android-auto
/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:bundleRelease
```

## Before Production Release

- The live dashboard now uses `https://fiber-locator.5-78-214-184.sslip.io/` through Caddy and a trusted certificate.
- The current bundle still includes Android Auto service metadata. For a phone-only first release, build a phone-only bundle or remove the car service metadata before production submission. Internal testing can still be useful now.
- Add real support contact details before submitting any public listing.
- Create and host the privacy policy at a public URL. A draft is in `docs/privacy-policy-fiber-locator.md`.
- Capture phone screenshots from the current app flow: login, ticket list, ticket detail, completion form, live map.

## Create App

- App name: `Fiber Locator`
- Default language: `English (United States) - en-US`
- App or game: `App`
- Free or paid: `Free`
- Declarations: acknowledge Developer Program Policies and US export laws.

## Main Store Listing

- App name: `Fiber Locator`
- Short description: `Field ticket map and locate workflow for Fiber Locator crews.`
- Full description:

```text
Fiber Locator gives authorized locating crews a mobile workflow for live One Call tickets, map review, ticket detail, completion notes, and field attachments.

The app connects to the private Fiber Locator dashboard so crews can sign in, review the current app view, open due-sorted live tickets, inspect ticket details, view polygons on the map, submit locate outcomes, and upload supporting photos or videos where needed.

Fiber Locator is intended for authorized field users only. Access requires an account issued by the Fiber Locator administrator.
```

- App category: `Business`
- Tags to consider: `Business`, `Productivity`, `Maps & Navigation`
- Contact email: use Reed's chosen support email.
- Website: use the future public dashboard/support URL if available.
- Phone: optional.
- Privacy policy: `https://fiber-locator.5-78-214-184.sslip.io/privacy-policy`

## Graphics And Screenshots

Required or strongly expected:

- App icon: already packaged from `android-auto/app/src/main/res/drawable/fiber_locator_logo.png`
- Phone screenshots: at least 2, recommended 4-5
- Feature graphic: 1024 x 500 PNG or JPEG

Recommended screenshot set:

- Login screen
- Live ticket list
- Ticket detail
- Completion form with action choices
- Full-page map with ticket polygons

## App Content

### Privacy Policy

Use `https://fiber-locator.5-78-214-184.sslip.io/privacy-policy`. The policy says the app is for authorized users, connects to the Fiber Locator dashboard, and handles login credentials, account requests, profile details, tickets, notes, attachments, and optional on-device location.

### App Access

Choose: `All or some functionality is restricted`.

Provide reviewer credentials for a test account that can log in without exposing admin access. Do not use a real production password in repo docs. Create a temporary reviewer employee account on the live dashboard before submission, then enter the username and password directly in Play Console.

Suggested reviewer note:

```text
This app is for authorized Fiber Locator field users. Please sign in with the provided test account. The Tickets tab shows live test-accessible ticket workflow, the Map tab shows ticket polygons, and ticket completion can be reviewed from an assigned ticket detail page.
```

### Ads

Choose: `No, my app does not contain ads`.

### Content Rating

Expected answers:

- Category: utility, productivity, or business app
- Violence: no
- Sexual content: no
- Profanity: no
- Controlled substances: no
- User-generated content visible to the public: no
- Location sharing with other users: no
- Digital goods/gambling: no

### Target Audience

Recommended:

- Target age: `18 and over`
- Not designed for children
- Not primarily child-directed

### News App

Choose: `No`.

### Government App

Choose: `No`, unless the Play Console wording treats utility-location contractors differently. This is a private field workflow, not an official government app.

### Financial Features

Choose: `No`.

### Health

Choose: `No`.

### Data Safety Draft

Be conservative and truthful. For the current app:

- Data collection: `Yes`
- Data sharing: `No`, unless third-party map/tile providers are treated as sharing by the final deployed configuration.
- Data encrypted in transit: `Yes`, as long as the app is built with the HTTPS dashboard URL and the live Caddy proxy remains active.
- Users can request deletion: depends on the operational process Reed wants to publish. If there is no self-service deletion, select the closest Play Console option and provide the support contact process.

Likely data types:

- Personal info: user ID or username, used for account management and app functionality.
- Photos and videos: user-provided field attachments, used for app functionality.
- App activity or user-generated content: ticket completion actions and notes, used for app functionality.
- Approximate and precise location: only if device location is transmitted to the server in a future build. In the current code, the `Locate me` map feature is on-device display and does not upload the device location.

Security practices:

- Data is not sold.
- Data is used for app functionality.
- App access requires login.
- HTTPS is active for the default dashboard endpoint.

## Internal Testing Release

Recommended first release path:

1. Create the app in Play Console.
2. Complete the minimum store listing and app content forms.
3. Go to `Test and release` > `Testing` > `Internal testing`.
4. Create an internal tester email list.
5. Upload `android-auto/app/build/outputs/bundle/release/app-release.aab`.
6. Add release notes:

```text
Initial Fiber Locator Android test release with employee login, account request, profile editor, live ticket list, ticket detail, completion workflow, attachments, and full-page map review.
```

7. Submit the internal testing release.

## Later Android Auto Release

After the phone app is accepted in internal testing:

- Decide whether Android Auto remains in the same package or moves to a separate package.
- Confirm the app category allowed by Android Auto review.
- Prepare car-specific screenshots, reviewer notes, and a DHU test path.
- Upload a new version code that includes the Android Auto service metadata.
