import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/http/api';
import { formatearMiles } from '../../utils/numeroALetras';
import { SignaturePad } from '../../components/SignaturePad';
import { useOcrDocument, validarOcrContraDato } from '../../hooks/useOcrDocument';

/* ─── Ciudades Colombia ──────────────────────────────────────── */
const CIUDADES_CO = [
  'Bogotá', 'Medellín', 'Cali', 'Cartagena', 'Barranquilla', 'Bucaramanga',
  'Pereira', 'Santa Marta', 'Cúcuta', 'Manizales', 'Armenia', 'Ibagué',
  'Montería', 'Villavicencio', 'Pasto', 'Neiva', 'Valledupar', 'San Andrés',
  'Popayán', 'Leticia', 'Florencia', 'Yopal', 'Riohacha', 'Tunja',
  'Duitama', 'Sogamoso', 'Santa Rosa de Viterbo', 'Chiquinquirá', 'Zipaquirá',
  'Facatativá', 'Girardot', 'Espinal', 'Honda', 'Barrancabermeja', 'Sincelejo',
  'Rionegro', 'Envigado', 'Bello', 'Palmira', 'Buenaventura',
];

/* ─── Precios de referencia por ruta ────────────────────────── */
const IATA_MAP: Record<string, string> = {
  'Bogotá': 'BOG', 'Medellín': 'MDE', 'Cali': 'CLO', 'Cartagena': 'CTG',
  'Barranquilla': 'BAQ', 'Bucaramanga': 'BGA', 'Pereira': 'PEI',
  'Santa Marta': 'SMR', 'Cúcuta': 'CUC', 'Manizales': 'MZL',
  'Armenia': 'AXM', 'Ibagué': 'IBE', 'Montería': 'MTR',
  'Villavicencio': 'VVC', 'Pasto': 'PSO', 'Neiva': 'HEI',
  'Valledupar': 'VUP', 'San Andrés': 'ADZ', 'Popayán': 'PPN',
  'Leticia': 'LET', 'Yopal': 'EYP', 'Riohacha': 'RCH',
};

interface PrecioRef { aereo?: [number, number]; terrestre?: [number, number] }

const PRECIOS_REF: Record<string, PrecioRef> = {
  'BOG-MDE': { aereo: [220000, 580000], terrestre: [50000, 120000] },
  'BOG-CTG': { aereo: [260000, 640000], terrestre: [200000, 340000] },
  'BOG-CLO': { aereo: [200000, 560000], terrestre: [80000, 175000] },
  'BOG-BAQ': { aereo: [245000, 630000], terrestre: [220000, 390000] },
  'BOG-BGA': { aereo: [185000, 480000], terrestre: [55000, 135000] },
  'BOG-PEI': { aereo: [165000, 430000], terrestre: [32000, 68000] },
  'BOG-SMR': { aereo: [255000, 620000], terrestre: [235000, 400000] },
  'BOG-MZL': { aereo: [175000, 450000], terrestre: [32000, 72000] },
  'BOG-CUC': { aereo: [210000, 545000], terrestre: [130000, 245000] },
  'BOG-VVC': { aereo: [160000, 405000], terrestre: [50000, 115000] },
  'BOG-PSO': { aereo: [230000, 590000], terrestre: [180000, 310000] },
  'BOG-HEI': { aereo: [195000, 500000], terrestre: [80000, 155000] },
  'BOG-MTR': { aereo: [235000, 600000], terrestre: [165000, 290000] },
  'BOG-AXM': { aereo: [165000, 430000], terrestre: [28000, 60000] },
  'BOG-IBE': { terrestre: [22000, 48000] },
  'BOG-ADZ': { aereo: [280000, 720000] },
  'BOG-LET': { aereo: [340000, 900000] },
  'MDE-CTG': { aereo: [235000, 595000], terrestre: [150000, 275000] },
  'MDE-CLO': { aereo: [195000, 500000], terrestre: [55000, 125000] },
  'MDE-BAQ': { aereo: [230000, 575000], terrestre: [140000, 265000] },
  'MDE-BGA': { aereo: [200000, 510000], terrestre: [80000, 165000] },
  'MDE-SMR': { aereo: [245000, 610000], terrestre: [170000, 310000] },
  'MDE-CUC': { aereo: [215000, 555000], terrestre: [110000, 220000] },
  'CTG-BAQ': { terrestre: [28000, 65000] },
  'CTG-SMR': { terrestre: [38000, 80000] },
  'CLO-PEI': { aereo: [160000, 405000], terrestre: [28000, 58000] },
  'CLO-MZL': { terrestre: [32000, 68000] },
  'CLO-BAQ': { aereo: [220000, 560000], terrestre: [240000, 410000] },
  'BGA-CUC': { terrestre: [45000, 90000] },
  'PEI-MZL': { terrestre: [12000, 28000] },
};

function getPreciosRef(origen: string, destino: string): PrecioRef | null {
  const o = IATA_MAP[origen] || origen.slice(0, 3).toUpperCase();
  const d = IATA_MAP[destino] || destino.slice(0, 3).toUpperCase();
  return PRECIOS_REF[`${o}-${d}`] || PRECIOS_REF[`${d}-${o}`] || null;
}

/* ─── Tipos ─────────────────────────────────────────────────── */
interface UsuarioSugerido { id: number; nombreCompleto: string; rol: string; area: string | null; }
interface FacturaAdj { archivoId: string; nombre: string; alertas: string[]; }
interface OpcionViaje { id: string; tipo: 'vuelo' | 'bus' | 'vuelo_escala'; empresa: string; salida: string; llegada: string; duracion: string; precio: number; esEstimado: boolean; }

/* ─── Helpers ───────────────────────────────────────────────── */
async function prepararImagen(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1600;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file),
        'image/jpeg', 0.82,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function subirArchivo(file: File): Promise<string> {
  const prepared = await prepararImagen(file);
  const fd = new FormData();
  fd.append('archivo', prepared);
  const r = await api.post<{ id: string }>('/archivos', fd, { headers: { 'Content-Type': undefined } });
  return r.data.id;
}

function fmtValor(v: string) {
  const n = parseInt(v.replace(/\D/g, '')) || 0;
  return n > 0 ? formatearMiles(n) : '';
}

/* ─── Sub-formulario de tiquete ────────────────────────────── */
interface TiqueteFormProps {
  titulo: string;
  ciudadOrigen: string;
  ciudadDestino: string;
  fecha: string;
  tipo: 'aereo' | 'terrestre';
  onTipo: (v: 'aereo' | 'terrestre') => void;
  empresa: string; onEmpresa: (v: string) => void;
  numDoc: string; onNumDoc: (v: string) => void;
  codReserva: string; onCodReserva: (v: string) => void;
  tramo: string; onTramo: (v: string) => void;
  puesto: string; onPuesto: (v: string) => void;
  horaSalida: string; onHoraSalida: (v: string) => void;
  horaLlegada: string; onHoraLlegada: (v: string) => void;
  valor: string; onValor: (v: string) => void;
}

