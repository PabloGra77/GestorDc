import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/http/api';
import { formatearMiles } from '../../utils/numeroALetras';
import { SignaturePad } from '../../components/SignaturePad';
import { useOcrDocument, validarOcrContraDato } from '../../hooks/useOcrDocument';

/* ─── Ciudades Colombia ──────────────────────────────────────── */
const CIUDADES_CO = [
  { nombre: 'Bogotá', iata: 'BOG' },
  { nombre: 'Medellín', iata: 'MDE' },
  { nombre: 'Cali', iata: 'CLO' },
  { nombre: 'Cartagena', iata: 'CTG' },
  { nombre: 'Barranquilla', iata: 'BAQ' },
  { nombre: 'Bucaramanga', iata: 'BGA' },
  { nombre: 'Pereira', iata: 'PEI' },
  { nombre: 'Santa Marta', iata: 'SMR' },
  { nombre: 'Cúcuta', iata: 'CUC' },
  { nombre: 'Manizales', iata: 'MZL' },
  { nombre: 'Armenia', iata: 'AXM' },
  { nombre: 'Ibagué', iata: 'IBE' },
  { nombre: 'Montería', iata: 'MTR' },
  { nombre: 'Villavicencio', iata: 'VVC' },
  { nombre: 'Pasto', iata: 'PSO' },
  { nombre: 'Neiva', iata: 'HEI' },
  { nombre: 'Valledupar', iata: 'VUP' },
  { nombre: 'San Andrés', iata: 'ADZ' },
  { nombre: 'Popayán', iata: 'PPN' },
  { nombre: 'Leticia', iata: 'LET' },
  { nombre: 'Florencia', iata: 'FLA' },
  { nombre: 'Yopal', iata: 'EYP' },
  { nombre: 'Riohacha', iata: 'RCH' },
  { nombre: 'Tunja', iata: '' },
  { nombre: 'Duitama', iata: '' },
  { nombre: 'Sogamoso', iata: '' },
];

/* ─── Tipos ─────────────────────────────────────────────────── */
interface UsuarioSugerido { id: number; nombreCompleto: string; rol: string; area: string | null; }

interface OpcionViaje {
  id: string;
  tipo: 'vuelo' | 'bus';
  empresa: string;
  salida: string;
  llegada: string;
  duracion: string;
  precio: number;
  esEstimado: boolean;
}

