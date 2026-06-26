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
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class TicketRepository {
    private static final long CACHE_MAX_AGE_MS = 1000L * 60L * 60L * 24L * 7L;
    private static final int CONNECT_TIMEOUT_MS = 8000;
    private static final int GET_READ_TIMEOUT_MS = 20000;
    private static final int WRITE_READ_TIMEOUT_MS = 45000;
    private static final int ATTACHMENT_READ_TIMEOUT_MS = 180000;
    public static final TicketAction[] ACTIONS = new TicketAction[] {
        new TicketAction("located", "Located", true),
        new TicketAction("locate-delayed", "Locate delayed", false),
        new TicketAction("clear", "Clear", true),
        new TicketAction("ticket-canceled-by-customer", "Caller canceled ticket", true),
        new TicketAction("in-conflict", "In conflict", true),
        new TicketAction("cannot-locate", "Cannot locate", true),
        new TicketAction("partially-located-large-project", "Partially located", true),
        new TicketAction("excavation-started", "Excavation started", true),
    };

    private final Context context;
    private boolean usedCachedResponse = false;

    public TicketRepository(Context context) {
        this.context = context.getApplicationContext();
    }

    public boolean usedCachedResponse() {
        return usedCachedResponse;
    }

    public List<Ticket> loadTickets() throws Exception {
        DashboardSnapshot snapshot = loadSnapshot();
        return snapshot.tickets.size() > 48 ? snapshot.tickets.subList(0, 48) : snapshot.tickets;
    }

    public List<LocationPhoto> loadLocationPhotos() throws Exception {
        JSONObject payload = requestJson("/api/location-photos", "GET", null);
        JSONArray photos = payload.optJSONArray("photos");
        List<LocationPhoto> out = new ArrayList<>();
        if (photos == null) return out;
        for (int index = 0; index < photos.length(); index++) {
            JSONObject item = photos.optJSONObject(index);
            if (item == null) continue;
            out.add(new LocationPhoto(
                text(item, "id"),
                text(item, "ticket"),
                text(item, "original_name"),
                text(item, "location_label"),
                text(item, "address"),
                text(item, "url"),
                text(item, "uploaded_at"),
                text(item, "review_status"),
                item.optDouble("lat", Double.NaN),
                item.optDouble("lng", Double.NaN)
            ));
        }
        return out;
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
        List<LocatorNote> locatorNotes = loadLocatorNotes();
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
                if (hasDashboardHiddenAction(ticket.actions)) continue;
                if (ticket.hasCoordinates || !ticket.locationLine().isEmpty()) out.add(ticket);
            }
        }
        Collections.sort(out, (left, right) -> left.dueLine().compareToIgnoreCase(right.dueLine()));
        return new DashboardSnapshot(
            out,
            locatorNotes,
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

    public List<MapFeature> loadVetroMapFeatures(JSONObject state) throws Exception {
        if (state != null && state.optBoolean("vetroVisible", true) == false) return Collections.emptyList();
        JSONObject payload = requestJson("/api/vetro-car", "GET", null);
        JSONArray features = payload.optJSONArray("features");
        if (features == null && "FeatureCollection".equals(payload.optString("type"))) {
            features = payload.optJSONArray("features");
        }
        if (features == null) return Collections.emptyList();
        List<MapFeature> out = new ArrayList<>();
        for (int index = 0; index < features.length(); index++) {
            JSONObject feature = features.optJSONObject(index);
            if (feature == null) continue;
            JSONObject props = feature.optJSONObject("properties");
            if (props == null) props = new JSONObject();
            String layerId = canonicalLayerId(first(
                text(props, "layer_id"),
                text(props, "Layer_ID"),
                text(props, "layerId"),
                text(props, "layer"),
                text(props, "Layer"),
                text(props, "geojson_layer"),
                "Unknown"
            ));
            String featureId = first(text(props, "ID"), text(props, "feature_id"), text(props, "Name"), layerId);
            if ("26".equals(layerId) && featureId.toUpperCase().startsWith("SL-") && state != null && state.optBoolean("vetroSlVisible", true) == false) continue;
            JSONObject geometry = feature.optJSONObject("geometry");
            if (!vetroFeaturePassesFilters(state, props, geometry, layerId)) continue;
            MapFeature parsed = parseMapFeature("vetro", layerId, featureId, geometry, props);
            if (parsed != null) out.add(parsed);
        }
        return out;
    }

    public JSONObject loadMapConfig() throws Exception {
        return requestJson("/api/map-config", "GET", null);
    }

    public void saveTicketActions(DashboardSnapshot snapshot, String ticketNumber, List<String> actionKeys) throws Exception {
        saveTicketCompletion(snapshot, ticketNumber, actionKeys, null, Collections.emptyList());
    }

    public JSONObject loadProfile() throws Exception {
        JSONObject payload = requestJson("/api/account/profile", "GET", null);
        JSONObject profile = payload.optJSONObject("profile");
        return profile == null ? new JSONObject() : profile;
    }

    public JSONObject saveProfile(JSONObject profile) throws Exception {
        JSONObject payload = requestJson("/api/account/profile", "POST", profile == null ? "{}" : profile.toString());
        JSONObject saved = payload.optJSONObject("profile");
        return saved == null ? new JSONObject() : saved;
    }

    public JSONObject submitAccountRequest(JSONObject request) throws Exception {
        return requestJson("/api/account/request", "POST", request == null ? "{}" : request.toString());
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

    public LocatorNote createLocatorNote(
        double latitude,
        double longitude,
        String category,
        String text,
        String targetType,
        String targetLabel,
        String targetId,
        String ticketNumber,
        String layerId,
        String featureId,
        List<Uri> attachments
    ) throws Exception {
        String boundary = "FiberLocatorNote" + System.currentTimeMillis();
        HttpURLConnection connection = open("/api/locator-notes", "POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
        try (OutputStream out = connection.getOutputStream()) {
            writeField(out, boundary, "lat", String.valueOf(latitude));
            writeField(out, boundary, "lng", String.valueOf(longitude));
            writeField(out, boundary, "category", category == null || category.trim().isEmpty() ? "instruction" : category.trim());
            writeField(out, boundary, "text", text == null ? "" : text.trim());
            writeField(out, boundary, "target_type", targetType == null || targetType.trim().isEmpty() ? "map" : targetType.trim());
            writeField(out, boundary, "target_label", targetLabel == null ? "" : targetLabel.trim());
            writeField(out, boundary, "target_id", targetId == null ? "" : targetId.trim());
            writeField(out, boundary, "ticket", ticketNumber == null ? "" : ticketNumber.trim());
            writeField(out, boundary, "layer_id", layerId == null ? "" : layerId.trim());
            writeField(out, boundary, "feature_id", featureId == null ? "" : featureId.trim());
            if (attachments != null) {
                for (Uri uri : attachments) writeFile(out, boundary, uri);
            }
            out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        }
        int status = connection.getResponseCode();
        if (status == 401 && login()) return createLocatorNote(latitude, longitude, category, text, targetType, targetLabel, targetId, ticketNumber, layerId, featureId, attachments);
        if (status < 200 || status >= 300) throw new IllegalStateException("Locator note save returned HTTP " + status);
        JSONObject payload = new JSONObject(read(connection));
        LocatorNote note = LocatorNote.fromJson(payload.optJSONObject("note"));
        if (note == null) throw new IllegalStateException("Locator note save did not return a note.");
        return note;
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
        try {
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
            JSONObject payload = new JSONObject(read(connection));
            if ("GET".equals(method) && shouldCache(path)) cacheJson(path, payload);
            return payload;
        } catch (Exception ex) {
            if ("GET".equals(method) && shouldCache(path)) {
                JSONObject cached = cachedJson(path);
                if (cached != null) {
                    usedCachedResponse = true;
                    return cached;
                }
            }
            throw ex;
        }
    }

    private void cacheJson(String path, JSONObject payload) {
        if (payload == null) return;
        AppSettings.prefs(context).edit()
            .putString(cacheKey(path), payload.toString())
            .putLong(cacheKey(path) + "_time", System.currentTimeMillis())
            .apply();
    }

    private JSONObject cachedJson(String path) {
        String key = cacheKey(path);
        long savedAt = AppSettings.prefs(context).getLong(key + "_time", 0L);
        if (savedAt <= 0L || System.currentTimeMillis() - savedAt > CACHE_MAX_AGE_MS) return null;
        String body = AppSettings.prefs(context).getString(key, "");
        if (body == null || body.trim().isEmpty()) return null;
        try {
            return new JSONObject(body);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String cacheKey(String path) {
        return "api_cache_" + (path == null ? "" : path.replaceAll("[^A-Za-z0-9_]+", "_"));
    }

    private static boolean shouldCache(String path) {
        if (path == null) return false;
        return !path.startsWith("/api/vetro");
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
            throw new IllegalStateException(serverErrorMessage(connection, "Attachment upload returned HTTP " + status));
        }
        read(connection);
    }

    private String serverErrorMessage(HttpURLConnection connection, String fallback) {
        try {
            String body = read(connection);
            if (body == null || body.trim().isEmpty()) return fallback;
            JSONObject payload = new JSONObject(body);
            String message = payload.optString("message", "").trim();
            return message.isEmpty() ? fallback : message;
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private List<LocatorNote> loadLocatorNotes() throws Exception {
        JSONObject payload = requestJson("/api/locator-notes", "GET", null);
        JSONArray notes = payload.optJSONArray("notes");
        List<LocatorNote> out = new ArrayList<>();
        if (notes == null) return out;
        for (int index = 0; index < notes.length(); index++) {
            LocatorNote note = LocatorNote.fromJson(notes.optJSONObject(index));
            if (note != null && note.hasCoordinates) out.add(note);
        }
        return out;
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
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(readTimeoutFor(path, method));
        connection.setRequestMethod(method);
        String cookie = AppSettings.authCookie(context);
        if (!cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);
        return connection;
    }

    private static int readTimeoutFor(String path, String method) {
        if ("GET".equals(method)) return GET_READ_TIMEOUT_MS;
        String cleanPath = path == null ? "" : path;
        if (cleanPath.contains("attachments") || cleanPath.contains("locator-notes")) return ATTACHMENT_READ_TIMEOUT_MS;
        return WRITE_READ_TIMEOUT_MS;
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

    private static boolean vetroFeaturePassesFilters(JSONObject state, JSONObject props, JSONObject geometry, String layerId) {
        if (state == null) return true;
        if (!passesLayerFilter(state.optJSONArray("vetroLayerFilterSelected"), layerId)) return false;
        if (!passesFilter(state.optJSONArray("vetroPlanFilterSelected"), text(props, "plan"))) return false;
        if (!passesFilter(state.optJSONArray("vetroBuildFilterSelected"), first(text(props, "build"), text(props, "Build")))) return false;
        if (!passesFilter(state.optJSONArray("vetroPlacementFilterSelected"), first(text(props, "placement"), text(props, "Placement")))) return false;
        if (!passesFilter(state.optJSONArray("vetroStatusFilterSelected"), text(props, "status_id"))) return false;
        if (!passesFilter(state.optJSONArray("vetroGeometryFilterSelected"), geometry == null ? "" : geometry.optString("type", ""))) return false;
        if (!passesFilter(state.optJSONArray("vetroFiberFilterSelected"), first(text(props, "Fiber_Capacity"), text(props, "Fiber Capacity")))) return false;
        if (!passesFilter(state.optJSONArray("vetroRouteFilterSelected"), first(text(props, "Bore_Plow"), text(props, "Bore Plow")))) return false;
        if (!passesFilter(state.optJSONArray("vetroPointFilterSelected"), first(text(props, "HH_Size"), text(props, "Size")))) return false;
        String search = state.optString("vetroSearch", "").trim().toLowerCase();
        if (search.isEmpty()) return true;
        return props.toString().toLowerCase().contains(search);
    }

    private static boolean passesFilter(JSONArray selected, String value) {
        Set<String> values = parseStringSet(selected);
        return values.isEmpty() || values.contains(value == null ? "" : value);
    }

    private static boolean passesLayerFilter(JSONArray selected, String layerId) {
        Set<String> values = parseStringSet(selected);
        if (values.isEmpty()) return true;
        String canonical = canonicalLayerId(layerId);
        return values.contains(layerId == null ? "" : layerId)
            || values.contains(canonical)
            || values.contains("Layer_" + canonical)
            || values.contains("layer_" + canonical);
    }

    private static String canonicalLayerId(String layerId) {
        String clean = layerId == null ? "" : layerId.trim();
        if (clean.toLowerCase(Locale.US).startsWith("layer_")) clean = clean.substring(6);
        return clean.isEmpty() ? "Unknown" : clean;
    }

    private static MapFeature parseMapFeature(String kind, String layerId, String label, JSONObject geometry, JSONObject props) {
        if (geometry == null) return null;
        String type = geometry.optString("type", "");
        JSONArray coordinates = geometry.optJSONArray("coordinates");
        if (coordinates == null) return null;
        List<List<double[]>> paths = new ArrayList<>();
        if ("Point".equals(type)) {
            double[] point = coordinate(coordinates);
            if (point != null) {
                List<double[]> path = new ArrayList<>();
                path.add(point);
                paths.add(path);
            }
        } else if ("MultiPoint".equals(type) || "LineString".equals(type)) {
            addPath(paths, coordinates);
        } else if ("MultiLineString".equals(type) || "Polygon".equals(type)) {
            for (int index = 0; index < coordinates.length(); index++) addPath(paths, coordinates.optJSONArray(index));
        } else if ("MultiPolygon".equals(type)) {
            for (int polygonIndex = 0; polygonIndex < coordinates.length(); polygonIndex++) {
                JSONArray polygon = coordinates.optJSONArray(polygonIndex);
                if (polygon == null) continue;
                for (int ringIndex = 0; ringIndex < polygon.length(); ringIndex++) addPath(paths, polygon.optJSONArray(ringIndex));
            }
        }
        if (paths.isEmpty()) return null;
        return new MapFeature(kind, layerId, label, type, paths, stringProperties(props));
    }

    private static Map<String, String> stringProperties(JSONObject props) {
        Map<String, String> out = new LinkedHashMap<>();
        if (props == null) return out;
        JSONArray names = props.names();
        if (names == null) return out;
        for (int index = 0; index < names.length(); index++) {
            String key = names.optString(index, "");
            if (!key.isEmpty()) out.put(key, props.optString(key, ""));
        }
        return out;
    }

    private static void addPath(List<List<double[]>> paths, JSONArray coordinates) {
        if (coordinates == null) return;
        List<double[]> path = new ArrayList<>();
        int stride = Math.max(1, coordinates.length() / 220);
        for (int index = 0; index < coordinates.length(); index += stride) {
            double[] point = coordinate(coordinates.optJSONArray(index));
            if (point != null) path.add(point);
        }
        if (path.size() >= 1) paths.add(path);
    }

    private static double[] coordinate(JSONArray coordinate) {
        if (coordinate == null || coordinate.length() < 2) return null;
        double lon = coordinate.optDouble(0, Double.NaN);
        double lat = coordinate.optDouble(1, Double.NaN);
        if (Double.isNaN(lat) || Double.isNaN(lon)) return null;
        return new double[] { lat, lon };
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
                    || isVetroFeatureFilterKey(key)
            ) {
                merged.put(key, overlay.opt(key));
            }
        }
        return merged;
    }

    private static boolean isVetroFeatureFilterKey(String key) {
        return "vetroLayerFilterSelected".equals(key)
            || "vetroPlanFilterSelected".equals(key)
            || "vetroBuildFilterSelected".equals(key)
            || "vetroPlacementFilterSelected".equals(key)
            || "vetroStatusFilterSelected".equals(key)
            || "vetroGeometryFilterSelected".equals(key)
            || "vetroFiberFilterSelected".equals(key)
            || "vetroRouteFilterSelected".equals(key)
            || "vetroPointFilterSelected".equals(key)
            || "vetroSearch".equals(key);
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

    private static boolean hasDashboardHiddenAction(List<String> actions) {
        if (actions == null || actions.isEmpty()) return false;
        for (String key : actions) {
            TicketAction action = action(key);
            if (action != null && action.hidesFromDashboard) return true;
        }
        return false;
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

    public static final class LocationPhoto {
        public final String id;
        public final String ticket;
        public final String originalName;
        public final String locationLabel;
        public final String address;
        public final String url;
        public final String uploadedAt;
        public final String reviewStatus;
        public final double latitude;
        public final double longitude;

        LocationPhoto(String id, String ticket, String originalName, String locationLabel, String address, String url, String uploadedAt, String reviewStatus, double latitude, double longitude) {
            this.id = id;
            this.ticket = ticket;
            this.originalName = originalName;
            this.locationLabel = locationLabel;
            this.address = address;
            this.url = url;
            this.uploadedAt = uploadedAt;
            this.reviewStatus = reviewStatus;
            this.latitude = latitude;
            this.longitude = longitude;
        }

        public boolean hasCoordinates() {
            return !Double.isNaN(latitude) && !Double.isNaN(longitude);
        }
    }

    public static final class DashboardSnapshot {
        public final List<Ticket> tickets;
        public final List<LocatorNote> locatorNotes;
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
            List<LocatorNote> locatorNotes,
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
            this.locatorNotes = Collections.unmodifiableList(new ArrayList<>(locatorNotes));
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
