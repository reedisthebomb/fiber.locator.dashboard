package com.fiberlocator.auto.car;

import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarLocation;
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
        if (!loading && error.isEmpty() && !tickets.isEmpty()) {
            return ticketMapTemplate();
        }

        ItemList.Builder list = new ItemList.Builder();
        if (loading) {
            list.addItem(new Row.Builder().setTitle("Loading tickets...").build());
        } else if (!error.isEmpty()) {
            list.addItem(new Row.Builder()
                .setTitle("Open phone app to sign in")
                .addText(error)
                .build());
        } else if (tickets.isEmpty()) {
            list.addItem(new Row.Builder().setTitle("No navigable tickets found").build());
        } else {
            for (Ticket ticket : tickets) {
                Row.Builder row = new Row.Builder()
                    .setTitle(ticket.title())
                    .addText(ticket.locationLine());
                String summary = ticket.summaryLine();
                if (!summary.isEmpty()) row.addText(summary);
                row.setOnClickListener(() -> getScreenManager().push(new TicketDetailScreen(getCarContext(), ticket)));
                list.addItem(row.build());
            }
        }

        Action refresh = new Action.Builder()
            .setTitle("Refresh")
            .setOnClickListener(this::reload)
            .build();

        return new ListTemplate.Builder()
            .setSingleList(list.build())
            .setTitle("Live tickets")
            .setHeaderAction(Action.APP_ICON)
            .addAction(refresh)
            .build();
    }

    private Template ticketMapTemplate() {
        ItemList.Builder list = new ItemList.Builder();
        Place anchor = null;
        for (Ticket ticket : tickets) {
            if (!ticket.hasCoordinates) continue;
            Place place = new Place.Builder(CarLocation.create(ticket.latitude, ticket.longitude))
                .setMarker(new PlaceMarker.Builder().setLabel(ticket.title()).build())
                .build();
            if (anchor == null) anchor = place;
            Row.Builder row = new Row.Builder()
                .setTitle(ticket.title())
                .addText(ticket.locationLine())
                .setMetadata(new Metadata.Builder().setPlace(place).build())
                .setOnClickListener(() -> getScreenManager().push(new TicketDetailScreen(getCarContext(), ticket)));
            String summary = ticket.summaryLine();
            if (!summary.isEmpty()) row.addText(summary);
            list.addItem(row.build());
        }

        if (anchor == null) {
            return noMappedTicketsTemplate();
        }

        Action refresh = new Action.Builder()
            .setTitle("Refresh")
            .setOnClickListener(this::reload)
            .build();

        return new PlaceListMapTemplate.Builder()
            .setTitle("Live tickets")
            .setHeaderAction(Action.APP_ICON)
            .setCurrentLocationEnabled(true)
            .setAnchor(anchor)
            .setItemList(list.build())
            .setActionStrip(new ActionStrip.Builder().addAction(refresh).build())
            .build();
    }

    private Template noMappedTicketsTemplate() {
        ItemList.Builder list = new ItemList.Builder()
            .addItem(new Row.Builder().setTitle("No mapped tickets found").build());
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
}
