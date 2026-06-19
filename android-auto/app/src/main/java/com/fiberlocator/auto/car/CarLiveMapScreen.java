package com.fiberlocator.auto.car;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PathEffect;
import android.graphics.Rect;
import android.location.Location;
import android.os.Handler;
import android.os.Looper;
import android.view.Surface;

import androidx.annotation.NonNull;
import androidx.car.app.AppManager;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.SurfaceCallback;
import androidx.car.app.SurfaceContainer;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarColor;
import androidx.car.app.model.Pane;
import androidx.car.app.model.PaneTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.model.MapController;
import androidx.car.app.navigation.model.MapWithContentTemplate;
import androidx.car.app.versioning.CarAppApiLevels;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleEventObserver;

import com.fiberlocator.auto.data.LocatorNote;
import com.fiberlocator.auto.data.MapFeature;
import com.fiberlocator.auto.data.Ticket;
import com.fiberlocator.auto.data.TicketRepository;
import com.fiberlocator.auto.data.TicketRepository.DashboardSnapshot;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.net.HttpURLConnection;
import java.net.URL;

public final class CarLiveMapScreen extends Screen implements SurfaceCallback {
    private static final int MAX_DRAWN_FEATURES = 25000;
    private static final int DRAW_THROTTLE_MS = 80;
    private static final double FOLLOW_ZOOM = 18.0;
    private static final double MIN_ZOOM = 8.0;
    private static final double MAX_ZOOM = 20.0;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final ExecutorService tileExecutor = Executors.newFixedThreadPool(4);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Ticket> tickets = new ArrayList<>();
    private final List<LocatorNote> locatorNotes = new ArrayList<>();
    private final List<MapFeature> vetroFeatures = new ArrayList<>();
    private final Ticket focusTicket;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Rect visibleArea = new Rect();
    private final Map<String, Bitmap> tileCache = new LinkedHashMap<String, Bitmap>(192, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Bitmap> eldest) {
            return size() > 192;
        }
    };
    private final List<String> loadingTiles = new ArrayList<>();

    private Surface surface;
    private int surfaceWidth;
    private int surfaceHeight;
    private Location currentLocation;
    private FusedLocationProviderClient fusedLocationProvider;
    private LocationCallback locationCallback;
    private JSONObject mapState = new JSONObject();
    private String mapStyle = "standard";
    private String mapboxToken = "";
    private String activeTileStyleKey = "";
    private boolean loading = true;
    private String error = "";
    private boolean followLocation = true;
    private boolean drawScheduled = false;
    private long lastDrawMs = 0L;
    private double centerLat = 33.23;
    private double centerLon = -92.67;
    private double zoom = 13.0;

    private final LocationCallback fusedLocationCallback = new LocationCallback() {
        @Override
        public void onLocationResult(@NonNull LocationResult result) {
            Location location = result.getLastLocation();
            if (location != null) {
                acceptLocation(location, false);
            }
        }
    };

    public CarLiveMapScreen(@NonNull CarContext carContext) {
        this(carContext, null);
    }

    public CarLiveMapScreen(@NonNull CarContext carContext, Ticket focusTicket) {
        super(carContext);
        this.focusTicket = focusTicket;
        carContext.getCarService(AppManager.class).setSurfaceCallback(this);
        getLifecycle().addObserver((LifecycleEventObserver) (source, event) -> {
            if (event == Lifecycle.Event.ON_DESTROY) {
                stopLocationUpdates();
                getCarContext().getCarService(AppManager.class).setSurfaceCallback(null);
                executor.shutdownNow();
                tileExecutor.shutdownNow();
            }
        });
        startLocationUpdates();
        reload();
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        if (getCarContext().getCarAppApiLevel() < CarAppApiLevels.LEVEL_7) {
            return fallbackTemplate();
        }
        Pane pane = new Pane.Builder()
            .addRow(new Row.Builder()
                .setTitle(loading ? "Loading live map" : "Live map")
                .addText(statusLine())
                .addText("Same saved view, VETRO styling, basemap, and live location")
                .build())
            .build();
        ActionStrip actions = new ActionStrip.Builder()
            .addAction(new Action.Builder().setTitle("Tickets").setOnClickListener(this::finish).build())
            .addAction(new Action.Builder().setTitle(followLocation ? "Following" : "Follow").setOnClickListener(this::followCurrentLocation).build())
            .addAction(new Action.Builder().setTitle("+").setOnClickListener(() -> zoomBy(1.0)).build())
            .addAction(new Action.Builder().setTitle("-").setOnClickListener(() -> zoomBy(-1.0)).build())
            .build();
        MapController controller = new MapController.Builder()
            .setMapActionStrip(new ActionStrip.Builder().addAction(Action.PAN).build())
            .setPanModeListener(isInPanMode -> drawMap())
            .build();
        return new MapWithContentTemplate.Builder()
            .setContentTemplate(new PaneTemplate.Builder(pane).build())
            .setActionStrip(actions)
            .setMapController(controller)
            .build();
    }

    @Override
    public void onSurfaceAvailable(@NonNull SurfaceContainer surfaceContainer) {
        releaseSurface();
        surface = surfaceContainer.getSurface();
        surfaceWidth = surfaceContainer.getWidth();
        surfaceHeight = surfaceContainer.getHeight();
        drawMap();
    }

    @Override
    public void onVisibleAreaChanged(@NonNull Rect area) {
        visibleArea.set(area);
        drawMap();
    }

    @Override
    public void onStableAreaChanged(@NonNull Rect area) {
        drawMap();
    }

    @Override
    public void onSurfaceDestroyed(@NonNull SurfaceContainer surfaceContainer) {
        releaseSurface();
    }

    @Override
    public void onScroll(float distanceX, float distanceY) {
        panBy(distanceX, distanceY);
    }

    @Override
    public void onScale(float focusX, float focusY, float scaleFactor) {
        if (scaleFactor > 0) {
            zoom = clamp(zoom + (Math.log(scaleFactor) / Math.log(2.0)), MIN_ZOOM, MAX_ZOOM);
            drawMap();
        }
    }

    @Override
    public void onClick(float x, float y) {
        Ticket nearest = nearestTicket(x, y);
        if (nearest != null) getScreenManager().push(new TicketDetailScreen(getCarContext(), nearest));
    }

    private Template fallbackTemplate() {
        Pane pane = new Pane.Builder()
            .addRow(new Row.Builder()
                .setTitle("Live map requires newer Android Auto")
                .addText("Ticket list still works. Update Android Auto / Google Play services for custom map layers.")
                .build())
            .build();
        return new PaneTemplate.Builder(pane)
            .setTitle("Map")
            .setHeaderAction(Action.BACK)
            .build();
    }

    private void reload() {
        loading = true;
        error = "";
        invalidate();
        executor.execute(() -> {
            try {
                TicketRepository repository = new TicketRepository(getCarContext());
                DashboardSnapshot snapshot = repository.loadSnapshot();
                List<MapFeature> layers = repository.loadVetroMapFeatures(snapshot.state);
                JSONObject mapConfig;
                try {
                    mapConfig = repository.loadMapConfig();
                } catch (Exception ignored) {
                    mapConfig = new JSONObject();
                }
                JSONObject loadedMapConfig = mapConfig;
                main.post(() -> {
                    tickets.clear();
                    tickets.addAll(snapshot.tickets);
                    locatorNotes.clear();
                    locatorNotes.addAll(snapshot.locatorNotes);
                    vetroFeatures.clear();
                    vetroFeatures.addAll(layers);
                    mapState = snapshot.state == null ? new JSONObject() : snapshot.state;
                    mapStyle = normalizeMapStyle(snapshot.mapStyle);
                    mapboxToken = loadedMapConfig.optString("mapboxAccessToken", "");
                    loading = false;
                    if (focusTicket != null && focusTicket.hasCoordinates) centerOnTicket(focusTicket);
                    else if (currentLocation != null) followCurrentLocation();
                    else centerOnWork(false);
                    invalidate();
                    drawMap();
                });
            } catch (Exception ex) {
                main.post(() -> {
                    loading = false;
                    error = ex.getMessage() == null ? "Unable to load dashboard map." : ex.getMessage();
                    invalidate();
                    drawMap();
                });
            }
        });
    }

    private String statusLine() {
        if (!error.isEmpty()) return error;
        if (loading) return "Loading from dashboard";
        return String.format(Locale.US, "%d tickets | %d notes | %d VETRO features", tickets.size(), locatorNotes.size(), vetroFeatures.size());
    }

    private void startLocationUpdates() {
        try {
            if (
                getCarContext().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                    && getCarContext().checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED
            ) {
                return;
            }
            fusedLocationProvider = LocationServices.getFusedLocationProviderClient(getCarContext());
            locationCallback = fusedLocationCallback;
            fusedLocationProvider.getLastLocation().addOnSuccessListener(location -> {
                if (location != null) acceptLocation(location, true);
            });
            LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L)
                .setMinUpdateIntervalMillis(500L)
                .setMinUpdateDistanceMeters(1f)
                .setWaitForAccurateLocation(true)
                .build();
            fusedLocationProvider.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());
        } catch (SecurityException ignored) {
        }
    }

    private void stopLocationUpdates() {
        try {
            if (fusedLocationProvider != null && locationCallback != null) {
                fusedLocationProvider.removeLocationUpdates(locationCallback);
            }
        } catch (SecurityException ignored) {
        }
    }

    private void acceptLocation(Location location, boolean fromLastKnown) {
        if (!shouldAcceptLocation(location, fromLastKnown)) return;
        currentLocation = new Location(location);
        if (followLocation) {
            centerLat = location.getLatitude();
            centerLon = location.getLongitude();
            if (zoom < FOLLOW_ZOOM) zoom = FOLLOW_ZOOM;
        }
        drawMap();
    }

    private boolean shouldAcceptLocation(Location location, boolean fromLastKnown) {
        if (location == null) return false;
        double lat = location.getLatitude();
        double lon = location.getLongitude();
        if (Double.isNaN(lat) || Double.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
        if (location.isFromMockProvider()) return false;
        long ageMs = locationAgeMs(location);
        if (ageMs > 120000L) return currentLocation == null && fromLastKnown;
        float accuracy = location.hasAccuracy() ? location.getAccuracy() : 999f;
        if (accuracy > (currentLocation == null ? 100f : 65f)) return false;
        if (currentLocation == null) return true;

        float previousAccuracy = currentLocation.hasAccuracy() ? currentLocation.getAccuracy() : 50f;
        float distance = currentLocation.distanceTo(location);
        long deltaMs = Math.max(1000L, Math.abs(locationElapsedMs(location) - locationElapsedMs(currentLocation)));
        double speedMetersPerSecond = distance / (deltaMs / 1000.0);

        if (distance > 45f && deltaMs < 4000L && accuracy > Math.max(18f, previousAccuracy * 1.25f)) return false;
        if (distance > 90f && deltaMs < 10000L && accuracy > previousAccuracy && distance > previousAccuracy + accuracy + 35f) return false;
        if (speedMetersPerSecond > 55.0 && accuracy > 12f) return false;
        return true;
    }

    private static long locationAgeMs(Location location) {
        long elapsedMs = locationElapsedMs(location);
        if (elapsedMs > 0L) return Math.max(0L, android.os.SystemClock.elapsedRealtime() - elapsedMs);
        long time = location.getTime();
        return time <= 0L ? 0L : Math.max(0L, System.currentTimeMillis() - time);
    }

    private static long locationElapsedMs(Location location) {
        long nanos = location.getElapsedRealtimeNanos();
        return nanos <= 0L ? 0L : nanos / 1000000L;
    }

    private void releaseSurface() {
        if (surface != null) {
            surface.release();
            surface = null;
        }
    }

    private void drawMap() {
        long now = android.os.SystemClock.uptimeMillis();
        long waitMs = DRAW_THROTTLE_MS - (now - lastDrawMs);
        if (waitMs > 0L) {
            if (!drawScheduled) {
                drawScheduled = true;
                main.postDelayed(() -> {
                    drawScheduled = false;
                    drawMapNow();
                }, waitMs);
            }
            return;
        }
        if (!drawScheduled) drawMapNow();
    }

    private void drawMapNow() {
        lastDrawMs = android.os.SystemClock.uptimeMillis();
        Surface drawSurface = surface;
        if (drawSurface == null || !drawSurface.isValid() || surfaceWidth <= 0 || surfaceHeight <= 0) return;
        Canvas canvas = null;
        try {
            canvas = drawSurface.lockCanvas(null);
            drawBaseMap(canvas);
            drawVetro(canvas);
            drawTicketPolygons(canvas);
            drawLocatorNotes(canvas);
            drawTickets(canvas);
            drawCurrentLocation(canvas);
            drawHud(canvas);
        } catch (Exception ignored) {
        } finally {
            if (canvas != null) {
                try {
                    drawSurface.unlockCanvasAndPost(canvas);
                } catch (Exception ignored) {
                }
            }
        }
    }

    private void drawBaseMap(Canvas canvas) {
        boolean night = isNightMap();
        String tileStyle = tileStyleKey(night);
        if (!tileStyle.equals(activeTileStyleKey)) {
            activeTileStyleKey = tileStyle;
            synchronized (tileCache) {
                tileCache.clear();
                loadingTiles.clear();
            }
        }
        canvas.drawColor(night ? Color.rgb(9, 15, 27) : Color.rgb(235, 242, 248));
        int tileZ = (int) clamp(Math.round(zoom), 1, 19);
        double tileScale = Math.pow(2.0, zoom - tileZ);
        double worldScale = Math.pow(2.0, zoom) * 256.0;
        double centerX = lonToWorld(centerLon, worldScale);
        double centerY = latToWorld(centerLat, worldScale);
        int minX = (int) Math.floor((centerX - surfaceWidth / 2.0) / (256.0 * tileScale)) - 1;
        int maxX = (int) Math.floor((centerX + surfaceWidth / 2.0) / (256.0 * tileScale)) + 1;
        int minY = (int) Math.floor((centerY - surfaceHeight / 2.0) / (256.0 * tileScale)) - 1;
        int maxY = (int) Math.floor((centerY + surfaceHeight / 2.0) / (256.0 * tileScale)) + 1;
        int maxTile = (1 << tileZ) - 1;
        for (int x = minX; x <= maxX; x++) {
            int wrappedX = ((x % (maxTile + 1)) + (maxTile + 1)) % (maxTile + 1);
            for (int y = Math.max(0, minY); y <= Math.min(maxTile, maxY); y++) {
                String key = tileKey(tileStyle, tileZ, wrappedX, y);
                Bitmap tile;
                synchronized (tileCache) {
                    tile = tileCache.get(key);
                }
                float left = (float) (x * 256.0 * tileScale - centerX + surfaceWidth / 2.0);
                float top = (float) (y * 256.0 * tileScale - centerY + surfaceHeight / 2.0);
                if (tile != null) {
                    Rect dst = new Rect(Math.round(left), Math.round(top), Math.round(left + 256f * (float) tileScale) + 1, Math.round(top + 256f * (float) tileScale) + 1);
                    canvas.drawBitmap(tile, null, dst, null);
                } else {
                    enqueueTileLoad(tileZ, wrappedX, y, key, tileStyle);
                }
            }
        }
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1f);
        paint.setColor(night ? Color.argb(105, 58, 70, 92) : Color.argb(90, 205, 216, 226));
        for (int x = 0; x < surfaceWidth; x += Math.max(80, surfaceWidth / 8)) canvas.drawLine(x, 0, x, surfaceHeight, paint);
        for (int y = 0; y < surfaceHeight; y += Math.max(80, surfaceHeight / 6)) canvas.drawLine(0, y, surfaceWidth, y, paint);
    }

    private void enqueueTileLoad(int z, int x, int y, String key, String style) {
        synchronized (tileCache) {
            if (tileCache.containsKey(key) || loadingTiles.contains(key)) return;
            loadingTiles.add(key);
        }
        tileExecutor.execute(() -> {
            Bitmap bitmap = null;
            try {
                    HttpURLConnection connection = (HttpURLConnection) new URL(tileUrl(z, x, y, style)).openConnection();
                connection.setConnectTimeout(3000);
                connection.setReadTimeout(5000);
                connection.setRequestProperty("User-Agent", "Fiber Locator Android Auto");
                if (connection.getResponseCode() >= 200 && connection.getResponseCode() < 300) {
                    bitmap = BitmapFactory.decodeStream(connection.getInputStream());
                }
            } catch (Exception ignored) {
            }
            Bitmap loaded = bitmap;
            main.post(() -> {
                synchronized (tileCache) {
                    loadingTiles.remove(key);
                    if (loaded != null) tileCache.put(key, loaded);
                }
                if (loaded != null) drawMap();
            });
        });
    }

    private String tileKey(String style, int z, int x, int y) {
        return style + "/" + z + "/" + x + "/" + y;
    }

    private String tileUrl(int z, int x, int y, String style) {
        if (style.startsWith("mapbox:") && !mapboxToken.isEmpty()) {
            String styleId = style.substring("mapbox:".length());
            return "https://api.mapbox.com/styles/v1/mapbox/" + styleId + "/tiles/256/" + z + "/" + x + "/" + y + "?access_token=" + mapboxToken;
        }
        if ("satellite".equals(style)) {
            return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" + z + "/" + y + "/" + x;
        }
        if ("carto-light".equals(style)) {
            return "https://a.basemaps.cartocdn.com/light_all/" + z + "/" + x + "/" + y + ".png";
        }
        if ("carto-dark".equals(style)) {
            return "https://a.basemaps.cartocdn.com/dark_all/" + z + "/" + x + "/" + y + ".png";
        }
        return "https://a.tile.openstreetmap.org/" + z + "/" + x + "/" + y + ".png";
    }

    private String tileStyleKey(boolean night) {
        if (night) {
            if (!mapboxToken.isEmpty()) return "mapbox:navigation-night-v1";
            return "carto-dark";
        }
        String style = normalizeMapStyle(mapStyle);
        if (style.startsWith("mapbox-")) return "mapbox:" + mapboxStyleId(style);
        if ("satellite".equals(style) || "hybrid".equals(style)) return "satellite";
        if ("light".equals(style)) return "carto-light";
        if ("dark".equals(style)) return "carto-dark";
        return "osm";
    }

    private boolean isNightMap() {
        if (getCarContext().isDarkMode()) return true;
        double lat = currentLocation == null ? centerLat : currentLocation.getLatitude();
        double lon = currentLocation == null ? centerLon : currentLocation.getLongitude();
        return isAfterCivilDusk(lat, lon, System.currentTimeMillis());
    }

    private static boolean isAfterCivilDusk(double latitude, double longitude, long nowMs) {
        Calendar calendar = Calendar.getInstance(TimeZone.getDefault(), Locale.US);
        calendar.setTimeInMillis(nowMs);
        int dayOfYear = calendar.get(Calendar.DAY_OF_YEAR);
        double lngHour = longitude / 15.0;
        double sunriseUtc = solarUtcHour(dayOfYear, latitude, lngHour, true);
        double sunsetUtc = solarUtcHour(dayOfYear, latitude, lngHour, false);
        if (Double.isNaN(sunriseUtc) || Double.isNaN(sunsetUtc)) {
            int hour = calendar.get(Calendar.HOUR_OF_DAY);
            return hour < 6 || hour >= 18;
        }
        double offsetHours = TimeZone.getDefault().getOffset(nowMs) / 3600000.0;
        double sunriseLocal = wrapHour(sunriseUtc + offsetHours);
        double sunsetLocal = wrapHour(sunsetUtc + offsetHours);
        double nowLocal = calendar.get(Calendar.HOUR_OF_DAY)
            + calendar.get(Calendar.MINUTE) / 60.0
            + calendar.get(Calendar.SECOND) / 3600.0;
        double duskLocal = wrapHour(sunsetLocal + 0.35);
        double dawnLocal = wrapHour(sunriseLocal - 0.35);
        if (duskLocal > dawnLocal) return nowLocal >= duskLocal || nowLocal < dawnLocal;
        return nowLocal >= duskLocal && nowLocal < dawnLocal;
    }

    private static double solarUtcHour(int dayOfYear, double latitude, double lngHour, boolean sunrise) {
        double t = dayOfYear + (((sunrise ? 6.0 : 18.0) - lngHour) / 24.0);
        double meanAnomaly = (0.9856 * t) - 3.289;
        double trueLongitude = meanAnomaly
            + (1.916 * Math.sin(Math.toRadians(meanAnomaly)))
            + (0.020 * Math.sin(Math.toRadians(2 * meanAnomaly)))
            + 282.634;
        trueLongitude = wrapDegrees(trueLongitude);
        double rightAscension = Math.toDegrees(Math.atan(0.91764 * Math.tan(Math.toRadians(trueLongitude))));
        rightAscension = wrapDegrees(rightAscension);
        double longitudeQuadrant = Math.floor(trueLongitude / 90.0) * 90.0;
        double ascensionQuadrant = Math.floor(rightAscension / 90.0) * 90.0;
        rightAscension = (rightAscension + longitudeQuadrant - ascensionQuadrant) / 15.0;
        double sinDeclination = 0.39782 * Math.sin(Math.toRadians(trueLongitude));
        double cosDeclination = Math.cos(Math.asin(sinDeclination));
        double zenith = 96.0; // Civil twilight keeps the map in night mode through dusk and dawn.
        double cosHour = (Math.cos(Math.toRadians(zenith)) - (sinDeclination * Math.sin(Math.toRadians(latitude))))
            / (cosDeclination * Math.cos(Math.toRadians(latitude)));
        if (cosHour < -1 || cosHour > 1) return Double.NaN;
        double hourAngle = sunrise ? 360.0 - Math.toDegrees(Math.acos(cosHour)) : Math.toDegrees(Math.acos(cosHour));
        hourAngle /= 15.0;
        double localMeanTime = hourAngle + rightAscension - (0.06571 * t) - 6.622;
        return wrapHour(localMeanTime - lngHour);
    }

    private static double wrapDegrees(double value) {
        double out = value % 360.0;
        return out < 0 ? out + 360.0 : out;
    }

    private static double wrapHour(double value) {
        double out = value % 24.0;
        return out < 0 ? out + 24.0 : out;
    }

    private void drawVetro(Canvas canvas) {
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
        int drawn = 0;
        for (MapFeature feature : vetroFeatures) {
            if (drawn >= MAX_DRAWN_FEATURES) break;
            VetroStyle style = vetroStyle(feature);
            paint.setColor(style.color);
            paint.setStrokeWidth(feature.isPoint() ? Math.max(4f, style.size) : Math.max(2f, style.size));
            paint.setAlpha(style.alpha);
            paint.setPathEffect(lineEffect(style.name));
            for (List<double[]> path : feature.paths) {
                if (feature.isPoint() || path.size() == 1) {
                    float[] p = project(path.get(0)[0], path.get(0)[1]);
                    if (!pointVisible(p[0], p[1], 96f)) continue;
                    drawShape(canvas, p[0], p[1], style);
                    drawn++;
                } else {
                    if (!pathVisible(path, 128f)) continue;
                    drawPath(canvas, path, false);
                    drawn++;
                }
            }
        }
        paint.setAlpha(255);
        paint.setPathEffect(null);
    }

    private void drawTicketPolygons(Canvas canvas) {
        paint.setStyle(Paint.Style.FILL);
        for (Ticket ticket : tickets) {
            List<List<double[]>> rings = ticketPolygon(ticket);
            if (rings.isEmpty()) continue;
            paint.setColor(ticketColor(ticket));
            paint.setStyle(Paint.Style.FILL);
            paint.setAlpha(10);
            for (List<double[]> ring : rings) {
                if (pathVisible(ring, 160f)) drawPath(canvas, ring, true);
            }
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2.5f);
            paint.setAlpha(150);
            for (List<double[]> ring : rings) {
                if (pathVisible(ring, 160f)) drawPath(canvas, ring, false);
            }
        }
        paint.setAlpha(255);
    }

    private void drawTickets(Canvas canvas) {
        paint.setStyle(Paint.Style.FILL);
        for (Ticket ticket : tickets) {
            if (!ticket.hasCoordinates) continue;
            float[] p = project(ticket.latitude, ticket.longitude);
            if (!pointVisible(p[0], p[1], 40f)) continue;
            paint.setColor(Color.WHITE);
            canvas.drawCircle(p[0], p[1], 10f, paint);
            paint.setColor(ticketColor(ticket));
            canvas.drawCircle(p[0], p[1], 7f, paint);
        }
    }

    private void drawLocatorNotes(Canvas canvas) {
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.rgb(147, 51, 234));
        for (LocatorNote note : locatorNotes) {
            if (!note.hasCoordinates) continue;
            float[] p = project(note.latitude, note.longitude);
            if (!pointVisible(p[0], p[1], 40f)) continue;
            canvas.drawRect(p[0] - 4f, p[1] - 4f, p[0] + 4f, p[1] + 4f, paint);
        }
    }

    private void drawCurrentLocation(Canvas canvas) {
        if (currentLocation == null) return;
        float[] p = project(currentLocation.getLatitude(), currentLocation.getLongitude());
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.argb(56, 56, 189, 248));
        canvas.drawCircle(p[0], p[1], 22f, paint);
        paint.setColor(Color.WHITE);
        canvas.drawCircle(p[0], p[1], 10f, paint);
        paint.setColor(Color.rgb(2, 132, 199));
        canvas.drawCircle(p[0], p[1], 7f, paint);
    }

    private void drawHud(Canvas canvas) {
        int left = visibleArea.isEmpty() ? 16 : Math.max(16, visibleArea.left + 12);
        int top = visibleArea.isEmpty() ? 18 : Math.max(18, visibleArea.top + 12);
        paint.setStyle(Paint.Style.FILL);
        boolean night = isNightMap();
        paint.setColor(night ? Color.argb(210, 5, 10, 22) : Color.argb(188, 15, 23, 42));
        canvas.drawRoundRect(left, top, left + 340, top + 64, 12, 12, paint);
        paint.setColor(Color.WHITE);
        paint.setTextSize(21f);
        paint.setFakeBoldText(true);
        canvas.drawText(night ? "Fiber night map" : "Fiber live map", left + 16, top + 25, paint);
        paint.setFakeBoldText(false);
        paint.setTextSize(15f);
        canvas.drawText(statusLine(), left + 16, top + 50, paint);
    }

    private void drawPath(Canvas canvas, List<double[]> coordinates, boolean fill) {
        if (coordinates.isEmpty()) return;
        Path path = new Path();
        float[] first = project(coordinates.get(0)[0], coordinates.get(0)[1]);
        path.moveTo(first[0], first[1]);
        int targetPoints = zoom >= 17 ? 180 : (zoom >= 14 ? 110 : 70);
        int stride = Math.max(1, coordinates.size() / targetPoints);
        for (int i = stride; i < coordinates.size(); i += stride) {
            float[] p = project(coordinates.get(i)[0], coordinates.get(i)[1]);
            path.lineTo(p[0], p[1]);
        }
        if (fill) {
            path.close();
            canvas.drawPath(path, paint);
        } else {
            paint.setStyle(Paint.Style.STROKE);
            canvas.drawPath(path, paint);
        }
    }

    private void drawShape(Canvas canvas, float x, float y, VetroStyle style) {
        float radius = Math.max(4f, style.size);
        paint.setStyle(Paint.Style.FILL);
        paint.setPathEffect(null);
        paint.setColor(style.color);
        paint.setAlpha(style.alpha);
        if ("square".equals(style.name)) {
            canvas.drawRect(x - radius, y - radius, x + radius, y + radius, paint);
        } else if ("diamond".equals(style.name)) {
            Path path = new Path();
            path.moveTo(x, y - radius * 1.25f);
            path.lineTo(x + radius * 1.25f, y);
            path.lineTo(x, y + radius * 1.25f);
            path.lineTo(x - radius * 1.25f, y);
            path.close();
            canvas.drawPath(path, paint);
        } else if ("pin".equals(style.name)) {
            canvas.drawCircle(x, y - radius * 0.35f, radius, paint);
            Path point = new Path();
            point.moveTo(x - radius * 0.7f, y + radius * 0.25f);
            point.lineTo(x + radius * 0.7f, y + radius * 0.25f);
            point.lineTo(x, y + radius * 1.6f);
            point.close();
            canvas.drawPath(point, paint);
        } else if ("house".equals(style.name)) {
            Path house = new Path();
            house.moveTo(x, y - radius * 1.35f);
            house.lineTo(x + radius * 1.3f, y - radius * 0.15f);
            house.lineTo(x + radius * 1.3f, y + radius * 1.2f);
            house.lineTo(x - radius * 1.3f, y + radius * 1.2f);
            house.lineTo(x - radius * 1.3f, y - radius * 0.15f);
            house.close();
            canvas.drawPath(house, paint);
        } else {
            canvas.drawCircle(x, y, radius, paint);
        }
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2f);
        paint.setColor(style.outline);
        paint.setAlpha(Math.min(230, style.alpha + 50));
        canvas.drawCircle(x, y, radius + 1.5f, paint);
    }

    private PathEffect lineEffect(String style) {
        if ("dashed".equals(style)) return new DashPathEffect(new float[] { 14f, 9f }, 0f);
        if ("dotted".equals(style)) return new DashPathEffect(new float[] { 2f, 10f }, 0f);
        return null;
    }

    private VetroStyle vetroStyle(MapFeature feature) {
        boolean serviceLocation = "26".equals(feature.layerId) && first(feature.properties.get("ID"), feature.properties.get("feature_id")).toUpperCase(Locale.US).startsWith("SL-");
        String styleName = serviceLocation
            ? mapState.optString("vetroSlShape", "diamond")
            : optStringObject("vetroLayerStyleOverrides", feature.layerId, feature.isPoint() ? "circle" : "solid");
        if (!serviceLocation && feature.isPoint()) {
            if ("28".equals(feature.layerId)) styleName = "square";
            else if ("42".equals(feature.layerId)) styleName = "circle";
        }
        int color = serviceLocation
            ? parseColor(mapState.optString("vetroSlColor", "#e7298a"), Color.rgb(231, 41, 138))
            : parseColor(optStringObject("vetroLayerColorOverrides", feature.layerId, ""), vetroColor(feature.layerId));
        int outline = serviceLocation
            ? parseColor(mapState.optString("vetroSlOutlineColor", "#111827"), Color.rgb(17, 24, 39))
            : Color.WHITE;
        double opacity = serviceLocation
            ? mapState.optDouble("vetroSlOpacity", 1.0)
            : optDoubleObject("vetroLayerOpacityOverrides", feature.layerId, mapState.optDouble("vetroOpacity", 0.72));
        double size = serviceLocation
            ? mapState.optDouble("vetroSlSize", 13.0)
            : optDoubleObject("vetroLayerSizeOverrides", feature.layerId, feature.isPoint() ? 7.0 : 3.0);
        return new VetroStyle(normalizeShapeOrLine(styleName, feature.isPoint()), color, outline, carLayerSize(feature.layerId, size), opaqueLayerAlpha(opacity));
    }

    private static int opaqueLayerAlpha(double savedOpacity) {
        return (int) clamp(Math.round(Math.max(savedOpacity, 0.92) * 255.0), 235, 255);
    }

    private static float carLayerSize(String layerId, double savedSize) {
        double boost = 0.0;
        if ("28".equals(layerId) || "42".equals(layerId)) boost = 4.0;
        else if ("17".equals(layerId) || "654".equals(layerId)) boost = 2.5;
        return (float) clamp(savedSize + boost, 1.0, 32.0);
    }

    private String optStringObject(String objectKey, String key, String fallback) {
        JSONObject object = mapState.optJSONObject(objectKey);
        if (object == null) return fallback;
        String value = object.optString(key, "");
        return value.isEmpty() ? fallback : value;
    }

    private double optDoubleObject(String objectKey, String key, double fallback) {
        JSONObject object = mapState.optJSONObject(objectKey);
        if (object == null || !object.has(key)) return fallback;
        return object.optDouble(key, fallback);
    }

    private static String normalizeShapeOrLine(String value, boolean point) {
        String clean = value == null ? "" : value.trim().toLowerCase(Locale.US);
        if (point) {
            if ("square".equals(clean) || "diamond".equals(clean) || "pin".equals(clean) || "house".equals(clean)) return clean;
            return "circle";
        }
        if ("dashed".equals(clean) || "dotted".equals(clean)) return clean;
        return "solid";
    }

    private List<List<double[]>> ticketPolygon(Ticket ticket) {
        if (ticket.polygon == null) return Collections.emptyList();
        JSONObject geometry = ticket.polygon.optJSONObject("geometry");
        if (geometry == null) geometry = ticket.polygon;
        JSONArray coordinates = geometry.optJSONArray("coordinates");
        if (coordinates == null) return Collections.emptyList();
        String type = geometry.optString("type", "");
        List<List<double[]>> paths = new ArrayList<>();
        if ("Polygon".equals(type)) {
            for (int i = 0; i < coordinates.length(); i++) addCoordinatePath(paths, coordinates.optJSONArray(i));
        } else if ("MultiPolygon".equals(type)) {
            for (int p = 0; p < coordinates.length(); p++) {
                JSONArray polygon = coordinates.optJSONArray(p);
                if (polygon == null) continue;
                for (int r = 0; r < polygon.length(); r++) addCoordinatePath(paths, polygon.optJSONArray(r));
            }
        }
        return paths;
    }

    private void addCoordinatePath(List<List<double[]>> paths, JSONArray coordinates) {
        if (coordinates == null) return;
        List<double[]> path = new ArrayList<>();
        for (int i = 0; i < coordinates.length(); i++) {
            JSONArray item = coordinates.optJSONArray(i);
            if (item == null || item.length() < 2) continue;
            double lon = item.optDouble(0, Double.NaN);
            double lat = item.optDouble(1, Double.NaN);
            if (!Double.isNaN(lat) && !Double.isNaN(lon)) path.add(new double[] { lat, lon });
        }
        if (!path.isEmpty()) paths.add(path);
    }

    private void centerOnWork(boolean disableFollow) {
        if (disableFollow) followLocation = false;
        double minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        boolean found = false;
        for (Ticket ticket : tickets) {
            if (!ticket.hasCoordinates) continue;
            minLat = Math.min(minLat, ticket.latitude);
            maxLat = Math.max(maxLat, ticket.latitude);
            minLon = Math.min(minLon, ticket.longitude);
            maxLon = Math.max(maxLon, ticket.longitude);
            found = true;
        }
        if (!found && currentLocation != null) {
            centerLat = currentLocation.getLatitude();
            centerLon = currentLocation.getLongitude();
            zoom = 15;
        } else if (found) {
            centerLat = (minLat + maxLat) / 2.0;
            centerLon = (minLon + maxLon) / 2.0;
            zoom = Math.max(10.0, Math.min(15.0, 12.0 - Math.log(Math.max(maxLat - minLat, maxLon - minLon) + 0.01) / Math.log(2.0)));
        }
        drawMap();
        invalidate();
    }

    private void centerOnTicket(Ticket ticket) {
        followLocation = false;
        List<List<double[]>> rings = ticketPolygon(ticket);
        if (!rings.isEmpty()) {
            fitPaths(rings, 17.8, 18.8);
        } else {
            centerLat = ticket.latitude;
            centerLon = ticket.longitude;
            zoom = Math.max(18.0, zoom);
        }
        drawMap();
        invalidate();
    }

    private void zoomBy(double delta) {
        zoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);
        drawMap();
        invalidate();
    }

    private void panBy(float distanceX, float distanceY) {
        followLocation = false;
        double scale = Math.pow(2.0, zoom) * 256.0;
        double centerX = lonToWorld(centerLon, scale) + distanceX;
        double centerY = latToWorld(centerLat, scale) + distanceY;
        centerLon = worldToLon(centerX, scale);
        centerLat = worldToLat(centerY, scale);
        drawMap();
        invalidate();
    }

    private void followCurrentLocation() {
        followLocation = true;
        if (currentLocation != null) {
            centerLat = currentLocation.getLatitude();
            centerLon = currentLocation.getLongitude();
            if (zoom < FOLLOW_ZOOM) zoom = FOLLOW_ZOOM;
        }
        invalidate();
        drawMap();
    }

    private Ticket nearestTicket(float x, float y) {
        Ticket nearest = null;
        double best = 28 * 28;
        for (Ticket ticket : tickets) {
            if (!ticket.hasCoordinates) continue;
            float[] p = project(ticket.latitude, ticket.longitude);
            double dx = x - p[0];
            double dy = y - p[1];
            double dist = dx * dx + dy * dy;
            if (dist < best) {
                best = dist;
                nearest = ticket;
            }
        }
        return nearest;
    }

    private boolean pointVisible(float x, float y, float margin) {
        return x >= -margin && x <= surfaceWidth + margin && y >= -margin && y <= surfaceHeight + margin;
    }

    private boolean pathVisible(List<double[]> coordinates, float margin) {
        if (coordinates == null || coordinates.isEmpty()) return false;
        int stride = Math.max(1, coordinates.size() / 48);
        for (int i = 0; i < coordinates.size(); i += stride) {
            float[] p = project(coordinates.get(i)[0], coordinates.get(i)[1]);
            if (pointVisible(p[0], p[1], margin)) return true;
        }
        float[] last = project(coordinates.get(coordinates.size() - 1)[0], coordinates.get(coordinates.size() - 1)[1]);
        return pointVisible(last[0], last[1], margin);
    }

    private void fitPaths(List<List<double[]>> paths, double minZoom, double maxZoom) {
        double minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        boolean found = false;
        for (List<double[]> path : paths) {
            for (double[] point : path) {
                if (point == null || point.length < 2) continue;
                minLat = Math.min(minLat, point[0]);
                maxLat = Math.max(maxLat, point[0]);
                minLon = Math.min(minLon, point[1]);
                maxLon = Math.max(maxLon, point[1]);
                found = true;
            }
        }
        if (!found) return;
        centerLat = (minLat + maxLat) / 2.0;
        centerLon = (minLon + maxLon) / 2.0;
        double span = Math.max(maxLat - minLat, maxLon - minLon);
        if (span <= 0.00001) {
            zoom = maxZoom;
        } else {
            zoom = clamp(14.4 - Math.log(span) / Math.log(2.0), minZoom, maxZoom);
        }
    }

    private float[] project(double lat, double lon) {
        double scale = Math.pow(2.0, zoom) * 256.0;
        double x = lonToWorld(lon, scale) - lonToWorld(centerLon, scale) + surfaceWidth / 2.0;
        double y = latToWorld(lat, scale) - latToWorld(centerLat, scale) + surfaceHeight / 2.0;
        return new float[] { (float) x, (float) y };
    }

    private static double lonToWorld(double lon, double scale) {
        return (lon + 180.0) / 360.0 * scale;
    }

    private static double latToWorld(double lat, double scale) {
        double clamped = clamp(lat, -85.05112878, 85.05112878);
        double radians = Math.toRadians(clamped);
        return (1.0 - Math.log(Math.tan(radians) + 1.0 / Math.cos(radians)) / Math.PI) / 2.0 * scale;
    }

    private static double worldToLon(double x, double scale) {
        return x / scale * 360.0 - 180.0;
    }

    private static double worldToLat(double y, double scale) {
        double n = Math.PI - 2.0 * Math.PI * y / scale;
        return Math.toDegrees(Math.atan(Math.sinh(n)));
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static int ticketColor(Ticket ticket) {
        return TicketCarStyle.dashboardColor(ticket);
    }

    private static int vetroColor(String layerId) {
        if ("17".equals(layerId) || "654".equals(layerId)) return Color.rgb(37, 99, 235);
        if ("26".equals(layerId)) return Color.rgb(231, 41, 138);
        if ("28".equals(layerId)) return Color.rgb(22, 163, 74);
        if ("42".equals(layerId)) return Color.rgb(249, 115, 22);
        return Color.rgb(100, 116, 139);
    }

    private static String normalizeMapStyle(String value) {
        String style = value == null ? "" : value.trim();
        if (style.isEmpty() || "published".equals(style)) return "standard";
        return style;
    }

    private static String mapboxStyleId(String style) {
        if ("mapbox-outdoors".equals(style)) return "outdoors-v12";
        if ("mapbox-light".equals(style)) return "light-v11";
        if ("mapbox-dark".equals(style)) return "dark-v11";
        if ("mapbox-satellite".equals(style)) return "satellite-v9";
        if ("mapbox-satellite-streets".equals(style)) return "satellite-streets-v12";
        if ("mapbox-navigation-day".equals(style)) return "navigation-day-v1";
        if ("mapbox-navigation-night".equals(style)) return "navigation-night-v1";
        return "streets-v12";
    }

    private static int parseColor(String value, int fallback) {
        if (value == null || value.trim().isEmpty()) return fallback;
        try {
            return Color.parseColor(value.trim());
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static String first(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) return value.trim();
        }
        return "";
    }

    private static final class VetroStyle {
        final String name;
        final int color;
        final int outline;
        final float size;
        final int alpha;

        VetroStyle(String name, int color, int outline, float size, int alpha) {
            this.name = name;
            this.color = color;
            this.outline = outline;
            this.size = size;
            this.alpha = alpha;
        }
    }
}
