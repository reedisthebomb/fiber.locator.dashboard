package com.fiberlocator.auto.car;

import android.content.Context;
import android.location.Location;
import android.location.LocationManager;
import android.os.Handler;
import android.os.Looper;
import android.text.SpannableString;
import android.text.Spanned;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.CarLocation;
import androidx.car.app.model.Distance;
import androidx.car.app.model.DistanceSpan;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Metadata;
import androidx.car.app.model.Place;
import androidx.car.app.model.PlaceListMapTemplate;
import androidx.car.app.model.PlaceMarker;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

import com.fiberlocator.auto.data.Ticket;
import com.fiberlocator.auto.data.TicketRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class TicketListScreen extends Screen {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Ticket> tickets = new ArrayList<>();
    private boolean loading = true;
    private String error = "";

    public TicketListScreen(@NonNull CarContext carContext) {
        super(carContext);
        reload();
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        if (!loading && error.isEmpty() && !tickets.isEmpty()) return ticketMapTemplate();
        return listTemplateForCurrentState();
    }

    private Template ticketMapTemplate() {
        ItemList.Builder list = new ItemList.Builder();
        Place anchor = null;
        Location currentLocation = lastKnownLocation();
        for (Ticket ticket : tickets) {
            if (!ticket.hasCoordinates) continue;
            double distanceMiles = distanceMiles(currentLocation, ticket);
            Place place = new Place.Builder(CarLocation.create(ticket.latitude, ticket.longitude))
                .setMarker(new PlaceMarker.Builder()
                    .setLabel(TicketCarStyle.mapLabel(ticket))
                    .setColor(TicketCarStyle.markerColor(ticket))
                    .build())
                .build();
            if (anchor == null) anchor = place;
            Row.Builder row = new Row.Builder()
                .setTitle(TicketCarStyle.title(ticket))
                .addText(statusWithDistance(ticket, distanceMiles))
                .addText(join(ticket.locationLine(), TicketCarStyle.detailLine(ticket)))
                .setMetadata(new Metadata.Builder().setPlace(place).build())
                .setOnClickListener(() -> getScreenManager().push(new TicketDetailScreen(getCarContext(), ticket)));
            list.addItem(row.build());
        }

        if (anchor == null) return listTemplateForCurrentState();

        return new PlaceListMapTemplate.Builder()
            .setTitle("Live tickets")
            .setHeaderAction(Action.APP_ICON)
            .setAnchor(anchor)
            .setItemList(list.build())
            .build();
    }

    private Template listTemplateForCurrentState() {
        ItemList.Builder list = new ItemList.Builder();
        if (loading) {
            list.addItem(new Row.Builder().setTitle("Loading tickets...").build());
        } else if (!error.isEmpty()) {
            list.addItem(new Row.Builder()
                .setTitle("Open phone app to sign in")
                .addText(error)
                .build());
        } else if (tickets.isEmpty()) {
            list.addItem(new Row.Builder().setTitle("No live tickets found").build());
        } else {
            for (Ticket ticket : tickets) {
                Row.Builder row = new Row.Builder()
                    .setTitle(TicketCarStyle.title(ticket))
                    .addText(TicketCarStyle.statusLine(ticket))
                    .addText(join(ticket.locationLine(), TicketCarStyle.detailLine(ticket)));
                row.setOnClickListener(() -> getScreenManager().push(new TicketDetailScreen(getCarContext(), ticket)));
                list.addItem(row.build());
            }
        }

        return new ListTemplate.Builder()
            .setSingleList(list.build())
            .setTitle("Live tickets")
            .setHeaderAction(Action.APP_ICON)
            .build();
    }

    private void reload() {
        loading = true;
        error = "";
        invalidate();
        executor.execute(() -> {
            try {
                List<Ticket> loaded = new TicketRepository(getCarContext()).loadTickets();
                main.post(() -> {
                    tickets.clear();
                    tickets.addAll(loaded);
                    loading = false;
                    invalidate();
                });
            } catch (Exception ex) {
                main.post(() -> {
                    tickets.clear();
                    loading = false;
                    error = ex.getMessage() == null ? "Unable to reach dashboard." : ex.getMessage();
                    invalidate();
                });
            }
        });
    }

    private Location lastKnownLocation() {
        try {
            LocationManager manager = (LocationManager) getCarContext().getSystemService(Context.LOCATION_SERVICE);
            if (manager == null) return null;
            Location best = null;
            for (String provider : manager.getProviders(true)) {
                Location location = manager.getLastKnownLocation(provider);
                if (location == null) continue;
                if (best == null || location.getTime() > best.getTime()) best = location;
            }
            return best;
        } catch (SecurityException ex) {
            return null;
        }
    }

    private static CharSequence statusWithDistance(Ticket ticket, double distanceMiles) {
        String status = TicketCarStyle.statusLine(ticket).toString();
        SpannableString text = new SpannableString("  - " + status);
        text.setSpan(
            DistanceSpan.create(Distance.create(Math.max(0, distanceMiles), Distance.UNIT_MILES_P1)),
            0,
            1,
            Spanned.SPAN_INCLUSIVE_INCLUSIVE
        );
        return text;
    }

    private static double distanceMiles(Location currentLocation, Ticket ticket) {
        if (currentLocation == null || !ticket.hasCoordinates) return 0;
        float[] result = new float[1];
        Location.distanceBetween(
            currentLocation.getLatitude(),
            currentLocation.getLongitude(),
            ticket.latitude,
            ticket.longitude,
            result
        );
        return result[0] / 1609.344d;
    }

    private static String join(String... values) {
        StringBuilder out = new StringBuilder();
        for (String value : values) {
            if (value == null || value.trim().isEmpty()) continue;
            if (out.length() > 0) out.append(" | ");
            out.append(value.trim());
        }
        return out.toString();
    }
}
