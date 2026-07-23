import { useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { DEPTOS } from '../solicitudes/colombiaData';

interface FlujoStep { rol: string; label: string; orden: number; }

interface ViajeEspecifico {
  origen: string;
  destino: string;
  tipo: 'aereo' | 'terrestre';
  precioTransporte: number;
  precioDesayuno: number;
  precioAlmuerzo: number;
  precioCena: number;
  precioHospedaje: number;
}

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
function parseNum(s: string) { return parseFloat(s.replace(/[^0-9.]/g, '')) || 0; }
function fmtCOP(v: number) { return v > 0 ? `$${v.toLocaleString('es-CO')}` : '$0'; }

/* cuando carga una ruta vieja que solo tiene "precio", la normaliza */
function normalizarViaje(v: Record<string, unknown>): ViajeEspecifico {
  return {
    origen:            String(v.origen ?? ''),
    destino:           String(v.destino ?? ''),
    tipo:              (v.tipo === 'terrestre' ? 'terrestre' : 'aereo') as 'aereo' | 'terrestre',
    precioTransporte:  Number(v.precioTransporte ?? v.precio ?? 0),
    precioDesayuno:    Number(v.precioDesayuno  ?? 0),
    precioAlmuerzo:    Number(v.precioAlmuerzo  ?? 0),
    precioCena:        Number(v.precioCena       ?? 0),
    precioHospedaje:   Number(v.precioHospedaje  ?? 0),
  };
}

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

  /* ── Flujo ── */
  const [flujo, setFlujo] = useState<FlujoStep[]>([]);

  /* ── Tarifas generales ── */
  const [precioAereo,      setPrecioAereo]      = useState('');
  const [precioTerrestre,  setPrecioTerrestre]  = useState('');
  const [precioDesayuno,   setPrecioDesayuno]   = useState('');
  const [precioAlmuerzo,   setPrecioAlmuerzo]   = useState('');
  const [precioCena,       setPrecioCena]       = useState('');
  const [precioHospedaje,  setPrecioHospedaje]  = useState('');

  /* ── Rutas específicas ── */
  const [viajes, setViajes] = useState<ViajeEspecifico[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editViaje, setEditViaje] = useState<ViajeEspecifico | null>(null);

  /* form nueva ruta */
  const [nDeptOrigen,   setNDeptOrigen]   = useState('');
  const [nCiudadOrigen, setNCiudadOrigen] = useState('');
  const [nDeptDestino,  setNDeptDestino]  = useState('');
  const [nCiudadDestino, setNCiudadDestino] = useState('');
  const [nTipo,         setNTipo]         = useState<'aereo' | 'terrestre'>('aereo');
  const [nTransporte,   setNTransporte]   = useState('');
  const [nDesayuno,     setNDesayuno]     = useState('');
  const [nAlmuerzo,     setNAlmuerzo]     = useState('');
  const [nCena,         setNCena]         = useState('');
  const [nHospedaje,    setNHospedaje]    = useState('');

  /* ── Visibilidad ── */
  const [areasVisibles, setAreasVisibles] = useState<'todas' | number[]>('todas');

  useEffect(() => {
    setCargando(true);
    Promise.all([
      api.get<Array<{ id: number; slug: string; nombre: string; descripcion: string | null; activo: boolean; flujoAprobacion: FlujoStep[]; configuracionTipo: { areasVisibles?: 'todas' | number[] } | null }>>('/tipos'),
      api.get<Area[]>('/areas'),
      api.get<Record<string, unknown>>('/admin/tarifas-viaticos'),
    ]).then(([rTipos, rAreas, rTar]) => {
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
      const t = rTar.data;
      setPrecioAereo(fmtNum(Number(t.precioAereo)));
      setPrecioTerrestre(fmtNum(Number(t.precioTerrestre)));
      setPrecioDesayuno(fmtNum(Number(t.precioDesayuno)));
      setPrecioAlmuerzo(fmtNum(Number(t.precioAlmuerzo)));
      setPrecioCena(fmtNum(Number(t.precioCena)));
      setPrecioHospedaje(fmtNum(Number(t.precioHospedaje)));
      const raw = Array.isArray(t.viajesEspecificos) ? (t.viajesEspecificos as Record<string, unknown>[]) : [];
      setViajes(raw.map(normalizarViaje));
      /* pre-fill form defaults con tarifa aéreo general */
      setNTransporte(fmtNum(Number(t.precioAereo)));
      setNDesayuno(fmtNum(Number(t.precioDesayuno)));
      setNAlmuerzo(fmtNum(Number(t.precioAlmuerzo)));
      setNCena(fmtNum(Number(t.precioCena)));
      setNHospedaje(fmtNum(Number(t.precioHospedaje)));
    }).catch(() => setErr('Error al cargar la configuración.')).finally(() => setCargando(false));
  }, []);

  /* al cambiar tipo de transporte en el form, actualizar precio de transporte por defecto */
  useEffect(() => {
    setNTransporte(nTipo === 'aereo' ? precioAereo : precioTerrestre);
  }, [nTipo, precioAereo, precioTerrestre]);

  function cambiarPaso(i: number, rol: string) {
    const info = ROLES.find((r) => r.value === rol);
    setFlujo((f) => f.map((s, idx) => idx === i ? { ...s, rol, label: info?.label ?? rol } : s));
  }

  function resetFormRuta() {
    setNDeptOrigen(''); setNCiudadOrigen('');
    setNDeptDestino(''); setNCiudadDestino('');
    setNTipo('aereo');
    setNTransporte(precioAereo);
    setNDesayuno(precioDesayuno);
    setNAlmuerzo(precioAlmuerzo);
    setNCena(precioCena);
    setNHospedaje(precioHospedaje);
    setErr('');
  }

  function agregarViaje() {
    const o = nCiudadOrigen.trim();
    const d = nCiudadDestino.trim();
    if (!o || !d) { setErr('Selecciona la ciudad de origen y destino.'); return; }
    if (o === d)  { setErr('Origen y destino deben ser diferentes.'); return; }
    const dup = viajes.find((v) => v.tipo === nTipo &&
      v.origen.toLowerCase() === o.toLowerCase() && v.destino.toLowerCase() === d.toLowerCase());
    if (dup) { setErr(`Ya existe una ruta ${nTipo} ${o} → ${d}.`); return; }
    setViajes((p) => [...p, {
      origen: o, destino: d, tipo: nTipo,
      precioTransporte: parseNum(nTransporte),
      precioDesayuno:   parseNum(nDesayuno),
      precioAlmuerzo:   parseNum(nAlmuerzo),
      precioCena:       parseNum(nCena),
      precioHospedaje:  parseNum(nHospedaje),
    }]);
    resetFormRuta();
  }

  async function guardar() {
    if (!tipoId) return;
    if (!nombre.trim()) { setErr('El nombre es obligatorio.'); return; }
    if (flujo.length === 0) { setErr('Agrega al menos un paso de aprobación.'); return; }
    setErr(''); setOk(''); setGuardando(true);
    try {
      await api.post('/admin/tarifas-viaticos', {
        precioAereo:     parseNum(precioAereo),
        precioTerrestre: parseNum(precioTerrestre),
        precioDesayuno:  parseNum(precioDesayuno),
        precioAlmuerzo:  parseNum(precioAlmuerzo),
        precioCena:      parseNum(precioCena),
        precioHospedaje: parseNum(precioHospedaje),
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
      {ok  && <div className="admin-success">{ok}</div>}

      {/* ── Información básica ── */}
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

      {/* ── Flujo ── */}
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

      {/* ── Tarifas por defecto ── */}
      <section className="leg-config-section">
        <h3>Tarifas por defecto</h3>
        <p className="leg-config-hint">
          Se aplican cuando <strong>no hay una ruta específica configurada</strong> para el viaje seleccionado.
        </p>

        <h4 className="tarifa-subtitulo">Transporte</h4>
        <div className="tarifa-grid">
          {([
            ['✈ Viaje aéreo (por tiquete)', precioAereo, setPrecioAereo],
            ['🚌 Viaje terrestre (por tiquete)', precioTerrestre, setPrecioTerrestre],
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

        <h4 className="tarifa-subtitulo" style={{ marginTop: 16 }}>Alimentación y hospedaje</h4>
        <div className="tarifa-grid">
          {([
            ['☀️ Desayuno (por día)',        precioDesayuno,  setPrecioDesayuno],
            ['🌤 Almuerzo (por día)',         precioAlmuerzo,  setPrecioAlmuerzo],
            ['🌙 Cena (por día)',             precioCena,      setPrecioCena],
            ['🏨 Hospedaje (por noche)',      precioHospedaje, setPrecioHospedaje],
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

      {/* ── Rutas específicas ── */}
      <section className="leg-config-section">
        <h3>Precios por ruta específica</h3>
        <p className="leg-config-hint">
          Cuando el profesional selecciona estas ciudades, se usan <strong>todos</strong> los precios de la ruta
          (transporte, comidas, hospedaje) en lugar de las tarifas por defecto.
          Las comidas y hospedaje indicados aquí reemplazan los valores generales para ese viaje.
        </p>

        {/* Tabla de rutas existentes */}
        {viajes.length > 0 && (
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table className="tarifa-rutas-tabla" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Tipo</th>
                  <th>Transp.</th>
                  <th>Desay.</th>
                  <th>Almuerz.</th>
                  <th>Cena</th>
                  <th>Hosped./noche</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {viajes.map((v, i) => {
                  const editando = editIdx === i && editViaje !== null;
                  if (editando && editViaje) {
                    /* ── Fila en modo edición ── */
                    const setE = (campo: keyof ViajeEspecifico) => (val: string) =>
                      setEditViaje((p) => p ? { ...p, [campo]: parseNum(val) } : p);
                    return (
                      <tr key={i} className="ruta-row-edit">
                        <td>{v.origen}</td>
                        <td>{v.destino}</td>
                        <td>
                          <select value={editViaje.tipo}
                            onChange={(e) => setEditViaje((p) => p ? { ...p, tipo: e.target.value as 'aereo' | 'terrestre' } : p)}
                            style={{ fontSize: 12 }}>
                            <option value="aereo">✈ Aéreo</option>
                            <option value="terrestre">🚌 Terrestre</option>
                          </select>
                        </td>
                        {(['precioTransporte','precioDesayuno','precioAlmuerzo','precioCena','precioHospedaje'] as (keyof ViajeEspecifico)[]).map((k) => (
                          <td key={k}>
                            <div className="leg-monto-row" style={{ margin: 0 }}>
                              <span className="leg-monto-prefix" style={{ fontSize: 11 }}>$</span>
                              <input type="text" inputMode="numeric" style={{ width: 80, margin: 0, fontSize: 12 }}
                                value={fmtNum(Number(editViaje[k]))}
                                onChange={(e) => setE(k)(e.target.value.replace(/[^0-9.,]/g, ''))} />
                            </div>
                          </td>
                        ))}
                        <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 4 }}>
                          <button type="button" className="admin-primary-button" style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => {
                              setViajes((p) => p.map((x, j) => j === i ? editViaje! : x));
                              setEditIdx(null); setEditViaje(null);
                            }}>Guardar</button>
                          <button type="button" className="admin-ghost-button" style={{ fontSize: 12, padding: '4px 8px' }}
                            onClick={() => { setEditIdx(null); setEditViaje(null); }}>✕</button>
                        </td>
                      </tr>
                    );
                  }
                  /* ── Fila normal ── */
                  return (
                    <tr key={i}>
                      <td>{v.origen}</td>
                      <td>{v.destino}</td>
                      <td>{v.tipo === 'aereo' ? '✈ Aéreo' : '🚌 Terrestre'}</td>
                      <td>{fmtCOP(v.precioTransporte)}</td>
                      <td>{fmtCOP(v.precioDesayuno)}</td>
                      <td>{fmtCOP(v.precioAlmuerzo)}</td>
                      <td>{fmtCOP(v.precioCena)}</td>
                      <td>{fmtCOP(v.precioHospedaje)}</td>
                      <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 4 }}>
                        <button type="button" className="admin-ghost-button" style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => { setEditIdx(i); setEditViaje({ ...v }); }}>
                          Editar
                        </button>
                        <button type="button" className="tipos-eliminar-btn"
                          onClick={() => { setViajes((p) => p.filter((_, j) => j !== i)); if (editIdx === i) { setEditIdx(null); setEditViaje(null); } }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Formulario nueva ruta */}
        <div className="ruta-especifica-form">
          <p className="leg-config-hint" style={{ marginBottom: 10 }}>
            <strong>Nueva ruta:</strong> los precios se pre-rellenan con los valores generales; modifica solo los que difieran.
          </p>

          {/* Ciudades */}
          <div className="ruta-ciudades-grid">
            <div className="ruta-ciudad-col">
              <label className="tarifa-label">Departamento origen</label>
              <select value={nDeptOrigen} onChange={(e) => { setNDeptOrigen(e.target.value); setNCiudadOrigen(''); }}>
                <option value="">— Departamento —</option>
                {DEPTOS.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
              <label className="tarifa-label" style={{ marginTop: 8 }}>Ciudad origen *</label>
              <select value={nCiudadOrigen} onChange={(e) => setNCiudadOrigen(e.target.value)} disabled={!nDeptOrigen}>
                <option value="">— Ciudad —</option>
                {(DEPTOS.find((d) => d.id === nDeptOrigen)?.ciudades ?? []).map((c) => (
                  <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="ruta-flecha">→</div>

            <div className="ruta-ciudad-col">
              <label className="tarifa-label">Departamento destino</label>
              <select value={nDeptDestino} onChange={(e) => { setNDeptDestino(e.target.value); setNCiudadDestino(''); }}>
                <option value="">— Departamento —</option>
                {DEPTOS.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
              <label className="tarifa-label" style={{ marginTop: 8 }}>Ciudad destino *</label>
              <select value={nCiudadDestino} onChange={(e) => setNCiudadDestino(e.target.value)} disabled={!nDeptDestino}>
                <option value="">— Ciudad —</option>
                {(DEPTOS.find((d) => d.id === nDeptDestino)?.ciudades ?? []).map((c) => (
                  <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tipo transporte */}
          <div style={{ marginTop: 12 }}>
            <label className="tarifa-label">Tipo de transporte</label>
            <div className="viaticos-tipo-transport-row" style={{ marginTop: 6 }}>
              <button type="button" className={`viatico-tr-btn${nTipo === 'aereo' ? ' selected' : ''}`} onClick={() => setNTipo('aereo')}>✈ Aéreo</button>
              <button type="button" className={`viatico-tr-btn${nTipo === 'terrestre' ? ' selected' : ''}`} onClick={() => setNTipo('terrestre')}>🚌 Terrestre</button>
            </div>
          </div>

          {/* Precios de la ruta */}
          <div className="tarifa-grid" style={{ marginTop: 14 }}>
            {([
              [`${nTipo === 'aereo' ? '✈' : '🚌'} Precio transporte`, nTransporte, setNTransporte],
              ['☀️ Desayuno por día',                                  nDesayuno,   setNDesayuno],
              ['🌤 Almuerzo por día',                                  nAlmuerzo,   setNAlmuerzo],
              ['🌙 Cena por día',                                      nCena,       setNCena],
              ['🏨 Hospedaje por noche',                               nHospedaje,  setNHospedaje],
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

          <button type="button" className="admin-ghost-button" style={{ marginTop: 14 }} onClick={agregarViaje}>
            + Agregar ruta
          </button>
        </div>
      </section>

      {/* ── Visibilidad ── */}
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
