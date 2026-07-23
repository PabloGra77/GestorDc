import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { generarPdfFormato } from './generarPdfFormato';
import { useOcrDocument } from '../../hooks/useOcrDocument';
import { numeroAPesosEnLetras, formatearMiles } from '../../utils/numeroALetras';

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
  ultimoComentario: string | null;
}

const PASO_LABEL: Record<string, string> = {
  analista: 'Analista',
  coordinador: 'Coordinador',
  director: 'Director',
  contabilidad: 'Área final (Contabilidad)',
};

function labelPaso(paso: string | null): string {
  if (!paso) return '';
  return PASO_LABEL[paso] || paso;
}

function labelEstado(s: Pick<SolicitudResumen, 'estado' | 'pasoActual' | 'ultimoComentario'>): string {
  if (s.estado === 'en_validacion') {
    return s.pasoActual ? `En revisión — ${labelPaso(s.pasoActual)}` : 'En revisión';
  }
  if (s.estado === 'devuelto') return 'Devuelto';
  if (s.estado === 'rechazado') return 'Rechazado';
  return ESTADO_LABEL[s.estado] || s.estado;
}

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  en_validacion: 'En validación',
  aprobado: 'Aprobado',
  por_legalizar: 'Aprobado · debes legalizar',
  en_legalizacion: 'Legalización en revisión',
  legalizado: 'Legalizado ✓',
  rechazado: 'Rechazado',
  devuelto: 'Devuelto',
};

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

interface Evidencia {
  nombre: string;
  estado: 'procesando' | 'listo' | 'error';
  archivoId?: string;
  ocrTexto?: string;
  ocrConfianza?: number;
  ocrAlertas?: string[];
}

