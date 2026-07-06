import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Navigation2, ShieldAlert, Info, X, ChevronDown, Loader2, LocateFixed, Users, Building2, ArrowRight, LayoutDashboard, Bus, TramFront, Car, Footprints, IndianRupee, Clock } from 'lucide-react';
import MapView from '../components/MapView';
import ScoreBadge, { bandColor, bandLabel } from '../components/ScoreBadge';
import { toast } from '../components/Toaster';
import { searchPlaces, computeRoutes, startJourney, fetchSafePlaces, type Place, type RouteResult, type SafePlace } from '../lib/api';
import { fetchTransit, type TransitOption } from '../lib/transit';
import { useEscape } from '../lib/useEscape';

const CHENNAI: [number, number] = [13.0827, 80.2707];

const SAFE_ICON: Record<string, string> = {
  police: '🛡️', women_police: '👮‍♀️', hospital: '🏥', pharmacy: '💊',
  metro: 'Ⓜ️', bus: '🚌', railway: '🚉', petrol: '⛽', govt: '🏛️', other: '📍',
};
const SAFE_COLOR: Record<string, string> = {
  police: '#0F766E', women_police: '#7C3AED', hospital: '#DC2626', pharmacy: '#EA580C',
  metro: '#2563EB', bus: '#0EA5E9', railway: '#6366F1', petrol: '#65A30D', govt: '#475569', other: '#64748B',
};

