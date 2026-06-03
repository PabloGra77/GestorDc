import { useRef, useState } from 'react';
import { api } from '../../services/http/api';
import type { Role } from '../../types/role';

interface AreaMini { id: number; nombre: string }

interface Props {
  roles: Role[];
  areas: AreaMini[];
  onResult: (creados: number, errores: number) => void;
  onError: (msg: string) => void;
}

interface DetalleItem {
  fila: number;
  correo?: string;
  ok: boolean;
  error?: string;
}

interface FilaCSV {
  primerNombre: string;
  segundoNombre?: string | null;
  primerApellido: string;
  segundoApellido?: string | null;
  correo: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  rolId: number;
  areaId?: number | null;
}

// Encabezados esperados (en orden flexible)
const CAMPOS = [
  'primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido',
  'correo', 'tipoDocumento', 'numeroDocumento', 'rol', 'area',
];

function parseCSV(texto: string, roles: Role[], areas: AreaMini[]): { filas: FilaCSV[]; errores: string[] } {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lineas.length < 2) return { filas: [], errores: ['Archivo vacío o solo encabezado.'] };
  const sep = lineas[0].includes(';') ? ';' : ',';
  const headers = lineas[0].split(sep).map((h) => h.trim());
  const errores: string[] = [];
  const filas: FilaCSV[] = [];

  for (let i = 1; i < lineas.length; i++) {
    const cols = lineas[i].split(sep).map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = cols[j] || ''; });

    if (!row.primerNombre || !row.primerApellido || !row.correo || !row.rol) {
      errores.push(`Fila ${i + 1}: faltan datos obligatorios.`);
      continue;
    }
    const rol = roles.find((r) => r.nombre.toLowerCase() === row.rol.toLowerCase());
    if (!rol) { errores.push(`Fila ${i + 1}: rol "${row.rol}" no existe.`); continue; }
    const area = row.area ? areas.find((a) => a.nombre.toLowerCase() === row.area.toLowerCase()) : null;
    if (row.area && !area) { errores.push(`Fila ${i + 1}: area "${row.area}" no existe.`); continue; }

    filas.push({
      primerNombre: row.primerNombre,
      segundoNombre: row.segundoNombre || null,
      primerApellido: row.primerApellido,
      segundoApellido: row.segundoApellido || null,
      correo: row.correo.toLowerCase(),
      tipoDocumento: row.tipoDocumento || 'CC',
      numeroDocumento: row.numeroDocumento || '',
      rolId: rol.id,
      areaId: area?.id ?? null,
    });
  }
  return { filas, errores };
}

export function BulkCreatePanel({ roles, areas, onResult, onError }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [previa, setPrevia] = useState<FilaCSV[]>([]);
  const [erroresParseo, setErroresParseo] = useState<string[]>([]);
  const [resultado, setResultado] = useState<DetalleItem[]>([]);

  function onArchivo(file: File | null) {
    setPrevia([]);
    setErroresParseo([]);
    setResultado([]);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const txt = String(reader.result || '');
      const { filas, errores } = parseCSV(txt, roles, areas);
      setPrevia(filas);
      setErroresParseo(errores);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function enviar() {
    if (previa.length === 0) { onError('No hay filas válidas para enviar.'); return; }
    setEnviando(true);
    try {
      const r = await api.post<{ creados: number; errores: number; total: number; detalle: DetalleItem[] }>(
        '/usuarios/bulk',
        { usuarios: previa }
      );
      setResultado(r.data.detalle || []);
      onResult(r.data.creados, r.data.errores);
      setPrevia([]);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      onError(msg || 'No se pudo procesar la carga masiva.');
    } finally {
      setEnviando(false);
    }
  }

  function descargarPlantilla() {
    const ejemplo = [
      CAMPOS.join(','),
      'Juan,Carlos,Perez,Gomez,jperez@ipsgoleman.com.co,CC,1023456789,' + (roles[0]?.nombre || 'Coordinador') + ',' + (areas[0]?.nombre || ''),
    ].join('\n');
    const blob = new Blob(['﻿' + ejemplo], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_usuarios.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <aside className="admin-side-list card-surface" style={{ gridColumn: '1 / -1', marginTop: 12 }}>
      <h4>Creación masiva de usuarios (CSV)</h4>
      <p className="admin-help-text">
        Sube un archivo CSV con los encabezados: <em>{CAMPOS.join(', ')}</em>.
        Columnas obligatorias: primerNombre, primerApellido, correo, rol.
      </p>
      <div className="admin-inline-actions" style={{ marginBottom: 8 }}>
        <button type="button" className="admin-ghost-button" onClick={descargarPlantilla}>
          ↓ Descargar plantilla
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onArchivo(e.target.files?.[0] ?? null)}
        />
      </div>
      {erroresParseo.length > 0 ? (
        <div className="admin-error">
          {erroresParseo.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      ) : null}
      {previa.length > 0 ? (
        <div>
          <p><strong>{previa.length}</strong> fila(s) listas para crear.</p>
          <button type="button" className="admin-primary-button" onClick={enviar} disabled={enviando}>
            {enviando ? 'Procesando…' : `Crear ${previa.length} usuario(s)`}
          </button>
        </div>
      ) : null}
      {resultado.length > 0 ? (
        <ul className="admin-bulk-resultado">
          {resultado.map((d, i) => (
            <li key={i} className={d.ok ? 'ok' : 'err'}>
              <span>Fila {d.fila}{d.correo ? ` · ${d.correo}` : ''}:</span>
              <strong>{d.ok ? '✓ creado' : `✗ ${d.error}`}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
