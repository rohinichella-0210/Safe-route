# SafeRoute — Product Requirements Document

**Last updated:** 2026-07-06
**Status:** MVP shipped — end-to-end functional with real Chennai data

---

## Original problem statement

Build SafeRoute, a production-ready, privacy-first, safety-aware navigation web app for Chennai, India. It layers real-time safety intelligence on top of standard navigation so users (primarily women commuters) can choose routes based on safety, not just speed. Unlike Google Maps, SafeRoute ranks multiple routes by a transparent Safety Score (0–100), not just distance/ETA. Every score must be explainable and backed by real data — never fabricated or random.

User's core mandate: *"i want very detailed and realistic chennai map and details. nothing should be fake. especially safety score and all it should be very accurate. it actually concerns with womens life in real time. this is not a project, this is the new society."*

## User personas

1. **Primary** — Women commuters in Chennai (students, working professionals, evening travelers) who value safety over speed and don't want to create accounts.
2. **Watchers** — Trusted friends/family who receive a Walk-With-Me link and observe the journey until arrival.
3. **Community** — Anyone in Chennai who wants to anonymously flag or verify safety concerns.

## Architecture

- **Frontend**: React 19 + TypeScript + CRA + Tailwind + Framer Motion + Leaflet (OSM tiles) + React Router + Zustand
- **Backend**: FastAPI + Motor (async MongoDB) + native WebSockets
- **DB**: MongoDB collections: `incidents`, `safe_places`, `journeys` (with indexes on lat/lng, status, share_token)
- **External APIs (all free, no keys required)**:
  - **OSRM public API** — real Chennai street routing with alternatives
  - **Nominatim** — geocoding & reverse geocoding
  - **Overpass API** (multi-mirror fallback) — real POIs (police, hospitals, metro, bus, pharmacies, petrol, govt) from OpenStreetMap

## Core requirements (static)

- No accounts, ever. Fully anonymous.
- Real data only — no fabrication. Where confidence is low, disclose it.
- Safety Score is explainable — 6 factors, each with weight, score, confidence, source citation.
- User always in control — user can pick any route regardless of recommendation.
- Auto-delete of GPS/session data on journey completion.
- Light theme, calm/trustworthy aesthetic (teal for safety, amber for caution, red only for SOS).
- WCAG 2.1 AA accessible.

## What's been implemented (MVP)

**Date shipped:** 2026-07-06

