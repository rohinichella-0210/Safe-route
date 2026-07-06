import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, Building2, MapPin, Users, Activity, Info } from 'lucide-react';
import { dashboardStats } from '../lib/api';

export default function DashboardScreen() {
  const nav = useNavigate();
  const [s, setS] = useState<any>(null);
  useEffect(() => { (async () => { try { setS(await dashboardStats()); } catch {} })(); }, []);

  const stat = (label: string, value: any, icon: React.ReactNode, note?: string) => (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
          <div className="font-poppins font-bold text-2xl text-slate-900 leading-tight">{value ?? '—'}</div>
        </div>
      </div>
      {note && <div className="text-[11px] text-slate-500 mt-2">{note}</div>}
    </div>
  );

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => nav('/')} className="flex items-center gap-1 text-slate-600 text-sm mb-4" data-testid="dashboard-back">
          <ChevronLeft className="w-4 h-4" /> Back to map
        </button>
        <h1 className="font-poppins font-bold text-3xl text-slate-900">SafeRoute Dashboard</h1>
        <p className="text-slate-600 mt-2">Real, aggregate stats — no claims we can't back with data.</p>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="stats-grid">
          {stat('Verified incidents', s?.verified_incidents, <ShieldCheck className="w-5 h-5" />, 'Community-confirmed reports')}
          {stat('Pending incidents', s?.pending_incidents, <Activity className="w-5 h-5" />, 'Awaiting verification')}
          {stat('Safe places mapped', s?.safe_places_mapped, <Building2 className="w-5 h-5" />, 'From OpenStreetMap')}
          {stat('Police stations', s?.police_stations, <MapPin className="w-5 h-5" />)}
          {stat('Hospitals', s?.hospitals, <MapPin className="w-5 h-5" />)}
          {stat('Metro stations', s?.metro_stations, <MapPin className="w-5 h-5" />)}
          {stat('Active journeys', s?.active_journeys, <Users className="w-5 h-5" />, 'Right now')}
          {stat('Total journeys', s?.total_journeys_started, <Users className="w-5 h-5" />, 'Since launch')}
        </div>

        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="font-poppins font-semibold text-lg text-slate-900 flex items-center gap-2">
            <Info className="w-5 h-5 text-teal-600" /> How safety scores are computed
          </h2>
          <div className="mt-3 space-y-1.5 text-sm text-slate-700">
            <div>· Incident history — <b>30%</b> weight</div>
            <div>· Lighting — <b>20%</b> weight (low confidence in Chennai; OSM tags sparse)</div>
            <div>· Nearby safe places — <b>15%</b> weight</div>
            <div>· Community confidence — <b>15%</b> weight</div>
            <div>· Time of day — <b>10%</b> weight</div>
            <div>· Route complexity — <b>10%</b> weight</div>
          </div>
          <div className="mt-4 text-xs text-slate-500 leading-relaxed">
            Every route shows its confidence level. Where data is limited, we say so explicitly — we never fabricate scores.
            You always have the final choice over your route.
          </div>
        </div>

        <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="font-poppins font-semibold text-lg text-slate-900">Data sources</h2>
          <div className="mt-3 space-y-2">
            {(s?.data_sources || []).map((d: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2 shrink-0" />
                <div><b className="text-slate-800">{d.name}</b> — <span className="text-slate-600">{d.purpose}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500 text-center">
          SafeRoute is anonymous. No accounts. No tracking outside active journeys. All GPS data auto-deleted on arrival.
        </div>
      </div>
    </div>
  );
}
