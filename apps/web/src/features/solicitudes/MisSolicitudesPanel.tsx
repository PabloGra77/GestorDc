import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { generarPdfFormato } from './generarPdfFormato';

interface SolicitudResumen {
  id: number;
  numeroRadicado: string;
  tipoSolicitudId: number;
  tipoNombre: string;
  areaId: number;
  areaNombre: string;
  solicitanteNombre: string | null;
  estado: string;
  pasoActual: string | null;
  pasoOrden: number;
  creadoEn: string;
  actualizadoEn: string;
  alertasCount: number;
}

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  en_validacion: 'En validación',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  devuelto: 'Devuelto',
};

export function MisSolicitudesPanel({ refresco }: { refresco?: number }) {
  const [items, setItems] = useState<SolicitudResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [descargando, setDescargando] = useState<number | null>(null);

  async function descargarPdf(id: number) {
    setDescargando(id);
    try {
      const r = await api.get(`/solicitudes/${id}`);
      generarPdfFormato(r.data);
    } catch {
      // silencioso
    } finally {
      setDescargando(null);
    }
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await api.get<SolicitudResumen[]>('/solicitudes');
      setItems(r.data);
    } catch {
      setErr('No se pudo cargar el listado.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, refresco]);

  function formatFecha(s: string) {
    try {
      const d = new Date(s.replace(' ', 'T') + 'Z');
      return d.toLocaleString('es-CO');
    } catch {
      return s;
    }
  }

  return (
    <section className="mis-solicitudes-panel">
      <header className="admin-panel-head">
        <div>
          <h3>Mis solicitudes</h3>
          <p className="admin-help-text">
            {loading ? 'Cargando…' : `${items.length} solicitud(es).`}
          </p>
        </div>
        <button type="button" className="admin-refresh-button" onClick={cargar}>
          Refrescar
        </button>
      </header>

      {err ? <div className="admin-error">{err}</div> : null}

      <div className="mis-solicitudes-list">
        {!loading && items.length === 0 ? (
          <p className="admin-help-text">No tienes solicitudes registradas.</p>
        ) : null}
        {items.map((s) => (
          <div key={s.id} className="mis-sol-item card-surface">
            <div>
              <strong>{s.numeroRadicado}</strong>
              <p className="admin-help-text">
                {s.areaNombre} · {s.tipoNombre}
              </p>
              <p className="admin-help-text">
                Creado: {formatFecha(s.creadoEn)}
              </p>
            </div>
            <div className="mis-sol-meta">
              <span className={`mis-sol-estado mis-sol-${s.estado}`}>
                {ESTADO_LABEL[s.estado] || s.estado}
              </span>
              {s.pasoActual ? (
                <span className="admin-help-text">
                  Paso: <strong>{s.pasoActual}</strong>
                </span>
              ) : null}
              {s.alertasCount > 0 ? (
                <span className="mis-sol-alertas">⚠ {s.alertasCount} alerta(s)</span>
              ) : null}
              {s.estado === 'aprobado' ? (
                <button
                  type="button"
                  className="admin-ghost-button"
                  onClick={() => descargarPdf(s.id)}
                  disabled={descargando === s.id}
                  style={{ fontSize: 11, padding: '6px 12px' }}
                >
                  {descargando === s.id ? 'Generando…' : '⬇ Descargar PDF'}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
