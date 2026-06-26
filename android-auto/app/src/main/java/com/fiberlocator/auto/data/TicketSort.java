package com.fiberlocator.auto.data;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Comparator;
import java.util.Date;
import java.util.Locale;

public final class TicketSort {
    public static final Comparator<Ticket> DASHBOARD = (left, right) -> {
        int compare = Integer.compare(topBucket(left), topBucket(right));
        if (compare != 0) return compare;
        compare = Long.compare(dueDateMs(left), dueDateMs(right));
        if (compare != 0) return compare;
        compare = Integer.compare(priorityRank(left), priorityRank(right));
        if (compare != 0) return compare;
        compare = Long.compare(dueTimeMinutes(left), dueTimeMinutes(right));
        if (compare != 0) return compare;
        compare = clean(left.ticketNumber).compareToIgnoreCase(clean(right.ticketNumber));
        if (compare != 0) return compare;
        return Long.compare(preparedMs(left), preparedMs(right));
    };

    private TicketSort() {
    }

    private static int topBucket(Ticket ticket) {
        int priority = priorityRank(ticket);
        return priority <= 1 ? 0 : 1;
    }

    private static int priorityRank(Ticket ticket) {
        String text = (
            clean(ticket.messageType) + " " +
            clean(ticket.workType) + " " +
            clean(ticket.rawText) + " " +
            clean(ticket.note)
        ).toLowerCase(Locale.US);
        if (text.contains("emergency") || text.contains("damage")) return 0;
        if (text.contains("remark") || text.contains("priority") || text.contains("rush")) return 1;
        if (text.contains("tcw") || text.contains("dmi")) return 2;
        if (text.contains("renewal")) return 3;
        return 6;
    }

    private static long dueDateMs(Ticket ticket) {
        return parseDate(clean(ticket.workDate), Long.MAX_VALUE - 200000L);
    }

    private static long preparedMs(Ticket ticket) {
        long date = parseDate(clean(ticket.preparedDate), Long.MAX_VALUE - 100000L);
        long minutes = dueTimeMinutes(clean(ticket.preparedTime));
        return date == Long.MAX_VALUE - 100000L ? date : date + (minutes * 60000L);
    }

    private static long dueTimeMinutes(Ticket ticket) {
        return dueTimeMinutes(clean(ticket.workTime));
    }

    private static long dueTimeMinutes(String value) {
        if (value.isEmpty()) return Long.MAX_VALUE / 60000L;
        String text = value.trim().toUpperCase(Locale.US);
        boolean pm = text.contains("PM");
        boolean am = text.contains("AM");
        String[] parts = text.replaceAll("[^0-9:]", "").split(":");
        if (parts.length == 0 || parts[0].isEmpty()) return Long.MAX_VALUE / 60000L;
        try {
            int hour = Integer.parseInt(parts[0]);
            int minute = parts.length > 1 && !parts[1].isEmpty() ? Integer.parseInt(parts[1]) : 0;
            if (pm && hour < 12) hour += 12;
            if (am && hour == 12) hour = 0;
            return hour * 60L + minute;
        } catch (NumberFormatException ignored) {
            return Long.MAX_VALUE / 60000L;
        }
    }

    private static long parseDate(String value, long fallback) {
        if (value.isEmpty()) return fallback;
        String[] patterns = {
            "M/d/yyyy",
            "MM/dd/yyyy",
            "M/d/yy",
            "MM/dd/yy",
            "yyyy-MM-dd",
            "MMM d yyyy",
            "MMMM d yyyy"
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat format = new SimpleDateFormat(pattern, Locale.US);
                format.setLenient(true);
                Date date = format.parse(value.replace(",", "").trim());
                if (date != null) return date.getTime();
            } catch (ParseException ignored) {
            }
        }
        return fallback;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
