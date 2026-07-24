import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/http/api';

interface LogEntry {
  id: number;
  usuarioId: number | null;
  correo: string | null;
  nombreCompleto: string | null;
  accion: string;
  detalle: string | null;
  ip: string | null;
  userAgent: string | null;
  exitoso: boolean;
  creadoEn: string;
}

interface LogsResponse {
  total: number;
  pagina: number;
  porPagina: number;
  logs: LogEntry[];
}

const ACCION_LABEL: Record<string, string> = {
  login_exitoso:    'Inicio de sesión',
  login_fallido:    'Intento fallido',
  logout:           'Cierre de sesión',
  crear_usuario:    'Crear usuario',
  editar_usuario:   'Editar usuario',
  eliminar_usuario: 'Eliminar usuario',
  crear_solicitud:  'Nueva solicitud',
  visto_bueno:      'Visto bueno',
  validar:          'Validar paso',
  aprobar:          'Aprobar',
  rechazar:         'Rechazar',
  devolver:         'Devolver',
};

const ACCION_COLOR: Record<string, string> = {
  login_exitoso:    '#22c55e',
  login_fallido:    '#ef4444',
  logout:           '#94a3b8',
  crear_usuario:    '#8b5cf6',
  editar_usuario:   '#6366f1',
  eliminar_usuario: '#ef4444',
  crear_solicitud:  '#3b82f6',
  visto_bueno:      '#0ea5e9',
  validar:          '#10b981',
  aprobar:          '#22c55e',
  rechazar:         '#ef4444',
  devolver:         '#f59e0b',
};

function formatFecha(s: string) {
  try {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('es-CO', {
      dateStyle: 'short', timeStyle: 'medium',
    });
  } catch { return s; }
}

function acortarUA(ua: string | null): string {
  if (!ua) return '—';
  const match = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|MSIE)[/\s]([\d.]+)/i);
  if (match) return `${match[1]} ${match[2].split('.')[0]}`;
  return ua.slice(0, 30);
}

