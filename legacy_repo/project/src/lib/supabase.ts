import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface DbIncidentReport {
  id: string;
  category: string;
  description: string | null;
  latitude: number;
  longitude: number;
  reported_at: string;
  confidence_score: number;
  verification_status: string;
  severity: string;
  is_active: boolean;
}

export interface DbTrustedPlace {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string | null;
  is_24_hours: boolean;
  contact_number: string | null;
  last_verified: string;
  is_active: boolean;
}

export interface DbPlatformStats {
  verified_incidents: number;
  active_reports: number;
  trusted_places_count: number;
  community_validations: number;
  routes_analyzed: number;
}

// Create a database function for nearby queries if it doesn't exist
export async function ensureDbFunctions() {
  // This function will be called once to ensure necessary DB functions exist
  // The functions should be created via migration ideally
}

// API functions
export async function fetchNearbyIncidents(
  lat: number,
  lng: number,
  radiusMeters: number = 500
): Promise<DbIncidentReport[]> {
  const { data, error } = await supabase
    .from('incident_reports')
    .select('*')
    .eq('is_active', true)
    .gte('latitude', lat - 0.01)
    .lte('latitude', lat + 0.01)
    .gte('longitude', lng - 0.01)
    .lte('longitude', lng + 0.01)
    .order('reported_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching incidents:', error);
    return [];
  }

  return data || [];
}

export async function fetchNearbyTrustedPlaces(
  lat: number,
  lng: number,
  category?: string
): Promise<DbTrustedPlace[]> {
  let query = supabase
    .from('trusted_places')
    .select('*')
    .eq('is_active', true)
    .gte('latitude', lat - 0.02)
    .lte('latitude', lat + 0.02)
    .gte('longitude', lng - 0.02)
    .lte('longitude', lng + 0.02);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query.limit(30);

  if (error) {
    console.error('Error fetching trusted places:', error);
    return [];
  }

  return data || [];
}

export async function reportIncidentToDb(
  category: string,
  description: string,
  latitude: number,
  longitude: number
) {
  const { data, error } = await supabase
    .from('incident_reports')
    .insert({
      category,
      description: description || null,
      latitude,
      longitude,
      confidence_score: 50,
      verification_status: 'pending',
      severity: 'medium',
      is_active: true,
      source_type: 'community',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error reporting incident:', error);
    throw error;
  }

  // Update platform stats
  await supabase.rpc('increment_stat', { stat_name: 'active_reports' }).catch(() => {});

  return data;
}

export async function validateIncident(
  incidentId: string,
  vote: 'confirm' | 'reject' | 'unable_verify',
  sessionToken: string
) {
  const { error } = await supabase.from('incident_validations').insert({
    incident_id: incidentId,
    vote,
    session_token: sessionToken,
  });

  if (error) {
    console.error('Error validating incident:', error);
    throw error;
  }

  // Update incident confidence
  const { data: incident } = await supabase
    .from('incident_reports')
    .select('confidence_score')
    .eq('id', incidentId)
    .single();

  if (incident) {
    const adjustment = vote === 'confirm' ? 5 : vote === 'reject' ? -5 : 0;
    await supabase
      .from('incident_reports')
      .update({
        confidence_score: Math.max(0, Math.min(100, incident.confidence_score + adjustment))
      })
      .eq('id', incidentId);
  }
}

export async function fetchPlatformStats(): Promise<DbPlatformStats> {
  const { data, error } = await supabase
    .from('platform_stats')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error fetching platform stats:', error);
    return {
      verified_incidents: 0,
      active_reports: 0,
      trusted_places_count: 0,
      community_validations: 0,
      routes_analyzed: 0,
    };
  }

  return data as DbPlatformStats;
}

export async function createJourneySession(
  sourceLat: number,
  sourceLng: number,
  destLat: number,
  destLng: number
) {
  const sessionToken = crypto.randomUUID();

  const { data, error } = await supabase
    .from('anonymous_sessions')
    .insert({
      session_token: sessionToken,
      source_lat: sourceLat,
      source_lng: sourceLng,
      dest_lat: destLat,
      dest_lng: destLng,
      current_lat: sourceLat,
      current_lng: sourceLng,
      status: 'active',
    })
    .select('id, session_token')
    .single();

  if (error) {
    console.error('Error creating journey session:', error);
    throw error;
  }

  return data;
}

