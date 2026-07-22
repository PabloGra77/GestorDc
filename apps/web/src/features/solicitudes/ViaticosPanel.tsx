import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/http/api';
import { formatearMiles } from '../../utils/numeroALetras';
import { SignaturePad } from '../../components/SignaturePad';
import { useOcrDocument, validarOcrContraDato } from '../../hooks/useOcrDocument';
import { DEPTOS } from './colombiaData';
import { MapaRuta } from './MapaRuta';

/* ─── Tipos ─────────────────────────────────────────────────── */
interface TarifasViaticos {
  precioAereo: number;
  precioTerrestre: number;
  precioDesayuno: number;
  precioAlmuerzo: number;
  precioCena: number;
  precioHospedaje: number;
}

interface UsuarioSugerido { id: number; nombreCompleto: string; rol: string; area: string | null; }
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

/* ─── Bloque de tipo de transporte ─────────────────────────── */
function TipoTransporteBloque({
  titulo, tipo, onTipo, tarifas,
}: { titulo: string; tipo: 'aereo' | 'terrestre'; onTipo: (v: 'aereo' | 'terrestre') => void; tarifas: TarifasViaticos | null }) {
  const precio = tarifas ? (tipo === 'aereo' ? tarifas.precioAereo : tarifas.precioTerrestre) : 0;
  return (
    <div className="viatico-tiquete-bloque">
      <div className="viatico-tiquete-titulo">{titulo}</div>
      <div className="leg-field">
        <label>Tipo de transporte *</label>
        <div className="viaticos-tipo-transport-row">
          <button type="button" className={`viatico-tr-btn${tipo === 'aereo' ? ' selected' : ''}`} onClick={() => onTipo('aereo')}>
            ✈ Aéreo
          </button>
          <button type="button" className={`viatico-tr-btn${tipo === 'terrestre' ? ' selected' : ''}`} onClick={() => onTipo('terrestre')}>
            🚌 Terrestre
          </button>
        </div>
      </div>
      <div className="viatico-tarifa-fija-display">
        <span>Tarifa {tipo === 'aereo' ? 'aéreo' : 'terrestre'}:</span>
        <strong>{tarifas ? `$${formatearMiles(precio)} COP` : 'Cargando…'}</strong>
      </div>
    </div>
  );
}

