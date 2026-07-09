import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { formatearMiles } from '../../utils/numeroALetras';

/* ─── Interfaces ─────────────────────────────────────────────── */
interface FlujoStep {
  rol: string;
  label: string;
  orden: number;
}

interface Topes {
  transporteTotal?: number;
  hotelNoche?: number;
  comidaDia?: number;
  desayuno?: number;
  almuerzo?: number;
  cena?: number;
  otrosGastos?: number;
  totalSolicitud?: number;
  diasMaximos?: number;
}

interface ConfiguracionTipo {
  topes?: Topes;
  areasVisibles?: 'todas' | number[];
}

interface TipoSolicitud {
  id: number;
  areaId: number;
  areaNombre: string;
  nombre: string;
  descripcion: string | null;
  slug: string;
  activo: boolean;
  orden: number;
  flujoAprobacion: FlujoStep[];
  configuracionTipo: ConfiguracionTipo | null;
  creadoEn: string;
}

interface Area {
  id: number;
  nombre: string;
  slug: string;
}

/* ─── Constantes ─────────────────────────────────────────────── */
const ROLES_DISPONIBLES = [
  { value: 'analista',      label: 'Analista del área' },
  { value: 'coordinador',   label: 'Coordinador / Director' },
  { value: 'contabilidad',  label: 'Contabilidad' },
  { value: 'tesoreria',     label: 'Tesorería' },
  { value: 'gerencia',      label: 'Gerencia' },
  { value: 'juridico',      label: 'Jurídico' },
  { value: 'rrhh',          label: 'Recursos Humanos' },
];

const FLUJO_DEFAULT: FlujoStep[] = [
  { rol: 'analista',     label: 'Analista del área',     orden: 1 },
  { rol: 'coordinador',  label: 'Coordinador / Director', orden: 2 },
  { rol: 'contabilidad', label: 'Contabilidad',           orden: 3 },
];

const SLUGS_ESPECIALES: Record<string, string> = {
  'viaticos':         'Viáticos (flujo especializado)',
  'anticipo':         'Anticipo de viático',
  'legalizar':        'Legalización de viático',
  'cuenta-cobro-ops': 'Cuenta de cobro OPS',
  'legalizacion':     'Legalización de gastos',
};

