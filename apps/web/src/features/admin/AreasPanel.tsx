import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/http/api';

interface Area {
  id: number;
  nombre: string;
  descripcion: string | null;
  slug: string;
  activo: boolean;
  orden: number;
}

export function AreasPanel() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [slug, setSlug] = useState('');
  const [activo, setActivo] = useState(true);
  const [orden, setOrden] = useState<number | ''>(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await api.get<Area[]>('/areas');
      setAreas(r.data);
    } catch {
      setErr('No se pudo cargar el listado de areas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function limpiarForm() {
    setEditingId(null);
    setNombre('');
    setDescripcion('');
    setSlug('');
    setActivo(true);
    setOrden(0);
  }

  function editar(a: Area) {
    setEditingId(a.id);
    setNombre(a.nombre);
    setDescripcion(a.descripcion ?? '');
    setSlug(a.slug);
    setActivo(a.activo);
    setOrden(a.orden);
    setMsg('');
    setErr('');
  }

  async function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg('');
    setErr('');
    if (!nombre.trim()) {
      setErr('Nombre es obligatorio.');
      return;
    }
    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      slug: slug.trim() || undefined,
      activo,
      orden: typeof orden === 'number' ? orden : 0,
    };
    try {
      if (editingId) {
        await api.patch(`/areas/${editingId}`, payload);
        setMsg('Area actualizada.');
      } else {
        await api.post('/areas', payload);
        setMsg('Area creada.');
      }
      limpiarForm();
      cargar();
    } catch (e) {
      const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(r || 'No se pudo guardar el area.');
    }
  }

  return (
    <section className="admin-areas-panel">
      <div className="admin-form-grid">
        <form className="admin-form card-surface" onSubmit={guardar}>
          <header className="admin-panel-head">
            <div>
              <h3>{editingId ? 'Editar area' : 'Crear area'}</h3>
              <p className="admin-help-text">
                Define las areas/dependencias institucionales (Operaciones, Recursos Humanos, Contabilidad…).
              </p>
            </div>
            {editingId ? (
              <button type="button" className="admin-ghost-button" onClick={limpiarForm}>
                Cancelar edicion
              </button>
            ) : null}
          </header>

          <div className="admin-user-form-grid">
            <div className="form-group">
              <label htmlFor="area-nombre">Nombre del area</label>
              <input
                id="area-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Recursos Humanos"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="area-slug">Identificador (slug)</label>
              <input
                id="area-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="se genera del nombre si lo dejas vacio"
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="area-desc">Descripcion</label>
              <input
                id="area-desc"
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripcion breve"
              />
            </div>
            <div className="form-group">
              <label htmlFor="area-orden">Orden</label>
              <input
                id="area-orden"
                type="number"
                value={orden}
                onChange={(e) => setOrden(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <label className="ops-checkbox" style={{ alignSelf: 'end' }}>
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />{' '}
              Activa
            </label>
          </div>

          {msg ? <div className="admin-success">{msg}</div> : null}
          {err ? <div className="admin-error">{err}</div> : null}

          <button type="submit" className="admin-primary-button">
            {editingId ? 'Guardar cambios' : 'Crear area'}
          </button>
        </form>

        <aside className="admin-side-list card-surface">
          <header className="admin-panel-head">
            <div>
              <h3>Areas registradas</h3>
              <p className="admin-help-text">
                {loading ? 'Cargando…' : `${areas.length} area(s) en el sistema.`}
              </p>
            </div>
            <button type="button" className="admin-refresh-button" onClick={cargar}>
              Refrescar
            </button>
          </header>

          <div className="admin-areas-grid">
            {areas.map((a) => (
              <div key={a.id} className="admin-area-card">
                <div className="admin-area-card-head">
                  <strong>{a.nombre}</strong>
                  <span className={a.activo ? 'admin-state-active' : 'admin-state-inactive'}>
                    {a.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                {a.descripcion ? <p className="admin-help-text">{a.descripcion}</p> : null}
                <p className="admin-help-text">ID #{a.id} · {a.slug} · orden {a.orden}</p>
                <div className="admin-inline-actions">
                  <button type="button" className="admin-ghost-button" onClick={() => editar(a)}>
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