function TiqueteForm({
  titulo, ciudadOrigen, ciudadDestino, fecha, tipo, onTipo,
  empresa, onEmpresa, numDoc, onNumDoc, codReserva, onCodReserva,
  tramo, onTramo, puesto, onPuesto,
  horaSalida, onHoraSalida, horaLlegada, onHoraLlegada,
  valor, onValor,
}: TiqueteFormProps) {
  return (
    <div className="viatico-tiquete-bloque">
      <div className="viatico-tiquete-titulo">{titulo}</div>
      <p className="leg-nota">{ciudadOrigen} → {ciudadDestino} · {fecha}</p>

      {/* Tipo de transporte */}
      <div className="leg-field">
        <label>Tipo de transporte *</label>
        <div className="viaticos-tipo-transport-row">
          <button type="button"
            className={`viatico-tr-btn${tipo === 'aereo' ? ' selected' : ''}`}
            onClick={() => onTipo('aereo')}>
            ✈ Aéreo
          </button>
          <button type="button"
            className={`viatico-tr-btn${tipo === 'terrestre' ? ' selected' : ''}`}
            onClick={() => onTipo('terrestre')}>
            🚌 Terrestre
          </button>
        </div>
      </div>

      <div className="leg-gasto-fields">
        <div className="leg-field">
          <label>Empresa transportadora *</label>
          <input type="text" value={empresa} onChange={(e) => onEmpresa(e.target.value)}
            placeholder={tipo === 'aereo' ? 'Ej: Avianca, LATAM, Aero República' : 'Ej: COOFLOTAX, Flota Magdalena'} />
        </div>

        <div className="leg-field">
          <label>{tipo === 'aereo' ? 'Número de vuelo *' : 'Número de tiquete *'}</label>
          <input type="text" value={numDoc} onChange={(e) => onNumDoc(e.target.value.toUpperCase())}
            placeholder={tipo === 'aereo' ? 'Ej: AV 8001, P5 7506' : 'Ej: DEST4-83964'} />
        </div>

        {tipo === 'aereo' && (
          <div className="leg-field">
            <label>Código de reserva</label>
            <input type="text" value={codReserva} onChange={(e) => onCodReserva(e.target.value.toUpperCase())}
              placeholder="Ej: J48SQO" maxLength={10} />
          </div>
        )}

        {tipo === 'terrestre' && (
          <>
            <div className="leg-field">
              <label>Tramo / Ruta</label>
              <input type="text" value={tramo} onChange={(e) => onTramo(e.target.value)}
                placeholder="Ej: SANTA ROSA - DUITAMA" />
            </div>
            <div className="leg-field">
              <label>Puesto / Silla</label>
              <input type="text" value={puesto} onChange={(e) => onPuesto(e.target.value)}
                placeholder="Ej: 3, 12A" maxLength={6} />
            </div>
          </>
        )}

        <div className="leg-field">
          <label>Hora de salida</label>
          <input type="time" value={horaSalida} onChange={(e) => onHoraSalida(e.target.value)} />
        </div>

        <div className="leg-field">
          <label>Hora de llegada</label>
          <input type="time" value={horaLlegada} onChange={(e) => onHoraLlegada(e.target.value)} />
        </div>

        <div className="leg-field">
          <label>Valor total del tiquete ($) *</label>
          <input type="text" inputMode="numeric" value={fmtValor(valor) ? `$${fmtValor(valor)}` : ''}
            onChange={(e) => onValor(e.target.value.replace(/\D/g, ''))}
            placeholder="$ 0" />
        </div>
      </div>
    </div>
  );
}

