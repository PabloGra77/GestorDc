import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/http/api';
import { getAuthSession } from '../auth/auth.service';
import { BandejaPanel } from '../solicitudes/BandejaPanel';
import { MisSolicitudesPanel } from '../solicitudes/MisSolicitudesPanel';
import { NuevaSolicitudPanel } from '../solicitudes/NuevaSolicitudPanel';
type Vista = 'bandeja' | 'misSolicitudes' | 'nueva' | 'tablero';

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

const VISTAS_LABELS: Record<Vista, string> = {
  bandeja: 'Bandeja de validación',
  misSolicitudes: 'Mis solicitudes',
  nueva: 'Nueva solicitud',
  tablero: 'Tablero general',
};

export function RadicacionesModule() {
  const [vista, setVista] = useState<Vista>('bandeja');
  const [items, setItems] = useState<SolicitudResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [borrando, setBorrando] = useState<number | null>(null);
  const [menuMovil, setMenuMovil] = useState(false);
  const isAdmin = (getAuthSession()?.usuario?.rol?.nombre || '').toLowerCase() === 'administrador';

  const eliminarSolicitud = useCallback(async (it: SolicitudResumen) => {
    const ok = window.confirm(`¿Eliminar definitivamente la solicitud ${it.numeroRadicado}? Esta acción no se puede deshacer.`);
    if (!ok) return;
    setBorrando(it.id);
    try {
      await api.delete(`/solicitudes/${it.id}`);
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } catch {
      window.alert('No se pudo eliminar la solicitud.');
    } finally {
      setBorrando(null);
    }
  }, []);

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
    if (vista === 'tablero') {
      cargarKpis();
    }
  }, [vista, cargarKpis]);

  const kpis = useMemo(() => {
    const cont = { total: items.length, en_validacion: 0, aprobado: 0, rechazado: 0, devuelto: 0, alertasIA: 0 };
    for (const it of items) {
      if (it.estado === 'en_validacion') cont.en_validacion++;
      else if (it.estado === 'aprobado') cont.aprobado++;
      else if (it.estado === 'rechazado') cont.rechazado++;
      else if (it.estado === 'devuelto') cont.devuelto++;
      if (it.alertasCount > 0) cont.alertasIA++;
    }
    return cont;
  }, [items]);

  function irA(v: Vista) { setVista(v); setMenuMovil(false); }

  return (
    <section className="card-surface radicaciones-module">
      <header className="radicaciones-head">
        <div>
          <h3>RADICACIONES</h3>
          <p>
            Flujo legal de validación documental por niveles. Cada solicitud pasa por los
            pasos definidos en su tipo (analista → coordinador → contabilidad).
          </p>
        </div>
      </header>

      {/* Selector de vista — solo visible en móvil */}
      <button
        type="button"
        className="radicaciones-menu-btn"
        aria-expanded={menuMovil}
        onClick={() => setMenuMovil((v) => !v)}
      >
        <span className="radicaciones-menu-label">{VISTAS_LABELS[vista]}</span>
      </button>

      <div className="radicaciones-layout">
        {/* Overlay oscuro para cerrar el menú en móvil */}
        {menuMovil && (
          <div className="radicaciones-overlay" role="presentation" onClick={() => setMenuMovil(false)} />
        )}

        <nav className={`radicaciones-nav${menuMovil ? ' movil-abierto' : ''}`} aria-label="Módulos de radicación">
          {([
            ['bandeja',        'Bandeja de validación'],
            ['misSolicitudes', 'Mis solicitudes'],
            ['nueva',          'Nueva solicitud'],
            ['tablero',        'Tablero general'],
          ] as [Vista, string][]).map(([key, label]) => (
            <button key={key} type="button"
              className={`radicaciones-nav-item${vista === key ? ' active' : ''}`}
              onClick={() => irA(key)}>
              {label}
            </button>
          ))}
        </nav>

        <div className="radicaciones-content">
          {vista === 'bandeja' ? <BandejaPanel /> : null}
          {vista === 'misSolicitudes' ? <MisSolicitudesPanel /> : null}
          {vista === 'nueva' ? <NuevaSolicitudPanel onCreada={() => irA('misSolicitudes')} /> : null}

          {vista === 'tablero' ? (
        <div className="radicaciones-tablero">
          {loading ? <p className="admin-help-text">Cargando indicadores…</p> : null}
          <div className="radicaciones-grid">
            <article className="radicaciones-kpi">
              <span>Total de solicitudes</span>
              <strong>{kpis.total}</strong>
            </article>
            <article className="radicaciones-kpi">
              <span>En validación</span>
              <strong>{kpis.en_validacion}</strong>
            </article>
            <article className="radicaciones-kpi">
              <span>Aprobadas</span>
              <strong>{kpis.aprobado}</strong>
            </article>
            <article className="radicaciones-kpi">
              <span>Devueltas al solicitante</span>
              <strong>{kpis.devuelto}</strong>
            </article>
            <article className="radicaciones-kpi">
              <span>Rechazadas</span>
              <strong>{kpis.rechazado}</strong>
            </article>
            <article className="radicaciones-kpi">
              <span>Con alertas de IA</span>
              <strong>{kpis.alertasIA}</strong>
            </article>
          </div>

          <h4 style={{ marginTop: 22 }}>Últimas solicitudes</h4>
          {items.length === 0 ? (
            <p className="admin-help-text">No hay solicitudes registradas.</p>
          ) : (
            <table className="radicaciones-history-table">
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
                {items.slice(0, 25).map((it) => (
                  <tr key={it.id}>
                    <td>{it.numeroRadicado}</td>
                    <td>{it.areaNombre} · {it.tipoNombre}</td>
                    <td>
                      <span className={`status-pill ${it.estado === 'aprobado' ? 'on' : it.estado === 'rechazado' ? 'off' : ''}`}>
                        {ETIQUETAS_ESTADO[it.estado] || it.estado}
                      </span>
                    </td>
                    <td>{it.pasoActual || '—'}</td>
                    <td>{it.alertasCount > 0 ? <span className="mis-sol-alertas">⚠ {it.alertasCount}</span> : '—'}</td>
                    <td>{it.creadoEn}</td>
                    {isAdmin ? (
                      <td>
                        <button
                          type="button"
                          className="admin-ghost-button bandeja-rechazar"
                          disabled={borrando === it.id}
                          title="Eliminar solicitud (solo administradores)"
                          onClick={() => eliminarSolicitud(it)}
                        >
                          {borrando === it.id ? '…' : '🗑 Eliminar'}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
