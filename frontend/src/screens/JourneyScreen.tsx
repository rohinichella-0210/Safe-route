import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Share2, Copy, MessageCircle, X, ShieldAlert, PhoneCall, Flag, Check, LocateFixed } from 'lucide-react';
import MapView from '../components/MapView';
import ScoreBadge, { bandColor } from '../components/ScoreBadge';
import { toast } from '../components/Toaster';
import { getJourney, pingJourney, triggerSOS, completeJourney, fetchSafePlaces, type SafePlace } from '../lib/api';

const SAFE_ICON: Record<string, string> = { police: '🛡️', women_police: '👮‍♀️', hospital: '🏥', pharmacy: '💊', metro: 'Ⓜ️', bus: '🚌', railway: '🚉', petrol: '⛽', govt: '🏛️', other: '📍' };
const SAFE_COLOR: Record<string, string> = { police: '#0F766E', women_police: '#7C3AED', hospital: '#DC2626', pharmacy: '#EA580C', metro: '#2563EB', bus: '#0EA5E9', railway: '#6366F1', petrol: '#65A30D', govt: '#475569', other: '#64748B' };

export default function JourneyScreen() {
  const { token } = useParams();
  const nav = useNavigate();
  const [journey, setJourney] = useState<any>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [remainingM, setRemainingM] = useState(0);
  const [remainingS, setRemainingS] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([]);
  const [deviation, setDeviation] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const shareUrl = useMemo(() => `${window.location.origin}/watch/${token}`, [token]);

  useEffect(() => {
    (async () => {
      try {
        const j = await getJourney(token!);
        setJourney(j);
        setRemainingM(j.estimated_distance_m);
        setRemainingS(j.estimated_duration_sec);
        // Fetch safe places along the route
        if (j.destination) {
          const sp = await fetchSafePlaces(j.destination.lat, j.destination.lng, 2000);
          setSafePlaces(sp.places);
        }
      } catch (e: any) {
        toast('error', 'Journey not found');
        nav('/');
      }
    })();
  }, [token, nav]);

  // Live GPS tracking
  useEffect(() => {
    if (!navigator.geolocation || !journey) return;
    const id = navigator.geolocation.watchPosition(async (pos) => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      setUserLoc({ lat, lng });
      try { await pingJourney(token!, lat, lng, pos.coords.speed || undefined, pos.coords.heading || undefined); } catch {}
      // Compute remaining distance to destination
      const dst = journey.destination;
      if (dst) {
        const R = 6371000;
        const p1 = lat * Math.PI / 180, p2 = dst.lat * Math.PI / 180;
        const dp = (dst.lat - lat) * Math.PI / 180, dl = (dst.lng - lng) * Math.PI / 180;
        const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
        const d = 2 * R * Math.asin(Math.sqrt(a));
        setRemainingM(Math.round(d));
        const speed = pos.coords.speed && pos.coords.speed > 0.3 ? pos.coords.speed : 1.3; // 1.3 m/s walk
        setRemainingS(Math.round(d / speed));
        if (d < 50) {
          finish();
        }
      }
      // Route deviation detection
      if (journey.route_geometry?.length) {
        let minDist = Infinity;
        for (const c of journey.route_geometry) {
          const p1 = lat * Math.PI / 180, p2 = c[1] * Math.PI / 180;
          const dp = (c[1] - lat) * Math.PI / 180, dl = (c[0] - lng) * Math.PI / 180;
          const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
          const d = 2 * 6371000 * Math.asin(Math.sqrt(a));
          if (d < minDist) minDist = d;
        }
        setDeviation(Math.round(minDist));
      }
    }, (err) => {
      toast('warning', 'GPS unavailable — enable location');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    watchIdRef.current = id;
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [journey, token]); // eslint-disable-line

  const finish = async () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    try { await completeJourney(token!); } catch {}
    toast('success', 'Journey complete. GPS data deleted.');
    setTimeout(() => nav('/'), 1200);
  };

  const doSOS = async () => {
    if (!userLoc) { toast('warning', 'Waiting for GPS…'); return; }
    try {
      await triggerSOS(token!, userLoc.lat, userLoc.lng, 'Emergency SOS');
      setSosActive(true);
      toast('error', 'SOS broadcasted to Walk-With-Me viewers');
    } catch {
      toast('error', 'SOS failed');
    }
    setShowSOS(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast('success', 'Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const t = encodeURIComponent(`I'm on my way. Track me live via SafeRoute: ${shareUrl}`);
    window.open(`https://wa.me/?text=${t}`, '_blank');
  };

  const markers = useMemo(() => {
    const arr: any[] = [];
    if (journey?.destination) arr.push({ id: 'dst', lat: journey.destination.lat, lng: journey.destination.lng, color: '#DC2626', icon: '🏁', label: 'Destination' });
    safePlaces.slice(0, 40).forEach(p => arr.push({
      id: p.id, lat: p.lat, lng: p.lng,
      color: SAFE_COLOR[p.category] || SAFE_COLOR.other, icon: SAFE_ICON[p.category] || SAFE_ICON.other,
      label: p.name,
    }));
    return arr;
  }, [journey, safePlaces]);

  if (!journey) return <div className="fixed inset-0 flex items-center justify-center bg-slate-50 text-slate-500">Loading…</div>;

  const c = bandColor(journey.safety_score);

  const routes = journey.route_geometry?.length ? [{
    id: 0, coords: journey.route_geometry, color: c.hex, weight: 7, opacity: 0.85,
  }] : [];

  return (
    <div className="fixed inset-0 w-full h-full">
      <MapView
        center={journey.destination ? [journey.destination.lat, journey.destination.lng] : [13.0827, 80.2707]}
        zoom={14} markers={markers} routes={routes} userLocation={userLoc} fitBounds
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Top progress bar */}
      <div className="absolute top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-b border-white/60 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 max-w-5xl mx-auto">
          <button onClick={() => nav('/')} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center" data-testid="journey-back">
            <X className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 truncate">{journey.destination_label || 'Destination'}</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-poppins font-bold text-slate-900">{Math.round(remainingS / 60)} min</span>
              <span className="text-sm text-slate-500">· {(remainingM / 1000).toFixed(1)} km left</span>
            </div>
          </div>
          <ScoreBadge score={journey.safety_score} size="sm" />
        </div>
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-teal-600 transition-all" style={{
            width: `${Math.max(0, Math.min(100, 100 - (remainingM / (journey.estimated_distance_m || 1)) * 100))}%`
          }} />
        </div>
      </div>

      {/* Deviation warning */}
      <AnimatePresence>
        {deviation > 80 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute top-20 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-96 z-40 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-2.5 shadow-md flex items-center gap-2 text-sm text-amber-900"
            data-testid="deviation-warning">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            You've moved <b>{deviation}m</b> off the planned route.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom actions */}
      <div className="absolute bottom-0 left-0 right-0 z-40 p-4 flex flex-col gap-3 items-stretch max-w-md mx-auto md:mx-4">
        <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-2xl p-3 shadow-glass">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-slate-500">Nearby safe spots</div>
            <div className="text-xs text-slate-400">{safePlaces.length} within 2 km</div>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto panel-scroll">
            {safePlaces.slice(0, 8).map(p => (
              <div key={p.id} className="shrink-0 bg-slate-50 rounded-xl px-3 py-2 text-xs min-w-[110px]" data-testid={`safe-spot-${p.id}`}>
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <span>{SAFE_ICON[p.category] || SAFE_ICON.other}</span>
                  <span className="capitalize truncate max-w-[70px]">{p.category.replace('_', ' ')}</span>
                </div>
                <div className="text-slate-500 truncate">{p.name}</div>
                <div className="text-slate-400 mt-0.5">{p.distance_m < 1000 ? `${p.distance_m} m` : `${(p.distance_m / 1000).toFixed(1)} km`}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowShare(true)} data-testid="walk-with-me-btn"
            className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 font-medium text-slate-700 shadow-sm transition">
            <Share2 className="w-5 h-5" /> Walk With Me
          </button>
          <button onClick={finish} data-testid="end-journey-btn"
            className="bg-slate-100 hover:bg-slate-200 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 font-medium text-slate-600 transition">
            <Flag className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* SOS button */}
      <button onClick={() => setShowSOS(true)} data-testid="sos-button"
        className={`absolute bottom-32 md:bottom-8 right-6 z-50 w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl transition ${sosActive ? 'sos-pulse' : ''}`}>
        <ShieldAlert className="w-7 h-7" />
      </button>

      {/* Share modal */}
      <AnimatePresence>
        {showShare && (
          <motion.div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end md:items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowShare(false)}>
            <motion.div onClick={(e) => e.stopPropagation()}
              initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl p-6 shadow-2xl"
              data-testid="share-modal">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-poppins font-bold text-lg text-slate-900">Walk With Me</h3>
                  <p className="text-sm text-slate-500 mt-1">Share this link with someone you trust. They'll see your live location until you arrive. No accounts needed.</p>
                </div>
                <button onClick={() => setShowShare(false)} className="p-1"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-2 text-xs text-slate-700 font-mono break-all border border-slate-200" data-testid="share-url">
                {shareUrl}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={copyLink} data-testid="copy-link-btn"
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 transition">
                  {copied ? <><Check className="w-4 h-4 text-teal-600" /> Copied</> : <><Copy className="w-4 h-4" /> Copy link</>}
                </button>
                <button onClick={shareWhatsApp} data-testid="whatsapp-btn"
                  className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 rounded-xl px-3 py-2.5 text-sm font-medium text-white transition">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </button>
              </div>
              <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
                Link auto-expires when you arrive or after 6 hours. All GPS data is deleted after journey ends.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SOS confirmation */}
      <AnimatePresence>
        {showSOS && (
          <motion.div className="fixed inset-0 z-[60] bg-red-900/50 backdrop-blur-sm flex items-end md:items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowSOS(false)}>
            <motion.div onClick={(e) => e.stopPropagation()}
              initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl p-6 shadow-2xl"
              data-testid="sos-modal">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="font-poppins font-bold text-xl text-slate-900 text-center">Trigger Emergency SOS?</h3>
              <p className="text-sm text-slate-600 text-center mt-2">
                Your live location will be highlighted for everyone watching your Walk-With-Me link.
                Nearest police stations and hospitals will surface.
              </p>
              <div className="mt-4 flex flex-col gap-2 bg-slate-50 rounded-2xl p-3 text-sm">
                <a href="tel:100" className="flex items-center justify-between hover:bg-white rounded-lg px-2 py-1.5" data-testid="call-100">
                  <span className="flex items-center gap-2"><PhoneCall className="w-4 h-4 text-red-600" /> Police</span>
                  <span className="font-semibold text-slate-800">100</span>
                </a>
                <a href="tel:1091" className="flex items-center justify-between hover:bg-white rounded-lg px-2 py-1.5" data-testid="call-1091">
                  <span className="flex items-center gap-2"><PhoneCall className="w-4 h-4 text-red-600" /> Women's Helpline</span>
                  <span className="font-semibold text-slate-800">1091</span>
                </a>
                <a href="tel:108" className="flex items-center justify-between hover:bg-white rounded-lg px-2 py-1.5" data-testid="call-108">
                  <span className="flex items-center gap-2"><PhoneCall className="w-4 h-4 text-red-600" /> Ambulance</span>
                  <span className="font-semibold text-slate-800">108</span>
                </a>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setShowSOS(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 rounded-xl px-4 py-3 font-medium text-slate-700">
                  Cancel
                </button>
                <button onClick={doSOS} data-testid="confirm-sos-btn"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-3 font-bold">
                  Broadcast SOS
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
