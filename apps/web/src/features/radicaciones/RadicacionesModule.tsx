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

export function RadicacionesModule() {
  const [vista, setVista] = useState<Vista>('bandeja');
  const [items, setItems] = useState<SolicitudResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [borrando, setBorrando] = useState<number | null>(null);
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

      <nav className="radicaciones-nav" aria-label="Modulos de radicación">
        <button
          type="button"
          className={`radicaciones-nav-item${vista === 'bandeja' ? ' active' : ''}`}
          onClick={() => setVista('bandeja')}
        >
          Bandeja de validación
        </button>
        <button
          type="button"
          className={`radicaciones-nav-item${vista === 'misSolicitudes' ? ' active' : ''}`}
          onClick={() => setVista('misSolicitudes')}
        >
          Mis solicitudes
        </button>
        <button
          type="button"
          className={`radicaciones-nav-item${vista === 'nueva' ? ' active' : ''}`}
          onClick={() => setVista('nueva')}
        >
          Nueva solicitud
        </button>
        <button
          type="button"
          className={`radicaciones-nav-item${vista === 'tablero' ? ' active' : ''}`}
          onClick={() => setVista('tablero')}
        >
          Tablero general
        </button>
      </nav>

      {vista === 'bandeja' ? <BandejaPanel /> : null}
      {vista === 'misSolicitudes' ? <MisSolicitudesPanel /> : null}
      {vista === 'nueva' ? <NuevaSolicitudPanel /> : null}

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
    </section>
  );
}
