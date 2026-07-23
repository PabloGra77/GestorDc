import { useEffect, useState } from 'react';
import { api } from '../../services/http/api';

interface FlujoStep { rol: string; label: string; orden: number; }
interface Area { id: number; nombre: string; }
interface LegalizacionConfig { categorias: string[]; montoMaximo: number; mensajePago: string; }

const ROLES = [
  { value: 'analista',     label: 'Analista del área' },
  { value: 'coordinador',  label: 'Coordinador / Director' },
  { value: 'contabilidad', label: 'Contabilidad' },
  { value: 'tesoreria',    label: 'Tesorería' },
  { value: 'gerencia',     label: 'Gerencia' },
  { value: 'juridico',     label: 'Jurídico' },
  { value: 'rrhh',         label: 'Recursos Humanos' },
];

const CATS_DEFECTO = ['Alimentación', 'Viajes', 'Transporte', 'Papelería / Útiles', 'Representación', 'Otros'];
const MSG_DEFECTO = 'Tu solicitud de legalización con número de radicado {radicado} fue aprobada. El pago será realizado en el transcurso de los días hábiles.';

export function ConfigLegalizacionPanel() {
  const [tipoId, setTipoId] = useState<number | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  /* ── Información básica ── */
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [activo, setActivo] = useState(true);

  /* ── Flujo ── */
  const [flujo, setFlujo] = useState<FlujoStep[]>([]);

  /* ── Config legalización ── */
  const [categorias, setCategorias] = useState<string[]>(CATS_DEFECTO);
  const [nuevaCat, setNuevaCat] = useState('');
  const [montoMaximo, setMontoMaximo] = useState('0');
  const [mensajePago, setMensajePago] = useState(MSG_DEFECTO);

  /* ── Visibilidad ── */
  const [areasVisibles, setAreasVisibles] = useState<'todas' | number[]>('todas');

  useEffect(() => {
    setCargando(true);
    Promise.all([
      api.get<Array<{ id: number; slug: string; nombre: string; descripcion: string | null; activo: boolean; flujoAprobacion: FlujoStep[]; configuracionTipo: { areasVisibles?: 'todas' | number[] } | null }>>('/tipos'),
      api.get<Area[]>('/areas'),
      api.get<LegalizacionConfig>('/config/legalizacion'),
    ]).then(([rTipos, rAreas, rConfig]) => {
      const tipo = rTipos.data.find((t) => t.slug === 'legalizacion');
      if (!tipo) { setErr('No se encontró el tipo "legalizacion" en la base de datos.'); return; }
      setTipoId(tipo.id);
      setNombre(tipo.nombre);
      setDescripcion(tipo.descripcion ?? '');
      setActivo(tipo.activo);
      const fl = Array.isArray(tipo.flujoAprobacion) && tipo.flujoAprobacion.length
        ? tipo.flujoAprobacion
        : [{ rol: 'analista', label: 'Analista del área', orden: 1 }, { rol: 'coordinador', label: 'Coordinador / Director', orden: 2 }, { rol: 'contabilidad', label: 'Contabilidad', orden: 3 }];
      setFlujo(fl);
      const av = tipo.configuracionTipo?.areasVisibles;
      setAreasVisibles(Array.isArray(av) ? av : 'todas');
      setAreas(rAreas.data);
      setCategorias(rConfig.data.categorias ?? CATS_DEFECTO);
      setMontoMaximo(String(rConfig.data.montoMaximo ?? 0));
      setMensajePago(rConfig.data.mensajePago ?? MSG_DEFECTO);
    }).catch(() => setErr('Error al cargar la configuración.')).finally(() => setCargando(false));
  }, []);

  function cambiarPaso(i: number, rol: string) {
    const info = ROLES.find((r) => r.value === rol);
    setFlujo((f) => f.map((s, idx) => idx === i ? { ...s, rol, label: info?.label ?? rol } : s));
  }

  function agregarCategoria() {
    const c = nuevaCat.trim();
    if (!c) return;
    if (categorias.some((x) => x.toLowerCase() === c.toLowerCase())) { setErr(`La categoría "${c}" ya existe.`); return; }
    setCategorias((p) => [...p, c]);
    setNuevaCat(''); setErr('');
  }

  function moverCategoria(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= categorias.length) return;
    setCategorias((p) => { const a = [...p]; [a[i], a[j]] = [a[j], a[i]]; return a; });
  }

  async function guardar() {
    if (!tipoId) return;
    if (!nombre.trim()) { setErr('El nombre es obligatorio.'); return; }
    if (flujo.length === 0) { setErr('Agrega al menos un paso de aprobación.'); return; }
    if (!mensajePago.trim()) { setErr('El mensaje de pago no puede estar vacío.'); return; }
    const monto = parseFloat(montoMaximo.replace(',', '.')) || 0;
    if (monto < 0) { setErr('El monto máximo no puede ser negativo.'); return; }
    setErr(''); setOk(''); setGuardando(true);
    try {
      await api.put('/config/legalizacion', {
        categorias,
        montoMaximo: monto,
        mensajePago: mensajePago.trim(),
      });
      await api.patch(`/tipos/${tipoId}`, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        activo,
        flujoAprobacion: flujo.map((s, i) => ({ ...s, orden: i + 1 })),
        configuracionTipo: { areasVisibles },
      });
      setOk('Configuración guardada correctamente.');
    } catch (ex: unknown) {
      const m = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(m || 'Error al guardar. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <div className="admin-loading">Cargando configuración…</div>;

  return (
    <div className="admin-module-content leg-config">
      <h2>Configuración — Legalización de Gastos</h2>
      <p className="leg-config-desc">Ajusta el flujo de aprobación, las categorías de gasto, el límite de monto y la visibilidad de este tipo de solicitud.</p>

      {err && <div className="admin-error">{err}</div>}
      {ok && <div className="admin-success">{ok}</div>}

      {/* Información básica */}
      <section className="leg-config-section">
        <h3>Información básica</h3>
        <div className="tipos-editor-fields">
          <div className="leg-field">
            <label>Nombre del tipo *</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="leg-field">
            <label>Descripción (visible al solicitante)</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2}
              placeholder="Ej: Presenta los gastos realizados en comisión para su reembolso." />
          </div>
          <label className="tipos-check-label">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <span>{activo ? 'Habilitado — visible para los usuarios' : 'Deshabilitado — oculto para los usuarios'}</span>
          </label>
        </div>
      </section>

      {/* Flujo de aprobación */}
      <section className="leg-config-section">
        <h3>Flujo de aprobación</h3>
        <p className="leg-config-hint">Define quién aprueba este tipo de solicitud, en orden. Mínimo 1 paso.</p>
        <div className="tipos-flujo-editor">
          {flujo.map((paso, i) => (
            <div key={i} className="tipos-flujo-editor-paso">
              <span className="tipos-flujo-num">{i + 1}</span>
              <select value={paso.rol} onChange={(e) => cambiarPaso(i, e.target.value)}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {i < flujo.length - 1 && <span className="tipos-flujo-arrow-edit">↓</span>}
              <button type="button" className="tipos-flujo-quitar" onClick={() => setFlujo((f) => f.filter((_, j) => j !== i))}
                disabled={flujo.length <= 1} title="Quitar paso">✕</button>
            </div>
          ))}
          {flujo.length < 6 && (
            <button type="button" className="tipos-flujo-agregar admin-ghost-button"
              onClick={() => setFlujo((f) => [...f, { rol: 'analista', label: 'Analista del área', orden: f.length + 1 }])}>
              + Agregar paso
            </button>
          )}
        </div>
      </section>

      {/* Categorías de gasto */}
      <section className="leg-config-section">
        <h3>Categorías de gasto</h3>
        <p className="leg-config-hint">Las categorías aparecen en el formulario de legalización. Ordénalas según preferencia.</p>
        <ul className="leg-cat-list">
          {categorias.map((c, i) => (
            <li key={i} className="leg-cat-item">
              <span className="leg-cat-name">{c}</span>
              <div className="leg-cat-actions">
                <button type="button" className="leg-cat-btn" onClick={() => moverCategoria(i, -1)} disabled={i === 0} title="Subir">↑</button>
                <button type="button" className="leg-cat-btn" onClick={() => moverCategoria(i, 1)} disabled={i === categorias.length - 1} title="Bajar">↓</button>
                <button type="button" className="leg-cat-btn leg-cat-del" onClick={() => {
                  if (categorias.length <= 1) { setErr('Debe haber al menos una categoría.'); return; }
                  setCategorias((p) => p.filter((_, j) => j !== i));
                }} title="Eliminar">✕</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="leg-cat-add">
          <input type="text" value={nuevaCat}
            onChange={(e) => setNuevaCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregarCategoria()}
            placeholder="Nueva categoría…" maxLength={80} />
          <button type="button" className="admin-ghost-button" onClick={agregarCategoria}>+ Agregar</button>
        </div>
      </section>

      {/* Monto máximo */}
      <section className="leg-config-section">
        <h3>Límite de monto por legalización</h3>
        <p className="leg-config-hint">Valor máximo permitido por solicitud. Escribe <strong>0</strong> para sin límite.</p>
        <div className="leg-monto-row">
          <span className="leg-monto-prefix">$</span>
          <input type="text" inputMode="decimal" value={montoMaximo}
            onChange={(e) => setMontoMaximo(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0" />
          {parseFloat(montoMaximo) === 0 && <span className="leg-sin-limite">Sin límite</span>}
        </div>
      </section>

      {/* Mensaje de pago */}
      <section className="leg-config-section">
        <h3>Mensaje de pago</h3>
        <p className="leg-config-hint">
          Este mensaje se mostrará al solicitante cuando contabilidad apruebe su legalización.
          Usa <code>{'{radicado}'}</code> para insertar el número de radicado automáticamente.
        </p>
        <textarea value={mensajePago} onChange={(e) => setMensajePago(e.target.value)}
          rows={4} maxLength={1000} className="leg-mensaje-textarea" />
        <p className="leg-char-count">{mensajePago.length} / 1000 caracteres</p>
        {mensajePago.includes('{radicado}') && (
          <div className="leg-preview-mensaje">
            <strong>Vista previa:</strong> {mensajePago.replace('{radicado}', 'LEG-2024-001')}
          </div>
        )}
      </section>

      {/* Visibilidad */}
      <section className="leg-config-section">
        <h3>Visibilidad por área</h3>
        <p className="leg-config-hint">Controla qué áreas pueden ver y usar esta solicitud.</p>
        <div className="tipos-visib-opts">
          <label className="tipos-check-label tipos-visib-radio">
            <input type="radio" checked={areasVisibles === 'todas'} onChange={() => setAreasVisibles('todas')} />
            <span><strong>Todas las áreas</strong></span>
          </label>
          <label className="tipos-check-label tipos-visib-radio">
            <input type="radio" checked={Array.isArray(areasVisibles)} onChange={() => setAreasVisibles([])} />
            <span><strong>Áreas específicas</strong></span>
          </label>
        </div>
        {Array.isArray(areasVisibles) && (
          <div className="tipos-areas-checkboxes">
            {areas.map((a) => (
              <label key={a.id} className="tipos-check-label tipos-area-cb">
                <input type="checkbox" checked={areasVisibles.includes(a.id)}
                  onChange={(e) => setAreasVisibles((prev) => {
                    if (!Array.isArray(prev)) return [a.id];
                    return e.target.checked ? [...prev, a.id] : prev.filter((id) => id !== a.id);
                  })} />
                <span>{a.nombre}</span>
              </label>
            ))}
            {Array.isArray(areasVisibles) && areasVisibles.length === 0 && (
              <p className="tipos-visib-warn">⚠ Sin áreas seleccionadas — no será visible para nadie.</p>
            )}
          </div>
        )}
      </section>

      <div className="leg-config-footer">
        <button type="button" className="admin-primary-button" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
