import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { PAISES, CIUDADES_POR_PAIS, LOCALIDADES_POR_CIUDAD } from '../utils/ubicaciones';
import { MapaInteractivo, type LugarMapa } from './MapaInteractivo';
import { buscarLugares, CATEGORIAS_LUGAR, enlacesViaje, type CategoriaLugar } from '../utils/lugares';

const TIPOS_VIA = [
  'Carrera', 'Calle', 'Avenida', 'Avenida Calle', 'Avenida Carrera',
  'Diagonal', 'Transversal', 'Circular', 'Autopista', 'Variante',
  'Anillo Vial', 'Vía', 'Camino', 'Boulevard', 'Paseo', 'Plaza',
];

const LETRAS_VIA = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'BIS'];
const CARDINALES = ['', 'Norte', 'Sur', 'Oriente', 'Occidente', 'Este', 'Oeste'];

interface DireccionPunto {
  direccion: string;
  tipoVia?: string;
  numeroVia?: string;
  letraVia?: string;
  numeroPlaca?: string;
  letraPlaca?: string;
  numeroCasa?: string;
  cardinal?: string;
  complemento?: string;
  ciudad: string;
  pais: string;
  localidad?: string;
  codigoPostal?: string;
  lat?: number;
  lon?: number;
}

interface DireccionValor {
  direccion: string;
  tipoVia?: string;
  numeroVia?: string;
  letraVia?: string;
  numeroPlaca?: string;
  letraPlaca?: string;
  numeroCasa?: string;
  cardinal?: string;
  complemento?: string;
  ciudad: string;
  pais: string;
  localidad?: string;
  codigoPostal?: string;
  lat?: number;
  lon?: number;
  tipoViaje?: 'unico' | 'solo_ida' | 'ida_y_vuelta';
  origen?: DireccionPunto;
}

interface Clima {
  temperatura: number;
  viento: number;
  codigo: number;
}

interface Props {
  value?: string;
  onChange: (json: string) => void;
  required?: boolean;
}