/* ─── Panel principal ────────────────────────────────────────── */
export function TiposSolicitudPanel() {
  const [tipos, setTipos] = useState<TipoSolicitud[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Crear nuevo
  const [showCrear, setShowCrear] = useState(false);
  const [cNombre, setCNombre] = useState('');
  const [cAreaId, setCAreaId] = useState(0);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [rTipos, rAreas] = await Promise.all([
        api.get<TipoSolicitud[]>('/tipos'),
        api.get<Area[]>('/areas'),
      ]);
      setTipos(Array.isArray(rTipos.data) ? rTipos.data : []);
      setAreas(Array.isArray(rAreas.data) ? rAreas.data : []);
      if (rAreas.data.length > 0 && cAreaId === 0) setCAreaId(rAreas.data[0].id);
    } catch {
      setErr('Error al cargar los tipos de solicitud.');
    } finally {
      setCargando(false);
    }
  }, [cAreaId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardarTipo(id: number, data: object) {
    setGuardando(true);
    setErr('');
    try {
      await api.patch(`/tipos/${id}`, data);
      setMsg('Tipo actualizado correctamente.');
      setEditId(null);
      await cargar();
    } catch (ex: unknown) {
      const m = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(m ?? 'Error al guardar. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(t: TipoSolicitud) {
    try {
      await api.patch(`/tipos/${t.id}`, { activo: !t.activo });
      setMsg(`Tipo "${t.nombre}" ${!t.activo ? 'habilitado' : 'deshabilitado'}.`);
      await cargar();
    } catch {
      setErr('Error al cambiar el estado.');
    }
  }

  async function crearTipo() {
    if (!cNombre.trim()) { setErr('Ingresa el nombre del tipo.'); return; }
    if (!cAreaId) { setErr('Selecciona un área.'); return; }
    setCreando(true);
    setErr('');
    try {
      await api.post('/tipos', {
        nombre: cNombre.trim(),
        areaId: cAreaId,
        flujoAprobacion: FLUJO_DEFAULT,
      });
      setMsg(`Tipo "${cNombre.trim()}" creado exitosamente.`);
      setCNombre('');
      setShowCrear(false);
      await cargar();
    } catch (ex: unknown) {
      const m = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(m ?? 'Error al crear el tipo.');
    } finally {
      setCreando(false);
    }
  }

  const porArea = areas.map((a) => ({
    area: a,
    tipos: tipos.filter((t) => t.areaId === a.id),
  })).filter((g) => g.tipos.length > 0);

  const sinArea = tipos.filter((t) => !areas.find((a) => a.id === t.areaId));

  return (
    <div className="tipos-panel">
      <div className="tipos-panel-head">
        <div>
          <h4>Tipos de solicitud</h4>
          <p className="admin-help-text">Configura qué solicitudes están disponibles, su flujo de aprobación, límites de gasto y visibilidad por área.</p>
        </div>
        <button type="button" className="admin-primary-button tipos-crear-btn"
          onClick={() => { setShowCrear(!showCrear); setErr(''); }}>
          {showCrear ? '✕ Cancelar' : '+ Nuevo tipo'}
        </button>
      </div>

      {msg && <div className="admin-success">{msg}</div>}
      {err && <div className="admin-error">{err}</div>}

      {showCrear && (
        <div className="tipos-crear-form card-surface">
          <h5>Nuevo tipo de solicitud</h5>
          <div className="tipos-crear-fields">
            <div className="leg-field">
              <label>Nombre *</label>
              <input type="text" value={cNombre} onChange={(e) => setCNombre(e.target.value)}
                placeholder="Ej: Viáticos, Anticipo de gastos…" autoFocus />
            </div>
            <div className="leg-field">
              <label>Área propietaria *</label>
              <select value={cAreaId} onChange={(e) => setCAreaId(Number(e.target.value))}>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          </div>
          <p className="admin-help-text">El identificador (slug) se genera automáticamente. Podrás editarlo después.</p>
          <div className="tipos-crear-acciones">
            <button type="button" className="admin-primary-button" onClick={crearTipo} disabled={creando}>
              {creando ? 'Creando…' : 'Crear tipo'}
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="admin-help-text" style={{ padding: 16 }}>Cargando tipos de solicitud…</p>
      ) : tipos.length === 0 ? (
        <div className="tipos-vacio">
          <p>No hay tipos de solicitud registrados.</p>
          <p className="admin-help-text">Crea el primero con el botón "+ Nuevo tipo".</p>
        </div>
      ) : (
        <div className="tipos-lista">
          {porArea.map(({ area, tipos: tiposArea }) => (
            <div key={area.id} className="tipos-grupo">
              <div className="tipos-grupo-header">
                <span className="tipos-grupo-area">{area.nombre}</span>
                <span className="tipos-grupo-count">{tiposArea.length} tipo{tiposArea.length !== 1 ? 's' : ''}</span>
              </div>
              {tiposArea.map((t) => (
                <TipoRow
                  key={t.id}
                  tipo={t}
                  areas={areas}
                  editando={editId === t.id}
                  onAbrir={() => { setEditId(t.id); setMsg(''); setErr(''); }}
                  onCancelar={() => setEditId(null)}
                  onGuardar={guardarTipo}
                  onToggle={() => toggleActivo(t)}
                  guardando={guardando}
                />
              ))}
            </div>
          ))}
          {sinArea.length > 0 && (
            <div className="tipos-grupo">
              <div className="tipos-grupo-header">
                <span className="tipos-grupo-area">Sin área asignada</span>
              </div>
              {sinArea.map((t) => (
                <TipoRow
                  key={t.id}
                  tipo={t}
                  areas={areas}
                  editando={editId === t.id}
                  onAbrir={() => { setEditId(t.id); setMsg(''); setErr(''); }}
                  onCancelar={() => setEditId(null)}
                  onGuardar={guardarTipo}
                  onToggle={() => toggleActivo(t)}
                  guardando={guardando}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Fila de tipo con editor completo ───────────────────────── */
interface TipoRowProps {
  tipo: TipoSolicitud;
  areas: Area[];
  editando: boolean;
  onAbrir: () => void;
  onCancelar: () => void;
  onGuardar: (id: number, data: object) => Promise<void>;
  onToggle: () => void;
  guardando: boolean;
}

function TipoRow({ tipo, areas, editando, onAbrir, onCancelar, onGuardar, onToggle, guardando }: TipoRowProps) {
  const hint = SLUGS_ESPECIALES[tipo.slug] ?? null;

  /* ── Estado del editor (inicializado al abrir) ── */
  const [eNombre, setENombre] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eSlug, setESlug] = useState('');
  const [eActivo, setEActivo] = useState(true);
  const [eOrden, setEOrden] = useState(0);
  const [eFlujo, setEFlujo] = useState<FlujoStep[]>([]);
  const [eTopes, setETopes] = useState<Record<string, string>>({});
  const [eAreasVisibles, setEAreasVisibles] = useState<'todas' | number[]>('todas');
  const [eErr, setEErr] = useState('');

  useEffect(() => {
    if (!editando) return;
    setENombre(tipo.nombre);
    setEDesc(tipo.descripcion ?? '');
    setESlug(tipo.slug);
    setEActivo(tipo.activo);
    setEOrden(tipo.orden);
    const flujo = Array.isArray(tipo.flujoAprobacion) ? tipo.flujoAprobacion : [];
    setEFlujo(flujo.length ? [...flujo] : [...FLUJO_DEFAULT]);
    const cfg: ConfiguracionTipo = tipo.configuracionTipo ?? {};
    const t: Topes = cfg.topes ?? {};
    setETopes({
      transporteTotal: t.transporteTotal ? String(t.transporteTotal) : '',
      hotelNoche:      t.hotelNoche      ? String(t.hotelNoche)      : '',
      comidaDia:       t.comidaDia       ? String(t.comidaDia)       : '',
      desayuno:        t.desayuno        ? String(t.desayuno)        : '',
      almuerzo:        t.almuerzo        ? String(t.almuerzo)        : '',
      cena:            t.cena            ? String(t.cena)            : '',
      otrosGastos:     t.otrosGastos     ? String(t.otrosGastos)     : '',
      totalSolicitud:  t.totalSolicitud  ? String(t.totalSolicitud)  : '',
      diasMaximos:     t.diasMaximos     ? String(t.diasMaximos)     : '',
    });
    const av = cfg.areasVisibles;
    setEAreasVisibles(Array.isArray(av) ? av : 'todas');
    setEErr('');
  }, [editando, tipo]);

  /* ── Helpers de topes ── */
  function fmtTope(key: string): string {
    const raw = eTopes[key] ?? '';
    const n = parseInt(raw.replace(/\D/g, '')) || 0;
    return n > 0 ? formatearMiles(n) : '';
  }
  function setTope(key: string, raw: string) {
    setETopes((prev) => ({ ...prev, [key]: raw.replace(/\D/g, '') }));
  }
  function topeNum(key: string): number | undefined {
    const n = parseInt((eTopes[key] ?? '').replace(/\D/g, '')) || 0;
    return n > 0 ? n : undefined;
  }

  /* ── Flujo helpers ── */
  function agregarPaso() {
    setEFlujo((f) => [...f, { rol: 'analista', label: 'Analista del área', orden: f.length + 1 }]);
  }
  function quitarPaso(i: number) {
    setEFlujo((f) => f.filter((_, idx) => idx !== i));
  }
  function cambiarPaso(i: number, rol: string) {
    const info = ROLES_DISPONIBLES.find((r) => r.value === rol);
    setEFlujo((f) => f.map((s, idx) => idx === i ? { ...s, rol, label: info?.label ?? rol } : s));
  }

  /* ── Visibilidad de áreas ── */
  function toggleArea(areaId: number, checked: boolean) {
    if (!Array.isArray(eAreasVisibles)) return;
    setEAreasVisibles(checked
      ? [...eAreasVisibles, areaId]
      : eAreasVisibles.filter((id) => id !== areaId),
    );
  }

  /* ── Guardar ── */
  async function handleGuardar() {
    if (!eNombre.trim()) { setEErr('El nombre es obligatorio.'); return; }
    if (!eSlug.trim()) { setEErr('El identificador (slug) es obligatorio.'); return; }

    const topesObj: Topes = {};
    if (topeNum('transporteTotal')) topesObj.transporteTotal = topeNum('transporteTotal');
    if (topeNum('hotelNoche'))      topesObj.hotelNoche      = topeNum('hotelNoche');
    if (topeNum('comidaDia'))       topesObj.comidaDia       = topeNum('comidaDia');
    if (topeNum('desayuno'))        topesObj.desayuno        = topeNum('desayuno');
    if (topeNum('almuerzo'))        topesObj.almuerzo        = topeNum('almuerzo');
    if (topeNum('cena'))            topesObj.cena            = topeNum('cena');
    if (topeNum('otrosGastos'))     topesObj.otrosGastos     = topeNum('otrosGastos');
    if (topeNum('totalSolicitud'))  topesObj.totalSolicitud  = topeNum('totalSolicitud');
    const dias = parseInt((eTopes.diasMaximos ?? '').replace(/\D/g, '')) || 0;
    if (dias > 0) topesObj.diasMaximos = dias;

    const configuracionTipo: ConfiguracionTipo = { areasVisibles: eAreasVisibles };
    if (Object.keys(topesObj).length) configuracionTipo.topes = topesObj;

    await onGuardar(tipo.id, {
      nombre: eNombre.trim(),
      descripcion: eDesc.trim() || null,
      slug: eSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      activo: eActivo,
      orden: eOrden,
      flujoAprobacion: eFlujo.map((s, i) => ({ ...s, orden: i + 1 })),
      configuracionTipo,
    });
  }

  /* ── Resumen de topes (cuando no editando) ── */
  function resumenTopes(): string | null {
    const t = tipo.configuracionTipo?.topes;
    if (!t || !Object.keys(t).length) return null;
    const partes: string[] = [];
    if (t.totalSolicitud) partes.push(`Total máx. $${formatearMiles(t.totalSolicitud)}`);
    if (t.diasMaximos) partes.push(`${t.diasMaximos} días máx.`);
    if (t.hotelNoche) partes.push(`Hotel $${formatearMiles(t.hotelNoche)}/noche`);
    if (t.comidaDia) partes.push(`Comida $${formatearMiles(t.comidaDia)}/día`);
    return partes.length ? partes.join(' · ') : null;
  }

  /* ── Resumen de visibilidad (cuando no editando) ── */
  function resumenVisibilidad(): string {
    const av = tipo.configuracionTipo?.areasVisibles;
    if (!av || av === 'todas') return 'Todas las áreas';
    if (Array.isArray(av) && av.length === 0) return 'Sin áreas asignadas';
    if (Array.isArray(av)) {
      const nombres = av.map((id) => areas.find((a) => a.id === id)?.nombre ?? `Área ${id}`);
      return nombres.join(', ');
    }
    return 'Todas las áreas';
  }

  return (
    <div className={`tipos-row${editando ? ' tipos-row-edit' : ''}`}>
      {/* Cabecera */}
      <div className="tipos-row-head">
        <div className="tipos-row-info">
          <span className={`tipos-badge-activo${tipo.activo ? '' : ' inactivo'}`}>
            {tipo.activo ? 'Activo' : 'Inactivo'}
          </span>
          <strong className="tipos-nombre">{tipo.nombre}</strong>
          <code className="tipos-slug">{tipo.slug}</code>
          {hint && <span className="tipos-hint-especial">⚡ {hint}</span>}
        </div>
        <div className="tipos-row-acciones">
          <button type="button"
            className={`tipos-toggle-btn${tipo.activo ? '' : ' off'}`}
            title={tipo.activo ? 'Deshabilitar' : 'Habilitar'}
            onClick={onToggle}>
            {tipo.activo ? '⏸ Deshabilitar' : '▶ Habilitar'}
          </button>
          {!editando
            ? <button type="button" className="admin-ghost-button" onClick={onAbrir}>⚙ Configurar</button>
            : <button type="button" className="admin-ghost-button" onClick={onCancelar}>✕ Cancelar</button>
          }
        </div>
      </div>

      {/* Vista resumida */}
      {!editando && (
        <>
          {tipo.descripcion && <p className="tipos-desc">{tipo.descripcion}</p>}
          {tipo.flujoAprobacion.length > 0 && (
            <div className="tipos-flujo-resumen">
              {tipo.flujoAprobacion.map((s, i) => (
                <span key={i} className="tipos-flujo-step">
                  <span className="tipos-flujo-num">{s.orden}</span>
                  {s.label}
                  {i < tipo.flujoAprobacion.length - 1 && <span className="tipos-flujo-arrow">→</span>}
                </span>
              ))}
            </div>
          )}
          <div className="tipos-meta-resumen">
            <span className="tipos-meta-visib">👁 {resumenVisibilidad()}</span>
            {resumenTopes() && <span className="tipos-meta-topes">💰 {resumenTopes()}</span>}
          </div>
        </>
      )}

      {/* Editor expandible */}
      {editando && (
        <div className="tipos-editor">

          {eErr && <div className="admin-error" style={{ marginBottom: 12 }}>{eErr}</div>}

          {/* ── Sección 1: Información básica ── */}
          <div className="tipos-editor-section">
            <h4>Información básica</h4>
            <div className="tipos-editor-fields">
              <div className="leg-field">
                <label>Nombre del tipo *</label>
                <input type="text" value={eNombre} onChange={(e) => setENombre(e.target.value)}
                  placeholder="Ej: Viáticos, Solicitud de permiso…" />
              </div>
              <div className="leg-field">
                <label>Descripción (visible al usuario)</label>
                <textarea value={eDesc} onChange={(e) => setEDesc(e.target.value)} rows={2}
                  placeholder="Explica brevemente para qué se usa este tipo de solicitud…" />
              </div>
              <div className="leg-field">
                <label>Identificador (slug) *</label>
                <input type="text" value={eSlug}
                  onChange={(e) => setESlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="ej: viaticos, cuenta-cobro-ops" />
                <p className="admin-help-text" style={{ marginTop: 4 }}>
                  Usado internamente. Slugs especiales: <code>viaticos</code>, <code>anticipo</code>, <code>legalizar</code>, <code>cuenta-cobro-ops</code>, <code>legalizacion</code>.
                </p>
              </div>
              <div className="tipos-editor-fila-doble">
                <div className="leg-field">
                  <label>Orden de aparición</label>
                  <input type="number" value={eOrden} min={0} max={999}
                    onChange={(e) => setEOrden(Number(e.target.value))} style={{ width: 80 }} />
                  <p className="admin-help-text" style={{ marginTop: 4 }}>Menor número = aparece primero.</p>
                </div>
                <div className="leg-field">
                  <label>Estado</label>
                  <label className="tipos-check-label">
                    <input type="checkbox" checked={eActivo} onChange={(e) => setEActivo(e.target.checked)} />
                    <span>{eActivo ? 'Habilitado — visible para usuarios' : 'Deshabilitado — oculto'}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Sección 2: Flujo de aprobación ── */}
          <div className="tipos-editor-section">
            <h4>Flujo de aprobación</h4>
            <p className="admin-help-text">Define quién debe aprobar este tipo de solicitud, en orden.</p>
            <div className="tipos-flujo-editor">
              {eFlujo.map((paso, i) => (
                <div key={i} className="tipos-flujo-editor-paso">
                  <span className="tipos-flujo-num">{i + 1}</span>
                  <select value={paso.rol} onChange={(e) => cambiarPaso(i, e.target.value)}>
                    {ROLES_DISPONIBLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  {i < eFlujo.length - 1 && <span className="tipos-flujo-arrow-edit">↓</span>}
                  <button type="button" className="tipos-flujo-quitar" title="Quitar paso"
                    onClick={() => quitarPaso(i)} disabled={eFlujo.length <= 1}>✕</button>
                </div>
              ))}
              {eFlujo.length < 6 && (
                <button type="button" className="tipos-flujo-agregar admin-ghost-button" onClick={agregarPaso}>
                  + Agregar paso
                </button>
              )}
            </div>
            <p className="admin-help-text" style={{ marginTop: 8 }}>
              El solicitante crea la solicitud → pasa por cada paso en orden → queda aprobada al final.
            </p>
          </div>

          {/* ── Sección 3: Topes y límites de gasto ── */}
          <div className="tipos-editor-section">
            <h4>Topes y límites de gasto</h4>
            <p className="admin-help-text">Define los montos máximos permitidos en cada categoría. Deja en blanco para sin límite.</p>
            <div className="tipos-topes-grid">
              <div className="leg-field">
                <label>🚌 Transporte total (COP)</label>
                <input type="text" inputMode="numeric" placeholder="Sin límite"
                  value={fmtTope('transporteTotal')}
                  onChange={(e) => setTope('transporteTotal', e.target.value)} />
              </div>
              <div className="leg-field">
                <label>🏨 Hotel por noche (COP)</label>
                <input type="text" inputMode="numeric" placeholder="Sin límite"
                  value={fmtTope('hotelNoche')}
                  onChange={(e) => setTope('hotelNoche', e.target.value)} />
              </div>
              <div className="leg-field">
                <label>🍽 Alimentación por día (COP)</label>
                <input type="text" inputMode="numeric" placeholder="Sin límite"
                  value={fmtTope('comidaDia')}
                  onChange={(e) => setTope('comidaDia', e.target.value)} />
              </div>
              <div className="leg-field">
                <label>☀️ Desayuno (COP)</label>
                <input type="text" inputMode="numeric" placeholder="Sin límite"
                  value={fmtTope('desayuno')}
                  onChange={(e) => setTope('desayuno', e.target.value)} />
              </div>
              <div className="leg-field">
                <label>🌤 Almuerzo (COP)</label>
                <input type="text" inputMode="numeric" placeholder="Sin límite"
                  value={fmtTope('almuerzo')}
                  onChange={(e) => setTope('almuerzo', e.target.value)} />
              </div>
              <div className="leg-field">
                <label>🌙 Cena (COP)</label>
                <input type="text" inputMode="numeric" placeholder="Sin límite"
                  value={fmtTope('cena')}
                  onChange={(e) => setTope('cena', e.target.value)} />
              </div>
              <div className="leg-field">
                <label>📦 Otros gastos (COP)</label>
                <input type="text" inputMode="numeric" placeholder="Sin límite"
                  value={fmtTope('otrosGastos')}
                  onChange={(e) => setTope('otrosGastos', e.target.value)} />
              </div>
              <div className="leg-field">
                <label>💼 Total máximo por solicitud (COP)</label>
                <input type="text" inputMode="numeric" placeholder="Sin límite"
                  value={fmtTope('totalSolicitud')}
                  onChange={(e) => setTope('totalSolicitud', e.target.value)} />
              </div>
              <div className="leg-field">
                <label>📅 Días máximos por viaje</label>
                <input type="number" min={1} max={365} placeholder="Sin límite"
                  value={eTopes.diasMaximos ?? ''}
                  onChange={(e) => setTope('diasMaximos', e.target.value)} style={{ width: 100 }} />
              </div>
            </div>
          </div>

          {/* ── Sección 4: Visibilidad por área ── */}
          <div className="tipos-editor-section">
            <h4>Visibilidad por área</h4>
            <p className="admin-help-text">Controla qué áreas pueden ver y usar este tipo de solicitud.</p>
            <div className="tipos-visib-opts">
              <label className="tipos-check-label tipos-visib-radio">
                <input type="radio" name={`visib-${tipo.id}`}
                  checked={eAreasVisibles === 'todas'}
                  onChange={() => setEAreasVisibles('todas')} />
                <span><strong>Todas las áreas</strong> — cualquier área puede verlo y usarlo</span>
              </label>
              <label className="tipos-check-label tipos-visib-radio">
                <input type="radio" name={`visib-${tipo.id}`}
                  checked={Array.isArray(eAreasVisibles)}
                  onChange={() => setEAreasVisibles([])} />
                <span><strong>Áreas específicas</strong> — solo las áreas seleccionadas</span>
              </label>
            </div>
            {Array.isArray(eAreasVisibles) && (
              <div className="tipos-areas-checkboxes">
                {areas.length === 0 && <p className="admin-help-text">No hay áreas disponibles.</p>}
                {areas.map((a) => (
                  <label key={a.id} className="tipos-check-label tipos-area-cb">
                    <input type="checkbox"
                      checked={eAreasVisibles.includes(a.id)}
                      onChange={(e) => toggleArea(a.id, e.target.checked)} />
                    <span>{a.nombre}</span>
                  </label>
                ))}
                {Array.isArray(eAreasVisibles) && eAreasVisibles.length === 0 && (
                  <p className="tipos-visib-warn">⚠ Sin áreas seleccionadas — este tipo no será visible para nadie.</p>
                )}
              </div>
            )}
          </div>

          {/* ── Acciones ── */}
          <div className="tipos-editor-acciones">
            <button type="button" className="admin-ghost-button" onClick={onCancelar}>Cancelar</button>
            <button type="button" className="admin-primary-button" onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
