package com.fiberlocator.auto;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
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

import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int PICK_ATTACHMENTS = 4107;

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
    private String screen = "login";
    private String pendingScreen = "";
    private String activeTicketNumber = "";
    private boolean refreshRunning = false;

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
        TextView sub = text("Sign in with your dashboard login.", 15, muted, false);
        EditText username = input("Username", AppSettings.username(this), InputType.TYPE_CLASS_TEXT);
        EditText password = input("Password", AppSettings.password(this), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        CheckBox remember = new CheckBox(this);
        remember.setText("Remember me");
        remember.setTextColor(ink);
        remember.setTextSize(15);
        remember.setChecked(AppSettings.rememberMe(this));
        TextView status = text(message, 13, message.isEmpty() ? muted : danger, false);
        Button signIn = primaryButton("Sign in");
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

        page.addView(logo);
        page.addView(heading);
        page.addView(sub);
        page.addView(spacer(18));
        page.addView(username);
        page.addView(password);
        page.addView(remember);
        page.addView(signIn, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        page.addView(status);
        setContentView(page);
    }

    private void showAppShell() {
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
        title.setText("Tickets");
        subtitle.setText(snapshot == null ? "Loading live tickets" : snapshot.tickets.size() + " open tickets");
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
        TextView count = text(snapshot == null ? "Loading app view" : snapshot.tickets.size() + " live tickets", 15, ink, true);
        tools.addView(count, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        Button refresh = secondaryButton("Refresh");
        refresh.setOnClickListener(view -> refreshTickets(true));
        tools.addView(refresh);
        list.addView(tools);
        list.addView(spacer(8));
        if (snapshot == null) {
            list.addView(emptyState("Loading from the cloud dashboard."));
        } else if (snapshot.tickets.isEmpty()) {
            list.addView(emptyState("No open tickets match the published mobile view."));
        } else {
            for (Ticket ticket : snapshot.tickets) list.addView(ticketRow(ticket));
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
        page.addView(primaryButton("View map of this ticket"), new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        ((Button) page.getChildAt(page.getChildCount() - 1)).setOnClickListener(view -> showMap(ticket));
        Button dashboard = secondaryButton("View on dashboard");
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
        chrome.setVisibility(View.GONE);
        selectNav(mapNav);
        content.removeAllViews();
        WebView map = new WebView(this);
        WebSettings settings = map.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        map.setWebViewClient(new WebViewClient());
        String cookie = AppSettings.authCookie(this);
        if (!cookie.isEmpty()) CookieManager.getInstance().setCookie(AppSettings.dashboardUrl(this), cookie);
        map.addJavascriptInterface(new MapBridge(), "FiberLocator");
        map.loadDataWithBaseURL(AppSettings.dashboardUrl(this), mapHtml(focus), "text/html", "UTF-8", null);
        content.addView(map, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private String mapHtml(Ticket focus) {
        String json = ticketsMapJson().toString();
        String stateJson = snapshot == null ? "{}" : snapshot.state.toString();
        String focusNumber = focus == null ? "" : focus.ticketNumber;
        return "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            + "<link rel=\"stylesheet\" href=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css\">"
            + "<style>:root{--vetro-scale:1}html,body,#map{height:100%;margin:0;background:#eef2f5}.leaflet-container{font-family:sans-serif}.opacity{position:fixed;z-index:1000;left:8px;top:70px;bottom:70px;width:38px;border-radius:20px;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center}.opacity input{writing-mode:bt-lr;-webkit-appearance:slider-vertical;width:30px;height:100%;accent-color:#38bdf8}.mwrap{position:relative;width:var(--s);height:var(--s)}.m{position:absolute;left:0;top:0;width:100%;height:100%;background:var(--c);border:2px solid var(--b);opacity:calc(var(--vetro-scale) * var(--o))}.circle{border-radius:50%}.square{}.diamond{transform:rotate(45deg)}.pin{border-radius:50% 50% 50% 0;transform:rotate(-45deg)}.house{clip-path:polygon(50% 0,100% 42%,100% 100%,0 100%,0 42%)}</style></head>"
            + "<body><div id=\"map\"></div><div class=\"opacity\"><input id=\"vetroOpacity\" type=\"range\" min=\"0\" max=\"100\" value=\"72\" orient=\"vertical\" aria-label=\"Vetro opacity\"></div><script src=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js\"></script><script>"
            + "const tickets=" + json + ";const state=" + stateJson + ";const focus=" + JSONObject.quote(focusNumber) + ";"
            + "let vetroOpacityScale=1;let vetroLayers=[];"
            + "const map=L.map('map',{zoomControl:false,preferCanvas:true}).setView([33.23,-92.67],12);"
            + "const TILE_STYLES={standard:{url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',subdomains:'abc',maxZoom:20},contrast:{url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20},detailed:{url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',maxZoom:20},light:{url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20},dark:{url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20},terrain:{url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',subdomains:'abc',maxZoom:17},satellite:{url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maxZoom:20},hybrid:{layers:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}','https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}','https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],maxZoom:20},'mapbox-streets':{provider:'mapbox',styleId:'streets-v12'},'mapbox-outdoors':{provider:'mapbox',styleId:'outdoors-v12'},'mapbox-light':{provider:'mapbox',styleId:'light-v11'},'mapbox-dark':{provider:'mapbox',styleId:'dark-v11'},'mapbox-satellite':{provider:'mapbox',styleId:'satellite-v9'},'mapbox-satellite-streets':{provider:'mapbox',styleId:'satellite-streets-v12'},'mapbox-navigation-day':{provider:'mapbox',styleId:'navigation-day-v1'},'mapbox-navigation-night':{provider:'mapbox',styleId:'navigation-night-v1'}};"
            + "function savedBase(){const s=String(state.baseMapStyle||state.baseMap||state.mapStyle||'standard');return TILE_STYLES[s]?s:'standard';}"
            + "function back(l){try{if(l&&l.bringToBack)l.bringToBack();else if(l&&l.eachLayer)l.eachLayer(x=>x.bringToBack&&x.bringToBack());}catch(e){}}"
            + "async function addBase(){const key=savedBase();const tile=TILE_STYLES[key];try{let layer;if(tile.provider==='mapbox'){const r=await fetch('/api/map-config',{credentials:'include'});const c=r.ok?await r.json():{};const token=String(c.mapboxAccessToken||'');if(!token)throw new Error('missing mapbox token');layer=L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/${tile.styleId}/tiles/512/{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`,{maxZoom:22,tileSize:512,zoomOffset:-1,attribution:''});}else if(Array.isArray(tile.layers)){layer=L.layerGroup(tile.layers.map(u=>L.tileLayer(u,{maxZoom:tile.maxZoom||20,attribution:''})));}else{layer=L.tileLayer(tile.url,{maxZoom:tile.maxZoom||20,subdomains:tile.subdomains||'abc',attribution:''});}layer.addTo(map);back(layer);}catch(e){const t=TILE_STYLES.standard;const l=L.tileLayer(t.url,{maxZoom:20,subdomains:t.subdomains,attribution:''}).addTo(map);back(l);}}"
            + "addBase();"
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
            + "const bounds=[];tickets.forEach(t=>{const color=t.id===focus?'#b42318':'#00695c';"
            + "if(t.polygon){const p=L.geoJSON(t.polygon,{style:{color,weight:3,fillColor:color,fillOpacity:.18}}).addTo(map);p.on('click',()=>FiberLocator.openTicket(t.id));try{bounds.push(p.getBounds())}catch(e){}}"
            + "if(t.lat&&t.lon){const m=L.circleMarker([t.lat,t.lon],{radius:6,color,fillColor:color,fillOpacity:.9}).addTo(map);m.on('click',()=>FiberLocator.openTicket(t.id));bounds.push(L.latLng(t.lat,t.lon));}});"
            + "async function layer(url,kind){try{const r=await fetch(url,{credentials:'include'});if(!r.ok)return;const g=await r.json();let f=Array.isArray(g.features)?g.features:[];"
            + "if(kind==='vetro'){if(state.vetroVisible===false)return;f=f.filter(vetroPass);}if(kind==='vitruvi'){if(state.vitruviVisible!==true)return;f=f.filter(vitPass);}"
            + "const group=L.geoJSON({type:'FeatureCollection',features:f},{style:x=>{const id=kind==='vetro'?vetroId(x):vitId(x);const geom=x.geometry&&String(x.geometry.type)||'';const c=color(kind,id,kind==='vetro'?(state.vetroColor||'#2563eb'):'#f97316');const raw=num(kind==='vetro'?state.vetroLayerOpacityOverrides:state.vitruviLayerOpacityOverrides,id,kind==='vetro'?(Number(state.vetroOpacity)||.72):.82,0,1);const op=kind==='vetro'?raw*vetroOpacityScale:raw;const sz=num(kind==='vetro'?state.vetroLayerSizeOverrides:state.vitruviLayerSizeOverrides,id,kind==='vetro'?3:3,1,18);const st={color:c,fillColor:c,weight:geom.startsWith('Line')?sz:1,opacity:op,fillOpacity:op*.32,radius:sz,baseOpacity:raw};const sn=styleName(kind,id,geom);if(geom.startsWith('Line')){st.fillOpacity=0;if(sn==='dashed')st.dashArray='8 6';if(sn==='dotted')st.dashArray='2 6';}return st;},pointToLayer:(x,ll)=>{const id=kind==='vetro'?vetroId(x):vitId(x);const c=color(kind,id,kind==='vetro'?(state.vetroColor||'#2563eb'):'#f97316');const raw=num(kind==='vetro'?state.vetroLayerOpacityOverrides:state.vitruviLayerOpacityOverrides,id,kind==='vetro'?(Number(state.vetroOpacity)||.72):.82,0,1);const op=kind==='vetro'?raw*vetroOpacityScale:raw;const sz=num(kind==='vetro'?state.vetroLayerSizeOverrides:state.vitruviLayerSizeOverrides,id,8,4,28);const marker=L.marker(ll,{icon:icon(styleName(kind,id,'Point'),c,sz*2,op)});marker.options.baseOpacity=raw;return marker;}}).addTo(map);if(kind==='vetro'){vetroLayers.push(group);applyVetroOpacity();}}catch(e){}}"
            + "layer('/api/vetro','vetro');layer('/api/vitruvi','vitruvi');"
            + "document.getElementById('vetroOpacity').addEventListener('input',e=>{vetroOpacityScale=Number(e.target.value)/100;document.documentElement.style.setProperty('--vetro-scale',String(vetroOpacityScale));applyVetroOpacity();});"
            + "if(focus){const item=tickets.find(t=>t.id===focus);if(item&&item.lat&&item.lon)map.setView([item.lat,item.lon],16);}"
            + "else if(bounds.length){let b=L.latLngBounds([]);bounds.forEach(x=>b.extend(x));map.fitBounds(b,{padding:[18,18],maxZoom:14});}"
            + "</script></body></html>";
    }

    private JSONArray ticketsMapJson() {
        JSONArray out = new JSONArray();
        if (snapshot == null) return out;
        for (Ticket ticket : snapshot.tickets) {
            JSONObject item = new JSONObject();
            try {
                item.put("id", ticket.ticketNumber);
                if (ticket.hasCoordinates) {
                    item.put("lat", ticket.latitude);
                    item.put("lon", ticket.longitude);
                }
                if (ticket.polygon != null) item.put("polygon", ticket.polygon);
                out.put(item);
            } catch (Exception ignored) {
            }
        }
        return out;
    }

    private void showCompletionForm(Ticket ticket) {
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
                    if (subtitle != null) subtitle.setText(loaded.tickets.size() + " open tickets | synced " + DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date()));
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
        } else if ("dig".equals(target)) {
            showDigTickets();
        } else if ("profile".equals(target)) {
            showProfile();
        }
    }

    private Ticket findTicket(String ticketNumber) {
        if (snapshot == null || ticketNumber == null || ticketNumber.isEmpty()) return null;
        for (Ticket ticket : snapshot.tickets) {
            if (ticket.ticketNumber.equals(ticketNumber)) return ticket;
        }
        return null;
    }

    private void showOverflowMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add("Dig Tickets");
        menu.getMenu().add("Profile");
        menu.getMenu().add("Refresh");
        menu.getMenu().add("Log out");
        menu.setOnMenuItemClickListener(item -> {
            String label = String.valueOf(item.getTitle());
            if ("Dig Tickets".equals(label)) showDigTickets();
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
        subtitle.setText("Dashboard profile options");
        selectNav(menuNav);
        openDashboardWebView("/#profile");
    }

    private void openDashboardWebView(String path) {
        content.removeAllViews();
        WebView web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
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
        if ("due-later".equals(due)) return Color.rgb(58, 176, 86);
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
        String clean = value.trim();
        try {
            String[] parts = clean.contains("-") ? clean.split("-") : clean.split("/");
            if (parts.length != 3) return null;
            if (clean.contains("-")) return new Date(Integer.parseInt(parts[0]) - 1900, Integer.parseInt(parts[1]) - 1, Integer.parseInt(parts[2]));
            int year = Integer.parseInt(parts[2]);
            if (year < 100) year += 2000;
            return new Date(year - 1900, Integer.parseInt(parts[0]) - 1, Integer.parseInt(parts[1]));
        } catch (Exception ignored) {
            return null;
        }
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

    private boolean isEmergency(Ticket ticket) {
        return priorityText(ticket).contains("EMERGENCY");
    }

    private boolean isRemark(Ticket ticket) {
        String text = priorityText(ticket);
        return text.contains("REMARK") || text.contains("RECALL") || text.contains("SECOND REQUEST");
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
}
