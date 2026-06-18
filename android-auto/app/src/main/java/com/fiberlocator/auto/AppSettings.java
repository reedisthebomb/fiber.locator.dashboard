package com.fiberlocator.auto;

import android.content.Context;
import android.content.SharedPreferences;

public final class AppSettings {
    public static final String DEFAULT_DASHBOARD_URL = "https://fiber-locator.5-78-214-184.sslip.io";
    private static final String PREFS = "fiber_locator_settings";
    private static String sessionCookie = "";

    private AppSettings() {
    }

    public static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static String dashboardUrl(Context context) {
        String value = prefs(context).getString("dashboard_url", DEFAULT_DASHBOARD_URL);
        if (value == null || value.trim().isEmpty()) return DEFAULT_DASHBOARD_URL;
        return trimTrailingSlash(value.trim());
    }

    public static String username(Context context) {
        return value(context, "username");
    }

    public static String password(Context context) {
        return value(context, "password");
    }

    public static String authCookie(Context context) {
        String stored = value(context, "auth_cookie");
        return stored.isEmpty() ? sessionCookie : stored;
    }

    public static boolean rememberMe(Context context) {
        return prefs(context).getBoolean("remember_me", false);
    }

    public static String dashboardMode(Context context) {
        String mode = value(context, "dashboard_mode");
        return "tcw".equals(mode) ? "tcw" : "main";
    }

    public static void saveDashboardMode(Context context, String mode) {
        prefs(context).edit().putString("dashboard_mode", "tcw".equals(mode) ? "tcw" : "main").apply();
    }

    public static String lastScreen(Context context) {
        String screen = value(context, "last_screen");
        if ("map".equals(screen) || "dashboard-map".equals(screen) || "detail".equals(screen) || "complete".equals(screen) || "tickets".equals(screen)
            || "dig".equals(screen) || "restoration".equals(screen) || "in-house-requests".equals(screen)
            || "location-photos".equals(screen) || "profile".equals(screen)) {
            return screen;
        }
        return "tickets";
    }

    public static String lastTicket(Context context) {
        return value(context, "last_ticket");
    }

    public static void saveLastView(Context context, String screen, String ticketNumber) {
        prefs(context).edit()
            .putString("last_screen", screen == null ? "tickets" : screen)
            .putString("last_ticket", ticketNumber == null ? "" : ticketNumber.trim())
            .apply();
    }

    public static void saveMapCamera(Context context, double latitude, double longitude, double zoom, double bearing, double pitch, String mode) {
        prefs(context).edit()
            .putFloat("map_lat", (float) latitude)
            .putFloat("map_lng", (float) longitude)
            .putFloat("map_zoom", (float) zoom)
            .putFloat("map_bearing", (float) bearing)
            .putFloat("map_pitch", (float) pitch)
            .putString("map_mode", mode == null ? "" : mode.trim())
            .putBoolean("map_camera_saved", true)
            .apply();
    }

    public static boolean hasMapCamera(Context context) {
        return prefs(context).getBoolean("map_camera_saved", false);
    }

    public static double mapLatitude(Context context) {
        return prefs(context).getFloat("map_lat", 33.23f);
    }

    public static double mapLongitude(Context context) {
        return prefs(context).getFloat("map_lng", -92.67f);
    }

    public static double mapZoom(Context context) {
        return prefs(context).getFloat("map_zoom", 12f);
    }

    public static double mapBearing(Context context) {
        return prefs(context).getFloat("map_bearing", 0f);
    }

    public static double mapPitch(Context context) {
        return prefs(context).getFloat("map_pitch", 0f);
    }

    public static String mapMode(Context context) {
        return value(context, "map_mode");
    }

    public static void save(Context context, String dashboardUrl, String username, String password, String authCookie) {
        save(context, dashboardUrl, username, password, authCookie, true);
    }

    public static void save(Context context, String dashboardUrl, String username, String password, String authCookie, boolean rememberMe) {
        sessionCookie = "";
        prefs(context).edit()
            .putString("dashboard_url", trimTrailingSlash(dashboardUrl))
            .putString("username", username == null ? "" : username.trim())
            .putString("password", rememberMe ? (password == null ? "" : password) : "")
            .putString("auth_cookie", rememberMe ? (authCookie == null ? "" : authCookie.trim()) : "")
            .putBoolean("remember_me", rememberMe)
            .apply();
    }

    public static void saveCookie(Context context, String authCookie) {
        String cookie = authCookie == null ? "" : authCookie.trim();
        if (rememberMe(context)) prefs(context).edit().putString("auth_cookie", cookie).apply();
        else sessionCookie = cookie;
    }

    private static String value(Context context, String key) {
        String value = prefs(context).getString(key, "");
        return value == null ? "" : value;
    }

    private static String trimTrailingSlash(String value) {
        String out = value == null ? "" : value.trim();
        while (out.endsWith("/")) out = out.substring(0, out.length() - 1);
        return out.isEmpty() ? DEFAULT_DASHBOARD_URL : out;
    }
}
