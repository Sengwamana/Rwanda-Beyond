import React, { useEffect, useMemo, useRef } from 'react';
import { MapPin } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import env from '../../config/env';
import { cn } from '../../utils/cn';

const RWANDA_CENTER = { lat: -1.9403, lng: 29.8739 };

export type MapboxMarkerTone = 'default' | 'danger' | 'warning' | 'success' | 'info';

export interface MapboxMarkerData {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  description?: string;
  badge?: string;
  tone?: MapboxMarkerTone;
}

interface MapboxMapProps {
  markers?: MapboxMarkerData[];
  className?: string;
  mapClassName?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  fitToMarkers?: boolean;
  selectedMarkerId?: string | null;
  onSelectMarker?: (markerId: string) => void;
  onCoordinateSelect?: (coords: { lat: number; lng: number }) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  tokenMissingTitle?: string;
  tokenMissingMessage?: string;
}

const toneStyles: Record<MapboxMarkerTone, { fill: string; glow: string }> = {
  default: { fill: '#0f766e', glow: 'rgba(15, 118, 110, 0.22)' },
  danger: { fill: '#dc2626', glow: 'rgba(220, 38, 38, 0.24)' },
  warning: { fill: '#d97706', glow: 'rgba(217, 119, 6, 0.24)' },
  success: { fill: '#059669', glow: 'rgba(5, 150, 105, 0.24)' },
  info: { fill: '#2563eb', glow: 'rgba(37, 99, 235, 0.24)' },
};

function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function createPopupContent(marker: MapboxMarkerData) {
  const wrapper = document.createElement('div');
  wrapper.style.minWidth = '180px';
  wrapper.style.color = '#0f172a';

  const title = document.createElement('p');
  title.textContent = marker.label;
  title.style.margin = '0';
  title.style.fontSize = '14px';
  title.style.fontWeight = '700';
  wrapper.appendChild(title);

  if (marker.badge) {
    const badge = document.createElement('p');
    badge.textContent = marker.badge;
    badge.style.margin = '6px 0 0';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = '600';
    badge.style.color = '#047857';
    wrapper.appendChild(badge);
  }

  if (marker.description) {
    const description = document.createElement('p');
    description.textContent = marker.description;
    description.style.margin = '8px 0 0';
    description.style.fontSize = '12px';
    description.style.lineHeight = '1.4';
    description.style.color = '#475569';
    wrapper.appendChild(description);
  }

  const coordinates = document.createElement('p');
  coordinates.textContent = `${marker.latitude.toFixed(4)}, ${marker.longitude.toFixed(4)}`;
  coordinates.style.margin = '8px 0 0';
  coordinates.style.fontSize = '11px';
  coordinates.style.color = '#64748b';
  wrapper.appendChild(coordinates);

  return wrapper;
}

function createMarkerElement(marker: MapboxMarkerData, selected: boolean) {
  const element = document.createElement('button');
  element.type = 'button';
  element.setAttribute('aria-label', marker.label);
  element.style.width = selected ? '22px' : '18px';
  element.style.height = selected ? '22px' : '18px';
  element.style.borderRadius = '999px';
  element.style.border = '2px solid white';
  element.style.cursor = 'pointer';
  element.style.boxShadow = `0 0 0 ${selected ? '8px' : '5px'} ${toneStyles[marker.tone || 'default'].glow}`;
  element.style.background = toneStyles[marker.tone || 'default'].fill;
  element.style.transition = 'transform 150ms ease, box-shadow 150ms ease';
  element.style.transform = selected ? 'scale(1.1)' : 'scale(1)';
  return element;
}

