import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { generarPdfFormato } from './generarPdfFormato';
import { useOcrDocument } from '../../hooks/useOcrDocument';

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
    setEnviando(true); setErr('');
    try {
      const documentos: Record<string, unknown> = {};
      for (const [k, e] of listas) {
        documentos[k] = { nombre: e.nombre, archivoId: e.archivoId, ocrTexto: e.ocrTexto, ocrConfianza: e.ocrConfianza, ocrAlertas: e.ocrAlertas };
      }
      await api.post(`/solicitudes/${solicitud.id}/legalizar`, { documentos });
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

export function MisSolicitudesPanel({ refresco }: { refresco?: number }) {
  const [items, setItems] = useState<SolicitudResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [descargando, setDescargando] = useState<number | null>(null);
  const [legalizar, setLegalizar] = useState<SolicitudResumen | null>(null);
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
              {(s.estado === 'por_legalizar' || s.estado === 'en_legalizacion') ? (
                <button
                  type="button"
                  className="admin-primary-button"
                  onClick={() => setLegalizar(s)}
                  style={{ fontSize: 11, padding: '6px 12px' }}
                >
                  {s.estado === 'en_legalizacion' ? '↻ Re-enviar legalización' : '💸 Legalizar (subir facturas)'}
                </button>
              ) : null}
              {(s.estado === 'aprobado' || s.estado === 'legalizado' || s.estado === 'por_legalizar' || s.estado === 'en_legalizacion') ? (
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

      {legalizar ? (
        <LegalizarModal
          solicitud={legalizar}
          onClose={() => setLegalizar(null)}
          onDone={() => { setLegalizar(null); setMsg('Legalización enviada. El área final la revisará.'); cargar(); }}
        />
      ) : null}
    </section>
  );
}
