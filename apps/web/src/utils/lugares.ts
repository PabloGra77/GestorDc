// Búsqueda de lugares cercanos (tiendas, hoteles, etc.) usando Overpass API de
// OpenStreetMap. Es gratuita y no requiere llave. Devuelve puntos con nombre.

import type { LugarMapa } from '../components/MapaInteractivo';

export type CategoriaLugar = 'tienda' | 'hotel' | 'restaurante' | 'banco' | 'salud' | 'transporte';

export const CATEGORIAS_LUGAR: Array<{ id: CategoriaLugar; label: string; emoji: string }> = [
  { id: 'tienda', label: 'Tiendas', emoji: '🛍️' },
  { id: 'hotel', label: 'Hoteles', emoji: '🏨' },
  { id: 'restaurante', label: 'Restaurantes', emoji: '🍽️' },
  { id: 'banco', label: 'Bancos', emoji: '🏦' },
  { id: 'salud', label: 'Salud', emoji: '🏥' },
  { id: 'transporte', label: 'Transporte', emoji: '🚉' },
];

const FILTROS: Record<CategoriaLugar, string> = {
  tienda: 'node["shop"](around:RADIO,LAT,LON);',
  hotel: 'node["tourism"~"hotel|hostel|guest_house|motel|apartment"](around:RADIO,LAT,LON);',
  restaurante: 'node["amenity"~"restaurant|cafe|fast_food|bar"](around:RADIO,LAT,LON);',
  banco: 'node["amenity"~"bank|atm|bureau_de_change"](around:RADIO,LAT,LON);',
  salud: 'node["amenity"~"hospital|clinic|pharmacy|doctors"](around:RADIO,LAT,LON);node["healthcare"](around:RADIO,LAT,LON);',
  transporte: 'node["aeroway"="aerodrome"](around:RADIO_GRANDE,LAT,LON);node["public_transport"="station"](around:RADIO,LAT,LON);node["amenity"~"bus_station|taxi"](around:RADIO,LAT,LON);',
};

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Busca hasta 40 lugares con nombre cerca de una coordenada.
 * radio en metros (por defecto 1500 m).
 */
export async function buscarLugares(
  lat: number,
  lon: number,
  categoria: CategoriaLugar,
  radio = 1500,
): Promise<LugarMapa[]> {
  const cuerpo = FILTROS[categoria]
    .replace(/RADIO_GRANDE/g, String(radio * 6))
    .replace(/RADIO/g, String(radio))
    .replace(/LAT/g, String(lat))
    .replace(/LON/g, String(lon));
  const query = `[out:json][timeout:20];(${cuerpo});out center 60;`;

  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { elements?: OverpassElement[] };
    const vistos = new Set<string>();
    const lugares: LugarMapa[] = [];
    for (const e of j.elements || []) {
      const plat = e.lat ?? e.center?.lat;
      const plon = e.lon ?? e.center?.lon;
      const nombre = e.tags?.name;
      if (typeof plat !== 'number' || typeof plon !== 'number' || !nombre) continue;
      if (vistos.has(nombre)) continue;
      vistos.add(nombre);
      lugares.push({ lat: plat, lon: plon, nombre });
      if (lugares.length >= 40) break;
    }
    return lugares;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Enlaces de viaje (vuelos, hoteles, transporte, mapa).
// No usamos APIs de pago (Amadeus/Skyscanner requieren llave + backend). En su
// lugar generamos enlaces directos a buscadores que ya ordenan por "más barato",
// con origen/destino prellenados. Abren en una pestaña nueva.
// ---------------------------------------------------------------------------

export interface EnlaceViaje {
  id: string;
  label: string;
  emoji: string;
  url: string;
}

interface OpcionesViaje {
  destinoCiudad?: string;
  destinoPais?: string;
  origenCiudad?: string;
  origenPais?: string;
}

export function enlacesViaje(opts: OpcionesViaje): EnlaceViaje[] {
  const enc = encodeURIComponent;
  const dest = [opts.destinoCiudad, opts.destinoPais].map((s) => (s || '').trim()).filter(Boolean).join(', ');
  const origen = [opts.origenCiudad, opts.origenPais].map((s) => (s || '').trim()).filter(Boolean).join(', ');
  if (!dest) return [];

  const consultaVuelo = origen
    ? `vuelos baratos de ${origen} a ${dest}`
    : `vuelos baratos a ${dest}`;

  return [
    {
      id: 'vuelos',
      label: 'Vuelos (más baratos)',
      emoji: '✈️',
      url: `https://www.google.com/travel/flights?q=${enc(consultaVuelo)}`,
    },
    {
      id: 'hoteles',
      label: 'Hoteles',
      emoji: '🏨',
      url: `https://www.booking.com/searchresults.html?ss=${enc(dest)}`,
    },
    {
      id: 'hospedaje',
      label: 'Hospedaje / apartamentos',
      emoji: '🛏️',
      url: `https://www.google.com/search?q=${enc(`hospedaje barato en ${dest}`)}`,
    },
    {
      id: 'transporte',
      label: origen ? 'Bus / transporte terrestre' : 'Cómo llegar',
      emoji: '🚌',
      url: origen
        ? `https://www.google.com/search?q=${enc(`pasajes de bus de ${origen} a ${dest} precio`)}`
        : `https://www.google.com/maps/search/${enc(`terminal de transporte ${dest}`)}`,
    },
    {
      id: 'ruta',
      label: 'Ruta en mapa',
      emoji: '🗺️',
      url: origen
        ? `https://www.google.com/maps/dir/${enc(origen)}/${enc(dest)}`
        : `https://www.google.com/maps/search/${enc(dest)}`,
    },
  ];
}
