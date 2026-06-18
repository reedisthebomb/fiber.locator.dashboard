package com.fiberlocator.auto.car;

import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.Pane;
import androidx.car.app.model.PaneTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

import com.fiberlocator.auto.data.Ticket;

public class TicketDetailScreen extends Screen {
    private final Ticket ticket;

    public TicketDetailScreen(@NonNull CarContext carContext, Ticket ticket) {
        super(carContext);
        this.ticket = ticket;
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        Action navigate = new Action.Builder()
            .setTitle("Google Maps")
            .setOnClickListener(this::navigate)
            .build();
        Action dashboardMap = new Action.Builder()
            .setTitle("Dashboard Map")
            .setOnClickListener(this::openDashboardMap)
            .build();

        Pane.Builder pane = new Pane.Builder()
            .addAction(dashboardMap)
            .addAction(navigate);
        addRow(pane, "Status", TicketCarStyle.statusLine(ticket));
        addRow(pane, "Location", ticket.locationLine());
        addRow(pane, "Due", ticket.dueLine());
        addRow(pane, "Work", join(first(ticket.workType, ticket.messageType), ticket.nearestIntersection));
        addRow(pane, "Contractor", join(first(ticket.contractor, ticket.caller), ticket.doneFor));
        addRow(pane, "Contact", first(ticket.contactPhone, ticket.companyPhone, ticket.contactEmail));

        return new PaneTemplate.Builder(pane.build())
            .setTitle(ticket.title())
            .setHeaderAction(Action.BACK)
            .build();
    }

    private void navigate() {
        try {
            Intent intent = new Intent(CarContext.ACTION_NAVIGATE, ticket.navigationUri());
            getCarContext().startCarApp(intent);
        } catch (Exception ex) {
            CarToast.makeText(getCarContext(), "Navigation is unavailable", CarToast.LENGTH_LONG).show();
        }
    }

    private void openDashboardMap() {
        if (!ticket.hasCoordinates) {
            CarToast.makeText(getCarContext(), "Ticket has no map location", CarToast.LENGTH_LONG).show();
            return;
        }
        getScreenManager().push(new CarLiveMapScreen(getCarContext(), ticket));
    }

    private static void addRow(Pane.Builder pane, String title, CharSequence text) {
        if (text == null || text.toString().trim().isEmpty()) return;
        pane.addRow(new Row.Builder().setTitle(title).addText(text).build());
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
            if (out.length() > 0) out.append(" | ");
            out.append(value.trim());
        }
        return out.toString();
    }
}
