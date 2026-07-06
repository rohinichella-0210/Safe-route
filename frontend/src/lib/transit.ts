import { api } from './api';

export interface TransitOption {
  mode: string;
  label: string;
  icon: string;
  fare_inr?: number;
  fare_note?: string;
  duration_min?: number;
  distance_km?: number;
  safety: { score: number; band: string; factors: string[]; confidence: number };
  legs?: { type: string; from: string; to: string; distance_m?: number; distance_km?: number; duration_min: number }[];
  source_station?: { name: string; lat: number; lng: number; distance_m: number };
  destination_station?: { name: string; lat: number; lng: number; distance_m: number };
  source_stop?: { name: string; lat: number; lng: number; distance_m: number };
  destination_stop?: { name: string; lat: number; lng: number; distance_m: number };
  unavailable?: boolean;
  reason?: string;
  data_source?: string;
}

export const fetchTransit = async (source: { lat: number; lng: number }, destination: { lat: number; lng: number }) => {
  const r = await api.post('/transit', { source, destination, mode: 'walking' });
  return r.data as { options: TransitOption[]; hour: number; departure: string; note: string };
};
