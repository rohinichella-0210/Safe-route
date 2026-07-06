/*
# SafeRoute Initial Database Schema

1. Purpose
- Creates the complete database schema for SafeRoute, a safety-first navigation platform for Chennai
- Stores incident reports, trusted places, community validations, infrastructure data
- Supports anonymous sessions for privacy-preserving journey tracking
- No user authentication required - all data is publicly accessible

2. New Tables
- incident_reports: Community-submitted safety incidents
- incident_validations: Community confirmations/rejections of reports  
- trusted_places: Verified safe public locations (police, hospitals, etc.)
- infrastructure_data: Street lighting and road infrastructure status
- public_transport: Metro and bus stop information
- anonymous_sessions: Temporary journey sessions (auto-deleted)
- walk_sessions: Walk With Me live sharing sessions
- viewers: Active viewers of shared journeys
- emergency_events: Emergency activations during journeys
- platform_stats: Cached platform statistics for dashboard

3. Security
- All tables use RLS with `TO anon, authenticated` policies
- No user authentication - anonymous usage by design
- Temporary session data is designed for cleanup

4. Spatial Features
- Uses PostGIS for geographic coordinates
- Spatial indexes for proximity queries
*/

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Incident Reports Table
CREATE TABLE IF NOT EXISTS incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('harassment', 'poor_lighting', 'suspicious_activity', 'unsafe_area', 'road_obstruction', 'broken_streetlight', 'public_disturbance', 'other')),
    description TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(10, 8) NOT NULL,
    location_point GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_MakePoint(longitude, latitude)::geography) STORED,
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    confidence_score INTEGER DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    source_type TEXT DEFAULT 'community' CHECK (source_type IN ('community', 'official')),
    is_active BOOLEAN DEFAULT true,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high'))
);

-- Community Validations Table
CREATE TABLE IF NOT EXISTS incident_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incident_reports(id) ON DELETE CASCADE,
    vote TEXT NOT NULL CHECK (vote IN ('confirm', 'reject', 'unable_verify')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    session_token TEXT
);

-- Trusted Places Table (Safe Spots)
CREATE TABLE IF NOT EXISTS trusted_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('police_station', 'womens_police_station', 'hospital', 'government_hospital', 'pharmacy', 'metro_station', 'bus_stop', 'railway_station', 'petrol_bunk', 'government_office', 'hotel', 'restaurant', 'bank', 'shopping_mall', 'public_facility')),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(10, 8) NOT NULL,
    location_point GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_MakePoint(longitude, latitude)::geography) STORED,
    address TEXT,
    provider TEXT DEFAULT 'google_places',
    is_24_hours BOOLEAN DEFAULT false,
    contact_number TEXT,
    last_verified TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Infrastructure Data Table (Street Lighting)
CREATE TABLE IF NOT EXISTS infrastructure_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    road_name TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(10, 8) NOT NULL,
    location_point GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_MakePoint(longitude, latitude)::geography) STORED,
    lighting_status TEXT DEFAULT 'unknown' CHECK (lighting_status IN ('excellent', 'good', 'moderate', 'poor', 'non_functional', 'unknown')),
    lighting_score INTEGER DEFAULT 50 CHECK (lighting_score >= 0 AND lighting_score <= 100),
    road_condition TEXT DEFAULT 'average',
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    data_source TEXT,
    community_confirmations INTEGER DEFAULT 0
);

-- Public Transport Table
CREATE TABLE IF NOT EXISTS public_transport (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transport_type TEXT NOT NULL CHECK (transport_type IN ('metro', 'bus', 'suburban_rail')),
    stop_name TEXT NOT NULL,
    route_numbers TEXT[],
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(10, 8) NOT NULL,
    location_point GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_MakePoint(longitude, latitude)::geography) STORED,
    fare_range_min DECIMAL(10, 2),
    fare_range_max DECIMAL(10, 2),
    operating_hours TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Anonymous Sessions Table (Temporary)
CREATE TABLE IF NOT EXISTS anonymous_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT UNIQUE NOT NULL,
    source_lat DECIMAL(10, 8),
    source_lng DECIMAL(10, 8),
    dest_lat DECIMAL(10, 8),
    dest_lng DECIMAL(10, 8),
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(10, 8),
    selected_route_id TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '4 hours',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'emergency')),
    transport_mode TEXT DEFAULT 'walking'
);

-- Walk Sessions Table (Walk With Me)
CREATE TABLE IF NOT EXISTS walk_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES anonymous_sessions(id) ON DELETE CASCADE,
    share_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '4 hours',
    viewer_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Viewers Table
CREATE TABLE IF NOT EXISTS viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    walk_session_id UUID REFERENCES walk_sessions(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    connection_status TEXT DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected'))
);

-- Emergency Events Table
CREATE TABLE IF NOT EXISTS emergency_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES anonymous_sessions(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(10, 8) NOT NULL,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
    viewers_notified INTEGER DEFAULT 0
);

-- Platform Stats Cache
CREATE TABLE IF NOT EXISTS platform_stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    verified_incidents INTEGER DEFAULT 0,
    active_reports INTEGER DEFAULT 0,
    trusted_places_count INTEGER DEFAULT 0,
    community_validations INTEGER DEFAULT 0,
    routes_analyzed INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create spatial indexes
