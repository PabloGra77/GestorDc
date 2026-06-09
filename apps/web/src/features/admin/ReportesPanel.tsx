import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/http/api';
import { getAuthSession } from '../auth/auth.service';

interface Props {
  onMsg: (m: string) => void;
  onErr: (e: string) => void;
}

interface CampoMin { key: string; label: string; type?: string }
interface TipoMin { id: number; nombre: string; camposPlantilla: CampoMin[] }

const REPORTES = [
  { tipo: 'nuevos', titulo: 'Usuarios nuevos (últimos 30 días)', desc: 'Usuarios creados en los últimos 30 días con su estado.' },
  { tipo: 'bloqueados', titulo: 'Usuarios bloqueados', desc: 'Usuarios con cuenta inactiva o pendientes de aprobación.' },
  { tipo: 'solicitudes', titulo: 'Solicitudes pendientes', desc: 'Solicitudes activas en validación, borrador o devueltas.' },
] as const;

// Columnas fijas disponibles para el informe dinámico
const COLS_FIJAS: Array<{ key: string; label: string }> = [
  { key: 'radicado', label: 'Radicado' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'tipo', label: 'Tipo de solicitud' },
  { key: 'area', label: 'Área' },
  { key: 'estado', label: 'Estado' },
  { key: 'paso', label: 'Paso actual' },
  { key: 'solicitante', label: 'Nombre del profesional' },
  { key: 'documento', label: 'Documento' },
  { key: 'correo', label: 'Correo' },
];

const ESTADOS = [
  { v: '', l: 'Todos los estados' },
  { v: 'en_validacion', l: 'En validación' },
  { v: 'aprobado', l: 'Aprobado' },
  { v: 'devuelto', l: 'Devuelto' },
  { v: 'rechazado', l: 'Rechazado' },
  { v: 'borrador', l: 'Borrador' },
];

export function ReportesPanel({ onMsg, onErr }: Props) {
  const [descargando, setDescargando] = useState<string | null>(null);

  // Generador dinámico
  const [tipos, setTipos] = useState<TipoMin[]>([]);
  const [tipoSel, setTipoSel] = useState<number | ''>('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [estado, setEstado] = useState('');
  const [cols, setCols] = useState<string[]>(['radicado', 'fecha', 'tipo', 'solicitante', 'estado']);

  useEffect(() => {
    api.get<TipoMin[]>('/tipos').then((r) => setTipos(r.data)).catch(() => setTipos([]));
  }, []);

  const tipoActual = useMemo(() => tipos.find((t) => t.id === tipoSel) || null, [tipos, tipoSel]);
  const colsDato = useMemo(() => {
    if (!tipoActual) return [];
    return (tipoActual.camposPlantilla || [])
      .filter((c) => c.key && c.type !== 'texto-fijo')
      .map((c) => ({ key: `dato:${c.key}`, label: c.label || c.key }));
  }, [tipoActual]);

  function toggleCol(key: string) {
    setCols((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function descargarUrl(path: string, nombreDefecto: string, idCarga: string) {
    setDescargando(idCarga);
    onMsg('');
    onErr('');
    try {
      const token = getAuthSession()?.token || '';
      const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        onErr((data as { message?: string }).message || 'No se pudo generar el informe.');
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const disp = r.headers.get('Content-Disposition') || '';
      const m = disp.match(/filename="?([^"]+)"?/);
      link.href = url;
      link.download = m ? m[1] : nombreDefecto;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onMsg('Informe descargado correctamente.');
    } catch {
      onErr('Error al descargar el informe.');
    } finally {
      setDescargando(null);
    }
  }

  function descargarDinamico() {
    if (cols.length === 0) { onErr('Selecciona al menos una columna para el informe.'); return; }
    if (desde && hasta && desde > hasta) { onErr('La fecha "desde" no puede ser mayor que "hasta".'); return; }
    const params = new URLSearchParams();
    if (tipoSel) params.set('tipo', String(tipoSel));
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (estado) params.set('estado', estado);
    params.set('columnas', cols.join(','));
    descargarUrl(`/api/index.php/solicitudes/reporte?${params.toString()}`, 'informe_solicitudes.csv', 'dinamico');
  }

  return (
    <aside className="admin-side-list card-surface" style={{ gridColumn: '1 / -1' }}>
      <h4>Reportes descargables</h4>
      <p className="admin-help-text">Genera y descarga reportes en CSV (compatible con Excel).</p>
      <ul className="reportes-list">
        {REPORTES.map((r) => (
          <li key={r.tipo} className="reporte-item">
            <div>
              <strong>{r.titulo}</strong>
              <span className="admin-help-text">{r.desc}</span>
            </div>
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => descargarUrl(`/api/index.php/usuarios/reporte?tipo=${encodeURIComponent(r.tipo)}`, `reporte_${r.tipo}.csv`, r.tipo)}
              disabled={descargando !== null}
            >
              {descargando === r.tipo ? 'Generando…' : '↓ Descargar CSV'}
            </button>
          </li>
        ))}
      </ul>

      <h4 style={{ marginTop: 26 }}>🧩 Generador de informe dinámico</h4>
      <p className="admin-help-text">
        Arma tu propio informe de solicitudes: elige el tipo, el rango de fechas, el estado y exactamente qué columnas quieres
        (incluyendo los datos diligenciados del formulario).
      </p>

      <div className="reporte-dinamico">
        <div className="reporte-filtros">
          <label>
            Tipo de solicitud
            <select value={tipoSel} onChange={(e) => { setTipoSel(e.target.value === '' ? '' : Number(e.target.value)); }}>
              <option value="">Todos los tipos</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
          <label>
            Estado
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADOS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </label>
          <label>
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>

        <div className="reporte-columnas">
          <strong className="reporte-cols-titulo">Columnas del informe</strong>
          <div className="reporte-cols-grupo">
            <span className="admin-help-text">Generales</span>
            <div className="reporte-cols-chips">
              {COLS_FIJAS.map((c) => (
                <label key={c.key} className={`reporte-chip${cols.includes(c.key) ? ' on' : ''}`}>
                  <input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
          {tipoActual ? (
            <div className="reporte-cols-grupo">
              <span className="admin-help-text">Datos del formulario · {tipoActual.nombre}</span>
              {colsDato.length === 0 ? (
                <span className="admin-help-text">Este tipo no tiene datos configurados.</span>
              ) : (
                <div className="reporte-cols-chips">
                  {colsDato.map((c) => (
                    <label key={c.key} className={`reporte-chip${cols.includes(c.key) ? ' on' : ''}`}>
                      <input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="admin-help-text">Elige un tipo de solicitud específico para incluir los datos del formulario como columnas.</span>
          )}
        </div>

        <div className="reporte-dinamico-acciones">
          <span className="admin-help-text">{cols.length} columna(s) seleccionada(s)</span>
          <button
            type="button"
            className="admin-primary-button"
            onClick={descargarDinamico}
            disabled={descargando !== null}
          >
            {descargando === 'dinamico' ? 'Generando…' : '↓ Descargar informe CSV'}
          </button>
        </div>
      </div>
    </aside>
  );
}
