import { useCallback, useEffect, useState, FormEvent } from 'react';
import { api } from '../../services/http/api';
import { generarPdfFormato, generarFormatoBlobUrl } from '../solicitudes/generarPdfFormato';
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
  devuelto: 'Devuelto al solicitante',
};

const ESTADO_COLOR: Record<string, string> = {
  aprobado:     '#2e7d32',
  rechazado:    '#c62828',
  devuelto:     '#e65100',
  en_validacion:'#1565c0',
  borrador:     '#555',
};

const ESTADO_BG: Record<string, string> = {
  aprobado:     'rgba(46,125,50,0.15)',
  rechazado:    'rgba(198,40,40,0.15)',
  devuelto:     'rgba(230,81,0,0.15)',
  en_validacion:'rgba(21,101,192,0.12)',
  borrador:     'rgba(80,80,80,0.12)',
};

function formatFecha(s: string) {
  try {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('es-CO', {
      dateStyle: 'medium', timeStyle: 'short',
    });
  } catch { return s; }
}

// ── Widget principal: Seguimiento de radicado ─────────────────────────────────
export function SeguimientoRadicado() {
  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [resultado, setResultado] = useState<SolicitudVerificada | null>(null);
  const [sinResultado, setSinResultado] = useState(false);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [mostrarPreview, setMostrarPreview] = useState(false);

  async function handleBuscar(e: FormEvent) {
    e.preventDefault();
    const termino = busqueda.trim().toUpperCase();
    if (!termino) { setError('Ingresa el número de radicado.'); return; }
    setError('');
    setResultado(null);
    setSinResultado(false);
    setPdfUrl(null);
    setMostrarPreview(false);
    setBuscando(true);
    try {
      const r = await api.get<VerificarRadicadoResponse>('/radicados/verificar', {
        params: { numero: termino, referencia: termino },
      });
      if (!r.data.existe || !r.data.solicitud) { setSinResultado(true); return; }
      setResultado(r.data.solicitud);
    } catch {
      setError('Error al consultar. Verifica el número e intenta de nuevo.');
    } finally {
      setBuscando(false);
    }
  }

  async function handleVerPdf() {
    if (!resultado) return;
    setCargandoPreview(true);
    setMostrarPreview(true);
    try {
      const r = await api.get(`/solicitudes/${resultado.id}`);
      const url = await generarFormatoBlobUrl(r.data);
      if (url) {
        setPdfUrl(url);
      } else {
        // Sin plantilla personalizada: generar y mostrar blob del PDF estándar
        const { generarPdfBlob } = await import('../solicitudes/generarPdfFormato').then(m => ({ generarPdfBlob: m.generarPdfFormato }));
        generarPdfBlob(r.data);
        setMostrarPreview(false);
      }
    } catch {
      setError('No se pudo cargar la vista previa.');
      setMostrarPreview(false);
    } finally {
      setCargandoPreview(false);
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

  function cerrarPreview() {
    setMostrarPreview(false);
    if (pdfUrl) { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }
  }

  const estadoColor  = resultado ? (ESTADO_COLOR[resultado.estado]  ?? '#888') : '#888';
  const estadoBg     = resultado ? (ESTADO_BG[resultado.estado]     ?? 'rgba(80,80,80,0.1)') : '';
  const estadoLabel  = resultado ? (ESTADO_LABEL[resultado.estado]  ?? resultado.estado) : '';

  return (
    <>
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
            autoCapitalize="characters"
          />
          <button type="submit" className="radicado-action-button" disabled={buscando}>
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        {error ? <div className="admin-error" style={{ marginTop: '0.75rem' }}>{error}</div> : null}

        {sinResultado ? (
          <div className="seg-sin-resultado">
            <span className="seg-sin-icono">🔍</span>
            <strong>Sin resultados</strong>
            <span>No existe una solicitud con el número <em>{busqueda}</em></span>
          </div>
        ) : null}

        {resultado ? (
          <div className="seg-resultado">

            {/* ── Encabezado ── */}
            <div className="seg-head" style={{ borderLeftColor: estadoColor }}>
              <div className="seg-head-left">
                <span className="seg-numero">{resultado.numeroRadicado}</span>
                <span className="seg-subtitulo">{resultado.tipoNombre}</span>
                <span className="seg-area">Área: <strong>{resultado.areaNombre}</strong></span>
                {resultado.pasoActual ? (
                  <span className="seg-paso-actual">
                    Pendiente con: <strong>{resultado.pasoActual}</strong>
                  </span>
                ) : null}
              </div>
              <div className="seg-head-right">
                <span
                  className="seg-estado-badge"
                  style={{ color: estadoColor, background: estadoBg, borderColor: estadoColor }}
                >
                  {resultado.estado === 'aprobado'     ? '✓' :
                   resultado.estado === 'rechazado'    ? '✗' :
                   resultado.estado === 'devuelto'     ? '↩' :
                   resultado.estado === 'en_validacion'? '⏳' : '●'}{' '}
                  {estadoLabel}
                </span>
                <div className="seg-fechas">
                  <span>Radicado: {formatFecha(resultado.creadoEn)}</span>
                  {resultado.aprobadoEn ? <span>Aprobado: {formatFecha(resultado.aprobadoEn)}</span> : null}
                </div>
              </div>
            </div>

            {/* ── Trazado de pasos ── */}
            {resultado.trazado.length > 0 ? (
              <div className="seg-trazado-wrap">
                <h5 className="seg-section-title">Flujo de aprobación</h5>
                <div className="seg-trazado">
                  {resultado.trazado.map((paso, i) => (
                    <div key={i} className={`seg-paso seg-paso--${paso.estado}`}>
                      <div className="seg-paso-circulo">
                        {paso.estado === 'completado' ? '✓' :
                         paso.estado === 'en_curso'   ? '◉' : (paso.orden + 1)}
                      </div>
                      {i < resultado.trazado.length - 1 && (
                        <div className={`seg-paso-linea seg-paso-linea--${paso.estado}`} />
                      )}
                      <span className="seg-paso-label">{paso.label || paso.rol}</span>
                      <span className="seg-paso-estado">
                        {paso.estado === 'completado' ? 'Completado' :
                         paso.estado === 'en_curso'   ? 'En curso'   : 'Pendiente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ── Historial ── */}
            {resultado.movimientosPublicos.length > 0 ? (
              <div className="seg-historial">
                <h5 className="seg-section-title">Historial de la solicitud</h5>
                <ul className="seg-mov-lista">
                  {resultado.movimientosPublicos.map((m, i) => (
                    <li key={i} className={`seg-mov seg-mov--${m.accion}`}>
                      <div className="seg-mov-icon">
                        {m.accion === 'creada'    ? '📄' :
                         m.accion === 'aprobada'  ? '✅' :
                         m.accion === 'rechazada' ? '❌' :
                         m.accion === 'devuelta'  ? '↩️' :
                         m.accion === 'validada'  ? '✔️' : '📋'}
                      </div>
                      <div className="seg-mov-body">
                        <div className="seg-mov-top">
                          <strong className="seg-mov-accion">
                            {m.accion.charAt(0).toUpperCase() + m.accion.slice(1)}
                            {m.paso ? <span className="seg-mov-paso"> — {m.paso}</span> : null}
                          </strong>
                          <span className="seg-mov-fecha">{formatFecha(m.creadoEn)}</span>
                        </div>
                        {m.comentario ? (
                          <p className="seg-mov-comentario">"{m.comentario}"</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* ── Acciones ── */}
            <div className="seg-acciones">
              <button
                type="button"
                className="radicado-action-button"
                onClick={handleVerPdf}
                disabled={cargandoPreview}
              >
                {cargandoPreview ? 'Cargando…' : '👁 Ver PDF'}
              </button>
              <button
                type="button"
                className="admin-ghost-button"
                onClick={handleDescargarPdf}
                disabled={descargando}
              >
                {descargando ? 'Generando…' : '⬇ Descargar PDF'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Modal preview PDF ── */}
      {mostrarPreview ? (
        <div className="seg-pdf-overlay" onClick={cerrarPreview}>
          <div className="seg-pdf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="seg-pdf-modal-head">
              <strong>Vista previa — {resultado?.numeroRadicado}</strong>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="admin-ghost-button" onClick={handleDescargarPdf} disabled={descargando}>
                  {descargando ? 'Generando…' : '⬇ Descargar'}
                </button>
                <button type="button" className="admin-ghost-button" onClick={cerrarPreview}>✕ Cerrar</button>
              </div>
            </div>
            <div className="seg-pdf-frame-wrap">
              {cargandoPreview ? (
                <div className="seg-pdf-loading">Generando vista previa…</div>
              ) : pdfUrl ? (
                <iframe src={pdfUrl} title="Vista previa PDF" className="seg-pdf-frame" />
              ) : (
                <div className="seg-pdf-loading">Este tipo de solicitud no tiene plantilla PDF personalizada.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ── Solicitudes recientes ─────────────────────────────────────────────────────
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

  useEffect(() => { cargar(); }, [cargar]);

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

export function InicioStats() { return null; }

