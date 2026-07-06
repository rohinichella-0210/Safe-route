import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ShieldCheck, Clock, MapPin, PhoneCall } from 'lucide-react';
import MapView from '../components/MapView';
import ScoreBadge, { bandColor } from '../components/ScoreBadge';
import { toast } from '../components/Toaster';
import { getJourney } from '../lib/api';

export default function WatchScreen() {
  const { token } = useParams();
  const [journey, setJourney] = useState<any>(null);
  const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [sosData, setSosData] = useState<any>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'completed' | 'expired'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const j = await getJourney(token!);
        if (j.status === 'completed') { setStatus('completed'); setJourney(j); return; }
        setJourney(j);
        if (j.current_location) setCurrentLoc({ lat: j.current_location.lat, lng: j.current_location.lng });
        if (j.sos_active) setSosData(j.sos_data);
        setStatus('live');
      } catch (e: any) {
        if (e?.response?.status === 410) setStatus('expired');
        else toast('error', 'Link invalid');
      }
    })();
  }, [token]);

  // Websocket for live updates
  useEffect(() => {
    if (status !== 'live' || !token) return;
    const wsBase = (process.env.REACT_APP_BACKEND_URL as string).replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBase}/api/ws/journeys/${token}`);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'location') { setCurrentLoc({ lat: msg.data.lat, lng: msg.data.lng }); setLastUpdate(new Date()); }
        else if (msg.type === 'sos') { setSosData(msg.data); }
        else if (msg.type === 'completed') { setStatus('completed'); }
      } catch {}
    };
    const ka = setInterval(() => { try { ws.send('ping'); } catch {} }, 25000);
    return () => { clearInterval(ka); ws.close(); };
  }, [status, token]);

  const routes = useMemo(() => journey?.route_geometry?.length
    ? [{ id: 0, coords: journey.route_geometry, color: bandColor(journey.safety_score).hex, weight: 6, opacity: 0.8 }]
    : [], [journey]);

  const markers = useMemo(() => {
    const arr: any[] = [];
    if (journey?.destination) arr.push({ id: 'dst', lat: journey.destination.lat, lng: journey.destination.lng, color: '#DC2626', icon: '🏁', label: 'Destination' });
    return arr;
  }, [journey]);

  if (status === 'expired') return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-6">
      <div className="text-center max-w-sm">
        <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="font-poppins text-xl font-bold text-slate-900">Link expired</h2>
        <p className="text-sm text-slate-500 mt-2">This SafeRoute share link has expired. All location data has been deleted for privacy.</p>
      </div>
    </div>
  );

  if (status === 'completed') return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-6">
      <div className="text-center max-w-sm">
        <ShieldCheck className="w-12 h-12 text-teal-600 mx-auto mb-3" />
        <h2 className="font-poppins text-xl font-bold text-slate-900">Journey ended safely</h2>
        <p className="text-sm text-slate-500 mt-2">The person you were watching has arrived. All GPS data has been auto-deleted.</p>
      </div>
    </div>
  );

  if (!journey) return <div className="fixed inset-0 flex items-center justify-center bg-slate-50 text-slate-500">Connecting…</div>;

  return (
    <div className="fixed inset-0 w-full h-full">
      <MapView
        center={currentLoc ? [currentLoc.lat, currentLoc.lng] : (journey.destination ? [journey.destination.lat, journey.destination.lng] : [13.0827, 80.2707])}
        zoom={15} markers={markers} routes={routes} userLocation={currentLoc} fitBounds
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-b border-white/60 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Watching live · SafeRoute</div>
            <div className="text-sm font-medium text-slate-800 truncate">
              → {journey.destination_label || 'Destination'}
            </div>
          </div>
          <ScoreBadge score={journey.safety_score} size="sm" />
        </div>
      </div>

      {/* SOS banner */}
      {sosData && (
        <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="absolute top-16 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-[440px] z-40 bg-red-600 text-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3"
          data-testid="sos-banner">
          <AlertTriangle className="w-6 h-6 shrink-0 animate-pulse" />
          <div className="flex-1">
            <div className="font-bold">EMERGENCY SOS ACTIVE</div>
            <div className="text-xs opacity-90 mt-0.5">
              Location: {sosData.lat?.toFixed(5)}, {sosData.lng?.toFixed(5)}
            </div>
          </div>
          <a href="tel:100" className="bg-white text-red-700 rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1" data-testid="watch-call-100">
            <PhoneCall className="w-3.5 h-3.5" /> 100
          </a>
        </motion.div>
      )}

      {/* Info panel */}
      <div className="absolute bottom-4 left-4 right-4 md:left-4 md:right-auto md:w-96 z-40 bg-white/95 backdrop-blur-xl border border-white/60 rounded-2xl p-4 shadow-glass">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <MapPin className="w-3.5 h-3.5" />
          {lastUpdate ? `Updated ${Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago` : 'Waiting for first location…'}
        </div>
        <div className="font-poppins font-bold text-slate-900">Live tracking in progress</div>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          You're watching this person's journey to {journey.destination_label || 'their destination'}.
          If you see anything concerning, call emergency services immediately.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <a href="tel:100" className="bg-slate-50 hover:bg-slate-100 rounded-lg px-2 py-2 text-center" data-testid="watch-emergency-100">
            <div className="font-bold text-red-600">100</div><div className="text-slate-500">Police</div>
          </a>
          <a href="tel:1091" className="bg-slate-50 hover:bg-slate-100 rounded-lg px-2 py-2 text-center" data-testid="watch-emergency-1091">
            <div className="font-bold text-red-600">1091</div><div className="text-slate-500">Women</div>
          </a>
          <a href="tel:108" className="bg-slate-50 hover:bg-slate-100 rounded-lg px-2 py-2 text-center" data-testid="watch-emergency-108">
            <div className="font-bold text-red-600">108</div><div className="text-slate-500">Ambulance</div>
          </a>
        </div>
      </div>
    </div>
  );
}
