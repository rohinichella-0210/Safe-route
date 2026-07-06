import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, LocateFixed, ShieldAlert, Info, Check, Camera, ImageIcon } from 'lucide-react';
import MapView from '../components/MapView';
import { toast } from '../components/Toaster';
import { submitIncident, fetchIncidents, confirmIncident, uploadIncidentPhoto, type Incident } from '../lib/api';

const CATEGORIES = [
  { id: 'harassment', label: 'Harassment', icon: '⚠️' },
  { id: 'stalking', label: 'Stalking', icon: '👤' },
  { id: 'theft', label: 'Theft / Snatching', icon: '👜' },
  { id: 'poor_lighting', label: 'Poor lighting', icon: '💡' },
  { id: 'suspicious_activity', label: 'Suspicious activity', icon: '👁️' },
  { id: 'other', label: 'Other concern', icon: '📝' },
];

const CAT_COLOR: Record<string, string> = {
  harassment: '#DC2626', stalking: '#B91C1C', theft: '#EA580C',
  poor_lighting: '#CA8A04', suspicious_activity: '#7C3AED', other: '#64748B',
};

export default function ReportScreen() {
  const nav = useNavigate();
  const [category, setCategory] = useState<string>('harassment');
  const [description, setDescription] = useState('');
  const [incidentLoc, setIncidentLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [reporterLoc, setReporterLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nearby, setNearby] = useState<Incident[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const getGPS = () => {
    if (!navigator.geolocation) { toast('error', 'GPS not available'); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      setReporterLoc({ lat, lng });
      if (!incidentLoc) setIncidentLoc({ lat, lng });
      try {
        const r = await fetchIncidents(lat, lng, 2000);
        setNearby(r.incidents);
      } catch {}
      toast('success', 'GPS locked');
    }, () => toast('error', 'GPS permission denied'), { enableHighAccuracy: true });
  };

  useEffect(() => {
    // Try GPS first
    getGPS();
    // Fallback: load nearby reports from Chennai center so list is never empty
    (async () => {
      try {
        const r = await fetchIncidents(13.0827, 80.2707, 15000);
        setNearby(prev => prev.length > 0 ? prev : r.incidents);
      } catch {}
    })();
  }, []); // eslint-disable-line

  const submit = async () => {
    if (!incidentLoc) { toast('warning', 'Set incident location'); return; }
    if (!reporterLoc) { toast('warning', 'Enable GPS to verify proximity'); return; }
    setSubmitting(true);
    try {
      const r = await submitIncident({
        category, description: description || undefined,
        lat: incidentLoc.lat, lng: incidentLoc.lng,
        reporter_lat: reporterLoc.lat, reporter_lng: reporterLoc.lng,
      });
      if (photo && r.id) {
        try {
          await uploadIncidentPhoto(r.id, photo);
          toast('success', 'Report + photo submitted (EXIF stripped, pending verification)');
        } catch {
          toast('warning', 'Report submitted but photo upload failed');
        }
      } else {
        toast('success', 'Report submitted — pending community verification');
      }
      setDescription(''); setPhoto(null); setPhotoPreview(null);
      const rr = await fetchIncidents(reporterLoc.lat, reporterLoc.lng, 2000);
      setNearby(rr.incidents);
    } catch (e: any) {
      toast('error', e?.response?.data?.detail || 'Submission failed');
    }
    setSubmitting(false);
  };

  const onPhotoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('error', 'Photo must be under 2 MB'); return; }
    setPhoto(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const confirm = async (id: string, disputed: boolean) => {
    try {
      await confirmIncident(id, disputed);
      toast('success', disputed ? 'Marked as disputed' : 'Confirmed');
      if (reporterLoc) {
        const r = await fetchIncidents(reporterLoc.lat, reporterLoc.lng, 2000);
        setNearby(r.incidents);
      }
    } catch {
      toast('error', 'Failed');
    }
  };

  const markers = [
    ...(incidentLoc ? [{ id: 'here', lat: incidentLoc.lat, lng: incidentLoc.lng, color: CAT_COLOR[category], icon: '⚠️', label: 'Reporting here' }] : []),
    ...nearby.slice(0, 40).map(i => ({
      id: i.id, lat: i.lat, lng: i.lng, color: CAT_COLOR[i.category] || '#64748B',
      icon: i.status === 'verified' ? '✓' : '·', label: `${i.category} · ${i.status}`,
    })),
  ];

  return (
    <div className="fixed inset-0 w-full h-full">
      <MapView
        center={reporterLoc ? [reporterLoc.lat, reporterLoc.lng] : [13.0827, 80.2707]}
        zoom={14} markers={markers} userLocation={reporterLoc}
        onMapClick={(lat, lng) => setIncidentLoc({ lat, lng })}
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-b border-white/60 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center" data-testid="report-back">
            <X className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <div className="font-poppins font-bold text-slate-900">Report a safety concern</div>
            <div className="text-xs text-slate-500">Anonymous · GPS-verified · Never shared with authorities without your consent</div>
          </div>
        </div>
      </div>

      {/* Panel */}
      <div className="absolute bottom-0 left-0 right-0 md:top-20 md:bottom-8 md:right-4 md:left-auto md:w-[420px] z-40 bg-white/95 backdrop-blur-xl border border-white/60 rounded-t-3xl md:rounded-2xl shadow-glass flex flex-col max-h-[85vh]">
        <div className="p-5 overflow-y-auto panel-scroll flex-1">
          <div className="mb-3 text-xs text-slate-600 bg-teal-50 border border-teal-200 rounded-xl p-3 flex gap-2">
            <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>Tap the map to set the incident location, or use your current GPS. You must be within 500m to submit — this prevents abuse.</span>
          </div>
          <label className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Category</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)} data-testid={`category-${c.id}`}
                className={`text-left rounded-xl px-3 py-2.5 border transition ${category === c.id ? 'bg-teal-50 border-teal-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <div className="text-lg">{c.icon}</div>
                <div className="text-sm font-medium text-slate-800">{c.label}</div>
              </button>
            ))}
          </div>

          <label className="text-xs uppercase tracking-widest text-slate-500 font-semibold mt-4 block">Description (optional)</label>
          <textarea data-testid="description-input" value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full mt-2 bg-slate-50 border border-transparent focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200 rounded-xl px-3 py-2 text-sm outline-none resize-none"
            rows={3} maxLength={300} placeholder="Any details that could help others…" />

          <label className="text-xs uppercase tracking-widest text-slate-500 font-semibold mt-4 block">Photo (optional)</label>
          <div className="mt-2">
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="preview" className="w-full h-40 object-cover rounded-xl border border-slate-200" data-testid="photo-preview" />
                <button onClick={() => { setPhoto(null); setPhotoPreview(null); }} data-testid="remove-photo"
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/95 border border-slate-200 flex items-center justify-center">
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-4 cursor-pointer hover:bg-slate-50 transition text-sm text-slate-600" data-testid="photo-picker">
                <Camera className="w-4 h-4" /> Attach photo (EXIF stripped for privacy)
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoPicked} className="hidden" />
              </label>
            )}
            <div className="text-[10px] text-slate-400 mt-1">Max 2 MB · Auto re-encoded to strip GPS/EXIF · Anonymous</div>
          </div>

          <div className="mt-3 bg-slate-50 rounded-xl p-3 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span>Incident location</span>
              <button onClick={getGPS} className="text-teal-700 flex items-center gap-1 font-semibold" data-testid="use-my-gps">
                <LocateFixed className="w-3.5 h-3.5" /> Use my GPS
              </button>
            </div>
            <div className="font-mono text-slate-500 mt-1">
              {incidentLoc ? `${incidentLoc.lat.toFixed(5)}, ${incidentLoc.lng.toFixed(5)}` : 'Tap the map or use GPS'}
            </div>
          </div>

          <button onClick={submit} disabled={submitting || !incidentLoc || !reporterLoc} data-testid="submit-report-btn"
            className="w-full mt-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition">
            <ShieldAlert className="w-4 h-4" /> {submitting ? 'Submitting…' : 'Submit anonymously'}
          </button>

          {nearby.length > 0 && (
            <div className="mt-5">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Recent reports nearby</div>
              <div className="mt-2 space-y-2">
                {nearby.slice(0, 8).map(i => (
                  <div key={i.id} className="bg-white border border-slate-200 rounded-xl p-3" data-testid={`nearby-incident-${i.id}`}>
                    <div className="flex items-start gap-2">
                      {i.photo_data_url && (
                        <img src={i.photo_data_url} alt="incident" className="w-14 h-14 rounded-lg object-cover border border-slate-200" data-testid={`incident-photo-${i.id}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${
                            i.status === 'verified' ? 'bg-teal-100 text-teal-800' : i.status === 'disputed' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'
                          }`}>{i.status}</span>
                          <span className="text-sm font-medium text-slate-800 capitalize">{i.category.replace('_', ' ')}</span>
                        </div>
                        {i.description && <div className="text-xs text-slate-600 mt-1">{i.description}</div>}
                        <div className="text-[11px] text-slate-400 mt-1">
                          {i.distance_m !== undefined ? `${i.distance_m < 1000 ? i.distance_m + ' m' : (i.distance_m/1000).toFixed(1)+' km'} away · ` : ''}
                          👍 {i.verified_count} · 👎 {i.disputed_count}
                          {i.source === 'seed' && i.source_url && <> · <a href={i.source_url} target="_blank" rel="noreferrer" className="underline">source</a></>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => confirm(i.id, false)} data-testid={`confirm-${i.id}`}
                        className="flex-1 text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg py-1.5 font-medium">
                        Confirm
                      </button>
                      <button onClick={() => confirm(i.id, true)} data-testid={`dispute-${i.id}`}
                        className="flex-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg py-1.5 font-medium">
                        Dispute
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
