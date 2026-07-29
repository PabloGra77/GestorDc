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
  plataforma: string | null;
}

interface Props {
  onMsg: (m: string) => void;
  onErr: (e: string) => void;
}

const MESES = [
  { v: '01', l: 'Enero' },     { v: '02', l: 'Febrero' },   { v: '03', l: 'Marzo' },
  { v: '04', l: 'Abril' },     { v: '05', l: 'Mayo' },      { v: '06', l: 'Junio' },
  { v: '07', l: 'Julio' },     { v: '08', l: 'Agosto' },    { v: '09', l: 'Septiembre' },
  { v: '10', l: 'Octubre' },   { v: '11', l: 'Noviembre' }, { v: '12', l: 'Diciembre' },
];

const hoyAnio = new Date().getFullYear();
const ANIOS: string[] = [];
for (let y = 2023; y <= hoyAnio + 1; y++) ANIOS.push(String(y));

const PLATF_LABEL: Record<string, string> = { '360': 'Plataforma 360', 'panacea': 'Panacea' };

const fmtPeriodo = (s: string | null) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) : '—';

const fmtDt = (s: string) =>
  new Date(s).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

function descargarPlantilla() {
  const BOM = '﻿';
  const contenido = BOM + [
    'cc_profesional;fecha_atencion;nombres_paciente;apellidos_paciente;cc_paciente;servicio;numero_historia',
    '1016018747;28/07/2026;JUAN;PÉREZ GARCÍA;1234567;PSICOLOGÍA;HC-000123',
    '1016018747;29/07/2026;MARÍA;LÓPEZ TORRES;7654321;FISIOTERAPIA PAD;HC-000456',
  ].join('\n');

  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'Plantilla_InformeOPS.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function InformesOpsPanel({ onMsg, onErr }: Props) {
  const hoy = new Date();
  const [informes, setInformes]   = useState<InformeOps[]>([]);
  const [loading, setLoading]     = useState(false);
  const [subiendo, setSubiendo]   = useState(false);
  const [borrando, setBorrando]   = useState<number | null>(null);
  const [mes, setMes]             = useState(String(hoy.getMonth() + 1).padStart(2, '0'));
  const [anio, setAnio]           = useState(String(hoy.getFullYear()));
  const [plataforma, setPlatf]    = useState<'360' | 'panacea'>('360');
  const [nombre, setNombre]       = useState('');
  const [nombreEditado, setNombreEditado] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!nombreEditado) {
      const mesNom = MESES.find((m) => m.v === mes)?.l ?? mes;
      setNombre(`${mesNom} ${anio} — ${PLATF_LABEL[plataforma]}`);
    }
  }, [mes, anio, plataforma, nombreEditado]);

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
    if (!file) { onErr('Selecciona un archivo CSV.'); return; }

    const primerDia = `${anio}-${mes}-01`;
    const ultimoDia = new Date(+anio, +mes, 0).toISOString().slice(0, 10);

    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('nombre', nombre.trim() || `${MESES.find((m) => m.v === mes)?.l} ${anio} — ${PLATF_LABEL[plataforma]}`);
    fd.append('periodoInicio', primerDia);
    fd.append('periodoFin', ultimoDia);
    fd.append('plataforma', plataforma);

    setSubiendo(true);
    try {
      const { data } = await api.post<{ totalFilas: number; nombre: string }>(
        '/admin/informes-ops', fd, { headers: { 'Content-Type': undefined } }
      );
      onMsg(`Informe "${data.nombre}" cargado — ${data.totalFilas.toLocaleString('es-CO')} atenciones registradas.`);
      setNombreEditado(false);
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
      {/* Plantilla descargable */}
      <div className="card-surface" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <h4 style={{ margin: '0 0 6px' }}>Plantilla de carga</h4>
        <p className="admin-help-text" style={{ margin: '0 0 12px' }}>
          Descarga la plantilla, diligénciala en Excel y súbela aquí. El sistema calcula
          automáticamente los servicios por profesional y por paciente, y los valida contra
          las cuentas de cobro OPS.
        </p>
        <div style={{ border: '1px solid var(--gold-line, rgba(212,175,55,.35))', borderRadius: 8, padding: '12px 14px' }}>
          <p className="admin-help-text" style={{ margin: '0 0 10px', fontSize: 12 }}>
            Columnas requeridas: <code>cc_profesional · fecha_atencion · nombres_paciente · apellidos_paciente · cc_paciente · servicio · numero_historia</code><br/>
            El <strong>número de historia</strong> identifica cada atención de forma única — el sistema lo usa para evitar duplicados. Cada fila = 1 atención.
          </p>
          <button type="button" className="admin-ghost-button" onClick={descargarPlantilla}>
            ⬇ Descargar plantilla
          </button>
        </div>
      </div>

      {/* Formulario de carga */}
      <form className="admin-form card-surface" onSubmit={handleSubir}>
        <h3 className="admin-section-title">Cargar informe de atenciones OPS</h3>

        <div className="admin-form-row">
          <label className="admin-label">
            Mes *
            <select className="admin-input" value={mes} onChange={(e) => setMes(e.target.value)}>
              {MESES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </label>
          <label className="admin-label">
            Año *
            <select className="admin-input" value={anio} onChange={(e) => setAnio(e.target.value)}>
              {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="admin-label">
            Plataforma *
            <select className="admin-input" value={plataforma} onChange={(e) => setPlatf(e.target.value as '360' | 'panacea')}>
              <option value="360">Plataforma 360</option>
              <option value="panacea">Panacea</option>
            </select>
          </label>
        </div>

        <div className="admin-form-row" style={{ marginTop: 8 }}>
          <label className="admin-label" style={{ flex: '1 1 auto' }}>
            Nombre del informe
            <input className="admin-input" type="text" value={nombre}
              onChange={(e) => { setNombre(e.target.value); setNombreEditado(true); }}
              onFocus={() => setNombreEditado(true)}
              placeholder="Se genera automáticamente" />
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
                <th>Plataforma</th>
                <th>Período</th>
                <th>Atenciones</th>
                <th>Subido por</th>
                <th>Fecha y hora de carga</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {informes.map((inf) => (
                <tr key={inf.id}>
                  <td><strong>{inf.nombre}</strong></td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {inf.plataforma ? (PLATF_LABEL[inf.plataforma] ?? inf.plataforma) : '—'}
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {fmtPeriodo(inf.periodoInicio)}
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
