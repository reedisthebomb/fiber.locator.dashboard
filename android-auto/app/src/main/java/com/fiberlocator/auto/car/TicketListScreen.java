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
import androidx.car.app.model.Tab;
import androidx.car.app.model.TabContents;
import androidx.car.app.model.TabTemplate;
import androidx.car.app.model.Template;

import com.fiberlocator.auto.data.Ticket;
import com.fiberlocator.auto.data.TicketRepository;
import com.fiberlocator.auto.data.TicketRepository.DashboardSnapshot;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class TicketListScreen extends Screen {
    private static final String TAB_TICKETS = "tickets";
    private static final String TAB_MAP = "map";
    private static final int MAX_TAB_TICKETS = 48;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Ticket> tickets = new ArrayList<>();
    private boolean loading = true;
    private String error = "";
    private String activeTab = TAB_TICKETS;

    public TicketListScreen(@NonNull CarContext carContext) {
        super(carContext);
        reload();
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        return tabTemplateForCurrentState();
    }

    private Template tabTemplateForCurrentState() {
        if (loading || !error.isEmpty()) return listTemplateForCurrentState(filteredTickets());
        List<Ticket> visible = filteredTickets();
        return new TabTemplate.Builder(new TabTemplate.TabCallback() {
                @Override
                public void onTabSelected(@NonNull String tabContentId) {
                    if (TAB_MAP.equals(tabContentId)) {
                        getScreenManager().push(new CarLiveMapScreen(getCarContext()));
                        return;
                    }
                    activeTab = TAB_TICKETS;
                    invalidate();
                }
            })
            .setHeaderAction(Action.APP_ICON)
            .addTab(new Tab.Builder()
                .setTitle("Tickets")
                .setIcon(androidx.car.app.model.CarIcon.APP_ICON)
                .setContentId(TAB_TICKETS)
                .build())
            .addTab(new Tab.Builder()
                .setTitle("Map")
                .setIcon(androidx.car.app.model.CarIcon.PAN)
                .setContentId(TAB_MAP)
                .build())
            .setActiveTabContentId(activeTab)
            .setTabContents(new TabContents.Builder(listTemplateForCurrentState(visible, false)).build())
            .build();
    }

    private Template ticketMapTemplate(List<Ticket> visibleTickets) {
        ItemList.Builder list = new ItemList.Builder();
        Place anchor = null;
        Location currentLocation = lastKnownLocation();
        for (Ticket ticket : visibleTickets) {
            if (!ticket.hasCoordinates) continue;
            double distanceMiles = distanceMiles(currentLocation, ticket);
            PlaceMarker.Builder marker = new PlaceMarker.Builder()
                .setColor(TicketCarStyle.markerColor(ticket));
            String markerLabel = TicketCarStyle.mapLabel(ticket);
            if (!markerLabel.isEmpty()) marker.setLabel(markerLabel);
            Place place = new Place.Builder(CarLocation.create(ticket.latitude, ticket.longitude))
                .setMarker(marker.build())
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

        if (anchor == null) return listTemplateForCurrentState(visibleTickets);

        return new PlaceListMapTemplate.Builder()
            .setTitle(tabTitle())
            .setHeaderAction(Action.APP_ICON)
            .setAnchor(anchor)
            .setItemList(list.build())
            .build();
    }

    private Template listTemplateForCurrentState(List<Ticket> visibleTickets) {
        return listTemplateForCurrentState(visibleTickets, true);
    }

    private ListTemplate listTemplateForCurrentState(List<Ticket> visibleTickets, boolean includeHeader) {
        ItemList.Builder list = new ItemList.Builder();
        if (loading) {
            list.addItem(new Row.Builder().setTitle("Loading tickets...").build());
            list.addItem(new Row.Builder()
                .setTitle("Open live map")
                .addText("Map can load while tickets refresh")
                .setOnClickListener(() -> getScreenManager().push(new CarLiveMapScreen(getCarContext())))
                .build());
        } else if (!error.isEmpty()) {
            list.addItem(new Row.Builder()
                .setTitle("Open phone app to sign in")
                .addText(error)
                .build());
            list.addItem(new Row.Builder()
                .setTitle("Open live map")
                .addText("Use cached map data if available")
                .setOnClickListener(() -> getScreenManager().push(new CarLiveMapScreen(getCarContext())))
                .build());
        } else if (visibleTickets.isEmpty()) {
            list.addItem(new Row.Builder().setTitle("No tickets found").build());
        } else {
            for (Ticket ticket : visibleTickets) {
                Row.Builder row = new Row.Builder()
                    .setTitle(TicketCarStyle.title(ticket))
                    .addText(TicketCarStyle.statusLine(ticket))
                    .addText(join(ticket.locationLine(), TicketCarStyle.detailLine(ticket)));
                row.setOnClickListener(() -> getScreenManager().push(new TicketDetailScreen(getCarContext(), ticket)));
                list.addItem(row.build());
            }
        }

        ListTemplate.Builder builder = new ListTemplate.Builder().setSingleList(list.build());
        if (includeHeader) {
            builder.setTitle(tabTitle()).setHeaderAction(Action.APP_ICON);
        }
        return builder.build();
    }

    private void reload() {
        loading = true;
        error = "";
        invalidate();
        executor.execute(() -> {
            try {
                DashboardSnapshot snapshot = new TicketRepository(getCarContext()).loadSnapshot();
                List<Ticket> loaded = snapshot.tickets;
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

    private List<Ticket> filteredTickets() {
        List<Ticket> visible = new ArrayList<>();
        for (Ticket ticket : tickets) {
            visible.add(ticket);
            if (visible.size() >= MAX_TAB_TICKETS) break;
        }
        return visible;
    }

    private String tabTitle() {
        return "Tickets";
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