/* ─── Panel Viáticos ────────────────────────────────────────── */
export function ViaticosPanel({ onCreada }: { onCreada?: (info: { id: number; numeroRadicado: string }) => void }) {
  const [paso, setPaso] = useState<1 | 2 | 3 | 4 | 5>(1);

  /* Paso 1 */
  const [tipoViatico, setTipoViatico] = useState<'anticipo' | 'legalizar' | ''>('');
  const [autorizadorInput, setAutorizadorInput] = useState('');
  const [autorizadorId, setAutorizadorId] = useState(0);
  const [autorizadorNombre, setAutorizadorNombre] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioSugerido[]>([]);
  const [showSugeridos, setShowSugeridos] = useState(false);
  const [motivoViaje, setMotivoViaje] = useState('');

  /* Paso 2 */
  const [ciudadOrigen, setCiudadOrigen] = useState('');
  const [ciudadDestino, setCiudadDestino] = useState('');
  const [esIdaVuelta, setEsIdaVuelta] = useState(true);
  const [fechaIda, setFechaIda] = useState('');
  const [fechaRegreso, setFechaRegreso] = useState('');

  /* Paso 3 — tiquete IDA */
  const [tipoTrIda, setTipoTrIda] = useState<'aereo' | 'terrestre'>('aereo');
  const [empresaIda, setEmpresaIda] = useState('');
  const [numDocIda, setNumDocIda] = useState('');
  const [codResIda, setCodResIda] = useState('');
  const [tramoIda, setTramoIda] = useState('');
  const [puestoIda, setPuestoIda] = useState('');
  const [hrSalidaIda, setHrSalidaIda] = useState('');
  const [hrLlegadaIda, setHrLlegadaIda] = useState('');
  const [valorIda, setValorIda] = useState('');

  /* Paso 3 — tiquete VUELTA */
  const [tipoTrVuelta, setTipoTrVuelta] = useState<'aereo' | 'terrestre'>('aereo');
  const [empresaVuelta, setEmpresaVuelta] = useState('');
  const [numDocVuelta, setNumDocVuelta] = useState('');
  const [codResVuelta, setCodResVuelta] = useState('');
  const [tramoVuelta, setTramoVuelta] = useState('');
  const [puestoVuelta, setPuestoVuelta] = useState('');
  const [hrSalidaVuelta, setHrSalidaVuelta] = useState('');
  const [hrLlegadaVuelta, setHrLlegadaVuelta] = useState('');
  const [valorVuelta, setValorVuelta] = useState('');

  const [facturaTransporte, setFacturaTransporte] = useState<FacturaAdj | null>(null);
  const [subiendoTransporte, setSubiendoTransporte] = useState(false);

  /* Paso 4 — hospedaje */
  const [tieneHospedaje, setTieneHospedaje] = useState(false);
  const [hotelNombre, setHotelNombre] = useState('');
  const [hotelEntrada, setHotelEntrada] = useState('');
  const [hotelSalida, setHotelSalida] = useState('');
  const [hotelValorNoche, setHotelValorNoche] = useState('');
  const [facturaHotel, setFacturaHotel] = useState<FacturaAdj | null>(null);
  const [subiendoHotel, setSubiendoHotel] = useState(false);

  /* Paso 4 — alimentación */
  const [diasDesayuno, setDiasDesayuno] = useState('');
  const [valorDesayuno, setValorDesayuno] = useState('');
  const [diasAlmuerzo, setDiasAlmuerzo] = useState('');
  const [valorAlmuerzo, setValorAlmuerzo] = useState('');
  const [diasCena, setDiasCena] = useState('');
  const [valorCena, setValorCena] = useState('');
  const [facturaComidas, setFacturaComidas] = useState<FacturaAdj | null>(null);
  const [subiendoComidas, setSubiendoComidas] = useState(false);

  /* Paso 5 */
  const [firma, setFirma] = useState('');

  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);

  const fileTransporteRef = useRef<HTMLInputElement>(null);
  const fileHotelRef = useRef<HTMLInputElement>(null);
  const fileComidasRef = useRef<HTMLInputElement>(null);

  const { procesarArchivo } = useOcrDocument();

  useEffect(() => {
    api.get<UsuarioSugerido[]>('/usuarios/nombres').then((r) => setUsuarios(r.data)).catch(() => {});
  }, []);

  const sugeridos = useMemo(() => {
    const term = autorizadorInput.trim().toLowerCase();
    if (term.length < 2) return [];
    return usuarios.filter((u) => u.nombreCompleto.toLowerCase().includes(term)).slice(0, 8);
  }, [autorizadorInput, usuarios]);

  function elegirAutorizador(u: UsuarioSugerido) {
    setAutorizadorId(u.id);
    setAutorizadorNombre(u.nombreCompleto);
    setAutorizadorInput(u.nombreCompleto);
    setShowSugeridos(false);
  }

  const preciosRef = useMemo(() => getPreciosRef(ciudadOrigen, ciudadDestino), [ciudadOrigen, ciudadDestino]);

  /* ─── API precios de viaje ──────────────────────────────────── */
  const [opcionesViaje, setOpcionesViaje] = useState<OpcionViaje[]>([]);
  const [opcionesRegreso, setOpcionesRegreso] = useState<OpcionViaje[]>([]);
  const [cargandoPrecios, setCargandoPrecios] = useState(false);
  const [fuentePrecios, setFuentePrecios] = useState<'api' | 'estimado' | null>(null);

  useEffect(() => {
    if (paso !== 3 || !ciudadOrigen || !ciudadDestino || !fechaIda) return;
    let cancelled = false;
    setCargandoPrecios(true);
    setOpcionesViaje([]);
    setOpcionesRegreso([]);
    const qs = new URLSearchParams({
      origen: ciudadOrigen,
      destino: ciudadDestino,
      fecha_ida: fechaIda,
      ...(esIdaVuelta && fechaRegreso ? { fecha_regreso: fechaRegreso } : {}),
    });
    api.get<{ opciones: OpcionViaje[]; opcionesRegreso: OpcionViaje[]; fuente: string }>(`/viajes/buscar?${qs}`)
      .then((r) => {
        if (cancelled) return;
        setOpcionesViaje(r.data.opciones ?? []);
        setOpcionesRegreso(r.data.opcionesRegreso ?? []);
        setFuentePrecios(r.data.fuente === 'api' ? 'api' : 'estimado');
      })
      .catch(() => { /* silencioso: usará PRECIOS_REF estático */ })
      .finally(() => { if (!cancelled) setCargandoPrecios(false); });
    return () => { cancelled = true; };
  }, [paso, ciudadOrigen, ciudadDestino, fechaIda, fechaRegreso, esIdaVuelta]);

  const totalTransporte = useMemo(() => {
    const ida = parseInt(valorIda.replace(/\D/g, '')) || 0;
    const vuelta = esIdaVuelta ? (parseInt(valorVuelta.replace(/\D/g, '')) || 0) : 0;
    return ida + vuelta;
  }, [valorIda, valorVuelta, esIdaVuelta]);

  const subirFactura = useCallback(async (
    file: File,
    tipo: 'transporte' | 'hotel' | 'comidas',
    contexto: { valor?: number; ciudad?: string; fecha?: string },
  ) => {
    const setSubiendo = tipo === 'transporte' ? setSubiendoTransporte : tipo === 'hotel' ? setSubiendoHotel : setSubiendoComidas;
    const setFactura = tipo === 'transporte' ? setFacturaTransporte : tipo === 'hotel' ? setFacturaHotel : setFacturaComidas;
    setSubiendo(true);
    try {
      const archivoId = await subirArchivo(file);
      const alertas: string[] = [];
      const ocr = await procesarArchivo(file).catch(() => null);
      if (ocr) {
        const texto = ocr.text;
        const t = texto.toLowerCase();
        if (ocr.confidence < 45) alertas.push(`Imagen de baja calidad (${Math.round(ocr.confidence)}%). Verifica que sea legible.`);
        if (contexto.valor && contexto.valor > 0) {
          const limpio = String(contexto.valor).replace(/\D/g, '');
          if (limpio.length >= 4) {
            const v = validarOcrContraDato(texto, limpio, 'cc');
            if (!v.coincide) alertas.push(`El valor $${formatearMiles(contexto.valor)} no se identificó claramente en el soporte.`);
          }
        }
        if (contexto.ciudad) {
          const v = validarOcrContraDato(texto, contexto.ciudad, 'texto');
          if (!v.coincide) alertas.push(`No se identificó "${contexto.ciudad}" en el soporte.`);
        }
        const marcadores = ['total', 'nit', 'valor', 'fecha', 'factura', 'tiquete', 'vuelo'].filter((k) => t.includes(k)).length;
        if (marcadores < 2) alertas.push('El archivo no parece ser un tiquete válido. Verifica el documento.');
      }
      setFactura({ archivoId, nombre: file.name, alertas });
    } catch {
      setFactura({ archivoId: '', nombre: '', alertas: ['No se pudo subir el archivo. Intenta de nuevo.'] });
    } finally {
      setSubiendo(false);
    }
  }, [procesarArchivo]);

  /* Cálculos */
  const noches = useMemo(() => {
    if (!tieneHospedaje || !hotelEntrada || !hotelSalida) return 0;
    return Math.max(0, Math.round((new Date(hotelSalida).getTime() - new Date(hotelEntrada).getTime()) / 86400000));
  }, [tieneHospedaje, hotelEntrada, hotelSalida]);

  const totalHospedaje = useMemo(() => tieneHospedaje ? (parseInt(hotelValorNoche) || 0) * noches : 0, [tieneHospedaje, hotelValorNoche, noches]);
  const totalComidas = useMemo(() => {
    return (parseInt(diasDesayuno) || 0) * (parseInt(valorDesayuno) || 0)
      + (parseInt(diasAlmuerzo) || 0) * (parseInt(valorAlmuerzo) || 0)
      + (parseInt(diasCena) || 0) * (parseInt(valorCena) || 0);
  }, [diasDesayuno, valorDesayuno, diasAlmuerzo, valorAlmuerzo, diasCena, valorCena]);
  const totalGeneral = useMemo(() => totalTransporte + totalHospedaje + totalComidas, [totalTransporte, totalHospedaje, totalComidas]);

  function validarPaso(): string {
    if (paso === 1) {
      if (!tipoViatico) return 'Selecciona si es anticipo o legalización de viático';
      if (!autorizadorId) return 'Selecciona el autorizador del viaje de la lista';
      if (autorizadorInput.trim() !== autorizadorNombre) return 'Selecciona el autorizador de la lista de sugerencias';
      if (!motivoViaje.trim()) return 'Describe el motivo o propósito del viaje';
    }
    if (paso === 2) {
      if (!ciudadOrigen) return 'Selecciona la ciudad de origen';
      if (!ciudadDestino) return 'Selecciona la ciudad de destino';
      if (ciudadOrigen === ciudadDestino) return 'Origen y destino deben ser diferentes';
      if (!fechaIda) return 'Indica la fecha de ida';
      if (esIdaVuelta && !fechaRegreso) return 'Indica la fecha de regreso';
      if (esIdaVuelta && fechaRegreso && fechaRegreso < fechaIda) return 'La fecha de regreso debe ser posterior a la de ida';
    }
    if (paso === 3) {
      if (!empresaIda.trim()) return 'Ingresa la empresa de transporte (tiquete de ida)';
      if (!numDocIda.trim()) return tipoTrIda === 'aereo' ? 'Ingresa el número de vuelo' : 'Ingresa el número del tiquete';
      if (!valorIda.replace(/\D/g, '')) return 'Ingresa el valor del tiquete de ida';
      if (esIdaVuelta) {
        if (!empresaVuelta.trim()) return 'Ingresa la empresa de transporte (tiquete de regreso)';
        if (!numDocVuelta.trim()) return tipoTrVuelta === 'aereo' ? 'Ingresa el número de vuelo de regreso' : 'Ingresa el número del tiquete de regreso';
        if (!valorVuelta.replace(/\D/g, '')) return 'Ingresa el valor del tiquete de regreso';
      }
      if (!facturaTransporte?.archivoId) return 'Adjunta el tiquete o comprobante de transporte';
    }
    if (paso === 4) {
      if (tieneHospedaje) {
        if (!hotelNombre.trim()) return 'Ingresa el nombre del hotel';
        if (!hotelEntrada || !hotelSalida) return 'Ingresa las fechas de entrada y salida del hotel';
        if (!hotelValorNoche) return 'Ingresa el valor por noche del hospedaje';
        if (!facturaHotel?.archivoId) return 'Adjunta la factura del hotel';
      }
      const tieneComidas = (parseInt(diasDesayuno) || 0) > 0 || (parseInt(diasAlmuerzo) || 0) > 0 || (parseInt(diasCena) || 0) > 0;
      if (tieneComidas && !facturaComidas?.archivoId) return 'Adjunta el soporte de alimentación';
    }
    if (paso === 5) {
      if (!firma) return 'La firma digital es obligatoria';
    }
    return '';
  }

  function siguiente() { const e = validarPaso(); if (e) { setErr(e); return; } setErr(''); setPaso((p) => Math.min(5, p + 1) as 1|2|3|4|5); }
  function anterior() { setErr(''); setPaso((p) => Math.max(1, p - 1) as 1|2|3|4|5); }

  function resetear() {
    setPaso(1); setTipoViatico(''); setAutorizadorInput(''); setAutorizadorId(0); setAutorizadorNombre(''); setMotivoViaje('');
    setCiudadOrigen(''); setCiudadDestino(''); setFechaIda(''); setFechaRegreso(''); setEsIdaVuelta(true);
    setEmpresaIda(''); setNumDocIda(''); setCodResIda(''); setTramoIda(''); setPuestoIda(''); setHrSalidaIda(''); setHrLlegadaIda(''); setValorIda('');
    setEmpresaVuelta(''); setNumDocVuelta(''); setCodResVuelta(''); setTramoVuelta(''); setPuestoVuelta(''); setHrSalidaVuelta(''); setHrLlegadaVuelta(''); setValorVuelta('');
    setFacturaTransporte(null); setTieneHospedaje(false); setHotelNombre(''); setHotelEntrada(''); setHotelSalida(''); setHotelValorNoche(''); setFacturaHotel(null);
    setDiasDesayuno(''); setValorDesayuno(''); setDiasAlmuerzo(''); setValorAlmuerzo(''); setDiasCena(''); setValorCena(''); setFacturaComidas(null);
    setFirma(''); setMsg('');
    setOpcionesViaje([]); setOpcionesRegreso([]); setFuentePrecios(null);
  }

  async function enviar() {
    const e = validarPaso();
    if (e) { setErr(e); return; }
    setErr('');
    setEnviando(true);
    try {
      const norm = (s: string) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
      const tipos = await api.get<Array<{ id: number; slug: string; nombre: string }>>('/tipos');
      const tipo = tipos.data.find((t) => norm(t.slug) === 'viaticos' || norm(t.nombre) === 'viaticos');
      if (!tipo) {
        setErr('No se encontró el tipo "Viáticos". El administrador debe crearlo en Panel → Tipos de solicitud con slug "viaticos".');
        return;
      }
      const docs: Record<string, unknown> = {};
      if (facturaTransporte?.archivoId) docs['tiquete'] = { archivoId: facturaTransporte.archivoId, nombre: facturaTransporte.nombre, ocrAlertas: facturaTransporte.alertas };
      if (facturaHotel?.archivoId) docs['hotel'] = { archivoId: facturaHotel.archivoId, nombre: facturaHotel.nombre, ocrAlertas: facturaHotel.alertas };
      if (facturaComidas?.archivoId) docs['comidas'] = { archivoId: facturaComidas.archivoId, nombre: facturaComidas.nombre, ocrAlertas: facturaComidas.alertas };

      const tiqueteIda = { tipo: tipoTrIda, empresa: empresaIda, numDoc: numDocIda, codReserva: codResIda, tramo: tramoIda, puesto: puestoIda, horaSalida: hrSalidaIda, horaLlegada: hrLlegadaIda, valor: valorIda.replace(/\D/g, '') };
      const tiqueteVuelta = esIdaVuelta ? { tipo: tipoTrVuelta, empresa: empresaVuelta, numDoc: numDocVuelta, codReserva: codResVuelta, tramo: tramoVuelta, puesto: puestoVuelta, horaSalida: hrSalidaVuelta, horaLlegada: hrLlegadaVuelta, valor: valorVuelta.replace(/\D/g, '') } : null;

      const r = await api.post<{ id: number; numeroRadicado: string }>('/solicitudes', {
        tipoSolicitudId: tipo.id,
        datos: {
          tipoViatico,
          motivoViaje,
          autorizadorId: String(autorizadorId),
          autorizadorNombre,
          ciudadOrigen,
          ciudadDestino,
          esIdaVuelta: String(esIdaVuelta),
          fechaIda,
          fechaRegreso: esIdaVuelta ? fechaRegreso : '',
          tiqueteIda: JSON.stringify(tiqueteIda),
          tiqueteVuelta: tiqueteVuelta ? JSON.stringify(tiqueteVuelta) : '',
          tieneHospedaje: String(tieneHospedaje),
          hotelNombre: tieneHospedaje ? hotelNombre : '',
          hotelEntrada: tieneHospedaje ? hotelEntrada : '',
          hotelSalida: tieneHospedaje ? hotelSalida : '',
          hotelValorNoche: tieneHospedaje ? hotelValorNoche : '',
          hotelNoches: tieneHospedaje ? String(noches) : '0',
          diasDesayuno, valorDesayuno,
          diasAlmuerzo, valorAlmuerzo,
          diasCena, valorCena,
          totalTransporte: String(totalTransporte),
          totalHospedaje: String(totalHospedaje),
          totalComidas: String(totalComidas),
          totalGeneral: String(totalGeneral),
        },
        documentos: docs,
        firmas: { profesional: firma },
      });
      setMsg(`¡Viático radicado exitosamente! Radicado: ${r.data.numeroRadicado}`);
      onCreada?.({ id: r.data.id, numeroRadicado: r.data.numeroRadicado });
    } catch (ex: unknown) {
      const m = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(m || 'Error al enviar la solicitud. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const PASOS = ['Tipo y autorización', 'Detalles del viaje', 'Tiquetes de transporte', 'Alojamiento y comidas', 'Resumen y firma'];

  if (msg) {
    return (
      <div className="leg-success card-surface">
        <div className="leg-success-icon">✓</div>
        <h3>Viático radicado</h3>
        <p>{msg}</p>
        <p className="leg-success-note">Puedes hacer seguimiento en <strong>Mis solicitudes</strong>.</p>
        <button type="button" className="admin-primary-button" onClick={resetear}>Nuevo viático</button>
      </div>
    );
  }

  return (
    <div className="leg-panel">
      {/* Stepper */}
      <div className="leg-stepper" role="list">
        {PASOS.map((label, i) => (
          <div key={i} role="listitem" className={`leg-step${paso === i + 1 ? ' active' : ''}${paso > i + 1 ? ' done' : ''}`}>
            <span className="leg-step-num">{paso > i + 1 ? '✓' : i + 1}</span>
            <span className="leg-step-label">{label}</span>
          </div>
        ))}
      </div>

      {err && <div className="admin-error" role="alert">{err}</div>}

      {/* ── PASO 1: Tipo y autorización ── */}
      {paso === 1 && (
        <div className="leg-form card-surface">
          <h3>Tipo de viático y autorización</h3>

          <div className="leg-field">
            <label>¿Qué tipo de viático necesitas? *</label>
            <div className="viaticos-tipo-grid">
              <button type="button"
                className={`viaticos-tipo-card${tipoViatico === 'anticipo' ? ' selected' : ''}`}
                onClick={() => setTipoViatico('anticipo')}>
                <span className="viaticos-tipo-icon">💳</span>
                <strong>Solicitar anticipo</strong>
                <p>El viaje no se ha realizado aún. Solicitas dinero por adelantado para cubrirlo.</p>
              </button>
              <button type="button"
                className={`viaticos-tipo-card${tipoViatico === 'legalizar' ? ' selected' : ''}`}
                onClick={() => setTipoViatico('legalizar')}>
                <span className="viaticos-tipo-icon">🧾</span>
                <strong>Legalizar viático</strong>
                <p>El viaje ya ocurrió y tienes facturas. Solicitas el reembolso de los gastos reales.</p>
              </button>
            </div>
          </div>

          <div className="leg-field" style={{ marginTop: 16 }}>
            <label>Motivo / propósito del viaje *</label>
            <textarea value={motivoViaje} onChange={(e) => setMotivoViaje(e.target.value)}
              rows={2} placeholder="Ej: Visita a cliente, capacitación, reunión con proveedor…" />
          </div>

          <div className="leg-field leg-autocomplete-wrap" style={{ marginTop: 16 }}>
            <label>¿Quién autorizó el viaje? *</label>
            <input type="text" value={autorizadorInput}
              onChange={(e) => { setAutorizadorInput(e.target.value); setAutorizadorId(0); setAutorizadorNombre(''); setShowSugeridos(true); }}
              onFocus={() => setShowSugeridos(true)}
              onBlur={() => setTimeout(() => setShowSugeridos(false), 150)}
              placeholder="Escribe el nombre del director o gerente que autorizó…"
              autoComplete="off" />
            {autorizadorId > 0 && <span className="leg-autorizado-ok">✓ {autorizadorNombre}</span>}
            {showSugeridos && sugeridos.length > 0 && (
              <div className="leg-sugeridos" role="listbox">
                {sugeridos.map((u) => (
                  <button key={u.id} type="button" className="leg-sugerido-item" onMouseDown={() => elegirAutorizador(u)}>
                    <strong>{u.nombreCompleto}</strong>
                    <span>{u.rol}{u.area ? ` · ${u.area}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
            {showSugeridos && autorizadorInput.length >= 2 && sugeridos.length === 0 && (
              <div className="leg-sugeridos">
                <span className="leg-sin-resultados">Sin coincidencias para "{autorizadorInput}"</span>
              </div>
            )}
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Detalles del viaje
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 2: Detalles del viaje ── */}
      {paso === 2 && (
        <div className="leg-form card-surface">
          <h3>Detalles del viaje</h3>

          <div className="leg-field">
            <label>Tipo de viaje *</label>
            <div className="leg-radio-group">
              <label className="leg-radio-item">
                <input type="radio" name="esIdaVuelta" checked={esIdaVuelta} onChange={() => setEsIdaVuelta(true)} />
                <strong>Ida y vuelta</strong>
              </label>
              <label className="leg-radio-item">
                <input type="radio" name="esIdaVuelta" checked={!esIdaVuelta} onChange={() => { setEsIdaVuelta(false); setFechaRegreso(''); }} />
                <strong>Solo ida</strong>
              </label>
            </div>
          </div>

          <div className="leg-gasto-fields">
            <div className="leg-field">
              <label>Ciudad de origen *</label>
              <select value={ciudadOrigen} onChange={(e) => setCiudadOrigen(e.target.value)} required>
                <option value="">— Selecciona —</option>
                {CIUDADES_CO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="leg-field">
              <label>Ciudad de destino *</label>
              <select value={ciudadDestino} onChange={(e) => setCiudadDestino(e.target.value)} required>
                <option value="">— Selecciona —</option>
                {CIUDADES_CO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="leg-field">
              <label>Fecha de ida *</label>
              <input type="date" value={fechaIda} onChange={(e) => setFechaIda(e.target.value)} required />
            </div>

            {esIdaVuelta && (
              <div className="leg-field">
                <label>Fecha de regreso *</label>
                <input type="date" value={fechaRegreso} min={fechaIda}
                  onChange={(e) => setFechaRegreso(e.target.value)} required />
              </div>
            )}
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Datos del tiquete
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 3: Tiquetes ── */}
      {paso === 3 && (
        <div className="leg-form card-surface">
          <h3>Datos del tiquete de transporte</h3>
          <p className="leg-nota">Ingresa los datos exactos de tu tiquete o comprobante de viaje.</p>

          {/* Precios de referencia: API en tiempo real → fallback estático */}
          <div className="viatico-ref-box">
            {cargandoPrecios ? (
              <div className="viatico-ref-titulo">⏳ Consultando precios para {ciudadOrigen} → {ciudadDestino}…</div>
            ) : opcionesViaje.length > 0 ? (
              <>
                <div className="viatico-ref-titulo">
                  📊 Opciones disponibles · {ciudadOrigen} → {ciudadDestino}
                  {fuentePrecios === 'api' && <span className="viatico-fuente-badge">Precios actualizados</span>}
                  {fuentePrecios === 'estimado' && <span className="viatico-fuente-badge viatico-fuente-est">Estimados de referencia</span>}
                </div>
                <div className="viatico-opciones-lista">
                  {opcionesViaje.slice(0, 5).map((op) => (
                    <div key={op.id} className="viatico-opcion-item">
                      <span className="viatico-opcion-icono">{op.tipo === 'bus' ? '🚌' : '✈'}</span>
                      <div className="viatico-opcion-info">
                        <strong>{op.empresa}</strong>
                        <span>{op.salida}{op.llegada !== '—' ? ` → ${op.llegada}` : ''} · {op.duracion}</span>
                      </div>
                      <div className="viatico-opcion-precio">${formatearMiles(op.precio)}</div>
                    </div>
                  ))}
                </div>
                {/* Validación en tiempo real contra precios de API */}
                {(() => {
                  const v = parseInt(valorIda.replace(/\D/g, '')) || 0;
                  if (v === 0) return null;
                  const filtradas = opcionesViaje.filter((o) => tipoTrIda === 'aereo' ? o.tipo !== 'bus' : o.tipo === 'bus');
                  if (filtradas.length === 0) return null;
                  const precios = filtradas.map((o) => o.precio);
                  const maxRef = Math.max(...precios) * 1.4;
                  const minRef = Math.min(...precios) * 0.7;
                  if (v > maxRef) return <div className="viatico-precio-alerta">⚠ ${formatearMiles(v)} supera el rango de referencia para esta ruta. El aprobador revisará.</div>;
                  if (v >= minRef) return <div className="viatico-precio-ok">✓ Precio dentro del rango de referencia para esta ruta.</div>;
                  return null;
                })()}
              </>
            ) : preciosRef ? (
              <>
                <div className="viatico-ref-titulo">📊 Precios habituales para esta ruta</div>
                <div className="viatico-ref-opciones">
                  {preciosRef.aereo && (
                    <div className="viatico-ref-opcion">
                      <span className="viatico-ref-icon">✈</span>
                      <div>
                        <div className="viatico-ref-tipo">Aéreo · {ciudadOrigen} → {ciudadDestino}</div>
                        <div className="viatico-ref-rango">${formatearMiles(preciosRef.aereo[0])} – ${formatearMiles(preciosRef.aereo[1])} COP</div>
                      </div>
                    </div>
                  )}
                  {preciosRef.terrestre && (
                    <div className="viatico-ref-opcion">
                      <span className="viatico-ref-icon">🚌</span>
                      <div>
                        <div className="viatico-ref-tipo">Terrestre · {ciudadOrigen} → {ciudadDestino}</div>
                        <div className="viatico-ref-rango">${formatearMiles(preciosRef.terrestre[0])} – ${formatearMiles(preciosRef.terrestre[1])} COP</div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <TiqueteForm
            titulo={esIdaVuelta ? '🛫 Tiquete de ida' : '🛫 Tiquete'}
            ciudadOrigen={ciudadOrigen} ciudadDestino={ciudadDestino} fecha={fechaIda}
            tipo={tipoTrIda} onTipo={setTipoTrIda}
            empresa={empresaIda} onEmpresa={setEmpresaIda}
            numDoc={numDocIda} onNumDoc={setNumDocIda}
            codReserva={codResIda} onCodReserva={setCodResIda}
            tramo={tramoIda} onTramo={setTramoIda}
            puesto={puestoIda} onPuesto={setPuestoIda}
            horaSalida={hrSalidaIda} onHoraSalida={setHrSalidaIda}
            horaLlegada={hrLlegadaIda} onHoraLlegada={setHrLlegadaIda}
            valor={valorIda} onValor={setValorIda}
          />

          {esIdaVuelta && (
            <>
              <TiqueteForm
                titulo="🛬 Tiquete de regreso"
                ciudadOrigen={ciudadDestino} ciudadDestino={ciudadOrigen} fecha={fechaRegreso}
                tipo={tipoTrVuelta} onTipo={setTipoTrVuelta}
                empresa={empresaVuelta} onEmpresa={setEmpresaVuelta}
                numDoc={numDocVuelta} onNumDoc={setNumDocVuelta}
                codReserva={codResVuelta} onCodReserva={setCodResVuelta}
                tramo={tramoVuelta} onTramo={setTramoVuelta}
                puesto={puestoVuelta} onPuesto={setPuestoVuelta}
                horaSalida={hrSalidaVuelta} onHoraSalida={setHrSalidaVuelta}
                horaLlegada={hrLlegadaVuelta} onHoraLlegada={setHrLlegadaVuelta}
                valor={valorVuelta} onValor={setValorVuelta}
              />
              {/* Validación precio regreso contra opciones API */}
              {opcionesRegreso.length > 0 && valorVuelta && (() => {
                const v = parseInt(valorVuelta.replace(/\D/g, '')) || 0;
                if (v === 0) return null;
                const filtradas = opcionesRegreso.filter((o) => tipoTrVuelta === 'aereo' ? o.tipo !== 'bus' : o.tipo === 'bus');
                if (filtradas.length === 0) return null;
                const precios = filtradas.map((o) => o.precio);
                if (v > Math.max(...precios) * 1.4) return <div className="viatico-precio-alerta">⚠ Regreso ${formatearMiles(v)}: supera el rango de referencia.</div>;
                if (v >= Math.min(...precios) * 0.7) return <div className="viatico-precio-ok">✓ Precio de regreso dentro del rango de referencia.</div>;
                return null;
              })()}
            </>
          )}

          {totalTransporte > 0 && (
            <div className="viatico-total-linea">
              ✈ Total transporte: <strong>${formatearMiles(totalTransporte)} COP</strong>
            </div>
          )}

          {/* Adjuntar tiquete */}
          <div className="leg-factura-section" style={{ marginTop: 20 }}>
            <div className="leg-factura-label">
              <strong>Adjuntar tiquete o comprobante *</strong>
              {!facturaTransporte?.archivoId && <span className="leg-factura-falta">⚠ Obligatorio</span>}
              {facturaTransporte?.archivoId && (
                <span className={facturaTransporte.alertas.length ? 'leg-factura-warn' : 'leg-factura-ok'}>
                  ✓ {facturaTransporte.nombre}
                  {facturaTransporte.alertas.length > 0 && ` — ${facturaTransporte.alertas.length} alerta(s)`}
                </span>
              )}
            </div>
            <p className="leg-nota" style={{ marginBottom: 8 }}>Sube una foto o PDF del tiquete (aéreo o terrestre).</p>
            <div className="leg-factura-actions">
              {subiendoTransporte
                ? <span className="leg-validando">Subiendo y analizando…</span>
                : (
                  <>
                    <button type="button" className="leg-btn-camara admin-ghost-button"
                      onClick={() => { if (fileTransporteRef.current) { fileTransporteRef.current.setAttribute('capture', 'environment'); fileTransporteRef.current.click(); } }}>
                      📷 Cámara
                    </button>
                    <button type="button" className="admin-ghost-button"
                      onClick={() => { if (fileTransporteRef.current) { fileTransporteRef.current.removeAttribute('capture'); fileTransporteRef.current.click(); } }}>
                      {facturaTransporte?.archivoId ? 'Cambiar archivo' : 'Adjuntar tiquete'}
                    </button>
                  </>
                )
              }
              <input ref={fileTransporteRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFactura(f, 'transporte', { valor: totalTransporte, ciudad: ciudadDestino, fecha: fechaIda }); e.target.value = ''; }} />
            </div>
            {facturaTransporte?.alertas.length
              ? <ul className="leg-alertas-list">{facturaTransporte.alertas.map((a, i) => <li key={i}>{a}</li>)}</ul>
              : null
            }
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Alojamiento y comidas
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 4: Alojamiento y alimentación ── */}
      {paso === 4 && (
        <div className="leg-form card-surface">
          <h3>Alojamiento y alimentación</h3>

          {/* HOSPEDAJE */}
          <div className="viaticos-seccion-titulo">🏨 Hospedaje</div>
          <div className="leg-field">
            <label className="viaticos-check-label">
              <input type="checkbox" checked={tieneHospedaje} onChange={(e) => setTieneHospedaje(e.target.checked)} />
              El viaje requirió / requerirá hospedaje
            </label>
          </div>

          {tieneHospedaje && (
            <>
              <div className="leg-gasto-fields">
                <div className="leg-field">
                  <label>Nombre del hotel *</label>
                  <input type="text" value={hotelNombre} onChange={(e) => setHotelNombre(e.target.value)}
                    placeholder="Ej: Hotel Dann Carlton" required />
                </div>
                <div className="leg-field">
                  <label>Fecha de entrada *</label>
                  <input type="date" value={hotelEntrada} min={fechaIda}
                    onChange={(e) => setHotelEntrada(e.target.value)} required />
                </div>
                <div className="leg-field">
                  <label>Fecha de salida *</label>
                  <input type="date" value={hotelSalida} min={hotelEntrada}
                    onChange={(e) => setHotelSalida(e.target.value)} required />
                </div>
                <div className="leg-field">
                  <label>Valor por noche ($) *</label>
                  <input type="text" inputMode="numeric" value={hotelValorNoche}
                    onChange={(e) => setHotelValorNoche(e.target.value.replace(/\D/g, ''))}
                    placeholder="0" required />
                </div>
              </div>
              {noches > 0 && (
                <div className="viatico-total-linea">
                  🏨 {noches} noche(s) × ${formatearMiles(parseInt(hotelValorNoche) || 0)} = <strong>${formatearMiles(totalHospedaje)}</strong>
                </div>
              )}
              <div className="leg-factura-section">
                <div className="leg-factura-label">
                  <strong>Factura del hotel *</strong>
                  {!facturaHotel?.archivoId && <span className="leg-factura-falta">⚠ Obligatoria</span>}
                  {facturaHotel?.archivoId && (
                    <span className={facturaHotel.alertas.length ? 'leg-factura-warn' : 'leg-factura-ok'}>
                      ✓ {facturaHotel.nombre}
                    </span>
                  )}
                </div>
                <div className="leg-factura-actions">
                  {subiendoHotel
                    ? <span className="leg-validando">Subiendo y analizando…</span>
                    : (
                      <>
                        <button type="button" className="leg-btn-camara admin-ghost-button"
                          onClick={() => { if (fileHotelRef.current) { fileHotelRef.current.setAttribute('capture', 'environment'); fileHotelRef.current.click(); } }}>
                          📷 Cámara
                        </button>
                        <button type="button" className="admin-ghost-button"
                          onClick={() => { if (fileHotelRef.current) { fileHotelRef.current.removeAttribute('capture'); fileHotelRef.current.click(); } }}>
                          {facturaHotel?.archivoId ? 'Cambiar' : 'Adjuntar factura'}
                        </button>
                      </>
                    )
                  }
                  <input ref={fileHotelRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFactura(f, 'hotel', { valor: totalHospedaje, ciudad: ciudadDestino, fecha: hotelEntrada }); e.target.value = ''; }} />
                </div>
                {facturaHotel?.alertas.length
                  ? <ul className="leg-alertas-list">{facturaHotel.alertas.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  : null
                }
              </div>
            </>
          )}

          {/* ALIMENTACIÓN */}
          <div className="viaticos-seccion-titulo" style={{ marginTop: 24 }}>🍽 Alimentación</div>
          <p className="leg-nota">Ingresa los días y valor por tipo de comida que cubre el viático.</p>

          <div className="viaticos-comidas-grid">
            {([
              { key: 'desayuno', icon: '☀️', label: 'Desayunos', dias: diasDesayuno, setDias: setDiasDesayuno, valor: valorDesayuno, setValor: setValorDesayuno },
              { key: 'almuerzo', icon: '🌤', label: 'Almuerzos', dias: diasAlmuerzo, setDias: setDiasAlmuerzo, valor: valorAlmuerzo, setValor: setValorAlmuerzo },
              { key: 'cena', icon: '🌙', label: 'Cenas', dias: diasCena, setDias: setDiasCena, valor: valorCena, setValor: setValorCena },
            ] as Array<{ key: string; icon: string; label: string; dias: string; setDias: (v: string) => void; valor: string; setValor: (v: string) => void }>).map(({ key, icon, label, dias, setDias, valor, setValor }) => (
              <div key={key} className="viaticos-comida-item">
                <div className="viaticos-comida-header">
                  <span>{icon}</span>
                  <strong>{label}</strong>
                </div>
                <div className="viaticos-comida-inputs">
                  <input type="number" min="0" max="30" value={dias} onChange={(e) => setDias(e.target.value)} placeholder="Días" />
                  <span className="viaticos-comida-x">×</span>
                  <input type="text" inputMode="numeric" value={valor}
                    onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))} placeholder="$ por día" />
                </div>
                {(parseInt(dias) || 0) > 0 && (parseInt(valor) || 0) > 0 && (
                  <div className="viaticos-comida-subtotal">
                    = ${formatearMiles((parseInt(dias) || 0) * (parseInt(valor) || 0))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalComidas > 0 && (
            <div className="viatico-total-linea">
              🍽 Total alimentación: <strong>${formatearMiles(totalComidas)}</strong>
            </div>
          )}

          {totalComidas > 0 && (
            <div className="leg-factura-section">
              <div className="leg-factura-label">
                <strong>Soportes de alimentación *</strong>
                {!facturaComidas?.archivoId && <span className="leg-factura-falta">⚠ Obligatorio</span>}
                {facturaComidas?.archivoId && (
                  <span className={facturaComidas.alertas.length ? 'leg-factura-warn' : 'leg-factura-ok'}>
                    ✓ {facturaComidas.nombre}
                  </span>
                )}
              </div>
              <div className="leg-factura-actions">
                {subiendoComidas
                  ? <span className="leg-validando">Subiendo y analizando…</span>
                  : (
                    <>
                      <button type="button" className="leg-btn-camara admin-ghost-button"
                        onClick={() => { if (fileComidasRef.current) { fileComidasRef.current.setAttribute('capture', 'environment'); fileComidasRef.current.click(); } }}>
                        📷 Cámara
                      </button>
                      <button type="button" className="admin-ghost-button"
                        onClick={() => { if (fileComidasRef.current) { fileComidasRef.current.removeAttribute('capture'); fileComidasRef.current.click(); } }}>
                        {facturaComidas?.archivoId ? 'Cambiar' : 'Adjuntar soporte'}
                      </button>
                    </>
                  )
                }
                <input ref={fileComidasRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFactura(f, 'comidas', { valor: totalComidas, fecha: fechaIda }); e.target.value = ''; }} />
              </div>
              {facturaComidas?.alertas.length
                ? <ul className="leg-alertas-list">{facturaComidas.alertas.map((a, i) => <li key={i}>{a}</li>)}</ul>
                : null
              }
            </div>
          )}

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Resumen y firma
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 5: Resumen y firma ── */}
      {paso === 5 && (
        <div className="leg-form card-surface">
          <h3>Resumen y firma</h3>

          <div className="leg-resumen-final">
            <h4>Tipo de solicitud</h4>
            <div className="leg-resumen-row">
              <span>Tipo:</span>
              <strong>{tipoViatico === 'anticipo' ? 'Solicitud de anticipo de viáticos' : 'Legalización de viáticos'}</strong>
            </div>
            <div className="leg-resumen-row"><span>Autorizado por:</span> <strong>{autorizadorNombre}</strong></div>
            <div className="leg-resumen-row"><span>Motivo:</span> <strong>{motivoViaje}</strong></div>

            <h4>Ruta</h4>
            <div className="leg-resumen-row">
              <span>Trayecto:</span>
              <strong>{ciudadOrigen} → {ciudadDestino}{esIdaVuelta ? ' (ida y vuelta)' : ' (solo ida)'}</strong>
            </div>
            <div className="leg-resumen-row"><span>Fecha ida:</span> <strong>{fechaIda}</strong></div>
            {esIdaVuelta && <div className="leg-resumen-row"><span>Fecha regreso:</span> <strong>{fechaRegreso}</strong></div>}

            <h4>Transporte</h4>
            <div className="leg-resumen-row">
              <span>Ida:</span>
              <strong>{tipoTrIda === 'aereo' ? '✈' : '🚌'} {empresaIda} — {numDocIda}{codResIda ? ` (Res. ${codResIda})` : ''} — ${formatearMiles(parseInt(valorIda.replace(/\D/g,''))||0)}</strong>
            </div>
            {esIdaVuelta && (
              <div className="leg-resumen-row">
                <span>Regreso:</span>
                <strong>{tipoTrVuelta === 'aereo' ? '✈' : '🚌'} {empresaVuelta} — {numDocVuelta}{codResVuelta ? ` (Res. ${codResVuelta})` : ''} — ${formatearMiles(parseInt(valorVuelta.replace(/\D/g,''))||0)}</strong>
              </div>
            )}

            {tieneHospedaje && (
              <>
                <h4>Hospedaje</h4>
                <div className="leg-resumen-row"><span>Hotel:</span> <strong>{hotelNombre}</strong></div>
                <div className="leg-resumen-row">
                  <span>Costo:</span>
                  <strong>{noches} noche(s) × ${formatearMiles(parseInt(hotelValorNoche) || 0)} = ${formatearMiles(totalHospedaje)}</strong>
                </div>
              </>
            )}

            {totalComidas > 0 && (
              <>
                <h4>Alimentación</h4>
                {(parseInt(diasDesayuno) || 0) > 0 && <div className="leg-resumen-row"><span>Desayunos:</span> <strong>{diasDesayuno} × ${formatearMiles(parseInt(valorDesayuno)||0)} = ${formatearMiles((parseInt(diasDesayuno)||0)*(parseInt(valorDesayuno)||0))}</strong></div>}
                {(parseInt(diasAlmuerzo) || 0) > 0 && <div className="leg-resumen-row"><span>Almuerzos:</span> <strong>{diasAlmuerzo} × ${formatearMiles(parseInt(valorAlmuerzo)||0)} = ${formatearMiles((parseInt(diasAlmuerzo)||0)*(parseInt(valorAlmuerzo)||0))}</strong></div>}
                {(parseInt(diasCena) || 0) > 0 && <div className="leg-resumen-row"><span>Cenas:</span> <strong>{diasCena} × ${formatearMiles(parseInt(valorCena)||0)} = ${formatearMiles((parseInt(diasCena)||0)*(parseInt(valorCena)||0))}</strong></div>}
              </>
            )}

            <div className="leg-resumen-total-line">
              <span>TOTAL VIÁTICO:</span>
              <strong>${formatearMiles(totalGeneral)} COP</strong>
            </div>
          </div>

          <div className="leg-field">
            <label>Firma del solicitante *</label>
            <p className="leg-nota">Al firmar, declaras que la información es veraz y los soportes adjuntos son auténticos.</p>
            <SignaturePad value={firma} onChange={setFirma} />
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar solicitud de viático'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
