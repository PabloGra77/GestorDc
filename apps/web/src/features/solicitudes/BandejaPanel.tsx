import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { SignaturePad } from '../../components/SignaturePad';
import { etiquetaDocumento } from '../../utils/documentoLabels';
import { generarPdfFormato, generarFormatoBlobUrl } from './generarPdfFormato';

interface Item {
  id: number;
  numeroRadicado: string;
  tipoNombre: string;
  areaNombre: string;
  solicitanteNombre: string | null;
  solicitanteCorreo: string | null;
  estado: string;
  pasoActual: string | null;
  pasoOrden: number;
  creadoEn: string;
  alertasCount: number;
}

interface CampoPlantilla {
  key: string;
  label: string;
  type: string;
  group?: string;
  ocr_target?: string;
  validar_contra?: string;
  comparar_contra?: string;
  columnas?: string[];
  conFactura?: boolean;
}

function parseFilas(v: unknown): Record<string, string>[] {
  if (typeof v !== 'string' || !v.trim()) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; }
}

interface Movimiento {
  id: number;
  accion: string;
  paso: string | null;
  estadoResultado: string | null;
  usuarioNombre: string | null;
  usuarioRol: string | null;
  comentario: string | null;
  visibilidad: string;
  creadoEn: string;
}

interface Detalle {
  id: number;
  numeroRadicado: string;
  tipoNombre: string;
  areaNombre: string;
  solicitanteNombre: string | null;
  solicitanteCorreo: string | null;
  solicitanteDocumento: string | null;
  estado: string;
  pasoActual: string | null;
  pasoOrden: number;
  datosFormulario: Record<string, unknown>;
  documentos: Record<string, unknown>;
  alertas: Array<{ tipo?: string; descripcion?: string; severidad?: string }>;
  camposPlantilla: CampoPlantilla[];
  flujoAprobacion: Array<{ rol: string; label: string; orden: number }>;
  movimientos: Movimiento[];
  creadoEn: string;
  firmas?: Record<string, string> | null;
  plantillaPdf?: { bloques?: unknown[] } | null;
}

interface AreaMini { id: number; nombre: string; activo: boolean }

// --- Formateo legible de valores diligenciados (evita mostrar JSON crudo) ---
function parseMaybeJson(v: unknown): unknown {
  if (v && typeof v === 'object') return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try { return JSON.parse(s); } catch { /* no era JSON */ }
    }
  }
  return v;
}

interface DireccionLike {
  direccion?: string; ciudad?: string; pais?: string; localidad?: string;
  codigoPostal?: string; lat?: number; lon?: number;
  tipoViaje?: string; origen?: DireccionLike;
}

function textoDireccion(o: DireccionLike): string {
  return [o.direccion, o.localidad, o.ciudad, o.pais].filter(Boolean).join(', ')
    + (o.codigoPostal ? ` · CP ${o.codigoPostal}` : '');
}

interface ValorFormateado { texto: string; lat?: number; lon?: number; origen?: { texto: string; lat?: number; lon?: number } }

function formatearValor(c: CampoPlantilla, value: unknown): ValorFormateado {
  if (value == null || value === '') return { texto: '—' };
  if (c.type === 'direccion') {
    const o = parseMaybeJson(value) as DireccionLike;
    if (o && typeof o === 'object') {
      const res: ValorFormateado = { texto: textoDireccion(o) || '—', lat: o.lat, lon: o.lon };
      if (o.origen && (o.tipoViaje === 'solo_ida' || o.tipoViaje === 'ida_y_vuelta')) {
        res.origen = { texto: textoDireccion(o.origen), lat: o.origen.lat, lon: o.origen.lon };
      }
      return res;
    }
  }
  if (c.type === 'valor-pesos') {
    const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
    if (!Number.isNaN(n) && n > 0) {
      return { texto: n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) };
    }
  }
  const parsed = parseMaybeJson(value);
  if (parsed && typeof parsed === 'object') {
    // Objeto genérico: mostrar "clave: valor" legible en vez de JSON crudo
    const pares = Object.entries(parsed as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== '' && typeof v !== 'object')
      .map(([k, v]) => `${k}: ${String(v)}`);
    return { texto: pares.length ? pares.join(' · ') : '—' };
  }
  return { texto: String(value) };
}

