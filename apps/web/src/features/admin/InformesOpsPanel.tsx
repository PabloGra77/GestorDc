import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/http/api';

interface InformeOps {
  id: number;
  nombre: string;
  periodoInicio: string | null;
  periodoFin: string | null;
  totalFilas: number;
  subidoEn: string;
  subidoPor: string | null;
  tipoPlantilla: 'ppl' | 'servicio';
}

interface Props {
  onMsg: (m: string) => void;
  onErr: (e: string) => void;
}

const fmtFecha = (s: string | null) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CO') : '—';
const fmtDt = (s: string) =>
  new Date(s).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

export function InformesOpsPanel({ onMsg, onErr }: Props) {
  const [informes, setInformes]   = useState<InformeOps[]>([]);
  const [loading, setLoading]     = useState(false);
  const [subiendo, setSubiendo]   = useState(false);
  const [borrando, setBorrando]   = useState<number | null>(null);
  const [nombre, setNombre]             = useState('');
  const [periodoInicio, setPi]          = useState('');
  const [periodoFin, setPf]             = useState('');
  const [tipoPlantilla, setTipoPlant]   = useState<'ppl' | 'servicio'>('ppl');
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

  async function handleSubir(e: { preventDefault(): void }) {
    e.preventDefault();
    onMsg(''); onErr('');
    const file = fileRef.current?.files?.[0];
    if (!file)          { onErr('Selecciona un archivo CSV.'); return; }
    if (!nombre.trim()) { onErr('Escribe un nombre para el informe.'); return; }

    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('nombre', nombre.trim());
    fd.append('tipoPlantilla', tipoPlantilla);
    if (periodoInicio) fd.append('periodoInicio', periodoInicio);
    if (periodoFin)    fd.append('periodoFin', periodoFin);

    setSubiendo(true);
    try {
      const { data } = await api.post<{ totalFilas: number; nombre: string }>(
        '/admin/informes-ops', fd, { headers: { 'Content-Type': undefined } }
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

        <div className="admin-form-row" style={{ marginBottom: 12 }}>
          <label className="admin-label" style={{ flex: '1 1 auto' }}>
            Tipo de plantilla *
            <select className="admin-input" value={tipoPlantilla}
              onChange={(e) => setTipoPlant(e.target.value as 'ppl' | 'servicio')}>
              <option value="ppl">Atenciones realizadas en PPL</option>
              <option value="servicio">Atenciones realizadas por servicio</option>
            </select>
          </label>
        </div>

        {tipoPlantilla === 'ppl' ? (
          <p className="admin-help-text" style={{ marginBottom: 12 }}>
            <strong>Atenciones realizadas en PPL</strong> — columnas del CSV:<br />
            cc_profesional, fecha_atencion, regional, establecimiento, cc_paciente, servicio<br />
            <em>Cada fila = 1 atención / 1 paciente.</em>
          </p>
        ) : (
          <p className="admin-help-text" style={{ marginBottom: 12 }}>
            <strong>Atenciones realizadas por servicio</strong> — columnas del CSV:<br />
            cc_profesional, nombres_paciente, apellidos_paciente, numero_identificacion, servicio, numero_sesiones<br />
            <em>Cada fila = N sesiones de un servicio para un paciente.</em>
          </p>
        )}

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
                <th>Tipo</th>
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
                    {inf.tipoPlantilla === 'servicio' ? 'Por servicio' : 'PPL'}
                  </td>
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
