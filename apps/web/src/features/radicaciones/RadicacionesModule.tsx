import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/http/api';
import { getAuthSession } from '../auth/auth.service';
import { BandejaPanel } from '../solicitudes/BandejaPanel';
import { MisSolicitudesPanel } from '../solicitudes/MisSolicitudesPanel';
import { NuevaSolicitudPanel } from '../solicitudes/NuevaSolicitudPanel';

type Vista = 'nueva' | 'misSolicitudes' | 'bandeja' | 'tablero';

interface SolicitudResumen {
  id: number;
  numeroRadicado: string;
  estado: string;
  pasoActual: string | null;
  creadoEn: string;
  alertasCount: number;
  areaNombre: string;
  tipoNombre: string;
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  en_validacion: 'En validación',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  devuelto: 'Devuelto',
};

const TABS: { key: Vista; label: string; desc: string; icon: string }[] = [
  { key: 'nueva',          label: 'Nueva solicitud',       desc: 'Crea un nuevo radicado', icon: 'plus' },
  { key: 'misSolicitudes', label: 'Mis solicitudes',        desc: 'Consulta tus radicados', icon: 'doc' },
  { key: 'bandeja',        label: 'Bandeja',                desc: 'Validación documental',  icon: 'inbox' },
  { key: 'tablero',        label: 'Tablero',                desc: 'Indicadores generales',  icon: 'chart' },
];

function TabIcon({ name }: { name: string }) {
  const s = 18;
  if (name === 'plus') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  );
  if (name === 'doc') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
  if (name === 'inbox') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  );
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const cls =
    estado === 'aprobado'      ? 'rad-badge--ok'  :
    estado === 'rechazado'     ? 'rad-badge--err' :
    estado === 'devuelto'      ? 'rad-badge--warn':
    estado === 'en_validacion' ? 'rad-badge--info': 'rad-badge--draft';
  return <span className={`rad-badge ${cls}`}>{ETIQUETAS_ESTADO[estado] ?? estado}</span>;
}

