let tickets = [];
let selectedTicket = null;
let map;
let baseTileLayer;
let mapDataOverlayLayer;
let mapDataOverlayAbort = 0;
let markers;
let polygons;
let vetroGeojson = null;
let vetroLayer = null;
let vetroLoaded = false;
let initialTicketBoundsApplied = false;
let currentView = "dashboard";
let currentProfileMode = "admin";
let adminPreviewState = null;
let sheetExpandedTickets = new Set();
let historicalDigTickets = null;
let historicalDigTicketError = "";
let historicalDigTicketSearch = "";
let attachmentCache = {};
let attachmentLoadingTickets = new Set();
let settingsCloseTimer = null;
let mapConfig = { googleMapsTileApiKey: "" };
const googleTileSessions = {};
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 40;
const STORAGE_KEYS = {
  hiddenTickets: "hiddenTickets",
  archivedTickets: "archivedTickets",
  ticketActions: "ticketActions",
  ticketDescriptions: "ticketDescriptions",
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
  vetroLayerStyles: "vetroLayerStyleOverrides",
  vetroLayerNames: "vetroLayerNameOverrides",
  vetroLayerNotes: "vetroLayerNoteOverrides",
  vetroLayerSizes: "vetroLayerSizeOverrides",
  vetroLayerOpacities: "vetroLayerOpacityOverrides",
  vetroSlVisible: "vetroSlVisible",
  vetroSlShape: "vetroSlShape",
  vetroSlColor: "vetroSlColor",
  vetroSlOutlineColor: "vetroSlOutlineColor",
  vetroSlOpacity: "vetroSlOpacity",
  vetroSlSize: "vetroSlSize",
  vetroSlLabels: "vetroSlLabels",
  vetroSearch: "vetroSearch",
  mapStyle: "mapStyle",
  mapDataOverlay: "mapDataOverlay",
  sidebarCollapsed: "sidebarCollapsed",
  ticketOpacity: "ticketOpacity",
  profile: "locatorProfile",
  sheetSort: "sheetSort",
  sheetColumnFilters: "sheetColumnFilters",
  sheetSavedFilters: "sheetSavedFilters",
};

const ACTIVE_COUNTIES = new Set(["UNION", "COLUMBIA"]);
const FOCUS_ZOOM_THRESHOLD = 14;
const FOCUS_TARGET_ZOOM = 17;
const MAP_TILE_STYLES = {
  standard: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    subdomains: "abc",
  },
  contrast: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
  },
  detailed: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, &copy; OpenTopoMap",
    subdomains: "abc",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  hybrid: {
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
  "google-roadmap": {
    provider: "google",
    mapType: "roadmap",
    attribution: "Map data &copy; Google",
  },
  "google-satellite": {
    provider: "google",
    mapType: "satellite",
    attribution: "Map data &copy; Google",
  },
  "google-hybrid": {
    provider: "google",
    mapType: "satellite",
    layerTypes: ["layerRoadmap"],
    overlay: false,
    attribution: "Map data &copy; Google",
  },
};

