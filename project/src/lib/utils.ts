import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Coordinates } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}min`;
}

export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // Earth's radius in meters
  const lat1 = (coord1.lat * Math.PI) / 180;
  const lat2 = (coord2.lat * Math.PI) / 180;
  const deltaLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const deltaLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function getSafetyColor(score: number): string {
  if (score >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-500';
  if (score >= 75) return 'text-green-600 bg-green-50 border-green-500';
  if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-500';
  if (score >= 40) return 'text-orange-600 bg-orange-50 border-orange-500';
  return 'text-red-600 bg-red-50 border-red-500';
}

export function getSafetyLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Low';
  return 'High Risk';
}

export function getSafetyStars(score: number): string {
  if (score >= 90) return '★★★★★';
  if (score >= 75) return '★★★★☆';
  if (score >= 60) return '★★★☆☆';
  if (score >= 40) return '★★☆☆☆';
  return '★☆☆☆☆';
}

export function generateRouteColor(index: number): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
  ];
  return colors[index % colors.length];
}

export function decodePolyline(encoded: string): Coordinates[] {
  const coordinates: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return coordinates;
}

export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function getIncidentCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    harassment: 'Harassment',
    poor_lighting: 'Poor Lighting',
    suspicious_activity: 'Suspicious Activity',
    unsafe_area: 'Unsafe Area',
    road_obstruction: 'Road Obstruction',
    broken_streetlight: 'Broken Streetlight',
    public_disturbance: 'Public Disturbance',
    other: 'Other',
  };
  return labels[category] || category;
}

export function getPlaceCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    police_station: 'Police Station',
    womens_police_station: "Women's Police Station",
    hospital: 'Hospital',
    government_hospital: 'Government Hospital',
    pharmacy: 'Pharmacy',
    metro_station: 'Metro Station',
    bus_stop: 'Bus Stop',
    railway_station: 'Railway Station',
    petrol_bunk: 'Petrol Bunk',
    government_office: 'Government Office',
    hotel: 'Hotel',
    restaurant: 'Restaurant',
    bank: 'Bank',
    shopping_mall: 'Shopping Mall',
    public_facility: 'Public Facility',
  };
  return labels[category] || category;
}

export function getPlaceIcon(category: string): string {
  const icons: Record<string, string> = {
    police_station: 'shield',
    womens_police_station: 'shield-check',
    hospital: 'hospital',
    government_hospital: 'building-2',
    pharmacy: 'pill',
    metro_station: 'train-front',
    bus_stop: 'bus',
    railway_station: 'train-track',
    petrol_bunk: 'fuel',
    government_office: 'building',
    hotel: 'hotel',
    restaurant: 'utensils',
    bank: 'landmark',
    shopping_mall: 'shopping-bag',
    public_facility: 'building-2',
  };
  return icons[category] || 'map-pin';
}
