export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Location {
  address: string;
  coordinates: Coordinates;
  placeId?: string;
}

export interface Route {
  id: string;
  name: string;
  distance: string;
  distanceMeters: number;
  duration: string;
  durationSeconds: number;
  polyline: string;
  overviewPolyline: string;
  coordinates: Coordinates[];
  safetyScore: number;
  incidentScore: number;
  lightingScore: number;
  trustedPlacesScore: number;
  crowdScore: number;
  confidenceScore: number;
  streetlightData: StreetlightInfo[];
  incidentData: IncidentOnRoute[];
  trustedPlacesOnRoute: TrustedPlace[];
  isRecommended: boolean;
  steps: RouteStep[];
  warnings: string[];
  color: string;
 ETA: Date;
  segments: RouteSegment[];
}

export interface RouteSegment {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  lightColor: string;
  safetyScore: number;
  streetName: string;
  lightingLevel: 'excellent' | 'good' | 'moderate' | 'poor' | 'dark';
  incidentCount: number;
  crowdDensity: 'high' | 'medium' | 'low' | 'none';
  isNearbySafePlace: boolean;
  safePlaceCount: number;
  distance: number;
  duration: number;
}

export interface StreetlightInfo {
  id: string;
  latitude: number;
  longitude: number;
  status: 'functional' | 'non_functional' | 'dim';
  brightness: number;
  lastChecked: Date;
}

export interface IncidentOnRoute {
  id: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceFromPath: number;
  severity: 'low' | 'medium' | 'high';
  reportedAt: Date;
}

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  startLocation: Coordinates;
  endLocation: Coordinates;
  maneuver: string;
}

export interface SafetyBreakdown {
  overall: number;
  incidents: number;
  lighting: number;
  trustedPlaces: number;
  crowdActivity: number;
  nightSafety: number;
  confidence: number;
  explanation: string[];
  factors: SafetyFactor[];
}

export interface SafetyFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
  trend: 'up' | 'down' | 'stable';
}

export interface IncidentReport {
  id: string;
  category: IncidentCategory;
  description?: string;
  latitude: number;
  longitude: number;
  reportedAt: Date;
  confidenceScore: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  severity: 'low' | 'medium' | 'high';
  votes: number;
  confirmations: number;
  rejections: number;
  area: string;
}

export type IncidentCategory =
  | 'harassment'
  | 'poor_lighting'
  | 'suspicious_activity'
  | 'unsafe_area'
  | 'road_obstruction'
  | 'broken_streetlight'
  | 'public_disturbance'
  | 'theft'
  | 'stalking'
  | 'other';

export interface TrustedPlace {
  id: string;
  name: string;
  category: TrustedPlaceCategory;
  latitude: number;
  longitude: number;
  address?: string;
  distance?: number;
  walkingTime?: number;
  isOpen24Hours?: boolean;
  contactNumber?: string;
  openStatus: 'open' | 'closed' | 'unknown';
  nextOpenTime?: string;
}

export type TrustedPlaceCategory =
  | 'police_station'
  | 'womens_police_station'
  | 'hospital'
  | 'government_hospital'
  | 'pharmacy'
  | 'metro_station'
  | 'bus_stop'
  | 'railway_station'
  | 'petrol_bunk'
  | 'government_office'
  | 'hotel'
  | 'restaurant'
  | 'bank'
  | 'shopping_mall'
  | 'public_facility'
  | 'atm'
  | 'call_center'
  | 'restroom';

export interface JourneySession {
  id: string;
  sessionToken: string;
  source: Coordinates;
  destination: Coordinates;
  currentLocation: Coordinates;
  selectedRoute: Route | null;
  startedAt: Date;
  status: 'active' | 'completed' | 'emergency' | 'paused';
  eta: number;
  remainingDistance: number;
  completedSegments: number;
  totalSegments: number;
  speed: number;
}

export interface WalkSession {
  id: string;
  sessionId: string;
  shareToken: string;
  viewerCount: number;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface Viewer {
  id: string;
  walkSessionId: string;
  joinedAt: Date;
  lastActivity: Date;
  connectionStatus: 'connected' | 'disconnected';
}

export interface EmergencyEvent {
  id: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved';
  viewersNotified: number;
}

export interface PlatformStats {
  verifiedIncidents: number;
  activeReports: number;
  trustedPlacesCount: number;
  communityValidations: number;
  routesAnalyzed: number;
  activeJourneys: number;
  areasCovered: number;
}

export interface TransportOption {
  type: 'metro' | 'bus' | 'auto' | 'walking' | 'walking_metro' | 'walking_bus' | 'cab';
  name: string;
  duration: string;
  durationMinutes: number;
  fare?: string;
  fareAmount?: number;
  routeNumber?: string;
  stops?: string[];
  safetyScore: number;
  departure?: string;
  arrival?: string;
  frequency?: string;
  transferCount?: number;
}

export interface SafetyZone {
  id: string;
  area: string;
  centerLat: number;
  centerLng: number;
  radius: number;
  safetyScore: number;
  incidentCount: number;
  streetlightCount: number;
  trustedPlaceCount: number;
  lastUpdated: Date;
  level: 'low' | 'moderate' | 'high' | 'excellent';
  populationDensity: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

export interface AreaAlert {
  id: string;
  message: string;
  area: string;
  type: 'warning' | 'info' | 'danger';
  timestamp: Date;
  incident?: IncidentReport;
}

export interface WeatherData {
  temperature: number;
  condition: 'clear' | 'cloudy' | 'rain' | 'storm';
  humidity: number;
  windSpeed: number;
  visibility: number;
  isSafeToWalk: boolean;
}

export interface DeviceSession {
  deviceId: string;
  sessionId: string;
  isActive: boolean;
  lastLocation: Coordinates;
  lastSeen: Date;
}

export type ViewMode =
  | 'home'
  | 'route_selection'
  | 'navigation'
  | 'walk_with_me'
  | 'emergency'
  | 'report_incident'
  | 'safe_places'
  | 'transport'
  | 'dashboard'
  | 'chat'
  | 'viewer_dashboard';
