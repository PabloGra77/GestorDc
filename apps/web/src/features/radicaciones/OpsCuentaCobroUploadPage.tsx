import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePayopsLogo } from '../../hooks/usePayopsLogo';
import { useOcrDocument, validarOcrContraDato, validarTipoDocumento } from '../../hooks/useOcrDocument';
import { numeroAPesosEnLetras, formatearMiles } from '../../utils/numeroALetras';
import { SignaturePad } from '../../components/SignaturePad';
import { BANCOS_COLOMBIA } from '../../utils/bancos';
import { etiquetaDocumento } from '../../utils/documentoLabels';
import { DireccionField } from '../../components/DireccionField';
import { ordenarCamposPorPlantilla } from '../../utils/ordenCamposPlantilla';

const API_PUBLICO = '/api/index.php/publico';

interface AreaPub {
  id: number;
  nombre: string;
  descripcion: string | null;
  slug: string;
}

interface CampoPlantilla {
  key: string;
  label: string;
  type: string;
  required: boolean;
  group?: string;
  ocr_target?: string;
  texto?: string;
}

interface BloqueCampoMin {
  tipo: string;
  campoKey?: string;
  etiqueta?: string;
  texto?: string;
  pagina?: number;
  y?: number;
  x?: number;
}

interface PlantillaPdfMin {
  bloques?: BloqueCampoMin[];
}

// Adivina el tipo de un campo por su clave (mismo criterio que el editor de plantillas)
function adivinarTipoCampo(key: string): string {
  const k = key.toLowerCase();
  if (k.startsWith('doc')) return 'file';
  if (k.includes('valor') || k.includes('monto') || k.includes('suma')) return 'valor-pesos';
  if (k.includes('fecha')) return 'date';
  if (k.includes('correo') || k.includes('email')) return 'email';
  if (k.includes('banco')) return 'banco-select';
  if (k.includes('cuenta')) return 'cuenta-bancaria';
  if (k.includes('concepto') || k.includes('observ') || k.includes('descrip')) return 'textarea';
  if (k.includes('direccion') || k.includes('destino')) return 'direccion';
  return 'text';
}

const TOKEN_CAMPOS: Record<string, { key: string; label: string; type: string }> = {
  valor: { key: 'valorPesos', label: 'Valor a cobrar', type: 'valor-pesos' },
  concepto: { key: 'observaciones', label: 'Concepto / observaciones', type: 'textarea' },
  ciudad: { key: 'ciudad', label: 'Ciudad', type: 'text' },
};

// Une los campos definidos del tipo con los que están colocados en la hoja
// (bloques "campo" y tokens {{valor}}/{{concepto}}/{{ciudad}}), para que el
// formulario público PREGUNTE todo lo que el documento necesita aunque no se
// haya agregado manualmente como dato. (Mismo criterio que el panel interno.)
function camposCompletos(campos: CampoPlantilla[], plantillaPdf?: PlantillaPdfMin | null): CampoPlantilla[] {
  const safeArr = Array.isArray(campos) ? campos : [];
  const vistos = new Set(safeArr.map((c) => c.key));
  const extra: CampoPlantilla[] = [];
  const bloques = (plantillaPdf?.bloques || []) as BloqueCampoMin[];
  for (const b of bloques) {
    if (b.tipo === 'campo' && b.campoKey && !b.campoKey.startsWith('__') && !vistos.has(b.campoKey)) {
      vistos.add(b.campoKey);
      extra.push({
        key: b.campoKey,
        label: (b.etiqueta || b.campoKey).replace(/[:]\s*$/, '').replace(/^[•☐]\s*/, '').trim() || b.campoKey,
        type: adivinarTipoCampo(b.campoKey),
        required: true,
        group: 'Datos del formato',
      });
    }
    if ((b.tipo === 'texto' || b.tipo === 'titulo') && b.texto) {
      const re = /\{\{(\w+)\}\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(b.texto)) !== null) {
        const def = TOKEN_CAMPOS[m[1]];
        if (def && !vistos.has(def.key)) {
          vistos.add(def.key);
          extra.push({ ...def, required: true, group: 'Datos del formato' });
        }
      }
    }
  }
  return [...safeArr, ...extra];
}

interface TipoPub {
  id: number;
  areaId: number;
  areaNombre: string;
  nombre: string;
  descripcion: string | null;
  camposPlantilla: CampoPlantilla[];
  plantillaPdf?: PlantillaPdfMin | null;
}