function componerDireccion(p: Partial<DireccionPunto>): string {
  const tv = (p.tipoVia || '').trim();
  const nv = (p.numeroVia || '').trim();
  const lv = (p.letraVia || '').trim();
  const np = (p.numeroPlaca || '').trim();
  const lp = (p.letraPlaca || '').trim();
  const nc = (p.numeroCasa || '').trim();
  const card = (p.cardinal || '').trim();
  if (!tv && !nv) {
    return (p.direccion || '').trim();
  }
  const principal = `${tv} ${nv}${lv}`.trim();
  let derecha = '';
  if (np) derecha = `#${np}${lp}${nc ? `-${nc}` : ''}`;
  const cardSuf = card ? ` ${card}` : '';
  return [principal, derecha, cardSuf].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function parseValor(raw?: string): DireccionValor {
  if (!raw) return { direccion: '', ciudad: '', pais: '', tipoViaje: 'unico' };
  try {
    const o = JSON.parse(raw);
    return {
      direccion: o.direccion || '',
      tipoVia: o.tipoVia,
      numeroVia: o.numeroVia,
      letraVia: o.letraVia,
      numeroPlaca: o.numeroPlaca,
      letraPlaca: o.letraPlaca,
      numeroCasa: o.numeroCasa,
      cardinal: o.cardinal,
      complemento: o.complemento,
      ciudad: o.ciudad || '',
      pais: o.pais || '',
      localidad: o.localidad,
      codigoPostal: o.codigoPostal,
      lat: o.lat,
      lon: o.lon,
      tipoViaje: o.tipoViaje || 'unico',
      origen: o.origen,
    };
  } catch {
    return { direccion: '', ciudad: '', pais: '', tipoViaje: 'unico' };
  }
}

const CLIMA_LABELS: Record<number, { texto: string; emoji: string }> = {
  0: { texto: 'Cielo despejado', emoji: '☀️' },
  1: { texto: 'Mayormente despejado', emoji: '🌤️' },
  2: { texto: 'Parcialmente nublado', emoji: '⛅' },
  3: { texto: 'Nublado', emoji: '☁️' },
  45: { texto: 'Niebla', emoji: '🌫️' },
  48: { texto: 'Niebla con escarcha', emoji: '🌫️' },
  51: { texto: 'Llovizna ligera', emoji: '🌦️' },
  53: { texto: 'Llovizna moderada', emoji: '🌦️' },
  55: { texto: 'Llovizna densa', emoji: '🌧️' },
  61: { texto: 'Lluvia ligera', emoji: '🌧️' },
  63: { texto: 'Lluvia moderada', emoji: '🌧️' },
  65: { texto: 'Lluvia fuerte', emoji: '⛈️' },
  71: { texto: 'Nevada ligera', emoji: '🌨️' },
  73: { texto: 'Nevada moderada', emoji: '❄️' },
  75: { texto: 'Nevada fuerte', emoji: '❄️' },
  80: { texto: 'Chubascos ligeros', emoji: '🌦️' },
  81: { texto: 'Chubascos moderados', emoji: '🌧️' },
  82: { texto: 'Chubascos fuertes', emoji: '⛈️' },
  95: { texto: 'Tormenta eléctrica', emoji: '⛈️' },
  96: { texto: 'Tormenta con granizo', emoji: '⛈️' },
  99: { texto: 'Tormenta fuerte con granizo', emoji: '⛈️' },
};

function descripcionClima(codigo: number) {
  return CLIMA_LABELS[codigo] || { texto: 'Condiciones desconocidas', emoji: '🌍' };
}

function codigoPaisISO(nombrePais: string): string | undefined {
  const p = PAISES.find((x) => x.nombre.toLowerCase() === nombrePais.toLowerCase());
  return p?.codigo.toLowerCase();
}

async function fetchNominatim(url: string): Promise<unknown[] | null> {
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return null;
    const arr = await r.json();
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

async function geocodificarPunto(p: DireccionPunto): Promise<{ lat: number; lon: number; etiqueta?: string } | null> {
  const direccion = (p.direccion || componerDireccion(p)).trim();
  const ciudad = (p.ciudad || '').trim();
  const pais = (p.pais || '').trim();
  const cp = (p.codigoPostal || '').trim();
  const iso = codigoPaisISO(pais);
  const ccParam = iso ? `&countrycodes=${iso}` : '';

  type NomItem = { lat: string; lon: string; display_name?: string };
  const tomarPrimero = (arr: unknown[] | null) => {
    if (!arr || arr.length === 0) return null;
    const first = arr[0] as NomItem;
    return { lat: parseFloat(first.lat), lon: parseFloat(first.lon), etiqueta: first.display_name };
  };

  // 1) Texto libre completo: dirección + localidad + ciudad + país (más tolerante con formatos colombianos como "Carrera 7 #74-21")
  if (direccion) {
    const partes = [direccion, p.localidad, ciudad, pais].filter(Boolean);
    const q = partes.join(', ');
    const r = tomarPrimero(await fetchNominatim(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}${ccParam}&format=json&limit=1&addressdetails=1&accept-language=es`));
    if (r) return r;
  }

  // 2) Búsqueda estructurada (street + city + country) — útil cuando hay datos limpios
  if (p.tipoVia && p.numeroVia) {
    const calle = `${p.tipoVia} ${p.numeroVia}${p.letraVia || ''}`.trim();
    const numero = p.numeroPlaca
      ? `${p.numeroPlaca}${p.letraPlaca || ''}${p.numeroCasa ? `-${p.numeroCasa}` : ''}`
      : '';
    const url = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(numero ? `${numero} ${calle}` : calle)}&city=${encodeURIComponent(ciudad)}&country=${encodeURIComponent(pais)}${cp ? `&postalcode=${encodeURIComponent(cp)}` : ''}${ccParam}&format=json&limit=1&addressdetails=1&accept-language=es`;
    const r = tomarPrimero(await fetchNominatim(url));
    if (r) return r;
  } else if (direccion) {
    const url = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(direccion)}&city=${encodeURIComponent(ciudad)}&country=${encodeURIComponent(pais)}${cp ? `&postalcode=${encodeURIComponent(cp)}` : ''}${ccParam}&format=json&limit=1&addressdetails=1&accept-language=es`;
    const r = tomarPrimero(await fetchNominatim(url));
    if (r) return r;
  }

  // 3) Variantes para Colombia: simplificar la dirección (remover # y -, dejar solo calle + número)
  if (iso === 'co' && direccion) {
    const simplificada = direccion
      .replace(/\s*#\s*/g, ' ')
      .replace(/\s*-\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (simplificada !== direccion) {
      const q = [simplificada, ciudad, pais].filter(Boolean).join(', ');
      const r = tomarPrimero(await fetchNominatim(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}${ccParam}&format=json&limit=1&accept-language=es`));
      if (r) return r;
    }
    // Sin número, solo nombre de vía: "Carrera 7, Bogotá"
    const soloVia = direccion.replace(/#[\s\S]*$/, '').trim();
    if (soloVia && soloVia !== direccion) {
      const q = [soloVia, p.localidad, ciudad, pais].filter(Boolean).join(', ');
      const r = tomarPrimero(await fetchNominatim(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}${ccParam}&format=json&limit=1&accept-language=es`));
      if (r) return r;
    }
  }

  // 4) Solo localidad/ciudad + país
  const fallbackQ = [p.localidad, ciudad, pais].filter(Boolean).join(', ');
  if (fallbackQ) {
    const r = tomarPrimero(await fetchNominatim(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallbackQ)}${ccParam}&format=json&limit=1&accept-language=es`));
    if (r) return r;
  }

  return null;
}

