import { useEffect, useRef, useState } from 'react';

// Leaflet se carga dinámicamente via CDN, no se incluye en package.json
type LeafletGlobal = {
  map: (el: HTMLElement) => LeafletMapInstance;
  tileLayer: (url: string, opts: Record<string, unknown>) => { addTo: (m: LeafletMapInstance) => unknown };
  marker: (latlng: [number, number], opts?: { draggable?: boolean }) => LeafletMarkerInstance;
  circleMarker: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletLayerInstance;
};
type LeafletMapInstance = {
  setView: (latlng: [number, number], zoom: number) => LeafletMapInstance;
  remove: () => void;
  removeLayer: (layer: LeafletLayerInstance) => void;
  on: (evt: string, cb: (e: { latlng: { lat: number; lng: number } }) => void) => void;
};
type LeafletLayerInstance = {
  addTo: (m: LeafletMapInstance) => LeafletLayerInstance;
  bindPopup: (html: string) => LeafletLayerInstance;
};
type LeafletMarkerInstance = {
  addTo: (m: LeafletMapInstance) => LeafletMarkerInstance;
  bindPopup: (html: string) => LeafletMarkerInstance;
  setLatLng: (latlng: [number, number] | { lat: number; lng: number }) => LeafletMarkerInstance;
  getLatLng: () => { lat: number; lng: number };
  on: (evt: string, cb: () => void) => void;
};

declare global {
  interface Window {
    L: LeafletGlobal | undefined;
  }
}

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

let leafletLoading: Promise<void> | null = null;

function cargarLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
    }
    if (document.querySelector(`script[src="${LEAFLET_JS}"]`)) {
      const wait = () => (window.L ? resolve() : setTimeout(wait, 50));
      wait();
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Leaflet'));
    document.head.appendChild(script);
  });
  return leafletLoading;
}

export interface LugarMapa {
  lat: number;
  lon: number;
  nombre: string;
}

interface Props {
  lat: number;
  lon: number;
  zoom?: number;
  onMover?: (coords: { lat: number; lon: number }) => void;
  alto?: number;
  pois?: LugarMapa[];
}

export function MapaInteractivo({ lat, lon, zoom = 16, onMover, alto = 280, pois }: Props) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<LeafletMapInstance | null>(null);
  const markerRef = useRef<LeafletMarkerInstance | null>(null);
  const poiLayersRef = useRef<LeafletLayerInstance[]>([]);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    cargarLeaflet().then(() => setListo(true)).catch(() => setListo(false));
  }, []);

  // Inicializa mapa
  useEffect(() => {
    if (!listo || !contenedorRef.current) return;
    if (mapaRef.current) return;
    const L = window.L;
    if (!L) return;
    const mapa = L.map(contenedorRef.current).setView([lat, lon], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapa);
    const marker = L.marker([lat, lon], { draggable: !!onMover }).addTo(mapa);
    markerRef.current = marker;
    mapaRef.current = mapa;
    if (onMover) {
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        onMover({ lat: ll.lat, lon: ll.lng });
      });
      mapa.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        onMover({ lat: e.latlng.lat, lon: e.latlng.lng });
      });
    }
    return () => {
      mapa.remove();
      mapaRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);

  // Actualiza posición cuando cambia lat/lon desde fuera (ej. al escribir dirección)
  useEffect(() => {
    if (!mapaRef.current || !markerRef.current) return;
    const ll = markerRef.current.getLatLng();
    if (Math.abs(ll.lat - lat) < 1e-6 && Math.abs(ll.lng - lon) < 1e-6) return;
    markerRef.current.setLatLng([lat, lon]);
    mapaRef.current.setView([lat, lon], zoom);
  }, [lat, lon, zoom]);

  // Pinta los lugares (POIs) como puntos dorados con popup del nombre
  useEffect(() => {
    const mapa = mapaRef.current;
    const L = window.L;
    if (!listo || !mapa || !L) return;
    // Limpia los marcadores de lugares anteriores
    for (const capa of poiLayersRef.current) {
      mapa.removeLayer(capa);
    }
    poiLayersRef.current = [];
    for (const p of pois || []) {
      if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
      const c = L.circleMarker([p.lat, p.lon], {
        radius: 7,
        color: '#b8901f',
        weight: 2,
        fillColor: '#D4AF37',
        fillOpacity: 0.85,
      })
        .bindPopup(`<strong>${p.nombre}</strong>`)
        .addTo(mapa);
      poiLayersRef.current.push(c);
    }
  }, [pois, listo]);

  return (
    <div className="mapa-interactivo-wrap">
      <div
        ref={contenedorRef}
        className="mapa-interactivo"
        style={{ height: alto, width: '100%', borderRadius: 8, overflow: 'hidden' }}
      />
      {onMover ? (
        <div className="mapa-interactivo-tip">
          👆 Click o arrastra el marcador en el mapa para usar esa ubicación
        </div>
      ) : null}
    </div>
  );
}
