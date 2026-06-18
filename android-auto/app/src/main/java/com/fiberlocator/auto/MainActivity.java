package com.fiberlocator.auto;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Rect;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Rational;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.ArrayAdapter;
import android.widget.Spinner;
import android.widget.TextView;

import com.fiberlocator.auto.data.LocatorNote;
import com.fiberlocator.auto.data.Ticket;
import com.fiberlocator.auto.data.TicketRepository;
import com.fiberlocator.auto.data.TicketRepository.DashboardSnapshot;
import com.fiberlocator.auto.data.TicketRepository.TicketAction;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    private static final int PICK_ATTACHMENTS = 4107;
    private static final int LOCATION_PERMISSION_REQUEST = 4108;
    private static final int PICK_PROFILE_PHOTO = 4109;
    private static final int PICK_WEB_FILE = 4110;
    private static final String SECURE_MAP_ORIGIN = "https://appassets.androidplatform.net/";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Uri> pendingAttachments = new ArrayList<>();
    private TicketRepository repository;
    private LinearLayout root;
    private FrameLayout content;
    private LinearLayout chrome;
    private LinearLayout nav;
    private ProgressBar progress;
    private TextView title;
    private TextView subtitle;
    private Button ticketsNav;
    private Button mapNav;
    private Button menuNav;
    private DashboardSnapshot snapshot;
    private Ticket activeTicket;
    private TextView attachmentStatus;
    private TextView locatorNoteAttachmentStatus;
    private ValueCallback<Uri[]> webFileCallback;
    private TextView profileStatus;
    private ImageView profilePhotoPreview;
    private String pendingProfileAvatarData = "";
    private String screen = "login";
    private String pendingScreen = "";
    private String activeTicketNumber = "";
    private double pendingLocatorNoteLatitude = Double.NaN;
    private double pendingLocatorNoteLongitude = Double.NaN;
    private String pendingLocatorNoteTargetType = "map";
    private String pendingLocatorNoteTargetLabel = "Map spot";
    private String pendingLocatorNoteTargetId = "";
    private String pendingLocatorNoteTicket = "";
    private String pendingLocatorNoteLayerId = "";
    private String pendingLocatorNoteFeatureId = "";
    private String pendingGeolocationOrigin = "";
    private GeolocationPermissions.Callback pendingGeolocationCallback;
    private WebView activeMapWebView;
    private boolean refreshRunning = false;
    private boolean tcwDashboardMode = false;

    private static final String[][] LOCATOR_NOTE_CATEGORIES = new String[][] {
        {"instruction", "Instruction"},
        {"layer_issue", "Layer issue"},
        {"locate_issue", "Locate issue"},
        {"needs_attention", "Needs attention"},
        {"restoration", "Restoration"},
        {"other", "Other note"}
    };

    private final int bg = Color.rgb(15, 23, 42);
    private final int surface = Color.rgb(17, 24, 39);
    private final int panel = Color.rgb(30, 41, 59);
    private final int ink = Color.rgb(248, 250, 252);
    private final int muted = Color.rgb(148, 163, 184);
    private final int accent = Color.rgb(56, 189, 248);
    private final int line = Color.rgb(51, 65, 85);
    private final int danger = Color.rgb(248, 113, 113);
    private final int lightPanel = Color.rgb(248, 250, 252);
    private final int lightControl = Color.WHITE;
    private final int darkInk = Color.rgb(15, 23, 42);
    private final int darkMuted = Color.rgb(71, 85, 105);
    private final int lightLine = Color.rgb(203, 213, 225);

    private final Runnable periodicRefresh = new Runnable() {
        @Override
        public void run() {
            if ("tickets".equals(screen)) refreshTickets(false);
            handler.postDelayed(this, 30000);
        }
    };

    @Override
    protected void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        getWindow().setStatusBarColor(bg);
        getWindow().setNavigationBarColor(bg);
        repository = new TicketRepository(this);
        if (bundle != null) {
            pendingScreen = bundle.getString("screen", "");
            activeTicketNumber = bundle.getString("ticket", "");
        } else {
            pendingScreen = AppSettings.lastScreen(this);
            activeTicketNumber = AppSettings.lastTicket(this);
        }
        if (AppSettings.username(this).isEmpty() || AppSettings.password(this).isEmpty()) showLogin("");
        else showAppShell();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        outState.putString("screen", screen);
        outState.putString("ticket", activeTicketNumber);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.postDelayed(periodicRefresh, 30000);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(periodicRefresh);
        super.onPause();
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (shouldUseMapPictureInPicture()) enterMapPictureInPicture();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        applyPictureInPictureChrome(isInPictureInPictureMode);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != LOCATION_PERMISSION_REQUEST) return;
        boolean granted = hasLocationPermission();
        if (pendingGeolocationCallback != null && !pendingGeolocationOrigin.isEmpty()) {
            pendingGeolocationCallback.invoke(pendingGeolocationOrigin, granted, granted);
        }
        pendingGeolocationOrigin = "";
        pendingGeolocationCallback = null;
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if ("map".equals(screen)) {
            showTickets();
        } else if ("complete".equals(screen)) {
            showTicketDetail(activeTicket);
        } else if ("locator-note".equals(screen)) {
            showMap(activeTicket);
        } else if ("dig".equals(screen) || "restoration".equals(screen) || "in-house-requests".equals(screen) || "location-photos".equals(screen) || "profile".equals(screen)) {
            showTickets();
        } else if ("detail".equals(screen)) {
            showTickets();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_PROFILE_PHOTO) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                try {
                    pendingProfileAvatarData = profileImageDataUri(data.getData());
                    if (profilePhotoPreview != null) profilePhotoPreview.setImageURI(data.getData());
                    if (profileStatus != null) {
                        profileStatus.setTextColor(muted);
                        profileStatus.setText("Profile photo selected.");
                    }
                } catch (Exception error) {
                    if (profileStatus != null) {
                        profileStatus.setTextColor(danger);
                        profileStatus.setText(error.getMessage());
                    }
                }
            }
            return;
        }
        if (requestCode == PICK_WEB_FILE) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int index = 0; index < count; index++) results[index] = data.getClipData().getItemAt(index).getUri();
                } else if (data.getData() != null) {
                    results = new Uri[] {data.getData()};
                }
            }
            if (webFileCallback != null) webFileCallback.onReceiveValue(results);
            webFileCallback = null;
            return;
        }
        if (requestCode != PICK_ATTACHMENTS || resultCode != RESULT_OK || data == null) return;
        if (data.getClipData() != null) {
            for (int index = 0; index < data.getClipData().getItemCount(); index++) {
                pendingAttachments.add(data.getClipData().getItemAt(index).getUri());
            }
        } else if (data.getData() != null) {
            pendingAttachments.add(data.getData());
        }
        if (attachmentStatus != null) attachmentStatus.setText(pendingAttachments.size() + " photo/video attachment(s) selected");
        if (locatorNoteAttachmentStatus != null) locatorNoteAttachmentStatus.setText(pendingAttachments.size() + " photo/video attachment(s) selected");
    }

    private void showLogin(String message) {
        screen = "login";
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER_VERTICAL);
        page.setPadding(dp(22), dp(26), dp(22), dp(26));
        page.setBackgroundColor(bg);

        ImageView logo = logoView(AppSettings.username(this));
        logo.getLayoutParams().height = dp(150);
        TextView heading = text("Fiber Locator", 30, ink, true);
        TextView sub = text("Employee login for live ticket access.", 15, muted, false);
        EditText username = input("Username", AppSettings.username(this), InputType.TYPE_CLASS_TEXT);
        EditText password = input("Password", AppSettings.password(this), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        CheckBox remember = new CheckBox(this);
        remember.setText("Remember me");
        remember.setTextColor(ink);
        remember.setTextSize(15);
        remember.setChecked(AppSettings.rememberMe(this));
        TextView status = text(message, 13, message.isEmpty() ? muted : danger, false);
        Button signIn = primaryButton("Sign in");
        Button createAccount = secondaryButton("Create account request");
        username.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
                logo.setImageResource(logoResource(String.valueOf(s)));
            }
            @Override public void afterTextChanged(Editable s) {}
        });

        signIn.setOnClickListener(view -> {
            AppSettings.save(this, AppSettings.DEFAULT_DASHBOARD_URL, username.getText().toString(), password.getText().toString(), "", remember.isChecked());
            status.setTextColor(muted);
            status.setText("Signing in...");
            signIn.setEnabled(false);
            executor.execute(() -> {
                try {
                    boolean ok = repository.ensureLogin();
                    runOnUiThread(() -> {
                        signIn.setEnabled(true);
                        if (ok) showAppShell();
                        else {
                            status.setTextColor(danger);
                            status.setText("Login failed. Check the username and password.");
                        }
                    });
                } catch (Exception error) {
                    runOnUiThread(() -> {
                        signIn.setEnabled(true);
                        status.setTextColor(danger);
                        status.setText(error.getMessage());
                    });
                }
            });
        });
        createAccount.setOnClickListener(view -> showAccountRequest());

        page.addView(logo);
        page.addView(heading);
        page.addView(sub);
        page.addView(spacer(18));
        page.addView(username);
        page.addView(password);
        page.addView(remember);
        page.addView(signIn, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        page.addView(createAccount, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        page.addView(status);
        setContentView(page);
    }

    private void showAccountRequest() {
        screen = "account_request";
        LinearLayout page = column(dp(22), dp(26), dp(22), dp(26));
        page.setGravity(Gravity.CENTER_VERTICAL);
        page.setBackgroundColor(bg);
        TextView heading = text("Create account", 28, ink, true);
        TextView sub = text("Request employee access. An admin must approve the account before live tickets are available.", 14, muted, false);
        EditText name = input("Full name", "", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PERSON_NAME);
        EditText email = input("Email", "", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        EditText phone = input("Phone", "", InputType.TYPE_CLASS_PHONE);
        EditText company = input("Company", "", InputType.TYPE_CLASS_TEXT);
        EditText titleField = input("Title / role", "", InputType.TYPE_CLASS_TEXT);
        EditText message = input("Message", "", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        message.setMinLines(3);
        message.setSingleLine(false);
        TextView status = text("", 13, muted, false);
        Button submit = primaryButton("Submit request");
        Button back = secondaryButton("Back to employee login");
        submit.setOnClickListener(view -> {
            submit.setEnabled(false);
            status.setTextColor(muted);
            status.setText("Submitting request...");
            executor.execute(() -> {
                try {
                    JSONObject request = new JSONObject();
                    request.put("display_name", name.getText().toString());
                    request.put("email", email.getText().toString());
                    request.put("phone", phone.getText().toString());
                    request.put("company", company.getText().toString());
                    request.put("title", titleField.getText().toString());
                    request.put("message", message.getText().toString());
                    repository.submitAccountRequest(request);
                    runOnUiThread(() -> {
                        submit.setEnabled(true);
                        status.setTextColor(accent);
                        status.setText("Request submitted. An admin will create your employee login.");
                    });
                } catch (Exception error) {
                    runOnUiThread(() -> {
                        submit.setEnabled(true);
                        status.setTextColor(danger);
                        status.setText(error.getMessage());
                    });
                }
            });
        });
        back.setOnClickListener(view -> showLogin(""));
        page.addView(heading);
        page.addView(sub);
        page.addView(spacer(16));
        page.addView(name);
        page.addView(email);
        page.addView(phone);
        page.addView(company);
        page.addView(titleField);
        page.addView(message);
        page.addView(submit, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        page.addView(back, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        page.addView(status);
        setContentView(page);
    }

    private void showAppShell() {
        tcwDashboardMode = false;
        AppSettings.saveDashboardMode(this, "main");
        String startupScreen = pendingScreen;
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(bg);

        chrome = new LinearLayout(this);
        chrome.setOrientation(LinearLayout.VERTICAL);
        chrome.setBackgroundColor(surface);
        chrome.setPadding(dp(16), dp(12), dp(16), dp(8));
        ImageView headerLogo = logoView(AppSettings.username(this));
        title = text("Tickets", 23, ink, true);
        subtitle = text("Live dashboard tickets", 13, muted, false);
        chrome.addView(headerLogo);
        chrome.addView(title);
        chrome.addView(subtitle);

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        progress.setVisibility(View.GONE);

        content = new FrameLayout(this);
        content.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        nav = new LinearLayout(this);
        nav.setOrientation(LinearLayout.HORIZONTAL);
        nav.setPadding(dp(8), dp(6), dp(8), dp(8));
        nav.setBackgroundColor(surface);
        ticketsNav = navButton("Tickets");
        mapNav = navButton("Map");
        menuNav = navButton("...");
        ticketsNav.setOnClickListener(view -> showTickets());
        mapNav.setOnClickListener(view -> showMap(null));
        menuNav.setOnClickListener(this::showOverflowMenu);
        nav.addView(ticketsNav);
        nav.addView(mapNav);
        LinearLayout.LayoutParams menuParams = new LinearLayout.LayoutParams(dp(58), dp(48));
        menuParams.setMargins(dp(6), 0, 0, 0);
        nav.addView(menuNav, menuParams);

        root.addView(chrome);
        root.addView(nav);
        root.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));
        root.addView(content);
        setContentView(root);
        showTickets();
        pendingScreen = startupScreen;
        refreshTickets(true);
    }

    private void setDashboardMode(boolean tcwMode) {
        tcwDashboardMode = false;
        AppSettings.saveDashboardMode(this, "main");
        activeTicket = null;
        activeTicketNumber = "";
        if ("map".equals(screen)) showMap(null);
        else showTickets();
    }

    private List<Ticket> visibleTickets() {
        if (snapshot == null) return new ArrayList<>();
        List<Ticket> out = new ArrayList<>();
        for (Ticket ticket : snapshot.tickets) {
            if (!ticketShouldShowOnDashboard(ticket)) continue;
            out.add(ticket);
        }
        return out;
    }

    private Button navButton(String label) {
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setText(label);
        button.setTextSize(15);
        button.setTextColor(muted);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(panel);
        bg.setCornerRadius(dp(6));
        bg.setStroke(dp(1), line);
        button.setBackground(bg);
        button.setLayoutParams(new LinearLayout.LayoutParams(0, dp(48), 1));
        return button;
    }

    private void selectNav(Button selected) {
        ticketsNav.setTextColor(selected == ticketsNav ? accent : muted);
        mapNav.setTextColor(selected == mapNav ? accent : muted);
        menuNav.setTextColor(selected == menuNav ? accent : muted);
        ticketsNav.setTypeface(null, selected == ticketsNav ? 1 : 0);
        mapNav.setTypeface(null, selected == mapNav ? 1 : 0);
        menuNav.setTypeface(null, selected == menuNav ? 1 : 0);
    }

    private boolean canUsePictureInPicture() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
    }

    private boolean shouldUseMapPictureInPicture() {
        return canUsePictureInPicture()
            && "map".equals(screen)
            && activeMapWebView != null
            && !isInPictureInPictureMode();
    }

    private PictureInPictureParams mapPictureInPictureParams() {
        PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
            .setAspectRatio(new Rational(16, 9));
        if (activeMapWebView != null) {
            Rect sourceRect = new Rect();
            if (activeMapWebView.getGlobalVisibleRect(sourceRect)) {
                builder.setSourceRectHint(sourceRect);
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled("map".equals(screen));
            builder.setSeamlessResizeEnabled(true);
        }
        return builder.build();
    }

    private void updateMapPictureInPictureParams() {
        if (!canUsePictureInPicture() || activeMapWebView == null) return;
        setPictureInPictureParams(mapPictureInPictureParams());
    }

    private void enterMapPictureInPicture() {
        if (!shouldUseMapPictureInPicture()) return;
        enterPictureInPictureMode(mapPictureInPictureParams());
    }

    private void applyPictureInPictureChrome(boolean inPictureInPicture) {
        if (chrome != null) chrome.setVisibility(inPictureInPicture || "map".equals(screen) ? View.GONE : View.VISIBLE);
        if (nav != null) nav.setVisibility(inPictureInPicture ? View.GONE : View.VISIBLE);
        if (progress != null && inPictureInPicture) progress.setVisibility(View.GONE);
        if (activeMapWebView != null) {
            activeMapWebView.evaluateJavascript(
                "document.body&&document.body.classList.toggle('pip-mode'," + (inPictureInPicture ? "true" : "false") + ");",
                null
            );
        }
    }

    private void showTickets() {
        screen = "tickets";
        activeTicket = null;
        activeTicketNumber = "";
        activeMapWebView = null;
        pendingScreen = "";
        AppSettings.saveLastView(this, screen, activeTicketNumber);
        chrome.setVisibility(View.VISIBLE);
        if (nav != null) nav.setVisibility(View.VISIBLE);
        title.setText("Tickets");
        List<Ticket> visible = visibleTickets();
        subtitle.setText(snapshot == null ? "Loading live tickets" : visible.size() + " open tickets");
        selectNav(ticketsNav);
        renderTickets();
    }

    private void renderTickets() {
        content.removeAllViews();
        ScrollView scroll = new ScrollView(this);
        LinearLayout list = column(dp(14), dp(12), dp(14), dp(22));
        scroll.addView(list);
        LinearLayout tools = new LinearLayout(this);
        tools.setOrientation(LinearLayout.HORIZONTAL);
        tools.setGravity(Gravity.CENTER_VERTICAL);
        List<Ticket> visible = visibleTickets();
        TextView count = text(snapshot == null ? "Loading app view" : visible.size() + " live tickets", 15, ink, true);
        tools.addView(count, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        Button refresh = secondaryButton("Refresh");
        refresh.setOnClickListener(view -> {
            refresh.setEnabled(false);
            refresh.setText("Updating...");
            progress.setVisibility(View.VISIBLE);
            refreshTickets(true);
        });
        tools.addView(refresh);
        list.addView(tools);
        list.addView(spacer(8));
        if (snapshot == null) {
            list.addView(emptyState("Loading from the cloud dashboard."));
        } else if (visible.isEmpty()) {
            list.addView(emptyState("No open tickets match the published mobile view."));
        } else {
            for (Ticket ticket : visible) list.addView(ticketRow(ticket));
        }
        content.addView(scroll);
    }

    private View ticketRow(Ticket ticket) {
        LinearLayout row = card();
        styleTicketRow(row, ticket);
        row.setOnClickListener(view -> showTicketDetail(ticket));
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.addView(text(ticket.title(), 18, ink, true), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView status = pill(dueStatusLabel(ticketDueStatus(ticket)), ticketStroke(ticket));
        top.addView(status);
        row.addView(top);
        row.addView(text((ticket.county.isEmpty() ? "UNKNOWN" : ticket.county) + (ticket.dueLine().isEmpty() ? "" : " | " + ticket.dueLine()), 13, muted, true));
        String type = first(ticket.workType, ticket.messageType);
        if (!type.isEmpty()) row.addView(text(type, 14, ink, true));
        if (!ticket.workDescription().isEmpty()) row.addView(text(ticket.workDescription(), 13, ink, false));
        if (!ticket.dashboardAddress().isEmpty()) row.addView(text(ticket.dashboardAddress(), 13, muted, false));
        String excavator = first(ticket.contractor, ticket.caller, ticket.doneFor);
        if (!excavator.isEmpty()) row.addView(text(excavator, 12, muted, false));
        return row;
    }

    private void showTicketDetail(Ticket ticket) {
        if (ticket == null) {
            showTickets();
            return;
        }
        screen = "detail";
        activeTicket = ticket;
        activeTicketNumber = ticket.ticketNumber;
        activeMapWebView = null;
        pendingScreen = "";
        AppSettings.saveLastView(this, screen, activeTicketNumber);
        chrome.setVisibility(View.VISIBLE);
        if (nav != null) nav.setVisibility(View.VISIBLE);
        title.setText(ticket.title());
        subtitle.setText(ticket.locationLine());
        selectNav(ticketsNav);
        content.removeAllViews();

        ScrollView scroll = new ScrollView(this);
        LinearLayout page = column(dp(14), dp(12), dp(14), dp(96));
        scroll.addView(page);

        field(page, "Ticket", ticket.title());
        field(page, "Due", ticket.dueLine());
        field(page, "Type", ticket.messageType);
        field(page, "Location", ticket.locationLine());
        field(page, "County / Place", join(ticket.county, ticket.place));
        field(page, "Nearest intersection", ticket.nearestIntersection);
        field(page, "Contractor", ticket.contractor);
        field(page, "Caller", ticket.caller);
        field(page, "Contact", join(ticket.contact, ticket.contactPhone, ticket.contactEmail));
        field(page, "Company phone", ticket.companyPhone);
        field(page, "Work type", ticket.workType);
        field(page, "Done for", ticket.doneFor);
        field(page, "Extent", ticket.extent);
        field(page, "Explosives", ticket.explosives);
        field(page, "White paint", ticket.whitePaint);
        field(page, "Directional boring", ticket.directionalBoring);
        field(page, "Driving directions", ticket.locationInformation);
        if (!ticket.utilitiesNotified.isEmpty()) field(page, "Utilities notified", join(ticket.utilitiesNotified.toArray(new String[0])));
        field(page, "Locator note", ticket.note);
        List<LocatorNote> ticketNotes = locatorNotesForTicket(ticket);
        if (!ticketNotes.isEmpty()) {
            field(page, "Map locator notes", locatorNotesText(ticketNotes));
        }
        field(page, "Raw ticket", ticket.rawText);

        Button navigate = primaryButton("Navigate with Google Maps");
        navigate.setOnClickListener(view -> openNavigation(ticket));
        page.addView(navigate, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        Button dashboard = secondaryButton("See on dashboard map");
        dashboard.setOnClickListener(view -> showMap(ticket));
        page.addView(dashboard, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        Button complete = primaryButton("Complete ticket");
        complete.setOnClickListener(view -> showCompletionForm(ticket));
        page.addView(complete, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        content.addView(scroll);
    }

    private void openNavigation(Ticket ticket) {
        Intent intent = new Intent(Intent.ACTION_VIEW, ticket.googleMapsUri());
        intent.setPackage("com.google.android.apps.maps");
        try {
            startActivity(intent);
        } catch (Exception firstError) {
            try {
                Intent fallback = new Intent(Intent.ACTION_VIEW, ticket.googleMapsUri());
                startActivity(fallback);
            } catch (Exception ignored) {
            }
        }
    }

    private void showMap(Ticket focus) {
        screen = "map";
        activeTicket = focus;
        activeTicketNumber = focus == null ? "" : focus.ticketNumber;
        pendingScreen = "";
        AppSettings.saveLastView(this, screen, activeTicketNumber);
        chrome.setVisibility(View.GONE);
        selectNav(mapNav);
        content.removeAllViews();
        WebView map = new WebView(this);
        activeMapWebView = map;
        configureLocationWebView(map);
        map.setWebViewClient(new MapWebViewClient());
        String cookie = AppSettings.authCookie(this);
        if (!cookie.isEmpty()) CookieManager.getInstance().setCookie(AppSettings.dashboardUrl(this), cookie);
        map.addJavascriptInterface(new MapBridge(), "FiberLocator");
        map.loadDataWithBaseURL(webMapOrigin(), mapHtml(focus), "text/html", "UTF-8", null);
        content.addView(map, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        updateMapPictureInPictureParams();
    }

    private String mapHtml(Ticket focus) {
        String json = ticketsMapJson().toString();
        String notesJson = locatorNotesMapJson().toString();
        String stateJson = snapshot == null ? "{}" : snapshot.state.toString();
        String focusNumber = focus == null ? "" : focus.ticketNumber;
        String cameraJson = savedMapCameraJson();
        return "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            + "<link rel=\"stylesheet\" href=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css\">"
            + "<link rel=\"stylesheet\" href=\"https://api.mapbox.com/mapbox-gl-js/v3.24.0/mapbox-gl.css\">"
            + "<style>:root{--vetro-scale:1}html,body,#map{height:100%;margin:0;background:#eef2f5}.leaflet-container{font-family:sans-serif}.pip-toggle{position:fixed;z-index:1002;left:10px;top:10px;width:44px;height:44px;border:0;border-radius:10px;background:#0f172a;color:#f8fafc;font:900 18px sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.25)}.locate{position:fixed;z-index:1000;right:10px;top:10px;border:0;border-radius:8px;background:#0f172a;color:#f8fafc;padding:10px 12px;font:700 14px sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.25)}.locate.active{background:#0369a1}.locate.error{background:#991b1b}.add-note{position:fixed;z-index:1000;right:10px;top:58px;border:0;border-radius:8px;background:#334155;color:#f8fafc;padding:10px 12px;font:700 14px sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.25)}.add-note.active{background:#15803d}.satellite-toggle{position:fixed;z-index:1000;left:10px;top:75%;transform:translateY(-50%);border:0;border-radius:9px;background:#0f172a;color:#f8fafc;padding:11px 12px;font:800 13px sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.28)}.satellite-toggle.active{background:#166534}.measure{position:fixed;z-index:1000;left:10px;bottom:12px;display:flex;gap:8px;align-items:center;background:rgba(15,23,42,.84);color:#f8fafc;border-radius:10px;padding:8px;box-shadow:0 6px 18px rgba(15,23,42,.25)}body.pip-mode .measure{display:none}.measure button{border:0;border-radius:8px;background:#334155;color:#f8fafc;padding:9px 10px;font:700 13px sans-serif}.measure button.active{background:#15803d}.measure span{min-width:82px;font:700 13px sans-serif}.measure-dot{width:12px;height:12px;border-radius:50%;background:#facc15;border:2px solid #111827}.note-flag{width:20px;height:20px;background:var(--c);opacity:var(--o,.42);border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(15,23,42,.42)}.note-popup strong{display:block;color:#0f172a}.note-popup small{display:block;color:#64748b;margin-top:2px}.note-popup p{white-space:pre-wrap;margin:.45rem 0 0;color:#0f172a}.user-dot{width:18px;height:18px;border-radius:50%;background:#38bdf8;border:3px solid #fff;box-shadow:0 0 0 10px rgba(56,189,248,.22),0 2px 10px rgba(15,23,42,.35)}.mwrap{position:relative;width:var(--s);height:var(--s)}.m{position:absolute;left:0;top:0;width:100%;height:100%;background:var(--c);border:2px solid var(--b);opacity:calc(var(--vetro-scale) * var(--o))}.circle{border-radius:50%}.square{}.diamond{transform:rotate(45deg)}.pin{border-radius:50% 50% 50% 0;transform:rotate(-45deg)}.house{clip-path:polygon(50% 0,100% 42%,100% 100%,0 100%,0 42%)}</style></head>"
            + "<body><div id=\"map\"></div><div id=\"map3d\" style=\"position:fixed;inset:0;display:none;background:#111827;z-index:900\"></div><button id=\"pipToggle\" class=\"pip-toggle\" type=\"button\" title=\"Shrink map\">&#8600;&#8598;</button><button id=\"locateMe\" class=\"locate\" type=\"button\">Location off</button><button id=\"addNote\" class=\"add-note\" type=\"button\">Add note</button><button id=\"satelliteToggle\" class=\"satellite-toggle\" type=\"button\">Satellite</button><button id=\"toggle3d\" type=\"button\" style=\"position:fixed;z-index:1001;right:10px;top:106px;border:0;border-radius:8px;background:#0f172a;color:#f8fafc;padding:10px 12px;font:800 14px sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.25)\">3D</button><button id=\"style3d\" type=\"button\" style=\"position:fixed;z-index:1001;right:10px;top:154px;display:none;border:0;border-radius:8px;background:#0f172a;color:#f8fafc;padding:10px 12px;font:800 13px sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.25)\">Streets</button><div id=\"tiltTools\" style=\"position:fixed;z-index:1001;right:10px;top:202px;display:none;gap:7px;flex-direction:column\"><button id=\"tiltUp\" type=\"button\" style=\"border:0;border-radius:8px;background:#334155;color:#f8fafc;padding:10px;font:800 13px sans-serif\">Tilt +</button><button id=\"tiltDown\" type=\"button\" style=\"border:0;border-radius:8px;background:#334155;color:#f8fafc;padding:10px;font:800 13px sans-serif\">Tilt -</button><button id=\"rotate3d\" type=\"button\" style=\"border:0;border-radius:8px;background:#334155;color:#f8fafc;padding:10px;font:800 13px sans-serif\">Rotate</button></div><div class=\"measure\"><button id=\"measureToggle\" type=\"button\">Measure</button><button id=\"measureClear\" type=\"button\">Clear</button><span id=\"measureStatus\">0 ft</span></div><script src=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js\"></script><script src=\"https://api.mapbox.com/mapbox-gl-js/v3.24.0/mapbox-gl.js\"></script><script>"
            + "const tickets=" + json + ";const locatorNotes=" + notesJson + ";const state=" + stateJson + ";const focus=" + JSONObject.quote(focusNumber) + ";const savedCamera=" + cameraJson + ";"
            + "let vetroOpacityScale=1;let vetroLayers=[];let locationWatch=null;let userMarker=null;let accuracyCircle=null;let measuring=false;let addingNote=false;let measurePoints=[];let measureLayer=L.layerGroup();let baseLayer=null;let currentBaseKey='';let map3d=null;let using3d=false;let saved3dLoaded=false;let map3dStyle=String(savedCamera.mode||'').includes('satellite')?'satellite':'standard';"
            + "const map=L.map('map',{zoomControl:false,preferCanvas:true}).setView([33.23,-92.67],12);"
            + "function saveLeafletCamera(){try{const c=map.getCenter();FiberLocator.saveMapCamera(c.lat,c.lng,map.getZoom(),0,0,using3d?'3d':'leaflet');}catch(e){}}"
            + "let cameraTimer=null;function scheduleCameraSave(){if(cameraTimer)clearTimeout(cameraTimer);cameraTimer=setTimeout(saveLeafletCamera,350);}"
            + "map.on('moveend zoomend',scheduleCameraSave);"
            + "const TILE_STYLES={standard:{url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',subdomains:'abc',maxZoom:20},contrast:{url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20},detailed:{url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',maxZoom:20},light:{url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20},dark:{url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20},terrain:{url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',subdomains:'abc',maxZoom:17},satellite:{url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maxZoom:20},hybrid:{layers:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}','https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}','https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],maxZoom:20},'mapbox-streets':{provider:'mapbox',styleId:'streets-v12'},'mapbox-outdoors':{provider:'mapbox',styleId:'outdoors-v12'},'mapbox-light':{provider:'mapbox',styleId:'light-v11'},'mapbox-dark':{provider:'mapbox',styleId:'dark-v11'},'mapbox-satellite':{provider:'mapbox',styleId:'satellite-v9'},'mapbox-satellite-streets':{provider:'mapbox',styleId:'satellite-streets-v12'},'mapbox-navigation-day':{provider:'mapbox',styleId:'navigation-day-v1'},'mapbox-navigation-night':{provider:'mapbox',styleId:'navigation-night-v1'}};"
            + "function savedBase(){const s=String(state.baseMapStyle||state.baseMap||state.mapStyle||'standard');return TILE_STYLES[s]?s:'standard';}"
            + "function back(l){try{if(l&&l.bringToBack)l.bringToBack();else if(l&&l.eachLayer)l.eachLayer(x=>x.bringToBack&&x.bringToBack());}catch(e){}}"
            + "async function setBase(key){const tile=TILE_STYLES[key]||TILE_STYLES.standard;try{let layer;if(tile.provider==='mapbox'){const r=await fetch('/api/map-config',{credentials:'include'});const c=r.ok?await r.json():{};const token=String(c.mapboxAccessToken||'');if(!token)throw new Error('missing mapbox token');layer=L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/${tile.styleId}/tiles/512/{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`,{maxZoom:22,tileSize:512,zoomOffset:-1,attribution:''});}else if(Array.isArray(tile.layers)){layer=L.layerGroup(tile.layers.map(u=>L.tileLayer(u,{maxZoom:tile.maxZoom||20,attribution:''})));}else{layer=L.tileLayer(tile.url,{maxZoom:tile.maxZoom||20,subdomains:tile.subdomains||'abc',attribution:''});}if(baseLayer)map.removeLayer(baseLayer);layer.addTo(map);baseLayer=layer;currentBaseKey=key;document.getElementById('satelliteToggle').classList.toggle('active',key==='mapbox-satellite-streets');back(layer);}catch(e){if(key!=='standard')return setBase('standard');}}"
            + "setBase(savedBase());document.getElementById('satelliteToggle').addEventListener('click',()=>setBase(currentBaseKey==='mapbox-satellite-streets'?savedBase():'mapbox-satellite-streets'));"
            + "document.getElementById('pipToggle').addEventListener('click',()=>{try{FiberLocator.enterPictureInPicture();}catch(e){}});"
            + "function prop(p,...n){p=p||{};for(const k of n){if(p[k]!=null&&p[k]!== '')return String(p[k]);}const l={};Object.keys(p).forEach(k=>l[k.toLowerCase()]=p[k]);for(const k of n){const v=l[k.toLowerCase()];if(v!=null&&v!=='')return String(v);}return '';}"
            + "function featureId(f){return prop(f.properties,'ID','feature_id','Name','name','vetro_id');}"
            + "function isSlFeature(f){return prop(f.properties,'layer_id','Layer_ID')==='26'&&featureId(f).toUpperCase().startsWith('SL-');}"
            + "function slLabel(f){return prop(f.properties,'ID','feature_id')||'SL';}"
            + "function vetroId(f){return isSlFeature(f)?'prefix:SL':prop(f.properties,'layer_id','Layer_ID');}"
            + "function vitId(f){return prop(f.properties,'vitruvi_layer','vitruvi_layer_label','category_name','geojson_layer','Category','category')||'Vitruvi';}"
            + "function hex(v){return /^#[0-9a-f]{6}$/i.test(String(v||''));}"
            + "function color(kind,id,fallback){const o=(kind==='vetro'?state.vetroLayerColorOverrides:state.vitruviLayerColorOverrides)||{};return hex(o[String(id)])?o[String(id)]:fallback;}"
            + "function num(obj,id,fallback,min,max){const n=Number((obj||{})[String(id)]);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}"
            + "function styleName(kind,id,geom){const o=((kind==='vetro'?state.vetroLayerStyleOverrides:state.vitruviLayerStyleOverrides)||{})[String(id)];return o||((geom||'').startsWith('Line')?'solid':'circle');}"
            + "function icon(shape,c,size,opacity){return L.divIcon({className:'',iconSize:[size,size],iconAnchor:[size/2,size/2],html:`<div class=\"mwrap\" style=\"--s:${size}px;--c:${c};--b:#111827;--o:${opacity}\"><div class=\"m ${shape}\"></div></div>`});}"
            + "function applyVetroOpacity(){vetroLayers.forEach(l=>{const base=Number(l.options&&l.options.baseOpacity)||1;const op=Math.max(0,Math.min(1,base*vetroOpacityScale));if(l.setStyle)l.setStyle({opacity:op,fillOpacity:op*.32});if(l.eachLayer)l.eachLayer(x=>{if(x.setStyle)x.setStyle({opacity:op,fillOpacity:op*.32});});});}"
            + "function pass(list,val){return !Array.isArray(list)||!list.length||list.includes(String(val||''));}"
            + "function vetroPass(x){const p=x.properties||{};return pass(state.vetroLayerFilterSelected,vetroId(x))&&pass(state.vetroPlanFilterSelected,prop(p,'plan'))&&pass(state.vetroBuildFilterSelected,prop(p,'build','Build'))&&pass(state.vetroPlacementFilterSelected,prop(p,'placement','Placement'))&&pass(state.vetroStatusFilterSelected,prop(p,'status_id'))&&pass(state.vetroGeometryFilterSelected,x.geometry&&x.geometry.type)&&pass(state.vetroFiberFilterSelected,prop(p,'Fiber_Capacity','Fiber Capacity'))&&pass(state.vetroRouteFilterSelected,prop(p,'Bore_Plow','Bore Plow'))&&pass(state.vetroPointFilterSelected,prop(p,'HH_Size','Size'));}"
            + "function vitPass(x){return pass(state.vitruviLayerFilterSelected,vitId(x));}"
            + "measureLayer.addTo(map);function fmtMeasure(m){const ft=m*3.28084;if(ft<5280)return Math.round(ft).toLocaleString()+' ft';return (ft/5280).toFixed(2)+' mi';}"
            + "function redrawMeasure(){measureLayer.clearLayers();let total=0;for(let i=0;i<measurePoints.length;i++){L.marker(measurePoints[i],{icon:L.divIcon({className:'',iconSize:[16,16],iconAnchor:[8,8],html:'<div class=\"measure-dot\"></div>'})}).addTo(measureLayer);if(i>0){total+=measurePoints[i-1].distanceTo(measurePoints[i]);}}if(measurePoints.length>1)L.polyline(measurePoints,{color:'#facc15',weight:4,opacity:.95}).addTo(measureLayer);document.getElementById('measureStatus').textContent=fmtMeasure(total);}"
            + "function addMeasurePoint(ll){measurePoints.push(ll);redrawMeasure();}"
            + "document.getElementById('measureToggle').addEventListener('click',()=>{measuring=!measuring;document.getElementById('measureToggle').classList.toggle('active',measuring);});"
            + "document.getElementById('measureClear').addEventListener('click',()=>{measurePoints=[];redrawMeasure();});"
            + "function setAddingNote(v){addingNote=!!v;document.getElementById('addNote').classList.toggle('active',addingNote);document.getElementById('addNote').textContent=addingNote?'Tap map':'Add note';if(addingNote){measuring=false;document.getElementById('measureToggle').classList.remove('active');}}"
            + "document.getElementById('addNote').addEventListener('click',()=>setAddingNote(!addingNote));"
            + "function addMapNote(ll){setAddingNote(false);FiberLocator.addLocatorNoteForMap(ll.lat,ll.lng);}"
            + "function addTicketNote(t,ll){setAddingNote(false);FiberLocator.addLocatorNoteForTicket(ll.lat,ll.lng,t.id);}"
            + "function addFeatureNote(kind,f,ll){const p=f.properties||{};const lid=kind==='vetro'?vetroId(f):vitId(f);const fid=prop(p,'ID','feature_id','vetro_id','vitruvi_id','id','uid');const label=kind==='vetro'?(prop(p,'Street_Address','street_address','Name','name','feature_id','ID')||lid):(prop(p,'label','name','Name','full_address','Address','feature_id')||lid);setAddingNote(false);FiberLocator.addLocatorNoteForFeature(ll.lat,ll.lng,kind,label,fid,lid,fid);}"
            + "map.on('click',e=>{if(addingNote){addMapNote(e.latlng);return;}if(measuring)addMeasurePoint(e.latlng);});"
            + "const bounds=[];tickets.forEach(t=>{const color=t.color||'#00695c';"
            + "if(t.polygon){const p=L.geoJSON(t.polygon,{style:{color,weight:t.id===focus?5:3,fillColor:color,fillOpacity:.11}}).addTo(map);p.on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);if(addingNote){addTicketNote(t,e.latlng);return;}if(measuring){addMeasurePoint(e.latlng);return;}stopLocation();FiberLocator.openTicket(t.id);});try{bounds.push(p.getBounds())}catch(e){}}"
            + "if(t.lat&&t.lon){const m=L.circleMarker([t.lat,t.lon],{radius:6,color,fillColor:color,fillOpacity:.9}).addTo(map);m.on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);if(addingNote){addTicketNote(t,e.latlng);return;}if(measuring){addMeasurePoint(e.latlng);return;}stopLocation();FiberLocator.openTicket(t.id);});bounds.push(L.latLng(t.lat,t.lon));}});"
            + "function esc(s){return String(s||'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));}"
            + "function noteColor(c){return {instruction:'#2563eb',layer_issue:'#9333ea',locate_issue:'#dc2626',needs_attention:'#f59e0b',restoration:'#16a34a',other:'#475569'}[String(c||'')]||'#2563eb';}"
            + "function noteLabel(c){return {instruction:'Instruction',layer_issue:'Layer issue',locate_issue:'Locate issue',needs_attention:'Needs attention',restoration:'Restoration',other:'Other note'}[String(c||'')]||'Instruction';}"
            + "function noteOpacity(n){const lid=String(n.layerId||'');if(n.targetType==='vetro'&&lid)return Math.max(.035,Math.min(.12,num(state.vetroLayerOpacityOverrides,lid,Number(state.vetroOpacity)||.72,0,1)*.18));if(n.targetType==='vitruvi'&&lid)return Math.max(.035,Math.min(.12,num(state.vitruviLayerOpacityOverrides,lid,.82,0,1)*.18));return .08;}"
            + "locatorNotes.forEach(n=>{if(!n.lat||!n.lon)return;const color=noteColor(n.category);const marker=L.marker([n.lat,n.lon],{zIndexOffset:9000,icon:L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,22],popupAnchor:[0,-18],html:`<div class=\"note-flag\" style=\"--c:${color};--o:${noteOpacity(n)}\"></div>`})}).addTo(map);marker.bindPopup(`<div class=\"note-popup\"><strong>${esc(noteLabel(n.category))}</strong><small>${esc(n.target||'Map note')}</small>${n.text?`<p>${esc(n.text)}</p>`:''}<small>${esc([n.createdBy,n.createdAt].filter(Boolean).join(' - '))}</small></div>`);bounds.push(L.latLng(n.lat,n.lon));});"
            + "async function layer(url,kind){try{const r=await fetch(url,{credentials:'include'});if(!r.ok)return;const g=await r.json();let f=Array.isArray(g.features)?g.features:[];"
            + "if(kind==='vetro'){if(state.vetroVisible===false)return;f=f.filter(vetroPass);}if(kind==='vitruvi'){if(state.vitruviVisible!==true)return;f=f.filter(vitPass);}"
            + "const group=L.geoJSON({type:'FeatureCollection',features:f},{style:x=>{const id=kind==='vetro'?vetroId(x):vitId(x);const geom=x.geometry&&String(x.geometry.type)||'';const c=color(kind,id,kind==='vetro'?(state.vetroColor||'#2563eb'):'#f97316');const raw=num(kind==='vetro'?state.vetroLayerOpacityOverrides:state.vitruviLayerOpacityOverrides,id,kind==='vetro'?(Number(state.vetroOpacity)||.72):.82,0,1);const op=kind==='vetro'?raw*vetroOpacityScale:raw;const sz=num(kind==='vetro'?state.vetroLayerSizeOverrides:state.vitruviLayerSizeOverrides,id,kind==='vetro'?3:3,1,18);const st={color:c,fillColor:c,weight:geom.startsWith('Line')?sz:1,opacity:op,fillOpacity:op*.32,radius:sz,baseOpacity:raw};const sn=styleName(kind,id,geom);if(geom.startsWith('Line')){st.fillOpacity=0;if(sn==='dashed')st.dashArray='8 6';if(sn==='dotted')st.dashArray='2 6';}return st;},pointToLayer:(x,ll)=>{const id=kind==='vetro'?vetroId(x):vitId(x);const c=color(kind,id,kind==='vetro'?(state.vetroColor||'#2563eb'):'#f97316');const raw=num(kind==='vetro'?state.vetroLayerOpacityOverrides:state.vitruviLayerOpacityOverrides,id,kind==='vetro'?(Number(state.vetroOpacity)||.72):.82,0,1);const op=kind==='vetro'?raw*vetroOpacityScale:raw;const sz=num(kind==='vetro'?state.vetroLayerSizeOverrides:state.vitruviLayerSizeOverrides,id,8,4,28);const marker=L.marker(ll,{icon:icon(styleName(kind,id,'Point'),c,sz*2,op)});marker.options.baseOpacity=raw;return marker;},onEachFeature:(x,l)=>{l.on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);if(addingNote){addFeatureNote(kind,x,e.latlng);return;}if(measuring){addMeasurePoint(e.latlng);}});}}).addTo(map);if(kind==='vetro'){vetroLayers.push(group);applyVetroOpacity();}}catch(e){}}"
            + "layer('/api/vetro','vetro');layer('/api/vitruvi','vitruvi');"
            + "function ticketFeatureCollection(kind){const features=[];tickets.forEach(t=>{if(kind==='polygon'&&t.polygon){const g=t.polygon.type==='Feature'?t.polygon.geometry:t.polygon;features.push({type:'Feature',properties:{id:t.id,color:t.color||'#00695c'},geometry:g});}if(kind==='point'&&t.lat&&t.lon){features.push({type:'Feature',properties:{id:t.id,color:t.color||'#00695c'},geometry:{type:'Point',coordinates:[t.lon,t.lat]}});}});return {type:'FeatureCollection',features};}"
            + "function noteFeatureCollection(){return {type:'FeatureCollection',features:locatorNotes.filter(n=>n.lat&&n.lon).map(n=>({type:'Feature',properties:{id:n.id,color:noteColor(n.category),text:n.text||'',target:n.target||'Map note'},geometry:{type:'Point',coordinates:[n.lon,n.lat]}}))};}"
            + "function normHex(v,f){v=String(v||'').trim();if(!v)return f;if(!v.startsWith('#'))v='#'+v;return /^#[0-9a-f]{6}$/i.test(v)?v.toLowerCase():f;}"
            + "function shapeIconName(kind,shape,color,outline){shape=String(shape||'circle');shape=['square','diamond','pin','house'].includes(shape)?shape:'circle';color=normHex(color,'#2563eb').slice(1);outline=normHex(outline,'#ffffff').slice(1);return `${kind}-${shape}-${color}-${outline}`;}"
            + "function makeShapeIcon(shape,color,outline){const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.translate(32,32);x.fillStyle=normHex(color,'#2563eb');x.strokeStyle=normHex(outline,'#ffffff');x.lineWidth=5;x.shadowColor='rgba(15,23,42,.35)';x.shadowBlur=5;if(shape==='square')x.rect(-18,-18,36,36);else if(shape==='diamond'){x.rotate(Math.PI/4);x.rect(-17,-17,34,34);}else if(shape==='pin'){x.rotate(-Math.PI/4);x.beginPath();x.arc(0,0,18,0,Math.PI*2);x.lineTo(18,18);x.closePath();}else if(shape==='house'){x.beginPath();x.moveTo(0,-22);x.lineTo(22,-3);x.lineTo(22,22);x.lineTo(-22,22);x.lineTo(-22,-3);x.closePath();}else{x.beginPath();x.arc(0,0,19,0,Math.PI*2);}x.fill();x.stroke();try{return x.getImageData(0,0,c.width,c.height);}catch(e){return c;}}"
            + "function add3dShapeImages(data){(data&&data.features||[]).forEach(f=>{const p=f.properties||{};const icon=p._icon;if(!icon||map3d.hasImage(icon))return;try{map3d.addImage(icon,makeShapeIcon(p._style,p._color,p._outline),{pixelRatio:2});}catch(e){console.log('3d icon failed',icon,e&&e.message);}});}"
            + "function styleFeature(kind,f){const id=kind==='vetro'?vetroId(f):vitId(f);const geom=f.geometry&&String(f.geometry.type)||'';const sl=kind==='vetro'&&isSlFeature(f);const fallback=kind==='vetro'?(state.vetroColor||'#2563eb'):'#f97316';const raw=sl?num(null,null,Number(state.vetroSlOpacity)||1,0,1):num(kind==='vetro'?state.vetroLayerOpacityOverrides:state.vitruviLayerOpacityOverrides,id,kind==='vetro'?(Number(state.vetroOpacity)||.72):.82,0,1);const size=sl?num(null,null,Number(state.vetroSlSize)||13,4,28):num(kind==='vetro'?state.vetroLayerSizeOverrides:state.vitruviLayerSizeOverrides,id,geom.startsWith('Line')?3:8,1,28);const style=sl?String(state.vetroSlShape||'diamond'):styleName(kind,id,geom);const c=sl?normHex(state.vetroSlColor,'#e7298a'):color(kind,id,fallback);const outline=sl?normHex(state.vetroSlOutlineColor,'#111827'):'#ffffff';const label=sl&&state.vetroSlLabels?slLabel(f):'';return {...f,properties:{...(f.properties||{}),_layerId:id,_color:c,_outline:outline,_opacity:kind==='vetro'?raw*vetroOpacityScale:raw,_size:size,_style:style,_icon:shapeIconName(kind,style,c,outline),_label:label}};}"
            + "function styledCollection(kind,g){let f=Array.isArray(g&&g.features)?g.features:[];if(kind==='vetro'){if(state.vetroVisible===false)f=[];else f=f.filter(vetroPass);}if(kind==='vitruvi'){if(state.vitruviVisible!==true)f=[];else f=f.filter(vitPass);}return {type:'FeatureCollection',features:f.map(x=>styleFeature(kind,x))};}"
            + "function addLayerSafe(spec){try{if(!map3d.getLayer(spec.id))map3d.addLayer(spec);}catch(e){console.log('3d layer failed',spec&&spec.id,e&&e.message);}}"
            + "function addSourceSafe(id,spec){try{if(map3d.getSource(id))map3d.getSource(id).setData(spec.data);else map3d.addSource(id,spec);return true;}catch(e){console.log('3d source failed',id,e&&e.message);return false;}}"
            + "function lineFilter(style){return ['all',['any',['==',['geometry-type'],'LineString'],['==',['geometry-type'],'MultiLineString']],style==='solid'?['all',['!=',['get','_style'],'dashed'],['!=',['get','_style'],'dotted']]:['==',['get','_style'],style]];}"
            + "function addStyled3dSource(kind,g){const source=`${kind}-3d`;const data=styledCollection(kind,g);add3dShapeImages(data);if(!addSourceSafe(source,{type:'geojson',data}))return;addLayerSafe({id:`${kind}-3d-fill`,type:'fill',source,filter:['any',['==',['geometry-type'],'Polygon'],['==',['geometry-type'],'MultiPolygon']],paint:{'fill-color':['coalesce',['get','_color'],'#2563eb'],'fill-opacity':['*',['coalesce',['to-number',['get','_opacity']],0.72],0.32]}});addLayerSafe({id:`${kind}-3d-line-solid`,type:'line',source,filter:lineFilter('solid'),paint:{'line-color':['coalesce',['get','_color'],'#2563eb'],'line-width':['coalesce',['to-number',['get','_size']],3],'line-opacity':['coalesce',['to-number',['get','_opacity']],0.72]}});addLayerSafe({id:`${kind}-3d-line-dashed`,type:'line',source,filter:lineFilter('dashed'),paint:{'line-color':['coalesce',['get','_color'],'#2563eb'],'line-width':['coalesce',['to-number',['get','_size']],3],'line-opacity':['coalesce',['to-number',['get','_opacity']],0.72],'line-dasharray':[2,1.5]}});addLayerSafe({id:`${kind}-3d-line-dotted`,type:'line',source,filter:lineFilter('dotted'),paint:{'line-color':['coalesce',['get','_color'],'#2563eb'],'line-width':['coalesce',['to-number',['get','_size']],3],'line-opacity':['coalesce',['to-number',['get','_opacity']],0.72],'line-dasharray':[0.4,1.6]}});addLayerSafe({id:`${kind}-3d-point-symbol`,type:'symbol',source,filter:['any',['==',['geometry-type'],'Point'],['==',['geometry-type'],'MultiPoint']],layout:{'icon-image':['get','_icon'],'icon-size':['interpolate',['linear'],['coalesce',['to-number',['get','_size']],12],4,0.42,13,0.72,28,1.2],'icon-allow-overlap':true,'icon-ignore-placement':true},paint:{'icon-opacity':['coalesce',['to-number',['get','_opacity']],0.72]}});addLayerSafe({id:`${kind}-3d-point-label`,type:'symbol',source,filter:['all',['any',['==',['geometry-type'],'Point'],['==',['geometry-type'],'MultiPoint']],['!=',['get','_label'],'']],layout:{'text-field':['get','_label'],'text-size':12,'text-offset':[0,1.25],'text-anchor':'top','text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#111827','text-halo-color':'#ffffff','text-halo-width':1.4,'text-opacity':['coalesce',['to-number',['get','_opacity']],0.85]}});}"
            + "function add3dLocationLayers(){if(!map3d.getSource('user-3d'))map3d.addSource('user-3d',{type:'geojson',data:{type:'FeatureCollection',features:[]}});addLayerSafe({id:'user-3d-accuracy',type:'circle',source:'user-3d',paint:{'circle-color':'#38bdf8','circle-radius':['interpolate',['linear'],['zoom'],10,10,16,34,20,90],'circle-opacity':0.16,'circle-stroke-color':'#0284c7','circle-stroke-width':1,'circle-stroke-opacity':0.45}});addLayerSafe({id:'user-3d-dot',type:'circle',source:'user-3d',paint:{'circle-color':'#38bdf8','circle-radius':9,'circle-stroke-color':'#ffffff','circle-stroke-width':3}});}"
            + "function set3dLocation(lat,lon,acc){if(!map3d||!map3d.getSource('user-3d'))return;map3d.getSource('user-3d').setData({type:'FeatureCollection',features:[{type:'Feature',properties:{accuracy:acc||0},geometry:{type:'Point',coordinates:[lon,lat]}}]});}"
            + "function add3dGeoJsonLayers(){if(!map3d)return;try{add3dShapeImages();}catch(e){console.log('3d image setup failed',e&&e.message);}addSourceSafe('tickets-poly',{type:'geojson',data:ticketFeatureCollection('polygon')});addLayerSafe({id:'tickets-poly-fill',type:'fill',source:'tickets-poly',paint:{'fill-color':['coalesce',['get','color'],'#00695c'],'fill-opacity':0.18}});addLayerSafe({id:'tickets-poly-line',type:'line',source:'tickets-poly',paint:{'line-color':['coalesce',['get','color'],'#00695c'],'line-width':3}});addSourceSafe('tickets-point',{type:'geojson',data:ticketFeatureCollection('point')});addLayerSafe({id:'tickets-point-dot',type:'circle',source:'tickets-point',paint:{'circle-color':['coalesce',['get','color'],'#00695c'],'circle-radius':7,'circle-stroke-color':'#ffffff','circle-stroke-width':2}});addSourceSafe('notes',{type:'geojson',data:noteFeatureCollection()});addLayerSafe({id:'notes-dot',type:'circle',source:'notes',paint:{'circle-color':['coalesce',['get','color'],'#2563eb'],'circle-radius':6,'circle-opacity':0.55,'circle-stroke-color':'#ffffff','circle-stroke-width':1}});add3dLocationLayers();['tickets-poly-fill','tickets-point-dot'].forEach(id=>{if(map3d.getLayer(id))map3d.on('click',id,e=>{const f=e.features&&e.features[0];if(f&&f.properties&&f.properties.id)FiberLocator.openTicket(String(f.properties.id));});});if(!map3d.getSource('vetro-3d'))fetch('/api/vetro',{credentials:'include'}).then(r=>r.ok?r.json():null).then(g=>{if(g)try{addStyled3dSource('vetro',g);}catch(e){console.log('vetro 3d add failed',e&&e.message);}}).catch(e=>console.log('vetro 3d fetch failed',e&&e.message));if(!map3d.getSource('vitruvi-3d'))fetch('/api/vitruvi',{credentials:'include'}).then(r=>r.ok?r.json():null).then(g=>{if(g)try{addStyled3dSource('vitruvi',g);}catch(e){console.log('vitruvi 3d add failed',e&&e.message);}}).catch(e=>console.log('vitruvi 3d fetch failed',e&&e.message));saved3dLoaded=!!(map3d.getSource('tickets-poly')&&map3d.getSource('tickets-point')&&map3d.getSource('notes')&&map3d.getLayer('tickets-poly-line')&&map3d.getLayer('tickets-point-dot')&&map3d.getSource('vetro-3d')&&map3d.getSource('vitruvi-3d'));}"
            + "function add3dBuildings(){if(!map3d||map3d.getLayer('map3d-buildings')||!map3d.getSource('composite'))return;const layers=map3d.getStyle().layers||[];const label=layers.find(l=>l.type==='symbol'&&l.layout&&l.layout['text-field']);try{map3d.addLayer({id:'map3d-buildings',source:'composite','source-layer':'building',filter:['==','extrude','true'],type:'fill-extrusion',minzoom:14,paint:{'fill-extrusion-color':'#c9d2dc','fill-extrusion-height':['interpolate',['linear'],['zoom'],14,0,16,['coalesce',['get','height'],12]],'fill-extrusion-base':['interpolate',['linear'],['zoom'],14,0,16,['coalesce',['get','min_height'],0]],'fill-extrusion-opacity':0.72}},label&&label.id);}catch(e){console.log('3d buildings failed',e&&e.message);}}"
            + "function prepare3dLayers(){if(!map3d)return;try{if(!map3d.getSource('mapbox-dem'))map3d.addSource('mapbox-dem',{type:'raster-dem',url:'mapbox://mapbox.mapbox-terrain-dem-v1',tileSize:512,maxzoom:14});map3d.setTerrain({source:'mapbox-dem',exaggeration:1.4});}catch(e){console.log('3d terrain failed',e&&e.message);}add3dBuildings();try{add3dGeoJsonLayers();}catch(e){console.log('3d overlay setup failed',e&&e.message);saved3dLoaded=false;}}"
            + "function schedule3dLayers(){if(!map3d)return;saved3dLoaded=false;let attempts=0;function tick(){prepare3dLayers();attempts++;if(!saved3dLoaded&&attempts<45)setTimeout(tick,1000);}tick();setTimeout(tick,250);setTimeout(tick,1200);setTimeout(tick,5000);}"
            + "function style3dUrl(){return map3dStyle==='satellite'?'mapbox://styles/mapbox/satellite-streets-v12':'mapbox://styles/mapbox/streets-v12';}"
            + "function update3dStyleButton(){const b=document.getElementById('style3d');b.textContent=map3dStyle==='satellite'?'Street 3D':'Satellite 3D';}"
            + "function save3dCamera(){try{const c=map3d.getCenter();FiberLocator.saveMapCamera(c.lat,c.lng,map3d.getZoom(),map3d.getBearing(),map3d.getPitch(),`3d-${map3dStyle}`);}catch(e){}}"
            + "function apply3dStyle(){if(!map3d)return;saved3dLoaded=false;map3d.setStyle(style3dUrl());update3dStyleButton();schedule3dLayers();}"
            + "async function ensure3d(){if(map3d)return true;const status=document.getElementById('toggle3d');status.textContent='3D...';try{const r=await fetch('/api/map-config',{credentials:'include'});const c=r.ok?await r.json():{};const token=String(c.mapboxAccessToken||'');if(!token)throw new Error('Mapbox token missing');mapboxgl.accessToken=token;const center=map.getCenter();map3d=new mapboxgl.Map({container:'map3d',style:style3dUrl(),center:[center.lng,center.lat],zoom:Math.max(map.getZoom(),14),pitch:Math.max(Number(savedCamera.pitch)||0,68),bearing:Number(savedCamera.bearing)||0,antialias:true});map3d.on('load',schedule3dLayers);map3d.on('style.load',schedule3dLayers);map3d.on('styledata',schedule3dLayers);map3d.on('idle',schedule3dLayers);schedule3dLayers();map3d.on('moveend',save3dCamera);map3d.on('pitchend',save3dCamera);map3d.on('rotateend',save3dCamera);status.textContent='2D';update3dStyleButton();return true;}catch(e){status.textContent='No 3D';setTimeout(()=>status.textContent='3D',1800);return false;}}"
            + "async function toggle3d(){if(using3d){using3d=false;document.getElementById('map').style.display='block';document.getElementById('map3d').style.display='none';document.getElementById('tiltTools').style.display='none';document.getElementById('style3d').style.display='none';document.getElementById('toggle3d').textContent='3D';saveLeafletCamera();return;}if(await ensure3d()){using3d=true;const c=map.getCenter();map3d.jumpTo({center:[c.lng,c.lat],zoom:Math.max(map.getZoom(),14),pitch:Math.max(map3d.getPitch(),60)});document.getElementById('map').style.display='none';document.getElementById('map3d').style.display='block';document.getElementById('tiltTools').style.display='flex';document.getElementById('style3d').style.display='block';document.getElementById('toggle3d').textContent='2D';map3d.resize();save3dCamera();}}"
            + "document.getElementById('toggle3d').addEventListener('click',toggle3d);document.getElementById('style3d').addEventListener('click',()=>{map3dStyle=map3dStyle==='satellite'?'standard':'satellite';apply3dStyle();save3dCamera();});document.getElementById('tiltUp').addEventListener('click',()=>{if(map3d)map3d.easeTo({pitch:Math.min(80,map3d.getPitch()+10),duration:250});});document.getElementById('tiltDown').addEventListener('click',()=>{if(map3d)map3d.easeTo({pitch:Math.max(0,map3d.getPitch()-10),duration:250});});document.getElementById('rotate3d').addEventListener('click',()=>{if(map3d)map3d.easeTo({bearing:map3d.getBearing()+45,duration:350});});"
            + "function setLocate(text,cls){const b=document.getElementById('locateMe');b.textContent=text;b.className='locate '+(cls||'');}"
            + "function updateLocation(pos){const lat=pos.coords.latitude,lon=pos.coords.longitude,acc=pos.coords.accuracy||0;const ll=[lat,lon];if(!userMarker){userMarker=L.marker(ll,{zIndexOffset:10000,icon:L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,12],html:'<div class=\"user-dot\"></div>'})}).addTo(map);accuracyCircle=L.circle(ll,{radius:acc,color:'#0284c7',weight:1,fillColor:'#38bdf8',fillOpacity:.14,opacity:.5}).addTo(map);map.setView(ll,17);}else{userMarker.setLatLng(ll);accuracyCircle.setLatLng(ll).setRadius(acc);if(!using3d)map.panTo(ll,{animate:true,duration:.35});}set3dLocation(lat,lon,acc);if(using3d&&map3d)map3d.easeTo({center:[lon,lat],zoom:Math.max(map3d.getZoom(),17),duration:350});setLocate(acc?('Live ±'+Math.round(acc)+'m'):'Live','active');}"
            + "function locationError(e){setLocate(e&&e.code===1?'Permission denied':'Location unavailable','error');}"
            + "function startLocation(){if(!navigator.geolocation){setLocate('No GPS','error');return;}if(locationWatch!=null)return;setLocate('Locating...','active');locationWatch=navigator.geolocation.watchPosition(updateLocation,locationError,{enableHighAccuracy:true,maximumAge:1500,timeout:15000});}"
            + "function stopLocation(){if(locationWatch!=null&&navigator.geolocation){navigator.geolocation.clearWatch(locationWatch);}locationWatch=null;setLocate('Location off','');}"
            + "function toggleLocation(){if(locationWatch==null)startLocation();else stopLocation();}"
            + "document.getElementById('locateMe').addEventListener('click',toggleLocation);window.addEventListener('pagehide',stopLocation);window.addEventListener('beforeunload',stopLocation);"
            + "if(focus){const item=tickets.find(t=>t.id===focus);if(item&&item.lat&&item.lon)map.setView([item.lat,item.lon],16);}"
            + "else if(savedCamera.saved){map.setView([savedCamera.lat,savedCamera.lng],savedCamera.zoom||12);if(String(savedCamera.mode||'').startsWith('3d'))setTimeout(()=>toggle3d(),800);}"
            + "else if(bounds.length){let b=L.latLngBounds([]);bounds.forEach(x=>b.extend(x));map.fitBounds(b,{padding:[18,18],maxZoom:14});}"
            + "</script></body></html>";
    }

    private String savedMapCameraJson() {
        if (!AppSettings.hasMapCamera(this)) return "{\"saved\":false}";
        JSONObject camera = new JSONObject();
        try {
            camera.put("saved", true);
            camera.put("lat", AppSettings.mapLatitude(this));
            camera.put("lng", AppSettings.mapLongitude(this));
            camera.put("zoom", AppSettings.mapZoom(this));
            camera.put("bearing", AppSettings.mapBearing(this));
            camera.put("pitch", AppSettings.mapPitch(this));
            camera.put("mode", AppSettings.mapMode(this));
        } catch (Exception ignored) {
        }
        return camera.toString();
    }

    private JSONArray ticketsMapJson() {
        JSONArray out = new JSONArray();
        if (snapshot == null) return out;
        for (Ticket ticket : visibleTickets()) {
            JSONObject item = new JSONObject();
            try {
                item.put("id", ticket.ticketNumber);
                if (ticket.hasCoordinates) {
                    item.put("lat", ticket.latitude);
                    item.put("lon", ticket.longitude);
                }
                if (ticket.polygon != null) item.put("polygon", ticket.polygon);
                item.put("color", colorHex(ticketStroke(ticket)));
                out.put(item);
            } catch (Exception ignored) {
            }
        }
        return out;
    }

    private JSONArray locatorNotesMapJson() {
        JSONArray out = new JSONArray();
        if (snapshot == null) return out;
        for (LocatorNote note : snapshot.locatorNotes) {
            if (!note.hasCoordinates) continue;
            JSONObject item = new JSONObject();
            try {
                item.put("id", note.id);
                item.put("lat", note.latitude);
                item.put("lon", note.longitude);
                item.put("category", note.category);
                item.put("text", note.text);
                item.put("target", first(note.targetLabel, note.ticket, note.targetType, "Map note"));
                item.put("targetType", note.targetType);
                item.put("layerId", note.layerId);
                item.put("createdAt", note.createdAt);
                item.put("createdBy", note.createdBy);
                out.put(item);
            } catch (Exception ignored) {
            }
        }
        return out;
    }

    private void showLocatorNoteForm(
        double latitude,
        double longitude,
        String targetType,
        String targetLabel,
        String targetId,
        String ticketNumber,
        String layerId,
        String featureId
    ) {
        screen = "locator-note";
        activeMapWebView = null;
        pendingScreen = "";
        AppSettings.saveLastView(this, "map", activeTicketNumber);
        pendingLocatorNoteLatitude = latitude;
        pendingLocatorNoteLongitude = longitude;
        pendingLocatorNoteTargetType = first(targetType, "map");
        pendingLocatorNoteTargetLabel = first(targetLabel, "Map spot");
        pendingLocatorNoteTargetId = targetId == null ? "" : targetId.trim();
        pendingLocatorNoteTicket = ticketNumber == null ? "" : ticketNumber.trim();
        pendingLocatorNoteLayerId = layerId == null ? "" : layerId.trim();
        pendingLocatorNoteFeatureId = featureId == null ? "" : featureId.trim();
        pendingAttachments.clear();
        attachmentStatus = null;
        locatorNoteAttachmentStatus = null;
        chrome.setVisibility(View.VISIBLE);
        title.setText("Add locator note");
        subtitle.setText(String.format(Locale.US, "%.6f, %.6f", latitude, longitude));
        selectNav(mapNav);
        content.removeAllViews();

        ScrollView scroll = new ScrollView(this);
        LinearLayout form = column(dp(16), dp(12), dp(16), dp(2));
        form.setBackgroundColor(lightPanel);
        scroll.addView(form);
        TextView location = text(String.format(Locale.US, "%.6f, %.6f", latitude, longitude), 13, darkMuted, false);
        TextView target = text(pendingLocatorNoteTargetSummary(), 14, darkInk, true);
        Spinner category = new Spinner(this);
        List<String> labels = new ArrayList<>();
        for (String[] option : LOCATOR_NOTE_CATEGORIES) labels.add(option[1]);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, labels);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        category.setAdapter(adapter);
        category.setBackgroundColor(lightControl);
        category.setPadding(dp(8), 0, dp(8), 0);
        EditText noteText = lightInput("Locator note", "", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        noteText.setMinLines(4);
        noteText.setSingleLine(false);
        form.addView(text("Location", 12, darkMuted, true));
        form.addView(location);
        form.addView(spacer(8));
        form.addView(text("Attached to", 12, darkMuted, true));
        form.addView(target);
        form.addView(spacer(8));
        form.addView(text("Category", 12, darkMuted, true));
        form.addView(category, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        form.addView(spacer(8));
        form.addView(noteText);
        locatorNoteAttachmentStatus = text("No photos selected", 13, darkMuted, false);
        Button choose = secondaryButton("Upload photos/videos");
        choose.setOnClickListener(view -> pickAttachments());
        form.addView(choose, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        form.addView(locatorNoteAttachmentStatus);
        form.addView(spacer(10));
        Button save = primaryButton("Save locator note");
        save.setOnClickListener(view -> saveLocatorNote(latitude, longitude, category.getSelectedItemPosition(), noteText.getText().toString()));
        form.addView(save, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50)));
        Button cancel = secondaryButton("Cancel");
        cancel.setOnClickListener(view -> showMap(activeTicket));
        form.addView(cancel, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        form.addView(spacer(42));
        content.addView(scroll);
    }

    private void saveLocatorNote(double latitude, double longitude, int categoryIndex, String text) {
        progress.setVisibility(View.VISIBLE);
        String category = LOCATOR_NOTE_CATEGORIES[Math.max(0, Math.min(LOCATOR_NOTE_CATEGORIES.length - 1, categoryIndex))][0];
        executor.execute(() -> {
            try {
                repository.createLocatorNote(
                    latitude,
                    longitude,
                    category,
                    text,
                    pendingLocatorNoteTargetType,
                    pendingLocatorNoteTargetLabel,
                    pendingLocatorNoteTargetId,
                    pendingLocatorNoteTicket,
                    pendingLocatorNoteLayerId,
                    pendingLocatorNoteFeatureId,
                    new ArrayList<>(pendingAttachments)
                );
                DashboardSnapshot next = repository.loadSnapshot();
                Ticket nextActive = pendingLocatorNoteTicket.isEmpty() ? null : findTicketIn(next.tickets, pendingLocatorNoteTicket);
                runOnUiThread(() -> {
                    snapshot = next;
                    activeTicket = nextActive;
                    progress.setVisibility(View.GONE);
                    showMap(nextActive);
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    progress.setVisibility(View.GONE);
                    new AlertDialog.Builder(this)
                        .setTitle("Locator note not saved")
                        .setMessage(error.getMessage())
                        .setPositiveButton("OK", null)
                        .show();
                });
            }
        });
    }

    private String pendingLocatorNoteTargetSummary() {
        if ("ticket".equals(pendingLocatorNoteTargetType)) return "Ticket " + pendingLocatorNoteTargetLabel;
        if ("vetro".equals(pendingLocatorNoteTargetType)) return "VETRO feature" + (pendingLocatorNoteTargetLabel.isEmpty() ? "" : ": " + pendingLocatorNoteTargetLabel);
        if ("vitruvi".equals(pendingLocatorNoteTargetType)) return "Vitruvi feature" + (pendingLocatorNoteTargetLabel.isEmpty() ? "" : ": " + pendingLocatorNoteTargetLabel);
        return "Map spot";
    }

    private String colorHex(int color) {
        return String.format(Locale.US, "#%06X", 0xFFFFFF & color);
    }

    private void showCompletionForm(Ticket ticket) {
        screen = "complete";
        activeTicket = ticket;
        activeTicketNumber = ticket.ticketNumber;
        activeMapWebView = null;
        pendingScreen = "";
        AppSettings.saveLastView(this, screen, activeTicketNumber);
        pendingAttachments.clear();
        locatorNoteAttachmentStatus = null;
        chrome.setVisibility(View.VISIBLE);
        title.setText("Complete ticket");
        subtitle.setText(ticket.title());
        content.removeAllViews();

        ScrollView scroll = new ScrollView(this);
        LinearLayout form = column(dp(14), dp(12), dp(14), dp(150));
        form.setBackgroundColor(lightPanel);
        scroll.setClipToPadding(false);
        scroll.addView(form);
        form.addView(text(ticket.title(), 21, darkInk, true));
        form.addView(text(ticket.locationLine(), 14, darkMuted, false));
        form.addView(spacer(10));

        List<CheckBox> boxes = new ArrayList<>();
        for (TicketAction action : TicketRepository.ACTIONS) {
            CheckBox box = actionCheckBox(action.label);
            box.setChecked(ticket.hasAction(action.key));
            box.setTag(action.key);
            boxes.add(box);
            form.addView(box);
        }

        EditText note = lightInput("Description / locator note", ticket.note, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        note.setMinLines(4);
        note.setSingleLine(false);
        form.addView(note);

        attachmentStatus = text("No photos selected", 13, darkMuted, false);
        Button choose = secondaryButton("Upload photos");
        choose.setOnClickListener(view -> pickAttachments());
        form.addView(choose, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        form.addView(attachmentStatus);

        Button submit = primaryButton("Submit ticket");
        submit.setOnClickListener(view -> {
            List<String> selected = new ArrayList<>();
            for (CheckBox box : boxes) if (box.isChecked()) selected.add(String.valueOf(box.getTag()));
            submitCompletion(ticket, selected, note.getText().toString());
        });
        form.addView(submit, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50)));
        form.addView(spacer(36));
        content.addView(scroll);
    }

    private void pickAttachments() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {"image/*", "video/*"});
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        startActivityForResult(intent, PICK_ATTACHMENTS);
    }

    private void submitCompletion(Ticket ticket, List<String> selected, String note) {
        if (snapshot == null) return;
        progress.setVisibility(View.VISIBLE);
        executor.execute(() -> {
            try {
                repository.saveTicketCompletion(snapshot, ticket.ticketNumber, selected, note, new ArrayList<>(pendingAttachments));
                DashboardSnapshot next = repository.loadSnapshot();
                runOnUiThread(() -> {
                    snapshot = next;
                    progress.setVisibility(View.GONE);
                    showTickets();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    progress.setVisibility(View.GONE);
                    if (attachmentStatus != null) {
                        attachmentStatus.setTextColor(danger);
                        attachmentStatus.setText(error.getMessage());
                    }
                });
            }
        });
    }

    private void refreshTickets(boolean showProgress) {
        if (refreshRunning) return;
        refreshRunning = true;
        if (showProgress) progress.setVisibility(View.VISIBLE);
        executor.execute(() -> {
            try {
                DashboardSnapshot loaded = repository.loadSnapshot();
                runOnUiThread(() -> {
                    refreshRunning = false;
                    snapshot = loaded;
                    progress.setVisibility(View.GONE);
                    if (subtitle != null) subtitle.setText(visibleTickets().size() + " open tickets | synced " + DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date()));
                    if ("tickets".equals(screen)) renderTickets();
                    else restoreRequestedScreen();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    refreshRunning = false;
                    progress.setVisibility(View.GONE);
                    showLogin(error.getMessage());
                });
            }
        });
    }

    private LinearLayout column(int left, int top, int right, int bottom) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(left, top, right, bottom);
        return layout;
    }

    private ImageView logoView(String username) {
        ImageView logo = new ImageView(this);
        logo.setImageResource(logoResource(username));
        logo.setAdjustViewBounds(true);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(96));
        params.setMargins(0, 0, 0, dp(10));
        logo.setLayoutParams(params);
        return logo;
    }

    private void restoreRequestedScreen() {
        String target = pendingScreen;
        if (target == null || target.isEmpty()) return;
        pendingScreen = "";
        if ("detail".equals(target) || "complete".equals(target)) {
            Ticket ticket = findTicket(activeTicketNumber);
            if (ticket == null) return;
            if ("complete".equals(target)) showCompletionForm(ticket);
            else showTicketDetail(ticket);
        } else if ("map".equals(target)) {
            showMap(findTicket(activeTicketNumber));
        } else if ("profile".equals(target)) {
            showProfile();
        } else if ("dig".equals(target)) {
            showDigTickets();
        } else if ("restoration".equals(target)) {
            showRestorationJobs();
        } else if ("in-house-requests".equals(target)) {
            showInHouseRequests();
        } else if ("location-photos".equals(target)) {
            showLocationPhotos();
        }
    }

    private Ticket findTicket(String ticketNumber) {
        if (snapshot == null || ticketNumber == null || ticketNumber.isEmpty()) return null;
        return findTicketIn(visibleTickets(), ticketNumber);
    }

    private Ticket findTicketIn(List<Ticket> tickets, String ticketNumber) {
        if (tickets == null || ticketNumber == null || ticketNumber.isEmpty()) return null;
        for (Ticket ticket : tickets) {
            if (ticket.ticketNumber.equals(ticketNumber)) return ticket;
        }
        return null;
    }

    private List<LocatorNote> locatorNotesForTicket(Ticket ticket) {
        List<LocatorNote> out = new ArrayList<>();
        if (snapshot == null || ticket == null) return out;
        for (LocatorNote note : snapshot.locatorNotes) {
            if (ticket.ticketNumber.equals(note.ticket) || ticket.ticketNumber.equals(note.targetId) || locatorNoteFallsInsideTicket(note, ticket)) out.add(note);
        }
        return out;
    }

    private boolean locatorNoteFallsInsideTicket(LocatorNote note, Ticket ticket) {
        if (note == null || ticket == null || !note.hasCoordinates || ticket.polygon == null) return false;
        JSONObject geometry = ticket.polygon.optJSONObject("geometry");
        if (geometry == null) geometry = ticket.polygon;
        String type = geometry.optString("type", "");
        JSONArray coordinates = geometry.optJSONArray("coordinates");
        if (coordinates == null) return false;
        if ("Polygon".equals(type)) return pointInPolygon(note.longitude, note.latitude, coordinates);
        if ("MultiPolygon".equals(type)) {
            for (int i = 0; i < coordinates.length(); i++) {
                JSONArray polygon = coordinates.optJSONArray(i);
                if (polygon != null && pointInPolygon(note.longitude, note.latitude, polygon)) return true;
            }
        }
        return false;
    }

    private boolean pointInPolygon(double x, double y, JSONArray polygon) {
        JSONArray outer = polygon.optJSONArray(0);
        if (outer == null || !pointInRing(x, y, outer)) return false;
        for (int i = 1; i < polygon.length(); i++) {
            JSONArray hole = polygon.optJSONArray(i);
            if (hole != null && pointInRing(x, y, hole)) return false;
        }
        return true;
    }

    private boolean pointInRing(double x, double y, JSONArray ring) {
        boolean inside = false;
        for (int i = 0, j = ring.length() - 1; i < ring.length(); j = i++) {
            JSONArray pi = ring.optJSONArray(i);
            JSONArray pj = ring.optJSONArray(j);
            if (pi == null || pj == null || pi.length() < 2 || pj.length() < 2) continue;
            double xi = pi.optDouble(0);
            double yi = pi.optDouble(1);
            double xj = pj.optDouble(0);
            double yj = pj.optDouble(1);
            boolean intersects = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) == 0 ? 1e-12 : (yj - yi)) + xi);
            if (intersects) inside = !inside;
        }
        return inside;
    }

    private String locatorNotesText(List<LocatorNote> notes) {
        StringBuilder out = new StringBuilder();
        for (LocatorNote note : notes) {
            if (out.length() > 0) out.append("\n\n");
            out.append(note.categoryLabel());
            if (!note.createdBy.isEmpty() || !note.createdAt.isEmpty()) out.append("\nAdded by ").append(join(note.createdBy, note.createdAt));
            if (!note.summary().isEmpty()) out.append("\n").append(note.summary());
        }
        return out.toString();
    }

    private void showOverflowMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add("Dig Tickets");
        menu.getMenu().add("Restoration Jobs");
        menu.getMenu().add("In-house Locate Requests");
        menu.getMenu().add("Location Photos");
        menu.getMenu().add("Profile");
        menu.getMenu().add("Refresh");
        menu.getMenu().add("Log out");
        menu.setOnMenuItemClickListener(item -> {
            String label = String.valueOf(item.getTitle());
            if ("Dig Tickets".equals(label)) showDigTickets();
            else if ("Restoration Jobs".equals(label)) showRestorationJobs();
            else if ("In-house Locate Requests".equals(label)) showInHouseRequests();
            else if ("Location Photos".equals(label)) showLocationPhotos();
            else if ("Profile".equals(label)) showProfile();
            else if ("Refresh".equals(label)) refreshTickets(true);
            else if ("Log out".equals(label)) {
                AppSettings.save(this, AppSettings.DEFAULT_DASHBOARD_URL, "", "", "", false);
                showLogin("");
            }
            return true;
        });
        menu.show();
    }

    private void showDigTickets() {
        screen = "dig";
        pendingScreen = "";
        activeTicket = null;
        activeTicketNumber = "";
        AppSettings.saveLastView(this, screen, activeTicketNumber);
        chrome.setVisibility(View.VISIBLE);
        title.setText("Dig Tickets");
        subtitle.setText("Dashboard dig ticket list");
        selectNav(menuNav);
        openDashboardWebView("/#sheet");
    }

    private void showRestorationJobs() {
        screen = "restoration";
        pendingScreen = "";
        activeTicket = null;
        activeTicketNumber = "";
        AppSettings.saveLastView(this, screen, activeTicketNumber);
        chrome.setVisibility(View.VISIBLE);
        title.setText("Restoration Jobs");
        subtitle.setText("Restoration job sheet and map");
        selectNav(menuNav);
        openDashboardWebView("/#restoration");
    }

    private void showInHouseRequests() {
        screen = "in-house-requests";
        pendingScreen = "";
        activeTicket = null;
        activeTicketNumber = "";
        AppSettings.saveLastView(this, screen, activeTicketNumber);
        chrome.setVisibility(View.VISIBLE);
        title.setText("In-house Locate Requests");
        subtitle.setText("Internal locate request dashboard");
        selectNav(menuNav);
        openDashboardWebView("/#in-house-requests");
    }

    private void showLocationPhotos() {
        screen = "location-photos";
        pendingScreen = "";
        activeTicket = null;
        activeTicketNumber = "";
        AppSettings.saveLastView(this, screen, activeTicketNumber);
        chrome.setVisibility(View.VISIBLE);
        title.setText("Location Photos");
        subtitle.setText("Upload GPS-tagged field photos");
        selectNav(menuNav);
        openDashboardWebView("/#location-photos");
    }

    private void showProfile() {
        screen = "profile";
        pendingScreen = "";
        activeTicket = null;
        activeTicketNumber = "";
        AppSettings.saveLastView(this, screen, activeTicketNumber);
        chrome.setVisibility(View.VISIBLE);
        title.setText("Profile");
        subtitle.setText("Account details");
        selectNav(menuNav);
        renderProfileEditor(null, "Loading profile...");
        executor.execute(() -> {
            try {
                JSONObject profile = repository.loadProfile();
                runOnUiThread(() -> renderProfileEditor(profile, ""));
            } catch (Exception error) {
                runOnUiThread(() -> renderProfileEditor(null, error.getMessage()));
            }
        });
    }

    private void renderProfileEditor(JSONObject profile, String message) {
        content.removeAllViews();
        pendingProfileAvatarData = "";
        ScrollView scroll = new ScrollView(this);
        LinearLayout page = column(dp(14), dp(14), dp(14), dp(120));
        scroll.addView(page);
        profilePhotoPreview = new ImageView(this);
        profilePhotoPreview.setAdjustViewBounds(true);
        profilePhotoPreview.setScaleType(ImageView.ScaleType.CENTER_CROP);
        LinearLayout.LayoutParams photoParams = new LinearLayout.LayoutParams(dp(112), dp(112));
        photoParams.gravity = Gravity.CENTER_HORIZONTAL;
        photoParams.setMargins(0, 0, 0, dp(12));
        profilePhotoPreview.setLayoutParams(photoParams);
        String avatar = profile == null ? "" : profile.optString("avatar_data", "");
        if (!avatar.isEmpty()) setProfilePreviewFromDataUri(avatar);
        else profilePhotoPreview.setImageResource(logoResource(AppSettings.username(this)));

        EditText displayName = input("Display name", profile == null ? "" : profile.optString("display_name", ""), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PERSON_NAME);
        EditText email = input("Email", profile == null ? "" : profile.optString("email", ""), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        EditText phone = input("Phone", profile == null ? "" : profile.optString("phone", ""), InputType.TYPE_CLASS_PHONE);
        EditText company = input("Company", profile == null ? "" : profile.optString("company", ""), InputType.TYPE_CLASS_TEXT);
        EditText titleField = input("Title / role", profile == null ? "" : profile.optString("title", ""), InputType.TYPE_CLASS_TEXT);
        EditText address = input("Address", profile == null ? "" : profile.optString("address", ""), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        address.setMinLines(2);
        address.setSingleLine(false);
        profileStatus = text(message == null ? "" : message, 13, message == null || message.isEmpty() || message.startsWith("Loading") ? muted : danger, false);
        Button choosePhoto = secondaryButton("Choose profile photo");
        Button save = primaryButton("Save profile");
        choosePhoto.setOnClickListener(view -> pickProfilePhoto());
        save.setOnClickListener(view -> {
            save.setEnabled(false);
            profileStatus.setTextColor(muted);
            profileStatus.setText("Saving profile...");
            executor.execute(() -> {
                try {
                    JSONObject update = new JSONObject();
                    update.put("display_name", displayName.getText().toString());
                    update.put("email", email.getText().toString());
                    update.put("phone", phone.getText().toString());
                    update.put("company", company.getText().toString());
                    update.put("title", titleField.getText().toString());
                    update.put("address", address.getText().toString());
                    if (!pendingProfileAvatarData.isEmpty()) update.put("avatar_data", pendingProfileAvatarData);
                    JSONObject saved = repository.saveProfile(update);
                    runOnUiThread(() -> {
                        save.setEnabled(true);
                        profileStatus.setTextColor(accent);
                        profileStatus.setText("Profile saved.");
                        renderProfileEditor(saved, "Profile saved.");
                    });
                } catch (Exception error) {
                    runOnUiThread(() -> {
                        save.setEnabled(true);
                        profileStatus.setTextColor(danger);
                        profileStatus.setText(error.getMessage());
                    });
                }
            });
        });
        page.addView(profilePhotoPreview);
        page.addView(choosePhoto, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        page.addView(displayName);
        page.addView(email);
        page.addView(phone);
        page.addView(company);
        page.addView(titleField);
        page.addView(address);
        page.addView(save, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50)));
        page.addView(profileStatus);
        content.addView(scroll);
    }

    private void openDashboardWebView(String path) {
        content.removeAllViews();
        WebView web = new WebView(this);
        configureLocationWebView(web);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (path.contains("#sheet")) {
                    view.evaluateJavascript("document.querySelector('#showSheetView')?.click()", null);
                } else if (path.contains("#restoration")) {
                    view.evaluateJavascript("document.querySelector('#showRestorationView')?.click()", null);
                } else if (path.contains("#location-photos")) {
                    view.evaluateJavascript("document.querySelector('#showLocationPhotosView')?.click()", null);
                } else if (path.contains("#profile")) {
                    view.evaluateJavascript("document.querySelector('#openProfileEditor')?.click()", null);
                }
            }
        });
        String cookie = AppSettings.authCookie(this);
        if (!cookie.isEmpty()) CookieManager.getInstance().setCookie(AppSettings.dashboardUrl(this), cookie);
        web.loadUrl(AppSettings.dashboardUrl(this) + path);
        content.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void pickProfilePhoto() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(intent, PICK_PROFILE_PHOTO);
    }

    private String profileImageDataUri(Uri uri) throws Exception {
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IllegalStateException("Unable to open profile photo.");
            Bitmap source = BitmapFactory.decodeStream(in);
            if (source == null) throw new IllegalStateException("Unable to read profile photo.");
            int width = source.getWidth();
            int height = source.getHeight();
            int max = Math.max(width, height);
            Bitmap output = source;
            if (max > 512) {
                float scale = 512f / max;
                output = Bitmap.createScaledBitmap(source, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), true);
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            output.compress(Bitmap.CompressFormat.JPEG, 82, bytes);
            if (bytes.size() > 650_000) throw new IllegalStateException("Profile photo is too large. Choose a smaller image.");
            return "data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP);
        }
    }

    private void setProfilePreviewFromDataUri(String value) {
        try {
            int comma = value.indexOf(',');
            if (comma < 0) return;
            byte[] bytes = Base64.decode(value.substring(comma + 1), Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap != null && profilePhotoPreview != null) profilePhotoPreview.setImageBitmap(bitmap);
        } catch (Exception ignored) {
        }
    }

    private void configureLocationWebView(WebView web) {
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        if (!AppSettings.dashboardUrl(this).startsWith("https://")) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, true);
                    return;
                }
                pendingGeolocationOrigin = origin == null ? "" : origin;
                pendingGeolocationCallback = callback;
                if (shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)) {
                    new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Location access")
                        .setMessage("Allow Fiber Locator to show your exact position on the map while this screen is open.")
                        .setPositiveButton("Allow", (dialog, which) -> requestLocationPermission())
                        .setNegativeButton("Not now", (dialog, which) -> denyPendingGeolocation())
                        .show();
                } else {
                    requestLocationPermission();
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (webFileCallback != null) webFileCallback.onReceiveValue(null);
                webFileCallback = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {"image/*", "video/*", "application/pdf", "text/plain"});
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(intent, PICK_WEB_FILE);
                } catch (Exception error) {
                    webFileCallback = null;
                    return false;
                }
                return true;
            }
        });
    }

    private String webMapOrigin() {
        String dashboardUrl = AppSettings.dashboardUrl(this);
        return dashboardUrl.startsWith("https://") ? dashboardUrl : SECURE_MAP_ORIGIN;
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestLocationPermission() {
        requestPermissions(
            new String[] {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
            LOCATION_PERMISSION_REQUEST
        );
    }

    private void denyPendingGeolocation() {
        if (pendingGeolocationCallback != null && !pendingGeolocationOrigin.isEmpty()) {
            pendingGeolocationCallback.invoke(pendingGeolocationOrigin, false, false);
        }
        pendingGeolocationOrigin = "";
        pendingGeolocationCallback = null;
    }

    private int logoResource(String username) {
        return R.drawable.fiber_locator_logo;
    }

    private boolean isJamesLogin(String username) {
        String value = username == null ? "" : username.trim().toLowerCase();
        return value.contains("james") || value.startsWith("jim");
    }

    private LinearLayout card() {
        LinearLayout card = column(dp(14), dp(13), dp(14), dp(13));
        card.setBackgroundColor(panel);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, dp(10));
        card.setLayoutParams(params);
        return card;
    }

    private void styleTicketRow(LinearLayout row, Ticket ticket) {
        int stroke = ticketStroke(ticket);
        int fill = blend(panel, stroke, ticketTintWeight(ticket));
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] {fill, panel});
        bg.setCornerRadius(dp(8));
        bg.setStroke(dp(isPriority(ticket) ? 3 : 2), stroke);
        row.setBackground(bg);
    }

    private boolean isPriority(Ticket ticket) {
        return isTcwDmi(ticket) || isEmergency(ticket) || isRemark(ticket) || isRenewal(ticket);
    }

    private float ticketTintWeight(Ticket ticket) {
        if (isTcwDmi(ticket)) return 0.28f;
        if (isEmergency(ticket)) return 0.26f;
        if (isRemark(ticket) || isRenewal(ticket)) return 0.22f;
        return 0.14f;
    }

    private int ticketStroke(Ticket ticket) {
        if (isTcwDmi(ticket)) return Color.rgb(255, 106, 0);
        if (isEmergency(ticket)) return Color.rgb(255, 0, 51);
        if (isRemark(ticket)) return Color.rgb(168, 85, 247);
        if (isRenewal(ticket)) return Color.rgb(56, 189, 248);
        String due = ticketDueStatus(ticket);
        if ("due-today".equals(due)) return Color.rgb(255, 128, 128);
        if ("due-next".equals(due)) return Color.rgb(214, 166, 0);
        if ("due-later".equals(due)) return Color.rgb(21, 128, 61);
        return line;
    }

    private TextView pill(String label, int color) {
        TextView view = text(label.isEmpty() ? "Open" : label, 12, color, true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(8), dp(3), dp(8), dp(3));
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(14));
        bg.setColor(blend(panel, color, 0.18f));
        bg.setStroke(dp(1), color);
        view.setBackground(bg);
        return view;
    }

    private String dueStatusLabel(String status) {
        if ("due-today".equals(status)) return "Due now";
        if ("due-next".equals(status)) return "Next due";
        if ("due-later".equals(status)) return "Upcoming";
        return "Open";
    }

    private String ticketDueStatus(Ticket ticket) {
        Date due = parseTicketDate(ticket.workDate);
        if (due == null) return "";
        Date today = startOfToday();
        Date next = nextWorkingDay(today);
        if (!due.after(today)) return "due-today";
        if (sameDay(due, next)) return "due-next";
        return "due-later";
    }

    private Date parseTicketDate(String value) {
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

    private Date startOfToday() {
        Date now = new Date();
        return new Date(now.getYear(), now.getMonth(), now.getDate());
    }

    private Date nextWorkingDay(Date from) {
        Date date = new Date(from.getTime());
        do {
            date = new Date(date.getYear(), date.getMonth(), date.getDate() + 1);
        } while (date.getDay() == 0 || date.getDay() == 6);
        return date;
    }

    private boolean sameDay(Date left, Date right) {
        return left.getYear() == right.getYear() && left.getMonth() == right.getMonth() && left.getDate() == right.getDate();
    }

    private boolean ticketDueDayIsPast(Ticket ticket) {
        Date due = parseTicketDate(ticket.workDate);
        if (due == null) return false;
        Date dueDay = new Date(due.getYear(), due.getMonth(), due.getDate());
        return dueDay.before(startOfToday());
    }

    private boolean ticketShouldShowOnDashboard(Ticket ticket) {
        return !(isTcwDmi(ticket) && ticketDueDayIsPast(ticket));
    }

    private boolean isEmergency(Ticket ticket) {
        return priorityText(ticket).contains("EMERGENCY");
    }

    private boolean isRemark(Ticket ticket) {
        String text = priorityText(ticket);
        return text.matches(".*\\bRECALL\\b.*")
            || text.matches(".*\\bSECOND\\s+REQUEST\\b.*")
            || text.matches(".*\\b24\\s*(HOUR|HR)\\s+PRIORITY\\b.*")
            || text.matches(".*\\bTWENTY\\s+FOUR\\s+HOUR\\s+PRIORITY\\b.*");
    }

    private boolean isRenewal(Ticket ticket) {
        return priorityText(ticket).contains("RENEWAL");
    }

    private boolean isTcwDmi(Ticket ticket) {
        String text = normalizedCompany(join(ticket.doneFor, ticket.contractor, ticket.caller));
        return text.contains(" TCW ") || text.contains(" DMI ") || text.contains(" TC WORKS ") || text.contains(" COMPUTER WORKS ") || text.contains(" DIRT MOVES ");
    }

    private String priorityText(Ticket ticket) {
        return join(ticket.messageType, ticket.workType, ticket.locationInformation, ticket.rawText).toUpperCase();
    }

    private String normalizedCompany(String value) {
        return (" " + value.toUpperCase().replace("&", " AND ").replaceAll("[^A-Z0-9]+", " ").replaceAll("\\s+", " ").trim() + " ");
    }

    private int blend(int base, int overlay, float amount) {
        int r = Math.round(Color.red(base) * (1 - amount) + Color.red(overlay) * amount);
        int g = Math.round(Color.green(base) * (1 - amount) + Color.green(overlay) * amount);
        int b = Math.round(Color.blue(base) * (1 - amount) + Color.blue(overlay) * amount);
        return Color.rgb(r, g, b);
    }

    private void field(LinearLayout page, String label, String value) {
        if (value == null || value.trim().isEmpty()) return;
        page.addView(text(label, 12, muted, true));
        TextView body = text(value, 15, ink, false);
        body.setPadding(0, 0, 0, dp(12));
        page.addView(body);
    }

    private TextView emptyState(String message) {
        TextView view = text(message, 15, muted, false);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(16), dp(60), dp(16), dp(60));
        return view;
    }

    private EditText input(String hint, String value, int type) {
        EditText view = new EditText(this);
        view.setHint(hint);
        view.setText(value == null ? "" : value);
        view.setInputType(type);
        view.setTextColor(ink);
        view.setHintTextColor(muted);
        view.setBackgroundColor(panel);
        view.setPadding(dp(12), 0, dp(12), 0);
        return view;
    }

    private EditText lightInput(String hint, String value, int type) {
        EditText view = input(hint, value, type);
        view.setTextColor(darkInk);
        view.setHintTextColor(darkMuted);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(lightControl);
        bg.setCornerRadius(dp(7));
        bg.setStroke(dp(1), lightLine);
        view.setBackground(bg);
        view.setPadding(dp(12), 0, dp(12), 0);
        return view;
    }

    private CheckBox actionCheckBox(String label) {
        CheckBox box = new CheckBox(this);
        box.setText(label);
        box.setTextSize(17);
        box.setTextColor(darkInk);
        box.setTypeface(null, 1);
        box.setMinHeight(dp(46));
        box.setPadding(dp(8), 0, dp(8), 0);
        box.setButtonTintList(new ColorStateList(
            new int[][] {new int[] {android.R.attr.state_checked}, new int[] {}},
            new int[] {Color.rgb(21, 128, 61), Color.rgb(15, 23, 42)}
        ));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(lightControl);
        bg.setCornerRadius(dp(7));
        bg.setStroke(dp(1), lightLine);
        box.setBackground(bg);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48));
        params.setMargins(0, 0, 0, dp(7));
        box.setLayoutParams(params);
        return box;
    }

    private Button primaryButton(String label) {
        Button button = button(label);
        button.setTextColor(bg);
        button.setBackgroundColor(accent);
        return button;
    }

    private Button secondaryButton(String label) {
        Button button = button(label);
        button.setTextColor(accent);
        button.setBackgroundColor(panel);
        return button;
    }

    private Button button(String label) {
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setText(label);
        button.setTextSize(15);
        return button;
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value == null ? "" : value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setLineSpacing(0, 1.12f);
        if (bold) view.setTypeface(null, 1);
        return view;
    }

    private View spacer(int height) {
        View view = new View(this);
        view.setLayoutParams(new LinearLayout.LayoutParams(1, dp(height)));
        return view;
    }

    private String join(String... values) {
        StringBuilder out = new StringBuilder();
        for (String value : values) {
            if (value == null || value.trim().isEmpty()) continue;
            if (out.length() > 0) out.append(" | ");
            out.append(value.trim());
        }
        return out.toString();
    }

    private String first(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) return value.trim();
        }
        return "";
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private final class MapBridge {
        @JavascriptInterface
        public void openTicket(String ticketNumber) {
            runOnUiThread(() -> {
                if (snapshot == null) return;
                for (Ticket ticket : snapshot.tickets) {
                    if (ticket.ticketNumber.equals(ticketNumber)) {
                        showTicketDetail(ticket);
                        return;
                    }
                }
            });
        }

        @JavascriptInterface
        public void addLocatorNoteForMap(double latitude, double longitude) {
            runOnUiThread(() -> showLocatorNoteForm(latitude, longitude, "map", "Map spot", "", "", "", ""));
        }

        @JavascriptInterface
        public void addLocatorNoteForTicket(double latitude, double longitude, String ticketNumber) {
            String cleanTicket = ticketNumber == null ? "" : ticketNumber.trim();
            runOnUiThread(() -> showLocatorNoteForm(latitude, longitude, "ticket", cleanTicket, cleanTicket, cleanTicket, "", ""));
        }

        @JavascriptInterface
        public void addLocatorNoteForFeature(double latitude, double longitude, String targetType, String targetLabel, String targetId, String layerId, String featureId) {
            runOnUiThread(() -> showLocatorNoteForm(latitude, longitude, targetType, targetLabel, targetId, "", layerId, featureId));
        }

        @JavascriptInterface
        public void saveMapCamera(double latitude, double longitude, double zoom, double bearing, double pitch, String mode) {
            AppSettings.saveMapCamera(MainActivity.this, latitude, longitude, zoom, bearing, pitch, mode);
            AppSettings.saveLastView(MainActivity.this, "map", activeTicketNumber);
        }

        @JavascriptInterface
        public void enterPictureInPicture() {
            runOnUiThread(() -> {
                updateMapPictureInPictureParams();
                enterMapPictureInPicture();
            });
        }
    }

    private final class MapWebViewClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request == null ? null : request.getUrl();
            if (uri == null || !"appassets.androidplatform.net".equals(uri.getHost())) {
                return super.shouldInterceptRequest(view, request);
            }
            String path = uri.getPath();
            if (path == null || !path.startsWith("/api/")) {
                return super.shouldInterceptRequest(view, request);
            }
            return proxyDashboardApi(path);
        }
    }

    private WebResourceResponse proxyDashboardApi(String path) {
        try {
            URL url = new URL(AppSettings.dashboardUrl(this) + path);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(12000);
            String cookie = AppSettings.authCookie(this);
            if (!cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);
            int code = connection.getResponseCode();
            String contentType = connection.getContentType();
            if (contentType == null || contentType.trim().isEmpty()) contentType = "application/json";
            String mimeType = contentType.split(";", 2)[0].trim();
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            return new WebResourceResponse(
                mimeType,
                "UTF-8",
                code,
                connection.getResponseMessage() == null ? "OK" : connection.getResponseMessage(),
                headers,
                code >= 400 && connection.getErrorStream() != null ? connection.getErrorStream() : connection.getInputStream()
            );
        } catch (Exception error) {
            return null;
        }
    }
}
