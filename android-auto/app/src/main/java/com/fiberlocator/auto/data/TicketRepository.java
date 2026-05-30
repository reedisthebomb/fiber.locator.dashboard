package com.fiberlocator.auto.data;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import com.fiberlocator.auto.AppSettings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class TicketRepository {
    public static final TicketAction[] ACTIONS = new TicketAction[] {
        new TicketAction("located", "Located", true),
        new TicketAction("locate-delayed", "Locate delayed", false),
        new TicketAction("clear", "Clear", true),
        new TicketAction("ticket-canceled-by-customer", "Ticket canceled", true),
        new TicketAction("in-conflict", "In conflict", true),
        new TicketAction("cannot-locate", "Cannot locate", true),
        new TicketAction("partially-located-large-project", "Partially located", true),
        new TicketAction("excavation-started", "Excavation started", true),
    };

    private final Context context;

    public TicketRepository(Context context) {
        this.context = context.getApplicationContext();
    }

    public List<Ticket> loadTickets() throws Exception {
        DashboardSnapshot snapshot = loadSnapshot();
        return snapshot.tickets.size() > 48 ? snapshot.tickets.subList(0, 48) : snapshot.tickets;
    }

    public DashboardSnapshot loadSnapshot() throws Exception {
        JSONObject statePayload = requestJson("/api/state", "GET", null);
        JSONObject effectiveState = statePayload.optJSONObject("state");
        if (effectiveState == null) effectiveState = new JSONObject();
        JSONObject appViewState = appViewState(statePayload.optJSONArray("viewPresets"));
        JSONObject employeeDashboard = statePayload.optJSONObject("employeeDashboard");
        JSONObject mobileState = appViewState == null ? effectiveState : mergeState(appViewState, effectiveState);
        boolean employeeEnabled = false;
        String employeeSavedAt = "";
        if (employeeDashboard != null) {
            employeeEnabled = employeeDashboard.optBoolean("enabled", false);
            employeeSavedAt = employeeDashboard.optString("saved_at", "");
        }
        JSONObject ticketsPayload = requestJson("/api/tickets", "GET", null);
        JSONArray tickets = ticketsPayload.optJSONArray("tickets");
        List<Ticket> out = new ArrayList<>();
        Map<String, List<String>> actions = parseActions(mobileState.optJSONObject("ticketActions"));
        Map<String, String> descriptions = parseDescriptions(mobileState.optJSONObject("ticketDescriptions"));
        Set<String> hiddenTickets = parseStringSet(mobileState.optJSONArray("hiddenTickets"));
        Set<String> archivedTickets = parseStringSet(mobileState.optJSONArray("archivedTickets"));
        Set<String> protectedTickets = protectedTickets(mobileState.optJSONObject("ticketListCheckpoint"));
        Set<String> selectedCounties = parseStringSet(mobileState.optJSONArray("countyFilterSelected"));
        boolean countyFilterAll = mobileState.optBoolean("countyFilterAll", true);
        boolean showHidden = mobileState.optBoolean("showHiddenTickets", false);
        String search = mobileState.optString("ticketSearch", "").trim();
        String mapStyle = first(mobileState.optString("baseMapStyle", ""), mobileState.optString("mapStyle", ""), "published");
        if (tickets != null) {
            for (int index = 0; index < tickets.length(); index++) {
                JSONObject item = tickets.optJSONObject(index);
                if (item == null) continue;
                Ticket ticket = parseTicket(item, actions, descriptions);
                if (!isActiveCounty(ticket)) continue;
                if (archivedTickets.contains(ticket.ticketNumber)) continue;
                if (protectedTickets.contains(ticket.ticketNumber)) continue;
                if (!countyFilterAll && !selectedCounties.isEmpty() && !selectedCounties.contains(ticket.county)) continue;
                if (!showHidden && hiddenTickets.contains(ticket.ticketNumber)) continue;
                if (!matchesSearch(ticket, search)) continue;
                if (!ticket.actions.isEmpty()) continue;
                if (ticket.hasCoordinates || !ticket.locationLine().isEmpty()) out.add(ticket);
            }
        }
        Collections.sort(out, (left, right) -> left.dueLine().compareToIgnoreCase(right.dueLine()));
        return new DashboardSnapshot(
            out,
            actions,
            parseTimestamps(mobileState.optJSONObject("ticketActionUpdatedAt")),
            mobileState,
            statePayload.optString("displayName", statePayload.optString("username", "")),
            statePayload.optString("role", ""),
            employeeEnabled,
            employeeSavedAt,
            search,
            mapStyle
        );
    }

    public void saveTicketActions(DashboardSnapshot snapshot, String ticketNumber, List<String> actionKeys) throws Exception {
        saveTicketCompletion(snapshot, ticketNumber, actionKeys, null, Collections.emptyList());
    }

    public void saveTicketCompletion(DashboardSnapshot snapshot, String ticketNumber, List<String> actionKeys, String description, List<Uri> attachments) throws Exception {
        Map<String, List<String>> actions = new LinkedHashMap<>(snapshot.actionsByTicket);
        List<String> valid = validActions(actionKeys);
        if (valid.isEmpty()) actions.remove(ticketNumber);
        else actions.put(ticketNumber, valid);
        Map<String, Double> timestamps = new LinkedHashMap<>(snapshot.actionUpdatedAt);
        timestamps.put(ticketNumber, (double) System.currentTimeMillis());

        JSONObject state = new JSONObject();
        state.put("ticketActions", actionsToJson(actions));
        state.put("ticketActionUpdatedAt", timestampsToJson(timestamps));
        JSONObject descriptions = snapshot.state.optJSONObject("ticketDescriptions");
        JSONObject nextDescriptions = descriptions == null ? new JSONObject() : new JSONObject(descriptions.toString());
        String cleanDescription = description == null ? "" : description.trim();
        if (description != null) {
            if (cleanDescription.isEmpty()) nextDescriptions.remove(ticketNumber);
            else nextDescriptions.put(ticketNumber, cleanDescription);
        }
        state.put("ticketDescriptions", nextDescriptions);
        requestJson("/api/state", "POST", state.toString());
        if (attachments != null && !attachments.isEmpty()) uploadAttachments(ticketNumber, cleanDescription, attachments);
    }

    public boolean ensureLogin() throws Exception {
        HttpURLConnection connection = open("/api/health", "GET");
        int status = connection.getResponseCode();
        if (status == 200) return true;
        return status == 401 && login();
    }

    private Ticket parseTicket(JSONObject item, Map<String, List<String>> actionsByTicket, Map<String, String> descriptionsByTicket) {
        double lat = item.optDouble("latitude", Double.NaN);
        double lon = item.optDouble("longitude", Double.NaN);
        boolean hasCoords = !Double.isNaN(lat) && !Double.isNaN(lon);
        String ticketNumber = text(item, "ticket_number");
        List<String> utilities = new ArrayList<>();
        JSONArray utilitiesJson = item.optJSONArray("utilities_notified");
        if (utilitiesJson != null) {
            for (int index = 0; index < utilitiesJson.length(); index++) {
                String utility = utilitiesJson.optString(index, "").trim();
                if (!utility.isEmpty()) utilities.add(utility);
            }
        }
        return new Ticket(
            ticketNumber,
            text(item, "message_type"),
            text(item, "prepared_date"),
            text(item, "prepared_time"),
            text(item, "county"),
            text(item, "place"),
            text(item, "street"),
            text(item, "address"),
            text(item, "nearest_intersection"),
            text(item, "work_begin_date"),
            text(item, "work_begin_time"),
            text(item, "caller"),
            text(item, "contractor"),
            text(item, "company_phone"),
            text(item, "contact"),
            text(item, "contact_phone"),
            text(item, "contact_email"),
            text(item, "location_information"),
            text(item, "work_type"),
            text(item, "done_for"),
            text(item, "extent"),
            text(item, "explosives"),
            text(item, "white_paint"),
            text(item, "directional_boring"),
            text(item, "raw_text"),
            descriptionsByTicket.get(ticketNumber),
            text(item, "portal_url"),
            item.optBoolean("portal_html_available", false),
            utilities,
            actionsByTicket.get(ticketNumber),
            lat,
            lon,
            hasCoords,
            item.optJSONObject("polygon")
        );
    }

    private boolean login() throws Exception {
        String username = AppSettings.username(context);
        String password = AppSettings.password(context);
        if (username.isEmpty() || password.isEmpty()) return false;

        String form = "username=" + encode(username) + "&password=" + encode(password) + "&next=%2F";
        HttpURLConnection connection = open("/login", "POST");
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        connection.setDoOutput(true);
        try (OutputStream out = connection.getOutputStream()) {
            out.write(form.getBytes(StandardCharsets.UTF_8));
        }
        int status = connection.getResponseCode();
        String cookie = connection.getHeaderField("Set-Cookie");
        if ((status == 302 || status == 200) && cookie != null && cookie.contains("onecall_auth=")) {
            AppSettings.saveCookie(context, cookie.split(";", 2)[0]);
            return true;
        }
        return false;
    }

    private JSONObject requestJson(String path, String method, String body) throws Exception {
        HttpURLConnection connection = open(path, method);
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            try (OutputStream out = connection.getOutputStream()) {
                out.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        int status = connection.getResponseCode();
        if (status == 401 && login()) {
            connection = open(path, method);
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(body.getBytes(StandardCharsets.UTF_8));
                }
            }
            status = connection.getResponseCode();
        }
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("Dashboard returned HTTP " + status);
        }
        return new JSONObject(read(connection));
    }

    private void uploadAttachments(String ticketNumber, String note, List<Uri> attachments) throws Exception {
        String boundary = "FiberLocator" + System.currentTimeMillis();
        HttpURLConnection connection = open("/api/attachments", "POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
        try (OutputStream out = connection.getOutputStream()) {
            writeField(out, boundary, "ticket", ticketNumber);
            writeField(out, boundary, "note", note == null ? "" : note);
            for (Uri uri : attachments) writeFile(out, boundary, uri);
            out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        }
        int status = connection.getResponseCode();
        if (status == 401 && login()) {
            uploadAttachments(ticketNumber, note, attachments);
            return;
        }
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("Attachment upload returned HTTP " + status);
        }
        read(connection);
    }

    private void writeField(OutputStream out, String boundary, String name, String value) throws Exception {
        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write((value == null ? "" : value).getBytes(StandardCharsets.UTF_8));
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private void writeFile(OutputStream out, String boundary, Uri uri) throws Exception {
        String filename = fileName(uri);
        String type = context.getContentResolver().getType(uri);
        if (type == null || type.trim().isEmpty()) type = "application/octet-stream";
        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"files\"; filename=\"" + filename.replace("\"", "") + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Type: " + type + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        try (InputStream in = context.getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IllegalStateException("Unable to open attachment.");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
        }
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private String fileName(Uri uri) {
        try (Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    String value = cursor.getString(index);
                    if (value != null && !value.trim().isEmpty()) return value.trim();
                }
            }
        } catch (Exception ignored) {
        }
        String fallback = uri.getLastPathSegment();
        return fallback == null || fallback.trim().isEmpty() ? "attachment" : fallback.trim();
    }

    private HttpURLConnection open(String path, String method) throws Exception {
        URL url = new URL(AppSettings.dashboardUrl(context) + path);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(12000);
        connection.setRequestMethod(method);
        String cookie = AppSettings.authCookie(context);
        if (!cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);
        return connection;
    }

    private static String read(HttpURLConnection connection) throws Exception {
        InputStream stream = connection.getResponseCode() >= 400 ? connection.getErrorStream() : connection.getInputStream();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            StringBuilder out = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) out.append(line);
            return out.toString();
        }
    }

    private static String text(JSONObject item, String key) {
        String value = item.optString(key, "");
        return value == null ? "" : value.trim();
    }

    private static String encode(String value) throws Exception {
        return URLEncoder.encode(value, "UTF-8");
    }

    private static JSONObject mergeState(JSONObject base, JSONObject overlay) throws Exception {
        JSONObject merged = new JSONObject(base.toString());
        JSONArray keys = overlay.names();
        if (keys == null) return merged;
        for (int index = 0; index < keys.length(); index++) {
            String key = keys.optString(index);
            if (
                "ticketActions".equals(key)
                    || "ticketActionUpdatedAt".equals(key)
                    || "ticketDescriptions".equals(key)
                    || "hiddenTickets".equals(key)
                    || "archivedTickets".equals(key)
                    || "ticketListCheckpoint".equals(key)
                    || "showHiddenTickets".equals(key)
            ) {
                merged.put(key, overlay.opt(key));
            }
        }
        return merged;
    }

    private static Map<String, List<String>> parseActions(JSONObject object) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        if (object == null) return out;
        JSONArray names = object.names();
        if (names == null) return out;
        for (int i = 0; i < names.length(); i++) {
            String ticket = names.optString(i);
            JSONArray values = object.optJSONArray(ticket);
            List<String> selected = new ArrayList<>();
            if (values != null) {
                for (int j = 0; j < values.length(); j++) {
                    String key = values.optString(j, "");
                    if (isValidAction(key)) selected.add(key);
                }
            }
            if (!selected.isEmpty()) out.put(ticket, selected);
        }
        return out;
    }

    private static Map<String, String> parseDescriptions(JSONObject object) {
        Map<String, String> out = new LinkedHashMap<>();
        if (object == null) return out;
        JSONArray names = object.names();
        if (names == null) return out;
        for (int i = 0; i < names.length(); i++) {
            String ticket = names.optString(i);
            String description = object.optString(ticket, "").trim();
            if (!ticket.isEmpty() && !description.isEmpty()) out.put(ticket, description);
        }
        return out;
    }

    private static JSONObject appViewState(JSONArray presets) {
        if (presets == null) return null;
        JSONObject fallback = null;
        for (int i = 0; i < presets.length(); i++) {
            JSONObject preset = presets.optJSONObject(i);
            if (preset == null) continue;
            String name = preset.optString("name", "").trim().toLowerCase();
            JSONObject state = preset.optJSONObject("state");
            if (state == null) continue;
            if ("app view".equals(name) || "mobile app view".equals(name) || "mobile view".equals(name)) return state;
            if (fallback == null && name.contains("app") && name.contains("view")) fallback = state;
        }
        return fallback;
    }

    private static Map<String, Double> parseTimestamps(JSONObject object) {
        Map<String, Double> out = new HashMap<>();
        if (object == null) return out;
        JSONArray names = object.names();
        if (names == null) return out;
        for (int i = 0; i < names.length(); i++) {
            String ticket = names.optString(i);
            double timestamp = object.optDouble(ticket, 0);
            if (timestamp > 0) out.put(ticket, timestamp);
        }
        return out;
    }

    private static Set<String> parseStringSet(JSONArray array) {
        Set<String> out = new HashSet<>();
        if (array == null) return out;
        for (int i = 0; i < array.length(); i++) {
            String value = array.optString(i, "");
            if (!value.isEmpty()) out.add(value);
        }
        return out;
    }

    private static Set<String> protectedTickets(JSONObject checkpoint) {
        Set<String> out = new HashSet<>();
        if (checkpoint == null || checkpoint.optBoolean("enabled", true) == false) return out;
        out.addAll(parseStringSet(checkpoint.optJSONArray("hiddenTickets")));
        out.addAll(parseStringSet(checkpoint.optJSONArray("archivedTickets")));
        JSONObject checkpointActions = checkpoint.optJSONObject("ticketActions");
        if (checkpointActions == null) return out;
        JSONArray names = checkpointActions.names();
        if (names == null) return out;
        for (int i = 0; i < names.length(); i++) {
            String ticket = names.optString(i, "");
            JSONArray values = checkpointActions.optJSONArray(ticket);
            if (values == null) continue;
            for (int j = 0; j < values.length(); j++) {
                TicketAction action = action(values.optString(j, ""));
                if (action != null && action.hidesFromDashboard) {
                    out.add(ticket);
                    break;
                }
            }
        }
        return out;
    }

    private static JSONObject actionsToJson(Map<String, List<String>> actions) throws Exception {
        JSONObject out = new JSONObject();
        for (Map.Entry<String, List<String>> entry : actions.entrySet()) {
            JSONArray values = new JSONArray();
            for (String action : validActions(entry.getValue())) values.put(action);
            if (values.length() > 0) out.put(entry.getKey(), values);
        }
        return out;
    }

    private static JSONObject timestampsToJson(Map<String, Double> timestamps) throws Exception {
        JSONObject out = new JSONObject();
        for (Map.Entry<String, Double> entry : timestamps.entrySet()) {
            if (entry.getValue() != null && entry.getValue() > 0) out.put(entry.getKey(), entry.getValue());
        }
        return out;
    }

    private static List<String> validActions(List<String> values) {
        if (values == null) return Collections.emptyList();
        List<String> out = new ArrayList<>();
        for (String value : values) {
            if (isValidAction(value) && !out.contains(value)) out.add(value);
        }
        return out;
    }

    private static boolean matchesSearch(Ticket ticket, String search) {
        if (search == null || search.isEmpty()) return true;
        String haystack = (ticket.ticketNumber + " " + ticket.county + " " + ticket.place + " " + ticket.street + " " + ticket.address + " " + ticket.caller + " " + ticket.contractor).toLowerCase();
        return haystack.contains(search.toLowerCase());
    }

    private static boolean isActionHidden(Ticket ticket) {
        for (TicketAction action : ACTIONS) {
            if (action.hidesFromDashboard && ticket.hasAction(action.key)) return true;
        }
        return false;
    }

    private static boolean isActiveCounty(Ticket ticket) {
        String county = ticket.county == null ? "" : ticket.county.trim().toUpperCase();
        return "UNION".equals(county) || "COLUMBIA".equals(county);
    }

    private static boolean isValidAction(String key) {
        return action(key) != null;
    }

    private static TicketAction action(String key) {
        for (TicketAction action : ACTIONS) if (action.key.equals(key)) return action;
        return null;
    }

    private static String first(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) return value.trim();
        }
        return "";
    }

    public static final class TicketAction {
        public final String key;
        public final String label;
        public final boolean hidesFromDashboard;

        TicketAction(String key, String label, boolean hidesFromDashboard) {
            this.key = key;
            this.label = label;
            this.hidesFromDashboard = hidesFromDashboard;
        }
    }

    public static final class DashboardSnapshot {
        public final List<Ticket> tickets;
        public final Map<String, List<String>> actionsByTicket;
        public final Map<String, Double> actionUpdatedAt;
        public final JSONObject state;
        public final String displayName;
        public final String role;
        public final boolean mobilePublished;
        public final String mobileSavedAt;
        public final String search;
        public final String mapStyle;

        DashboardSnapshot(
            List<Ticket> tickets,
            Map<String, List<String>> actionsByTicket,
            Map<String, Double> actionUpdatedAt,
            JSONObject state,
            String displayName,
            String role,
            boolean mobilePublished,
            String mobileSavedAt,
            String search,
            String mapStyle
        ) {
            this.tickets = Collections.unmodifiableList(new ArrayList<>(tickets));
            this.actionsByTicket = Collections.unmodifiableMap(new LinkedHashMap<>(actionsByTicket));
            this.actionUpdatedAt = Collections.unmodifiableMap(new LinkedHashMap<>(actionUpdatedAt));
            this.state = state;
            this.displayName = displayName;
            this.role = role;
            this.mobilePublished = mobilePublished;
            this.mobileSavedAt = mobileSavedAt;
            this.search = search;
            this.mapStyle = mapStyle;
        }
    }
}