export function RadicacionesModule() {
  const [vista, setVista]         = useState<Vista>('misSolicitudes');
  const [items, setItems]         = useState<SolicitudResumen[]>([]);
  const [loading, setLoading]     = useState(false);
  const [borrando, setBorrando]   = useState<number | null>(null);
  const isAdmin = (getAuthSession()?.usuario?.rol?.nombre ?? '').toLowerCase() === 'administrador';

  const tabs = isAdmin ? TABS : TABS.filter((t) => t.key !== 'tablero');

  function irA(v: Vista) { setVista(v); }

  const cargarKpis = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<SolicitudResumen[]>('/solicitudes');
      setItems(r.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (vista === 'tablero') cargarKpis();
  }, [vista, cargarKpis]);

  const kpis = useMemo(() => {
    const c = { total: items.length, en_validacion: 0, aprobado: 0, rechazado: 0, devuelto: 0, alertasIA: 0 };
    for (const it of items) {
      if (it.estado === 'en_validacion') c.en_validacion++;
      else if (it.estado === 'aprobado') c.aprobado++;
      else if (it.estado === 'rechazado') c.rechazado++;
      else if (it.estado === 'devuelto') c.devuelto++;
      if (it.alertasCount > 0) c.alertasIA++;
    }
    return c;
  }, [items]);

  async function eliminarSolicitud(it: SolicitudResumen) {
    if (!window.confirm(`¿Eliminar definitivamente ${it.numeroRadicado}? Esta acción no se puede deshacer.`)) return;
    setBorrando(it.id);
    try {
      await api.delete(`/solicitudes/${it.id}`);
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } catch {
      window.alert('No se pudo eliminar la solicitud.');
    } finally {
      setBorrando(null);
    }
  }

  return (
    <div className="rad2-shell">
      {/* ── Cabecera del módulo ── */}
      <div className="rad2-header">
        <div className="rad2-header-text">
          <h2 className="rad2-titulo">Radicaciones</h2>
          <p className="rad2-subtitulo">Gestión y validación de solicitudes documentales de Goleman IPS</p>
        </div>
      </div>

      {/* ── Tabs de navegación ── */}
      <nav className="rad2-tabs" aria-label="Vistas de radicaciones">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`rad2-tab${vista === tab.key ? ' rad2-tab--active' : ''}`}
            onClick={() => irA(tab.key)}
          >
            <span className="rad2-tab-icon"><TabIcon name={tab.icon} /></span>
            <span className="rad2-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Área de contenido ── */}
      <div className="rad2-content">
        {vista === 'nueva' && (
          <NuevaSolicitudPanel onCreada={() => irA('misSolicitudes')} />
        )}

        {vista === 'misSolicitudes' && (
          <MisSolicitudesPanel />
        )}

        {vista === 'bandeja' && (
          <BandejaPanel />
        )}

        {vista === 'tablero' && (
          <div className="rad2-tablero">
            {loading ? (
              <p className="admin-help-text" style={{ textAlign: 'center', padding: '32px 0' }}>Cargando indicadores…</p>
            ) : (
              <>
                {/* KPIs */}
                <div className="rad2-kpi-grid">
                  <div className="rad2-kpi">
                    <div className="rad2-kpi-icon rad2-kpi-icon--total">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div>
                      <p className="rad2-kpi-val">{kpis.total}</p>
                      <p className="rad2-kpi-label">Total solicitudes</p>
                    </div>
                  </div>
                  <div className="rad2-kpi">
                    <div className="rad2-kpi-icon rad2-kpi-icon--pend">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div>
                      <p className="rad2-kpi-val">{kpis.en_validacion}</p>
                      <p className="rad2-kpi-label">En validación</p>
                    </div>
                  </div>
                  <div className="rad2-kpi">
                    <div className="rad2-kpi-icon rad2-kpi-icon--ok">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div>
                      <p className="rad2-kpi-val">{kpis.aprobado}</p>
                      <p className="rad2-kpi-label">Aprobadas</p>
                    </div>
                  </div>
                  <div className="rad2-kpi">
                    <div className="rad2-kpi-icon rad2-kpi-icon--dev">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                    </div>
                    <div>
                      <p className="rad2-kpi-val">{kpis.devuelto}</p>
                      <p className="rad2-kpi-label">Devueltas</p>
                    </div>
                  </div>
                  <div className="rad2-kpi">
                    <div className="rad2-kpi-icon rad2-kpi-icon--err">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </div>
                    <div>
                      <p className="rad2-kpi-val">{kpis.rechazado}</p>
                      <p className="rad2-kpi-label">Rechazadas</p>
                    </div>
                  </div>
                  <div className="rad2-kpi">
                    <div className="rad2-kpi-icon rad2-kpi-icon--ai">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div>
                      <p className="rad2-kpi-val">{kpis.alertasIA}</p>
                      <p className="rad2-kpi-label">Alertas de IA</p>
                    </div>
                  </div>
                </div>

                {/* Tabla de solicitudes */}
                {items.length === 0 ? (
                  <div className="rad2-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    <p>No hay solicitudes registradas aún.</p>
                  </div>
                ) : (
                  <div className="rad2-table-wrap">
                    <table className="rad2-table">
                      <thead>
                        <tr>
                          <th>Radicado</th>
                          <th>Área · Tipo</th>
                          <th>Estado</th>
                          <th>Paso actual</th>
                          <th>Alertas IA</th>
                          <th>Creado</th>
                          {isAdmin ? <th>Acciones</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {items.slice(0, 30).map((it) => (
                          <tr key={it.id}>
                            <td className="rad2-td-rad">{it.numeroRadicado}</td>
                            <td className="rad2-td-area">{it.areaNombre} · {it.tipoNombre}</td>
                            <td><EstadoBadge estado={it.estado} /></td>
                            <td className="rad2-td-muted">{it.pasoActual ?? '—'}</td>
                            <td>
                              {it.alertasCount > 0
                                ? <span className="rad2-alerta-chip">⚠ {it.alertasCount}</span>
                                : <span className="rad2-td-muted">—</span>}
                            </td>
                            <td className="rad2-td-muted">{it.creadoEn}</td>
                            {isAdmin ? (
                              <td>
                                <button
                                  type="button"
                                  className="rad2-delete-btn"
                                  disabled={borrando === it.id}
                                  onClick={() => eliminarSolicitud(it)}
                                  title="Eliminar solicitud"
                                >
                                  {borrando === it.id ? '…' : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                  )}
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