interface DocFormateado { texto: string; url?: string; confianza?: number; archivoId?: string }
function formatearDocumento(v: unknown): DocFormateado | null {
  const o = parseMaybeJson(v);
  if (o == null || o === '') return null;
  if (typeof o === 'string') return { texto: o, url: o.startsWith('http') || o.startsWith('data:') ? o : undefined };
  if (typeof o === 'object') {
    const r = o as Record<string, unknown>;
    const nombre = (r.nombre || r.filename || r.name || 'archivo adjunto') as string;
    const url = (r.url || r.src || r.dataUrl) as string | undefined;
    const confianza = typeof r.ocrConfianza === 'number' ? r.ocrConfianza : undefined;
    const archivoId = typeof r.archivoId === 'string' ? r.archivoId : undefined;
    return { texto: nombre, url, confianza, archivoId };
  }
  return { texto: String(v) };
}

export function BandejaPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [motivoSel, setMotivoSel] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [comentario, setComentario] = useState('');
  const [firmaValidador, setFirmaValidador] = useState('');
  const [accionando, setAccionando] = useState<string | null>(null);
  const [areas, setAreas] = useState<AreaMini[]>([]);
  const [areaRemitir, setAreaRemitir] = useState<number | ''>('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // Genera el formato diligenciado (PDF) para verlo embebido cuando se abre un detalle
  useEffect(() => {
    let cancel = false;
    setPdfUrl(null);
    if (!detalle || !detalle.plantillaPdf?.bloques?.length) return;
    setGenerandoPdf(true);
    generarFormatoBlobUrl(detalle as unknown as Parameters<typeof generarFormatoBlobUrl>[0])
      .then((url) => { if (!cancel) setPdfUrl(url); })
      .catch(() => { if (!cancel) setPdfUrl(null); })
      .finally(() => { if (!cancel) setGenerandoPdf(false); });
    return () => { cancel = true; };
  }, [detalle]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await api.get<Item[]>('/solicitudes/bandeja');
      setItems(r.data);
    } catch {
      setErr('No se pudo cargar la bandeja.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    api.get<AreaMini[]>('/areas').then((r) => setAreas(r.data.filter((a) => a.activo))).catch(() => setAreas([]));
  }, []);

  async function abrir(id: number) {
    if (openId === id) {
      setOpenId(null);
      setDetalle(null);
      return;
    }
    setOpenId(id);
    setDetalle(null);
    setLoadingDetalle(true);
    setComentario('');
    setMotivoSel('');
    setMsg('');
    setErr('');
    try {
      const r = await api.get<Detalle>(`/solicitudes/${id}`);
      setDetalle(r.data);
    } catch {
      setErr('No se pudo cargar el detalle.');
    } finally {
      setLoadingDetalle(false);
    }
  }

  async function abrirArchivo(archivoId: string) {
    try {
      const r = await api.get(`/archivos/ver?id=${encodeURIComponent(archivoId)}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data as Blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setErr('No se pudo abrir el adjunto.');
    }
  }

  // El comentario final combina el motivo del menú + el detalle escrito
  const comentarioFinal = [motivoSel, comentario.trim()].filter(Boolean).join(' — ');

  async function ejecutar(accion: 'validar' | 'devolver' | 'rechazar' | 'remitir', id: number) {
    if ((accion === 'devolver' || accion === 'rechazar') && comentarioFinal === '') {
      setErr('Selecciona un motivo o escríbelo para devolver o rechazar.');
      return;
    }
    if (accion === 'validar' && !firmaValidador) {
      setErr('Debes firmar antes de validar la solicitud.');
      return;
    }
    if (accion === 'remitir' && !areaRemitir) {
      setErr('Selecciona el área destino para remitir.');
      return;
    }
    setAccionando(accion);
    setErr('');
    setMsg('');
    try {
      const body: Record<string, unknown> = { comentario: comentarioFinal };
      if (accion === 'validar') body.firma = firmaValidador;
      if (accion === 'remitir') body.areaIdDestino = Number(areaRemitir);
      await api.post(`/solicitudes/${id}/${accion}`, body);
      const labelOk: Record<string, string> = {
        validar: 'validada', devolver: 'devuelta', rechazar: 'rechazada', remitir: 'remitida',
      };
      setMsg(`Solicitud ${labelOk[accion]} correctamente.`);
      setOpenId(null);
      setDetalle(null);
      setComentario('');
      setFirmaValidador('');
      setAreaRemitir('');
      cargar();
    } catch (e) {
      const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(r || 'No se pudo ejecutar la accion.');
    } finally {
      setAccionando(null);
    }
  }

  return (
    <section className="bandeja-panel">
      <header className="admin-panel-head">
        <div>
          <h3>Bandeja de validación</h3>
          <p className="admin-help-text">
            {loading ? 'Cargando…' : `${items.length} solicitud(es) pendiente(s) de tu validación.`}
          </p>
        </div>
        <button type="button" className="admin-refresh-button" onClick={cargar}>
          Refrescar
        </button>
      </header>

      {err ? <div className="admin-error">{err}</div> : null}
      {msg ? <div className="admin-success">{msg}</div> : null}

      <div className="bandeja-list">
        {!loading && items.length === 0 ? (
          <p className="admin-help-text">No tienes solicitudes pendientes en este momento.</p>
        ) : null}

        {items.map((it) => (
          <div key={it.id} className="bandeja-item card-surface">
            <div className="bandeja-item-head" onClick={() => abrir(it.id)} role="button" tabIndex={0}>
              <div>
                <strong>{it.numeroRadicado}</strong>
                <p className="admin-help-text">{it.areaNombre} · {it.tipoNombre}</p>
                <p className="admin-help-text">Solicitante: {it.solicitanteNombre || it.solicitanteCorreo || '—'}</p>
              </div>
              <div className="bandeja-item-meta">
                <span className="mis-sol-estado mis-sol-en_validacion">{it.pasoActual}</span>
                {it.alertasCount > 0 ? (
                  <span className="mis-sol-alertas">⚠ {it.alertasCount}</span>
                ) : null}
                <span className="admin-help-text">{openId === it.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {openId === it.id ? (
              <div className="bandeja-item-body">
                {loadingDetalle ? <p className="admin-help-text">Cargando detalle…</p> : null}
                {detalle ? (
                  <>
                    {detalle.alertas.length > 0 ? (
                      <div className="bandeja-alertas">
                        <strong>⚠ {detalle.alertas.length} alerta(s)</strong>
                        <ul>
                          {detalle.alertas.map((a, i) => (
                            <li key={i}>{a.descripcion || a.tipo}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="bandeja-formato-head">
                      <h4>Formato diligenciado</h4>
                      <button
                        type="button"
                        className="admin-ghost-button"
                        onClick={() => generarPdfFormato(detalle as unknown as Parameters<typeof generarPdfFormato>[0])}
                      >
                        📥 Descargar PDF
                      </button>
                    </div>
                    {detalle.plantillaPdf?.bloques?.length ? (
                      generandoPdf ? (
                        <p className="admin-help-text">Generando el PDF del formato…</p>
                      ) : pdfUrl ? (
                        <iframe className="bandeja-pdf-preview" src={pdfUrl} title="Formato diligenciado" />
                      ) : (
                        <p className="admin-help-text">No se pudo generar la vista del PDF. Usa “Descargar PDF”.</p>
                      )
                    ) : (
                      <p className="admin-help-text">
                        Este tipo de solicitud no tiene plantilla PDF personalizada. Con “Descargar PDF” obtienes el formato estándar con los datos.
                      </p>
                    )}

                    <h4>Datos diligenciados</h4>
                    <div className="bandeja-datos">
                      {detalle.camposPlantilla
                        .filter((c) => c.type !== 'file')
                        .map((c) => {
                          if (c.type === 'tabla-items') {
                            const cols = c.columnas && c.columnas.length ? c.columnas : ['Ítem', 'Valor'];
                            const filas = parseFilas(detalle.datosFormulario[c.key]);
                            const hayFactura = filas.some((r) => '_factura' in r) || c.conFactura;
                            const faltan = hayFactura ? filas.filter((r) => cols.some((col) => (r[col] || '').trim() !== '') && !r._factura).length : 0;
                            return (
                              <div key={c.key} className="bandeja-dato bandeja-dato-tabla">
                                <span className="admin-help-text">{c.label}</span>
                                {filas.length === 0 ? (
                                  <strong>—</strong>
                                ) : (
                                  <>
                                    <table className="bandeja-items-table">
                                      <thead><tr>{cols.map((col) => <th key={col}>{col}</th>)}{hayFactura ? <th>Factura (IA)</th> : null}</tr></thead>
                                      <tbody>
                                        {filas.map((r, i) => {
                                          let alertas: string[] = [];
                                          if (r._facturaAlertas) { try { alertas = JSON.parse(r._facturaAlertas); } catch { alertas = []; } }
                                          return (
                                            <tr key={i}>
                                              {cols.map((col) => <td key={col}>{r[col] || ''}</td>)}
                                              {hayFactura ? (
                                                <td>
                                                  {r._factura
                                                    ? <span title={alertas.join(' · ')}>{alertas.length ? '⚠' : '✓'} {r._factura}</span>
                                                    : <span className="factura-falta">⚠ falta</span>}
                                                </td>
                                              ) : null}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                    {faltan > 0 ? <span className="factura-resumen warn">⚠ Faltan {faltan} factura(s) en esta solicitud.</span> : null}
                                  </>
                                )}
                              </div>
                            );
                          }
                          const f = formatearValor(c, detalle.datosFormulario[c.key]);
                          return (
                            <div key={c.key} className="bandeja-dato">
                              <span className="admin-help-text">{c.label}</span>
                              {f.origen ? (
                                <>
                                  <strong>
                                    De: {f.origen.texto}
                                    {f.origen.lat != null && f.origen.lon != null ? (
                                      <a className="bandeja-mapa-link" href={`https://www.openstreetmap.org/?mlat=${f.origen.lat}&mlon=${f.origen.lon}&zoom=16`} target="_blank" rel="noopener noreferrer"> 🗺️</a>
                                    ) : null}
                                  </strong>
                                  <strong>
                                    A: {f.texto}
                                    {f.lat != null && f.lon != null ? (
                                      <a className="bandeja-mapa-link" href={`https://www.openstreetmap.org/?mlat=${f.lat}&mlon=${f.lon}&zoom=16`} target="_blank" rel="noopener noreferrer"> 🗺️</a>
                                    ) : null}
                                  </strong>
                                </>
                              ) : (
                                <strong>
                                  {f.texto}
                                  {f.lat != null && f.lon != null ? (
                                    <a className="bandeja-mapa-link" href={`https://www.openstreetmap.org/?mlat=${f.lat}&mlon=${f.lon}&zoom=16`} target="_blank" rel="noopener noreferrer"> 🗺️ ver en mapa</a>
                                  ) : null}
                                </strong>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    <h4>Documentos adjuntos</h4>
                    <ul className="bandeja-docs">
                      {detalle.camposPlantilla.filter((c) => c.type === 'file').length === 0 ? (
                        <li><em className="admin-help-text">Este tipo de solicitud no pide documentos adjuntos.</em></li>
                      ) : null}
                      {detalle.camposPlantilla
                        .filter((c) => c.type === 'file')
                        .map((c) => {
                          const doc = formatearDocumento(detalle.documentos[c.key]);
                          // Comparación: dato que la IA debe verificar dentro del adjunto
                          const campoDato = c.validar_contra
                            ? detalle.camposPlantilla.find((d) => d.key === c.validar_contra)
                            : undefined;
                          const valorEsperado = campoDato
                            ? formatearValor(campoDato, detalle.datosFormulario[campoDato.key]).texto
                            : null;
                          return (
                            <li key={c.key}>
                              <strong>{c.label}:</strong>{' '}
                              {doc ? (
                                doc.archivoId ? (
                                  <button type="button" className="bandeja-abrir-adjunto" onClick={() => abrirArchivo(doc.archivoId!)}>📎 {doc.texto} · Abrir</button>
                                ) : doc.url ? (
                                  <a href={doc.url} target="_blank" rel="noopener noreferrer">📎 {doc.texto}</a>
                                ) : (
                                  <span title="Adjunto sin archivo (solicitud antigua)">📎 {doc.texto} <em className="admin-help-text">(sin archivo)</em></span>
                                )
                              ) : (
                                <em className="admin-help-text">no adjuntado</em>
                              )}
                              {doc?.confianza != null ? (
                                <span className="admin-help-text"> · IA: {Math.round(doc.confianza)}% de coincidencia</span>
                              ) : null}
                              {c.ocr_target ? <span className="admin-help-text"> · esperado: {etiquetaDocumento(c.ocr_target)}</span> : null}
                              {campoDato && valorEsperado && valorEsperado !== '—' ? (
                                <div className="bandeja-comparacion">
                                  🔎 La IA debe verificar que <strong>{campoDato.label}</strong> (“{valorEsperado}”) aparezca en este adjunto.
                                </div>
                              ) : null}
                              {detalle.camposPlantilla
                                .filter((d) => d.comparar_contra === c.key)
                                .map((d) => {
                                  const val = formatearValor(d, detalle.datosFormulario[d.key]).texto;
                                  if (!val || val === '—') return null;
                                  return (
                                    <div key={d.key} className="bandeja-comparacion">
                                      🔎 Debe coincidir con <strong>{d.label}</strong>: “{val}”.
                                    </div>
                                  );
                                })}
                            </li>
                          );
                        })}
                    </ul>

                    <h4>Trazabilidad</h4>
                    <ul className="bandeja-trazado">
                      {detalle.movimientos.map((m) => (
                        <li key={m.id}>
                          <span className="bandeja-mov-accion">{m.accion}</span>
                          {m.usuarioNombre ? <span> · {m.usuarioNombre}</span> : null}
                          {m.paso ? <span> · paso: {m.paso}</span> : null}
                          {m.comentario ? <p className="admin-help-text">"{m.comentario}"</p> : null}
                          <span className="admin-help-text">{m.creadoEn}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="bandeja-actions">
                      <label className="admin-help-text" htmlFor={`motivo-${it.id}`}>Motivo (para devolver o rechazar)</label>
                      <select
                        id={`motivo-${it.id}`}
                        value={motivoSel}
                        onChange={(e) => setMotivoSel(e.target.value)}
                      >
                        <option value="">— Selecciona un motivo —</option>
                        <option value="Adjunto faltante">Adjunto faltante</option>
                        <option value="Adjunto ilegible o de baja calidad">Adjunto ilegible o de baja calidad</option>
                        <option value="Adjunto no corresponde">Adjunto no corresponde al documento pedido</option>
                        <option value="Valor no coincide con el soporte">Valor no coincide con el soporte</option>
                        <option value="Datos del formulario incorrectos">Datos del formulario incorrectos</option>
                        <option value="Falta firma">Falta firma</option>
                        <option value="Documento vencido">Documento vencido</option>
                        <option value="Otro">Otro (especificar abajo)</option>
                      </select>
                      <textarea
                        placeholder="Detalle del motivo (opcional si ya elegiste uno arriba)"
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        rows={3}
                      />
                      <SignaturePad
                        value={firmaValidador}
                        onChange={setFirmaValidador}
                        label="Firma del validador (obligatoria para validar)"
                      />
                      <div className="bandeja-actions-row">
                        <button
                          type="button"
                          className="admin-primary-button"
                          disabled={accionando !== null}
                          onClick={() => ejecutar('validar', it.id)}
                        >
                          ✓ Validar y avanzar
                        </button>
                        <button
                          type="button"
                          className="admin-ghost-button"
                          disabled={accionando !== null}
                          onClick={() => ejecutar('devolver', it.id)}
                        >
                          ↩ Devolver al solicitante
                        </button>
                        <button
                          type="button"
                          className="admin-ghost-button bandeja-rechazar"
                          disabled={accionando !== null}
                          onClick={() => ejecutar('rechazar', it.id)}
                        >
                          ✗ Rechazar
                        </button>
                      </div>
                      <div className="bandeja-remitir-row">
                        <label htmlFor={`remitir-${it.id}`}>Remitir a otra área:</label>
                        <select
                          id={`remitir-${it.id}`}
                          value={areaRemitir}
                          onChange={(e) => setAreaRemitir(e.target.value === '' ? '' : Number(e.target.value))}
                        >
                          <option value="">— selecciona área destino —</option>
                          {areas.filter((a) => a.id !== (detalle ? (detalle as unknown as { areaId?: number }).areaId : 0)).map((a) => (
                            <option key={a.id} value={a.id}>{a.nombre}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="admin-ghost-button"
                          disabled={accionando !== null || !areaRemitir}
                          onClick={() => ejecutar('remitir', it.id)}
                        >
                          → Remitir
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
