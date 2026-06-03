import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { SignaturePad } from '../../components/SignaturePad';
import { etiquetaDocumento } from '../../utils/documentoLabels';

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
}

interface AreaMini { id: number; nombre: string; activo: boolean }

export function BandejaPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [comentario, setComentario] = useState('');
  const [firmaValidador, setFirmaValidador] = useState('');
  const [accionando, setAccionando] = useState<string | null>(null);
  const [areas, setAreas] = useState<AreaMini[]>([]);
  const [areaRemitir, setAreaRemitir] = useState<number | ''>('');

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

  async function ejecutar(accion: 'validar' | 'devolver' | 'rechazar' | 'remitir', id: number) {
    if ((accion === 'devolver' || accion === 'rechazar') && comentario.trim() === '') {
      setErr('El motivo es obligatorio para devolver o rechazar.');
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
      const body: Record<string, unknown> = { comentario: comentario.trim() };
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

                    <h4>Datos diligenciados</h4>
                    <div className="bandeja-datos">
                      {detalle.camposPlantilla
                        .filter((c) => c.type !== 'file')
                        .map((c) => (
                          <div key={c.key} className="bandeja-dato">
                            <span className="admin-help-text">{c.label}</span>
                            <strong>{String(detalle.datosFormulario[c.key] ?? '—')}</strong>
                          </div>
                        ))}
                    </div>

                    <h4>Documentos adjuntos</h4>
                    <ul className="bandeja-docs">
                      {detalle.camposPlantilla
                        .filter((c) => c.type === 'file')
                        .map((c) => (
                          <li key={c.key}>
                            <strong>{c.label}:</strong>{' '}
                            {detalle.documentos[c.key] ? String(detalle.documentos[c.key]) : <em>no adjuntado</em>}
                            {c.ocr_target ? <span className="admin-help-text"> · esperado: {etiquetaDocumento(c.ocr_target)}</span> : null}
                          </li>
                        ))}
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
                      <textarea
                        placeholder="Motivo o comentario (obligatorio para devolver/rechazar)"
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