interface TrazadoPaso {
  rol: string;
  label: string;
  orden: number;
  estado: 'pendiente' | 'en_curso' | 'completado';
}

interface EstadoResp {
  autorizado: boolean;
  mensaje?: string;
  numeroRadicado?: string;
  tipoNombre?: string;
  areaNombre?: string;
  estado?: string;
  pasoActual?: string | null;
  creadoEn?: string;
  aprobadoEn?: string | null;
  trazado?: TrazadoPaso[];
  movimientosPublicos?: Array<{ accion: string; paso: string | null; comentario: string | null; creadoEn: string }>;
}

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  en_validacion: 'En validación',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  devuelto: 'Devuelto',
};

export function OpsCuentaCobroUploadPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const logoSrc = usePayopsLogo();
  const [logoOk, setLogoOk] = useState(true);
  const [tab, setTab] = useState<'estado' | 'realizar'>(
    params.get('tab') === 'realizar' ? 'realizar' : 'estado'
  );

  return (
    <div className="login-shell ops-shell">
      <section className="login-panel ops-panel">
        <div className="ops-public-topbar">
          <button
            type="button"
            className="admin-ghost-button"
            onClick={() => navigate('/login')}
          >
            ← Volver al inicio de sesión
          </button>
        </div>
        <div className="login-brand">
          {logoOk ? (
            <img
              src={logoSrc}
              alt="Goleman IPS"
              style={{ width: 180, height: 'auto', maxWidth: '60%', background: 'transparent' }}
              onError={() => setLogoOk(false)}
            />
          ) : null}
          <div>
            <h1 className="login-title">Solicitud de radicación</h1>
            <p className="login-subtitle">Tramite electronico Goleman IPS</p>
          </div>
        </div>

        <div className="ops-public-tabs" role="tablist">
          <button
            type="button"
            className={`ops-public-tab${tab === 'estado' ? ' active' : ''}`}
            onClick={() => setTab('estado')}
          >
            Estado de mi solicitud
          </button>
          <button
            type="button"
            className={`ops-public-tab${tab === 'realizar' ? ' active' : ''}`}
            onClick={() => setTab('realizar')}
          >
            Realizar solicitud
          </button>
        </div>

        {tab === 'estado' ? <EstadoPublico /> : <RealizarPublica />}
      </section>
    </div>
  );
}

/* ============================================================
   ESTADO PUBLICO — consulta por radicado + cedula
   ============================================================ */