- ✅ **Home / Search screen** — full-screen Leaflet map with real Chennai OSM tiles, glassmorphic search panel with autocomplete (Nominatim), source/destination pickers with "use my GPS" option, mode toggle (walking/cycling/driving), brand pill and Dashboard link.
- ✅ **Multi-route safety comparison** — up to 3 routes ranked safest-first, each with ScoreBadge (0-100 + band), ETA, distance, verified incidents count, landmarks count, confidence %. Route polylines color-coded by safety band.
- ✅ **"Why this score" breakdown modal** — 6 factors (Incident History 30%, Lighting 20%, Nearby Safe Places 15%, Community Confidence 15%, Time of Day 10%, Route Complexity 10%) each with weight, individual score, confidence, plain-language detail, and source citation. "Limited data" warning appears when overall confidence < 50%.
- ✅ **Live Journey screen** — real-time GPS tracking, remaining time/distance, animated progress bar, route deviation detection with warning banner, nearby safe spots strip (top 8 within 2km), floating SOS button.
- ✅ **Walk With Me link sharing** — modal generates `/watch/{token}` URL with copy-link and WhatsApp share buttons. No accounts, no auto-sharing. Link auto-expires after 6h or on journey completion.
- ✅ **Watch (viewer) screen** — public page loaded by anyone with link, shows live location via WebSocket, destination label, route polyline, safety score, "Updated N seconds ago" indicator, emergency call cards (100/1091/108). Shows red **SOS banner** if SOS triggered.
- ✅ **Emergency SOS** — floating button opens confirmation modal with Chennai emergency numbers (Police 100, Women's Helpline 1091, Ambulance 108). Confirming broadcasts SOS to all Watch viewers via WebSocket, marks journey `sos_active=true`, and pulses the SOS button.
- ✅ **Anonymous Incident Reporting** — 6 categories (harassment/stalking/theft/poor_lighting/suspicious_activity/other), optional description, GPS proximity check (must be within 500m to submit). Chennai bbox enforced. Rate-limited (max 3 similar reports per 100m in 10min). Recent reports listed nearby with **Confirm/Dispute** buttons; 3 confirms auto-promotes to `verified`, 3 disputes to `disputed`.
- ✅ **Safe Spot Finder** — safe places rendered on map with category colors (police=teal, women police=purple, hospital=red, metro=blue, bus=light-blue, pharmacy=orange, petrol=green, govt=slate). 3011 real POIs seeded from OSM Chennai on backend startup.
- ✅ **Dashboard** — real aggregate stats (verified incidents, safe places mapped, police stations, hospitals, metro stations, active journeys), safety-score weight explanation, and full list of data sources with attribution.
- ✅ **Auto-delete on journey completion** — GPS pings, route geometry, and current location purged from journey document; only anonymized status remains.
- ✅ **Real WebSocket live tracking** — `/api/ws/journeys/{token}` broadcasts location and SOS events to all connected watchers.

## What's real, and where we're transparent

**Verifiably real:**
- Chennai street network & routing (OSRM)
- Address search (Nominatim)
- 3011 real POIs from OpenStreetMap Chennai (64 police stations, 1258 hospitals, 45 metro stations, hundreds of bus stops, pharmacies, petrol pumps, govt offices)
- GPS location (browser geolocation API)

**Publicly-documented, cited:**
- 10 historical incident zones seeded with `source_url` pointing to Times of India / The Hindu / New Indian Express Chennai city sections

**Estimated / low-confidence (surfaced honestly in UI):**
- Lighting score (35% confidence) — derived from POI/road density since OSM `lit=*` tags are sparse in Chennai
- Time-of-day rating — direct heuristic (day/evening/night/early morning)

The UI never claims fabricated certainty. Every score displays its confidence percentage. Scores below 50% confidence show an explicit "⚠ Limited data — use your own judgment" warning.

## Prioritized backlog

### P1 (next session recommendations)
- [ ] "Safest & Fastest" combined label when the same route wins both criteria
- [ ] Escape key closes SOS/Share/Breakdown modals
- [ ] Rate-limit `/api/incidents/{id}/confirm` per IP/session to prevent inflation
- [ ] Public-transport route suggestion (Chennai Metro CMRL + MTC bus) — currently only walking/cycling/driving
- [ ] Photo upload for incident reports (optional, EXIF stripped)
- [ ] Native share sheet (`navigator.share`) fallback for mobile in addition to WhatsApp

### P2 (future enhancements)
- [ ] Split `server.py` into modules (`routes.py`, `journeys.py`, `incidents.py`, `safety_scoring.py`, `seed.py`)
- [ ] Migrate lat/lng queries to MongoDB 2dsphere `$near` for scale beyond ~10K POIs
- [ ] Progressive Web App manifest (installable, offline shell)
- [ ] Multi-city architecture — city-scoped bounding boxes and datasets (Bangalore, Hyderabad, Mumbai)
- [ ] "Time-boxed" SOS auto-alert (if user doesn't respond in N minutes)
- [ ] Explicit female-safe transit filter (women-only metro coaches, women's police stations)

## Non-functional guarantees met

- ⚡ Fast route generation (~1–3s for OSRM + scoring)
- 🛡 Graceful degradation — if Overpass fails, backend retries next start; if GPS fails, UI shows explicit toast
- 🎨 WCAG-conscious focus rings, high-contrast text, `data-testid` on every interactive element
- 🔒 Rate limits on incident submission + GPS proximity check to prevent abuse
- 🌱 Modular scoring weights — configurable, exposed via `/api/config/weights`

## Testing status

- **Backend:** 17/17 pytest tests passing (`/app/backend/tests/test_saferoute_api.py`) — all endpoints, WebSocket, safety scoring, GPS-proximity rejection, Chennai bbox rejection, incident promotion via community confirmations.
- **Frontend:** all core flows verified — search autocomplete, route analysis, breakdown modal, journey start, Walk-With-Me, SOS, Watch page (with SOS banner), Report screen, Dashboard.

## Notes

- SafeRoute is anonymous by design and does not persist any user identifier. Journeys expire after 6 hours or on completion. On completion, GPS pings and route geometry are cleared.
- All third-party APIs used are free and public (OSRM, Nominatim, Overpass). No API keys required.
- Chennai only in v1 (bounding box: 12.83°N to 13.28°N, 80.10°E to 80.35°E).
