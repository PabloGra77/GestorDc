import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/http/api';

interface AreaMin { id: number; nombre: string }
interface Autorizado {
  id: number;
  numeroDocumento: string;
  rol: string;
  area: string | null;
  nivelAprobacion: string | null;
  usado: boolean;
  usadoEn: string | null;
  creadoEn: string;
}

const ROLES = [
  { v: 'profesional', l: 'Profesional' },
  { v: 'analista', l: 'Analista' },
  { v: 'coordinador', l: 'Coordinador' },
  { v: 'director', l: 'Director' },
  { v: 'gerente', l: 'Gerente' },
  { v: 'administrador', l: 'Administrador' },
];
const ROLES_CON_AREA = ['analista', 'coordinador', 'director'];

export function PersonalAutorizadoPanel({ areas }: { areas: AreaMin[] }) {
  const [lista, setLista] = useState<Autorizado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroArea, setFiltroArea] = useState('');

  // Individual
  const [cc, setCc] = useState('');
  const [rol, setRol] = useState('profesional');
  const [area, setArea] = useState('');

  // Masivo
  const [texto, setTexto] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get<Autorizado[]>('/personal');
      setLista(r.data);
    } catch {
      setErr('No se pudo cargar el personal autorizado.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function getErr(e: unknown): string {
    const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    return m || 'No fue posible completar la operación.';
  }

  async function autorizarIndividual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(''); setErr('');
    if (cc.trim().length < 4) { setErr('Documento inválido.'); return; }
    if (ROLES_CON_AREA.includes(rol) && !area) { setErr(`El rol ${rol} requiere área.`); return; }
    try {
      await api.post('/personal', { numeroDocumento: cc.trim(), rol, area: area || null });
      setMsg(`Documento ${cc.trim()} autorizado como ${rol}.`);
      setCc(''); setArea('');
      await cargar();
    } catch (e) { setErr(getErr(e)); }
  }

  async function leerArchivo(file: File | null) {
    if (!file) return;
    const t = await file.text();
    setTexto(t);
  }

  async function autorizarMasivo() {
    setMsg(''); setErr('');
    if (!texto.trim()) { setErr('Pega o sube un archivo con cc, rol, área.'); return; }
    try {
      const r = await api.post<{ autorizados: number; errores: number; detalleErrores: string[] }>(
        '/personal/bulk', { texto },
      );
      setMsg(`Autorizados: ${r.data.autorizados}. Errores: ${r.data.errores}.` +
        (r.data.detalleErrores.length ? ` (${r.data.detalleErrores.slice(0, 5).join(' · ')})` : ''));
      setTexto('');
      if (fileRef.current) fileRef.current.value = '';
      await cargar();
    } catch (e) { setErr(getErr(e)); }
  }

  const listaFiltrada = lista.filter((p) => {
    const docOk = busqueda.trim() === '' || p.numeroDocumento.includes(busqueda.trim());
    const areaOk = filtroArea === '' || (p.area ?? '').toLowerCase().includes(filtroArea.toLowerCase());
    return docOk && areaOk;
  });

  async function eliminar(id: number, doc: string) {
    if (!window.confirm(`¿Quitar la autorización del documento ${doc}?`)) return;
    setMsg(''); setErr('');
    try {
      await api.delete(`/personal/${id}`);
      setMsg(`Autorización de ${doc} eliminada.`);
      await cargar();
    } catch (e) { setErr(getErr(e)); }
  }

  return (
    <>
      <form className="admin-form card-surface" onSubmit={autorizarIndividual}>
        <h4>Autorizar persona (individual)</h4>
        <p className="admin-help-text">Solo las cédulas autorizadas aquí podrán crear cuenta. El rol y el área quedan asignados.</p>
        <div className="admin-user-form-grid">
          <input type="text" placeholder="Número de documento" value={cc}
            onChange={(e) => setCc(e.target.value.replace(/[^A-Za-z0-9]/g, ''))} required maxLength={20} />
          <select value={rol} onChange={(e) => setRol(e.target.value)} required>
            {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
          <select value={area} onChange={(e) => setArea(e.target.value)} required={ROLES_CON_AREA.includes(rol)}>
            <option value="">{ROLES_CON_AREA.includes(rol) ? '— área (requerida) —' : '— área (opcional) —'}</option>
            {areas.map((a) => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
          </select>
        </div>
        <button type="submit" className="admin-primary-button">Autorizar</button>

        <hr style={{ margin: '18px 0', border: 0, borderTop: '1px solid #e2e8f0' }} />

        <h4>Autorización masiva (archivo plano)</h4>
        <p className="admin-help-text">
          Una línea por persona con: <strong>documento, rol, área</strong>. Ej: <code>1020456789,analista,Contabilidad</code>.
          Sube un CSV/TXT o pega el contenido.
        </p>
        <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain"
          onChange={(e) => leerArchivo(e.target.files?.[0] ?? null)} />
        <textarea rows={6} placeholder={'1020456789,analista,Contabilidad\n1033221145,profesional,OPS\n79854123,director,Operaciones (OPS)'}
          value={texto} onChange={(e) => setTexto(e.target.value)} style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 13 }} />
        <button type="button" className="admin-primary-button" onClick={autorizarMasivo} style={{ marginTop: 8 }}>
          Autorizar lote
        </button>

        {msg ? <div className="admin-success" style={{ marginTop: 10 }}>{msg}</div> : null}
        {err ? <div className="admin-error" style={{ marginTop: 10 }}>{err}</div> : null}
      </form>

      <aside className="admin-side-list card-surface">
        <div className="pers-list-head">
          <h4>Personal autorizado ({lista.length})</h4>
          {lista.length > 0 && (
            <div className="pers-filtros">
              <input
                type="text"
                className="pers-busqueda-input"
                placeholder="Buscar por N.º documento…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                maxLength={20}
              />
              <select
                className="pers-area-select"
                value={filtroArea}
                onChange={(e) => setFiltroArea(e.target.value)}
              >
                <option value="">Todas las áreas</option>
                {[...new Set(lista.map((p) => p.area).filter(Boolean))].sort().map((a) => (
                  <option key={a!} value={a!}>{a}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {cargando ? <p>Cargando…</p> : lista.length === 0 ? (
          <p>Aún no hay personal autorizado.</p>
        ) : listaFiltrada.length === 0 ? (
          <p className="admin-help-text" style={{ padding: '12px 0' }}>
            Sin resultados para la búsqueda actual.
          </p>
        ) : (
          <ul>
            {listaFiltrada.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>{p.numeroDocumento}</strong>
                  <span className="admin-user-meta">{p.rol}{p.area ? ` · ${p.area}` : ''}</span>
                </div>
                <div className="admin-inline-actions">
                  <span className={`status-pill ${p.usado ? 'off' : 'on'}`}>{p.usado ? 'Cuenta creada' : 'Pendiente'}</span>
                  <button type="button" className="admin-ghost-button admin-role-delete" onClick={() => eliminar(p.id, p.numeroDocumento)}>
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </>
  );
}