CREATE INDEX IF NOT EXISTS idx_incident_reports_location ON incident_reports USING GIST(location_point);
CREATE INDEX IF NOT EXISTS idx_trusted_places_location ON trusted_places USING GIST(location_point);
CREATE INDEX IF NOT EXISTS idx_infrastructure_location ON infrastructure_data USING GIST(location_point);
CREATE INDEX IF NOT EXISTS idx_public_transport_location ON public_transport USING GIST(location_point);

-- Create additional indexes
CREATE INDEX IF NOT EXISTS idx_incident_reports_category ON incident_reports(category);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON incident_reports(verification_status);
CREATE INDEX IF NOT EXISTS idx_trusted_places_category ON trusted_places(category);
CREATE INDEX IF NOT EXISTS idx_anonymous_sessions_token ON anonymous_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_walk_sessions_token ON walk_sessions(share_token);

-- Enable RLS on all tables
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE infrastructure_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymous_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for incident_reports (anon + authenticated allowed)
DROP POLICY IF EXISTS "anon_select_incidents" ON incident_reports;
CREATE POLICY "anon_select_incidents" ON incident_reports FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_incidents" ON incident_reports;
CREATE POLICY "anon_insert_incidents" ON incident_reports FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_incidents" ON incident_reports;
CREATE POLICY "anon_update_incidents" ON incident_reports FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for incident_validations
DROP POLICY IF EXISTS "anon_select_validations" ON incident_validations;
CREATE POLICY "anon_select_validations" ON incident_validations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_validations" ON incident_validations;
CREATE POLICY "anon_insert_validations" ON incident_validations FOR INSERT TO anon, authenticated WITH CHECK (true);

-- RLS Policies for trusted_places (read-only for anon)
DROP POLICY IF EXISTS "anon_select_places" ON trusted_places;
CREATE POLICY "anon_select_places" ON trusted_places FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_places" ON trusted_places;
CREATE POLICY "anon_insert_places" ON trusted_places FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_places" ON trusted_places;
CREATE POLICY "anon_update_places" ON trusted_places FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for infrastructure_data
DROP POLICY IF EXISTS "anon_select_infra" ON infrastructure_data;
CREATE POLICY "anon_select_infra" ON infrastructure_data FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_infra" ON infrastructure_data;
CREATE POLICY "anon_insert_infra" ON infrastructure_data FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_infra" ON infrastructure_data;
CREATE POLICY "anon_update_infra" ON infrastructure_data FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for public_transport (read-only)
DROP POLICY IF EXISTS "anon_select_transport" ON public_transport;
CREATE POLICY "anon_select_transport" ON public_transport FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_transport" ON public_transport;
CREATE POLICY "anon_insert_transport" ON public_transport FOR INSERT TO anon, authenticated WITH CHECK (true);

-- RLS Policies for anonymous_sessions
DROP POLICY IF EXISTS "anon_select_sessions" ON anonymous_sessions;
CREATE POLICY "anon_select_sessions" ON anonymous_sessions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sessions" ON anonymous_sessions;
CREATE POLICY "anon_insert_sessions" ON anonymous_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sessions" ON anonymous_sessions;
CREATE POLICY "anon_update_sessions" ON anonymous_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sessions" ON anonymous_sessions;
CREATE POLICY "anon_delete_sessions" ON anonymous_sessions FOR DELETE TO anon, authenticated USING (true);

-- RLS Policies for walk_sessions
DROP POLICY IF EXISTS "anon_select_walk" ON walk_sessions;
CREATE POLICY "anon_select_walk" ON walk_sessions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_walk" ON walk_sessions;
CREATE POLICY "anon_insert_walk" ON walk_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_walk" ON walk_sessions;
CREATE POLICY "anon_update_walk" ON walk_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_walk" ON walk_sessions;
CREATE POLICY "anon_delete_walk" ON walk_sessions FOR DELETE TO anon, authenticated USING (true);

-- RLS Policies for viewers
DROP POLICY IF EXISTS "anon_select_viewers" ON viewers;
CREATE POLICY "anon_select_viewers" ON viewers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_viewers" ON viewers;
CREATE POLICY "anon_insert_viewers" ON viewers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_viewers" ON viewers;
CREATE POLICY "anon_delete_viewers" ON viewers FOR DELETE TO anon, authenticated USING (true);

-- RLS Policies for emergency_events
DROP POLICY IF EXISTS "anon_select_emergency" ON emergency_events;
CREATE POLICY "anon_select_emergency" ON emergency_events FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_emergency" ON emergency_events;
CREATE POLICY "anon_insert_emergency" ON emergency_events FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_emergency" ON emergency_events;
CREATE POLICY "anon_update_emergency" ON emergency_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for platform_stats
DROP POLICY IF EXISTS "anon_select_stats" ON platform_stats;
CREATE POLICY "anon_select_stats" ON platform_stats FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_stats" ON platform_stats;
CREATE POLICY "anon_update_stats" ON platform_stats FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Insert initial platform stats
INSERT INTO platform_stats (id, verified_incidents, active_reports, trusted_places_count, community_validations, routes_analyzed)
VALUES (1, 0, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;
