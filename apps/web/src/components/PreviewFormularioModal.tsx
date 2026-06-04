import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ordenarCamposPorPlantilla } from '../utils/ordenCamposPlantilla';

interface CampoMin {
  key: string;
  label: string;
  type: string;
  required: boolean;
  group?: string;
  texto?: string;
  columnas?: string[];
}

interface BloqueCampoMin {
  tipo: string;
  campoKey?: string;
  pagina?: number;
  y?: number;
  x?: number;
}

interface PlantillaPdfMin {
  bloques?: BloqueCampoMin[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  campos: CampoMin[];
  plantillaPdf?: PlantillaPdfMin | null;
  tipoNombre: string;
}

const TIPO_LABEL: Record<string, string> = {
  text: 'Texto', email: 'Correo', number: 'Número',
  'valor-pesos': 'Valor en pesos', date: 'Fecha', 'mes-anio': 'Mes/Año',
  textarea: 'Texto largo', 'texto-fijo': 'Nota fija',
  select: 'Lista', 'tipo-doc': 'Tipo doc', cc: 'Cédula',
  nit: 'NIT', 'cuenta-bancaria': 'Cuenta', 'banco-select': 'Banco',
  direccion: 'Dirección con mapa', file: 'Archivo (imagen o PDF)',
};

/** Cuerpo del formulario (reutilizable: modal y vista en vivo dentro del editor). */
export function PreviewFormularioContenido({ campos, plantillaPdf }: { campos: CampoMin[]; plantillaPdf?: PlantillaPdfMin | null }) {
  const gruposArr = useMemo(() => {
    const ordenados = ordenarCamposPorPlantilla(campos, plantillaPdf);
    const m = new Map<string, CampoMin[]>();
    for (const c of ordenados) {
      const g = c.group || 'Datos';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
    return Array.from(m.entries());
  }, [campos, plantillaPdf]);

  return (
        <div className="preview-form-body">
          {gruposArr.length === 0 ? (
            <p className="admin-help-text">No hay campos definidos. Agrega campos en la sección 3 o usa los conjuntos predefinidos del editor.</p>
          ) : (
            gruposArr.map(([grupo, campos], idx) => (
              <section key={grupo} className="preview-form-group">
                <h4 className="preview-form-group-title">
                  <span className="preview-form-step">Paso {idx + 1}</span> {grupo}
                </h4>
                <div className="preview-form-grid">
                  {campos.map((c) => (
                    <div key={c.key} className="preview-form-field">
                      <label>
                        {c.label} {c.required ? <span className="req">*</span> : null}
                        <span className="preview-form-type">[{TIPO_LABEL[c.type] || c.type}]</span>
                      </label>
                      {c.type === 'texto-fijo' ? (
                        <div className="preview-form-fijo">{c.texto || c.label}</div>
                      ) : c.type === 'tabla-items' ? (
                        <div className="preview-form-tabla">
                          <table>
                            <thead><tr>{(c.columnas && c.columnas.length ? c.columnas : ['Ítem', 'Valor']).map((col) => <th key={col}>{col}</th>)}</tr></thead>
                            <tbody><tr>{(c.columnas && c.columnas.length ? c.columnas : ['Ítem', 'Valor']).map((col) => <td key={col}>&nbsp;</td>)}</tr></tbody>
                          </table>
                          <small className="admin-help-text">➕ El solicitante puede agregar varias filas</small>
                        </div>
                      ) : c.type === 'textarea' ? (
                        <textarea disabled rows={3} placeholder={`Ej. ${c.label.toLowerCase()}…`} />
                      ) : c.type === 'select' || c.type === 'tipo-doc' || c.type === 'banco-select' ? (
                        <select disabled>
                          <option>— elige una opción —</option>
                        </select>
                      ) : c.type === 'file' ? (
                        <div className="preview-form-file">📎 Adjuntar archivo (imagen o PDF)</div>
                      ) : c.type === 'direccion' ? (
                        <div className="preview-form-direccion">
                          🗺️ Campo dirección con país/ciudad/localidad selectables, mapa interactivo y clima
                        </div>
                      ) : c.type === 'date' ? (
                        <input type="date" disabled />
                      ) : c.type === 'mes-anio' ? (
                        <input type="month" disabled />
                      ) : c.type === 'valor-pesos' ? (
                        <input type="text" disabled placeholder="$ 0 (auto-letras)" />
                      ) : (
                        <input type="text" disabled placeholder={`Ej. ${c.label.toLowerCase()}…`} />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}

          <section className="preview-form-group">
            <h4 className="preview-form-group-title">
              <span className="preview-form-step">Paso {gruposArr.length + 1}</span> Firma del solicitante
            </h4>
            <div className="preview-form-firma">
              ✍️ Pad de firma digital con mouse/táctil
            </div>
          </section>
        </div>
  );
}

export function PreviewFormularioModal({ open, onClose, campos, plantillaPdf, tipoNombre }: Props) {
  if (!open) return null;

  const content = (
    <div className="preview-form-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="preview-form-modal card-surface" onClick={(e) => e.stopPropagation()}>
        <header className="preview-form-head">
          <div>
            <h3>👁️ Vista previa del formulario</h3>
            <p className="admin-help-text">Así se verá cuando un usuario haga la solicitud "{tipoNombre || 'sin nombre'}".</p>
          </div>
          <button type="button" className="admin-ghost-button" onClick={onClose}>✕ Cerrar</button>
        </header>

        <PreviewFormularioContenido campos={campos} plantillaPdf={plantillaPdf} />

        <footer className="preview-form-footer">
          <p className="admin-help-text">
            ℹ️ Los campos se muestran en el orden definido por los bloques tipo "Campo" de la plantilla PDF.
            Cambia el orden moviendo bloques en el editor para reorganizar el formulario.
          </p>
          <button type="button" className="admin-primary-button" onClick={onClose}>Cerrar vista previa</button>
        </footer>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
