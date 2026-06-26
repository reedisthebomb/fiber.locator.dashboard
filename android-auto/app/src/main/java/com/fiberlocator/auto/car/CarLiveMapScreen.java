package com.fiberlocator.auto.car;

import android.Manifest;
import android.content.Intent;
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
import androidx.car.app.CarToast;
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
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.net.HttpURLConnection;
import java.net.URL;

public final class CarLiveMapScreen extends Screen implements SurfaceCallback {
    private static final int MAX_DRAWN_FEATURES = 25000;
    private static final int DRAW_THROTTLE_MS = 80;
    private static final double FOLLOW_ZOOM = 18.0;
    private static final double FOLLOW_FAST_ZOOM = 16.8;
    private static final double FOLLOW_CITY_ZOOM = 17.25;
    private static final double MIN_ZOOM = 8.0;
    private static final double MAX_ZOOM = 20.0;
    private static final float HEADING_UP_MIN_SPEED_MPS = 1.5f;
    private static final float HEADING_UP_MIN_BEARING_DELTA_DEGREES = 3f;
    private static final float HEADING_UP_SMOOTHING = 0.28f;
    private static final long DOUBLE_TAP_TIMEOUT_MS = 360L;
    private static final float DOUBLE_TAP_SLOP_PX = 72f;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final ExecutorService tileExecutor = Executors.newFixedThreadPool(4);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Ticket> tickets = new ArrayList<>();
    private final List<LocatorNote> locatorNotes = new ArrayList<>();
    private final List<MapFeature> vetroFeatures = new ArrayList<>();
    private final Ticket focusTicket;
    private final boolean rootScreen;
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
    private DashboardSnapshot currentSnapshot;
    private Ticket selectedTicket;
    private MapFeature selectedFeature;
    private boolean usingCachedData = false;
    private boolean loading = true;
    private boolean vetroLoading = false;
    private String error = "";
    private boolean followLocation = true;
    private boolean headingUp = true;
    private boolean drawScheduled = false;
    private boolean mapBearingReady = false;
    private long lastDrawMs = 0L;
    private long lastTapMs = 0L;
    private float lastTapX = Float.NaN;
    private float lastTapY = Float.NaN;
    private double centerLat = 33.23;
    private double centerLon = -92.67;
    private double zoom = 13.0;
    private double mapBearing = 0.0;

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
        this(carContext, focusTicket, false);
    }

    public CarLiveMapScreen(@NonNull CarContext carContext, Ticket focusTicket, boolean rootScreen) {
        super(carContext);
        this.focusTicket = focusTicket;
        this.rootScreen = rootScreen;
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
        Pane.Builder paneBuilder = new Pane.Builder();
        paneBuilder.addRow(new Row.Builder()
            .setTitle("Live Map")
            .addText(statusLine())
            .build());
        Pane pane = paneBuilder.build();
        ActionStrip actions = new ActionStrip.Builder()
            .addAction(new Action.Builder().setTitle("Tickets").setOnClickListener(this::openTickets).build())
            .addAction(new Action.Builder().setTitle(followLocation ? "Following" : "Follow").setOnClickListener(this::followCurrentLocation).build())
            .addAction(new Action.Builder().setTitle(headingUp ? "North" : "Heading").setOnClickListener(this::toggleHeadingMode).build())
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
            zoomAt(focusX, focusY, Math.log(scaleFactor) / Math.log(2.0));
        }
    }

    @Override
    public void onClick(float x, float y) {
        long now = android.os.SystemClock.uptimeMillis();
        if (isDoubleTap(now, x, y)) {
            clearLastTap();
            zoomAt(x, y, 1.0);
            return;
        }
        lastTapMs = now;
        lastTapX = x;
        lastTapY = y;
        MapFeature feature = nearestVetroFeature(x, y);
        if (feature != null) {
            selectedFeature = feature;
            selectedTicket = null;
            CarToast.makeText(getCarContext(), featureToast(feature), CarToast.LENGTH_SHORT).show();
            drawMap();
            return;
        }
        Ticket nearest = nearestTicket(x, y);
        if (nearest != null) {
            selectedFeature = null;
            selectedTicket = nearest;
            centerOnTicket(nearest, false);
            return;
        }
        selectedFeature = null;
        selectedTicket = null;
        drawMap();
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
                JSONObject mapConfig;
                try {
                    mapConfig = repository.loadMapConfig();
                } catch (Exception ignored) {
                    mapConfig = new JSONObject();
                }
                JSONObject loadedMapConfig = mapConfig;
                main.post(() -> {
                    currentSnapshot = snapshot;
                    usingCachedData = repository.usedCachedResponse();
                    tickets.clear();
                    tickets.addAll(snapshot.tickets);
                    if (selectedTicket != null) selectedTicket = ticketByNumber(selectedTicket.ticketNumber);
                    selectedFeature = null;
                    locatorNotes.clear();
                    locatorNotes.addAll(snapshot.locatorNotes);
                    vetroFeatures.clear();
                    mapState = snapshot.state == null ? new JSONObject() : snapshot.state;
                    mapStyle = normalizeMapStyle(snapshot.mapStyle);
                    mapboxToken = loadedMapConfig.optString("mapboxAccessToken", "");
                    loading = false;
                    vetroLoading = true;
                    if (focusTicket != null && focusTicket.hasCoordinates) {
                        selectedTicket = ticketByNumber(focusTicket.ticketNumber);
                        centerOnTicket(selectedTicket == null ? focusTicket : selectedTicket);
                    }
                    else if (currentLocation != null) followCurrentLocation();
                    else centerOnWork(false);
                    invalidate();
                    drawMap();
                    loadVetroLayers();
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

    private void loadVetroLayers() {
        DashboardSnapshot snapshot = currentSnapshot;
        if (snapshot == null) {
            vetroLoading = false;
            return;
        }
        executor.execute(() -> {
            try {
                List<MapFeature> layers = new TicketRepository(getCarContext()).loadVetroMapFeatures(snapshot.state);
                main.post(() -> {
                    vetroFeatures.clear();
                    vetroFeatures.addAll(layers);
                    if (selectedFeature != null && !vetroFeatures.contains(selectedFeature)) selectedFeature = null;
                    vetroLoading = false;
                    invalidate();
                    drawMap();
                });
            } catch (OutOfMemoryError oom) {
                main.post(() -> {
                    vetroFeatures.clear();
                    vetroLoading = false;
                    invalidate();
                    drawMap();
                });
            } catch (Exception ignored) {
                main.post(() -> {
                    vetroLoading = false;
                    invalidate();
                    drawMap();
                });
            }
        });
    }

    private String statusLine() {
        if (!error.isEmpty()) return error;
        if (loading) return "Loading from dashboard";
        String mode = !followLocation ? "Free Pan" : (activeMapBearing() == 0.0 ? "North Up" : "Heading Up");
        String fiber = vetroLoading ? "loading fiber" : String.format(Locale.US, "%d fiber", vetroFeatures.size());
        return String.format(Locale.US, "%d tickets • %d notes • %s • %s%s", tickets.size(), locatorNotes.size(), fiber, mode, usingCachedData ? " • cached" : "");
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
        if (!fromLastKnown) updateMapBearing(location);
        if (followLocation) {
            centerLat = location.getLatitude();
            centerLon = location.getLongitude();
            double targetZoom = targetFollowZoom(location);
            if (fromLastKnown || Math.abs(zoom - targetZoom) > 1.4) zoom = targetZoom;
            else zoom += (targetZoom - zoom) * 0.24;
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
            double bearing = activeMapBearing();
            if (bearing != 0.0) {
                canvas.save();
                canvas.rotate(-(float) bearing, surfaceWidth / 2f, surfaceHeight / 2f);
                drawBaseMap(canvas, true);
                canvas.restore();
            } else {
                drawBaseMap(canvas, false);
            }
            drawVetro(canvas);
            drawTicketPolygons(canvas);
            drawLocatorNotes(canvas);
            drawTickets(canvas);
            drawCurrentLocation(canvas);
            drawSelectedFeatureInfo(canvas);
            drawCompass(canvas);
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

    private void drawBaseMap(Canvas canvas, boolean rotated) {
        String tileStyle = tileStyleKey();
        if (!tileStyle.equals(activeTileStyleKey)) {
            activeTileStyleKey = tileStyle;
            synchronized (tileCache) {
                tileCache.clear();
                loadingTiles.clear();
            }
        }
        canvas.drawColor(Color.rgb(235, 242, 248));
        int tileZ = (int) clamp(Math.round(zoom), 1, 19);
        double tileScale = Math.pow(2.0, zoom - tileZ);
        double worldScale = Math.pow(2.0, zoom) * 256.0;
        double centerX = lonToWorld(centerLon, worldScale);
        double centerY = latToWorld(centerLat, worldScale);
        double transformedSpan = Math.hypot(surfaceWidth, surfaceHeight);
        double tileViewportWidth = rotated ? transformedSpan : surfaceWidth;
        double tileViewportHeight = rotated ? transformedSpan : surfaceHeight;
        int minX = (int) Math.floor((centerX - tileViewportWidth / 2.0) / (256.0 * tileScale)) - 1;
        int maxX = (int) Math.floor((centerX + tileViewportWidth / 2.0) / (256.0 * tileScale)) + 1;
        int minY = (int) Math.floor((centerY - tileViewportHeight / 2.0) / (256.0 * tileScale)) - 1;
        int maxY = (int) Math.floor((centerY + tileViewportHeight / 2.0) / (256.0 * tileScale)) + 1;
        int maxTile = (1 << tileZ) - 1;
        int centerTileX = (int) Math.floor(centerX / (256.0 * tileScale));
        int centerTileY = (int) Math.floor(centerY / (256.0 * tileScale));
        List<int[]> missingTiles = new ArrayList<>();
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
                    missingTiles.add(new int[] { tileZ, wrappedX, y, x });
                }
            }
        }
        Collections.sort(missingTiles, (a, b) -> {
            int da = Math.abs(a[3] - centerTileX) + Math.abs(a[2] - centerTileY);
            int db = Math.abs(b[3] - centerTileX) + Math.abs(b[2] - centerTileY);
            return Integer.compare(da, db);
        });
        for (int[] tile : missingTiles) {
            enqueueTileLoad(tile[0], tile[1], tile[2], tileKey(tileStyle, tile[0], tile[1], tile[2]), tileStyle);
        }
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1f);
        paint.setColor(Color.argb(90, 205, 216, 226));
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
            return "https://api.mapbox.com/styles/v1/mapbox/" + styleId + "/tiles/512/" + z + "/" + x + "/" + y + "?access_token=" + mapboxToken;
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

    private String tileStyleKey() {
        String style = normalizeMapStyle(mapStyle);
        if (style.startsWith("mapbox-")) return "mapbox:" + mapboxStyleId(style);
        if ("satellite".equals(style) || "hybrid".equals(style)) return "satellite";
        if ("light".equals(style)) return "carto-light";
        if ("dark".equals(style)) return "carto-dark";
        return "osm";
    }

    private void drawVetro(Canvas canvas) {
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
        int drawn = 0;
        for (MapFeature feature : vetroFeatures) {
            if (drawn >= MAX_DRAWN_FEATURES) break;
            if (!shouldDrawVetroFeature(feature)) continue;
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
                    if (shouldDrawVetroLabel(feature)) drawFeatureLabel(canvas, featureAddressLabel(feature), p[0], p[1], style);
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
        paint.setFakeBoldText(false);
    }

    private boolean shouldDrawVetroFeature(MapFeature feature) {
        if (feature == null) return false;
        if (zoom < 10.5) return false;
        if (feature.isPoint()) {
            if ("26".equals(feature.layerId)) return zoom >= 14.0;
            if ("28".equals(feature.layerId) || "42".equals(feature.layerId)) return zoom >= 15.0;
            return zoom >= 16.0;
        }
        if ("17".equals(feature.layerId) || "654".equals(feature.layerId)) return zoom >= 11.0;
        return zoom >= 13.0;
    }

    private boolean shouldDrawVetroLabel(MapFeature feature) {
        if (feature == null || !feature.isPoint() || zoom < 18.0) return false;
        if (featureAddressLabel(feature).isEmpty()) return false;
        if ("26".equals(feature.layerId) || "prefix:SL".equals(feature.layerId)) return true;
        String label = first(feature.label, feature.layerId).toLowerCase(Locale.US);
        return label.contains("customer") || label.contains("service");
    }

    private void drawTicketPolygons(Canvas canvas) {
        paint.setStyle(Paint.Style.FILL);
        for (Ticket ticket : tickets) {
            List<List<double[]>> rings = ticketPolygon(ticket);
            if (rings.isEmpty()) continue;
            boolean selected = isSelectedTicket(ticket);
            paint.setColor(ticketColor(ticket));
            paint.setStyle(Paint.Style.FILL);
            paint.setAlpha(selected ? 36 : 10);
            for (List<double[]> ring : rings) {
                if (pathVisible(ring, 160f)) drawPath(canvas, ring, true);
            }
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(selected ? 6f : 2.5f);
            paint.setAlpha(selected ? 245 : 150);
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
            boolean selected = isSelectedTicket(ticket);
            paint.setColor(Color.WHITE);
            canvas.drawCircle(p[0], p[1], selected ? 15f : 10f, paint);
            paint.setColor(ticketColor(ticket));
            canvas.drawCircle(p[0], p[1], selected ? 11f : 7f, paint);
            if (selected) {
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(3f);
                paint.setColor(Color.WHITE);
                canvas.drawCircle(p[0], p[1], 19f, paint);
                paint.setStyle(Paint.Style.FILL);
            }
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
        float accuracyRadius = currentLocation.hasAccuracy()
            ? (float) clamp((currentLocation.getAccuracy() / metersPerPixel(currentLocation.getLatitude())) / 2.0, 18.0, 90.0)
            : 24f;
        paint.setColor(Color.argb(46, 56, 189, 248));
        canvas.drawCircle(p[0], p[1], accuracyRadius, paint);
        paint.setColor(Color.WHITE);
        canvas.drawCircle(p[0], p[1], 12f, paint);
        paint.setColor(Color.rgb(2, 132, 199));
        canvas.drawCircle(p[0], p[1], 8f, paint);
        if (currentLocation.hasBearing() && currentLocation.hasSpeed() && currentLocation.getSpeed() > 0.8f) {
            drawHeadingArrow(canvas, p[0], p[1], (float) normalizeBearing(currentLocation.getBearing() - activeMapBearing()));
        }
    }

    private void drawHeadingArrow(Canvas canvas, float x, float y, float bearing) {
        canvas.save();
        canvas.rotate(bearing, x, y);
        Path arrow = new Path();
        arrow.moveTo(x, y - 28f);
        arrow.lineTo(x + 10f, y - 4f);
        arrow.lineTo(x, y - 10f);
        arrow.lineTo(x - 10f, y - 4f);
        arrow.close();
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.rgb(2, 132, 199));
        canvas.drawPath(arrow, paint);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2f);
        paint.setColor(Color.WHITE);
        canvas.drawPath(arrow, paint);
        canvas.restore();
    }

    private void drawCompass(Canvas canvas) {
        int top = visibleArea.isEmpty() ? 18 : Math.max(18, visibleArea.top + 12);
        int right = visibleArea.isEmpty() ? surfaceWidth - 16 : Math.min(surfaceWidth - 16, visibleArea.right - 12);
        float cx = right - 34f;
        float cy = top + 34f;
        double bearing = activeMapBearing();
        double radians = Math.toRadians(bearing);
        float northX = (float) (-Math.sin(radians) * 18.0);
        float northY = (float) (-Math.cos(radians) * 18.0);

        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.argb(188, 15, 23, 42));
        canvas.drawCircle(cx, cy, 28f, paint);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2f);
        paint.setColor(Color.argb(215, 255, 255, 255));
        canvas.drawCircle(cx, cy, 28f, paint);
        paint.setStrokeWidth(4f);
        paint.setColor(Color.WHITE);
        canvas.drawLine(cx, cy, cx + northX, cy + northY, paint);
        paint.setStyle(Paint.Style.FILL);
        paint.setTextSize(15f);
        paint.setFakeBoldText(true);
        canvas.drawText("N", cx + northX - 5f, cy + northY - 5f, paint);
        paint.setFakeBoldText(false);
    }

    private void drawFeatureLabel(Canvas canvas, String text, float x, float y, VetroStyle style) {
        if (text == null || text.isEmpty()) return;
        paint.setPathEffect(null);
        paint.setTextSize(11f);
        paint.setFakeBoldText(true);
        float maxWidth = Math.max(90f, Math.min(190f, surfaceWidth * 0.3f));
        String label = ellipsize(text, maxWidth - 14f, paint);
        float width = paint.measureText(label) + 10f;
        float height = 17f;
        float left = x + Math.max(10f, style.size + 6f);
        float top = y - height / 2f;
        if (left + width > surfaceWidth - 10f) left = x - width - Math.max(10f, style.size + 6f);
        if (top < 8f) top = 8f;
        if (top + height > surfaceHeight - 8f) top = surfaceHeight - height - 8f;
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.argb(204, 2, 6, 23));
        canvas.drawRoundRect(left, top, left + width, top + height, 5f, 5f, paint);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1.5f);
        paint.setColor(Color.argb(204, 250, 204, 21));
        canvas.drawRoundRect(left, top, left + width, top + height, 5f, 5f, paint);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.WHITE);
        canvas.drawText(label, left + 5f, top + 12.5f, paint);
        paint.setFakeBoldText(false);
    }

    private void drawSelectedFeatureInfo(Canvas canvas) {
        MapFeature feature = selectedFeature;
        if (feature == null) return;
        int left = visibleArea.isEmpty() ? 16 : Math.max(16, visibleArea.left + 12);
        int bottom = visibleArea.isEmpty() ? surfaceHeight - 18 : Math.min(surfaceHeight - 18, visibleArea.bottom - 12);
        int width = Math.min(Math.max(360, surfaceWidth / 2), Math.max(260, surfaceWidth - left - 24));
        int rowHeight = 20;
        List<String[]> rows = featureInfoRows(feature);
        int maxRows = Math.max(4, Math.min(10, (bottom - 118) / rowHeight));
        int shown = Math.min(rows.size(), maxRows);
        int height = 48 + shown * rowHeight + (rows.size() > shown ? 20 : 0);
        int top = Math.max(92, bottom - height);

        paint.setPathEffect(null);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.argb(220, 248, 250, 252));
        canvas.drawRoundRect(left, top, left + width, top + height, 12f, 12f, paint);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2f);
        paint.setColor(Color.rgb(250, 204, 21));
        canvas.drawRoundRect(left, top, left + width, top + height, 12f, 12f, paint);

        paint.setStyle(Paint.Style.FILL);
        paint.setFakeBoldText(true);
        paint.setTextSize(18f);
        paint.setColor(Color.rgb(15, 23, 42));
        canvas.drawText(ellipsize(featureTitle(feature), width - 28f, paint), left + 14f, top + 24f, paint);
        paint.setFakeBoldText(false);
        paint.setTextSize(14f);
        paint.setColor(Color.rgb(71, 85, 105));
        canvas.drawText("Tap empty map to clear", left + 14f, top + 43f, paint);

        int y = top + 66;
        for (int i = 0; i < shown; i++) {
            String[] row = rows.get(i);
            paint.setFakeBoldText(true);
            paint.setTextSize(14f);
            paint.setColor(Color.rgb(15, 23, 42));
            String key = ellipsize(row[0] + ":", 118f, paint);
            canvas.drawText(key, left + 14f, y, paint);
            paint.setFakeBoldText(false);
            paint.setColor(Color.rgb(30, 41, 59));
            canvas.drawText(ellipsize(row[1], width - 148f, paint), left + 132f, y, paint);
            y += rowHeight;
        }
        if (rows.size() > shown) {
            paint.setColor(Color.rgb(146, 64, 14));
            canvas.drawText("+" + (rows.size() - shown) + " more fields in the phone/web detail view", left + 14f, y, paint);
        }
    }

    private void drawPath(Canvas canvas, List<double[]> coordinates, boolean fill) {
        if (coordinates.isEmpty()) return;
        Path path = new Path();
        float[] first = project(coordinates.get(0)[0], coordinates.get(0)[1]);
        path.moveTo(first[0], first[1]);
        int targetPoints = zoom >= 18 ? 180 : (zoom >= 15 ? 110 : (zoom >= 12 ? 56 : 32));
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
        centerOnTicket(ticket, true);
    }

    private void centerOnTicket(Ticket ticket, boolean updateTemplate) {
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
        if (updateTemplate) invalidate();
    }

    private void zoomBy(double delta) {
        zoomAt(surfaceWidth / 2f, surfaceHeight / 2f, delta);
    }

    private void navigateToTicket(Ticket ticket) {
        if (ticket == null) return;
        try {
            getCarContext().startCarApp(new Intent(CarContext.ACTION_NAVIGATE, ticket.navigationUri()));
        } catch (Exception ex) {
            CarToast.makeText(getCarContext(), "Navigation is unavailable", CarToast.LENGTH_LONG).show();
        }
    }

    private void saveSelectedTicketAction(String actionKey) {
        Ticket ticket = selectedTicket;
        DashboardSnapshot snapshot = currentSnapshot;
        if (ticket == null || snapshot == null) return;
        CarToast.makeText(getCarContext(), "Saving " + ticket.title(), CarToast.LENGTH_SHORT).show();
        executor.execute(() -> {
            try {
                new TicketRepository(getCarContext()).saveTicketActions(snapshot, ticket.ticketNumber, Collections.singletonList(actionKey));
                main.post(() -> {
                    CarToast.makeText(getCarContext(), "Ticket updated", CarToast.LENGTH_SHORT).show();
                    reload();
                });
            } catch (Exception ex) {
                main.post(() -> CarToast.makeText(getCarContext(), "Unable to save ticket", CarToast.LENGTH_LONG).show());
            }
        });
    }

    private void panBy(float distanceX, float distanceY) {
        double bearing = activeMapBearing();
        followLocation = false;
        double scale = Math.pow(2.0, zoom) * 256.0;
        double radians = Math.toRadians(bearing);
        double cos = Math.cos(radians);
        double sin = Math.sin(radians);
        double worldDeltaX = distanceX * cos - distanceY * sin;
        double worldDeltaY = distanceX * sin + distanceY * cos;
        double centerX = lonToWorld(centerLon, scale) + worldDeltaX;
        double centerY = latToWorld(centerLat, scale) + worldDeltaY;
        centerLon = worldToLon(centerX, scale);
        centerLat = worldToLat(centerY, scale);
        drawMap();
        invalidate();
    }

    private void zoomAt(float focusX, float focusY, double delta) {
        if (surfaceWidth <= 0 || surfaceHeight <= 0 || delta == 0.0) return;
        double nextZoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);
        if (nextZoom == zoom) return;

        double bearing = activeMapBearing();
        double oldScale = Math.pow(2.0, zoom) * 256.0;
        double[] oldDelta = screenDeltaToWorldDelta(focusX - surfaceWidth / 2.0, focusY - surfaceHeight / 2.0, bearing);
        double focusWorldX = lonToWorld(centerLon, oldScale) + oldDelta[0];
        double focusWorldY = latToWorld(centerLat, oldScale) + oldDelta[1];
        double focusLon = worldToLon(focusWorldX, oldScale);
        double focusLat = worldToLat(focusWorldY, oldScale);

        zoom = nextZoom;
        double newScale = Math.pow(2.0, zoom) * 256.0;
        double[] newDelta = screenDeltaToWorldDelta(focusX - surfaceWidth / 2.0, focusY - surfaceHeight / 2.0, bearing);
        centerLon = worldToLon(lonToWorld(focusLon, newScale) - newDelta[0], newScale);
        centerLat = worldToLat(latToWorld(focusLat, newScale) - newDelta[1], newScale);
        drawMap();
        invalidate();
    }

    private double[] screenDeltaToWorldDelta(double screenDx, double screenDy, double bearing) {
        if (bearing == 0.0) return new double[] { screenDx, screenDy };
        double radians = Math.toRadians(bearing);
        double cos = Math.cos(radians);
        double sin = Math.sin(radians);
        return new double[] {
            screenDx * cos - screenDy * sin,
            screenDx * sin + screenDy * cos
        };
    }

    private boolean isDoubleTap(long now, float x, float y) {
        if (lastTapMs <= 0L || now - lastTapMs > DOUBLE_TAP_TIMEOUT_MS) return false;
        if (Float.isNaN(lastTapX) || Float.isNaN(lastTapY)) return false;
        float dx = x - lastTapX;
        float dy = y - lastTapY;
        return dx * dx + dy * dy <= DOUBLE_TAP_SLOP_PX * DOUBLE_TAP_SLOP_PX;
    }

    private void clearLastTap() {
        lastTapMs = 0L;
        lastTapX = Float.NaN;
        lastTapY = Float.NaN;
    }

    private void followCurrentLocation() {
        followLocation = true;
        headingUp = true;
        if (currentLocation != null) updateMapBearing(currentLocation);
        if (currentLocation != null) {
            centerLat = currentLocation.getLatitude();
            centerLon = currentLocation.getLongitude();
            zoom = targetFollowZoom(currentLocation);
        }
        invalidate();
        drawMap();
    }

    private void toggleHeadingMode() {
        headingUp = !headingUp;
        if (headingUp) {
            followLocation = true;
            if (currentLocation != null) {
                updateMapBearing(currentLocation);
                centerLat = currentLocation.getLatitude();
                centerLon = currentLocation.getLongitude();
                zoom = targetFollowZoom(currentLocation);
            }
        } else {
            mapBearing = 0.0;
            mapBearingReady = false;
        }
        invalidate();
        drawMap();
    }

    private void openTickets() {
        if (rootScreen) {
            getScreenManager().push(new TicketListScreen(getCarContext()));
        } else {
            finish();
        }
    }

    private Ticket ticketByNumber(String ticketNumber) {
        if (ticketNumber == null || ticketNumber.trim().isEmpty()) return null;
        for (Ticket ticket : tickets) {
            if (ticket.ticketNumber.equals(ticketNumber)) return ticket;
        }
        return null;
    }

    private boolean isSelectedTicket(Ticket ticket) {
        return ticket != null && selectedTicket != null && ticket.ticketNumber.equals(selectedTicket.ticketNumber);
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
        if (nearest != null) return nearest;
        for (Ticket ticket : tickets) {
            if (screenPointInTicket(ticket, x, y)) return ticket;
        }
        return nearest;
    }

    private MapFeature nearestVetroFeature(float x, float y) {
        MapFeature nearest = null;
        double best = 34 * 34;
        for (MapFeature feature : vetroFeatures) {
            if (!shouldDrawVetroFeature(feature)) continue;
            VetroStyle style = vetroStyle(feature);
            double threshold = Math.max(18.0, style.size + 12.0);
            double thresholdSquared = threshold * threshold;
            for (List<double[]> path : feature.paths) {
                if (path == null || path.isEmpty() || !pathVisible(path, 128f)) continue;
                double dist;
                if (feature.isPoint() || path.size() == 1) {
                    float[] p = project(path.get(0)[0], path.get(0)[1]);
                    double dx = x - p[0];
                    double dy = y - p[1];
                    dist = dx * dx + dy * dy;
                } else {
                    if (screenPointInPath(path, x, y)) return feature;
                    dist = screenDistanceToPath(path, x, y);
                }
                if (dist <= thresholdSquared && dist < best) {
                    best = dist;
                    nearest = feature;
                }
            }
        }
        return nearest;
    }

    private String featureToast(MapFeature feature) {
        String label = featureTitle(feature);
        String layer = feature.layerId.isEmpty() ? "VETRO" : "Layer " + feature.layerId;
        if (label.isEmpty()) return layer;
        return layer + ": " + label;
    }

    private String featureTitle(MapFeature feature) {
        if (feature == null) return "";
        return first(
            featureAddressLabel(feature),
            feature.label,
            prop(feature, "ID", "feature_id", "Name", "name", "label", "vetro_id", "vitruvi_id"),
            feature.layerId.isEmpty() ? feature.kind : "Layer " + feature.layerId
        );
    }

    private String featureAddressLabel(MapFeature feature) {
        return prop(
            feature,
            "Street Address",
            "Street_Address",
            "street_address",
            "Service Address",
            "service_address",
            "Customer Address",
            "customer_address",
            "full_address",
            "Address",
            "address"
        );
    }

    private String prop(MapFeature feature, String... keys) {
        if (feature == null || feature.properties == null) return "";
        for (String key : keys) {
            String value = feature.properties.get(key);
            if (value != null && !value.trim().isEmpty()) return value.trim();
        }
        for (String wanted : keys) {
            for (Map.Entry<String, String> entry : feature.properties.entrySet()) {
                if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(wanted) && entry.getValue() != null && !entry.getValue().trim().isEmpty()) {
                    return entry.getValue().trim();
                }
            }
        }
        return "";
    }

    private List<String[]> featureInfoRows(MapFeature feature) {
        List<String[]> rows = new ArrayList<>();
        LinkedHashMap<String, String> curated = new LinkedHashMap<>();
        curated.put("Layer", first(feature.layerId, feature.kind));
        curated.put("Address", featureAddressLabel(feature));
        curated.put("Feature ID", prop(feature, "ID", "feature_id", "vetro_id", "vitruvi_id", "id", "uid"));
        curated.put("Name", prop(feature, "Name", "name", "label"));
        curated.put("Status", prop(feature, "status_id", "Status", "status"));
        curated.put("Plan", first(prop(feature, "plan"), prop(feature, "plan_id")));
        curated.put("Build", prop(feature, "Build", "build"));
        curated.put("Placement", prop(feature, "Placement", "placement"));
        curated.put("Note", prop(feature, "Note", "note"));
        List<String> used = new ArrayList<>();
        for (Map.Entry<String, String> entry : curated.entrySet()) {
            if (entry.getValue() == null || entry.getValue().trim().isEmpty()) continue;
            rows.add(new String[] { entry.getKey(), entry.getValue().trim() });
        }
        Collections.addAll(used,
            "Street Address", "Street_Address", "street_address", "Service Address", "service_address",
            "Customer Address", "customer_address", "full_address", "Address", "address", "ID", "feature_id",
            "vetro_id", "vitruvi_id", "id", "uid", "Name", "name", "label", "status_id", "Status", "status",
            "plan", "plan_id", "Build", "build", "Placement", "placement", "Note", "note"
        );
        for (Map.Entry<String, String> entry : feature.properties.entrySet()) {
            String key = entry.getKey() == null ? "" : entry.getKey().trim();
            String value = entry.getValue() == null ? "" : entry.getValue().trim();
            if (key.isEmpty() || value.isEmpty()) continue;
            boolean duplicate = false;
            for (String usedKey : used) {
                if (key.equalsIgnoreCase(usedKey)) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) rows.add(new String[] { key, value });
        }
        return rows;
    }

    private String ellipsize(String text, float maxWidth, Paint textPaint) {
        if (text == null) return "";
        String clean = text.trim();
        if (clean.isEmpty() || textPaint.measureText(clean) <= maxWidth) return clean;
        String suffix = "...";
        while (clean.length() > 1 && textPaint.measureText(clean + suffix) > maxWidth) {
            clean = clean.substring(0, clean.length() - 1);
        }
        return clean + suffix;
    }

    private boolean screenPointInPath(List<double[]> path, float x, float y) {
        if (path.size() < 3) return false;
        boolean inside = false;
        for (int i = 0, j = path.size() - 1; i < path.size(); j = i++) {
            float[] pi = project(path.get(i)[0], path.get(i)[1]);
            float[] pj = project(path.get(j)[0], path.get(j)[1]);
            if (((pi[1] > y) != (pj[1] > y)) && (x < (pj[0] - pi[0]) * (y - pi[1]) / ((pj[1] - pi[1]) == 0 ? 0.0001f : (pj[1] - pi[1])) + pi[0])) {
                inside = !inside;
            }
        }
        return inside;
    }

    private double screenDistanceToPath(List<double[]> path, float x, float y) {
        double best = Double.MAX_VALUE;
        for (int index = 1; index < path.size(); index++) {
            float[] a = project(path.get(index - 1)[0], path.get(index - 1)[1]);
            float[] b = project(path.get(index)[0], path.get(index)[1]);
            best = Math.min(best, distanceToSegmentSquared(x, y, a[0], a[1], b[0], b[1]));
        }
        return best;
    }

    private double distanceToSegmentSquared(float px, float py, float ax, float ay, float bx, float by) {
        double dx = bx - ax;
        double dy = by - ay;
        if (dx == 0 && dy == 0) {
            double x = px - ax;
            double y = py - ay;
            return x * x + y * y;
        }
        double t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
        t = Math.max(0, Math.min(1, t));
        double cx = ax + t * dx;
        double cy = ay + t * dy;
        double x = px - cx;
        double y = py - cy;
        return x * x + y * y;
    }

    private boolean screenPointInTicket(Ticket ticket, float x, float y) {
        for (List<double[]> ring : ticketPolygon(ticket)) {
            if (ring.size() < 3 || !pathVisible(ring, 80f)) continue;
            boolean inside = false;
            for (int i = 0, j = ring.size() - 1; i < ring.size(); j = i++) {
                float[] pi = project(ring.get(i)[0], ring.get(i)[1]);
                float[] pj = project(ring.get(j)[0], ring.get(j)[1]);
                if (((pi[1] > y) != (pj[1] > y)) && (x < (pj[0] - pi[0]) * (y - pi[1]) / ((pj[1] - pi[1]) == 0 ? 0.0001f : (pj[1] - pi[1])) + pi[0])) {
                    inside = !inside;
                }
            }
            if (inside) return true;
        }
        return false;
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
        double dx = lonToWorld(lon, scale) - lonToWorld(centerLon, scale);
        double dy = latToWorld(lat, scale) - latToWorld(centerLat, scale);
        double bearing = activeMapBearing();
        if (bearing != 0.0) {
            double radians = Math.toRadians(bearing);
            double cos = Math.cos(radians);
            double sin = Math.sin(radians);
            double rotatedX = dx * cos + dy * sin;
            double rotatedY = -dx * sin + dy * cos;
            dx = rotatedX;
            dy = rotatedY;
        }
        double x = dx + surfaceWidth / 2.0;
        double y = dy + surfaceHeight / 2.0;
        return new float[] { (float) x, (float) y };
    }

    private void updateMapBearing(Location location) {
        if (!headingUp || !followLocation || !hasUsableBearing(location)) return;
        double target = normalizeBearing(location.getBearing());
        if (!mapBearingReady) {
            mapBearing = target;
            mapBearingReady = true;
            return;
        }
        double delta = shortestBearingDelta(mapBearing, target);
        if (Math.abs(delta) < HEADING_UP_MIN_BEARING_DELTA_DEGREES) return;
        mapBearing = normalizeBearing(mapBearing + delta * HEADING_UP_SMOOTHING);
    }

    private boolean hasUsableBearing(Location location) {
        return location != null
            && location.hasBearing()
            && location.hasSpeed()
            && location.getSpeed() >= HEADING_UP_MIN_SPEED_MPS;
    }

    private double targetFollowZoom(Location location) {
        if (location == null || !location.hasSpeed()) return FOLLOW_ZOOM;
        float speed = location.getSpeed();
        if (speed >= 17.0f) return FOLLOW_FAST_ZOOM;
        if (speed >= 8.0f) return FOLLOW_CITY_ZOOM;
        return FOLLOW_ZOOM;
    }

    private double activeMapBearing() {
        if (!followLocation || !headingUp) return 0.0;
        if (!hasUsableBearing(currentLocation) || !mapBearingReady) return 0.0;
        return normalizeBearing(mapBearing);
    }

    private static double normalizeBearing(double bearing) {
        double normalized = bearing % 360.0;
        return normalized < 0.0 ? normalized + 360.0 : normalized;
    }

    private static double shortestBearingDelta(double from, double to) {
        double delta = normalizeBearing(to - from);
        return delta > 180.0 ? delta - 360.0 : delta;
    }

    private double metersPerPixel(double latitude) {
        return 156543.03392 * Math.cos(Math.toRadians(latitude)) / Math.pow(2.0, zoom);
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
        if ("mapbox-standard".equals(style)) return "standard";
        if ("mapbox-standard-satellite".equals(style)) return "standard-satellite";
        if ("mapbox-outdoors".equals(style)) return "outdoors-v12";
        if ("mapbox-light".equals(style)) return "light-v11";
        if ("mapbox-dark".equals(style)) return "dark-v11";
        if ("mapbox-satellite".equals(style)) return "satellite-v9";
        if ("mapbox-satellite-traffic".equals(style)) return "satellite-streets-v12";
        if ("mapbox-satellite-streets".equals(style)) return "satellite-streets-v12";
        if ("mapbox-navigation-day".equals(style)) return "navigation-day-v1";
        if ("mapbox-navigation-night".equals(style)) return "navigation-night-v1";
        if ("mapbox-traffic-day".equals(style)) return "traffic-day-v2";
        if ("mapbox-traffic-night".equals(style)) return "traffic-night-v2";
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
