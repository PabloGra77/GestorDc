import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../../services/http/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface InformeOps {
  id: number;
  nombre: string;
  periodoInicio: string | null;
  periodoFin: string | null;
  totalFilas: number;
  subidoEn: string;
  subidoPor: string | null;
}

interface TarifaOps {
  id: number;
  servicio: string;
  tipoServicio: 'sm' | 'pad';
  valorUnitario: number;
  activo: boolean;
}

interface Props {
  onMsg: (m: string) => void;
  onErr: (e: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const fmtFecha = (s: string | null) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CO') : '—';
const fmtDt = (s: string) =>
  new Date(s).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

// ── Componente ────────────────────────────────────────────────────────────────

export function InformesOpsPanel({ onMsg, onErr }: Props) {
  const [tab, setTab] = useState<'informes' | 'tarifas'>('informes');

  return (
    <div>
      <div className="admin-module-nav" role="tablist" style={{ marginBottom: 20 }}>
        {(['informes', 'tarifas'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`admin-module-item${tab === t ? ' active' : ''}`}
            onClick={() => { setTab(t); onMsg(''); onErr(''); }}
          >
            {t === 'informes' ? 'Informes de atenciones' : 'Tarifas por servicio'}
          </button>
        ))}
      </div>

      {tab === 'informes' ? (
        <InformesTab onMsg={onMsg} onErr={onErr} />
      ) : (
        <TarifasTab onMsg={onMsg} onErr={onErr} />
      )}
    </div>
  );
}

// ── Tab: Informes ─────────────────────────────────────────────────────────────

function InformesTab({ onMsg, onErr }: Props) {
  const [informes, setInformes]   = useState<InformeOps[]>([]);
  const [loading, setLoading]     = useState(false);
  const [subiendo, setSubiendo]   = useState(false);
  const [borrando, setBorrando]   = useState<number | null>(null);
  const [nombre, setNombre]       = useState('');
  const [periodoInicio, setPi]    = useState('');
  const [periodoFin, setPf]       = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get<InformeOps[]>('/admin/informes-ops');
      setInformes(data);
    } catch { onErr('No se pudieron cargar los informes.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  async function handleSubir(e: FormEvent) {
    e.preventDefault();
    onMsg(''); onErr('');
    const file = fileRef.current?.files?.[0];
    if (!file)          { onErr('Selecciona un archivo CSV.'); return; }
    if (!nombre.trim()) { onErr('Escribe un nombre para el informe.'); return; }

    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('nombre', nombre.trim());
    if (periodoInicio) fd.append('periodoInicio', periodoInicio);
    if (periodoFin)    fd.append('periodoFin', periodoFin);

    setSubiendo(true);
    try {
      const { data } = await api.post<{ totalFilas: number; nombre: string }>(
        '/admin/informes-ops', fd, { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      onMsg(`Informe "${data.nombre}" cargado — ${data.totalFilas.toLocaleString('es-CO')} atenciones/sesiones.`);
      setNombre(''); setPi(''); setPf('');
      if (fileRef.current) fileRef.current.value = '';
      await cargar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      onErr(msg || 'Error al subir el informe.');
    } finally { setSubiendo(false); }
  }

  async function handleBorrar(inf: InformeOps) {
    if (!confirm(`¿Eliminar "${inf.nombre}"? Se borrarán las ${inf.totalFilas.toLocaleString('es-CO')} atenciones asociadas.`)) return;
    onMsg(''); onErr('');
    setBorrando(inf.id);
    try {
      await api.delete(`/admin/informes-ops/${inf.id}`);
      onMsg(`Informe "${inf.nombre}" eliminado.`);
      await cargar();
    } catch { onErr('No se pudo eliminar el informe.'); }
    finally { setBorrando(null); }
  }

  return (
    <div>
      {/* Formulario de carga */}
      <form className="admin-form card-surface" onSubmit={handleSubir}>
        <h3 className="admin-section-title">Cargar informe de atenciones OPS</h3>
        <p className="admin-help-text" style={{ marginBottom: 12 }}>
          El CSV debe tener encabezado. Columnas reconocidas:
          <br />
          <strong>Todos los servicios:</strong> cc_profesional, servicio
          <br />
          <strong>Servicios SM</strong> (por paciente): + fecha_atencion, regional, establecimiento, cc_paciente
          <br />
          <strong>Servicios PAD</strong> (por sesiones): + numero_sesiones
        </p>

        <div className="admin-form-row">
          <label className="admin-label">
            Nombre del informe *
            <input className="admin-input" type="text" value={nombre}
              onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Agosto 2025" required />
          </label>
          <label className="admin-label">
            Período inicio
            <input className="admin-input" type="date" value={periodoInicio}
              onChange={(e) => setPi(e.target.value)} />
          </label>
          <label className="admin-label">
            Período fin
            <input className="admin-input" type="date" value={periodoFin}
              onChange={(e) => setPf(e.target.value)} />
          </label>
        </div>

        <div className="admin-form-row" style={{ marginTop: 8 }}>
          <label className="admin-label" style={{ flex: '1 1 auto' }}>
            Archivo CSV *
            <input ref={fileRef} className="admin-input" type="file"
              accept=".csv,text/csv,text/plain" required />
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <button type="submit" className="admin-primary-button" disabled={subiendo}>
            {subiendo ? 'Procesando…' : 'Cargar informe'}
          </button>
        </div>
      </form>

      {/* Lista de informes */}
      <aside className="admin-side-list card-surface" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ margin: 0 }}>Informes cargados</h4>
          <button type="button" className="admin-ghost-button" onClick={cargar} disabled={loading}>
            {loading ? 'Actualizando…' : '↺ Actualizar'}
          </button>
        </div>

        {informes.length === 0 ? (
          <p className="admin-help-text">Aún no hay informes cargados.</p>
        ) : (
          <table className="bandeja-items-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Nombre</th>
                <th>Período</th>
                <th>Atenciones/sesiones</th>
                <th>Subido por</th>
                <th>Fecha carga</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {informes.map((inf) => (
                <tr key={inf.id}>
                  <td><strong>{inf.nombre}</strong></td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {fmtFecha(inf.periodoInicio)} — {fmtFecha(inf.periodoFin)}
                  </td>
                  <td style={{ textAlign: 'center' }}>{inf.totalFilas.toLocaleString('es-CO')}</td>
                  <td style={{ textAlign: 'center' }}>{inf.subidoPor || '—'}</td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtDt(inf.subidoEn)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="admin-danger-button"
                      disabled={borrando === inf.id} onClick={() => handleBorrar(inf)}>
                      {borrando === inf.id ? '…' : 'Eliminar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </aside>
    </div>
  );
}

// ── Tab: Tarifas ──────────────────────────────────────────────────────────────

function TarifasTab({ onMsg, onErr }: Props) {
  const [tarifas, setTarifas]   = useState<TarifaOps[]>([]);
  const [loading, setLoading]   = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Copia editable: { servicio → valor }
  const [valores, setValores]   = useState<Record<string, string>>({});

  async function cargar() {
    setLoading(true);
    try {
      const { data } = await api.get<TarifaOps[]>('/admin/tarifas-ops');
      setTarifas(data);
      const init: Record<string, string> = {};
      data.forEach((t) => { init[t.servicio] = String(t.valorUnitario); });
      setValores(init);
    } catch { onErr('No se pudieron cargar las tarifas.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, []);

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    onMsg(''); onErr('');
    setGuardando(true);
    try {
      const payload = tarifas.map((t) => ({
        servicio:      t.servicio,
        tipoServicio:  t.tipoServicio,
        valorUnitario: parseFloat((valores[t.servicio] || '0').replace(/[^0-9.]/g, '')) || 0,
        activo:        t.activo,
      }));
      await api.post('/admin/tarifas-ops', { tarifas: payload });
      onMsg('Tarifas guardadas correctamente.');
      await cargar();
    } catch { onErr('Error al guardar las tarifas.'); }
    finally { setGuardando(false); }
  }

  const sm  = tarifas.filter((t) => t.tipoServicio === 'sm');
  const pad = tarifas.filter((t) => t.tipoServicio === 'pad');

  if (loading) return <p className="admin-help-text">Cargando tarifas…</p>;

  return (
    <form className="admin-form card-surface" onSubmit={handleGuardar}>
      <h3 className="admin-section-title">Tarifas por servicio OPS</h3>
      <p className="admin-help-text" style={{ marginBottom: 16 }}>
        Configura el valor unitario de cada servicio. Los servicios <strong>SM</strong> cobran
        por atención (paciente); los <strong>PAD</strong> cobran por sesión.
        El sistema calculará el valor esperado al revisar la solicitud del profesional.
      </p>

      {/* SM */}
      <h4 style={{ marginBottom: 8 }}>Servicios SM — valor por atención / paciente</h4>
      <table className="bandeja-items-table" style={{ width: '100%', marginBottom: 24 }}>
        <thead>
          <tr><th style={{ textAlign: 'left' }}>Servicio</th><th style={{ width: 200 }}>Valor unitario (COP)</th></tr>
        </thead>
        <tbody>
          {sm.map((t) => (
            <tr key={t.servicio}>
              <td>{t.servicio}</td>
              <td>
                <input
                  className="admin-input"
                  type="text"
                  inputMode="numeric"
                  value={valores[t.servicio] ?? '0'}
                  onChange={(e) => setValores((v) => ({ ...v, [t.servicio]: e.target.value }))}
                  style={{ margin: 0 }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PAD */}
      <h4 style={{ marginBottom: 8 }}>Servicios PAD — valor por sesión</h4>
      <table className="bandeja-items-table" style={{ width: '100%', marginBottom: 24 }}>
        <thead>
          <tr><th style={{ textAlign: 'left' }}>Servicio</th><th style={{ width: 200 }}>Valor unitario (COP)</th></tr>
        </thead>
        <tbody>
          {pad.map((t) => (
            <tr key={t.servicio}>
              <td>{t.servicio}</td>
              <td>
                <input
                  className="admin-input"
                  type="text"
                  inputMode="numeric"
                  value={valores[t.servicio] ?? '0'}
                  onChange={(e) => setValores((v) => ({ ...v, [t.servicio]: e.target.value }))}
                  style={{ margin: 0 }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Vista previa total */}
      {tarifas.length > 0 && (
        <div className="admin-help-text" style={{ marginBottom: 16 }}>
          Tarifas configuradas:{' '}
          {tarifas
            .filter((t) => parseFloat(valores[t.servicio] || '0') > 0)
            .map((t) => `${t.servicio}: ${fmt(parseFloat(valores[t.servicio] || '0'))}`)
            .join(' · ') || 'ninguna aún'}
        </div>
      )}

      <button type="submit" className="admin-primary-button" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar tarifas'}
      </button>
    </form>
  );
}
