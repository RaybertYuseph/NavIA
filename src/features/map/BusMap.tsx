'use client';
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapBus = { id: string; lat: number; lng: number; label: string; stale?: boolean };
export type MapStop = { id: string; lat: number; lng: number; name: string; done?: boolean };

/**
 * Mapa con OpenStreetMap (sin API key). Leaflet se carga solo en el navegador y solo en las
 * pantallas que muestran mapa, para no pesar en la primera carga.
 */
export function BusMap({ buses, stops = [], className = 'h-64' }: { buses: MapBus[]; stops?: MapStop[]; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !el.current || map.current) return;
      map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([10.47, -66.65], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap',
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      draw(L);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      fitted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el mapa se crea una vez; draw() se llama abajo
  }, []);

  useEffect(() => {
    void import('leaflet').then((L) => draw(L));
  });

  function draw(L: typeof import('leaflet')) {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    for (const s of stops) {
      L.circleMarker([s.lat, s.lng], {
        radius: 5,
        color: s.done ? '#059669' : '#64748b',
        fillColor: s.done ? '#059669' : '#ffffff',
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(s.name)
        .addTo(layer.current);
    }
    if (stops.length > 1) {
      L.polyline(
        stops.map((s) => [s.lat, s.lng] as [number, number]),
        { color: '#0284c7', weight: 3, opacity: 0.5, dashArray: '6 6' },
      ).addTo(layer.current);
    }
    for (const b of buses) {
      L.marker([b.lat, b.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
            <div style="background:${b.stale ? '#94a3b8' : '#0ea5e9'};color:#fff;border-radius:9999px;padding:2px 8px;font:600 12px system-ui;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.3)">🚌 ${escapeHtml(b.label)}</div>
            <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${b.stale ? '#94a3b8' : '#0ea5e9'}"></div>
          </div>`,
        }),
      }).addTo(layer.current);
    }
    const points = [...buses, ...stops].map((p) => [p.lat, p.lng] as [number, number]);
    if (points.length && !fitted.current) {
      map.current.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 15 });
      fitted.current = true;
    }
  }

  return <div ref={el} className={`${className} z-0 w-full overflow-hidden rounded-3xl bg-slate-200`} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
