"""
SafeRoute backend integration tests.
Tests real endpoints against the deployed backend via REACT_APP_BACKEND_URL.
"""
import time
import json
import pytest
import requests
import websocket  # from websocket-client
import threading


T_NAGAR = {"lat": 13.0418, "lng": 80.2337}
EGMORE = {"lat": 13.0827, "lng": 80.2707}


# ---------- Health ----------
def test_health(api_client, base_url):
    r = api_client.get(f"{base_url}/api/health", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert isinstance(data.get("safe_places"), int)
    assert data["safe_places"] > 0, f"safe_places should be non-zero, got {data.get('safe_places')}"
    assert data.get("incidents", 0) >= 10


# ---------- Geocode / Reverse ----------
def test_geocode_t_nagar(api_client, base_url):
    r = api_client.get(f"{base_url}/api/geocode", params={"q": "T Nagar"}, timeout=25)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "results" in data
    assert len(data["results"]) >= 1
    first = data["results"][0]
    assert "lat" in first and "lng" in first and "label" in first
    # Must be in Chennai bbox
    assert 12.83 <= first["lat"] <= 13.28
    assert 80.10 <= first["lng"] <= 80.35


def test_reverse_geocode(api_client, base_url):
    r = api_client.get(f"{base_url}/api/reverse", params={"lat": T_NAGAR["lat"], "lng": T_NAGAR["lng"]}, timeout=25)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "label" in data
    assert data["label"] is not None


# ---------- Routes ----------
def test_routes_walking_t_nagar_to_egmore(api_client, base_url):
    payload = {"source": T_NAGAR, "destination": EGMORE, "mode": "walking"}
    r = api_client.post(f"{base_url}/api/routes", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "routes" in data
    assert len(data["routes"]) >= 1

    scores = []
    for route in data["routes"]:
        s = route["safety"]
        assert 0 <= s["score"] <= 100
        assert "band" in s
        assert "breakdown" in s and len(s["breakdown"]) == 6
        # each factor
        expected_factors = {"Incident History", "Lighting", "Nearby Safe Places",
                             "Community Confidence", "Time of Day", "Route Complexity"}
        found_factors = {b["factor"] for b in s["breakdown"]}
        assert expected_factors == found_factors, f"missing factors: {expected_factors - found_factors}"
        for b in s["breakdown"]:
            assert "weight" in b
            assert "score" in b
            assert "confidence" in b
            assert "source" in b
            assert "detail" in b
        assert "confidence" in s
        assert isinstance(route["distance_m"], (int, float))
        assert isinstance(route["duration_s"], (int, float))
        assert isinstance(route["geometry"], list) and len(route["geometry"]) > 1
        scores.append(s["score"])

    # safest first sorted
    assert scores == sorted(scores, reverse=True), f"routes not sorted safest-first: {scores}"
    # Weight sum sanity
    weights = data.get("weights", {})
    assert abs(sum(weights.values()) - 1.0) < 0.001


# ---------- Safe places ----------
def test_safe_places_near_t_nagar(api_client, base_url):
    r = api_client.get(f"{base_url}/api/safe-places", params={"lat": T_NAGAR["lat"], "lng": T_NAGAR["lng"], "radius_m": 1500}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "places" in data
    assert len(data["places"]) > 0
    for p in data["places"]:
        assert "category" in p
        assert "distance_m" in p
        assert p["distance_m"] <= 1500
        assert "lat" in p and "lng" in p


# ---------- Incidents ----------
def test_list_seeded_incidents(api_client, base_url):
    r = api_client.get(f"{base_url}/api/incidents", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "incidents" in data
    assert len(data["incidents"]) >= 10
    # Seeded incidents must have source_url pointing to news sites
    seeded = [i for i in data["incidents"] if i.get("source") == "seed"]
    assert len(seeded) >= 10
    news_domains = ("timesofindia", "thehindu", "newindianexpress")
    for inc in seeded:
        assert inc.get("source_url"), "seed incident missing source_url"
        assert any(d in inc["source_url"] for d in news_domains), f"unexpected source_url: {inc['source_url']}"


def test_create_incident_gps_valid(api_client, base_url):
    # Reporter is same location as incident
    payload = {
        "category": "harassment",
        "description": "TEST_pytest sample report",
        "lat": 13.0418,
        "lng": 80.2337,
        "reporter_lat": 13.0418,
        "reporter_lng": 80.2337,
    }
    r = api_client.post(f"{base_url}/api/incidents", json=payload, timeout=20)
    # Might hit rate limit if this test re-runs several times - allow both
    if r.status_code == 429:
        pytest.skip("Rate limited due to previous test runs")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "id" in data
    assert data["status"] == "pending"


def test_create_incident_reporter_too_far(api_client, base_url):
    # Reporter 5km away from incident location -> should be rejected
    payload = {
        "category": "harassment",
        "description": "TEST_pytest far",
        "lat": 13.0418,
        "lng": 80.2337,
        "reporter_lat": 13.10,
        "reporter_lng": 80.30,
    }
    r = api_client.post(f"{base_url}/api/incidents", json=payload, timeout=20)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


def test_create_incident_outside_chennai(api_client, base_url):
    payload = {
        "category": "harassment",
        "description": "TEST_pytest outside",
        "lat": 19.076,  # Mumbai
        "lng": 72.877,
        "reporter_lat": 19.076,
        "reporter_lng": 72.877,
    }
    r = api_client.post(f"{base_url}/api/incidents", json=payload, timeout=20)
    assert r.status_code == 400


def test_confirm_incident_promotes_to_verified(api_client, base_url):
    # Create a new incident with unique coords, then confirm 3 times
    # Use unique location per run to avoid rate-limit collision
    epsilon = (time.time() % 100) * 1e-5
    lat = 13.0620 + epsilon
    lng = 80.2500 + epsilon
    payload = {
        "category": "poor_lighting",
        "description": "TEST_pytest confirm-flow",
        "lat": lat,
        "lng": lng,
        "reporter_lat": lat,
        "reporter_lng": lng,
    }
    r = api_client.post(f"{base_url}/api/incidents", json=payload, timeout=20)
    if r.status_code == 429:
        pytest.skip("Rate limited")
    assert r.status_code == 200, r.text
    inc_id = r.json()["id"]

    for i in range(3):
        c = api_client.post(f"{base_url}/api/incidents/{inc_id}/confirm", timeout=15)
        assert c.status_code == 200, c.text
        data = c.json()
        assert data["verified"] == i + 1
    # After 3 confirmations, should be verified
    assert data["status"] == "verified"


# ---------- Journeys ----------
@pytest.fixture(scope="module")
def created_journey():
    """Create a journey and return its data."""
    base = _get_base()
    payload = {
        "route_geometry": [[80.2337, 13.0418], [80.25, 13.06], [80.2707, 13.0827]],
        "destination": EGMORE,
        "destination_label": "Egmore",
        "estimated_duration_sec": 900,
        "estimated_distance_m": 5000,
        "safety_score": 78,
    }
    r = requests.post(f"{base}/api/journeys", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def _get_base():
    import os
    b = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
    if b:
        return b
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("no base url")


def test_journey_create_returns_token(created_journey):
    assert "share_token" in created_journey
    assert "expires_at" in created_journey
    assert len(created_journey["share_token"]) > 5


def test_journey_get_full_state(api_client, base_url, created_journey):
    token = created_journey["share_token"]
    r = api_client.get(f"{base_url}/api/journeys/{token}", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "active"
    assert data["destination_label"] == "Egmore"
    assert data["safety_score"] == 78
    assert isinstance(data["route_geometry"], list) and len(data["route_geometry"]) >= 2


def test_journey_ping_updates_location(api_client, base_url, created_journey):
    token = created_journey["share_token"]
    r = api_client.post(f"{base_url}/api/journeys/{token}/ping",
                        json={"lat": 13.05, "lng": 80.25, "speed": 1.2, "heading": 90},
                        timeout=15)
    assert r.status_code == 200
    # Verify persisted
    g = api_client.get(f"{base_url}/api/journeys/{token}", timeout=15)
    cur = g.json()["current_location"]
    assert cur is not None
    assert cur["lat"] == 13.05
    assert cur["lng"] == 80.25


def test_journey_sos_sets_active(api_client, base_url, created_journey):
    token = created_journey["share_token"]
    r = api_client.post(f"{base_url}/api/journeys/{token}/sos",
                        json={"lat": 13.05, "lng": 80.25, "message": "TEST_pytest sos"},
                        timeout=15)
    assert r.status_code == 200
    g = api_client.get(f"{base_url}/api/journeys/{token}", timeout=15)
    data = g.json()
    assert data["sos_active"] is True


def test_journey_complete_deletes_gps(api_client, base_url, created_journey):
    token = created_journey["share_token"]
    r = api_client.post(f"{base_url}/api/journeys/{token}/complete", timeout=15)
    assert r.status_code == 200
    g = api_client.get(f"{base_url}/api/journeys/{token}", timeout=15)
    data = g.json()
    assert data["status"] == "completed"
    # After completion, current_location and route_geometry should be gone from response
    # The GET returns short-form for completed
    assert "route_geometry" not in data or not data.get("route_geometry")


# ---------- Dashboard stats ----------
def test_dashboard_stats(api_client, base_url):
    r = api_client.get(f"{base_url}/api/dashboard/stats", timeout=15)
    assert r.status_code == 200
    data = r.json()
    for key in ["verified_incidents", "safe_places_mapped", "police_stations", "hospitals", "metro_stations", "data_sources"]:
        assert key in data
    assert isinstance(data["data_sources"], list) and len(data["data_sources"]) >= 1
    assert data["safe_places_mapped"] > 0


# ---------- WebSocket ----------
def test_ws_journey_receives_location():
    base = _get_base()
    # Create a fresh journey
    payload = {
        "route_geometry": [[80.2337, 13.0418], [80.2707, 13.0827]],
        "destination": EGMORE,
        "destination_label": "Egmore",
        "estimated_duration_sec": 600,
        "estimated_distance_m": 3000,
        "safety_score": 75,
    }
    j = requests.post(f"{base}/api/journeys", json=payload, timeout=20).json()
    token = j["share_token"]

    ws_url = base.replace("https://", "wss://").replace("http://", "ws://") + f"/api/ws/journeys/{token}"
    received = []
    err_holder = {}

    def _on_message(ws, message):
        try:
            received.append(json.loads(message))
        except Exception:
            received.append({"raw": message})
        if len(received) >= 1:
            ws.close()

    def _on_error(ws, error):
        err_holder["err"] = str(error)

    ws = websocket.WebSocketApp(ws_url, on_message=_on_message, on_error=_on_error)
    t = threading.Thread(target=ws.run_forever, daemon=True)
    t.start()
    time.sleep(2.0)
    # Send a ping via REST -> should broadcast via ws
    requests.post(f"{base}/api/journeys/{token}/ping",
                  json={"lat": 13.05, "lng": 80.25}, timeout=15)
    # Wait up to 8 seconds for message
    deadline = time.time() + 8
    while time.time() < deadline and not received:
        time.sleep(0.3)
    try:
        ws.close()
    except Exception:
        pass
    assert received, f"WebSocket got no messages. err={err_holder}"
    # first message should have type=location
    types = {m.get("type") for m in received}
    assert "location" in types, f"types={types}"
