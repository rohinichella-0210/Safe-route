import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from './store';
import {
  cn,
  getSafetyColor,
  getSafetyLabel,
  formatDuration,
  formatDistance,
} from './lib/utils';
import {
  supabase,
  fetchPlatformStats,
  createJourneySession,
  endJourneySession,
  reportIncidentToDb,
} from './lib/supabase';
import type { Coordinates, Route, SafetyZone, RouteSegment, IncidentReport, TrustedPlace } from './types';
import {
  Shield, Navigation, MapPin, AlertTriangle, Clock, Users, X, Copy,
  Phone, Flag, CheckCircle2, Info, Loader2, Crosshair, Eye, Sparkles,
  MessageCircle, Layers, Heart, ChevronDown, ChevronUp, Send, Bot,
  AlertCircle, BarChart3, Bus, Train, Car, Sun,
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

// ── Constants ────────────────────────────────────────────────────────────────
const CHENNAI_CENTER: Coordinates = { lat: 13.0827, lng: 80.2707 };

const CHENNAI_AREAS = [
  { name: 'T. Nagar',         lat: 13.0410, lng: 80.2331, safety: 72 },
  { name: 'Anna Nagar',       lat: 13.0868, lng: 80.2128, safety: 85 },
  { name: 'Nungambakkam',     lat: 13.0603, lng: 80.2436, safety: 78 },
  { name: 'Adyar',            lat: 13.0068, lng: 80.2580, safety: 82 },
  { name: 'Mylapore',         lat: 13.0369, lng: 80.2688, safety: 75 },
  { name: 'Chennai Central',  lat: 13.0839, lng: 80.2747, safety: 70 },
  { name: 'Egmore',           lat: 13.0663, lng: 80.2548, safety: 73 },
  { name: 'Velachery',        lat: 12.9812, lng: 80.2181, safety: 68 },
  { name: 'Porur',            lat: 13.0332, lng: 80.1551, safety: 65 },
  { name: 'Thousand Lights',  lat: 13.0412, lng: 80.2465, safety: 79 },
  { name: 'Chromepet',        lat: 12.9520, lng: 80.1400, safety: 62 },
  { name: 'Kodambakkam',      lat: 13.0498, lng: 80.2320, safety: 74 },
  { name: 'Ashok Nagar',      lat: 13.0369, lng: 80.2206, safety: 69 },
  { name: 'Besant Nagar',     lat: 13.0012, lng: 80.2689, safety: 88 },
  { name: 'Kilpauk',          lat: 13.0825, lng: 80.2435, safety: 83 },
  { name: 'Purasavakkam',     lat: 13.1044, lng: 80.2500, safety: 77 },
  { name: 'Chetpet',          lat: 13.0728, lng: 80.2356, safety: 76 },
  { name: 'Tambaram',         lat: 12.9249, lng: 80.1000, safety: 67 },
  { name: 'Perungudi',        lat: 12.9594, lng: 80.2416, safety: 64 },
  { name: 'Kelambakkam',      lat: 12.8001, lng: 80.2264, safety: 63 },
];

const ROUTE_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed'];

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildSafetyZones(): SafetyZone[] {
  return CHENNAI_AREAS.map((area, i) => ({
    id: `z${i}`,
    area: area.name,
    centerLat: area.lat,
    centerLng: area.lng,
    radius: 900 + Math.random() * 600,
    safetyScore: area.safety + Math.floor((Math.random() - 0.5) * 8),
    incidentCount: Math.floor(Math.random() * 15),
    streetlightCount: Math.floor(Math.random() * 40) + 10,
    trustedPlaceCount: Math.floor(Math.random() * 8) + 2,
    lastUpdated: new Date(),
    level: area.safety >= 80 ? 'excellent' : area.safety >= 70 ? 'high' : area.safety >= 60 ? 'moderate' : 'low',
    populationDensity: Math.floor(Math.random() * 5000) + 1000,
  }));
}

function calcSegments(coords: Coordinates[]): RouteSegment[] {
  const streets = ['Anna Salai', 'Mount Road', 'Kodambakkam High Road', 'Poonamallee High Road', 'Rajaji Salai'];
  return coords.slice(0, -1).map((_, i) => {
    const base = 50 + Math.random() * 40;
    return {
      id: `s${i}`,
      startLat: coords[i].lat, startLng: coords[i].lng,
      endLat: coords[i + 1].lat, endLng: coords[i + 1].lng,
      lightColor: '#3b82f6',
      safetyScore: Math.floor(base),
      streetName: streets[Math.floor(Math.random() * streets.length)],
      lightingLevel: base >= 85 ? 'excellent' : base >= 65 ? 'good' : base >= 45 ? 'moderate' : base >= 25 ? 'poor' : 'dark',
      incidentCount: Math.floor(Math.random() * 3),
      crowdDensity: (['high', 'medium', 'low', 'none'] as const)[Math.floor(Math.random() * 4)],
      isNearbySafePlace: Math.random() > 0.6,
      safePlaceCount: Math.floor(Math.random() * 4),
      distance: 60 + Math.random() * 200,
      duration: 40 + Math.random() * 130,
    };
  });
}

function calcSafety(incidents: IncidentReport[]) {
  const inc = Math.max(30, Math.min(95, 75 - incidents.length * 2 + Math.floor(Math.random() * 15)));
  const light = Math.floor(50 + Math.random() * 40);
  const places = Math.floor(55 + Math.random() * 40);
  const h = new Date().getHours();
  const peak = (h >= 8 && h <= 10) || (h >= 17 && h <= 20);
  const crowd = peak ? Math.floor(70 + Math.random() * 25) : Math.floor(55 + Math.random() * 30);
  const conf = Math.floor(70 + Math.random() * 25);
  return {
    score: Math.round(inc * 0.3 + light * 0.2 + places * 0.2 + crowd * 0.15 + conf * 0.15),
    inc, light, places, crowd, conf,
  };
}

// Nominatim autocomplete
async function nominatimSearch(q: string) {
  const p = new URLSearchParams({ q: q + ' Chennai', format: 'json', limit: '6', countrycodes: 'in', viewbox: '80.10,12.75,80.45,13.25', bounded: '0' });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, { headers: { 'Accept-Language': 'en' } });
    return await res.json() as { display_name: string; lat: string; lon: string }[];
  } catch { return []; }
}

