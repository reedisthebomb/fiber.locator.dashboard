package com.fiberlocator.auto.data;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class MapFeature {
    public final String kind;
    public final String layerId;
    public final String label;
    public final String geometryType;
    public final List<List<double[]>> paths;
    public final Map<String, String> properties;

    public MapFeature(String kind, String layerId, String label, String geometryType, List<List<double[]>> paths, Map<String, String> properties) {
        this.kind = clean(kind);
        this.layerId = clean(layerId);
        this.label = clean(label);
        this.geometryType = clean(geometryType);
        this.properties = Collections.unmodifiableMap(new LinkedHashMap<>(properties == null ? Collections.emptyMap() : properties));
        List<List<double[]>> copy = new ArrayList<>();
        if (paths != null) {
            for (List<double[]> path : paths) {
                if (path == null || path.isEmpty()) continue;
                List<double[]> pathCopy = new ArrayList<>();
                for (double[] point : path) {
                    if (point != null && point.length >= 2) pathCopy.add(new double[] { point[0], point[1] });
                }
                if (!pathCopy.isEmpty()) copy.add(Collections.unmodifiableList(pathCopy));
            }
        }
        this.paths = Collections.unmodifiableList(copy);
    }

    public boolean isPoint() {
        return "Point".equals(geometryType) || "MultiPoint".equals(geometryType);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
