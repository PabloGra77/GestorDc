import { useEffect, useState } from 'react';
import { api } from '../../services/http/api';

interface LegalizacionConfig {
  categorias: string[];
  montoMaximo: number;
  mensajePago: string;
}

const CATEGORIAS_DEFECTO = ['Alimentación', 'Viajes', 'Transporte', 'Papelería / Útiles', 'Representación', 'Otros'];

export function LegalizacionConfigPanel() {
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_DEFECTO);
  const [montoMaximo, setMontoMaximo] = useState('0');
  const [mensajePago, setMensajePago] = useState(
    'Tu solicitud de legalización con número de radicado {radicado} fue aprobada. El pago será realizado en el transcurso de los días hábiles.'
  );
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    api.get<LegalizacionConfig>('/config/legalizacion')
      .then((r) => {
        setCategorias(r.data.categorias ?? CATEGORIAS_DEFECTO);
        setMontoMaximo(String(r.data.montoMaximo ?? 0));
        setMensajePago(r.data.mensajePago ?? mensajePago);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  function agregarCategoria() {
    const c = nuevaCategoria.trim();
    if (!c) return;
    if (categorias.some((x) => x.toLowerCase() === c.toLowerCase())) {
      setErr(`La categoría "${c}" ya existe`);
      return;
    }
    setCategorias((prev) => [...prev, c]);
    setNuevaCategoria('');
    setErr('');
  }

  function eliminarCategoria(i: number) {
    if (categorias.length <= 1) { setErr('Debe haber al menos una categoría'); return; }
    setCategorias((prev) => prev.filter((_, idx) => idx !== i));
  }

  function moverCategoria(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= categorias.length) return;
    setCategorias((prev) => {
      const arr = [...prev];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }

  async function guardar() {
    setErr(''); setOk('');
    const monto = parseFloat(montoMaximo.replace(',', '.')) || 0;
    if (monto < 0) { setErr('El monto máximo no puede ser negativo'); return; }
    if (!mensajePago.trim()) { setErr('El mensaje de pago no puede estar vacío'); return; }
    setGuardando(true);
    try {
      await api.put('/config/legalizacion', {
        categorias,
        montoMaximo: monto,
        mensajePago: mensajePago.trim(),
      });
      setOk('Configuración guardada correctamente');
    } catch (ex: unknown) {
      const m = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(m || 'Error al guardar la configuración');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <div className="admin-loading">Cargando configuración…</div>;

  return (
    <div className="admin-module-content leg-config">
      <h2>Configuración de Legalizaciones</h2>
      <p className="leg-config-desc">
        Ajusta las categorías de gasto, el límite de monto y el mensaje que verá el solicitante cuando su legalización sea aprobada.
      </p>

      {err && <div className="admin-error">{err}</div>}
      {ok && <div className="admin-success">{ok}</div>}

      {/* Categorías */}
      <section className="leg-config-section">
        <h3>Categorías de gasto</h3>
        <p className="leg-config-hint">Las categorías aparecen en el formulario de legalización. Ordénalas según preferencia.</p>
        <ul className="leg-cat-list">
          {categorias.map((c, i) => (
            <li key={i} className="leg-cat-item">
              <span className="leg-cat-name">{c}</span>
              <div className="leg-cat-actions">
                <button type="button" title="Subir" className="leg-cat-btn"
                  onClick={() => moverCategoria(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" title="Bajar" className="leg-cat-btn"
                  onClick={() => moverCategoria(i, 1)} disabled={i === categorias.length - 1}>↓</button>
                <button type="button" title="Eliminar" className="leg-cat-btn leg-cat-del"
                  onClick={() => eliminarCategoria(i)}>✕</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="leg-cat-add">
          <input
            type="text"
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregarCategoria()}
            placeholder="Nueva categoría…"
            maxLength={80}
          />
          <button type="button" className="admin-ghost-button" onClick={agregarCategoria}>
            + Agregar
          </button>
        </div>
      </section>

      {/* Monto máximo */}
      <section className="leg-config-section">
        <h3>Límite de monto por legalización</h3>
        <p className="leg-config-hint">
          Valor máximo permitido por solicitud. Escribe <strong>0</strong> para sin límite.
        </p>
        <div className="leg-monto-row">
          <span className="leg-monto-prefix">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={montoMaximo}
            onChange={(e) => setMontoMaximo(e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
          />
          {parseFloat(montoMaximo) === 0 && <span className="leg-sin-limite">Sin límite</span>}
        </div>
      </section>

      {/* Mensaje de pago */}
      <section className="leg-config-section">
        <h3>Mensaje de pago</h3>
        <p className="leg-config-hint">
          Este mensaje se mostrará al solicitante cuando contabilidad apruebe su legalización.
          Usa <code>{'{radicado}'}</code> para insertar el número de radicado automáticamente.
        </p>
        <textarea
          value={mensajePago}
          onChange={(e) => setMensajePago(e.target.value)}
          rows={4}
          maxLength={1000}
          className="leg-mensaje-textarea"
        />
        <p className="leg-char-count">{mensajePago.length} / 1000 caracteres</p>
        {mensajePago.includes('{radicado}') && (
          <div className="leg-preview-mensaje">
            <strong>Vista previa:</strong>{' '}
            {mensajePago.replace('{radicado}', 'LEG-2024-001')}
          </div>
        )}
      </section>

      <div className="leg-config-footer">
        <button type="button" className="admin-primary-button" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
