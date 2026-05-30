package com.fiberlocator.auto;

import android.content.Context;
import android.content.SharedPreferences;

public final class AppSettings {
    public static final String DEFAULT_DASHBOARD_URL = "http://5.78.214.184:8765";
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
