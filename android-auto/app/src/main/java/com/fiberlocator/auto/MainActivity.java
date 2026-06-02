package com.fiberlocator.auto;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
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
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

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
    private static final String SECURE_MAP_ORIGIN = "https://appassets.androidplatform.net/";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Uri> pendingAttachments = new ArrayList<>();
    private TicketRepository repository;
    private LinearLayout root;
    private FrameLayout content;
    private LinearLayout chrome;
    private ProgressBar progress;
    private TextView title;
    private TextView subtitle;
    private Button ticketsNav;
    private Button mapNav;
    private Button menuNav;
    private DashboardSnapshot snapshot;
    private Ticket activeTicket;
    private TextView attachmentStatus;
    private TextView profileStatus;
    private ImageView profilePhotoPreview;
    private String pendingProfileAvatarData = "";
    private String screen = "login";
    private String pendingScreen = "";
    private String activeTicketNumber = "";
    private String pendingGeolocationOrigin = "";
    private GeolocationPermissions.Callback pendingGeolocationCallback;
    private boolean refreshRunning = false;
    private boolean tcwDashboardMode = false;

    private final int bg = Color.rgb(15, 23, 42);
    private final int surface = Color.rgb(17, 24, 39);
    private final int panel = Color.rgb(30, 41, 59);
    private final int ink = Color.rgb(248, 250, 252);
    private final int muted = Color.rgb(148, 163, 184);
    private final int accent = Color.rgb(56, 189, 248);
    private final int line = Color.rgb(51, 65, 85);
    private final int danger = Color.rgb(248, 113, 113);

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
        } else if ("dig".equals(screen) || "profile".equals(screen)) {
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
        if (requestCode != PICK_ATTACHMENTS || resultCode != RESULT_OK || data == null) return;
        if (data.getClipData() != null) {
            for (int index = 0; index < data.getClipData().getItemCount(); index++) {
                pendingAttachments.add(data.getClipData().getItemAt(index).getUri());
            }
        } else if (data.getData() != null) {
            pendingAttachments.add(data.getData());
        }
        if (attachmentStatus != null) attachmentStatus.setText(pendingAttachments.size() + " photo/video attachment(s) selected");
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
        tcwDashboardMode = "tcw".equals(AppSettings.dashboardMode(this));
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

        LinearLayout nav = new LinearLayout(this);
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
        refreshTickets(true);
    }

    private void setDashboardMode(boolean tcwMode) {
        tcwDashboardMode = tcwMode;
        AppSettings.saveDashboardMode(this, tcwMode ? "tcw" : "main");
        activeTicket = null;
        activeTicketNumber = "";
        if ("map".equals(screen)) showMap(null);
        else showTickets();
    }

    private List<Ticket> visibleTickets() {
        if (snapshot == null) return new ArrayList<>();
        List<Ticket> out = new ArrayList<>();
        for (Ticket ticket : snapshot.tickets) {
            boolean tcw = isTcwDmi(ticket);
            if (tcwDashboardMode) {
                if (tcw && !ticketDueDayIsPast(ticket)) out.add(ticket);
            } else if (!tcw) {
                out.add(ticket);
            }
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

    private void showTickets() {
        screen = "tickets";
        activeTicket = null;
        activeTicketNumber = "";
        pendingScreen = "";
        chrome.setVisibility(View.VISIBLE);
        title.setText(tcwDashboardMode ? "One-Calls Done For TCW" : "Tickets");
        List<Ticket> visible = visibleTickets();
        subtitle.setText(snapshot == null ? "Loading live tickets" : visible.size() + (tcwDashboardMode ? " TCW ticket(s)" : " open tickets"));
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
        TextView count = text(snapshot == null ? "Loading app view" : visible.size() + (tcwDashboardMode ? " One-Calls Done For TCW" : " live tickets"), 15, ink, true);
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
            list.addView(emptyState(tcwDashboardMode ? "No One-Calls Done For TCW are due or pending review." : "No open tickets match the published mobile view."));
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
        pendingScreen = "";
        chrome.setVisibility(View.VISIBLE);
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
        field(page, "Raw ticket", ticket.rawText);

        Button navigate = primaryButton("Navigate with Google Maps");
        navigate.setOnClickListener(view -> openNavigation(ticket));
        page.addView(navigate, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        Button dashboard = secondaryButton("See on dashboard map");
        dashboard.setOnClickListener(view -> showMap(ticket));
        page.addView(dashboard, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        if (tcwDashboardMode && isTcwDmi(ticket)) {
            page.addView(text("Read-only TCW ticket. It stays on this dashboard through the due date.", 14, muted, false));
        } else {
            Button complete = primaryButton("Complete ticket");
            complete.setOnClickListener(view -> showCompletionForm(ticket));
            page.addView(complete, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        }
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
        chrome.setVisibility(View.GONE);
        selectNav(mapNav);
        content.removeAllViews();
        WebView map = new WebView(this);
        configureLocationWebView(map);
        map.setWebViewClient(new MapWebViewClient());
        String cookie = AppSettings.authCookie(this);
        if (!cookie.isEmpty()) CookieManager.getInstance().setCookie(AppSettings.dashboardUrl(this), cookie);
        map.addJavascriptInterface(new MapBridge(), "FiberLocator");
        map.loadDataWithBaseURL(webMapOrigin(), mapHtml(focus), "text/html", "UTF-8", null);
        content.addView(map, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private String mapHtml(Ticket focus) {
        String json = ticketsMapJson().toString();
        String stateJson = snapshot == null ? "{}" : snapshot.state.toString();
        String focusNumber = focus == null ? "" : focus.ticketNumber;
        return "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            + "<link rel=\"stylesheet\" href=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css\">"
            + "<style>:root{--vetro-scale:1}html,body,#map{height:100%;margin:0;background:#eef2f5}.leaflet-container{font-family:sans-serif}.locate{position:fixed;z-index:1000;right:10px;top:10px;border:0;border-radius:8px;background:#0f172a;color:#f8fafc;padding:10px 12px;font:700 14px sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.25)}.locate.active{background:#0369a1}.locate.error{background:#991b1b}.satellite-toggle{position:fixed;z-index:1000;left:10px;top:75%;transform:translateY(-50%);border:0;border-radius:9px;background:#0f172a;color:#f8fafc;padding:11px 12px;font:800 13px sans-serif;box-shadow:0 6px 18px rgba(15,23,42,.28)}.satellite-toggle.active{background:#166534}.measure{position:fixed;z-index:1000;left:10px;bottom:12px;display:flex;gap:8px;align-items:center;background:rgba(15,23,42,.84);color:#f8fafc;border-radius:10px;padding:8px;box-shadow:0 6px 18px rgba(15,23,42,.25)}.measure button{border:0;border-radius:8px;background:#334155;color:#f8fafc;padding:9px 10px;font:700 13px sans-serif}.measure button.active{background:#15803d}.measure span{min-width:82px;font:700 13px sans-serif}.measure-dot{width:12px;height:12px;border-radius:50%;background:#facc15;border:2px solid #111827}.user-dot{width:18px;height:18px;border-radius:50%;background:#38bdf8;border:3px solid #fff;box-shadow:0 0 0 10px rgba(56,189,248,.22),0 2px 10px rgba(15,23,42,.35)}.mwrap{position:relative;width:var(--s);height:var(--s)}.m{position:absolute;left:0;top:0;width:100%;height:100%;background:var(--c);border:2px solid var(--b);opacity:calc(var(--vetro-scale) * var(--o))}.circle{border-radius:50%}.square{}.diamond{transform:rotate(45deg)}.pin{border-radius:50% 50% 50% 0;transform:rotate(-45deg)}.house{clip-path:polygon(50% 0,100% 42%,100% 100%,0 100%,0 42%)}</style></head>"
            + "<body><div id=\"map\"></div><button id=\"locateMe\" class=\"locate\" type=\"button\">Location off</button><button id=\"satelliteToggle\" class=\"satellite-toggle\" type=\"button\">Satellite</button><div class=\"measure\"><button id=\"measureToggle\" type=\"button\">Measure</button><button id=\"measureClear\" type=\"button\">Clear</button><span id=\"measureStatus\">0 ft</span></div><script src=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js\"></script><script>"
            + "const tickets=" + json + ";const state=" + stateJson + ";const focus=" + JSONObject.quote(focusNumber) + ";"
            + "let vetroOpacityScale=1;let vetroLayers=[];let locationWatch=null;let userMarker=null;let accuracyCircle=null;let measuring=false;let measurePoints=[];let measureLayer=L.layerGroup();let baseLayer=null;let currentBaseKey='';"
            + "const map=L.map('map',{zoomControl:false,preferCanvas:true}).setView([33.23,-92.67],12);"
            + "const TILE_STYLES={standard:{url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',subdomains:'abc',maxZoom:20},contrast:{url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20},detailed:{url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',maxZoom:20},light:{url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20},dark:{url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20},terrain:{url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',subdomains:'abc',maxZoom:17},satellite:{url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maxZoom:20},hybrid:{layers:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}','https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}','https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],maxZoom:20},'mapbox-streets':{provider:'mapbox',styleId:'streets-v12'},'mapbox-outdoors':{provider:'mapbox',styleId:'outdoors-v12'},'mapbox-light':{provider:'mapbox',styleId:'light-v11'},'mapbox-dark':{provider:'mapbox',styleId:'dark-v11'},'mapbox-satellite':{provider:'mapbox',styleId:'satellite-v9'},'mapbox-satellite-streets':{provider:'mapbox',styleId:'satellite-streets-v12'},'mapbox-navigation-day':{provider:'mapbox',styleId:'navigation-day-v1'},'mapbox-navigation-night':{provider:'mapbox',styleId:'navigation-night-v1'}};"
            + "function savedBase(){const s=String(state.baseMapStyle||state.baseMap||state.mapStyle||'standard');return TILE_STYLES[s]?s:'standard';}"
            + "function back(l){try{if(l&&l.bringToBack)l.bringToBack();else if(l&&l.eachLayer)l.eachLayer(x=>x.bringToBack&&x.bringToBack());}catch(e){}}"
            + "async function setBase(key){const tile=TILE_STYLES[key]||TILE_STYLES.standard;try{let layer;if(tile.provider==='mapbox'){const r=await fetch('/api/map-config',{credentials:'include'});const c=r.ok?await r.json():{};const token=String(c.mapboxAccessToken||'');if(!token)throw new Error('missing mapbox token');layer=L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/${tile.styleId}/tiles/512/{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`,{maxZoom:22,tileSize:512,zoomOffset:-1,attribution:''});}else if(Array.isArray(tile.layers)){layer=L.layerGroup(tile.layers.map(u=>L.tileLayer(u,{maxZoom:tile.maxZoom||20,attribution:''})));}else{layer=L.tileLayer(tile.url,{maxZoom:tile.maxZoom||20,subdomains:tile.subdomains||'abc',attribution:''});}if(baseLayer)map.removeLayer(baseLayer);layer.addTo(map);baseLayer=layer;currentBaseKey=key;document.getElementById('satelliteToggle').classList.toggle('active',key==='mapbox-satellite-streets');back(layer);}catch(e){if(key!=='standard')return setBase('standard');}}"
            + "setBase(savedBase());document.getElementById('satelliteToggle').addEventListener('click',()=>setBase(currentBaseKey==='mapbox-satellite-streets'?savedBase():'mapbox-satellite-streets'));"
            + "function prop(p,...n){p=p||{};for(const k of n){if(p[k]!=null&&p[k]!== '')return String(p[k]);}const l={};Object.keys(p).forEach(k=>l[k.toLowerCase()]=p[k]);for(const k of n){const v=l[k.toLowerCase()];if(v!=null&&v!=='')return String(v);}return '';}"
            + "function vetroId(f){return prop(f.properties,'layer_id','Layer_ID');}"
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
            + "document.getElementById('measureClear').addEventListener('click',()=>{measurePoints=[];redrawMeasure();});map.on('click',e=>{if(measuring)addMeasurePoint(e.latlng);});"
            + "const bounds=[];tickets.forEach(t=>{const color=t.color||'#00695c';"
            + "if(t.polygon){const p=L.geoJSON(t.polygon,{style:{color,weight:t.id===focus?5:3,fillColor:color,fillOpacity:.11}}).addTo(map);p.on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);if(measuring){addMeasurePoint(e.latlng);return;}stopLocation();FiberLocator.openTicket(t.id);});try{bounds.push(p.getBounds())}catch(e){}}"
            + "if(t.lat&&t.lon){const m=L.circleMarker([t.lat,t.lon],{radius:6,color,fillColor:color,fillOpacity:.9}).addTo(map);m.on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);if(measuring){addMeasurePoint(e.latlng);return;}stopLocation();FiberLocator.openTicket(t.id);});bounds.push(L.latLng(t.lat,t.lon));}});"
            + "async function layer(url,kind){try{const r=await fetch(url,{credentials:'include'});if(!r.ok)return;const g=await r.json();let f=Array.isArray(g.features)?g.features:[];"
            + "if(kind==='vetro'){if(state.vetroVisible===false)return;f=f.filter(vetroPass);}if(kind==='vitruvi'){if(state.vitruviVisible!==true)return;f=f.filter(vitPass);}"
            + "const group=L.geoJSON({type:'FeatureCollection',features:f},{style:x=>{const id=kind==='vetro'?vetroId(x):vitId(x);const geom=x.geometry&&String(x.geometry.type)||'';const c=color(kind,id,kind==='vetro'?(state.vetroColor||'#2563eb'):'#f97316');const raw=num(kind==='vetro'?state.vetroLayerOpacityOverrides:state.vitruviLayerOpacityOverrides,id,kind==='vetro'?(Number(state.vetroOpacity)||.72):.82,0,1);const op=kind==='vetro'?raw*vetroOpacityScale:raw;const sz=num(kind==='vetro'?state.vetroLayerSizeOverrides:state.vitruviLayerSizeOverrides,id,kind==='vetro'?3:3,1,18);const st={color:c,fillColor:c,weight:geom.startsWith('Line')?sz:1,opacity:op,fillOpacity:op*.32,radius:sz,baseOpacity:raw};const sn=styleName(kind,id,geom);if(geom.startsWith('Line')){st.fillOpacity=0;if(sn==='dashed')st.dashArray='8 6';if(sn==='dotted')st.dashArray='2 6';}return st;},pointToLayer:(x,ll)=>{const id=kind==='vetro'?vetroId(x):vitId(x);const c=color(kind,id,kind==='vetro'?(state.vetroColor||'#2563eb'):'#f97316');const raw=num(kind==='vetro'?state.vetroLayerOpacityOverrides:state.vitruviLayerOpacityOverrides,id,kind==='vetro'?(Number(state.vetroOpacity)||.72):.82,0,1);const op=kind==='vetro'?raw*vetroOpacityScale:raw;const sz=num(kind==='vetro'?state.vetroLayerSizeOverrides:state.vitruviLayerSizeOverrides,id,8,4,28);const marker=L.marker(ll,{icon:icon(styleName(kind,id,'Point'),c,sz*2,op)});marker.options.baseOpacity=raw;return marker;}}).addTo(map);if(kind==='vetro'){vetroLayers.push(group);applyVetroOpacity();}}catch(e){}}"
            + "layer('/api/vetro','vetro');layer('/api/vitruvi','vitruvi');"
            + "function setLocate(text,cls){const b=document.getElementById('locateMe');b.textContent=text;b.className='locate '+(cls||'');}"
            + "function updateLocation(pos){const lat=pos.coords.latitude,lon=pos.coords.longitude,acc=pos.coords.accuracy||0;const ll=[lat,lon];if(!userMarker){userMarker=L.marker(ll,{zIndexOffset:10000,icon:L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,12],html:'<div class=\"user-dot\"></div>'})}).addTo(map);accuracyCircle=L.circle(ll,{radius:acc,color:'#0284c7',weight:1,fillColor:'#38bdf8',fillOpacity:.14,opacity:.5}).addTo(map);map.setView(ll,17);}else{userMarker.setLatLng(ll);accuracyCircle.setLatLng(ll).setRadius(acc);map.panTo(ll,{animate:true,duration:.35});}setLocate(acc?('Live ±'+Math.round(acc)+'m'):'Live','active');}"
            + "function locationError(e){setLocate(e&&e.code===1?'Permission denied':'Location unavailable','error');}"
            + "function startLocation(){if(!navigator.geolocation){setLocate('No GPS','error');return;}if(locationWatch!=null)return;setLocate('Locating...','active');locationWatch=navigator.geolocation.watchPosition(updateLocation,locationError,{enableHighAccuracy:true,maximumAge:1500,timeout:15000});}"
            + "function stopLocation(){if(locationWatch!=null&&navigator.geolocation){navigator.geolocation.clearWatch(locationWatch);}locationWatch=null;setLocate('Location off','');}"
            + "function toggleLocation(){if(locationWatch==null)startLocation();else stopLocation();}"
            + "document.getElementById('locateMe').addEventListener('click',toggleLocation);window.addEventListener('pagehide',stopLocation);window.addEventListener('beforeunload',stopLocation);"
            + "if(focus){const item=tickets.find(t=>t.id===focus);if(item&&item.lat&&item.lon)map.setView([item.lat,item.lon],16);}"
            + "else if(bounds.length){let b=L.latLngBounds([]);bounds.forEach(x=>b.extend(x));map.fitBounds(b,{padding:[18,18],maxZoom:14});}"
            + "</script></body></html>";
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

    private String colorHex(int color) {
        return String.format(Locale.US, "#%06X", 0xFFFFFF & color);
    }

    private void showCompletionForm(Ticket ticket) {
        if (tcwDashboardMode && isTcwDmi(ticket)) {
            showTicketDetail(ticket);
            return;
        }
        screen = "complete";
        activeTicket = ticket;
        activeTicketNumber = ticket.ticketNumber;
        pendingScreen = "";
        pendingAttachments.clear();
        chrome.setVisibility(View.VISIBLE);
        title.setText("Complete ticket");
        subtitle.setText(ticket.title());
        content.removeAllViews();

        ScrollView scroll = new ScrollView(this);
        LinearLayout form = column(dp(14), dp(12), dp(14), dp(150));
        scroll.setClipToPadding(false);
        scroll.addView(form);
        form.addView(text(ticket.title(), 21, ink, true));
        form.addView(text(ticket.locationLine(), 14, muted, false));
        form.addView(spacer(10));

        List<CheckBox> boxes = new ArrayList<>();
        for (TicketAction action : TicketRepository.ACTIONS) {
            CheckBox box = new CheckBox(this);
            box.setText(action.label);
            box.setTextSize(16);
            box.setTextColor(ink);
            box.setChecked(ticket.hasAction(action.key));
            box.setTag(action.key);
            boxes.add(box);
            form.addView(box);
        }

        EditText note = input("Description / locator note", ticket.note, InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        note.setMinLines(4);
        note.setSingleLine(false);
        form.addView(note);

        attachmentStatus = text("No photos selected", 13, muted, false);
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
                    if (subtitle != null) subtitle.setText(visibleTickets().size() + (tcwDashboardMode ? " TCW ticket(s)" : " open tickets") + " | synced " + DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date()));
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
        }
    }

    private Ticket findTicket(String ticketNumber) {
        if (snapshot == null || ticketNumber == null || ticketNumber.isEmpty()) return null;
        for (Ticket ticket : visibleTickets()) {
            if (ticket.ticketNumber.equals(ticketNumber)) return ticket;
        }
        return null;
    }

    private void showOverflowMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add(tcwDashboardMode ? "Main Dashboard" : "One-Calls Done For TCW");
        menu.getMenu().add("Profile");
        menu.getMenu().add("Refresh");
        menu.getMenu().add("Log out");
        menu.setOnMenuItemClickListener(item -> {
            String label = String.valueOf(item.getTitle());
            if ("One-Calls Done For TCW".equals(label)) setDashboardMode(true);
            else if ("Main Dashboard".equals(label)) setDashboardMode(false);
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
        chrome.setVisibility(View.VISIBLE);
        title.setText("Dig Tickets");
        subtitle.setText("Dashboard dig ticket list");
        selectNav(menuNav);
        openDashboardWebView("/#sheet");
    }

    private void showProfile() {
        screen = "profile";
        pendingScreen = "";
        activeTicket = null;
        activeTicketNumber = "";
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
        return isJamesLogin(username) ? R.drawable.james_fiber_locator_logo : R.drawable.fiber_locator_logo;
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
