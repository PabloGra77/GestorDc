import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/http/api';
import { SignaturePad } from '../../components/SignaturePad';
import { BANCOS_COLOMBIA } from '../../utils/bancos';
import { formatearMiles, numeroAPesosEnLetras } from '../../utils/numeroALetras';
import { getAuthSession } from '../auth/auth.service';
import { buscarCiudad, getClima, TODAS_CIUDADES } from './colombiaData';
import type { CiudadCO } from './colombiaData';

interface AnticipoPanelProps {
  onCreada?: (info: { id: number; numeroRadicado: string }) => void;
  areaId?: number;
}

interface TipoInfo {
  id: number;
  nombre: string;
  slug: string;
  configuracionTipo?: {
    topeTransporte?: number;
    topeHospedaje?: number;
    topeAlimentacion?: number;
    topeMateriales?: number;
    topeCapacitacion?: number;
    topeOtro?: number;
    topeTotal?: number;
  } | null;
}

interface UsuarioSugerido {
  id: number;
  nombreCompleto: string;
  correo?: string;
}

interface ItemMaterial { id: string; desc: string; valor: string; }

// ── Colombia geography ──────────────────────────────────────────────────────
const COLOMBIA: Record<string, string[]> = {
  'Amazonas': ['Leticia', 'Puerto Nariño'],
  'Antioquia': ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Sabaneta', 'Rionegro', 'Apartadó', 'Turbo', 'Marinilla', 'Caldas', 'La Estrella'],
  'Arauca': ['Arauca', 'Saravena', 'Tame', 'Fortul'],
  'Atlántico': ['Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Galapa', 'Puerto Colombia'],
  'Bogotá D.C.': ['Bogotá D.C.'],
  'Bolívar': ['Cartagena', 'Magangué', 'Mompós', 'El Carmen de Bolívar'],
  'Boyacá': ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá', 'Paipa', 'Villa de Leyva'],
  'Caldas': ['Manizales', 'La Dorada', 'Chinchiná', 'Riosucio'],
  'Caquetá': ['Florencia', 'San Vicente del Caguán', 'Puerto Rico'],
  'Casanare': ['Yopal', 'Aguazul', 'Villanueva', 'Paz de Ariporo'],
  'Cauca': ['Popayán', 'Santander de Quilichao', 'Puerto Tejada', 'Patía'],
  'Cesar': ['Valledupar', 'Aguachica', 'Codazzi', 'La Paz'],
  'Chocó': ['Quibdó', 'Istmina', 'Acandí'],
  'Córdoba': ['Montería', 'Cereté', 'Lorica', 'Sahagún', 'Montelíbano'],
  'Cundinamarca': ['Soacha', 'Facatativá', 'Zipaquirá', 'Chía', 'Mosquera', 'Madrid', 'Fusagasugá', 'Girardot', 'Cajicá', 'La Calera', 'Sibaté', 'Tocancipá'],
  'Guainía': ['Inírida'],
  'Guaviare': ['San José del Guaviare', 'El Retorno', 'Calamar'],
  'Huila': ['Neiva', 'Pitalito', 'Garzón', 'La Plata'],
  'La Guajira': ['Riohacha', 'Maicao', 'Uribia', 'Manaure', 'Fonseca'],
  'Magdalena': ['Santa Marta', 'Ciénaga', 'Fundación', 'El Banco'],
  'Meta': ['Villavicencio', 'Acacías', 'Granada', 'Puerto López'],
  'Nariño': ['Pasto', 'Tumaco', 'Ipiales', 'Túquerres', 'La Unión'],
  'Norte de Santander': ['Cúcuta', 'Ocaña', 'Pamplona', 'Tibú', 'Los Patios'],
  'Putumayo': ['Mocoa', 'Puerto Asís', 'La Hormiga', 'Orito'],
  'Quindío': ['Armenia', 'Calarcá', 'Montenegro', 'Quimbaya', 'La Tebaida'],
  'Risaralda': ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'Marsella'],
  'San Andrés y Providencia': ['San Andrés', 'Providencia'],
  'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil'],
  'Sucre': ['Sincelejo', 'Corozal', 'Sampués', 'Tolú'],
  'Tolima': ['Ibagué', 'Espinal', 'Melgar', 'Honda', 'Chaparral'],
  'Valle del Cauca': ['Cali', 'Buenaventura', 'Palmira', 'Buga', 'Cartago', 'Tuluá', 'Yumbo', 'Jamundí'],
  'Vaupés': ['Mitú'],
  'Vichada': ['Puerto Carreño'],
};

const LOCALIDADES_BOGOTA = [
  'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito',
  'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos',
  'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda',
  'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz',
];

const DEPARTAMENTOS = Object.keys(COLOMBIA).sort((a, b) => a.localeCompare(b, 'es'));

const BOGOTA_LOC_COORDS: Record<string, [number, number]> = {
  'Usaquén':          [4.701, -74.031], 'Chapinero':       [4.646, -74.070],
  'Santa Fe':         [4.598, -74.073], 'San Cristóbal':   [4.570, -74.079],
  'Usme':             [4.479, -74.126], 'Tunjuelito':      [4.570, -74.134],
  'Bosa':             [4.621, -74.196], 'Kennedy':         [4.627, -74.162],
  'Fontibón':         [4.683, -74.148], 'Engativá':        [4.703, -74.111],
  'Suba':             [4.741, -74.084], 'Barrios Unidos':  [4.671, -74.087],
  'Teusaquillo':      [4.641, -74.089], 'Los Mártires':    [4.607, -74.089],
  'Antonio Nariño':   [4.585, -74.108], 'Puente Aranda':   [4.618, -74.116],
  'La Candelaria':    [4.596, -74.075], 'Rafael Uribe Uribe': [4.566, -74.108],
  'Ciudad Bolívar':   [4.513, -74.163], 'Sumapaz':         [4.199, -74.390],
};

function haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371, d2r = Math.PI / 180;
  const dl = (la2 - la1) * d2r, dg = (lo2 - lo1) * d2r;
  const a = Math.sin(dl/2)**2 + Math.cos(la1*d2r)*Math.cos(la2*d2r)*Math.sin(dg/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function buscarCiudadFlex(nombre: string): CiudadCO | undefined {
  if (!nombre) return undefined;
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  const n = norm(nombre);
  return buscarCiudad(nombre) ||
    TODAS_CIUDADES.find(c => norm(c.nombre) === n) ||
    TODAS_CIUDADES.find(c => n.startsWith(norm(c.nombre)) || norm(c.nombre).startsWith(n));
}

const MODOS_TRANSPORTE = [
  { key: 'uber',    label: 'Uber' },
  { key: 'yango',   label: 'Yango' },
  { key: 'didi',    label: 'DiDi' },
  { key: 'motoapp', label: 'Moto de aplicación' },
  { key: 'taxi',    label: 'Taxi' },
  { key: 'bus',    label: 'Bus / TransMilenio' },
  { key: 'inter',  label: 'Bus intermunicipal' },
  { key: 'propio', label: 'Vehículo propio' },
  { key: 'otro',   label: 'Otro medio' },
];

const TIPOS_CUENTA = ['Ahorros', 'Corriente'];

function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtN(v: number): string { return v > 0 ? formatearMiles(String(v)) : '0'; }
function parseV(s: string): number { return parseInt(s.replace(/\D/g, '')) || 0; }
function normTxt(s: string) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

export function AnticipOPanel({ onCreada, areaId }: AnticipoPanelProps) {
  const session = getAuthSession();
  const nombreSesion = session?.usuario?.nombreCompleto || '';

  const [tipo, setTipo] = useState<TipoInfo | null>(null);
  const [paso, setPaso] = useState(1);
  const PASOS = ['Propósito y autorización', 'Desglose de gastos', 'Resumen y firma'];

  // ── Autorizador ─────────────────────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState<UsuarioSugerido[]>([]);
  const [autorizadorInput, setAutorizadorInput] = useState('');
  const [autorizadorId, setAutorizadorId] = useState(0);
  const [autorizadorNombre, setAutorizadorNombre] = useState('');
  const [showSuger, setShowSuger] = useState(false);

  // ── Paso 1: Propósito ───────────────────────────────────────────────────────
  const [proposito, setProposito] = useState('');
  const [fechaEvento, setFechaEvento] = useState('');

  // ── Paso 2: Transporte ──────────────────────────────────────────────────────
  const [useTransporte, setUseTransporte] = useState(true);
  const [trDepto, setTrDepto] = useState('Bogotá D.C.');
  const [trCiudad, setTrCiudad] = useState('Bogotá D.C.');
  const [trLocalidad, setTrLocalidad] = useState('');
  const [trMode, setTrMode] = useState('uber');
  const [trTrayectos, setTrTrayectos] = useState('1');
  const [trValor, setTrValor] = useState('');
  const [trOrigenCiudad, setTrOrigenCiudad] = useState('');
  const [trOrigenLocalidad, setTrOrigenLocalidad] = useState('');
  const [trLluviaOverride, setTrLluviaOverride] = useState<boolean | null>(null);
  const [showOrigenSuger, setShowOrigenSuger] = useState(false);

  // ── Paso 2: Hospedaje ───────────────────────────────────────────────────────
  const [useHospedaje, setUseHospedaje] = useState(false);
  const [hospLugar, setHospLugar] = useState('');
  const [hospNoches, setHospNoches] = useState('1');
  const [hospValorNoche, setHospValorNoche] = useState('');

  // ── Paso 2: Alimentación ────────────────────────────────────────────────────
  const [useAlimentacion, setUseAlimentacion] = useState(false);
  const [alimDesD, setAlimDesD] = useState('0');
  const [alimDesV, setAlimDesV] = useState('');
  const [alimAlmD, setAlimAlmD] = useState('0');
  const [alimAlmV, setAlimAlmV] = useState('');
  const [alimCenD, setAlimCenD] = useState('0');
  const [alimCenV, setAlimCenV] = useState('');

  // ── Paso 2: Materiales ──────────────────────────────────────────────────────
  const [useMateriales, setUseMateriales] = useState(false);
  const [materiales, setMateriales] = useState<ItemMaterial[]>([{ id: uid(), desc: '', valor: '' }]);

  // ── Paso 2: Capacitación ────────────────────────────────────────────────────
  const [useCapacitacion, setUseCapacitacion] = useState(false);
  const [capNombre, setCapNombre] = useState('');
  const [capInstitucion, setCapInstitucion] = useState('');
  const [capValor, setCapValor] = useState('');

  // ── Paso 2: Otro ────────────────────────────────────────────────────────────
  const [useOtro, setUseOtro] = useState(false);
  const [otroDesc, setOtroDesc] = useState('');
  const [otroValor, setOtroValor] = useState('');

  // ── Paso 3: Cuenta + Firma + Compromiso ────────────────────────────────────
  // fechaLegalizacion: default = hoy + 3 días calendario
  const [fechaLegalizacion, setFechaLegalizacion] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10);
  });
  // ── Paso 3: Cuenta + Firma ──────────────────────────────────────────────────
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('Ahorros');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [titularCuenta, setTitularCuenta] = useState('');
  const [firma, setFirma] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const numTr = Math.max(1, parseInt(trTrayectos) || 1);
  const subTransporte = useTransporte ? parseV(trValor) * numTr : 0;
  const subHospedaje  = useHospedaje  ? (parseInt(hospNoches)||0) * parseV(hospValorNoche) : 0;
  const subAlim = useAlimentacion
    ? (parseInt(alimDesD)||0)*parseV(alimDesV) + (parseInt(alimAlmD)||0)*parseV(alimAlmV) + (parseInt(alimCenD)||0)*parseV(alimCenV)
    : 0;
  const subMat  = useMateriales   ? materiales.reduce((s, m) => s + parseV(m.valor), 0) : 0;
  const subCap  = useCapacitacion ? parseV(capValor) : 0;
  const subOtro = useOtro         ? parseV(otroValor) : 0;
  const total   = subTransporte + subHospedaje + subAlim + subMat + subCap + subOtro;

  const topes = tipo?.configuracionTipo ?? {};

  // ── Carga de datos ──────────────────────────────────────────────────────────
  useEffect(() => {
    const norm = normTxt;
    api.get<TipoInfo[]>('/tipos').then((r) => {
      const t = r.data.find(x => norm(x.slug) === 'anticipo' || norm(x.nombre) === 'anticipo');
      setTipo(t ?? null);
    }).catch(() => {});

    api.get<UsuarioSugerido[]>('/usuarios').then((r) => setUsuarios(r.data)).catch(() => {});

    api.get<Record<string, string>>('/usuarios/perfil').then((r) => {
      if (r.data.banco) setBanco(r.data.banco);
      if (r.data.tipoCuenta) setTipoCuenta(r.data.tipoCuenta);
      if (r.data.numeroCuenta) setNumeroCuenta(r.data.numeroCuenta);
      if (r.data.titularCuenta) setTitularCuenta(r.data.titularCuenta);
    }).catch(() => {});
  }, []);

  // ── Sugerencias de autorizador ──────────────────────────────────────────────
  const sugeridos = useMemo(() => {
    const term = autorizadorInput.trim().toLowerCase();
    if (term.length < 2 || !showSuger) return [];
    return usuarios
      .filter(u => u.nombreCompleto.toLowerCase().includes(term) || u.correo?.toLowerCase().includes(term))
      .slice(0, 6);
  }, [autorizadorInput, usuarios, showSuger]);

  function elegirAutorizador(u: UsuarioSugerido) {
    setAutorizadorId(u.id);
    setAutorizadorNombre(u.nombreCompleto);
    setAutorizadorInput(u.nombreCompleto);
    setShowSuger(false);
  }

  const origenSugeridos = useMemo(() => {
    const term = trOrigenCiudad.trim();
    if (term.length < 2 || !showOrigenSuger) return [];
    const tN = normTxt(term);
    const all = [...LOCALIDADES_BOGOTA, ...TODAS_CIUDADES.map(c => c.nombre)];
    const seen = new Set<string>();
    return all.filter(s => {
      if (seen.has(s)) return false;
      seen.add(s);
      return normTxt(s).includes(tN);
    }).slice(0, 9);
  }, [trOrigenCiudad, showOrigenSuger]);

  // ── Ciudades del depto seleccionado ────────────────────────────────────────
  const trCiudades = COLOMBIA[trDepto] || [];
  const esBogotaDest = trDepto === 'Bogotá D.C.';
  const isMotoApp = trMode === 'motoapp';
  const isCarApp = ['uber', 'yango', 'didi'].includes(trMode);
  const isApp = isCarApp || isMotoApp;

  // ── Calculadora de precio transporte ───────────────────────────────────────
  // Coordenadas de origen
  const origenCoords = ((): [number, number] | null => {
    const loc = BOGOTA_LOC_COORDS[trOrigenLocalidad] ?? BOGOTA_LOC_COORDS[trOrigenCiudad];
    if (loc) return loc;
    const city = buscarCiudadFlex(trOrigenCiudad);
    if (city) return [city.lat, city.lng];
    return null;
  })();

  // Coordenadas de destino
  const destinoCityData = buscarCiudadFlex(trCiudad);
  const destinoCoords = ((): [number, number] | null => {
    const loc = BOGOTA_LOC_COORDS[trLocalidad];
    if (esBogotaDest && loc) return loc;
    if (destinoCityData) return [destinoCityData.lat, destinoCityData.lng];
    return null;
  })();

  // Distancia km (haversine × factor vial: urbano 1.4, intercity 1.25)
  const distLineal = (origenCoords && destinoCoords)
    ? haversineKm(origenCoords[0], origenCoords[1], destinoCoords[0], destinoCoords[1])
    : 0;
  const mismaCiudad = !!trOrigenCiudad &&
    (buscarCiudadFlex(trOrigenCiudad)?.nombre === (destinoCityData?.nombre ?? ''));
  const trKmCalculado = distLineal > 0 ? Math.max(1, Math.round(distLineal * (mismaCiudad ? 1.4 : 1.25))) : 0;

  // Clima auto-detectado (igual que viáticos) + override manual
  const today = new Date().toISOString().slice(0, 10);
  const climaAuto = destinoCityData ? getClima(destinoCityData, today) : null;
  const esLluviosoAuto = climaAuto?.condicion === 'lluvioso' || climaAuto?.condicion === 'tormenta';
  const esLluvioso = trLluviaOverride !== null ? trLluviaOverride : esLluviosoAuto;

  // Horas pico: 6:00-8:00, 11:30-13:30, 16:30-20:00 · Noche desde 19:00
  const _now = new Date();
  const horaD = _now.getHours() + _now.getMinutes() / 60;
  const isHoraPico = (horaD >= 6 && horaD < 8) || (horaD >= 11.5 && horaD < 13.5) || (horaD >= 16.5 && horaD < 20);
  const isNoche = horaD >= 19;

  // Precio estimado
  const baseKmRate = isMotoApp ? 1000 : 1500;
  const trEstBase = trKmCalculado > 0
    ? Math.max(isMotoApp ? 5000 : 8000, Math.round(trKmCalculado * baseKmRate))
    : 0;
  const trEstMult = (isHoraPico ? 1.25 : 1) * (isNoche ? 1.15 : 1) * (esLluvioso ? 1.25 : 1);
  const trEstMin = trEstBase;
  const trEstMax = Math.round(trEstBase * trEstMult);

  // ── Materiales helpers ──────────────────────────────────────────────────────
  function addMat() { setMateriales(p => [...p, { id: uid(), desc: '', valor: '' }]); }
  function rmMat(id: string) { setMateriales(p => p.filter(m => m.id !== id)); }
  function setMatF(id: string, f: 'desc' | 'valor', v: string) {
    setMateriales(p => p.map(m => m.id === id ? { ...m, [f]: v } : m));
  }

  // ── Validación por paso ─────────────────────────────────────────────────────
  function validar(): string {
    if (paso === 1) {
      if (!proposito.trim()) return 'Describe el propósito del anticipo.';
      if (!autorizadorId) return 'Selecciona quién autoriza el anticipo de la lista.';
      if (autorizadorInput.trim() !== autorizadorNombre) return 'Elige el autorizador de la lista de sugerencias.';
    }
    if (paso === 2) {
      if (!useTransporte && !useHospedaje && !useAlimentacion && !useMateriales && !useCapacitacion && !useOtro) {
        return 'Selecciona al menos un tipo de gasto.';
      }
      if (total <= 0) return 'El total del anticipo debe ser mayor a 0.';
      if (useTransporte && subTransporte <= 0) return 'Ingresa el valor por trayecto en Transporte.';
      if (useHospedaje && subHospedaje <= 0) return 'Ingresa noches y valor por noche en Hospedaje.';
      if (useAlimentacion && subAlim <= 0) return 'Ingresa al menos un valor de alimentación.';
      if (useMateriales && subMat <= 0) return 'Agrega al menos un material con valor.';
      if (useCapacitacion && (!capNombre.trim() || subCap <= 0)) return 'Completa el nombre y valor de la capacitación.';
      if (useOtro && (!otroDesc.trim() || subOtro <= 0)) return 'Describe y valora el concepto "Otro".';
      const topeT = (topes as Record<string, number>)['topeTotal'];
      if (topeT && total > topeT) return `El total ($ ${fmtN(total)}) supera el tope configurado de $ ${fmtN(topeT)}.`;
    }
    if (paso === 3) {
      if (!firma) return 'Firma digital requerida.';
    }
    return '';
  }

  // ── Construir ítems para el payload ────────────────────────────────────────
  function buildItems(): Array<{ concepto: string; descripcion: string; valor: string }> {
    const items: Array<{ concepto: string; descripcion: string; valor: string }> = [];
    if (useTransporte && subTransporte > 0) {
      const modeName = MODOS_TRANSPORTE.find(m => m.key === trMode)?.label || trMode;
      const destino = [trDepto, trCiudad, trLocalidad].filter(Boolean).join(' › ');
      items.push({
        concepto: `Transporte (${modeName})`,
        descripcion: `${numTr} trayecto(s) — destino: ${destino}`,
        valor: String(subTransporte),
      });
    }
    if (useHospedaje && subHospedaje > 0) {
      items.push({
        concepto: 'Hospedaje',
        descripcion: `${hospLugar || 'Alojamiento'} · ${hospNoches} noche(s) × $ ${fmtN(parseV(hospValorNoche))}`,
        valor: String(subHospedaje),
      });
    }
    if (useAlimentacion && subAlim > 0) {
      const partes: string[] = [];
      const dD = parseInt(alimDesD)||0, vD = parseV(alimDesV);
      const dA = parseInt(alimAlmD)||0, vA = parseV(alimAlmV);
      const dC = parseInt(alimCenD)||0, vC = parseV(alimCenV);
      if (dD*vD>0) partes.push(`Desayuno ${dD}d×$${fmtN(vD)}`);
      if (dA*vA>0) partes.push(`Almuerzo ${dA}d×$${fmtN(vA)}`);
      if (dC*vC>0) partes.push(`Cena ${dC}d×$${fmtN(vC)}`);
      items.push({ concepto: 'Alimentación', descripcion: partes.join(' · '), valor: String(subAlim) });
    }
    if (useMateriales && subMat > 0) {
      const desc = materiales
        .filter(m => m.desc.trim() && parseV(m.valor)>0)
        .map(m => `${m.desc} ($${fmtN(parseV(m.valor))})`)
        .join('; ');
      items.push({ concepto: 'Materiales e insumos', descripcion: desc, valor: String(subMat) });
    }
    if (useCapacitacion && subCap > 0) {
      items.push({
        concepto: 'Capacitación / Evento',
        descripcion: [capNombre, capInstitucion].filter(Boolean).join(' — '),
        valor: String(subCap),
      });
    }
    if (useOtro && subOtro > 0) {
      items.push({ concepto: 'Otro', descripcion: otroDesc, valor: String(subOtro) });
    }
    return items;
  }

  // ── Siguiente / Enviar ──────────────────────────────────────────────────────
  function siguiente() {
    const err = validar();
    if (err) { setError(err); return; }
    setError('');
    setPaso(p => p + 1);
  }

  async function enviar() {
    const err = validar();
    if (err) { setError(err); return; }
    if (!tipo) { setError('No se encontró el tipo "Anticipo". Contacta al administrador.'); return; }
    setEnviando(true);
    setError('');
    try {
      const items = buildItems();
      const destino = useTransporte
        ? [trDepto, trCiudad, trLocalidad].filter(Boolean).join(' › ')
        : '';
      const modeName = MODOS_TRANSPORTE.find(m => m.key === trMode)?.label || trMode;
      const categoriasStr = [
        useTransporte && 'Transporte', useHospedaje && 'Hospedaje',
        useAlimentacion && 'Alimentación', useMateriales && 'Materiales',
        useCapacitacion && 'Capacitación', useOtro && 'Otro',
      ].filter(Boolean).join(', ');
      const mesAnioActual = new Date().toLocaleString('es-CO', { month: 'long', year: 'numeric' });
      await api.post<{ id: number; numeroRadicado: string }>('/solicitudes', {
        tipoSolicitudId: tipo.id,
        ...(areaId ? { areaSeleccionadaId: areaId } : {}),
        datos: {
          proposito,
          justificacion: proposito,
          descripcionGasto: proposito,
          paraque: proposito,
          categoria: categoriasStr,
          tipoTransporte: useTransporte ? modeName : '',
          medioTransporte: useTransporte ? modeName : '',
          mesAnioRadicar: mesAnioActual,
          fechaLegalizacion,
          fechaEvento,
          destino,
          autorizadorId: String(autorizadorId),
          autorizadorNombre,
          autorizadoPor: autorizadorNombre,
          items: JSON.stringify(items),
          valorPesos: String(total),
          banco,
          tipoCuenta,
          numeroCuenta,
          titularCuenta,
        },
        firmas: { profesional: firma },
      }).then(r => onCreada?.({ id: r.data.id, numeroRadicado: r.data.numeroRadicado }));
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'No se pudo registrar el anticipo. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  // ── Helper: tope warning ────────────────────────────────────────────────────
  function topeWarn(key: string, valor: number) {
    const tope = (topes as Record<string, number>)[key];
    if (tope && valor > tope) {
      return <span className="anticipo-tope-warn">⚠ supera el tope ($ {fmtN(tope)})</span>;
    }
    return null;
  }

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="anticipo-panel card-surface">
      <div className="nueva-sol-substeps">
        {PASOS.map((n, i) => (
          <span key={n} className={`nueva-sol-substep${paso===i+1?' active':''}${paso>i+1?' done':''}`}>
            {i+1}. {n}
          </span>
        ))}
      </div>

      {error && <div className="admin-error" style={{ marginBottom: 14 }}>{error}</div>}

      {/* ═══ PASO 1: Propósito y autorización ═══ */}
      {paso === 1 && (
        <div className="anticipo-paso">
          <h4 className="anticipo-paso-titulo">Propósito y autorización del anticipo</h4>

          <div className="form-group form-group--wide">
            <label>¿Para qué es el anticipo? <span className="req">*</span></label>
            <textarea
              rows={3}
              placeholder="Describe la actividad, evento o gestión que requiere el dinero anticipado."
              value={proposito}
              onChange={e => setProposito(e.target.value)}
            />
          </div>

          <div className="anticipo-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <div className="form-group">
              <label>Fecha del evento / actividad</label>
              <input type="date" value={fechaEvento} onChange={e => setFechaEvento(e.target.value)} />
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label>Autorizado por <span className="req">*</span></label>
              <input
                type="text"
                placeholder="Escribe nombre del autorizador…"
                value={autorizadorInput}
                onChange={e => { setAutorizadorInput(e.target.value); setAutorizadorId(0); setAutorizadorNombre(''); setShowSuger(true); }}
                onFocus={() => setShowSuger(true)}
                onBlur={() => setTimeout(() => setShowSuger(false), 160)}
                autoComplete="off"
              />
              {autorizadorId > 0 && <span className="leg-autorizado-ok">✓ {autorizadorNombre}</span>}
              {showSuger && sugeridos.length > 0 && (
                <div className="leg-sugeridos-list">
                  {sugeridos.map(u => (
                    <button key={u.id} type="button" className="leg-sugerido-item" onMouseDown={() => elegirAutorizador(u)}>
                      <strong>{u.nombreCompleto}</strong>
                      {u.correo && <span style={{ marginLeft: 6, opacity: 0.65, fontSize: 12 }}>{u.correo}</span>}
                    </button>
                  ))}
                </div>
              )}
              {showSuger && autorizadorInput.length >= 2 && sugeridos.length === 0 && (
                <div className="leg-sugeridos-list">
                  <span className="leg-sin-resultados">Sin coincidencias para "{autorizadorInput}"</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-group form-group--wide" style={{ marginTop: 4 }}>
            <label style={{ display:'flex', alignItems:'center', gap: 8, fontWeight: 500, cursor:'default' }}>
              <span>Solicitante:</span>
              <strong>{nombreSesion || session?.usuario?.correo || '—'}</strong>
            </label>
          </div>
        </div>
      )}

      {/* ═══ PASO 2: Desglose de gastos ═══ */}
      {paso === 2 && (
        <div className="anticipo-paso">
          <h4 className="anticipo-paso-titulo">Desglose de gastos solicitados</h4>
          <p className="admin-help-text" style={{ marginBottom: 14 }}>
            Activa las categorías que apliquen e ingresa los valores estimados.
          </p>

          {/* ── Transporte ── */}
          <div className={`anticipo-categoria${useTransporte ? ' activa' : ''}`}>
            <label className="anticipo-cat-header">
              <input type="checkbox" checked={useTransporte} onChange={e => setUseTransporte(e.target.checked)} />
              <span>🚗 Transporte</span>
              {useTransporte && subTransporte > 0 && <strong className="anticipo-subtotal-badge">$ {fmtN(subTransporte)}</strong>}
              {topeWarn('topeTransporte', subTransporte)}
            </label>
            {useTransporte && (
              <div className="anticipo-cat-body">
                {/* ── Punto de partida ── */}
                <div className="anticipo-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>📍 Punto de partida</label>
                    <input
                      type="text"
                      placeholder="Ciudad o localidad de origen…"
                      value={trOrigenCiudad}
                      onChange={e => { setTrOrigenCiudad(e.target.value); setTrOrigenLocalidad(''); setShowOrigenSuger(true); }}
                      onFocus={() => setShowOrigenSuger(true)}
                      onBlur={() => setTimeout(() => setShowOrigenSuger(false), 160)}
                      autoComplete="off"
                    />
                    {showOrigenSuger && origenSugeridos.length > 0 && (
                      <div className="leg-sugeridos-list">
                        {origenSugeridos.map(s => (
                          <button key={s} type="button" className="leg-sugerido-item"
                            onMouseDown={() => { setTrOrigenCiudad(s); setShowOrigenSuger(false); }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {buscarCiudadFlex(trOrigenCiudad)?.nombre === 'Bogotá' && !BOGOTA_LOC_COORDS[trOrigenCiudad] && (
                    <div className="form-group">
                      <label>Localidad de origen</label>
                      <select value={trOrigenLocalidad} onChange={e => setTrOrigenLocalidad(e.target.value)}>
                        <option value="">— selecciona —</option>
                        {LOCALIDADES_BOGOTA.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="anticipo-grid-3">
                  <div className="form-group">
                    <label>Departamento de destino</label>
                    <select value={trDepto} onChange={e => {
                      const d = e.target.value;
                      setTrDepto(d);
                      setTrCiudad(COLOMBIA[d]?.[0] || '');
                      setTrLocalidad('');
                    }}>
                      {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Ciudad / Municipio</label>
                    <select value={trCiudad} onChange={e => setTrCiudad(e.target.value)}>
                      {trCiudades.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {esBogotaDest && (
                    <div className="form-group">
                      <label>Localidad <span style={{ opacity: 0.6 }}>(opcional)</span></label>
                      <select value={trLocalidad} onChange={e => setTrLocalidad(e.target.value)}>
                        <option value="">— selecciona —</option>
                        {LOCALIDADES_BOGOTA.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="anticipo-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 10 }}>
                  <div className="form-group">
                    <label>Modo de transporte</label>
                    <select value={trMode} onChange={e => setTrMode(e.target.value)}>
                      {MODOS_TRANSPORTE.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>N° de trayectos</label>
                    <input type="number" min="1" value={trTrayectos} onChange={e => setTrTrayectos(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Valor por trayecto ($)</label>
                    <input
                      type="text" inputMode="numeric" placeholder="0" style={{ textAlign: 'right' }}
                      value={trValor ? fmtN(parseV(trValor)) : ''}
                      onChange={e => setTrValor(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                {isApp && (
                  <div className="anticipo-hint-precios" style={{ marginTop: 12 }}>
                    <span className="anticipo-hint-title">
                      💡 Estimador de precio — {MODOS_TRANSPORTE.find(m => m.key === trMode)?.label}
                    </span>

                    {/* Clima auto-detectado para ciudad de destino */}
                    {climaAuto && (
                      <div className="anticipo-calc-indicadores" style={{ marginBottom: 8 }}>
                        <span className={`anticipo-calc-badge ${esLluvioso ? 'lluvia' : 'normal'}`}>
                          {climaAuto.emoji} {trCiudad}: {climaAuto.descripcion} · {climaAuto.temperatura}°C
                        </span>
                        <label className="anticipo-calc-check" style={{ fontSize: 11, marginLeft: 6 }}>
                          <input
                            type="checkbox"
                            checked={trLluviaOverride ?? esLluviosoAuto}
                            onChange={e => setTrLluviaOverride(e.target.checked === esLluviosoAuto ? null : e.target.checked)}
                          />
                          Marcar lluvia manualmente
                        </label>
                      </div>
                    )}

                    {trKmCalculado > 0 ? (
                      <>
                        <div className="anticipo-calc-indicadores">
                          <span className="anticipo-calc-badge normal">📏 {trKmCalculado} km calculados</span>
                          {isHoraPico && <span className="anticipo-calc-badge pico">⏱ Hora pico +25%</span>}
                          {isNoche    && <span className="anticipo-calc-badge noche">🌙 Noche +15%</span>}
                          {esLluvioso && <span className="anticipo-calc-badge lluvia">🌧️ Lluvia +25%</span>}
                          {!isHoraPico && !isNoche && !esLluvioso && <span className="anticipo-calc-badge normal">✓ Condiciones normales</span>}
                        </div>
                        <div className="anticipo-calc-resultado">
                          Estimado por trayecto:&nbsp;
                          <strong>$ {fmtN(trEstMin)}{trEstMax > trEstMin ? ` – $ ${fmtN(trEstMax)}` : ''}</strong>
                        </div>
                        <p className="anticipo-hint-nota" style={{ marginTop: 4 }}>
                          Base $ {baseKmRate.toLocaleString('es-CO')}/km · hora actual: {Math.floor(horaD)}:{String(Math.round((horaD % 1) * 60)).padStart(2, '0')}
                        </p>
                        <button
                          type="button" className="admin-ghost-button"
                          style={{ marginTop: 8, fontSize: 12 }}
                          onClick={() => setTrValor(String(Math.round((trEstMin + trEstMax) / 2)))}
                        >
                          ↑ Usar promedio ($ {fmtN(Math.round((trEstMin + trEstMax) / 2))})
                        </button>
                      </>
                    ) : (
                      <>
                        {!trOrigenCiudad && (
                          <p className="anticipo-hint-nota" style={{ marginTop: 4, marginBottom: 6 }}>
                            Ingresa el <strong>punto de partida</strong> para calcular km y precio automáticamente.
                          </p>
                        )}
                        <div className="anticipo-precios-grid" style={{ marginTop: 6 }}>
                          <span>Trayecto corto (&lt; 5 km)</span>
                          <span>{isMotoApp ? '$ 5.000 – $ 8.000' : '$ 8.000 – $ 18.000'}</span>
                          <span>Trayecto medio (5 – 15 km)</span>
                          <span>{isMotoApp ? '$ 7.000 – $ 18.000' : '$ 15.000 – $ 35.000'}</span>
                          <span>Trayecto largo (&gt; 15 km)</span>
                          <span>{isMotoApp ? '$ 15.000 – $ 30.000' : '$ 25.000 – $ 55.000'}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {subTransporte > 0 && (
                  <div className="anticipo-sub-row">
                    Subtotal transporte ({numTr} × $ {fmtN(parseV(trValor))}): <strong>$ {fmtN(subTransporte)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Hospedaje ── */}
          <div className={`anticipo-categoria${useHospedaje ? ' activa' : ''}`}>
            <label className="anticipo-cat-header">
              <input type="checkbox" checked={useHospedaje} onChange={e => setUseHospedaje(e.target.checked)} />
              <span>🏨 Hospedaje / Alojamiento</span>
              {useHospedaje && subHospedaje > 0 && <strong className="anticipo-subtotal-badge">$ {fmtN(subHospedaje)}</strong>}
              {topeWarn('topeHospedaje', subHospedaje)}
            </label>
            {useHospedaje && (
              <div className="anticipo-cat-body">
                <div className="anticipo-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Hotel / Lugar de alojamiento</label>
                    <input type="text" placeholder="Nombre del hotel o alojamiento" value={hospLugar} onChange={e => setHospLugar(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>N° de noches</label>
                    <input type="number" min="1" value={hospNoches} onChange={e => setHospNoches(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Valor por noche ($)</label>
                    <input
                      type="text" inputMode="numeric" placeholder="0" style={{ textAlign: 'right' }}
                      value={hospValorNoche ? fmtN(parseV(hospValorNoche)) : ''}
                      onChange={e => setHospValorNoche(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
                {subHospedaje > 0 && (
                  <div className="anticipo-sub-row">
                    Subtotal hospedaje ({hospNoches} noche(s)): <strong>$ {fmtN(subHospedaje)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Alimentación ── */}
          <div className={`anticipo-categoria${useAlimentacion ? ' activa' : ''}`}>
            <label className="anticipo-cat-header">
              <input type="checkbox" checked={useAlimentacion} onChange={e => setUseAlimentacion(e.target.checked)} />
              <span>🍽️ Alimentación</span>
              {useAlimentacion && subAlim > 0 && <strong className="anticipo-subtotal-badge">$ {fmtN(subAlim)}</strong>}
              {topeWarn('topeAlimentacion', subAlim)}
            </label>
            {useAlimentacion && (
              <div className="anticipo-cat-body">
                <div className="anticipo-alim-tabla">
                  <div className="anticipo-alim-hdr-row">
                    <span></span>
                    <span>Días</span>
                    <span>Valor / día ($)</span>
                    <span>Subtotal</span>
                  </div>
                  {[
                    { label: 'Desayuno', dias: alimDesD, setDias: setAlimDesD, val: alimDesV, setVal: setAlimDesV },
                    { label: 'Almuerzo', dias: alimAlmD, setDias: setAlimAlmD, val: alimAlmV, setVal: setAlimAlmV },
                    { label: 'Cena',     dias: alimCenD, setDias: setAlimCenD, val: alimCenV, setVal: setAlimCenV },
                  ].map(({ label, dias, setDias, val, setVal }) => (
                    <div key={label} className="anticipo-alim-row">
                      <span className="anticipo-alim-label">{label}</span>
                      <input type="number" min="0" value={dias} onChange={e => setDias(e.target.value)} />
                      <input
                        type="text" inputMode="numeric" placeholder="0" style={{ textAlign: 'right' }}
                        value={val ? fmtN(parseV(val)) : ''}
                        onChange={e => setVal(e.target.value.replace(/\D/g, ''))}
                      />
                      <span className="anticipo-alim-sub">$ {fmtN((parseInt(dias)||0)*parseV(val))}</span>
                    </div>
                  ))}
                </div>
                {subAlim > 0 && (
                  <div className="anticipo-sub-row">
                    Subtotal alimentación: <strong>$ {fmtN(subAlim)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Materiales e insumos ── */}
          <div className={`anticipo-categoria${useMateriales ? ' activa' : ''}`}>
            <label className="anticipo-cat-header">
              <input type="checkbox" checked={useMateriales} onChange={e => setUseMateriales(e.target.checked)} />
              <span>📦 Materiales e insumos</span>
              {useMateriales && subMat > 0 && <strong className="anticipo-subtotal-badge">$ {fmtN(subMat)}</strong>}
              {topeWarn('topeMateriales', subMat)}
            </label>
            {useMateriales && (
              <div className="anticipo-cat-body">
                {materiales.map((m) => (
                  <div key={m.id} className="anticipo-mat-row">
                    <input
                      type="text" placeholder="Descripción del material o insumo" style={{ flex: 2 }}
                      value={m.desc}
                      onChange={e => setMatF(m.id, 'desc', e.target.value)}
                    />
                    <input
                      type="text" inputMode="numeric" placeholder="$ 0" style={{ flex: 1, textAlign: 'right' }}
                      value={m.valor ? fmtN(parseV(m.valor)) : ''}
                      onChange={e => setMatF(m.id, 'valor', e.target.value.replace(/\D/g, ''))}
                    />
                    {materiales.length > 1 && (
                      <button type="button" className="admin-ghost-button" style={{ padding: '4px 10px', flexShrink: 0 }} onClick={() => rmMat(m.id)}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" className="admin-ghost-button" style={{ marginTop: 6 }} onClick={addMat}>+ Agregar ítem</button>
                {subMat > 0 && (
                  <div className="anticipo-sub-row">Subtotal materiales: <strong>$ {fmtN(subMat)}</strong></div>
                )}
              </div>
            )}
          </div>

          {/* ── Capacitación / Evento ── */}
          <div className={`anticipo-categoria${useCapacitacion ? ' activa' : ''}`}>
            <label className="anticipo-cat-header">
              <input type="checkbox" checked={useCapacitacion} onChange={e => setUseCapacitacion(e.target.checked)} />
              <span>🎓 Capacitación / Evento</span>
              {useCapacitacion && subCap > 0 && <strong className="anticipo-subtotal-badge">$ {fmtN(subCap)}</strong>}
              {topeWarn('topeCapacitacion', subCap)}
            </label>
            {useCapacitacion && (
              <div className="anticipo-cat-body">
                <div className="anticipo-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Nombre del evento / curso <span className="req">*</span></label>
                    <input type="text" placeholder="Ej: Congreso de salud pública" value={capNombre} onChange={e => setCapNombre(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Institución organizadora</label>
                    <input type="text" placeholder="Ej: Ministerio de Salud" value={capInstitucion} onChange={e => setCapInstitucion(e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ maxWidth: 220 }}>
                  <label>Valor inscripción / registro ($) <span className="req">*</span></label>
                  <input
                    type="text" inputMode="numeric" placeholder="0" style={{ textAlign: 'right' }}
                    value={capValor ? fmtN(parseV(capValor)) : ''}
                    onChange={e => setCapValor(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                {subCap > 0 && (
                  <div className="anticipo-sub-row">Subtotal capacitación: <strong>$ {fmtN(subCap)}</strong></div>
                )}
              </div>
            )}
          </div>

          {/* ── Otro ── */}
          <div className={`anticipo-categoria${useOtro ? ' activa' : ''}`}>
            <label className="anticipo-cat-header">
              <input type="checkbox" checked={useOtro} onChange={e => setUseOtro(e.target.checked)} />
              <span>📋 Otro concepto</span>
              {useOtro && subOtro > 0 && <strong className="anticipo-subtotal-badge">$ {fmtN(subOtro)}</strong>}
              {topeWarn('topeOtro', subOtro)}
            </label>
            {useOtro && (
              <div className="anticipo-cat-body">
                <div className="anticipo-grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Descripción del gasto <span className="req">*</span></label>
                    <input type="text" placeholder="¿En qué se gastará?" value={otroDesc} onChange={e => setOtroDesc(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Valor ($) <span className="req">*</span></label>
                    <input
                      type="text" inputMode="numeric" placeholder="0" style={{ textAlign: 'right' }}
                      value={otroValor ? fmtN(parseV(otroValor)) : ''}
                      onChange={e => setOtroValor(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
                {subOtro > 0 && (
                  <div className="anticipo-sub-row">Subtotal otro: <strong>$ {fmtN(subOtro)}</strong></div>
                )}
              </div>
            )}
          </div>

          {/* Total general */}
          {total > 0 && (
            <div className="anticipo-total-box" style={{ marginTop: 16 }}>
              <div className="anticipo-total-row">
                <span>Total solicitado</span>
                <strong className="anticipo-total-valor">$ {fmtN(total)}</strong>
              </div>
              <div className="anticipo-total-letras">{numeroAPesosEnLetras(String(total))}</div>
              {(topes as Record<string,number>)['topeTotal'] && total > ((topes as Record<string,number>)['topeTotal'] as number) && (
                <div style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>
                  ⚠ Supera el tope total configurado de $ {fmtN((topes as Record<string,number>)['topeTotal'] as number)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ PASO 3: Resumen y firma ═══ */}
      {paso === 3 && (
        <div className="anticipo-paso">
          <h4 className="anticipo-paso-titulo">Resumen y firma</h4>

          {/* Resumen */}
          <div className="anticipo-resumen-section">
            <h5 style={{ marginBottom: 8 }}>Desglose del anticipo</h5>
            <table className="anticipo-resumen-tabla">
              <thead>
                <tr><th>Concepto</th><th>Detalle</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
              </thead>
              <tbody>
                {buildItems().map((it, i) => (
                  <tr key={i}>
                    <td><strong>{it.concepto}</strong></td>
                    <td style={{ fontSize: 12, opacity: 0.85 }}>{it.descripcion}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>$ {fmtN(parseInt(it.valor))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}><strong>TOTAL SOLICITADO</strong></td>
                  <td style={{ textAlign: 'right' }}><strong>$ {fmtN(total)}</strong></td>
                </tr>
              </tfoot>
            </table>
            <p style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>{numeroAPesosEnLetras(String(total))}</p>
            {fechaEvento && <p style={{ fontSize: 13, marginTop: 4 }}>Fecha: <strong>{fechaEvento}</strong></p>}
            <p style={{ fontSize: 13, marginTop: 2 }}>Autorizado por: <strong>{autorizadorNombre}</strong></p>
          </div>

          {/* Compromiso de legalización */}
          <div className="anticipo-resumen-section">
            <h5 style={{ marginBottom: 6 }}>Compromiso de legalización</h5>
            <div className="admin-help-text" style={{ padding: '10px 14px', background: 'var(--color-bg-alt, #f8f6ed)', borderRadius: 8, borderLeft: '3px solid #d4a017' }}>
              ⏱ Una vez aprobado tu anticipo, tendrás <strong>3 días hábiles</strong> para presentar facturas y soportes que respalden el gasto. Si sobra dinero, debes devolverlo; si falta, declarar la diferencia.
            </div>
          </div>

          {/* Cuenta para el desembolso */}
          <div className="anticipo-resumen-section">
            <h5 style={{ marginBottom: 8 }}>Cuenta para el desembolso</h5>
            <p className="admin-help-text" style={{ marginBottom: 10 }}>
              Pre-cargada desde tu perfil. Edítala aquí si es necesario.
            </p>
            <div className="anticipo-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Banco <span className="req">*</span></label>
                <select value={banco} onChange={e => setBanco(e.target.value)}>
                  <option value="">— selecciona —</option>
                  {BANCOS_COLOMBIA.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de cuenta</label>
                <select value={tipoCuenta} onChange={e => setTipoCuenta(e.target.value)}>
                  {TIPOS_CUENTA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>N° de cuenta <span className="req">*</span></label>
                <input
                  type="text" inputMode="numeric" placeholder="0000000000"
                  value={numeroCuenta}
                  onChange={e => setNumeroCuenta(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
            {titularCuenta && (
              <p style={{ fontSize: 13, marginTop: 4 }}>Titular: <strong>{titularCuenta}</strong></p>
            )}
          </div>

          {/* Compromiso */}
          <div className="anticipo-compromiso-box">
            <p>
              Yo, <strong>{nombreSesion || 'el/la solicitante'}</strong>, declaro que la información
              suministrada es verídica y me comprometo a legalizar el anticipo de{' '}
              <strong>$ {fmtN(total)}</strong> ({numeroAPesosEnLetras(String(total))})
              mediante la presentación de los soportes correspondientes dentro del plazo
              establecido, conforme a la política de anticipos vigente.
            </p>
          </div>

          <div className="form-group form-group--wide" style={{ marginTop: 16 }}>
            <label>Firma digital <span className="req">*</span></label>
            <SignaturePad onChange={setFirma} />
          </div>
        </div>
      )}

      {/* Navegación */}
      <div className="nueva-sol-actions">
        {paso > 1 && (
          <button type="button" className="admin-ghost-button" onClick={() => { setError(''); setPaso(p => p - 1); }}>
            ← Anterior
          </button>
        )}
        {paso < 3 ? (
          <button type="button" className="admin-primary-button" onClick={siguiente}>
            Siguiente →
          </button>
        ) : (
          <button
            type="button"
            className="admin-primary-button"
            disabled={enviando || !firma}
            onClick={enviar}
          >
            {enviando ? 'Enviando…' : '📤 Enviar solicitud de anticipo'}
          </button>
        )}
      </div>
    </div>
  );
}