interface ReverseAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  country?: string;
  postcode?: string;
}

async function reverseGeocode(lat: number, lon: number): Promise<{
  direccion?: string;
  ciudad?: string;
  pais?: string;
  localidad?: string;
  codigoPostal?: string;
} | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=es`,
      { headers: { 'Accept': 'application/json' } },
    );
    if (!r.ok) return null;
    const data = await r.json();
    const a: ReverseAddress = data?.address || {};
    const direccion = [a.road, a.house_number].filter(Boolean).join(' ').trim() || data?.display_name?.split(',')[0] || '';
    return {
      direccion,
      ciudad: a.city || a.town || a.village || '',
      pais: a.country || '',
      localidad: a.suburb || a.neighbourhood || '',
      codigoPostal: a.postcode || '',
    };
  } catch {
    return null;
  }
}

interface SeccionProps {
  titulo: string;
  punto: DireccionPunto;
  onChange: (next: DireccionPunto) => void;
  onBuscarAhora?: () => void;
  required?: boolean;
}

function SeccionDireccion({ titulo, punto, onChange, onBuscarAhora, required }: SeccionProps) {
  const ciudadesDelPais = CIUDADES_POR_PAIS[punto.pais] || [];
  const localidadesDeCiudad = LOCALIDADES_POR_CIUDAD[punto.ciudad] || [];
  const [modoLibre, setModoLibre] = useState(false);

  function patch(p: Partial<DireccionPunto>) {
    const merged = { ...punto, ...p };
    // Recalcula la dirección compuesta automáticamente si hay componentes
    if (!modoLibre && (merged.tipoVia || merged.numeroVia || merged.numeroPlaca)) {
      merged.direccion = componerDireccion(merged);
    }
    onChange(merged);
  }

  return (
    <div className="direccion-seccion">
      <h5 className="direccion-seccion-titulo">{titulo}</h5>
      <div className="direccion-grid">
        <div className="form-group">
          <label>País {required ? <span className="req">*</span> : null}</label>
          <select
            value={punto.pais}
            onChange={(e) => patch({ pais: e.target.value, ciudad: '', localidad: undefined })}
            required={required}
          >
            <option value="">— selecciona país —</option>
            {PAISES.map((p) => <option key={p.codigo} value={p.nombre}>{p.nombre}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Ciudad {required ? <span className="req">*</span> : null}</label>
          {ciudadesDelPais.length > 0 ? (
            <select
              value={punto.ciudad}
              onChange={(e) => patch({ ciudad: e.target.value, localidad: undefined })}
              required={required}
            >
              <option value="">— selecciona ciudad —</option>
              {ciudadesDelPais.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__otra__">Otra (escribir)</option>
            </select>
          ) : (
            <input
              type="text"
              placeholder="Escribe la ciudad"
              value={punto.ciudad}
              onChange={(e) => patch({ ciudad: e.target.value })}
              required={required}
            />
          )}
          {punto.ciudad === '__otra__' ? (
            <input
              type="text"
              placeholder="Nombre de la ciudad"
              style={{ marginTop: 4 }}
              onChange={(e) => patch({ ciudad: e.target.value })}
            />
          ) : null}
        </div>

        {localidadesDeCiudad.length > 0 ? (
          <div className="form-group">
            <label>Localidad / Barrio</label>
            <select
              value={punto.localidad || ''}
              onChange={(e) => patch({ localidad: e.target.value || undefined })}
            >
              <option value="">— selecciona localidad —</option>
              {localidadesDeCiudad.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        ) : null}

        <div className="form-group">
          <label>Código postal</label>
          <input
            type="text"
            placeholder="Opcional"
            value={punto.codigoPostal || ''}
            onChange={(e) => patch({ codigoPostal: e.target.value })}
          />
        </div>
      </div>

      {/* DIRECCIÓN ESTRUCTURADA */}
      <div className="direccion-vialista">
        <div className="direccion-vialista-head">
          <label>
            Dirección exacta {required ? <span className="req">*</span> : null}
          </label>
          <label className="ops-checkbox" style={{ fontSize: 11 }}>
            <input
              type="checkbox"
              checked={modoLibre}
              onChange={(e) => setModoLibre(e.target.checked)}
            /> Escribir libre
          </label>
        </div>

        {modoLibre ? (
          <div className="direccion-libre-row">
            <input
              type="text"
              placeholder="Ej. Carrera 7 #74-21, Bogotá"
              value={punto.direccion}
              onChange={(e) => patch({ direccion: e.target.value })}
              required={required}
            />
            {onBuscarAhora ? (
              <button
                type="button"
                className="admin-primary-button direccion-buscar-btn"
                onClick={onBuscarAhora}
                title="Buscar esta dirección en el mapa ahora"
              >
                🔍 Buscar
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="direccion-via-grid">
              <div className="form-group">
                <label className="ops-label-mini">Tipo de vía</label>
                <select
                  value={punto.tipoVia || ''}
                  onChange={(e) => patch({ tipoVia: e.target.value })}
                  required={required}
                >
                  <option value="">— vía —</option>
                  {TIPOS_VIA.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="ops-label-mini">Número</label>
                <input
                  type="text"
                  placeholder="7"
                  value={punto.numeroVia || ''}
                  onChange={(e) => patch({ numeroVia: e.target.value })}
                  required={required}
                />
              </div>
              <div className="form-group">
                <label className="ops-label-mini">Letra</label>
                <select
                  value={punto.letraVia || ''}
                  onChange={(e) => patch({ letraVia: e.target.value })}
                >
                  {LETRAS_VIA.map((l) => <option key={l} value={l}>{l || '—'}</option>)}
                </select>
              </div>
              <div className="form-group">
                <span className="direccion-hash">#</span>
              </div>
              <div className="form-group">
                <label className="ops-label-mini">Placa</label>
                <input
                  type="text"
                  placeholder="74"
                  value={punto.numeroPlaca || ''}
                  onChange={(e) => patch({ numeroPlaca: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="ops-label-mini">Letra</label>
                <select
                  value={punto.letraPlaca || ''}
                  onChange={(e) => patch({ letraPlaca: e.target.value })}
                >
                  {LETRAS_VIA.map((l) => <option key={l} value={l}>{l || '—'}</option>)}
                </select>
              </div>
              <div className="form-group">
                <span className="direccion-hash">-</span>
              </div>
              <div className="form-group">
                <label className="ops-label-mini">N° casa</label>
                <input
                  type="text"
                  placeholder="21"
                  value={punto.numeroCasa || ''}
                  onChange={(e) => patch({ numeroCasa: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="ops-label-mini">Cardinal</label>
                <select
                  value={punto.cardinal || ''}
                  onChange={(e) => patch({ cardinal: e.target.value })}
                >
                  {CARDINALES.map((c) => <option key={c} value={c}>{c || '—'}</option>)}
                </select>
              </div>
            </div>
            {punto.direccion ? (
              <div className="direccion-preview">
                <strong>📍 Dirección armada:</strong> <span>{punto.direccion}</span>
              </div>
            ) : null}
            {onBuscarAhora ? (
              <button
                type="button"
                className="admin-primary-button direccion-buscar-btn"
                onClick={onBuscarAhora}
                style={{ marginTop: 8 }}
              >
                🔍 Buscar esta dirección en el mapa
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function DireccionField({ value, onChange, required }: Props) {
  const [valor, setValor] = useState<DireccionValor>(() => parseValor(value));
  const [buscando, setBuscando] = useState(false);
  const [clima, setClima] = useState<Clima | null>(null);
  const [error, setError] = useState('');
  const [animandoMundo, setAnimandoMundo] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const radioName = useId();

  // Explorador de lugares cercanos al destino (tiendas, hoteles, etc.)
  const [lugares, setLugares] = useState<LugarMapa[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<CategoriaLugar | null>(null);
  const [buscandoLugares, setBuscandoLugares] = useState(false);

  async function explorarLugares(cat: CategoriaLugar) {
    if (valor.lat == null || valor.lon == null) return;
    // Toggle: volver a tocar la categoría activa limpia el mapa
    if (categoriaActiva === cat) {
      setCategoriaActiva(null);
      setLugares([]);
      return;
    }
    setCategoriaActiva(cat);
    setBuscandoLugares(true);
    try {
      const res = await buscarLugares(valor.lat, valor.lon, cat);
      setLugares(res);
    } catch {
      setLugares([]);
    } finally {
      setBuscandoLugares(false);
    }
  }

  // Si cambia el destino, limpia los lugares (ya no corresponden a la zona)
  useEffect(() => {
    setLugares([]);
    setCategoriaActiva(null);
  }, [valor.lat, valor.lon]);

  const consulta = useMemo(() => {
    const partes = [valor.direccion, valor.localidad, valor.ciudad, valor.pais].map((p) => (p || '').trim()).filter(Boolean);
    return partes.join(', ');
  }, [valor]);

  function emit(next: DireccionValor) {
    setValor(next);
    onChange(JSON.stringify(next));
  }

  function updateDestino(p: DireccionPunto) {
    emit({ ...valor, ...p });
  }

  async function buscarDestinoYClima() {
    if (!valor.ciudad?.trim() || !valor.pais?.trim()) {
      setError('Selecciona país y ciudad antes de buscar en el mapa.');
      return;
    }
    setBuscando(true);
    setError('');
    setAnimandoMundo(true);
    try {
      const coords = await geocodificarPunto({
        direccion: valor.direccion,
        tipoVia: valor.tipoVia,
        numeroVia: valor.numeroVia,
        letraVia: valor.letraVia,
        numeroPlaca: valor.numeroPlaca,
        letraPlaca: valor.letraPlaca,
        numeroCasa: valor.numeroCasa,
        cardinal: valor.cardinal,
        complemento: valor.complemento,
        ciudad: valor.ciudad,
        pais: valor.pais,
        localidad: valor.localidad,
        codigoPostal: valor.codigoPostal,
      });
      if (!coords) {
        setError('No se pudo localizar la dirección exacta. Arrastra el marcador en el mapa para corregirla, o usa "Escribir libre".');
        setBuscando(false);
        setAnimandoMundo(false);
        return;
      }
      const next = { ...valor, lat: coords.lat, lon: coords.lon };
      emit(next);

      const climaR = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true`);
      const climaJ = await climaR.json();
      if (climaJ?.current_weather) {
        setClima({
          temperatura: climaJ.current_weather.temperature,
          viento: climaJ.current_weather.windspeed,
          codigo: climaJ.current_weather.weathercode,
        });
      }
    } catch {
      setError('No se pudo consultar la ubicación o el clima.');
    } finally {
      setBuscando(false);
      window.setTimeout(() => setAnimandoMundo(false), 1200);
    }
  }

  // Geocodifica DESTINO con debounce
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!valor.ciudad?.trim() || !valor.pais?.trim()) {
      setClima(null);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void buscarDestinoYClima();
    }, 800);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor.direccion, valor.ciudad, valor.pais, valor.localidad, valor.codigoPostal, valor.tipoVia, valor.numeroVia, valor.numeroPlaca, valor.numeroCasa]);

  async function buscarOrigen() {
    if (!valor.origen) return;
    if (!valor.origen.ciudad?.trim() || !valor.origen.pais?.trim()) return;
    const coords = await geocodificarPunto(valor.origen);
    if (!coords) return;
    emit({ ...valor, origen: { ...valor.origen, lat: coords.lat, lon: coords.lon } });
  }

  // Geocodifica ORIGEN
  useEffect(() => {
    if (!valor.origen) return;
    if (!valor.origen.ciudad?.trim() || !valor.origen.pais?.trim()) return;
    let cancel = false;
    const t = window.setTimeout(async () => {
      const coords = await geocodificarPunto(valor.origen!);
      if (cancel || !coords) return;
      emit({ ...valor, origen: { ...valor.origen!, lat: coords.lat, lon: coords.lon } });
    }, 800);
    return () => { cancel = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor.origen?.direccion, valor.origen?.ciudad, valor.origen?.pais, valor.origen?.localidad, valor.origen?.tipoVia, valor.origen?.numeroVia, valor.origen?.numeroPlaca]);

  const climaInfo = clima ? descripcionClima(clima.codigo) : null;
  const zoomDestino = (valor.numeroPlaca || valor.numeroVia) ? 17 : valor.direccion?.trim() ? 15 : 12;

  async function mapaDestinoMovido(coords: { lat: number; lon: number }) {
    // Reverse geocode + actualiza dirección/ciudad/país
    const info = await reverseGeocode(coords.lat, coords.lon);
    if (!info) {
      emit({ ...valor, lat: coords.lat, lon: coords.lon });
      return;
    }
    emit({
      ...valor,
      lat: coords.lat,
      lon: coords.lon,
      direccion: info.direccion || valor.direccion,
      ciudad: info.ciudad || valor.ciudad,
      pais: info.pais || valor.pais,
      localidad: info.localidad || valor.localidad,
      codigoPostal: info.codigoPostal || valor.codigoPostal,
      // Limpia los componentes estructurados — ahora la fuente de verdad es la dirección reverse-geocodeada
      tipoVia: undefined,
      numeroVia: undefined,
      letraVia: undefined,
      numeroPlaca: undefined,
      letraPlaca: undefined,
      numeroCasa: undefined,
      cardinal: undefined,
    });
  }

  async function mapaOrigenMovido(coords: { lat: number; lon: number }) {
    if (!valor.origen) return;
    const info = await reverseGeocode(coords.lat, coords.lon);
    const origenActual = valor.origen;
    if (!info) {
      emit({ ...valor, origen: { ...origenActual, lat: coords.lat, lon: coords.lon } });
      return;
    }
    emit({
      ...valor,
      origen: {
        ...origenActual,
        lat: coords.lat,
        lon: coords.lon,
        direccion: info.direccion || origenActual.direccion,
        ciudad: info.ciudad || origenActual.ciudad,
        pais: info.pais || origenActual.pais,
        localidad: info.localidad || origenActual.localidad,
        codigoPostal: info.codigoPostal || origenActual.codigoPostal,
        tipoVia: undefined,
        numeroVia: undefined,
        letraVia: undefined,
        numeroPlaca: undefined,
        letraPlaca: undefined,
        numeroCasa: undefined,
        cardinal: undefined,
      },
    });
  }

  const tipoViaje = valor.tipoViaje || 'unico';
  const muestraOrigen = tipoViaje === 'solo_ida' || tipoViaje === 'ida_y_vuelta';

  const enlaces = useMemo(
    () => enlacesViaje({
      destinoCiudad: valor.ciudad,
      destinoPais: valor.pais,
      origenCiudad: valor.origen?.ciudad,
      origenPais: valor.origen?.pais,
    }),
    [valor.ciudad, valor.pais, valor.origen?.ciudad, valor.origen?.pais],
  );

  return (
    <div className="direccion-field">
      <div className="direccion-tipo-bar">
        <label className="ops-checkbox">
          <input
            type="radio"
            name={radioName}
            checked={tipoViaje === 'unico'}
            onChange={() => emit({ ...valor, tipoViaje: 'unico', origen: undefined })}
          /> Dirección única
        </label>
        <label className="ops-checkbox">
          <input
            type="radio"
            name={radioName}
            checked={tipoViaje === 'solo_ida'}
            onChange={() => emit({ ...valor, tipoViaje: 'solo_ida' })}
          /> Viaje solo ida (origen → destino)
        </label>
        <label className="ops-checkbox">
          <input
            type="radio"
            name={radioName}
            checked={tipoViaje === 'ida_y_vuelta'}
            onChange={() => emit({ ...valor, tipoViaje: 'ida_y_vuelta' })}
          /> Ida y vuelta
        </label>
      </div>

      {muestraOrigen ? (
        <SeccionDireccion
          titulo="📍 Origen del viaje"
          punto={valor.origen || { direccion: '', ciudad: '', pais: '' }}
          onChange={(p) => emit({ ...valor, origen: p })}
          onBuscarAhora={buscarOrigen}
          required={required}
        />
      ) : null}

      <SeccionDireccion
        titulo={muestraOrigen ? '🎯 Destino' : 'Dirección'}
        punto={{
          direccion: valor.direccion,
          tipoVia: valor.tipoVia,
          numeroVia: valor.numeroVia,
          letraVia: valor.letraVia,
          numeroPlaca: valor.numeroPlaca,
          letraPlaca: valor.letraPlaca,
          numeroCasa: valor.numeroCasa,
          cardinal: valor.cardinal,
          complemento: valor.complemento,
          ciudad: valor.ciudad,
          pais: valor.pais,
          localidad: valor.localidad,
          codigoPostal: valor.codigoPostal,
        }}
        onChange={(p) => updateDestino(p)}
        onBuscarAhora={buscarDestinoYClima}
        required={required}
      />

      {animandoMundo ? (
        <div className="direccion-mundo">
          <div className="direccion-mundo-globo">🌍</div>
          <span>Localizando «{consulta}»…</span>
        </div>
      ) : null}

      {error ? <div className="direccion-error">{error}</div> : null}

      {/* Mapa origen */}
      {valor.origen?.lat != null && valor.origen?.lon != null && !animandoMundo ? (
        <div className="direccion-resultado">
          <div className="direccion-mapa-wrap">
            <MapaInteractivo
              lat={valor.origen.lat}
              lon={valor.origen.lon}
              zoom={15}
              onMover={mapaOrigenMovido}
              alto={260}
            />
            <a className="direccion-mapa-link" href={`https://www.openstreetmap.org/?mlat=${valor.origen.lat}&mlon=${valor.origen.lon}&zoom=14`} target="_blank" rel="noopener noreferrer">
              Origen ↗
            </a>
          </div>
        </div>
      ) : null}

      {/* Mapa destino + clima */}
      {valor.lat != null && valor.lon != null && !animandoMundo ? (
        <div className="direccion-resultado">
          <div className="direccion-mapa-wrap">
            <MapaInteractivo
              lat={valor.lat}
              lon={valor.lon}
              zoom={zoomDestino}
              onMover={mapaDestinoMovido}
              alto={300}
              pois={lugares}
            />
            <a className="direccion-mapa-link" href={`https://www.openstreetmap.org/?mlat=${valor.lat}&mlon=${valor.lon}&zoom=17`} target="_blank" rel="noopener noreferrer">
              {muestraOrigen ? 'Destino ↗' : 'Ver en OpenStreetMap ↗'}
            </a>
          </div>

          {/* Explorador de lugares cercanos (Overpass / OpenStreetMap) */}
          <div className="direccion-lugares">
            <span className="admin-help-text"><strong>🔎 Explorar cerca del destino:</strong></span>
            <div className="direccion-lugares-chips">
              {CATEGORIAS_LUGAR.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`direccion-lugar-chip${categoriaActiva === c.id ? ' active' : ''}`}
                  onClick={() => explorarLugares(c.id)}
                  title={`Ver ${c.label.toLowerCase()} cercanos en el mapa`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            {buscandoLugares ? (
              <small className="admin-help-text">Buscando lugares cercanos…</small>
            ) : categoriaActiva && lugares.length > 0 ? (
              <ul className="direccion-lugares-lista">
                {lugares.slice(0, 12).map((l, i) => (
                  <li key={`${l.nombre}-${i}`}>
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(l.nombre)}/@${l.lat},${l.lon},17z`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      📍 {l.nombre}
                    </a>
                  </li>
                ))}
                {lugares.length > 12 ? <li className="admin-help-text">y {lugares.length - 12} más en el mapa…</li> : null}
              </ul>
            ) : categoriaActiva ? (
              <small className="admin-help-text">No se encontraron lugares de esa categoría en la zona.</small>
            ) : null}
          </div>

          {/* Enlaces de viaje: vuelos, hoteles, transporte (mejores precios) */}
          {enlaces.length > 0 ? (
            <div className="direccion-viaje">
              <span className="admin-help-text"><strong>💸 Buscar precios para {valor.ciudad}:</strong></span>
              <div className="direccion-viaje-links">
                {enlaces.map((e) => (
                  <a
                    key={e.id}
                    className="direccion-viaje-link"
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {e.emoji} {e.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {climaInfo && clima ? (
            <div className="direccion-clima card-surface">
              <div className="direccion-clima-emoji" aria-hidden="true">{climaInfo.emoji}</div>
              <div className="direccion-clima-info">
                <strong>{climaInfo.texto}</strong>
                <span>{Math.round(clima.temperatura)}°C · viento {Math.round(clima.viento)} km/h</span>
                <span className="admin-help-text">{valor.localidad ? `${valor.localidad}, ` : ''}{valor.ciudad}, {valor.pais}</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {buscando ? <small className="admin-help-text">Cargando información…</small> : null}
    </div>
  );
}
