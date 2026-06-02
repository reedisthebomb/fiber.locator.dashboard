package com.fiberlocator.auto.data;

import android.net.Uri;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class Ticket {
    public final String ticketNumber;
    public final String messageType;
    public final String preparedDate;
    public final String preparedTime;
    public final String county;
    public final String place;
    public final String street;
    public final String address;
    public final String nearestIntersection;
    public final String workDate;
    public final String workTime;
    public final String caller;
    public final String contractor;
    public final String companyPhone;
    public final String contact;
    public final String contactPhone;
    public final String contactEmail;
    public final String locationInformation;
    public final String workType;
    public final String doneFor;
    public final String extent;
    public final String explosives;
    public final String whitePaint;
    public final String directionalBoring;
    public final String rawText;
    public final String note;
    public final String portalUrl;
    public final boolean portalHtmlAvailable;
    public final List<String> utilitiesNotified;
    public final List<String> actions;
    public final double latitude;
    public final double longitude;
    public final boolean hasCoordinates;
    public final JSONObject polygon;

    public Ticket(
        String ticketNumber,
        String messageType,
        String preparedDate,
        String preparedTime,
        String county,
        String place,
        String street,
        String address,
        String nearestIntersection,
        String workDate,
        String workTime,
        String caller,
        String contractor,
        String companyPhone,
        String contact,
        String contactPhone,
        String contactEmail,
        String locationInformation,
        String workType,
        String doneFor,
        String extent,
        String explosives,
        String whitePaint,
        String directionalBoring,
        String rawText,
        String note,
        String portalUrl,
        boolean portalHtmlAvailable,
        List<String> utilitiesNotified,
        List<String> actions,
        double latitude,
        double longitude,
        boolean hasCoordinates,
        JSONObject polygon
    ) {
        this.ticketNumber = clean(ticketNumber);
        this.messageType = clean(messageType);
        this.preparedDate = clean(preparedDate);
        this.preparedTime = clean(preparedTime);
        this.county = clean(county);
        this.place = clean(place);
        this.street = clean(street);
        this.address = clean(address);
        this.nearestIntersection = clean(nearestIntersection);
        this.workDate = clean(workDate);
        this.workTime = clean(workTime);
        this.caller = clean(caller);
        this.contractor = clean(contractor);
        this.companyPhone = clean(companyPhone);
        this.contact = clean(contact);
        this.contactPhone = clean(contactPhone);
        this.contactEmail = clean(contactEmail);
        this.locationInformation = clean(locationInformation);
        this.workType = clean(workType);
        this.doneFor = clean(doneFor);
        this.extent = clean(extent);
        this.explosives = clean(explosives);
        this.whitePaint = clean(whitePaint);
        this.directionalBoring = clean(directionalBoring);
        this.rawText = clean(rawText);
        this.note = clean(note);
        this.portalUrl = clean(portalUrl);
        this.portalHtmlAvailable = portalHtmlAvailable;
        this.utilitiesNotified = Collections.unmodifiableList(new ArrayList<>(utilitiesNotified == null ? Collections.emptyList() : utilitiesNotified));
        this.actions = Collections.unmodifiableList(new ArrayList<>(actions == null ? Collections.emptyList() : actions));
        this.latitude = latitude;
        this.longitude = longitude;
        this.hasCoordinates = hasCoordinates;
        this.polygon = polygon;
    }

    public String title() {
        return ticketNumber.isEmpty() ? "Ticket" : ticketNumber;
    }

    public String locationLine() {
        String value = first(address, street);
        if (!value.isEmpty()) return value;
        return join(place, county);
    }

    public String dashboardAddress() {
        return join(address, street, place, county);
    }

    public String workDescription() {
        return first(locationInformation, rawText);
    }

    public String dueLine() {
        return join(workDate, workTime);
    }

    public String summaryLine() {
        return join(first(contractor, caller), dueLine());
    }

    public boolean hasAction(String key) {
        return actions.contains(key);
    }

    public Uri navigationUri() {
        if (hasCoordinates) {
            String label = Uri.encode(title());
            return Uri.parse("geo:" + latitude + "," + longitude + "?q=" + latitude + "," + longitude + "(" + label + ")");
        }
        String query = join(first(address, street), place, county, "AR");
        return Uri.parse("geo:0,0?q=" + Uri.encode(query));
    }

    public Uri googleMapsUri() {
        if (hasCoordinates) {
            return Uri.parse("https://www.google.com/maps/dir/?api=1&destination=" + latitude + "," + longitude + "&travelmode=driving");
        }
        String query = join(first(address, street), place, county, "AR");
        return Uri.parse("https://www.google.com/maps/dir/?api=1&destination=" + Uri.encode(query) + "&travelmode=driving");
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String first(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) return value.trim();
        }
        return "";
    }

    private static String join(String... values) {
        StringBuilder out = new StringBuilder();
        for (String value : values) {
            if (value == null || value.trim().isEmpty()) continue;
            if (out.length() > 0) out.append(", ");
            out.append(value.trim());
        }
        return out.toString();
    }
}
