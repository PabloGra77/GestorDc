export type ZonaClimatica = 'caribe' | 'andina' | 'pacifico' | 'amazonia' | 'orinoquia' | 'insular';

export interface CiudadCO {
  nombre: string;
  lat: number;
  lng: number;
  iata?: string;
  aeropuerto?: string;
  terminal?: string;
  zona: ZonaClimatica;
}

export interface DeptoCO {
  id: string;
  nombre: string;
  ciudades: CiudadCO[];
}

export const DEPTOS: DeptoCO[] = [
  { id: 'ANT', nombre: 'Antioquia', ciudades: [
    { nombre: 'Medellín',        lat: 6.244,  lng: -75.579, iata: 'MDE', aeropuerto: 'José María Córdova', terminal: 'Terminal Norte / Sur', zona: 'andina' },
    { nombre: 'Bello',           lat: 6.340,  lng: -75.555, zona: 'andina', terminal: 'Terminal Bello' },
    { nombre: 'Itagüí',         lat: 6.184,  lng: -75.600, zona: 'andina' },
    { nombre: 'Envigado',        lat: 6.169,  lng: -75.590, zona: 'andina' },
    { nombre: 'Rionegro',        lat: 6.152,  lng: -75.372, iata: 'MDE', aeropuerto: 'José María Córdova', zona: 'andina' },
    { nombre: 'Apartadó',        lat: 7.881,  lng: -76.626, iata: 'APO', aeropuerto: 'Carepa', zona: 'caribe' },
    { nombre: 'Caucasia',        lat: 7.988,  lng: -75.198, zona: 'caribe', terminal: 'Terminal Caucasia' },
    { nombre: 'Turbo',           lat: 8.100,  lng: -76.731, zona: 'caribe' },
  ]},
  { id: 'ATL', nombre: 'Atlántico', ciudades: [
    { nombre: 'Barranquilla',    lat: 10.963, lng: -74.796, iata: 'BAQ', aeropuerto: 'Ernesto Cortissoz', terminal: 'Terminal de Transportes', zona: 'caribe' },
    { nombre: 'Soledad',         lat: 10.915, lng: -74.767, zona: 'caribe' },
    { nombre: 'Malambo',         lat: 10.869, lng: -74.777, zona: 'caribe' },
  ]},
  { id: 'BOL', nombre: 'Bolívar', ciudades: [
    { nombre: 'Cartagena',       lat: 10.391, lng: -75.479, iata: 'CTG', aeropuerto: 'Rafael Núñez', terminal: 'Terminal de Transportes', zona: 'caribe' },
    { nombre: 'Magangué',        lat: 9.240,  lng: -74.754, iata: 'MGN', aeropuerto: 'Baracoa', zona: 'caribe', terminal: 'Terminal Magangué' },
    { nombre: 'El Carmen de Bolívar', lat: 9.718, lng: -75.122, zona: 'caribe', terminal: 'Terminal El Carmen' },
    { nombre: 'Turbaco',         lat: 10.333, lng: -75.418, zona: 'caribe' },
  ]},
  { id: 'BOY', nombre: 'Boyacá', ciudades: [
    { nombre: 'Tunja',           lat: 5.535,  lng: -73.361, iata: 'TUA', aeropuerto: 'Los Pirales', terminal: 'Terminal Tunja', zona: 'andina' },
    { nombre: 'Duitama',         lat: 5.826,  lng: -73.026, terminal: 'Terminal Duitama', zona: 'andina' },
    { nombre: 'Sogamoso',        lat: 5.718,  lng: -72.929, terminal: 'Terminal Sogamoso', zona: 'andina' },
    { nombre: 'Chiquinquirá',    lat: 5.617,  lng: -73.817, terminal: 'Terminal Chiquinquirá', zona: 'andina' },
    { nombre: 'Puerto Boyacá',   lat: 5.976,  lng: -74.589, zona: 'andina' },
  ]},
  { id: 'CAL', nombre: 'Caldas', ciudades: [
    { nombre: 'Manizales',       lat: 5.070,  lng: -75.520, iata: 'MZL', aeropuerto: 'La Nubia', terminal: 'Terminal de Transportes', zona: 'andina' },
    { nombre: 'La Dorada',       lat: 5.455,  lng: -74.665, terminal: 'Terminal La Dorada', zona: 'andina' },
    { nombre: 'Chinchiná',       lat: 4.982,  lng: -75.602, zona: 'andina' },
  ]},
  { id: 'CAQ', nombre: 'Caquetá', ciudades: [
    { nombre: 'Florencia',       lat: 1.614,  lng: -75.617, iata: 'FLA', aeropuerto: 'Gustavo Artunduaga', terminal: 'Terminal Florencia', zona: 'amazonia' },
    { nombre: 'San Vicente del Caguán', lat: 2.114, lng: -74.769, zona: 'amazonia' },
  ]},
  { id: 'CAS', nombre: 'Casanare', ciudades: [
    { nombre: 'Yopal',           lat: 5.338,  lng: -72.395, iata: 'EYP', aeropuerto: 'El Alcaraván', terminal: 'Terminal Yopal', zona: 'orinoquia' },
    { nombre: 'Aguazul',         lat: 5.172,  lng: -72.556, zona: 'orinoquia' },
    { nombre: 'Paz de Ariporo',  lat: 5.883,  lng: -71.900, zona: 'orinoquia' },
  ]},
  { id: 'CAU', nombre: 'Cauca', ciudades: [
    { nombre: 'Popayán',         lat: 2.441,  lng: -76.607, iata: 'PPN', aeropuerto: 'Guillermo León Valencia', terminal: 'Terminal Popayán', zona: 'andina' },
    { nombre: 'Santander de Quilichao', lat: 3.007, lng: -76.484, terminal: 'Terminal Santander de Quilichao', zona: 'andina' },
    { nombre: 'Puerto Tejada',   lat: 3.232,  lng: -76.411, zona: 'andina' },
  ]},
  { id: 'CES', nombre: 'Cesar', ciudades: [
    { nombre: 'Valledupar',      lat: 10.463, lng: -73.253, iata: 'VUP', aeropuerto: 'Alfonso López Pumarejo', terminal: 'Terminal Valledupar', zona: 'caribe' },
    { nombre: 'Aguachica',       lat: 8.308,  lng: -73.620, terminal: 'Terminal Aguachica', zona: 'caribe' },
    { nombre: 'Bosconia',        lat: 9.965,  lng: -73.887, zona: 'caribe' },
    { nombre: 'Pelaya',          lat: 8.692,  lng: -73.662, zona: 'caribe' },
    { nombre: 'La Paz',          lat: 10.381, lng: -73.168, zona: 'caribe' },
    { nombre: 'Codazzi',         lat: 10.017, lng: -73.234, zona: 'caribe' },
  ]},
  { id: 'CHO', nombre: 'Chocó', ciudades: [
    { nombre: 'Quibdó',          lat: 5.692,  lng: -76.657, iata: 'UIB', aeropuerto: 'El Caraño', terminal: 'Terminal Quibdó', zona: 'pacifico' },
    { nombre: 'Bahía Solano',    lat: 6.224,  lng: -77.395, iata: 'BSC', aeropuerto: 'José Celestino Mutis', zona: 'pacifico' },
    { nombre: 'Nuquí',           lat: 5.714,  lng: -77.270, iata: 'NQU', aeropuerto: 'Reyes Murillo', zona: 'pacifico' },
  ]},
  { id: 'COR', nombre: 'Córdoba', ciudades: [
    { nombre: 'Montería',        lat: 8.757,  lng: -75.881, iata: 'MTR', aeropuerto: 'Los Garzones', terminal: 'Terminal Montería', zona: 'caribe' },
    { nombre: 'Lorica',          lat: 9.237,  lng: -75.814, zona: 'caribe', terminal: 'Terminal Lorica' },
    { nombre: 'Montelíbano',     lat: 7.986,  lng: -75.421, iata: 'MTB', aeropuerto: 'Montelíbano', zona: 'caribe' },
    { nombre: 'Sahagún',         lat: 8.951,  lng: -75.446, zona: 'caribe' },
    { nombre: 'Cereté',          lat: 8.881,  lng: -75.792, zona: 'caribe' },
  ]},
  { id: 'CUN', nombre: 'Cundinamarca', ciudades: [
    { nombre: 'Bogotá',          lat: 4.711,  lng: -74.073, iata: 'BOG', aeropuerto: 'El Dorado', terminal: 'Terminal Salitre / Sur', zona: 'andina' },
    { nombre: 'Soacha',          lat: 4.579,  lng: -74.217, zona: 'andina' },
    { nombre: 'Facatativá',      lat: 4.815,  lng: -74.353, terminal: 'Terminal Facatativá', zona: 'andina' },
    { nombre: 'Zipaquirá',       lat: 5.023,  lng: -74.005, terminal: 'Terminal Zipaquirá', zona: 'andina' },
    { nombre: 'Fusagasugá',      lat: 4.337,  lng: -74.363, terminal: 'Terminal Fusagasugá', zona: 'andina' },
    { nombre: 'Girardot',        lat: 4.304,  lng: -74.803, terminal: 'Terminal Girardot', zona: 'andina' },
    { nombre: 'Madrid',          lat: 4.734,  lng: -74.262, zona: 'andina' },
    { nombre: 'Chía',            lat: 4.863,  lng: -73.928, zona: 'andina' },
    { nombre: 'Mosquera',        lat: 4.707,  lng: -74.231, zona: 'andina' },
  ]},
  { id: 'GUA', nombre: 'Guainía', ciudades: [
    { nombre: 'Inírida',         lat: 3.865,  lng: -67.924, iata: 'INI', aeropuerto: 'Cesar Gaviria Trujillo', zona: 'amazonia' },
  ]},
  { id: 'GUV', nombre: 'Guaviare', ciudades: [
    { nombre: 'San José del Guaviare', lat: 2.564, lng: -72.638, iata: 'SJE', aeropuerto: 'Jorge Enrique González Torres', terminal: 'Terminal San José del Guaviare', zona: 'amazonia' },
  ]},
  { id: 'HUI', nombre: 'Huila', ciudades: [
    { nombre: 'Neiva',           lat: 2.933,  lng: -75.298, iata: 'HEI', aeropuerto: 'Benito Salas', terminal: 'Terminal Neiva', zona: 'andina' },
    { nombre: 'Pitalito',        lat: 1.848,  lng: -76.048, iata: 'PTX', aeropuerto: 'Contador', terminal: 'Terminal Pitalito', zona: 'andina' },
    { nombre: 'Garzón',          lat: 2.197,  lng: -75.621, terminal: 'Terminal Garzón', zona: 'andina' },
    { nombre: 'La Plata',        lat: 2.387,  lng: -75.899, zona: 'andina' },
  ]},
  { id: 'LAG', nombre: 'La Guajira', ciudades: [
    { nombre: 'Riohacha',        lat: 11.545, lng: -72.907, iata: 'RCH', aeropuerto: 'Almirante Padilla', terminal: 'Terminal Riohacha', zona: 'caribe' },
    { nombre: 'Maicao',          lat: 11.379, lng: -72.244, terminal: 'Terminal Maicao', zona: 'caribe' },
    { nombre: 'San Juan del Cesar', lat: 10.770, lng: -73.010, zona: 'caribe' },
    { nombre: 'Villanueva',      lat: 10.602, lng: -72.975, zona: 'caribe' },
  ]},
  { id: 'MAG', nombre: 'Magdalena', ciudades: [
    { nombre: 'Santa Marta',     lat: 11.240, lng: -74.210, iata: 'SMR', aeropuerto: 'Simón Bolívar', terminal: 'Terminal Santa Marta', zona: 'caribe' },
    { nombre: 'Ciénaga',         lat: 11.006, lng: -74.252, terminal: 'Terminal Ciénaga', zona: 'caribe' },
    { nombre: 'Fundación',       lat: 10.523, lng: -74.186, terminal: 'Terminal Fundación', zona: 'caribe' },
    { nombre: 'El Banco',        lat: 9.005,  lng: -73.977, iata: 'ELB', aeropuerto: 'Las Flores', zona: 'caribe' },
  ]},
  { id: 'MET', nombre: 'Meta', ciudades: [
    { nombre: 'Villavicencio',   lat: 4.143,  lng: -73.629, iata: 'VVC', aeropuerto: 'La Vanguardia', terminal: 'Terminal Villavicencio', zona: 'orinoquia' },
    { nombre: 'Acacías',         lat: 3.992,  lng: -73.761, terminal: 'Terminal Acacías', zona: 'orinoquia' },
    { nombre: 'Granada',         lat: 3.543,  lng: -73.720, terminal: 'Terminal Granada', zona: 'orinoquia' },
  ]},
  { id: 'NAR', nombre: 'Nariño', ciudades: [
    { nombre: 'Pasto',           lat: 1.213,  lng: -77.281, iata: 'PSO', aeropuerto: 'Antonio Nariño', terminal: 'Terminal Pasto', zona: 'andina' },
    { nombre: 'Tumaco',          lat: 1.800,  lng: -78.812, iata: 'TCO', aeropuerto: 'La Florida', zona: 'pacifico' },
    { nombre: 'Ipiales',         lat: 0.832,  lng: -77.644, terminal: 'Terminal Ipiales', zona: 'andina' },
    { nombre: 'Túquerres',       lat: 1.087,  lng: -77.616, zona: 'andina' },
  ]},
  { id: 'NOR', nombre: 'Norte de Santander', ciudades: [
    { nombre: 'Cúcuta',          lat: 7.894,  lng: -72.511, iata: 'CUC', aeropuerto: 'Camilo Daza', terminal: 'Terminal Cúcuta', zona: 'andina' },
    { nombre: 'Ocaña',           lat: 8.237,  lng: -73.355, terminal: 'Terminal Ocaña', zona: 'andina' },
    { nombre: 'Pamplona',        lat: 7.376,  lng: -72.649, terminal: 'Terminal Pamplona', zona: 'andina' },
    { nombre: 'Villa del Rosario', lat: 7.833, lng: -72.472, zona: 'andina' },
  ]},
  { id: 'PUT', nombre: 'Putumayo', ciudades: [
    { nombre: 'Mocoa',           lat: 1.152,  lng: -76.648, iata: 'MOC', aeropuerto: 'Ciudad de Mocoa', terminal: 'Terminal Mocoa', zona: 'amazonia' },
    { nombre: 'Puerto Asís',     lat: 0.503,  lng: -76.501, iata: 'PUU', aeropuerto: 'Tres de Mayo', zona: 'amazonia' },
    { nombre: 'Villagarzón',     lat: 1.027,  lng: -76.624, zona: 'amazonia' },
  ]},
  { id: 'QUI', nombre: 'Quindío', ciudades: [
    { nombre: 'Armenia',         lat: 4.534,  lng: -75.680, iata: 'AXM', aeropuerto: 'El Edén', terminal: 'Terminal Armenia', zona: 'andina' },
    { nombre: 'Calarcá',         lat: 4.523,  lng: -75.636, terminal: 'Terminal Calarcá', zona: 'andina' },
    { nombre: 'La Tebaida',      lat: 4.457,  lng: -75.802, zona: 'andina' },
  ]},
  { id: 'RIS', nombre: 'Risaralda', ciudades: [
    { nombre: 'Pereira',         lat: 4.814,  lng: -75.696, iata: 'PEI', aeropuerto: 'Matecaña', terminal: 'Terminal Pereira', zona: 'andina' },
    { nombre: 'Dosquebradas',    lat: 4.836,  lng: -75.667, zona: 'andina' },
    { nombre: 'Santa Rosa de Cabal', lat: 4.869, lng: -75.620, terminal: 'Terminal Santa Rosa', zona: 'andina' },
  ]},
  { id: 'SAP', nombre: 'San Andrés y Providencia', ciudades: [
    { nombre: 'San Andrés',      lat: 12.584, lng: -81.706, iata: 'ADZ', aeropuerto: 'Gustavo Rojas Pinilla', zona: 'insular' },
    { nombre: 'Providencia',     lat: 13.349, lng: -81.381, iata: 'PVA', aeropuerto: 'El Embrujo', zona: 'insular' },
  ]},
  { id: 'SAN', nombre: 'Santander', ciudades: [
    { nombre: 'Bucaramanga',     lat: 7.119,  lng: -73.122, iata: 'BGA', aeropuerto: 'Palonegro', terminal: 'Terminal Bucaramanga', zona: 'andina' },
    { nombre: 'Barrancabermeja', lat: 7.065,  lng: -73.854, iata: 'EJA', aeropuerto: 'Yariguíes', terminal: 'Terminal Barrancabermeja', zona: 'andina' },
    { nombre: 'Floridablanca',   lat: 7.064,  lng: -73.086, zona: 'andina' },
    { nombre: 'Girón',           lat: 7.073,  lng: -73.167, zona: 'andina' },
    { nombre: 'Piedecuesta',     lat: 6.994,  lng: -73.053, terminal: 'Terminal Piedecuesta', zona: 'andina' },
    { nombre: 'San Gil',         lat: 6.556,  lng: -73.135, terminal: 'Terminal San Gil', zona: 'andina' },
    { nombre: 'Socorro',         lat: 6.464,  lng: -73.265, terminal: 'Terminal Socorro', zona: 'andina' },
    { nombre: 'Vélez',           lat: 6.014,  lng: -73.682, zona: 'andina' },
  ]},
  { id: 'SUC', nombre: 'Sucre', ciudades: [
    { nombre: 'Sincelejo',       lat: 9.304,  lng: -75.396, iata: 'SIN', aeropuerto: 'Las Brujas', terminal: 'Terminal Sincelejo', zona: 'caribe' },
    { nombre: 'Corozal',         lat: 9.321,  lng: -75.298, terminal: 'Terminal Corozal', zona: 'caribe' },
    { nombre: 'Sampués',         lat: 9.193,  lng: -75.384, zona: 'caribe' },
    { nombre: 'Tolú',            lat: 9.531,  lng: -75.576, zona: 'caribe' },
  ]},
  { id: 'TOL', nombre: 'Tolima', ciudades: [
    { nombre: 'Ibagué',          lat: 4.440,  lng: -75.230, iata: 'IBE', aeropuerto: 'Perales', terminal: 'Terminal Ibagué', zona: 'andina' },
    { nombre: 'Espinal',         lat: 4.151,  lng: -74.882, terminal: 'Terminal Espinal', zona: 'andina' },
    { nombre: 'Honda',           lat: 5.205,  lng: -74.744, terminal: 'Terminal Honda', zona: 'andina' },
    { nombre: 'Melgar',          lat: 4.200,  lng: -74.644, zona: 'andina' },
    { nombre: 'Chaparral',       lat: 3.723,  lng: -75.487, terminal: 'Terminal Chaparral', zona: 'andina' },
  ]},
  { id: 'VAC', nombre: 'Valle del Cauca', ciudades: [
    { nombre: 'Cali',            lat: 3.451,  lng: -76.532, iata: 'CLO', aeropuerto: 'Alfonso Bonilla Aragón', terminal: 'Terminal Cali', zona: 'andina' },
    { nombre: 'Buenaventura',    lat: 3.878,  lng: -76.988, iata: 'BUN', aeropuerto: 'Gerardo Tobar López', terminal: 'Terminal Buenaventura', zona: 'pacifico' },
    { nombre: 'Palmira',         lat: 3.538,  lng: -76.304, terminal: 'Terminal Palmira', zona: 'andina' },
    { nombre: 'Tuluá',           lat: 4.088,  lng: -76.198, terminal: 'Terminal Tuluá', zona: 'andina' },
    { nombre: 'Cartago',         lat: 4.747,  lng: -75.913, terminal: 'Terminal Cartago', zona: 'andina' },
    { nombre: 'Buga',            lat: 3.901,  lng: -76.299, terminal: 'Terminal Buga', zona: 'andina' },
    { nombre: 'Yumbo',           lat: 3.585,  lng: -76.493, zona: 'andina' },
    { nombre: 'Florida',         lat: 3.327,  lng: -76.234, zona: 'andina' },
  ]},
  { id: 'VAU', nombre: 'Vaupés', ciudades: [
    { nombre: 'Mitú',            lat: 1.198,  lng: -70.172, iata: 'MVP', aeropuerto: 'Fabio Alberto León Bentley', zona: 'amazonia' },
  ]},
  { id: 'VID', nombre: 'Vichada', ciudades: [
    { nombre: 'Puerto Carreño',  lat: 6.189,  lng: -67.484, iata: 'PCR', aeropuerto: 'German Olano', zona: 'orinoquia' },
    { nombre: 'La Primavera',    lat: 5.491,  lng: -70.407, zona: 'orinoquia' },
  ]},
  { id: 'AMA', nombre: 'Amazonas', ciudades: [
    { nombre: 'Leticia',         lat: -4.215, lng: -69.940, iata: 'LET', aeropuerto: 'Alfredo Vásquez Cobo', zona: 'amazonia' },
    { nombre: 'Puerto Nariño',   lat: -3.770, lng: -70.378, zona: 'amazonia' },
  ]},
  { id: 'ARA', nombre: 'Arauca', ciudades: [
    { nombre: 'Arauca',          lat: 7.091,  lng: -70.758, iata: 'AUC', aeropuerto: 'Santiago Pérez Quiroz', terminal: 'Terminal Arauca', zona: 'orinoquia' },
    { nombre: 'Saravena',        lat: 6.952,  lng: -71.862, iata: 'RVE', aeropuerto: 'Los Colonizadores', zona: 'orinoquia' },
    { nombre: 'Tame',            lat: 6.459,  lng: -71.728, iata: 'TME', aeropuerto: 'Gabriel Vargas Santos', zona: 'orinoquia' },
  ]},
];

