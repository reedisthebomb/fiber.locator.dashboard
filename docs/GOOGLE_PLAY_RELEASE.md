# Fiber Locator Google Play Release Workflow

Current rule: Reed's "mobile app" means the native Android app package `com.fiberlocator.auto`. The Android Auto experience is attached to this same package through `FiberLocatorCarAppService`; it is not a separate Play Console app.

## Normal update flow

1. Make the dashboard/APK/Android Auto code changes in this repo.
2. Increment `versionCode` in `android-auto/app/build.gradle` for every Play Console upload. `versionName` should also move forward for readability.
3. Build the Play artifact:

```sh
cd /home/linux/fiber.locator.dashboard/android-auto
/home/linux/.local/gradle/gradle-8.10.2/bin/gradle :app:bundleRelease
```

4. Upload this file in Play Console:

```text
/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab
```

5. Use the Internal testing track first. Add release notes, save, review, and roll out the release.
6. Test from Google Play on a real phone. If Android Auto is included, also test the car screen/DHU from the Play-installed build.

## Current state

- Google Play developer account exists.
- Fiber Locator app exists in Play Console and is in Internal testing/review.
- Latest local package name: `com.fiberlocator.auto`.
- Latest local release: `versionCode 6`, `versionName 0.1.5`.
- Current AAB for upload: `/home/linux/fiber.locator.dashboard/android-auto/app/build/outputs/bundle/release/app-release.aab`
- Current AAB SHA256: `39dff6c7541d443cdbf0f9dd7140a7ccb4ebf701daf766645fbda0c9011766e9`
- Android Auto is included in the same AAB, not a separate app.
- Current target behavior for Android Auto: color-coded live tickets, ticket details, and Navigate action. A fuller custom map/layer/polygon view requires a second phase using Android for Cars map/navigation surfaces and stricter review testing.
