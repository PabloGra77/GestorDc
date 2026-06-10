import { useCallback, useEffect, useState, FormEvent } from 'react';
import { api } from '../../services/http/api';
import { generarPdfFormato } from '../solicitudes/generarPdfFormato';
import type { VerificarRadicadoResponse, SolicitudVerificada } from '../../types/radicado';

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

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  en_validacion: 'En validación',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  devuelto: 'Devuelto',
};

const ESTADO_CLASS: Record<string, string> = {
  aprobado: 'on',
  rechazado: 'off',
  devuelto: 'warn',
  en_validacion: '',
  borrador: '',
};

function formatFecha(s: string) {
  try {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('es-CO');
  } catch {
    return s;
  }
}

// ── Widget principal: Seguimiento de radicado ─────────────────────────────────
export function SeguimientoRadicado() {
  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [resultado, setResultado] = useState<SolicitudVerificada | null>(null);
  const [sinResultado, setSinResultado] = useState(false);
  const [error, setError] = useState('');

  async function handleBuscar(e: FormEvent) {
    e.preventDefault();
    const termino = busqueda.trim();
    if (!termino) { setError('Ingresa el número de radicado.'); return; }
    setError('');
    setResultado(null);
    setSinResultado(false);
    setBuscando(true);
    try {
      const r = await api.get<VerificarRadicadoResponse>('/radicados/verificar', {
        params: { numero: termino, referencia: termino },
      });
      if (!r.data.existe) { setSinResultado(true); return; }
      if (r.data.tipo === 'solicitud' && r.data.solicitud) {
        setResultado(r.data.solicitud);
      } else {
        setSinResultado(true);
      }
    } catch {
      setError('Error al consultar. Verifica el número e intenta de nuevo.');
    } finally {
      setBuscando(false);
    }
  }

  async function handleDescargarPdf() {
    if (!resultado) return;
    setDescargando(true);
    try {
      const r = await api.get(`/solicitudes/${resultado.id}`);
      generarPdfFormato(r.data);
    } catch {
      setError('No se pudo generar el PDF.');
    } finally {
      setDescargando(false);
    }
  }

  return (
    <section className="card-surface inicio-seguimiento-principal">
      <header className="inicio-seguimiento-header">
        <h3>Seguimiento de radicado</h3>
        <p className="admin-help-text">Consulta el estado de cualquier solicitud ingresando su número de radicado.</p>
      </header>

      <form className="inicio-seguimiento-input" onSubmit={handleBuscar}>
        <input
          type="text"
          placeholder="Ej. X2652-C00001"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="radicado-action-button" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error ? <div className="admin-error" style={{ marginTop: '0.75rem' }}>{error}</div> : null}

      {sinResultado ? (
        <div className="radicado-result card-surface" style={{ marginTop: '1rem' }}>
          <strong>Sin coincidencias</strong>
          <span className="admin-help-text">No existe una solicitud con ese número.</span>
        </div>
      ) : null}

      {resultado ? (
        <div className="seguimiento-resultado" style={{ marginTop: '1rem' }}>
          {/* Encabezado del resultado */}
          <div className="radicado-result card-surface">
            <div className="seguimiento-result-head">
              <div>
                <strong className="seguimiento-numero">{resultado.numeroRadicado}</strong>
                <span className="admin-help-text">{resultado.tipoNombre} · {resultado.areaNombre}</span>
              </div>
              <span className={`status-pill ${ESTADO_CLASS[resultado.estado] ?? ''}`}>
                {ESTADO_LABEL[resultado.estado] ?? resultado.estado}
              </span>
            </div>

            <div className="seguimiento-meta">
              <span><strong>Radicado:</strong> {formatFecha(resultado.creadoEn)}</span>
              {resultado.pasoActual ? <span><strong>Paso actual:</strong> {resultado.pasoActual}</span> : null}
              {resultado.aprobadoEn ? <span><strong>Aprobado:</strong> {formatFecha(resultado.aprobadoEn)}</span> : null}
            </div>

            {/* Trazado visual de pasos */}
            {resultado.trazado.length > 0 ? (
              <div className="seguimiento-trazado">
                {resultado.trazado.map((paso, i) => (
                  <div key={i} className={`trazado-paso trazado-${paso.estado}`}>
                    <div className="trazado-icono">
                      {paso.estado === 'completado' ? '✓' : paso.estado === 'en_curso' ? '◉' : '○'}
                    </div>
                    <span className="trazado-label">{paso.label || paso.rol}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Movimientos públicos */}
            {resultado.movimientosPublicos.length > 0 ? (
              <div className="seguimiento-movimientos">
                <h5>Historial</h5>
                <ul>
                  {resultado.movimientosPublicos.map((m, i) => (
                    <li key={i} className="seguimiento-mov-item">
                      <span className="seguimiento-mov-fecha">{formatFecha(m.creadoEn)}</span>
                      <span className="seguimiento-mov-accion">{m.accion}{m.paso ? ` — ${m.paso}` : ''}</span>
                      {m.comentario ? <span className="seguimiento-mov-comentario">"{m.comentario}"</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Botón descargar PDF */}
            <div className="seguimiento-actions">
              <button
                type="button"
                className="radicado-action-button"
                onClick={handleDescargarPdf}
                disabled={descargando}
              >
                {descargando ? 'Generando PDF…' : '⬇ Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ── Solicitudes recientes (se mantiene sin cambios) ───────────────────────────
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
                  {ESTADO_LABEL[it.estado] ?? it.estado.replace('_', ' ')}
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

// InicioStats se mantiene exportado pero vacío (compatibilidad con imports existentes)
export function InicioStats() {
  return null;
}
