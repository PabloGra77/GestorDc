import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/http/api';

interface FlujoStep {
  rol: string;
  label: string;
  orden: number;
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
  creadoEn: string;
}

interface Area {
  id: number;
  nombre: string;
  slug: string;
}

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
  'viaticos':        'Viáticos (flujo especializado)',
  'anticipo':        'Anticipo de viático',
  'legalizar':       'Legalización de viático',
  'cuenta-cobro-ops': 'Cuenta de cobro OPS',
  'legalizacion':    'Legalización de gastos',
};

function slugHint(slug: string): string | null {
  return SLUGS_ESPECIALES[slug] ?? null;
}

export function TiposSolicitudPanel() {
  const [tipos, setTipos] = useState<TipoSolicitud[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Campos de edición
  const [eNombre, setENombre] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eSlug, setESlug] = useState('');
  const [eActivo, setEActivo] = useState(true);
  const [eOrden, setEOrden] = useState(0);
  const [eFlujo, setEFlujo] = useState<FlujoStep[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Crear nuevo tipo
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
      setTipos(rTipos.data);
      setAreas(rAreas.data);
      if (rAreas.data.length > 0 && cAreaId === 0) setCAreaId(rAreas.data[0].id);
    } catch {
      setErr('Error al cargar los tipos de solicitud.');
    } finally {
      setCargando(false);
    }
  }, [cAreaId]);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirEdicion(t: TipoSolicitud) {
    setEditId(t.id);
    setENombre(t.nombre);
    setEDesc(t.descripcion ?? '');
    setESlug(t.slug);
    setEActivo(t.activo);
    setEOrden(t.orden);
    setEFlujo(t.flujoAprobacion.length ? [...t.flujoAprobacion] : [...FLUJO_DEFAULT]);
    setMsg('');
    setErr('');
  }

  function cancelarEdicion() {
    setEditId(null);
    setMsg('');
    setErr('');
  }

  async function guardarTipo() {
    if (!eNombre.trim()) { setErr('El nombre es obligatorio.'); return; }
    if (!eSlug.trim()) { setErr('El identificador (slug) es obligatorio.'); return; }
    setGuardando(true);
    setErr('');
    try {
      await api.patch(`/tipos/${editId}`, {
        nombre: eNombre.trim(),
        descripcion: eDesc.trim() || null,
        slug: eSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        activo: eActivo,
        orden: eOrden,
        flujoAprobacion: eFlujo.map((s, i) => ({ ...s, orden: i + 1 })),
      });
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

  function agregarPasoFlujo() {
    setEFlujo((f) => [...f, { rol: 'analista', label: 'Analista del área', orden: f.length + 1 }]);
  }

  function quitarPasoFlujo(i: number) {
    setEFlujo((f) => f.filter((_, idx) => idx !== i));
  }

  function cambiarPasoFlujo(i: number, rol: string) {
    const rolInfo = ROLES_DISPONIBLES.find((r) => r.value === rol);
    setEFlujo((f) => f.map((s, idx) => idx === i ? { ...s, rol, label: rolInfo?.label ?? rol } : s));
  }

  // Agrupar por área
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
          <p className="admin-help-text">Configura qué solicitudes están disponibles, su flujo de aprobación y sus metadatos.</p>
        </div>
        <button type="button" className="admin-primary-button tipos-crear-btn"
          onClick={() => { setShowCrear(!showCrear); setErr(''); }}>
          {showCrear ? '✕ Cancelar' : '+ Nuevo tipo'}
        </button>
      </div>

      {msg && <div className="admin-success">{msg}</div>}
      {err && <div className="admin-error">{err}</div>}

      {/* Formulario creación */}
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
              <label>Área *</label>
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
                  editando={editId === t.id}
                  eNombre={eNombre} setENombre={setENombre}
                  eDesc={eDesc} setEDesc={setEDesc}
                  eSlug={eSlug} setESlug={setESlug}
                  eActivo={eActivo} setEActivo={setEActivo}
                  eOrden={eOrden} setEOrden={setEOrden}
                  eFlujo={eFlujo}
                  onAbrir={() => abrirEdicion(t)}
                  onCancelar={cancelarEdicion}
                  onGuardar={guardarTipo}
                  onToggle={() => toggleActivo(t)}
                  onAgregarPaso={agregarPasoFlujo}
                  onQuitarPaso={quitarPasoFlujo}
                  onCambiarPaso={cambiarPasoFlujo}
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
                <TipoRow key={t.id} tipo={t}
                  editando={editId === t.id}
                  eNombre={eNombre} setENombre={setENombre}
                  eDesc={eDesc} setEDesc={setEDesc}
                  eSlug={eSlug} setESlug={setESlug}
                  eActivo={eActivo} setEActivo={setEActivo}
                  eOrden={eOrden} setEOrden={setEOrden}
                  eFlujo={eFlujo}
                  onAbrir={() => abrirEdicion(t)}
                  onCancelar={cancelarEdicion}
                  onGuardar={guardarTipo}
                  onToggle={() => toggleActivo(t)}
                  onAgregarPaso={agregarPasoFlujo}
                  onQuitarPaso={quitarPasoFlujo}
                  onCambiarPaso={cambiarPasoFlujo}
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

/* ─── Fila de un tipo con editor inline ────────────────────────── */
interface TipoRowProps {
  tipo: TipoSolicitud;
  editando: boolean;
  eNombre: string; setENombre: (v: string) => void;
  eDesc: string; setEDesc: (v: string) => void;
  eSlug: string; setESlug: (v: string) => void;
  eActivo: boolean; setEActivo: (v: boolean) => void;
  eOrden: number; setEOrden: (v: number) => void;
  eFlujo: FlujoStep[];
  onAbrir: () => void;
  onCancelar: () => void;
  onGuardar: () => void;
  onToggle: () => void;
  onAgregarPaso: () => void;
  onQuitarPaso: (i: number) => void;
  onCambiarPaso: (i: number, rol: string) => void;
  guardando: boolean;
}

function TipoRow({
  tipo, editando,
  eNombre, setENombre, eDesc, setEDesc, eSlug, setESlug,
  eActivo, setEActivo, eOrden, setEOrden, eFlujo,
  onAbrir, onCancelar, onGuardar, onToggle,
  onAgregarPaso, onQuitarPaso, onCambiarPaso, guardando,
}: TipoRowProps) {
  const hint = slugHint(tipo.slug);

  return (
    <div className={`tipos-row${editando ? ' tipos-row-edit' : ''}`}>
      {/* Cabecera de la fila */}
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

      {/* Descripción corta */}
      {!editando && tipo.descripcion && (
        <p className="tipos-desc">{tipo.descripcion}</p>
      )}

      {/* Flujo resumido (cuando no editando) */}
      {!editando && tipo.flujoAprobacion.length > 0 && (
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

      {/* Editor expandible */}
      {editando && (
        <div className="tipos-editor">

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
                  Usado internamente. Slugs especiales reconocidos: <code>viaticos</code>, <code>anticipo</code>, <code>legalizar</code>, <code>cuenta-cobro-ops</code>, <code>legalizacion</code>.
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

          <div className="tipos-editor-section">
            <h4>Flujo de aprobación</h4>
            <p className="admin-help-text">Define quién debe aprobar este tipo de solicitud, en orden.</p>
            <div className="tipos-flujo-editor">
              {eFlujo.map((paso, i) => (
                <div key={i} className="tipos-flujo-editor-paso">
                  <span className="tipos-flujo-num">{i + 1}</span>
                  <select value={paso.rol} onChange={(e) => onCambiarPaso(i, e.target.value)}>
                    {ROLES_DISPONIBLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  {i < eFlujo.length - 1 && <span className="tipos-flujo-arrow-edit">↓</span>}
                  <button type="button" className="tipos-flujo-quitar" title="Quitar paso"
                    onClick={() => onQuitarPaso(i)} disabled={eFlujo.length <= 1}>
                    ✕
                  </button>
                </div>
              ))}
              {eFlujo.length < 6 && (
                <button type="button" className="tipos-flujo-agregar admin-ghost-button"
                  onClick={onAgregarPaso}>
                  + Agregar paso
                </button>
              )}
            </div>
            <p className="admin-help-text" style={{ marginTop: 8 }}>
              El solicitante crea la solicitud → pasa por cada paso en orden → queda aprobada al final.
            </p>
          </div>

          <div className="tipos-editor-acciones">
            <button type="button" className="admin-ghost-button" onClick={onCancelar}>Cancelar</button>
            <button type="button" className="admin-primary-button" onClick={onGuardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