/* ─── Panel Viáticos ────────────────────────────────────────── */
export function ViaticosPanel({ onCreada, areaId }: { onCreada?: (info: { id: number; numeroRadicado: string }) => void; areaId?: number }) {
  const [paso, setPaso] = useState<1 | 2 | 3 | 4 | 5>(1);

  /* Tarifas fijas del admin */
  const [tarifas, setTarifas] = useState<TarifasViaticos | null>(null);

  /* Paso 1 */
  const [tipoViatico, setTipoViatico] = useState<'anticipo' | 'legalizar' | ''>('anticipo');
  const [autorizadorInput, setAutorizadorInput] = useState('');
  const [autorizadorId, setAutorizadorId] = useState(0);
  const [autorizadorNombre, setAutorizadorNombre] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioSugerido[]>([]);
  const [showSugeridos, setShowSugeridos] = useState(false);
  const [motivoViaje, setMotivoViaje] = useState('');

  /* Paso 2 */
  const [ciudadOrigen, setCiudadOrigen] = useState('');
  const [ciudadDestino, setCiudadDestino] = useState('');
  const [deptoOrigen, setDeptoOrigen] = useState('');
  const [deptoDestino, setDeptoDestino] = useState('');
  const [esIdaVuelta, setEsIdaVuelta] = useState(true);
  const [fechaIda, setFechaIda] = useState('');
  const [fechaRegreso, setFechaRegreso] = useState('');

  /* Paso 3 — tipo de transporte */
  const [tipoTrIda, setTipoTrIda] = useState<'aereo' | 'terrestre'>('aereo');
  const [tipoTrVuelta, setTipoTrVuelta] = useState<'aereo' | 'terrestre'>('aereo');
  /* Solo para legalización */
  const [empresaIda, setEmpresaIda] = useState('');
  const [numDocIda, setNumDocIda] = useState('');
  const [codResIda, setCodResIda] = useState('');
  const [tramoIda, setTramoIda] = useState('');
  const [puestoIda, setPuestoIda] = useState('');
  const [hrSalidaIda, setHrSalidaIda] = useState('');
  const [hrLlegadaIda, setHrLlegadaIda] = useState('');
  const [empresaVuelta, setEmpresaVuelta] = useState('');
  const [numDocVuelta, setNumDocVuelta] = useState('');
  const [codResVuelta, setCodResVuelta] = useState('');
  const [tramoVuelta, setTramoVuelta] = useState('');
  const [puestoVuelta, setPuestoVuelta] = useState('');
  const [hrSalidaVuelta, setHrSalidaVuelta] = useState('');
  const [hrLlegadaVuelta, setHrLlegadaVuelta] = useState('');
  const [facturaTransporte, setFacturaTransporte] = useState<FacturaAdj | null>(null);
  const [subiendoTransporte, setSubiendoTransporte] = useState(false);

  /* Paso 4 — hospedaje */
  const [tieneHospedaje, setTieneHospedaje] = useState(false);
  const [hotelNombre, setHotelNombre] = useState('');
  const [hotelEntrada, setHotelEntrada] = useState('');
  const [hotelSalida, setHotelSalida] = useState('');
  const [facturaHotel, setFacturaHotel] = useState<FacturaAdj | null>(null);
  const [subiendoHotel, setSubiendoHotel] = useState(false);

  /* Paso 4 — alimentación (solo días; precio viene de tarifas) */
  const [diasDesayuno, setDiasDesayuno] = useState('');
  const [diasAlmuerzo, setDiasAlmuerzo] = useState('');
  const [diasCena, setDiasCena] = useState('');
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

  /* Cargar tarifas y usuarios */
  useEffect(() => {
    api.get<TarifasViaticos>('/tarifas-viaticos').then((r) => setTarifas(r.data)).catch(() => {});
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

  /* Precio unitario de transporte según tipo seleccionado */
  const precioIda    = tarifas ? (tipoTrIda    === 'aereo' ? tarifas.precioAereo : tarifas.precioTerrestre) : 0;
  const precioVuelta = tarifas ? (tipoTrVuelta === 'aereo' ? tarifas.precioAereo : tarifas.precioTerrestre) : 0;

  /* Cálculos */
  const totalTransporte = useMemo(() => precioIda + (esIdaVuelta ? precioVuelta : 0), [precioIda, precioVuelta, esIdaVuelta]);

  const noches = useMemo(() => {
    if (!tieneHospedaje || !hotelEntrada || !hotelSalida) return 0;
    return Math.max(0, Math.round((new Date(hotelSalida).getTime() - new Date(hotelEntrada).getTime()) / 86400000));
  }, [tieneHospedaje, hotelEntrada, hotelSalida]);

  const precioHospedaje = tarifas?.precioHospedaje ?? 0;
  const totalHospedaje  = useMemo(() => tieneHospedaje ? precioHospedaje * noches : 0, [tieneHospedaje, precioHospedaje, noches]);

  const totalComidas = useMemo(() => {
    const pd = tarifas?.precioDesayuno ?? 0;
    const pa = tarifas?.precioAlmuerzo ?? 0;
    const pc = tarifas?.precioCena     ?? 0;
    return (parseInt(diasDesayuno) || 0) * pd
         + (parseInt(diasAlmuerzo) || 0) * pa
         + (parseInt(diasCena)     || 0) * pc;
  }, [diasDesayuno, diasAlmuerzo, diasCena, tarifas]);

  const totalGeneral = useMemo(() => totalTransporte + totalHospedaje + totalComidas, [totalTransporte, totalHospedaje, totalComidas]);

  const subirFactura = useCallback(async (
    file: File,
    tipo: 'transporte' | 'hotel' | 'comidas',
    contexto: { valor?: number; ciudad?: string; fecha?: string },
  ) => {
    const setSubiendo = tipo === 'transporte' ? setSubiendoTransporte : tipo === 'hotel' ? setSubiendoHotel : setSubiendoComidas;
    const setFactura  = tipo === 'transporte' ? setFacturaTransporte  : tipo === 'hotel' ? setFacturaHotel  : setFacturaComidas;
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
            const ocrFlat = texto.replace(/[.,\s]/g, '');
            if (!ocrFlat.includes(limpio)) alertas.push(`El valor $${formatearMiles(contexto.valor)} no se identificó claramente en el soporte.`);
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
    } catch (ex: unknown) {
      const serverMsg = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const isServerError = (ex as { response?: unknown })?.response !== undefined;
      const errMsg = isServerError
        ? (serverMsg?.toLowerCase().includes('tamaño') || serverMsg?.toLowerCase().includes('excede')
            ? 'El archivo es demasiado grande. Usa JPG, PNG o PDF de menos de 10 MB.'
            : serverMsg?.toLowerCase().includes('tipo') || serverMsg?.toLowerCase().includes('formato')
              ? 'Formato no permitido. Solo JPG, PNG, WEBP o PDF.'
              : `Error en el servidor${serverMsg ? ': ' + serverMsg : '. Intenta de nuevo.'}`)
        : 'No se pudo subir el archivo. Verifica tu conexión e inténtalo de nuevo.';
      setFactura({ archivoId: '', nombre: '', alertas: [errMsg] });
    } finally {
      setSubiendo(false);
    }
  }, [procesarArchivo]);

  function validarPaso(): string {
    if (paso === 1) {
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
      if (tipoViatico === 'legalizar') {
        if (!empresaIda.trim()) return 'Ingresa la empresa transportadora de ida';
        if (!numDocIda.trim()) return `Ingresa el ${tipoTrIda === 'aereo' ? 'número de vuelo' : 'número de tiquete'} de ida`;
        if (esIdaVuelta && !empresaVuelta.trim()) return 'Ingresa la empresa transportadora de regreso';
        if (esIdaVuelta && !numDocVuelta.trim()) return `Ingresa el ${tipoTrVuelta === 'aereo' ? 'número de vuelo' : 'número de tiquete'} de regreso`;
        if (!facturaTransporte?.archivoId) return 'Adjunta el tiquete o comprobante de transporte';
      }
    }
    if (paso === 4) {
      if (tieneHospedaje) {
        if (!hotelNombre.trim()) return 'Ingresa el nombre del hotel';
        if (!hotelEntrada || !hotelSalida) return 'Ingresa las fechas de entrada y salida del hotel';
      }
    }
    if (paso === 5) {
      if (!firma) return 'La firma digital es obligatoria';
    }
    return '';
  }

  function siguiente() { const e = validarPaso(); if (e) { setErr(e); return; } setErr(''); setPaso((p) => Math.min(5, p + 1) as 1|2|3|4|5); }
  function anterior() { setErr(''); setPaso((p) => Math.max(1, p - 1) as 1|2|3|4|5); }

  function resetear() {
    setPaso(1); setTipoViatico('anticipo'); setAutorizadorInput(''); setAutorizadorId(0); setAutorizadorNombre(''); setMotivoViaje('');
    setCiudadOrigen(''); setCiudadDestino(''); setFechaIda(''); setFechaRegreso(''); setEsIdaVuelta(true);
    setTipoTrIda('aereo'); setTipoTrVuelta('aereo');
    setEmpresaIda(''); setNumDocIda(''); setCodResIda(''); setTramoIda(''); setPuestoIda(''); setHrSalidaIda(''); setHrLlegadaIda('');
    setEmpresaVuelta(''); setNumDocVuelta(''); setCodResVuelta(''); setTramoVuelta(''); setPuestoVuelta(''); setHrSalidaVuelta(''); setHrLlegadaVuelta('');
    setFacturaTransporte(null); setTieneHospedaje(false); setHotelNombre(''); setHotelEntrada(''); setHotelSalida(''); setFacturaHotel(null);
    setDiasDesayuno(''); setDiasAlmuerzo(''); setDiasCena(''); setFacturaComidas(null);
    setFirma(''); setMsg('');
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
        setErr('No se encontró el tipo "Viáticos". El administrador debe crearlo con slug "viaticos".');
        return;
      }
      const docs: Record<string, unknown> = {};
      if (facturaTransporte?.archivoId) docs['tiquete'] = { archivoId: facturaTransporte.archivoId, nombre: facturaTransporte.nombre, ocrAlertas: facturaTransporte.alertas };
      if (facturaHotel?.archivoId)      docs['hotel']   = { archivoId: facturaHotel.archivoId,      nombre: facturaHotel.nombre,      ocrAlertas: facturaHotel.alertas };
      if (facturaComidas?.archivoId)    docs['comidas'] = { archivoId: facturaComidas.archivoId,    nombre: facturaComidas.nombre,    ocrAlertas: facturaComidas.alertas };

      const tiqueteIda = { tipo: tipoTrIda, empresa: empresaIda, numDoc: numDocIda, codReserva: codResIda, tramo: tramoIda, puesto: puestoIda, horaSalida: hrSalidaIda, horaLlegada: hrLlegadaIda, valor: String(precioIda) };
      const tiqueteVuelta = esIdaVuelta ? { tipo: tipoTrVuelta, empresa: empresaVuelta, numDoc: numDocVuelta, codReserva: codResVuelta, tramo: tramoVuelta, puesto: puestoVuelta, horaSalida: hrSalidaVuelta, horaLlegada: hrLlegadaVuelta, valor: String(precioVuelta) } : null;

      const r = await api.post<{ id: number; numeroRadicado: string }>('/solicitudes', {
        tipoSolicitudId: tipo.id,
        ...(areaId ? { areaSeleccionadaId: areaId } : {}),
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
          hotelSalida:  tieneHospedaje ? hotelSalida  : '',
          hotelNoches:  tieneHospedaje ? String(noches) : '0',
          hotelValorNoche: tieneHospedaje ? String(precioHospedaje) : '0',
          diasDesayuno, valorDesayuno: String(tarifas?.precioDesayuno ?? 0),
          diasAlmuerzo, valorAlmuerzo: String(tarifas?.precioAlmuerzo ?? 0),
          diasCena,     valorCena:     String(tarifas?.precioCena     ?? 0),
          totalTransporte: String(totalTransporte),
          totalHospedaje:  String(totalHospedaje),
          totalComidas:    String(totalComidas),
          totalGeneral:    String(totalGeneral),
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

  const PASOS = ['Tipo y autorización', 'Detalles del viaje', 'Transporte', 'Hospedaje y comidas', 'Resumen y firma'];

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
            <div className="leg-radio-group">
              <label className="leg-radio-item">
                <input type="radio" name="tipoViatico" checked={tipoViatico === 'anticipo'} onChange={() => setTipoViatico('anticipo')} />
                <div>
                  <strong>Solicitud de anticipo</strong>
                  <span className="leg-radio-desc">Pide el dinero antes del viaje. Luego debes legalizarlo con tiquetes y facturas.</span>
                </div>
              </label>
              <label className="leg-radio-item">
                <input type="radio" name="tipoViatico" checked={tipoViatico === 'legalizar'} onChange={() => setTipoViatico('legalizar')} />
                <div>
                  <strong>Legalización de viático</strong>
                  <span className="leg-radio-desc">Ya realizaste el viaje y quieres reembolso o legalizar un anticipo previo.</span>
                </div>
              </label>
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

          <div className="viaje-ciudad-grid">
            <div className="viaje-ciudad-bloque">
              <div className="leg-field">
                <label>Departamento de origen *</label>
                <select value={deptoOrigen} onChange={(e) => { setDeptoOrigen(e.target.value); setCiudadOrigen(''); }} required>
                  <option value="">— Departamento —</option>
                  {DEPTOS.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div className="leg-field">
                <label>Ciudad de origen *</label>
                <select value={ciudadOrigen} onChange={(e) => setCiudadOrigen(e.target.value)} required disabled={!deptoOrigen}>
                  <option value="">— Ciudad —</option>
                  {(DEPTOS.find((d) => d.id === deptoOrigen)?.ciudades ?? []).map((c) => (
                    <option key={c.nombre} value={c.nombre}>{c.nombre}{c.iata ? ` (${c.iata})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="viaje-ciudad-bloque">
              <div className="leg-field">
                <label>Departamento de destino *</label>
                <select value={deptoDestino} onChange={(e) => { setDeptoDestino(e.target.value); setCiudadDestino(''); }} required>
                  <option value="">— Departamento —</option>
                  {DEPTOS.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div className="leg-field">
                <label>Ciudad de destino *</label>
                <select value={ciudadDestino} onChange={(e) => setCiudadDestino(e.target.value)} required disabled={!deptoDestino}>
                  <option value="">— Ciudad —</option>
                  {(DEPTOS.find((d) => d.id === deptoDestino)?.ciudades ?? []).map((c) => (
                    <option key={c.nombre} value={c.nombre}>{c.nombre}{c.iata ? ` (${c.iata})` : ''}</option>
                  ))}
                </select>
              </div>
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

          {(ciudadOrigen || ciudadDestino) && (
            <MapaRuta origen={ciudadOrigen} destino={ciudadDestino} fecha={fechaIda || new Date().toISOString().slice(0, 10)} />
          )}

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Transporte
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 3: Transporte ── */}
      {paso === 3 && (
        <div className="leg-form card-surface">
          <h3>Transporte</h3>
          <p className="leg-nota">
            {tipoViatico === 'anticipo'
              ? 'Selecciona el tipo de transporte. Las tarifas están configuradas por el administrador.'
              : 'Selecciona el tipo de transporte e ingresa los datos del tiquete.'}
          </p>

          {!tarifas && <p className="admin-help-text">Cargando tarifas…</p>}
          {tarifas && (tarifas.precioAereo === 0 && tarifas.precioTerrestre === 0) && (
            <div className="viatico-anticipo-aviso">
              El administrador aún no ha configurado las tarifas de viáticos. Los valores aparecerán en $0.
            </div>
          )}

          <TipoTransporteBloque
            titulo={esIdaVuelta ? '🛫 Ida' : '🛫 Tiquete'}
            tipo={tipoTrIda}
            onTipo={setTipoTrIda}
            tarifas={tarifas}
          />

          {/* Detalles solo para legalización */}
          {tipoViatico === 'legalizar' && (
            <div className="leg-gasto-fields" style={{ marginTop: 8 }}>
              <div className="leg-field">
                <label>Empresa transportadora *</label>
                <input type="text" value={empresaIda} onChange={(e) => setEmpresaIda(e.target.value)}
                  placeholder={tipoTrIda === 'aereo' ? 'Ej: Avianca, LATAM' : 'Ej: COOFLOTAX, Flota Magdalena'} />
              </div>
              <div className="leg-field">
                <label>{tipoTrIda === 'aereo' ? 'Número de vuelo *' : 'Número de tiquete *'}</label>
                <input type="text" value={numDocIda} onChange={(e) => setNumDocIda(e.target.value.toUpperCase())}
                  placeholder={tipoTrIda === 'aereo' ? 'Ej: AV 8001' : 'Ej: DEST4-83964'} />
              </div>
              {tipoTrIda === 'aereo' && (
                <div className="leg-field">
                  <label>Código de reserva</label>
                  <input type="text" value={codResIda} onChange={(e) => setCodResIda(e.target.value.toUpperCase())} placeholder="Ej: J48SQO" maxLength={10} />
                </div>
              )}
              {tipoTrIda === 'terrestre' && (
                <>
                  <div className="leg-field">
                    <label>Tramo / Ruta</label>
                    <input type="text" value={tramoIda} onChange={(e) => setTramoIda(e.target.value)} placeholder="Ej: SANTA ROSA - DUITAMA" />
                  </div>
                  <div className="leg-field">
                    <label>Puesto / Silla</label>
                    <input type="text" value={puestoIda} onChange={(e) => setPuestoIda(e.target.value)} placeholder="Ej: 3, 12A" maxLength={6} />
                  </div>
                </>
              )}
              <div className="leg-field">
                <label>Hora de salida</label>
                <input type="time" value={hrSalidaIda} onChange={(e) => setHrSalidaIda(e.target.value)} />
              </div>
              <div className="leg-field">
                <label>Hora de llegada</label>
                <input type="time" value={hrLlegadaIda} onChange={(e) => setHrLlegadaIda(e.target.value)} />
              </div>
            </div>
          )}

          {esIdaVuelta && (
            <>
              <TipoTransporteBloque
                titulo="🛬 Regreso"
                tipo={tipoTrVuelta}
                onTipo={setTipoTrVuelta}
                tarifas={tarifas}
              />
              {tipoViatico === 'legalizar' && (
                <div className="leg-gasto-fields" style={{ marginTop: 8 }}>
                  <div className="leg-field">
                    <label>Empresa transportadora *</label>
                    <input type="text" value={empresaVuelta} onChange={(e) => setEmpresaVuelta(e.target.value)}
                      placeholder={tipoTrVuelta === 'aereo' ? 'Ej: Avianca, LATAM' : 'Ej: COOFLOTAX, Flota Magdalena'} />
                  </div>
                  <div className="leg-field">
                    <label>{tipoTrVuelta === 'aereo' ? 'Número de vuelo *' : 'Número de tiquete *'}</label>
                    <input type="text" value={numDocVuelta} onChange={(e) => setNumDocVuelta(e.target.value.toUpperCase())}
                      placeholder={tipoTrVuelta === 'aereo' ? 'Ej: AV 8001' : 'Ej: DEST4-83964'} />
                  </div>
                  {tipoTrVuelta === 'aereo' && (
                    <div className="leg-field">
                      <label>Código de reserva</label>
                      <input type="text" value={codResVuelta} onChange={(e) => setCodResVuelta(e.target.value.toUpperCase())} placeholder="Ej: J48SQO" maxLength={10} />
                    </div>
                  )}
                  {tipoTrVuelta === 'terrestre' && (
                    <>
                      <div className="leg-field">
                        <label>Tramo / Ruta</label>
                        <input type="text" value={tramoVuelta} onChange={(e) => setTramoVuelta(e.target.value)} placeholder="Ej: DUITAMA - SANTA ROSA" />
                      </div>
                      <div className="leg-field">
                        <label>Puesto / Silla</label>
                        <input type="text" value={puestoVuelta} onChange={(e) => setPuestoVuelta(e.target.value)} placeholder="Ej: 3, 12A" maxLength={6} />
                      </div>
                    </>
                  )}
                  <div className="leg-field">
                    <label>Hora de salida</label>
                    <input type="time" value={hrSalidaVuelta} onChange={(e) => setHrSalidaVuelta(e.target.value)} />
                  </div>
                  <div className="leg-field">
                    <label>Hora de llegada</label>
                    <input type="time" value={hrLlegadaVuelta} onChange={(e) => setHrLlegadaVuelta(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          )}

          {totalTransporte > 0 && (
            <div className="viatico-total-linea">
              ✈ Total transporte: <strong>${formatearMiles(totalTransporte)} COP</strong>
            </div>
          )}

          {/* Adjuntar tiquete — solo para legalización */}
          {tipoViatico === 'anticipo' ? (
            <div className="viatico-anticipo-aviso" style={{ marginTop: 20 }}>
              <strong>No necesitas adjuntar tiquete ahora.</strong> Al recibir el anticipo, la plataforma te pedirá que lo legalices con los tiquetes y facturas reales.
            </div>
          ) : (
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
          )}

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
          <h3>{tipoViatico === 'anticipo' ? 'Estimación de hospedaje y alimentación' : 'Alojamiento y alimentación'}</h3>
          {tipoViatico === 'anticipo' && (
            <p className="leg-nota">Indica los días / noches que necesitas. Los valores son las tarifas fijas configuradas.</p>
          )}

          {/* HOSPEDAJE */}
          <div className="viaticos-seccion-titulo">🏨 Hospedaje</div>
          <div className="leg-field">
            <label className="viaticos-check-label">
              <input type="checkbox" checked={tieneHospedaje} onChange={(e) => setTieneHospedaje(e.target.checked)} />
              {tipoViatico === 'anticipo' ? 'El viaje requerirá hospedaje' : 'El viaje requirió / requerirá hospedaje'}
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
              </div>
              {noches > 0 && (
                <div className="viatico-total-linea">
                  🏨 {noches} noche(s) × ${formatearMiles(precioHospedaje)}/noche = <strong>${formatearMiles(totalHospedaje)}</strong>
                </div>
              )}
              {noches === 0 && hotelEntrada && hotelSalida && (
                <p className="leg-nota" style={{ color: 'var(--error, #c0392b)' }}>La fecha de salida debe ser posterior a la de entrada.</p>
              )}
              {tipoViatico === 'legalizar' && (
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
              )}
            </>
          )}

          {/* ALIMENTACIÓN */}
          <div className="viaticos-seccion-titulo" style={{ marginTop: 24 }}>🍽 Alimentación</div>
          <p className="leg-nota">Indica el número de días por tipo de comida. Las tarifas son fijas.</p>

          <div className="viaticos-comidas-grid">
            {([
              { key: 'desayuno', icon: '☀️', label: 'Desayunos', dias: diasDesayuno, setDias: setDiasDesayuno, precio: tarifas?.precioDesayuno ?? 0 },
              { key: 'almuerzo', icon: '🌤',  label: 'Almuerzos', dias: diasAlmuerzo, setDias: setDiasAlmuerzo, precio: tarifas?.precioAlmuerzo ?? 0 },
              { key: 'cena',    icon: '🌙',   label: 'Cenas',     dias: diasCena,     setDias: setDiasCena,     precio: tarifas?.precioCena     ?? 0 },
            ] as Array<{ key: string; icon: string; label: string; dias: string; setDias: (v: string) => void; precio: number }>).map(({ key, icon, label, dias, setDias, precio }) => (
              <div key={key} className="viaticos-comida-item">
                <div className="viaticos-comida-header">
                  <span>{icon}</span>
                  <strong>{label}</strong>
                </div>
                <div className="viaticos-comida-inputs">
                  <input type="number" min="0" max="30" value={dias} onChange={(e) => setDias(e.target.value)} placeholder="Días" />
                  <span className="viaticos-comida-x">× ${formatearMiles(precio)}/día</span>
                </div>
                {(parseInt(dias) || 0) > 0 && precio > 0 && (
                  <div className="viaticos-comida-subtotal">
                    = ${formatearMiles((parseInt(dias) || 0) * precio)}
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

          {totalComidas > 0 && tipoViatico === 'legalizar' && (
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
              <strong>{tipoTrIda === 'aereo' ? '✈ Aéreo' : '🚌 Terrestre'} — ${formatearMiles(precioIda)}</strong>
            </div>
            {esIdaVuelta && (
              <div className="leg-resumen-row">
                <span>Regreso:</span>
                <strong>{tipoTrVuelta === 'aereo' ? '✈ Aéreo' : '🚌 Terrestre'} — ${formatearMiles(precioVuelta)}</strong>
              </div>
            )}

            {tieneHospedaje && (
              <>
                <h4>Hospedaje</h4>
                <div className="leg-resumen-row"><span>Hotel:</span> <strong>{hotelNombre}</strong></div>
                <div className="leg-resumen-row">
                  <span>Costo:</span>
                  <strong>{noches} noche(s) × ${formatearMiles(precioHospedaje)} = ${formatearMiles(totalHospedaje)}</strong>
                </div>
              </>
            )}

            {totalComidas > 0 && (
              <>
                <h4>Alimentación</h4>
                {(parseInt(diasDesayuno) || 0) > 0 && <div className="leg-resumen-row"><span>Desayunos:</span> <strong>{diasDesayuno} × ${formatearMiles(tarifas?.precioDesayuno ?? 0)} = ${formatearMiles((parseInt(diasDesayuno)||0)*(tarifas?.precioDesayuno??0))}</strong></div>}
                {(parseInt(diasAlmuerzo) || 0) > 0 && <div className="leg-resumen-row"><span>Almuerzos:</span> <strong>{diasAlmuerzo} × ${formatearMiles(tarifas?.precioAlmuerzo ?? 0)} = ${formatearMiles((parseInt(diasAlmuerzo)||0)*(tarifas?.precioAlmuerzo??0))}</strong></div>}
                {(parseInt(diasCena) || 0) > 0    && <div className="leg-resumen-row"><span>Cenas:</span>     <strong>{diasCena}     × ${formatearMiles(tarifas?.precioCena     ?? 0)} = ${formatearMiles((parseInt(diasCena)    ||0)*(tarifas?.precioCena    ??0))}</strong></div>}
              </>
            )}

            <div className="leg-resumen-total-line">
              <span>{tipoViatico === 'anticipo' ? 'ANTICIPO SOLICITADO:' : 'TOTAL A REEMBOLSAR:'}</span>
              <strong>${formatearMiles(totalGeneral)} COP</strong>
            </div>
            {tipoViatico === 'anticipo' && (
              <div className="viatico-anticipo-aviso" style={{ marginTop: 12 }}>
                Al recibir este anticipo, deberás <strong>legalizarlo en la plataforma</strong> adjuntando los tiquetes y facturas reales.
              </div>
            )}
          </div>

          <div className="leg-field">
            <label>Firma del solicitante *</label>
            <p className="leg-nota">{tipoViatico === 'anticipo'
              ? 'Al firmar, declaras que el viaje está autorizado y te comprometes a legalizar el anticipo con facturas reales.'
              : 'Al firmar, declaras que la información es veraz y los soportes adjuntos son auténticos.'
            }</p>
            <SignaturePad value={firma} onChange={setFirma} />
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando…' : tipoViatico === 'anticipo' ? 'Solicitar viático' : 'Enviar legalización de viático'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
