let tickets = [];
let selectedTicket = null;
let map;
let baseTileLayer;
let mapDataOverlayLayer;
let mapDataOverlayAbort = 0;
let locatorNotesLayer;
let locatorNotes = [];
let locatorNoteMode = false;
let pendingLocatorNoteTarget = null;
let locationPhotos = [];
let locationPhotosLoading = false;
let locationPhotosMap = null;
let locationPhotosLayer = null;
let restorationJobs = [];
let restorationCanManage = false;
let restorationSearch = "";
let selectedRestorationJobId = "";
let restorationMap = null;
let restorationMapMarkers = null;
let restorationMapVetroLayer = null;
let restorationPriorityFilter = "";
let restorationStatusFilter = "";
let inHouseRequests = [];
let selectedInHouseRequestId = "";
let inHouseMap = null;
let inHouseBaseTileLayer = null;
let inHouseMapMarker = null;
let inHouseMapVetroLayer = null;
let inHouseMapSearchTimer = null;
let inHouseMapSearchToken = 0;
let markers;
let polygons;
let userLocationLayer;
let userLocationMarker = null;
let userLocationAccuracy = null;
let map3d = null;
let map3dEnabled = false;
let map3dStyle = localStorage.getItem("dashboard3dStyle") === "satellite" ? "satellite" : "standard";
let map3dAssetsPromise = null;
let map3dUserLocation = null;
let mobileMap = null;
let mobileMapMarkers = null;
let mobileMapPolygons = null;
let mobileMapVetroLayer = null;
let mobileMapUserLayer = null;
let mobileMapHasFit = false;
let mobileUserLocationMarker = null;
let mobileUserLocationAccuracy = null;
let locationWatchId = null;
let liveLocationEnabled = false;
let mobilePanel = localStorage.getItem("mobilePanel") || "tickets";
let dashboardTicketMode = localStorage.getItem("dashboardTicketMode") === "tcw" ? "tcw" : "main";
let measureTool = null;
let mobileMeasureTool = null;
let vetroGeojson = null;
let vetroLayer = null;
let vetroLoaded = false;
let pendingVetroCaptureFile = null;
let vitruviGeojson = null;
let vitruviLayer = null;
let vitruviLoaded = false;
let vitruviLayerGeometryById = {};
let initialTicketBoundsApplied = false;
let currentView = "dashboard";
let currentProfileMode = "admin";
let currentUsername = "";
let currentUserDisplayName = "";
let currentUserRole = "admin";
let adminPreviewState = null;
let sheetExpandedTickets = new Set();
let historicalDigTickets = null;
let historicalDigTicketError = "";
let historicalDigTicketSearch = "";
let attachmentCache = {};
let attachmentLoadingTickets = new Set();
let settingsCloseTimer = null;
let mapConfig = { mapboxAccessToken: "" };
const maplibreStyleCache = {};
let maplibreAssetsPromise = null;
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 40;
const SELECTED_POLYGON_NEARBY_PIXELS = 96;
const NEARBY_POLYGON_DIM_OPACITY = 0.035;
const NEARBY_POLYGON_DIM_STROKE_OPACITY = 0.12;
const DEFAULT_BRAND_LOGO = "/static/assets/tcw-logo.png?v=20260602150000";
const DEFAULT_BRAND_SECONDARY_LOGO = "/static/assets/finallandscapelocator.png?v=20260606120000";
const JAMES_BRAND_LOGO = "/static/james-fiber-locator-logo.png?v=20260528190500";
const STORAGE_KEYS = {
  hiddenTickets: "hiddenTickets",
  archivedTickets: "archivedTickets",
  hiddenTicketUpdatedAt: "hiddenTicketUpdatedAt",
  archivedTicketUpdatedAt: "archivedTicketUpdatedAt",
  ticketActions: "ticketActions",
  ticketActionUpdatedAt: "ticketActionUpdatedAt",
  ticketDescriptions: "ticketDescriptions",
  ticketMarkedBy: "ticketMarkedBy",
  ticketPriorities: "ticketPriorities",
  ticketListCheckpoint: "ticketListCheckpoint",
  showHidden: "showHiddenTickets",
  countyFilterAll: "countyFilterAll",
  countyFilterSelected: "countyFilterSelected",
  vetroVisible: "vetroVisible",
  vetroLayers: "vetroLayerFilterSelected",
  vetroPlan: "vetroPlanFilterSelected",
  vetroBuild: "vetroBuildFilterSelected",
  vetroPlacement: "vetroPlacementFilterSelected",
  vetroStatus: "vetroStatusFilterSelected",
  vetroGeometry: "vetroGeometryFilterSelected",
  vetroFiber: "vetroFiberFilterSelected",
  vetroRoute: "vetroRouteFilterSelected",
  vetroPoint: "vetroPointFilterSelected",
  vetroLayerColors: "vetroLayerColorOverrides",
  vetroLayerStyles: "vetroLayerStyleOverrides",
  vetroLayerNames: "vetroLayerNameOverrides",
  vetroLayerNotes: "vetroLayerNoteOverrides",
  vetroLayerSizes: "vetroLayerSizeOverrides",
  vetroLayerOpacities: "vetroLayerOpacityOverrides",
  vitruviVisible: "vitruviVisible",
  vitruviLayers: "vitruviLayerFilterSelected",
  vitruviSearch: "vitruviSearch",
  vitruviOpacity: "vitruviOpacity",
  vitruviLayerColors: "vitruviLayerColorOverrides",
  vitruviLayerStyles: "vitruviLayerStyleOverrides",
  vitruviLayerNames: "vitruviLayerNameOverrides",
  vitruviLayerNotes: "vitruviLayerNoteOverrides",
  vitruviLayerSizes: "vitruviLayerSizeOverrides",
  vitruviLayerOpacities: "vitruviLayerOpacityOverrides",
  vetroSlVisible: "vetroSlVisible",
  vetroSlShape: "vetroSlShape",
  vetroSlColor: "vetroSlColor",
  vetroSlOutlineColor: "vetroSlOutlineColor",
  vetroSlOpacity: "vetroSlOpacity",
  vetroSlSize: "vetroSlSize",
  vetroSlLabels: "vetroSlLabels",
  vetroSearch: "vetroSearch",
  savedViewSelected: "savedViewSelected",
  mapStyle: "mapStyle",
  mapDataOverlay: "mapDataOverlay",
  sidebarCollapsed: "sidebarCollapsed",
  ticketOpacity: "ticketOpacity",
  profile: "locatorProfile",
  sheetSort: "sheetSort",
  sheetColumnFilters: "sheetColumnFilters",
  sheetSavedFilters: "sheetSavedFilters",
  sheetColumnWidths: "sheetColumnWidths",
};
const DIG_TICKET_PRIORITIES = ["low", "medium", "high", "emergency"];

const ACTIVE_COUNTIES = new Set(["UNION", "COLUMBIA"]);
const FOCUS_ZOOM_THRESHOLD = 14;
const FOCUS_TARGET_ZOOM = 17;
const VETRO_SERVICE_LOCATION_LAYER_ID = "26";
const NEW_SAVED_VIEW_OPTION = "__new_saved_view__";
const LOCATOR_NOTE_CATEGORIES = {
  instruction: { label: "Future locator instruction", color: "#2563eb" },
  layer_issue: { label: "Layer is not correct", color: "#f59e0b" },
  locate_issue: { label: "Problem locating", color: "#dc2626" },
  needs_attention: { label: "Needs attention", color: "#7c3aed" },
  restoration: { label: "Restoration needed", color: "#059669" },
  other: { label: "Other note", color: "#475569" },
};
const VETRO_PREFIX_LAYERS = [
  { prefix: "SL-", id: "prefix:SL", name: "Customers", detail: "customer service-location points from VETRO layer 26" },
];
const MAP_TILE_STYLES = {
  "locator-dark-detail": {
    label: "Dark locator detail + addresses",
    group: "Recommended",
    provider: "maplibre",
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
    customize: "locator-dark-detail",
    mapDataOverlay: "addresses",
  },
  standard: {
    label: "Standard streets",
    group: "Open maps",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    subdomains: "abc",
  },
  contrast: {
    label: "High contrast streets",
    group: "Open maps",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
  },
  detailed: {
    label: "Detailed streets + buildings",
    group: "Open maps",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  light: {
    label: "Light streets",
    group: "Open maps",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
  },
  dark: {
    label: "Dark streets",
    group: "Open maps",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
  },
  terrain: {
    label: "Terrain",
    group: "Open maps",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, &copy; OpenTopoMap",
    subdomains: "abc",
  },
  satellite: {
    label: "Satellite",
    group: "Open maps",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  hybrid: {
    label: "Hybrid imagery + labels",
    group: "Open maps",
    layers: [
      {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "Tiles &copy; Esri",
      },
      {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
        attribution: "Transportation labels &copy; Esri",
      },
      {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        attribution: "Place labels &copy; Esri",
      },
    ],
    attribution: "Tiles &copy; Esri",
  },
  "openfree-bright": {
    label: "OpenFreeMap bright",
    group: "Free vector",
    provider: "maplibre",
    styleUrl: "https://tiles.openfreemap.org/styles/bright",
  },
  "openfree-liberty": {
    label: "OpenFreeMap liberty",
    group: "Free vector",
    provider: "maplibre",
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
  },
  "openfree-positron": {
    label: "OpenFreeMap positron",
    group: "Free vector",
    provider: "maplibre",
    styleUrl: "https://tiles.openfreemap.org/styles/positron",
  },
  "openfree-dark": {
    label: "OpenFreeMap dark",
    group: "Free vector",
    provider: "maplibre",
    styleUrl: "https://tiles.openfreemap.org/styles/dark",
  },
  "openfree-fiord": {
    label: "OpenFreeMap fiord",
    group: "Free vector",
    provider: "maplibre",
    styleUrl: "https://tiles.openfreemap.org/styles/fiord",
  },
  "mapbox-streets": {
    label: "Mapbox streets",
    group: "Mapbox",
    provider: "mapbox",
    styleId: "streets-v12",
    attribution: "&copy; Mapbox &copy; OpenStreetMap",
  },
  "mapbox-outdoors": {
    label: "Mapbox outdoors",
    group: "Mapbox",
    provider: "mapbox",
    styleId: "outdoors-v12",
    attribution: "&copy; Mapbox &copy; OpenStreetMap",
  },
  "mapbox-light": {
    label: "Mapbox light",
    group: "Mapbox",
    provider: "mapbox",
    styleId: "light-v11",
    attribution: "&copy; Mapbox &copy; OpenStreetMap",
  },
  "mapbox-dark": {
    label: "Mapbox dark",
    group: "Mapbox",
    provider: "mapbox",
    styleId: "dark-v11",
    attribution: "&copy; Mapbox &copy; OpenStreetMap",
  },
  "mapbox-satellite": {
    label: "Mapbox satellite",
    group: "Mapbox",
    provider: "mapbox",
    styleId: "satellite-v9",
    imagery: true,
    attribution: "&copy; Mapbox &copy; OpenStreetMap",
  },
  "mapbox-satellite-streets": {
    label: "Mapbox satellite streets",
    group: "Mapbox",
    provider: "mapbox",
    styleId: "satellite-streets-v12",
    imagery: true,
    attribution: "&copy; Mapbox &copy; OpenStreetMap",
  },
  "mapbox-navigation-day": {
    label: "Mapbox navigation day",
    group: "Mapbox",
    provider: "mapbox",
    styleId: "navigation-day-v1",
    attribution: "&copy; Mapbox &copy; OpenStreetMap",
  },
  "mapbox-navigation-night": {
    label: "Mapbox navigation night",
    group: "Mapbox",
    provider: "mapbox",
    styleId: "navigation-night-v1",
    attribution: "&copy; Mapbox &copy; OpenStreetMap",
  },
};

const MAP_STYLE_GROUPS = ["Recommended", "Open maps", "Free vector", "Mapbox"];

const TICKET_ACTIONS = [
  { key: "located", label: "Located", hidesFromDashboard: true },
  { key: "locate-delayed", label: "Locate delayed", hidesFromDashboard: false },
  { key: "clear", label: "Clear", hidesFromDashboard: true },
  { key: "ticket-canceled-by-customer", label: "Caller canceled ticket", hidesFromDashboard: true },
  { key: "in-conflict", label: "In conflict", hidesFromDashboard: true },
  { key: "cannot-locate", label: "Cannot locate", hidesFromDashboard: true },
  { key: "partially-located-large-project", label: "Partially located/large project", hidesFromDashboard: true },
  { key: "excavation-started", label: "An excavation started", hidesFromDashboard: true },
];
const DASHBOARD_TIME_ZONE = "America/Chicago";
const DASHBOARD_TIME_FORMAT = {
  timeZone: DASHBOARD_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
};

function formatDashboardDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "") : date.toLocaleString(undefined, DASHBOARD_TIME_FORMAT);
}

const ARCGIS_POINT_OVERLAYS = {
  addresses: {
    label: "address",
    minZoom: 16,
    url: "https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Location/FeatureServer/14/query",
    color: "#f97316",
    radius: 4,
    labelFields: ["adr_num_comp"],
    fields: [
      "adr_label",
      "adr_num_comp",
      "pstr_fulnam",
      "adr_muni",
      "cnty_name",
      "adr_zip5",
      "landmark_nam",
    ],
  },
  parcels: {
    label: "parcel",
    minZoom: 16,
    url: "https://geostor.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/0/query",
    color: "#22c55e",
    radius: 3,
    fields: ["parcelid", "ownername", "situsadd", "siteaddr", "address", "county"],
  },
};

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readBooleanStorage(key, fallback = false) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "true";
}

function readSetStorage(key) {
  const value = readJsonStorage(key, null);
  if (Array.isArray(value)) return new Set(value.map(String));
  const raw = localStorage.getItem(key);
  return raw ? new Set([raw]) : new Set();
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function writeBooleanStorage(key, value) {
  localStorage.setItem(key, value ? "true" : "false");
}

function auditEvent(event, details = {}) {
  if (!dashboardStateReady || dashboardStateHydrating) return;
  void fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, details }),
    keepalive: true,
  }).catch((error) => console.warn("Unable to write audit event", error));
}

function populateMapStyleSelect() {
  if (!elements?.mapStyle) return;
  elements.mapStyle.innerHTML = "";
  for (const groupName of MAP_STYLE_GROUPS) {
    const styles = Object.entries(MAP_TILE_STYLES).filter(([, tile]) => tile.group === groupName);
    if (!styles.length) continue;
    const group = document.createElement("optgroup");
    group.label = groupName;
    for (const [styleId, tile] of styles) {
      const option = document.createElement("option");
      option.value = styleId;
      option.textContent = tile.label || styleId;
      group.appendChild(option);
    }
    elements.mapStyle.appendChild(group);
  }
  const grouped = new Set(MAP_STYLE_GROUPS);
  for (const [styleId, tile] of Object.entries(MAP_TILE_STYLES).filter(([, tile]) => !grouped.has(tile.group))) {
    const option = document.createElement("option");
    option.value = styleId;
    option.textContent = tile.label || styleId;
    elements.mapStyle.appendChild(option);
  }
  elements.mapStyle.value = MAP_TILE_STYLES[mapStyle] ? mapStyle : "contrast";
}

function syncTicketSearchInputs() {
  if (elements.search) elements.search.value = ticketSearch;
  if (elements.ticketQuickSearch) elements.ticketQuickSearch.value = ticketSearch;
  if (elements.mobileSearch) elements.mobileSearch.value = ticketSearch;
  if (elements.sheetSearch) elements.sheetSearch.value = ticketSearch;
}

function updateTicketSearch(value, options = {}) {
  ticketSearch = String(value || "");
  historicalDigTicketSearch = ticketSearch;
  localStorage.setItem("ticketSearch", ticketSearch);
  syncTicketSearchInputs();
  if (options.renderSheet) renderSheetView();
  render();
  scheduleEmployeeDashboardSync();
}

async function loadMapConfig() {
  try {
    const response = await fetch("/api/map-config");
    if (!response.ok) throw new Error(`Map config failed: ${response.status}`);
    const payload = await response.json();
    mapConfig = {
      mapboxAccessToken: String(payload.mapboxAccessToken || ""),
    };
  } catch (error) {
    console.warn("Unable to load map config", error);
    mapConfig = { mapboxAccessToken: "" };
  }
}

function readObjectStorage(key) {
  const value = readJsonStorage(key, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeProfile(value) {
  const profile = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    name: String(profile.name ?? "Reed").slice(0, 60),
    role: String(profile.role ?? "Admin profile").slice(0, 80),
    photo: String(profile.photo || ""),
  };
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

function rememberUndoState({ applyCheckpoint = true } = {}) {
  if (!dashboardStateReady || dashboardStateHydrating) return;
  undoStack.push(cloneState(dashboardStatePayload({ applyCheckpoint })));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
  updateHistoryButtons();
}

function normalizeTicketListCheckpoint(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    enabled: value.enabled !== false,
    hiddenTickets: Array.isArray(value.hiddenTickets) ? value.hiddenTickets.map(String) : [],
    archivedTickets: Array.isArray(value.archivedTickets) ? value.archivedTickets.map(String) : [],
    hiddenTicketUpdatedAt: normalizeTicketActionUpdatedAt(value.hiddenTicketUpdatedAt),
    archivedTicketUpdatedAt: normalizeTicketActionUpdatedAt(value.archivedTicketUpdatedAt),
    ticketActions: normalizeTicketActions(value.ticketActions),
    ticketActionUpdatedAt: normalizeTicketActionUpdatedAt(value.ticketActionUpdatedAt),
    savedAt: String(value.savedAt || ""),
  };
}

function writeTicketListCheckpoint() {
  if (ticketListCheckpoint?.enabled) writeJsonStorage(STORAGE_KEYS.ticketListCheckpoint, ticketListCheckpoint);
  else localStorage.removeItem(STORAGE_KEYS.ticketListCheckpoint);
}

function protectedTicketNumbersFromCheckpoint() {
  const checkpoint = normalizeTicketListCheckpoint(ticketListCheckpoint);
  if (!checkpoint?.enabled) return new Set();
  return new Set([
    ...checkpoint.hiddenTickets,
    ...checkpoint.archivedTickets,
    ...Object.keys(checkpoint.ticketActions || {}).filter((ticketNumber) => {
      return (checkpoint.ticketActions[ticketNumber] || []).some((key) => actionByKey(key)?.hidesFromDashboard);
    }),
  ]);
}

function applyTicketListCheckpoint() {
  const checkpoint = normalizeTicketListCheckpoint(ticketListCheckpoint);
  if (!checkpoint?.enabled) {
    ticketListCheckpoint = null;
    writeTicketListCheckpoint();
    return;
  }
  ticketListCheckpoint = checkpoint;
  for (const ticketNumber of checkpoint.hiddenTickets) {
    const checkpointTime = Number(checkpoint.hiddenTicketUpdatedAt?.[ticketNumber] || 0);
    const currentTime = Number(hiddenTicketUpdatedAt?.[ticketNumber] || 0);
    if (!checkpointTime || checkpointTime >= currentTime) hiddenTickets.add(ticketNumber);
  }
  for (const ticketNumber of checkpoint.archivedTickets) {
    const checkpointTime = Number(checkpoint.archivedTicketUpdatedAt?.[ticketNumber] || 0);
    const currentTime = Number(archivedTicketUpdatedAt?.[ticketNumber] || 0);
    if (!checkpointTime || checkpointTime >= currentTime) archivedTickets.add(ticketNumber);
  }
  hiddenTicketUpdatedAt = { ...hiddenTicketUpdatedAt };
  for (const [ticketNumber, updatedAt] of Object.entries(checkpoint.hiddenTicketUpdatedAt || {})) {
    const checkpointTime = Number(updatedAt || 0);
    const currentTime = Number(hiddenTicketUpdatedAt[ticketNumber] || 0);
    if (checkpointTime >= currentTime) hiddenTicketUpdatedAt[ticketNumber] = checkpointTime;
  }
  archivedTicketUpdatedAt = { ...archivedTicketUpdatedAt };
  for (const [ticketNumber, updatedAt] of Object.entries(checkpoint.archivedTicketUpdatedAt || {})) {
    const checkpointTime = Number(updatedAt || 0);
    const currentTime = Number(archivedTicketUpdatedAt[ticketNumber] || 0);
    if (checkpointTime >= currentTime) archivedTicketUpdatedAt[ticketNumber] = checkpointTime;
  }
  for (const [ticketNumber, actions] of Object.entries(checkpoint.ticketActions || {})) {
    const checkpointTime = Number(checkpoint.ticketActionUpdatedAt?.[ticketNumber] || 0);
    const currentTime = Number(ticketActionUpdatedAt?.[ticketNumber] || 0);
    if (Array.isArray(actions) && actions.length && checkpointTime >= currentTime) ticketActions[ticketNumber] = actions;
  }
  ticketActionUpdatedAt = { ...ticketActionUpdatedAt };
  for (const [ticketNumber, updatedAt] of Object.entries(checkpoint.ticketActionUpdatedAt || {})) {
    const checkpointTime = Number(updatedAt || 0);
    const currentTime = Number(ticketActionUpdatedAt[ticketNumber] || 0);
    if (checkpointTime >= currentTime) ticketActionUpdatedAt[ticketNumber] = checkpointTime;
  }
  writeJsonStorage(STORAGE_KEYS.hiddenTickets, [...hiddenTickets]);
  writeJsonStorage(STORAGE_KEYS.archivedTickets, [...archivedTickets]);
  writeJsonStorage(STORAGE_KEYS.hiddenTicketUpdatedAt, hiddenTicketUpdatedAt);
  writeJsonStorage(STORAGE_KEYS.archivedTicketUpdatedAt, archivedTicketUpdatedAt);
  writeJsonStorage(STORAGE_KEYS.ticketActions, ticketActions);
  writeJsonStorage(STORAGE_KEYS.ticketActionUpdatedAt, ticketActionUpdatedAt);
  writeTicketListCheckpoint();
}

async function saveDashboardCheckpoint() {
  rememberUndoState({ applyCheckpoint: false });
  if (elements.saveDashboardState) elements.saveDashboardState.disabled = true;
  showSavedToast("Saving dashboard...");
  ticketListCheckpoint = {
    enabled: true,
    hiddenTickets: [...hiddenTickets],
    archivedTickets: [...archivedTickets],
    hiddenTicketUpdatedAt: normalizeTicketActionUpdatedAt(hiddenTicketUpdatedAt),
    archivedTicketUpdatedAt: normalizeTicketActionUpdatedAt(archivedTicketUpdatedAt),
    ticketActions: normalizeTicketActions(ticketActions),
    ticketActionUpdatedAt: normalizeTicketActionUpdatedAt(ticketActionUpdatedAt),
    savedAt: new Date().toISOString(),
  };
  writeTicketListCheckpoint();
  try {
    await saveDashboardState(dashboardStatePayload({ applyCheckpoint: false }), { force: true });
    updateHistoryButtons();
    showSavedToast("Dashboard saved");
    auditEvent("dashboard_checkpoint_saved", {
      hidden: ticketListCheckpoint.hiddenTickets.length,
      archived: ticketListCheckpoint.archivedTickets.length,
      actioned: Object.keys(ticketListCheckpoint.ticketActions).length,
    });
  } finally {
    if (elements.saveDashboardState) elements.saveDashboardState.disabled = false;
  }
}

function restoreDashboardStateSnapshot(state) {
  const beforeActions = normalizeTicketActions(ticketActions);
  applyDashboardState(cloneState(state));
  stampTicketActionDifferences(beforeActions, ticketActions);
  render();
  renderVetroLayer();
  scheduleDashboardStateSave();
}

function formatActivityTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "") : date.toLocaleString(undefined, DASHBOARD_TIME_FORMAT);
}

function activityDetailsText(details) {
  if (!details || typeof details !== "object") return "";
  try {
    return JSON.stringify(details);
  } catch {
    return String(details || "");
  }
}

let activityEvents = [];

function renderActivity(events = []) {
  if (!elements.activityList) return;
  activityEvents = Array.isArray(events) ? events : [];
  if (!events.length) {
    elements.activityList.innerHTML = '<div class="detail-content">No app or dashboard activity recorded yet.</div>';
    return;
  }
  elements.activityList.innerHTML = events
    .map((item) => `
      <div class="activity-item">
        <span>${escapeHtml(formatActivityTime(item.time))}</span>
        <strong>${escapeHtml(item.username || "anonymous")}</strong>
        <span>${escapeHtml(item.event || "event")}</span>
        <code>${escapeHtml(activityDetailsText(item.details))}${item.ip ? `\nIP ${escapeHtml(item.ip)}` : ""}</code>
      </div>
    `)
    .join("");
}

async function loadActivity() {
  if (!elements.activityList) return;
  elements.activityList.innerHTML = '<div class="detail-content">Loading app and dashboard log...</div>';
  const response = await fetch("/api/audit?limit=50000");
  if (!response.ok) throw new Error(`Log load failed: ${response.status}`);
  const payload = await response.json();
  renderActivity(Array.isArray(payload.events) ? payload.events : []);
}

function downloadActivityLog(format = "csv") {
  const events = Array.isArray(activityEvents) ? activityEvents : [];
  if (!events.length) {
    showSavedToast("No log entries to download");
    return;
  }
  const rows = [["time", "username", "event", "ip", "details"]];
  for (const item of events) {
    rows.push([
      item.time || "",
      item.username || "anonymous",
      item.event || "event",
      item.ip || "",
      activityDetailsText(item.details),
    ]);
  }
  let body = "";
  let type = "text/csv";
  let extension = "csv";
  if (format === "json") {
    body = JSON.stringify(events, null, 2);
    type = "application/json";
    extension = "json";
  } else if (format === "excel") {
    const header = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="utf-8"></head>
        <body><table>`;
    const tableRows = rows.map((row, index) => `<tr>${row.map((value) => {
      const cell = escapeHtml(String(value ?? "")).replace(/\n/g, "<br>");
      return index === 0 ? `<th>${cell}</th>` : `<td>${cell}</td>`;
    }).join("")}</tr>`).join("");
    body = `${header}${tableRows}</table></body></html>`;
    type = "application/vnd.ms-excel";
    extension = "xls";
  } else {
    body = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  }
  const blob = new Blob([body], { type: `${type};charset=utf-8` });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `fiber-app-dashboard-log-${new Date().toISOString().slice(0, 10)}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showSavedToast("Log download started");
}

function updateHistoryButtons() {
  if (!elements.undoAction || !elements.redoAction) return;
  elements.undoAction.disabled = undoStack.length === 0;
  elements.redoAction.disabled = redoStack.length === 0;
}

function undoLastChange() {
  if (!undoStack.length) return;
  redoStack.push(cloneState(dashboardStatePayload()));
  const previous = undoStack.pop();
  restoreDashboardStateSnapshot(previous);
  updateHistoryButtons();
}

function redoLastChange() {
  if (!redoStack.length) return;
  undoStack.push(cloneState(dashboardStatePayload()));
  const next = redoStack.pop();
  restoreDashboardStateSnapshot(next);
  updateHistoryButtons();
}

function closeMoreMenu() {
  const menu = document.querySelector(".more-menu");
  if (menu) menu.open = false;
}

let moreMenuCloseTimer = null;

function scheduleMoreMenuClose() {
  if (moreMenuCloseTimer) window.clearTimeout(moreMenuCloseTimer);
  moreMenuCloseTimer = window.setTimeout(() => {
    moreMenuCloseTimer = null;
    closeMoreMenu();
  }, 1400);
}

function cancelMoreMenuClose() {
  if (!moreMenuCloseTimer) return;
  window.clearTimeout(moreMenuCloseTimer);
  moreMenuCloseTimer = null;
}

function showSettingsPanel() {
  if (!elements.settingsPanel) return;
  elements.settingsPanel.hidden = false;
  if (elements.showSettingsMenu) elements.showSettingsMenu.setAttribute("aria-expanded", "true");
  cancelSettingsPanelClose();
  void refreshOneDriveStatus();
  void refreshPhotoSettings();
}

function hideSettingsPanel() {
  if (!elements.settingsPanel) return;
  elements.settingsPanel.hidden = true;
  if (elements.showSettingsMenu) elements.showSettingsMenu.setAttribute("aria-expanded", "false");
}

function scheduleSettingsPanelClose() {
  if (settingsCloseTimer) window.clearTimeout(settingsCloseTimer);
  settingsCloseTimer = window.setTimeout(() => {
    settingsCloseTimer = null;
    hideSettingsPanel();
  }, 2000);
}

function cancelSettingsPanelClose() {
  if (!settingsCloseTimer) return;
  window.clearTimeout(settingsCloseTimer);
  settingsCloseTimer = null;
}

function setOneDriveStatus(message) {
  if (elements.oneDriveStatus) elements.oneDriveStatus.textContent = message;
}

async function refreshOneDriveStatus() {
  if (!elements.oneDriveStatus) return null;
  setOneDriveStatus("Checking OneDrive...");
  try {
    const response = await fetch("/api/onedrive/status");
    const payload = await response.json();
    if (!payload.configured) {
      setOneDriveStatus(payload.message || "OneDrive is not configured.");
    } else if (payload.connected) {
      const account = payload.account || {};
      setOneDriveStatus(`Connected: ${account.displayName || account.userPrincipalName || "OneDrive account"} · Folder: ${payload.rootFolder || "Fiber Locator Attachments"}`);
    } else {
      setOneDriveStatus(payload.message || "OneDrive is ready to connect.");
    }
    return payload;
  } catch (error) {
    setOneDriveStatus(error.message || "Unable to check OneDrive.");
    return null;
  }
}

async function connectOneDrive() {
  setOneDriveStatus("Starting Microsoft sign-in...");
  const start = await fetch("/api/onedrive/device-code", { method: "POST" });
  const device = await start.json();
  if (!start.ok || device.ok === false) {
    setOneDriveStatus(device.message || `Unable to start OneDrive sign-in: ${start.status}`);
    return;
  }
  const message = device.message || `Go to ${device.verificationUri} and enter code ${device.userCode}`;
  setOneDriveStatus(message);
  if (device.verificationUri) window.open(device.verificationUri, "_blank", "noopener,noreferrer");
  const interval = Math.max(5, Number(device.interval) || 5) * 1000;
  const expiresAt = Date.now() + Math.max(60, Number(device.expiresIn) || 900) * 1000;
  while (Date.now() < expiresAt) {
    await new Promise((resolve) => window.setTimeout(resolve, interval));
    const complete = await fetch("/api/onedrive/complete-device-code", { method: "POST" });
    const payload = await complete.json();
    if (complete.status === 202 || payload.pending) {
      setOneDriveStatus(payload.message || "Waiting for Microsoft sign-in approval.");
      continue;
    }
    if (!complete.ok || payload.ok === false) {
      setOneDriveStatus(payload.message || `OneDrive sign-in failed: ${complete.status}`);
      return;
    }
    const account = payload.account || {};
    setOneDriveStatus(`Connected: ${account.displayName || account.userPrincipalName || "OneDrive account"}`);
    return;
  }
  setOneDriveStatus("OneDrive sign-in expired. Start again.");
}

function setPhotoSettingsStatus(message) {
  if (elements.photoSettingsStatus) elements.photoSettingsStatus.textContent = message;
}

function downloadLocationPhotos(format) {
  const endpoint = format === "zip" ? "/api/location-photos/export.zip" : "/api/location-photos/export.csv";
  window.open(endpoint, "_blank", "noopener,noreferrer");
}

async function refreshPhotoSettings() {
  if (!elements.photoSettingsStatus) return null;
  setPhotoSettingsStatus("Checking photo library...");
  try {
    const response = await fetch("/api/location-photos/settings");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.message || `Photo settings failed: ${response.status}`);
    const settings = payload.settings || {};
    if (elements.photoSettingsSourceApp) elements.photoSettingsSourceApp.value = settings.sourceApp || "Timestamp Camera";
    if (elements.photoSettingsGoogleFolder) elements.photoSettingsGoogleFolder.value = settings.googleDriveFolder || "Fiber Locator Photos";
    if (elements.photoSettingsDriveMode) elements.photoSettingsDriveMode.value = settings.googleDriveMode || "export";
    const summary = payload.summary || {};
    setPhotoSettingsStatus(`${summary.total || 0} photo${summary.total === 1 ? "" : "s"} stored · ${summary.withCoordinates || 0} with GPS · Mode: ${settings.googleDriveMode || "export"}`);
    return payload;
  } catch (error) {
    setPhotoSettingsStatus(error.message || "Unable to check photo library.");
    return null;
  }
}

async function savePhotoSettings() {
  setPhotoSettingsStatus("Saving photo settings...");
  try {
    const response = await fetch("/api/location-photos/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceApp: elements.photoSettingsSourceApp?.value || "Timestamp Camera",
        googleDriveFolder: elements.photoSettingsGoogleFolder?.value || "Fiber Locator Photos",
        googleDriveMode: elements.photoSettingsDriveMode?.value || "export",
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.message || `Save failed: ${response.status}`);
    setPhotoSettingsStatus("Photo settings saved.");
  } catch (error) {
    setPhotoSettingsStatus(error.message || "Unable to save photo settings.");
  }
}

function employeeDashboardState() {
  return employeeDashboardConfig.enabled && employeeDashboardConfig.state && typeof employeeDashboardConfig.state === "object"
    ? employeeDashboardConfig.state
    : null;
}

function employeeFallbackState() {
  return locatorDefaultConfig.enabled && locatorDefaultConfig.state && typeof locatorDefaultConfig.state === "object"
    ? locatorDefaultConfig.state
    : dashboardStatePayload();
}

function employeeWritableStatePayload() {
  return {
    ...ticketWorkflowStatePayload(),
    vetroOpacity,
    ticketOpacity,
    mapStyle,
    baseMapStyle: mapStyle,
    baseMap: mapStyle,
    mapDataOverlay: effectiveMapDataOverlay(),
  };
}

function employeeDashboardStateFromAdminFilters() {
  const state = dashboardStatePayload();
  const current = employeeDashboardState() || {};
  return {
    ...state,
    employeeViewMode: typeof current.employeeViewMode === "string" ? current.employeeViewMode : state.employeeViewMode,
  };
}

function currentMapViewPayload() {
  return map
    ? {
        center: [map.getCenter().lat, map.getCenter().lng],
        zoom: map.getZoom(),
      }
      : pendingMapView;
}

function savedBaseMapStyle(state) {
  for (const key of ["baseMapStyle", "baseMap", "mapStyle"]) {
    const value = state?.[key];
    if (typeof value === "string" && MAP_TILE_STYLES[value]) return value;
  }
  return "";
}

function savedViewStatePayload() {
  applyTicketListCheckpoint();
  return {
    hiddenTickets: [...hiddenTickets],
    archivedTickets: [...archivedTickets],
    hiddenTicketUpdatedAt,
    archivedTicketUpdatedAt,
    ticketActions,
    ticketActionUpdatedAt,
    ticketDescriptions,
    ticketMarkedBy,
    ticketPriorities,
    ticketListCheckpoint,
    showHiddenTickets,
    ticketSearch,
    countyFilterAll,
    countyFilterSelected: [...selectedCounties],
    vetroVisible,
    vetroLayerColorOverrides,
    vetroLayerStyleOverrides,
    vetroLayerNameOverrides,
    vetroLayerNoteOverrides,
    vetroLayerSizeOverrides,
    vetroLayerOpacityOverrides,
    vitruviVisible: isSiteOwner() ? vitruviVisible : false,
    vitruviLayerFilterSelected: isSiteOwner() ? [...vitruviSelectedLayers] : [],
    vitruviSearch: isSiteOwner() ? vitruviSearch : "",
    vitruviOpacity: isSiteOwner() ? vitruviOpacity : 0.82,
    vitruviLayerColorOverrides: isSiteOwner() ? vitruviLayerColorOverrides : {},
    vitruviLayerStyleOverrides: isSiteOwner() ? vitruviLayerStyleOverrides : {},
    vitruviLayerNameOverrides: isSiteOwner() ? vitruviLayerNameOverrides : {},
    vitruviLayerNoteOverrides: isSiteOwner() ? vitruviLayerNoteOverrides : {},
    vitruviLayerSizeOverrides: isSiteOwner() ? vitruviLayerSizeOverrides : {},
    vitruviLayerOpacityOverrides: isSiteOwner() ? vitruviLayerOpacityOverrides : {},
    vetroSlVisible,
    vetroSlShape,
    vetroSlColor,
    vetroSlOutlineColor,
    vetroSlOpacity,
    vetroSlSize,
    vetroSlLabels,
    vetroColor,
    vetroOpacity,
    polygonOpacity,
    ticketOpacity,
    mapStyle,
    baseMapStyle: mapStyle,
    baseMap: mapStyle,
    mapDataOverlay: effectiveMapDataOverlay(),
    mapView: currentMapViewPayload(),
  };
}

function normalizeViewPresets(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((item) => ({
      id: String(item?.id || item?.name || "").trim(),
      name: String(item?.name || "").trim().slice(0, 80),
      state: item?.state && typeof item.state === "object" ? item.state : {},
      saved_at: String(item?.saved_at || ""),
      saved_by: String(item?.saved_by || ""),
    }))
    .filter((item) => item.id && item.name && !seen.has(item.id) && seen.add(item.id));
}

function selectedSavedView() {
  return viewPresets.find((preset) => preset.id === selectedSavedViewId) || null;
}

function updateSavedViewStatus(message = "") {
  if (!elements.savedViewStatus) return;
  if (message) {
    elements.savedViewStatus.textContent = message;
    return;
  }
  const preset = selectedSavedView();
  if (!preset) {
    elements.savedViewStatus.textContent = selectedSavedViewId === NEW_SAVED_VIEW_OPTION ? "New view selected" : (viewPresets.length ? "Choose a saved view" : "No saved views");
    return;
  }
  const savedAt = preset.saved_at ? new Date(preset.saved_at) : null;
  const savedText = savedAt && !Number.isNaN(savedAt.getTime()) ? formatDashboardDateTime(savedAt) : "saved";
  elements.savedViewStatus.textContent = `${preset.name}: ${savedText}`;
}

function renderSavedViewControls() {
  if (!elements.savedViewSelect) return;
  const selectedExists = viewPresets.some((preset) => preset.id === selectedSavedViewId);
  if (!selectedExists) selectedSavedViewId = viewPresets[0]?.id || "";
  localStorage.setItem(STORAGE_KEYS.savedViewSelected, selectedSavedViewId);
  elements.savedViewSelect.innerHTML = `
    <option value="">Choose view</option>
    ${viewPresets.map((preset) => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`).join("")}
    <option value="${NEW_SAVED_VIEW_OPTION}">Add new view...</option>
  `;
  elements.savedViewSelect.value = selectedSavedViewId;
  updateSavedViewStatus();
}

async function applySavedViewState(state) {
  if (!state || typeof state !== "object") return;
  dashboardStateHydrating = true;
  try {
    if (typeof state.showHiddenTickets === "boolean") {
      showHiddenTickets = state.showHiddenTickets;
      writeBooleanStorage(STORAGE_KEYS.showHidden, showHiddenTickets);
    }
    if (typeof state.ticketSearch === "string") {
      ticketSearch = state.ticketSearch;
      localStorage.setItem("ticketSearch", ticketSearch);
      syncTicketSearchInputs();
      historicalDigTicketSearch = ticketSearch;
    }
    if (typeof state.countyFilterAll === "boolean") {
      countyFilterAll = state.countyFilterAll;
      writeBooleanStorage(STORAGE_KEYS.countyFilterAll, countyFilterAll);
    }
    if (Array.isArray(state.countyFilterSelected)) {
      selectedCounties = new Set(state.countyFilterSelected.map(String));
      writeJsonStorage(STORAGE_KEYS.countyFilterSelected, [...selectedCounties]);
    }
    if (typeof state.vetroVisible === "boolean") {
      vetroVisible = state.vetroVisible;
      writeBooleanStorage(STORAGE_KEYS.vetroVisible, vetroVisible);
      elements.vetroToggle.checked = vetroVisible;
    }
    if (state.vetroLayerColorOverrides && typeof state.vetroLayerColorOverrides === "object") {
      vetroLayerColorOverrides = state.vetroLayerColorOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerColors, JSON.stringify(vetroLayerColorOverrides));
    }
    if (state.vetroLayerStyleOverrides && typeof state.vetroLayerStyleOverrides === "object") {
      vetroLayerStyleOverrides = state.vetroLayerStyleOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerStyles, JSON.stringify(vetroLayerStyleOverrides));
    }
    if (state.vetroLayerNameOverrides && typeof state.vetroLayerNameOverrides === "object") {
      vetroLayerNameOverrides = state.vetroLayerNameOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerNames, JSON.stringify(vetroLayerNameOverrides));
    }
    if (state.vetroLayerNoteOverrides && typeof state.vetroLayerNoteOverrides === "object") {
      vetroLayerNoteOverrides = state.vetroLayerNoteOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerNotes, JSON.stringify(vetroLayerNoteOverrides));
    }
    if (state.vetroLayerSizeOverrides && typeof state.vetroLayerSizeOverrides === "object") {
      vetroLayerSizeOverrides = state.vetroLayerSizeOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerSizes, JSON.stringify(vetroLayerSizeOverrides));
    }
    if (state.vetroLayerOpacityOverrides && typeof state.vetroLayerOpacityOverrides === "object") {
      vetroLayerOpacityOverrides = state.vetroLayerOpacityOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerOpacities, JSON.stringify(vetroLayerOpacityOverrides));
    }
    if (isSiteOwner()) {
      if (typeof state.vitruviVisible === "boolean") {
        vitruviVisible = state.vitruviVisible;
        writeBooleanStorage(STORAGE_KEYS.vitruviVisible, vitruviVisible);
        if (elements.vitruviToggle) elements.vitruviToggle.checked = vitruviVisible;
      }
      if (Array.isArray(state.vitruviLayerFilterSelected)) {
        vitruviSelectedLayers = new Set(state.vitruviLayerFilterSelected.map(String));
        writeJsonStorage(STORAGE_KEYS.vitruviLayers, [...vitruviSelectedLayers]);
      }
      if (typeof state.vitruviSearch === "string") {
        vitruviSearch = state.vitruviSearch;
        localStorage.setItem(STORAGE_KEYS.vitruviSearch, vitruviSearch);
        if (elements.vitruviSearch) elements.vitruviSearch.value = vitruviSearch;
      }
      if (typeof state.vitruviOpacity === "number") {
        vitruviOpacity = state.vitruviOpacity;
        localStorage.setItem(STORAGE_KEYS.vitruviOpacity, String(vitruviOpacity));
        if (elements.vitruviOpacity) elements.vitruviOpacity.value = String(opacityToPercent(vitruviOpacity));
      }
      if (state.vitruviLayerColorOverrides && typeof state.vitruviLayerColorOverrides === "object") {
        vitruviLayerColorOverrides = state.vitruviLayerColorOverrides;
        localStorage.setItem(STORAGE_KEYS.vitruviLayerColors, JSON.stringify(vitruviLayerColorOverrides));
      }
      if (state.vitruviLayerStyleOverrides && typeof state.vitruviLayerStyleOverrides === "object") {
        vitruviLayerStyleOverrides = state.vitruviLayerStyleOverrides;
        localStorage.setItem(STORAGE_KEYS.vitruviLayerStyles, JSON.stringify(vitruviLayerStyleOverrides));
      }
      if (state.vitruviLayerNameOverrides && typeof state.vitruviLayerNameOverrides === "object") {
        vitruviLayerNameOverrides = state.vitruviLayerNameOverrides;
        localStorage.setItem(STORAGE_KEYS.vitruviLayerNames, JSON.stringify(vitruviLayerNameOverrides));
      }
      if (state.vitruviLayerNoteOverrides && typeof state.vitruviLayerNoteOverrides === "object") {
        vitruviLayerNoteOverrides = state.vitruviLayerNoteOverrides;
        localStorage.setItem(STORAGE_KEYS.vitruviLayerNotes, JSON.stringify(vitruviLayerNoteOverrides));
      }
      if (state.vitruviLayerSizeOverrides && typeof state.vitruviLayerSizeOverrides === "object") {
        vitruviLayerSizeOverrides = state.vitruviLayerSizeOverrides;
        localStorage.setItem(STORAGE_KEYS.vitruviLayerSizes, JSON.stringify(vitruviLayerSizeOverrides));
      }
      if (state.vitruviLayerOpacityOverrides && typeof state.vitruviLayerOpacityOverrides === "object") {
        vitruviLayerOpacityOverrides = state.vitruviLayerOpacityOverrides;
        localStorage.setItem(STORAGE_KEYS.vitruviLayerOpacities, JSON.stringify(vitruviLayerOpacityOverrides));
      }
    }
    if (typeof state.vetroSlVisible === "boolean") {
      vetroSlVisible = state.vetroSlVisible;
      writeBooleanStorage(STORAGE_KEYS.vetroSlVisible, vetroSlVisible);
      if (elements.vetroSlToggle) elements.vetroSlToggle.checked = vetroSlVisible;
    }
    if (typeof state.vetroSlShape === "string") {
      vetroSlShape = state.vetroSlShape;
      localStorage.setItem(STORAGE_KEYS.vetroSlShape, vetroSlShape);
      if (elements.vetroSlShape) elements.vetroSlShape.value = vetroSlShape;
    }
    if (typeof state.vetroSlColor === "string") {
      vetroSlColor = state.vetroSlColor;
      localStorage.setItem(STORAGE_KEYS.vetroSlColor, vetroSlColor);
      if (elements.vetroSlColor) elements.vetroSlColor.value = vetroSlColor;
    }
    if (typeof state.vetroSlOutlineColor === "string") {
      vetroSlOutlineColor = state.vetroSlOutlineColor;
      localStorage.setItem(STORAGE_KEYS.vetroSlOutlineColor, vetroSlOutlineColor);
      if (elements.vetroSlOutlineColor) elements.vetroSlOutlineColor.value = vetroSlOutlineColor;
    }
    if (typeof state.vetroSlOpacity === "number") {
      vetroSlOpacity = state.vetroSlOpacity;
      localStorage.setItem(STORAGE_KEYS.vetroSlOpacity, String(vetroSlOpacity));
      if (elements.vetroSlOpacity) elements.vetroSlOpacity.value = String(opacityToPercent(vetroSlOpacity));
    }
    if (typeof state.vetroSlSize === "number") {
      vetroSlSize = state.vetroSlSize;
      localStorage.setItem(STORAGE_KEYS.vetroSlSize, String(vetroSlSize));
      if (elements.vetroSlSize) elements.vetroSlSize.value = String(vetroSlSize);
    }
    if (typeof state.vetroSlLabels === "boolean") {
      vetroSlLabels = state.vetroSlLabels;
      writeBooleanStorage(STORAGE_KEYS.vetroSlLabels, vetroSlLabels);
      if (elements.vetroSlLabels) elements.vetroSlLabels.checked = vetroSlLabels;
    }
    if (typeof state.vetroColor === "string") {
      vetroColor = state.vetroColor;
      localStorage.setItem("vetroColor", vetroColor);
      elements.vetroColor.value = vetroColor;
    }
    if (typeof state.vetroOpacity === "number") {
      vetroOpacity = state.vetroOpacity;
      localStorage.setItem("vetroOpacity", String(vetroOpacity));
      elements.vetroOpacity.value = String(opacityToPercent(vetroOpacity));
    }
    if (typeof state.polygonOpacity === "number") {
      polygonOpacity = state.polygonOpacity;
      localStorage.setItem("polygonOpacity", String(polygonOpacity));
      elements.polygonOpacity.value = String(opacityToPercent(polygonOpacity));
    }
    if (typeof state.ticketOpacity === "number") {
      ticketOpacity = state.ticketOpacity;
      localStorage.setItem(STORAGE_KEYS.ticketOpacity, String(ticketOpacity));
      elements.ticketOpacity.value = String(opacityToPercent(ticketOpacity));
    }
    const nextMapStyle = savedBaseMapStyle(state);
    if (nextMapStyle) {
      mapStyle = nextMapStyle;
      localStorage.setItem(STORAGE_KEYS.mapStyle, mapStyle);
      elements.mapStyle.value = mapStyle;
    }
    if (state.mapView && typeof state.mapView === "object") pendingMapView = state.mapView;
  } finally {
    dashboardStateHydrating = false;
  }
  if (mapStyle) await setMapTileStyle(mapStyle, false);
  if (vetroVisible) await ensureVetroLoaded();
  else renderVetroLayer();
  if (vetroLoaded) populateVetroFilters();
  renderVetroLayer();
  if (map && pendingMapView) {
    const center = pendingMapView.center;
    if (Array.isArray(center) && center.length === 2) map.setView(center, pendingMapView.zoom || map.getZoom());
  }
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
}

function scheduleEmployeeDashboardSync() {
  if (!dashboardStateReady || dashboardStateHydrating || currentProfileMode !== "admin" || !canWriteEmployeeDashboard()) return;
  if (employeeDashboardSyncTimer) window.clearTimeout(employeeDashboardSyncTimer);
  employeeDashboardSyncTimer = window.setTimeout(() => {
    employeeDashboardSyncTimer = null;
    void saveEmployeeDashboard({ enabled: true, state: employeeDashboardStateFromAdminFilters(), toast: false }).catch((error) => {
      console.warn("Unable to sync employee dashboard filters", error);
    });
  }, 550);
}

function applyEmployeeDashboardState() {
  applyDashboardState(employeeDashboardState() || employeeFallbackState());
  if (map && pendingMapView) {
    const center = pendingMapView.center;
    if (Array.isArray(center) && center.length === 2) {
      map.setView(center, pendingMapView.zoom || map.getZoom());
    } else if (center && typeof center.lat === "number" && typeof center.lng === "number") {
      map.setView([center.lat, center.lng], pendingMapView.zoom || map.getZoom());
    }
  }
  render();
  renderVetroLayer();
}

function updateDashboardMenuLabel() {
  if (!elements.showDashboardView) return;
  elements.showDashboardView.textContent = "Dashboard";
}

function applyAuditAccess(username = "") {
  if (elements.showActivityView) elements.showActivityView.hidden = username !== "site_owner" && !canWriteEmployeeDashboard();
  if (elements.showMobileAdminView) elements.showMobileAdminView.hidden = !canWriteEmployeeDashboard();
  if (elements.vetroCaptureTool) elements.vetroCaptureTool.hidden = username !== "site_owner";
  if (elements.vitruviDrawer) elements.vitruviDrawer.hidden = username !== "site_owner";
  if (username !== "site_owner") {
    vitruviVisible = false;
    if (elements.vitruviToggle) elements.vitruviToggle.checked = false;
    renderVitruviLayer();
  }
}

function canWriteEmployeeDashboard() {
  return currentUserRole === "admin" && (currentUsername === "administrator" || currentUsername === "site_owner");
}

function isSiteOwner() {
  return currentUsername === "site_owner";
}

function canEditVetroAppearance() {
  return currentUserRole === "admin" && currentProfileMode === "admin";
}

function applySharedDashboardAccess() {
  const canWrite = canWriteEmployeeDashboard();
  if (elements.saveEmployeeDashboard) {
    elements.saveEmployeeDashboard.hidden = !canWrite;
    elements.saveEmployeeDashboard.disabled = !canWrite;
  }
  if (elements.saveSharedFieldDefault) {
    elements.saveSharedFieldDefault.hidden = !canWrite;
    elements.saveSharedFieldDefault.disabled = !canWrite;
  }
  if (elements.showMobileAdminView) elements.showMobileAdminView.hidden = !canWrite;
  if (elements.mobileSaveEmployeeDashboard) {
    elements.mobileSaveEmployeeDashboard.hidden = !canWrite;
    elements.mobileSaveEmployeeDashboard.disabled = !canWrite;
  }
  if (elements.showEmployeeView) elements.showEmployeeView.hidden = currentUserRole === "employee";
  if (elements.showAdminView) elements.showAdminView.hidden = currentUserRole === "employee";
}

function setProfileMode(mode) {
  if (currentUserRole === "employee") mode = "employee";
  const nextMode = mode === "employee" ? "employee" : "admin";
  if (nextMode === currentProfileMode) {
    updateDashboardMenuLabel();
    setCurrentView("dashboard");
    return;
  }
  if (nextMode === "employee") {
    adminPreviewState = dashboardStatePayload();
    const targetEmployeeView = employeeDashboardState()?.employeeViewMode === "mobile" ? "mobile" : "dashboard";
    currentProfileMode = "employee";
    document.body.classList.add("employee-mode");
    if (elements.employeeBar) elements.employeeBar.hidden = false;
    applyEmployeeDashboardState();
    renderProfile();
    updateDashboardMenuLabel();
    setCurrentView(targetEmployeeView);
    return;
  } else {
    currentProfileMode = "admin";
    document.body.classList.remove("employee-mode");
    if (elements.employeeBar) elements.employeeBar.hidden = true;
    if (adminPreviewState) {
      applyDashboardState(adminPreviewState);
      adminPreviewState = null;
      render();
      renderVetroLayer();
    }
  }
  renderProfile();
  updateDashboardMenuLabel();
  setCurrentView("dashboard");
}

function setCurrentView(view) {
  if (view === "mobile-admin") view = "admin-console";
  if (view === "admin-console" && !canWriteEmployeeDashboard()) view = "dashboard";
  currentView = view === "sheet" || view === "restoration" || view === "in-house-requests" || view === "location-photos" || view === "live-tickets" || view === "mobile" || view === "activity" || view === "admin-console" ? view : "dashboard";
  document.body.classList.toggle("sheet-mode", currentView === "sheet");
  document.body.classList.toggle("restoration-mode", currentView === "restoration");
  document.body.classList.toggle("in-house-requests-mode", currentView === "in-house-requests");
  document.body.classList.toggle("location-photos-mode", currentView === "location-photos");
  document.body.classList.toggle("live-tickets-mode", currentView === "live-tickets");
  document.body.classList.toggle("mobile-mode", currentView === "mobile");
  document.body.classList.toggle("activity-mode", currentView === "activity");
  document.body.classList.toggle("mobile-admin-mode", currentView === "admin-console");
  document.body.classList.toggle("admin-console-mode", currentView === "admin-console");
  document.body.classList.toggle("mobile-map-open", currentView === "mobile" && mobilePanel === "map");
  if (elements.sheetView) elements.sheetView.hidden = currentView !== "sheet";
  if (elements.restorationView) elements.restorationView.hidden = currentView !== "restoration";
  if (elements.inHouseRequestsView) elements.inHouseRequestsView.hidden = currentView !== "in-house-requests";
  if (elements.locationPhotosView) elements.locationPhotosView.hidden = currentView !== "location-photos";
  if (elements.liveTicketsView) elements.liveTicketsView.hidden = currentView !== "live-tickets";
  if (elements.mobileView) elements.mobileView.hidden = currentView !== "mobile";
  if (elements.activityView) elements.activityView.hidden = currentView !== "activity";
  if (elements.mobileAdminView) elements.mobileAdminView.hidden = currentView !== "admin-console";
  if (currentView === "sheet") {
    if (elements.sheetSearch) elements.sheetSearch.value = ticketSearch;
    historicalDigTicketSearch = ticketSearch;
    renderSheetView();
    void loadHistoricalDigTickets().then(renderSheetView);
  } else if (currentView === "restoration") {
    renderRestorationView();
    void loadRestorationJobs().then(renderRestorationView).catch((error) => {
      if (elements.restorationFormStatus) elements.restorationFormStatus.textContent = error.message || "Restoration jobs failed to load.";
      console.error(error);
    });
  } else if (currentView === "in-house-requests") {
    fillInHouseForm({});
    if (elements.inHouseFormStatus) elements.inHouseFormStatus.textContent = "Ready for a new in-house locate request.";
    renderInHouseRequestsView();
    void loadInHouseRequests().then(renderInHouseRequestsView).catch((error) => {
      if (elements.inHouseFormStatus) elements.inHouseFormStatus.textContent = error.message || "In-house requests failed to load.";
      console.error(error);
    });
  } else if (currentView === "live-tickets") {
    renderLiveTicketsView();
  } else if (currentView === "location-photos") {
    renderLocationPhotosView();
    requestAnimationFrame(() => {
      initLocationPhotosMap();
      renderLocationPhotosMap();
    });
    void loadLocationPhotos().then(renderLocationPhotosView).catch((error) => {
      if (elements.locationPhotosStatus) elements.locationPhotosStatus.textContent = error.message || "Location photos failed to load.";
      console.error(error);
    });
  } else if (currentView === "mobile") {
    renderMobileView();
  } else if (currentView === "admin-console") {
    renderMobileAdminConfig();
    void loadEmployeeAccess();
  } else if (currentView === "activity") {
    void loadActivity().catch((error) => {
      if (elements.activityList) elements.activityList.innerHTML = `<div class="detail-content">${escapeHtml(error.message)}</div>`;
      console.error(error);
    });
  } else if (map) {
    requestAnimationFrame(() => map.invalidateSize());
  }
  if (window.location.hash !== `#${currentView}`) {
    if (currentView === "dashboard") history.replaceState(null, "", window.location.pathname + window.location.search);
    else history.replaceState(null, "", `#${currentView}`);
  }
  closeMoreMenu();
}

function setDashboardTicketMode(mode) {
  dashboardTicketMode = "main";
  localStorage.setItem("dashboardTicketMode", dashboardTicketMode);
  document.body.classList.remove("tcw-dashboard-mode");
  if (elements.sourcePath && tickets.length) {
    elements.sourcePath.dataset.dashboardMode = "Fiber Locator";
  }
  selectedTicket = null;
  pendingSelectedTicketNumber = "";
  localStorage.removeItem("selectedTicketNumber");
  setCurrentView("dashboard");
  render();
}

function captureTicketListScroll() {
  if (!elements.ticketList) return;
  pendingTicketListScroll = {
    top: elements.ticketList.scrollTop,
    left: elements.ticketList.scrollLeft,
  };
}

function restoreTicketListScroll() {
  if (!elements.ticketList) return;
  const { top, left } = pendingTicketListScroll;
  requestAnimationFrame(() => {
    elements.ticketList.scrollTop = top;
    elements.ticketList.scrollLeft = left;
    requestAnimationFrame(() => {
      elements.ticketList.scrollTop = top;
      elements.ticketList.scrollLeft = left;
    });
  });
}

function closeDashboardLayerDrawers() {
  for (const drawer of elements.layerDrawers || []) {
    drawer.open = false;
  }
}

function applyTicketListScrolled() {
  const scrolled = Boolean(elements.ticketList && elements.ticketList.scrollTop > 24);
  if (scrolled === ticketListScrolled) return;
  ticketListScrolled = scrolled;
  document.body.classList.toggle("ticket-list-scrolled", ticketListScrolled);
  if (map) requestAnimationFrame(() => map.invalidateSize());
}

function dashboardStatePayload({ employeeViewMode = currentView, applyCheckpoint = true } = {}) {
  if (applyCheckpoint) applyTicketListCheckpoint();
  return {
    hiddenTickets: [...hiddenTickets],
    archivedTickets: [...archivedTickets],
    hiddenTicketUpdatedAt,
    archivedTicketUpdatedAt,
    ticketActions,
    ticketActionUpdatedAt,
    ticketDescriptions,
    ticketMarkedBy,
    ticketPriorities,
    ticketListCheckpoint,
    showHiddenTickets,
    ticketSearch,
    countyFilterAll,
    countyFilterSelected: [...selectedCounties],
    vetroVisible,
    vetroLayerFilterSelected: [...vetroSelectedLayers],
    vetroPlanFilterSelected: [...vetroSelectedPlans],
    vetroBuildFilterSelected: [...vetroSelectedBuilds],
    vetroPlacementFilterSelected: [...vetroSelectedPlacements],
    vetroStatusFilterSelected: [...vetroSelectedStatuses],
    vetroGeometryFilterSelected: [...vetroSelectedGeometries],
    vetroFiberFilterSelected: [...vetroSelectedFibers],
    vetroRouteFilterSelected: [...vetroSelectedRoutes],
    vetroPointFilterSelected: [...vetroSelectedPoints],
    vetroLayerColorOverrides,
    vetroLayerStyleOverrides,
    vetroLayerNameOverrides,
    vetroLayerNoteOverrides,
    vetroLayerSizeOverrides,
    vetroLayerOpacityOverrides,
    vitruviVisible: isSiteOwner() ? vitruviVisible : false,
    vitruviLayerFilterSelected: isSiteOwner() ? [...vitruviSelectedLayers] : [],
    vitruviSearch: isSiteOwner() ? vitruviSearch : "",
    vitruviOpacity: isSiteOwner() ? vitruviOpacity : 0.82,
    vitruviLayerColorOverrides: isSiteOwner() ? vitruviLayerColorOverrides : {},
    vitruviLayerStyleOverrides: isSiteOwner() ? vitruviLayerStyleOverrides : {},
    vitruviLayerNameOverrides: isSiteOwner() ? vitruviLayerNameOverrides : {},
    vitruviLayerNoteOverrides: isSiteOwner() ? vitruviLayerNoteOverrides : {},
    vitruviLayerSizeOverrides: isSiteOwner() ? vitruviLayerSizeOverrides : {},
    vitruviLayerOpacityOverrides: isSiteOwner() ? vitruviLayerOpacityOverrides : {},
    vetroSlVisible,
    vetroSlShape,
    vetroSlColor,
    vetroSlOutlineColor,
    vetroSlOpacity,
    vetroSlSize,
    vetroSlLabels,
    vetroSearch,
    vetroColor,
    vetroOpacity,
    polygonColor,
    polygonOpacity,
    ticketOpacity,
    mapStyle,
    baseMapStyle: mapStyle,
    baseMap: mapStyle,
    mapDataOverlay: effectiveMapDataOverlay(),
    sidebarCollapsed,
    locatorProfile,
    employeeViewMode: employeeViewMode === "mobile" ? "mobile" : "dashboard",
    selectedTicketNumber: selectedTicket?.ticket_number || pendingSelectedTicketNumber || "",
    mapView: currentMapViewPayload(),
  };
}

function ticketWorkflowStatePayload() {
  applyTicketListCheckpoint();
  return {
    hiddenTickets: [...hiddenTickets],
    archivedTickets: [...archivedTickets],
    hiddenTicketUpdatedAt,
    archivedTicketUpdatedAt,
    ticketActions,
    ticketActionUpdatedAt,
    ticketDescriptions,
    ticketMarkedBy,
    ticketListCheckpoint,
  };
}

function applyDashboardState(state) {
  if (!state || typeof state !== "object") return;
  dashboardStateHydrating = true;
  try {
    if (Array.isArray(state.hiddenTickets)) {
      hiddenTickets = new Set(state.hiddenTickets.map(String));
      writeJsonStorage(STORAGE_KEYS.hiddenTickets, [...hiddenTickets]);
    }
    if (Array.isArray(state.archivedTickets)) {
      archivedTickets = new Set(state.archivedTickets.map(String));
      writeJsonStorage(STORAGE_KEYS.archivedTickets, [...archivedTickets]);
    }
    if (state.hiddenTicketUpdatedAt && typeof state.hiddenTicketUpdatedAt === "object") {
      hiddenTicketUpdatedAt = normalizeTicketActionUpdatedAt(state.hiddenTicketUpdatedAt);
      writeJsonStorage(STORAGE_KEYS.hiddenTicketUpdatedAt, hiddenTicketUpdatedAt);
    }
    if (state.archivedTicketUpdatedAt && typeof state.archivedTicketUpdatedAt === "object") {
      archivedTicketUpdatedAt = normalizeTicketActionUpdatedAt(state.archivedTicketUpdatedAt);
      writeJsonStorage(STORAGE_KEYS.archivedTicketUpdatedAt, archivedTicketUpdatedAt);
    }
    if (state.ticketActions && typeof state.ticketActions === "object") {
      ticketActions = normalizeTicketActions(state.ticketActions);
      writeJsonStorage(STORAGE_KEYS.ticketActions, ticketActions);
    }
    if (state.ticketActionUpdatedAt && typeof state.ticketActionUpdatedAt === "object") {
      ticketActionUpdatedAt = normalizeTicketActionUpdatedAt(state.ticketActionUpdatedAt);
      writeJsonStorage(STORAGE_KEYS.ticketActionUpdatedAt, ticketActionUpdatedAt);
    }
    if (state.ticketDescriptions && typeof state.ticketDescriptions === "object") {
      ticketDescriptions = normalizeTicketDescriptions(state.ticketDescriptions);
      writeJsonStorage(STORAGE_KEYS.ticketDescriptions, ticketDescriptions);
    }
    if (state.ticketMarkedBy && typeof state.ticketMarkedBy === "object") {
      ticketMarkedBy = normalizeTicketMarkedBy(state.ticketMarkedBy);
      writeJsonStorage(STORAGE_KEYS.ticketMarkedBy, ticketMarkedBy);
    }
    if (state.ticketPriorities && typeof state.ticketPriorities === "object") {
      ticketPriorities = normalizeTicketPriorities(state.ticketPriorities);
      writeJsonStorage(STORAGE_KEYS.ticketPriorities, ticketPriorities);
    }
    if ("ticketListCheckpoint" in state) {
      ticketListCheckpoint = normalizeTicketListCheckpoint(state.ticketListCheckpoint);
      writeTicketListCheckpoint();
    }
    if (typeof state.showHiddenTickets === "boolean") {
      showHiddenTickets = state.showHiddenTickets;
      writeBooleanStorage(STORAGE_KEYS.showHidden, showHiddenTickets);
    }
    if (typeof state.ticketSearch === "string") {
      ticketSearch = state.ticketSearch;
      localStorage.setItem("ticketSearch", ticketSearch);
      syncTicketSearchInputs();
      historicalDigTicketSearch = ticketSearch;
    }
    if (state.locatorProfile && typeof state.locatorProfile === "object") {
      locatorProfile = normalizeProfile(state.locatorProfile);
      writeJsonStorage(STORAGE_KEYS.profile, locatorProfile);
      renderProfile();
    }
    if (typeof state.countyFilterAll === "boolean") {
      countyFilterAll = state.countyFilterAll;
      writeBooleanStorage(STORAGE_KEYS.countyFilterAll, countyFilterAll);
    }
    if (Array.isArray(state.countyFilterSelected)) {
      selectedCounties = new Set(state.countyFilterSelected.map(String));
      writeJsonStorage(STORAGE_KEYS.countyFilterSelected, [...selectedCounties]);
    } else if (typeof state.countyFilter === "string" && state.countyFilter) {
      countyFilterAll = false;
      writeBooleanStorage(STORAGE_KEYS.countyFilterAll, countyFilterAll);
      selectedCounties = new Set([state.countyFilter]);
      writeJsonStorage(STORAGE_KEYS.countyFilterSelected, [...selectedCounties]);
    }
    if (typeof state.vetroVisible === "boolean") {
      vetroVisible = state.vetroVisible;
      writeBooleanStorage(STORAGE_KEYS.vetroVisible, vetroVisible);
      elements.vetroToggle.checked = vetroVisible;
    }
    if (Array.isArray(state.vetroLayerFilterSelected)) {
      vetroSelectedLayers = new Set(state.vetroLayerFilterSelected.map(String));
      writeJsonStorage(STORAGE_KEYS.vetroLayers, [...vetroSelectedLayers]);
    }
    if (Array.isArray(state.vetroPlanFilterSelected)) {
      vetroSelectedPlans = new Set(state.vetroPlanFilterSelected.map(String));
      writeJsonStorage(STORAGE_KEYS.vetroPlan, [...vetroSelectedPlans]);
    }
    if (Array.isArray(state.vetroBuildFilterSelected)) {
      vetroSelectedBuilds = new Set(state.vetroBuildFilterSelected.map(String));
      writeJsonStorage(STORAGE_KEYS.vetroBuild, [...vetroSelectedBuilds]);
    }
    if (Array.isArray(state.vetroPlacementFilterSelected)) {
      vetroSelectedPlacements = new Set(state.vetroPlacementFilterSelected.map(String));
      writeJsonStorage(STORAGE_KEYS.vetroPlacement, [...vetroSelectedPlacements]);
    }
    if (Array.isArray(state.vetroStatusFilterSelected)) {
      vetroSelectedStatuses = new Set(state.vetroStatusFilterSelected.map(String));
      writeJsonStorage(STORAGE_KEYS.vetroStatus, [...vetroSelectedStatuses]);
    }
    if (Array.isArray(state.vetroGeometryFilterSelected)) {
      vetroSelectedGeometries = new Set(state.vetroGeometryFilterSelected.map(String));
      writeJsonStorage(STORAGE_KEYS.vetroGeometry, [...vetroSelectedGeometries]);
    }
    if (Array.isArray(state.vetroFiberFilterSelected)) {
      vetroSelectedFibers = new Set(state.vetroFiberFilterSelected.map(String));
      writeJsonStorage(STORAGE_KEYS.vetroFiber, [...vetroSelectedFibers]);
    }
    if (Array.isArray(state.vetroRouteFilterSelected)) {
      vetroSelectedRoutes = new Set(state.vetroRouteFilterSelected.map(String));
      writeJsonStorage(STORAGE_KEYS.vetroRoute, [...vetroSelectedRoutes]);
    }
    if (Array.isArray(state.vetroPointFilterSelected)) {
      vetroSelectedPoints = new Set(state.vetroPointFilterSelected.map(String));
      writeJsonStorage(STORAGE_KEYS.vetroPoint, [...vetroSelectedPoints]);
    }
    if (state.vetroLayerColorOverrides && typeof state.vetroLayerColorOverrides === "object") {
      vetroLayerColorOverrides = state.vetroLayerColorOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerColors, JSON.stringify(vetroLayerColorOverrides));
    }
    if (state.vetroLayerStyleOverrides && typeof state.vetroLayerStyleOverrides === "object") {
      vetroLayerStyleOverrides = state.vetroLayerStyleOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerStyles, JSON.stringify(vetroLayerStyleOverrides));
    }
    if (state.vetroLayerNameOverrides && typeof state.vetroLayerNameOverrides === "object") {
      vetroLayerNameOverrides = state.vetroLayerNameOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerNames, JSON.stringify(vetroLayerNameOverrides));
    }
    if (state.vetroLayerNoteOverrides && typeof state.vetroLayerNoteOverrides === "object") {
      vetroLayerNoteOverrides = state.vetroLayerNoteOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerNotes, JSON.stringify(vetroLayerNoteOverrides));
    }
    if (state.vetroLayerSizeOverrides && typeof state.vetroLayerSizeOverrides === "object") {
      vetroLayerSizeOverrides = state.vetroLayerSizeOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerSizes, JSON.stringify(vetroLayerSizeOverrides));
    }
    if (state.vetroLayerOpacityOverrides && typeof state.vetroLayerOpacityOverrides === "object") {
      vetroLayerOpacityOverrides = state.vetroLayerOpacityOverrides;
      localStorage.setItem(STORAGE_KEYS.vetroLayerOpacities, JSON.stringify(vetroLayerOpacityOverrides));
    }
    if (typeof state.vetroSlVisible === "boolean") {
      vetroSlVisible = state.vetroSlVisible;
      writeBooleanStorage(STORAGE_KEYS.vetroSlVisible, vetroSlVisible);
      if (elements.vetroSlToggle) elements.vetroSlToggle.checked = vetroSlVisible;
    }
    if (typeof state.vetroSlShape === "string") {
      vetroSlShape = state.vetroSlShape;
      localStorage.setItem(STORAGE_KEYS.vetroSlShape, vetroSlShape);
      if (elements.vetroSlShape) elements.vetroSlShape.value = vetroSlShape;
    }
    if (typeof state.vetroSlColor === "string") {
      vetroSlColor = state.vetroSlColor;
      localStorage.setItem(STORAGE_KEYS.vetroSlColor, vetroSlColor);
      if (elements.vetroSlColor) elements.vetroSlColor.value = vetroSlColor;
    }
    if (typeof state.vetroSlOutlineColor === "string") {
      vetroSlOutlineColor = state.vetroSlOutlineColor;
      localStorage.setItem(STORAGE_KEYS.vetroSlOutlineColor, vetroSlOutlineColor);
      if (elements.vetroSlOutlineColor) elements.vetroSlOutlineColor.value = vetroSlOutlineColor;
    }
    if (typeof state.vetroSlOpacity === "number") {
      vetroSlOpacity = state.vetroSlOpacity;
      localStorage.setItem(STORAGE_KEYS.vetroSlOpacity, String(vetroSlOpacity));
      if (elements.vetroSlOpacity) elements.vetroSlOpacity.value = String(opacityToPercent(vetroSlOpacity));
    }
    if (typeof state.vetroSlSize === "number") {
      vetroSlSize = state.vetroSlSize;
      localStorage.setItem(STORAGE_KEYS.vetroSlSize, String(vetroSlSize));
      if (elements.vetroSlSize) elements.vetroSlSize.value = String(vetroSlSize);
    }
    if (typeof state.vetroSlLabels === "boolean") {
      vetroSlLabels = state.vetroSlLabels;
      writeBooleanStorage(STORAGE_KEYS.vetroSlLabels, vetroSlLabels);
      if (elements.vetroSlLabels) elements.vetroSlLabels.checked = vetroSlLabels;
    }
    if (typeof state.vetroSearch === "string") {
      vetroSearch = state.vetroSearch;
      localStorage.setItem(STORAGE_KEYS.vetroSearch, vetroSearch);
      elements.vetroSearch.value = vetroSearch;
    }
    if (typeof state.vetroColor === "string") {
      vetroColor = state.vetroColor;
      localStorage.setItem("vetroColor", vetroColor);
      elements.vetroColor.value = vetroColor;
    }
    if (typeof state.vetroOpacity === "number") {
      vetroOpacity = state.vetroOpacity;
      localStorage.setItem("vetroOpacity", String(vetroOpacity));
      elements.vetroOpacity.value = String(opacityToPercent(vetroOpacity));
    }
    if (typeof state.polygonColor === "string") {
      polygonColor = state.polygonColor;
      localStorage.setItem("polygonColor", polygonColor);
      elements.polygonColor.value = polygonColor;
    }
    if (typeof state.polygonOpacity === "number") {
      polygonOpacity = state.polygonOpacity;
      localStorage.setItem("polygonOpacity", String(polygonOpacity));
      elements.polygonOpacity.value = String(opacityToPercent(polygonOpacity));
    }
    if (typeof state.ticketOpacity === "number") {
      ticketOpacity = state.ticketOpacity;
      localStorage.setItem(STORAGE_KEYS.ticketOpacity, String(ticketOpacity));
      elements.ticketOpacity.value = String(opacityToPercent(ticketOpacity));
    }
    const nextMapStyle = savedBaseMapStyle(state);
    if (nextMapStyle) {
      mapStyle = nextMapStyle;
      localStorage.setItem(STORAGE_KEYS.mapStyle, mapStyle);
      elements.mapStyle.value = mapStyle;
    }
    if (isValidMapDataOverlay(state.mapDataOverlay)) {
      mapDataOverlay = state.mapDataOverlay;
      localStorage.setItem(STORAGE_KEYS.mapDataOverlay, mapDataOverlay);
    } else {
      mapDataOverlay = "none";
      localStorage.removeItem(STORAGE_KEYS.mapDataOverlay);
    }
    if (typeof state.sidebarCollapsed === "boolean") {
      sidebarCollapsed = state.sidebarCollapsed;
      writeBooleanStorage(STORAGE_KEYS.sidebarCollapsed, sidebarCollapsed);
      applySidebarCollapsed();
    }
    if (typeof state.selectedTicketNumber === "string") {
    pendingSelectedTicketNumber = state.selectedTicketNumber;
    localStorage.setItem("selectedTicketNumber", pendingSelectedTicketNumber);
    }
    if (state.mapView && typeof state.mapView === "object") {
      pendingMapView = state.mapView;
    }
  } finally {
    dashboardStateHydrating = false;
  }
  applyTicketListCheckpoint();
}

function scheduleDashboardStateSave() {
  if (!dashboardStateReady || dashboardStateHydrating) return;
  if (dashboardStateSaveTimer) window.clearTimeout(dashboardStateSaveTimer);
  dashboardStateSaveTimer = window.setTimeout(() => {
    dashboardStateSaveTimer = null;
    void saveDashboardState();
  }, 400);
}

async function saveDashboardState(stateOverride = null, { force = false } = {}) {
  if ((!dashboardStateReady || dashboardStateHydrating) && !force) return;
  if (currentProfileMode === "employee") {
    if (canWriteEmployeeDashboard()) {
      await saveEmployeeDashboard({ enabled: true, state: employeeWritableStatePayload(), toast: false });
      return;
    }
    stateOverride = employeeWritableStatePayload();
  }
  const state = stateOverride && typeof stateOverride === "object" ? stateOverride : dashboardStatePayload();
  const response = await fetch("/api/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(state),
  });
  if (!response.ok) {
    throw new Error(`Failed to save dashboard state: ${response.status}`);
  }
}

async function savePersonalDashboardState(stateOverride = null) {
  const state = stateOverride && typeof stateOverride === "object" ? stateOverride : dashboardStatePayload();
  const response = await fetch("/api/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(state),
  });
  if (!response.ok) {
    throw new Error(`Failed to save dashboard state: ${response.status}`);
  }
}

async function saveTicketWorkflowStateToServer() {
  if (!dashboardStateReady || dashboardStateHydrating) return;
  const response = await fetch("/api/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ticketWorkflowStatePayload()),
  });
  if (!response.ok) {
    throw new Error(`Failed to save ticket workflow state: ${response.status}`);
  }
}

async function saveTicketWorkflowStateNow() {
  if (!dashboardStateReady || dashboardStateHydrating) return;
  if (ticketWorkflowSaveTimer) {
    window.clearTimeout(ticketWorkflowSaveTimer);
    ticketWorkflowSaveTimer = null;
  }
  await saveTicketWorkflowStateToServer();
}

function scheduleTicketWorkflowServerSave() {
  if (!dashboardStateReady || dashboardStateHydrating) return;
  if (ticketWorkflowSaveTimer) window.clearTimeout(ticketWorkflowSaveTimer);
  ticketWorkflowSaveTimer = window.setTimeout(() => {
    ticketWorkflowSaveTimer = null;
    void saveTicketWorkflowStateToServer().catch((error) => {
      console.warn("Unable to save ticket workflow state", error);
    });
  }, 150);
}

function flushTicketWorkflowState() {
  if (!dashboardStateReady || dashboardStateHydrating) return;
  if (ticketWorkflowSaveTimer) {
    window.clearTimeout(ticketWorkflowSaveTimer);
    ticketWorkflowSaveTimer = null;
  }
  const payload = JSON.stringify(ticketWorkflowStatePayload());
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon("/api/state", blob)) return;
  }
  void fetch("/api/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
    keepalive: true,
  }).catch((error) => {
    console.warn("Unable to flush ticket workflow state", error);
  });
}

async function saveEmployeeDashboard({ enabled = true, state = dashboardStatePayload(), toast = true } = {}) {
  if (!canWriteEmployeeDashboard()) {
    if (toast) showSavedToast("Shared dashboard access denied");
    return employeeDashboardConfig;
  }
  if (toast) showSavedToast("Saving employee dashboard...");
  const response = await fetch("/api/employee-dashboard", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled, state }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save employee dashboard: ${response.status}`);
  }
  const payload = await response.json();
  employeeDashboardConfig = payload.employeeDashboard || { enabled, state };
  if (toast) showSavedToast("Employee dashboard saved");
  auditEvent("employee_dashboard_saved_client", { enabled });
  return employeeDashboardConfig;
}

async function saveLocatorDefault({ enabled = true, state = dashboardStatePayload() } = {}) {
  if (!canWriteEmployeeDashboard()) return locatorDefaultConfig;
  const response = await fetch("/api/locator-default", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled, state }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save locator default: ${response.status}`);
  }
  const payload = await response.json();
  locatorDefaultConfig = payload.locatorDefault || { enabled, state };
  return locatorDefaultConfig;
}

async function saveAppViewPreset(state) {
  const response = await fetch("/api/view-presets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: "app view",
      name: "app view",
      state,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save app view: ${response.status}`);
  }
  const payload = await response.json();
  viewPresets = normalizeViewPresets(payload.viewPresets || []);
  selectedSavedViewId = String(payload.savedView?.id || "app view");
  renderSavedViewControls();
  return selectedSavedView();
}

async function saveSharedFieldDefault() {
  if (!canWriteEmployeeDashboard()) {
    showSavedToast("Shared dashboard access denied");
    return;
  }
  const state = dashboardStatePayload({ employeeViewMode: "dashboard" });
  if (elements.saveSharedFieldDefault) elements.saveSharedFieldDefault.disabled = true;
  showSavedToast("Saving employee dashboard default...");
  try {
    employeeDashboardConfig = await saveEmployeeDashboard({ enabled: true, state, toast: false });
    renderMobileAdminConfig();
    showSavedToast("Employee dashboard default saved");
    auditEvent("employee_dashboard_default_saved_client", { target: "web" });
  } finally {
    if (elements.saveSharedFieldDefault) elements.saveSharedFieldDefault.disabled = false;
  }
}

function mobileAppUrl() {
  return `${window.location.origin}/mobile`;
}

function renderMobileAdminConfig() {
  if (!elements.mobileAdminView) return;
  const openList = mobileOpenTickets();
  const doneList = mobileDoneTickets();
  const mappedCount = visibleTickets().filter((ticket) => ticket.polygon || (Number.isFinite(Number(ticket.latitude)) && Number.isFinite(Number(ticket.longitude)))).length;
  if (elements.mobileConfigOpenCount) elements.mobileConfigOpenCount.textContent = openList.length.toLocaleString();
  if (elements.mobileConfigDoneCount) elements.mobileConfigDoneCount.textContent = doneList.length.toLocaleString();
  if (elements.mobileConfigMapCount) elements.mobileConfigMapCount.textContent = mappedCount.toLocaleString();
  if (elements.mobileConfigStartMode) elements.mobileConfigStartMode.textContent = employeeDashboardConfig?.state?.employeeViewMode === "mobile" ? "Mobile field app" : "Tickets";
  if (elements.mobileConfigSavedAt) {
    const savedAt = employeeDashboardConfig?.saved_at ? formatDashboardDateTime(employeeDashboardConfig.saved_at) : "";
    elements.mobileConfigSavedAt.textContent = savedAt || "Not published yet";
  }
  for (const item of [elements.mobileInstallUrlIos, elements.mobileInstallUrlAndroid]) {
    if (item) item.textContent = mobileAppUrl();
  }
  if (elements.openMobileAppLink) elements.openMobileAppLink.href = mobileAppUrl();
}

async function publishMobileConfig() {
  if (!canWriteEmployeeDashboard()) return;
  if (elements.publishMobileConfig) elements.publishMobileConfig.disabled = true;
  if (elements.mobileConfigStatus) elements.mobileConfigStatus.textContent = "Publishing the current dashboard filters, map, tickets, and VETRO layers...";
  try {
    const state = dashboardStatePayload({ employeeViewMode: "mobile" });
    employeeDashboardConfig = await saveEmployeeDashboard({ enabled: true, state, toast: false });
    if (elements.mobileConfigStatus) elements.mobileConfigStatus.textContent = "Mobile app config published.";
    showSavedToast("Mobile app config published");
    renderMobileAdminConfig();
  } catch (error) {
    if (elements.mobileConfigStatus) elements.mobileConfigStatus.textContent = error.message || "Mobile config publish failed.";
    showSavedToast("Mobile config failed");
    console.error(error);
  } finally {
    if (elements.publishMobileConfig) elements.publishMobileConfig.disabled = false;
  }
}

function renderEmployeeAccess(payload = {}) {
  if (!elements.employeeAccessList) return;
  const users = Array.isArray(payload.users) ? payload.users : [];
  const invites = Array.isArray(payload.invites) ? payload.invites : [];
  const accountRequests = Array.isArray(payload.account_requests) ? payload.account_requests : [];
  const employeeUsers = users.filter((item) => item.role === "employee");
  const pendingInvites = invites.filter((item) => !item.used_at);
  const usedInvites = invites.filter((item) => item.used_at).slice(0, 8);
  const userRows = employeeUsers.length
    ? employeeUsers.map((item) => `<li><strong>${escapeHtml(item.display_name || item.username)}</strong><span>${escapeHtml(item.username)}${item.password_set_at ? ` · active ${escapeHtml(formatDashboardDateTime(item.password_set_at))}` : ""}</span></li>`).join("")
    : "<li><strong>No employee accounts yet</strong><span>Create a setup link below.</span></li>";
  const inviteRows = pendingInvites.length
    ? pendingInvites.map((item) => `<li><strong>${escapeHtml(item.display_name || item.username)}</strong><span>${escapeHtml(item.username)} · pending from ${escapeHtml(formatDashboardDateTime(item.created_at))}</span></li>`).join("")
    : "<li><strong>No pending invites</strong><span>New invite links appear here until they are used.</span></li>";
  const requestRows = accountRequests.length
    ? accountRequests.map((item) => `<li><strong>${escapeHtml(item.display_name || item.email || "Account request")}</strong><span>${escapeHtml(item.email || "")}${item.phone ? ` · ${escapeHtml(item.phone)}` : ""}${item.requested_at ? ` · ${escapeHtml(formatDashboardDateTime(item.requested_at))}` : ""}</span></li>`).join("")
    : "<li><strong>No account requests</strong><span>Requests from the Android app login screen appear here.</span></li>";
  const usedRows = usedInvites.length
    ? `<div class="employee-used-invites"><strong>Recently used</strong><ul>${usedInvites.map((item) => `<li>${escapeHtml(item.username)} · ${escapeHtml(formatDashboardDateTime(item.used_at))}</li>`).join("")}</ul></div>`
    : "";
  elements.employeeAccessList.innerHTML = `
    <div class="employee-access-group">
      <h4>Active employees</h4>
      <ul>${userRows}</ul>
    </div>
    <div class="employee-access-group">
      <h4>Pending setup links</h4>
      <ul>${inviteRows}</ul>
    </div>
    <div class="employee-access-group">
      <h4>Account requests</h4>
      <ul>${requestRows}</ul>
    </div>
    ${usedRows}
  `;
}

async function loadEmployeeAccess() {
  if (!elements.employeeAccessList || !canWriteEmployeeDashboard()) return;
  try {
    const response = await fetch("/api/employees");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.message || `Employee access failed: ${response.status}`);
    renderEmployeeAccess(payload);
  } catch (error) {
    elements.employeeAccessList.innerHTML = `<div class="mobile-admin-status">${escapeHtml(error.message || "Unable to load employees.")}</div>`;
  }
}

function renderInviteLink(inviteUrl, invite = {}) {
  if (!elements.employeeInviteLink) return;
  const smsText = `Fiber Locator setup link: ${inviteUrl}`;
  elements.employeeInviteLink.hidden = false;
  elements.employeeInviteLink.innerHTML = `
    <strong>Setup link for ${escapeHtml(invite.display_name || invite.username || "employee")}</strong>
    <input readonly value="${escapeHtml(inviteUrl)}">
    <div>
      <button type="button" data-copy-invite-link>Copy link</button>
      <a href="sms:?&body=${encodeURIComponent(smsText)}">Text</a>
      <a href="mailto:?subject=${encodeURIComponent("Fiber Locator setup")}&body=${encodeURIComponent(smsText)}">Email</a>
    </div>
  `;
  const copyButton = elements.employeeInviteLink.querySelector("[data-copy-invite-link]");
  if (copyButton) copyButton.addEventListener("click", () => copyText(inviteUrl, "Invite link copied"));
}

async function createEmployeeInvite(event) {
  event.preventDefault();
  if (!elements.employeeInviteForm || !canWriteEmployeeDashboard()) return;
  const username = elements.employeeUsername?.value || "";
  const displayName = elements.employeeDisplayName?.value || "";
  if (elements.employeeInviteStatus) elements.employeeInviteStatus.textContent = "Creating setup link...";
  const button = elements.employeeInviteForm.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    const response = await fetch("/api/employees/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, display_name: displayName }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.message || `Invite failed: ${response.status}`);
    elements.employeeInviteForm.reset();
    if (elements.employeeInviteStatus) elements.employeeInviteStatus.textContent = "Setup link created. Copy, text, or email it to the employee.";
    renderInviteLink(payload.invite_url, payload.invite);
    renderEmployeeAccess(payload);
  } catch (error) {
    if (elements.employeeInviteStatus) elements.employeeInviteStatus.textContent = error.message || "Invite failed.";
  } finally {
    if (button) button.disabled = false;
  }
}

async function runAdminTicketFetch(event) {
  event.preventDefault();
  if (!elements.adminTicketFetchForm || !canWriteEmployeeDashboard()) return;
  const button = elements.adminTicketFetchForm.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  if (elements.adminTicketFetchStatus) elements.adminTicketFetchStatus.textContent = "Fetching GeoCall pages and polygons...";
  if (elements.adminTicketFetchLog) {
    elements.adminTicketFetchLog.hidden = true;
    elements.adminTicketFetchLog.textContent = "";
  }
  try {
    await saveTicketWorkflowStateNow();
    const response = await fetch("/api/admin/geocall-fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticket_numbers: elements.adminTicketNumbers?.value || "",
        curl: elements.adminGeocallCurl?.value || "",
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.message || `Ticket fetch failed: ${response.status}`);
    const fetched = Array.isArray(payload.fetched) ? payload.fetched : [];
    const missing = Array.isArray(payload.missing) ? payload.missing : [];
    if (elements.adminTicketFetchStatus) {
      elements.adminTicketFetchStatus.textContent = `${payload.message || `Fetched ${fetched.length} ticket(s).`} Refreshing dashboard tickets...`;
    }
    if (elements.adminTicketFetchLog) {
      const lines = [
        fetched.length ? `Fetched: ${fetched.join(", ")}` : "Fetched: none",
        missing.length ? `Still missing: ${missing.join(", ")}` : "Still missing: none",
      ];
      if (payload.stdout) lines.push("", payload.stdout.trim());
      if (payload.stderr) lines.push("", payload.stderr.trim());
      elements.adminTicketFetchLog.textContent = lines.filter((line) => line !== undefined).join("\n");
      elements.adminTicketFetchLog.hidden = false;
    }
    if (elements.adminGeocallCurl) elements.adminGeocallCurl.value = "";
    await loadTickets();
    render();
    renderMobileAdminConfig();
    if (elements.adminTicketFetchStatus) elements.adminTicketFetchStatus.textContent = payload.message || `Fetched ${fetched.length} ticket(s).`;
    showSavedToast("Ticket fetch complete");
  } catch (error) {
    if (elements.adminTicketFetchStatus) elements.adminTicketFetchStatus.textContent = error.message || "Ticket fetch failed.";
    showSavedToast("Ticket fetch failed");
  } finally {
    if (button) button.disabled = false;
  }
}

async function copyText(text, successMessage = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    showSavedToast(successMessage);
  } catch (error) {
    window.prompt("Copy", text);
  }
}

function confirmYesNo(message, yesLabel = "Yes", noLabel = "No") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-card" role="dialog" aria-modal="true">
        <p>${escapeHtml(message)}</p>
        <div>
          <button type="button" data-confirm-no>${escapeHtml(noLabel)}</button>
          <button type="button" data-confirm-yes>${escapeHtml(yesLabel)}</button>
        </div>
      </div>
    `;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      finish(false);
    };
    const finish = (value) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(value);
    };
    overlay.querySelector("[data-confirm-yes]")?.addEventListener("click", () => finish(true));
    overlay.querySelector("[data-confirm-no]")?.addEventListener("click", () => finish(false));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(false);
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    overlay.querySelector("[data-confirm-yes]")?.focus();
  });
}

function showSavedToast(message = "Saved") {
  if (!elements.saveToast) return;
  elements.saveToast.textContent = message;
  elements.saveToast.hidden = false;
  elements.saveToast.classList.add("visible");
  if (saveToastTimer) window.clearTimeout(saveToastTimer);
  saveToastTimer = window.setTimeout(() => {
    elements.saveToast.classList.remove("visible");
    saveToastTimer = window.setTimeout(() => {
      elements.saveToast.hidden = true;
    }, 180);
  }, 1800);
}

async function saveNamedView(name) {
  const trimmedName = String(name || "").trim().slice(0, 80);
  if (!trimmedName) return null;
  updateSavedViewStatus(`Saving ${trimmedName}...`);
  showSavedToast(`Saving ${trimmedName}...`);
  const existing = viewPresets.find((preset) => preset.name.toLowerCase() === trimmedName.toLowerCase());
  const response = await fetch("/api/view-presets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: existing?.id || trimmedName,
      name: trimmedName,
      state: savedViewStatePayload(),
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save view: ${response.status}`);
  }
  const payload = await response.json();
  viewPresets = normalizeViewPresets(payload.viewPresets || []);
  selectedSavedViewId = String(payload.savedView?.id || existing?.id || trimmedName);
  renderSavedViewControls();
  showSavedToast(`${trimmedName} saved`);
  auditEvent("view_saved_client", { name: trimmedName });
  return selectedSavedView();
}

async function loadDashboardState() {
  const response = await fetch("/api/state");
  if (!response.ok) return;
  const payload = await response.json();
  currentUsername = payload.username || "";
  currentUserDisplayName = payload.displayName || currentUsername;
  currentUserRole = payload.role === "employee" ? "employee" : "admin";
  applyAuditAccess(currentUsername);
  applyUserBranding();
  applySharedDashboardAccess();
  locatorDefaultConfig = payload.locatorDefault || { enabled: false, state: {}, saved_at: "", saved_by: "" };
  viewPresets = normalizeViewPresets(payload.viewPresets || []);
  employeeDashboardConfig = payload.employeeDashboard || { enabled: false, state: {}, saved_at: "", saved_by: "" };
  renderSavedViewControls();
  applyDashboardState(payload.state || {});
  if (currentUserRole === "employee") {
    currentProfileMode = "employee";
    document.body.classList.add("employee-mode");
    if (elements.employeeBar) elements.employeeBar.hidden = false;
    updateDashboardMenuLabel();
  }
}

let hiddenTickets = new Set(readJsonStorage(STORAGE_KEYS.hiddenTickets, []));
let archivedTickets = new Set(readJsonStorage(STORAGE_KEYS.archivedTickets, []));
let hiddenTicketUpdatedAt = normalizeTicketActionUpdatedAt(readObjectStorage(STORAGE_KEYS.hiddenTicketUpdatedAt));
let archivedTicketUpdatedAt = normalizeTicketActionUpdatedAt(readObjectStorage(STORAGE_KEYS.archivedTicketUpdatedAt));
let ticketActions = normalizeTicketActions(readObjectStorage(STORAGE_KEYS.ticketActions));
let ticketActionUpdatedAt = normalizeTicketActionUpdatedAt(readObjectStorage(STORAGE_KEYS.ticketActionUpdatedAt));
let ticketDescriptions = normalizeTicketDescriptions(readObjectStorage(STORAGE_KEYS.ticketDescriptions));
let ticketMarkedBy = normalizeTicketMarkedBy(readObjectStorage(STORAGE_KEYS.ticketMarkedBy));
let ticketPriorities = normalizeTicketPriorities(readObjectStorage(STORAGE_KEYS.ticketPriorities));
let ticketListCheckpoint = normalizeTicketListCheckpoint(readJsonStorage(STORAGE_KEYS.ticketListCheckpoint, null));
applyTicketListCheckpoint();
let polygonColor = localStorage.getItem("polygonColor") || "#1f7a4d";
let polygonOpacity = Number(localStorage.getItem("polygonOpacity") || "0.14");
let vetroColor = localStorage.getItem("vetroColor") || "#00a5ff";
let vetroOpacity = Number(localStorage.getItem("vetroOpacity") || "0.85");
let mapOpacity = 1;
localStorage.removeItem("mapOpacity");
let ticketOpacity = Number(localStorage.getItem(STORAGE_KEYS.ticketOpacity) || "1");
let mapStyle = localStorage.getItem(STORAGE_KEYS.mapStyle) || "locator-dark-detail";
if (!MAP_TILE_STYLES[mapStyle]) mapStyle = "locator-dark-detail";
let lastStreetMapStyle = ["satellite", "hybrid"].includes(mapStyle) || MAP_TILE_STYLES[mapStyle]?.imagery ? "contrast" : mapStyle;
let mapDataOverlay = localStorage.getItem(STORAGE_KEYS.mapDataOverlay) || "none";
if (!isValidMapDataOverlay(mapDataOverlay)) mapDataOverlay = "none";
let sheetSort = readJsonStorage(STORAGE_KEYS.sheetSort, { column: "Due Date", direction: "desc" });
let sheetColumnFilters = readObjectStorage(STORAGE_KEYS.sheetColumnFilters);
let sheetSavedFilters = readJsonStorage(STORAGE_KEYS.sheetSavedFilters, []);
let sheetColumnWidths = readObjectStorage(STORAGE_KEYS.sheetColumnWidths);
let showHiddenTickets = readBooleanStorage(STORAGE_KEYS.showHidden, false);
let vetroVisible = readBooleanStorage(STORAGE_KEYS.vetroVisible, false);
let vetroSelectedLayers = new Set(readJsonStorage(STORAGE_KEYS.vetroLayers, []));
let vetroSelectedPlans = readSetStorage(STORAGE_KEYS.vetroPlan);
let vetroSelectedBuilds = readSetStorage(STORAGE_KEYS.vetroBuild);
let vetroSelectedPlacements = readSetStorage(STORAGE_KEYS.vetroPlacement);
let vetroSelectedStatuses = readSetStorage(STORAGE_KEYS.vetroStatus);
let vetroSelectedGeometries = readSetStorage(STORAGE_KEYS.vetroGeometry);
let vetroSelectedFibers = readSetStorage(STORAGE_KEYS.vetroFiber);
let vetroSelectedRoutes = readSetStorage(STORAGE_KEYS.vetroRoute);
let vetroSelectedPoints = readSetStorage(STORAGE_KEYS.vetroPoint);
let vetroLayerColorOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vetroLayerColors) || localStorage.getItem("vetroLayerColors") || "{}");
let vetroLayerStyleOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vetroLayerStyles) || "{}");
let vetroLayerNameOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vetroLayerNames) || "{}");
let vetroLayerNoteOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vetroLayerNotes) || "{}");
let vetroLayerSizeOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vetroLayerSizes) || "{}");
let vetroLayerOpacityOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vetroLayerOpacities) || "{}");
let vitruviVisible = readBooleanStorage(STORAGE_KEYS.vitruviVisible, false);
let vitruviSelectedLayers = new Set(readJsonStorage(STORAGE_KEYS.vitruviLayers, []));
let vitruviSearch = localStorage.getItem(STORAGE_KEYS.vitruviSearch) || "";
let vitruviOpacity = Number(localStorage.getItem(STORAGE_KEYS.vitruviOpacity) || "0.82");
let vitruviLayerColorOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vitruviLayerColors) || "{}");
let vitruviLayerStyleOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vitruviLayerStyles) || "{}");
let vitruviLayerNameOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vitruviLayerNames) || "{}");
let vitruviLayerNoteOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vitruviLayerNotes) || "{}");
let vitruviLayerSizeOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vitruviLayerSizes) || "{}");
let vitruviLayerOpacityOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vitruviLayerOpacities) || "{}");
let vetroSlVisible = readBooleanStorage(STORAGE_KEYS.vetroSlVisible, true);
let vetroSlShape = localStorage.getItem(STORAGE_KEYS.vetroSlShape) || "diamond";
let vetroSlColor = localStorage.getItem(STORAGE_KEYS.vetroSlColor) || "#e7298a";
let vetroSlOutlineColor = localStorage.getItem(STORAGE_KEYS.vetroSlOutlineColor) || "#111827";
let vetroSlOpacity = Number(localStorage.getItem(STORAGE_KEYS.vetroSlOpacity) || "1");
let vetroSlSize = Number(localStorage.getItem(STORAGE_KEYS.vetroSlSize) || "13");
let vetroSlLabels = readBooleanStorage(STORAGE_KEYS.vetroSlLabels, false);
let vetroSearch = localStorage.getItem(STORAGE_KEYS.vetroSearch) || "";
let ticketSearch = localStorage.getItem("ticketSearch") || "";
let sidebarCollapsed = readBooleanStorage(STORAGE_KEYS.sidebarCollapsed, false);
let countyFilterAll = readBooleanStorage(STORAGE_KEYS.countyFilterAll, true);
let selectedCounties = readSetStorage(STORAGE_KEYS.countyFilterSelected);
const legacyCountyFilterValue = localStorage.getItem("countyFilter") || "";
if (!selectedCounties.size && legacyCountyFilterValue) {
  countyFilterAll = false;
  writeBooleanStorage(STORAGE_KEYS.countyFilterAll, countyFilterAll);
  selectedCounties = new Set([legacyCountyFilterValue]);
  writeJsonStorage(STORAGE_KEYS.countyFilterSelected, [...selectedCounties]);
}
let pendingSelectedTicketNumber = localStorage.getItem("selectedTicketNumber") || "";
let pendingMapView = null;
let pendingTicketListScroll = { top: 0, left: 0 };
let ticketListScrolled = false;
let dashboardStateReady = false;
let dashboardStateHydrating = false;
let dashboardStateSaveTimer = null;
let ticketWorkflowSaveTimer = null;
let employeeDashboardSyncTimer = null;
let saveToastTimer = null;
let locatorDefaultConfig = { enabled: false, state: {}, saved_at: "", saved_by: "" };
let viewPresets = [];
let selectedSavedViewId = localStorage.getItem(STORAGE_KEYS.savedViewSelected) || "";
let employeeDashboardConfig = { enabled: false, state: {}, saved_at: "", saved_by: "" };
let locatorProfile = normalizeProfile(readObjectStorage(STORAGE_KEYS.profile));
let appVetroStyleLayerId = localStorage.getItem("appVetroStyleLayerId") || "";

const elements = {
  sourcePath: document.querySelector("#sourcePath"),
  appBrandLogo: document.querySelector("#appBrandLogo"),
  appBrandSecondaryLogo: document.querySelector("#appBrandSecondaryLogo"),
  mobileBrandLogo: document.querySelector("#mobileBrandLogo"),
  mobileBrandSecondaryLogo: document.querySelector("#mobileBrandSecondaryLogo"),
  totalCount: document.querySelector("#totalCount"),
  dueCount: document.querySelector("#dueCount"),
  countyCount: document.querySelector("#countyCount"),
  search: document.querySelector("#search"),
  ticketQuickSearch: document.querySelector("#ticketQuickSearch"),
  mapSearchForm: document.querySelector("#mapSearchForm"),
  mapSearch: document.querySelector("#mapSearch"),
  map: document.querySelector("#map"),
  locateMe: document.querySelector("#locateMe"),
  measureToggle: document.querySelector("#measureToggle"),
  measureClear: document.querySelector("#measureClear"),
  measureUnit: document.querySelector("#measureUnit"),
  measureStatus: document.querySelector("#measureStatus"),
  map3d: document.querySelector("#map3d"),
  dashboard3dToggle: document.querySelector("#dashboard3dToggle"),
  dashboard3dStyle: document.querySelector("#dashboard3dStyle"),
  dashboard3dTilt: document.querySelector("#dashboard3dTilt"),
  dashboard3dTiltUp: document.querySelector("#dashboard3dTiltUp"),
  dashboard3dTiltDown: document.querySelector("#dashboard3dTiltDown"),
  dashboard3dRotate: document.querySelector("#dashboard3dRotate"),
  countyFilter: document.querySelector("#countyFilter"),
  countyFilterSummary: document.querySelector("#countyFilterSummary"),
  countyAll: document.querySelector("#countyAll"),
  countyClear: document.querySelector("#countyClear"),
  savedViewSelect: document.querySelector("#savedViewSelect"),
  saveDashboardState: document.querySelector("#saveDashboardState"),
  saveView: document.querySelector("#saveView"),
  saveSharedFieldDefault: document.querySelector("#saveSharedFieldDefault"),
  saveEmployeeDashboard: document.querySelector("#saveEmployeeDashboard"),
  savedViewStatus: document.querySelector("#savedViewStatus"),
  employeeBar: document.querySelector("#employeeBar"),
  saveToast: document.querySelector("#saveToast"),
  refresh: document.querySelector("#refresh"),
  vetroDrawer: document.querySelector("#vetroDrawer"),
  vetroToggle: document.querySelector("#vetroToggle"),
  vetroStatus: document.querySelector("#vetroStatus"),
  updateVetro: document.querySelector("#updateVetro"),
  vetroCaptureTool: document.querySelector("#vetroCaptureTool"),
  vetroCaptureText: document.querySelector("#vetroCaptureText"),
  vetroCaptureFile: document.querySelector("#vetroCaptureFile"),
  saveVetroCapture: document.querySelector("#saveVetroCapture"),
  vetroCaptureStatus: document.querySelector("#vetroCaptureStatus"),
  vetroRefreshProgress: document.querySelector("#vetroRefreshProgress"),
  vetroRefreshStatus: document.querySelector("#vetroRefreshStatus"),
  vetroLoginLink: document.querySelector("#vetroLoginLink"),
  vetroRefreshBar: document.querySelector("#vetroRefreshBar"),
  vetroSearch: document.querySelector("#vetroSearch"),
  appVetroStyleEditor: document.querySelector("#appVetroStyleEditor"),
  appVetroStyleSummary: document.querySelector("#appVetroStyleSummary"),
  appVetroSaveView: document.querySelector("#appVetroSaveView"),
  appVetroLayerSelect: document.querySelector("#appVetroLayerSelect"),
  appVetroLayerSize: document.querySelector("#appVetroLayerSize"),
  appVetroSizeLabel: document.querySelector("#appVetroSizeLabel"),
  appVetroSizeValue: document.querySelector("#appVetroSizeValue"),
  appVetroLayerOpacity: document.querySelector("#appVetroLayerOpacity"),
  appVetroOpacityValue: document.querySelector("#appVetroOpacityValue"),
  appVetroLayerColor: document.querySelector("#appVetroLayerColor"),
  appVetroLayerStyle: document.querySelector("#appVetroLayerStyle"),
  vetroLayerFilter: document.querySelector("#vetroLayerFilter"),
  vetroLayerAll: document.querySelector("#vetroLayerAll"),
  vetroLayerClear: document.querySelector("#vetroLayerClear"),
  vitruviDrawer: document.querySelector("#vitruviDrawer"),
  vitruviToggle: document.querySelector("#vitruviToggle"),
  vitruviStatus: document.querySelector("#vitruviStatus"),
  vitruviSearch: document.querySelector("#vitruviSearch"),
  vitruviLayerFilter: document.querySelector("#vitruviLayerFilter"),
  vitruviLayerAll: document.querySelector("#vitruviLayerAll"),
  vitruviLayerClear: document.querySelector("#vitruviLayerClear"),
  vitruviOpacity: document.querySelector("#vitruviOpacity"),
  vetroPlanFilter: document.querySelector("#vetroPlanFilter"),
  vetroPlanAll: document.querySelector("#vetroPlanAll"),
  vetroPlanClear: document.querySelector("#vetroPlanClear"),
  vetroBuildFilter: document.querySelector("#vetroBuildFilter"),
  vetroBuildAll: document.querySelector("#vetroBuildAll"),
  vetroBuildClear: document.querySelector("#vetroBuildClear"),
  vetroPlacementFilter: document.querySelector("#vetroPlacementFilter"),
  vetroPlacementAll: document.querySelector("#vetroPlacementAll"),
  vetroPlacementClear: document.querySelector("#vetroPlacementClear"),
  vetroStatusFilter: document.querySelector("#vetroStatusFilter"),
  vetroStatusAll: document.querySelector("#vetroStatusAll"),
  vetroStatusClear: document.querySelector("#vetroStatusClear"),
  vetroGeometryFilter: document.querySelector("#vetroGeometryFilter"),
  vetroGeometryAll: document.querySelector("#vetroGeometryAll"),
  vetroGeometryClear: document.querySelector("#vetroGeometryClear"),
  vetroFiberFilter: document.querySelector("#vetroFiberFilter"),
  vetroFiberAll: document.querySelector("#vetroFiberAll"),
  vetroFiberClear: document.querySelector("#vetroFiberClear"),
  vetroRouteFilter: document.querySelector("#vetroRouteFilter"),
  vetroRouteAll: document.querySelector("#vetroRouteAll"),
  vetroRouteClear: document.querySelector("#vetroRouteClear"),
  vetroPointFilter: document.querySelector("#vetroPointFilter"),
  vetroPointAll: document.querySelector("#vetroPointAll"),
  vetroPointClear: document.querySelector("#vetroPointClear"),
  vetroSlToggle: document.querySelector("#vetroSlToggle"),
  vetroSlShape: document.querySelector("#vetroSlShape"),
  vetroSlColor: document.querySelector("#vetroSlColor"),
  vetroSlOutlineColor: document.querySelector("#vetroSlOutlineColor"),
  vetroSlOpacity: document.querySelector("#vetroSlOpacity"),
  vetroSlSize: document.querySelector("#vetroSlSize"),
  vetroSlLabels: document.querySelector("#vetroSlLabels"),
  vetroColor: document.querySelector("#vetroColor"),
  vetroOpacity: document.querySelector("#vetroOpacity"),
  showHiddenToggle: document.querySelector("#showHiddenToggle"),
  polygonColor: document.querySelector("#polygonColor"),
  polygonOpacity: document.querySelector("#polygonOpacity"),
  ticketOpacity: document.querySelector("#ticketOpacity"),
  mapStyle: document.querySelector("#mapStyle"),
  mapDataOverlay: document.querySelector("#mapDataOverlay"),
  mapDataOverlayStatus: document.querySelector("#mapDataOverlayStatus"),
  undoAction: document.querySelector("#undoAction"),
  redoAction: document.querySelector("#redoAction"),
  showSheetView: document.querySelector("#showSheetView"),
  showRestorationView: document.querySelector("#showRestorationView"),
  showInHouseRequestsView: document.querySelector("#showInHouseRequestsView"),
  showLocationPhotosView: document.querySelector("#showLocationPhotosView"),
  showLiveTicketsView: document.querySelector("#showLiveTicketsView"),
  showTcwDashboardView: document.querySelector("#showTcwDashboardView"),
  dashboardSatelliteToggle: document.querySelector("#dashboardSatelliteToggle"),
  showMobileView: document.querySelector("#showMobileView"),
  addLocatorNote: document.querySelector("#addLocatorNote"),
  showDashboardView: document.querySelector("#showDashboardView"),
  showMobileAdminView: document.querySelector("#showMobileAdminView"),
  showActivityView: document.querySelector("#showActivityView"),
  showEmployeeView: document.querySelector("#showEmployeeView"),
  showAdminView: document.querySelector("#showAdminView"),
  settingsFlyout: document.querySelector("#settingsFlyout"),
  showSettingsMenu: document.querySelector("#showSettingsMenu"),
  settingsPanel: document.querySelector("#settingsPanel"),
  oneDriveStatus: document.querySelector("#oneDriveStatus"),
  refreshOneDriveStatus: document.querySelector("#refreshOneDriveStatus"),
  connectOneDrive: document.querySelector("#connectOneDrive"),
  openPhotoManager: document.querySelector("#openPhotoManager"),
  downloadPhotoCsv: document.querySelector("#downloadPhotoCsv"),
  downloadPhotoZip: document.querySelector("#downloadPhotoZip"),
  photoSettingsSourceApp: document.querySelector("#photoSettingsSourceApp"),
  photoSettingsGoogleFolder: document.querySelector("#photoSettingsGoogleFolder"),
  photoSettingsDriveMode: document.querySelector("#photoSettingsDriveMode"),
  savePhotoSettings: document.querySelector("#savePhotoSettings"),
  photoSettingsStatus: document.querySelector("#photoSettingsStatus"),
  deployAppUpdate: document.querySelector("#deployAppUpdate"),
  sheetBackToDashboard: document.querySelector("#sheetBackToDashboard"),
  sheetView: document.querySelector("#sheetView"),
  sheetFilterToolbar: document.querySelector("#sheetFilterToolbar"),
  sheetHorizontalScroll: document.querySelector("#sheetHorizontalScroll"),
  sheetHorizontalScrollInner: document.querySelector("#sheetHorizontalScrollInner"),
  sheetTableWrap: document.querySelector("#sheetTableWrap"),
  restorationView: document.querySelector("#restorationView"),
  restorationSearch: document.querySelector("#restorationSearch"),
  restorationPriorityFilter: document.querySelector("#restorationPriorityFilter"),
  restorationStatusFilter: document.querySelector("#restorationStatusFilter"),
  newRestorationJob: document.querySelector("#newRestorationJob"),
  restorationBackToDashboard: document.querySelector("#restorationBackToDashboard"),
  restorationMap: document.querySelector("#restorationMap"),
  restorationModal: document.querySelector("#restorationModal"),
  restorationCancel: document.querySelector("#restorationCancel"),
  restorationForm: document.querySelector("#restorationForm"),
  restorationJobId: document.querySelector("#restorationJobId"),
  restorationTitle: document.querySelector("#restorationTitle"),
  restorationTicket: document.querySelector("#restorationTicket"),
  restorationLocation: document.querySelector("#restorationLocation"),
  restorationEntity: document.querySelector("#restorationEntity"),
  restorationLat: document.querySelector("#restorationLat"),
  restorationLng: document.querySelector("#restorationLng"),
  restorationPriority: document.querySelector("#restorationPriority"),
  restorationStatus: document.querySelector("#restorationStatus"),
  restorationScheduled: document.querySelector("#restorationScheduled"),
  restorationAssigned: document.querySelector("#restorationAssigned"),
  restorationNotes: document.querySelector("#restorationNotes"),
  restorationFormStatus: document.querySelector("#restorationFormStatus"),
  restorationJobsTable: document.querySelector("#restorationJobsTable"),
  restorationDetail: document.querySelector("#restorationDetail"),
  inHouseRequestsView: document.querySelector("#inHouseRequestsView"),
  inHouseBackToDashboard: document.querySelector("#inHouseBackToDashboard"),
  inHouseForm: document.querySelector("#inHouseForm"),
  inHouseId: document.querySelector("#inHouseId"),
  inHouseTitle: document.querySelector("#inHouseTitle"),
  inHouseRequestor: document.querySelector("#inHouseRequestor"),
  inHouseContactPhone: document.querySelector("#inHouseContactPhone"),
  inHouseCrew: document.querySelector("#inHouseCrew"),
  inHouseProject: document.querySelector("#inHouseProject"),
  inHouseAddress: document.querySelector("#inHouseAddress"),
  inHouseCounty: document.querySelector("#inHouseCounty"),
  inHousePlace: document.querySelector("#inHousePlace"),
  inHouseLat: document.querySelector("#inHouseLat"),
  inHouseLng: document.querySelector("#inHouseLng"),
  inHousePriority: document.querySelector("#inHousePriority"),
  inHouseStatus: document.querySelector("#inHouseStatus"),
  inHouseDue: document.querySelector("#inHouseDue"),
  inHouseAssigned: document.querySelector("#inHouseAssigned"),
  inHouseUtilities: document.querySelector("#inHouseUtilities"),
  inHouseScope: document.querySelector("#inHouseScope"),
  inHouseNotes: document.querySelector("#inHouseNotes"),
  inHouseFormStatus: document.querySelector("#inHouseFormStatus"),
  inHouseNewRequest: document.querySelector("#inHouseNewRequest"),
  inHouseMap: document.querySelector("#inHouseMap"),
  inHouseMapStatus: document.querySelector("#inHouseMapStatus"),
  inHouseUseMapCenter: document.querySelector("#inHouseUseMapCenter"),
  inHouseRefreshRequests: document.querySelector("#inHouseRefreshRequests"),
  inHouseRequestList: document.querySelector("#inHouseRequestList"),
  locationPhotosView: document.querySelector("#locationPhotosView"),
  locationPhotosForm: document.querySelector("#locationPhotosForm"),
  locationPhotosFiles: document.querySelector("#locationPhotosFiles"),
  locationPhotosTicket: document.querySelector("#locationPhotosTicket"),
  locationPhotosLocationLabel: document.querySelector("#locationPhotosLocationLabel"),
  locationPhotosAddress: document.querySelector("#locationPhotosAddress"),
  locationPhotosLat: document.querySelector("#locationPhotosLat"),
  locationPhotosLng: document.querySelector("#locationPhotosLng"),
  locationPhotosNote: document.querySelector("#locationPhotosNote"),
  locationPhotosUpload: document.querySelector("#locationPhotosUpload"),
  locationPhotosStatus: document.querySelector("#locationPhotosStatus"),
  locationPhotosProgress: document.querySelector("#locationPhotosProgress"),
  locationPhotosProgressBar: document.querySelector("#locationPhotosProgressBar"),
  locationPhotosMap: document.querySelector("#locationPhotosMap"),
  locationPhotosList: document.querySelector("#locationPhotosList"),
  locationPhotosSummary: document.querySelector("#locationPhotosSummary"),
  refreshLocationPhotos: document.querySelector("#refreshLocationPhotos"),
  exportLocationPhotosCsv: document.querySelector("#exportLocationPhotosCsv"),
  exportLocationPhotosZip: document.querySelector("#exportLocationPhotosZip"),
  locationPhotosBackToDashboard: document.querySelector("#locationPhotosBackToDashboard"),
  liveTicketsView: document.querySelector("#liveTicketsView"),
  liveTicketsSummary: document.querySelector("#liveTicketsSummary"),
  liveTicketsSearch: document.querySelector("#liveTicketsSearch"),
  liveTicketsBackToDashboard: document.querySelector("#liveTicketsBackToDashboard"),
  liveTicketsList: document.querySelector("#liveTicketsList"),
  liveTicketDetail: document.querySelector("#liveTicketDetail"),
  mobileView: document.querySelector("#mobileView"),
  mobileAdminView: document.querySelector("#mobileAdminView"),
  mobileAdminBackToDashboard: document.querySelector("#mobileAdminBackToDashboard"),
  openMobileAppLink: document.querySelector("#openMobileAppLink"),
  mobileConfigOpenCount: document.querySelector("#mobileConfigOpenCount"),
  mobileConfigMapCount: document.querySelector("#mobileConfigMapCount"),
  mobileConfigDoneCount: document.querySelector("#mobileConfigDoneCount"),
  mobileConfigStartMode: document.querySelector("#mobileConfigStartMode"),
  mobileConfigSavedAt: document.querySelector("#mobileConfigSavedAt"),
  mobileConfigStatus: document.querySelector("#mobileConfigStatus"),
  publishMobileConfig: document.querySelector("#publishMobileConfig"),
  copyMobileAppLink: document.querySelector("#copyMobileAppLink"),
  mobileInstallUrlIos: document.querySelector("#mobileInstallUrlIos"),
  mobileInstallUrlAndroid: document.querySelector("#mobileInstallUrlAndroid"),
  employeeInviteForm: document.querySelector("#employeeInviteForm"),
  employeeDisplayName: document.querySelector("#employeeDisplayName"),
  employeeUsername: document.querySelector("#employeeUsername"),
  employeeInviteStatus: document.querySelector("#employeeInviteStatus"),
  employeeInviteLink: document.querySelector("#employeeInviteLink"),
  employeeAccessList: document.querySelector("#employeeAccessList"),
  adminTicketFetchForm: document.querySelector("#adminTicketFetchForm"),
  adminTicketNumbers: document.querySelector("#adminTicketNumbers"),
  adminGeocallCurl: document.querySelector("#adminGeocallCurl"),
  adminTicketFetchStatus: document.querySelector("#adminTicketFetchStatus"),
  adminTicketFetchLog: document.querySelector("#adminTicketFetchLog"),
  adminOpenActivityLog: document.querySelector("#adminOpenActivityLog"),
  activityView: document.querySelector("#activityView"),
  activityList: document.querySelector("#activityList"),
  refreshActivity: document.querySelector("#refreshActivity"),
  downloadActivityCsv: document.querySelector("#downloadActivityCsv"),
  downloadActivityExcel: document.querySelector("#downloadActivityExcel"),
  downloadActivityJson: document.querySelector("#downloadActivityJson"),
  activityBackToDashboard: document.querySelector("#activityBackToDashboard"),
  locatorNoteModal: document.querySelector("#locatorNoteModal"),
  locatorNoteForm: document.querySelector("#locatorNoteForm"),
  locatorNoteCategory: document.querySelector("#locatorNoteCategory"),
  locatorNoteText: document.querySelector("#locatorNoteText"),
  locatorNoteFiles: document.querySelector("#locatorNoteFiles"),
  locatorNoteTarget: document.querySelector("#locatorNoteTarget"),
  locatorNoteStatus: document.querySelector("#locatorNoteStatus"),
  locatorNoteCancel: document.querySelector("#locatorNoteCancel"),
  locatorNoteClose: document.querySelector("#locatorNoteClose"),
  mobileSummary: document.querySelector("#mobileSummary"),
  sheetSearch: document.querySelector("#sheetSearch"),
  exportSheetPdf: document.querySelector("#exportSheetPdf"),
  exportSheetExcel: document.querySelector("#exportSheetExcel"),
  exportSheetCsv: document.querySelector("#exportSheetCsv"),
  mobileSearch: document.querySelector("#mobileSearch"),
  mobileLocateMe: document.querySelector("#mobileLocateMe"),
  mobilePanelTabs: document.querySelector(".mobile-panel-tabs"),
  mobileOpenCount: document.querySelector("#mobileOpenCount"),
  mobileMapCount: document.querySelector("#mobileMapCount"),
  mobileDoneCount: document.querySelector("#mobileDoneCount"),
  mobileDigCount: document.querySelector("#mobileDigCount"),
  mobileMapPanel: document.querySelector("#mobileMapPanel"),
  mobileFieldMap: document.querySelector("#mobileFieldMap"),
  mobileLiveStatus: document.querySelector("#mobileLiveStatus"),
  mobileFollowLocation: document.querySelector("#mobileFollowLocation"),
  mobileMeasureToggle: document.querySelector("#mobileMeasureToggle"),
  mobileMeasureClear: document.querySelector("#mobileMeasureClear"),
  mobileMeasureUnit: document.querySelector("#mobileMeasureUnit"),
  mobileMeasureStatus: document.querySelector("#mobileMeasureStatus"),
  mobileMapTickets: document.querySelector("#mobileMapTickets"),
  mobileMapFitAll: document.querySelector("#mobileMapFitAll"),
  mobileSaveEmployeeDashboard: document.querySelector("#mobileSaveEmployeeDashboard"),
  mobileDeployAppUpdate: document.querySelector("#mobileDeployAppUpdate"),
  mobileRefresh: document.querySelector("#mobileRefresh"),
  mobileBackToDashboard: document.querySelector("#mobileBackToDashboard"),
  mobileTicketList: document.querySelector("#mobileTicketList"),
  mobileTicketDetail: document.querySelector("#mobileTicketDetail"),
  profileName: document.querySelector("#profileName"),
  profileRole: document.querySelector("#profileRole"),
  profilePhoto: document.querySelector("#profilePhoto"),
  profileLogout: document.querySelector("#profileLogout"),
  clearProfilePhoto: document.querySelector("#clearProfilePhoto"),
  openProfileEditor: document.querySelector("#openProfileEditor"),
  closeProfileEditor: document.querySelector("#closeProfileEditor"),
  saveProfileEditor: document.querySelector("#saveProfileEditor"),
  profileModal: document.querySelector("#profileModal"),
  profileAvatar: document.querySelector("#profileAvatar"),
  profileInitials: document.querySelector("#profileInitials"),
  profileEditorAvatar: document.querySelector("#profileEditorAvatar"),
  profileEditorInitials: document.querySelector("#profileEditorInitials"),
  profileNameDisplay: document.querySelector("#profileNameDisplay"),
  profileRoleDisplay: document.querySelector("#profileRoleDisplay"),
  mobileProfileAvatar: document.querySelector("#mobileProfileAvatar"),
  mobileProfileInitials: document.querySelector("#mobileProfileInitials"),
  mapLegend: document.querySelector("#mapLegend"),
  sheetLegend: document.querySelector("#sheetLegend"),
  legendToggle: document.querySelector("#legendToggle"),
  ticketList: document.querySelector("#ticketList"),
  detail: document.querySelector("#detail"),
  sidebarCollapse: document.querySelector("#sidebarCollapse"),
  layerDrawers: document.querySelectorAll(".layer-drawers > details"),
};

elements.polygonColor.value = polygonColor;
elements.polygonOpacity.value = String(opacityToPercent(polygonOpacity));
elements.ticketOpacity.value = String(opacityToPercent(ticketOpacity));
elements.vetroColor.value = vetroColor;
elements.vetroOpacity.value = String(opacityToPercent(vetroOpacity));
if (elements.vetroSlToggle) elements.vetroSlToggle.checked = vetroSlVisible;
if (elements.vetroSlShape) elements.vetroSlShape.value = vetroSlShape;
if (elements.vetroSlColor) elements.vetroSlColor.value = vetroSlColor;
if (elements.vetroSlOutlineColor) elements.vetroSlOutlineColor.value = vetroSlOutlineColor;
if (elements.vetroSlOpacity) elements.vetroSlOpacity.value = String(opacityToPercent(vetroSlOpacity));
if (elements.vetroSlSize) elements.vetroSlSize.value = String(vetroSlSize);
if (elements.vetroSlLabels) elements.vetroSlLabels.checked = vetroSlLabels;
elements.vetroSearch.value = vetroSearch;
if (elements.vitruviToggle) elements.vitruviToggle.checked = vitruviVisible;
if (elements.vitruviSearch) elements.vitruviSearch.value = vitruviSearch;
if (elements.vitruviOpacity) elements.vitruviOpacity.value = String(opacityToPercent(vitruviOpacity));
syncTicketSearchInputs();
populateMapStyleSelect();
elements.showHiddenToggle.checked = showHiddenTickets;
elements.vetroToggle.checked = vetroVisible;
updateDashboardMenuLabel();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function propValue(props, ...names) {
  for (const name of names) {
    if (props?.[name] !== undefined && props[name] !== null && props[name] !== "") return String(props[name]);
  }
  const lower = Object.fromEntries(Object.entries(props || {}).map(([key, value]) => [key.toLowerCase(), value]));
  for (const name of names) {
    const value = lower[name.toLowerCase()];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return "";
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function featureSearchText(feature) {
  const props = feature.properties || {};
  return [
    props.feature_id,
    props.ID,
    props.Name,
    props.name,
    props.street_address,
    props.Street_Address,
    props.vetro_id,
    props.plan,
    props.layer_id,
    props.status_id,
    props.Build,
    props.Placement,
    props.Fiber_Capacity,
    props.Bore_Plow,
    props.HH_Size,
    props.Zone_Name,
    props.Zone_Status,
    props.Note,
    props.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const VETRO_LAYER_INFO = {
  "17": {
    name: "Fiber routes",
    geometry: "LineString",
    detail: "line features with fiber capacity, placement, helix/sag, and route IDs",
  },
  "26": {
    name: "Service locations",
    geometry: "Point",
    detail: "address point features with zone, building, and drop-type fields",
  },
  "28": {
    name: "Handholes",
    geometry: "Point",
    detail: "point features with handhole size, TT ID, and notes",
  },
  "42": {
    name: "Network points",
    geometry: "Point",
    detail: "point features with IDs, notes, and status values",
  },
  "43": {
    name: "Named equipment/sites",
    geometry: "Point",
    detail: "small point layer with names, notes, and status values",
  },
  "654": {
    name: "Construction routes",
    geometry: "LineString",
    detail: "line features with linear footage and bore/plow fields",
  },
  "659": {
    name: "Micro duct",
    geometry: "LineString",
    detail: "line feature with micro-duct count",
  },
};

let vetroLayerGeometryById = {};

function vetroFeatureId(feature) {
  return propValue(feature?.properties || {}, "ID", "feature_id", "Name", "name", "vetro_id");
}

function vetroPrefixLayerForFeature(feature) {
  const props = feature?.properties || {};
  if (propValue(props, "layer_id", "Layer_ID") !== VETRO_SERVICE_LOCATION_LAYER_ID) return null;
  const id = vetroFeatureId(feature).toUpperCase();
  return VETRO_PREFIX_LAYERS.find((item) => id.startsWith(item.prefix)) || null;
}

function vetroLayerControlId(feature) {
  return vetroPrefixLayerForFeature(feature)?.id || propValue(feature?.properties || {}, "layer_id", "Layer_ID");
}

function vetroLayerInfo(layerId) {
  const key = String(layerId);
  const prefixLayer = VETRO_PREFIX_LAYERS.find((item) => item.id === key);
  if (prefixLayer) return { name: prefixLayer.name, geometry: "Point", detail: prefixLayer.detail, virtual: true };
  return VETRO_LAYER_INFO[key] || null;
}

function vetroLayerGeometryType(layerId) {
  return vetroLayerGeometryById[String(layerId)] || vetroLayerInfo(layerId)?.geometry || "";
}

function vetroLayerStyleChoice(layerId) {
  return vetroLayerGeometryType(layerId).includes("Line") ? "line" : "point";
}

function vetroLayerDefaultName(layerId) {
  return vetroLayerInfo(layerId)?.name || `Layer ${layerId}`;
}

function vetroLayerDisplayName(layerId) {
  return vetroLayerNameOverrides[String(layerId)]?.trim() || vetroLayerDefaultName(layerId);
}

function vetroLayerNote(layerId) {
  return vetroLayerNoteOverrides[String(layerId)]?.trim() || "";
}

function vetroLayerLabel(layerId, count = 0) {
  const geometry = vetroLayerGeometryType(layerId);
  const geometryLabel = geometry ? ` · ${geometry.startsWith("Line") ? "Line" : "Point"}` : "";
  const countLabel = count ? ` (${Number(count).toLocaleString()})` : "";
  const info = vetroLayerInfo(layerId);
  const prefixLabel = info?.virtual ? "" : `Layer ${layerId}: `;
  return `${prefixLabel}${vetroLayerDisplayName(layerId)}${geometryLabel}${countLabel}`;
}

function vetroLayerTitle(layerId) {
  const info = vetroLayerInfo(layerId) || { detail: "features from VETRO export" };
  const geometry = vetroLayerGeometryType(layerId);
  const shapeHint = geometry.startsWith("Line")
    ? "Use the layer style selector to switch between solid, dashed, and dotted lines."
    : "Use the layer shape selector to switch between circle, square, diamond, and pin markers.";
  const note = vetroLayerNote(layerId);
  const sizeHint = geometry.startsWith("Line") ? `Line width ${vetroLayerSize(layerId)}.` : `Marker size ${vetroLayerSize(layerId)}.`;
  const opacityHint = `Opacity ${Math.round(vetroLayerOpacity(layerId) * 100)}%.`;
  const colorHint = `Color ${colorForVetroLayer(layerId)}.`;
  return `${vetroLayerLabel(layerId)}. ${info.detail} ${shapeHint} ${sizeHint} ${opacityHint} ${colorHint}${note ? ` Note: ${note}` : ""}`;
}

function vetroStatusLabel(statusId) {
  const labels = {
    "1": "Status 1",
    "3": "Status 3",
    "4": "Status 4",
  };
  return labels[String(statusId)] || `Status ${statusId}`;
}

function valueCountMap(features, getter) {
  const counts = {};
  for (const feature of features) {
    const value = getter(feature);
    if (!value) continue;
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function labelWithCount(value, counts, labelFor = (item) => item) {
  const count = counts[value] || 0;
  return count ? `${labelFor(value)} (${count.toLocaleString()})` : labelFor(value);
}

function profileInitials(name) {
  const letters = String(name || "Reed")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0] || "")
    .join("")
    .toUpperCase();
  return letters || "FL";
}

function saveProfile() {
  locatorProfile = normalizeProfile(locatorProfile);
  writeJsonStorage(STORAGE_KEYS.profile, locatorProfile);
  renderProfile();
  scheduleDashboardStateSave();
}

function jamesBrandingEnabled() {
  return currentUsername === "james";
}

function applyUserBranding() {
  const jamesBranding = jamesBrandingEnabled();
  const logo = jamesBranding ? JAMES_BRAND_LOGO : DEFAULT_BRAND_LOGO;
  const alt = jamesBranding ? "James Fiber Locator" : "TCW";
  for (const image of [elements.appBrandLogo, elements.mobileBrandLogo]) {
    if (!image) continue;
    image.src = logo;
    image.alt = alt;
    image.classList.toggle("james-brand-logo", jamesBranding);
  }
  for (const image of [elements.appBrandSecondaryLogo, elements.mobileBrandSecondaryLogo]) {
    if (!image) continue;
    image.src = DEFAULT_BRAND_SECONDARY_LOGO;
    image.hidden = jamesBranding;
  }
  document.body.classList.toggle("james-branding", jamesBranding);
}

function renderProfile() {
  const profile = normalizeProfile(locatorProfile);
  const employeeMode = currentProfileMode === "employee";
  const jamesBranding = jamesBrandingEnabled();
  const displayName = employeeMode
    ? (currentUserDisplayName || currentUsername || "Employee")
    : (profile.name.trim() || currentUserDisplayName || currentUsername || "Admin");
  const displayRole = employeeMode ? "Employee profile" : (profile.role.trim() || "Admin profile");
  const initials = profileInitials(displayName);
  if (elements.profileName) elements.profileName.value = profile.name;
  if (elements.profileRole) elements.profileRole.value = profile.role;
  if (elements.profileNameDisplay) elements.profileNameDisplay.textContent = displayName;
  if (elements.profileRoleDisplay) elements.profileRoleDisplay.textContent = displayRole;
  for (const item of [elements.profileInitials, elements.mobileProfileInitials, elements.profileEditorInitials]) {
    if (item) item.textContent = initials;
  }
  for (const avatar of [elements.profileAvatar, elements.mobileProfileAvatar, elements.profileEditorAvatar]) {
    if (!avatar) continue;
    if (jamesBranding) {
      avatar.src = JAMES_BRAND_LOGO;
      avatar.hidden = false;
    } else if (profile.photo) {
      avatar.src = profile.photo;
      avatar.hidden = false;
    } else {
      avatar.removeAttribute("src");
      avatar.hidden = true;
    }
  }
}

function setProfileModalOpen(open) {
  if (!elements.profileModal) return;
  elements.profileModal.hidden = !open;
  if (open) {
    renderProfile();
    closeMoreMenu();
    requestAnimationFrame(() => elements.profileName?.focus());
  }
}

async function cropProfilePhoto(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("Unable to read image")));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Unable to load image")));
    img.src = dataUrl;
  });
  const side = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sourceX = ((image.naturalWidth || image.width) - side) / 2;
  const sourceY = ((image.naturalHeight || image.height) - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 320, 320);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function routeValue(feature) {
  const props = feature.properties || {};
  return propValue(props, "Bore_Plow", "Bore Plow", "Linear_Footage") ? "Has route construction fields" : "";
}

function pointValue(feature) {
  const props = feature.properties || {};
  if (propValue(props, "HH_Size", "Size")) return "Handhole size";
  if (propValue(props, "Street_Address", "street_address", "Address")) return "Address/service point";
  if (propValue(props, "Zone_Status", "Zone_Name")) return "Zone/service area";
  if (propValue(props, "Name")) return "Named point";
  if ((feature.geometry?.type || "") === "Point") return "Other point";
  return "";
}

function isSlFeature(feature) {
  return Boolean(vetroPrefixLayerForFeature(feature));
}

function slLabel(feature) {
  const props = feature.properties || {};
  return propValue(props, "ID", "feature_id") || "SL";
}

function vetroMarkerIcon(shape, color, size, opacity = 1, label = "", outlineColor = "#111827") {
  const markerSize = Math.max(4, Math.min(28, Number(size) || 13));
  const markerColor = hexToRgba(color, opacity);
  const markerBorder = hexToRgba(outlineColor, Math.max(0.45, clampNumber(opacity, 0, 1, 1)));
  return L.divIcon({
    className: "vetro-layer-icon",
    html: `<div class="vetro-marker-wrap" style="--marker-color:${escapeHtml(markerColor)};--marker-border:${escapeHtml(markerBorder)};--marker-size:${markerSize}px"><div class="vetro-marker vetro-marker-${escapeHtml(shape)}"></div>${label ? `<span>${escapeHtml(label)}</span>` : ""}</div>`,
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize / 2, markerSize / 2],
  });
}

function slMarkerIcon(feature) {
  const size = Math.max(4, Math.min(28, Number(vetroSlSize) || 13));
  const markerSize = Math.max(4, Math.min(28, Number(size) || 13));
  const markerColor = hexToRgba(vetroSlColor, vetroSlOpacity);
  const markerBorder = hexToRgba(vetroSlOutlineColor, Math.max(0.45, clampNumber(vetroSlOpacity, 0, 1, 1)));
  const label = vetroSlLabels ? slLabel(feature) : "";
  return L.divIcon({
    className: "vetro-layer-icon",
    html: `<div class="vetro-marker-wrap vetro-service-location-marker" style="--marker-color:${escapeHtml(markerColor)};--marker-border:${escapeHtml(markerBorder)};--marker-size:${markerSize}px"><div class="vetro-marker vetro-marker-${escapeHtml(vetroSlShape)}"></div>${label ? `<span>${escapeHtml(label)}</span>` : ""}</div>`,
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize / 2, markerSize / 2],
  });
}

function vetroLayerSizeDefault(layerId) {
  return vetroLayerStyleChoice(layerId) === "line" ? 3 : 12;
}

function vetroLayerSizeRange(layerId) {
  return vetroLayerStyleChoice(layerId) === "line"
    ? { label: "Line width", min: 1, max: 10, step: 1 }
    : { label: "Size", min: 4, max: 28, step: 1 };
}

function vetroLayerSize(layerId) {
  const range = vetroLayerSizeRange(layerId);
  return clampNumber(vetroLayerSizeOverrides[String(layerId)], range.min, range.max, vetroLayerSizeDefault(layerId));
}

function vetroLayerOpacity(layerId) {
  return clampNumber(vetroLayerOpacityOverrides[String(layerId)], 0, 1, vetroOpacity);
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function normalizeHexColor(value) {
  const raw = String(value || "").trim();
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  return isHexColor(withHash) ? withHash.toLowerCase() : "";
}

function vetroLayerShape(layerId) {
  const geometryChoice = vetroLayerStyleChoice(layerId);
  return vetroLayerStyleOverrides[String(layerId)] || (geometryChoice === "line" ? "solid" : "circle");
}

function vetroPointToLayer(feature, latlng) {
  const layerId = vetroLayerControlId(feature);
  const shape = vetroLayerShape(layerId);
  const size = vetroLayerSize(layerId);
  const opacity = vetroLayerOpacity(layerId);
  const label = vetroSlLabels && isSlFeature(feature) ? slLabel(feature) : "";
  return L.marker(latlng, {
    icon: vetroMarkerIcon(shape, colorForVetroLayer(layerId), size, opacity, label),
  });
}

function isValidMapDataOverlay(value) {
  return value === "none" || value === "addresses" || value === "parcels" || value === "addresses-parcels";
}

function initMap() {
  map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([33.23, -92.67], 12);
  setMapTileStyle(mapStyle, false);
  mapDataOverlayLayer = L.layerGroup().addTo(map);
  locatorNotesLayer = L.layerGroup().addTo(map);
  userLocationLayer = L.layerGroup().addTo(map);
  markers = L.layerGroup().addTo(map);
  polygons = L.layerGroup().addTo(map);
  map.on("click", (event) => {
    if (measureTool?.active) return;
    if (locatorNoteMode) {
      beginLocatorNoteForMap(event.latlng);
      return;
    }
    clearSelectedTicket();
  });
  map.on("moveend zoomend", () => {
    if (!dashboardStateReady || dashboardStateHydrating) return;
    scheduleDashboardStateSave();
    scheduleMapDataOverlayRefresh();
  });
  measureTool = createMeasureTool({
    map,
    toggleButton: elements.measureToggle,
    clearButton: elements.measureClear,
    unitSelect: elements.measureUnit,
    statusElement: elements.measureStatus,
    label: "Measure",
    onChange: () => renderMap(visibleTickets()),
  });
  scheduleMapDataOverlayRefresh();
}

function locatorNoteCategoryLabel(category) {
  return LOCATOR_NOTE_CATEGORIES[category]?.label || LOCATOR_NOTE_CATEGORIES.other.label;
}

function locatorNoteCategoryColor(category) {
  return LOCATOR_NOTE_CATEGORIES[category]?.color || LOCATOR_NOTE_CATEGORIES.other.color;
}

function setLocatorNoteMode(active) {
  locatorNoteMode = Boolean(active);
  document.body.classList.toggle("locator-note-mode", locatorNoteMode);
  if (elements.addLocatorNote) {
    elements.addLocatorNote.classList.toggle("active", locatorNoteMode);
    elements.addLocatorNote.textContent = locatorNoteMode ? "Cancel locator note" : "Add locator note";
  }
}

function locatorNoteTargetSummary(target) {
  if (!target) return "Map spot";
  if (target.targetType === "ticket") return `Ticket ${target.targetLabel || target.ticket || ""}`.trim();
  if (target.targetType === "vetro") {
    const layer = target.layerId ? ` - ${vetroLayerLabel(target.layerId)}` : "";
    return `VETRO feature${target.targetLabel ? `: ${target.targetLabel}` : ""}${layer}`;
  }
  if (target.targetType === "vitruvi") {
    const layer = target.layerId ? ` - ${vitruviLayerLabel(target.layerId)}` : "";
    return `Vitruvi feature${target.targetLabel ? `: ${target.targetLabel}` : ""}${layer}`;
  }
  return "Map spot";
}

function openLocatorNoteModal(target) {
  pendingLocatorNoteTarget = target;
  if (elements.locatorNoteTarget) elements.locatorNoteTarget.textContent = locatorNoteTargetSummary(target);
  if (elements.locatorNoteStatus) elements.locatorNoteStatus.textContent = "Photos or files are optional.";
  if (elements.locatorNoteCategory) elements.locatorNoteCategory.value = "instruction";
  if (elements.locatorNoteText) elements.locatorNoteText.value = "";
  if (elements.locatorNoteFiles) elements.locatorNoteFiles.value = "";
  if (elements.locatorNoteModal) elements.locatorNoteModal.hidden = false;
  window.setTimeout(() => elements.locatorNoteText?.focus(), 0);
}

function closeLocatorNoteModal() {
  if (elements.locatorNoteModal) elements.locatorNoteModal.hidden = true;
  pendingLocatorNoteTarget = null;
  setLocatorNoteMode(false);
}

function beginLocatorNoteForMap(latlng) {
  if (!latlng) return;
  openLocatorNoteModal({
    lat: latlng.lat,
    lng: latlng.lng,
    targetType: "map",
    targetLabel: "Map spot",
    targetId: "",
    ticket: "",
    layerId: "",
    featureId: "",
  });
}

function beginLocatorNoteForTicket(ticket, latlng = null) {
  const point = latlng || ticketPopupLatLng(ticket);
  if (!ticket || !point) return;
  openLocatorNoteModal({
    lat: point.lat,
    lng: point.lng,
    targetType: "ticket",
    targetLabel: ticket.ticket_number || "",
    targetId: ticket.ticket_number || "",
    ticket: ticket.ticket_number || "",
    layerId: "",
    featureId: "",
  });
}

function beginLocatorNoteForVetro(feature, latlng = null) {
  const props = feature?.properties || {};
  const layerId = vetroLayerControlId(feature);
  const point = latlng || featureCenterLatLng(feature);
  if (!point) return;
  const featureId = propValue(props, "ID", "feature_id", "vetro_id") || "";
  openLocatorNoteModal({
    lat: point.lat,
    lng: point.lng,
    targetType: "vetro",
    targetLabel: propValue(props, "Street_Address", "street_address", "Name", "name", "feature_id", "ID") || vetroLayerLabel(layerId),
    targetId: featureId,
    ticket: "",
    layerId,
    featureId,
  });
}

function beginLocatorNoteForVitruvi(feature, latlng = null) {
  const props = feature?.properties || {};
  const layerId = vitruviLayerId(feature);
  const point = latlng || featureCenterLatLng(feature);
  if (!point) return;
  const featureId = propValue(props, "vitruvi_id", "feature_id", "ID", "id", "uid") || "";
  openLocatorNoteModal({
    lat: point.lat,
    lng: point.lng,
    targetType: "vitruvi",
    targetLabel: propValue(props, "label", "name", "Name", "full_address", "Address", "feature_id") || vitruviLayerLabel(layerId),
    targetId: featureId,
    ticket: "",
    layerId,
    featureId,
  });
}

function featureCenterLatLng(feature) {
  try {
    const layer = L.geoJSON(feature);
    const bounds = layer.getBounds();
    if (bounds.isValid()) return bounds.getCenter();
  } catch (error) {
    console.warn("Unable to find feature center", error);
  }
  return null;
}

async function loadLocatorNotes() {
  if (!locatorNotesLayer) return;
  try {
    const response = await fetch("/api/locator-notes");
    if (!response.ok) throw new Error("Unable to load locator notes");
    const payload = await response.json();
    locatorNotes = Array.isArray(payload.notes) ? payload.notes : [];
    renderLocatorNotes();
  } catch (error) {
    console.warn(error);
  }
}

function renderLocatorNotes() {
  if (!locatorNotesLayer) return;
  locatorNotesLayer.clearLayers();
  for (const note of locatorNotes) {
    const lat = Number(note.lat);
    const lng = Number(note.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "",
        html: `<span class="locator-note-flag" style="--flag-color:${escapeHtml(locatorNoteCategoryColor(note.category))};--flag-opacity:${locatorNoteMarkerOpacity(note)}"></span>`,
        iconSize: [18, 22],
        iconAnchor: [4, 21],
        popupAnchor: [4, -20],
      }),
    });
    marker.bindPopup(locatorNotePopupHtml(note), { maxWidth: 360 });
    marker.addTo(locatorNotesLayer);
  }
}

function locatorNoteMarkerOpacity(note) {
  const targetType = String(note?.target_type || "");
  const layerId = String(note?.layer_id || "");
  if (targetType === "vetro" && layerId) return Math.max(0.035, Math.min(0.12, vetroLayerOpacity(layerId) * 0.18));
  if (targetType === "vitruvi" && layerId) return Math.max(0.035, Math.min(0.12, vitruviLayerOpacity(layerId) * 0.18));
  return 0.08;
}

function locatorNotesForTicket(ticket) {
  if (!ticket) return [];
  return locatorNotes.filter((note) => (
    note?.ticket === ticket.ticket_number
    || note?.target_id === ticket.ticket_number
    || locatorNoteFallsInsideTicket(note, ticket)
  ));
}

function locationPhotosForTicket(ticket) {
  if (!ticket) return [];
  return locationPhotos.filter((photo) => (
    photo?.ticket === ticket.ticket_number
    || pointFallsInsideTicket(photo, ticket)
  ));
}

function openPhotoHistoryForTicket(ticketNumber) {
  const ticket = tickets.find((item) => item.ticket_number === ticketNumber);
  if (!ticket) return;
  setCurrentView("location-photos");
  if (elements.locationPhotosTicket) elements.locationPhotosTicket.value = ticket.ticket_number;
  if (elements.locationPhotosLocationLabel && !elements.locationPhotosLocationLabel.value) {
    elements.locationPhotosLocationLabel.value = ticketAddress(ticket) || ticket.place || ticket.county || "";
  }
  if (elements.locationPhotosAddress && !elements.locationPhotosAddress.value) {
    elements.locationPhotosAddress.value = ticketAddress(ticket) || "";
  }
  renderLocationPhotosView(ticket);
  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
}

function locatorNoteFallsInsideTicket(note, ticket) {
  return pointFallsInsideTicket(note, ticket);
}

function pointFallsInsideTicket(point, ticket) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !ticket?.polygon) return false;
  const geometry = ticket.polygon.type === "Feature" ? ticket.polygon.geometry : ticket.polygon;
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return false;
  if (geometry.type === "Polygon") return pointInGeoJsonPolygon(lng, lat, coordinates);
  if (geometry.type === "MultiPolygon") return coordinates.some((polygon) => pointInGeoJsonPolygon(lng, lat, polygon));
  return false;
}

function locatorNoteFallsInsideTicketLegacy(note, ticket) {
  const lat = Number(note?.lat);
  const lng = Number(note?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !ticket?.polygon) return false;
  const geometry = ticket.polygon.type === "Feature" ? ticket.polygon.geometry : ticket.polygon;
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return false;
  if (geometry.type === "Polygon") return pointInGeoJsonPolygon(lng, lat, coordinates);
  if (geometry.type === "MultiPolygon") return coordinates.some((polygon) => pointInGeoJsonPolygon(lng, lat, polygon));
  return false;
}

function pointInGeoJsonPolygon(x, y, polygon) {
  if (!Array.isArray(polygon?.[0]) || !pointInGeoJsonRing(x, y, polygon[0])) return false;
  return !polygon.slice(1).some((ring) => pointInGeoJsonRing(x, y, ring));
}

function pointInGeoJsonRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i] || [];
    const pj = ring[j] || [];
    const xi = Number(pi[0]);
    const yi = Number(pi[1]);
    const xj = Number(pj[0]);
    const yj = Number(pj[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function locatorNoteSummaryHtml(notes = []) {
  if (!notes.length) return "";
  return `
    <div class="locator-note-summary">
      <strong>Locator note attached</strong>
      ${notes.map((note) => `
        <div>
          <span>${escapeHtml(locatorNoteCategoryLabel(note.category))}</span>
          ${note.text ? `<p>${escapeHtml(note.text)}</p>` : ""}
          ${note.created_by || note.created_at ? `<em>Added by ${escapeHtml([note.created_by, note.created_at].filter(Boolean).join(" - "))}</em>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function locationPhotoSummaryHtml(photos = []) {
  if (!photos.length) return "";
  return `
    <div class="location-photo-summary">
      <strong>Previous location photos in this area</strong>
      ${photos.map((photo) => `
        <a href="${escapeHtml(photo.url || "#")}" target="_blank" rel="noreferrer">
          <span>${escapeHtml(photo.original_name || "Location photo")}</span>
          <em>${escapeHtml([photo.uploaded_by, photo.uploaded_at].filter(Boolean).join(" - "))}</em>
          <small>${escapeHtml(locationPhotoCoordinateLabel(photo))}</small>
          ${photo.note ? `<p>${escapeHtml(photo.note)}</p>` : ""}
        </a>
      `).join("")}
    </div>
  `;
}

function photoHistoryButtonHtml(ticket, photos = []) {
  if (!photos.length) return "";
  return `
    <button class="photo-history-button" type="button" data-photo-history-ticket="${escapeHtml(ticket.ticket_number)}">
      Photo History (${photos.length})
    </button>
  `;
}

function locationPhotoCoordinateLabel(photo) {
  const lat = Number(photo?.lat);
  const lng = Number(photo?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "No coordinates";
  const source = photo.coordinate_source === "exif" ? "photo GPS" : photo.coordinate_source === "manual" ? "manual" : "coordinates";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)} (${source})`;
}

async function loadLocationPhotos() {
  if (locationPhotosLoading) return;
  locationPhotosLoading = true;
  try {
    const response = await fetch("/api/location-photos");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.message || `Location photos failed: ${response.status}`);
    locationPhotos = Array.isArray(payload.photos) ? payload.photos : [];
  } finally {
    locationPhotosLoading = false;
  }
}

function renderLocationPhotosView(focusTicket = null) {
  if (!elements.locationPhotosList) return;
  initLocationPhotosMap();
  const visiblePhotos = focusTicket ? locationPhotosForTicket(focusTicket) : locationPhotos;
  renderLocationPhotosMap(visiblePhotos);
  if (elements.locationPhotosSummary) {
    const label = focusTicket
      ? `Photo history for ${focusTicket.ticket_number}: ${visiblePhotos.length} matching photo${visiblePhotos.length === 1 ? "" : "s"}`
      : `${locationPhotos.length} stored photo${locationPhotos.length === 1 ? "" : "s"}`;
    elements.locationPhotosSummary.textContent = label;
  }
  if (!visiblePhotos.length) {
    elements.locationPhotosList.innerHTML = '<div class="location-photo-empty">No location photos uploaded yet.</div>';
    return;
  }
  elements.locationPhotosList.innerHTML = visiblePhotos.map((photo) => `
    <a class="location-photo-row" href="${escapeHtml(photo.url || "#")}" target="_blank" rel="noreferrer">
      <strong>${escapeHtml(photo.original_name || "Location photo")}</strong>
      <em>${escapeHtml([photo.ticket, photo.location_label, photo.review_status].filter(Boolean).join(" - "))}</em>
      <span>${escapeHtml(locationPhotoCoordinateLabel(photo))}</span>
      ${photo.address ? `<span>${escapeHtml(photo.address)}</span>` : ""}
      <small>${escapeHtml([photo.uploaded_by, photo.uploaded_at].filter(Boolean).join(" - "))}</small>
      ${photo.note ? `<p>${escapeHtml(photo.note)}</p>` : ""}
    </a>
  `).join("");
}

function initLocationPhotosMap() {
  if (!elements.locationPhotosMap || typeof L === "undefined") return;
  if (locationPhotosMap) {
    locationPhotosMap.invalidateSize();
    return;
  }
  locationPhotosMap = L.map(elements.locationPhotosMap, { zoomControl: true, preferCanvas: true }).setView([33.23, -92.67], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    subdomains: "abc",
    maxZoom: 20,
  }).addTo(locationPhotosMap);
  locationPhotosLayer = L.layerGroup().addTo(locationPhotosMap);
}

function renderLocationPhotosMap(photos = locationPhotos) {
  if (!locationPhotosMap || !locationPhotosLayer) return;
  locationPhotosLayer.clearLayers();
  const bounds = [];
  for (const photo of photos) {
    const lat = Number(photo?.lat);
    const lng = Number(photo?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const marker = L.circleMarker([lat, lng], {
      radius: 7,
      color: "#1d4ed8",
      fillColor: "#60a5fa",
      fillOpacity: 0.84,
      weight: 2,
    });
    marker.bindPopup(`
      <div class="location-photo-popup">
        <strong>${escapeHtml(photo.original_name || "Location photo")}</strong>
        <span>${escapeHtml(locationPhotoCoordinateLabel(photo))}</span>
        ${photo.note ? `<p>${escapeHtml(photo.note)}</p>` : ""}
        <a href="${escapeHtml(photo.url || "#")}" target="_blank" rel="noreferrer">Open photo</a>
      </div>
    `);
    marker.addTo(locationPhotosLayer);
    bounds.push([lat, lng]);
  }
  if (bounds.length) {
    locationPhotosMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  }
  locationPhotosMap.invalidateSize();
}

function setLocationPhotosProgress(percent, text = "") {
  if (elements.locationPhotosProgress) elements.locationPhotosProgress.hidden = false;
  if (elements.locationPhotosProgressBar) elements.locationPhotosProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (elements.locationPhotosStatus && text) elements.locationPhotosStatus.textContent = text;
}

function uploadLocationPhotos(event) {
  event.preventDefault();
  const files = [...(elements.locationPhotosFiles?.files || [])];
  if (!files.length) {
    if (elements.locationPhotosStatus) elements.locationPhotosStatus.textContent = "Choose photos to upload.";
    return;
  }
  if (files.length > 80) {
    if (elements.locationPhotosStatus) elements.locationPhotosStatus.textContent = "Select 80 photos or fewer.";
    return;
  }
  const data = new FormData();
  for (const file of files) data.append("files", file, file.name);
  if (elements.locationPhotosTicket?.value) data.set("ticket", elements.locationPhotosTicket.value);
  if (elements.locationPhotosLocationLabel?.value) data.set("locationLabel", elements.locationPhotosLocationLabel.value);
  if (elements.locationPhotosAddress?.value) data.set("address", elements.locationPhotosAddress.value);
  if (elements.locationPhotosLat?.value) data.set("lat", elements.locationPhotosLat.value);
  if (elements.locationPhotosLng?.value) data.set("lng", elements.locationPhotosLng.value);
  if (elements.locationPhotosNote?.value) data.set("note", elements.locationPhotosNote.value);
  const xhr = new XMLHttpRequest();
  if (elements.locationPhotosUpload) elements.locationPhotosUpload.disabled = true;
  setLocationPhotosProgress(2, `Preparing ${files.length} photo${files.length === 1 ? "" : "s"}...`);
  xhr.upload.addEventListener("progress", (progress) => {
    if (!progress.lengthComputable) {
      setLocationPhotosProgress(35, "Uploading photos...");
      return;
    }
    setLocationPhotosProgress(Math.min(90, Math.round((progress.loaded / progress.total) * 90)), "Uploading photos...");
  });
  xhr.addEventListener("load", async () => {
    try {
      const payload = JSON.parse(xhr.responseText || "{}");
      if (xhr.status < 200 || xhr.status >= 300 || payload.ok === false) throw new Error(payload.message || `Upload failed: ${xhr.status}`);
      setLocationPhotosProgress(96, "Refreshing location photos...");
      await loadLocationPhotos();
      renderLocationPhotosView();
      renderLocationPhotosMap();
      renderDetail();
      renderMobileTicketDetail();
      if (elements.locationPhotosFiles) elements.locationPhotosFiles.value = "";
      if (elements.locationPhotosNote) elements.locationPhotosNote.value = "";
      setLocationPhotosProgress(100, "Location photos uploaded.");
    } catch (error) {
      if (elements.locationPhotosStatus) elements.locationPhotosStatus.textContent = error.message || "Location photo upload failed.";
    } finally {
      if (elements.locationPhotosUpload) elements.locationPhotosUpload.disabled = false;
    }
  });
  xhr.addEventListener("error", () => {
    if (elements.locationPhotosStatus) elements.locationPhotosStatus.textContent = "Upload failed before reaching the server.";
    if (elements.locationPhotosUpload) elements.locationPhotosUpload.disabled = false;
  });
  xhr.open("POST", "/api/location-photos");
  xhr.send(data);
}

function locatorNotePopupHtml(note) {
  const attachments = Array.isArray(note.attachments) ? note.attachments : [];
  const attachmentHtml = attachments.length
    ? `<div class="locator-note-attachments">${attachments.map((item) => `<a href="${escapeHtml(item.url || "")}" target="_blank" rel="noreferrer">${escapeHtml(item.original_name || "Attachment")}</a>`).join("")}</div>`
    : "";
  const created = [note.created_by, note.created_at].filter(Boolean).join(" - ");
  return `
    <div class="locator-note-popup">
      <strong>${escapeHtml(locatorNoteCategoryLabel(note.category))}</strong>
      <small>${escapeHtml(note.target_label || note.target_type || "Map spot")}</small>
      ${note.text ? `<p>${escapeHtml(note.text).replaceAll("\n", "<br>")}</p>` : ""}
      ${attachmentHtml}
      ${created ? `<em>${escapeHtml(created)}</em>` : ""}
    </div>
  `;
}

async function submitLocatorNote(event) {
  event.preventDefault();
  const target = pendingLocatorNoteTarget;
  if (!target) return;
  const files = [...(elements.locatorNoteFiles?.files || [])];
  if (files.length > 20) {
    if (elements.locatorNoteStatus) elements.locatorNoteStatus.textContent = "Select 20 attachments or fewer.";
    return;
  }
  const form = new FormData();
  form.append("lat", String(target.lat));
  form.append("lng", String(target.lng));
  form.append("category", elements.locatorNoteCategory?.value || "instruction");
  form.append("text", elements.locatorNoteText?.value || "");
  form.append("targetType", target.targetType || "map");
  form.append("targetLabel", target.targetLabel || "");
  form.append("targetId", target.targetId || "");
  form.append("ticket", target.ticket || "");
  form.append("layerId", target.layerId || "");
  form.append("featureId", target.featureId || "");
  for (const file of files) form.append("attachments", file, file.name);
  if (elements.locatorNoteStatus) elements.locatorNoteStatus.textContent = "Saving note...";
  const response = await fetch("/api/locator-notes", { method: "POST", body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    if (elements.locatorNoteStatus) elements.locatorNoteStatus.textContent = payload.message || "Unable to save locator note.";
    return;
  }
  locatorNotes.push(payload.note);
  renderLocatorNotes();
  closeLocatorNoteModal();
  showSavedToast("Locator note saved");
}

function formatMeasureDistance(meters, unit = "feet") {
  const feet = meters * 3.28084;
  if (unit === "miles") return `${(feet / 5280).toFixed(2)} mi`;
  return `${Math.round(feet).toLocaleString()} ft`;
}

function measurePointIcon(index) {
  return L.divIcon({
    className: "",
    html: `<span class="measure-point">${index}</span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function measureLabelIcon(text) {
  return L.divIcon({
    className: "",
    html: `<span class="measure-distance-label">${escapeHtml(text)}</span>`,
    iconSize: [110, 24],
    iconAnchor: [55, 12],
  });
}

function createMeasureTool({ map, toggleButton, clearButton, unitSelect, statusElement, label, onChange = null }) {
  const tool = {
    active: false,
    points: [],
    layer: L.layerGroup().addTo(map),
    line: null,
    segmentLabels: [],
    unit: unitSelect?.value === "miles" ? "miles" : "feet",
  };

  const statusText = () => {
    if (!tool.active && !tool.points.length) return "Off";
    if (tool.active && !tool.points.length) return "Click first point";
    if (tool.active && tool.points.length === 1) return "Click next point";
    const total = tool.points.slice(1).reduce((sum, point, index) => sum + point.distanceTo(tool.points[index]), 0);
    return `${tool.points.length} pts · ${formatMeasureDistance(total, tool.unit)}`;
  };

  const updateStatus = () => {
    if (statusElement) statusElement.textContent = statusText();
    if (toggleButton) {
      toggleButton.classList.toggle("active", tool.active);
      toggleButton.setAttribute("aria-pressed", tool.active ? "true" : "false");
      toggleButton.textContent = tool.active ? "Measuring" : label;
    }
    map.getContainer().classList.toggle("measuring", tool.active);
  };

  const redraw = () => {
    tool.layer.clearLayers();
    tool.segmentLabels = [];
    tool.line = null;
    if (tool.points.length) {
      tool.line = L.polyline(tool.points, {
        color: "#0ea5e9",
        weight: 4,
        opacity: 0.95,
        dashArray: "8 6",
      }).addTo(tool.layer);
    }
    tool.points.forEach((point, index) => {
      L.marker(point, { icon: measurePointIcon(index + 1), interactive: false }).addTo(tool.layer);
      if (index === 0) return;
      const previous = tool.points[index - 1];
      const midpoint = L.latLng((previous.lat + point.lat) / 2, (previous.lng + point.lng) / 2);
      const labelMarker = L.marker(midpoint, {
        icon: measureLabelIcon(formatMeasureDistance(previous.distanceTo(point), tool.unit)),
        interactive: false,
      }).addTo(tool.layer);
      tool.segmentLabels.push(labelMarker);
    });
    updateStatus();
  };

  const addPoint = (latlng) => {
    tool.points.push(L.latLng(latlng.lat, latlng.lng));
    redraw();
  };

  const clear = () => {
    tool.points = [];
    tool.layer.clearLayers();
    tool.segmentLabels = [];
    tool.line = null;
    updateStatus();
  };

  const setActive = (active) => {
    tool.active = Boolean(active);
    updateStatus();
    if (typeof onChange === "function") onChange(tool.active);
  };

  map.on("click", (event) => {
    if (!tool.active) return;
    if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
    addPoint(event.latlng);
  });
  map.on("contextmenu", () => {
    if (tool.active) setActive(false);
  });
  map.on("zoomend moveend", redraw);
  if (toggleButton) {
    toggleButton.addEventListener("click", () => setActive(!tool.active));
  }
  if (clearButton) {
    clearButton.addEventListener("click", clear);
  }
  if (unitSelect) {
    unitSelect.addEventListener("change", () => {
      tool.unit = unitSelect.value === "miles" ? "miles" : "feet";
      redraw();
    });
  }
  updateStatus();
  return { ...tool, addPoint, clear, setActive, get active() { return tool.active; } };
}

function setLocationButtonsBusy(busy, label = "") {
  for (const button of [elements.locateMe, elements.mobileLocateMe]) {
    if (!button) continue;
    button.disabled = busy;
    button.textContent = busy ? "Locating..." : (label || (liveLocationEnabled ? "Live on" : "Live location"));
  }
}

function syncLocationUi() {
  if (elements.mobileLiveStatus) elements.mobileLiveStatus.textContent = liveLocationEnabled ? "Live location on" : "One Call polygons and fiber layers";
  if (elements.mobileLocateMe) elements.mobileLocateMe.textContent = liveLocationEnabled ? "Live on" : "Live location";
  if (elements.mobileFollowLocation) elements.mobileFollowLocation.textContent = liveLocationEnabled ? "Following" : "Follow me";
}

function updateUserLocation(position, { center = true } = {}) {
  if (!map || !userLocationLayer) return;
  const coords = position.coords || {};
  const lat = Number(coords.latitude);
  const lng = Number(coords.longitude);
  const accuracy = Number(coords.accuracy || 0);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Location is unavailable.");
  const latlng = [lat, lng];
  if (!userLocationMarker) {
    userLocationMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: "",
        html: '<span class="user-location-marker" aria-label="Your location"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      zIndexOffset: 1000,
    }).addTo(userLocationLayer);
    userLocationMarker.bindPopup("Your current location");
  } else {
    userLocationMarker.setLatLng(latlng);
  }
  if (!userLocationAccuracy) {
    userLocationAccuracy = L.circle(latlng, {
      radius: Number.isFinite(accuracy) ? accuracy : 0,
      color: "#1d9bf0",
      fillColor: "#1d9bf0",
      fillOpacity: 0.12,
      opacity: 0.45,
      weight: 2,
    }).addTo(userLocationLayer);
  } else {
    userLocationAccuracy.setLatLng(latlng);
    userLocationAccuracy.setRadius(Number.isFinite(accuracy) ? accuracy : 0);
  }
  if (center) map.flyTo(latlng, Math.max(map.getZoom(), 17), { duration: 0.45 });
  updateMap3dUserLocation(position, { center });
  updateMobileUserLocation(latlng, accuracy, { center });
  showSavedToast("Location shown on map");
}

function updateMobileUserLocation(latlng, accuracy = 0, { center = true } = {}) {
  if (!mobileMap || !mobileMapUserLayer) return;
  if (!mobileUserLocationMarker) {
    mobileUserLocationMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: "",
        html: '<span class="user-location-marker mobile-user-location-marker" aria-label="Your live location"></span>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
      zIndexOffset: 1000,
    }).addTo(mobileMapUserLayer);
    mobileUserLocationMarker.bindPopup("Your live location");
  } else {
    mobileUserLocationMarker.setLatLng(latlng);
  }
  if (!mobileUserLocationAccuracy) {
    mobileUserLocationAccuracy = L.circle(latlng, {
      radius: Number.isFinite(accuracy) ? accuracy : 0,
      color: "#38bdf8",
      fillColor: "#38bdf8",
      fillOpacity: 0.12,
      opacity: 0.55,
      weight: 2,
    }).addTo(mobileMapUserLayer);
  } else {
    mobileUserLocationAccuracy.setLatLng(latlng);
    mobileUserLocationAccuracy.setRadius(Number.isFinite(accuracy) ? accuracy : 0);
  }
  if (center) mobileMap.flyTo(latlng, Math.max(mobileMap.getZoom(), 17), { duration: 0.35 });
}

function requestUserLocation() {
  if (!navigator.geolocation) {
    window.alert("Location is not available in this browser.");
    return;
  }
  setLocationButtonsBusy(true);
  navigator.geolocation.getCurrentPosition(
    (position) => {
      try {
        updateUserLocation(position);
      } catch (error) {
        window.alert(error.message || "Location failed.");
      } finally {
        setLocationButtonsBusy(false);
      }
    },
    (error) => {
      setLocationButtonsBusy(false);
      const message = error?.code === error?.PERMISSION_DENIED
        ? "Location permission was denied. Enable location access for Fiber Locator in your browser or phone settings."
        : "Unable to get your current location.";
      window.alert(message);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
  );
}

function toggleLiveLocation() {
  if (!navigator.geolocation) {
    window.alert("Location is not available in this browser.");
    return;
  }
  if (liveLocationEnabled && locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
    liveLocationEnabled = false;
    syncLocationUi();
    showSavedToast("Live location off");
    return;
  }
  setMobilePanel("map");
  liveLocationEnabled = true;
  syncLocationUi();
  locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      try {
        updateUserLocation(position, { center: true });
        if (elements.mobileLiveStatus) {
          const accuracy = Number(position.coords?.accuracy || 0);
          elements.mobileLiveStatus.textContent = `Live location on${Number.isFinite(accuracy) && accuracy ? ` · ±${Math.round(accuracy)} m` : ""}`;
        }
      } catch (error) {
        console.warn(error);
      }
    },
    (error) => {
      liveLocationEnabled = false;
      locationWatchId = null;
      syncLocationUi();
      const message = error?.code === error?.PERMISSION_DENIED
        ? "Location permission was denied. Enable location access for Fiber Locator in your browser or phone settings."
        : "Unable to keep live location on.";
      window.alert(message);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
  );
}

async function deployAppUpdate() {
  showSavedToast("Checking for app update...");
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update()));
    }
    const response = await fetch("/", { cache: "reload" });
    if (!response.ok) throw new Error(`Update check failed: ${response.status}`);
    showSavedToast("App updated. Reloading...");
    window.setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    console.error(error);
    showSavedToast("App update failed");
  }
}

function unregisterWebAppServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) registration.unregister();
    }).catch((error) => {
      console.warn("Service worker cleanup failed", error);
    });
  });
}

function applySidebarCollapsed() {
  document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  if (elements.sidebarCollapse) {
    elements.sidebarCollapse.textContent = sidebarCollapsed ? "›" : "‹";
    elements.sidebarCollapse.dataset.state = sidebarCollapsed ? "collapsed" : "expanded";
    elements.sidebarCollapse.title = sidebarCollapsed ? "Expand ticket panel" : "Collapse ticket panel";
    elements.sidebarCollapse.setAttribute("aria-label", elements.sidebarCollapse.title);
  }
  if (map) {
    requestAnimationFrame(() => map.invalidateSize());
  }
}

function setSidebarCollapsed(collapsed) {
  sidebarCollapsed = collapsed;
  writeBooleanStorage(STORAGE_KEYS.sidebarCollapsed, sidebarCollapsed);
  applySidebarCollapsed();
  scheduleDashboardStateSave();
}

function mapboxTileLayer(tile) {
  if (!mapConfig.mapboxAccessToken) {
    throw new Error("Mapbox access token is not configured on this server.");
  }
  return L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/${tile.styleId}/tiles/512/{z}/{x}/{y}?access_token=${encodeURIComponent(mapConfig.mapboxAccessToken)}`, {
    maxZoom: 22,
    tileSize: 512,
    zoomOffset: -1,
    attribution: tile.attribution,
    opacity: mapOpacity,
  });
}

function loadCssOnce(href) {
  if ([...document.styleSheets].some((sheet) => sheet.href === href)) return Promise.resolve();
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = resolve;
    link.onerror = () => reject(new Error(`Stylesheet failed to load: ${href}`));
    document.head.appendChild(link);
  });
}

function loadScriptOnce(src, timeoutMs = 15000) {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  if (existing?.dataset.failed === "true") existing.remove();
  const active = document.querySelector(`script[src="${src}"]`);
  if (active) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(`Script timed out: ${src}`)), timeoutMs);
      active.addEventListener("load", () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
      active.addEventListener("error", () => {
        window.clearTimeout(timer);
        active.dataset.failed = "true";
        active.remove();
        reject(new Error(`Script failed to load: ${src}`));
      }, { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    const timer = window.setTimeout(() => {
      script.dataset.failed = "true";
      script.remove();
      reject(new Error(`Script timed out: ${src}`));
    }, timeoutMs);
    script.onload = () => {
      window.clearTimeout(timer);
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.dataset.failed = "true";
      script.remove();
      reject(new Error(`Script failed to load: ${src}`));
    };
    document.head.appendChild(script);
  });
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function ensureMaplibreAssets() {
  if (window.maplibregl && L.maplibreGL) return;
  if (!maplibreAssetsPromise) {
    maplibreAssetsPromise = (async () => {
      await loadCssOnce("https://unpkg.com/maplibre-gl@5.7.3/dist/maplibre-gl.css");
      await loadScriptOnce("https://unpkg.com/maplibre-gl@5.7.3/dist/maplibre-gl.js");
      await loadScriptOnce("https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js");
    })();
  }
  await maplibreAssetsPromise;
}

async function ensureMapbox3dAssets() {
  if (window.mapboxgl) return;
  if (!map3dAssetsPromise) {
    map3dAssetsPromise = (async () => {
      const css = "https://api.mapbox.com/mapbox-gl-js/v3.24.0/mapbox-gl.css";
      const js = "https://api.mapbox.com/mapbox-gl-js/v3.24.0/mapbox-gl.js";
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await loadCssOnce(css);
          await loadScriptOnce(js);
          if (window.mapboxgl) return;
        } catch (error) {
          lastError = error;
          document.querySelector(`script[src="${js}"]`)?.remove();
          await wait(500 + attempt * 500);
        }
      }
      throw lastError || new Error("Mapbox GL JS did not load.");
    })();
  }
  try {
    await map3dAssetsPromise;
  } catch (error) {
    map3dAssetsPromise = null;
    throw error;
  }
}

async function maplibreTileLayer(tile) {
  await ensureMaplibreAssets();
  if (!window.maplibregl || !L.maplibreGL) {
    throw new Error("MapLibre basemap libraries did not load.");
  }
  if (!maplibreStyleCache[tile.styleUrl]) {
    const response = await fetch(tile.styleUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Free vector basemap failed to load: ${response.status}`);
    const style = await response.json();
    if (!style || style.version !== 8 || !style.sources || !Array.isArray(style.layers)) {
      throw new Error("Free vector basemap returned an invalid style.");
    }
    maplibreStyleCache[tile.styleUrl] = style;
  }
  const style = customizeMaplibreStyle(cloneState(maplibreStyleCache[tile.styleUrl]), tile);
  return L.maplibreGL({
    style,
    interactive: false,
  });
}

function customizeMaplibreStyle(style, tile) {
  if (tile.customize !== "locator-dark-detail") return style;
  style.name = "Dark locator detail";
  for (const layer of style.layers || []) {
    const layerId = String(layer.id || "").toLowerCase();
    const sourceLayer = String(layer["source-layer"] || "").toLowerCase();
    const type = layer.type;
    layer.paint = layer.paint || {};
    layer.layout = layer.layout || {};

    if (type === "background") {
      layer.paint["background-color"] = "#07111f";
      continue;
    }

    if (type === "fill") {
      if (sourceLayer.includes("building") || layerId.includes("building")) {
        layer.paint["fill-color"] = "#263f56";
        layer.paint["fill-outline-color"] = "#6fb7dc";
        layer.paint["fill-opacity"] = 0.86;
      } else if (sourceLayer.includes("water") || layerId.includes("water")) {
        layer.paint["fill-color"] = "#0a2840";
        layer.paint["fill-opacity"] = 0.95;
      } else if (layerId.includes("park") || layerId.includes("wood") || layerId.includes("landcover")) {
        layer.paint["fill-color"] = "#12372f";
        layer.paint["fill-opacity"] = 0.72;
      } else {
        layer.paint["fill-color"] = "#101c2d";
        layer.paint["fill-opacity"] = layer.paint["fill-opacity"] ?? 0.9;
      }
    }

    if (type === "fill-extrusion" && (sourceLayer.includes("building") || layerId.includes("building"))) {
      layer.paint["fill-extrusion-color"] = "#29445c";
      layer.paint["fill-extrusion-opacity"] = 0.82;
    }

    if (type === "line") {
      if (layerId.includes("road") || layerId.includes("highway") || sourceLayer.includes("transportation")) {
        const isCasing = layerId.includes("case") || layerId.includes("casing");
        const isMajor = layerId.includes("motorway") || layerId.includes("trunk") || layerId.includes("primary");
        layer.paint["line-color"] = isCasing ? "#07111f" : (isMajor ? "#67b7ff" : "#a7c4da");
        layer.paint["line-opacity"] = isCasing ? 0.95 : 0.9;
      } else if (layerId.includes("water")) {
        layer.paint["line-color"] = "#22607e";
      }
    }

    if (type === "symbol") {
      const isRoadLabel = layerId.includes("road") || layerId.includes("highway");
      const isHouseLabel = layerId.includes("housenumber") || layerId.includes("address");
      layer.paint["text-color"] = isHouseLabel ? "#ffe7a3" : (isRoadLabel ? "#f8fbff" : "#dbeafe");
      layer.paint["text-halo-color"] = "#06101d";
      layer.paint["text-halo-width"] = isRoadLabel || isHouseLabel ? 1.7 : 1.25;
      layer.paint["text-halo-blur"] = 0.2;
      if (layer.paint["icon-opacity"] !== undefined) layer.paint["icon-opacity"] = 0.9;
    }
  }
  return style;
}

function bringBaseLayerToBack(layer) {
  if (!layer) return;
  if (typeof layer.bringToBack === "function") {
    layer.bringToBack();
    return;
  }
  if (typeof layer.eachLayer === "function") {
    layer.eachLayer((item) => {
      if (typeof item.bringToBack === "function") item.bringToBack();
    });
  }
}

async function setMapTileStyle(style, save = true) {
  mapStyle = MAP_TILE_STYLES[style] ? style : "contrast";
  localStorage.setItem(STORAGE_KEYS.mapStyle, mapStyle);
  if (elements.mapStyle) elements.mapStyle.value = mapStyle;
  if (!isImageryMapStyle(mapStyle)) lastStreetMapStyle = mapStyle;
  if (!map) return;
  if (baseTileLayer) {
    map.removeLayer(baseTileLayer);
  }
  const tile = MAP_TILE_STYLES[mapStyle];
  if (tile.provider === "maplibre") {
    try {
      baseTileLayer = await maplibreTileLayer(tile);
      baseTileLayer.addTo(map);
      bringBaseLayerToBack(baseTileLayer);
    } catch (error) {
      console.error(error);
      mapStyle = "contrast";
      localStorage.setItem(STORAGE_KEYS.mapStyle, mapStyle);
      if (elements.mapStyle) elements.mapStyle.value = mapStyle;
      baseTileLayer = L.tileLayer(MAP_TILE_STYLES.contrast.url, {
        maxZoom: 20,
        attribution: MAP_TILE_STYLES.contrast.attribution,
        opacity: mapOpacity,
        subdomains: MAP_TILE_STYLES.contrast.subdomains,
      }).addTo(map);
      bringBaseLayerToBack(baseTileLayer);
      window.alert(`${error.message} Falling back to High contrast streets.`);
    }
  } else if (tile.provider === "mapbox") {
    try {
      baseTileLayer = mapboxTileLayer(tile);
      baseTileLayer.addTo(map);
      bringBaseLayerToBack(baseTileLayer);
    } catch (error) {
      console.error(error);
      mapStyle = "contrast";
      localStorage.setItem(STORAGE_KEYS.mapStyle, mapStyle);
      if (elements.mapStyle) elements.mapStyle.value = mapStyle;
      baseTileLayer = L.tileLayer(MAP_TILE_STYLES.contrast.url, {
        maxZoom: 20,
        attribution: MAP_TILE_STYLES.contrast.attribution,
        opacity: mapOpacity,
        subdomains: MAP_TILE_STYLES.contrast.subdomains,
      }).addTo(map);
      bringBaseLayerToBack(baseTileLayer);
      window.alert(`${error.message} Falling back to High contrast streets.`);
    }
  } else if (Array.isArray(tile.layers)) {
    baseTileLayer = L.layerGroup(
      tile.layers.map((item) => L.tileLayer(item.url, {
        maxZoom: 20,
        attribution: item.attribution || tile.attribution,
        opacity: mapOpacity,
        ...(item.subdomains ? { subdomains: item.subdomains } : {}),
      })),
    ).addTo(map);
    bringBaseLayerToBack(baseTileLayer);
  } else {
    baseTileLayer = L.tileLayer(tile.url, {
      maxZoom: 20,
      attribution: tile.attribution,
      opacity: mapOpacity,
      ...(tile.subdomains ? { subdomains: tile.subdomains } : {}),
    }).addTo(map);
    bringBaseLayerToBack(baseTileLayer);
  }
  scheduleMapDataOverlayRefresh();
  syncDashboardSatelliteToggle();
  void renderInHouseBaseLayer();
  if (save) scheduleDashboardStateSave();
}

function isImageryMapStyle(style) {
  return ["satellite", "hybrid"].includes(style) || Boolean(MAP_TILE_STYLES[style]?.imagery);
}

function preferredImageryMapStyle() {
  if (mapConfig.mapboxAccessToken) return "mapbox-satellite-streets";
  return "hybrid";
}

function preferredStreetMapStyle() {
  return MAP_TILE_STYLES[lastStreetMapStyle] && !isImageryMapStyle(lastStreetMapStyle) ? lastStreetMapStyle : "locator-dark-detail";
}

function syncDashboardSatelliteToggle() {
  if (!elements.dashboardSatelliteToggle) return;
  const active = mapStyle === "mapbox-satellite-streets";
  elements.dashboardSatelliteToggle.classList.toggle("active", active);
  elements.dashboardSatelliteToggle.setAttribute("aria-pressed", active ? "true" : "false");
  elements.dashboardSatelliteToggle.textContent = active ? "Streets" : "Satellite";
}

function map3dStyleUrl() {
  return map3dStyle === "satellite" ? "mapbox://styles/mapbox/satellite-streets-v12" : "mapbox://styles/mapbox/streets-v12";
}

function isMapboxStandard3dStyle() {
  return false;
}

function map3dStyleLayers() {
  if (!map3d) return null;
  try {
    return map3d.getStyle()?.layers || null;
  } catch (error) {
    return null;
  }
}

function configureMap3dBasemap() {
  if (!map3d || !isMapboxStandard3dStyle()) return;
  try {
    map3d.setConfigProperty("basemap", "show3dObjects", true);
    map3d.setConfigProperty("basemap", "showRoadLabels", true);
    map3d.setConfigProperty("basemap", "showPlaceLabels", true);
    map3d.setConfigProperty("basemap", "showPointOfInterestLabels", true);
    map3d.setConfigProperty("basemap", "lightPreset", "day");
  } catch (error) {
    console.warn("3D basemap configuration failed", error);
  }
}

function syncMap3dControls() {
  if (elements.map) elements.map.classList.toggle("map-2d-hidden", map3dEnabled);
  if (elements.dashboard3dToggle) {
    elements.dashboard3dToggle.classList.toggle("active", map3dEnabled);
    elements.dashboard3dToggle.setAttribute("aria-pressed", map3dEnabled ? "true" : "false");
    elements.dashboard3dToggle.textContent = map3dEnabled ? "2D" : "3D";
  }
  if (elements.dashboard3dStyle) {
    elements.dashboard3dStyle.hidden = !map3dEnabled;
    elements.dashboard3dStyle.textContent = map3dStyle === "satellite" ? "Street 3D" : "Satellite 3D";
  }
  if (elements.dashboard3dTilt) elements.dashboard3dTilt.hidden = !map3dEnabled;
  if (elements.map3d) elements.map3d.hidden = !map3dEnabled;
}

function map3dTicketCollection(kind) {
  const features = [];
  for (const ticket of visibleTickets()) {
    const colors = ticketMapColors(ticket);
    if (kind === "polygon" && ticket.polygon) {
      const geometry = ticket.polygon.type === "Feature" ? ticket.polygon.geometry : ticket.polygon;
      features.push({
        type: "Feature",
        properties: { id: ticket.ticket_number, color: colors.stroke, fill: colors.fill },
        geometry,
      });
    }
    if (kind === "point" && typeof ticket.latitude === "number" && typeof ticket.longitude === "number") {
      features.push({
        type: "Feature",
        properties: { id: ticket.ticket_number, color: colors.stroke, fill: colors.fill },
        geometry: { type: "Point", coordinates: [ticket.longitude, ticket.latitude] },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function map3dLocatorNoteCollection() {
  return {
    type: "FeatureCollection",
    features: locatorNotes
      .filter((note) => Number.isFinite(Number(note.lat)) && Number.isFinite(Number(note.lng)))
      .map((note) => ({
        type: "Feature",
        properties: { id: note.id || "", color: locatorNoteCategoryColor(note.category) },
        geometry: { type: "Point", coordinates: [Number(note.lng), Number(note.lat)] },
      })),
  };
}

function map3dStyledFeature(kind, feature) {
  const layerId = kind === "vetro" ? vetroLayerControlId(feature) : vitruviLayerId(feature);
  const geometry = feature?.geometry?.type || "";
  const serviceLocation = kind === "vetro" && isSlFeature(feature);
  const opacity = serviceLocation ? vetroSlOpacity : (kind === "vetro" ? vetroLayerOpacity(layerId) : vitruviLayerOpacity(layerId));
  const size = serviceLocation ? vetroSlSize : (kind === "vetro" ? vetroLayerSize(layerId) : vitruviLayerSize(layerId));
  const style = serviceLocation ? vetroSlShape : (kind === "vetro" ? vetroLayerShape(layerId) : (vitruviLayerStyleOverrides[String(layerId)] || (geometry.startsWith("Line") ? "solid" : "circle")));
  const color = serviceLocation ? vetroSlColor : (kind === "vetro" ? colorForVetroLayer(layerId) : colorForVitruviLayer(layerId));
  const outline = serviceLocation ? vetroSlOutlineColor : "#ffffff";
  const label = serviceLocation && vetroSlLabels ? slLabel(feature) : "";
  return {
    ...feature,
    properties: {
      ...(feature.properties || {}),
      _layerId: layerId,
      _color: color,
      _outline: outline,
      _opacity: opacity,
      _size: size,
      _style: style,
      _icon: map3dShapeIconName(kind, style, color, outline),
      _label: label,
    },
  };
}

function map3dStyledCollection(kind) {
  const geojson = kind === "vetro" ? filteredVetroGeojson() : filteredVitruviGeojson();
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  return { type: "FeatureCollection", features: features.map((feature) => map3dStyledFeature(kind, feature)) };
}

function map3dAddSource(id, data) {
  if (!map3d) return;
  const spec = { type: "geojson", data };
  try {
    const source = map3d.getSource(id);
    if (source?.setData) source.setData(data);
    else map3d.addSource(id, spec);
  } catch (error) {
    console.warn("3D source failed", id, error);
  }
}

function map3dAddLayer(spec) {
  if (!map3d || map3d.getLayer(spec.id)) return;
  try {
    const layerSpec = isMapboxStandard3dStyle() && !spec.slot ? { ...spec, slot: "top" } : spec;
    map3d.addLayer(layerSpec);
  } catch (error) {
    console.warn("3D layer failed", spec.id, error);
  }
}

function map3dShapeIconName(kind, shape, color, outline = "#ffffff") {
  const normalizedShape = ["circle", "square", "diamond", "pin", "house"].includes(String(shape || "")) ? String(shape) : "circle";
  const normalizedColor = normalizeHexColor(color) || "#2563eb";
  const normalizedOutline = normalizeHexColor(outline) || "#ffffff";
  return `${kind}-${normalizedShape}-${normalizedColor.slice(1)}-${normalizedOutline.slice(1)}`;
}

function map3dMakeShapeIcon(shape, color, outline = "#ffffff") {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.translate(32, 32);
  context.fillStyle = normalizeHexColor(color) || "#2563eb";
  context.strokeStyle = normalizeHexColor(outline) || "#ffffff";
  context.lineWidth = 5;
  context.shadowColor = "rgba(15,23,42,.35)";
  context.shadowBlur = 5;
  if (shape === "square") {
    context.rect(-18, -18, 36, 36);
  } else if (shape === "diamond") {
    context.rotate(Math.PI / 4);
    context.rect(-17, -17, 34, 34);
  } else if (shape === "pin") {
    context.rotate(-Math.PI / 4);
    context.beginPath();
    context.arc(0, 0, 18, 0, Math.PI * 2);
    context.lineTo(18, 18);
    context.closePath();
  } else if (shape === "house") {
    context.beginPath();
    context.moveTo(0, -22);
    context.lineTo(22, -3);
    context.lineTo(22, 22);
    context.lineTo(-22, 22);
    context.lineTo(-22, -3);
    context.closePath();
  } else {
    context.beginPath();
    context.arc(0, 0, 19, 0, Math.PI * 2);
  }
  context.fill();
  context.stroke();
  try {
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } catch (error) {
    return canvas;
  }
}

function map3dEnsureShapeImages(data) {
  if (!map3d) return;
  for (const feature of data?.features || []) {
    const icon = feature?.properties?._icon;
    if (!icon || map3d.hasImage(icon)) continue;
    try {
      map3d.addImage(
        icon,
        map3dMakeShapeIcon(feature.properties._style, feature.properties._color, feature.properties._outline),
        { pixelRatio: 2 },
      );
    } catch (error) {
      console.warn("3D icon failed", icon, error);
    }
  }
}

function addMap3dBuildingExtrusions() {
  if (!map3d || map3d.getLayer("map3d-buildings") || !map3d.getSource("composite")) return;
  const layers = map3dStyleLayers() || [];
  const labelLayer = layers.find((layer) => layer.type === "symbol" && layer.layout && layer.layout["text-field"]);
  const buildingLayer = {
    id: "map3d-buildings",
    source: "composite",
    "source-layer": "building",
    filter: ["==", "extrude", "true"],
    type: "fill-extrusion",
    minzoom: 14,
    paint: {
      "fill-extrusion-color": "#c9d2dc",
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 16, ["coalesce", ["get", "height"], 12]],
      "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 14, 0, 16, ["coalesce", ["get", "min_height"], 0]],
      "fill-extrusion-opacity": 0.72,
    },
  };
  try {
    map3d.addLayer(buildingLayer, labelLayer?.id);
  } catch (error) {
    console.warn("3D buildings failed", error);
  }
}

function map3dLineFilter(style) {
  return [
    "all",
    ["any", ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "MultiLineString"]],
    ...(style === "solid"
      ? [["!=", ["get", "_style"], "dashed"], ["!=", ["get", "_style"], "dotted"]]
      : [["==", ["get", "_style"], style]]),
  ];
}

function map3dApplyStyledSource(kind, data) {
  const source = `${kind}-3d`;
  map3dEnsureShapeImages(data);
  map3dAddSource(source, data);
  map3dAddLayer({
    id: `${kind}-3d-fill`,
    type: "fill",
    source,
    filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
    paint: { "fill-color": ["coalesce", ["get", "_color"], "#2563eb"], "fill-opacity": ["*", ["coalesce", ["to-number", ["get", "_opacity"]], 0.72], 0.32] },
  });
  for (const style of ["solid", "dashed", "dotted"]) {
    map3dAddLayer({
      id: `${kind}-3d-line-${style}`,
      type: "line",
      source,
      filter: map3dLineFilter(style),
      paint: {
        "line-color": ["coalesce", ["get", "_color"], "#2563eb"],
        "line-width": ["coalesce", ["to-number", ["get", "_size"]], 3],
        "line-opacity": ["coalesce", ["to-number", ["get", "_opacity"]], 0.72],
        ...(style === "dashed" ? { "line-dasharray": [2, 1.5] } : {}),
        ...(style === "dotted" ? { "line-dasharray": [0.4, 1.6] } : {}),
      },
    });
  }
  map3dAddLayer({
    id: `${kind}-3d-point-symbol`,
    type: "symbol",
    source,
    filter: ["any", ["==", ["geometry-type"], "Point"], ["==", ["geometry-type"], "MultiPoint"]],
    layout: {
      "icon-image": ["get", "_icon"],
      "icon-size": ["interpolate", ["linear"], ["coalesce", ["to-number", ["get", "_size"]], 12], 4, 0.42, 13, 0.72, 28, 1.2],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: {
      "icon-opacity": ["coalesce", ["to-number", ["get", "_opacity"]], 0.72],
    },
  });
  map3dAddLayer({
    id: `${kind}-3d-point-label`,
    type: "symbol",
    source,
    filter: ["all", ["any", ["==", ["geometry-type"], "Point"], ["==", ["geometry-type"], "MultiPoint"]], ["!=", ["get", "_label"], ""]],
    layout: {
      "text-field": ["get", "_label"],
      "text-size": 12,
      "text-offset": [0, 1.25],
      "text-anchor": "top",
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#111827",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.4,
      "text-opacity": ["coalesce", ["to-number", ["get", "_opacity"]], 0.85],
    },
  });
}

function refreshMap3dLayers() {
  if (!map3dEnabled || !map3d || !map3dStyleLayers()) return;
  map3dAddSource("tickets-poly-3d", map3dTicketCollection("polygon"));
  map3dAddLayer({ id: "tickets-poly-3d-fill", type: "fill", source: "tickets-poly-3d", paint: { "fill-color": ["coalesce", ["get", "fill"], "#16a34a"], "fill-opacity": 0.18 } });
  map3dAddLayer({ id: "tickets-poly-3d-line", type: "line", source: "tickets-poly-3d", paint: { "line-color": ["coalesce", ["get", "color"], "#16a34a"], "line-width": 3 } });
  map3dAddSource("tickets-point-3d", map3dTicketCollection("point"));
  map3dAddLayer({ id: "tickets-point-3d-dot", type: "circle", source: "tickets-point-3d", paint: { "circle-color": ["coalesce", ["get", "fill"], "#16a34a"], "circle-radius": 7, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
  map3dAddSource("notes-3d", map3dLocatorNoteCollection());
  map3dAddLayer({ id: "notes-3d-dot", type: "circle", source: "notes-3d", paint: { "circle-color": ["coalesce", ["get", "color"], "#2563eb"], "circle-radius": 6, "circle-opacity": 0.55, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 } });
  if (elements.vetroToggle?.checked && vetroGeojson) map3dApplyStyledSource("vetro", map3dStyledCollection("vetro"));
  else map3dApplyStyledSource("vetro", { type: "FeatureCollection", features: [] });
  if (elements.vitruviToggle?.checked && vitruviGeojson && isSiteOwner()) map3dApplyStyledSource("vitruvi", map3dStyledCollection("vitruvi"));
  else map3dApplyStyledSource("vitruvi", { type: "FeatureCollection", features: [] });
  if (map3dUserLocation) updateMap3dUserLocation(map3dUserLocation, { center: false });
}

function prepareMap3dTerrainAndLayers() {
  if (!map3dEnabled || !map3d || !map3dStyleLayers()) return;
  configureMap3dBasemap();
  try {
    if (!map3d.getSource("mapbox-dem")) {
      map3d.addSource("mapbox-dem", { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 });
    }
    map3d.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
  } catch (error) {
    console.warn("3D terrain failed", error);
  }
  addMap3dBuildingExtrusions();
  refreshMap3dLayers();
}

function scheduleMap3dRefresh() {
  if (!map3dEnabled || !map3d) return;
  let attempts = 0;
  const tick = () => {
    if (!map3dEnabled || !map3d) return;
    prepareMap3dTerrainAndLayers();
    attempts += 1;
    if (attempts < 30) window.setTimeout(tick, 1000);
  };
  tick();
  window.setTimeout(tick, 250);
  window.setTimeout(tick, 1200);
}

function updateMap3dUserLocation(position, { center = false } = {}) {
  map3dUserLocation = position;
  if (!map3dEnabled || !map3d || !map3dStyleLayers()) return;
  const coords = position.coords || {};
  const lat = Number(coords.latitude);
  const lng = Number(coords.longitude);
  const accuracy = Number(coords.accuracy || 0);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  map3dAddSource("user-3d", {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: { accuracy }, geometry: { type: "Point", coordinates: [lng, lat] } }],
  });
  map3dAddLayer({ id: "user-3d-accuracy", type: "circle", source: "user-3d", paint: { "circle-color": "#38bdf8", "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 10, 16, 34, 20, 90], "circle-opacity": 0.16, "circle-stroke-color": "#0284c7", "circle-stroke-width": 1 } });
  map3dAddLayer({ id: "user-3d-dot", type: "circle", source: "user-3d", paint: { "circle-color": "#38bdf8", "circle-radius": 9, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
  if (center) map3d.easeTo({ center: [lng, lat], zoom: Math.max(map3d.getZoom(), 17), duration: 450 });
}

async function enableMap3d() {
  if (!elements.map3d || !map) return;
  if (!mapConfig.mapboxAccessToken) {
    window.alert("Mapbox access token is not configured on this server.");
    return;
  }
  await ensureMapbox3dAssets();
  window.mapboxgl.accessToken = mapConfig.mapboxAccessToken;
  const center = map.getCenter();
  map3dEnabled = true;
  syncMap3dControls();
  window.setTimeout(() => {
    if (map3d) map3d.resize();
  }, 100);
  if (!map3d) {
    map3d = new window.mapboxgl.Map({
      container: elements.map3d,
      style: map3dStyleUrl(),
      center: [center.lng, center.lat],
      zoom: Math.max(map.getZoom(), 14),
      pitch: 68,
      bearing: 0,
      antialias: true,
    });
    map3d.on("load", scheduleMap3dRefresh);
    map3d.on("style.load", scheduleMap3dRefresh);
    map3d.on("styledata", scheduleMap3dRefresh);
    map3d.on("idle", scheduleMap3dRefresh);
    scheduleMap3dRefresh();
  } else {
    map3d.jumpTo({ center: [center.lng, center.lat], zoom: Math.max(map.getZoom(), 14) });
    map3d.resize();
    scheduleMap3dRefresh();
  }
}

function disableMap3d() {
  map3dEnabled = false;
  syncMap3dControls();
  if (map && typeof map.invalidateSize === "function") window.setTimeout(() => map.invalidateSize(), 50);
}

async function toggleMap3d() {
  if (map3dEnabled) {
    disableMap3d();
    return;
  }
  await enableMap3d();
}

function setMap3dStyle(nextStyle) {
  map3dStyle = nextStyle === "satellite" ? "satellite" : "standard";
  localStorage.setItem("dashboard3dStyle", map3dStyle);
  syncMap3dControls();
  if (map3d) {
    map3d.setStyle(map3dStyleUrl());
    scheduleMap3dRefresh();
  }
}

async function toggleMapView() {
  rememberUndoState();
  const nextStyle = isImageryMapStyle(mapStyle) ? preferredStreetMapStyle() : preferredImageryMapStyle();
  await setMapTileStyle(nextStyle);
}

async function toggleDashboardSatellite() {
  rememberUndoState();
  const nextStyle = mapStyle === "mapbox-satellite-streets" ? preferredStreetMapStyle() : "mapbox-satellite-streets";
  await setMapTileStyle(nextStyle);
}

function setBaseTileOpacity(opacity) {
  if (!baseTileLayer) return;
  if (typeof baseTileLayer.setOpacity === "function") {
    baseTileLayer.setOpacity(opacity);
    return;
  }
  if (typeof baseTileLayer.eachLayer === "function") {
    baseTileLayer.eachLayer((layer) => {
      if (typeof layer.setOpacity === "function") layer.setOpacity(opacity);
    });
  }
}

function mapDataOverlayConfigs() {
  const overlay = effectiveMapDataOverlay();
  if (overlay === "addresses") return [ARCGIS_POINT_OVERLAYS.addresses];
  if (overlay === "parcels") return [ARCGIS_POINT_OVERLAYS.parcels];
  if (overlay === "addresses-parcels") return [ARCGIS_POINT_OVERLAYS.addresses, ARCGIS_POINT_OVERLAYS.parcels];
  return [];
}

function effectiveMapDataOverlay() {
  if (isValidMapDataOverlay(mapDataOverlay) && mapDataOverlay !== "none") return mapDataOverlay;
  const bundled = MAP_TILE_STYLES[mapStyle]?.mapDataOverlay;
  return isValidMapDataOverlay(bundled) ? bundled : "none";
}

function setMapDataOverlayStatus(message) {
  if (elements.mapDataOverlayStatus) elements.mapDataOverlayStatus.textContent = message;
}

function arcgisJsonp(url, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `arcgisJsonp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const query = new URLSearchParams({ ...params, f: "json", callback: callbackName });
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("ArcGIS overlay request timed out"));
    }, 20000);
    window[callbackName] = (payload) => {
      window.clearTimeout(timeout);
      cleanup();
      if (payload?.error) reject(new Error(payload.error.message || "ArcGIS overlay request failed"));
      else resolve(payload);
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      cleanup();
      reject(new Error("ArcGIS overlay request failed"));
    };
    script.src = `${url}?${query.toString()}`;
    document.head.appendChild(script);
  });
}

function overlayPopupRows(attributes, fields) {
  return fields
    .map((field) => [field, attributes?.[field]])
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([field, value]) => `<div><strong>${escapeHtml(field)}:</strong> ${escapeHtml(value)}</div>`)
    .join("");
}

function overlayLabelText(attributes, fields = []) {
  return fields
    .map((field) => attributes?.[field])
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .map((value) => String(value).trim())
    .join(" ");
}

async function loadArcgisPointOverlay(config, requestId) {
  const bounds = map.getBounds();
  const geometry = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ].join(",");
  const payload = await arcgisJsonp(config.url, {
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    resultRecordCount: "500",
    geometry,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
  });
  if (requestId !== mapDataOverlayAbort) return 0;
  let added = 0;
  for (const feature of payload.features || []) {
    const geometry = feature.geometry || {};
    if (!Number.isFinite(geometry.y) || !Number.isFinite(geometry.x)) continue;
    const attributes = feature.attributes || {};
    const marker = L.circleMarker([geometry.y, geometry.x], {
      radius: config.radius,
      color: config.color,
      weight: 2,
      fillColor: config.color,
      fillOpacity: 0.82,
      opacity: 0.95,
    });
    const label = overlayLabelText(attributes, config.labelFields);
    if (label) {
      marker.bindTooltip(escapeHtml(label), {
        permanent: true,
        direction: "center",
        className: "address-number-label",
        opacity: 1,
        interactive: false,
      });
    }
    const rows = overlayPopupRows(attributes, config.fields);
    marker.bindPopup(`<strong>Arkansas ${escapeHtml(config.label)}</strong>${rows ? `<div class="popup-table">${rows}</div>` : ""}`);
    marker.addTo(mapDataOverlayLayer);
    added += 1;
  }
  return added;
}

let mapDataOverlayTimer = null;
function scheduleMapDataOverlayRefresh() {
  if (mapDataOverlayTimer) window.clearTimeout(mapDataOverlayTimer);
  mapDataOverlayTimer = window.setTimeout(() => {
    mapDataOverlayTimer = null;
    void refreshMapDataOverlay();
  }, 180);
}

async function refreshMapDataOverlay() {
  if (!map || !mapDataOverlayLayer) return;
  const requestId = mapDataOverlayAbort + 1;
  mapDataOverlayAbort = requestId;
  mapDataOverlayLayer.clearLayers();
  const configs = mapDataOverlayConfigs();
  if (!configs.length) {
    setMapDataOverlayStatus("");
    return;
  }
  const minZoom = Math.max(...configs.map((config) => config.minZoom || 0));
  if (minZoom && map.getZoom() < minZoom) {
    setMapDataOverlayStatus(`Zoom to ${minZoom}+ to show address labels.`);
    return;
  }
  setMapDataOverlayStatus("Loading address labels...");
  try {
    const counts = await Promise.all(configs.map((config) => loadArcgisPointOverlay(config, requestId)));
    if (requestId !== mapDataOverlayAbort) return;
    const total = counts.reduce((sum, count) => sum + count, 0);
    setMapDataOverlayStatus(total ? `Showing ${total} address labels.` : "No address labels found in this view.");
  } catch (error) {
    if (requestId !== mapDataOverlayAbort) return;
    console.error(error);
    setMapDataOverlayStatus("Address labels failed to load.");
  }
}

function colorForVetroLayer(layerId) {
  const override = vetroLayerColorOverrides[String(layerId)];
  return isHexColor(override) ? override : vetroColor;
}

function syncVetroLayerColorInputs(layerId, color) {
  const key = String(layerId);
  for (const input of elements.vetroLayerFilter.querySelectorAll("[data-layer-color]")) {
    if (input.dataset.layerColor === key) input.value = color;
  }
  for (const input of elements.vetroLayerFilter.querySelectorAll("[data-layer-color-hex]")) {
    if (input.dataset.layerColorHex !== key) continue;
    input.value = color;
    input.classList.remove("invalid");
  }
}

function setVetroLayerColorOverride(layerId, value) {
  const color = normalizeHexColor(value);
  if (!color) return false;
  vetroLayerColorOverrides[layerId] = color;
  vetroLayerColorOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerColors, vetroLayerColorOverrides, (id, item) => isHexColor(item));
  syncVetroLayerColorInputs(layerId, color);
  renderVetroLayer();
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
  return true;
}

function vitruviLayerId(feature) {
  return propValue(feature?.properties || {}, "vitruvi_layer", "vitruvi_layer_label", "category_name", "geojson_layer", "Category", "category") || "Vitruvi";
}

function vitruviLayerDefaultName(layerId) {
  const key = String(layerId);
  const metadataLayer = vitruviGeojson?.metadata?.layers?.find((item) => String(item.id) === key);
  return metadataLayer?.label || key;
}

function vitruviLayerDisplayName(layerId) {
  return vitruviLayerNameOverrides[String(layerId)]?.trim() || vitruviLayerDefaultName(layerId);
}

function vitruviLayerNote(layerId) {
  return vitruviLayerNoteOverrides[String(layerId)]?.trim() || "";
}

function vitruviLayerGeometryType(layerId) {
  return vitruviLayerGeometryById[String(layerId)] || "";
}

function vitruviLayerStyleChoices(layerId) {
  return vitruviLayerGeometryType(layerId).startsWith("Line")
    ? [["", "Auto"], ["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]]
    : [["", "Auto"], ["circle", "Circle"], ["square", "Square"], ["rectangle", "Rectangle"], ["diamond", "Diamond"], ["pin", "Pin"], ["house", "House"]];
}

function vitruviLayerStyleValid(layerId, value) {
  return vitruviLayerStyleChoices(layerId).some(([optionValue]) => optionValue === value);
}

function vitruviLayerStyleLabel(layerId) {
  return vitruviLayerGeometryType(layerId).startsWith("Line") ? "Line style" : "Shape";
}

function colorForVitruviLayer(layerId) {
  const override = vitruviLayerColorOverrides[String(layerId)];
  if (isHexColor(override)) return override;
  const palette = ["#f97316", "#22c55e", "#38bdf8", "#eab308", "#a855f7", "#ef4444", "#14b8a6", "#f43f5e"];
  let hash = 0;
  for (const char of String(layerId)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function vitruviLayerSizeDefault(layerId) {
  return vitruviLayerGeometryType(layerId).startsWith("Line") ? 3 : 11;
}

function vitruviLayerSizeRange(layerId) {
  return vitruviLayerGeometryType(layerId).startsWith("Line")
    ? { label: "Line width", min: 1, max: 10, step: 1 }
    : { label: "Size", min: 7, max: 28, step: 1 };
}

function vitruviLayerSize(layerId) {
  const range = vitruviLayerSizeRange(layerId);
  return clampNumber(vitruviLayerSizeOverrides[String(layerId)], range.min, range.max, vitruviLayerSizeDefault(layerId));
}

function vitruviLayerOpacity(layerId) {
  return clampNumber(vitruviLayerOpacityOverrides[String(layerId)], 0, 1, vitruviOpacity);
}

function vitruviLayerLabel(layerId, count = 0) {
  const geometry = vitruviLayerGeometryType(layerId);
  const geometryLabel = geometry ? ` · ${geometry.startsWith("Line") ? "Line" : "Point"}` : "";
  const countLabel = count ? ` (${Number(count).toLocaleString()})` : "";
  return `${vitruviLayerDisplayName(layerId)}${geometryLabel}${countLabel}`;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function opacityToPercent(value) {
  return Math.round(clampNumber(value, 0, 1, 1) * 100);
}

function percentToOpacity(value, fallback = 1) {
  return clampNumber(Number(value) / 100, 0, 1, fallback);
}

function hexToRgba(color, opacity) {
  const alpha = clampNumber(opacity, 0, 1, 1);
  const hex = String(color || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  return color;
}

function selectedValues(select) {
  if (!select) return [];
  return [...select.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.value);
}

function setAllChecked(container, checked) {
  if (!container) return;
  for (const input of container.querySelectorAll("input[type='checkbox']")) {
    input.checked = checked;
  }
}

function syncVetroLayerSelection() {
  vetroSelectedLayers = new Set(selectedValues(elements.vetroLayerFilter));
  writeJsonStorage(STORAGE_KEYS.vetroLayers, [...vetroSelectedLayers]);
}

function syncVetroFacetSelection() {
  vetroSelectedPlans = new Set(selectedValues(elements.vetroPlanFilter));
  vetroSearch = elements.vetroSearch.value.trim();
  writeJsonStorage(STORAGE_KEYS.vetroPlan, [...vetroSelectedPlans]);
  localStorage.setItem(STORAGE_KEYS.vetroSearch, vetroSearch);
}

function renderCheckboxList(container, values, selected, labelFor = (value) => value, colorFor = null, titleFor = null, extraFor = null) {
  const selectedValues = Array.isArray(selected) ? selected : [];
  container.innerHTML = values
    .map(
      (value) => `
        <label class="check-item"${titleFor ? ` title="${escapeHtml(titleFor(value))}"` : ""}>
          <input type="checkbox" value="${escapeHtml(value)}" ${selectedValues.includes(String(value)) ? "checked" : ""}>
          <span>${escapeHtml(labelFor(value))}</span>
          ${colorFor ? `<input class="layer-color" type="color" data-layer-color="${escapeHtml(value)}" value="${escapeHtml(colorFor(value))}">` : ""}
          ${extraFor ? extraFor(value) : ""}
        </label>
      `,
    )
    .join("");
}

function renderVetroLayerList(container, values, selected, counts = {}) {
  const selectedValues = Array.isArray(selected) ? selected : [];
  container.innerHTML = values
    .map((layerId) => {
      const checked = selectedValues.includes(String(layerId)) ? "checked" : "";
      const count = counts[layerId] || 0;
      const sizeRange = vetroLayerSizeRange(layerId);
      return `
        <div class="vetro-layer-item${checked ? " active" : ""}" title="${escapeHtml(vetroLayerTitle(layerId))}">
          <div class="vetro-layer-head">
            <label class="vetro-layer-check">
              <input type="checkbox" value="${escapeHtml(layerId)}" ${checked}>
              <span>${escapeHtml(vetroLayerLabel(layerId, count))}</span>
            </label>
            <div class="vetro-layer-appearance">
              <label class="layer-swatch">
                <span>Color</span>
                <span class="layer-color-control">
                  <input class="layer-color" type="color" data-layer-color="${escapeHtml(layerId)}" value="${escapeHtml(colorForVetroLayer(layerId))}">
                  <input class="layer-color-hex" type="text" data-layer-color-hex="${escapeHtml(layerId)}" value="${escapeHtml(colorForVetroLayer(layerId))}" placeholder="#00a5ff" maxlength="7" spellcheck="false">
                </span>
              </label>
              <label class="layer-swatch">
                <span>Opacity %</span>
                <input class="layer-opacity" type="number" min="0" max="100" step="1" data-layer-opacity="${escapeHtml(layerId)}" value="${escapeHtml(opacityToPercent(vetroLayerOpacity(layerId)))}">
              </label>
            </div>
          </div>
          <div class="vetro-layer-tools">
            ${vetroLayerStyleHtml(layerId)}
            <div class="layer-setting layer-setting-range">
              <span>${escapeHtml(sizeRange.label)}</span>
              <input class="layer-size" type="number" min="${sizeRange.min}" max="${sizeRange.max}" step="${sizeRange.step}" data-layer-size="${escapeHtml(layerId)}" value="${escapeHtml(vetroLayerSize(layerId))}">
            </div>
            ${vetroLayerMetaHtml(layerId)}
          </div>
          <div class="vetro-layer-note">${escapeHtml(vetroLayerTitle(layerId))}</div>
        </div>
      `;
    })
    .join("");
}

function appVetroAvailableLayerIds() {
  if (!vetroGeojson?.features) return [];
  return uniqueSorted(vetroGeojson.features.map(vetroLayerControlId));
}

function setAppVetroStyleLayer(layerId, { openDrawer = false } = {}) {
  const available = appVetroAvailableLayerIds();
  if (!available.length) return;
  const next = available.includes(String(layerId)) ? String(layerId) : (available.includes(appVetroStyleLayerId) ? appVetroStyleLayerId : available[0]);
  appVetroStyleLayerId = next;
  localStorage.setItem("appVetroStyleLayerId", appVetroStyleLayerId);
  if (elements.appVetroLayerSelect) elements.appVetroLayerSelect.value = appVetroStyleLayerId;
  if (openDrawer && elements.vetroDrawer) elements.vetroDrawer.open = true;
  renderAppVetroStyleEditor();
}

function syncAppVetroLayerInputs(layerId = appVetroStyleLayerId) {
  if (!elements.vetroLayerFilter || !layerId) return;
  const layerKey = String(layerId);
  for (const input of elements.vetroLayerFilter.querySelectorAll("[data-layer-size]")) {
    if (input.dataset.layerSize === layerKey) input.value = String(vetroLayerSize(layerKey));
  }
  for (const input of elements.vetroLayerFilter.querySelectorAll("[data-layer-opacity]")) {
    if (input.dataset.layerOpacity === layerKey) input.value = String(opacityToPercent(vetroLayerOpacity(layerKey)));
  }
  for (const select of elements.vetroLayerFilter.querySelectorAll("[data-layer-style]")) {
    if (select.dataset.layerStyle === layerKey) select.value = vetroLayerStyleOverrides[layerKey] || "";
  }
}

function renderAppVetroStyleEditor(layerIds = appVetroAvailableLayerIds(), counts = {}) {
  if (!elements.appVetroStyleEditor) return;
  elements.appVetroStyleEditor.hidden = !canEditVetroAppearance();
  if (elements.appVetroStyleEditor.hidden) return;
  if (!layerIds.length) {
    if (elements.appVetroLayerSelect) elements.appVetroLayerSelect.innerHTML = "";
    if (elements.appVetroStyleSummary) elements.appVetroStyleSummary.textContent = "Load VETRO to tune app layer sizes.";
    for (const control of [elements.appVetroLayerSelect, elements.appVetroLayerSize, elements.appVetroLayerOpacity, elements.appVetroLayerColor, elements.appVetroLayerStyle, elements.appVetroSaveView]) {
      if (control) control.disabled = true;
    }
    return;
  }
  for (const control of [elements.appVetroLayerSelect, elements.appVetroLayerSize, elements.appVetroLayerOpacity, elements.appVetroLayerColor, elements.appVetroLayerStyle, elements.appVetroSaveView]) {
    if (control) control.disabled = false;
  }
  if (!layerIds.includes(appVetroStyleLayerId)) {
    const selected = layerIds.find((layerId) => vetroSelectedLayers.has(layerId));
    appVetroStyleLayerId = selected || layerIds[0];
    localStorage.setItem("appVetroStyleLayerId", appVetroStyleLayerId);
  }
  if (elements.appVetroLayerSelect) {
    elements.appVetroLayerSelect.innerHTML = layerIds
      .map((layerId) => `<option value="${escapeHtml(layerId)}">${escapeHtml(vetroLayerLabel(layerId, counts[layerId] || 0))}</option>`)
      .join("");
    elements.appVetroLayerSelect.value = appVetroStyleLayerId;
  }
  const range = vetroLayerSizeRange(appVetroStyleLayerId);
  if (elements.appVetroSizeLabel) elements.appVetroSizeLabel.textContent = range.label;
  if (elements.appVetroLayerSize) {
    elements.appVetroLayerSize.min = String(range.min);
    elements.appVetroLayerSize.max = String(range.max);
    elements.appVetroLayerSize.step = String(range.step);
    elements.appVetroLayerSize.value = String(vetroLayerSize(appVetroStyleLayerId));
  }
  if (elements.appVetroSizeValue) {
    elements.appVetroSizeValue.min = String(range.min);
    elements.appVetroSizeValue.max = String(range.max);
    elements.appVetroSizeValue.step = String(range.step);
    elements.appVetroSizeValue.value = String(vetroLayerSize(appVetroStyleLayerId));
  }
  if (elements.appVetroLayerOpacity) elements.appVetroLayerOpacity.value = String(opacityToPercent(vetroLayerOpacity(appVetroStyleLayerId)));
  if (elements.appVetroOpacityValue) elements.appVetroOpacityValue.value = String(opacityToPercent(vetroLayerOpacity(appVetroStyleLayerId)));
  if (elements.appVetroLayerColor) elements.appVetroLayerColor.value = colorForVetroLayer(appVetroStyleLayerId);
  if (elements.appVetroLayerStyle) {
    const current = vetroLayerStyleOverrides[String(appVetroStyleLayerId)] || "";
    elements.appVetroLayerStyle.innerHTML = vetroLayerStyleChoices(appVetroStyleLayerId)
      .map(([value, text]) => `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(text)}</option>`)
      .join("");
    elements.appVetroLayerStyle.value = current;
  }
  if (elements.appVetroStyleSummary) {
    elements.appVetroStyleSummary.textContent = `${vetroLayerDisplayName(appVetroStyleLayerId)} · ${range.label.toLowerCase()} ${vetroLayerSize(appVetroStyleLayerId)} · ${opacityToPercent(vetroLayerOpacity(appVetroStyleLayerId))}%`;
  }
}

function updateAppVetroLayerSize(value) {
  if (!appVetroStyleLayerId) return;
  rememberUndoState();
  const range = vetroLayerSizeRange(appVetroStyleLayerId);
  vetroLayerSizeOverrides[appVetroStyleLayerId] = clampNumber(value, range.min, range.max, vetroLayerSizeDefault(appVetroStyleLayerId));
  vetroLayerSizeOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerSizes, vetroLayerSizeOverrides, (layerId, item) => Number.isFinite(Number(item)));
  renderVetroLayer();
  syncAppVetroLayerInputs();
  renderAppVetroStyleEditor();
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
}

function updateAppVetroLayerOpacity(value) {
  if (!appVetroStyleLayerId) return;
  rememberUndoState();
  vetroLayerOpacityOverrides[appVetroStyleLayerId] = percentToOpacity(value, vetroOpacity);
  vetroLayerOpacityOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerOpacities, vetroLayerOpacityOverrides, (layerId, item) => Number.isFinite(Number(item)));
  renderVetroLayer();
  syncAppVetroLayerInputs();
  renderAppVetroStyleEditor();
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
}

function updateAppVetroLayerStyle(value) {
  if (!appVetroStyleLayerId) return;
  rememberUndoState();
  vetroLayerStyleOverrides[appVetroStyleLayerId] = value;
  vetroLayerStyleOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerStyles, vetroLayerStyleOverrides, (layerId, item) => vetroLayerStyleValid(layerId, item));
  renderVetroLayer();
  syncAppVetroLayerInputs();
  renderAppVetroStyleEditor();
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
}

function applyAppVetroPreset(name) {
  if (!appVetroStyleLayerId) return;
  rememberUndoState();
  const range = vetroLayerSizeRange(appVetroStyleLayerId);
  const line = vetroLayerStyleChoice(appVetroStyleLayerId) === "line";
  if (name === "reset") {
    delete vetroLayerSizeOverrides[appVetroStyleLayerId];
    delete vetroLayerOpacityOverrides[appVetroStyleLayerId];
    delete vetroLayerStyleOverrides[appVetroStyleLayerId];
  } else {
    const preset = {
      field: { size: line ? 4 : 15, opacity: 0.78, style: line ? "solid" : "circle" },
      satellite: { size: line ? 5 : 17, opacity: 0.9, style: line ? "solid" : "pin" },
      thin: { size: line ? 2 : 10, opacity: 0.55, style: line ? "solid" : "circle" },
      bold: { size: line ? 7 : 22, opacity: 0.95, style: line ? "solid" : "pin" },
    }[name];
    if (!preset) return;
    vetroLayerSizeOverrides[appVetroStyleLayerId] = clampNumber(preset.size, range.min, range.max, vetroLayerSizeDefault(appVetroStyleLayerId));
    vetroLayerOpacityOverrides[appVetroStyleLayerId] = clampNumber(preset.opacity, 0, 1, vetroOpacity);
    if (vetroLayerStyleValid(appVetroStyleLayerId, preset.style)) vetroLayerStyleOverrides[appVetroStyleLayerId] = preset.style;
  }
  vetroLayerSizeOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerSizes, vetroLayerSizeOverrides, (layerId, item) => Number.isFinite(Number(item)));
  vetroLayerOpacityOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerOpacities, vetroLayerOpacityOverrides, (layerId, item) => Number.isFinite(Number(item)));
  vetroLayerStyleOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerStyles, vetroLayerStyleOverrides, (layerId, item) => vetroLayerStyleValid(layerId, item));
  renderVetroLayer();
  syncAppVetroLayerInputs();
  renderAppVetroStyleEditor();
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
}

async function saveAppVetroStyleView() {
  if (!canWriteEmployeeDashboard()) {
    showSavedToast("Shared dashboard access denied");
    return;
  }
  if (elements.appVetroSaveView) elements.appVetroSaveView.disabled = true;
  showSavedToast("Saving app VETRO style...");
  try {
    await saveAppViewPreset(dashboardStatePayload({ employeeViewMode: "mobile" }));
    showSavedToast("App VETRO style saved");
    if (elements.appVetroStyleSummary) elements.appVetroStyleSummary.textContent = "Saved to app view. Refresh tickets in the native app.";
  } catch (error) {
    showSavedToast("App VETRO style save failed");
    console.error(error);
  } finally {
    if (elements.appVetroSaveView) elements.appVetroSaveView.disabled = false;
  }
}

function vitruviLayerTitle(layerId, count = 0) {
  const geometry = vitruviLayerGeometryType(layerId);
  const note = vitruviLayerNote(layerId);
  const control = geometry.startsWith("Line") ? "line style" : "shape";
  return `${vitruviLayerLabel(layerId, count)}. Owner-only Vitruvi layer. ${control}: ${vitruviLayerStyleOverrides[String(layerId)] || "Auto"}. Color ${colorForVitruviLayer(layerId)}. Size ${vitruviLayerSize(layerId)}. Opacity ${Math.round(vitruviLayerOpacity(layerId) * 100)}%.${note ? ` Note: ${note}` : ""}`;
}

function vitruviLayerStyleHtml(layerId) {
  const current = vitruviLayerStyleOverrides[String(layerId)] || "";
  const label = vitruviLayerStyleLabel(layerId);
  return `
    <div class="layer-setting">
      <span>${escapeHtml(label)}</span>
      <select class="vitruvi-layer-style" data-vitruvi-layer-style="${escapeHtml(layerId)}" aria-label="${escapeHtml(label)}">
        ${vitruviLayerStyleChoices(layerId).map(([value, text]) => `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(text)}</option>`).join("")}
      </select>
    </div>
  `;
}

function vitruviLayerMetaHtml(layerId) {
  const name = vitruviLayerNameOverrides[String(layerId)] || "";
  const note = vitruviLayerNoteOverrides[String(layerId)] || "";
  return `
    <div class="layer-metadata">
      <div class="layer-setting">
        <span>Name</span>
        <input class="vitruvi-layer-alias" type="text" data-vitruvi-layer-alias="${escapeHtml(layerId)}" value="${escapeHtml(name)}" placeholder="${escapeHtml(vitruviLayerDefaultName(layerId))}" maxlength="80">
      </div>
      <div class="layer-setting layer-setting-wide">
        <span>Note</span>
        <input class="vitruvi-layer-note-input" type="text" data-vitruvi-layer-note="${escapeHtml(layerId)}" value="${escapeHtml(note)}" placeholder="Optional owner note" maxlength="160">
      </div>
    </div>
  `;
}

function renderVitruviLayerList(container, values, selected, counts = {}) {
  if (!container) return;
  const selectedValues = Array.isArray(selected) ? selected : [];
  container.innerHTML = values
    .map((layerId) => {
      const checked = selectedValues.includes(String(layerId)) ? "checked" : "";
      const count = counts[layerId] || 0;
      const sizeRange = vitruviLayerSizeRange(layerId);
      return `
        <div class="vetro-layer-item${checked ? " active" : ""}" title="${escapeHtml(vitruviLayerTitle(layerId, count))}">
          <div class="vetro-layer-head">
            <label class="vetro-layer-check">
              <input type="checkbox" value="${escapeHtml(layerId)}" ${checked}>
              <span>${escapeHtml(vitruviLayerLabel(layerId, count))}</span>
            </label>
            <div class="vetro-layer-appearance">
              <label class="layer-swatch">
                <span>Color</span>
                <span class="layer-color-control">
                  <input class="vitruvi-layer-color" type="color" data-vitruvi-layer-color="${escapeHtml(layerId)}" value="${escapeHtml(colorForVitruviLayer(layerId))}">
                  <input class="vitruvi-layer-color-hex layer-color-hex" type="text" data-vitruvi-layer-color-hex="${escapeHtml(layerId)}" value="${escapeHtml(colorForVitruviLayer(layerId))}" placeholder="#f97316" maxlength="7" spellcheck="false">
                </span>
              </label>
              <label class="layer-swatch">
                <span>Opacity %</span>
                <input class="vitruvi-layer-opacity" type="number" min="0" max="100" step="1" data-vitruvi-layer-opacity="${escapeHtml(layerId)}" value="${escapeHtml(opacityToPercent(vitruviLayerOpacity(layerId)))}">
              </label>
            </div>
          </div>
          <div class="vetro-layer-tools">
            ${vitruviLayerStyleHtml(layerId)}
            <div class="layer-setting layer-setting-range">
              <span>${escapeHtml(sizeRange.label)}</span>
              <input class="vitruvi-layer-size" type="number" min="${sizeRange.min}" max="${sizeRange.max}" step="${sizeRange.step}" data-vitruvi-layer-size="${escapeHtml(layerId)}" value="${escapeHtml(vitruviLayerSize(layerId))}">
            </div>
            ${vitruviLayerMetaHtml(layerId)}
          </div>
          <div class="vetro-layer-note">${escapeHtml(vitruviLayerTitle(layerId, count))}</div>
        </div>
      `;
    })
    .join("");
}

function fillSelect(select, values, selected, labelFor = (value) => value) {
  select.innerHTML = '<option value="">All</option>';
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labelFor(value);
    select.appendChild(option);
  }
  select.value = values.includes(selected) ? selected : "";
}

function normalizeSelectedSet(selectedSet, values, storageKey) {
  const available = new Set(values);
  const normalized = new Set([...selectedSet].filter((value) => available.has(value)));
  writeJsonStorage(storageKey, [...normalized]);
  return normalized;
}

function normalizeObjectStorage(storageKey, value, validator = null) {
  const normalized = {};
  for (const [key, item] of Object.entries(value || {})) {
    if (validator && !validator(key, item)) continue;
    normalized[key] = item;
  }
  localStorage.setItem(storageKey, JSON.stringify(normalized));
  return normalized;
}

function vetroLayerStyleChoices(layerId) {
  return vetroLayerGeometryType(layerId).startsWith("Line")
    ? [
        ["", "Auto"],
        ["solid", "Solid"],
        ["dashed", "Dashed"],
        ["dotted", "Dotted"],
      ]
    : [
        ["", "Auto"],
        ["circle", "Circle"],
        ["square", "Square"],
        ["rectangle", "Rectangle"],
        ["diamond", "Diamond"],
        ["pin", "Pin"],
        ["house", "House"],
      ];
}

function vetroLayerStyleLabel(layerId) {
  return vetroLayerGeometryType(layerId).startsWith("Line") ? "Line style" : "Shape";
}

function vetroLayerStyleValid(layerId, value) {
  return vetroLayerStyleChoices(layerId).some(([optionValue]) => optionValue === value);
}

function vetroLayerStyleHtml(layerId) {
  const current = vetroLayerStyleOverrides[String(layerId)] || "";
  const label = vetroLayerStyleLabel(layerId);
  return `
    <div class="layer-setting">
      <span>${escapeHtml(label)}</span>
      <select class="layer-style" data-layer-style="${escapeHtml(layerId)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
        ${vetroLayerStyleChoices(layerId)
          .map(
            ([value, text]) => `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(text)}</option>`,
          )
          .join("")}
      </select>
    </div>
  `;
}

function vetroLayerMetaHtml(layerId) {
  const name = vetroLayerNameOverrides[String(layerId)] || "";
  const note = vetroLayerNoteOverrides[String(layerId)] || "";
  return `
    <div class="layer-metadata">
      <div class="layer-setting">
        <span>Name</span>
        <input class="layer-alias" type="text" data-layer-alias="${escapeHtml(layerId)}" value="${escapeHtml(name)}" placeholder="${escapeHtml(vetroLayerDefaultName(layerId))}" maxlength="80">
      </div>
      <div class="layer-setting layer-setting-wide">
        <span>Note</span>
        <input class="layer-note" type="text" data-layer-note="${escapeHtml(layerId)}" value="${escapeHtml(note)}" placeholder="Optional note for this layer" maxlength="160">
      </div>
    </div>
  `;
}

function setFilterChecked(container, checked, sync = syncVetroFacetSelection) {
  rememberUndoState();
  setAllChecked(container, checked);
  sync();
  renderVetroLayer();
  scheduleEmployeeDashboardSync();
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function vetroStyle(feature) {
  const layerId = vetroLayerControlId(feature);
  const color = colorForVetroLayer(layerId);
  const outlineColor = color;
  const geometry = feature?.geometry?.type || "";
  const size = vetroLayerSize(layerId);
  const opacity = vetroLayerOpacity(layerId);
  const style = {
    color: outlineColor,
    fillColor: color,
    fillOpacity: opacity * 0.32,
    opacity,
    weight: geometry.startsWith("Line") ? size : 1,
    radius: size,
  };
  if (geometry.startsWith("Line")) {
    const override = vetroLayerStyleOverrides[String(layerId)] || "solid";
    style.fillOpacity = 0;
    if (override === "dashed") style.dashArray = "8 6";
    if (override === "dotted") style.dashArray = "2 6";
  }
  return style;
}

function bindVetroPopup(feature, layer) {
  const props = feature.properties || {};
  const layerId = vetroLayerControlId(feature);
  const sourceLayerId = propValue(props, "layer_id", "Layer_ID");
  const title = propValue(props, "feature_id", "ID", "Name", "name") || `Layer ${sourceLayerId}`.trim() || "Vetro feature";
  const rows = [
    ["Customer / Address", propValue(props, "Street_Address", "street_address", "Address")],
    ["VETRO feature ID", propValue(props, "ID", "feature_id")],
    ["Zone", propValue(props, "Zone_Name")],
    ["Zone Status", propValue(props, "Zone_Status")],
    ["Building Type", propValue(props, "Building_Type", "Building Type")],
    ["Drop Type", propValue(props, "Drop_Type", "Drop Type")],
    ["Layer", layerId ? vetroLayerLabel(layerId) : ""],
    ["Source layer", sourceLayerId],
    ["Layer name", layerId ? vetroLayerDisplayName(layerId) : ""],
    ["Layer note", layerId ? vetroLayerNote(layerId) : ""],
    ["Layer control", layerId ? vetroLayerStyleLabel(layerId) : ""],
    ["Layer setting", layerId ? (vetroLayerStyleOverrides[String(layerId)] || "Auto") : ""],
    ["Layer color", layerId ? colorForVetroLayer(layerId) : ""],
    ["Layer size", layerId ? String(vetroLayerSize(layerId)) : ""],
    ["Layer opacity", layerId ? `${Math.round(vetroLayerOpacity(layerId) * 100)}%` : ""],
    ["Vector", propValue(props, "vector_layer", "Vector_layer")],
    ["Plan", propValue(props, "plan")],
    ["Plan ID", propValue(props, "plan_id")],
    ["Status", propValue(props, "status_id") ? vetroStatusLabel(propValue(props, "status_id")) : ""],
    ["Build", propValue(props, "build", "Build")],
    ["Placement", propValue(props, "placement", "Placement")],
    ["Fiber Capacity", propValue(props, "Fiber_Capacity", "Fiber Capacity")],
    ["Handhole Size", propValue(props, "HH_Size", "Size")],
    ["Bore / Plow", propValue(props, "Bore_Plow", "Bore Plow")],
    ["Linear Footage", propValue(props, "Linear_Footage")],
    ["Micro Duct Count", propValue(props, "Micro_Duct_Count")],
    ["Street Address", propValue(props, "street_address", "Street_Address", "Street Address")],
    ["Note", propValue(props, "Note", "note")],
    ["Vetro ID", propValue(props, "vetro_id")],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`)
    .join("");
  if (layerId) {
    layer.on("click", (event) => {
      if (locatorNoteMode) {
        if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
        beginLocatorNoteForVetro(feature, event.latlng || null);
        return;
      }
      setAppVetroStyleLayer(layerId, { openDrawer: true });
    });
  }
  layer.bindPopup(`<strong>${escapeHtml(title)}</strong>${rows ? `<div class="popup-rows">${rows}</div>` : ""}`);
}

function syncVitruviLayerSelection() {
  vitruviSelectedLayers = new Set(selectedValues(elements.vitruviLayerFilter));
  writeJsonStorage(STORAGE_KEYS.vitruviLayers, [...vitruviSelectedLayers]);
}

function syncVitruviLayerColorInputs(layerId, color) {
  const key = String(layerId);
  if (!elements.vitruviLayerFilter) return;
  for (const input of elements.vitruviLayerFilter.querySelectorAll("[data-vitruvi-layer-color]")) {
    if (input.dataset.vitruviLayerColor === key) input.value = color;
  }
  for (const input of elements.vitruviLayerFilter.querySelectorAll("[data-vitruvi-layer-color-hex]")) {
    if (input.dataset.vitruviLayerColorHex !== key) continue;
    input.value = color;
    input.classList.remove("invalid");
  }
}

function setVitruviLayerColorOverride(layerId, value) {
  const color = normalizeHexColor(value);
  if (!color) return false;
  vitruviLayerColorOverrides[layerId] = color;
  vitruviLayerColorOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerColors, vitruviLayerColorOverrides, (id, item) => isHexColor(item));
  syncVitruviLayerColorInputs(layerId, color);
  renderVitruviLayer();
  scheduleDashboardStateSave();
  return true;
}

function vitruviPointToLayer(feature, latlng) {
  const layerId = vitruviLayerId(feature);
  const shape = vitruviLayerStyleOverrides[String(layerId)] || "circle";
  return L.marker(latlng, {
    icon: vetroMarkerIcon(shape, colorForVitruviLayer(layerId), vitruviLayerSize(layerId), vitruviLayerOpacity(layerId), ""),
  });
}

function vitruviStyle(feature) {
  const layerId = vitruviLayerId(feature);
  const color = colorForVitruviLayer(layerId);
  const opacity = vitruviLayerOpacity(layerId);
  const geometry = feature?.geometry?.type || "";
  const size = vitruviLayerSize(layerId);
  const style = {
    color,
    fillColor: color,
    fillOpacity: opacity * 0.32,
    opacity,
    weight: geometry.startsWith("Line") ? size : 1,
    radius: size,
  };
  if (geometry.startsWith("Line")) {
    const override = vitruviLayerStyleOverrides[String(layerId)] || "solid";
    style.fillOpacity = 0;
    if (override === "dashed") style.dashArray = "8 6";
    if (override === "dotted") style.dashArray = "2 6";
  }
  return style;
}

function bindVitruviPopup(feature, layer) {
  const props = feature.properties || {};
  const layerId = vitruviLayerId(feature);
  const title = propValue(props, "label", "feature_id", "vitruvi_id", "name", "Name") || vitruviLayerDisplayName(layerId);
  const rows = [
    ["Layer", vitruviLayerLabel(layerId)],
    ["Layer name", vitruviLayerDisplayName(layerId)],
    ["Layer note", vitruviLayerNote(layerId)],
    ["Category", propValue(props, "category_name", "vitruvi_layer_label", "category")],
    ["Status", propValue(props, "vitruvi_status", "status", "Status")],
    ["Region", propValue(props, "region_name", "Region")],
    ["Address", propValue(props, "full_address", "Address")],
    ["Vitruvi ID", propValue(props, "vitruvi_id", "ID", "id")],
    ["UID", propValue(props, "uid", "vetro_id")],
    ["Length", propValue(props, "planned_length", "total_length", "shape__len")],
    ["Color", colorForVitruviLayer(layerId)],
    ["Opacity", `${Math.round(vitruviLayerOpacity(layerId) * 100)}%`],
  ].filter(([, value]) => value)
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`)
    .join("");
  layer.on("click", (event) => {
    if (!locatorNoteMode) return;
    if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
    beginLocatorNoteForVitruvi(feature, event.latlng || null);
  });
  layer.bindPopup(`<strong>${escapeHtml(title)}</strong>${rows ? `<div class="popup-rows">${rows}</div>` : ""}`);
}

function filteredVitruviGeojson() {
  if (!vitruviGeojson || !isSiteOwner()) return null;
  const layerIds = [...vitruviSelectedLayers];
  const search = vitruviSearch.toLowerCase();
  const sourceFeatures = Array.isArray(vitruviGeojson.features) ? vitruviGeojson.features : [];
  return {
    type: "FeatureCollection",
    features: sourceFeatures.filter((feature) => {
      const layerId = vitruviLayerId(feature);
      if (!layerIds.includes(layerId)) return false;
      if (search && !featureSearchText(feature).includes(search)) return false;
      return true;
    }),
  };
}

function renderVitruviLayer() {
  if (vitruviLayer) {
    map.removeLayer(vitruviLayer);
    vitruviLayer = null;
  }
  if (!elements.vitruviStatus) return;
  if (!isSiteOwner()) {
    elements.vitruviStatus.textContent = "Owner only";
    return;
  }
  if (!elements.vitruviToggle?.checked || !vitruviGeojson) {
    elements.vitruviStatus.textContent = vitruviGeojson ? "Off" : "Owner only";
    refreshMap3dLayers();
    scheduleDashboardStateSave();
    return;
  }
  const filtered = filteredVitruviGeojson();
  const features = Array.isArray(filtered?.features) ? filtered.features : [];
  vitruviLayer = L.geoJSON(filtered, {
    style: vitruviStyle,
    pointToLayer: vitruviPointToLayer,
    onEachFeature: bindVitruviPopup,
  }).addTo(map);
  const total = Array.isArray(vitruviGeojson?.features) ? vitruviGeojson.features.length : 0;
  elements.vitruviStatus.textContent = `${features.length.toLocaleString()} / ${total.toLocaleString()}`;
  refreshMap3dLayers();
  scheduleDashboardStateSave();
}

function populateVitruviFilters() {
  if (!elements.vitruviLayerFilter || !vitruviGeojson) return;
  const features = vitruviGeojson.features || [];
  const layerIds = uniqueSorted(features.map(vitruviLayerId));
  const availableLayers = new Set(layerIds);
  const geometryByLayer = {};
  for (const feature of features) {
    const layerId = vitruviLayerId(feature);
    const geometry = feature.geometry?.type || "";
    if (!geometryByLayer[layerId]) geometryByLayer[layerId] = new Set();
    if (geometry) geometryByLayer[layerId].add(geometry);
  }
  vitruviLayerGeometryById = Object.fromEntries(Object.entries(geometryByLayer).map(([layerId, geometries]) => [layerId, [...geometries][0] || ""]));
  vitruviLayerStyleOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerStyles, vitruviLayerStyleOverrides, (layerId, value) => availableLayers.has(layerId) && vitruviLayerStyleValid(layerId, value));
  vitruviLayerColorOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerColors, vitruviLayerColorOverrides, (layerId, value) => availableLayers.has(layerId) && isHexColor(value));
  vitruviLayerNameOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerNames, vitruviLayerNameOverrides, (layerId, value) => availableLayers.has(layerId) && typeof value === "string");
  vitruviLayerNoteOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerNotes, vitruviLayerNoteOverrides, (layerId, value) => availableLayers.has(layerId) && typeof value === "string");
  vitruviLayerSizeOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerSizes, vitruviLayerSizeOverrides, (layerId, value) => availableLayers.has(layerId) && Number.isFinite(Number(value)));
  vitruviLayerOpacityOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerOpacities, vitruviLayerOpacityOverrides, (layerId, value) => availableLayers.has(layerId) && Number.isFinite(Number(value)));
  vitruviSelectedLayers = new Set([...vitruviSelectedLayers].filter((layerId) => availableLayers.has(layerId)));
  if (!vitruviSelectedLayers.size) vitruviSelectedLayers = new Set(layerIds);
  writeJsonStorage(STORAGE_KEYS.vitruviLayers, [...vitruviSelectedLayers]);
  const layerCounts = valueCountMap(features, vitruviLayerId);
  renderVitruviLayerList(elements.vitruviLayerFilter, layerIds, [...vitruviSelectedLayers], layerCounts);
}

async function ensureVitruviLoaded() {
  if (!isSiteOwner()) return;
  if (vitruviGeojson) return;
  elements.vitruviStatus.textContent = "Loading...";
  const response = await fetch("/api/vitruvi");
  if (!response.ok) throw new Error(`Vitruvi layer failed: ${response.status}`);
  vitruviGeojson = await response.json();
  if (!Array.isArray(vitruviGeojson?.features)) {
    vitruviGeojson = { type: "FeatureCollection", features: [] };
  }
  vitruviLoaded = true;
  populateVitruviFilters();
  elements.vitruviStatus.textContent = `Ready ${vitruviGeojson.features.length.toLocaleString()}`;
}

async function setVitruviVisible(visible) {
  if (!isSiteOwner()) return;
  if (!visible) {
    renderVitruviLayer();
    scheduleDashboardStateSave();
    return;
  }
  await ensureVitruviLoaded();
  renderVitruviLayer();
  scheduleDashboardStateSave();
}

function filteredVetroGeojson() {
  if (!vetroGeojson) return null;
  const layerIds = [...vetroSelectedLayers];
  const search = vetroSearch.toLowerCase();
  const sourceFeatures = Array.isArray(vetroGeojson.features) ? vetroGeojson.features : [];
  return {
    type: "FeatureCollection",
    features: sourceFeatures.filter((feature) => {
      const props = feature.properties || {};
      const layerControlId = vetroLayerControlId(feature);
      if (!layerIds.includes(layerControlId)) return false;
      if (vetroSelectedPlans.size && !vetroSelectedPlans.has(propValue(props, "plan"))) return false;
      if (search && !featureSearchText(feature).includes(search)) return false;
      return true;
    }),
  };
}

function renderVetroLayer() {
  if (vetroLayer) {
    map.removeLayer(vetroLayer);
    vetroLayer = null;
  }
  if (!elements.vetroToggle.checked || !vetroGeojson) {
    renderInHouseVetroLayer();
    refreshMap3dLayers();
    scheduleDashboardStateSave();
    return;
  }
  const filtered = filteredVetroGeojson();
  const features = Array.isArray(filtered?.features) ? filtered.features : [];
  if (!filtered || !features.length && !Array.isArray(vetroGeojson?.features)) {
    elements.vetroStatus.textContent = "0 / 0";
    scheduleDashboardStateSave();
    return;
  }
  vetroLayer = L.geoJSON(filtered, {
    style: vetroStyle,
    pointToLayer: vetroPointToLayer,
    onEachFeature: bindVetroPopup,
  }).addTo(map);
  const shown = features.length;
  const total = Array.isArray(vetroGeojson?.features) ? vetroGeojson.features.length : 0;
  elements.vetroStatus.textContent = `${shown.toLocaleString()} / ${total.toLocaleString()}`;
  renderInHouseVetroLayer();
  refreshMap3dLayers();
  scheduleDashboardStateSave();
}

function populateVetroFilters() {
  const features = vetroGeojson?.features || [];
  const layerIds = uniqueSorted(features.map(vetroLayerControlId));
  const availableLayers = new Set(layerIds);
  const geometryByLayer = {};
  for (const feature of features) {
    const layerId = vetroLayerControlId(feature);
    const geometry = feature.geometry?.type || "";
    if (!geometryByLayer[layerId]) geometryByLayer[layerId] = new Set();
    if (geometry) geometryByLayer[layerId].add(geometry);
  }
  vetroLayerGeometryById = Object.fromEntries(Object.entries(geometryByLayer).map(([layerId, geometries]) => [layerId, [...geometries][0] || ""]));
  vetroLayerStyleOverrides = normalizeObjectStorage(
    STORAGE_KEYS.vetroLayerStyles,
    vetroLayerStyleOverrides,
    (layerId, value) => availableLayers.has(layerId) && vetroLayerStyleValid(layerId, value),
  );
  vetroLayerColorOverrides = normalizeObjectStorage(
    STORAGE_KEYS.vetroLayerColors,
    vetroLayerColorOverrides,
    (layerId, value) => availableLayers.has(layerId) && isHexColor(value),
  );
  vetroLayerNameOverrides = normalizeObjectStorage(
    STORAGE_KEYS.vetroLayerNames,
    vetroLayerNameOverrides,
    (layerId, value) => availableLayers.has(layerId) && typeof value === "string",
  );
  vetroLayerNoteOverrides = normalizeObjectStorage(
    STORAGE_KEYS.vetroLayerNotes,
    vetroLayerNoteOverrides,
    (layerId, value) => availableLayers.has(layerId) && typeof value === "string",
  );
  vetroLayerSizeOverrides = normalizeObjectStorage(
    STORAGE_KEYS.vetroLayerSizes,
    vetroLayerSizeOverrides,
    (layerId, value) => availableLayers.has(layerId) && Number.isFinite(Number(value)),
  );
  vetroLayerOpacityOverrides = normalizeObjectStorage(
    STORAGE_KEYS.vetroLayerOpacities,
    vetroLayerOpacityOverrides,
    (layerId, value) => availableLayers.has(layerId) && Number.isFinite(Number(value)),
  );
  const selectedLayerIds = [...vetroSelectedLayers];
  const hadRawLayer26 = vetroSelectedLayers.has(VETRO_SERVICE_LOCATION_LAYER_ID);
  const hadObsoleteLayer26Split = selectedLayerIds.some((layerId) => String(layerId).startsWith("prefix:") && layerId !== "prefix:SL");
  if (hadRawLayer26 && availableLayers.has("prefix:SL")) {
    vetroSelectedLayers.add("prefix:SL");
  }
  if (hadObsoleteLayer26Split && availableLayers.has(VETRO_SERVICE_LOCATION_LAYER_ID)) {
    vetroSelectedLayers.add(VETRO_SERVICE_LOCATION_LAYER_ID);
  }
  vetroSelectedLayers = new Set([...vetroSelectedLayers].filter((layerId) => availableLayers.has(layerId)));
  if (!vetroSelectedLayers.size) {
    vetroSelectedLayers = new Set(layerIds);
  }
  writeJsonStorage(STORAGE_KEYS.vetroLayers, [...vetroSelectedLayers]);
  const layerCounts = valueCountMap(features, vetroLayerControlId);
  renderVetroLayerList(elements.vetroLayerFilter, layerIds, [...vetroSelectedLayers], layerCounts);
  renderAppVetroStyleEditor(layerIds, layerCounts);
  const planValues = uniqueSorted(features.map((feature) => propValue(feature.properties || {}, "plan")));

  vetroSelectedPlans = normalizeSelectedSet(vetroSelectedPlans, planValues, STORAGE_KEYS.vetroPlan);

  const planCounts = valueCountMap(features, (feature) => propValue(feature.properties || {}, "plan"));

  renderCheckboxList(elements.vetroPlanFilter, planValues, [...vetroSelectedPlans], (value) => labelWithCount(value, planCounts));
  syncVetroFacetSelection();
  scheduleDashboardStateSave();
}

async function setVetroVisible(visible) {
  if (!visible) {
    renderVetroLayer();
    elements.vetroStatus.textContent = "Off";
    scheduleDashboardStateSave();
    return;
  }
  await ensureVetroLoaded();
  renderVetroLayer();
  scheduleDashboardStateSave();
}

async function ensureVetroLoaded() {
  if (vetroGeojson) return;
  elements.vetroStatus.textContent = "Loading...";
  const response = await fetch("/api/vetro");
  if (!response.ok) throw new Error(`Vetro layer failed: ${response.status}`);
  vetroGeojson = await response.json();
  if (!Array.isArray(vetroGeojson?.features)) {
    vetroGeojson = { type: "FeatureCollection", features: [] };
  }
  vetroLoaded = true;
  populateVetroFilters();
}

function updateVetroRefreshUi(status) {
  if (!elements.vetroRefreshProgress) return;
  const running = Boolean(status?.running);
  const complete = status?.success === true;
  const failed = status?.success === false;
  elements.vetroRefreshProgress.hidden = !running && !complete && !failed;
  if (elements.updateVetro) elements.updateVetro.disabled = running;
  const percent = Math.max(0, Math.min(100, Number(status?.percent) || 0));
  if (elements.vetroRefreshBar) elements.vetroRefreshBar.style.width = `${percent}%`;
  if (elements.vetroRefreshStatus) {
    const message = status?.message || "Idle";
    elements.vetroRefreshStatus.textContent = running ? `${message} (${percent}%)` : message;
  }
  if (elements.vetroLoginLink) {
    const loginUrl = typeof status?.vetro_login_url === "string" ? status.vetro_login_url : "";
    const showLogin = Boolean(status?.auth_required && loginUrl);
    elements.vetroLoginLink.hidden = !showLogin;
    if (showLogin) elements.vetroLoginLink.href = loginUrl;
  }
}

async function pollVetroRefresh() {
  for (;;) {
    const response = await fetch("/api/vetro-refresh");
    if (!response.ok) throw new Error(`VETRO refresh status failed: ${response.status}`);
    const status = await response.json();
    updateVetroRefreshUi(status);
    if (!status.running) return status;
    await sleep(2000);
  }
}

async function reloadVetroAfterRefresh() {
  if (vetroLayer) {
    map.removeLayer(vetroLayer);
  }
  vetroGeojson = null;
  vetroLayer = null;
  vetroLoaded = false;
  if (elements.vetroToggle.checked) {
    await ensureVetroLoaded();
    renderVetroLayer();
  } else {
    elements.vetroStatus.textContent = "Off";
  }
}

async function startVetroRefresh() {
  if (!elements.updateVetro) return;
  elements.updateVetro.disabled = true;
  updateVetroRefreshUi({ running: true, message: "Starting VETRO refresh", percent: 3 });
  try {
    const response = await fetch("/api/vetro-refresh", { method: "POST" });
    const startStatus = await response.json().catch(() => ({}));
    if (startStatus.auth_required && startStatus.vetro_login_url) {
      updateVetroRefreshUi({ ...startStatus, running: false, success: false, percent: 100 });
      auditEvent("vetro_login_required", { url: startStatus.vetro_login_url });
      return;
    }
    if (!response.ok && response.status !== 409) throw new Error(startStatus.message || `VETRO refresh request failed: ${response.status}`);
    const status = await pollVetroRefresh();
    if (!status.success) throw new Error(status.message || "VETRO refresh failed");
    await reloadVetroAfterRefresh();
    updateVetroRefreshUi({ ...status, message: "VETRO refresh completed", percent: 100 });
    auditEvent("vetro_refresh_completed", {});
  } catch (error) {
    updateVetroRefreshUi({ running: false, success: false, message: error.message || "VETRO refresh failed", percent: 100 });
    auditEvent("vetro_refresh_failed", { message: error.message || "VETRO refresh failed" });
    console.error(error);
  } finally {
    if (elements.updateVetro) elements.updateVetro.disabled = false;
  }
}

async function saveVetroCapture() {
  if (!elements.vetroCaptureText || !elements.saveVetroCapture) return;
  const content = pendingVetroCaptureFile ? await pendingVetroCaptureFile.text() : elements.vetroCaptureText.value.trim();
  if (!content) {
    if (elements.vetroCaptureStatus) elements.vetroCaptureStatus.textContent = "Choose a HAR/text file or paste copied cURL first.";
    return;
  }
  elements.saveVetroCapture.disabled = true;
  if (elements.vetroCaptureStatus) elements.vetroCaptureStatus.textContent = "Saving capture...";
  try {
    const response = await fetch("/api/vetro-capture", {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: content,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.message || `VETRO capture failed: ${response.status}`);
    if (elements.vetroCaptureStatus) {
      const tiles = Number(payload.vetro_tile_count || payload.pbf_url_count || 0);
      const layerCount = payload.layer_counts && typeof payload.layer_counts === "object" ? Object.keys(payload.layer_counts).length : 0;
      const readiness = payload.ready_for_import ? "Ready to import." : (payload.capture_warning || "Not ready to import.");
      elements.vetroCaptureStatus.textContent = `Capture saved. Found ${tiles} VETRO tile request${tiles === 1 ? "" : "s"}${layerCount ? ` across ${layerCount} layer${layerCount === 1 ? "" : "s"}` : ""}. ${readiness}`;
    }
    auditEvent("vetro_capture_saved_client", { pbf_url_count: payload.pbf_url_count || 0, vetro_tile_count: payload.vetro_tile_count || 0, ready_for_import: Boolean(payload.ready_for_import) });
  } catch (error) {
    if (elements.vetroCaptureStatus) elements.vetroCaptureStatus.textContent = error.message || "Capture save failed";
    console.error(error);
  } finally {
    elements.saveVetroCapture.disabled = false;
  }
}

async function pollServerRefresh() {
  for (;;) {
    const response = await fetch("/api/refresh");
    if (!response.ok) throw new Error(`Refresh status failed: ${response.status}`);
    const status = await response.json();
    if (!status.running) return status;
    elements.refresh.textContent = status.message || "Refreshing...";
    await sleep(4000);
  }
}

async function refreshServerData() {
  const originalText = elements.refresh.textContent;
  elements.refresh.disabled = true;
  elements.refresh.textContent = "Refreshing...";
  showSavedToast("Refreshing tickets...");
  try {
    await saveTicketWorkflowStateNow();
    const response = await fetch("/api/refresh", { method: "POST" });
    if (!response.ok && response.status !== 409) {
      throw new Error(`Refresh request failed: ${response.status}`);
    }
    const status = response.status === 409 ? await pollServerRefresh() : await pollServerRefresh();
    if (!status.success) {
      throw new Error(status.message || "Refresh failed");
    }
    await loadTickets();
    showSavedToast("Refresh complete");
    auditEvent("ticket_refresh_completed", {});
  } catch (error) {
    showSavedToast("Refresh failed");
    auditEvent("ticket_refresh_failed", { message: error.message || "Refresh failed" });
    throw error;
  } finally {
    elements.refresh.disabled = false;
    elements.refresh.textContent = originalText || "Refresh";
  }
}

function ticketAddress(ticket) {
  return [ticket.address, ticket.street, ticket.place, ticket.county].filter(Boolean).join(" ");
}

function workDescription(ticket) {
  return ticket.location_information || ticket.raw_text || "";
}

function actionByKey(key) {
  return TICKET_ACTIONS.find((action) => action.key === key) || null;
}

function normalizeTicketActions(value) {
  const valid = new Set(TICKET_ACTIONS.map((action) => action.key));
  const normalized = {};
  for (const [ticketNumber, actions] of Object.entries(value || {})) {
    if (!Array.isArray(actions)) continue;
    const selected = [...new Set(actions.map(String).filter((action) => valid.has(action)))];
    if (selected.length) normalized[String(ticketNumber)] = selected;
  }
  return normalized;
}

function normalizeTicketActionUpdatedAt(value) {
  const normalized = {};
  for (const [ticketNumber, updatedAt] of Object.entries(value || {})) {
    const timestamp = Number(updatedAt);
    if (Number.isFinite(timestamp) && timestamp > 0) normalized[String(ticketNumber)] = timestamp;
  }
  return normalized;
}

function normalizeTicketDescriptions(value) {
  const normalized = {};
  for (const [ticketNumber, description] of Object.entries(value || {})) {
    const text = String(description || "").trim();
    if (text) normalized[String(ticketNumber)] = text;
  }
  return normalized;
}

function normalizeTicketMarkedBy(value) {
  const normalized = {};
  for (const [ticketNumber, username] of Object.entries(value || {})) {
    const text = String(username || "").trim();
    if (text) normalized[String(ticketNumber)] = text.slice(0, 120);
  }
  return normalized;
}

function normalizeTicketPriorities(value) {
  const normalized = {};
  for (const [ticketNumber, priority] of Object.entries(value || {})) {
    const text = String(priority || "").trim().toLowerCase();
    if (DIG_TICKET_PRIORITIES.includes(text)) normalized[String(ticketNumber)] = text;
  }
  return normalized;
}

function canManagePriorities() {
  return currentUserRole !== "employee";
}

function ticketAssignedPriority(ticketNumber) {
  return ticketPriorities[String(ticketNumber)] || "";
}

function ticketAssignedPriorityLabel(ticketNumber) {
  const priority = ticketAssignedPriority(ticketNumber);
  if (!priority) return "";
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function ticketPriorityControlHtml(ticketNumber) {
  const priority = ticketAssignedPriority(ticketNumber);
  if (!canManagePriorities()) return priority ? `<span class="sheet-priority-pill priority-${escapeHtml(priority)}">${escapeHtml(ticketAssignedPriorityLabel(ticketNumber))}</span>` : '<span class="sheet-muted">No priority</span>';
  return `
    <select class="sheet-priority-select" data-ticket-priority="${escapeHtml(ticketNumber)}">
      <option value="">No priority</option>
      ${DIG_TICKET_PRIORITIES.map((item) => `<option value="${escapeHtml(item)}" ${priority === item ? "selected" : ""}>${escapeHtml(item.charAt(0).toUpperCase() + item.slice(1))}</option>`).join("")}
    </select>
  `;
}

function setTicketPriority(ticketNumber, priority) {
  if (!canManagePriorities()) return;
  const normalized = String(priority || "").trim().toLowerCase();
  if (DIG_TICKET_PRIORITIES.includes(normalized)) ticketPriorities[ticketNumber] = normalized;
  else delete ticketPriorities[ticketNumber];
  writeJsonStorage(STORAGE_KEYS.ticketPriorities, ticketPriorities);
  scheduleDashboardStateSave();
  auditEvent("ticket_priority_changed", { ticket: ticketNumber, priority: normalized || "none" });
  render();
  if (currentView === "sheet") renderSheetView();
}

function ticketSelectedActions(ticketNumber) {
  return Array.isArray(ticketActions[ticketNumber]) ? ticketActions[ticketNumber] : [];
}

function ticketActionLabels(ticketNumber) {
  return ticketSelectedActions(ticketNumber)
    .map((key) => actionByKey(key)?.label)
    .filter(Boolean);
}

function ticketHasActions(ticketNumber) {
  return ticketSelectedActions(ticketNumber).length > 0;
}

function ticketIsActionHidden(ticket) {
  return ticketSelectedActions(ticket.ticket_number).some((key) => actionByKey(key)?.hidesFromDashboard);
}

function actionListSignature(actions) {
  return JSON.stringify([...(actions || [])].map(String).sort());
}

function stampTicketAction(ticketNumber, timestamp = Date.now()) {
  ticketActionUpdatedAt[String(ticketNumber)] = timestamp;
  writeJsonStorage(STORAGE_KEYS.ticketActionUpdatedAt, ticketActionUpdatedAt);
}

function stampTicketVisibility(ticketNumber, kind, timestamp = Date.now()) {
  const key = String(ticketNumber || "");
  if (!key) return;
  if (kind === "archive") {
    archivedTicketUpdatedAt[key] = timestamp;
    writeJsonStorage(STORAGE_KEYS.archivedTicketUpdatedAt, archivedTicketUpdatedAt);
  } else {
    hiddenTicketUpdatedAt[key] = timestamp;
    writeJsonStorage(STORAGE_KEYS.hiddenTicketUpdatedAt, hiddenTicketUpdatedAt);
  }
}

function ticketWorkDateKey(ticket) {
  const raw = String(ticket?.work_begin_date || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, "0"),
      String(parsed.getDate()).padStart(2, "0"),
    ].join("-");
  }
  const match = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function stampTicketActionDifferences(beforeActions, afterActions, timestamp = Date.now()) {
  const ticketNumbers = new Set([
    ...Object.keys(beforeActions || {}),
    ...Object.keys(afterActions || {}),
  ]);
  for (const ticketNumber of ticketNumbers) {
    if (actionListSignature(beforeActions?.[ticketNumber]) !== actionListSignature(afterActions?.[ticketNumber])) {
      ticketActionUpdatedAt[String(ticketNumber)] = timestamp;
    }
  }
  writeJsonStorage(STORAGE_KEYS.ticketActionUpdatedAt, ticketActionUpdatedAt);
}

function ticketDescription(ticketNumber) {
  return ticketDescriptions[ticketNumber] || "";
}

function saveTicketWorkflowState() {
  applyTicketListCheckpoint();
  hiddenTicketUpdatedAt = normalizeTicketActionUpdatedAt(hiddenTicketUpdatedAt);
  archivedTicketUpdatedAt = normalizeTicketActionUpdatedAt(archivedTicketUpdatedAt);
  ticketActions = normalizeTicketActions(ticketActions);
  ticketActionUpdatedAt = normalizeTicketActionUpdatedAt(ticketActionUpdatedAt);
  ticketDescriptions = normalizeTicketDescriptions(ticketDescriptions);
  ticketMarkedBy = normalizeTicketMarkedBy(ticketMarkedBy);
  if (ticketListCheckpoint?.enabled) {
    ticketListCheckpoint.ticketActions = normalizeTicketActions(ticketActions);
    ticketListCheckpoint.hiddenTicketUpdatedAt = normalizeTicketActionUpdatedAt(hiddenTicketUpdatedAt);
    ticketListCheckpoint.archivedTicketUpdatedAt = normalizeTicketActionUpdatedAt(archivedTicketUpdatedAt);
    ticketListCheckpoint.ticketActionUpdatedAt = normalizeTicketActionUpdatedAt(ticketActionUpdatedAt);
    writeTicketListCheckpoint();
  }
  writeJsonStorage(STORAGE_KEYS.hiddenTicketUpdatedAt, hiddenTicketUpdatedAt);
  writeJsonStorage(STORAGE_KEYS.archivedTicketUpdatedAt, archivedTicketUpdatedAt);
  ticketPriorities = normalizeTicketPriorities(ticketPriorities);
  writeJsonStorage(STORAGE_KEYS.ticketActions, ticketActions);
  writeJsonStorage(STORAGE_KEYS.ticketActionUpdatedAt, ticketActionUpdatedAt);
  writeJsonStorage(STORAGE_KEYS.ticketDescriptions, ticketDescriptions);
  writeJsonStorage(STORAGE_KEYS.ticketMarkedBy, ticketMarkedBy);
  writeJsonStorage(STORAGE_KEYS.ticketPriorities, ticketPriorities);
  scheduleTicketWorkflowServerSave();
  scheduleDashboardStateSave();
  void saveDashboardState().catch((error) => {
    console.warn("Unable to save dashboard ticket workflow state", error);
  });
}

function setTicketDescription(ticketNumber, value) {
  const text = String(value || "").trim();
  if (text) ticketDescriptions[ticketNumber] = text;
  else delete ticketDescriptions[ticketNumber];
  saveTicketWorkflowState();
}

function setTicketAction(ticketNumber, actionKey, selected) {
  const current = new Set(ticketSelectedActions(ticketNumber));
  if (selected) current.add(actionKey);
  else current.delete(actionKey);
  const next = [...current].filter((key) => actionByKey(key));
  setTicketActions(ticketNumber, next);
}

function setTicketActions(ticketNumber, actionKeys) {
  if (!actionKeys?.length && protectedTicketNumbersFromCheckpoint().has(String(ticketNumber))) return;
  const next = [...new Set((actionKeys || []).map(String).filter((key) => actionByKey(key)))];
  if (next.length) ticketActions[ticketNumber] = next;
  else delete ticketActions[ticketNumber];
  const actor = currentUsername || currentUserDisplayName;
  if (actor) ticketMarkedBy[ticketNumber] = actor;
  stampTicketAction(ticketNumber);
  saveTicketWorkflowState();
  auditEvent("ticket_actions_changed", { ticket: ticketNumber, actions: next });
}

function setAllTicketActions(ticketNumber, selected) {
  if (!selected && protectedTicketNumbersFromCheckpoint().has(String(ticketNumber))) return;
  if (selected) ticketActions[ticketNumber] = TICKET_ACTIONS.map((action) => action.key);
  else delete ticketActions[ticketNumber];
  const actor = currentUsername || currentUserDisplayName;
  if (actor) ticketMarkedBy[ticketNumber] = actor;
  stampTicketAction(ticketNumber);
  saveTicketWorkflowState();
  auditEvent("ticket_actions_all_changed", { ticket: ticketNumber, selected });
}

function bindTicketDescriptionControls(root) {
  if (!root) return;
  for (const input of root.querySelectorAll("[data-ticket-description]")) {
    input.addEventListener("change", () => {
      rememberUndoState();
      setTicketDescription(input.dataset.ticketDescription, input.value);
    });
  }
}

function sheetActionSummaryHtml(ticketNumber) {
  const labels = ticketActionLabels(ticketNumber);
  return labels.length
    ? `<span class="sheet-status-list">${labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</span>`
    : '<span class="sheet-muted">Click row to mark</span>';
}

function sheetSubmitHtml(ticket, expanded) {
  return expanded
    ? `<button class="sheet-submit-action" type="button" data-ticket-action-submit="${escapeHtml(ticket.ticket_number)}">Submit</button>`
    : '<button class="sheet-submit-action" type="button" disabled>Submit</button>';
}

function actionControlHtml(ticketNumber, compact = false, options = {}) {
  const selected = new Set(ticketSelectedActions(ticketNumber));
  const allChecked = TICKET_ACTIONS.every((action) => selected.has(action.key));
  const deferred = Boolean(options.deferred);
  const externalSubmit = Boolean(options.externalSubmit);
  const includeDescription = Boolean(options.includeDescription);
  const allAttribute = deferred ? "data-ticket-action-stage-all" : "data-ticket-action-all";
  const actionAttribute = deferred ? "data-ticket-action-stage" : "data-ticket-action";
  const rows = [
    `<label><input type="checkbox" ${allAttribute}="${escapeHtml(ticketNumber)}" ${allChecked ? "checked" : ""}> Select all</label>`,
    ...TICKET_ACTIONS.map(
      (action) => `<label><input type="checkbox" ${actionAttribute}="${escapeHtml(ticketNumber)}" data-action-key="${escapeHtml(action.key)}" ${selected.has(action.key) ? "checked" : ""}> ${escapeHtml(action.label)}</label>`,
    ),
  ].join("");
  const submit = deferred
    ? `<div class="ticket-action-submit-row${externalSubmit ? " external-submit" : ""}">
        ${externalSubmit ? "" : `<button type="button" data-ticket-action-submit="${escapeHtml(ticketNumber)}">Submit</button>`}
        <span data-ticket-action-pending="${escapeHtml(ticketNumber)}">Choose actions, then submit.</span>
      </div>`
    : "";
  const description = includeDescription
    ? `<label class="ticket-action-description">
        Description before submit
        <textarea data-ticket-description="${escapeHtml(ticketNumber)}" rows="3" placeholder="Add locator notes">${escapeHtml(ticketDescription(ticketNumber))}</textarea>
      </label>`
    : "";
  const upload = deferred ? attachmentUploadHtml(ticketNumber) : "";
  return `<div class="ticket-action-checks${compact ? " compact" : ""}${deferred ? " staged" : ""}" data-action-mode="${deferred ? "deferred" : "instant"}">${rows}${description}${upload}${submit}</div>`;
}

function firstTicketValue(ticket, keys) {
  for (const key of keys) {
    const value = ticket[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function ticketDueText(ticket) {
  return [ticket.work_begin_date, ticket.work_begin_time].filter(Boolean).join(" ");
}

function ticketLatLong(ticket) {
  const latitude = firstTicketValue(ticket, ["latitude", "lat"]);
  const longitude = firstTicketValue(ticket, ["longitude", "lon", "lng"]);
  return latitude && longitude ? `${latitude}, ${longitude}` : "";
}

function formatTicketDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : formatDashboardDateTime(date);
}

function ticketAttachmentSummary(ticketNumber) {
  const ticket = tickets.find((item) => item.ticket_number === ticketNumber);
  const summary = ticket?.attachment_summary;
  return summary && typeof summary === "object" ? summary : { count: 0, folder_url: "", folder_name: ticketNumber };
}

function attachmentFolderLinkHtml(ticketNumber) {
  const summary = ticketAttachmentSummary(ticketNumber);
  if (!summary.folder_url) {
    return summary.count ? `<span>${Number(summary.count).toLocaleString()} attachment${Number(summary.count) === 1 ? "" : "s"}</span>` : '<span>No attachments</span>';
  }
  const count = Number(summary.count) || 0;
  const label = count ? `${count.toLocaleString()} attachment${count === 1 ? "" : "s"}` : "Open OneDrive folder";
  return `<a href="${escapeHtml(summary.folder_url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function attachmentUploadHtml(ticketNumber, compact = false) {
  return `
    <div class="ticket-attachment-upload${compact ? " compact" : ""}" data-ticket-upload="${escapeHtml(ticketNumber)}">
      <div class="ticket-attachment-head">
        ${compact ? "" : "<strong>Attachments</strong>"}
        <span data-ticket-attachment-folder="${escapeHtml(ticketNumber)}">${attachmentFolderLinkHtml(ticketNumber)}</span>
      </div>
      <input type="file" multiple hidden data-ticket-file-input="${escapeHtml(ticketNumber)}">
      <div class="ticket-attachment-actions">
        <button type="button" data-ticket-file-button="${escapeHtml(ticketNumber)}">Choose attachments</button>
        <button type="button" data-ticket-upload-button="${escapeHtml(ticketNumber)}" disabled>Upload attachments</button>
      </div>
      <div class="ticket-attachment-selected" data-ticket-file-status="${escapeHtml(ticketNumber)}">Select up to 80 files.</div>
      <div class="ticket-upload-progress" hidden>
        <div data-ticket-upload-bar="${escapeHtml(ticketNumber)}"></div>
      </div>
    </div>
  `;
}

const SHEET_COLUMNS = [
  ["Submit", sheetSubmitHtml, "html"],
  ["Priority", (ticket) => ticketPriorityControlHtml(ticket.ticket_number), "html"],
  ["Action", (ticket, expanded) => expanded ? actionControlHtml(ticket.ticket_number, true, { deferred: true, externalSubmit: true }) : sheetActionSummaryHtml(ticket.ticket_number), "html"],
  ["Attachments", (ticket) => attachmentUploadHtml(ticket.ticket_number, true), "html"],
  ["Description", (ticket, expanded) => expanded ? `
    <textarea class="sheet-description" data-ticket-description="${escapeHtml(ticket.ticket_number)}" placeholder="Leave a description">${escapeHtml(ticketDescription(ticket.ticket_number))}</textarea>
  ` : escapeHtml(ticketDescription(ticket.ticket_number) || workDescription(ticket)), "html"],
  ["Marked By", (ticket) => ticketMarkedBy[ticket.ticket_number] || ""],
  ["Comment", () => ""],
  ["811 Ticket #", (ticket) => ticket.ticket_number || ""],
  ["Due Date", ticketDueText],
  ["Latitude & Longitude", ticketLatLong],
  ["Work Address", ticketAddress],
  ["Work Area", (ticket) => firstTicketValue(ticket, ["place", "city"])],
  ["Done For", (ticket) => firstTicketValue(ticket, ["done_for", "company_name"])],
  ["Excavator Name", (ticket) => firstTicketValue(ticket, ["contractor", "caller"])],
  ["Location Information", workDescription],
  ["Excavator Phone", (ticket) => firstTicketValue(ticket, ["contact_phone", "company_phone", "phone"])],
  ["Extent", (ticket) => firstTicketValue(ticket, ["extent"])],
  ["Work Order #", (ticket) => firstTicketValue(ticket, ["work_order", "work_order_number"])],
  ["Nearest Intersection", (ticket) => firstTicketValue(ticket, ["nearest_intersection"])],
  ["Directional Boring", (ticket) => firstTicketValue(ticket, ["directional_boring"])],
  ["Work County", (ticket) => firstTicketValue(ticket, ["county"])],
  ["Work Type", (ticket) => firstTicketValue(ticket, ["work_type"])],
  ["WorkPriority", (ticket) => (ticketIsEmergency(ticket) ? "EMERGENCY" : firstTicketValue(ticket, ["message_type", "priority"]))],
  ["Excavator City", (ticket) => firstTicketValue(ticket, ["company_city", "caller_city"])],
  ["Excavator Email", (ticket) => firstTicketValue(ticket, ["contact_email", "company_email", "email"])],
  ["Excavator Address", (ticket) => firstTicketValue(ticket, ["company_address", "caller_address"])],
  ["Excavator Contact Name", (ticket) => firstTicketValue(ticket, ["contact", "contact_name"])],
  ["Excavator State", (ticket) => firstTicketValue(ticket, ["company_state", "caller_state", "state"])],
  ["Utilities Notified", (ticket) => firstTicketValue(ticket, ["utilities_notified"])],
  ["Site NESW", (ticket) => firstTicketValue(ticket, ["site_nesw", "site_direction", "direction"])],
  ["Site Address", (ticket) => firstTicketValue(ticket, ["address"])],
  ["Site Street", (ticket) => firstTicketValue(ticket, ["street"])],
  ["Site Street Type", (ticket) => firstTicketValue(ticket, ["street_type"])],
  ["Latitude", (ticket) => firstTicketValue(ticket, ["latitude", "lat"])],
  ["Longitude", (ticket) => firstTicketValue(ticket, ["longitude", "lon", "lng"])],
  ["Site Direction", (ticket) => firstTicketValue(ticket, ["site_direction", "direction"])],
  ["Received", (ticket) => formatTicketDate(firstTicketValue(ticket, ["email_date", "received"]))],
  ["Created", (ticket) => [ticket.prepared_date, ticket.prepared_time].filter(Boolean).join(" ")],
  ["Date Added", (ticket) => formatTicketDate(firstTicketValue(ticket, ["email_date", "date_added"]))],
  ["Dig Ticket", (ticket) => ticket.ticket_number || ""],
  ["Code", (ticket) => firstTicketValue(ticket, ["code"])],
  ["Facilities", (ticket) => firstTicketValue(ticket, ["facilities"])],
  ["Modified By", (ticket) => firstTicketValue(ticket, ["modified_by"])],
];

function normalizeSheetSort(value) {
  const label = String(value?.column || "Due Date");
  return {
    column: SHEET_COLUMNS.some(([columnLabel]) => columnLabel === label) ? label : "Due Date",
    direction: value?.direction === "asc" ? "asc" : "desc",
  };
}

function normalizeSheetColumnFilters(value) {
  const validColumns = new Set(SHEET_COLUMNS.map(([label]) => label));
  const normalized = {};
  for (const [label, values] of Object.entries(value || {})) {
    if (!validColumns.has(label) || !Array.isArray(values)) continue;
    const selected = [...new Set(values.map(String))];
    if (selected.length) normalized[label] = selected;
  }
  return normalized;
}

function normalizeSheetSavedFilters(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: String(item?.name || "").trim().slice(0, 60),
      search: String(item?.search || ""),
      sort: normalizeSheetSort(item?.sort || {}),
      columnFilters: normalizeSheetColumnFilters(item?.columnFilters || {}),
      savedAt: String(item?.savedAt || ""),
    }))
    .filter((item) => item.name);
}

function defaultSheetColumnWidth(label) {
  const widths = {
    Submit: 92,
    Priority: 132,
    Action: 310,
    Attachments: 260,
    Description: 360,
    "Marked By": 150,
    Comment: 160,
    "811 Ticket #": 150,
    "Due Date": 170,
    "Latitude & Longitude": 190,
    "Work Address": 280,
    "Work Area": 180,
    "Done For": 210,
    "Excavator Name": 220,
    "Location Information": 420,
    "Excavator Phone": 170,
  };
  return widths[label] || 165;
}

function normalizeSheetColumnWidths(value) {
  const validColumns = new Set(SHEET_COLUMNS.map(([label]) => label));
  const normalized = {};
  for (const [label, width] of Object.entries(value || {})) {
    if (!validColumns.has(label)) continue;
    const number = Number(width);
    if (Number.isFinite(number)) normalized[label] = Math.max(70, Math.min(720, Math.round(number)));
  }
  return normalized;
}

function sheetColumnWidth(label) {
  return sheetColumnWidths[label] || defaultSheetColumnWidth(label);
}

function sheetTableWidth() {
  return SHEET_COLUMNS.reduce((total, [label]) => total + sheetColumnWidth(label), 0);
}

function sheetColgroupHtml() {
  return `<colgroup>${SHEET_COLUMNS.map(([label]) => `<col style="width:${sheetColumnWidth(label)}px">`).join("")}</colgroup>`;
}

function saveSheetColumnWidths() {
  sheetColumnWidths = normalizeSheetColumnWidths(sheetColumnWidths);
  writeJsonStorage(STORAGE_KEYS.sheetColumnWidths, sheetColumnWidths);
}

let syncingSheetHorizontalScroll = false;

function syncSheetHorizontalScroller() {
  if (!elements.sheetTableWrap || !elements.sheetHorizontalScroll || !elements.sheetHorizontalScrollInner) return;
  const table = elements.sheetTableWrap.querySelector(".sheet-table");
  const width = table ? Math.max(table.scrollWidth, table.offsetWidth, sheetTableWidth()) : sheetTableWidth();
  elements.sheetHorizontalScrollInner.style.width = `${width}px`;
  elements.sheetHorizontalScroll.scrollLeft = elements.sheetTableWrap.scrollLeft;
  elements.sheetHorizontalScroll.hidden = width <= elements.sheetTableWrap.clientWidth + 2;
}

function bindSheetHorizontalScroller() {
  if (!elements.sheetTableWrap || !elements.sheetHorizontalScroll) return;
  if (elements.sheetHorizontalScroll.dataset.bound === "true") return;
  elements.sheetHorizontalScroll.dataset.bound = "true";
  elements.sheetHorizontalScroll.addEventListener("scroll", () => {
    if (syncingSheetHorizontalScroll) return;
    syncingSheetHorizontalScroll = true;
    elements.sheetTableWrap.scrollLeft = elements.sheetHorizontalScroll.scrollLeft;
    syncingSheetHorizontalScroll = false;
  });
  elements.sheetHorizontalScroll.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    elements.sheetHorizontalScroll.scrollLeft += event.deltaY;
    elements.sheetTableWrap.scrollLeft = elements.sheetHorizontalScroll.scrollLeft;
  }, { passive: false });
  elements.sheetTableWrap.addEventListener("scroll", () => {
    if (syncingSheetHorizontalScroll) return;
    syncingSheetHorizontalScroll = true;
    elements.sheetHorizontalScroll.scrollLeft = elements.sheetTableWrap.scrollLeft;
    syncingSheetHorizontalScroll = false;
  });
}

sheetSort = normalizeSheetSort(sheetSort);
sheetColumnFilters = normalizeSheetColumnFilters(sheetColumnFilters);
sheetSavedFilters = normalizeSheetSavedFilters(sheetSavedFilters);
sheetColumnWidths = normalizeSheetColumnWidths(sheetColumnWidths);

function saveSheetGridState() {
  sheetSort = normalizeSheetSort(sheetSort);
  sheetColumnFilters = normalizeSheetColumnFilters(sheetColumnFilters);
  sheetSavedFilters = normalizeSheetSavedFilters(sheetSavedFilters);
  writeJsonStorage(STORAGE_KEYS.sheetSort, sheetSort);
  writeJsonStorage(STORAGE_KEYS.sheetColumnFilters, sheetColumnFilters);
  writeJsonStorage(STORAGE_KEYS.sheetSavedFilters, sheetSavedFilters);
}

function plainTextFromHtml(html) {
  const element = document.createElement("div");
  element.innerHTML = String(html || "");
  return element.textContent || element.innerText || "";
}

function sheetExportCell(ticket, column) {
  const [label, getter, mode] = column;
  if (label === "Action") return ticketActionLabels(ticket.ticket_number).join("; ");
  if (label === "Description") return ticketDescription(ticket.ticket_number) || workDescription(ticket);
  if (label === "Marked By") return ticketMarkedBy[ticket.ticket_number] || "";
  const value = getter(ticket, false) || "";
  return mode === "html" ? plainTextFromHtml(value) : String(value);
}

function sheetColumnByLabel(label) {
  return SHEET_COLUMNS.find(([columnLabel]) => columnLabel === label) || SHEET_COLUMNS[0];
}

function sheetCellValue(ticket, label) {
  return sheetExportCell(ticket, sheetColumnByLabel(label));
}

function sheetSearchValue(ticket) {
  return SHEET_COLUMNS.map(([label]) => sheetCellValue(ticket, label)).join(" ").toLowerCase();
}

function sheetSortValue(ticket, label) {
  const value = sheetCellValue(ticket, label);
  if (label === "Due Date") {
    const date = parseTicketDueDate(ticket);
    return date ? date.getTime() : -Infinity;
  }
  if (label === "Latitude" || label === "Longitude") {
    const number = Number(value);
    return Number.isFinite(number) ? number : -Infinity;
  }
  return String(value || "").toLowerCase();
}

function compareSheetTickets(a, b) {
  const direction = sheetSort.direction === "asc" ? 1 : -1;
  const aValue = sheetSortValue(a, sheetSort.column);
  const bValue = sheetSortValue(b, sheetSort.column);
  if (typeof aValue === "number" && typeof bValue === "number" && aValue !== bValue) return (aValue - bValue) * direction;
  const compared = String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: "base" });
  if (compared) return compared * direction;
  return String(a.ticket_number || "").localeCompare(String(b.ticket_number || ""));
}

function sheetColumnFilteredTickets(excludedLabel = "") {
  const query = ticketSearch.trim().toLowerCase();
  return scopedTickets().filter((ticket) => {
    if (query && !sheetSearchValue(ticket).includes(query)) return false;
    for (const [label, values] of Object.entries(sheetColumnFilters)) {
      if (label === excludedLabel || !Array.isArray(values) || !values.length) continue;
      if (!values.includes(sheetCellValue(ticket, label))) return false;
    }
    return true;
  });
}

function sheetColumnValues(label) {
  return [...new Set(sheetColumnFilteredTickets(label).map((ticket) => sheetCellValue(ticket, label)))]
    .sort((a, b) => String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" }));
}

function sheetFilterActive(label) {
  return Array.isArray(sheetColumnFilters[label]) && sheetColumnFilters[label].length > 0;
}

function sheetAnyFilterActive() {
  return ticketSearch.trim().length > 0 || Object.values(sheetColumnFilters).some((values) => Array.isArray(values) && values.length);
}

function sheetHeaderHtml(label) {
  const active = sheetFilterActive(label);
  const sortMark = sheetSort.column === label ? (sheetSort.direction === "asc" ? " ↑" : " ↓") : "";
  const values = sheetColumnValues(label);
  const selected = new Set(sheetColumnFilters[label] || []);
  const visibleValues = values.slice(0, 250);
  const checkedAll = !active;
  return `
    <th class="${active ? "sheet-filtered-column" : ""}" data-sheet-column="${escapeHtml(label)}" style="width:${sheetColumnWidth(label)}px">
      <details class="sheet-filter-menu" data-sheet-filter-menu="${escapeHtml(label)}">
        <summary>${escapeHtml(label)}${sortMark}</summary>
        <div class="sheet-filter-panel">
          <div class="sheet-filter-title">${escapeHtml(label)}</div>
          <button type="button" data-sheet-sort="${escapeHtml(label)}" data-sort-direction="asc">Sort A to Z</button>
          <button type="button" data-sheet-sort="${escapeHtml(label)}" data-sort-direction="desc">Sort Z to A</button>
          <button type="button" data-sheet-clear-column="${escapeHtml(label)}">Clear column filter</button>
          <input type="search" data-sheet-filter-search="${escapeHtml(label)}" placeholder="Search this column">
          <div class="sheet-filter-values" data-sheet-filter-values="${escapeHtml(label)}">
            <label><input type="checkbox" data-sheet-filter-all="${escapeHtml(label)}" ${checkedAll ? "checked" : ""}> Select all visible</label>
            ${visibleValues.map((value) => {
              const checked = !active || selected.has(value);
              const display = value || "(Blanks)";
              return `<label data-sheet-filter-value-row="${escapeHtml(label)}"><input type="checkbox" data-sheet-filter-value="${escapeHtml(label)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""}> ${escapeHtml(display)}</label>`;
            }).join("")}
          </div>
          ${values.length > visibleValues.length ? `<div class="sheet-filter-note">Showing first ${visibleValues.length.toLocaleString()} of ${values.length.toLocaleString()} values. Use search to narrow.</div>` : ""}
          <div class="sheet-filter-actions">
            <button type="button" data-sheet-apply-filter="${escapeHtml(label)}">Apply</button>
            <button type="button" data-sheet-close-filter>Close</button>
          </div>
        </div>
      </details>
      <button class="sheet-column-resizer" type="button" data-sheet-resize-column="${escapeHtml(label)}" title="Drag to resize ${escapeHtml(label)} column" aria-label="Resize ${escapeHtml(label)} column"></button>
    </th>
  `;
}

function sheetFilterToolbarHtml(rows) {
  return `
    <div class="sheet-filter-toolbar">
      <div>
        <strong>${rows.length.toLocaleString()}</strong>
        <span>active row${rows.length === 1 ? "" : "s"} shown</span>
      </div>
      <label>
        Saved filter
        <select id="sheetSavedFilterSelect">
          <option value="">Choose saved filter</option>
          ${sheetSavedFilters.map((filter) => `<option value="${escapeHtml(filter.name)}">${escapeHtml(filter.name)}</option>`).join("")}
        </select>
      </label>
      <button type="button" id="sheetSaveFilter">Save current filter</button>
      <button type="button" id="sheetClearFilters" ${sheetAnyFilterActive() ? "" : "disabled"}>Clear filters</button>
    </div>
  `;
}

function sheetExportRows() {
  return sheetTickets().map((ticket) => ({
    ticket,
    values: SHEET_COLUMNS.map((column) => sheetExportCell(ticket, column)),
  }));
}

function exportFileName(extension) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `dig-tickets-${stamp}.${extension}`;
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportSheetCsv() {
  const rows = sheetExportRows();
  const header = SHEET_COLUMNS.map(([label]) => csvCell(label)).join(",");
  const body = rows.map((row) => row.values.map(csvCell).join(",")).join("\n");
  downloadTextFile(exportFileName("csv"), `\ufeff${header}\n${body}\n`, "text/csv;charset=utf-8");
}

function sheetExportRowStyle(ticket) {
  if (ticketIsTcwDmiWork(ticket)) return "background:#fff0e6;border-left:5px solid #ff6a00;";
  if (ticketIsEmergency(ticket)) return "background:#ffe5ea;border-left:4px solid #ff0033;";
  if (ticketIsRemark(ticket)) return "background:#f3e8ff;border-left:4px solid #a855f7;";
  if (ticketIsRenewal(ticket)) return "background:#e5f7ff;border-left:4px solid #38bdf8;";
  return "";
}

function exportTableHtml() {
  const header = SHEET_COLUMNS.map(([label]) => `<th>${escapeHtml(label)}</th>`).join("");
  const rows = sheetExportRows().map((row) => {
    const cells = row.values.map((value) => `<td>${escapeHtml(value)}</td>`).join("");
    return `<tr style="${sheetExportRowStyle(row.ticket)}">${cells}</tr>`;
  }).join("");
  return `
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${SHEET_COLUMNS.length}">No active tickets found.</td></tr>`}</tbody>
    </table>
  `;
}

function exportSheetExcel() {
  const html = `<!doctype html>
    <html>
      <head><meta charset="utf-8"></head>
      <body>${exportTableHtml()}</body>
    </html>`;
  downloadTextFile(exportFileName("xls"), html, "application/vnd.ms-excel;charset=utf-8");
}

function exportSheetPdf() {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.alert("Allow popups for this dashboard so the PDF export window can open.");
    return;
  }
  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Dig Tickets Export</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color: #17202b; margin: 18px; }
          h1 { margin: 0 0 8px; font-size: 20px; }
          p { margin: 0 0 14px; color: #526173; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #c7d0db; padding: 5px 6px; text-align: left; vertical-align: top; }
          th { background: #e8edf3; }
          @page { size: landscape; margin: 0.35in; }
        </style>
      </head>
      <body>
        <h1>Dig Tickets</h1>
        <p>Exported ${escapeHtml(formatDashboardDateTime(new Date()))}</p>
        ${exportTableHtml()}
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

const HISTORY_DIG_TICKET_URL = "/data/history/to_date_dig_tickets_history.json";
const HISTORY_DIG_TICKET_XLSX_URL = "/data/history/to.date.dig.tickets.history.xlsx";
const HISTORY_DIG_TICKET_LIMIT = 500;
const HISTORY_COLUMNS = [
  "Action",
  "Remark",
  "Marked By",
  "Comment",
  "811 Ticket #",
  "Due Date",
  "Latitude & Longitude",
  "Work Address",
  "Work Area",
  "Done For",
  "Excavator Name",
  "Location Information",
  "Excavator Phone",
  "Extent",
  "Work County",
  "Work Type",
  "WorkPriority",
];

async function loadHistoricalDigTickets() {
  if (historicalDigTickets || historicalDigTicketError) return;
  try {
    const response = await fetch(HISTORY_DIG_TICKET_URL);
    if (!response.ok) throw new Error(`History file failed to load: ${response.status}`);
    historicalDigTickets = await response.json();
  } catch (error) {
    historicalDigTicketError = error instanceof Error ? error.message : String(error);
  }
}

function historyCell(record, column) {
  return String(record?.[column] ?? "");
}

function matchingHistoricalRows() {
  const rows = Array.isArray(historicalDigTickets?.rows) ? historicalDigTickets.rows : [];
  const query = historicalDigTicketSearch.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((record) => HISTORY_COLUMNS.some((column) => historyCell(record, column).toLowerCase().includes(query)));
}

function renderHistoricalDigTickets() {
  if (historicalDigTicketError) {
    return `<section class="history-panel"><h3>Historical Dig Tickets</h3><p class="sheet-muted">${escapeHtml(historicalDigTicketError)}</p></section>`;
  }
  if (!historicalDigTickets) {
    return '<section class="history-panel"><h3>Historical Dig Tickets</h3><p class="sheet-muted">Loading history...</p></section>';
  }
  const rows = matchingHistoricalRows();
  const hasSearch = historicalDigTicketSearch.trim().length > 0;
  const visibleRows = hasSearch ? rows : rows.slice(0, HISTORY_DIG_TICKET_LIMIT);
  const head = HISTORY_COLUMNS.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = visibleRows
    .map((record) => {
      const priorityClass = historicalRecordIsTcwDmiWork(record) ? " history-row-tcw-dmi-work ticket-tcw-dmi-work" : "";
      const cells = HISTORY_COLUMNS.map((column) => `<td><div class="sheet-cell-content">${escapeHtml(historyCell(record, column))}</div></td>`).join("");
      return `<tr class="history-row${priorityClass}">${cells}</tr>`;
    })
    .join("");
  return `
    <section class="history-panel">
      <div class="history-panel-head">
        <div>
          <h3>Historical Dig Tickets</h3>
          <p>${rows.length.toLocaleString()} matching of ${(historicalDigTickets.rows || []).length.toLocaleString()} imported from ${escapeHtml(historicalDigTickets.sourceFile || "Excel history")}</p>
        </div>
        <a class="history-download" href="${HISTORY_DIG_TICKET_XLSX_URL}" target="_blank" rel="noreferrer">Open Excel</a>
      </div>
      <div class="history-tools">
        <input id="historySearch" type="search" value="${escapeHtml(historicalDigTicketSearch)}" placeholder="Search historical ticket, address, county, excavator">
        <span>Showing ${visibleRows.length.toLocaleString()} rows${!hasSearch && rows.length > HISTORY_DIG_TICKET_LIMIT ? ` of ${rows.length.toLocaleString()}` : ""}</span>
      </div>
      <table class="sheet-table history-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body || `<tr><td colspan="${HISTORY_COLUMNS.length}">No historical records match that search.</td></tr>`}</tbody>
      </table>
    </section>
  `;
}

function sheetTickets() {
  return sheetColumnFilteredTickets()
    .slice()
    .sort(compareSheetTickets);
}

function renderSheetView() {
  if (!elements.sheetTableWrap) return;
  const rows = sheetTickets();
  if (elements.sheetFilterToolbar) elements.sheetFilterToolbar.innerHTML = sheetFilterToolbarHtml(rows);
  const head = SHEET_COLUMNS.map(([label]) => sheetHeaderHtml(label)).join("");
  const body = rows
    .map((ticket) => {
      const dueStatus = ticketDueStatus(ticket);
      const ticketNumber = String(ticket.ticket_number || "");
      const expanded = sheetExpandedTickets.has(ticketNumber);
      const actionClass = ticketHasActions(ticketNumber) ? " sheet-row-actioned" : "";
      const priorityClasses = ticketPriorityClasses(ticket);
      const expandedClass = expanded ? " sheet-row-expanded" : " sheet-row-collapsed";
      const cells = SHEET_COLUMNS.map(([, getter, mode]) => {
        const value = getter(ticket, expanded) || "";
        return `<td><div class="sheet-cell-content">${mode === "html" ? value : escapeHtml(value)}</div></td>`;
      }).join("");
      return `<tr class="sheet-row sheet-row-${escapeHtml(dueStatus)} ${escapeHtml(priorityClasses)}${actionClass}${expandedClass}" data-sheet-ticket="${escapeHtml(ticketNumber)}" tabindex="0">${cells}</tr>`;
    })
    .join("");
  elements.sheetTableWrap.innerHTML = `
    <table class="sheet-table" style="width:${sheetTableWidth()}px; min-width:${sheetTableWidth()}px">
      ${sheetColgroupHtml()}
      <thead><tr>${head}</tr></thead>
      <tbody>${body || `<tr><td colspan="${SHEET_COLUMNS.length}">No active tickets found.</td></tr>`}</tbody>
    </table>
    ${renderHistoricalDigTickets()}
  `;
  bindSheetHorizontalScroller();
  syncSheetHorizontalScroller();
  bindSheetFilterControls();
  const historySearch = elements.sheetTableWrap.querySelector("#historySearch");
  if (historySearch) {
    historySearch.addEventListener("input", () => {
      historicalDigTicketSearch = historySearch.value;
      if (elements.sheetSearch && elements.sheetSearch.value !== historicalDigTicketSearch) elements.sheetSearch.value = historicalDigTicketSearch;
      window.clearTimeout(historySearch._historyTimer);
      historySearch._historyTimer = window.setTimeout(renderSheetView, 180);
    });
  }
  for (const row of elements.sheetTableWrap.querySelectorAll("[data-sheet-ticket]")) {
    row.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, button, a, label")) return;
      const ticketNumber = row.dataset.sheetTicket || "";
      if (!ticketNumber) return;
      if (sheetExpandedTickets.has(ticketNumber)) {
        sheetExpandedTickets.delete(ticketNumber);
      } else {
        sheetExpandedTickets.add(ticketNumber);
      }
      renderSheetView();
    });
    row.addEventListener("focusin", () => {
      const ticketNumber = row.dataset.sheetTicket || "";
      if (ticketNumber && !sheetExpandedTickets.has(ticketNumber)) {
        sheetExpandedTickets.add(ticketNumber);
        renderSheetView();
      }
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, button, a, label")) return;
      event.preventDefault();
      const ticketNumber = row.dataset.sheetTicket || "";
      if (!ticketNumber) return;
      if (sheetExpandedTickets.has(ticketNumber)) sheetExpandedTickets.delete(ticketNumber);
      else sheetExpandedTickets.add(ticketNumber);
      renderSheetView();
    });
  }
  bindTicketActionControls(elements.sheetTableWrap);
  bindSheetColumnResizers();
  for (const select of elements.sheetTableWrap.querySelectorAll("[data-ticket-priority]")) {
    select.addEventListener("change", () => {
      setTicketPriority(select.dataset.ticketPriority, select.value);
    });
  }
  for (const input of elements.sheetTableWrap.querySelectorAll("[data-ticket-description]")) {
    input.addEventListener("change", () => {
      rememberUndoState();
      setTicketDescription(input.dataset.ticketDescription, input.value);
    });
  }
}

function bindSheetColumnResizers() {
  if (!elements.sheetTableWrap) return;
  const startResize = (event, handle, moveEventName, endEventName) => {
    event.preventDefault();
    event.stopPropagation();
    const label = handle.dataset.sheetResizeColumn || "";
    if (!label) return;
    const startX = event.clientX;
    const startWidth = sheetColumnWidth(label);
    document.body.classList.add("sheet-column-resizing");
    const move = (moveEvent) => {
      const nextWidth = Math.max(70, Math.min(720, Math.round(startWidth + moveEvent.clientX - startX)));
      sheetColumnWidths[label] = nextWidth;
      const table = elements.sheetTableWrap.querySelector(".sheet-table");
      const columnIndex = SHEET_COLUMNS.findIndex(([columnLabel]) => columnLabel === label);
      const col = table?.querySelectorAll("col")?.[columnIndex];
      const th = [...(table?.querySelectorAll("[data-sheet-column]") || [])].find((cell) => cell.dataset.sheetColumn === label);
      if (col) col.style.width = `${nextWidth}px`;
      if (th) th.style.width = `${nextWidth}px`;
      if (table) {
        const width = sheetTableWidth();
        table.style.width = `${width}px`;
        table.style.minWidth = `${width}px`;
      }
      syncSheetHorizontalScroller();
    };
    const finish = () => {
      document.removeEventListener(moveEventName, move);
      document.removeEventListener(endEventName, finish);
      document.body.classList.remove("sheet-column-resizing");
      saveSheetColumnWidths();
    };
    document.addEventListener(moveEventName, move);
    document.addEventListener(endEventName, finish, { once: true });
  };
  for (const handle of elements.sheetTableWrap.querySelectorAll("[data-sheet-resize-column]")) {
    handle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener("pointerdown", (event) => {
      handle.setPointerCapture?.(event.pointerId);
      startResize(event, handle, "pointermove", "pointerup");
    });
    handle.addEventListener("mousedown", (event) => {
      if (window.PointerEvent) return;
      startResize(event, handle, "mousemove", "mouseup");
    });
  }
}

async function loadRestorationJobs() {
  const response = await fetch("/api/restoration-jobs");
  if (!response.ok) throw new Error(`Restoration jobs failed to load: ${response.status}`);
  const payload = await response.json();
  restorationJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  restorationCanManage = Boolean(payload.canManage);
  document.body.classList.toggle("restoration-can-manage", restorationCanManage);
  return restorationJobs;
}

function restorationJobSearchText(job) {
  return [
    job.id,
    job.ticket,
    job.title,
    job.location,
    job.entity,
    job.priority,
    job.status,
    job.assigned_to,
    job.created_by,
    job.completed_by,
  ].join(" ").toLowerCase();
}

function filteredRestorationJobs() {
  const query = restorationSearch.trim().toLowerCase();
  const jobs = query ? restorationJobs.filter((job) => restorationJobSearchText(job).includes(query)) : restorationJobs;
  return jobs
    .filter((job) => !restorationPriorityFilter || job.priority === restorationPriorityFilter)
    .filter((job) => !restorationStatusFilter || job.status === restorationStatusFilter)
    .slice()
    .sort((a, b) => {
    const priorityOrder = { emergency: 0, high: 1, medium: 2, low: 3 };
    const ap = priorityOrder[a.priority] ?? 4;
    const bp = priorityOrder[b.priority] ?? 4;
    if (ap !== bp) return ap - bp;
    const ad = String(a.scheduled_for || "9999");
    const bd = String(b.scheduled_for || "9999");
    if (ad !== bd) return ad.localeCompare(bd);
    return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""));
  });
}

function selectedRestorationJob() {
  return restorationJobs.find((job) => job.id === selectedRestorationJobId) || null;
}

function fillRestorationForm(job = {}) {
  selectedRestorationJobId = job.id || "";
  if (elements.restorationJobId) elements.restorationJobId.value = job.id || "";
  if (elements.restorationTitle) elements.restorationTitle.value = job.title || "";
  if (elements.restorationTicket) elements.restorationTicket.value = job.ticket || "";
  if (elements.restorationLocation) elements.restorationLocation.value = job.location || "";
  if (elements.restorationEntity) elements.restorationEntity.value = job.entity || "";
  if (elements.restorationLat) elements.restorationLat.value = job.lat ?? "";
  if (elements.restorationLng) elements.restorationLng.value = job.lng ?? "";
  if (elements.restorationPriority) elements.restorationPriority.value = job.priority || "medium";
  if (elements.restorationStatus) elements.restorationStatus.value = job.status || "open";
  if (elements.restorationScheduled) elements.restorationScheduled.value = String(job.scheduled_for || "").slice(0, 16);
  if (elements.restorationAssigned) elements.restorationAssigned.value = job.assigned_to || "";
  if (elements.restorationNotes) elements.restorationNotes.value = job.notes || "";
  if (elements.restorationFormStatus) elements.restorationFormStatus.textContent = job.id ? `Editing ${job.id}` : "New restoration job";
}

function openRestorationForm(job = {}) {
  fillRestorationForm(job);
  if (elements.restorationModal) elements.restorationModal.hidden = false;
}

function closeRestorationForm() {
  if (elements.restorationModal) elements.restorationModal.hidden = true;
}

function restorationFormPayload() {
  return {
    id: elements.restorationJobId?.value || "",
    title: elements.restorationTitle?.value || "",
    ticket: elements.restorationTicket?.value || "",
    location: elements.restorationLocation?.value || "",
    entity: elements.restorationEntity?.value || "",
    lat: elements.restorationLat?.value || "",
    lng: elements.restorationLng?.value || "",
    priority: elements.restorationPriority?.value || "medium",
    status: elements.restorationStatus?.value || "open",
    scheduled_for: elements.restorationScheduled?.value || "",
    assigned_to: elements.restorationAssigned?.value || "",
    notes: elements.restorationNotes?.value || "",
  };
}

async function saveRestorationJob(event) {
  event?.preventDefault();
  if (elements.restorationFormStatus) elements.restorationFormStatus.textContent = "Saving...";
  const response = await fetch("/api/restoration-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(restorationFormPayload()),
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.message || `Save failed: ${response.status}`);
  await loadRestorationJobs();
  fillRestorationForm(payload.job || {});
  closeRestorationForm();
  renderRestorationView();
  if (elements.restorationFormStatus) elements.restorationFormStatus.textContent = "Restoration job saved";
}

function restorationAttachmentListHtml(job) {
  const items = Array.isArray(job.attachments) ? job.attachments : [];
  if (!items.length) return '<span class="sheet-muted">No photos</span>';
  const folder = job.folder_url;
  return `
    ${folder ? `<a href="${escapeHtml(folder)}" target="_blank" rel="noreferrer">Open OneDrive folder</a>` : ""}
    <span>${items.length} photo${items.length === 1 ? "" : "s"}</span>
  `;
}

function restorationJobsTableHtml(jobs) {
  const grouped = new Map();
  for (const job of jobs) {
    const key = job.priority || "medium";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(job);
  }
  const rows = ["emergency", "high", "medium", "low"].map((priority) => {
    const items = grouped.get(priority) || [];
    if (!items.length) return "";
    return `
      <tbody class="ops-priority-group">
        <tr class="ops-group-row"><th colspan="7">${escapeHtml(priorityLabel(priority))} priority <span>${items.length} job${items.length === 1 ? "" : "s"}</span></th></tr>
        ${items.map((job) => restorationJobRowHtml(job)).join("")}
      </tbody>
    `;
  }).join("");
  return `
    <table class="sheet-table restoration-table">
      <thead>
        <tr><th>Job</th><th>Due</th><th>Location</th><th>Priority</th><th>Status</th><th>Photos</th><th>Upload</th></tr>
      </thead>
      ${rows || '<tbody><tr><td colspan="7">No restoration jobs found.</td></tr></tbody>'}
    </table>
  `;
}

function priorityLabel(priority) {
  const text = String(priority || "medium");
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, " ");
}

function statusLabel(status) {
  const text = String(status || "open").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function restorationJobRowHtml(job) {
  return `
    <tr class="restoration-row restoration-priority-${escapeHtml(job.priority || "medium")} ${job.id === selectedRestorationJobId ? "selected" : ""}" data-restoration-job="${escapeHtml(job.id)}">
      <td><strong>${escapeHtml(job.id)}</strong><span>${escapeHtml(job.ticket || job.title || "")}</span></td>
      <td>${escapeHtml(String(job.scheduled_for || "").replace("T", " ")) || '<span class="sheet-muted">No due date</span>'}</td>
      <td>${escapeHtml(job.location || job.entity || "")}<small>${escapeHtml(job.assigned_to || job.created_by || "")}</small></td>
      <td><span class="sheet-priority-pill priority-${escapeHtml(job.priority || "medium")}">${escapeHtml(priorityLabel(job.priority))}</span></td>
      <td>${escapeHtml(statusLabel(job.status))}</td>
      <td class="restoration-photo-cell">${restorationAttachmentListHtml(job)}</td>
      <td class="ops-upload-cell">
        <input type="file" multiple accept="image/*,video/*" data-restoration-file-input="${escapeHtml(job.id)}">
        <select data-restoration-upload-status="${escapeHtml(job.id)}">
          <option value="submitted">Submitted</option>
          <option value="completed">Completed</option>
        </select>
        <button type="button" data-restoration-upload="${escapeHtml(job.id)}">Upload</button>
      </td>
    </tr>
  `;
}

function restorationDetailHtml(job) {
  if (!job) return '<div class="live-ticket-empty">Select a restoration job</div>';
  return `
    <header>
      <h3>${escapeHtml(job.title || job.id)}</h3>
      <span class="sheet-priority-pill priority-${escapeHtml(job.priority || "medium")}">${escapeHtml(priorityLabel(job.priority))}</span>
    </header>
    <dl>
      <dt>Job</dt><dd>${escapeHtml(job.id)}</dd>
      <dt>Ticket</dt><dd>${escapeHtml(job.ticket || "None")}</dd>
      <dt>Due</dt><dd>${escapeHtml(String(job.scheduled_for || "").replace("T", " ") || "Not scheduled")}</dd>
      <dt>Status</dt><dd>${escapeHtml(statusLabel(job.status))}</dd>
      <dt>Assigned</dt><dd>${escapeHtml(job.assigned_to || "Unassigned")}</dd>
      <dt>Location</dt><dd>${escapeHtml(job.location || job.entity || "No location")}</dd>
      <dt>Notes</dt><dd>${escapeHtml(job.notes || "No notes")}</dd>
      <dt>Photos</dt><dd>${restorationAttachmentListHtml(job)}</dd>
    </dl>
    <button type="button" data-edit-restoration="${escapeHtml(job.id)}">Edit restoration ticket</button>
  `;
}

function ensureRestorationMap() {
  if (!elements.restorationMap || restorationMap || typeof L === "undefined") return;
  restorationMap = L.map(elements.restorationMap, { zoomControl: true }).setView([33.21, -92.66], 11);
  const restorationTile = MAP_TILE_STYLES[mapStyle]?.url ? MAP_TILE_STYLES[mapStyle] : MAP_TILE_STYLES.standard;
  L.tileLayer(restorationTile.url, {
    maxZoom: 20,
    attribution: restorationTile.attribution || MAP_TILE_STYLES.standard.attribution,
    ...(restorationTile.subdomains ? { subdomains: restorationTile.subdomains } : {}),
  }).addTo(restorationMap);
  restorationMap.on("click", (event) => {
    if (elements.restorationLat) elements.restorationLat.value = event.latlng.lat.toFixed(6);
    if (elements.restorationLng) elements.restorationLng.value = event.latlng.lng.toFixed(6);
    if (elements.restorationFormStatus) elements.restorationFormStatus.textContent = "Map point selected";
  });
}

function renderRestorationMap(jobs) {
  ensureRestorationMap();
  if (!restorationMap) return;
  if (restorationMapMarkers) restorationMap.removeLayer(restorationMapMarkers);
  if (restorationMapVetroLayer) {
    restorationMap.removeLayer(restorationMapVetroLayer);
    restorationMapVetroLayer = null;
  }
  restorationMapMarkers = L.layerGroup().addTo(restorationMap);
  const bounds = [];
  for (const job of jobs) {
    const ticket = tickets.find((item) => item.ticket_number === job.ticket);
    if (ticket?.polygon) {
      const polygon = L.geoJSON(ticket.polygon, { style: { color: "#2563eb", weight: 2, fillOpacity: 0.08 } }).addTo(restorationMapMarkers);
      const polygonBounds = polygon.getBounds();
      if (polygonBounds?.isValid?.()) {
        bounds.push([polygonBounds.getSouth(), polygonBounds.getWest()]);
        bounds.push([polygonBounds.getNorth(), polygonBounds.getEast()]);
      }
    }
    const lat = Number(job.lat ?? ticket?.latitude);
    const lng = Number(job.lng ?? ticket?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const marker = L.circleMarker([lat, lng], {
      radius: job.priority === "emergency" ? 9 : 7,
      color: job.priority === "emergency" ? "#dc2626" : job.priority === "high" ? "#d97706" : "#2563eb",
      fillColor: job.priority === "low" ? "#2f855a" : job.priority === "medium" ? "#2563eb" : job.priority === "high" ? "#d97706" : "#dc2626",
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(restorationMapMarkers);
    marker.bindPopup(`<strong>${escapeHtml(job.title || job.id)}</strong><br>${escapeHtml(job.ticket || job.location || "")}<br>${escapeHtml(job.status || "")}`);
    marker.on("click", () => {
      fillRestorationForm(job);
      renderRestorationView();
    });
    bounds.push([lat, lng]);
  }
  if (!vetroGeojson) {
    void ensureVetroLoaded().then(() => {
      if (currentView === "restoration") renderRestorationMap(filteredRestorationJobs());
    }).catch((error) => console.warn(error));
  } else {
    const filtered = filteredVetroGeojson();
    if (filtered) {
      restorationMapVetroLayer = L.geoJSON(filtered, {
        style: vetroStyle,
        pointToLayer: vetroPointToLayer,
        onEachFeature: bindVetroPopup,
      }).addTo(restorationMap);
    }
  }
  requestAnimationFrame(() => {
    restorationMap.invalidateSize();
    if (bounds.length) restorationMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  });
}

async function uploadRestorationPhotos(jobId) {
  const input = [...(elements.restorationJobsTable?.querySelectorAll("[data-restoration-file-input]") || [])].find((item) => item.dataset.restorationFileInput === jobId);
  const status = [...(elements.restorationJobsTable?.querySelectorAll("[data-restoration-upload-status]") || [])].find((item) => item.dataset.restorationUploadStatus === jobId);
  const files = [...(input?.files || [])];
  if (!files.length) return;
  if (files.length > 80) throw new Error("Select 80 attachments or fewer.");
  const data = new FormData();
  data.set("job_id", jobId);
  data.set("status", status?.value || "submitted");
  for (const file of files) data.append("files", file, file.name);
  const response = await fetch("/api/restoration-jobs/upload", { method: "POST", body: data });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.message || `Upload failed: ${response.status}`);
  await loadRestorationJobs();
  fillRestorationForm(payload.job || selectedRestorationJob() || {});
  renderRestorationView();
}

function renderRestorationView() {
  if (!elements.restorationView) return;
  document.body.classList.toggle("restoration-can-manage", restorationCanManage);
  for (const control of elements.restorationView.querySelectorAll(".restoration-admin-only input, .restoration-admin-only select")) {
    control.disabled = !restorationCanManage;
  }
  const jobs = filteredRestorationJobs();
  if (!selectedRestorationJobId && jobs.length) selectedRestorationJobId = jobs[0].id;
  if (elements.restorationJobsTable) {
    elements.restorationJobsTable.innerHTML = restorationJobsTableHtml(jobs);
    for (const row of elements.restorationJobsTable.querySelectorAll("[data-restoration-job]")) {
      row.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement && event.target.closest("input, select, button, a")) return;
        const job = restorationJobs.find((item) => item.id === row.dataset.restorationJob);
        if (job) selectedRestorationJobId = job.id;
        renderRestorationView();
      });
    }
    for (const button of elements.restorationJobsTable.querySelectorAll("[data-restoration-upload]")) {
      button.addEventListener("click", async () => {
        try {
          button.disabled = true;
          await uploadRestorationPhotos(button.dataset.restorationUpload);
        } catch (error) {
          if (elements.restorationFormStatus) elements.restorationFormStatus.textContent = error.message || "Upload failed.";
          console.error(error);
        } finally {
          button.disabled = false;
        }
      });
    }
  }
  if (elements.restorationDetail) {
    elements.restorationDetail.innerHTML = restorationDetailHtml(selectedRestorationJob());
    const edit = elements.restorationDetail.querySelector("[data-edit-restoration]");
    if (edit) edit.addEventListener("click", () => openRestorationForm(selectedRestorationJob() || {}));
  }
  renderRestorationMap(jobs);
}

async function loadInHouseRequests() {
  const response = await fetch("/api/in-house-requests");
  if (!response.ok) throw new Error(`In-house requests failed to load: ${response.status}`);
  const payload = await response.json();
  inHouseRequests = Array.isArray(payload.requests) ? payload.requests : [];
  return inHouseRequests;
}

function inHouseRequestSearchLabel() {
  const value = [
    elements.inHouseAddress?.value,
    elements.inHousePlace?.value,
    elements.inHouseCounty?.value,
  ].filter(Boolean).join(", ").trim();
  if (!value) return "";
  return /\b(arkansas|ar|usa|united states)\b/i.test(value) ? value : `${value}, Arkansas, USA`;
}

function inHouseCoordinatesFromForm() {
  const lat = Number(elements.inHouseLat?.value);
  const lng = Number(elements.inHouseLng?.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng };
}

function ensureInHouseMap() {
  if (!elements.inHouseMap || inHouseMap || typeof L === "undefined") return;
  inHouseMap = L.map(elements.inHouseMap, { zoomControl: true }).setView([33.21, -92.66], 12);
  void renderInHouseBaseLayer();
  inHouseMap.on("click", (event) => {
    setInHouseMapPoint(event.latlng.lat, event.latlng.lng, "Map point selected", { pan: false });
  });
}

async function renderInHouseBaseLayer() {
  if (!inHouseMap) return;
  const priorLayer = inHouseBaseTileLayer;
  let nextLayer = null;
  const tile = MAP_TILE_STYLES[mapStyle] || MAP_TILE_STYLES["locator-dark-detail"] || MAP_TILE_STYLES.standard;
  try {
    if (tile.provider === "maplibre") {
      nextLayer = await maplibreTileLayer(tile);
    } else if (tile.provider === "mapbox") {
      nextLayer = mapboxTileLayer(tile);
    } else if (Array.isArray(tile.layers)) {
      nextLayer = L.layerGroup(
        tile.layers.map((item) => L.tileLayer(item.url, {
          maxZoom: 20,
          attribution: item.attribution || tile.attribution,
          opacity: mapOpacity,
          ...(item.subdomains ? { subdomains: item.subdomains } : {}),
        })),
      );
    } else {
      nextLayer = L.tileLayer(tile.url, {
        maxZoom: 20,
        attribution: tile.attribution,
        opacity: mapOpacity,
        ...(tile.subdomains ? { subdomains: tile.subdomains } : {}),
      });
    }
  } catch (error) {
    console.warn("In-house map base style fallback", error);
    nextLayer = L.tileLayer(MAP_TILE_STYLES.contrast.url, {
      maxZoom: 20,
      attribution: MAP_TILE_STYLES.contrast.attribution,
      opacity: mapOpacity,
      subdomains: MAP_TILE_STYLES.contrast.subdomains,
    });
  }
  if (priorLayer && inHouseMap.hasLayer(priorLayer)) inHouseMap.removeLayer(priorLayer);
  inHouseBaseTileLayer = nextLayer.addTo(inHouseMap);
  bringBaseLayerToBack(inHouseBaseTileLayer);
  renderInHouseVetroLayer();
}

function renderInHouseVetroLayer() {
  if (!inHouseMap) return;
  if (inHouseMapVetroLayer) {
    inHouseMap.removeLayer(inHouseMapVetroLayer);
    inHouseMapVetroLayer = null;
  }
  if (!elements.vetroToggle?.checked || !vetroGeojson) return;
  const filtered = filteredVetroGeojson();
  const features = Array.isArray(filtered?.features) ? filtered.features : [];
  if (!features.length) return;
  inHouseMapVetroLayer = L.geoJSON(filtered, {
    style: vetroStyle,
    pointToLayer: vetroPointToLayer,
    onEachFeature: bindVetroPopup,
  }).addTo(inHouseMap);
}

function setInHouseMapPoint(latitude, longitude, label = "Selected point", options = {}) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (elements.inHouseLat) elements.inHouseLat.value = lat.toFixed(6);
  if (elements.inHouseLng) elements.inHouseLng.value = lng.toFixed(6);
  ensureInHouseMap();
  if (inHouseMap) {
    const latlng = [lat, lng];
    if (!inHouseMapMarker) {
      inHouseMapMarker = L.marker(latlng, { draggable: true }).addTo(inHouseMap);
      inHouseMapMarker.on("dragend", () => {
        const point = inHouseMapMarker.getLatLng();
        setInHouseMapPoint(point.lat, point.lng, "Marker moved", { pan: false });
      });
    } else {
      inHouseMapMarker.setLatLng(latlng);
    }
    if (options.pan !== false) inHouseMap.flyTo(latlng, Math.max(inHouseMap.getZoom(), 17), { duration: 0.35 });
    inHouseMapMarker.bindPopup(`<strong>${escapeHtml(label)}</strong><br>${lat.toFixed(6)}, ${lng.toFixed(6)}`).openPopup();
  }
  if (elements.inHouseMapStatus) elements.inHouseMapStatus.textContent = `${label}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function clearInHouseMapSelection() {
  if (inHouseMapMarker && inHouseMap) {
    inHouseMap.removeLayer(inHouseMapMarker);
    inHouseMapMarker = null;
  }
  if (elements.inHouseMapStatus) elements.inHouseMapStatus.textContent = "Type an address or click the map.";
}

function syncInHouseMapFromCoordinates() {
  const coordinates = inHouseCoordinatesFromForm();
  if (!coordinates) return false;
  setInHouseMapPoint(coordinates.latitude, coordinates.longitude, "Coordinates selected");
  return true;
}

function scheduleInHouseMapSearch(options = {}) {
  window.clearTimeout(inHouseMapSearchTimer);
  if (!options.forceAddress && syncInHouseMapFromCoordinates()) return;
  const query = inHouseRequestSearchLabel();
  if (!query || query.length < 4) {
    if (elements.inHouseMapStatus) elements.inHouseMapStatus.textContent = "Type an address or click the map.";
    return;
  }
  const token = ++inHouseMapSearchToken;
  if (elements.inHouseMapStatus) elements.inHouseMapStatus.textContent = "Searching map...";
  inHouseMapSearchTimer = window.setTimeout(async () => {
    try {
      const response = await fetch(`/api/map-search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`Map search failed: ${response.status}`);
      const payload = await response.json();
      if (token !== inHouseMapSearchToken) return;
      if (!payload.ok) {
        if (elements.inHouseMapStatus) elements.inHouseMapStatus.textContent = payload.message || "No map result found.";
        return;
      }
      setInHouseMapPoint(Number(payload.latitude), Number(payload.longitude), payload.name || query);
    } catch (error) {
      if (token === inHouseMapSearchToken && elements.inHouseMapStatus) elements.inHouseMapStatus.textContent = error.message || "Map search failed.";
      console.error(error);
    }
  }, 450);
}

function fillInHouseForm(item = {}) {
  selectedInHouseRequestId = item.id || "";
  if (elements.inHouseId) elements.inHouseId.value = item.id || "";
  if (elements.inHouseTitle) elements.inHouseTitle.value = item.title || "";
  if (elements.inHouseRequestor) elements.inHouseRequestor.value = item.requestor || "";
  if (elements.inHouseContactPhone) elements.inHouseContactPhone.value = item.contact_phone || "";
  if (elements.inHouseCrew) elements.inHouseCrew.value = item.crew || "";
  if (elements.inHouseProject) elements.inHouseProject.value = item.project || "";
  if (elements.inHouseAddress) elements.inHouseAddress.value = item.address || "";
  if (elements.inHouseCounty) elements.inHouseCounty.value = item.county || "";
  if (elements.inHousePlace) elements.inHousePlace.value = item.place || "";
  if (elements.inHouseLat) elements.inHouseLat.value = item.lat ?? "";
  if (elements.inHouseLng) elements.inHouseLng.value = item.lng ?? "";
  if (elements.inHousePriority) elements.inHousePriority.value = item.priority || "medium";
  if (elements.inHouseStatus) elements.inHouseStatus.value = item.status || "open";
  if (elements.inHouseDue) elements.inHouseDue.value = String(item.due_at || "").slice(0, 16);
  if (elements.inHouseAssigned) elements.inHouseAssigned.value = item.assigned_to || "";
  if (elements.inHouseUtilities) elements.inHouseUtilities.value = item.utilities || "";
  if (elements.inHouseScope) elements.inHouseScope.value = item.scope || "";
  if (elements.inHouseNotes) elements.inHouseNotes.value = item.notes || "";
  if (elements.inHouseFormStatus) elements.inHouseFormStatus.textContent = item.id ? `Editing ${item.id}` : "Ready for a new in-house locate request.";
  if (item.lat != null && item.lng != null) {
    setInHouseMapPoint(item.lat, item.lng, item.address || item.title || item.id || "Saved request");
  } else if (!item.id && !inHouseRequestSearchLabel()) {
    clearInHouseMapSelection();
  } else {
    scheduleInHouseMapSearch();
  }
  renderInHouseRequestsView();
}

function inHouseFormPayload() {
  return {
    id: elements.inHouseId?.value || "",
    title: elements.inHouseTitle?.value || "",
    requestor: elements.inHouseRequestor?.value || "",
    contact_phone: elements.inHouseContactPhone?.value || "",
    crew: elements.inHouseCrew?.value || "",
    project: elements.inHouseProject?.value || "",
    address: elements.inHouseAddress?.value || "",
    county: elements.inHouseCounty?.value || "",
    place: elements.inHousePlace?.value || "",
    lat: elements.inHouseLat?.value || "",
    lng: elements.inHouseLng?.value || "",
    priority: elements.inHousePriority?.value || "medium",
    status: elements.inHouseStatus?.value || "open",
    due_at: elements.inHouseDue?.value || "",
    assigned_to: elements.inHouseAssigned?.value || "",
    utilities: elements.inHouseUtilities?.value || "",
    scope: elements.inHouseScope?.value || "",
    notes: elements.inHouseNotes?.value || "",
  };
}

async function saveInHouseRequest(event) {
  event?.preventDefault();
  if (elements.inHouseFormStatus) elements.inHouseFormStatus.textContent = "Saving...";
  const response = await fetch("/api/in-house-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inHouseFormPayload()),
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.message || `Save failed: ${response.status}`);
  const requestId = payload.request?.id || payload.ticket?.ticket_number || "request";
  await loadInHouseRequests();
  fillInHouseForm(payload.request || {});
  await loadTickets();
  if (elements.inHouseFormStatus) elements.inHouseFormStatus.textContent = `${requestId} saved to the locator dashboard.`;
  showSavedToast("In-house request saved");
}

function inHouseRequestRowHtml(item) {
  return `
    <article class="in-house-request-row ${item.id === selectedInHouseRequestId ? "selected" : ""}">
      <div>
        <strong>${escapeHtml(item.title || item.id)}</strong>
        <p>${escapeHtml(item.address || item.place || "No address")}</p>
        <div class="live-ticket-meta">
          <span>${escapeHtml(item.id)}</span>
          <span>${escapeHtml(priorityLabel(item.priority))}</span>
          <span>${escapeHtml(statusLabel(item.status))}</span>
          <span>${escapeHtml(String(item.due_at || "").replace("T", " ") || "No due date")}</span>
        </div>
      </div>
      <button type="button" data-edit-in-house-request="${escapeHtml(item.id)}">Edit</button>
    </article>
  `;
}

function renderInHouseRequestsView() {
  if (!elements.inHouseRequestList) return;
  const rows = inHouseRequests.slice().sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
  elements.inHouseRequestList.innerHTML = rows.length
    ? rows.map(inHouseRequestRowHtml).join("")
    : '<div class="live-ticket-empty">No in-house requests yet.</div>';
  for (const button of elements.inHouseRequestList.querySelectorAll("[data-edit-in-house-request]")) {
    button.addEventListener("click", () => {
      const item = inHouseRequests.find((request) => request.id === button.dataset.editInHouseRequest);
      if (item) fillInHouseForm(item);
    });
  }
  requestAnimationFrame(() => {
    ensureInHouseMap();
    void renderInHouseBaseLayer();
    if (!vetroGeojson) {
      void ensureVetroLoaded().then(() => {
        if (currentView === "in-house-requests") renderInHouseVetroLayer();
      }).catch((error) => console.warn(error));
    } else {
      renderInHouseVetroLayer();
    }
    if (inHouseMap) inHouseMap.invalidateSize();
    if (!inHouseMapMarker) syncInHouseMapFromCoordinates();
  });
}

function bindSheetFilterControls() {
  if (!elements.sheetTableWrap) return;
  for (const button of elements.sheetTableWrap.querySelectorAll("[data-sheet-sort]")) {
    button.addEventListener("click", () => {
      sheetSort = normalizeSheetSort({
        column: button.dataset.sheetSort,
        direction: button.dataset.sortDirection,
      });
      saveSheetGridState();
      renderSheetView();
    });
  }
  for (const button of elements.sheetTableWrap.querySelectorAll("[data-sheet-clear-column]")) {
    button.addEventListener("click", () => {
      delete sheetColumnFilters[button.dataset.sheetClearColumn];
      saveSheetGridState();
      renderSheetView();
    });
  }
  for (const input of elements.sheetTableWrap.querySelectorAll("[data-sheet-filter-search]")) {
    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      const panel = input.closest(".sheet-filter-panel");
      if (!panel) return;
      for (const row of panel.querySelectorAll("[data-sheet-filter-value-row]")) {
        row.hidden = query && !row.textContent.toLowerCase().includes(query);
      }
    });
  }
  for (const input of elements.sheetTableWrap.querySelectorAll("[data-sheet-filter-all]")) {
    input.addEventListener("change", () => {
      const panel = input.closest(".sheet-filter-panel");
      if (!panel) return;
      for (const checkbox of panel.querySelectorAll("[data-sheet-filter-value]")) {
        const row = checkbox.closest("[data-sheet-filter-value-row]");
        if (row?.hidden) continue;
        checkbox.checked = input.checked;
      }
    });
  }
  for (const button of elements.sheetTableWrap.querySelectorAll("[data-sheet-apply-filter]")) {
    button.addEventListener("click", () => {
      const label = button.dataset.sheetApplyFilter;
      const panel = button.closest(".sheet-filter-panel");
      if (!panel) return;
      const allValues = sheetColumnValues(label);
      const selected = [...panel.querySelectorAll("[data-sheet-filter-value]")]
        .filter((input) => input.checked)
        .map((input) => input.value);
      if (selected.length === allValues.length) delete sheetColumnFilters[label];
      else sheetColumnFilters[label] = selected;
      saveSheetGridState();
      renderSheetView();
    });
  }
  for (const button of elements.sheetTableWrap.querySelectorAll("[data-sheet-close-filter]")) {
    button.addEventListener("click", () => {
      const details = button.closest("details");
      if (details) details.open = false;
    });
  }
  const saveButton = elements.sheetFilterToolbar?.querySelector("#sheetSaveFilter");
  if (saveButton) {
    saveButton.addEventListener("click", () => {
      const name = window.prompt("Saved filter name");
      const cleanName = String(name || "").trim();
      if (!cleanName) return;
      const nextFilter = {
        name: cleanName.slice(0, 60),
        search: ticketSearch,
        sort: normalizeSheetSort(sheetSort),
        columnFilters: normalizeSheetColumnFilters(sheetColumnFilters),
        savedAt: new Date().toISOString(),
      };
      sheetSavedFilters = normalizeSheetSavedFilters([
        ...sheetSavedFilters.filter((filter) => filter.name !== nextFilter.name),
        nextFilter,
      ]);
      saveSheetGridState();
      renderSheetView();
    });
  }
  const savedSelect = elements.sheetFilterToolbar?.querySelector("#sheetSavedFilterSelect");
  if (savedSelect) {
    savedSelect.addEventListener("change", () => {
      const saved = sheetSavedFilters.find((filter) => filter.name === savedSelect.value);
      if (!saved) return;
      ticketSearch = saved.search || "";
      historicalDigTicketSearch = ticketSearch;
      localStorage.setItem("ticketSearch", ticketSearch);
      syncTicketSearchInputs();
      sheetSort = normalizeSheetSort(saved.sort);
      sheetColumnFilters = normalizeSheetColumnFilters(saved.columnFilters);
      saveSheetGridState();
      render();
      renderSheetView();
    });
  }
  const clearButton = elements.sheetFilterToolbar?.querySelector("#sheetClearFilters");
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      ticketSearch = "";
      historicalDigTicketSearch = "";
      localStorage.setItem("ticketSearch", ticketSearch);
      syncTicketSearchInputs();
      sheetColumnFilters = {};
      sheetSort = normalizeSheetSort({ column: "Due Date", direction: "desc" });
      saveSheetGridState();
      render();
      renderSheetView();
    });
  }
}

function bindTicketActionControls(container) {
  for (const uploader of container.querySelectorAll("[data-ticket-upload]")) {
    uploader.addEventListener("click", (event) => event.stopPropagation());
    uploader.addEventListener("keydown", (event) => event.stopPropagation());
  }

  function stagedActionKeys(wrapper) {
    return [...wrapper.querySelectorAll("[data-ticket-action-stage]")]
      .filter((input) => input.checked)
      .map((input) => input.dataset.actionKey);
  }

  function submitStagedActions(wrapper, ticketNumber, selected) {
    rememberUndoState();
    setTicketActions(ticketNumber, selected);
    updateStagedActionStatus(wrapper, false);
    render();
  }

  function updateStagedActionStatus(wrapper, dirty = true) {
    const allInput = wrapper.querySelector("[data-ticket-action-stage-all]");
    const actionInputs = [...wrapper.querySelectorAll("[data-ticket-action-stage]")];
    if (allInput) {
      allInput.checked = actionInputs.length > 0 && actionInputs.every((input) => input.checked);
      allInput.indeterminate = actionInputs.some((input) => input.checked) && !allInput.checked;
    }
    const status = wrapper.querySelector("[data-ticket-action-pending]");
    if (status) {
      const selectedCount = actionInputs.filter((input) => input.checked).length;
      status.textContent = dirty
        ? `${selectedCount} selected. Not submitted yet.`
        : `${selectedCount} submitted.`;
    }
  }

  for (const input of container.querySelectorAll("[data-ticket-action-stage-all]")) {
    input.addEventListener("change", () => {
      const wrapper = input.closest(".ticket-action-checks");
      if (!wrapper) return;
      for (const actionInput of wrapper.querySelectorAll("[data-ticket-action-stage]")) {
        actionInput.checked = input.checked;
      }
      updateStagedActionStatus(wrapper);
    });
  }
  for (const input of container.querySelectorAll("[data-ticket-action-stage]")) {
    input.addEventListener("change", () => {
      const wrapper = input.closest(".ticket-action-checks");
      if (wrapper) updateStagedActionStatus(wrapper);
    });
  }
  for (const button of container.querySelectorAll("[data-ticket-action-submit]")) {
    button.addEventListener("click", async () => {
      const wrapper = button.closest(".ticket-action-checks") || button.closest("[data-sheet-ticket]")?.querySelector(".ticket-action-checks");
      if (!wrapper) return;
      const ticketNumber = button.dataset.ticketActionSubmit;
      const selected = stagedActionKeys(wrapper);
      const uploader = wrapper.querySelector("[data-ticket-upload]");
      const shouldAskForAttachments = selected.some((key) => key !== "clear");
      if (uploader && shouldAskForAttachments && await confirmYesNo(`Do you want to upload attachments to ticket ${ticketNumber} before submitting these actions?`, "Yes", "No")) {
        const fileInput = uploader.querySelector("[data-ticket-file-input]");
        if (fileInput?.files?.length) {
          try {
            await uploadTicketAttachments(ticketNumber, fileInput.files, uploader);
            submitStagedActions(wrapper, ticketNumber, selected);
          } catch (error) {
            window.alert(error.message || "Attachment upload failed.");
          }
        } else if (fileInput) {
          fileInput.dataset.submitAfterUpload = "1";
          fileInput.click();
        }
        return;
      }
      submitStagedActions(wrapper, ticketNumber, selected);
    });
  }

  for (const button of container.querySelectorAll("[data-ticket-file-button]")) {
    button.addEventListener("click", () => {
      const uploader = button.closest("[data-ticket-upload]");
      const input = uploader?.querySelector("[data-ticket-file-input]");
      if (input) input.click();
    });
  }

  for (const input of container.querySelectorAll("[data-ticket-file-input]")) {
    input.addEventListener("change", async () => {
      const uploader = input.closest("[data-ticket-upload]");
      if (!uploader) return;
      const ticketNumber = input.dataset.ticketFileInput;
      const files = [...(input.files || [])];
      const status = uploader.querySelector("[data-ticket-file-status]");
      const uploadButton = uploader.querySelector("[data-ticket-upload-button]");
      if (files.length > 80) {
        input.value = "";
        if (status) status.textContent = "Select 80 attachments or fewer.";
        if (uploadButton) uploadButton.disabled = true;
        window.alert("Select 80 attachments or fewer.");
        return;
      }
      if (status) status.textContent = files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected.` : "Select up to 80 files.";
      if (uploadButton) uploadButton.disabled = files.length === 0;
      if (input.dataset.submitAfterUpload === "1") {
        delete input.dataset.submitAfterUpload;
        if (!files.length) return;
        try {
          await uploadTicketAttachments(ticketNumber, input.files, uploader);
          const wrapper = input.closest(".ticket-action-checks");
          if (wrapper) submitStagedActions(wrapper, ticketNumber, stagedActionKeys(wrapper));
        } catch (error) {
          window.alert(error.message || "Attachment upload failed.");
        }
      }
    });
  }

  for (const button of container.querySelectorAll("[data-ticket-upload-button]")) {
    button.addEventListener("click", async () => {
      const uploader = button.closest("[data-ticket-upload]");
      if (!uploader) return;
      const ticketNumber = button.dataset.ticketUploadButton;
      const input = uploader.querySelector("[data-ticket-file-input]");
      if (!input?.files?.length) return;
      if (!window.confirm(`Upload ${input.files.length} attachment${input.files.length === 1 ? "" : "s"} to ticket ${ticketNumber}?`)) return;
      try {
        await uploadTicketAttachments(ticketNumber, input.files, uploader);
      } catch (error) {
        window.alert(error.message || "Attachment upload failed.");
      }
    });
  }

  for (const input of container.querySelectorAll("[data-ticket-action-all]")) {
    input.addEventListener("change", () => {
      rememberUndoState();
      setAllTicketActions(input.dataset.ticketActionAll, input.checked);
      render();
    });
  }
  for (const input of container.querySelectorAll("[data-ticket-action]")) {
    input.addEventListener("change", () => {
      rememberUndoState();
      setTicketAction(input.dataset.ticketAction, input.dataset.actionKey, input.checked);
      render();
    });
  }
}

function searchable(ticket) {
  return [
    ticket.ticket_number,
    ticket.contractor,
    ticket.caller,
    ticket.contact,
    ticket.done_for,
    ticket.company_name,
    ticket.contact_phone,
    ticket.company_phone,
    ticket.contact_email,
    ticket.place,
    ticket.county,
    ticket.address,
    ticket.street,
    ticket.work_begin_date,
    ticket.work_begin_time,
    ticket.nearest_intersection,
    ticket.location_information,
    ticket.work_type,
    ticket.message_type,
    ticket.raw_text,
    ticket.portal_ticket_id,
  ].join(" ").toLowerCase();
}

function scopedTickets() {
  return dashboardModeTickets();
}

function visibleTickets() {
  const protectedTickets = protectedTicketNumbersFromCheckpoint();
  return matchingTickets().filter(
    (ticket) => !archivedTickets.has(ticket.ticket_number)
      && !ticketIsActionHidden(ticket)
      && ticketShouldShowOnDashboard(ticket)
      && !protectedTickets.has(ticket.ticket_number)
      && (elements.showHiddenToggle.checked || !hiddenTickets.has(ticket.ticket_number)),
  );
}

function fieldOpenTickets() {
  const query = ticketSearch.trim().toLowerCase();
  return scopedTickets().filter((ticket) => {
    if (ticketIsActionHidden(ticket)) return false;
    if (!ticketShouldShowOnDashboard(ticket)) return false;
    if (!countyFilterAll && !selectedCounties.has(ticket.county || "")) return false;
    if (query && !searchable(ticket).includes(query)) return false;
    return true;
  });
}

function matchingTickets() {
  const query = ticketSearch.trim().toLowerCase();
  const protectedTickets = protectedTicketNumbersFromCheckpoint();
  return scopedTickets().filter((ticket) => {
    if (archivedTickets.has(ticket.ticket_number)) return false;
    if (ticketIsActionHidden(ticket)) return false;
    if (!ticketShouldShowOnDashboard(ticket)) return false;
    if (protectedTickets.has(ticket.ticket_number)) return false;
    if (!countyFilterAll && !selectedCounties.has(ticket.county || "")) return false;
    if (query && !searchable(ticket).includes(query)) return false;
    return true;
  });
}

function renderMetrics(list = []) {
  const protectedTickets = protectedTicketNumbersFromCheckpoint();
  const activeTickets = scopedTickets().filter((ticket) => !archivedTickets.has(ticket.ticket_number) && !ticketIsActionHidden(ticket) && ticketShouldShowOnDashboard(ticket) && !protectedTickets.has(ticket.ticket_number));
  const counties = new Set(activeTickets.map((ticket) => ticket.county).filter(Boolean));
  const activeCount = activeTickets.filter((ticket) => !hiddenTickets.has(ticket.ticket_number)).length;
  elements.totalCount.textContent = String(activeCount);
  elements.countyCount.textContent = String(counties.size);
  elements.dueCount.textContent = String(list.filter((ticket) => ticket.work_begin_date).length);
}

function saveHiddenTickets() {
  applyTicketListCheckpoint();
  writeJsonStorage(STORAGE_KEYS.hiddenTickets, [...hiddenTickets]);
  writeJsonStorage(STORAGE_KEYS.hiddenTicketUpdatedAt, hiddenTicketUpdatedAt);
  scheduleDashboardStateSave();
  void saveDashboardState().catch((error) => {
    console.warn("Unable to save hidden ticket state", error);
  });
}

function saveArchivedTickets() {
  applyTicketListCheckpoint();
  writeJsonStorage(STORAGE_KEYS.archivedTickets, [...archivedTickets]);
  writeJsonStorage(STORAGE_KEYS.archivedTicketUpdatedAt, archivedTicketUpdatedAt);
  scheduleDashboardStateSave();
  void saveDashboardState().catch((error) => {
    console.warn("Unable to save archived ticket state", error);
  });
}

function hideIcon(hidden) {
  const slash = hidden ? "" : '<line x1="4" y1="20" x2="20" y2="4"></line>';
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"></path>
      <circle cx="12" cy="12" r="3"></circle>
      ${slash}
    </svg>
  `;
}

function archiveIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7h18"></path>
      <path d="M5 7v13h14V7"></path>
      <path d="M8 3h8l2 4H6z"></path>
      <path d="M10 12h4"></path>
    </svg>
  `;
}

function toggleTicketHidden(ticketNumber) {
  rememberUndoState();
  let hidden = false;
  if (hiddenTickets.has(ticketNumber)) {
    hiddenTickets.delete(ticketNumber);
    stampTicketVisibility(ticketNumber, "hidden");
  } else {
    hiddenTickets.add(ticketNumber);
    stampTicketVisibility(ticketNumber, "hidden");
    hidden = true;
    if (selectedTicket?.ticket_number === ticketNumber && !elements.showHiddenToggle.checked) {
      selectedTicket = visibleTickets().find((ticket) => ticket.ticket_number !== ticketNumber) || null;
    }
  }
  saveHiddenTickets();
  auditEvent("ticket_hidden_changed", { ticket: ticketNumber, hidden });
  render();
}

function toggleTicketArchived(ticketNumber) {
  rememberUndoState();
  let archived = false;
  if (archivedTickets.has(ticketNumber)) {
    archivedTickets.delete(ticketNumber);
    stampTicketVisibility(ticketNumber, "archive");
  } else {
    archivedTickets.add(ticketNumber);
    stampTicketVisibility(ticketNumber, "archive");
    archived = true;
    if (selectedTicket?.ticket_number === ticketNumber) {
      selectedTicket = null;
      pendingSelectedTicketNumber = "";
      localStorage.removeItem("selectedTicketNumber");
    }
  }
  saveArchivedTickets();
  auditEvent("ticket_archived_changed", { ticket: ticketNumber, archived });
  render();
}

function renderCountyFilter() {
  const counties = [...new Set(scopedTickets().map((ticket) => ticket.county).filter(Boolean))].sort();
  const visibleCounties = counties.length ? counties : [...ACTIVE_COUNTIES].sort();
  for (const county of [...selectedCounties]) {
    if (!visibleCounties.includes(county)) selectedCounties.delete(county);
  }
  if (!countyFilterAll && selectedCounties.size === 0 && visibleCounties.length) {
    countyFilterAll = true;
  }
  elements.countyFilter.innerHTML = "";
  for (const county of visibleCounties) {
    const label = document.createElement("label");
    label.className = "check-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = county;
    input.checked = countyFilterAll || selectedCounties.has(county);
    input.addEventListener("change", () => {
      rememberUndoState();
      if (countyFilterAll) {
        countyFilterAll = false;
        selectedCounties = new Set(visibleCounties);
      }
      if (input.checked) {
        selectedCounties.add(county);
      } else {
        selectedCounties.delete(county);
      }
      if (selectedCounties.size === visibleCounties.length) {
        countyFilterAll = true;
        selectedCounties.clear();
      }
      writeBooleanStorage(STORAGE_KEYS.countyFilterAll, countyFilterAll);
      writeJsonStorage(STORAGE_KEYS.countyFilterSelected, [...selectedCounties]);
      localStorage.removeItem("countyFilter");
      render();
      scheduleEmployeeDashboardSync();
    });
    label.append(input, document.createTextNode(county));
    elements.countyFilter.appendChild(label);
  }
  const selectedCount = countyFilterAll ? visibleCounties.length : selectedCounties.size;
  elements.countyFilterSummary.textContent = countyFilterAll ? "All counties" : `${selectedCount} counties`;
  writeBooleanStorage(STORAGE_KEYS.countyFilterAll, countyFilterAll);
  writeJsonStorage(STORAGE_KEYS.countyFilterSelected, [...selectedCounties]);
}

function ticketDueKey(ticket) {
  return ticket.work_begin_date || "No due date";
}

function ticketIsEmergency(ticket) {
  return [ticket.message_type, ticket.work_type, ticket.location_information, ticket.raw_text]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
    .includes("EMERGENCY");
}

function ticketPriorityText(ticket) {
  return [
    ticket.message_type,
    ticket.work_type,
    ticket.location_information,
    ticket.raw_text,
    ticket.priority,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

function ticketIsRenewal(ticket) {
  return ticketPriorityText(ticket).includes("RENEWAL");
}

function ticketIsRemark(ticket) {
  const text = ticketPriorityText(ticket);
  return /\bRECALL\b/.test(text)
    || /\bSECOND\s+REQUEST\b/.test(text)
    || /\b24\s*(?:HOUR|HR)\s+PRIORITY\b/.test(text)
    || /\bTWENTY\s+FOUR\s+HOUR\s+PRIORITY\b/.test(text);
}

function normalizedCompanyText(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function companyTextMatchesOrangePriority(value) {
  const text = normalizedCompanyText(value);
  if (!text) return false;
  return /\bTCW\b/.test(text)
    || /\bDMI\b/.test(text)
    || /\bTC\s+WORKS\b/.test(text)
    || /\bTHE\s+COMPUTER\s+WORKS\b/.test(text)
    || /\bCOMPUTER\s+WORKS\b/.test(text)
    || /\bDIRT\s+MOVES\b/.test(text)
    || /\bDIRT\s+MOVES\s+INC\b/.test(text)
    || /\bDIRT\s+MOVES\s+INCORPORATED\b/.test(text);
}

function ticketCompanyPriorityText(ticket) {
  return [
    ticket.done_for,
    ticket.company_name,
    ticket.contractor,
    ticket.caller,
    ticket.excavator,
    ticket.excavator_name,
  ].filter(Boolean).join(" ");
}

function ticketIsTcwDmiWork(ticket) {
  return companyTextMatchesOrangePriority(ticketCompanyPriorityText(ticket));
}

function ticketShouldShowOnDashboard(ticket) {
  return !(ticketIsTcwDmiWork(ticket) && ticketDueDayIsPast(ticket));
}

function baseScopedTickets() {
  return Array.isArray(tickets) ? tickets.filter((ticket) => ACTIVE_COUNTIES.has(String(ticket.county || "").toUpperCase())) : [];
}

function ticketDueDay(ticket) {
  const due = parseTicketDueDate(ticket);
  if (!due) return null;
  return new Date(due.getFullYear(), due.getMonth(), due.getDate());
}

function ticketDueDayIsPast(ticket) {
  const due = ticketDueDay(ticket);
  return Boolean(due && due < startOfToday());
}

function ticketDueDayIsToday(ticket) {
  const due = ticketDueDay(ticket);
  const today = startOfToday();
  return Boolean(due && due.getTime() === today.getTime());
}

function dashboardModeTickets() {
  return baseScopedTickets();
}

function historicalRecordIsTcwDmiWork(record) {
  return companyTextMatchesOrangePriority([
    historyCell(record, "Done For"),
    historyCell(record, "Excavator Name"),
  ].join(" "));
}

function parseTicketDueDate(ticket) {
  const value = String(ticket.work_begin_date || ticket.work_date || ticket.due_date || ticket.workDate || "").trim();
  if (!value) return null;
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }
  const slashMatch = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (slashMatch) {
    const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
    return new Date(year, Number(slashMatch[1]) - 1, Number(slashMatch[2]));
  }
  const namedMonthMatch = value.match(/\b(JANUARY|JAN|FEBRUARY|FEB|MARCH|MAR|APRIL|APR|MAY|JUNE|JUN|JULY|JUL|AUGUST|AUG|SEPTEMBER|SEP|SEPT|OCTOBER|OCT|NOVEMBER|NOV|DECEMBER|DEC)\.?\s+(\d{1,2})(?:ST|ND|RD|TH)?[,]?\s+(\d{2,4})\b/i);
  if (namedMonthMatch) {
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const monthKey = namedMonthMatch[1].slice(0, 3).toUpperCase();
    const month = monthNames.indexOf(monthKey);
    const year = Number(namedMonthMatch[3].length === 2 ? `20${namedMonthMatch[3]}` : namedMonthMatch[3]);
    if (month >= 0) return new Date(year, month, Number(namedMonthMatch[2]));
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return null;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function nextWorkingDay(fromDate) {
  const date = new Date(fromDate);
  do {
    date.setDate(date.getDate() + 1);
  } while (date.getDay() === 0 || date.getDay() === 6);
  return date;
}

function ticketDueStatus(ticket) {
  const dueDate = parseTicketDueDate(ticket);
  if (!dueDate) return "";
  const today = startOfToday();
  const nextDueDay = nextWorkingDay(today);
  if (dueDate <= today) return "due-today";
  if (dueDate.getTime() === nextDueDay.getTime()) return "due-next";
  return "due-later";
}

function priorityLegendItems() {
  const today = startOfToday();
  const nextDay = nextWorkingDay(today);
  const dateText = (date) => date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return [
    { className: "legend-low", label: "Admin priority: Low" },
    { className: "legend-medium", label: "Admin priority: Medium" },
    { className: "legend-high", label: "Admin priority: High" },
    { className: "legend-emergency", label: "Emergency - immediate priority" },
    { className: "legend-remark", label: "Recall / second request - due within 24 hours" },
    { className: "legend-renewal", label: "Renewal request - excavator still working after 10 days" },
    { className: "legend-tcw", label: "TCW/DMI/Computer Works/Dirt Moves work" },
    { className: "legend-due-today", label: `Past due / due ${dateText(today)} at 8:00 AM` },
    { className: "legend-due-next", label: `Due next working day ${dateText(nextDay)} at 8:00 AM` },
    { className: "legend-due-later", label: "Due more than one working day away" },
    { className: "legend-actioned", label: "Action selected - completed/handled" },
  ];
}

function renderPriorityLegends() {
  const html = `
    <strong>Legend</strong>
    ${priorityLegendItems()
      .map((item) => `<span class="legend-item ${item.className}"><i></i>${escapeHtml(item.label)}</span>`)
      .join("")}
  `;
  for (const element of [elements.mapLegend, elements.sheetLegend]) {
    if (element) element.innerHTML = html;
  }
  showMapLegendTemporarily(3600);
}

let mapLegendTimer = null;

function showMapLegendTemporarily(duration = 3200) {
  if (!elements.mapLegend) return;
  elements.mapLegend.classList.add("visible");
  if (mapLegendTimer) window.clearTimeout(mapLegendTimer);
  mapLegendTimer = window.setTimeout(() => {
    elements.mapLegend.classList.remove("visible");
    mapLegendTimer = null;
  }, duration);
}

function ticketPriorityClasses(ticket) {
  const classes = [];
  const assignedPriority = ticketAssignedPriority(ticket.ticket_number);
  if (assignedPriority) classes.push(`ticket-priority-${assignedPriority}`);
  if (ticketHasActions(ticket.ticket_number)) classes.push("ticket-actioned");
  if (ticketIsTcwDmiWork(ticket)) classes.push("ticket-tcw-dmi-work");
  if (ticketIsEmergency(ticket)) classes.push("ticket-emergency-priority");
  if (ticketIsRemark(ticket)) classes.push("ticket-remark-priority");
  if (ticketIsRenewal(ticket)) classes.push("ticket-renewal-priority");
  const dueStatus = ticketDueStatus(ticket);
  if (dueStatus) classes.push(`ticket-${dueStatus}`);
  return classes.join(" ");
}

function ticketVisualColors(ticket) {
  switch (ticketAssignedPriority(ticket.ticket_number)) {
    case "low":
      return { stroke: "#2f855a", fill: "#2f855a", fillOpacity: 0.2 };
    case "medium":
      return { stroke: "#2563eb", fill: "#2563eb", fillOpacity: 0.22 };
    case "high":
      return { stroke: "#d97706", fill: "#d97706", fillOpacity: 0.26 };
    case "emergency":
      return { stroke: "#dc2626", fill: "#dc2626", fillOpacity: 0.32 };
  }
  if (ticketIsTcwDmiWork(ticket)) return { stroke: "#ff6a00", fill: "#ff6a00", fillOpacity: 0.26 };
  if (ticketIsEmergency(ticket)) return { stroke: "#ff0033", fill: "#ff0033", fillOpacity: 0.28 };
  if (ticketIsRemark(ticket)) return { stroke: "#a855f7", fill: "#a855f7", fillOpacity: 0.24 };
  if (ticketIsRenewal(ticket)) return { stroke: "#38bdf8", fill: "#38bdf8", fillOpacity: 0.22 };
  switch (ticketDueStatus(ticket)) {
    case "due-today":
      return { stroke: "#ffb3b3", fill: "#ffb3b3", fillOpacity: 0.34 };
    case "due-next":
      return { stroke: "#facc15", fill: "#facc15", fillOpacity: 0.3 };
    case "due-later":
      return { stroke: "#15803d", fill: "#15803d", fillOpacity: 0.18 };
    default:
      return { stroke: "#2563eb", fill: "#2563eb", fillOpacity: 0.16 };
  }
}

function ticketMapColors(ticket) {
  const colors = ticketVisualColors(ticket);
  if (ticketHasActions(ticket.ticket_number) && !ticketIsTcwDmiWork(ticket) && !ticketIsEmergency(ticket) && !ticketIsRemark(ticket) && !ticketIsRenewal(ticket)) {
    return { stroke: "#ff2b2b", fill: "#ff2b2b", fillOpacity: 0.16 };
  }
  return colors;
}

function sortedTickets(list) {
  return [...list].sort((a, b) => {
    const aDate = a.work_begin_date || "9999-99-99";
    const bDate = b.work_begin_date || "9999-99-99";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return (a.work_begin_time || "").localeCompare(b.work_begin_time || "") || a.ticket_number.localeCompare(b.ticket_number);
  });
}

function ticketDateTimeValue(ticket) {
  const dueDate = parseTicketDueDate(ticket);
  if (!dueDate) return Infinity;
  const time = String(ticket.work_begin_time || "").trim();
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const seconds = Number(timeMatch[3] || 0);
    const meridiem = String(timeMatch[4] || "").toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    dueDate.setHours(hours, minutes, seconds, 0);
  }
  return dueDate.getTime();
}

function compareTicketsByDate(a, b, direction = "asc") {
  const aValue = ticketDateTimeValue(a);
  const bValue = ticketDateTimeValue(b);
  if (aValue !== bValue) {
    const safeA = Number.isFinite(aValue) ? aValue : Number.MAX_SAFE_INTEGER;
    const safeB = Number.isFinite(bValue) ? bValue : Number.MAX_SAFE_INTEGER;
    return (safeA - safeB) * (direction === "desc" ? -1 : 1);
  }
  return String(a.ticket_number || "").localeCompare(String(b.ticket_number || ""), undefined, { numeric: true });
}

function setTicketsHidden(ticketNumbers, hidden) {
  const numbers = ticketNumbers.filter(Boolean);
  if (!numbers.length) return;
  rememberUndoState();
  let changed = false;
  for (const ticketNumber of numbers) {
    if (hidden) {
      if (!hiddenTickets.has(ticketNumber)) {
        hiddenTickets.add(ticketNumber);
        stampTicketVisibility(ticketNumber, "hidden");
        changed = true;
      }
    } else if (hiddenTickets.delete(ticketNumber)) {
      stampTicketVisibility(ticketNumber, "hidden");
      changed = true;
    }
  }
  if (!changed) return;
  if (selectedTicket && hiddenTickets.has(selectedTicket.ticket_number) && !elements.showHiddenToggle.checked) {
    selectedTicket = visibleTickets().find((ticket) => !hiddenTickets.has(ticket.ticket_number)) || null;
  }
  saveHiddenTickets();
  auditEvent("ticket_group_hidden_changed", { count: numbers.length, hidden });
  render();
}

function hideGroupTickets(ticketNumbers, hidden = true) {
  setTicketsHidden(ticketNumbers, hidden);
}

function ticketCardHtml(ticket) {
  const hidden = hiddenTickets.has(ticket.ticket_number);
  const archived = archivedTickets.has(ticket.ticket_number);
  const priorityClasses = ticketPriorityClasses(ticket);
  const attachedLocatorNotes = locatorNotesForTicket(ticket);
  const attachedLocationPhotos = locationPhotosForTicket(ticket);
  return `
    <div class="ticket-card ${priorityClasses} ${selectedTicket?.ticket_number === ticket.ticket_number ? "active" : ""} ${hidden ? "hidden-ticket" : ""} ${archived ? "archived-ticket" : ""}" data-ticket="${escapeHtml(ticket.ticket_number)}" role="button" tabindex="0">
      <div class="ticket-card-header">
        <span class="ticket-number">${escapeHtml(ticket.ticket_number)}</span>
        <span class="ticket-header-actions">
          <button class="hide-ticket-button" type="button" data-hide-ticket="${escapeHtml(ticket.ticket_number)}" title="${hidden ? "Unhide ticket" : "Hide ticket"}" aria-label="${hidden ? "Unhide ticket" : "Hide ticket"}">
            ${hideIcon(hidden)}
          </button>
          <span class="badge">${escapeHtml(ticket.county || "UNKNOWN")}</span>
        </span>
      </div>
      <div class="ticket-actions-row">
        ${hidden ? '<span class="mini-status hidden-status">Hidden</span>' : ""}
        ${archived ? '<span class="mini-status archived-status">Archived</span>' : ""}
        ${ticketActionLabels(ticket.ticket_number).map((label) => `<span class="mini-status action-status">${escapeHtml(label)}</span>`).join("")}
        ${attachedLocatorNotes.length ? '<span class="mini-status action-status">Locator note attached</span>' : ""}
        ${attachedLocationPhotos.length ? '<span class="mini-status action-status">Previous photos nearby</span>' : ""}
        ${ticket.portal_html_available ? `<a class="mini-link" href="/api/portal-html?ticket=${encodeURIComponent(ticket.ticket_number)}" target="_blank" rel="noreferrer">Open page</a>` : ""}
        ${ticket.portal_url && !ticket.portal_html_available ? `<a class="mini-link" href="${escapeHtml(ticket.portal_url)}" target="_blank" rel="noreferrer">Open GeoCall</a>` : ""}
        ${ticket.polygon ? '<span class="mini-status">Polygon</span>' : ""}
      </div>
      <p><strong>${escapeHtml(ticket.work_type || ticket.message_type)}</strong></p>
      <p class="work-comment">${escapeHtml(workDescription(ticket))}</p>
      <p>${escapeHtml(ticketAddress(ticket))}</p>
      <p>${escapeHtml(ticket.contractor)} · Begin ${escapeHtml(ticket.work_begin_date)} ${escapeHtml(ticket.work_begin_time)}</p>
    </div>
  `;
}

function parseCoordinateSearch(value) {
  const match = String(value || "").trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return { latitude: first, longitude: second };
  if (Math.abs(second) <= 90 && Math.abs(first) <= 180) return { latitude: second, longitude: first };
  return null;
}

function showMapSearchResult(latitude, longitude, label) {
  if (!map) return;
  const latlng = [latitude, longitude];
  map.flyTo(latlng, Math.max(map.getZoom(), 17), { duration: 0.45, easeLinearity: 0.3 });
  L.popup({ closeButton: true, autoClose: true })
    .setLatLng(latlng)
    .setContent(`<strong>${escapeHtml(label || "Map search")}</strong><br>${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
    .openOn(map);
}

async function runMapSearch() {
  const query = elements.mapSearch?.value.trim() || "";
  if (!query) return;
  const coordinates = parseCoordinateSearch(query);
  if (coordinates) {
    showMapSearchResult(coordinates.latitude, coordinates.longitude, query);
    return;
  }
  const localTicket = tickets.find((ticket) => searchable(ticket).includes(query.toLowerCase()) && (typeof ticket.latitude === "number" || ticket.polygon));
  if (localTicket) {
    selectTicket(localTicket.ticket_number, { focus: true });
    return;
  }
  const response = await fetch(`/api/map-search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`Map search failed: ${response.status}`);
  const payload = await response.json();
  if (!payload.ok) {
    window.alert(payload.message || "No map search result found.");
    return;
  }
  showMapSearchResult(Number(payload.latitude), Number(payload.longitude), payload.name || query);
}

function groupActionButtonHtml(items = []) {
  const activeItems = items.filter((ticket) => !archivedTickets.has(ticket.ticket_number));
  const hiddenCount = activeItems.filter((ticket) => hiddenTickets.has(ticket.ticket_number)).length;
  const shouldHide = hiddenCount < activeItems.length;
  const label = shouldHide ? "Hide all" : "Unhide all";
  const action = shouldHide ? "hide" : "unhide";
  return `
    <button class="group-hide-button" type="button" data-group-action="${action}" data-group-ticket-numbers="${escapeHtml(activeItems.map((ticket) => ticket.ticket_number).join(","))}">
      ${escapeHtml(label)}
    </button>
  `;
}

function renderTicketGroup(summaryLabel, items = [], extraClass = "", open = true, visibleItems = items) {
  const activeItems = items.filter((ticket) => !archivedTickets.has(ticket.ticket_number));
  const hiddenCount = activeItems.filter((ticket) => hiddenTickets.has(ticket.ticket_number)).length;
  const visibleCount = visibleItems.length;
  const totalCount = activeItems.length;
  const body = visibleCount
    ? visibleItems.map(ticketCardHtml).join("")
    : `<div class="ticket-group-empty">${hiddenCount === totalCount ? "All tickets in this folder are hidden." : "No tickets match the current filters."}</div>`;
  return `
    <details class="ticket-date-group ${escapeHtml(extraClass)}" ${open ? "open" : ""}>
      <summary class="ticket-date-heading">
        <span>${escapeHtml(summaryLabel)}</span>
        <span class="ticket-group-summary">
          <span>${totalCount} ticket${totalCount === 1 ? "" : "s"}${hiddenCount ? `, ${hiddenCount} hidden` : ""}</span>
          ${activeItems.length ? groupActionButtonHtml(activeItems) : ""}
        </span>
      </summary>
      ${body}
    </details>
  `;
}

function renderList(list = []) {
  const protectedTickets = protectedTicketNumbersFromCheckpoint();
  if (!list.length) {
    elements.ticketList.innerHTML = '<div class="detail-content">No matching tickets.</div>';
    return;
  }

  const emergencies = [];
  const dateGroups = new Map();
  const activeList = list.filter((ticket) => !archivedTickets.has(ticket.ticket_number));
  const archivedList = sortedTickets(scopedTickets().filter((ticket) => archivedTickets.has(ticket.ticket_number) && !protectedTickets.has(ticket.ticket_number)));
  for (const ticket of sortedTickets(activeList)) {
    if (ticketIsEmergency(ticket)) {
      emergencies.push(ticket);
      continue;
    }
    const key = ticketDueKey(ticket);
    if (!dateGroups.has(key)) dateGroups.set(key, []);
    dateGroups.get(key).push(ticket);
  }

  const sections = [];
  if (emergencies.length) {
    const visibleEmergencies = elements.showHiddenToggle.checked
      ? emergencies.filter((ticket) => !protectedTickets.has(ticket.ticket_number))
      : emergencies.filter((ticket) => !hiddenTickets.has(ticket.ticket_number) && !protectedTickets.has(ticket.ticket_number));
    sections.push(renderTicketGroup("Priority emergencies", emergencies, "ticket-emergency-group", true, visibleEmergencies));
  }
  sections.push(
    ...[...dateGroups.entries()].map(([dueDate, items]) => {
      const visibleItems = elements.showHiddenToggle.checked
        ? items.filter((ticket) => !protectedTickets.has(ticket.ticket_number))
        : items.filter((ticket) => !hiddenTickets.has(ticket.ticket_number) && !protectedTickets.has(ticket.ticket_number));
      return renderTicketGroup(dueDate, items, "ticket-date-folder", true, visibleItems);
    }),
  );
  if (archivedList.length) {
    sections.push(renderTicketGroup("Archived tickets", archivedList, "ticket-archived-group", false, archivedList));
  }

  elements.ticketList.innerHTML = sections.join("");

  for (const card of elements.ticketList.querySelectorAll(".ticket-card")) {
    card.addEventListener("click", () => selectTicket(card.dataset.ticket, { focus: true }));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectTicket(card.dataset.ticket, { focus: true });
      }
    });
  }

  for (const link of elements.ticketList.querySelectorAll(".mini-link")) {
    link.addEventListener("click", (event) => event.stopPropagation());
  }

  for (const button of elements.ticketList.querySelectorAll(".hide-ticket-button")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTicketHidden(button.dataset.hideTicket);
    });
  }

  for (const button of elements.ticketList.querySelectorAll(".group-hide-button")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const numbers = (button.dataset.groupTicketNumbers || "").split(",").filter(Boolean);
      hideGroupTickets(numbers, button.dataset.groupAction !== "unhide");
    });
  }
}

function focusTicketOnMap(ticket) {
  if (!ticket) return;
  const detailOffset = () => {
    if (!elements.detail || elements.detail.hidden || window.innerWidth < 760) return [0, 0];
    const detailRect = elements.detail.getBoundingClientRect();
    const mapRect = elements.map?.getBoundingClientRect?.();
    const detailWidth = detailRect.width || 0;
    const mapWidth = mapRect?.width || window.innerWidth;
    const visibleWidth = Math.max(240, mapWidth - detailWidth - 28);
    const targetShift = Math.max(0, (mapWidth / 2) - (visibleWidth / 2));
    return [Math.min(detailWidth + 90, Math.max(220, targetShift + 32)), 0];
  };
  const visiblePadding = () => {
    const rightPadding = elements.detail && !elements.detail.hidden && window.innerWidth >= 760
      ? Math.min(560, Math.ceil(elements.detail.getBoundingClientRect().width + 120))
      : 72;
    return {
      topLeft: [72, 72],
      bottomRight: [rightPadding, 72],
    };
  };
  const moveAtCurrentZoom = (latlng) => {
    const point = map.project(latlng, map.getZoom()).add(detailOffset());
    map.panTo(map.unproject(point, map.getZoom()), {
      animate: true,
      duration: 0.7,
      easeLinearity: 0.25,
      noMoveStart: true,
    });
  };
  const zoomToBounds = (bounds) => {
    const padding = visiblePadding();
    map.flyToBounds(bounds, {
      paddingTopLeft: padding.topLeft,
      paddingBottomRight: padding.bottomRight,
      maxZoom: FOCUS_TARGET_ZOOM,
      duration: 0.35,
      easeLinearity: 0.3,
    });
  };
  if (ticket.polygon) {
    const layer = L.geoJSON(ticket.polygon);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      if (map.getZoom() < FOCUS_ZOOM_THRESHOLD) {
        zoomToBounds(bounds);
      } else {
        moveAtCurrentZoom(bounds.getCenter());
      }
      return;
    }
  }
  if (typeof ticket.latitude === "number" && typeof ticket.longitude === "number") {
    const latlng = [ticket.latitude, ticket.longitude];
    if (map.getZoom() < FOCUS_ZOOM_THRESHOLD) {
      const point = map.project(latlng, FOCUS_TARGET_ZOOM).add(detailOffset());
      map.flyTo(map.unproject(point, FOCUS_TARGET_ZOOM), FOCUS_TARGET_ZOOM, { duration: 0.35, easeLinearity: 0.3 });
    } else {
      moveAtCurrentZoom(latlng);
    }
  }
}

function ticketPolygonBounds(ticket) {
  if (!ticket?.polygon || typeof L === "undefined") return null;
  const layer = L.geoJSON(ticket.polygon);
  const bounds = layer.getBounds();
  return bounds?.isValid?.() ? bounds : null;
}

function paddedBoundsByPixels(bounds, mapInstance, pixels = SELECTED_POLYGON_NEARBY_PIXELS) {
  if (!bounds?.isValid?.() || !mapInstance) return null;
  const zoom = mapInstance.getZoom();
  const southWest = mapInstance.project(bounds.getSouthWest(), zoom).subtract([pixels, pixels]);
  const northEast = mapInstance.project(bounds.getNorthEast(), zoom).add([pixels, pixels]);
  const padded = L.latLngBounds(
    mapInstance.unproject(southWest, zoom),
    mapInstance.unproject(northEast, zoom),
  );
  return padded?.isValid?.() ? padded : bounds;
}

function selectedPolygonFocusBounds(mapInstance) {
  if (!selectedTicket?.polygon) return null;
  const bounds = ticketPolygonBounds(selectedTicket);
  return paddedBoundsByPixels(bounds, mapInstance);
}

function shouldDimNearSelectedPolygon(ticket, focusBounds) {
  if (!focusBounds || !ticket?.polygon || selectedTicket?.ticket_number === ticket.ticket_number) return false;
  const bounds = ticketPolygonBounds(ticket);
  return Boolean(bounds?.isValid?.() && focusBounds.intersects(bounds));
}

function renderMap(list = []) {
  markers.clearLayers();
  polygons.clearLayers();
  const bounds = [];
  const focusedPolygonBounds = selectedPolygonFocusBounds(map);
  const measuring = Boolean(measureTool?.active);

  for (const ticket of list) {
    if (ticket.polygon) {
      const dueColors = ticketMapColors(ticket);
      const selected = selectedTicket?.ticket_number === ticket.ticket_number;
      const dimmedBySelection = shouldDimNearSelectedPolygon(ticket, focusedPolygonBounds);
      const fillOpacity = dimmedBySelection
        ? NEARBY_POLYGON_DIM_OPACITY
        : dueColors.fillOpacity;
      const strokeOpacity = dimmedBySelection ? NEARBY_POLYGON_DIM_STROKE_OPACITY : 1;
      const polygon = L.geoJSON(ticket.polygon, {
        style: {
          color: dueColors.stroke,
          fillColor: dueColors.fill,
          fillOpacity: (measuring ? Math.min(fillOpacity, 0.08) : fillOpacity) * ticketOpacity,
          opacity: (measuring ? 0.28 : strokeOpacity) * ticketOpacity,
          weight: measuring ? 2 : (selected ? 6 : 4),
        },
      });
      polygon.bindPopup(`<strong>${escapeHtml(ticket.ticket_number)}</strong><br>${escapeHtml(ticketAddress(ticket) || "GeoCall polygon")}`);
      polygon.on("click", (event) => {
        if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
        if (locatorNoteMode) {
          beginLocatorNoteForTicket(ticket, event.latlng);
          return;
        }
        if (measureTool?.active) {
          measureTool.addPoint(event.latlng);
          return;
        }
        selectTicket(ticket.ticket_number, { focus: true });
      });
      polygon.on("dblclick", (event) => {
        if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
        if (locatorNoteMode) {
          beginLocatorNoteForTicket(ticket, event.latlng);
          return;
        }
        if (measureTool?.active) {
          measureTool.addPoint(event.latlng);
          return;
        }
        selectTicket(ticket.ticket_number, { focus: true });
      });
      polygon.addTo(polygons);
      polygon.eachLayer((layer) => {
        if (layer.getBounds) {
          const layerBounds = layer.getBounds();
          bounds.push([layerBounds.getSouth(), layerBounds.getWest()]);
          bounds.push([layerBounds.getNorth(), layerBounds.getEast()]);
        }
      });
    }

    if (typeof ticket.latitude !== "number" || typeof ticket.longitude !== "number") continue;
    const pointColors = ticketMapColors(ticket);
    const markerDimmedBySelection = shouldDimNearSelectedPolygon(ticket, focusedPolygonBounds);
    const markerOpacity = markerDimmedBySelection ? NEARBY_POLYGON_DIM_STROKE_OPACITY : 1;
    const marker = L.circleMarker([ticket.latitude, ticket.longitude], {
      radius: selectedTicket?.ticket_number === ticket.ticket_number ? 10 : 7,
      color: pointColors.stroke,
      fillColor: pointColors.fill,
      opacity: markerOpacity * ticketOpacity,
      fillOpacity: (markerDimmedBySelection ? NEARBY_POLYGON_DIM_OPACITY : 0.88) * ticketOpacity,
      weight: selectedTicket?.ticket_number === ticket.ticket_number ? 5 : 4,
    });
    marker.bindPopup(`<strong>${escapeHtml(ticket.ticket_number)}</strong><br>${escapeHtml(ticketAddress(ticket))}`);
    marker.on("click", (event) => {
      if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
      if (locatorNoteMode) {
        beginLocatorNoteForTicket(ticket, event.latlng);
        return;
      }
      selectTicket(ticket.ticket_number, { focus: true });
    });
    marker.on("dblclick", (event) => {
      if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
      if (locatorNoteMode) {
        beginLocatorNoteForTicket(ticket, event.latlng);
        return;
      }
      selectTicket(ticket.ticket_number, { focus: true });
    });
    marker.addTo(markers);
    bounds.push([ticket.latitude, ticket.longitude]);
  }

  if (bounds.length && !initialTicketBoundsApplied && !pendingMapView) {
    initialTicketBoundsApplied = true;
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
  refreshMap3dLayers();
}

function ticketPopupContent(ticket) {
  const address = ticketAddress(ticket) || "GeoCall polygon";
  const work = workDescription(ticket);
  return `
    <strong>${escapeHtml(ticket.ticket_number)}</strong><br>
    ${escapeHtml(address)}
    ${work ? `<br><small>${escapeHtml(work)}</small>` : ""}
  `;
}

function ticketPopupLatLng(ticket) {
  if (!ticket) return null;
  if (ticket.polygon) {
    const layer = L.geoJSON(ticket.polygon);
    const bounds = layer.getBounds();
    if (bounds.isValid()) return bounds.getCenter();
  }
  if (typeof ticket.latitude === "number" && typeof ticket.longitude === "number") {
    return L.latLng(ticket.latitude, ticket.longitude);
  }
  return null;
}

function openTicketMapPopup(ticket) {
  if (!map || !ticket) return;
  const latlng = ticketPopupLatLng(ticket);
  if (!latlng) return;
  L.popup({ closeButton: true, autoClose: true, autoPan: false, maxWidth: 360 })
    .setLatLng(latlng)
    .setContent(ticketPopupContent(ticket))
    .openOn(map);
}

function syncSelectedTicketCard(previousTicketNumber = "") {
  if (!elements.ticketList) return;
  if (previousTicketNumber) {
    const previous = elements.ticketList.querySelector(`[data-ticket="${CSS.escape(previousTicketNumber)}"]`);
    if (previous) previous.classList.remove("active");
  }
  if (!selectedTicket) return;
  const current = elements.ticketList.querySelector(`[data-ticket="${CSS.escape(selectedTicket.ticket_number)}"]`);
  if (current) current.classList.add("active");
}

function field(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return `<div class="field"><label>${escapeHtml(label)}</label><div>${escapeHtml(value)}</div></div>`;
}

function htmlField(label, htmlValue) {
  if (!htmlValue) return "";
  return `<div class="field"><label>${escapeHtml(label)}</label><div>${htmlValue}</div></div>`;
}

function linkField(label, href, text) {
  if (!href) return "";
  return `<div class="field"><label>${escapeHtml(label)}</label><div><a class="inline-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(text)}</a></div></div>`;
}

function phoneHref(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 7) return "";
  return `tel:${digits.length === 10 ? `+1${digits}` : digits}`;
}

function contactLinkHtml(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const href = phoneHref(text);
  return href ? `<a class="inline-link" href="${escapeHtml(href)}">${escapeHtml(text)}</a>` : escapeHtml(text);
}

function emailLinkHtml(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return `<a class="inline-link" href="mailto:${escapeHtml(text)}">${escapeHtml(text)}</a>`;
}

function mapLinkHtml(value, ticket, navigate = false) {
  const text = String(value || "").trim();
  if (!text) return "";
  const href = navigate ? ticketGoogleMapsUrl(ticket, true) : ticketGoogleMapsUrl(ticket, false);
  return href ? `<a class="inline-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(text)}</a>` : escapeHtml(text);
}

function coordinateLinkHtml(ticket) {
  if (!Number.isFinite(Number(ticket.latitude)) || !Number.isFinite(Number(ticket.longitude))) return "";
  const text = `${ticket.latitude}, ${ticket.longitude}`;
  return mapLinkHtml(text, ticket);
}

function linkifyContactText(value) {
  let output = escapeHtml(value || "");
  output = output.replace(
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
    (match) => `<a class="inline-link" href="mailto:${escapeHtml(match)}">${match}</a>`,
  );
  output = output.replace(
    /(?<![A-Za-z0-9@])(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})(?![A-Za-z0-9])/g,
    (match) => {
      const href = phoneHref(match);
      return href ? `<a class="inline-link" href="${escapeHtml(href)}">${match}</a>` : match;
    },
  );
  return output;
}

function ticketPageUrl(ticket) {
  if (ticket.portal_html_available) return `/api/portal-html?ticket=${encodeURIComponent(ticket.ticket_number)}`;
  return ticket.portal_url || "";
}

function ticketGoogleMapsUrl(ticket, navigate = false) {
  if (Number.isFinite(Number(ticket.latitude)) && Number.isFinite(Number(ticket.longitude))) {
    const destination = `${ticket.latitude},${ticket.longitude}`;
    return navigate
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
  }
  const query = ticketAddress(ticket) || [ticket.street, ticket.place, ticket.county, ticket.state].filter(Boolean).join(", ");
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : "";
}

function ticketGoogleMapsEmbedUrl(ticket) {
  if (Number.isFinite(Number(ticket.latitude)) && Number.isFinite(Number(ticket.longitude))) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${ticket.latitude},${ticket.longitude}`)}&z=17&output=embed`;
  }
  const query = ticketAddress(ticket) || [ticket.street, ticket.place, ticket.county, ticket.state].filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : "";
}

function portalActions(ticket) {
  const actions = [];
  if (ticket.portal_html_available) {
    actions.push(`<a class="action" href="/api/portal-html?ticket=${encodeURIComponent(ticket.ticket_number)}" target="_blank" rel="noreferrer">Ticket page</a>`);
  }
  if (ticket.portal_url) {
    actions.push(`<a class="action" href="${escapeHtml(ticket.portal_url)}" target="_blank" rel="noreferrer">Open live GeoCall page</a>`);
  }
  if (!actions.length) return "";
  return `<div class="actions">${actions.join("")}</div>`;
}

function attachmentSizeLabel(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

async function loadTicketAttachments(ticketNumber, force = false) {
  if (!ticketNumber || attachmentLoadingTickets.has(ticketNumber)) return;
  if (!force && Array.isArray(attachmentCache[ticketNumber])) return;
  attachmentLoadingTickets.add(ticketNumber);
  try {
    const response = await fetch(`/api/attachments?ticket=${encodeURIComponent(ticketNumber)}`);
    if (!response.ok) throw new Error(`Attachment load failed: ${response.status}`);
    const payload = await response.json();
    attachmentCache[ticketNumber] = Array.isArray(payload.attachments) ? payload.attachments : [];
  } catch (error) {
    attachmentCache[ticketNumber] = [];
    console.warn(error);
  } finally {
    attachmentLoadingTickets.delete(ticketNumber);
  }
}

function updateTicketAttachmentSummary(ticketNumber, summary) {
  if (!summary || typeof summary !== "object") return;
  for (const ticket of tickets) {
    if (ticket.ticket_number === ticketNumber) ticket.attachment_summary = summary;
  }
}

function updateUploadProgress(uploader, percent, text = "") {
  const progress = uploader?.querySelector(".ticket-upload-progress");
  const bar = uploader?.querySelector("[data-ticket-upload-bar]");
  const status = uploader?.querySelector("[data-ticket-file-status]");
  if (progress) progress.hidden = false;
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (status && text) status.textContent = text;
}

function uploadTicketAttachments(ticketNumber, fileList, uploader = null) {
  const files = [...(fileList || [])];
  if (!files.length) return Promise.resolve(null);
  if (files.length > 80) return Promise.reject(new Error("Select 80 attachments or fewer."));
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.set("ticket", ticketNumber);
    for (const file of files) data.append("files", file, file.name);
    const xhr = new XMLHttpRequest();
    const uploadButton = uploader?.querySelector("[data-ticket-upload-button]");
    const chooseButton = uploader?.querySelector("[data-ticket-file-button]");
    if (uploadButton) uploadButton.disabled = true;
    if (chooseButton) chooseButton.disabled = true;
    updateUploadProgress(uploader, 2, `Preparing ${files.length} attachment${files.length === 1 ? "" : "s"}...`);
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        updateUploadProgress(uploader, 35, "Uploading attachments...");
        return;
      }
      const percent = Math.min(90, Math.round((event.loaded / event.total) * 90));
      updateUploadProgress(uploader, percent, `Uploading ${percent}%...`);
    });
    xhr.addEventListener("load", async () => {
      try {
        const payload = JSON.parse(xhr.responseText || "{}");
        if (xhr.status < 200 || xhr.status >= 300 || payload.ok === false) {
          throw new Error(payload.message || `Upload failed: ${xhr.status}`);
        }
        updateUploadProgress(uploader, 96, "Saving OneDrive folder link...");
        updateTicketAttachmentSummary(ticketNumber, payload.attachment_summary);
        await loadTicketAttachments(ticketNumber, true);
        updateUploadProgress(uploader, 100, "Upload complete.");
        const input = uploader?.querySelector("[data-ticket-file-input]");
        if (input) input.value = "";
        render();
        resolve(payload);
      } catch (error) {
        reject(error);
      } finally {
        if (uploadButton) uploadButton.disabled = false;
        if (chooseButton) chooseButton.disabled = false;
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed before reaching the server.")));
    xhr.open("POST", "/api/attachments");
    xhr.send(data);
  });
}

function mobileAttachmentListHtml(ticketNumber) {
  const items = attachmentCache[ticketNumber];
  if (!Array.isArray(items)) return '<p class="mobile-muted">Loading attachments...</p>';
  if (!items.length) return '<p class="mobile-muted">No photos or videos attached yet.</p>';
  const folder = ticketAttachmentSummary(ticketNumber).folder_url;
  return `
    <div class="mobile-attachments">
      ${folder ? `<a href="${escapeHtml(folder)}" target="_blank" rel="noreferrer"><strong>Open OneDrive ticket folder</strong><span>${escapeHtml(ticketNumber)}</span></a>` : ""}
      ${items.map((item) => `
        <a href="${escapeHtml(item.url || "#")}" target="_blank" rel="noreferrer">
          <strong>${escapeHtml(item.original_name || "Attachment")}</strong>
          <span>${escapeHtml(item.uploaded_at || "")} · ${escapeHtml(attachmentSizeLabel(item.size))}</span>
          ${item.note ? `<em>${escapeHtml(item.note)}</em>` : ""}
        </a>
      `).join("")}
    </div>
  `;
}

function mobileTicketCardHtml(ticket) {
  const selected = selectedTicket?.ticket_number === ticket.ticket_number;
  const priorityClasses = ticketPriorityClasses(ticket);
  const dueStatus = ticketDueStatus(ticket);
  const actionLabels = ticketActionLabels(ticket.ticket_number);
  const completed = ticketIsActionHidden(ticket);
  return `
    <button class="mobile-ticket-card ${priorityClasses} ${selected ? "active" : ""}" type="button" data-mobile-ticket="${escapeHtml(ticket.ticket_number)}">
      <span class="mobile-card-topline">
        <span class="mobile-ticket-number">${escapeHtml(ticket.ticket_number)}</span>
        <span class="mobile-status-pill mobile-status-${escapeHtml(completed ? "done" : dueStatus)}">${escapeHtml(completed ? "Done" : dueStatusLabel(dueStatus))}</span>
      </span>
      <span class="mobile-card-meta">${escapeHtml(ticket.county || "UNKNOWN")} · ${escapeHtml(ticket.work_begin_date || "")} ${escapeHtml(ticket.work_begin_time || "")}</span>
      <strong>${escapeHtml(workDescription(ticket))}</strong>
      <small>${escapeHtml(ticketAddress(ticket))}</small>
      ${actionLabels.length ? `<span class="mobile-action-pills">${actionLabels.map((label) => `<i>${escapeHtml(label)}</i>`).join("")}</span>` : ""}
    </button>
  `;
}

function mobileOpenTickets() {
  return fieldOpenTickets()
    .sort((a, b) => compareTicketsByDate(a, b, "asc"));
}

function mobileDoneTickets() {
  return tickets
    .filter((ticket) => ticketIsActionHidden(ticket))
    .sort((a, b) => compareTicketsByDate(a, b, "desc"));
}

function mobileDigTickets() {
  return sheetTickets();
}

function mobilePanelTickets() {
  if (mobilePanel === "map") return fieldOpenTickets();
  if (mobilePanel === "dig") return mobileDigTickets();
  if (mobilePanel === "done") return mobileDoneTickets();
  return mobileOpenTickets();
}

function setMobilePanel(panel) {
  const previousPanel = mobilePanel;
  mobilePanel = ["map", "done", "dig"].includes(panel) ? panel : "tickets";
  if (mobilePanel !== "map") {
    document.body.classList.remove("mobile-map-ticket-open");
  } else if (previousPanel !== "map") {
    document.body.classList.remove("mobile-detail-open", "mobile-map-ticket-open");
    mobileMapHasFit = false;
  }
  localStorage.setItem("mobilePanel", mobilePanel);
  renderMobileView();
}

function dueStatusLabel(status) {
  if (status === "due-today") return "Today";
  if (status === "due-next") return "Soon";
  if (status === "due-later") return "Later";
  return "Open";
}

function mobileTicketIndex(ticketNumber) {
  return mobilePanelTickets().findIndex((ticket) => ticket.ticket_number === ticketNumber);
}

function selectMobileTicketByOffset(offset) {
  const list = mobilePanelTickets();
  if (!list.length) return;
  const currentIndex = Math.max(0, mobileTicketIndex(selectedTicket?.ticket_number || ""));
  const nextIndex = Math.max(0, Math.min(list.length - 1, currentIndex + offset));
  selectedTicket = list[nextIndex];
  pendingSelectedTicketNumber = selectedTicket?.ticket_number || "";
  localStorage.setItem("selectedTicketNumber", pendingSelectedTicketNumber);
  document.body.classList.add("mobile-detail-open");
  renderMobileView();
  scheduleDashboardStateSave();
}

function mobileDetailProgress(ticketNumber) {
  const list = mobilePanelTickets();
  const index = list.findIndex((ticket) => ticket.ticket_number === ticketNumber);
  if (index < 0) return "";
  return `${(index + 1).toLocaleString()} of ${list.length.toLocaleString()}`;
}

function renderMobileView() {
  if (!elements.mobileView || currentView !== "mobile") return;
  const openList = mobileOpenTickets();
  const doneList = mobileDoneTickets();
  const digList = mobileDigTickets();
  const list = mobilePanelTickets();
  const mapDetailOpen = mobilePanel === "map" && document.body.classList.contains("mobile-map-ticket-open") && selectedTicket;
  document.body.classList.toggle("mobile-map-open", mobilePanel === "map");
  if (elements.mobileSummary) {
    elements.mobileSummary.textContent = `${openList.length.toLocaleString()} open · ${doneList.length.toLocaleString()} done · ${digList.length.toLocaleString()} dig`;
  }
  if (elements.mobileOpenCount) elements.mobileOpenCount.textContent = openList.length.toLocaleString();
  if (elements.mobileMapCount) elements.mobileMapCount.textContent = visibleTickets().length.toLocaleString();
  if (elements.mobileDoneCount) elements.mobileDoneCount.textContent = doneList.length.toLocaleString();
  if (elements.mobileDigCount) elements.mobileDigCount.textContent = digList.length.toLocaleString();
  if (elements.mobilePanelTabs) {
    for (const button of elements.mobilePanelTabs.querySelectorAll("[data-mobile-panel]")) {
      button.classList.toggle("active", button.dataset.mobilePanel === mobilePanel);
    }
  }
  if (elements.mobileTicketList) elements.mobileTicketList.hidden = mobilePanel === "map";
  if (elements.mobileMapPanel) elements.mobileMapPanel.hidden = mobilePanel !== "map";
  if (elements.mobileTicketDetail) elements.mobileTicketDetail.hidden = mobilePanel === "map" && !mapDetailOpen;
  if (mobilePanel !== "map" && (!selectedTicket || !list.some((ticket) => ticket.ticket_number === selectedTicket.ticket_number))) {
    selectedTicket = list[0] || null;
  }
  if (elements.mobileTicketList) {
    elements.mobileTicketList.innerHTML = list.length
      ? list.map(mobileTicketCardHtml).join("")
      : '<div class="mobile-empty">No tickets match the current filters.</div>';
  }
  renderMobileTicketDetail();
  renderMobileMap(visibleTickets());
  bindMobileView();
}

function initMobileMap() {
  if (mobileMap || !elements.mobileFieldMap || typeof L === "undefined") return;
  mobileMap = L.map(elements.mobileFieldMap, { zoomControl: true, preferCanvas: true }).setView([33.23, -92.67], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    subdomains: "abc",
    maxZoom: 20,
  }).addTo(mobileMap);
  mobileMapMarkers = L.layerGroup().addTo(mobileMap);
  mobileMapPolygons = L.layerGroup().addTo(mobileMap);
  mobileMapUserLayer = L.layerGroup().addTo(mobileMap);
  mobileMap.on("click", () => {
    if (mobileMeasureTool?.active) return;
    clearSelectedTicket();
    document.body.classList.remove("mobile-map-ticket-open");
    renderMobileView();
  });
  mobileMeasureTool = createMeasureTool({
    map: mobileMap,
    toggleButton: elements.mobileMeasureToggle,
    clearButton: elements.mobileMeasureClear,
    unitSelect: elements.mobileMeasureUnit,
    statusElement: elements.mobileMeasureStatus,
    label: "Measure",
    onChange: () => renderMobileMap(visibleTickets()),
  });
}

function renderMobileMap(list = []) {
  if (mobilePanel !== "map" || !elements.mobileFieldMap) return;
  initMobileMap();
  if (!mobileMap || !mobileMapMarkers) return;
  mobileMapMarkers.clearLayers();
  if (mobileMapPolygons) mobileMapPolygons.clearLayers();
  if (mobileMapVetroLayer) {
    mobileMap.removeLayer(mobileMapVetroLayer);
    mobileMapVetroLayer = null;
  }
  const bounds = [];
  const focusedPolygonBounds = selectedPolygonFocusBounds(mobileMap);
  const measuring = Boolean(mobileMeasureTool?.active);
  for (const ticket of list) {
    if (ticket.polygon && mobileMapPolygons) {
      const dueColors = ticketMapColors(ticket);
      const selected = selectedTicket?.ticket_number === ticket.ticket_number;
      const dimmedBySelection = shouldDimNearSelectedPolygon(ticket, focusedPolygonBounds);
      const fillOpacity = dimmedBySelection
        ? NEARBY_POLYGON_DIM_OPACITY
        : dueColors.fillOpacity;
      const strokeOpacity = dimmedBySelection ? NEARBY_POLYGON_DIM_STROKE_OPACITY : 0.96;
      const polygon = L.geoJSON(ticket.polygon, {
        style: {
          color: dueColors.stroke,
          fillColor: dueColors.fill,
          fillOpacity: measuring ? Math.min(fillOpacity, 0.08) : fillOpacity,
          opacity: measuring ? 0.28 : strokeOpacity,
          weight: measuring ? 2 : (selected ? 6 : 4),
        },
      });
      polygon.bindPopup(`<strong>${escapeHtml(ticket.ticket_number)}</strong><br>${escapeHtml(ticketAddress(ticket) || "GeoCall polygon")}`);
      polygon.on("click", (event) => {
        if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
        if (mobileMeasureTool?.active) {
          mobileMeasureTool.addPoint(event.latlng);
          return;
        }
        selectedTicket = ticket;
        pendingSelectedTicketNumber = ticket.ticket_number;
        localStorage.setItem("selectedTicketNumber", pendingSelectedTicketNumber);
        document.body.classList.add("mobile-map-ticket-open");
        renderMobileView();
        scheduleDashboardStateSave();
      });
      polygon.addTo(mobileMapPolygons);
      polygon.eachLayer((layer) => {
        if (!layer.getBounds) return;
        const layerBounds = layer.getBounds();
        bounds.push([layerBounds.getSouth(), layerBounds.getWest()]);
        bounds.push([layerBounds.getNorth(), layerBounds.getEast()]);
      });
    }
    if (!Number.isFinite(Number(ticket.latitude)) || !Number.isFinite(Number(ticket.longitude))) continue;
    const colors = ticketMapColors(ticket);
    const latlng = [Number(ticket.latitude), Number(ticket.longitude)];
    const markerDimmedBySelection = shouldDimNearSelectedPolygon(ticket, focusedPolygonBounds);
    const marker = L.circleMarker(latlng, {
      radius: selectedTicket?.ticket_number === ticket.ticket_number ? 10 : 7,
      color: colors.stroke,
      fillColor: colors.fill,
      opacity: markerDimmedBySelection ? NEARBY_POLYGON_DIM_STROKE_OPACITY : 0.95,
      fillOpacity: markerDimmedBySelection ? NEARBY_POLYGON_DIM_OPACITY : 0.85,
      weight: selectedTicket?.ticket_number === ticket.ticket_number ? 5 : 3,
    }).addTo(mobileMapMarkers);
    marker.bindPopup(`<strong>${escapeHtml(ticket.ticket_number)}</strong><br>${escapeHtml(ticketAddress(ticket))}`);
    marker.on("click", (event) => {
      if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
      selectedTicket = ticket;
      pendingSelectedTicketNumber = ticket.ticket_number;
      localStorage.setItem("selectedTicketNumber", pendingSelectedTicketNumber);
      document.body.classList.add("mobile-map-ticket-open");
      renderMobileView();
      scheduleDashboardStateSave();
    });
    bounds.push(latlng);
  }
  if (!vetroGeojson) {
    void ensureVetroLoaded().then(() => {
      if (currentView === "mobile" && mobilePanel === "map") renderMobileMap(list);
    }).catch((error) => console.warn(error));
  } else if (vetroGeojson) {
    const filtered = filteredVetroGeojson();
    if (filtered) {
      mobileMapVetroLayer = L.geoJSON(filtered, {
        style: vetroStyle,
        pointToLayer: vetroPointToLayer,
        onEachFeature: bindVetroPopup,
      }).addTo(mobileMap);
      mobileMapVetroLayer.eachLayer((layer) => {
        if (!layer.getBounds) return;
        const layerBounds = layer.getBounds();
        if (!layerBounds?.isValid?.()) return;
        bounds.push([layerBounds.getSouth(), layerBounds.getWest()]);
        bounds.push([layerBounds.getNorth(), layerBounds.getEast()]);
      });
    }
  }
  requestAnimationFrame(() => {
    mobileMap.invalidateSize();
    if (!mobileMapHasFit && bounds.length) {
      mobileMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      mobileMapHasFit = true;
    }
  });
}

function fitMobileMapToTickets() {
  mobileMapHasFit = false;
  document.body.classList.remove("mobile-map-ticket-open");
  renderMobileMap(visibleTickets());
}

function renderMobileTicketDetail() {
  if (!elements.mobileTicketDetail) return;
  if (!selectedTicket) {
    elements.mobileTicketDetail.innerHTML = '<div class="mobile-empty">Select a ticket</div>';
    return;
  }
  const ticket = selectedTicket;
  const mapsUrl = ticketGoogleMapsUrl(ticket, false);
  const navUrl = ticketGoogleMapsUrl(ticket, true);
  const embedUrl = ticketGoogleMapsEmbedUrl(ticket);
  const phoneUrl = phoneHref(ticket.contact_phone || ticket.company_phone);
  const progress = mobileDetailProgress(ticket.ticket_number);
  const actionLabels = ticketActionLabels(ticket.ticket_number);
  const completed = ticketIsActionHidden(ticket);
  const backLabel = mobilePanel === "map" ? "Map" : "Tickets";
  const attachedLocatorNotes = locatorNotesForTicket(ticket);
  const attachedLocationPhotos = locationPhotosForTicket(ticket);
  if (!Array.isArray(attachmentCache[ticket.ticket_number])) {
    void loadTicketAttachments(ticket.ticket_number).then(() => {
      if (currentView === "mobile" && selectedTicket?.ticket_number === ticket.ticket_number) renderMobileTicketDetail();
    });
  }
  elements.mobileTicketDetail.innerHTML = `
    <div class="mobile-detail-card ${ticketPriorityClasses(ticket)}">
      <div class="mobile-detail-head">
        <div>
          <h3>${escapeHtml(ticket.ticket_number)}</h3>
          <p>${escapeHtml(ticket.county)} · ${escapeHtml(ticket.message_type || ticket.work_type)}${progress ? ` · ${escapeHtml(progress)}` : ""}</p>
        </div>
        <button class="mobile-detail-back" type="button" data-mobile-back-to-list>${backLabel}</button>
        ${ticket.portal_html_available ? `<a href="/api/portal-html?ticket=${encodeURIComponent(ticket.ticket_number)}" target="_blank" rel="noreferrer">Ticket page</a>` : ""}
      </div>

      <div class="mobile-detail-summary">
        <span>${escapeHtml(dueStatusLabel(ticketDueStatus(ticket)))}</span>
        <span>${escapeHtml(ticket.county || "UNKNOWN")}</span>
        ${ticketIsTcwDmiWork(ticket) ? "<span>Priority company</span>" : ""}
        ${actionLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
      </div>

      <div class="mobile-map-preview">
        ${embedUrl ? `<iframe title="Ticket map" loading="lazy" src="${escapeHtml(embedUrl)}"></iframe>` : '<div class="mobile-empty">No map coordinates available</div>'}
      </div>
      <div class="mobile-action-row mobile-action-dock">
        ${navUrl ? `<a class="mobile-primary-action" href="${escapeHtml(navUrl)}" target="_blank" rel="noreferrer">Navigate</a>` : ""}
        <button class="mobile-complete-action" type="button" data-mobile-complete-ticket="${escapeHtml(ticket.ticket_number)}">${completed ? "Completed" : "Complete ticket"}</button>
        ${phoneUrl ? `<a class="mobile-secondary-action" href="${escapeHtml(phoneUrl)}">Call</a>` : ""}
        ${mapsUrl ? `<a class="mobile-secondary-action" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">Open Google Maps</a>` : ""}
        <button class="mobile-secondary-action" type="button" data-mobile-copy-ticket="${escapeHtml(ticket.ticket_number)}">Copy #</button>
        <button class="mobile-secondary-action" type="button" data-mobile-prev-ticket>Prev</button>
        <button class="mobile-secondary-action" type="button" data-mobile-next-ticket>Next</button>
      </div>

      <section>
        <h4>Work Description</h4>
        <div class="mobile-description">${escapeHtml(workDescription(ticket))}</div>
      </section>

      <section class="mobile-fields">
        ${htmlField("Address", mapLinkHtml(ticketAddress(ticket), ticket))}
        ${field("Intersection", ticket.nearest_intersection)}
        ${field("Begin", `${ticket.work_begin_date} ${ticket.work_begin_time}`)}
        ${field("Contractor", ticket.contractor)}
        ${field("Done For", ticket.done_for)}
        ${htmlField("Contact phone", contactLinkHtml(ticket.contact_phone || ticket.company_phone))}
        ${htmlField("Email", emailLinkHtml(ticket.contact_email))}
        ${htmlField("Coordinates", coordinateLinkHtml(ticket))}
      </section>

      <details class="mobile-raw-ticket">
        <summary>Raw ticket text</summary>
        <div class="raw">${linkifyContactText(ticket.raw_text)}</div>
      </details>

      <section>
        <h4>Actions</h4>
        ${actionControlHtml(ticket.ticket_number, true, { deferred: true })}
        <label class="mobile-note">
          Note / description
          <textarea data-ticket-description="${escapeHtml(ticket.ticket_number)}" rows="3" placeholder="Add locator notes">${escapeHtml(ticketDescription(ticket.ticket_number))}</textarea>
        </label>
      </section>

      ${attachedLocatorNotes.length ? `<section><h4>Locator notes attached</h4>${locatorNoteSummaryHtml(attachedLocatorNotes)}</section>` : ""}
      ${attachedLocationPhotos.length ? `<section><h4>Previous location photos</h4>${locationPhotoSummaryHtml(attachedLocationPhotos)}</section>` : ""}
      ${photoHistoryButtonHtml(ticket, attachedLocationPhotos)}

      <section>
        <h4>Photos & videos</h4>
        <form class="mobile-upload-form" data-mobile-upload="${escapeHtml(ticket.ticket_number)}">
          <input type="file" name="files" multiple accept="image/*,video/*,.jpg,.jpeg,.png,.heic,.heif,.mp4,.mov">
          <textarea name="note" rows="2" placeholder="Optional upload note"></textarea>
          <button type="submit">Upload to ticket</button>
        </form>
        <div class="mobile-attachment-list">${mobileAttachmentListHtml(ticket.ticket_number)}</div>
      </section>
    </div>
  `;
  bindTicketActionControls(elements.mobileTicketDetail);
  bindTicketDescriptionControls(elements.mobileTicketDetail);
  bindMobileDetailControls();
}

function bindMobileView() {
  if (!elements.mobileTicketList) return;
  for (const button of elements.mobileTicketList.querySelectorAll("[data-mobile-ticket]")) {
    button.addEventListener("click", () => {
      selectedTicket = tickets.find((ticket) => ticket.ticket_number === button.dataset.mobileTicket) || null;
      pendingSelectedTicketNumber = selectedTicket?.ticket_number || "";
      localStorage.setItem("selectedTicketNumber", pendingSelectedTicketNumber);
      if (mobilePanel === "map") {
        document.body.classList.add("mobile-map-ticket-open");
      }
      document.body.classList.add("mobile-detail-open");
      renderMobileView();
      scheduleDashboardStateSave();
    });
  }
}

function bindMobileDetailControls() {
  if (!elements.mobileTicketDetail) return;
  const backButton = elements.mobileTicketDetail.querySelector("[data-mobile-back-to-list]");
  if (backButton) {
    backButton.addEventListener("click", () => {
      if (mobilePanel === "map") {
        document.body.classList.remove("mobile-map-ticket-open");
      } else {
        document.body.classList.remove("mobile-detail-open");
      }
      renderMobileView();
    });
  }
  const dashboardButton = elements.mobileTicketDetail.querySelector("[data-mobile-show-dashboard]");
  if (dashboardButton) {
    dashboardButton.addEventListener("click", () => {
      const ticketNumber = dashboardButton.dataset.mobileShowDashboard;
      setCurrentView("dashboard");
      selectTicket(ticketNumber, { focus: true });
    });
  }
  const copyButton = elements.mobileTicketDetail.querySelector("[data-mobile-copy-ticket]");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const ticketNumber = copyButton.dataset.mobileCopyTicket || "";
      try {
        await navigator.clipboard.writeText(ticketNumber);
        showSavedToast(`Copied ${ticketNumber}`);
      } catch (error) {
        window.prompt("Copy ticket number", ticketNumber);
      }
    });
  }
  const completeButton = elements.mobileTicketDetail.querySelector("[data-mobile-complete-ticket]");
  if (completeButton) {
    completeButton.addEventListener("click", () => {
      const ticketNumber = completeButton.dataset.mobileCompleteTicket;
      setTicketActions(ticketNumber, ["located"]);
      showSavedToast(`${ticketNumber} completed`);
      document.body.classList.remove("mobile-detail-open");
      renderMobileView();
    });
  }
  const prevButton = elements.mobileTicketDetail.querySelector("[data-mobile-prev-ticket]");
  if (prevButton) prevButton.addEventListener("click", () => selectMobileTicketByOffset(-1));
  const nextButton = elements.mobileTicketDetail.querySelector("[data-mobile-next-ticket]");
  if (nextButton) nextButton.addEventListener("click", () => selectMobileTicketByOffset(1));
  for (const button of elements.mobileTicketDetail.querySelectorAll("[data-photo-history-ticket]")) {
    button.addEventListener("click", () => openPhotoHistoryForTicket(button.dataset.photoHistoryTicket || ""));
  }
  for (const form of elements.mobileTicketDetail.querySelectorAll("[data-mobile-upload]")) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const ticketNumber = form.dataset.mobileUpload;
      const fileInput = form.querySelector('input[type="file"]');
      if (!fileInput?.files?.length) return;
      const button = form.querySelector('button[type="submit"]');
      if (button) {
        button.disabled = true;
        button.textContent = "Uploading...";
      }
      try {
        await uploadTicketAttachments(ticketNumber, fileInput.files, form);
        form.reset();
      } catch (error) {
        alert(error.message || "Upload failed");
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = "Upload to ticket";
        }
        renderMobileTicketDetail();
      }
    });
  }
}

function liveTickets() {
  return visibleTickets()
    .filter((ticket) => !ticketHasActions(ticket.ticket_number))
    .sort((a, b) => compareTicketsByDate(a, b, "asc"));
}

function liveTicketRowHtml(ticket, index, count) {
  const mapsUrl = ticketGoogleMapsUrl(ticket, false);
  const due = ticketDueText(ticket) || "No due date";
  const selected = selectedTicket?.ticket_number === ticket.ticket_number;
  return `
    <button class="live-ticket-row ${ticketPriorityClasses(ticket)} ${selected ? "active" : ""}" type="button" data-live-ticket="${escapeHtml(ticket.ticket_number)}">
      <span class="live-ticket-row-head">
        <strong>${escapeHtml(ticket.ticket_number)}</strong>
        <span class="live-ticket-status">${(index + 1).toLocaleString()} of ${count.toLocaleString()}</span>
      </span>
      <span class="live-ticket-meta">
        <span>${escapeHtml(due)}</span>
        <span>${escapeHtml(ticket.county || "UNKNOWN")}</span>
        <span>${escapeHtml(ticket.message_type || ticket.work_type || "Ticket")}</span>
        ${ticket.polygon ? "<span>Polygon</span>" : ""}
      </span>
      <p>${escapeHtml(ticketAddress(ticket) || "No address listed")}</p>
      <p>${escapeHtml(ticket.contractor || ticket.done_for || ticket.caller || "No contractor listed")}</p>
      <span class="live-ticket-actions">
        ${ticket.portal_html_available ? `<span class="live-ticket-status">Ticket page ready</span>` : ""}
        ${mapsUrl ? `<span class="live-ticket-status">Map link ready</span>` : ""}
      </span>
    </button>
  `;
}

function renderLiveTicketDetail() {
  if (!elements.liveTicketDetail) return;
  const list = liveTickets();
  if (!selectedTicket || !list.some((ticket) => ticket.ticket_number === selectedTicket.ticket_number)) {
    selectedTicket = list[0] || null;
  }
  if (!selectedTicket) {
    elements.liveTicketDetail.innerHTML = '<div class="live-ticket-empty">No live tickets need action right now.</div>';
    return;
  }
  const ticket = selectedTicket;
  const mapsUrl = ticketGoogleMapsUrl(ticket, false);
  const navUrl = ticketGoogleMapsUrl(ticket, true);
  elements.liveTicketDetail.innerHTML = `
    <div class="live-ticket-detail-card ${ticketPriorityClasses(ticket)}">
      <div>
        <h3>${escapeHtml(ticket.ticket_number)}</h3>
        <div class="live-ticket-meta">
          <span>${escapeHtml(ticketDueText(ticket) || "No due date")}</span>
          <span>${escapeHtml(ticket.county || "UNKNOWN")}</span>
          <span>${escapeHtml(ticket.message_type || ticket.work_type || "Ticket")}</span>
        </div>
      </div>
      <div class="live-ticket-actions">
        <button type="button" data-live-show-dashboard="${escapeHtml(ticket.ticket_number)}">Open on dashboard</button>
        ${navUrl ? `<a class="mobile-secondary-action" href="${escapeHtml(navUrl)}" target="_blank" rel="noreferrer">Navigate</a>` : ""}
        ${mapsUrl ? `<a class="mobile-secondary-action" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">Open Google Maps</a>` : ""}
        ${ticket.portal_html_available ? `<a class="mobile-secondary-action" href="/api/portal-html?ticket=${encodeURIComponent(ticket.ticket_number)}" target="_blank" rel="noreferrer">Ticket page</a>` : ""}
      </div>
      <section>
        <h4>Actions</h4>
        ${actionControlHtml(ticket.ticket_number, false, { deferred: true })}
      </section>
      <section>
        <h4>Work Description</h4>
        <div class="description-box">${escapeHtml(workDescription(ticket))}</div>
      </section>
      <section class="mobile-fields">
        ${htmlField("Address", mapLinkHtml(ticketAddress(ticket), ticket))}
        ${field("Intersection", ticket.nearest_intersection)}
        ${htmlField("Coordinates", coordinateLinkHtml(ticket))}
        ${field("Contractor", ticket.contractor)}
        ${field("Contact", ticket.contact)}
        ${htmlField("Contact phone", contactLinkHtml(ticket.contact_phone || ticket.company_phone))}
        ${htmlField("Email", emailLinkHtml(ticket.contact_email))}
        ${field("Done For", ticket.done_for)}
        ${field("Prepared", `${ticket.prepared_date || ""} ${ticket.prepared_time || ""}`.trim())}
        ${field("Work Begins", `${ticket.work_begin_date || ""} ${ticket.work_begin_time || ""}`.trim())}
        ${field("Extent", ticket.extent)}
        ${field("Work Type", ticket.work_type)}
        ${field("Directional Boring", ticket.directional_boring)}
        ${field("White Paint", ticket.white_paint)}
      </section>
      <label class="mobile-note">
        Note / description
        <textarea data-ticket-description="${escapeHtml(ticket.ticket_number)}" rows="3" placeholder="Add locator notes">${escapeHtml(ticketDescription(ticket.ticket_number))}</textarea>
      </label>
      <details class="mobile-raw-ticket">
        <summary>Raw ticket text</summary>
        <div class="raw">${linkifyContactText(ticket.raw_text)}</div>
      </details>
    </div>
  `;
  bindTicketActionControls(elements.liveTicketDetail);
  bindTicketDescriptionControls(elements.liveTicketDetail);
  const dashboardButton = elements.liveTicketDetail.querySelector("[data-live-show-dashboard]");
  if (dashboardButton) {
    dashboardButton.addEventListener("click", () => {
      setCurrentView("dashboard");
      selectTicket(dashboardButton.dataset.liveShowDashboard, { focus: true });
    });
  }
}

function renderLiveTicketsView() {
  if (!elements.liveTicketsView || currentView !== "live-tickets") return;
  const list = liveTickets();
  if (elements.liveTicketsSummary) {
    const filtered = ticketSearch.trim() ? " matching current search" : "";
    elements.liveTicketsSummary.textContent = `${list.length.toLocaleString()} live ticket${list.length === 1 ? "" : "s"}${filtered}, sorted soonest due first.`;
  }
  if (elements.liveTicketsSearch) elements.liveTicketsSearch.value = ticketSearch;
  if (elements.liveTicketsList) {
    elements.liveTicketsList.innerHTML = list.length
      ? list.map((ticket, index) => liveTicketRowHtml(ticket, index, list.length)).join("")
      : '<div class="live-ticket-empty">No live tickets need action with the current dashboard filters.</div>';
    for (const button of elements.liveTicketsList.querySelectorAll("[data-live-ticket]")) {
      button.addEventListener("click", () => {
        selectedTicket = tickets.find((ticket) => ticket.ticket_number === button.dataset.liveTicket) || null;
        pendingSelectedTicketNumber = selectedTicket?.ticket_number || "";
        localStorage.setItem("selectedTicketNumber", pendingSelectedTicketNumber);
        renderLiveTicketsView();
        scheduleDashboardStateSave();
      });
    }
  }
  renderLiveTicketDetail();
}

function renderDetail() {
  if (!selectedTicket) {
    elements.detail.hidden = true;
    elements.detail.classList.remove(
      "ticket-emergency-priority",
      "ticket-remark-priority",
      "ticket-renewal-priority",
      "ticket-tcw-dmi-work",
      "ticket-due-today",
      "ticket-due-next",
      "ticket-due-later",
      "ticket-actioned",
    );
    elements.detail.innerHTML = "";
    return;
  }

  const ticket = selectedTicket;
  const priorityClasses = ticketPriorityClasses(ticket);
  const attachedLocatorNotes = locatorNotesForTicket(ticket);
  const attachedLocationPhotos = locationPhotosForTicket(ticket);
  elements.detail.hidden = false;
  elements.detail.classList.toggle("ticket-emergency-priority", ticketIsEmergency(ticket));
  elements.detail.classList.toggle("ticket-remark-priority", ticketIsRemark(ticket));
  elements.detail.classList.toggle("ticket-renewal-priority", ticketIsRenewal(ticket));
  elements.detail.classList.toggle("ticket-tcw-dmi-work", ticketIsTcwDmiWork(ticket));
  elements.detail.classList.toggle("ticket-due-today", ticketDueStatus(ticket) === "due-today");
  elements.detail.classList.toggle("ticket-due-next", ticketDueStatus(ticket) === "due-next");
  elements.detail.classList.toggle("ticket-due-later", ticketDueStatus(ticket) === "due-later");
  elements.detail.classList.toggle("ticket-actioned", ticketHasActions(ticket.ticket_number));
	  elements.detail.innerHTML = `
	    <div class="detail-content ${priorityClasses}">
	      <div class="detail-head">
	        <h2>${escapeHtml(ticket.ticket_number)}</h2>
	        <button class="detail-close" type="button" data-close-ticket-detail aria-label="Close ticket detail" title="Close">x</button>
	      </div>
	      <div class="badge">${escapeHtml(ticket.county)} · ${escapeHtml(ticket.message_type)}</div>
      ${portalActions(ticket)}

      <h3>Actions</h3>
      ${actionControlHtml(ticket.ticket_number, false, { deferred: true, includeDescription: true })}

      <h3>Work Description</h3>
      <div class="description-box">${escapeHtml(workDescription(ticket))}</div>

      <h3>Locate</h3>
      ${htmlField("Address", mapLinkHtml(ticketAddress(ticket), ticket))}
      ${field("Intersection", ticket.nearest_intersection)}
      ${htmlField("Coordinates", coordinateLinkHtml(ticket))}
      ${field("GeoCall ID", ticket.portal_ticket_id)}
      ${linkField("Ticket page", ticketPageUrl(ticket), ticket.portal_html_available ? "Open cached ticket page" : "Open live ticket page")}
      ${field("Polygon", ticket.polygon ? "Loaded" : "Not loaded yet")}
      ${field("Work Type", ticket.work_type)}
      ${field("Directional Boring", ticket.directional_boring)}
      ${field("White Paint", ticket.white_paint)}
      ${attachedLocatorNotes.length ? `<h3>Locator Notes Attached</h3>${locatorNoteSummaryHtml(attachedLocatorNotes)}` : ""}
      ${attachedLocationPhotos.length ? `<h3>Previous Location Photos</h3>${locationPhotoSummaryHtml(attachedLocationPhotos)}` : ""}
      ${photoHistoryButtonHtml(ticket, attachedLocationPhotos)}

      <h3>Schedule</h3>
      ${field("Prepared", `${ticket.prepared_date} ${ticket.prepared_time}`)}
      ${field("Work Begins", `${ticket.work_begin_date} ${ticket.work_begin_time}`)}
      ${field("Extent", ticket.extent)}

      <h3>Contractor</h3>
      ${field("Contractor", ticket.contractor)}
      ${field("Caller", ticket.caller)}
      ${field("Contact", ticket.contact)}
      ${htmlField("Contact phone", contactLinkHtml(ticket.contact_phone))}
      ${htmlField("Company phone", contactLinkHtml(ticket.company_phone))}
      ${htmlField("Email", emailLinkHtml(ticket.contact_email))}
      ${field("Done For", ticket.done_for)}

      <h3>Raw Email Text</h3>
      <div class="raw">${linkifyContactText(ticket.raw_text)}</div>
    </div>
  `;
	  bindTicketActionControls(elements.detail);
	  bindTicketDescriptionControls(elements.detail);
	  const closeButton = elements.detail.querySelector("[data-close-ticket-detail]");
	  if (closeButton) closeButton.addEventListener("click", clearSelectedTicket);
    for (const button of elements.detail.querySelectorAll("[data-photo-history-ticket]")) {
      button.addEventListener("click", () => openPhotoHistoryForTicket(button.dataset.photoHistoryTicket || ""));
    }
}

function selectTicket(ticketNumber, options = {}) {
  const previousTicketNumber = selectedTicket?.ticket_number || "";
  selectedTicket = tickets.find((ticket) => ticket.ticket_number === ticketNumber) || null;
  pendingSelectedTicketNumber = selectedTicket?.ticket_number || "";
  localStorage.setItem("selectedTicketNumber", pendingSelectedTicketNumber);
  const list = visibleTickets();
  syncSelectedTicketCard(previousTicketNumber);
  renderMap(list);
  renderDetail();
  if (options.focus) {
    focusTicketOnMap(selectedTicket);
  }
  if (selectedTicket && options.popup !== false) {
    window.setTimeout(() => openTicketMapPopup(selectedTicket), options.focus ? 220 : 0);
  }
  scheduleDashboardStateSave();
}

function clearSelectedTicket() {
  if (!selectedTicket) return;
  selectedTicket = null;
  pendingSelectedTicketNumber = "";
  localStorage.removeItem("selectedTicketNumber");
  const list = visibleTickets();
  renderList(list);
  renderMap(list);
  renderDetail();
  scheduleDashboardStateSave();
}

function render() {
  captureTicketListScroll();
  const matching = matchingTickets();
  const list = visibleTickets();
  if (elements.sourcePath) {
    elements.sourcePath.textContent = elements.sourcePath.textContent.replace(/^(TCW Dashboard|One-Calls Done For TCW|Fiber Locator):/, "Fiber Locator:");
  }
  if (selectedTicket && !matching.some((ticket) => ticket.ticket_number === selectedTicket.ticket_number)) {
    selectedTicket = null;
    pendingSelectedTicketNumber = "";
    localStorage.removeItem("selectedTicketNumber");
  }
  renderMetrics(list);
  renderCountyFilter();
  renderList(matching);
  renderMap(list);
  renderDetail();
  if (currentView === "sheet") renderSheetView();
  if (currentView === "live-tickets") renderLiveTicketsView();
  if (currentView === "mobile") renderMobileView();
  restoreTicketListScroll();
  scheduleDashboardStateSave();
}

async function loadTickets() {
  const response = await fetch("/api/tickets");
  if (!response.ok) throw new Error(`Failed to load tickets: ${response.status}`);
  const payload = await response.json();
  tickets = Array.isArray(payload.tickets)
    ? payload.tickets.filter((ticket) => ACTIVE_COUNTIES.has(String(ticket.county || "").toUpperCase()))
    : [];
  const activeDashboardTickets = dashboardModeTickets();
  const scopedPolygonCount = activeDashboardTickets.filter((ticket) => ticket.polygon).length;
  const scopedMissingPolygonCount = activeDashboardTickets.length - scopedPolygonCount;
  const polygonStatus = scopedMissingPolygonCount
    ? `${scopedPolygonCount} polygon(s) loaded, ${scopedMissingPolygonCount} waiting on GeoCall cache`
    : `${scopedPolygonCount} polygon(s) loaded`;
  const modeLabel = "Fiber Locator";
  elements.sourcePath.textContent = `${modeLabel}: reading ${activeDashboardTickets.length} dashboard ticket(s) from ${payload.inbox_dir || payload.downloads_dir} - ${polygonStatus}`;
  if (pendingSelectedTicketNumber) {
    selectedTicket = tickets.find((ticket) => ticket.ticket_number === pendingSelectedTicketNumber) || null;
  }
  render();
  if (map && pendingMapView) {
    const center = pendingMapView.center;
    if (Array.isArray(center) && center.length === 2) {
      map.setView(center, pendingMapView.zoom || map.getZoom());
    } else if (center && typeof center.lat === "number" && typeof center.lng === "number") {
      map.setView([center.lat, center.lng], pendingMapView.zoom || map.getZoom());
    }
  }
}

async function loadVetroControls() {
  try {
    await ensureVetroLoaded();
    if (elements.vetroToggle.checked) {
      renderVetroLayer();
    }
  } catch (error) {
    elements.vetroStatus.textContent = "Error";
    console.error(error);
  }
}

elements.search.addEventListener("input", () => {
  updateTicketSearch(elements.search.value);
});
if (elements.ticketQuickSearch) {
  elements.ticketQuickSearch.addEventListener("input", () => {
    updateTicketSearch(elements.ticketQuickSearch.value);
  });
}
if (elements.sheetSearch) {
  elements.sheetSearch.addEventListener("input", () => {
    updateTicketSearch(elements.sheetSearch.value, { renderSheet: true });
  });
}
if (elements.liveTicketsSearch) {
  elements.liveTicketsSearch.addEventListener("input", () => {
    updateTicketSearch(elements.liveTicketsSearch.value);
    renderLiveTicketsView();
  });
}
elements.undoAction.addEventListener("click", undoLastChange);
elements.redoAction.addEventListener("click", redoLastChange);
elements.showSheetView.addEventListener("click", () => setCurrentView("sheet"));
if (elements.showRestorationView) elements.showRestorationView.addEventListener("click", () => setCurrentView("restoration"));
if (elements.showInHouseRequestsView) elements.showInHouseRequestsView.addEventListener("click", () => setCurrentView("in-house-requests"));
if (elements.showLocationPhotosView) elements.showLocationPhotosView.addEventListener("click", () => {
  setCurrentView("location-photos");
  closeMoreMenu();
  window.scrollTo({ top: 0, left: 0 });
});
if (elements.showLiveTicketsView) elements.showLiveTicketsView.addEventListener("click", () => setCurrentView("live-tickets"));
if (elements.showMobileView) elements.showMobileView.addEventListener("click", () => setCurrentView("mobile"));
elements.showDashboardView.addEventListener("click", () => setCurrentView("dashboard"));
if (elements.showMobileAdminView) elements.showMobileAdminView.addEventListener("click", () => setCurrentView("admin-console"));
if (elements.showActivityView) elements.showActivityView.addEventListener("click", () => setCurrentView("activity"));
if (elements.adminOpenActivityLog) elements.adminOpenActivityLog.addEventListener("click", () => setCurrentView("activity"));
if (elements.refreshActivity) elements.refreshActivity.addEventListener("click", () => {
  void loadActivity().catch((error) => {
    if (elements.activityList) elements.activityList.innerHTML = `<div class="detail-content">${escapeHtml(error.message)}</div>`;
    console.error(error);
  });
});
if (elements.downloadActivityCsv) elements.downloadActivityCsv.addEventListener("click", () => downloadActivityLog("csv"));
if (elements.downloadActivityExcel) elements.downloadActivityExcel.addEventListener("click", () => downloadActivityLog("excel"));
if (elements.downloadActivityJson) elements.downloadActivityJson.addEventListener("click", () => downloadActivityLog("json"));
if (elements.activityBackToDashboard) elements.activityBackToDashboard.addEventListener("click", () => setCurrentView("dashboard"));
if (elements.restorationBackToDashboard) elements.restorationBackToDashboard.addEventListener("click", () => setCurrentView("dashboard"));
if (elements.inHouseBackToDashboard) elements.inHouseBackToDashboard.addEventListener("click", () => setCurrentView("dashboard"));
if (elements.newRestorationJob) elements.newRestorationJob.addEventListener("click", () => openRestorationForm({}));
if (elements.restorationCancel) elements.restorationCancel.addEventListener("click", closeRestorationForm);
if (elements.restorationForm) elements.restorationForm.addEventListener("submit", (event) => {
  void saveRestorationJob(event).catch((error) => {
    if (elements.restorationFormStatus) elements.restorationFormStatus.textContent = error.message || "Save failed.";
    console.error(error);
  });
});
if (elements.restorationSearch) elements.restorationSearch.addEventListener("input", () => {
  restorationSearch = elements.restorationSearch.value;
  renderRestorationView();
});
if (elements.restorationPriorityFilter) elements.restorationPriorityFilter.addEventListener("change", () => {
  restorationPriorityFilter = elements.restorationPriorityFilter.value;
  renderRestorationView();
});
if (elements.restorationStatusFilter) elements.restorationStatusFilter.addEventListener("change", () => {
  restorationStatusFilter = elements.restorationStatusFilter.value;
  renderRestorationView();
});
if (elements.inHouseForm) elements.inHouseForm.addEventListener("submit", (event) => {
  void saveInHouseRequest(event).catch((error) => {
    if (elements.inHouseFormStatus) elements.inHouseFormStatus.textContent = error.message || "Save failed.";
    console.error(error);
  });
});
if (elements.inHouseNewRequest) elements.inHouseNewRequest.addEventListener("click", () => fillInHouseForm({}));
if (elements.inHouseRefreshRequests) {
  elements.inHouseRefreshRequests.addEventListener("click", () => {
    void loadInHouseRequests().then(renderInHouseRequestsView).catch((error) => {
      if (elements.inHouseFormStatus) elements.inHouseFormStatus.textContent = error.message || "Unable to refresh requests.";
      console.error(error);
    });
  });
}
if (elements.inHouseUseMapCenter) {
  elements.inHouseUseMapCenter.addEventListener("click", () => {
    ensureInHouseMap();
    if (!inHouseMap) return;
    const center = inHouseMap.getCenter();
    setInHouseMapPoint(center.lat, center.lng, "Map center selected", { pan: false });
  });
}
for (const input of [elements.inHouseLat, elements.inHouseLng]) {
  if (input) input.addEventListener("input", syncInHouseMapFromCoordinates);
}
for (const input of [elements.inHouseAddress, elements.inHousePlace, elements.inHouseCounty]) {
  if (input) input.addEventListener("input", () => scheduleInHouseMapSearch({ forceAddress: true }));
}
if (elements.locationPhotosBackToDashboard) elements.locationPhotosBackToDashboard.addEventListener("click", () => setCurrentView("dashboard"));
if (elements.refreshLocationPhotos) elements.refreshLocationPhotos.addEventListener("click", () => {
  void loadLocationPhotos().then(renderLocationPhotosView).catch((error) => {
    if (elements.locationPhotosStatus) elements.locationPhotosStatus.textContent = error.message || "Unable to refresh location photos.";
    console.error(error);
  });
});
if (elements.exportLocationPhotosCsv) elements.exportLocationPhotosCsv.addEventListener("click", () => downloadLocationPhotos("csv"));
if (elements.exportLocationPhotosZip) elements.exportLocationPhotosZip.addEventListener("click", () => downloadLocationPhotos("zip"));
if (elements.locationPhotosForm) elements.locationPhotosForm.addEventListener("submit", uploadLocationPhotos);
if (elements.mobileAdminBackToDashboard) elements.mobileAdminBackToDashboard.addEventListener("click", () => setCurrentView("dashboard"));
if (elements.publishMobileConfig) elements.publishMobileConfig.addEventListener("click", publishMobileConfig);
if (elements.copyMobileAppLink) elements.copyMobileAppLink.addEventListener("click", () => copyText(mobileAppUrl(), "Mobile app link copied"));
if (elements.employeeInviteForm) elements.employeeInviteForm.addEventListener("submit", createEmployeeInvite);
if (elements.adminTicketFetchForm) elements.adminTicketFetchForm.addEventListener("submit", runAdminTicketFetch);
if (elements.showEmployeeView) elements.showEmployeeView.addEventListener("click", () => setProfileMode("employee"));
if (elements.showAdminView) elements.showAdminView.addEventListener("click", () => setProfileMode("admin"));
if (elements.showSettingsMenu) {
  elements.showSettingsMenu.addEventListener("click", (event) => {
    event.stopPropagation();
    if (elements.settingsPanel?.hidden) showSettingsPanel();
    else hideSettingsPanel();
  });
}
if (elements.settingsFlyout) {
  elements.settingsFlyout.addEventListener("mouseenter", cancelSettingsPanelClose);
  elements.settingsFlyout.addEventListener("mouseleave", scheduleSettingsPanelClose);
  elements.settingsFlyout.addEventListener("focusin", cancelSettingsPanelClose);
  elements.settingsFlyout.addEventListener("focusout", (event) => {
    if (!elements.settingsFlyout.contains(event.relatedTarget)) scheduleSettingsPanelClose();
  });
}
if (elements.refreshOneDriveStatus) elements.refreshOneDriveStatus.addEventListener("click", () => void refreshOneDriveStatus());
if (elements.connectOneDrive) elements.connectOneDrive.addEventListener("click", () => void connectOneDrive());
if (elements.openPhotoManager) elements.openPhotoManager.addEventListener("click", () => {
  setCurrentView("location-photos");
  hideSettingsPanel();
});
if (elements.downloadPhotoCsv) elements.downloadPhotoCsv.addEventListener("click", () => downloadLocationPhotos("csv"));
if (elements.downloadPhotoZip) elements.downloadPhotoZip.addEventListener("click", () => downloadLocationPhotos("zip"));
if (elements.savePhotoSettings) elements.savePhotoSettings.addEventListener("click", () => void savePhotoSettings());
if (elements.deployAppUpdate) elements.deployAppUpdate.addEventListener("click", () => void deployAppUpdate());
elements.sheetBackToDashboard.addEventListener("click", () => setCurrentView("dashboard"));
if (elements.liveTicketsBackToDashboard) elements.liveTicketsBackToDashboard.addEventListener("click", () => setCurrentView("dashboard"));
if (elements.exportSheetPdf) elements.exportSheetPdf.addEventListener("click", exportSheetPdf);
if (elements.exportSheetExcel) elements.exportSheetExcel.addEventListener("click", exportSheetExcel);
if (elements.exportSheetCsv) elements.exportSheetCsv.addEventListener("click", exportSheetCsv);
if (elements.mobileSearch) {
  elements.mobileSearch.addEventListener("input", () => {
    updateTicketSearch(elements.mobileSearch.value);
  });
}
if (elements.mobilePanelTabs) {
  for (const button of elements.mobilePanelTabs.querySelectorAll("[data-mobile-panel]")) {
    button.addEventListener("click", () => setMobilePanel(button.dataset.mobilePanel));
  }
}
if (elements.locateMe) elements.locateMe.addEventListener("click", requestUserLocation);
if (elements.mobileLocateMe) elements.mobileLocateMe.addEventListener("click", toggleLiveLocation);
if (elements.mobileFollowLocation) elements.mobileFollowLocation.addEventListener("click", toggleLiveLocation);
if (elements.mobileMapTickets) elements.mobileMapTickets.addEventListener("click", () => setMobilePanel("tickets"));
if (elements.mobileMapFitAll) elements.mobileMapFitAll.addEventListener("click", fitMobileMapToTickets);
if (elements.dashboardSatelliteToggle) elements.dashboardSatelliteToggle.addEventListener("click", () => void toggleDashboardSatellite().catch((error) => console.error(error)));
if (elements.dashboard3dToggle) {
  elements.dashboard3dToggle.addEventListener("click", () => {
    void toggleMap3d().catch((error) => {
      console.error(error);
      window.alert(error.message || "3D map failed.");
      disableMap3d();
    });
  });
}
if (elements.dashboard3dStyle) {
  elements.dashboard3dStyle.addEventListener("click", () => {
    setMap3dStyle(map3dStyle === "satellite" ? "standard" : "satellite");
  });
}
if (elements.dashboard3dTiltUp) {
  elements.dashboard3dTiltUp.addEventListener("click", () => {
    if (map3d) map3d.easeTo({ pitch: Math.min(80, map3d.getPitch() + 10), duration: 250 });
  });
}
if (elements.dashboard3dTiltDown) {
  elements.dashboard3dTiltDown.addEventListener("click", () => {
    if (map3d) map3d.easeTo({ pitch: Math.max(0, map3d.getPitch() - 10), duration: 250 });
  });
}
if (elements.dashboard3dRotate) {
  elements.dashboard3dRotate.addEventListener("click", () => {
    if (map3d) map3d.easeTo({ bearing: map3d.getBearing() + 45, duration: 350 });
  });
}
if (elements.mobileDeployAppUpdate) elements.mobileDeployAppUpdate.addEventListener("click", () => void deployAppUpdate());
if (elements.mobileSaveEmployeeDashboard) {
  elements.mobileSaveEmployeeDashboard.addEventListener("click", async () => {
    try {
      await saveEmployeeDashboard({ enabled: true, state: dashboardStatePayload({ employeeViewMode: "mobile" }), toast: true });
    } catch (error) {
      showSavedToast("Employee save failed");
      console.error(error);
    }
  });
}
if (elements.mapSearchForm) {
  elements.mapSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void runMapSearch().catch((error) => {
      console.error(error);
      window.alert(error.message || "Map search failed.");
    });
  });
}
if (elements.mobileRefresh) {
  elements.mobileRefresh.addEventListener("click", async () => {
    elements.mobileRefresh.disabled = true;
    elements.mobileRefresh.textContent = "Refreshing...";
    try {
      await loadDashboardState();
      await loadTickets();
    } finally {
      elements.mobileRefresh.disabled = false;
      elements.mobileRefresh.textContent = "Refresh";
    }
  });
}
if (elements.profileName) {
  elements.profileName.addEventListener("input", () => {
    locatorProfile.name = elements.profileName.value;
    saveProfile();
  });
}
if (elements.profileRole) {
  elements.profileRole.addEventListener("input", () => {
    locatorProfile.role = elements.profileRole.value;
    saveProfile();
  });
}
if (elements.profilePhoto) {
  elements.profilePhoto.addEventListener("change", async () => {
    const file = elements.profilePhoto.files?.[0];
    if (!file) return;
    try {
      locatorProfile.photo = await cropProfilePhoto(file);
      elements.profilePhoto.value = "";
      saveProfile();
    } catch (error) {
      alert(error.message || "Unable to load profile photo");
    }
  });
}
if (elements.clearProfilePhoto) {
  elements.clearProfilePhoto.addEventListener("click", () => {
    locatorProfile.photo = "";
    saveProfile();
  });
}
if (elements.profileLogout) {
  elements.profileLogout.addEventListener("click", () => {
    window.location.href = "/logout";
  });
}
if (elements.openProfileEditor) {
  elements.openProfileEditor.addEventListener("click", () => setProfileModalOpen(true));
}
if (elements.closeProfileEditor) {
  elements.closeProfileEditor.addEventListener("click", () => setProfileModalOpen(false));
}
if (elements.saveProfileEditor) {
  elements.saveProfileEditor.addEventListener("click", () => setProfileModalOpen(false));
}
if (elements.profileModal) {
  elements.profileModal.addEventListener("click", (event) => {
    if (event.target === elements.profileModal) setProfileModalOpen(false);
  });
}
elements.countyAll.addEventListener("click", () => {
  rememberUndoState();
  countyFilterAll = true;
  selectedCounties.clear();
  writeBooleanStorage(STORAGE_KEYS.countyFilterAll, countyFilterAll);
  writeJsonStorage(STORAGE_KEYS.countyFilterSelected, []);
  localStorage.removeItem("countyFilter");
  render();
  scheduleEmployeeDashboardSync();
});
elements.countyClear.addEventListener("click", () => {
  rememberUndoState();
  countyFilterAll = false;
  selectedCounties.clear();
  writeBooleanStorage(STORAGE_KEYS.countyFilterAll, countyFilterAll);
  writeJsonStorage(STORAGE_KEYS.countyFilterSelected, [...selectedCounties]);
  render();
  scheduleEmployeeDashboardSync();
});
if (elements.savedViewSelect) {
  elements.savedViewSelect.addEventListener("change", async () => {
    try {
      selectedSavedViewId = elements.savedViewSelect.value;
      localStorage.setItem(STORAGE_KEYS.savedViewSelected, selectedSavedViewId);
      if (selectedSavedViewId === NEW_SAVED_VIEW_OPTION) {
        updateSavedViewStatus("New view selected. Hit Save view to name it.");
        return;
      }
      const preset = selectedSavedView();
      updateSavedViewStatus(preset ? `Loading ${preset.name}...` : "");
      if (preset) {
        await applySavedViewState(preset.state);
        updateSavedViewStatus(`${preset.name} loaded`);
        showSavedToast(`${preset.name} loaded`);
      } else {
        updateSavedViewStatus();
      }
    } catch (error) {
      updateSavedViewStatus("View load failed");
      showSavedToast("View load failed");
      console.error(error);
    }
  });
}
if (elements.saveDashboardState) {
  elements.saveDashboardState.addEventListener("click", async () => {
    try {
      await saveDashboardCheckpoint();
    } catch (error) {
      showSavedToast("Dashboard save failed");
      console.error(error);
    }
  });
}
if (elements.saveView) {
  elements.saveView.addEventListener("click", async () => {
    try {
      const current = selectedSavedView();
      const name = window.prompt(
        current ? `Save over "${current.name}" or type a new view name` : "New view name",
        current?.name || "",
      );
      if (name === null) return;
      await saveNamedView(name);
    } catch (error) {
      updateSavedViewStatus("View save failed");
      showSavedToast("View save failed");
      console.error(error);
    }
  });
}
if (elements.saveSharedFieldDefault) {
  elements.saveSharedFieldDefault.addEventListener("click", async () => {
    try {
      await saveSharedFieldDefault();
    } catch (error) {
      showSavedToast("Field default save failed");
      console.error(error);
    }
  });
}
if (elements.saveEmployeeDashboard) {
  elements.saveEmployeeDashboard.addEventListener("click", async () => {
    try {
      await saveEmployeeDashboard({ enabled: true, state: dashboardStatePayload(), toast: true });
    } catch (error) {
      showSavedToast("Employee save failed");
      console.error(error);
    }
  });
}
if (elements.updateVetro) {
  elements.updateVetro.addEventListener("click", () => {
    void startVetroRefresh();
  });
}
if (elements.vetroCaptureFile && elements.vetroCaptureText) {
  elements.vetroCaptureFile.addEventListener("change", async () => {
    const file = elements.vetroCaptureFile.files?.[0];
    if (!file) return;
    pendingVetroCaptureFile = file;
    elements.vetroCaptureText.value = "";
    if (elements.vetroCaptureStatus) elements.vetroCaptureStatus.textContent = `${file.name} selected (${file.size.toLocaleString()} bytes). Hit Save capture.`;
  });
  elements.vetroCaptureText.addEventListener("input", () => {
    pendingVetroCaptureFile = null;
    elements.vetroCaptureFile.value = "";
  });
}
if (elements.saveVetroCapture) {
  elements.saveVetroCapture.addEventListener("click", () => {
    void saveVetroCapture();
  });
}
if (elements.appVetroLayerSelect) {
  elements.appVetroLayerSelect.addEventListener("change", () => {
    setAppVetroStyleLayer(elements.appVetroLayerSelect.value);
  });
}
if (elements.appVetroLayerSize) {
  elements.appVetroLayerSize.addEventListener("input", () => {
    updateAppVetroLayerSize(elements.appVetroLayerSize.value);
  });
}
if (elements.appVetroSizeValue) {
  elements.appVetroSizeValue.addEventListener("input", () => {
    updateAppVetroLayerSize(elements.appVetroSizeValue.value);
  });
  elements.appVetroSizeValue.addEventListener("change", () => {
    updateAppVetroLayerSize(elements.appVetroSizeValue.value);
  });
}
if (elements.appVetroLayerOpacity) {
  elements.appVetroLayerOpacity.addEventListener("input", () => {
    updateAppVetroLayerOpacity(elements.appVetroLayerOpacity.value);
  });
}
if (elements.appVetroOpacityValue) {
  elements.appVetroOpacityValue.addEventListener("input", () => {
    updateAppVetroLayerOpacity(elements.appVetroOpacityValue.value);
  });
  elements.appVetroOpacityValue.addEventListener("change", () => {
    updateAppVetroLayerOpacity(elements.appVetroOpacityValue.value);
  });
}
if (elements.appVetroLayerColor) {
  elements.appVetroLayerColor.addEventListener("input", () => {
    if (!appVetroStyleLayerId) return;
    rememberUndoState();
    setVetroLayerColorOverride(appVetroStyleLayerId, elements.appVetroLayerColor.value);
    renderAppVetroStyleEditor();
  });
}
if (elements.appVetroLayerStyle) {
  elements.appVetroLayerStyle.addEventListener("change", () => {
    updateAppVetroLayerStyle(elements.appVetroLayerStyle.value);
  });
}
if (elements.appVetroStyleEditor) {
  for (const button of elements.appVetroStyleEditor.querySelectorAll("[data-app-vetro-preset]")) {
    button.addEventListener("click", () => applyAppVetroPreset(button.dataset.appVetroPreset));
  }
}
if (elements.appVetroSaveView) {
  elements.appVetroSaveView.addEventListener("click", () => {
    void saveAppVetroStyleView();
  });
}
elements.refresh.addEventListener("click", refreshServerData);
elements.showHiddenToggle.addEventListener("change", () => {
  rememberUndoState();
  showHiddenTickets = elements.showHiddenToggle.checked;
  writeBooleanStorage(STORAGE_KEYS.showHidden, showHiddenTickets);
  render();
  scheduleEmployeeDashboardSync();
});
elements.polygonColor.addEventListener("change", () => {
  rememberUndoState();
  polygonColor = elements.polygonColor.value;
  localStorage.setItem("polygonColor", polygonColor);
  renderMap(visibleTickets());
  scheduleDashboardStateSave();
});
elements.polygonOpacity.addEventListener("input", () => {
  rememberUndoState();
  polygonOpacity = percentToOpacity(elements.polygonOpacity.value, polygonOpacity);
  localStorage.setItem("polygonOpacity", String(polygonOpacity));
  renderMap(visibleTickets());
  scheduleDashboardStateSave();
});
elements.ticketOpacity.addEventListener("input", () => {
  rememberUndoState();
  ticketOpacity = percentToOpacity(elements.ticketOpacity.value, ticketOpacity);
  localStorage.setItem(STORAGE_KEYS.ticketOpacity, String(ticketOpacity));
  renderMap(visibleTickets());
  scheduleDashboardStateSave();
});
elements.mapStyle.addEventListener("change", () => {
  rememberUndoState();
  auditEvent("map_style_changed", { style: elements.mapStyle.value });
  void setMapTileStyle(elements.mapStyle.value).catch((error) => console.error(error));
});
elements.vetroLayerFilter.addEventListener("input", (event) => {
  if (!canEditVetroAppearance()) return;
  if (event.target.matches(".layer-color")) {
    rememberUndoState();
    const layerId = event.target.dataset.layerColor;
    setVetroLayerColorOverride(layerId, event.target.value);
    return;
  }
  if (event.target.matches(".layer-color-hex")) {
    const layerId = event.target.dataset.layerColorHex;
    const value = normalizeHexColor(event.target.value);
    event.target.classList.toggle("invalid", Boolean(event.target.value.trim()) && !value);
    if (value) {
      rememberUndoState();
      setVetroLayerColorOverride(layerId, value);
    }
    return;
  }
  if (event.target.matches(".layer-size")) {
    rememberUndoState();
    const range = vetroLayerSizeRange(event.target.dataset.layerSize);
    vetroLayerSizeOverrides[event.target.dataset.layerSize] = clampNumber(event.target.value, range.min, range.max, vetroLayerSizeDefault(event.target.dataset.layerSize));
    vetroLayerSizeOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerSizes, vetroLayerSizeOverrides, (layerId, value) => Number.isFinite(Number(value)));
    renderVetroLayer();
    scheduleDashboardStateSave();
    scheduleEmployeeDashboardSync();
    return;
  }
  if (event.target.matches(".layer-opacity")) {
    rememberUndoState();
    vetroLayerOpacityOverrides[event.target.dataset.layerOpacity] = percentToOpacity(event.target.value, vetroOpacity);
    vetroLayerOpacityOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerOpacities, vetroLayerOpacityOverrides, (layerId, value) => Number.isFinite(Number(value)));
    renderVetroLayer();
    scheduleDashboardStateSave();
    scheduleEmployeeDashboardSync();
  }
});
elements.vetroLayerFilter.addEventListener("change", (event) => {
  if (!canEditVetroAppearance()) return;
  if (event.target.matches(".layer-color")) {
    return;
  }
  if (event.target.matches(".layer-color-hex")) {
    const layerId = event.target.dataset.layerColorHex;
    const value = normalizeHexColor(event.target.value);
    if (value) {
      rememberUndoState();
      setVetroLayerColorOverride(layerId, value);
    } else {
      event.target.value = colorForVetroLayer(layerId);
      event.target.classList.remove("invalid");
    }
    return;
  }
  if (event.target.matches(".layer-style")) {
    rememberUndoState();
    vetroLayerStyleOverrides[event.target.dataset.layerStyle] = event.target.value;
    vetroLayerStyleOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerStyles, vetroLayerStyleOverrides, (layerId, value) => vetroLayerStyleValid(layerId, value));
    renderVetroLayer();
    scheduleDashboardStateSave();
    scheduleEmployeeDashboardSync();
    return;
  }
  if (event.target.matches(".layer-alias")) {
    rememberUndoState();
    const layerId = event.target.dataset.layerAlias;
    const value = event.target.value.trim();
    if (value) vetroLayerNameOverrides[layerId] = value;
    else delete vetroLayerNameOverrides[layerId];
    vetroLayerNameOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerNames, vetroLayerNameOverrides, (id, item) => typeof item === "string");
    populateVetroFilters();
    renderVetroLayer();
    scheduleEmployeeDashboardSync();
    return;
  }
  if (event.target.matches(".layer-note")) {
    rememberUndoState();
    const layerId = event.target.dataset.layerNote;
    const value = event.target.value.trim();
    if (value) vetroLayerNoteOverrides[layerId] = value;
    else delete vetroLayerNoteOverrides[layerId];
    vetroLayerNoteOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerNotes, vetroLayerNoteOverrides, (id, item) => typeof item === "string");
    populateVetroFilters();
    renderVetroLayer();
    scheduleEmployeeDashboardSync();
    return;
  }
  rememberUndoState();
  syncVetroLayerSelection();
  renderVetroLayer();
  scheduleEmployeeDashboardSync();
});
elements.vetroLayerAll.addEventListener("click", () => {
  if (!canEditVetroAppearance()) return;
  rememberUndoState();
  setAllChecked(elements.vetroLayerFilter, true);
  syncVetroLayerSelection();
  renderVetroLayer();
  scheduleEmployeeDashboardSync();
});
elements.vetroLayerClear.addEventListener("click", () => {
  if (!canEditVetroAppearance()) return;
  rememberUndoState();
  setAllChecked(elements.vetroLayerFilter, false);
  syncVetroLayerSelection();
  renderVetroLayer();
  scheduleEmployeeDashboardSync();
});
[
  elements.vetroPlanFilter,
].filter(Boolean).forEach((container) => {
	  container.addEventListener("change", () => {
    if (!canEditVetroAppearance()) return;
    rememberUndoState();
    syncVetroFacetSelection();
    renderVetroLayer();
    scheduleEmployeeDashboardSync();
  });
});
[
  [elements.vetroPlanAll, elements.vetroPlanClear, elements.vetroPlanFilter],
].filter(([allButton, clearButton, container]) => allButton && clearButton && container).forEach(([allButton, clearButton, container]) => {
  allButton.addEventListener("click", () => {
    if (!canEditVetroAppearance()) return;
    setFilterChecked(container, true);
  });
  clearButton.addEventListener("click", () => {
    if (!canEditVetroAppearance()) return;
    setFilterChecked(container, false);
  });
});
elements.vetroSearch.addEventListener("input", () => {
  if (!canEditVetroAppearance()) return;
  rememberUndoState();
  syncVetroFacetSelection();
  renderVetroLayer();
  scheduleEmployeeDashboardSync();
});
if (elements.vetroSlToggle) {
	  elements.vetroSlToggle.addEventListener("change", () => {
    if (!canEditVetroAppearance()) return;
    rememberUndoState();
    vetroSlVisible = elements.vetroSlToggle.checked;
    writeBooleanStorage(STORAGE_KEYS.vetroSlVisible, vetroSlVisible);
    renderVetroLayer();
    scheduleEmployeeDashboardSync();
  });
}
if (elements.vetroSlShape) {
	  elements.vetroSlShape.addEventListener("change", () => {
    if (!canEditVetroAppearance()) return;
    rememberUndoState();
    vetroSlShape = elements.vetroSlShape.value;
    localStorage.setItem(STORAGE_KEYS.vetroSlShape, vetroSlShape);
    renderVetroLayer();
    scheduleEmployeeDashboardSync();
  });
}
if (elements.vetroSlColor) {
	  elements.vetroSlColor.addEventListener("change", () => {
    if (!canEditVetroAppearance()) return;
    rememberUndoState();
    vetroSlColor = elements.vetroSlColor.value;
    localStorage.setItem(STORAGE_KEYS.vetroSlColor, vetroSlColor);
    renderVetroLayer();
    scheduleDashboardStateSave();
    scheduleEmployeeDashboardSync();
  });
}
if (elements.vetroSlOutlineColor) {
	  elements.vetroSlOutlineColor.addEventListener("change", () => {
    if (!canEditVetroAppearance()) return;
    rememberUndoState();
    vetroSlOutlineColor = elements.vetroSlOutlineColor.value;
    localStorage.setItem(STORAGE_KEYS.vetroSlOutlineColor, vetroSlOutlineColor);
    renderVetroLayer();
    scheduleDashboardStateSave();
    scheduleEmployeeDashboardSync();
  });
}
if (elements.vetroSlOpacity) {
	  elements.vetroSlOpacity.addEventListener("input", () => {
    if (!canEditVetroAppearance()) return;
    rememberUndoState();
    vetroSlOpacity = percentToOpacity(elements.vetroSlOpacity.value, vetroSlOpacity);
    localStorage.setItem(STORAGE_KEYS.vetroSlOpacity, String(vetroSlOpacity));
    renderVetroLayer();
    scheduleDashboardStateSave();
    scheduleEmployeeDashboardSync();
  });
}
if (elements.vetroSlSize) {
	  elements.vetroSlSize.addEventListener("input", () => {
    if (!canEditVetroAppearance()) return;
    rememberUndoState();
    vetroSlSize = clampNumber(elements.vetroSlSize.value, 8, 22, vetroSlSize);
    localStorage.setItem(STORAGE_KEYS.vetroSlSize, String(vetroSlSize));
    renderVetroLayer();
    scheduleDashboardStateSave();
    scheduleEmployeeDashboardSync();
  });
}
if (elements.vetroSlLabels) {
	  elements.vetroSlLabels.addEventListener("change", () => {
    if (!canEditVetroAppearance()) return;
    rememberUndoState();
    vetroSlLabels = elements.vetroSlLabels.checked;
    writeBooleanStorage(STORAGE_KEYS.vetroSlLabels, vetroSlLabels);
    renderVetroLayer();
    scheduleEmployeeDashboardSync();
  });
}
elements.vetroColor.addEventListener("change", () => {
  if (!canEditVetroAppearance()) return;
  rememberUndoState();
  vetroColor = elements.vetroColor.value;
  localStorage.setItem("vetroColor", vetroColor);
  if (vetroLoaded) populateVetroFilters();
  renderVetroLayer();
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
});
elements.vetroOpacity.addEventListener("input", () => {
  rememberUndoState();
  vetroOpacity = percentToOpacity(elements.vetroOpacity.value, vetroOpacity);
  localStorage.setItem("vetroOpacity", String(vetroOpacity));
  renderVetroLayer();
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
});
elements.vetroToggle.addEventListener("change", async () => {
  if (!canEditVetroAppearance()) {
    elements.vetroToggle.checked = vetroVisible;
    return;
  }
  try {
    rememberUndoState();
    vetroVisible = elements.vetroToggle.checked;
    writeBooleanStorage(STORAGE_KEYS.vetroVisible, vetroVisible);
    await setVetroVisible(vetroVisible);
    scheduleEmployeeDashboardSync();
  } catch (error) {
    console.error(error);
  }
});
if (elements.vitruviLayerFilter) {
  elements.vitruviLayerFilter.addEventListener("input", (event) => {
    if (!isSiteOwner()) return;
    if (event.target.matches(".vitruvi-layer-color")) {
      rememberUndoState();
      setVitruviLayerColorOverride(event.target.dataset.vitruviLayerColor, event.target.value);
      return;
    }
    if (event.target.matches(".vitruvi-layer-color-hex")) {
      const layerId = event.target.dataset.vitruviLayerColorHex;
      const value = normalizeHexColor(event.target.value);
      event.target.classList.toggle("invalid", Boolean(event.target.value.trim()) && !value);
      if (value) {
        rememberUndoState();
        setVitruviLayerColorOverride(layerId, value);
      }
      return;
    }
    if (event.target.matches(".vitruvi-layer-size")) {
      rememberUndoState();
      const range = vitruviLayerSizeRange(event.target.dataset.vitruviLayerSize);
      vitruviLayerSizeOverrides[event.target.dataset.vitruviLayerSize] = clampNumber(event.target.value, range.min, range.max, vitruviLayerSizeDefault(event.target.dataset.vitruviLayerSize));
      vitruviLayerSizeOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerSizes, vitruviLayerSizeOverrides, (layerId, value) => Number.isFinite(Number(value)));
      renderVitruviLayer();
      scheduleDashboardStateSave();
      return;
    }
    if (event.target.matches(".vitruvi-layer-opacity")) {
      rememberUndoState();
      vitruviLayerOpacityOverrides[event.target.dataset.vitruviLayerOpacity] = percentToOpacity(event.target.value, vitruviOpacity);
      vitruviLayerOpacityOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerOpacities, vitruviLayerOpacityOverrides, (layerId, value) => Number.isFinite(Number(value)));
      renderVitruviLayer();
      scheduleDashboardStateSave();
    }
  });
  elements.vitruviLayerFilter.addEventListener("change", (event) => {
    if (!isSiteOwner()) return;
    if (event.target.matches(".vitruvi-layer-color")) return;
    if (event.target.matches(".vitruvi-layer-color-hex")) {
      const layerId = event.target.dataset.vitruviLayerColorHex;
      const value = normalizeHexColor(event.target.value);
      if (value) {
        rememberUndoState();
        setVitruviLayerColorOverride(layerId, value);
      } else {
        event.target.value = colorForVitruviLayer(layerId);
        event.target.classList.remove("invalid");
      }
      return;
    }
    if (event.target.matches(".vitruvi-layer-style")) {
      rememberUndoState();
      vitruviLayerStyleOverrides[event.target.dataset.vitruviLayerStyle] = event.target.value;
      vitruviLayerStyleOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerStyles, vitruviLayerStyleOverrides, (layerId, value) => vitruviLayerStyleValid(layerId, value));
      renderVitruviLayer();
      scheduleDashboardStateSave();
      return;
    }
    if (event.target.matches(".vitruvi-layer-alias")) {
      rememberUndoState();
      const layerId = event.target.dataset.vitruviLayerAlias;
      const value = event.target.value.trim();
      if (value) vitruviLayerNameOverrides[layerId] = value;
      else delete vitruviLayerNameOverrides[layerId];
      vitruviLayerNameOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerNames, vitruviLayerNameOverrides, (id, item) => typeof item === "string");
      populateVitruviFilters();
      renderVitruviLayer();
      scheduleDashboardStateSave();
      return;
    }
    if (event.target.matches(".vitruvi-layer-note-input")) {
      rememberUndoState();
      const layerId = event.target.dataset.vitruviLayerNote;
      const value = event.target.value.trim();
      if (value) vitruviLayerNoteOverrides[layerId] = value;
      else delete vitruviLayerNoteOverrides[layerId];
      vitruviLayerNoteOverrides = normalizeObjectStorage(STORAGE_KEYS.vitruviLayerNotes, vitruviLayerNoteOverrides, (id, item) => typeof item === "string");
      populateVitruviFilters();
      renderVitruviLayer();
      scheduleDashboardStateSave();
      return;
    }
    rememberUndoState();
    syncVitruviLayerSelection();
    renderVitruviLayer();
    scheduleDashboardStateSave();
  });
}
if (elements.vitruviLayerAll) {
  elements.vitruviLayerAll.addEventListener("click", () => {
    if (!isSiteOwner()) return;
    rememberUndoState();
    setAllChecked(elements.vitruviLayerFilter, true);
    syncVitruviLayerSelection();
    renderVitruviLayer();
    scheduleDashboardStateSave();
  });
}
if (elements.vitruviLayerClear) {
  elements.vitruviLayerClear.addEventListener("click", () => {
    if (!isSiteOwner()) return;
    rememberUndoState();
    setAllChecked(elements.vitruviLayerFilter, false);
    syncVitruviLayerSelection();
    renderVitruviLayer();
    scheduleDashboardStateSave();
  });
}
if (elements.vitruviSearch) {
  elements.vitruviSearch.addEventListener("input", () => {
    if (!isSiteOwner()) return;
    rememberUndoState();
    vitruviSearch = elements.vitruviSearch.value.trim();
    localStorage.setItem(STORAGE_KEYS.vitruviSearch, vitruviSearch);
    renderVitruviLayer();
    scheduleDashboardStateSave();
  });
}
if (elements.vitruviOpacity) {
  elements.vitruviOpacity.addEventListener("input", () => {
    if (!isSiteOwner()) return;
    rememberUndoState();
    vitruviOpacity = percentToOpacity(elements.vitruviOpacity.value, vitruviOpacity);
    localStorage.setItem(STORAGE_KEYS.vitruviOpacity, String(vitruviOpacity));
    renderVitruviLayer();
    if (vitruviLoaded) populateVitruviFilters();
    scheduleDashboardStateSave();
  });
}
if (elements.vitruviToggle) {
  elements.vitruviToggle.addEventListener("change", async () => {
    if (!isSiteOwner()) {
      elements.vitruviToggle.checked = false;
      return;
    }
    try {
      rememberUndoState();
      vitruviVisible = elements.vitruviToggle.checked;
      writeBooleanStorage(STORAGE_KEYS.vitruviVisible, vitruviVisible);
      await setVitruviVisible(vitruviVisible);
    } catch (error) {
      elements.vitruviStatus.textContent = "Error";
      console.error(error);
    }
  });
}
elements.sidebarCollapse.addEventListener("click", () => {
  rememberUndoState();
  setSidebarCollapsed(!sidebarCollapsed);
});
if (elements.ticketList) {
  elements.ticketList.addEventListener("scroll", applyTicketListScrolled, { passive: true });
}
if (elements.vetroDrawer) {
  elements.vetroDrawer.addEventListener("toggle", () => {
    if (elements.vetroDrawer.open) void ensureVetroControlsLoaded();
  });
}
if (elements.legendToggle) {
  elements.legendToggle.addEventListener("click", () => showMapLegendTemporarily(3200));
}
if (elements.addLocatorNote) {
  elements.addLocatorNote.addEventListener("click", () => {
    const nextActive = !locatorNoteMode;
    setLocatorNoteMode(nextActive);
    closeMoreMenu();
    showSavedToast(nextActive ? "Click a map spot or feature for the note" : "Locator note canceled");
  });
}
if (elements.locatorNoteForm) {
  elements.locatorNoteForm.addEventListener("submit", (event) => {
    submitLocatorNote(event).catch((error) => {
      if (elements.locatorNoteStatus) elements.locatorNoteStatus.textContent = error.message || "Unable to save locator note.";
      console.error(error);
    });
  });
}
if (elements.locatorNoteCancel) {
  elements.locatorNoteCancel.addEventListener("click", closeLocatorNoteModal);
}
if (elements.locatorNoteClose) {
  elements.locatorNoteClose.addEventListener("click", closeLocatorNoteModal);
}
const moreMenu = document.querySelector(".more-menu");
if (moreMenu) {
  moreMenu.addEventListener("mouseenter", cancelMoreMenuClose);
  moreMenu.addEventListener("mouseleave", scheduleMoreMenuClose);
  moreMenu.addEventListener("focusin", cancelMoreMenuClose);
  moreMenu.addEventListener("focusout", (event) => {
    if (!moreMenu.contains(event.relatedTarget)) scheduleMoreMenuClose();
  });
}
window.addEventListener("pagehide", flushTicketWorkflowState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushTicketWorkflowState();
});

async function bootstrap() {
  unregisterWebAppServiceWorkers();
  dashboardTicketMode = "main";
  localStorage.setItem("dashboardTicketMode", "main");
  document.body.classList.remove("tcw-dashboard-mode");
  if (elements.showTcwDashboardView) {
    elements.showTcwDashboardView.hidden = true;
  }
  closeDashboardLayerDrawers();
  await loadMapConfig();
  await loadDashboardState().catch((error) => {
    console.warn("Unable to load dashboard state", error);
  });
  renderPriorityLegends();
  renderProfile();
  initMap();
  await loadLocatorNotes();
  await loadLocationPhotos().catch((error) => console.warn("Unable to load location photos", error));
  applySidebarCollapsed();
  try {
    await loadTickets();
  } catch (error) {
    elements.ticketList.innerHTML = `<div class="detail-content">${escapeHtml(error.message)}</div>`;
    throw error;
  }
  if (window.location.hash === "#sheet") {
    setCurrentView("sheet");
  } else if (window.location.hash === "#restoration") {
    setCurrentView("restoration");
  } else if (window.location.hash === "#in-house-requests" || window.location.hash === "#inhouse") {
    setCurrentView("in-house-requests");
  } else if (window.location.hash === "#location-photos") {
    setCurrentView("location-photos");
  } else if (window.location.hash === "#live-tickets") {
    setCurrentView("live-tickets");
  } else if (window.location.hash === "#admin-console" || window.location.hash === "#mobile-admin") {
    setCurrentView("admin-console");
  } else if (window.location.hash === "#activity" || window.location.hash === "#app-dashboard-log") {
    setCurrentView("activity");
  }
  dashboardStateReady = true;
  updateHistoryButtons();
  scheduleDashboardStateSave();
  if (elements.vetroToggle.checked) {
    scheduleIdleTask(() => {
      void loadVetroControls().catch((error) => {
        elements.vetroStatus.textContent = "Error";
        console.error(error);
      });
    });
  } else if (elements.vetroStatus) {
    elements.vetroStatus.textContent = "Off";
  }
  scheduleDashboardStateSave();
}

function scheduleIdleTask(callback, timeout = 1600) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout });
  } else {
    window.setTimeout(callback, 0);
  }
}

async function ensureVetroControlsLoaded() {
  if (vetroLoaded) return;
  await loadVetroControls().catch((error) => {
      elements.vetroStatus.textContent = "Error";
      console.error(error);
  });
}

bootstrap().catch((error) => {
  elements.ticketList.innerHTML = `<div class="detail-content">${escapeHtml(error.message)}</div>`;
});