function LegalizarModal({ solicitud, onClose, onDone }: {
  solicitud: SolicitudResumen;
  onClose: () => void;
  onDone: () => void;
}) {
  const [evidencias, setEvidencias] = useState<Record<string, Evidencia>>({});
  const [montoLegalizado, setMontoLegalizado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState('');
  const { procesarArchivo } = useOcrDocument();

  async function agregar(files: FileList | null) {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = `evidencia_${Date.now()}_${i}`;
      setEvidencias((p) => ({ ...p, [key]: { nombre: file.name, estado: 'procesando' } }));
      try {
        // Subir archivo
        const fd = new FormData();
        fd.append('archivo', file);
        const up = await api.post<{ id: string }>('/archivos', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        // OCR
        const ocr = await procesarArchivo(file);
        const alertas: string[] = [];
        if (ocr && ocr.confidence < 50) alertas.push(`Lectura de baja calidad (${Math.round(ocr.confidence)}%): documento borroso o ilegible.`);
        // Forense (anti-fraude / alteración)
        try {
          const dataUrl = await leerComoDataUrl(file);
          const fr = await api.post<{ hallazgos?: Array<{ severidad: string; texto: string }> }>('/forense', { archivoBase64: dataUrl, nombre: file.name });
          for (const h of fr.data?.hallazgos || []) {
            if (h.severidad === 'alta' || h.severidad === 'media') alertas.push(`🔎 ${h.texto}`);
          }
        } catch { /* complementario */ }
        setEvidencias((p) => ({
          ...p,
          [key]: { nombre: file.name, estado: 'listo', archivoId: up.data.id, ocrTexto: ocr?.text, ocrConfianza: ocr?.confidence, ocrAlertas: alertas },
        }));
      } catch {
        setEvidencias((p) => ({ ...p, [key]: { nombre: file.name, estado: 'error' } }));
      }
    }
  }

  function quitar(key: string) {
    setEvidencias((p) => { const c = { ...p }; delete c[key]; return c; });
  }

  async function enviar() {
    const listas = Object.entries(evidencias).filter(([, e]) => e.estado === 'listo');
    if (listas.length === 0) { setErr('Adjunta al menos un soporte válido (factura/recibo).'); return; }
    if (!montoLegalizado) { setErr('Indica el monto total de la factura/compra legalizada.'); return; }
    setEnviando(true); setErr('');
    try {
      const documentos: Record<string, unknown> = {};
      for (const [k, e] of listas) {
        documentos[k] = { nombre: e.nombre, archivoId: e.archivoId, ocrTexto: e.ocrTexto, ocrConfianza: e.ocrConfianza, ocrAlertas: e.ocrAlertas };
      }
      await api.post(`/solicitudes/${solicitud.id}/legalizar`, { documentos, montoLegalizado });
      onDone();
    } catch (e) {
      const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(r || 'No se pudo enviar la legalización.');
    } finally {
      setEnviando(false);
    }
  }

  const lista = Object.entries(evidencias);
  const procesando = lista.some(([, e]) => e.estado === 'procesando');

  return (
    <div className="admin-permissions-overlay" role="dialog" aria-modal="true" aria-label="Legalizar anticipo">
      <div className="admin-permissions-modal card-surface">
        <div className="admin-role-head">
          <h4>Legalizar anticipo · {solicitud.numeroRadicado}</h4>
          <p>Adjunta las facturas/soportes del gasto. La inteligencia artificial los revisará (anti-fraude).</p>
        </div>
        <input type="file" accept="image/*,application/pdf" multiple onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
        <ul className="bandeja-docs" style={{ marginTop: 12 }}>
          {lista.length === 0 ? <li><em className="admin-help-text">Aún no has adjuntado soportes.</em></li> : null}
          {lista.map(([k, e]) => (
            <li key={k}>
              <strong>📎 {e.nombre}</strong>{' '}
              {e.estado === 'procesando' ? <span className="admin-help-text">⏳ Analizando con IA…</span>
                : e.estado === 'error' ? <span style={{ color: '#dc2626' }}>error al subir</span>
                : <>
                    <span className="ocr-ok">✓ {Math.round(e.ocrConfianza || 0)}% legible</span>
                    {(e.ocrAlertas?.length ?? 0) > 0 ? <ul>{e.ocrAlertas!.map((a, i) => <li key={i} style={{ color: '#b45309' }}>⚠ {a}</li>)}</ul> : null}
                    <button type="button" className="admin-ghost-button" style={{ marginLeft: 8 }} onClick={() => quitar(k)}>quitar</button>
                  </>}
            </li>
          ))}
        </ul>
        <label htmlFor="monto-legalizado" style={{ display: 'block', marginTop: 14, fontWeight: 600 }}>
          Monto total de la factura/compra legalizada
        </label>
        <div className="valor-pesos-wrap">
          <input
            id="monto-legalizado"
            type="text"
            inputMode="numeric"
            placeholder="Ej: 150000"
            value={montoLegalizado}
            onChange={(e) => setMontoLegalizado(e.target.value.replace(/\D/g, ''))}
          />
          {montoLegalizado ? (
            <div className="valor-pesos-preview">
              <span>$ {formatearMiles(montoLegalizado)}</span>
              <strong>{numeroAPesosEnLetras(montoLegalizado)}</strong>
            </div>
          ) : null}
        </div>
        {err ? <div className="admin-error" style={{ marginTop: 8 }}>{err}</div> : null}
        <div className="admin-permissions-actions">
          <button type="button" className="admin-ghost-button" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="button" className="admin-primary-button" onClick={enviar} disabled={enviando || procesando}>
            {enviando ? 'Enviando…' : 'Enviar legalización'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Movimiento {
  id: number;
  accion: string;
  paso: string | null;
  estadoResultado: string | null;
  usuarioNombre: string | null;
  comentario: string | null;
  creadoEn: string;
}

interface DetalleCompleto {
  id: number;
  numeroRadicado: string;
  estado: string;
  movimientos: Movimiento[];
}

function DetalleDevueltoModal({ solicitud, onClose, onRenviada }: {
  solicitud: SolicitudResumen;
  onClose: () => void;
  onRenviada: () => void;
}) {
  const [detalle, setDetalle] = useState<DetalleCompleto | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(true);
  const [comentario, setComentario] = useState('');
  const [reenviando, setRenviando] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get(`/solicitudes/${solicitud.id}`).then((r) => {
      setDetalle(r.data as DetalleCompleto);
    }).catch(() => {
      setErr('No se pudo cargar el detalle.');
    }).finally(() => setLoadingDetalle(false));
  }, [solicitud.id]);

  async function reenviar() {
    setRenviando(true);
    setErr('');
    try {
      const body: Record<string, unknown> = {};
      if (comentario.trim()) body.comentario = comentario.trim();
      await api.post(`/solicitudes/${solicitud.id}/reenviar`, body);
      setMsg('Solicitud reenviada. Los validadores serán notificados.');
      setTimeout(() => { onRenviada(); }, 1500);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErr(msg || 'No se pudo reenviar la solicitud.');
    } finally {
      setRenviando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 600, width: '95%' }}>
        <div className="modal-head">
          <h3>{solicitud.numeroRadicado} — {solicitud.estado === 'devuelto' ? 'Solicitud devuelta' : 'Solicitud rechazada'}</h3>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loadingDetalle ? <p className="admin-help-text">Cargando historial…</p> : null}
        {err ? <div className="admin-error">{err}</div> : null}
        {msg ? <div className="admin-success">{msg}</div> : null}

        {detalle ? (
          <>
            <h4 style={{ marginBottom: 8, marginTop: 12 }}>Historial de acciones</h4>
            <ul className="bandeja-movimientos" style={{ marginBottom: 16 }}>
              {detalle.movimientos.map((m) => (
                <li key={m.id} className={`mov-accion-${m.accion}`}>
                  <span className="bandeja-mov-accion">{m.accion}</span>
                  {m.usuarioNombre ? <span> · {m.usuarioNombre}</span> : null}
                  {m.comentario ? <p className="admin-help-text" style={{ marginTop: 2 }}>"{m.comentario}"</p> : null}
                  <span className="admin-help-text" style={{ display: 'block' }}>{m.creadoEn}</span>
                </li>
              ))}
            </ul>

            {solicitud.estado === 'devuelto' && !msg ? (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <p className="admin-help-text" style={{ marginBottom: 8 }}>
                  Corrije los problemas mencionados arriba y haz clic en <strong>Reenviar</strong> para volver a someter la solicitud al flujo de validación.
                </p>
                <textarea
                  className="admin-input"
                  placeholder="Comentario sobre las correcciones realizadas (opcional)"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  style={{ marginBottom: 10, width: '100%' }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="admin-ghost-button" onClick={onClose} disabled={reenviando}>
                    Cancelar
                  </button>
                  <button type="button" className="admin-primary-button" onClick={reenviar} disabled={reenviando}>
                    {reenviando ? 'Reenviando…' : 'Reenviar solicitud'}
                  </button>
                </div>
              </div>
            ) : null}

            {solicitud.estado === 'rechazado' ? (
              <p className="admin-help-text" style={{ marginTop: 8, color: '#c0392b' }}>
                Esta solicitud fue rechazada de forma definitiva y no puede reenviarse.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function MisSolicitudesPanel({ refresco, initialOpenId }: { refresco?: number; initialOpenId?: number }) {
  const [items, setItems] = useState<SolicitudResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [descargando, setDescargando] = useState<number | null>(null);
  const [legalizar, setLegalizar] = useState<SolicitudResumen | null>(null);
  const [verDetalle, setVerDetalle] = useState<SolicitudResumen | null>(null);
  const [msg, setMsg] = useState('');

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

  // Auto-abrir solicitud cuando llega desde notificación
  useEffect(() => {
    if (!initialOpenId || verDetalle?.id === initialOpenId || loading || items.length === 0) return;
    const found = items.find((it) => it.id === initialOpenId);
    if (found) setVerDetalle(found);
  }, [initialOpenId, items, loading]);

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
      {msg ? <div className="admin-success">{msg}</div> : null}

      <div className="mis-solicitudes-list">
        {!loading && items.length === 0 ? (
          <p className="admin-help-text">No tienes solicitudes registradas.</p>
        ) : null}
        {items.map((s) => (
          <div key={s.id} className="mis-sol-item card-surface">
            {/* Cabecera: radicado + fecha */}
            <div className="mis-sol-head">
              <div>
                <strong>{s.numeroRadicado}</strong>
                <span className="mis-sol-tipo">{s.areaNombre} · {s.tipoNombre}</span>
              </div>
              <span className="mis-sol-fecha">{formatFecha(s.creadoEn)}</span>
            </div>

            {/* Pie: estado + acciones */}
            <div className="mis-sol-foot">
              <div className="mis-sol-estado-row">
                <span className={`mis-sol-estado mis-sol-${s.estado}`}>
                  {labelEstado(s)}
                </span>
                {s.alertasCount > 0 ? (
                  <span className="mis-sol-alertas">⚠ {s.alertasCount}</span>
                ) : null}
              </div>
              {/* Comentario resumido para devuelto/rechazado */}
              {(s.estado === 'devuelto' || s.estado === 'rechazado') && s.ultimoComentario ? (
                <p className="mis-sol-comentario-dev">"{s.ultimoComentario}"</p>
              ) : null}
              <div className="mis-sol-actions">
                {(s.estado === 'devuelto' || s.estado === 'rechazado') ? (
                  <button
                    type="button"
                    className={s.estado === 'devuelto' ? 'admin-primary-button' : 'admin-ghost-button'}
                    onClick={() => setVerDetalle(s)}
                  >
                    {s.estado === 'devuelto' ? 'Ver motivo / Corregir' : 'Ver motivo'}
                  </button>
                ) : null}
                {(s.estado === 'por_legalizar' || s.estado === 'en_legalizacion') ? (
                  <button
                    type="button"
                    className="admin-primary-button"
                    onClick={() => setLegalizar(s)}
                  >
                    {s.estado === 'en_legalizacion' ? '↻ Re-enviar legalización' : '💸 Legalizar'}
                  </button>
                ) : null}
                {(s.estado === 'aprobado' || s.estado === 'legalizado' || s.estado === 'por_legalizar' || s.estado === 'en_legalizacion') ? (
                  <button
                    type="button"
                    className="admin-ghost-button"
                    onClick={() => descargarPdf(s.id)}
                    disabled={descargando === s.id}
                  >
                    {descargando === s.id ? 'Generando…' : '⬇ PDF'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {legalizar ? (
        <LegalizarModal
          solicitud={legalizar}
          onClose={() => setLegalizar(null)}
          onDone={() => { setLegalizar(null); setMsg('Legalización enviada. El área final la revisará.'); cargar(); }}
        />
      ) : null}

      {verDetalle ? (
        <DetalleDevueltoModal
          solicitud={verDetalle}
          onClose={() => setVerDetalle(null)}
          onRenviada={() => { setVerDetalle(null); setMsg('Solicitud reenviada. Los validadores han sido notificados.'); cargar(); }}
        />
      ) : null}
    </section>
  );
}
