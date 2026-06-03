import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/http/api';

interface SolicitudResumen {
  id: number;
  numeroRadicado: string;
  estado: string;
  pasoActual: string | null;
  areaNombre: string;
  tipoNombre: string;
  creadoEn: string;
  alertasCount: number;
}

interface BandejaItem {
  id: number;
  numeroRadicado: string;
  pasoActual: string | null;
  areaNombre: string;
  tipoNombre: string;
  creadoEn: string;
  alertasCount: number;
}

export function InicioStats() {
  const [mias, setMias] = useState<SolicitudResumen[]>([]);
  const [bandeja, setBandeja] = useState<BandejaItem[]>([]);

  const cargar = useCallback(async () => {
    try {
      const [misR, bR] = await Promise.all([
        api.get<SolicitudResumen[]>('/solicitudes').catch(() => ({ data: [] as SolicitudResumen[] })),
        api.get<BandejaItem[]>('/solicitudes/bandeja').catch(() => ({ data: [] as BandejaItem[] })),
      ]);
      setMias(misR.data);
      setBandeja(bR.data);
    } catch {
      // ignorar
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [cargar]);

  const stats = useMemo(() => {
    const cont = {
      pendientesValidar: bandeja.length,
      misEnCurso: 0,
      misDevueltas: 0,
      misAprobadas: 0,
      misRechazadas: 0,
      conAlertas: 0,
    };
    for (const s of mias) {
      if (s.estado === 'en_validacion' || s.estado === 'borrador') cont.misEnCurso++;
      else if (s.estado === 'devuelto') cont.misDevueltas++;
      else if (s.estado === 'aprobado') cont.misAprobadas++;
      else if (s.estado === 'rechazado') cont.misRechazadas++;
      if (s.alertasCount > 0) cont.conAlertas++;
    }
    return cont;
  }, [mias, bandeja]);

  return (
    <div className="inicio-stats-grid">
      <article className="inicio-stat-card alta">
        <span className="stat-label">Pendientes por validar</span>
        <strong className="stat-value">{stats.pendientesValidar}</strong>
        <span className="stat-help">En tu bandeja</span>
      </article>
      <article className="inicio-stat-card">
        <span className="stat-label">Mis solicitudes en curso</span>
        <strong className="stat-value">{stats.misEnCurso}</strong>
        <span className="stat-help">En validación</span>
      </article>
      <article className="inicio-stat-card warn">
        <span className="stat-label">Devueltas a mí</span>
        <strong className="stat-value">{stats.misDevueltas}</strong>
        <span className="stat-help">Requieren acción</span>
      </article>
      <article className="inicio-stat-card ok">
        <span className="stat-label">Aprobadas</span>
        <strong className="stat-value">{stats.misAprobadas}</strong>
        <span className="stat-help">Cerradas con éxito</span>
      </article>
      <article className="inicio-stat-card err">
        <span className="stat-label">Rechazadas</span>
        <strong className="stat-value">{stats.misRechazadas}</strong>
        <span className="stat-help">Cerradas sin aprobación</span>
      </article>
      <article className="inicio-stat-card alerta">
        <span className="stat-label">Con alertas de IA</span>
        <strong className="stat-value">{stats.conAlertas}</strong>
        <span className="stat-help">Revisión recomendada</span>
      </article>
    </div>
  );
}

export function InicioRecientes() {
  const [items, setItems] = useState<SolicitudResumen[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
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
    cargar();
  }, [cargar]);

  return (
    <section className="card-surface inicio-recientes">
      <header className="inicio-recientes-head">
        <div>
          <h4>Mis solicitudes recientes</h4>
          <p className="admin-help-text">Últimos movimientos. Para gestionar entra a Radicaciones.</p>
        </div>
        <button type="button" className="admin-ghost-button" onClick={cargar} disabled={loading}>
          {loading ? 'Actualizando…' : 'Refrescar'}
        </button>
      </header>
      {items.length === 0 ? (
        <p className="admin-help-text">No hay solicitudes registradas.</p>
      ) : (
        <ul className="inicio-recientes-list">
          {items.slice(0, 6).map((it) => (
            <li key={it.id} className={`inicio-reciente-item estado-${it.estado}`}>
              <div>
                <strong>{it.numeroRadicado}</strong>
                <span>{it.areaNombre} · {it.tipoNombre}</span>
              </div>
              <div className="inicio-reciente-meta">
                <span className={`status-pill ${it.estado === 'aprobado' ? 'on' : it.estado === 'rechazado' ? 'off' : ''}`}>
                  {it.estado.replace('_', ' ')}
                </span>
                {it.alertasCount > 0 ? <span className="mis-sol-alertas">⚠ {it.alertasCount}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