export async function updateJourneyLocation(
  sessionToken: string,
  lat: number,
  lng: number
) {
  const { error } = await supabase
    .from('anonymous_sessions')
    .update({
      current_lat: lat,
      current_lng: lng,
    })
    .eq('session_token', sessionToken);

  if (error) {
    console.error('Error updating journey location:', error);
  }
}

export async function endJourneySession(sessionToken: string) {
  const { error } = await supabase
    .from('anonymous_sessions')
    .update({ status: 'completed' })
    .eq('session_token', sessionToken);

  if (error) {
    console.error('Error ending journey session:', error);
  }

  // Update routes analyzed count
  await supabase
    .from('platform_stats')
    .update({ routes_analyzed: (await fetchPlatformStats()).routes_analyzed + 1 })
    .eq('id', 1);
}

export async function createWalkSession(sessionId: string): Promise<{ id: string; share_token: string }> {
  const shareToken = crypto.randomUUID();

  const { data, error } = await supabase
    .from('walk_sessions')
    .insert({
      session_id: sessionId,
      share_token: shareToken,
      is_active: true,
      viewer_count: 0,
    })
    .select('id, share_token')
    .single();

  if (error) {
    console.error('Error creating walk session:', error);
    throw error;
  }

  return data;
}

export async function updateWalkViewerCount(walkSessionId: string, count: number) {
  const { error } = await supabase
    .from('walk_sessions')
    .update({ viewer_count: count })
    .eq('id', walkSessionId);

  if (error) {
    console.error('Error updating viewer count:', error);
  }
}

export async function endWalkSession(walkSessionId: string) {
  const { error } = await supabase
    .from('walk_sessions')
    .update({ is_active: false })
    .eq('id', walkSessionId);

  if (error) {
    console.error('Error ending walk session:', error);
  }
}

export async function recordEmergency(
  sessionId: string,
  lat: number,
  lng: number
) {
  const { data, error } = await supabase
    .from('emergency_events')
    .insert({
      session_id: sessionId,
      latitude: lat,
      longitude: lng,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error recording emergency:', error);
    throw error;
  }

  return data;
}

export async function resolveEmergency(emergencyId: string) {
  const { error } = await supabase
    .from('emergency_events')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString()
    })
    .eq('id', emergencyId);

  if (error) {
    console.error('Error resolving emergency:', error);
  }
}

// Subscribe to real-time updates for a walk session
export function subscribeToWalkSession(
  shareToken: string,
  onUpdate: (location: { lat: number; lng: number }) => void
) {
  return supabase
    .channel(`walk_session:${shareToken}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'anonymous_sessions',
      },
      (payload) => {
        const newData = payload.new as {
          current_lat: number;
          current_lng: number;
        };
        if (newData.current_lat && newData.current_lng) {
          onUpdate({
            lat: newData.current_lat,
            lng: newData.current_lng,
          });
        }
      }
    )
    .subscribe();
}

// Subscribe to new incidents in an area
export function subscribeToAreaIncidents(
  onNewIncident: (incident: DbIncidentReport) => void
) {
  return supabase
    .channel('area_incidents')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'incident_reports',
      },
      (payload) => {
        onNewIncident(payload.new as DbIncidentReport);
      }
    )
    .subscribe();
}

// Get all incidents for heatmap
export async function getAllIncidents(): Promise<DbIncidentReport[]> {
  const { data, error } = await supabase
    .from('incident_reports')
    .select('*')
    .eq('is_active', true)
    .order('reported_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching all incidents:', error);
    return [];
  }

  return data || [];
}

// Get all trusted places
export async function getAllTrustedPlaces(): Promise<DbTrustedPlace[]> {
  const { data, error } = await supabase
    .from('trusted_places')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching trusted places:', error);
    return [];
  }

  return data || [];
}

// Get public transport options
export async function getPublicTransport(
  lat: number,
  lng: number
) {
  const { data, error } = await supabase
    .from('public_transport')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching public transport:', error);
    return [];
  }

  return data || [];
}

// Real-time channel for journey tracking
export function createJourneyChannel(sessionId: string) {
  return supabase.channel(`journey:${sessionId}`);
}
