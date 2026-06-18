package com.fiberlocator.auto.data;

import org.json.JSONObject;

public final class LocatorNote {
    public final String id;
    public final double latitude;
    public final double longitude;
    public final boolean hasCoordinates;
    public final String category;
    public final String text;
    public final String targetType;
    public final String targetLabel;
    public final String targetId;
    public final String ticket;
    public final String layerId;
    public final String featureId;
    public final String createdAt;
    public final String createdBy;

    public LocatorNote(
        String id,
        double latitude,
        double longitude,
        boolean hasCoordinates,
        String category,
        String text,
        String targetType,
        String targetLabel,
        String targetId,
        String ticket,
        String layerId,
        String featureId,
        String createdAt,
        String createdBy
    ) {
        this.id = clean(id);
        this.latitude = latitude;
        this.longitude = longitude;
        this.hasCoordinates = hasCoordinates;
        this.category = clean(category).isEmpty() ? "instruction" : clean(category);
        this.text = clean(text);
        this.targetType = clean(targetType);
        this.targetLabel = clean(targetLabel);
        this.targetId = clean(targetId);
        this.ticket = clean(ticket);
        this.layerId = clean(layerId);
        this.featureId = clean(featureId);
        this.createdAt = clean(createdAt);
        this.createdBy = clean(createdBy);
    }

    public static LocatorNote fromJson(JSONObject item) {
        if (item == null) return null;
        double lat = item.optDouble("lat", Double.NaN);
        double lng = item.optDouble("lng", Double.NaN);
        boolean valid = !Double.isNaN(lat) && !Double.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        return new LocatorNote(
            item.optString("id", ""),
            lat,
            lng,
            valid,
            item.optString("category", "instruction"),
            item.optString("text", ""),
            item.optString("target_type", ""),
            item.optString("target_label", ""),
            item.optString("target_id", ""),
            item.optString("ticket", ""),
            item.optString("layer_id", ""),
            item.optString("feature_id", ""),
            item.optString("created_at", ""),
            item.optString("created_by", "")
        );
    }

    public String categoryLabel() {
        if ("layer_issue".equals(category)) return "Layer issue";
        if ("locate_issue".equals(category)) return "Locate issue";
        if ("needs_attention".equals(category)) return "Needs attention";
        if ("restoration".equals(category)) return "Restoration";
        if ("other".equals(category)) return "Other note";
        return "Instruction";
    }

    public String summary() {
        if (!text.isEmpty()) return text;
        if (!targetLabel.isEmpty()) return targetLabel;
        return categoryLabel();
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