function generarCsvBlob(logs: LogEntry[]): Blob {
  const headers = ['ID','Fecha','Usuario','Correo','Acción','Detalle','IP','Navegador','Resultado'];
  const rows = logs.map(l => [
    l.id,
    formatFecha(l.creadoEn),
    l.nombreCompleto ?? '—',
    l.correo ?? '—',
    ACCION_LABEL[l.accion] ?? l.accion,
    (l.detalle ?? '').replace(/,/g, ';'),
    l.ip ?? '—',
    acortarUA(l.userAgent),
    l.exitoso ? 'Exitoso' : 'Fallido',
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  return new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
}

export function HistorialPanel() {
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [pagina, setPagina]       = useState(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [accion, setAccion]         = useState('');
  const [busqueda, setBusqueda]     = useState('');

  const porPagina = 50;

  const cargar = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { pagina: String(p), por_pagina: String(porPagina) };
      if (fechaDesde) params.fecha_desde = fechaDesde;
      if (fechaHasta) params.fecha_hasta = fechaHasta;
      if (accion)     params.accion      = accion;
      if (busqueda)   params.q           = busqueda;

      const r = await api.get<LogsResponse>('/historial', { params });
      setLogs(r.data.logs);
      setTotal(r.data.total);
      setPagina(p);
    } catch {
      setError('No se pudo cargar el historial. Verifica que la tabla auditoria_logs exista en la base de datos.');
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta, accion, busqueda]);

  useEffect(() => { cargar(1); }, [cargar]);

  function handleFiltrar(e: React.FormEvent) {
    e.preventDefault();
    cargar(1);
  }

  function descargarCSV() {
    const blob = generarCsvBlob(logs);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const ts   = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = `historial-payops-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  return (
    <div className="historial-panel">
      {/* ── Cabecera ── */}
      <div className="historial-head">
        <div>
          <h3 className="historial-titulo">Historial de actividad</h3>
          <p className="admin-help-text">Registro detallado de acciones, inicios de sesión e incidentes con IP y hora exacta.</p>
        </div>
        <button type="button" className="radicado-action-button" onClick={descargarCSV} disabled={logs.length === 0}>
          ⬇ Exportar CSV
        </button>
      </div>

      {/* ── Filtros ── */}
      <form className="historial-filtros" onSubmit={handleFiltrar}>
        <input
          type="date"
          className="admin-input"
          value={fechaDesde}
          onChange={e => setFechaDesde(e.target.value)}
          title="Desde"
        />
        <input
          type="date"
          className="admin-input"
          value={fechaHasta}
          onChange={e => setFechaHasta(e.target.value)}
          title="Hasta"
        />
        <select className="admin-input" value={accion} onChange={e => setAccion(e.target.value)}>
          <option value="">Todas las acciones</option>
          <option value="login_exitoso">Inicio de sesión</option>
          <option value="login_fallido">Intento fallido</option>
          <option value="logout">Cierre de sesión</option>
          <option value="crear_usuario">Crear usuario</option>
          <option value="editar_usuario">Editar usuario</option>
          <option value="eliminar_usuario">Eliminar usuario</option>
          <option value="crear_solicitud">Nueva solicitud</option>
          <option value="visto_bueno">Visto bueno</option>
          <option value="validar">Validar paso</option>
          <option value="aprobar">Aprobar</option>
          <option value="rechazar">Rechazar</option>
          <option value="devolver">Devolver</option>
        </select>
        <input
          type="search"
          className="admin-input"
          placeholder="Buscar por usuario, IP, detalle…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <button type="submit" className="admin-primary-button" disabled={loading}>
          {loading ? 'Cargando…' : 'Filtrar'}
        </button>
        <button type="button" className="admin-ghost-button" onClick={() => {
          setFechaDesde(''); setFechaHasta(''); setAccion(''); setBusqueda('');
        }}>
          Limpiar
        </button>
      </form>

      {error ? <div className="admin-error" style={{ margin: '12px 0' }}>{error}</div> : null}

      {/* ── Resumen ── */}
      {!loading && !error && (
        <p className="historial-total">
          {total > 0
            ? `${total.toLocaleString('es-CO')} registro${total !== 1 ? 's' : ''} · Página ${pagina} de ${totalPaginas}`
            : 'Sin registros para los filtros seleccionados.'}
        </p>
      )}

      {/* ── Tabla ── */}
      {logs.length > 0 && (
        <div className="historial-tabla-wrap">
          <table className="historial-tabla">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Detalle</th>
                <th>IP</th>
                <th>Navegador</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className={log.exitoso ? '' : 'historial-fila-error'}>
                  <td className="historial-fecha">{formatFecha(log.creadoEn)}</td>
                  <td>
                    <div className="historial-usuario">
                      <strong>{log.nombreCompleto ?? '—'}</strong>
                      <span>{log.correo ?? '—'}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className="historial-accion-badge"
                      style={{ borderColor: ACCION_COLOR[log.accion] ?? '#94a3b8', color: ACCION_COLOR[log.accion] ?? '#94a3b8' }}
                    >
                      {ACCION_LABEL[log.accion] ?? log.accion}
                    </span>
                  </td>
                  <td className="historial-detalle">{log.detalle ?? '—'}</td>
                  <td className="historial-ip">{log.ip ?? '—'}</td>
                  <td className="historial-ua">{acortarUA(log.userAgent)}</td>
                  <td>
                    <span className={`historial-estado ${log.exitoso ? 'ok' : 'err'}`}>
                      {log.exitoso ? '✓ OK' : '✗ Fallido'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Paginación ── */}
      {totalPaginas > 1 && (
        <div className="historial-paginacion">
          <button className="admin-ghost-button" onClick={() => cargar(pagina - 1)} disabled={pagina <= 1 || loading}>
            ← Anterior
          </button>
          <span>{pagina} / {totalPaginas}</span>
          <button className="admin-ghost-button" onClick={() => cargar(pagina + 1)} disabled={pagina >= totalPaginas || loading}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