export function MapboxMap({
  markers = [],
  className,
  mapClassName,
  center,
  zoom = 6.6,
  fitToMarkers = true,
  selectedMarkerId,
  onSelectMarker,
  onCoordinateSelect,
  emptyTitle = 'No map points available',
  emptyMessage = 'No records with valid coordinates are available for this map yet.',
  tokenMissingTitle = 'Mapbox token missing',
  tokenMissingMessage = 'Add VITE_MAPBOX_ACCESS_TOKEN to enable the live map in this workspace.',
}: MapboxMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const coordinateSelectRef = useRef(onCoordinateSelect);

  const validMarkers = useMemo(
    () => markers.filter((marker) => isValidCoordinate(marker.latitude, marker.longitude)),
    [markers]
  );
  const initialCenter = center || (
    validMarkers[0]
      ? { lat: validMarkers[0].latitude, lng: validMarkers[0].longitude }
      : RWANDA_CENTER
  );
  const hasToken = Boolean(env.mapboxAccessToken);

  useEffect(() => {
    coordinateSelectRef.current = onCoordinateSelect;
  }, [onCoordinateSelect]);

  useEffect(() => {
    if (!hasToken || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = env.mapboxAccessToken as string;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [initialCenter.lng, initialCenter.lat],
      zoom,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    if (coordinateSelectRef.current) {
      map.getCanvas().style.cursor = 'crosshair';
      map.on('click', (event) => {
        coordinateSelectRef.current?.({
          lat: Number(event.lngLat.lat.toFixed(6)),
          lng: Number(event.lngLat.lng.toFixed(6)),
        });
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [hasToken, initialCenter.lat, initialCenter.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = onCoordinateSelect ? 'crosshair' : '';
  }, [onCoordinateSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    validMarkers.forEach((marker) => {
      const element = createMarkerElement(marker, marker.id === selectedMarkerId);
      const popup = new mapboxgl.Popup({ offset: 14 }).setDOMContent(createPopupContent(marker));

      element.addEventListener('click', () => {
        onSelectMarker?.(marker.id);
      });

      const mapMarker = new mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(mapMarker);
    });

    if (!fitToMarkers) return;

    if (validMarkers.length === 1) {
      map.easeTo({
        center: [validMarkers[0].longitude, validMarkers[0].latitude],
        zoom: Math.max(zoom, 11.5),
        duration: 600,
      });
      return;
    }

    if (validMarkers.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      validMarkers.forEach((marker) => {
        bounds.extend([marker.longitude, marker.latitude]);
      });
      map.fitBounds(bounds, {
        padding: 52,
        maxZoom: 11.8,
        duration: 600,
      });
    }
  }, [fitToMarkers, onSelectMarker, selectedMarkerId, validMarkers, zoom]);

  if (!hasToken) {
    return (
      <div className={cn('dash-dashed-block space-y-3 rounded-[24px] p-5', className)}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900/70 dark:text-slate-300">
            <MapPin size={18} />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">{tokenMissingTitle}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{tokenMissingMessage}</p>
          </div>
        </div>
        {validMarkers.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {validMarkers.slice(0, 4).map((marker) => (
              <div key={marker.id} className="dash-outline-block">
                <p className="font-medium">{marker.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {marker.latitude.toFixed(4)}, {marker.longitude.toFixed(4)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (validMarkers.length === 0 && !onCoordinateSelect) {
    return (
      <div className={cn('dash-dashed-block rounded-[24px] p-6 text-center', className)}>
        <p className="font-semibold text-slate-900 dark:text-white">{emptyTitle}</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-[24px] border border-[hsl(var(--border))] bg-white/95 shadow-[0_28px_60px_rgba(15,23,42,0.08)] dark:bg-slate-950/95', className)}>
      <div
        ref={mapContainerRef}
        className={cn('h-[340px] w-full', mapClassName)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--border))] bg-slate-50/80 px-4 py-3 text-xs text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
        <span>
          {onCoordinateSelect
            ? 'Click anywhere on the map to place or update coordinates.'
            : `${validMarkers.length} mapped point${validMarkers.length === 1 ? '' : 's'} in the current view.`}
        </span>
        <span>Map style: Mapbox Light</span>
      </div>
    </div>
  );
}

export default MapboxMap;
