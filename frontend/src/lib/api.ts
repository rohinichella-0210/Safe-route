import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL as string;

export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 60000,
});

export interface LatLng { lat: number; lng: number; }
export interface Place { label: string; lat: number; lng: number; type?: string; }

export interface ScoreFactor {
  factor: string; weight: number; score: number; confidence: number; detail: string; source: string;
}
export interface RouteSafety {
  score: number; band: string; breakdown: ScoreFactor[]; confidence: number;
  verified_incidents_near_route: number; pending_incidents_near_route: number;
  safe_places_near_route: number; length_m: number;
}
export interface RouteResult {
  id: number; distance_m: number; duration_s: number;
  geometry: number[][]; steps: any[]; safety: RouteSafety; mode: string; label: string;
}
export interface SafePlace { id: string; name: string; category: string; lat: number; lng: number; distance_m: number; }
export interface Incident {
  id: string; category: string; description?: string; lat: number; lng: number;
  status: string; verified_count: number; disputed_count: number;
  source: string; source_url?: string; distance_m?: number; created_at?: string;
}

export const searchPlaces = async (q: string): Promise<Place[]> => {
  const r = await api.get('/geocode', { params: { q } });
  return r.data.results;
};

export const computeRoutes = async (source: LatLng, destination: LatLng, mode = 'walking') => {
  const r = await api.post('/routes', { source, destination, mode });
  return r.data as { routes: RouteResult[]; departure: string; weights: Record<string, number> };
};

export const fetchSafePlaces = async (lat: number, lng: number, radius_m = 1500, category?: string) => {
  const r = await api.get('/safe-places', { params: { lat, lng, radius_m, category } });
  return r.data as { places: SafePlace[]; total: number; source: string };
};

export const fetchIncidents = async (lat?: number, lng?: number, radius_m = 3000) => {
  const r = await api.get('/incidents', { params: { lat, lng, radius_m } });
  return r.data as { incidents: Incident[] };
};

export const submitIncident = async (payload: {
  category: string; description?: string; lat: number; lng: number;
  reporter_lat?: number; reporter_lng?: number;
}) => (await api.post('/incidents', payload)).data;

export const confirmIncident = async (id: string, disputed = false) =>
  (await api.post(`/incidents/${id}/confirm`, null, { params: { disputed } })).data;

export const startJourney = async (payload: {
  route_geometry: number[][]; destination: LatLng; destination_label?: string;
  estimated_duration_sec: number; estimated_distance_m: number; safety_score: number;
}) => (await api.post('/journeys', payload)).data as { id: string; share_token: string; expires_at: string; };

export const getJourney = async (token: string) => (await api.get(`/journeys/${token}`)).data;

export const pingJourney = async (token: string, lat: number, lng: number, speed?: number, heading?: number) =>
  (await api.post(`/journeys/${token}/ping`, { lat, lng, speed, heading })).data;

export const triggerSOS = async (token: string, lat: number, lng: number, message?: string) =>
  (await api.post(`/journeys/${token}/sos`, { lat, lng, message })).data;

export const completeJourney = async (token: string) =>
  (await api.post(`/journeys/${token}/complete`)).data;

export const dashboardStats = async () => (await api.get('/dashboard/stats')).data;