interface SearchBoxProps {
  label: string; value: Place | null; onSelect: (p: Place) => void; testId: string; placeholder: string;
  onUseLocation?: () => void;
}
function SearchBox({ label, value, onSelect, testId, placeholder, onUseLocation }: SearchBoxProps) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const t = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!q || q.length < 2) { setResults([]); return; }
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(async () => {
      setLoading(true);
      try { const r = await searchPlaces(q); setResults(r); setOpen(true); }
      catch { toast('error', 'Search failed'); }
      setLoading(false);
    }, 350);
  }, [q]);

  return (
    <div className="relative">
      <label className="block text-[11px] uppercase tracking-widest text-slate-500 mb-1 font-semibold">{label}</label>
      <div className="flex items-center gap-2 bg-slate-50 border border-transparent focus-within:bg-white focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-200 rounded-xl px-3 py-2 transition-all">
        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          data-testid={testId}
          value={value ? value.label.split(',').slice(0, 2).join(', ') : q}
          onChange={(e) => { setQ(e.target.value); if (value) onSelect(null as any); }}
          onFocus={() => q.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
        />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        {onUseLocation && (
          <button data-testid={`${testId}-locate`} onClick={onUseLocation}
            className="text-teal-600 hover:text-teal-700 p-1" aria-label="Use current location">
            <LocateFixed className="w-4 h-4" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute z-40 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto panel-scroll">
            {results.map((r, i) => (
              <button key={i} onMouseDown={() => { onSelect(r); setOpen(false); setQ(''); }}
                data-testid={`${testId}-result-${i}`}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0">
                <div className="font-medium text-slate-800 truncate">{r.label.split(',').slice(0, 2).join(', ')}</div>
                <div className="text-xs text-slate-500 truncate">{r.label}</div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HomeScreen() {
  const nav = useNavigate();
  const [source, setSource] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mode, setMode] = useState<'walking' | 'cycling' | 'driving'>('walking');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [transitOpen, setTransitOpen] = useState(false);
  const [transit, setTransit] = useState<TransitOption[]>([]);
  const [transitLoading, setTransitLoading] = useState(false);
  const [selectedTransit, setSelectedTransit] = useState<TransitOption | null>(null);
  const [womenOnly, setWomenOnly] = useState(false);

  useEscape(showBreakdown, () => setShowBreakdown(false));
  useEscape(transitOpen, () => setTransitOpen(false));

  // Locate on mount
  const handleUseLocation = (setter: (p: Place) => void) => {
    if (!navigator.geolocation) { toast('error', 'Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      setUserLoc({ lat, lng });
      setter({ label: `Current location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, lat, lng });
      toast('success', 'Location detected');
    }, () => toast('error', 'Location permission denied'), { enableHighAccuracy: true, timeout: 10000 });
  };

  const findRoutes = async () => {
    if (!source || !destination) { toast('warning', 'Pick source and destination'); return; }
    setLoading(true); setRoutes([]);
    try {
      const r = await computeRoutes({ lat: source.lat, lng: source.lng }, { lat: destination.lat, lng: destination.lng }, mode);
      if (!r.routes.length) { toast('warning', 'No route found'); }
      else {
        setRoutes(r.routes); setSelectedIdx(0);
        // Fetch safe places along the destination area
        const sp = await fetchSafePlaces(destination.lat, destination.lng, 1500);
        setSafePlaces(sp.places);
        toast('success', `${r.routes.length} route(s) analyzed`);
      }
    } catch (e: any) {
      toast('error', e?.response?.data?.detail || 'Failed to compute routes');
    }
    setLoading(false);
  };

  const loadTransit = async () => {
    if (!source || !destination) { toast('warning', 'Pick source and destination first'); return; }
    setTransitLoading(true);
    try {
      const r = await fetchTransit({ lat: source.lat, lng: source.lng }, { lat: destination.lat, lng: destination.lng });
      setTransit(r.options);
      setTransitOpen(true);
    } catch (e: any) {
      toast('error', 'Transit lookup failed');
    }
    setTransitLoading(false);
  };

  const routeMarkers = useMemo(() => {
    const arr: any[] = [];
    if (source) arr.push({ id: 'src', lat: source.lat, lng: source.lng, color: '#0EA5E9', icon: 'A', label: 'Start' });
    if (destination) arr.push({ id: 'dst', lat: destination.lat, lng: destination.lng, color: '#DC2626', icon: 'B', label: 'Destination' });
    // Transit station markers
    if (selectedTransit) {
      const s = selectedTransit.source_station || selectedTransit.source_stop;
      const d = selectedTransit.destination_station || selectedTransit.destination_stop;
      if (s) arr.push({ id: 't-src', lat: s.lat, lng: s.lng, color: selectedTransit.mode === 'metro' ? '#2563EB' : '#0EA5E9', icon: selectedTransit.mode === 'metro' ? 'Ⓜ' : '🚌', label: s.name });
      if (d) arr.push({ id: 't-dst', lat: d.lat, lng: d.lng, color: selectedTransit.mode === 'metro' ? '#2563EB' : '#0EA5E9', icon: selectedTransit.mode === 'metro' ? 'Ⓜ' : '🚌', label: d.name });
    }
    safePlaces.slice(0, 60).forEach(p => arr.push({
      id: p.id, lat: p.lat, lng: p.lng, color: SAFE_COLOR[p.category] || SAFE_COLOR.other,
      icon: SAFE_ICON[p.category] || SAFE_ICON.other, label: `${p.name} · ${p.category}`,
    }));
    return arr;
  }, [source, destination, safePlaces, selectedTransit]);

  const routeLines = useMemo(() => {
    // If a transit option is selected, render its legs
    if (selectedTransit && selectedTransit.legs) {
      return selectedTransit.legs
        .filter(l => l.geometry && l.geometry.length > 1)
        .map((l, i) => ({
          id: `t-${i}`,
          coords: l.geometry as number[][],
          color: l.type === 'walk' ? '#64748B' : l.type === 'metro' ? '#2563EB' : '#0EA5E9',
          weight: l.type === 'walk' ? 5 : 7,
          opacity: 0.9,
          dashArray: l.type === 'walk' ? '2 8' : undefined,
        }));
    }
    return routes.map((r, i) => ({
      id: r.id,
      coords: r.geometry,
      color: bandColor(r.safety.score).hex,
      weight: i === selectedIdx ? 8 : 4,
      opacity: i === selectedIdx ? 0.95 : 0.5,
      onClick: () => setSelectedIdx(i),
    }));
  }, [routes, selectedIdx, selectedTransit]);

  const selected = routes[selectedIdx];

  const beginJourney = async () => {
    if (!selected || !destination) return;
    try {
      const j = await startJourney({
        route_geometry: selected.geometry,
        destination: { lat: destination.lat, lng: destination.lng },
        destination_label: destination.label.split(',').slice(0, 2).join(', '),
        estimated_duration_sec: selected.duration_s,
        estimated_distance_m: selected.distance_m,
        safety_score: selected.safety.score,
      });
      nav(`/journey/${j.share_token}`);
    } catch (e: any) {
      toast('error', 'Could not start journey');
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-slate-50">
      <MapView
        center={CHENNAI}
        zoom={12}
        markers={routeMarkers}
        routes={routeLines}
        userLocation={userLoc}
        fitBounds={routes.length > 0 || !!selectedTransit}
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Top brand pill */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2 bg-white/90 backdrop-blur-xl border border-white/60 rounded-full px-4 py-2 shadow-lg" data-testid="brand-pill">
        <div className="w-7 h-7 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm">S</div>
        <div>
          <div className="font-poppins font-bold text-slate-900 text-sm leading-none">SafeRoute</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">Chennai</div>
        </div>
      </div>

      <button data-testid="dashboard-link" onClick={() => nav('/dashboard')}
        className="absolute top-4 right-4 z-40 flex items-center gap-2 bg-white/90 backdrop-blur-xl border border-white/60 rounded-full px-4 py-2 shadow-lg text-sm font-medium text-slate-700 hover:bg-white transition">
        <LayoutDashboard className="w-4 h-4" /> Dashboard
      </button>

      {/* Active transit legend */}
      {selectedTransit && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white/95 backdrop-blur-xl border border-white/60 rounded-full pl-4 pr-2 py-1.5 shadow-lg" data-testid="transit-legend">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedTransit.mode === 'metro' ? 'bg-blue-100 text-blue-700' : 'bg-sky-100 text-sky-700'}`}>
            {selectedTransit.mode === 'metro' ? <TramFront className="w-3.5 h-3.5" /> : <Bus className="w-3.5 h-3.5" />}
          </div>
          <div className="text-xs">
            <div className="font-semibold text-slate-900 leading-tight">{selectedTransit.label} · ₹{selectedTransit.fare_inr} · {selectedTransit.duration_min}m</div>
            {selectedTransit.line_note && <div className="text-[10px] text-slate-500 leading-tight">{selectedTransit.line_note}</div>}
          </div>
          <button onClick={() => setSelectedTransit(null)} className="ml-1 w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center" data-testid="clear-transit">
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      )}

      {/* Left panel (desktop) / bottom sheet (mobile) */}
      <motion.div
        initial={false}
        animate={{ y: panelOpen ? 0 : 400 }}
        transition={{ type: 'spring', damping: 26, stiffness: 240 }}
        className="absolute z-40 bottom-0 left-0 right-0 md:top-20 md:bottom-8 md:left-4 md:right-auto md:w-[420px] bg-white/90 backdrop-blur-xl border border-white/60 shadow-glass rounded-t-3xl md:rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-4 md:p-5 border-b border-slate-100 shrink-0">
          <button className="md:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 block" onClick={() => setPanelOpen(!panelOpen)} aria-label="Toggle panel" />
          <div className="flex items-center gap-2 mb-3">
            <h1 className="font-poppins font-bold text-lg text-slate-900">Plan a safer route</h1>
          </div>
          <div className="space-y-2">
            <SearchBox label="From" testId="search-source" placeholder="Search Chennai or use GPS"
              value={source} onSelect={setSource} onUseLocation={() => handleUseLocation(setSource)} />
            <SearchBox label="To" testId="search-destination" placeholder="Where are you going?"
              value={destination} onSelect={setDestination} />
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1 bg-slate-100 rounded-full p-1">
              {(['walking', 'cycling', 'driving'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} data-testid={`mode-${m}`}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition ${mode === m ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>
                  {m}
                </button>
              ))}
            </div>
            <button data-testid="find-routes-btn" onClick={findRoutes} disabled={loading || !source || !destination}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl px-4 py-2 font-medium text-sm flex items-center gap-2 transition">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Analyze
            </button>
          </div>
          <button data-testid="transit-btn" onClick={loadTransit} disabled={transitLoading || !source || !destination}
            className="w-full mt-2 bg-slate-50 hover:bg-slate-100 disabled:bg-slate-50 disabled:text-slate-400 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 transition">
            {transitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bus className="w-4 h-4" />}
            Show Metro · Bus · Auto · Cab
          </button>
        </div>

        <div className="flex-1 overflow-y-auto panel-scroll p-4 md:p-5 space-y-3" data-testid="routes-panel">
          {routes.length === 0 && !loading && (
            <div className="text-center py-10 px-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 flex items-center justify-center mb-3">
                <Navigation2 className="w-7 h-7 text-teal-600" />
              </div>
              <h3 className="font-poppins font-semibold text-slate-800">Safety-first navigation</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Every route is scored 0–100 using real Chennai data — police stations, hospitals, community reports,
                lighting, and time of day. Every score explains its factors.
              </p>
              <div className="mt-4 flex flex-col gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-2 justify-center"><Users className="w-3.5 h-3.5 text-teal-600" /> 100% anonymous — no accounts</div>
                <div className="flex items-center gap-2 justify-center"><Building2 className="w-3.5 h-3.5 text-teal-600" /> Real OpenStreetMap data for Chennai</div>
              </div>
            </div>
          )}

          {routes.map((r, i) => (
            <motion.div key={r.id} onClick={() => setSelectedIdx(i)}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              data-testid={`route-card-${i}`}
              className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                i === selectedIdx ? 'bg-white border-teal-500 shadow-md ring-2 ring-teal-100' : 'bg-white/80 border-slate-200 hover:border-slate-300'
              }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${bandColor(r.safety.score).bg} ${bandColor(r.safety.score).text}`}>
                      {r.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                      {bandLabel(r.safety.score)} safety
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 mt-1">
                    <div className="font-poppins text-lg font-bold text-slate-900">
                      {Math.round(r.duration_s / 60)} min
                    </div>
                    <div className="text-slate-500 text-sm">{(r.distance_m / 1000).toFixed(1)} km</div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                    <span title="Verified incidents near route">🛡 {r.safety.verified_incidents_near_route} verified</span>
                    <span title="Safe places along route">📍 {r.safety.safe_places_near_route} landmarks</span>
                    <span title="Data confidence">{Math.round(r.safety.confidence * 100)}% confident</span>
                  </div>
                </div>
                <ScoreBadge score={r.safety.score} size="md" />
              </div>
              {i === selectedIdx && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); setShowBreakdown(true); }}
                    data-testid={`route-why-${i}`}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm font-medium transition">
                    <Info className="w-4 h-4" /> Why this score
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); beginJourney(); }}
                    data-testid={`start-journey-${i}`}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-3 py-2 text-sm font-medium transition">
                    Start <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}

          {routes.length > 0 && (
            <button onClick={() => nav('/report')} data-testid="report-incident-btn"
              className="w-full mt-2 flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl px-3 py-2.5 text-sm font-medium transition">
              <ShieldAlert className="w-4 h-4" /> Report a safety concern
            </button>
          )}
        </div>
      </motion.div>

      {/* Breakdown modal */}
      <AnimatePresence>
        {showBreakdown && selected && (
          <motion.div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end md:items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowBreakdown(false)}>
            <motion.div onClick={(e) => e.stopPropagation()}
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
              data-testid="breakdown-modal">
              <div className="p-5 border-b border-slate-100 flex items-start gap-4">
                <ScoreBadge score={selected.safety.score} size="lg" confidence={selected.safety.confidence} />
                <div className="flex-1">
                  <div className="font-poppins font-bold text-lg text-slate-900">Why {selected.safety.score}?</div>
                  <div className="text-sm text-slate-600 mt-1">{bandLabel(selected.safety.score)} safety · {Math.round(selected.safety.confidence * 100)}% confidence in data</div>
                  {selected.safety.confidence < 0.5 && (
                    <div className="mt-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2 py-1.5">
                      ⚠ Limited data for this area — use your own judgment.
                    </div>
                  )}
                </div>
                <button onClick={() => setShowBreakdown(false)} className="p-1 hover:bg-slate-100 rounded-full" data-testid="close-breakdown">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto panel-scroll p-5 space-y-3">
                {selected.safety.breakdown.map((f, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">{f.factor}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest">weight {f.weight}%</span>
                        </div>
                      </div>
                      <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${bandColor(f.score).bg} ${bandColor(f.score).text}`}>
                        {f.score}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-600 leading-relaxed">{f.detail}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Source: {f.source}</span>
                      <span className="text-slate-500 font-medium">{Math.round(f.confidence * 100)}% conf.</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full" style={{ width: `${f.score}%`, background: bandColor(f.score).hex }} />
                    </div>
                  </div>
                ))}
                <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <b>How this works:</b> SafeRoute never fabricates data. Where confidence is low (e.g. lighting),
                  we say so explicitly. All safety scores use real Chennai POI data (OpenStreetMap) and community
                  reports validated by GPS proximity. You always choose your own route.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transit modal */}
      <AnimatePresence>
        {transitOpen && (
          <motion.div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end md:items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setTransitOpen(false)}>
            <motion.div onClick={(e) => e.stopPropagation()}
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
              data-testid="transit-modal">
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div>
                  <div className="font-poppins font-bold text-lg text-slate-900">Public transport options</div>
                  <div className="text-xs text-slate-500 mt-1">Real Chennai fares · CMRL slab, MTC slab, meter rates</div>
                  <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none" data-testid="women-only-toggle">
                    <input type="checkbox" checked={womenOnly} onChange={(e) => setWomenOnly(e.target.checked)} className="w-4 h-4 accent-teal-600" />
                    <span>Women-friendly modes only <span className="text-slate-400">(CCTV / free-fare / GPS-tracked)</span></span>
                  </label>
                </div>
                <button onClick={() => setTransitOpen(false)} className="p-1 hover:bg-slate-100 rounded-full" data-testid="close-transit">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto panel-scroll p-5 space-y-3">
                {transit.filter(o => !womenOnly || (o as any).women_friendly === true || o.mode === 'walk').map((opt, i) => {
                  const Icon = opt.mode === 'metro' ? TramFront : opt.mode === 'bus' ? Bus : opt.mode === 'walk' ? Footprints : Car;
                  const iconTint = opt.mode === 'metro' ? 'bg-blue-100 text-blue-700'
                    : opt.mode === 'bus' ? 'bg-sky-100 text-sky-700'
                    : opt.mode === 'auto' ? 'bg-yellow-100 text-yellow-700'
                    : opt.mode === 'cab' ? 'bg-slate-100 text-slate-700'
                    : 'bg-teal-100 text-teal-700';
                  const hasMappable = opt.legs?.some(l => l.geometry && l.geometry.length > 1);
                  return (
                    <div key={i} className={`rounded-2xl border p-4 ${opt.unavailable ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200 shadow-sm'}`}
                      data-testid={`transit-option-${opt.mode}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconTint}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="font-poppins font-bold text-slate-900">{opt.label}</div>
                            <ScoreBadge score={opt.safety.score} size="sm" />
                          </div>
                          {opt.unavailable ? (
                            <div className="text-sm text-slate-500 mt-1">{opt.reason}</div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3 text-sm text-slate-700 mt-1">
                                <span className="flex items-center gap-1 font-medium"><IndianRupee className="w-3.5 h-3.5" />{opt.fare_inr}</span>
                                <span className="flex items-center gap-1 text-slate-500"><Clock className="w-3.5 h-3.5" />{opt.duration_min} min</span>
                                <span className="text-slate-500">{opt.distance_km} km</span>
                              </div>
                              {opt.line_note && (
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                  {opt.line_note.toLowerCase().includes('blue') && <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full" data-testid={`line-blue-${opt.mode}`}>🔵 Blue Line</span>}
                                  {opt.line_note.toLowerCase().includes('green') && <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full" data-testid={`line-green-${opt.mode}`}>🟢 Green Line</span>}
                                  {opt.line_note.toLowerCase().includes('interchange') && <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">🔀 Interchange</span>}
                                  {!opt.line_note.toLowerCase().includes('blue') && !opt.line_note.toLowerCase().includes('green') && !opt.line_note.toLowerCase().includes('interchange') && <span className="text-[10px] text-slate-500">{opt.line_note}</span>}
                                  {opt.line_note.toLowerCase().includes('direct') && <span className="text-[10px] text-slate-500">· direct, no change</span>}
                                </div>
                              )}
                              {opt.fare_note && <div className="text-[11px] text-slate-500 mt-1">{opt.fare_note}</div>}
                              {opt.service_warning && (
                                <div className={`mt-2 text-xs rounded-lg px-2 py-1.5 border ${opt.service_warning.startsWith('⛔') ? 'bg-red-50 border-red-200 text-red-800' : opt.service_warning.startsWith('⚠') ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-sky-50 border-sky-200 text-sky-800'}`} data-testid={`service-warning-${opt.mode}`}>
                                  {opt.service_warning}
                                </div>
                              )}
                              {opt.frequency_note && (
                                <div className="text-[11px] text-slate-500 mt-1 italic">{opt.frequency_note}</div>
                              )}
                              {opt.legs && opt.legs.length > 0 && (
                                <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-600 flex-wrap">
                                  {opt.legs.map((l, li) => (
                                    <React.Fragment key={li}>
                                      <span className={`px-1.5 py-0.5 rounded ${l.type === 'walk' ? 'bg-slate-100 text-slate-700' : l.type === 'metro' ? 'bg-blue-100 text-blue-700' : 'bg-sky-100 text-sky-700'}`}>
                                        {l.type === 'walk' ? '🚶' : l.type === 'metro' ? 'Ⓜ️' : '🚌'} {l.type === 'walk' ? `${l.distance_m}m` : `${l.distance_km}km`} · {l.duration_min}min
                                      </span>
                                      {li < opt.legs!.length - 1 && <ArrowRight className="w-3 h-3 text-slate-400" />}
                                    </React.Fragment>
                                  ))}
                                </div>
                              )}
                              {opt.safety.factors.length > 0 && (
                                <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100">
                                  <div className="font-semibold text-slate-700 mb-1">Safety factors ({Math.round(opt.safety.confidence * 100)}% conf.)</div>
                                  <ul className="space-y-0.5 list-disc list-inside">
                                    {opt.safety.factors.map((f, fi) => <li key={fi}>{f}</li>)}
                                  </ul>
                                </div>
                              )}
                              {hasMappable && (
                                <button data-testid={`show-transit-map-${opt.mode}`}
                                  onClick={() => { setRoutes([]); setSelectedTransit(opt); setTransitOpen(false); toast('success', `${opt.label} legs shown on map`); }}
                                  className="mt-3 w-full flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-3 py-2 text-sm font-medium transition">
                                  <MapPin className="w-4 h-4" /> Show on map
                                </button>
                              )}
                              {opt.book_links && (opt.book_links.ola || opt.book_links.uber) && (
                                <div className="mt-3 flex gap-2">
                                  {opt.book_links.ola && (
                                    <a href={opt.book_links.ola} target="_blank" rel="noreferrer" data-testid={`book-ola-${opt.mode}`}
                                      className="flex-1 text-xs bg-lime-50 hover:bg-lime-100 text-lime-800 border border-lime-200 rounded-lg py-2 text-center font-semibold transition">
                                      Book Ola →
                                    </a>
                                  )}
                                  {opt.book_links.uber && (
                                    <a href={opt.book_links.uber} target="_blank" rel="noreferrer" data-testid={`book-uber-${opt.mode}`}
                                      className="flex-1 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-2 text-center font-semibold transition">
                                      Book Uber →
                                    </a>
                                  )}
                                </div>
                              )}
                              {opt.data_source && (
                                <div className="text-[10px] text-slate-400 mt-2">Source: {opt.data_source}</div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <b>Note:</b> Fares are official published rates. Cab estimates exclude surge. Bus is <b>FREE for women</b> in MTC ordinary buses under the Tamil Nadu Government scheme.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
