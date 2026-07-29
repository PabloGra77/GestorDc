import { useEffect, useState } from 'react';
import { api } from '../../services/http/api';

interface FlujoStep { rol: string; label: string; orden: number; }
interface Area { id: number; nombre: string; }
interface TarifaOps { id: number; servicio: string; tipoServicio: 'sm' | 'pad'; valorUnitario: number; activo: boolean; }

const ROLES = [
  { value: 'analista',     label: 'Analista del área' },
  { value: 'coordinador',  label: 'Coordinador / Director' },
  { value: 'contabilidad', label: 'Contabilidad' },
  { value: 'tesoreria',    label: 'Tesorería' },
  { value: 'gerencia',     label: 'Gerencia' },
  { value: 'juridico',     label: 'Jurídico' },
  { value: 'rrhh',         label: 'Recursos Humanos' },
];

export function ConfigCuentaCobroPanel() {
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

  /* ── Tarifas OPS ── */
  const [tarifas, setTarifas] = useState<TarifaOps[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [newSv, setNewSv]     = useState('');
  const [newTs, setNewTs]     = useState<'sm' | 'pad'>('sm');
  const [newVal, setNewVal]   = useState('');
  const [agregando, setAgregando] = useState(false);

  /* ── Visibilidad ── */
  const [areasVisibles, setAreasVisibles] = useState<'todas' | number[]>('todas');

  /* ── Informe ── */
  const [infDesde, setInfDesde] = useState('');
  const [infHasta, setInfHasta] = useState('');
  const [infSolicitante, setInfSolicitante] = useState('');
  const [infEstado, setInfEstado] = useState('');
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    setCargando(true);
    Promise.all([
      api.get<Array<{ id: number; slug: string; nombre: string; descripcion: string | null; activo: boolean; flujoAprobacion: FlujoStep[]; configuracionTipo: { areasVisibles?: 'todas' | number[] } | null }>>('/tipos'),
      api.get<Area[]>('/areas'),
      api.get<TarifaOps[]>('/admin/tarifas-ops'),
    ]).then(([rTipos, rAreas, rTarifas]) => {
      const tipo = rTipos.data.find((t) => t.slug === 'cuenta-cobro-ops');
      if (!tipo) { setErr('No se encontró el tipo "cuenta-cobro-ops" en la base de datos.'); return; }
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
      const ts = Array.isArray(rTarifas.data) ? rTarifas.data : [];
      setTarifas(ts);
      const vals: Record<string, string> = {};
      ts.forEach((t) => { vals[t.servicio] = t.valorUnitario > 0 ? String(t.valorUnitario) : ''; });
      setValores(vals);
    }).catch(() => setErr('Error al cargar la configuración.')).finally(() => setCargando(false));
  }, []);

  const fmtPesos = (raw: string) => {
    const n = parseInt(raw.replace(/\./g, ''), 10);
    return isNaN(n) || raw === '' ? '' : n.toLocaleString('es-CO');
  };

  async function recargarTarifas() {
    const r = await api.get<TarifaOps[]>('/admin/tarifas-ops');
    const ts = Array.isArray(r.data) ? r.data : [];
    setTarifas(ts);
    setValores((prev) => {
      const vals = { ...prev };
      ts.forEach((t) => { if (!(t.servicio in vals)) vals[t.servicio] = t.valorUnitario > 0 ? String(t.valorUnitario) : ''; });
      return vals;
    });
  }

  async function agregarServicio() {
    const sv = newSv.trim().toUpperCase();
    if (!sv) { setErr('Escribe el nombre del servicio.'); return; }
    setAgregando(true); setErr(''); setOk('');
    try {
      const vu = parseFloat(newVal.replace(/\./g, '').replace(/[^0-9]/g, '')) || 0;
      await api.post('/admin/tarifas-ops', {
        tarifas: [{ servicio: sv, tipoServicio: newTs, valorUnitario: vu, activo: true }],
      });
      setNewSv(''); setNewVal('');
      await recargarTarifas();
      setOk(`Servicio "${sv}" agregado correctamente.`);
    } catch { setErr('Error al agregar el servicio.'); }
    finally { setAgregando(false); }
  }

  function cambiarPaso(i: number, rol: string) {
    const info = ROLES.find((r) => r.value === rol);
    setFlujo((f) => f.map((s, idx) => idx === i ? { ...s, rol, label: info?.label ?? rol } : s));
  }

  async function descargarInforme() {
    if (!tipoId) return;
    setDescargando(true); setErr(''); setOk('');
    try {
      const cols = [
        'radicado','fecha','aprobado','solicitante','documento','correo','area','estado','paso',
        'ops_profesion','ops_banco','ops_cuenta','ops_tipo_cuenta',
        'ops_periodo',
        'ops_atenciones','ops_desglose','ops_total',
      ].join(',');
      const params = new URLSearchParams({ tipo: String(tipoId), columnas: cols });
      if (infDesde)              params.set('desde',       infDesde);
      if (infHasta)              params.set('hasta',        infHasta);
      if (infEstado)             params.set('estado',       infEstado);
      if (infSolicitante.trim()) params.set('solicitante', infSolicitante.trim());
      const r = await fetch(`/api/index.php/solicitudes/reporte?${params}`, { credentials: 'include' });
      if (!r.ok) { setErr('No se pudo generar el informe.'); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Informe_CuentaCobroOPS_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); URL.revokeObjectURL(url);
      setOk('Informe descargado correctamente.');
    } catch { setErr('No se pudo generar el informe.'); }
    finally { setDescargando(false); }
  }

  async function guardar() {
    if (!tipoId) return;
    if (!nombre.trim()) { setErr('El nombre es obligatorio.'); return; }
    if (flujo.length === 0) { setErr('Agrega al menos un paso de aprobación.'); return; }
    setErr(''); setOk(''); setGuardando(true);
    try {
      if (tarifas.length > 0) {
        const payload = tarifas.map((t) => ({
          servicio: t.servicio,
          tipoServicio: t.tipoServicio,
          valorUnitario: parseFloat((valores[t.servicio] ?? '0').replace(/[^0-9.]/g, '')) || 0,
          activo: t.activo,
        }));
        await api.post('/admin/tarifas-ops', { tarifas: payload });
      }
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
      <h2>Configuración — Cuenta de Cobro OPS</h2>
      <p className="leg-config-desc">Ajusta el flujo de aprobación, las tarifas por servicio y la visibilidad de este tipo de solicitud.</p>

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
              placeholder="Ej: Presenta tu cuenta de cobro para los servicios OPS prestados en el mes." />
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

      {/* Tarifas OPS */}
      <section className="leg-config-section">
        <h3>Tarifas por servicio OPS</h3>
        <p className="leg-config-hint">
          Los servicios <strong>SM</strong> cobran por atención (paciente); los demás por sesión.
          Solo los servicios configurados aquí serán aceptados al cargar un informe de atenciones.
        </p>

        {tarifas.length === 0 ? (
          <p className="leg-config-hint">No hay servicios configurados. Ejecuta la migración SQL 013 y 014.</p>
        ) : (
          <table className="tarifa-rutas-tabla">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Servicio</th>
                <th style={{ textAlign: 'left' }}>Tipo</th>
                <th style={{ width: 220 }}>Valor unitario (COP)</th>
              </tr>
            </thead>
            <tbody>
              {tarifas.map((t) => (
                <tr key={t.servicio}>
                  <td>{t.servicio}</td>
                  <td><span className="ops-tipo-badge">{t.tipoServicio === 'sm' ? 'SM — por paciente' : 'PAD — por sesión'}</span></td>
                  <td>
                    <div className="leg-monto-row" style={{ margin: 0 }}>
                      <span className="leg-monto-prefix">$</span>
                      <input type="text" inputMode="numeric"
                        value={fmtPesos(valores[t.servicio] ?? '')}
                        placeholder="0"
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                          setValores((v) => ({ ...v, [t.servicio]: raw }));
                        }}
                        style={{ margin: 0 }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Agregar nuevo servicio */}
        <div style={{ marginTop: 16, padding: '14px 16px', border: '1px dashed var(--gold-line, rgba(212,175,55,.4))', borderRadius: 8 }}>
          <strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>Agregar servicio</strong>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="admin-label" style={{ flex: '2 1 180px', margin: 0 }}>
              Nombre del servicio
              <input className="admin-input" type="text" value={newSv}
                onChange={(e) => setNewSv(e.target.value.toUpperCase())}
                placeholder="Ej: PSICOLOGÍA CONTROL SM" style={{ margin: '4px 0 0' }} />
            </label>
            <label className="admin-label" style={{ flex: '1 1 140px', margin: 0 }}>
              Tipo
              <select className="admin-input" value={newTs} onChange={(e) => setNewTs(e.target.value as 'sm' | 'pad')}
                style={{ margin: '4px 0 0' }}>
                <option value="sm">SM — por paciente</option>
                <option value="pad">PAD — por sesión</option>
              </select>
            </label>
            <label className="admin-label" style={{ flex: '1 1 140px', margin: 0 }}>
              Valor unitario (COP)
              <div className="leg-monto-row" style={{ margin: '4px 0 0' }}>
                <span className="leg-monto-prefix">$</span>
                <input type="text" inputMode="numeric" value={fmtPesos(newVal)} placeholder="0"
                  onChange={(e) => setNewVal(e.target.value.replace(/\./g, '').replace(/[^0-9]/g, ''))}
                  style={{ margin: 0 }} />
              </div>
            </label>
            <button type="button" className="admin-primary-button"
              onClick={agregarServicio} disabled={agregando || !newSv.trim()}
              style={{ alignSelf: 'flex-end', marginBottom: 0 }}>
              {agregando ? 'Agregando…' : '+ Agregar'}
            </button>
          </div>
        </div>
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

      {/* Informe Excel */}
      <section className="leg-config-section">
        <h3>Informe Excel de cuentas de cobro OPS</h3>
        <p className="leg-config-hint">
          Genera un archivo Excel con todas las cuentas de cobro OPS. Puedes filtrar por período, estado y profesional.
        </p>
        <div className="tipos-editor-fila-doble">
          <div className="leg-field">
            <label>Desde</label>
            <input type="date" value={infDesde} onChange={(e) => setInfDesde(e.target.value)} />
          </div>
          <div className="leg-field">
            <label>Hasta</label>
            <input type="date" value={infHasta} onChange={(e) => setInfHasta(e.target.value)} />
          </div>
        </div>
        <div className="leg-field">
          <label>Profesional (nombre, búsqueda parcial)</label>
          <input type="text" value={infSolicitante} onChange={(e) => setInfSolicitante(e.target.value)}
            placeholder="Ej: Juan Pérez — deja vacío para todos" />
        </div>
        <div className="leg-field">
          <label>Estado</label>
          <select value={infEstado} onChange={(e) => setInfEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="en_validacion">En validación</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="devuelto">Devuelto</option>
          </select>
        </div>
        <button type="button" className="admin-primary-button" onClick={descargarInforme}
          disabled={descargando || !tipoId}>
          {descargando ? 'Generando…' : '⬇ Descargar informe Excel'}
        </button>
      </section>

      <div className="leg-config-footer">
        <button type="button" className="admin-primary-button" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
