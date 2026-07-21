import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { SignaturePad } from '../../components/SignaturePad';
import { getAuthSession } from '../auth/auth.service';
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

interface DesgloseServicio {
  servicio: string;
  tipoServicio: 'sm' | 'pad';
  sesiones: number;
  tarifa: number;
  subtotal: number;
}

interface ComparacionOps {
  atencionesDeclaradas: number;
  valorDeclarado: number;
  ccProfesional: string;
  sinInforme: boolean;
  informeId: number | null;
  informeNombre: string | null;
  periodoInforme: string | null;
  atencionesEnInforme: number | null;
  valorCalculado: number | null;
  desglose: DesgloseServicio[];
}

interface Detalle {
  id: number;
  numeroRadicado: string;
  tipoNombre: string;
  tipoSlug: string;
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
  comparacionOps?: ComparacionOps | null;
}

interface AreaMini { id: number; nombre: string; activo: boolean }

const ESTADO_LABEL: Record<string, string> = {
  en_validacion: 'En validación',
  por_legalizar: 'Por legalizar',
  en_legalizacion: 'Legalización por revisar',
  aprobado: 'Aprobado',
  legalizado: 'Legalizado',
  rechazado: 'Rechazado',
  devuelto: 'Devuelto',
};

const PASO_LABEL: Record<string, string> = {
  analista: 'Analista',
  coordinador: 'Coordinador',
  director: 'Director',
  contabilidad: 'Área final (Contabilidad)',
  autorizador_visto_bueno: 'Visto bueno del autorizador',
};

