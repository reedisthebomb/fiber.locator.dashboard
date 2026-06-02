package com.fiberlocator.auto.car;

import com.fiberlocator.auto.data.Ticket;

import androidx.car.app.model.CarColor;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

final class TicketCarStyle {
    private TicketCarStyle() {
    }

    static CharSequence title(Ticket ticket) {
        String label = badge(ticket);
        return label.isEmpty() ? ticket.title() : label + "  " + ticket.title();
    }

    static CharSequence statusLine(Ticket ticket) {
        String label = badge(ticket);
        String due = ticket.dueLine();
        if (label.isEmpty()) label = "Open";
        return due.isEmpty() ? label : label + " - " + due;
    }

    static String detailLine(Ticket ticket) {
        return join(ticket.county, first(ticket.workType, ticket.messageType), first(ticket.contractor, ticket.caller));
    }

    static String mapLabel(Ticket ticket) {
        if (isEmergency(ticket)) return "EMG";
        if (isTcwDmi(ticket)) return "TCW";
        if (isRecall(ticket)) return "REC";
        if (isRenewal(ticket)) return "REN";
        String due = dueStatus(ticket);
        if ("due-today".equals(due)) return "DUE";
        if ("due-next".equals(due)) return "NXT";
        return "";
    }

    static CarColor markerColor(Ticket ticket) {
        if (isEmergency(ticket)) return CarColor.RED;
        if (isTcwDmi(ticket)) return CarColor.YELLOW;
        if (isRecall(ticket)) return CarColor.BLUE;
        if (isRenewal(ticket)) return CarColor.BLUE;
        String due = dueStatus(ticket);
        if ("due-today".equals(due)) return CarColor.RED;
        if ("due-next".equals(due)) return CarColor.YELLOW;
        if ("due-later".equals(due)) return CarColor.GREEN;
        return CarColor.DEFAULT;
    }

    static String badge(Ticket ticket) {
        if (isTcwDmi(ticket)) return "TCW/DMI";
        if (isEmergency(ticket)) return "Emergency";
        if (isRecall(ticket)) return "Recall";
        if (isRenewal(ticket)) return "Renewal";
        String due = dueStatus(ticket);
        if ("due-today".equals(due)) return "Due now";
        if ("due-next".equals(due)) return "Next due";
        if ("due-later".equals(due)) return "Upcoming";
        return "";
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

    private static boolean isEmergency(Ticket ticket) {
        return priorityText(ticket).contains("EMERGENCY");
    }

    private static boolean isRecall(Ticket ticket) {
        String text = priorityText(ticket);
        return text.matches(".*\\bRECALL\\b.*")
            || text.matches(".*\\bSECOND\\s+REQUEST\\b.*")
            || text.matches(".*\\b24\\s*(HOUR|HR)\\s+PRIORITY\\b.*")
            || text.matches(".*\\bTWENTY\\s+FOUR\\s+HOUR\\s+PRIORITY\\b.*");
    }

    private static boolean isRenewal(Ticket ticket) {
        return priorityText(ticket).contains("RENEWAL");
    }

    private static boolean isTcwDmi(Ticket ticket) {
        String text = normalized(ticket.doneFor + " " + ticket.contractor + " " + ticket.caller);
        return text.contains(" TCW ")
            || text.contains(" DMI ")
            || text.contains(" TC WORKS ")
            || text.contains(" THE COMPUTER WORKS ")
            || text.contains(" COMPUTER WORKS ")
            || text.contains(" DIRT MOVES ")
            || text.contains(" DIRT MOVES INC ")
            || text.contains(" DIRT MOVES INCORPORATED ");
    }

    private static String priorityText(Ticket ticket) {
        return (ticket.messageType + " " + ticket.workType + " " + ticket.locationInformation + " " + ticket.rawText).toUpperCase(Locale.US);
    }

    private static String normalized(String value) {
        return (" " + String.valueOf(value).toUpperCase(Locale.US)
            .replace("&", " AND ")
            .replaceAll("[^A-Z0-9]+", " ")
            .replaceAll("\\s+", " ")
            .trim() + " ");
    }

    private static String dueStatus(Ticket ticket) {
        Date due = parseTicketDate(ticket.workDate);
        if (due == null) return "";
        Date today = startOfToday();
        Date next = nextWorkingDay(today);
        if (!due.after(today)) return "due-today";
        if (sameDay(due, next)) return "due-next";
        return "due-later";
    }

    private static Date parseTicketDate(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        String clean = value.trim().replace(" at ", " ");
        try {
            String[] parts = clean.contains("-") ? clean.split("-") : clean.split("/");
            if (parts.length >= 3) {
                String dayPart = parts[2].trim().split("\\s+")[0].replaceAll("[^0-9]", "");
                if (clean.contains("-") && parts[0].trim().length() == 4) {
                    return new Date(Integer.parseInt(parts[0].trim()) - 1900, Integer.parseInt(parts[1].trim()) - 1, Integer.parseInt(dayPart));
                }
                int year = Integer.parseInt(dayPart);
                if (year < 100) year += 2000;
                return new Date(year - 1900, Integer.parseInt(parts[0].trim()) - 1, Integer.parseInt(parts[1].trim()));
            }
        } catch (Exception ignored) {
        }
        String[] formats = new String[] {
            "MMMM d, yyyy h:mm a",
            "MMM d, yyyy h:mm a",
            "MMMM d, yyyy",
            "MMM d, yyyy",
            "MMMM d yyyy h:mm a",
            "MMM d yyyy h:mm a",
            "MMMM d yyyy",
            "MMM d yyyy"
        };
        for (String format : formats) {
            try {
                return new SimpleDateFormat(format, Locale.US).parse(clean);
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private static Date startOfToday() {
        Date now = new Date();
        return new Date(now.getYear(), now.getMonth(), now.getDate());
    }

    private static Date nextWorkingDay(Date from) {
        Date date = new Date(from.getTime());
        do {
            date = new Date(date.getYear(), date.getMonth(), date.getDate() + 1);
        } while (date.getDay() == 0 || date.getDay() == 6);
        return date;
    }

    private static boolean sameDay(Date left, Date right) {
        return left.getYear() == right.getYear() && left.getMonth() == right.getMonth() && left.getDate() == right.getDate();
    }
}
