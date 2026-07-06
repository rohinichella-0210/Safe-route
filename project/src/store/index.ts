import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Coordinates, Route, JourneySession, WalkSession, IncidentReport, TrustedPlace, PlatformStats, SafetyBreakdown, Location, TransportOption, SafetyZone, ChatMessage } from '../types';

interface AppState {
  // Map & Location
  currentLocation: Coordinates | null;
  setCurrentLocation: (coords: Coordinates | null) => void;
  mapViewport: { longitude: number; latitude: number; zoom: number; bearing: number; pitch: number };
  setMapViewport: (viewport: AppState['mapViewport']) => void;

  // Source and destination
  source: Location | null;
  destination: Location | null;
  setSource: (location: Location | null) => void;
  setDestination: (location: Location | null) => void;

  // Routes
  routes: Route[];
  selectedRoute: Route | null;
  setRoutes: (routes: Route[]) => void;
  setSelectedRoute: (route: Route | null) => void;
  isCalculatingRoutes: boolean;
  setIsCalculatingRoutes: (loading: boolean) => void;

  // Journey session (unique per device)
  journeySession: JourneySession | null;
  startJourney: () => void;
  endJourney: () => void;
  updateJourneyProgress: (coords: Coordinates, eta: number, distance: number) => void;

  // Walk With Me (real-time sharing)
  walkSession: WalkSession | null;
  sharedJourneyLink: string | null;
  startWalkWithMe: () => string;
  endWalkWithMe: () => void;
  viewerCount: number;
  setViewerCount: (count: number) => void;
  activeViewers: Array<{ id: string; joinedAt: Date; lastSeen: Date }>;
  setActiveViewers: (viewers: AppState['activeViewers']) => void;

  // Emergency
  isEmergencyActive: boolean;
  emergencyId: string | null;
  activateEmergency: () => void;
  deactivateEmergency: () => void;

  // Incidents & Safety
  incidentReports: IncidentReport[];
  setIncidentReports: (reports: IncidentReport[]) => void;
  nearbyIncidents: IncidentReport[];
  setNearbyIncidents: (reports: IncidentReport[]) => void;
  reportIncident: (report: Omit<IncidentReport, 'id' | 'reportedAt' | 'confidenceScore'>) => void;

  // Trusted Places
  trustedPlaces: TrustedPlace[];
  setTrustedPlaces: (places: TrustedPlace[]) => void;
  nearbyPlaces: TrustedPlace[];
  setNearbyPlaces: (places: TrustedPlace[]) => void;

  // Safety Zones (for heatmap)
  safetyZones: SafetyZone[];
  setSafetyZones: (zones: SafetyZone[]) => void;

  // Platform Stats
  platformStats: PlatformStats;
  setPlatformStats: (stats: PlatformStats) => void;

  // Safety Breakdown
  safetyBreakdown: SafetyBreakdown | null;
  setSafetyBreakdown: (breakdown: SafetyBreakdown | null) => void;

  // Transport
  transportOptions: TransportOption[];
  setTransportOptions: (options: TransportOption[]) => void;

  // AI Chat Assistant
  chatMessages: ChatMessage[];
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;

  // Area Alerts
  areaAlerts: Array<{ id: string; message: string; area: string; type: 'warning' | 'info' | 'danger'; timestamp: Date }>;
  addAreaAlert: (alert: AppState['areaAlerts'][0]) => void;
  clearAreaAlerts: () => void;

  // UI State
  currentPage: 'home' | 'dashboard' | 'navigation' | 'safe-places' | 'report' | 'stats' | 'settings' | 'viewer' | 'chat';
  setCurrentPage: (page: AppState['currentPage']) => void;
  isDrawerOpen: boolean;
  toggleDrawer: () => void;
  selectedPlaceCategory: string | null;
  setSelectedPlaceCategory: (category: string | null) => void;
  showHeatmap: boolean;
  setShowHeatmap: (show: boolean) => void;
  show3DView: boolean;
  setShow3DView: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Map & Location
  currentLocation: null,
  setCurrentLocation: (coords) => set({ currentLocation: coords }),
  mapViewport: {
    longitude: 80.2707,
    latitude: 13.0827,
    zoom: 12,
    bearing: 0,
    pitch: 45,
  },
  setMapViewport: (viewport) => set({ mapViewport: viewport }),

  // Source and destination
  source: null,
  destination: null,
  setSource: (location) => set({ source: location }),
  setDestination: (location) => set({ destination: location }),

  // Routes
  routes: [],
  selectedRoute: null,
  setRoutes: (routes) => set({ routes }),
  setSelectedRoute: (route) => set({ selectedRoute: route }),
  isCalculatingRoutes: false,
  setIsCalculatingRoutes: (loading) => set({ isCalculatingRoutes: loading }),