interface FacturaAdj { archivoId: string; nombre: string; alertas: string[]; }

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

  /* Paso 2 */
  const [ciudadOrigen, setCiudadOrigen] = useState('');
  const [ciudadDestino, setCiudadDestino] = useState('');
  const [esIdaVuelta, setEsIdaVuelta] = useState(true);
  const [fechaIda, setFechaIda] = useState('');
  const [fechaRegreso, setFechaRegreso] = useState('');
  const [tipoTransporte, setTipoTransporte] = useState<'aereo' | 'terrestre' | 'cualquiera'>('cualquiera');

  /* Paso 3 — búsqueda */
  const [opcionesIda, setOpcionesIda] = useState<OpcionViaje[]>([]);
  const [opcionesVuelta, setOpcionesVuelta] = useState<OpcionViaje[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [yaFueBuscado, setYaFueBuscado] = useState(false);
  const [errBusqueda, setErrBusqueda] = useState('');
  const [viajeIda, setViajeIda] = useState<OpcionViaje | null>(null);
  const [viajeVuelta, setViajeVuelta] = useState<OpcionViaje | null>(null);
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

  const ciudadOrigenObj = useMemo(() => CIUDADES_CO.find((c) => c.nombre === ciudadOrigen), [ciudadOrigen]);
  const ciudadDestinoObj = useMemo(() => CIUDADES_CO.find((c) => c.nombre === ciudadDestino), [ciudadDestino]);

  async function buscarViajes() {
    if (!ciudadOrigenObj || !ciudadDestinoObj || !fechaIda) return;
    setBuscando(true);
    setErrBusqueda('');
    setOpcionesIda([]);
    setOpcionesVuelta([]);
    setViajeIda(null);
    setViajeVuelta(null);
    try {
      const params: Record<string, string> = {
        origen: ciudadOrigenObj.iata || ciudadOrigen,
        destino: ciudadDestinoObj.iata || ciudadDestino,
        fecha_ida: fechaIda,
      };
      if (esIdaVuelta && fechaRegreso) params.fecha_regreso = fechaRegreso;
      const r = await api.get<{ opciones: OpcionViaje[]; opcionesRegreso?: OpcionViaje[] }>('/viajes/buscar', { params });
      setOpcionesIda(r.data.opciones || []);
      if (esIdaVuelta) setOpcionesVuelta(r.data.opcionesRegreso || r.data.opciones || []);
      setYaFueBuscado(true);
    } catch {
      setErrBusqueda('No se pudieron cargar las opciones de viaje. Verifica tu conexión e intenta de nuevo.');
      setYaFueBuscado(true);
    } finally {
      setBuscando(false);
    }
  }

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
        const marcadores = ['total', 'nit', 'valor', 'fecha', 'factura'].filter((k) => t.includes(k)).length;
        if (marcadores < 2) alertas.push('El archivo no parece ser una factura válida. Verifica el documento.');
      }
      setFactura({ archivoId, nombre: file.name, alertas });
    } catch {
      setFactura({ archivoId: '', nombre: '', alertas: ['No se pudo subir el archivo. Intenta de nuevo.'] });
    } finally {
      setSubiendo(false);
    }
  }, [procesarArchivo]);

  /* Cálculos de totales */
  const noches = useMemo(() => {
    if (!tieneHospedaje || !hotelEntrada || !hotelSalida) return 0;
    const diff = (new Date(hotelSalida).getTime() - new Date(hotelEntrada).getTime()) / 86400000;
    return Math.max(0, Math.round(diff));
  }, [tieneHospedaje, hotelEntrada, hotelSalida]);

  const totalTransporte = useMemo(() => (viajeIda?.precio || 0) + (esIdaVuelta ? (viajeVuelta?.precio || 0) : 0), [viajeIda, viajeVuelta, esIdaVuelta]);
  const totalHospedaje = useMemo(() => tieneHospedaje ? (parseInt(hotelValorNoche) || 0) * noches : 0, [tieneHospedaje, hotelValorNoche, noches]);
  const totalComidas = useMemo(() => {
    const d = (parseInt(diasDesayuno) || 0) * (parseInt(valorDesayuno) || 0);
    const a = (parseInt(diasAlmuerzo) || 0) * (parseInt(valorAlmuerzo) || 0);
    const c = (parseInt(diasCena) || 0) * (parseInt(valorCena) || 0);
    return d + a + c;
  }, [diasDesayuno, valorDesayuno, diasAlmuerzo, valorAlmuerzo, diasCena, valorCena]);
  const totalGeneral = useMemo(() => totalTransporte + totalHospedaje + totalComidas, [totalTransporte, totalHospedaje, totalComidas]);

  const opsFiltradas = useCallback((ops: OpcionViaje[]) => ops.filter((o) =>
    tipoTransporte === 'cualquiera' ||
    (tipoTransporte === 'aereo' && o.tipo === 'vuelo') ||
    (tipoTransporte === 'terrestre' && o.tipo === 'bus'),
  ), [tipoTransporte]);

  function validarPaso(): string {
    if (paso === 1) {
      if (!tipoViatico) return 'Selecciona si es anticipo o legalización de viático';
      if (!autorizadorId) return 'Selecciona el autorizador del viaje de la lista';
      if (autorizadorInput.trim() !== autorizadorNombre) return 'Selecciona el autorizador de la lista de sugerencias';
    }
    if (paso === 2) {
      if (!ciudadOrigen) return 'Selecciona la ciudad de origen';
      if (!ciudadDestino) return 'Selecciona la ciudad de destino';
      if (ciudadOrigen === ciudadDestino) return 'Origen y destino deben ser ciudades diferentes';
      if (!fechaIda) return 'Indica la fecha de ida';
      if (esIdaVuelta && !fechaRegreso) return 'Indica la fecha de regreso';
      if (esIdaVuelta && fechaRegreso && fechaRegreso < fechaIda) return 'La fecha de regreso debe ser posterior a la de ida';
    }
    if (paso === 3) {
      if (!viajeIda) return 'Selecciona una opción de viaje de ida';
      if (esIdaVuelta && !viajeVuelta) return 'Selecciona una opción de viaje de regreso';
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

  async function enviar() {
    const e = validarPaso();
    if (e) { setErr(e); return; }
    setErr('');
    setEnviando(true);
    try {
      const tipos = await api.get<Array<{ id: number; slug: string }>>('/tipos');
      const tipo = tipos.data.find((t) => t.slug === 'viaticos');
      if (!tipo) {
        setErr('No se encontró el tipo "Viáticos" en el sistema. El administrador debe crearlo en Panel → Tipos de solicitud con slug "viaticos".');
        return;
      }
      const docs: Record<string, unknown> = {};
      if (facturaTransporte?.archivoId) docs['tiquete'] = { archivoId: facturaTransporte.archivoId, nombre: facturaTransporte.nombre, ocrAlertas: facturaTransporte.alertas };
      if (facturaHotel?.archivoId) docs['hotel'] = { archivoId: facturaHotel.archivoId, nombre: facturaHotel.nombre, ocrAlertas: facturaHotel.alertas };
      if (facturaComidas?.archivoId) docs['comidas'] = { archivoId: facturaComidas.archivoId, nombre: facturaComidas.nombre, ocrAlertas: facturaComidas.alertas };

      const r = await api.post<{ id: number; numeroRadicado: string }>('/solicitudes', {
        tipoSolicitudId: tipo.id,
        datos: {
          tipoViatico,
          autorizadorId: String(autorizadorId),
          autorizadorNombre,
          ciudadOrigen,
          ciudadDestino,
          esIdaVuelta: String(esIdaVuelta),
          fechaIda,
          fechaRegreso: esIdaVuelta ? fechaRegreso : '',
          tipoTransporte,
          viajeIda: JSON.stringify(viajeIda),
          viajeVuelta: esIdaVuelta && viajeVuelta ? JSON.stringify(viajeVuelta) : '',
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

  const PASOS = ['Tipo y autorización', 'Detalles del viaje', 'Opciones de viaje', 'Alojamiento y comidas', 'Resumen y firma'];

  if (msg) {
    return (
      <div className="leg-success card-surface">
        <div className="leg-success-icon">✓</div>
        <h3>Viático radicado</h3>
        <p>{msg}</p>
        <p className="leg-success-note">Puedes hacer seguimiento en <strong>Mis solicitudes</strong>.</p>
        <button type="button" className="admin-primary-button" onClick={() => { setMsg(''); setPaso(1); setTipoViatico(''); setAutorizadorInput(''); setAutorizadorId(0); setAutorizadorNombre(''); setCiudadOrigen(''); setCiudadDestino(''); setFechaIda(''); setFechaRegreso(''); setViajeIda(null); setViajeVuelta(null); setFacturaTransporte(null); setTieneHospedaje(false); setHotelNombre(''); setHotelEntrada(''); setHotelSalida(''); setHotelValorNoche(''); setFacturaHotel(null); setDiasDesayuno(''); setValorDesayuno(''); setDiasAlmuerzo(''); setValorAlmuerzo(''); setDiasCena(''); setValorCena(''); setFacturaComidas(null); setFirma(''); setYaFueBuscado(false); }}>
          Nuevo viático
        </button>
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
                {CIUDADES_CO.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>

            <div className="leg-field">
              <label>Ciudad de destino *</label>
              <select value={ciudadDestino} onChange={(e) => setCiudadDestino(e.target.value)} required>
                <option value="">— Selecciona —</option>
                {CIUDADES_CO.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
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

            <div className="leg-field">
              <label>Tipo de transporte</label>
              <select value={tipoTransporte} onChange={(e) => setTipoTransporte(e.target.value as typeof tipoTransporte)}>
                <option value="cualquiera">Cualquiera (vuelo o bus)</option>
                <option value="aereo">Solo aéreo</option>
                <option value="terrestre">Solo terrestre</option>
              </select>
            </div>
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Buscar opciones de viaje
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 3: Opciones de viaje ── */}
      {paso === 3 && (
        <div className="leg-form card-surface">
          <h3>Opciones de viaje disponibles</h3>
          <p className="leg-nota">
            ✈ {ciudadOrigen} → {ciudadDestino}
            {esIdaVuelta ? ' (ida y vuelta)' : ' (solo ida)'}
            {' · '}{fechaIda}{esIdaVuelta && fechaRegreso ? ` · Regreso: ${fechaRegreso}` : ''}
          </p>

          {!yaFueBuscado && !buscando && (
            <div className="viaticos-buscar-cta">
              <button type="button" className="admin-primary-button viaticos-buscar-btn" onClick={buscarViajes}>
                🔍 Buscar vuelos y buses disponibles
              </button>
              <p className="leg-nota">Consultamos vuelos (Avianca, LATAM, JetSmart) y buses para tu ruta.</p>
            </div>
          )}

          {buscando && (
            <div className="viaticos-buscando">
              <div className="viaticos-buscando-spinner" />
              <p>Consultando disponibilidad de vuelos y buses…</p>
            </div>
          )}

          {errBusqueda && <div className="admin-error">{errBusqueda}</div>}

          {yaFueBuscado && !buscando && (
            <>
              {/* Ida */}
              <div className="viaticos-opciones-section">
                <h4>🛫 Viaje de ida: {ciudadOrigen} → {ciudadDestino} · {fechaIda}</h4>
                {opsFiltradas(opcionesIda).length === 0
                  ? <p className="leg-nota">No hay opciones disponibles para este trayecto.</p>
                  : (
                    <div className="viaticos-opciones-lista">
                      {opsFiltradas(opcionesIda).map((op) => (
                        <button key={op.id} type="button"
                          className={`viatico-opcion-card${viajeIda?.id === op.id ? ' selected' : ''}`}
                          onClick={() => setViajeIda(op)}>
                          <div className="viatico-opcion-empresa">
                            <span>{op.tipo === 'vuelo' ? '✈️' : '🚌'}</span>
                            <strong>{op.empresa}</strong>
                            {op.esEstimado && <span className="viatico-badge-estimado">Precio estimado</span>}
                          </div>
                          <div className="viatico-opcion-horario">
                            <span className="viatico-hora">{op.salida}</span>
                            <span className="viatico-duracion">— {op.duracion} —</span>
                            <span className="viatico-hora">{op.llegada}</span>
                          </div>
                          <div className="viatico-opcion-precio">${formatearMiles(op.precio)} COP</div>
                          {viajeIda?.id === op.id && <div className="viatico-seleccionado">✓ Seleccionado</div>}
                        </button>
                      ))}
                    </div>
                  )
                }
              </div>

              {/* Vuelta */}
              {esIdaVuelta && (
                <div className="viaticos-opciones-section">
                  <h4>🛬 Viaje de regreso: {ciudadDestino} → {ciudadOrigen} · {fechaRegreso}</h4>
                  {opsFiltradas(opcionesVuelta).length === 0
                    ? <p className="leg-nota">No hay opciones disponibles para el regreso.</p>
                    : (
                      <div className="viaticos-opciones-lista">
                        {opsFiltradas(opcionesVuelta).map((op) => {
                          const id = op.id + '-r';
                          return (
                            <button key={id} type="button"
                              className={`viatico-opcion-card${viajeVuelta?.id === id ? ' selected' : ''}`}
                              onClick={() => setViajeVuelta({ ...op, id })}>
                              <div className="viatico-opcion-empresa">
                                <span>{op.tipo === 'vuelo' ? '✈️' : '🚌'}</span>
                                <strong>{op.empresa}</strong>
                                {op.esEstimado && <span className="viatico-badge-estimado">Precio estimado</span>}
                              </div>
                              <div className="viatico-opcion-horario">
                                <span className="viatico-hora">{op.salida}</span>
                                <span className="viatico-duracion">— {op.duracion} —</span>
                                <span className="viatico-hora">{op.llegada}</span>
                              </div>
                              <div className="viatico-opcion-precio">${formatearMiles(op.precio)} COP</div>
                              {viajeVuelta?.id === id && <div className="viatico-seleccionado">✓ Seleccionado</div>}
                            </button>
                          );
                        })}
                      </div>
                    )
                  }
                </div>
              )}

              {totalTransporte > 0 && (
                <div className="viatico-total-linea">
                  ✈ Total transporte: <strong>${formatearMiles(totalTransporte)} COP</strong>
                </div>
              )}

              <button type="button" className="admin-ghost-button" style={{ marginTop: 12 }}
                onClick={() => { setYaFueBuscado(false); buscarViajes(); }}>
                🔄 Buscar de nuevo
              </button>
            </>
          )}

          {/* Factura de transporte */}
          <div className="leg-factura-section" style={{ marginTop: 24 }}>
            <div className="leg-factura-label">
              <strong>Tiquete / comprobante de transporte *</strong>
              {!facturaTransporte?.archivoId && <span className="leg-factura-falta">⚠ Obligatorio</span>}
              {facturaTransporte?.archivoId && (
                <span className={facturaTransporte.alertas.length ? 'leg-factura-warn' : 'leg-factura-ok'}>
                  ✓ {facturaTransporte.nombre}
                  {facturaTransporte.alertas.length > 0 && ` — ${facturaTransporte.alertas.length} alerta(s)`}
                </span>
              )}
            </div>
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
                  <input type="number" min="0" max="30" value={dias} onChange={(e) => setDias(e.target.value)}
                    placeholder="Días" />
                  <span className="viaticos-comida-x">×</span>
                  <input type="text" inputMode="numeric" value={valor}
                    onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
                    placeholder="$ por día" />
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

            <h4>Viaje</h4>
            <div className="leg-resumen-row">
              <span>Ruta:</span>
              <strong>{ciudadOrigen} → {ciudadDestino}{esIdaVuelta ? ' (ida y vuelta)' : ' (solo ida)'}</strong>
            </div>
            <div className="leg-resumen-row"><span>Fecha ida:</span> <strong>{fechaIda}</strong></div>
            {esIdaVuelta && <div className="leg-resumen-row"><span>Fecha regreso:</span> <strong>{fechaRegreso}</strong></div>}
            {viajeIda && (
              <div className="leg-resumen-row">
                <span>Transporte ida:</span>
                <strong>{viajeIda.tipo === 'vuelo' ? '✈️' : '🚌'} {viajeIda.empresa} — ${formatearMiles(viajeIda.precio)}</strong>
              </div>
            )}
            {esIdaVuelta && viajeVuelta && (
              <div className="leg-resumen-row">
                <span>Transporte regreso:</span>
                <strong>{viajeVuelta.tipo === 'vuelo' ? '✈️' : '🚌'} {viajeVuelta.empresa} — ${formatearMiles(viajeVuelta.precio)}</strong>
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
                {(parseInt(diasDesayuno) || 0) > 0 && (
                  <div className="leg-resumen-row"><span>Desayunos:</span> <strong>{diasDesayuno} × ${formatearMiles(parseInt(valorDesayuno) || 0)} = ${formatearMiles((parseInt(diasDesayuno) || 0) * (parseInt(valorDesayuno) || 0))}</strong></div>
                )}
                {(parseInt(diasAlmuerzo) || 0) > 0 && (
                  <div className="leg-resumen-row"><span>Almuerzos:</span> <strong>{diasAlmuerzo} × ${formatearMiles(parseInt(valorAlmuerzo) || 0)} = ${formatearMiles((parseInt(diasAlmuerzo) || 0) * (parseInt(valorAlmuerzo) || 0))}</strong></div>
                )}
                {(parseInt(diasCena) || 0) > 0 && (
                  <div className="leg-resumen-row"><span>Cenas:</span> <strong>{diasCena} × ${formatearMiles(parseInt(valorCena) || 0)} = ${formatearMiles((parseInt(diasCena) || 0) * (parseInt(valorCena) || 0))}</strong></div>
                )}
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
