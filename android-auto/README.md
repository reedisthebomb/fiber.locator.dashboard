# Fiber Locator Android Auto

This is a native Android companion for the Fiber Locator dashboard. It uses the Android for Cars App Library as a templated POI app so Android Auto can show a driver-safe ticket list, ticket details, and a `Navigate` action.

## Current Scope

- Phone setup screen for the dashboard URL and login details.
- Android Auto `Live tickets` list loaded from `/api/tickets`.
- Ticket detail screen with a `Navigate` action using `CarContext.ACTION_NAVIGATE`.
- Defaults to the cloud dashboard at `https://fiber-locator.5-78-214-184.sslip.io`.

## Build

Use Android Studio or a Gradle/Android SDK install:

```sh
cd android-auto
./gradlew assembleDebug
```

The debug APK will be under `app/build/outputs/apk/debug/`.

## Ford Sync 4 / Android Auto Testing

1. Install the APK on the Android phone that connects to the Ford Sync 4 head unit.
2. Open `Fiber Locator` on the phone and save the dashboard URL plus credentials.
3. Connect the phone to Android Auto.
4. If the app is not visible, enable Android Auto developer mode and allow unknown sources for local debug builds.
5. Open `Fiber Locator`, select a ticket, then choose `Navigate`.

For production-style installs on a real vehicle, Android Auto apps generally need to come from a trusted source such as Google Play. Local debug visibility can vary by phone, Android Auto version, and developer settings.