  // Journey session
  journeySession: null,
  startJourney: () => {
    const state = get();
    const sessionId = uuidv4();
    const session: JourneySession = {
      id: sessionId,
      sessionToken: sessionId,
      source: state.source?.coordinates || { lat: 0, lng: 0 },
      destination: state.destination?.coordinates || { lat: 0, lng: 0 },
      currentLocation: state.currentLocation || { lat: 0, lng: 0 },
      selectedRoute: state.selectedRoute,
      startedAt: new Date(),
      status: 'active',
      eta: state.selectedRoute?.durationSeconds || 0,
      remainingDistance: state.selectedRoute?.distanceMeters || 0,
    };
    set({ journeySession: session, currentPage: 'navigation' });
  },
  endJourney: () => {
    set({
      journeySession: null,
      walkSession: null,
      sharedJourneyLink: null,
      isEmergencyActive: false,
      emergencyId: null,
      currentPage: 'home',
      selectedRoute: null,
      routes: [],
      source: null,
      destination: null,
    });
  },
  updateJourneyProgress: (coords, eta, distance) => {
    set((state) => ({
      currentLocation: coords,
      journeySession: state.journeySession
        ? { ...state.journeySession, currentLocation: coords, eta, remainingDistance: distance }
        : null,
    }));
  },

  // Walk With Me
  walkSession: null,
  sharedJourneyLink: null,
  startWalkWithMe: () => {
    const state = get();
    const shareToken = uuidv4();
    const sessionId = state.journeySession?.id || uuidv4();
    const shareLink = `${window.location.origin}/view/${shareToken}`;

    const walkSession: WalkSession = {
      id: uuidv4(),
      sessionId,
      shareToken,
      viewerCount: 0,
      isActive: true,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    };

    set({ walkSession, sharedJourneyLink: shareLink });
    return shareLink;
  },
  endWalkWithMe: () => set({ walkSession: null, sharedJourneyLink: null, viewerCount: 0, activeViewers: [] }),
  viewerCount: 0,
  setViewerCount: (count) => set({ viewerCount: count }),
  activeViewers: [],
  setActiveViewers: (viewers) => set({ activeViewers: viewers }),

  // Emergency
  isEmergencyActive: false,
  emergencyId: null,
  activateEmergency: () => {
    const emergencyId = uuidv4();
    set({ isEmergencyActive: true, emergencyId, currentPage: 'navigation' });
  },
  deactivateEmergency: () => set({ isEmergencyActive: false, emergencyId: null }),

  // Incidents
  incidentReports: [],
  setIncidentReports: (reports) => set({ incidentReports: reports }),
  nearbyIncidents: [],
  setNearbyIncidents: (reports) => set({ nearbyIncidents: reports }),
  reportIncident: (report) => {
    const newReport: IncidentReport = {
      id: uuidv4(),
      ...report,
      reportedAt: new Date(),
      confidenceScore: 50,
    };
    set((state) => ({ incidentReports: [...state.incidentReports, newReport] }));
  },

  // Trusted Places
  trustedPlaces: [],
  setTrustedPlaces: (places) => set({ trustedPlaces: places }),
  nearbyPlaces: [],
  setNearbyPlaces: (places) => set({ nearbyPlaces: places }),

  // Safety Zones
  safetyZones: [],
  setSafetyZones: (zones) => set({ safetyZones: zones }),

  // Platform Stats
  platformStats: {
    verifiedIncidents: 0,
    activeReports: 0,
    trustedPlacesCount: 0,
    communityValidations: 0,
    routesAnalyzed: 0,
    activeJourneys: 0,
    areasCovered: 0,
  },
  setPlatformStats: (stats) => set({ platformStats: stats }),

  // Safety Breakdown
  safetyBreakdown: null,
  setSafetyBreakdown: (breakdown) => set({ safetyBreakdown: breakdown }),

  // Transport
  transportOptions: [],
  setTransportOptions: (options) => set({ transportOptions: options }),

  // AI Chat
  chatMessages: [],
  addChatMessage: (message) => {
    const newMessage: ChatMessage = {
      id: uuidv4(),
      ...message,
      timestamp: new Date(),
    };
    set((state) => ({ chatMessages: [...state.chatMessages, newMessage] }));
  },
  clearChat: () => set({ chatMessages: [] }),
  isTyping: false,
  setIsTyping: (typing) => set({ isTyping: typing }),

  // Area Alerts
  areaAlerts: [],
  addAreaAlert: (alert) => set((state) => ({ areaAlerts: [...state.areaAlerts, alert] })),
  clearAreaAlerts: () => set({ areaAlerts: [] }),

  // UI State
  currentPage: 'home',
  setCurrentPage: (page) => set({ currentPage: page }),
  isDrawerOpen: false,
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
  selectedPlaceCategory: null,
  setSelectedPlaceCategory: (category) => set({ selectedPlaceCategory: category }),
  showHeatmap: false,
  setShowHeatmap: (show) => set({ showHeatmap: show }),
  show3DView: false,
  setShow3DView: (show) => set({ show3DView: show }),
}));