function EstadoPublico() {
  const [numero, setNumero] = useState('');
  const [cc, setCc] = useState('');
  const [resp, setResp] = useState<EstadoResp | null>(null);
  const [err, setErr] = useState('');
  const [cargando, setCargando] = useState(false);

  async function buscar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr('');
    setResp(null);
    if (!numero.trim() || !cc.trim()) {
      setErr('Debes ingresar numero de radicado y cedula.');
      return;
    }
    setCargando(true);
    try {
      const url = `${API_PUBLICO}/solicitudes/estado?numero=${encodeURIComponent(numero.trim().toUpperCase())}&cc=${encodeURIComponent(cc.trim())}`;
      const r = await fetch(url);
      const data: EstadoResp = await r.json();
      setResp(data);
    } catch {
      setErr('No se pudo consultar el estado.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-card ops-card">
      <div className="login-card-header">
        <h2>Estado de mi solicitud</h2>
        <p>Consulta el avance ingresando tu numero de radicado y tu cedula.</p>
      </div>

      <form className="login-form" onSubmit={buscar}>
        <div className="form-group">
          <label htmlFor="est-num">Numero de radicado</label>
          <input
            id="est-num"
            type="text"
            placeholder="RAD-..."
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="est-cc">Documento de identidad del solicitante</label>
          <input
            id="est-cc"
            type="text"
            placeholder="CC, CE, pasaporte, etc."
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="login-button" disabled={cargando}>
          {cargando ? 'Consultando…' : 'Ver estado'}
        </button>
        {err ? <div className="login-error">{err}</div> : null}
      </form>

      {resp && !resp.autorizado ? (
        <div className="login-error" style={{ marginTop: 12 }}>{resp.mensaje}</div>
      ) : null}

      {resp && resp.autorizado ? (
        <div className="radicado-result card-surface" style={{ marginTop: 14 }}>
          <strong>{resp.numeroRadicado}</strong>
          <span>Tipo: {resp.tipoNombre}</span>
          <span>Area: {resp.areaNombre}</span>
          <span>Estado: <strong>{ESTADO_LABEL[resp.estado || ''] || resp.estado}</strong></span>
          {resp.aprobadoEn ? (
            <span>Aprobado: {new Date(resp.aprobadoEn.replace(' ', 'T') + 'Z').toLocaleString('es-CO')}</span>
          ) : null}

          {resp.trazado && resp.trazado.length > 0 ? (
            <div className="trazado-publico" style={{ marginTop: 12 }}>
              {resp.trazado.map((p) => (
                <div key={p.rol} className={`trazado-paso trazado-${p.estado}`}>
                  <span className="trazado-paso-icon">
                    {p.estado === 'completado' ? '✓' : p.estado === 'en_curso' ? '•' : ''}
                  </span>
                  <span>
                    <strong>{p.label}</strong>
                    <br />
                    <small>
                      {p.estado === 'completado' ? 'Validado' : p.estado === 'en_curso' ? 'En revision' : 'Pendiente'}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
   REALIZAR SOLICITUD PUBLICA — area, tipo, form dinamico
   ============================================================ */
function RealizarPublica() {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [areas, setAreas] = useState<AreaPub[]>([]);
  const [tipos, setTipos] = useState<TipoPub[]>([]);
  const [areaSel, setAreaSel] = useState<AreaPub | null>(null);
  const [tipoSel, setTipoSel] = useState<TipoPub | null>(null);
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [ocrPorCampo, setOcrPorCampo] = useState<Record<string, { texto: string; confianza: number; alertas: string[] }>>({});
  const [ocrCampoActivo, setOcrCampoActivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [resultado, setResultado] = useState<{ numeroRadicado: string } | null>(null);

  // Datos del solicitante (siempre obligatorios)
  const [firmaSolicitante, setFirmaSolicitante] = useState('');
  const [solNombre, setSolNombre] = useState('');
  const [solCorreo, setSolCorreo] = useState('');
  const [solCC, setSolCC] = useState('');
  const [subPaso, setSubPaso] = useState(0);

  const { procesarArchivo, running: ocrRunning, progress: ocrProgress } = useOcrDocument();

  useEffect(() => {
    setErr('');
    Promise.all([
      fetch(`${API_PUBLICO}/areas`).then((r) => r.json()),
      fetch(`${API_PUBLICO}/tipos`).then((r) => r.json()),
    ])
      .then(([a, t]) => {
        setAreas(a);
        setTipos(t);
      })
      .catch(() => setErr('No se pudo cargar el catalogo. Intenta de nuevo.'));
  }, []);

  const tiposDelArea = useMemo(() => {
    if (!areaSel) return [];
    return tipos.filter((t) => {
      if (t.areaId === areaSel.id) return true;
      const participantes = (t as unknown as { flujoAreas?: { areasParticipantes?: number[] } })?.flujoAreas?.areasParticipantes;
      return Array.isArray(participantes) && participantes.includes(areaSel.id);
    });
  }, [tipos, areaSel]);

  const camposPorGrupo = useMemo(() => {
    const m = new Map<string, CampoPlantilla[]>();
    if (!tipoSel) return m;
    const todos = camposCompletos(tipoSel.camposPlantilla, tipoSel.plantillaPdf);
    const camposOrdenados = ordenarCamposPorPlantilla(todos, tipoSel.plantillaPdf);
    for (const c of camposOrdenados) {
      const g = c.group || 'Datos';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
    return m;
  }, [tipoSel]);

  function reset() {
    setPaso(1);
    setSubPaso(0);
    setAreaSel(null);
    setTipoSel(null);
    setDatos({});
    setDocs({});
    setOcrPorCampo({});
    setResultado(null);
    setMsg('');
    setErr('');
  }

  // Sub-pasos del paso 3: [Datos solicitante, ...grupos, Firma]
  const gruposArr = useMemo(() => Array.from(camposPorGrupo.entries()), [camposPorGrupo]);
  const totalSubPasos = 1 + gruposArr.length + 1; // datos solicitante + grupos + firma

  function validarSubPaso(): string {
    if (subPaso === 0) {
      if (!solNombre.trim() || !solCorreo.trim() || !solCC.trim()) {
        return 'Diligencia nombre, correo y cedula.';
      }
      return '';
    }
    const grupoIdx = subPaso - 1;
    if (grupoIdx < gruposArr.length) {
      const [, campos] = gruposArr[grupoIdx];
      const faltan = campos.filter((c) => {
        if (!c.required) return false;
        if (c.type === 'texto-fijo') return false;
        if (c.type === 'file') return !docs[c.key];
        return !datos[c.key] || (datos[c.key] || '').trim() === '';
      });
      if (faltan.length > 0) return `Faltan: ${faltan.map((f) => f.label).join(', ')}`;
    }
    return '';
  }

  function siguienteSubPaso() {
    const e = validarSubPaso();
    if (e) { setErr(e); return; }
    setErr('');
    setSubPaso((p) => Math.min(totalSubPasos - 1, p + 1));
  }

  function anteriorSubPaso() {
    setErr('');
    setSubPaso((p) => Math.max(0, p - 1));
  }

  async function handleFile(key: string, file: File | null) {
    if (!file) {
      setDocs((p) => { const c = { ...p }; delete c[key]; return c; });
      setOcrPorCampo((p) => { const c = { ...p }; delete c[key]; return c; });
      return;
    }
    setDocs((p) => ({ ...p, [key]: file.name }));
    const campo = (Array.isArray(tipoSel?.camposPlantilla) ? tipoSel!.camposPlantilla : []).find((c) => c.key === key);
    if (!campo?.ocr_target) return;
    setOcrCampoActivo(key);
    const ocr = await procesarArchivo(file);
    setOcrCampoActivo(null);
    if (!ocr) return;
    const alertas: string[] = [];
    const target = campo.ocr_target;
    const targetLabel = etiquetaDocumento(target);

    // 1) Verificar que el documento sea del tipo correcto
    const tipoCheck = validarTipoDocumento(ocr.text, target);
    if (!tipoCheck.esValido) {
      const detectadoLabel = tipoCheck.tipoDetectado ? etiquetaDocumento(tipoCheck.tipoDetectado) : '';
      alertas.push(
        detectadoLabel
          ? `El archivo adjuntado no parece ser un ${targetLabel}. La inteligencia artificial detectó que se parece más a un ${detectadoLabel}.`
          : `El archivo adjuntado no parece ser un ${targetLabel}. Verifica que estés subiendo el documento correcto.`
      );
    }

    // 2) Validar cedula del solicitante presente en el doc
    const cc = solCC || datos.numeroDocumento || '';
    if (cc) {
      const v = validarOcrContraDato(ocr.text, cc, 'cc');
      if (!v.coincide) alertas.push(`El número ${cc} no se identificó en el ${targetLabel}.`);
    }
    if (solNombre) {
      const v = validarOcrContraDato(ocr.text, solNombre, 'texto');
      if (!v.coincide) alertas.push(`El nombre del solicitante no coincide del todo con el ${targetLabel}.`);
    }

    // 3) Validaciones especificas por tipo
    if (target === 'cuenta_bancaria') {
      const banco = datos.banco || '';
      const numCuenta = datos.numeroCuenta || '';
      if (banco) {
        const v = validarOcrContraDato(ocr.text, banco, 'texto');
        if (!v.coincide) alertas.push(`El banco "${banco}" no se identificó en la certificación bancaria.`);
      }
      if (numCuenta && numCuenta.length >= 5) {
        const v = validarOcrContraDato(ocr.text, numCuenta, 'cc');
        if (!v.coincide) alertas.push(`El número de cuenta ${numCuenta} no se identificó en la certificación bancaria.`);
      }
    }
    if (target === 'eps') {
      const eps = datos.eps || '';
      if (eps) {
        const v = validarOcrContraDato(ocr.text, eps, 'texto');
        if (!v.coincide) alertas.push(`La EPS "${eps}" no se identificó en el certificado.`);
      }
    }

    if (ocr.confidence < 50) alertas.push(`La inteligencia artificial leyó el documento con baja confiabilidad (${Math.round(ocr.confidence)}%). Adjunta una imagen más nítida si es posible.`);
    setOcrPorCampo((p) => ({ ...p, [key]: { texto: ocr.text, confianza: ocr.confidence, alertas } }));
  }

  const setDato = useCallback((k: string, v: string) => {
    setDatos((p) => ({ ...p, [k]: v }));
  }, []);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr('');
    if (!tipoSel) return;
    if (!solNombre.trim() || !solCorreo.trim() || !solCC.trim()) {
      setErr('Debes diligenciar nombre, correo y cedula.');
      return;
    }
    if (!firmaSolicitante) {
      setErr('Debes firmar para enviar la solicitud.');
      return;
    }
    const faltantes = camposCompletos(tipoSel.camposPlantilla, tipoSel.plantillaPdf).filter((c) => {
      if (!c.required) return false;
      if (c.type === 'file') return !docs[c.key];
      if (c.type === 'texto-fijo') return false;
      return !datos[c.key] || datos[c.key].trim() === '';
    });
    if (faltantes.length > 0) {
      setErr(`Faltan: ${faltantes.map((f) => f.label).join(', ')}`);
      return;
    }
    setEnviando(true);
    try {
      const documentosFinales: Record<string, unknown> = {};
      Object.entries(docs).forEach(([k, nombre]) => {
        const ocrInfo = ocrPorCampo[k];
        documentosFinales[k] = ocrInfo
          ? { nombre, ocrTexto: ocrInfo.texto, ocrConfianza: ocrInfo.confianza, ocrAlertas: ocrInfo.alertas }
          : { nombre };
      });
      const resp = await fetch(`${API_PUBLICO}/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoSolicitudId: tipoSel.id,
          solicitante: { nombre: solNombre.trim(), correo: solCorreo.trim().toLowerCase(), cc: solCC.trim() },
          datos,
          documentos: documentosFinales,
          firmas: { profesional: firmaSolicitante },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErr(data?.message || 'No se pudo crear la solicitud.');
        return;
      }
      setResultado({ numeroRadicado: data.numeroRadicado });
      setMsg('Solicitud enviada correctamente. Guarda tu numero de radicado.');
    } catch {
      setErr('No se pudo conectar con el servidor.');
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <div className="login-card ops-card">
        <div className="login-card-header">
          <h2>✓ Solicitud recibida</h2>
          <p>{msg}</p>
        </div>
        <div className="radicado-result card-surface" style={{ marginTop: 14 }}>
          <strong style={{ fontSize: 22 }}>{resultado.numeroRadicado}</strong>
          <span>Conserva este numero para consultar el estado.</span>
          <span>Tambien lo enviamos al correo {solCorreo}.</span>
        </div>
        <button type="button" className="login-button login-button-secondary" onClick={reset} style={{ marginTop: 14 }}>
          Hacer otra solicitud
        </button>
      </div>
    );
  }

  return (
    <div className="login-card ops-card">
      <div className="login-card-header">
        <h2>Realizar solicitud</h2>
        <p>Elige el area, el tipo y diligencia los datos requeridos.</p>
      </div>

      {err ? <div className="login-error">{err}</div> : null}

      {paso === 1 ? (
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="ops-area-select">Selecciona el area</label>
          <select
            id="ops-area-select"
            value={areaSel?.id ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              const a = areas.find((x) => x.id === id) || null;
              setAreaSel(a);
              setTipoSel(null);
              if (a) setPaso(2);
            }}
          >
            <option value="">— selecciona —</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
          {areas.length === 0 ? <p className="admin-help-text">No hay areas disponibles.</p> : null}
        </div>
      ) : null}

      {paso === 2 && areaSel ? (
        <>
          <button type="button" className="admin-ghost-button" onClick={() => setPaso(1)} style={{ marginBottom: 12 }}>
            ← Cambiar area
          </button>
          <div className="nueva-sol-cards">
            {tiposDelArea.length === 0 ? <p className="admin-help-text">No hay tipos en esta area.</p> : null}
            {tiposDelArea.map((t) => (
              <button key={t.id} type="button" className="nueva-sol-card" onClick={() => { setTipoSel(t); setPaso(3); setDatos({}); setDocs({}); setOcrPorCampo({}); }}>
                <strong>{t.nombre}</strong>
                <p>{t.descripcion || 'Sin descripcion'}</p>
                <small>{(Array.isArray(t.camposPlantilla) ? t.camposPlantilla : []).length} campo(s)</small>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {paso === 3 && tipoSel ? (
        <>
          <button type="button" className="admin-ghost-button" onClick={() => setPaso(2)} style={{ marginBottom: 12 }}>
            ← Cambiar tipo
          </button>
          <form className="nueva-sol-form" onSubmit={enviar}>
            {/* Indicador de sub-pasos */}
            <div className="nueva-sol-substeps">
              <span className={`nueva-sol-substep${subPaso === 0 ? ' active' : ''}${subPaso > 0 ? ' done' : ''}`}>
                1. Datos del solicitante
              </span>
              {gruposArr.map(([g], i) => (
                <span key={g} className={`nueva-sol-substep${subPaso === i + 1 ? ' active' : ''}${subPaso > i + 1 ? ' done' : ''}`}>
                  {i + 2}. {g}
                </span>
              ))}
              <span className={`nueva-sol-substep${subPaso === gruposArr.length + 1 ? ' active' : ''}`}>
                {gruposArr.length + 2}. Firma
              </span>
            </div>

            {subPaso === 0 ? (
              <div className="nueva-sol-grupo">
                <h4 className="nueva-sol-grupo-titulo">Datos del solicitante</h4>
                <div className="nueva-sol-grupo-grid">
                  <div className="form-group">
                    <label>Nombre completo <span className="req">*</span></label>
                    <input type="text" value={solNombre} onChange={(e) => setSolNombre(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Correo electronico <span className="req">*</span></label>
                    <input type="email" value={solCorreo} onChange={(e) => setSolCorreo(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Documento (CC, CE, etc.) <span className="req">*</span></label>
                    <input
                      type="text"
                      value={solCC}
                      onChange={(e) => setSolCC(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            ) : subPaso <= gruposArr.length ? (() => {
              const [grupo, campos] = gruposArr[subPaso - 1];
              return (
              <div key={grupo} className="nueva-sol-grupo">
                <h4 className="nueva-sol-grupo-titulo">{grupo}</h4>
                <div className="nueva-sol-grupo-grid">
                  {campos.map((c) => (
                    <div key={c.key} className="form-group" style={c.type === 'texto-fijo' ? { gridColumn: '1 / -1' } : undefined}>
                      {c.type !== 'texto-fijo' ? (
                        <label htmlFor={`pf-${c.key}`}>
                          {c.label} {c.required ? <span className="req">*</span> : null}
                        </label>
                      ) : null}
                      {renderCampo(c, datos, setDato, docs, handleFile, ocrCampoActivo, ocrRunning, ocrProgress, ocrPorCampo)}
                    </div>
                  ))}
                </div>
              </div>
              );
            })() : (
              <div className="nueva-sol-grupo">
                <h4 className="nueva-sol-grupo-titulo">Firma del solicitante</h4>
                <SignaturePad
                  label="Firma con dedo, lápiz táctil o adjunta imagen"
                  value={firmaSolicitante}
                  onChange={setFirmaSolicitante}
                />
              </div>
            )}

            <div className="nueva-sol-actions">
              <button type="button" className="admin-ghost-button" onClick={reset}>
                Cancelar
              </button>
              {subPaso > 0 ? (
                <button type="button" className="admin-ghost-button" onClick={anteriorSubPaso}>
                  ← Anterior
                </button>
              ) : null}
              {subPaso < totalSubPasos - 1 ? (
                <button type="button" className="login-button" onClick={siguienteSubPaso}>
                  Siguiente →
                </button>
              ) : (
                <button type="submit" className="login-button" disabled={enviando}>
                  {enviando ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              )}
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}

function renderCampo(
  c: CampoPlantilla,
  datos: Record<string, string>,
  setDato: (k: string, v: string) => void,
  docs: Record<string, string>,
  handleFile: (k: string, f: File | null) => void,
  ocrActivo: string | null,
  ocrRunning: boolean,
  ocrProgress: number,
  ocrPorCampo: Record<string, { texto: string; confianza: number; alertas: string[] }>,
) {
  const id = `pf-${c.key}`;
  if (c.type === 'texto-fijo') {
    return <p className="texto-fijo-nota">{c.texto || c.label}</p>;
  }
  if (c.type === 'textarea') {
    return <textarea id={id} value={datos[c.key] || ''} onChange={(e) => setDato(c.key, e.target.value)} required={c.required} />;
  }
  if (c.type === 'tipo-doc') {
    return (
      <select id={id} value={datos[c.key] || ''} onChange={(e) => setDato(c.key, e.target.value)} required={c.required}>
        <option value="">— selecciona —</option>
        <option value="CC">Cedula de ciudadania</option>
        <option value="CE">Cedula de extranjeria</option>
        <option value="TI">Tarjeta de identidad</option>
        <option value="PP">Pasaporte</option>
        <option value="NIT">NIT</option>
      </select>
    );
  }
  if (c.type === 'mes-anio') {
    return <input id={id} type="month" value={datos[c.key] || ''} onChange={(e) => setDato(c.key, e.target.value)} required={c.required} />;
  }
  if (c.type === 'valor-pesos') {
    return (
      <div className="valor-pesos-wrap">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="Ej: 1500000"
          value={datos[c.key] || ''}
          onChange={(e) => {
            const limpio = e.target.value.replace(/\D/g, '');
            setDato(c.key, limpio);
            setDato(`${c.key}__letras`, numeroAPesosEnLetras(limpio));
          }}
          required={c.required}
        />
        {datos[c.key] ? (
          <div className="valor-pesos-preview">
            <span>$ {formatearMiles(datos[c.key])}</span>
            <strong>{datos[`${c.key}__letras`] || numeroAPesosEnLetras(datos[c.key])}</strong>
          </div>
        ) : null}
      </div>
    );
  }
  if (c.type === 'cuenta-bancaria') {
    return (
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={datos[c.key] || ''}
        onChange={(e) => setDato(c.key, e.target.value.replace(/\D/g, ''))}
        required={c.required}
      />
    );
  }
  if (c.type === 'banco-select') {
    return (
      <select id={id} value={datos[c.key] || ''} onChange={(e) => setDato(c.key, e.target.value)} required={c.required}>
        <option value="">— selecciona banco —</option>
        {BANCOS_COLOMBIA.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    );
  }
  if (c.type === 'direccion') {
    return (
      <DireccionField
        value={datos[c.key] || ''}
        onChange={(json) => setDato(c.key, json)}
        required={c.required}
      />
    );
  }
  if (c.type === 'select' && c.key === 'tipoCuenta') {
    return (
      <select id={id} value={datos[c.key] || ''} onChange={(e) => setDato(c.key, e.target.value)} required={c.required}>
        <option value="">— selecciona —</option>
        <option value="ahorros">Ahorros</option>
        <option value="corriente">Corriente</option>
      </select>
    );
  }
  if (c.type === 'select' && c.key === 'tipoTransporte') {
    return (
      <select id={id} value={datos[c.key] || ''} onChange={(e) => setDato(c.key, e.target.value)} required={c.required}>
        <option value="">— selecciona —</option>
        <option value="avion">Avión</option>
        <option value="taxi">Taxi</option>
        <option value="pickup">Pick-up / Uber / Cabify / DiDi</option>
        <option value="carro_arrendado">Carro arrendado</option>
        <option value="bus">Bus / transporte público</option>
        <option value="otro">Otro</option>
      </select>
    );
  }
  if (c.type === 'file') {
    return (
      <>
        <input
          id={id}
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => handleFile(c.key, e.target.files?.[0] ?? null)}
          required={c.required && !docs[c.key]}
        />
        {c.ocr_target ? (
          <small className="admin-help-text">Validación automática con inteligencia artificial · documento esperado: <em>{etiquetaDocumento(c.ocr_target)}</em></small>
        ) : null}
        {ocrActivo === c.key && ocrRunning ? (
          <div className="ocr-progress">
            <div className="ocr-progress-bar" style={{ width: `${ocrProgress}%` }} />
            <small>Validando con inteligencia artificial… {ocrProgress}%</small>
          </div>
        ) : null}
        {ocrPorCampo[c.key] ? (
          <div className={`ocr-result ${ocrPorCampo[c.key].alertas.length > 0 ? 'ocr-warn' : 'ocr-ok'}`}>
            {ocrPorCampo[c.key].alertas.length === 0 ? (
              <small>✓ Documento validado por IA · confiabilidad {Math.round(ocrPorCampo[c.key].confianza)}%</small>
            ) : (
              <>
                <small>⚠ La inteligencia artificial detectó:</small>
                <ul>{ocrPorCampo[c.key].alertas.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </>
            )}
          </div>
        ) : null}
      </>
    );
  }
  return (
    <input
      id={id}
      type={c.type === 'cc' || c.type === 'nit' ? 'text' : c.type}
      inputMode={c.type === 'cc' || c.type === 'nit' || c.type === 'number' ? 'numeric' : undefined}
      value={datos[c.key] || ''}
      onChange={(e) => setDato(c.key, e.target.value)}
      required={c.required}
    />
  );
}
