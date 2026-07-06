import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MarkerSpec {
  id: string; lat: number; lng: number; color?: string; icon?: string;
  label?: string; onClick?: () => void;
}
interface RouteSpec {
  id: string | number; coords: number[][]; color: string; weight?: number; opacity?: number; dashArray?: string; onClick?: () => void;
}

interface Props {
  center: [number, number];
  zoom?: number;
  markers?: MarkerSpec[];
  routes?: RouteSpec[];
  userLocation?: { lat: number; lng: number } | null;
  fitBounds?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

export default function MapView({ center, zoom = 13, markers = [], routes = [], userLocation, fitBounds, onMapClick, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const clickHandlerRef = useRef(onMapClick);

  useEffect(() => { clickHandlerRef.current = onMapClick; }, [onMapClick]);

  // Init once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (clickHandlerRef.current) clickHandlerRef.current(e.latlng.lat, e.latlng.lng);
    });
    mapRef.current = map;
    // Fix leaflet default icon
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line

  // Update markers
  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markers.forEach(m => {
      const color = m.color || '#0D9488';
      const html = `<div class="sr-marker" style="width:32px;height:32px;background:${color};">
        <div style="font-size:14px;">${m.icon || '📍'}</div>
      </div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });
      const mk = L.marker([m.lat, m.lng], { icon }).addTo(layer);
      if (m.label) mk.bindPopup(`<div style="font-family:Inter,sans-serif"><strong>${m.label}</strong></div>`);
      if (m.onClick) mk.on('click', () => m.onClick && m.onClick());
    });
  }, [markers]);

  // Update routes
  useEffect(() => {
    const layer = routeLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    routes.forEach(r => {
      const latlngs = r.coords.map(c => [c[1], c[0]] as [number, number]);
      const pl = L.polyline(latlngs, {
        color: r.color,
        weight: r.weight ?? 6,
        opacity: r.opacity ?? 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: r.dashArray,
      }).addTo(layer);
      if (r.onClick) pl.on('click', () => r.onClick && r.onClick());
    });
    if (fitBounds && routes.length > 0) {
      const all: L.LatLngExpression[] = [];
      routes.forEach(r => r.coords.forEach(c => all.push([c[1], c[0]])));
      if (all.length > 0) {
        try { map.fitBounds(L.latLngBounds(all as any), { padding: [80, 80] }); } catch {}
      }
    }
  }, [routes, fitBounds]);

  // User location
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userMarkerRef.current) { map.removeLayer(userMarkerRef.current); userMarkerRef.current = null; }
    if (userLocation) {
      const icon = L.divIcon({
        html: `<div style="width:20px;height:20px;background:#0EA5E9;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(14,165,233,0.25);"></div>`,
        className: '', iconSize: [20, 20], iconAnchor: [10, 10]
      });
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon }).addTo(map);
    }
  }, [userLocation]);

  return <div ref={ref} className={className || 'w-full h-full'} data-testid="map-view" />;
}
