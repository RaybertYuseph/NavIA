'use client';
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapBus = { id: string; lat: number; lng: number; label: string; stale?: boolean };
export type MapStop = { id: string; lat: number; lng: number; name: string; seq?: number; done?: boolean };

/**
 * Mapa con el estilo de NavIA, sin API key: teselas claras de Esri (con OpenStreetMap de respaldo) con
 * un tinte de la marca, la ruta como línea continua, paradas numeradas y cada unidad como una
 * pastilla con su placa y la gota. Leaflet se carga solo en el navegador y solo en las pantallas
 * que muestran mapa, para no pesar en la primera carga.
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
      map.current = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([10.47, -66.65], 11);
      L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map.current);
      map.current.attributionControl.setPrefix(false);
      // CARTO pasó a pedir API key ("API key required" en las teselas). Esri Light Gray no la pide;
      // si sus teselas fallan varias veces, se cambia a las de OpenStreetMap.
      const esri = (name: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${name}/MapServer/tile/{z}/{y}/{x}`;
      const base = L.tileLayer(esri('World_Light_Gray_Base'), { maxNativeZoom: 16, maxZoom: 19, attribution: 'Teselas © Esri · datos © OpenStreetMap y otros' });
      const labels = L.tileLayer(esri('World_Light_Gray_Reference'), { maxNativeZoom: 16, maxZoom: 19 });
      let failures = 0;
      base.on('tileerror', () => {
        if (++failures !== 4 || !map.current) return;
        map.current.removeLayer(base).removeLayer(labels);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map.current);
      });
      base.addTo(map.current);
      labels.addTo(map.current);
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
    if (stops.length > 1) {
      const line = stops.map((s) => [s.lat, s.lng] as [number, number]);
      L.polyline(line, { color: '#ffffff', weight: 9, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(layer.current);
      L.polyline(line, { color: '#0ea5e9', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(layer.current);
    }
    stops.forEach((s, i) => {
      L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          className: '',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          html: `<div class="navia-stop${s.done ? ' is-done' : ''}">${s.done ? '✓' : (s.seq ?? i + 1)}</div>`,
        }),
        keyboard: false,
      })
        .bindTooltip(escapeHtml(s.name), { direction: 'top', offset: [0, -12], className: 'navia-tip' })
        .addTo(layer.current!);
    });
    for (const b of buses) {
      L.marker([b.lat, b.lng], {
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: '',
          iconSize: [0, 0],
          html: `<div class="navia-bus${b.stale ? ' is-stale' : ''}"><img src="/brand/gota/navia.webp" alt="" /><span>${escapeHtml(b.label)}</span></div>`,
        }),
      }).addTo(layer.current);
    }
    const points = [...buses, ...stops].map((p) => [p.lat, p.lng] as [number, number]);
    if (points.length && !fitted.current) {
      map.current.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 15 });
      fitted.current = true;
    }
  }

  return <div ref={el} className={`navia-map ${className} z-0 w-full overflow-hidden rounded-3xl bg-sky-50 ring-1 ring-slate-200/70`} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