function labelPaso(paso: string | null): string {
  if (!paso) return '';
  return PASO_LABEL[paso] || paso;
}

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
    if (!detalle) return;
    const esLeg = typeof detalle.datosFormulario['gastos'] === 'string';
    if (!esLeg && !detalle.plantillaPdf?.bloques?.length) return;
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

  const isAdmin = (getAuthSession()?.usuario?.rol?.nombre || '').toLowerCase() === 'administrador';

  async function eliminarSolicitud(it: Item) {
    if (!window.confirm(`¿Eliminar definitivamente la solicitud ${it.numeroRadicado}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/solicitudes/${it.id}`);
      setItems((prev) => prev.filter((x) => x.id !== it.id));
      setOpenId(null);
      setDetalle(null);
      setMsg(`Solicitud ${it.numeroRadicado} eliminada.`);
    } catch {
      setErr('No se pudo eliminar la solicitud.');
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

  async function accionLeg(id: number, ruta: string, okMsg: string, confirmTxt?: string) {
    if (confirmTxt && !window.confirm(confirmTxt)) return;
    setAccionando(ruta);
    setErr('');
    setMsg('');
    try {
      await api.post(`/solicitudes/${id}/${ruta}`, {});
      setMsg(okMsg);
      setOpenId(null);
      setDetalle(null);
      cargar();
    } catch (e) {
      const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(r || 'No se pudo ejecutar la acción.');
    } finally {
      setAccionando(null);
    }
  }

  async function darVistoBueno(id: number) {
    setAccionando('visto_bueno');
    setErr('');
    setMsg('');
    try {
      await api.post(`/solicitudes/${id}/autorizar-legalizacion`, { comentario: comentario.trim() || 'Visto bueno otorgado' });
      setMsg('Visto bueno otorgado. La solicitud avanzó al siguiente paso.');
      setOpenId(null);
      setDetalle(null);
      setComentario('');
      cargar();
    } catch (e) {
      const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(r || 'No se pudo dar el visto bueno.');
    } finally {
      setAccionando(null);
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
                <span className={`mis-sol-estado mis-sol-${it.estado}`}>
                  {it.estado === 'en_validacion' ? `Validando por ${labelPaso(it.pasoActual)}` : (ESTADO_LABEL[it.estado] || it.estado)}
                </span>
                {it.alertasCount > 0 ? (
                  <span className="mis-sol-alertas">⚠ {it.alertasCount}</span>
                ) : null}
                {(it.estado === 'por_legalizar' || it.estado === 'en_legalizacion') ? (
                  <span className="bandeja-leg-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="admin-ghost-button"
                      disabled={accionando !== null}
                      onClick={() => accionLeg(it.id, 'recordar-legalizar', `Recordatorio enviado para ${it.numeroRadicado}.`)}
                    >
                      🔔 Recordar legalizar
                    </button>
                    {it.estado === 'en_legalizacion' ? (
                      <button
                        type="button"
                        className="admin-primary-button"
                        disabled={accionando !== null}
                        onClick={() => accionLeg(it.id, 'legalizacion/confirmar', `Anticipo ${it.numeroRadicado} legalizado.`, `¿Confirmar que ${it.numeroRadicado} quedó legalizado (facturas correctas)?`)}
                      >
                        ✓ Confirmar legalización
                      </button>
                    ) : null}
                  </span>
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

                    {(() => {
                      const leg = (detalle.documentos as Record<string, unknown>)?.['__legalizacion'] as Record<string, unknown> | undefined;
                      const resumen = leg?.['_resumen'] as { valorSolicitado?: number; montoLegalizado?: number; saldoPendiente?: number } | undefined;
                      if (!resumen) return null;
                      const fmt = (n?: number) => `$ ${Number(n || 0).toLocaleString('es-CO')}`;
                      const saldo = resumen.saldoPendiente ?? 0;
                      return (
                        <div className="bandeja-alertas" style={{ background: saldo > 0 ? '#FEF3C7' : undefined }}>
                          <strong>Comparación de montos</strong>
                          <ul>
                            <li>Monto del anticipo: {fmt(resumen.valorSolicitado)}</li>
                            <li>Monto legalizado (factura): {fmt(resumen.montoLegalizado)}</li>
                            <li>
                              {saldo > 0
                                ? <>Saldo a devolver por el solicitante: <strong>{fmt(saldo)}</strong></>
                                : saldo < 0
                                  ? <>El gasto superó el anticipo por {fmt(Math.abs(saldo))} (revisar manualmente).</>
                                  : 'Legalización completa, sin saldo pendiente.'}
                            </li>
                          </ul>
                        </div>
                      );
                    })()}

                    {/* ── Bloque comparación OPS ── */}
                    {detalle.comparacionOps ? (() => {
                      const cmp          = detalle.comparacionOps!;
                      const declaradas   = cmp.atencionesDeclaradas;
                      const enInforme    = cmp.atencionesEnInforme;
                      const diff         = enInforme != null ? enInforme - declaradas : null;
                      const hayDiff      = diff !== null && diff !== 0;
                      const fmtCOP       = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
                      const valDec       = cmp.valorDeclarado ?? 0;
                      const valCalc      = cmp.valorCalculado ?? null;
                      const diffVal      = valCalc != null ? valCalc - valDec : null;
                      const hayDiffVal   = diffVal !== null && Math.abs(diffVal) > 1;
                      const hayTarifas   = (cmp.desglose ?? []).some((d) => d.tarifa > 0);
                      return (
                        <div className="bandeja-leg-gastos">
                          <h4>Validación de atenciones OPS</h4>

                          {/* Resumen de atenciones */}
                          <div className="bandeja-alertas" style={{ background: hayDiff ? '#FEF3C7' : undefined, marginBottom: 10 }}>
                            <ul>
                              <li>CC profesional: <strong>{cmp.ccProfesional || '—'}</strong></li>
                              <li>Atenciones/sesiones declaradas: <strong>{declaradas}</strong></li>
                              {cmp.sinInforme ? (
                                <li style={{ color: 'var(--text-secondary)' }}>
                                  Sin informe de atenciones cargado — sube un informe en <em>Administrador → Informes OPS</em>.
                                </li>
                              ) : (
                                <>
                                  <li>
                                    En informe <em>{cmp.informeNombre}{cmp.periodoInforme ? ` (${cmp.periodoInforme})` : ''}</em>:{' '}
                                    <strong>{enInforme}</strong>
                                  </li>
                                  {diff !== null && (
                                    <li>
                                      {diff === 0
                                        ? 'Las cantidades coinciden.'
                                        : diff > 0
                                          ? <>El informe tiene <strong>{diff} más</strong> de las declaradas.</>
                                          : <>El informe tiene <strong>{Math.abs(diff)} menos</strong> de las declaradas.</>}
                                    </li>
                                  )}
                                  {valCalc != null && hayTarifas && (
                                    <li style={{ marginTop: 4 }}>
                                      Valor declarado: <strong>{fmtCOP(valDec)}</strong>
                                      {' · '}
                                      Valor calculado por tarifas: <strong>{fmtCOP(valCalc)}</strong>
                                      {hayDiffVal && (
                                        <> — <span style={{ color: diffVal! > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                          diferencia {fmtCOP(Math.abs(diffVal!))}
                                          {diffVal! > 0 ? ' a favor del profesional' : ' por debajo de lo calculado'}
                                        </span></>
                                      )}
                                    </li>
                                  )}
                                </>
                              )}
                            </ul>
                          </div>

                          {/* Desglose por servicio */}
                          {!cmp.sinInforme && (cmp.desglose ?? []).length > 0 && (
                            <table className="bandeja-items-table bandeja-leg-table">
                              <thead>
                                <tr>
                                  <th style={{ textAlign: 'left' }}>Servicio</th>
                                  <th>Tipo</th>
                                  <th>Atenciones/sesiones</th>
                                  {hayTarifas && <><th>Tarifa</th><th>Subtotal</th></>}
                                </tr>
                              </thead>
                              <tbody>
                                {(cmp.desglose ?? []).map((d, i) => (
                                  <tr key={i}>
                                    <td>{d.servicio}</td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span className="leg-ocr-badge">
                                        {d.tipoServicio === 'pad' ? 'PAD' : 'SM'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{d.sesiones}</td>
                                    {hayTarifas && (
                                      <>
                                        <td style={{ textAlign: 'right' }}>
                                          {d.tarifa > 0 ? fmtCOP(d.tarifa) : <span style={{ color: 'var(--text-secondary)' }}>sin tarifa</span>}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                          {d.tarifa > 0 ? fmtCOP(d.subtotal) : '—'}
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                              {hayTarifas && valCalc != null && (
                                <tfoot>
                                  <tr>
                                    <td colSpan={3}><strong>Total calculado</strong></td>
                                    <td colSpan={2} style={{ textAlign: 'right' }}><strong>{fmtCOP(valCalc)}</strong></td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          )}
                        </div>
                      );
                    })() : null}

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
                    {(detalle.plantillaPdf?.bloques?.length
                      || typeof detalle.datosFormulario['gastos'] === 'string'
                      || typeof detalle.datosFormulario['tiqueteIda'] === 'string'
                      || typeof detalle.datosFormulario['items'] === 'string') ? (
                      generandoPdf ? (
                        <p className="admin-help-text">Generando el PDF del formato…</p>
                      ) : pdfUrl ? (
                        <iframe className="bandeja-pdf-preview" src={pdfUrl} title="Formato diligenciado" />
                      ) : (
                        <p className="admin-help-text">No se pudo generar la vista del PDF. Usa "Descargar PDF".</p>
                      )
                    ) : (
                      <p className="admin-help-text">
                        Este tipo de solicitud no tiene plantilla PDF personalizada. Con "Descargar PDF" obtienes el formato estándar con los datos.
                      </p>
                    )}

                    {/* Bloque especial: gastos de legalización */}
                    {(() => {
                      const raw = detalle.datosFormulario['gastos'];
                      if (!raw) return null;
                      let gastos: Record<string, string>[] = [];
                      try { const p = JSON.parse(String(raw)); if (Array.isArray(p)) gastos = p; } catch { return null; }
                      if (!gastos.length) return null;
                      const fmt = (v: string) => {
                        const n = Number(String(v).replace(/[^0-9]/g, ''));
                        return n ? `$ ${n.toLocaleString('es-CO')}` : v || '—';
                      };
                      const totalStr = String(detalle.datosFormulario['totalGastos'] || '');
                      const total = Number(totalStr.replace(/[^0-9]/g, ''));
                      return (
                        <div className="bandeja-leg-gastos">
                          <h4>Gastos legalizados</h4>
                          {String(detalle.datosFormulario['concepto'] || '') && (
                            <p className="bandeja-leg-concepto"><strong>Concepto:</strong> {String(detalle.datosFormulario['concepto'])}</p>
                          )}
                          {String(detalle.datosFormulario['fechaPeriodo'] || '') && (
                            <p className="bandeja-leg-concepto"><strong>Período:</strong> {String(detalle.datosFormulario['fechaPeriodo'])}</p>
                          )}
                          <table className="bandeja-items-table bandeja-leg-table">
                            <thead>
                              <tr>
                                <th>#</th><th>Categoría</th><th>Descripción</th><th>Fecha</th><th>Valor</th><th>Proveedor</th><th>Factura</th>
                              </tr>
                            </thead>
                            <tbody>
                              {gastos.map((g, i) => (
                                <tr key={i}>
                                  <td>{i + 1}</td>
                                  <td>{g.categoria || '—'}</td>
                                  <td>{g.descripcion || '—'}</td>
                                  <td>{g.fechaGasto || '—'}</td>
                                  <td>{fmt(g.valor)}</td>
                                  <td>
                                    {g.nombreProveedor || '—'}
                                    {g.nitProveedor ? <span className="leg-ocr-badge" style={{ marginLeft: 6 }}>NIT: {g.nitProveedor}</span> : null}
                                  </td>
                                  <td>
                                    {g._facturaArchivoId ? (
                                      <button type="button" className="bandeja-abrir-adjunto" onClick={() => abrirArchivo(g._facturaArchivoId)}>
                                        📎 {g._factura || 'Ver factura'}
                                      </button>
                                    ) : g._factura ? (
                                      <span>📎 {g._factura}</span>
                                    ) : (
                                      <span className="factura-falta">⚠ sin factura</span>
                                    )}
                                    {g.numeroFactura ? <span className="leg-ocr-badge" style={{ marginLeft: 4 }}>N° {g.numeroFactura}</span> : null}
                                    {(g._facturaAlertas && g._facturaAlertas !== '[]') ? (() => {
                                      try {
                                        const al = JSON.parse(g._facturaAlertas) as string[];
                                        if (!al.length) return null;
                                        return (
                                          <ul className="bandeja-factura-alertas">
                                            {al.map((a, ai) => <li key={ai}>⚠ {a}</li>)}
                                          </ul>
                                        );
                                      } catch { return <span className="bandeja-factura-alerta-item">⚠ {g._facturaAlertas}</span>; }
                                    })() : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            {total > 0 && (
                              <tfoot>
                                <tr>
                                  <td colSpan={4}><strong>Total</strong></td>
                                  <td colSpan={3}><strong>{fmt(totalStr)}</strong></td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                          {String(detalle.datosFormulario['banco'] || '') && (
                            <p className="bandeja-leg-concepto" style={{ marginTop: 8 }}>
                              <strong>Cuenta:</strong> {String(detalle.datosFormulario['banco'])} {String(detalle.datosFormulario['tipoCuenta'] || '')} — {String(detalle.datosFormulario['numeroCuenta'] || '')} ({String(detalle.datosFormulario['titularCuenta'] || '')})
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Bloque viáticos ── */}
                    {(() => {
                      const rawIda = detalle.datosFormulario['tiqueteIda'];
                      if (!rawIda || typeof rawIda !== 'string') return null;
                      let tIda: Record<string, string> | null = null;
                      try { tIda = JSON.parse(rawIda); } catch { return null; }
                      if (!tIda) return null;
                      const rawVuelta = String(detalle.datosFormulario['tiqueteVuelta'] || '');
                      let tVuelta: Record<string, string> | null = null;
                      if (rawVuelta) { try { tVuelta = JSON.parse(rawVuelta); } catch { /* */ } }
                      const fmt = (v: string) => { const n = Number(String(v || '0').replace(/[^0-9]/g, '')); return n ? `$ ${n.toLocaleString('es-CO')}` : '—'; };
                      const ciudadOrigen = String(detalle.datosFormulario['ciudadOrigen'] || '');
                      const ciudadDestino = String(detalle.datosFormulario['ciudadDestino'] || '');
                      const fechaIda = String(detalle.datosFormulario['fechaIda'] || '');
                      const fechaRegreso = String(detalle.datosFormulario['fechaRegreso'] || '');
                      const motivoViaje = String(detalle.datosFormulario['motivoViaje'] || '');
                      const tipoViatico = String(detalle.datosFormulario['tipoViatico'] || '');
                      const autorizadorNombre = String(detalle.datosFormulario['autorizadorNombre'] || '');
                      const tieneHospedaje = String(detalle.datosFormulario['tieneHospedaje'] || '') === 'true';
                      const hotelNombre = String(detalle.datosFormulario['hotelNombre'] || '');
                      const hotelEntrada = String(detalle.datosFormulario['hotelEntrada'] || '');
                      const hotelSalida = String(detalle.datosFormulario['hotelSalida'] || '');
                      const hotelValorNoche = String(detalle.datosFormulario['hotelValorNoche'] || '');
                      const hotelNoches = String(detalle.datosFormulario['hotelNoches'] || '0');
                      const totalHospedaje = String(detalle.datosFormulario['totalHospedaje'] || '');
                      const diasDesayuno = String(detalle.datosFormulario['diasDesayuno'] || '0');
                      const valorDesayuno = String(detalle.datosFormulario['valorDesayuno'] || '0');
                      const diasAlmuerzo = String(detalle.datosFormulario['diasAlmuerzo'] || '0');
                      const valorAlmuerzo = String(detalle.datosFormulario['valorAlmuerzo'] || '0');
                      const diasCena = String(detalle.datosFormulario['diasCena'] || '0');
                      const valorCena = String(detalle.datosFormulario['valorCena'] || '0');
                      const totalComidas = String(detalle.datosFormulario['totalComidas'] || '');
                      const totalTransporte = String(detalle.datosFormulario['totalTransporte'] || '');
                      const totalGeneral = String(detalle.datosFormulario['totalGeneral'] || '');
                      const docTiquete = (detalle.documentos as Record<string, unknown>)?.['tiquete'] as { archivoId?: string; nombre?: string; ocrAlertas?: string[] } | undefined;
                      const docHotel = (detalle.documentos as Record<string, unknown>)?.['hotel'] as { archivoId?: string; nombre?: string; ocrAlertas?: string[] } | undefined;
                      const docComidas = (detalle.documentos as Record<string, unknown>)?.['comidas'] as { archivoId?: string; nombre?: string; ocrAlertas?: string[] } | undefined;
                      return (
                        <div className="bandeja-leg-gastos">
                          <h4>Viáticos solicitados</h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                            {ciudadOrigen && ciudadDestino && <span className="leg-ocr-badge">✈ {ciudadOrigen} → {ciudadDestino}</span>}
                            {fechaIda && <span className="leg-ocr-badge">📅 Ida: {fechaIda}</span>}
                            {fechaRegreso && <span className="leg-ocr-badge">📅 Regreso: {fechaRegreso}</span>}
                            {tipoViatico && <span className="leg-ocr-badge">{tipoViatico === 'anticipo' ? '⏩ Anticipo' : '🔄 Legalización'}</span>}
                            {autorizadorNombre && <span className="leg-ocr-badge">👤 Autoriza: {autorizadorNombre}</span>}
                          </div>
                          {motivoViaje && <p className="bandeja-leg-concepto"><strong>Motivo:</strong> {motivoViaje}</p>}
                          {/* Tiquetes */}
                          <table className="bandeja-items-table bandeja-leg-table">
                            <thead><tr><th>Trayecto</th><th>Tipo</th><th>Empresa</th><th>N° vuelo/tiquete</th><th>Salida</th><th>Llegada</th><th>Valor</th><th>Soporte</th></tr></thead>
                            <tbody>
                              {tIda && (
                                <tr>
                                  <td>Ida</td>
                                  <td>{tIda.tipo === 'aereo' ? '✈ Aéreo' : '🚌 Terrestre'}</td>
                                  <td>{tIda.empresa || '—'}</td>
                                  <td>{tIda.numDoc || '—'}{tIda.codReserva ? <span className="leg-ocr-badge" style={{ marginLeft: 4 }}>Res: {tIda.codReserva}</span> : null}</td>
                                  <td>{tIda.horaSalida || '—'}</td>
                                  <td>{tIda.horaLlegada || '—'}</td>
                                  <td>{fmt(tIda.valor)}</td>
                                  <td rowSpan={tVuelta ? 2 : 1}>
                                    {docTiquete?.archivoId ? (
                                      <button type="button" className="bandeja-abrir-adjunto" onClick={() => abrirArchivo(docTiquete.archivoId!)}>📎 {docTiquete.nombre || 'Ver tiquete'}</button>
                                    ) : <span className="factura-falta">⚠ sin soporte</span>}
                                    {docTiquete?.ocrAlertas && docTiquete.ocrAlertas.length > 0 && (
                                      <ul className="bandeja-factura-alertas">{docTiquete.ocrAlertas.map((a, ai) => <li key={ai}>⚠ {a}</li>)}</ul>
                                    )}
                                  </td>
                                </tr>
                              )}
                              {tVuelta && (
                                <tr>
                                  <td>Vuelta</td>
                                  <td>{tVuelta.tipo === 'aereo' ? '✈ Aéreo' : '🚌 Terrestre'}</td>
                                  <td>{tVuelta.empresa || '—'}</td>
                                  <td>{tVuelta.numDoc || '—'}{tVuelta.codReserva ? <span className="leg-ocr-badge" style={{ marginLeft: 4 }}>Res: {tVuelta.codReserva}</span> : null}</td>
                                  <td>{tVuelta.horaSalida || '—'}</td>
                                  <td>{tVuelta.horaLlegada || '—'}</td>
                                  <td>{fmt(tVuelta.valor)}</td>
                                </tr>
                              )}
                            </tbody>
                            {Number(totalTransporte) > 0 && <tfoot><tr><td colSpan={6}><strong>Total transporte</strong></td><td colSpan={2}><strong>{fmt(totalTransporte)}</strong></td></tr></tfoot>}
                          </table>
                          {/* Hospedaje */}
                          {tieneHospedaje && (
                            <div style={{ marginTop: 12 }}>
                              <h5 style={{ color: 'var(--gold)', marginBottom: 6 }}>Alojamiento</h5>
                              <table className="bandeja-items-table bandeja-leg-table">
                                <thead><tr><th>Hotel</th><th>Entrada</th><th>Salida</th><th>Noches</th><th>Valor/noche</th><th>Total</th><th>Soporte</th></tr></thead>
                                <tbody>
                                  <tr>
                                    <td>{hotelNombre || '—'}</td><td>{hotelEntrada || '—'}</td><td>{hotelSalida || '—'}</td>
                                    <td>{hotelNoches}</td><td>{fmt(hotelValorNoche)}</td><td>{fmt(totalHospedaje)}</td>
                                    <td>
                                      {docHotel?.archivoId ? <button type="button" className="bandeja-abrir-adjunto" onClick={() => abrirArchivo(docHotel.archivoId!)}>📎 {docHotel.nombre || 'Ver factura'}</button> : <span className="factura-falta">⚠ sin soporte</span>}
                                      {docHotel?.ocrAlertas && docHotel.ocrAlertas.length > 0 && <ul className="bandeja-factura-alertas">{docHotel.ocrAlertas.map((a, ai) => <li key={ai}>⚠ {a}</li>)}</ul>}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                          {/* Alimentación */}
                          {(parseInt(diasDesayuno) + parseInt(diasAlmuerzo) + parseInt(diasCena)) > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <h5 style={{ color: 'var(--gold)', marginBottom: 6 }}>Alimentación</h5>
                              <table className="bandeja-items-table bandeja-leg-table">
                                <thead><tr><th>Tipo</th><th>Días</th><th>Valor/día</th><th>Total</th></tr></thead>
                                <tbody>
                                  {parseInt(diasDesayuno) > 0 && <tr><td>Desayuno</td><td>{diasDesayuno}</td><td>{fmt(valorDesayuno)}</td><td>{fmt(String(parseInt(diasDesayuno) * parseInt(valorDesayuno)))}</td></tr>}
                                  {parseInt(diasAlmuerzo) > 0 && <tr><td>Almuerzo</td><td>{diasAlmuerzo}</td><td>{fmt(valorAlmuerzo)}</td><td>{fmt(String(parseInt(diasAlmuerzo) * parseInt(valorAlmuerzo)))}</td></tr>}
                                  {parseInt(diasCena) > 0 && <tr><td>Cena</td><td>{diasCena}</td><td>{fmt(valorCena)}</td><td>{fmt(String(parseInt(diasCena) * parseInt(valorCena)))}</td></tr>}
                                </tbody>
                                {Number(totalComidas) > 0 && <tfoot><tr><td colSpan={3}><strong>Total alimentación</strong></td><td><strong>{fmt(totalComidas)}</strong></td></tr></tfoot>}
                              </table>
                              {docComidas?.archivoId && <div style={{ marginTop: 4 }}><button type="button" className="bandeja-abrir-adjunto" onClick={() => abrirArchivo(docComidas.archivoId!)}>📎 {docComidas.nombre || 'Ver soporte comidas'}</button>{docComidas?.ocrAlertas && docComidas.ocrAlertas.length > 0 && <ul className="bandeja-factura-alertas">{docComidas.ocrAlertas.map((a, ai) => <li key={ai}>⚠ {a}</li>)}</ul>}</div>}
                            </div>
                          )}
                          {Number(totalGeneral) > 0 && <div style={{ marginTop: 12, textAlign: 'right' }}><strong style={{ fontSize: 15 }}>Total general: {fmt(totalGeneral)}</strong></div>}
                        </div>
                      );
                    })()}

                    {/* ── Bloque anticipo ── */}
                    {(() => {
                      const rawItems = detalle.datosFormulario['items'];
                      if (!rawItems || typeof rawItems !== 'string') return null;
                      let items: Record<string, string>[] = [];
                      try { const p = JSON.parse(rawItems); if (Array.isArray(p)) items = p; } catch { return null; }
                      if (!items.length) return null;
                      const fmt = (v: string) => { const n = Number(String(v || '0').replace(/[^0-9]/g, '')); return n ? `$ ${n.toLocaleString('es-CO')}` : v || '—'; };
                      const totalStr = String(detalle.datosFormulario['valorPesos'] || '');
                      const total = Number(totalStr.replace(/[^0-9]/g, ''));
                      const descripcion = String(detalle.datosFormulario['descripcionGasto'] || '');
                      const destino = String(detalle.datosFormulario['destino'] || '');
                      const fechaEvento = String(detalle.datosFormulario['fechaEvento'] || '');
                      return (
                        <div className="bandeja-leg-gastos">
                          <h4>Anticipo de gastos</h4>
                          {descripcion && <p className="bandeja-leg-concepto"><strong>Propósito:</strong> {descripcion}</p>}
                          {destino && <p className="bandeja-leg-concepto"><strong>Destino/lugar:</strong> {destino}</p>}
                          {fechaEvento && <p className="bandeja-leg-concepto"><strong>Fecha evento:</strong> {fechaEvento}</p>}
                          <table className="bandeja-items-table bandeja-leg-table">
                            <thead><tr><th>#</th><th>Concepto</th><th>Descripción</th><th>Valor</th></tr></thead>
                            <tbody>
                              {items.map((it, i) => (
                                <tr key={i}>
                                  <td>{i + 1}</td>
                                  <td>{it.concepto || '—'}</td>
                                  <td>{it.descripcion || '—'}</td>
                                  <td>{fmt(it.valor)}</td>
                                </tr>
                              ))}
                            </tbody>
                            {total > 0 && <tfoot><tr><td colSpan={3}><strong>Total</strong></td><td><strong>{fmt(totalStr)}</strong></td></tr></tfoot>}
                          </table>
                          {String(detalle.datosFormulario['banco'] || '') && (
                            <p className="bandeja-leg-concepto" style={{ marginTop: 8 }}>
                              <strong>Cuenta:</strong> {String(detalle.datosFormulario['banco'])} {String(detalle.datosFormulario['tipoCuenta'] || '')} — {String(detalle.datosFormulario['numeroCuenta'] || '')}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <h4>Datos diligenciados</h4>
                    <div className="bandeja-datos">
                      {(Array.isArray(detalle.camposPlantilla) ? detalle.camposPlantilla : [])
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
                      {(Array.isArray(detalle.camposPlantilla) ? detalle.camposPlantilla : []).filter((c) => c.type === 'file').length === 0 ? (
                        <li><em className="admin-help-text">Este tipo de solicitud no pide documentos adjuntos.</em></li>
                      ) : null}
                      {(Array.isArray(detalle.camposPlantilla) ? detalle.camposPlantilla : [])
                        .filter((c) => c.type === 'file')
                        .map((c) => {
                          const doc = formatearDocumento(detalle.documentos[c.key]);
                          // Comparación: dato que la IA debe verificar dentro del adjunto
                          const campoDato = c.validar_contra
                            ? (Array.isArray(detalle.camposPlantilla) ? detalle.camposPlantilla : []).find((d) => d.key === c.validar_contra)
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
                                  🔎 La IA debe verificar que <strong>{campoDato.label}</strong> ("{valorEsperado}") aparezca en este adjunto.
                                </div>
                              ) : null}
                              {(Array.isArray(detalle.camposPlantilla) ? detalle.camposPlantilla : [])
                                .filter((d) => d.comparar_contra === c.key)
                                .map((d) => {
                                  const val = formatearValor(d, detalle.datosFormulario[d.key]).texto;
                                  if (!val || val === '—') return null;
                                  return (
                                    <div key={d.key} className="bandeja-comparacion">
                                      🔎 Debe coincidir con <strong>{d.label}</strong>: "{val}".
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

                    {detalle.estado === 'en_validacion' && detalle.pasoActual === 'autorizador_visto_bueno' && (
                      <div className="bandeja-actions">
                        <div className="bandeja-visto-bueno-info">
                          <p>
                            <strong>Se requiere tu visto bueno</strong> — El solicitante indica que tu autorizaste este gasto verbalmente.
                            Al confirmar, la solicitud avanza al siguiente paso del flujo.
                          </p>
                        </div>
                        <textarea
                          placeholder="Observacion (opcional)"
                          value={comentario}
                          onChange={(e) => setComentario(e.target.value)}
                          rows={2}
                        />
                        <div className="bandeja-actions-row">
                          <button
                            type="button"
                            className="admin-primary-button"
                            disabled={accionando !== null}
                            onClick={() => darVistoBueno(it.id)}
                          >
                            Confirmar visto bueno
                          </button>
                          <button
                            type="button"
                            className="admin-ghost-button bandeja-rechazar"
                            disabled={accionando !== null}
                            onClick={() => ejecutar('rechazar', it.id)}
                          >
                            No autorizo este gasto
                          </button>
                        </div>
                      </div>
                    )}
                    {detalle.estado === 'en_validacion' && detalle.pasoActual !== 'autorizador_visto_bueno' && (
                    <div className="bandeja-actions">
                      <label className="admin-help-text" htmlFor={`motivo-${it.id}`}>Motivo (para devolver o rechazar)</label>
                      <select
                        id={`motivo-${it.id}`}
                        value={motivoSel}
                        onChange={(e) => setMotivoSel(e.target.value)}
                      >
                        <option value="">selecciona un motivo</option>
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
                          Validar y avanzar
                        </button>
                        <button
                          type="button"
                          className="admin-ghost-button"
                          disabled={accionando !== null}
                          onClick={() => ejecutar('devolver', it.id)}
                        >
                          Devolver al solicitante
                        </button>
                        <button
                          type="button"
                          className="admin-ghost-button bandeja-rechazar"
                          disabled={accionando !== null}
                          onClick={() => ejecutar('rechazar', it.id)}
                        >
                          Rechazar
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="admin-ghost-button bandeja-rechazar"
                            title="Eliminar definitivamente (solo administradores)"
                            onClick={() => eliminarSolicitud(it)}
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                      <div className="bandeja-remitir-row">
                        <label htmlFor={`remitir-${it.id}`}>Remitir a otra area:</label>
                        <select
                          id={`remitir-${it.id}`}
                          value={areaRemitir}
                          onChange={(e) => setAreaRemitir(e.target.value === '' ? '' : Number(e.target.value))}
                        >
                          <option value="">selecciona area destino</option>
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
                          Remitir
                        </button>
                      </div>
                    </div>
                    )}
                    {detalle.estado !== 'en_validacion' && (
                      <p className="admin-help-text" style={{ marginTop: 10 }}>
                        Este anticipo esta en etapa de legalizacion. Usa Recordar legalizar o Confirmar legalizacion en la parte superior de la tarjeta.
                      </p>
                    )}
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