/* ─── Lookup plano ──────────────────────────────────────────── */
export const TODAS_CIUDADES: CiudadCO[] = DEPTOS.flatMap((d) => d.ciudades);

export function buscarCiudad(nombre: string): CiudadCO | undefined {
  return TODAS_CIUDADES.find((c) => c.nombre === nombre);
}

/* ─── Clima simulado (determinístico por ciudad+fecha) ──────── */
export type CondicionClima = 'soleado' | 'parcialmente_nublado' | 'nublado' | 'lluvioso' | 'tormenta';

export interface ClimaInfo {
  condicion: CondicionClima;
  temperatura: number;
  humedad: number;
  descripcion: string;
  emoji: string;
  viento: number;
}

const TEMP_BASE: Record<ZonaClimatica, number> = {
  caribe: 33, andina: 16, pacifico: 28, amazonia: 30, orinoquia: 32, insular: 30,
};
const LLUVIA_PROB: Record<ZonaClimatica, number> = {
  caribe: 30, andina: 60, pacifico: 88, amazonia: 85, orinoquia: 52, insular: 38,
};

function xorHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function getClima(ciudad: CiudadCO, fecha: string): ClimaInfo {
  const h = xorHash(`${ciudad.nombre}-${fecha}`);
  const pct = (h & 0xFF) / 255;
  const pct2 = ((h >>> 8) & 0xFF) / 255;
  const pct3 = ((h >>> 16) & 0xFF) / 255;

  const rp = LLUVIA_PROB[ciudad.zona] / 100;
  let condicion: CondicionClima;
  if (pct < rp * 0.18)       condicion = 'tormenta';
  else if (pct < rp * 0.55)  condicion = 'lluvioso';
  else if (pct < rp * 0.80)  condicion = 'nublado';
  else if (pct < 0.88)       condicion = 'parcialmente_nublado';
  else                        condicion = 'soleado';

  const base = TEMP_BASE[ciudad.zona];
  const adj = condicion === 'tormenta' ? -5 : condicion === 'lluvioso' ? -3 : condicion === 'soleado' ? +3 : 0;
  const temperatura = Math.round(base + (pct2 * 10 - 5) + adj);
  const humedad = Math.round(40 + pct3 * 50 + (condicion === 'tormenta' || condicion === 'lluvioso' ? 25 : 0));
  const viento = Math.round(5 + pct2 * 30 + (condicion === 'tormenta' ? 20 : 0));

  const desc: Record<CondicionClima, string> = {
    soleado:              'Cielo despejado y soleado',
    parcialmente_nublado: 'Parcialmente nublado',
    nublado:              'Cielo nublado',
    lluvioso:             'Lluvia moderada',
    tormenta:             'Tormenta eléctrica',
  };
  const emojis: Record<CondicionClima, string> = {
    soleado: '☀️', parcialmente_nublado: '⛅', nublado: '☁️', lluvioso: '🌧️', tormenta: '⛈️',
  };

  return { condicion, temperatura: Math.min(45, Math.max(5, temperatura)), humedad: Math.min(99, humedad), descripcion: desc[condicion], emoji: emojis[condicion], viento };
}

/* ─── Coordenadas SVG (viewBox 0 0 360 480) ─────────────────── */
export function ciudadToSVG(lat: number, lng: number): [number, number] {
  const x = ((lng + 79) / 12.1) * 360;
  const y = ((12.5 - lat) / 16.7) * 480;
  return [Math.round(x), Math.round(y)];
}
