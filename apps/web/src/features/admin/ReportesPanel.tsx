import { useState } from 'react';
import { getAuthSession } from '../auth/auth.service';

interface Props {
  onMsg: (m: string) => void;
  onErr: (e: string) => void;
}

const REPORTES = [
  { tipo: 'nuevos', titulo: 'Usuarios nuevos (últimos 30 días)', desc: 'Usuarios creados en los últimos 30 días con su estado.' },
  { tipo: 'bloqueados', titulo: 'Usuarios bloqueados', desc: 'Usuarios con cuenta inactiva o pendientes de aprobación.' },
  { tipo: 'solicitudes', titulo: 'Solicitudes pendientes', desc: 'Solicitudes activas en validación, borrador o devueltas.' },
] as const;

export function ReportesPanel({ onMsg, onErr }: Props) {
  const [descargando, setDescargando] = useState<string | null>(null);

  async function descargar(tipo: string) {
    setDescargando(tipo);
    onMsg('');
    onErr('');
    try {
      const session = getAuthSession();
      const token = session?.token || '';
      const r = await fetch(`/api/index.php/usuarios/reporte?tipo=${encodeURIComponent(tipo)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        onErr((data as { message?: string }).message || 'No se pudo generar el reporte.');
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const disp = r.headers.get('Content-Disposition') || '';
      const m = disp.match(/filename="?([^"]+)"?/);
      link.href = url;
      link.download = m ? m[1] : `reporte_${tipo}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onMsg(`Reporte "${tipo}" descargado.`);
    } catch {
      onErr('Error al descargar el reporte.');
    } finally {
      setDescargando(null);
    }
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
              onClick={() => descargar(r.tipo)}
              disabled={descargando !== null}
            >
              {descargando === r.tipo ? 'Generando…' : '↓ Descargar CSV'}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