// OSRM routing (free, no key)
async function osrmRoute(from: Coordinates, to: Coordinates) {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      const r = data.routes[0];
      return {
        coords: r.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })) as Coordinates[],
        distanceM: r.distance as number,
        durationS: r.duration as number,
      };
    }
  } catch {}
  return null;
}

// ── Leaflet map icons (pure SVG, no file paths) ──────────────────────────────
function makeDivIcon(color: string, size = 22) {
  return L.divIcon({
    html: `<svg width="${size}" height="${Math.round(size * 1.4)}" viewBox="0 0 24 33" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 21 12 21S24 21 24 12C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4.5" fill="white" fill-opacity="0.9"/>
    </svg>`,
    className: '',
    iconSize: [size, Math.round(size * 1.4)],
    iconAnchor: [size / 2, Math.round(size * 1.4)],
    popupAnchor: [0, -Math.round(size * 1.4)],
  });
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function App() {
  // Map refs (vanilla Leaflet)
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);

  // Search state
  const [searchValue, setSearchValue] = useState('');
  const [suggestions, setSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [showChat, setShowChat] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [safetyZones] = useState<SafetyZone[]>(() => buildSafetyZones());
  const [selectedZone, setSelectedZone] = useState<SafetyZone | null>(null);
  const [chatInput, setChatInput] = useState('');

  const {
    currentLocation, setCurrentLocation,
    source, setSource,
    destination, setDestination,
    routes, setRoutes,
    selectedRoute, setSelectedRoute,
    isCalculatingRoutes, setIsCalculatingRoutes,
    journeySession, startJourney, endJourney, updateJourneyProgress,
    walkSession, startWalkWithMe, endWalkWithMe, sharedJourneyLink, viewerCount,
    isEmergencyActive, activateEmergency, deactivateEmergency,
    incidentReports, setIncidentReports, reportIncident,
    trustedPlaces, setTrustedPlaces,
    platformStats, setPlatformStats,
    currentPage, setCurrentPage,
    showHeatmap, setShowHeatmap,
    chatMessages, addChatMessage, isTyping, setIsTyping,
  } = useAppStore();

  // ── Initialize Leaflet map ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, {
      center: [CHENNAI_CENTER.lat, CHENNAI_CENTER.lng],
      zoom: 13,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
      maxZoom: 20,
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Clear all dynamic layers ───────────────────────────────────────────────
  const clearLayers = useCallback(() => {
    if (!mapRef.current) return;
    layersRef.current.forEach((layer) => {
      try { mapRef.current.removeLayer(layer); } catch {}
    });
    layersRef.current = [];
  }, []);

  const addLayer = (layer: any) => {
    if (!mapRef.current) return;
    layer.addTo(mapRef.current);
    layersRef.current.push(layer);
  };

  // ── Re-render map layers whenever data changes ─────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    clearLayers();

    // Safety heatmap circles
    if (showHeatmap) {
      safetyZones.forEach((zone) => {
        const color = zone.safetyScore >= 80 ? '#10b981' : zone.safetyScore >= 65 ? '#f59e0b' : '#ef4444';
        const circle = L.circle([zone.centerLat, zone.centerLng], {
          radius: zone.radius,
          color, fillColor: color, fillOpacity: 0.18, weight: 1.5, opacity: 0.5,
        });
        circle.bindTooltip(`<b>${zone.area}</b><br/>Safety: ${zone.safetyScore}/100<br/>Incidents: ${zone.incidentCount}`, { sticky: true });
        circle.on('click', () => setSelectedZone(zone));
        addLayer(circle);
      });
    }

    // Incident markers
    incidentReports.forEach((inc) => {
      const marker = L.marker([inc.latitude, inc.longitude], { icon: makeDivIcon('#ef4444', 14) });
      marker.bindPopup(`<div style="font-size:12px;min-width:140px"><b style="text-transform:capitalize">${inc.category.replace(/_/g, ' ')}</b>${inc.description ? `<p style="color:#666;margin:2px 0">${inc.description}</p>` : ''}<p style="color:${inc.severity === 'high' ? '#dc2626' : inc.severity === 'medium' ? '#d97706' : '#2563eb'};font-weight:600;margin-top:4px">${inc.severity} severity</p></div>`);
      addLayer(marker);
    });

    // Trusted place markers
    trustedPlaces.forEach((p) => {
      const marker = L.marker([p.latitude, p.longitude], { icon: makeDivIcon('#10b981', 12) });
      marker.bindPopup(`<div style="font-size:12px;min-width:140px"><b>${p.name}</b><p style="color:#666;text-transform:capitalize">${p.category.replace(/_/g, ' ')}</p>${p.isOpen24Hours ? '<p style="color:#059669;font-weight:600">Open 24 hours</p>' : ''}</div>`);
      addLayer(marker);
    });

    // All routes (non-selected dimmed)
    routes.forEach((route) => {
      if (route.id === selectedRoute?.id) return;
      const line = L.polyline(route.coordinates.map((c) => [c.lat, c.lng]), {
        color: route.color, weight: 4, opacity: 0.35, dashArray: '8 8',
      });
      line.on('click', () => setSelectedRoute(route));
      addLayer(line);
    });

    // Selected route (bold)
    if (selectedRoute && selectedRoute.coordinates.length > 1) {
      const coords = selectedRoute.coordinates.map((c) => [c.lat, c.lng]);
      addLayer(L.polyline(coords, { color: '#000', weight: 11, opacity: 0.10 }));
      addLayer(L.polyline(coords, { color: selectedRoute.color, weight: 7, opacity: 1, lineCap: 'round', lineJoin: 'round' }));
    }

    // Source / Destination / Current location markers
    if (source) {
      addLayer(L.marker([source.coordinates.lat, source.coordinates.lng], { icon: makeDivIcon('#22c55e', 22) }).bindPopup(`<b>From:</b> ${source.address}`));
    }
    if (destination) {
      addLayer(L.marker([destination.coordinates.lat, destination.coordinates.lng], { icon: makeDivIcon('#ef4444', 22) }).bindPopup(`<b>To:</b> ${destination.address}`));
    }
    if (currentLocation) {
      addLayer(L.circleMarker([currentLocation.lat, currentLocation.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }).bindPopup('You are here'));
      // Accuracy pulse ring
      addLayer(L.circleMarker([currentLocation.lat, currentLocation.lng], { radius: 18, color: '#3b82f6', weight: 2, fillOpacity: 0, opacity: 0.4 }));
    }
  }, [showHeatmap, safetyZones, incidentReports, trustedPlaces, routes, selectedRoute, source, destination, currentLocation, clearLayers]);

  // Fit map to route bounds
  useEffect(() => {
    if (!mapRef.current || !selectedRoute || selectedRoute.coordinates.length < 2) return;
    const bounds = L.latLngBounds(selectedRoute.coordinates.map((c) => [c.lat, c.lng]));
    mapRef.current.fitBounds(bounds, { padding: [60, 60] });
  }, [selectedRoute]);

  // ── Init data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPlatformStats().then(setPlatformStats);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(loc);
        if (mapRef.current) mapRef.current.setView([loc.lat, loc.lng], 14);
      },
      () => setCurrentLocation(CHENNAI_CENTER),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    supabase.from('incident_reports').select('*').eq('is_active', true).order('reported_at', { ascending: false }).limit(60)
      .then(({ data }) => {
        if (data) setIncidentReports(data.map((d: any) => ({
          id: d.id, category: d.category, description: d.description,
          latitude: d.latitude, longitude: d.longitude,
          reportedAt: new Date(d.reported_at), confidenceScore: d.confidence_score,
          verificationStatus: d.verification_status, severity: d.severity,
          votes: 0, confirmations: 0, rejections: 0, area: 'Chennai',
        })));
      });
  }, []);

  useEffect(() => {
    supabase.from('trusted_places').select('*').eq('is_active', true)
      .then(({ data }) => {
        if (data) setTrustedPlaces(data.map((p: any) => ({
          id: p.id, name: p.name, category: p.category,
          latitude: p.latitude, longitude: p.longitude,
          address: p.address, isOpen24Hours: p.is_24_hours,
          contactNumber: p.contact_number, openStatus: 'open' as const,
        })));
      });
  }, []);

  // ── Search / autocomplete ──────────────────────────────────────────────────
  const handleSearchChange = (val: string) => {
    setSearchValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 3) { setSuggestions([]); return; }
    setLoadingSuggest(true);
    debounceRef.current = setTimeout(async () => {
      const results = await nominatimSearch(val);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setLoadingSuggest(false);
    }, 400);
  };

  const pickSuggestion = (item: { display_name: string; lat: string; lon: string }) => {
    const loc = {
      address: item.display_name,
      coordinates: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
    };
    setDestination(loc);
    setSearchValue(item.display_name.split(',')[0]);
    setSuggestions([]);
    setShowSuggestions(false);
    if (!source && currentLocation) setSource({ address: 'Your Location', coordinates: currentLocation });
  };

  // ── Route calculation ──────────────────────────────────────────────────────
  const calculateRoutes = useCallback(async () => {
    const from = source?.coordinates || currentLocation;
    if (!from || !destination?.coordinates) {
      toast.error('Please select a destination first.');
      return;
    }
    setIsCalculatingRoutes(true);
    try {
      const r = await osrmRoute(from, destination.coordinates);
      if (!r) { toast.error('Could not find a route. Try another destination.'); return; }

      const s = calcSafety(incidentReports);
      const route: Route = {
        id: 'route-0',
        name: 'Safest Walking Route',
        distance: r.distanceM >= 1000 ? `${(r.distanceM / 1000).toFixed(1)} km` : `${Math.round(r.distanceM)} m`,
        distanceMeters: r.distanceM,
        duration: r.durationS >= 3600 ? `${Math.floor(r.durationS / 3600)}h ${Math.floor((r.durationS % 3600) / 60)}m` : `${Math.ceil(r.durationS / 60)} min`,
        durationSeconds: r.durationS,
        polyline: '', overviewPolyline: '',
        coordinates: r.coords,
        safetyScore: s.score, incidentScore: s.inc, lightingScore: s.light,
        trustedPlacesScore: s.places, crowdScore: s.crowd, confidenceScore: s.conf,
        isRecommended: true, steps: [], warnings: [],
        color: ROUTE_COLORS[0],
        ETA: new Date(Date.now() + r.durationS * 1000),
        streetlightData: [], incidentData: [], trustedPlacesOnRoute: [],
        segments: calcSegments(r.coords),
      };
      setRoutes([route]);
      setSelectedRoute(route);
      setShowRouteDetails(true);
      toast.success('Safe route found!');
    } catch {
      toast.error('Routing failed. Please try again.');
    } finally {
      setIsCalculatingRoutes(false);
    }
  }, [source, destination, currentLocation, incidentReports, setIsCalculatingRoutes, setRoutes, setSelectedRoute]);

  // Auto-calculate when destination is set
  useEffect(() => {
    if (destination && (source || currentLocation) && routes.length === 0 && !isCalculatingRoutes) {
      calculateRoutes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  // ── Navigation actions ─────────────────────────────────────────────────────
  const handleStartNavigation = async () => {
    if (!selectedRoute || !currentLocation) return;
    startJourney();
    try {
      await createJourneySession(
        (source?.coordinates || currentLocation).lat,
        (source?.coordinates || currentLocation).lng,
        destination!.coordinates.lat,
        destination!.coordinates.lng
      );
    } catch {}
    navigator.geolocation.watchPosition(
      (pos) => updateJourneyProgress({ lat: pos.coords.latitude, lng: pos.coords.longitude }, selectedRoute.durationSeconds, selectedRoute.distanceMeters),
      () => {}, { enableHighAccuracy: true, maximumAge: 5000 }
    );
    toast.success('Navigation started. Stay safe!');
  };

  const handleEndNavigation = async () => {
    if (journeySession?.sessionToken) await endJourneySession(journeySession.sessionToken).catch(() => {});
    endJourney();
    if (walkSession) endWalkWithMe();
    setRoutes([]);
    toast.success('Journey ended safely!');
  };

  const handleWalkWithMe = () => {
    const link = startWalkWithMe();
    navigator.clipboard.writeText(link).catch(() => {});
    toast.success('Share link copied! Send it to trusted contacts.');
  };

  const handleReportIncident = async (category: string) => {
    if (!currentLocation) { toast.error('Location unavailable'); return; }
    reportIncident({ category: category as any, latitude: currentLocation.lat, longitude: currentLocation.lng, verificationStatus: 'pending', severity: 'medium' });
    await reportIncidentToDb(category, '', currentLocation.lat, currentLocation.lng).catch(() => {});
    toast.success('Incident reported. Thank you!');
    setShowIncidentModal(false);
  };

  const sendChat = (text: string) => {
    if (!text.trim()) return;
    addChatMessage({ role: 'user', content: text });
    setChatInput('');
    setIsTyping(true);
    setTimeout(() => {
      const r: Record<string, string> = {
        police: 'Nearest: Egmore Police Station (0.8 km), T. Nagar Police Station (1.5 km). Emergency: 100.',
        hospital: 'Nearest: Govt. General Hospital (1.1 km), Apollo (2.3 km). Ambulance: 108.',
        safe: 'Safest areas now: Besant Nagar (88), Anna Nagar (85), Kilpauk (83). Avoid isolated streets after 9 PM.',
        route: 'Enter your destination in the search bar. Routes are automatically calculated with safety scores.',
        walk: 'Walk With Me shares your live location. Press "Walk With Me" during navigation to get a shareable link.',
        light: 'Lighting scores are shown per route segment — look for the lighting breakdown in route details.',
      };
      const key = Object.keys(r).find((k) => text.toLowerCase().includes(k));
      addChatMessage({ role: 'assistant', content: key ? r[key] : 'I can help with safe routes, nearby police stations, hospitals, and how to use SafeRoute features. What do you need?' });
      setIsTyping(false);
    }, 1200);
  };

  const recenterMap = () => {
    if (mapRef.current && currentLocation) mapRef.current.setView([currentLocation.lat, currentLocation.lng], 16);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-zinc-100">
      <Toaster position="top-center" toastOptions={{ style: { fontSize: 13 } }} />

      {/* ─ HEADER ─ */}
      <header className="flex-shrink-0 bg-white border-b border-zinc-200 z-[1000] relative shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-md">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                SafeRoute
              </h1>
              <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                Chennai, Tamil Nadu
              </p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { id: 'home', label: 'Home' },
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'safe-places', label: 'Safe Places' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id as any)}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all',
                  currentPage === item.id ? 'bg-blue-100 text-blue-700' : 'text-zinc-600 hover:bg-zinc-100'
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              title="Safety heatmap"
              className={cn('p-2 rounded-xl transition-all', showHeatmap ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-zinc-100 text-zinc-500')}
            >
              <Layers className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className="p-2 rounded-xl hover:bg-zinc-100 relative text-zinc-500"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">AI</span>
            </button>
            <button onClick={() => setShowIncidentModal(true)} className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100">
              <Flag className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden flex gap-1.5 px-4 pb-2 overflow-x-auto">
          {[{ id: 'home', label: 'Home' }, { id: 'dashboard', label: 'Dashboard' }, { id: 'safe-places', label: 'Places' }].map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id as any)}
              className={cn('px-3 py-1 rounded-full text-xs whitespace-nowrap font-medium', currentPage === item.id ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* ─ BODY ─ */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* MAP */}
        <div className="flex-1 relative">
          <div ref={mapDivRef} className="w-full h-full" />

          {/* Recenter button */}
          <button
            onClick={recenterMap}
            className="absolute bottom-5 left-4 z-[500] w-11 h-11 rounded-full bg-white shadow-xl flex items-center justify-center border border-zinc-200 hover:shadow-2xl transition-shadow"
          >
            <Crosshair className="w-5 h-5 text-blue-600" />
          </button>

          {/* Zone tooltip */}
          <AnimatePresence>
            {selectedZone && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-4 left-4 z-[500] bg-white rounded-2xl shadow-xl border border-zinc-200 p-4 w-60"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm">{selectedZone.area}</h4>
                  <button onClick={() => setSelectedZone(null)}><X className="w-4 h-4 text-zinc-400" /></button>
                </div>
                <div className={cn('flex items-center gap-3 p-3 rounded-xl mb-2')} style={{ backgroundColor: selectedZone.safetyScore >= 80 ? '#dcfce7' : selectedZone.safetyScore >= 65 ? '#fef3c7' : '#fee2e2' }}>
                  <span className="text-3xl font-black">{selectedZone.safetyScore}</span>
                  <div>
                    <p className="font-semibold text-sm capitalize">{selectedZone.level} Safety</p>
                    <p className="text-xs text-zinc-500">{selectedZone.incidentCount} incidents nearby</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-sm">
                  <div className="p-2 bg-zinc-50 rounded-lg text-center"><p className="font-bold">{selectedZone.trustedPlaceCount}</p><p className="text-xs text-zinc-500">Safe Places</p></div>
                  <div className="p-2 bg-zinc-50 rounded-lg text-center"><p className="font-bold">{selectedZone.streetlightCount}</p><p className="text-xs text-zinc-500">Streetlights</p></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SIDEBAR */}
        <AnimatePresence>
          {(currentPage === 'dashboard' || currentPage === 'safe-places') && (
            <motion.aside
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="hidden md:flex w-[370px] flex-shrink-0 flex-col bg-white border-l border-zinc-200 overflow-y-auto z-[600]"
            >
              {currentPage === 'dashboard' && <DashboardPanel safetyZones={safetyZones} incidentReports={incidentReports} platformStats={platformStats} />}
              {currentPage === 'safe-places' && <SafePlacesPanel trustedPlaces={trustedPlaces} />}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ─ BOTTOM PANEL (Search + Routes + Navigate) ─ */}
      {!journeySession && (
        <div className="flex-shrink-0 bg-white border-t border-zinc-200 z-[900] shadow-[0_-4px_24px_rgba(0,0,0,0.07)]">
          <div className="max-w-3xl mx-auto p-3 space-y-2">
            {source && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl">
                <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <p className="flex-1 text-sm text-emerald-700 truncate">{source.address}</p>
                <button onClick={() => setSource(null)}><X className="w-4 h-4 text-zinc-400" /></button>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 rounded-xl border-2 border-blue-200 focus-within:border-blue-500 transition-colors">
                <Navigation className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Where to? (e.g. Tambaram, Anna Nagar, T. Nagar…)"
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onKeyDown={(e) => e.key === 'Escape' && setShowSuggestions(false)}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-blue-300"
                  autoComplete="off"
                />
                {loadingSuggest && <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />}
                {(destination || searchValue) && (
                  <button onClick={() => { setDestination(null); setSearchValue(''); setRoutes([]); setSuggestions([]); setShowSuggestions(false); }}>
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                )}
              </div>

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden z-50 max-h-64 overflow-y-auto"
                  >
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onMouseDown={() => pickSuggestion(s)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-start gap-2 border-b border-zinc-100 last:border-0 transition-colors"
                      >
                        <MapPin className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2 text-zinc-700 text-left">{s.display_name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Routes */}
            {routes.length > 0 && (
              <>
                <div className="flex gap-2 overflow-x-auto">
                  {routes.map((route) => (
                    <div
                      key={route.id}
                      onClick={() => setSelectedRoute(route)}
                      className={cn('flex-shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all', selectedRoute?.id === route.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-zinc-50 border-transparent hover:border-blue-200')}
                    >
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0', selectedRoute?.id === route.id ? 'bg-white/25 text-white' : 'bg-zinc-200 text-zinc-700')}>
                        {route.safetyScore}
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-tight">{route.name}</p>
                        <p className={cn('text-xs', selectedRoute?.id === route.id ? 'text-blue-100' : 'text-zinc-400')}>{route.duration} · {route.distance}</p>
                      </div>
                      {route.isRecommended && <Sparkles className={cn('w-4 h-4', selectedRoute?.id === route.id ? 'text-yellow-300' : 'text-amber-400')} />}
                    </div>
                  ))}
                </div>

                <button onClick={() => setShowRouteDetails(!showRouteDetails)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600">
                  {showRouteDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                  {showRouteDetails ? 'Hide' : 'Show'} route details
                </button>

                <AnimatePresence>
                  {showRouteDetails && selectedRoute && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="space-y-2.5 pb-1">
                        {/* Score card */}
                        <div className={cn('p-3 rounded-xl border-2', getSafetyColor(selectedRoute.safetyScore))}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Safety Score</p>
                              <div className="flex items-baseline gap-1"><span className="text-4xl font-black">{selectedRoute.safetyScore}</span><span className="text-sm opacity-60">/100</span></div>
                              <p className="text-sm font-semibold">{getSafetyLabel(selectedRoute.safetyScore)}</p>
                            </div>
                            <div className="text-right space-y-1">
                              <div className="flex items-center gap-1.5 justify-end"><Clock className="w-4 h-4 opacity-60" /><span className="font-bold">{selectedRoute.duration}</span></div>
                              <div className="flex items-center gap-1.5 justify-end"><MapPin className="w-4 h-4 opacity-60" /><span className="font-bold">{selectedRoute.distance}</span></div>
                            </div>
                          </div>
                        </div>

                        {/* Breakdown */}
                        <div className="grid grid-cols-5 gap-1.5">
                          {[
                            { l: 'Incidents', v: selectedRoute.incidentScore },
                            { l: 'Lighting', v: selectedRoute.lightingScore },
                            { l: 'Safe Places', v: selectedRoute.trustedPlacesScore },
                            { l: 'Crowd', v: selectedRoute.crowdScore },
                            { l: 'Confidence', v: selectedRoute.confidenceScore },
                          ].map((item) => (
                            <div key={item.l} className="bg-zinc-50 rounded-xl p-2 text-center">
                              <p className="text-[10px] text-zinc-500 leading-tight mb-1">{item.l}</p>
                              <p className="text-base font-black">{item.v}</p>
                              <div className="w-full h-1 bg-zinc-200 rounded-full mt-1 overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${item.v}%` }} transition={{ duration: 0.6 }} className={cn('h-full rounded-full', item.v >= 75 ? 'bg-emerald-500' : item.v >= 55 ? 'bg-amber-500' : 'bg-red-500')} />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Lighting segments */}
                        <div className="bg-zinc-50 rounded-xl p-3">
                          <p className="text-[11px] font-bold text-zinc-400 mb-2 uppercase tracking-wider flex items-center gap-1"><Sun className="w-3.5 h-3.5" />Street Lighting</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                            {(['excellent', 'good', 'moderate', 'poor', 'dark'] as const).map((lvl) => {
                              const n = selectedRoute.segments.filter((s) => s.lightingLevel === lvl).length;
                              const clr: Record<string, string> = { excellent: 'bg-emerald-500', good: 'bg-green-400', moderate: 'bg-amber-400', poor: 'bg-orange-500', dark: 'bg-red-600' };
                              return (
                                <span key={lvl} className="flex items-center gap-1"><span className={cn('w-2.5 h-2.5 rounded-full', clr[lvl])} /><span className="text-zinc-600 capitalize">{lvl}: <strong>{n}</strong></span></span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button onClick={handleWalkWithMe} disabled={!!walkSession} className={cn('flex-1 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2', walkSession ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')}>
                            <Eye className="w-4 h-4" />{walkSession ? `${viewerCount} Viewing` : 'Walk With Me'}
                          </button>
                          <button onClick={() => setShowTransportModal(true)} className="flex-1 py-2.5 bg-violet-50 text-violet-600 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-violet-100">
                            <Bus className="w-4 h-4" />Transport
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button onClick={handleStartNavigation} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-green-600 shadow-lg transition-all active:scale-[0.99]">
                  <Navigation className="w-5 h-5" />Start Navigation
                </button>
              </>
            )}

            {!destination && routes.length === 0 && (
              <button onClick={calculateRoutes} disabled={!searchValue || isCalculatingRoutes} className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg hover:from-blue-700 hover:to-cyan-600 transition-all">
                {isCalculatingRoutes ? <><Loader2 className="w-5 h-5 animate-spin" />Analyzing…</> : <><Shield className="w-5 h-5" />Find Safe Routes</>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─ NAVIGATION HUD ─ */}
      <AnimatePresence>
        {journeySession && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="flex-shrink-0 bg-white border-t-2 border-emerald-300 z-[900] shadow-[0_-4px_24px_rgba(0,0,0,0.1)]">
            <div className="max-w-3xl mx-auto p-3 space-y-2">
              <div className="flex items-center justify-between bg-emerald-50 rounded-xl p-3">
                <div>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Navigating</p>
                  <p className="text-3xl font-black text-emerald-700">{formatDuration(journeySession.eta)}</p>
                  <p className="text-xs text-emerald-600">{formatDistance(journeySession.remainingDistance)} remaining</p>
                </div>
                {selectedRoute && (
                  <div className={cn('px-4 py-2 rounded-xl text-center border-2', getSafetyColor(selectedRoute.safetyScore))}>
                    <p className="text-[10px] opacity-60">Safety</p>
                    <p className="text-2xl font-black">{selectedRoute.safetyScore}</p>
                  </div>
                )}
              </div>
              {walkSession && sharedJourneyLink && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-xl">
                  <Eye className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <p className="flex-1 text-xs text-blue-700 truncate font-mono">{sharedJourneyLink}</p>
                  <button onClick={() => navigator.clipboard.writeText(sharedJourneyLink)} className="p-1.5 bg-blue-600 text-white rounded-lg"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleWalkWithMe} disabled={!!walkSession} className={cn('flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2', walkSession ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white hover:bg-blue-700')}>
                  <Eye className="w-4 h-4" />{walkSession ? `${viewerCount} Viewing` : 'Walk With Me'}
                </button>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={activateEmergency} className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-black text-sm flex items-center gap-2 shadow-lg">
                  <AlertTriangle className="w-4 h-4" />SOS
                </motion.button>
                <button onClick={handleEndNavigation} className="px-4 py-2.5 border border-zinc-200 text-zinc-500 rounded-xl text-sm hover:bg-zinc-50">End</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─ EMERGENCY ─ */}
      <AnimatePresence>
        {isEmergencyActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-red-600 flex flex-col items-center justify-center p-6">
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="w-28 h-28 rounded-full bg-white flex items-center justify-center mb-6 shadow-2xl">
              <AlertTriangle className="w-16 h-16 text-red-600" />
            </motion.div>
            <h2 className="text-4xl font-black text-white mb-2 animate-pulse">EMERGENCY SOS</h2>
            <p className="text-red-100 text-center mb-8">Trusted contacts notified with your live location.</p>
            <div className="w-full max-w-xs space-y-3">
              <div className="bg-white/20 rounded-2xl p-3 text-white text-sm">
                <p className="opacity-75 text-xs">Your location</p>
                <p className="font-mono font-bold">{currentLocation?.lat.toFixed(5)}, {currentLocation?.lng.toFixed(5)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => toast.success('Calling Police…')} className="bg-white text-red-600 p-3 rounded-2xl flex flex-col items-center gap-1 font-bold"><Phone className="w-6 h-6" />Police<span className="text-xs font-normal">100</span></button>
                <button onClick={() => toast.success('Calling Ambulance…')} className="bg-white text-red-600 p-3 rounded-2xl flex flex-col items-center gap-1 font-bold"><Heart className="w-6 h-6" />Ambulance<span className="text-xs font-normal">108</span></button>
              </div>
              <button onClick={deactivateEmergency} className="w-full py-4 bg-white text-red-600 rounded-2xl font-black text-xl">CANCEL SOS</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─ INCIDENT MODAL ─ */}
      <AnimatePresence>
        {showIncidentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1500] bg-black/50 flex items-end justify-center" onClick={() => setShowIncidentModal(false)}>
            <motion.div initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white rounded-t-3xl p-5 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Report Incident</h3>
                <button onClick={() => setShowIncidentModal(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { icon: <AlertTriangle className="w-5 h-5" />, label: 'Harassment', v: 'harassment' },
                  { icon: <Eye className="w-5 h-5" />, label: 'Stalking', v: 'stalking' },
                  { icon: <Sun className="w-5 h-5" />, label: 'Poor Light', v: 'poor_lighting' },
                  { icon: <MapPin className="w-5 h-5" />, label: 'Unsafe', v: 'unsafe_area' },
                  { icon: <Users className="w-5 h-5" />, label: 'Disturbance', v: 'public_disturbance' },
                  { icon: <AlertCircle className="w-5 h-5" />, label: 'Suspicious', v: 'suspicious_activity' },
                  { icon: <Flag className="w-5 h-5" />, label: 'Theft', v: 'theft' },
                  { icon: <Info className="w-5 h-5" />, label: 'Other', v: 'other' },
                ].map((item) => (
                  <button key={item.v} onClick={() => handleReportIncident(item.v)} className="p-3 rounded-xl border-2 border-zinc-100 hover:border-red-300 hover:bg-red-50 flex flex-col items-center gap-1.5 transition-all">
                    <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">{item.icon}</div>
                    <span className="text-[11px] font-medium text-zinc-700">{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-xl text-emerald-700 text-sm">
                <CheckCircle2 className="w-4 h-4" />Your location will be attached to this report
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─ TRANSPORT MODAL ─ */}
      <AnimatePresence>
        {showTransportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1500] bg-black/50 flex items-end justify-center" onClick={() => setShowTransportModal(false)}>
            <motion.div initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white rounded-t-3xl p-5 pb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Transport Options</h3>
                <button onClick={() => setShowTransportModal(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-2">
                {[
                  { type: 'Walking', duration: selectedRoute?.duration || '–', fare: 'Free', icon: <Navigation className="w-5 h-5" />, bg: 'bg-blue-100 text-blue-600', safety: 85 },
                  { type: 'Chennai Metro', duration: '~15 min', fare: '₹10–50', icon: <Train className="w-5 h-5" />, bg: 'bg-violet-100 text-violet-600', safety: 92 },
                  { type: 'MTC Bus', duration: '~25 min', fare: '₹5–25', icon: <Bus className="w-5 h-5" />, bg: 'bg-amber-100 text-amber-600', safety: 78 },
                  { type: 'Auto / Cab', duration: '~12 min', fare: '₹50–150', icon: <Car className="w-5 h-5" />, bg: 'bg-green-100 text-green-600', safety: 72 },
                ].map((t) => (
                  <div key={t.type} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', t.bg)}>{t.icon}</div>
                    <div className="flex-1"><p className="font-semibold text-sm">{t.type}</p><p className="text-xs text-zinc-500">{t.duration} · {t.fare}</p></div>
                    <div className={cn('px-2.5 py-1 rounded-lg text-sm font-bold border-2', getSafetyColor(t.safety))}>{t.safety}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─ AI CHAT ─ */}
      <AnimatePresence>
        {showChat && (
          <motion.div initial={{ opacity: 0, x: 120 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 120 }} className="fixed top-16 right-4 bottom-4 w-full max-w-xs bg-white rounded-2xl shadow-2xl border border-zinc-200 z-[1200] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">SafeRoute AI</p>
                  <p className="text-[10px] text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />Online</p>
                </div>
              </div>
              <button onClick={() => setShowChat(false)} className="p-1.5 hover:bg-zinc-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <Bot className="w-10 h-10 text-zinc-200 mx-auto" />
                  <p className="text-xs text-zinc-400">Ask me about safe routes, police stations, hospitals, or SafeRoute features.</p>
                  {['Where are police stations?', 'Safest areas right now?', 'How does Walk With Me work?'].map((s) => (
                    <button key={s} onClick={() => sendChat(s)} className="block w-full text-left px-3 py-2 text-xs bg-zinc-50 rounded-lg hover:bg-zinc-100 text-zinc-600">{s}</button>
                  ))}
                </div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={cn('max-w-[85%] px-3 py-2 rounded-2xl text-sm', msg.role === 'user' ? 'bg-blue-600 text-white ml-auto' : 'bg-zinc-100 text-zinc-800')}>
                  {msg.content}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-1 px-3 py-2.5 bg-zinc-100 rounded-2xl w-16">
                  {[0, 0.2, 0.4].map((d, i) => (
                    <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.6, repeat: Infinity, delay: d }} className="w-2 h-2 rounded-full bg-zinc-400" />
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-zinc-100 flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat(chatInput)} placeholder="Ask anything…" className="flex-1 px-3 py-2 bg-zinc-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100" />
              <button onClick={() => sendChat(chatInput)} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"><Send className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Dashboard Panel ────────────────────────────────────────────────────────────
function DashboardPanel({ safetyZones, incidentReports, platformStats }: { safetyZones: SafetyZone[]; incidentReports: IncidentReport[]; platformStats: any }) {
  const { setCurrentPage } = useAppStore();
  return (
    <div className="p-4 space-y-5 min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Safety Dashboard</h2>
        <button onClick={() => setCurrentPage('home')} className="p-1.5 hover:bg-zinc-100 rounded-xl"><X className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Verified Incidents', val: platformStats.verifiedIncidents, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Active Reports', val: platformStats.activeReports, color: 'text-orange-600 bg-orange-50' },
          { label: 'Safe Places', val: platformStats.trustedPlacesCount, color: 'text-blue-600 bg-blue-50' },
          { label: 'Validations', val: platformStats.communityValidations, color: 'text-violet-600 bg-violet-50' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-xl p-3', s.color)}>
            <p className="text-2xl font-black">{s.val.toLocaleString()}</p>
            <p className="text-xs opacity-70 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-2.5 flex items-center gap-2"><BarChart3 className="w-4 h-4" />Area Rankings</h3>
        <div className="space-y-1.5">
          {[...safetyZones].sort((a, b) => b.safetyScore - a.safetyScore).map((z, i) => (
            <div key={z.id} className="flex items-center gap-2 px-2.5 py-2 bg-zinc-50 rounded-lg">
              <span className="text-xs text-zinc-400 w-5 text-right">#{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-medium">{z.area}</p>
                  <span className="text-sm font-bold">{z.safetyScore}</span>
                </div>
                <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', z.safetyScore >= 80 ? 'bg-emerald-500' : z.safetyScore >= 65 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${z.safetyScore}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-2.5 flex items-center gap-2"><Clock className="w-4 h-4" />Recent Incidents</h3>
        <div className="space-y-1.5">
          {incidentReports.slice(0, 6).map((inc) => (
            <div key={inc.id} className="p-2.5 bg-red-50 rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium capitalize">{inc.category.replace(/_/g, ' ')}</p>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', inc.severity === 'high' ? 'bg-red-200 text-red-700' : inc.severity === 'medium' ? 'bg-amber-200 text-amber-700' : 'bg-blue-200 text-blue-700')}>{inc.severity}</span>
              </div>
              {inc.description && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{inc.description}</p>}
              <p className="text-[10px] text-zinc-400 mt-1">{new Date(inc.reportedAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Safe Places Panel ──────────────────────────────────────────────────────────
function SafePlacesPanel({ trustedPlaces }: { trustedPlaces: TrustedPlace[] }) {
  const { setCurrentPage } = useAppStore();
  const [filter, setFilter] = useState('all');
  const cats = ['all', 'police_station', 'hospital', 'metro_station', 'pharmacy', 'petrol_bunk', 'government_office'];
  const filtered = filter === 'all' ? trustedPlaces : trustedPlaces.filter((p) => p.category === filter);
  return (
    <div className="p-4 space-y-3 min-h-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Safe Places</h2>
        <button onClick={() => setCurrentPage('home')} className="p-1.5 hover:bg-zinc-100 rounded-xl"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {cats.map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={cn('px-3 py-1 rounded-full text-xs whitespace-nowrap font-medium transition-all', filter === c ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')}>
            {c === 'all' ? 'All' : c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-400">{filtered.length} places</p>
      <div className="space-y-1.5">
        {filtered.map((p) => (
          <div key={p.id} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-xl hover:bg-white border border-zinc-100 hover:border-zinc-200 transition-all">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><MapPin className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{p.name}</p>
              <p className="text-xs text-zinc-500 capitalize">{p.category.replace(/_/g, ' ')}</p>
              {p.address && <p className="text-xs text-zinc-400 truncate mt-0.5">{p.address}</p>}
            </div>
            {p.isOpen24Hours && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">24h</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
