package com.fiberlocator.auto;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;

import com.fiberlocator.auto.data.TicketRepository;
import com.fiberlocator.auto.data.TicketRepository.DashboardSnapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class TicketCompletionService extends Service {
    private static final String ACTION_COMPLETE = "com.fiberlocator.auto.COMPLETE_TICKET";
    private static final String EXTRA_TICKET = "ticket";
    private static final String EXTRA_ACTIONS = "actions";
    private static final String EXTRA_NOTE = "note";
    private static final String EXTRA_ATTACHMENTS = "attachments";
    private static final String CHANNEL_ID = "ticket_completion";
    private static final int NOTIFICATION_ID = 8207;
    private static final Set<String> RUNNING_TICKETS = Collections.synchronizedSet(new HashSet<>());

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public static void start(Context context, String ticketNumber, List<String> actions, String note, List<Uri> attachments) {
        Intent intent = new Intent(context, TicketCompletionService.class);
        intent.setAction(ACTION_COMPLETE);
        intent.putExtra(EXTRA_TICKET, ticketNumber == null ? "" : ticketNumber);
        intent.putStringArrayListExtra(EXTRA_ACTIONS, new ArrayList<>(actions == null ? Collections.emptyList() : actions));
        ArrayList<String> attachmentStrings = new ArrayList<>();
        if (attachments != null) {
            for (Uri uri : attachments) {
                if (uri != null) attachmentStrings.add(uri.toString());
            }
        }
        intent.putStringArrayListExtra(EXTRA_ATTACHMENTS, attachmentStrings);
        intent.putExtra(EXTRA_NOTE, note == null ? "" : note);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
        else context.startService(intent);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !ACTION_COMPLETE.equals(intent.getAction())) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        String ticketNumber = clean(intent.getStringExtra(EXTRA_TICKET));
        if (ticketNumber.isEmpty()) {
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        if (!RUNNING_TICKETS.add(ticketNumber)) {
            showFinalNotification("Ticket completion already running", ticketNumber);
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        startForeground(NOTIFICATION_ID, notification("Completing ticket", ticketNumber, true));
        ArrayList<String> actions = intent.getStringArrayListExtra(EXTRA_ACTIONS);
        ArrayList<String> attachmentValues = intent.getStringArrayListExtra(EXTRA_ATTACHMENTS);
        String note = intent.getStringExtra(EXTRA_NOTE);
        executor.execute(() -> {
            try {
                List<Uri> attachments = new ArrayList<>();
                if (attachmentValues != null) {
                    for (String value : attachmentValues) {
                        if (value != null && !value.trim().isEmpty()) attachments.add(Uri.parse(value));
                    }
                }
                TicketRepository repository = new TicketRepository(this);
                DashboardSnapshot snapshot = repository.loadSnapshot();
                repository.saveTicketCompletion(snapshot, ticketNumber, actions == null ? Collections.emptyList() : actions, note, attachments);
                showFinalNotification("Ticket completed", ticketNumber);
            } catch (Exception error) {
                String message = clean(error.getMessage());
                showFinalNotification("Ticket completion failed", message.isEmpty() ? ticketNumber : ticketNumber + " - " + message);
            } finally {
                RUNNING_TICKETS.remove(ticketNumber);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_DETACH);
                else stopForeground(false);
                stopSelf(startId);
            }
        });
        return START_REDELIVER_INTENT;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    private void showFinalNotification(String title, String text) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(NOTIFICATION_ID + 1, notification(title, text, false));
    }

    private Notification notification(String title, String text, boolean ongoing) {
        ensureChannel();
        Intent launch = new Intent(this, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int pendingFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, launch, pendingFlags);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text == null ? "" : text)
            .setContentIntent(pendingIntent)
            .setOngoing(ongoing)
            .setOnlyAlertOnce(ongoing)
            .setAutoCancel(!ongoing);
        if (ongoing) builder.setProgress(0, 0, true);
        return builder.build();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Ticket completion", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Ticket completion and attachment upload status");
        manager.createNotificationChannel(channel);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
