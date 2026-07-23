import { useEffect, useState } from 'react';
import { api } from '../../services/http/api';

interface FlujoStep { rol: string; label: string; orden: number; }
interface ViajeEspecifico { origen: string; destino: string; tipo: 'aereo' | 'terrestre'; precio: number; }
interface Area { id: number; nombre: string; }

const ROLES = [
  { value: 'analista',     label: 'Analista del área' },
  { value: 'coordinador',  label: 'Coordinador / Director' },
  { value: 'contabilidad', label: 'Contabilidad' },
  { value: 'tesoreria',    label: 'Tesorería' },
  { value: 'gerencia',     label: 'Gerencia' },
  { value: 'juridico',     label: 'Jurídico' },
  { value: 'rrhh',         label: 'Recursos Humanos' },
];

function fmtNum(v: number) { return v > 0 ? String(v) : ''; }
function parseNum(s: string) { return parseFloat(s.replace(/\D/g, '')) || 0; }

export function ConfigViaticosPanel() {
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

  /* ── Flujo de aprobación ── */
  const [flujo, setFlujo] = useState<FlujoStep[]>([]);

  /* ── Tarifas fijas ── */
  const [precioAereo, setPrecioAereo] = useState('');
  const [precioTerrestre, setPrecioTerrestre] = useState('');
  const [precioDesayuno, setPrecioDesayuno] = useState('');
  const [precioAlmuerzo, setPrecioAlmuerzo] = useState('');
  const [precioCena, setPrecioCena] = useState('');
  const [precioHospedaje, setPrecioHospedaje] = useState('');

  /* ── Viajes específicos ── */
  const [viajes, setViajes] = useState<ViajeEspecifico[]>([]);
  const [nOrigen, setNOrigen] = useState('');
  const [nDestino, setNDestino] = useState('');
  const [nTipo, setNTipo] = useState<'aereo' | 'terrestre'>('aereo');
  const [nPrecio, setNPrecio] = useState('');

  /* ── Visibilidad ── */
  const [areasVisibles, setAreasVisibles] = useState<'todas' | number[]>('todas');

  useEffect(() => {
    setCargando(true);
    Promise.all([
      api.get<Array<{ id: number; slug: string; nombre: string; descripcion: string | null; activo: boolean; flujoAprobacion: FlujoStep[]; configuracionTipo: { areasVisibles?: 'todas' | number[] } | null }>>('/tipos'),
      api.get<Area[]>('/areas'),
      api.get<{ precioAereo: number; precioTerrestre: number; precioDesayuno: number; precioAlmuerzo: number; precioCena: number; precioHospedaje: number; viajesEspecificos?: ViajeEspecifico[] }>('/admin/tarifas-viaticos'),
    ]).then(([rTipos, rAreas, rTarifas]) => {
      const tipo = rTipos.data.find((t) => t.slug === 'viaticos');
      if (!tipo) { setErr('No se encontró el tipo "viaticos" en la base de datos.'); return; }
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
      const t = rTarifas.data;
      setPrecioAereo(fmtNum(t.precioAereo));
      setPrecioTerrestre(fmtNum(t.precioTerrestre));
      setPrecioDesayuno(fmtNum(t.precioDesayuno));
      setPrecioAlmuerzo(fmtNum(t.precioAlmuerzo));
      setPrecioCena(fmtNum(t.precioCena));
      setPrecioHospedaje(fmtNum(t.precioHospedaje));
      setViajes(t.viajesEspecificos ?? []);
    }).catch(() => setErr('Error al cargar la configuración.')).finally(() => setCargando(false));
  }, []);

  function agregarViaje() {
    const o = nOrigen.trim(); const d = nDestino.trim();
    if (!o || !d) { setErr('Ingresa origen y destino.'); return; }
    setViajes((p) => [...p, { origen: o, destino: d, tipo: nTipo, precio: parseNum(nPrecio) }]);
    setNOrigen(''); setNDestino(''); setNTipo('aereo'); setNPrecio(''); setErr('');
  }

  function cambiarPaso(i: number, rol: string) {
    const info = ROLES.find((r) => r.value === rol);
    setFlujo((f) => f.map((s, idx) => idx === i ? { ...s, rol, label: info?.label ?? rol } : s));
  }

  async function guardar() {
    if (!tipoId) return;
    if (!nombre.trim()) { setErr('El nombre es obligatorio.'); return; }
    if (flujo.length === 0) { setErr('Agrega al menos un paso de aprobación.'); return; }
    setErr(''); setOk(''); setGuardando(true);
    try {
      await api.post('/admin/tarifas-viaticos', {
        precioAereo: parseNum(precioAereo), precioTerrestre: parseNum(precioTerrestre),
        precioDesayuno: parseNum(precioDesayuno), precioAlmuerzo: parseNum(precioAlmuerzo),
        precioCena: parseNum(precioCena), precioHospedaje: parseNum(precioHospedaje),
        viajesEspecificos: viajes,
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
      <h2>Configuración — Solicitud de Viático</h2>
      <p className="leg-config-desc">Ajusta el flujo de aprobación, las tarifas y la visibilidad de este tipo de solicitud.</p>

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
              placeholder="Ej: Solicita los viáticos para un viaje autorizado por tu director." />
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

      {/* Tarifas fijas */}
      <section className="leg-config-section">
        <h3>Tarifas de transporte</h3>
        <p className="leg-config-hint">Valores fijos por trayecto. Se aplican cuando no hay precio específico de ruta.</p>
        <div className="tarifa-grid">
          {([
            ['Viaje aéreo', precioAereo, setPrecioAereo],
            ['Viaje terrestre', precioTerrestre, setPrecioTerrestre],
          ] as [string, string, (v: string) => void][]).map(([label, val, set]) => (
            <div key={label} className="tarifa-campo">
              <label className="tarifa-label">{label}</label>
              <div className="leg-monto-row">
                <span className="leg-monto-prefix">$</span>
                <input type="text" inputMode="numeric" value={val} placeholder="0"
                  onChange={(e) => set(e.target.value.replace(/[^0-9.,]/g, ''))} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rutas específicas */}
      <section className="leg-config-section">
        <h3>Precios por ruta específica</h3>
        <p className="leg-config-hint">Si una ruta tiene un precio fijo diferente al general, agrégala aquí. El sistema la detecta automáticamente al seleccionar las ciudades.</p>
        {viajes.length > 0 && (
          <table className="tarifa-rutas-tabla">
            <thead><tr><th>Origen</th><th>Destino</th><th>Tipo</th><th>Precio</th><th></th></tr></thead>
            <tbody>
              {viajes.map((v, i) => (
                <tr key={i}>
                  <td>{v.origen}</td><td>{v.destino}</td>
                  <td>{v.tipo === 'aereo' ? '✈ Aéreo' : '🚌 Terrestre'}</td>
                  <td>${v.precio.toLocaleString('es-CO')}</td>
                  <td><button type="button" className="tipos-eliminar-btn" onClick={() => setViajes((p) => p.filter((_, j) => j !== i))}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="tarifa-ruta-form">
          <input type="text" placeholder="Ciudad origen" value={nOrigen} onChange={(e) => setNOrigen(e.target.value)} />
          <input type="text" placeholder="Ciudad destino" value={nDestino} onChange={(e) => setNDestino(e.target.value)} />
          <select value={nTipo} onChange={(e) => setNTipo(e.target.value as 'aereo' | 'terrestre')}>
            <option value="aereo">✈ Aéreo</option>
            <option value="terrestre">🚌 Terrestre</option>
          </select>
          <div className="leg-monto-row">
            <span className="leg-monto-prefix">$</span>
            <input type="text" inputMode="numeric" placeholder="Precio" value={nPrecio}
              onChange={(e) => setNPrecio(e.target.value.replace(/[^0-9.,]/g, ''))} />
          </div>
          <button type="button" className="admin-ghost-button" onClick={agregarViaje}>+ Agregar ruta</button>
        </div>
      </section>

      {/* Tarifas alimentación y hospedaje */}
      <section className="leg-config-section">
        <h3>Alimentación y hospedaje</h3>
        <div className="tarifa-grid">
          {([
            ['☀️ Desayuno (por día)', precioDesayuno, setPrecioDesayuno],
            ['🌤 Almuerzo (por día)', precioAlmuerzo, setPrecioAlmuerzo],
            ['🌙 Cena (por día)', precioCena, setPrecioCena],
            ['🏨 Hospedaje (por noche)', precioHospedaje, setPrecioHospedaje],
          ] as [string, string, (v: string) => void][]).map(([label, val, set]) => (
            <div key={label} className="tarifa-campo">
              <label className="tarifa-label">{label}</label>
              <div className="leg-monto-row">
                <span className="leg-monto-prefix">$</span>
                <input type="text" inputMode="numeric" value={val} placeholder="0"
                  onChange={(e) => set(e.target.value.replace(/[^0-9.,]/g, ''))} />
              </div>
            </div>
          ))}
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

      <div className="leg-config-footer">
        <button type="button" className="admin-primary-button" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