const TICKET_ACTIONS = [
  { key: "located", label: "Located", hidesFromDashboard: true },
  { key: "locate-delayed", label: "Locate delayed", hidesFromDashboard: false },
  { key: "clear", label: "Clear", hidesFromDashboard: true },
  { key: "in-conflict", label: "In conflict", hidesFromDashboard: true },
  { key: "cannot-locate", label: "Cannot locate", hidesFromDashboard: true },
  { key: "partially-located-large-project", label: "Partially located/large project", hidesFromDashboard: false },
  { key: "excavation-started", label: "An excavation started", hidesFromDashboard: true },
];

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
      googleMapsTileApiKey: String(payload.googleMapsTileApiKey || ""),
    };
  } catch (error) {
    console.warn("Unable to load map config", error);
    mapConfig = { googleMapsTileApiKey: "" };
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

function rememberUndoState() {
  if (!dashboardStateReady || dashboardStateHydrating) return;
  undoStack.push(cloneState(dashboardStatePayload()));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
  updateHistoryButtons();
}

function restoreDashboardStateSnapshot(state) {
  applyDashboardState(cloneState(state));
  render();
  renderVetroLayer();
  scheduleDashboardStateSave();
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
  const baseState = employeeDashboardState() || employeeFallbackState() || {};
  return {
    ...cloneState(baseState),
    vetroOpacity,
    ticketOpacity,
    mapStyle,
  };
}

function employeeDashboardStateFromAdminFilters() {
  const state = dashboardStatePayload();
  const current = employeeDashboardState() || {};
  return {
    ...state,
    vetroOpacity: typeof current.vetroOpacity === "number" ? current.vetroOpacity : state.vetroOpacity,
    ticketOpacity: typeof current.ticketOpacity === "number" ? current.ticketOpacity : state.ticketOpacity,
    mapStyle: typeof current.mapStyle === "string" && MAP_TILE_STYLES[current.mapStyle] ? current.mapStyle : state.mapStyle,
  };
}

function scheduleEmployeeDashboardSync() {
  if (!dashboardStateReady || dashboardStateHydrating || currentProfileMode !== "admin") return;
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
  elements.showDashboardView.textContent = currentProfileMode === "admin" ? "Admin Dashboard" : "Dashboard";
}

function setProfileMode(mode) {
  const nextMode = mode === "employee" ? "employee" : "admin";
  if (nextMode === currentProfileMode) {
    updateDashboardMenuLabel();
    setCurrentView("dashboard");
    return;
  }
  if (nextMode === "employee") {
    adminPreviewState = dashboardStatePayload();
    currentProfileMode = "employee";
    document.body.classList.add("employee-mode");
    if (elements.employeeBar) elements.employeeBar.hidden = false;
    applyEmployeeDashboardState();
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
  currentView = view === "sheet" || view === "mobile" ? view : "dashboard";
  document.body.classList.toggle("sheet-mode", currentView === "sheet");
  document.body.classList.toggle("mobile-mode", currentView === "mobile");
  if (elements.sheetView) elements.sheetView.hidden = currentView !== "sheet";
  if (elements.mobileView) elements.mobileView.hidden = currentView !== "mobile";
  if (currentView === "sheet") {
    if (elements.sheetSearch) elements.sheetSearch.value = ticketSearch;
    historicalDigTicketSearch = ticketSearch;
    renderSheetView();
    void loadHistoricalDigTickets().then(renderSheetView);
  } else if (currentView === "mobile") {
    renderMobileView();
  } else if (map) {
    requestAnimationFrame(() => map.invalidateSize());
  }
  if (window.location.hash !== `#${currentView}`) {
    if (currentView === "dashboard") history.replaceState(null, "", window.location.pathname + window.location.search);
    else history.replaceState(null, "", `#${currentView}`);
  }
  closeMoreMenu();
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

function dashboardStatePayload() {
  return {
    hiddenTickets: [...hiddenTickets],
    archivedTickets: [...archivedTickets],
    ticketActions,
    ticketDescriptions,
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
    vetroLayerStyleOverrides,
    vetroLayerNameOverrides,
    vetroLayerNoteOverrides,
    vetroLayerSizeOverrides,
    vetroLayerOpacityOverrides,
    vetroLayerColors,
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
    sidebarCollapsed,
    locatorProfile,
    selectedTicketNumber: selectedTicket?.ticket_number || pendingSelectedTicketNumber || "",
    mapView: map
      ? {
          center: [map.getCenter().lat, map.getCenter().lng],
          zoom: map.getZoom(),
        }
      : pendingMapView,
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
    if (state.ticketActions && typeof state.ticketActions === "object") {
      ticketActions = normalizeTicketActions(state.ticketActions);
      writeJsonStorage(STORAGE_KEYS.ticketActions, ticketActions);
    }
    if (state.ticketDescriptions && typeof state.ticketDescriptions === "object") {
      ticketDescriptions = normalizeTicketDescriptions(state.ticketDescriptions);
      writeJsonStorage(STORAGE_KEYS.ticketDescriptions, ticketDescriptions);
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
      elements.vetroSlToggle.checked = vetroSlVisible;
    }
    if (typeof state.vetroSlShape === "string") {
      vetroSlShape = state.vetroSlShape;
      localStorage.setItem(STORAGE_KEYS.vetroSlShape, vetroSlShape);
      elements.vetroSlShape.value = vetroSlShape;
    }
    if (typeof state.vetroSlColor === "string") {
      vetroSlColor = state.vetroSlColor;
      localStorage.setItem(STORAGE_KEYS.vetroSlColor, vetroSlColor);
      elements.vetroSlColor.value = vetroSlColor;
    }
    if (typeof state.vetroSlOutlineColor === "string") {
      vetroSlOutlineColor = state.vetroSlOutlineColor;
      localStorage.setItem(STORAGE_KEYS.vetroSlOutlineColor, vetroSlOutlineColor);
      elements.vetroSlOutlineColor.value = vetroSlOutlineColor;
    }
    if (typeof state.vetroSlOpacity === "number") {
      vetroSlOpacity = state.vetroSlOpacity;
      localStorage.setItem(STORAGE_KEYS.vetroSlOpacity, String(vetroSlOpacity));
      elements.vetroSlOpacity.value = String(opacityToPercent(vetroSlOpacity));
    }
    if (typeof state.vetroSlSize === "number") {
      vetroSlSize = state.vetroSlSize;
      localStorage.setItem(STORAGE_KEYS.vetroSlSize, String(vetroSlSize));
      elements.vetroSlSize.value = String(vetroSlSize);
    }
    if (typeof state.vetroSlLabels === "boolean") {
      vetroSlLabels = state.vetroSlLabels;
      writeBooleanStorage(STORAGE_KEYS.vetroSlLabels, vetroSlLabels);
      elements.vetroSlLabels.checked = vetroSlLabels;
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
    if (typeof state.mapStyle === "string" && MAP_TILE_STYLES[state.mapStyle]) {
      mapStyle = state.mapStyle;
      localStorage.setItem(STORAGE_KEYS.mapStyle, mapStyle);
      elements.mapStyle.value = mapStyle;
    }
    mapDataOverlay = "none";
    localStorage.removeItem(STORAGE_KEYS.mapDataOverlay);
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
}

function scheduleDashboardStateSave() {
  if (!dashboardStateReady || dashboardStateHydrating) return;
  if (dashboardStateSaveTimer) window.clearTimeout(dashboardStateSaveTimer);
  dashboardStateSaveTimer = window.setTimeout(() => {
    dashboardStateSaveTimer = null;
    void saveDashboardState();
  }, 400);
}

async function saveDashboardState() {
  if (!dashboardStateReady || dashboardStateHydrating) return;
  if (currentProfileMode === "employee") {
    await saveEmployeeDashboard({ enabled: true, state: employeeWritableStatePayload(), toast: false });
    return;
  }
  const response = await fetch("/api/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dashboardStatePayload()),
    keepalive: true,
  });
  if (!response.ok) {
    throw new Error(`Failed to save dashboard state: ${response.status}`);
  }
}

async function saveEmployeeDashboard({ enabled = true, state = dashboardStatePayload(), toast = true } = {}) {
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
  return employeeDashboardConfig;
}

function updateLocatorDefaultStatus() {
  if (!elements.locatorDefaultToggle || !elements.locatorDefaultStatus) return;
  elements.locatorDefaultToggle.checked = Boolean(locatorDefaultConfig.enabled);
  if (!locatorDefaultConfig.enabled) {
    elements.locatorDefaultStatus.textContent = "Default view is off";
    return;
  }
  const savedAt = locatorDefaultConfig.saved_at ? new Date(locatorDefaultConfig.saved_at) : null;
  const savedText = savedAt && !Number.isNaN(savedAt.getTime()) ? savedAt.toLocaleString() : "saved";
  elements.locatorDefaultStatus.textContent = `Default view on: ${savedText}`;
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

async function saveLocatorDefault({ enabled = elements.locatorDefaultToggle.checked, includeState = true } = {}) {
  const body = { enabled };
  if (includeState) body.state = dashboardStatePayload();
  const response = await fetch("/api/locator-default", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to save locator default: ${response.status}`);
  }
  const payload = await response.json();
  locatorDefaultConfig = payload.locatorDefault || { enabled, state: body.state || {} };
  updateLocatorDefaultStatus();
  showSavedToast("Saved");
  return locatorDefaultConfig;
}

async function loadDashboardState() {
  const response = await fetch("/api/state");
  if (!response.ok) return;
  const payload = await response.json();
  locatorDefaultConfig = payload.locatorDefault || { enabled: false, state: {}, saved_at: "", saved_by: "" };
  employeeDashboardConfig = payload.employeeDashboard || { enabled: false, state: {}, saved_at: "", saved_by: "" };
  updateLocatorDefaultStatus();
  const defaultState = locatorDefaultConfig.enabled && locatorDefaultConfig.state ? locatorDefaultConfig.state : null;
  applyDashboardState(defaultState || payload.state || {});
}

let hiddenTickets = new Set(readJsonStorage(STORAGE_KEYS.hiddenTickets, []));
let archivedTickets = new Set(readJsonStorage(STORAGE_KEYS.archivedTickets, []));
let ticketActions = normalizeTicketActions(readObjectStorage(STORAGE_KEYS.ticketActions));
let ticketDescriptions = normalizeTicketDescriptions(readObjectStorage(STORAGE_KEYS.ticketDescriptions));
let polygonColor = localStorage.getItem("polygonColor") || "#1f7a4d";
let polygonOpacity = Number(localStorage.getItem("polygonOpacity") || "0.14");
let vetroColor = localStorage.getItem("vetroColor") || "#00a5ff";
let vetroOpacity = Number(localStorage.getItem("vetroOpacity") || "0.85");
let mapOpacity = 1;
localStorage.removeItem("mapOpacity");
let ticketOpacity = Number(localStorage.getItem(STORAGE_KEYS.ticketOpacity) || "1");
let mapStyle = localStorage.getItem(STORAGE_KEYS.mapStyle) || "contrast";
if (!MAP_TILE_STYLES[mapStyle]) mapStyle = "contrast";
let lastStreetMapStyle = ["satellite", "hybrid", "google-satellite", "google-hybrid"].includes(mapStyle) ? "contrast" : mapStyle;
let mapDataOverlay = "none";
localStorage.removeItem(STORAGE_KEYS.mapDataOverlay);
let sheetSort = readJsonStorage(STORAGE_KEYS.sheetSort, { column: "Due Date", direction: "desc" });
let sheetColumnFilters = readObjectStorage(STORAGE_KEYS.sheetColumnFilters);
let sheetSavedFilters = readJsonStorage(STORAGE_KEYS.sheetSavedFilters, []);
let vetroLayerColors = JSON.parse(localStorage.getItem("vetroLayerColors") || "{}");
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
let vetroLayerStyleOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vetroLayerStyles) || "{}");
let vetroLayerNameOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vetroLayerNames) || "{}");
let vetroLayerNoteOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vetroLayerNotes) || "{}");
let vetroLayerSizeOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vetroLayerSizes) || "{}");
let vetroLayerOpacityOverrides = JSON.parse(localStorage.getItem(STORAGE_KEYS.vetroLayerOpacities) || "{}");
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
let dashboardStateReady = false;
let dashboardStateHydrating = false;
let dashboardStateSaveTimer = null;
let employeeDashboardSyncTimer = null;
let saveToastTimer = null;
let locatorDefaultConfig = { enabled: false, state: {}, saved_at: "", saved_by: "" };
let employeeDashboardConfig = { enabled: false, state: {}, saved_at: "", saved_by: "" };
let locatorProfile = normalizeProfile(readObjectStorage(STORAGE_KEYS.profile));

const elements = {
  sourcePath: document.querySelector("#sourcePath"),
  totalCount: document.querySelector("#totalCount"),
  dueCount: document.querySelector("#dueCount"),
  countyCount: document.querySelector("#countyCount"),
  search: document.querySelector("#search"),
  ticketQuickSearch: document.querySelector("#ticketQuickSearch"),
  mapSearchForm: document.querySelector("#mapSearchForm"),
  mapSearch: document.querySelector("#mapSearch"),
  countyFilter: document.querySelector("#countyFilter"),
  countyFilterSummary: document.querySelector("#countyFilterSummary"),
  countyAll: document.querySelector("#countyAll"),
  countyClear: document.querySelector("#countyClear"),
  locatorDefaultToggle: document.querySelector("#locatorDefaultToggle"),
  saveLocatorDefault: document.querySelector("#saveLocatorDefault"),
  saveEmployeeDashboard: document.querySelector("#saveEmployeeDashboard"),
  locatorDefaultStatus: document.querySelector("#locatorDefaultStatus"),
  employeeBar: document.querySelector("#employeeBar"),
  saveToast: document.querySelector("#saveToast"),
  refresh: document.querySelector("#refresh"),
  vetroToggle: document.querySelector("#vetroToggle"),
  vetroStatus: document.querySelector("#vetroStatus"),
  vetroSearch: document.querySelector("#vetroSearch"),
  vetroLayerFilter: document.querySelector("#vetroLayerFilter"),
  vetroLayerAll: document.querySelector("#vetroLayerAll"),
  vetroLayerClear: document.querySelector("#vetroLayerClear"),
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
  showMobileView: document.querySelector("#showMobileView"),
  showDashboardView: document.querySelector("#showDashboardView"),
  showEmployeeView: document.querySelector("#showEmployeeView"),
  showAdminView: document.querySelector("#showAdminView"),
  settingsFlyout: document.querySelector("#settingsFlyout"),
  showSettingsMenu: document.querySelector("#showSettingsMenu"),
  settingsPanel: document.querySelector("#settingsPanel"),
  oneDriveStatus: document.querySelector("#oneDriveStatus"),
  refreshOneDriveStatus: document.querySelector("#refreshOneDriveStatus"),
  connectOneDrive: document.querySelector("#connectOneDrive"),
  sheetBackToDashboard: document.querySelector("#sheetBackToDashboard"),
  sheetView: document.querySelector("#sheetView"),
  sheetFilterToolbar: document.querySelector("#sheetFilterToolbar"),
  sheetTableWrap: document.querySelector("#sheetTableWrap"),
  mobileView: document.querySelector("#mobileView"),
  mobileSummary: document.querySelector("#mobileSummary"),
  sheetSearch: document.querySelector("#sheetSearch"),
  exportSheetPdf: document.querySelector("#exportSheetPdf"),
  exportSheetExcel: document.querySelector("#exportSheetExcel"),
  exportSheetCsv: document.querySelector("#exportSheetCsv"),
  mobileSearch: document.querySelector("#mobileSearch"),
  mobileRefresh: document.querySelector("#mobileRefresh"),
  mobileBackToDashboard: document.querySelector("#mobileBackToDashboard"),
  mobileTicketList: document.querySelector("#mobileTicketList"),
  mobileTicketDetail: document.querySelector("#mobileTicketDetail"),
  profileName: document.querySelector("#profileName"),
  profileRole: document.querySelector("#profileRole"),
  profilePhoto: document.querySelector("#profilePhoto"),
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
};

elements.polygonColor.value = polygonColor;
elements.polygonOpacity.value = String(opacityToPercent(polygonOpacity));
elements.ticketOpacity.value = String(opacityToPercent(ticketOpacity));
elements.vetroColor.value = vetroColor;
elements.vetroOpacity.value = String(opacityToPercent(vetroOpacity));
elements.vetroSlToggle.checked = vetroSlVisible;
elements.vetroSlShape.value = vetroSlShape;
elements.vetroSlColor.value = vetroSlColor;
elements.vetroSlOutlineColor.value = vetroSlOutlineColor;
elements.vetroSlOpacity.value = String(opacityToPercent(vetroSlOpacity));
elements.vetroSlSize.value = String(vetroSlSize);
elements.vetroSlLabels.checked = vetroSlLabels;
elements.vetroSearch.value = vetroSearch;
syncTicketSearchInputs();
elements.mapStyle.value = mapStyle;
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

function vetroLayerGeometryType(layerId) {
  return vetroLayerGeometryById[String(layerId)] || VETRO_LAYER_INFO[String(layerId)]?.geometry || "";
}

function vetroLayerStyleChoice(layerId) {
  return vetroLayerGeometryType(layerId).includes("Line") ? "line" : "point";
}

function vetroLayerDefaultName(layerId) {
  return VETRO_LAYER_INFO[String(layerId)]?.name || `Layer ${layerId}`;
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
  return `Layer ${layerId}: ${vetroLayerDisplayName(layerId)}${geometryLabel}${countLabel}`;
}

function vetroLayerTitle(layerId) {
  const info = VETRO_LAYER_INFO[String(layerId)] || { detail: "features from VETRO export" };
  const geometry = vetroLayerGeometryType(layerId);
  const shapeHint = geometry.startsWith("Line")
    ? "Use the layer style selector to switch between solid, dashed, and dotted lines."
    : "Use the layer shape selector to switch between circle, square, diamond, and pin markers.";
  const note = vetroLayerNote(layerId);
  const sizeHint = geometry.startsWith("Line") ? `Line width ${vetroLayerSize(layerId)}.` : `Marker size ${vetroLayerSize(layerId)}.`;
  const opacityHint = `Opacity ${Math.round(vetroLayerOpacity(layerId) * 100)}%.`;
  return `Layer ${layerId}: ${vetroLayerDisplayName(layerId)}. ${info.detail} ${shapeHint} ${sizeHint} ${opacityHint}${note ? ` Note: ${note}` : ""}`;
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

function renderProfile() {
  const profile = normalizeProfile(locatorProfile);
  const employeeMode = currentProfileMode === "employee";
  const displayName = employeeMode ? "Employee" : (profile.name.trim() || "Reed");
  const displayRole = employeeMode ? "Employee dashboard" : (profile.role.trim() || "Admin profile");
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
    if (profile.photo) {
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
  const props = feature.properties || {};
  return propValue(props, "layer_id", "Layer_ID") === "26" && propValue(props, "ID", "feature_id").toUpperCase().startsWith("SL-");
}

function slLabel(feature) {
  const props = feature.properties || {};
  return propValue(props, "ID", "feature_id") || "SL";
}

function vetroMarkerIcon(shape, color, size, opacity = 1, label = "", outlineColor = "#111827") {
  const markerSize = Math.max(8, Math.min(22, Number(size) || 13));
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
  const size = Math.max(8, Math.min(22, Number(vetroSlSize) || 13));
  const markerSize = Math.max(8, Math.min(22, Number(size) || 13));
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
    : { label: "Size", min: 8, max: 28, step: 1 };
}

function vetroLayerSize(layerId) {
  const range = vetroLayerSizeRange(layerId);
  return clampNumber(vetroLayerSizeOverrides[String(layerId)], range.min, range.max, vetroLayerSizeDefault(layerId));
}

function vetroLayerOpacity(layerId) {
  return clampNumber(vetroLayerOpacityOverrides[String(layerId)], 0, 1, vetroOpacity);
}

function vetroLayerShape(layerId) {
  const geometryChoice = vetroLayerStyleChoice(layerId);
  return vetroLayerStyleOverrides[String(layerId)] || (geometryChoice === "line" ? "solid" : "circle");
}

function vetroPointToLayer(feature, latlng) {
  const layerId = propValue(feature?.properties || {}, "layer_id", "Layer_ID");
  if (isSlFeature(feature)) {
    return L.marker(latlng, { icon: slMarkerIcon(feature) });
  }
  const shape = vetroLayerShape(layerId);
  const size = vetroLayerSize(layerId);
  const opacity = vetroLayerOpacity(layerId);
  return L.marker(latlng, {
    icon: vetroMarkerIcon(shape, colorForVetroLayer(layerId), size, opacity),
  });
}

function isValidMapDataOverlay(value) {
  return value === "none" || value === "addresses" || value === "parcels" || value === "addresses-parcels";
}

function initMap() {
  map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([33.23, -92.67], 12);
  setMapTileStyle(mapStyle, false);
  mapDataOverlayLayer = L.layerGroup().addTo(map);
  markers = L.layerGroup().addTo(map);
  polygons = L.layerGroup().addTo(map);
  map.on("click", () => {
    clearSelectedTicket();
  });
  map.on("moveend zoomend", () => {
    if (!dashboardStateReady || dashboardStateHydrating) return;
    scheduleDashboardStateSave();
    scheduleMapDataOverlayRefresh();
  });
  scheduleMapDataOverlayRefresh();
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

function googleSessionCacheKey(tile) {
  return JSON.stringify({
    mapType: tile.mapType,
    layerTypes: tile.layerTypes || [],
    overlay: Boolean(tile.overlay),
  });
}

async function createGoogleTileSession(tile) {
  if (!mapConfig.googleMapsTileApiKey) {
    throw new Error("Google Maps Tile API key is not configured on this server.");
  }
  const cacheKey = googleSessionCacheKey(tile);
  const cached = googleTileSessions[cacheKey];
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cached?.session && (!cached.expiry || cached.expiry - nowSeconds > 3600)) {
    return cached.session;
  }
  const body = {
    mapType: tile.mapType,
    language: "en-US",
    region: "US",
  };
  if (tile.layerTypes) body.layerTypes = tile.layerTypes;
  if (typeof tile.overlay === "boolean") body.overlay = tile.overlay;
  const response = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(mapConfig.googleMapsTileApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Google Maps session failed: ${response.status}${message ? ` ${message.slice(0, 160)}` : ""}`);
  }
  const payload = await response.json();
  if (!payload.session) throw new Error("Google Maps session response did not include a session token.");
  googleTileSessions[cacheKey] = {
    session: payload.session,
    expiry: Number(payload.expiry || 0),
  };
  return payload.session;
}

async function googleTileLayer(tile) {
  const session = await createGoogleTileSession(tile);
  return L.tileLayer(`https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(mapConfig.googleMapsTileApiKey)}`, {
    maxZoom: 20,
    attribution: tile.attribution,
    opacity: mapOpacity,
  });
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
  if (tile.provider === "google") {
    try {
      baseTileLayer = await googleTileLayer(tile);
      baseTileLayer.addTo(map);
      baseTileLayer.bringToBack();
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
      baseTileLayer.bringToBack();
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
    baseTileLayer.eachLayer((layer) => layer.bringToBack());
  } else {
    baseTileLayer = L.tileLayer(tile.url, {
      maxZoom: 20,
      attribution: tile.attribution,
      opacity: mapOpacity,
      ...(tile.subdomains ? { subdomains: tile.subdomains } : {}),
    }).addTo(map);
    baseTileLayer.bringToBack();
  }
  if (save) scheduleDashboardStateSave();
}

function isImageryMapStyle(style) {
  return ["satellite", "hybrid", "google-satellite", "google-hybrid"].includes(style);
}

function preferredImageryMapStyle() {
  return mapConfig.googleMapsTileApiKey ? "google-hybrid" : "hybrid";
}

function preferredStreetMapStyle() {
  return MAP_TILE_STYLES[lastStreetMapStyle] && !isImageryMapStyle(lastStreetMapStyle) ? lastStreetMapStyle : "contrast";
}

async function toggleMapView() {
  rememberUndoState();
  const nextStyle = isImageryMapStyle(mapStyle) ? preferredStreetMapStyle() : preferredImageryMapStyle();
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
  if (mapDataOverlay === "addresses") return [ARCGIS_POINT_OVERLAYS.addresses];
  if (mapDataOverlay === "parcels") return [ARCGIS_POINT_OVERLAYS.parcels];
  if (mapDataOverlay === "addresses-parcels") return [ARCGIS_POINT_OVERLAYS.addresses, ARCGIS_POINT_OVERLAYS.parcels];
  return [];
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
  void refreshMapDataOverlay();
}

async function refreshMapDataOverlay() {
  if (!map || !mapDataOverlayLayer) return;
  mapDataOverlayAbort += 1;
  mapDataOverlay = "none";
  mapDataOverlayLayer.clearLayers();
  localStorage.removeItem(STORAGE_KEYS.mapDataOverlay);
  setMapDataOverlayStatus("");
}

function colorForVetroLayer(layerId) {
  return vetroLayerColors[String(layerId)] || vetroColor;
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
  return [...select.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.value);
}

function setAllChecked(container, checked) {
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
  vetroSelectedBuilds = new Set(selectedValues(elements.vetroBuildFilter));
  vetroSelectedPlacements = new Set(selectedValues(elements.vetroPlacementFilter));
  vetroSelectedStatuses = new Set(selectedValues(elements.vetroStatusFilter));
  vetroSelectedGeometries = new Set(selectedValues(elements.vetroGeometryFilter));
  vetroSelectedFibers = new Set(selectedValues(elements.vetroFiberFilter));
  vetroSelectedRoutes = new Set(selectedValues(elements.vetroRouteFilter));
  vetroSelectedPoints = new Set(selectedValues(elements.vetroPointFilter));
  vetroSearch = elements.vetroSearch.value.trim();
  writeJsonStorage(STORAGE_KEYS.vetroPlan, [...vetroSelectedPlans]);
  writeJsonStorage(STORAGE_KEYS.vetroBuild, [...vetroSelectedBuilds]);
  writeJsonStorage(STORAGE_KEYS.vetroPlacement, [...vetroSelectedPlacements]);
  writeJsonStorage(STORAGE_KEYS.vetroStatus, [...vetroSelectedStatuses]);
  writeJsonStorage(STORAGE_KEYS.vetroGeometry, [...vetroSelectedGeometries]);
  writeJsonStorage(STORAGE_KEYS.vetroFiber, [...vetroSelectedFibers]);
  writeJsonStorage(STORAGE_KEYS.vetroRoute, [...vetroSelectedRoutes]);
  writeJsonStorage(STORAGE_KEYS.vetroPoint, [...vetroSelectedPoints]);
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
                <input class="layer-color" type="color" data-layer-color="${escapeHtml(layerId)}" value="${escapeHtml(colorForVetroLayer(layerId))}">
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
  const layerId = propValue(feature?.properties || {}, "layer_id", "Layer_ID");
  const color = isSlFeature(feature) ? vetroSlColor : colorForVetroLayer(layerId);
  const outlineColor = isSlFeature(feature) ? vetroSlOutlineColor : color;
  const geometry = feature?.geometry?.type || "";
  const size = isSlFeature(feature) ? vetroSlSize : vetroLayerSize(layerId);
  const opacity = isSlFeature(feature) ? vetroSlOpacity : vetroLayerOpacity(layerId);
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
  const title = isSlFeature(feature)
    ? `Service location ${propValue(props, "ID", "feature_id")}`
    : propValue(props, "feature_id", "ID", "Name", "name") || `Layer ${propValue(props, "layer_id", "Layer_ID")}`.trim() || "Vetro feature";
  const layerId = propValue(props, "layer_id", "Layer_ID");
  const rows = [
    ["Customer / Address", propValue(props, "Street_Address", "street_address", "Address")],
    ["Service Location ID", isSlFeature(feature) ? propValue(props, "ID", "feature_id") : ""],
    ["Zone", propValue(props, "Zone_Name")],
    ["Zone Status", propValue(props, "Zone_Status")],
    ["Building Type", propValue(props, "Building_Type", "Building Type")],
    ["Drop Type", propValue(props, "Drop_Type", "Drop Type")],
    ["Layer", layerId ? vetroLayerLabel(layerId) : ""],
    ["Layer name", layerId ? vetroLayerDisplayName(layerId) : ""],
    ["Layer note", layerId ? vetroLayerNote(layerId) : ""],
    ["Layer control", layerId ? vetroLayerStyleLabel(layerId) : ""],
    ["Layer setting", layerId ? (vetroLayerStyleOverrides[String(layerId)] || "Auto") : ""],
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
    ["Street Address", isSlFeature(feature) ? "" : propValue(props, "street_address", "Street_Address", "Street Address")],
    ["Note", propValue(props, "Note", "note")],
    ["Vetro ID", propValue(props, "vetro_id")],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`)
    .join("");
  layer.bindPopup(`<strong>${escapeHtml(title)}</strong>${rows ? `<div class="popup-rows">${rows}</div>` : ""}`);
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
      if (isSlFeature(feature) && !vetroSlVisible) return false;
      if (layerIds.length && !layerIds.includes(propValue(props, "layer_id", "Layer_ID"))) return false;
      if (vetroSelectedPlans.size && !vetroSelectedPlans.has(propValue(props, "plan"))) return false;
      if (vetroSelectedBuilds.size && !vetroSelectedBuilds.has(propValue(props, "build", "Build"))) return false;
      if (vetroSelectedPlacements.size && !vetroSelectedPlacements.has(propValue(props, "placement", "Placement"))) return false;
      if (vetroSelectedStatuses.size && !vetroSelectedStatuses.has(propValue(props, "status_id", "Status_ID"))) return false;
      if (vetroSelectedGeometries.size && !vetroSelectedGeometries.has(feature.geometry?.type || "")) return false;
      if (vetroSelectedFibers.size && !vetroSelectedFibers.has(propValue(props, "Fiber_Capacity", "Fiber Capacity"))) return false;
      if (vetroSelectedRoutes.size && !vetroSelectedRoutes.has(routeValue(feature))) return false;
      if (vetroSelectedPoints.size && !vetroSelectedPoints.has(pointValue(feature))) return false;
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
  scheduleDashboardStateSave();
}

function populateVetroFilters() {
  const features = vetroGeojson?.features || [];
  const layerIds = uniqueSorted(features.map((feature) => propValue(feature.properties || {}, "layer_id", "Layer_ID")));
  const availableLayers = new Set(layerIds);
  const geometryByLayer = {};
  for (const feature of features) {
    const layerId = propValue(feature.properties || {}, "layer_id", "Layer_ID");
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
  vetroSelectedLayers = new Set([...vetroSelectedLayers].filter((layerId) => availableLayers.has(layerId)));
  writeJsonStorage(STORAGE_KEYS.vetroLayers, [...vetroSelectedLayers]);
  const layerCounts = Object.fromEntries((vetroGeojson.metadata?.layers || []).map((item) => [String(item.id), item.feature_count]));
  renderVetroLayerList(elements.vetroLayerFilter, layerIds, [...vetroSelectedLayers], layerCounts);
  const planValues = uniqueSorted(features.map((feature) => propValue(feature.properties || {}, "plan")));
  const buildValues = uniqueSorted(features.map((feature) => propValue(feature.properties || {}, "build", "Build")));
  const placementValues = uniqueSorted(features.map((feature) => propValue(feature.properties || {}, "placement", "Placement")));
  const statusValues = uniqueSorted(features.map((feature) => propValue(feature.properties || {}, "status_id", "Status_ID")));
  const geometryValues = uniqueSorted(features.map((feature) => feature.geometry?.type || ""));
  const fiberValues = uniqueSorted(features.map((feature) => propValue(feature.properties || {}, "Fiber_Capacity", "Fiber Capacity")));
  const routeValues = uniqueSorted(features.map(routeValue));
  const pointValues = uniqueSorted(features.map(pointValue));

  vetroSelectedPlans = normalizeSelectedSet(vetroSelectedPlans, planValues, STORAGE_KEYS.vetroPlan);
  vetroSelectedBuilds = normalizeSelectedSet(vetroSelectedBuilds, buildValues, STORAGE_KEYS.vetroBuild);
  vetroSelectedPlacements = normalizeSelectedSet(vetroSelectedPlacements, placementValues, STORAGE_KEYS.vetroPlacement);
  vetroSelectedStatuses = normalizeSelectedSet(vetroSelectedStatuses, statusValues, STORAGE_KEYS.vetroStatus);
  vetroSelectedGeometries = normalizeSelectedSet(vetroSelectedGeometries, geometryValues, STORAGE_KEYS.vetroGeometry);
  vetroSelectedFibers = normalizeSelectedSet(vetroSelectedFibers, fiberValues, STORAGE_KEYS.vetroFiber);
  vetroSelectedRoutes = normalizeSelectedSet(vetroSelectedRoutes, routeValues, STORAGE_KEYS.vetroRoute);
  vetroSelectedPoints = normalizeSelectedSet(vetroSelectedPoints, pointValues, STORAGE_KEYS.vetroPoint);

  const planCounts = valueCountMap(features, (feature) => propValue(feature.properties || {}, "plan"));
  const statusCounts = valueCountMap(features, (feature) => propValue(feature.properties || {}, "status_id", "Status_ID"));
  const fiberCounts = valueCountMap(features, (feature) => propValue(feature.properties || {}, "Fiber_Capacity", "Fiber Capacity"));
  const placementCounts = valueCountMap(features, (feature) => propValue(feature.properties || {}, "placement", "Placement"));
  const routeCounts = valueCountMap(features, routeValue);
  const pointCounts = valueCountMap(features, pointValue);
  const geometryCounts = valueCountMap(features, (feature) => feature.geometry?.type || "");
  const buildCounts = valueCountMap(features, (feature) => propValue(feature.properties || {}, "build", "Build"));

  renderCheckboxList(elements.vetroPlanFilter, planValues, [...vetroSelectedPlans], (value) => labelWithCount(value, planCounts));
  renderCheckboxList(elements.vetroStatusFilter, statusValues, [...vetroSelectedStatuses], (value) => labelWithCount(value, statusCounts, vetroStatusLabel));
  renderCheckboxList(elements.vetroFiberFilter, fiberValues, [...vetroSelectedFibers], (value) => labelWithCount(`${value}`, fiberCounts, (item) => `${item} fiber`));
  renderCheckboxList(elements.vetroPlacementFilter, placementValues, [...vetroSelectedPlacements], (value) => labelWithCount(value, placementCounts));
  renderCheckboxList(elements.vetroRouteFilter, routeValues, [...vetroSelectedRoutes], (value) => labelWithCount(value, routeCounts));
  renderCheckboxList(elements.vetroPointFilter, pointValues, [...vetroSelectedPoints], (value) => labelWithCount(value, pointCounts));
  renderCheckboxList(elements.vetroGeometryFilter, geometryValues, [...vetroSelectedGeometries], (value) => labelWithCount(value, geometryCounts));
  renderCheckboxList(elements.vetroBuildFilter, buildValues, [...vetroSelectedBuilds], (value) => labelWithCount(value, buildCounts));
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
  try {
    const response = await fetch("/api/refresh", { method: "POST" });
    if (!response.ok && response.status !== 409) {
      throw new Error(`Refresh request failed: ${response.status}`);
    }
    const status = response.status === 409 ? await pollServerRefresh() : await pollServerRefresh();
    if (!status.success) {
      throw new Error(status.message || "Refresh failed");
    }
    await loadTickets();
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

function normalizeTicketDescriptions(value) {
  const normalized = {};
  for (const [ticketNumber, description] of Object.entries(value || {})) {
    const text = String(description || "").trim();
    if (text) normalized[String(ticketNumber)] = text;
  }
  return normalized;
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

function ticketDescription(ticketNumber) {
  return ticketDescriptions[ticketNumber] || "";
}

function saveTicketWorkflowState() {
  ticketActions = normalizeTicketActions(ticketActions);
  ticketDescriptions = normalizeTicketDescriptions(ticketDescriptions);
  writeJsonStorage(STORAGE_KEYS.ticketActions, ticketActions);
  writeJsonStorage(STORAGE_KEYS.ticketDescriptions, ticketDescriptions);
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
  const next = [...new Set((actionKeys || []).map(String).filter((key) => actionByKey(key)))];
  if (next.length) ticketActions[ticketNumber] = next;
  else delete ticketActions[ticketNumber];
  saveTicketWorkflowState();
}

function setAllTicketActions(ticketNumber, selected) {
  if (selected) ticketActions[ticketNumber] = TICKET_ACTIONS.map((action) => action.key);
  else delete ticketActions[ticketNumber];
  saveTicketWorkflowState();
}

function sheetActionSummaryHtml(ticketNumber) {
  const labels = ticketActionLabels(ticketNumber);
  return labels.length
    ? `<span class="sheet-status-list">${labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</span>`
    : '<span class="sheet-muted">Click row to mark</span>';
}

function actionControlHtml(ticketNumber, compact = false, options = {}) {
  const selected = new Set(ticketSelectedActions(ticketNumber));
  const allChecked = TICKET_ACTIONS.every((action) => selected.has(action.key));
  const deferred = Boolean(options.deferred);
  const allAttribute = deferred ? "data-ticket-action-stage-all" : "data-ticket-action-all";
  const actionAttribute = deferred ? "data-ticket-action-stage" : "data-ticket-action";
  const rows = [
    `<label><input type="checkbox" ${allAttribute}="${escapeHtml(ticketNumber)}" ${allChecked ? "checked" : ""}> Select all</label>`,
    ...TICKET_ACTIONS.map(
      (action) => `<label><input type="checkbox" ${actionAttribute}="${escapeHtml(ticketNumber)}" data-action-key="${escapeHtml(action.key)}" ${selected.has(action.key) ? "checked" : ""}> ${escapeHtml(action.label)}</label>`,
    ),
  ].join("");
  const submit = deferred
    ? `<div class="ticket-action-submit-row">
        <button type="button" data-ticket-action-submit="${escapeHtml(ticketNumber)}">Submit</button>
        <span data-ticket-action-pending="${escapeHtml(ticketNumber)}">Choose actions, then submit.</span>
      </div>`
    : "";
  const upload = deferred ? attachmentUploadHtml(ticketNumber) : "";
  return `<div class="ticket-action-checks${compact ? " compact" : ""}${deferred ? " staged" : ""}" data-action-mode="${deferred ? "deferred" : "instant"}">${rows}${upload}${submit}</div>`;
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
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
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
  ["Action", (ticket, expanded) => expanded ? actionControlHtml(ticket.ticket_number, true) : sheetActionSummaryHtml(ticket.ticket_number), "html"],
  ["Attachments", (ticket) => attachmentUploadHtml(ticket.ticket_number, true), "html"],
  ["Description", (ticket, expanded) => expanded ? `
    <textarea class="sheet-description" data-ticket-description="${escapeHtml(ticket.ticket_number)}" placeholder="Leave a description">${escapeHtml(ticketDescription(ticket.ticket_number))}</textarea>
  ` : escapeHtml(ticketDescription(ticket.ticket_number) || workDescription(ticket)), "html"],
  ["Marked By", () => ""],
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

sheetSort = normalizeSheetSort(sheetSort);
sheetColumnFilters = normalizeSheetColumnFilters(sheetColumnFilters);
sheetSavedFilters = normalizeSheetSavedFilters(sheetSavedFilters);

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
    <th class="${active ? "sheet-filtered-column" : ""}">
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
  if (ticketIsRemark(ticket)) return "background:#e8f3ff;border-left:4px solid #008cff;";
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
        <p>Exported ${escapeHtml(new Date().toLocaleString())}</p>
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
    <table class="sheet-table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body || `<tr><td colspan="${SHEET_COLUMNS.length}">No active tickets found.</td></tr>`}</tbody>
    </table>
    ${renderHistoricalDigTickets()}
  `;
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
  for (const input of elements.sheetTableWrap.querySelectorAll("[data-ticket-description]")) {
    input.addEventListener("change", () => {
      rememberUndoState();
      setTicketDescription(input.dataset.ticketDescription, input.value);
    });
  }
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
      const wrapper = button.closest(".ticket-action-checks");
      if (!wrapper) return;
      const ticketNumber = button.dataset.ticketActionSubmit;
      const selected = stagedActionKeys(wrapper);
      const uploader = wrapper.querySelector("[data-ticket-upload]");
      const shouldAskForAttachments = selected.some((key) => key !== "clear");
      if (uploader && shouldAskForAttachments && window.confirm(`Do you want to upload attachments to ticket ${ticketNumber} before submitting these actions?`)) {
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
  return Array.isArray(tickets) ? tickets.filter((ticket) => ACTIVE_COUNTIES.has(String(ticket.county || "").toUpperCase())) : [];
}

function visibleTickets() {
  return matchingTickets().filter(
    (ticket) => !archivedTickets.has(ticket.ticket_number)
      && !ticketIsActionHidden(ticket)
      && (elements.showHiddenToggle.checked || !hiddenTickets.has(ticket.ticket_number)),
  );
}

function matchingTickets() {
  const query = ticketSearch.trim().toLowerCase();
  return scopedTickets().filter((ticket) => {
    if (archivedTickets.has(ticket.ticket_number)) return false;
    if (ticketIsActionHidden(ticket)) return false;
    if (!countyFilterAll && !selectedCounties.has(ticket.county || "")) return false;
    if (query && !searchable(ticket).includes(query)) return false;
    return true;
  });
}

function renderMetrics(list = []) {
  const activeTickets = scopedTickets().filter((ticket) => !archivedTickets.has(ticket.ticket_number) && !ticketIsActionHidden(ticket));
  const counties = new Set(activeTickets.map((ticket) => ticket.county).filter(Boolean));
  const activeCount = activeTickets.filter((ticket) => !hiddenTickets.has(ticket.ticket_number)).length;
  elements.totalCount.textContent = String(activeCount);
  elements.countyCount.textContent = String(counties.size);
  elements.dueCount.textContent = String(list.filter((ticket) => ticket.work_begin_date).length);
}

function saveHiddenTickets() {
  writeJsonStorage(STORAGE_KEYS.hiddenTickets, [...hiddenTickets]);
  scheduleDashboardStateSave();
  void saveDashboardState().catch((error) => {
    console.warn("Unable to save hidden ticket state", error);
  });
}

function saveArchivedTickets() {
  writeJsonStorage(STORAGE_KEYS.archivedTickets, [...archivedTickets]);
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
  if (hiddenTickets.has(ticketNumber)) {
    hiddenTickets.delete(ticketNumber);
  } else {
    hiddenTickets.add(ticketNumber);
    if (selectedTicket?.ticket_number === ticketNumber && !elements.showHiddenToggle.checked) {
      selectedTicket = visibleTickets().find((ticket) => ticket.ticket_number !== ticketNumber) || null;
    }
  }
  saveHiddenTickets();
  render();
}

function toggleTicketArchived(ticketNumber) {
  rememberUndoState();
  if (archivedTickets.has(ticketNumber)) {
    archivedTickets.delete(ticketNumber);
  } else {
    archivedTickets.add(ticketNumber);
    if (selectedTicket?.ticket_number === ticketNumber) {
      selectedTicket = null;
      pendingSelectedTicketNumber = "";
      localStorage.removeItem("selectedTicketNumber");
    }
  }
  saveArchivedTickets();
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

function ticketIsRemark(ticket) {
  const text = [
    ticket.message_type,
    ticket.work_type,
    ticket.location_information,
    ticket.raw_text,
    ticket.priority,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  return text.includes("REMARK") || text.includes("RECALL");
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

function historicalRecordIsTcwDmiWork(record) {
  return companyTextMatchesOrangePriority([
    historyCell(record, "Done For"),
    historyCell(record, "Excavator Name"),
  ].join(" "));
}

function parseTicketDueDate(ticket) {
  const value = String(ticket.work_begin_date || "").trim();
  if (!value) return null;
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }
  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
    return new Date(year, Number(slashMatch[1]) - 1, Number(slashMatch[2]));
  }
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
    { className: "legend-emergency", label: "Emergency - immediate priority" },
    { className: "legend-remark", label: "Remark/recall - due within 24 hours" },
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
  if (ticketHasActions(ticket.ticket_number)) classes.push("ticket-actioned");
  if (ticketIsTcwDmiWork(ticket)) classes.push("ticket-tcw-dmi-work");
  if (ticketIsEmergency(ticket)) classes.push("ticket-emergency-priority");
  if (ticketIsRemark(ticket)) classes.push("ticket-remark-priority");
  const dueStatus = ticketDueStatus(ticket);
  if (dueStatus) classes.push(`ticket-${dueStatus}`);
  return classes.join(" ");
}

function ticketVisualColors(ticket) {
  if (ticketIsTcwDmiWork(ticket)) return { stroke: "#ff6a00", fill: "#ff6a00", fillOpacity: 0.26 };
  if (ticketIsEmergency(ticket)) return { stroke: "#ff0033", fill: "#ff0033", fillOpacity: 0.28 };
  if (ticketIsRemark(ticket)) return { stroke: "#008cff", fill: "#008cff", fillOpacity: 0.22 };
  switch (ticketDueStatus(ticket)) {
    case "due-today":
      return { stroke: "#ffb3b3", fill: "#ffb3b3", fillOpacity: 0.34 };
    case "due-next":
      return { stroke: "#c026ff", fill: "#c026ff", fillOpacity: 0.3 };
    case "due-later":
      return { stroke: "#8df5a5", fill: "#8df5a5", fillOpacity: 0.28 };
    default:
      return { stroke: "#74a6ff", fill: "#74a6ff", fillOpacity: 0.24 };
  }
}

function ticketMapColors(ticket) {
  const colors = ticketVisualColors(ticket);
  if (ticketHasActions(ticket.ticket_number) && !ticketIsTcwDmiWork(ticket) && !ticketIsEmergency(ticket) && !ticketIsRemark(ticket)) {
    return { stroke: "#ff2b2b", fill: "#ff2b2b", fillOpacity: 0.3 };
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

function setTicketsHidden(ticketNumbers, hidden) {
  const numbers = ticketNumbers.filter(Boolean);
  if (!numbers.length) return;
  rememberUndoState();
  let changed = false;
  for (const ticketNumber of numbers) {
    if (hidden) {
      if (!hiddenTickets.has(ticketNumber)) {
        hiddenTickets.add(ticketNumber);
        changed = true;
      }
    } else if (hiddenTickets.delete(ticketNumber)) {
      changed = true;
    }
  }
  if (!changed) return;
  if (selectedTicket && hiddenTickets.has(selectedTicket.ticket_number) && !elements.showHiddenToggle.checked) {
    selectedTicket = visibleTickets().find((ticket) => !hiddenTickets.has(ticket.ticket_number)) || null;
  }
  saveHiddenTickets();
  render();
}

function hideGroupTickets(ticketNumbers, hidden = true) {
  setTicketsHidden(ticketNumbers, hidden);
}

function ticketCardHtml(ticket) {
  const hidden = hiddenTickets.has(ticket.ticket_number);
  const archived = archivedTickets.has(ticket.ticket_number);
  const priorityClasses = ticketPriorityClasses(ticket);
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
  if (!list.length) {
    elements.ticketList.innerHTML = '<div class="detail-content">No matching tickets.</div>';
    return;
  }

  const emergencies = [];
  const dateGroups = new Map();
  const activeList = list.filter((ticket) => !archivedTickets.has(ticket.ticket_number));
  const archivedList = sortedTickets(scopedTickets().filter((ticket) => archivedTickets.has(ticket.ticket_number)));
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
      ? emergencies
      : emergencies.filter((ticket) => !hiddenTickets.has(ticket.ticket_number));
    sections.push(renderTicketGroup("Priority emergencies", emergencies, "ticket-emergency-group", true, visibleEmergencies));
  }
  sections.push(
    ...[...dateGroups.entries()].map(([dueDate, items]) => {
      const visibleItems = elements.showHiddenToggle.checked ? items : items.filter((ticket) => !hiddenTickets.has(ticket.ticket_number));
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
    const width = elements.detail.getBoundingClientRect().width || 0;
    return [Math.min(340, Math.max(180, width * 0.72)), 0];
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

function renderMap(list = []) {
  markers.clearLayers();
  polygons.clearLayers();
  const bounds = [];

  for (const ticket of list) {
    if (ticket.polygon) {
      const dueColors = ticketMapColors(ticket);
      const selected = selectedTicket?.ticket_number === ticket.ticket_number;
      const polygon = L.geoJSON(ticket.polygon, {
        style: {
          color: dueColors.stroke,
          fillColor: dueColors.fill,
          fillOpacity: (selected ? Math.max(0.48, dueColors.fillOpacity) : dueColors.fillOpacity) * ticketOpacity,
          opacity: ticketOpacity,
          weight: selected ? 6 : 4,
        },
      });
      polygon.bindPopup(`<strong>${escapeHtml(ticket.ticket_number)}</strong><br>${escapeHtml(ticketAddress(ticket) || "GeoCall polygon")}`);
      polygon.on("click", (event) => {
        if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
        selectTicket(ticket.ticket_number, { focus: true });
      });
      polygon.on("dblclick", (event) => {
        if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
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
    const marker = L.circleMarker([ticket.latitude, ticket.longitude], {
      radius: selectedTicket?.ticket_number === ticket.ticket_number ? 10 : 7,
      color: pointColors.stroke,
      fillColor: pointColors.fill,
      opacity: ticketOpacity,
      fillOpacity: 0.88 * ticketOpacity,
      weight: selectedTicket?.ticket_number === ticket.ticket_number ? 5 : 4,
    });
    marker.bindPopup(`<strong>${escapeHtml(ticket.ticket_number)}</strong><br>${escapeHtml(ticketAddress(ticket))}`);
    marker.on("click", (event) => {
      if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
      selectTicket(ticket.ticket_number, { focus: true });
    });
    marker.on("dblclick", (event) => {
      if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
      selectTicket(ticket.ticket_number, { focus: true });
    });
    marker.addTo(markers);
    bounds.push([ticket.latitude, ticket.longitude]);
  }

  if (bounds.length && !initialTicketBoundsApplied && !pendingMapView) {
    initialTicketBoundsApplied = true;
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
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
  return `
    <button class="mobile-ticket-card ${priorityClasses} ${selected ? "active" : ""}" type="button" data-mobile-ticket="${escapeHtml(ticket.ticket_number)}">
      <span class="mobile-ticket-number">${escapeHtml(ticket.ticket_number)}</span>
      <span>${escapeHtml(ticket.county || "UNKNOWN")} · ${escapeHtml(ticket.work_begin_date || "")}</span>
      <strong>${escapeHtml(workDescription(ticket))}</strong>
      <small>${escapeHtml(ticketAddress(ticket))}</small>
    </button>
  `;
}

function renderMobileView() {
  if (!elements.mobileView || currentView !== "mobile") return;
  const list = visibleTickets();
  if (elements.mobileSummary) {
    elements.mobileSummary.textContent = `${list.length.toLocaleString()} active ticket${list.length === 1 ? "" : "s"}`;
  }
  if (!selectedTicket || !list.some((ticket) => ticket.ticket_number === selectedTicket.ticket_number)) {
    selectedTicket = list[0] || null;
  }
  if (elements.mobileTicketList) {
    elements.mobileTicketList.innerHTML = list.length
      ? list.map(mobileTicketCardHtml).join("")
      : '<div class="mobile-empty">No tickets match the current filters.</div>';
  }
  renderMobileTicketDetail();
  bindMobileView();
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
          <p>${escapeHtml(ticket.county)} · ${escapeHtml(ticket.message_type || ticket.work_type)}</p>
        </div>
        ${ticket.portal_html_available ? `<a href="/api/portal-html?ticket=${encodeURIComponent(ticket.ticket_number)}" target="_blank" rel="noreferrer">Ticket page</a>` : ""}
      </div>

      <div class="mobile-map-preview">
        ${embedUrl ? `<iframe title="Ticket map" loading="lazy" src="${escapeHtml(embedUrl)}"></iframe>` : '<div class="mobile-empty">No map coordinates available</div>'}
      </div>
      <div class="mobile-action-row">
        ${navUrl ? `<a class="mobile-primary-action" href="${escapeHtml(navUrl)}" target="_blank" rel="noreferrer">Navigate</a>` : ""}
        ${mapsUrl ? `<a class="mobile-secondary-action" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">Open Google Maps</a>` : ""}
        <button class="mobile-secondary-action" type="button" data-mobile-show-dashboard="${escapeHtml(ticket.ticket_number)}">Show on dashboard</button>
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
        ${actionControlHtml(ticket.ticket_number, true)}
        <label class="mobile-note">
          Note / description
          <textarea data-ticket-description="${escapeHtml(ticket.ticket_number)}" rows="3" placeholder="Add locator notes">${escapeHtml(ticketDescription(ticket.ticket_number))}</textarea>
        </label>
      </section>

      <section>
        <h4>Photos & videos</h4>
        <form class="mobile-upload-form" data-mobile-upload="${escapeHtml(ticket.ticket_number)}">
          <input type="file" name="files" multiple accept="image/*,video/*" capture="environment">
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
      renderMobileView();
      scheduleDashboardStateSave();
    });
  }
}

function bindMobileDetailControls() {
  if (!elements.mobileTicketDetail) return;
  const dashboardButton = elements.mobileTicketDetail.querySelector("[data-mobile-show-dashboard]");
  if (dashboardButton) {
    dashboardButton.addEventListener("click", () => {
      const ticketNumber = dashboardButton.dataset.mobileShowDashboard;
      setCurrentView("dashboard");
      selectTicket(ticketNumber, { focus: true });
    });
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

function renderDetail() {
  if (!selectedTicket) {
    elements.detail.hidden = true;
    elements.detail.classList.remove(
      "ticket-emergency-priority",
      "ticket-remark-priority",
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
  elements.detail.hidden = false;
  elements.detail.classList.toggle("ticket-emergency-priority", ticketIsEmergency(ticket));
  elements.detail.classList.toggle("ticket-remark-priority", ticketIsRemark(ticket));
  elements.detail.classList.toggle("ticket-tcw-dmi-work", ticketIsTcwDmiWork(ticket));
  elements.detail.classList.toggle("ticket-due-today", ticketDueStatus(ticket) === "due-today");
  elements.detail.classList.toggle("ticket-due-next", ticketDueStatus(ticket) === "due-next");
  elements.detail.classList.toggle("ticket-due-later", ticketDueStatus(ticket) === "due-later");
  elements.detail.classList.toggle("ticket-actioned", ticketHasActions(ticket.ticket_number));
  elements.detail.innerHTML = `
    <div class="detail-content ${priorityClasses}">
      <h2>${escapeHtml(ticket.ticket_number)}</h2>
      <div class="badge">${escapeHtml(ticket.county)} · ${escapeHtml(ticket.message_type)}</div>
      ${portalActions(ticket)}

      <h3>Actions</h3>
      ${actionControlHtml(ticket.ticket_number, false, { deferred: true })}

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
}

function selectTicket(ticketNumber, options = {}) {
  selectedTicket = tickets.find((ticket) => ticket.ticket_number === ticketNumber) || null;
  pendingSelectedTicketNumber = selectedTicket?.ticket_number || "";
  localStorage.setItem("selectedTicketNumber", pendingSelectedTicketNumber);
  const list = visibleTickets();
  renderList(list);
  renderMap(list);
  renderDetail();
  if (options.focus) {
    focusTicketOnMap(selectedTicket);
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
  elements.sourcePath.textContent = `Reading ${tickets.length} exported ticket(s) from ${payload.inbox_dir || payload.downloads_dir}`;
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
elements.undoAction.addEventListener("click", undoLastChange);
elements.redoAction.addEventListener("click", redoLastChange);
elements.showSheetView.addEventListener("click", () => setCurrentView("sheet"));
if (elements.showMobileView) elements.showMobileView.addEventListener("click", () => setCurrentView("mobile"));
elements.showDashboardView.addEventListener("click", () => setCurrentView("dashboard"));
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
elements.sheetBackToDashboard.addEventListener("click", () => setCurrentView("dashboard"));
if (elements.exportSheetPdf) elements.exportSheetPdf.addEventListener("click", exportSheetPdf);
if (elements.exportSheetExcel) elements.exportSheetExcel.addEventListener("click", exportSheetExcel);
if (elements.exportSheetCsv) elements.exportSheetCsv.addEventListener("click", exportSheetCsv);
if (elements.mobileBackToDashboard) elements.mobileBackToDashboard.addEventListener("click", () => setCurrentView("dashboard"));
if (elements.mobileSearch) {
  elements.mobileSearch.addEventListener("input", () => {
    updateTicketSearch(elements.mobileSearch.value);
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
elements.locatorDefaultToggle.addEventListener("change", async () => {
  try {
    await saveLocatorDefault({ enabled: elements.locatorDefaultToggle.checked, includeState: elements.locatorDefaultToggle.checked });
    if (locatorDefaultConfig.enabled && locatorDefaultConfig.state) {
      applyDashboardState(locatorDefaultConfig.state);
      render();
      renderVetroLayer();
    }
  } catch (error) {
    elements.locatorDefaultStatus.textContent = "Default save failed";
    console.error(error);
  }
});
elements.saveLocatorDefault.addEventListener("click", async () => {
  try {
    elements.locatorDefaultToggle.checked = true;
    await saveLocatorDefault({ enabled: true, includeState: true });
  } catch (error) {
    elements.locatorDefaultStatus.textContent = "Default save failed";
    console.error(error);
  }
});
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
  void setMapTileStyle(elements.mapStyle.value).catch((error) => console.error(error));
});
elements.vetroLayerFilter.addEventListener("input", (event) => {
  if (event.target.matches(".layer-color")) {
    rememberUndoState();
    vetroLayerColors[event.target.dataset.layerColor] = event.target.value;
    localStorage.setItem("vetroLayerColors", JSON.stringify(vetroLayerColors));
    renderVetroLayer();
    scheduleDashboardStateSave();
    scheduleEmployeeDashboardSync();
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
  if (event.target.matches(".layer-style")) {
    rememberUndoState();
    vetroLayerStyleOverrides[event.target.dataset.layerStyle] = event.target.value;
    vetroLayerStyleOverrides = normalizeObjectStorage(STORAGE_KEYS.vetroLayerStyles, vetroLayerStyleOverrides, (layerId, value) => vetroLayerStyleValid(layerId, value));
    renderVetroLayer();
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
  rememberUndoState();
  setAllChecked(elements.vetroLayerFilter, true);
  syncVetroLayerSelection();
  renderVetroLayer();
  scheduleEmployeeDashboardSync();
});
elements.vetroLayerClear.addEventListener("click", () => {
  rememberUndoState();
  setAllChecked(elements.vetroLayerFilter, false);
  syncVetroLayerSelection();
  renderVetroLayer();
  scheduleEmployeeDashboardSync();
});
[
  elements.vetroPlanFilter,
  elements.vetroBuildFilter,
  elements.vetroPlacementFilter,
  elements.vetroStatusFilter,
  elements.vetroGeometryFilter,
  elements.vetroFiberFilter,
  elements.vetroRouteFilter,
  elements.vetroPointFilter,
].forEach((container) => {
  container.addEventListener("change", () => {
    rememberUndoState();
    syncVetroFacetSelection();
    renderVetroLayer();
    scheduleEmployeeDashboardSync();
  });
});
[
  [elements.vetroPlanAll, elements.vetroPlanClear, elements.vetroPlanFilter],
  [elements.vetroStatusAll, elements.vetroStatusClear, elements.vetroStatusFilter],
  [elements.vetroFiberAll, elements.vetroFiberClear, elements.vetroFiberFilter],
  [elements.vetroPlacementAll, elements.vetroPlacementClear, elements.vetroPlacementFilter],
  [elements.vetroRouteAll, elements.vetroRouteClear, elements.vetroRouteFilter],
  [elements.vetroPointAll, elements.vetroPointClear, elements.vetroPointFilter],
  [elements.vetroGeometryAll, elements.vetroGeometryClear, elements.vetroGeometryFilter],
  [elements.vetroBuildAll, elements.vetroBuildClear, elements.vetroBuildFilter],
].forEach(([allButton, clearButton, container]) => {
  allButton.addEventListener("click", () => setFilterChecked(container, true));
  clearButton.addEventListener("click", () => setFilterChecked(container, false));
});
elements.vetroSearch.addEventListener("input", () => {
  rememberUndoState();
  syncVetroFacetSelection();
  renderVetroLayer();
  scheduleEmployeeDashboardSync();
});
elements.vetroSlToggle.addEventListener("change", () => {
  rememberUndoState();
  vetroSlVisible = elements.vetroSlToggle.checked;
  writeBooleanStorage(STORAGE_KEYS.vetroSlVisible, vetroSlVisible);
  renderVetroLayer();
  scheduleEmployeeDashboardSync();
});
elements.vetroSlShape.addEventListener("change", () => {
  rememberUndoState();
  vetroSlShape = elements.vetroSlShape.value;
  localStorage.setItem(STORAGE_KEYS.vetroSlShape, vetroSlShape);
  renderVetroLayer();
  scheduleEmployeeDashboardSync();
});
elements.vetroSlColor.addEventListener("change", () => {
  rememberUndoState();
  vetroSlColor = elements.vetroSlColor.value;
  localStorage.setItem(STORAGE_KEYS.vetroSlColor, vetroSlColor);
  renderVetroLayer();
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
});
elements.vetroSlOutlineColor.addEventListener("change", () => {
  rememberUndoState();
  vetroSlOutlineColor = elements.vetroSlOutlineColor.value;
  localStorage.setItem(STORAGE_KEYS.vetroSlOutlineColor, vetroSlOutlineColor);
  renderVetroLayer();
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
});
elements.vetroSlOpacity.addEventListener("input", () => {
  rememberUndoState();
  vetroSlOpacity = percentToOpacity(elements.vetroSlOpacity.value, vetroSlOpacity);
  localStorage.setItem(STORAGE_KEYS.vetroSlOpacity, String(vetroSlOpacity));
  renderVetroLayer();
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
});
elements.vetroSlSize.addEventListener("input", () => {
  rememberUndoState();
  vetroSlSize = clampNumber(elements.vetroSlSize.value, 8, 22, vetroSlSize);
  localStorage.setItem(STORAGE_KEYS.vetroSlSize, String(vetroSlSize));
  renderVetroLayer();
  scheduleDashboardStateSave();
  scheduleEmployeeDashboardSync();
});
elements.vetroSlLabels.addEventListener("change", () => {
  rememberUndoState();
  vetroSlLabels = elements.vetroSlLabels.checked;
  writeBooleanStorage(STORAGE_KEYS.vetroSlLabels, vetroSlLabels);
  renderVetroLayer();
  scheduleEmployeeDashboardSync();
});
elements.vetroColor.addEventListener("change", () => {
  rememberUndoState();
  vetroColor = elements.vetroColor.value;
  localStorage.setItem("vetroColor", vetroColor);
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
elements.sidebarCollapse.addEventListener("click", () => {
  rememberUndoState();
  setSidebarCollapsed(!sidebarCollapsed);
});
if (elements.legendToggle) {
  elements.legendToggle.addEventListener("click", () => showMapLegendTemporarily(3200));
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

async function bootstrap() {
  await loadMapConfig();
  await loadDashboardState().catch((error) => {
    console.warn("Unable to load dashboard state", error);
  });
  renderPriorityLegends();
  renderProfile();
  initMap();
  applySidebarCollapsed();
  try {
    await loadTickets();
  } catch (error) {
    elements.ticketList.innerHTML = `<div class="detail-content">${escapeHtml(error.message)}</div>`;
    throw error;
  }
  if (window.location.hash === "#mobile") {
    setCurrentView("mobile");
  } else if (window.location.hash === "#sheet") {
    setCurrentView("sheet");
  }
  dashboardStateReady = true;
  updateHistoryButtons();
  scheduleDashboardStateSave();
  await loadVetroControls().catch((error) => {
    elements.vetroStatus.textContent = "Error";
    console.error(error);
  });
  if (elements.vetroToggle.checked) {
    await setVetroVisible(true).catch((error) => {
      elements.vetroStatus.textContent = "Error";
      console.error(error);
    });
  }
  scheduleDashboardStateSave();
}

bootstrap().catch((error) => {
  elements.ticketList.innerHTML = `<div class="detail-content">${escapeHtml(error.message)}</div>`;
});
