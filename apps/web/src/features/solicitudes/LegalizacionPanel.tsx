import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/http/api';
import { useOcrDocument, validarOcrContraDato } from '../../hooks/useOcrDocument';
import { formatearMiles } from '../../utils/numeroALetras';
import { SignaturePad } from '../../components/SignaturePad';
import { BANCOS_COLOMBIA } from '../../utils/bancos';

/* ─── Tipos ────────────────────────────────────────────────── */
interface UsuarioSugerido {
  id: number;
  nombreCompleto: string;
  rol: string;
  area: string | null;
}

interface Gasto {
  id: string;
  categoria: string;
  descripcion: string;
  fechaGasto: string;
  valor: string;
  nombreProveedor: string;
  nitProveedor: string;
  numeroFactura: string;
  fechaFactura: string;
  _facturaArchivoId: string;
  _factura: string;
  _facturaHash: string;
  _facturaConfianza: number;
  _facturaAlertas: string[];
  _validando: boolean;
}

interface LegalizacionConfig {
  categorias: string[];
  montoMaximo: number;
  mensajePago: string;
}

interface LegalizacionPanelProps {
  onCreada?: (info: { id: number; numeroRadicado: string }) => void;
}

const TIPOS_CUENTA = ['Ahorros', 'Corriente'];

function uid() {
  return Math.random().toString(36).slice(2);
}

function gastoVacio(): Gasto {
  return {
    id: uid(),
    categoria: '',
    descripcion: '',
    fechaGasto: '',
    valor: '',
    nombreProveedor: '',
    nitProveedor: '',
    numeroFactura: '',
    fechaFactura: '',
    _facturaArchivoId: '',
    _factura: '',
    _facturaHash: '',
    _facturaConfianza: 0,
    _facturaAlertas: [],
    _validando: false,
  };
}

async function hashFile(file: File): Promise<string> {
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

/** Convierte cualquier imagen a JPEG comprimida (<1.5 MB, max 1600px) para upload seguro */
async function prepararImagen(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1600;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        const nombre = file.name.replace(/\.[^.]+$/, '.jpg');
        resolve(new File([blob], nombre, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/* ─── Componente fila de gasto ─────────────────────────────── */
function FilaGasto({
  gasto, idx, categorias, onChange, onRemove, onAdjuntarFactura, canRemove,
}: {
  gasto: Gasto;
  idx: number;
  categorias: string[];
  onChange: (g: Gasto) => void;
  onRemove: () => void;
  onAdjuntarFactura: (idx: number, file: File) => void;
  canRemove: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function set(field: keyof Gasto, val: string) {
    onChange({ ...gasto, [field]: val });
  }

  const tieneFactura = !!gasto._factura;
  const hayAlertas = gasto._facturaAlertas.length > 0;

  return (
    <div className="leg-gasto-row card-surface">
      <div className="leg-gasto-header">
        <span className="leg-gasto-num">Gasto {idx + 1}</span>
        {canRemove && (
          <button type="button" className="leg-gasto-del" onClick={onRemove} title="Eliminar gasto">✕</button>
        )}
      </div>

      <div className="leg-gasto-fields">
        <div className="leg-field">
          <label>Categoría *</label>
          <select value={gasto.categoria} onChange={(e) => set('categoria', e.target.value)} required>
            <option value="">— Selecciona —</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="leg-field">
          <label>Descripción *</label>
          <input type="text" value={gasto.descripcion} onChange={(e) => set('descripcion', e.target.value)}
            placeholder="Ej: Almuerzo reunión de trabajo" required />
        </div>

        <div className="leg-field">
          <label>Fecha del gasto *</label>
          <input type="date" value={gasto.fechaGasto} onChange={(e) => set('fechaGasto', e.target.value)} required />
        </div>

        <div className="leg-field">
          <label>Valor ($) *</label>
          <input type="text" inputMode="numeric" value={gasto.valor}
            onChange={(e) => set('valor', e.target.value.replace(/[^0-9.,]/g, ''))}
            placeholder="0" required />
        </div>

        <div className="leg-field">
          <label>Proveedor / Establecimiento</label>
          <input type="text" value={gasto.nombreProveedor} onChange={(e) => set('nombreProveedor', e.target.value)}
            placeholder="Nombre del proveedor" />
        </div>

        <div className="leg-field">
          <label>NIT del proveedor</label>
          <input type="text" inputMode="numeric" value={gasto.nitProveedor}
            onChange={(e) => set('nitProveedor', e.target.value.replace(/\D/g, ''))}
            placeholder="NIT sin dígito de verificación" />
        </div>

        <div className="leg-field">
          <label>N° de factura</label>
          <input type="text" value={gasto.numeroFactura} onChange={(e) => set('numeroFactura', e.target.value)}
            placeholder="Número o código de la factura" />
        </div>

        <div className="leg-field">
          <label>Fecha de la factura</label>
          <input type="date" value={gasto.fechaFactura} onChange={(e) => set('fechaFactura', e.target.value)} />
        </div>
      </div>

      {/* Factura adjunta */}
      <div className="leg-factura-section">
        <div className="leg-factura-label">
          <strong>Factura / soporte *</strong>
          {!tieneFactura && <span className="leg-factura-falta">⚠ Obligatoria</span>}
          {tieneFactura && !hayAlertas && <span className="leg-factura-ok">✓ {gasto._factura}</span>}
          {tieneFactura && hayAlertas && (
            <span className="leg-factura-warn" title={gasto._facturaAlertas.join('\n')}>
              ⚠ {gasto._factura} — {gasto._facturaAlertas.length} alerta(s)
            </span>
          )}
        </div>

        <div className="leg-factura-actions">
          {gasto._validando ? (
            <span className="leg-validando">Analizando factura…</span>
          ) : (
            <>
              {/* Tomar foto con cámara (móvil) */}
              <button type="button" className="leg-btn-camara admin-ghost-button"
                onClick={() => {
                  if (fileRef.current) {
                    fileRef.current.setAttribute('capture', 'environment');
                    fileRef.current.click();
                  }
                }}>
                📷 Cámara
              </button>
              {/* Adjuntar archivo */}
              <button type="button" className="admin-ghost-button"
                onClick={() => {
                  if (fileRef.current) {
                    fileRef.current.removeAttribute('capture');
                    fileRef.current.click();
                  }
                }}>
                {tieneFactura ? 'Cambiar archivo' : 'Adjuntar archivo'}
              </button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAdjuntarFactura(idx, f);
              e.target.value = '';
            }}
          />
        </div>

        {/* Error de upload (sin archivo cargado) */}
        {!tieneFactura && gasto._facturaAlertas.length > 0 && (
          <div className="admin-error" style={{ marginTop: 8, fontSize: 13 }}>
            {gasto._facturaAlertas[0]}
          </div>
        )}

        {/* Alertas OCR (archivo cargado con advertencias) */}
        {tieneFactura && hayAlertas && (
          <ul className="leg-alertas-list">
            {gasto._facturaAlertas.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Panel principal ───────────────────────────────────────── */
export function LegalizacionPanel({ onCreada }: LegalizacionPanelProps) {
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [config, setConfig] = useState<LegalizacionConfig>({
    categorias: ['Alimentación', 'Viajes', 'Transporte', 'Papelería / Útiles', 'Representación', 'Otros'],
    montoMaximo: 0,
    mensajePago: '',
  });

  // Paso 1: datos básicos
  const [concepto, setConcepto] = useState('');
  const [fechaPeriodo, setFechaPeriodo] = useState('');
  const [autorizadorInput, setAutorizadorInput] = useState('');
  const [autorizadorId, setAutorizadorId] = useState<number>(0);
  const [autorizadorNombre, setAutorizadorNombre] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioSugerido[]>([]);
  const [showSugeridos, setShowSugeridos] = useState(false);

  // Paso 2: gastos
  const [gastos, setGastos] = useState<Gasto[]>([gastoVacio()]);

  // Paso 3: datos bancarios
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('Ahorros');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [titularCuenta, setTitularCuenta] = useState('');

  // Paso 4: firma
  const [firma, setFirma] = useState('');

  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);

  const { procesarArchivo } = useOcrDocument();
  const gastosRef = useRef(gastos);
  useEffect(() => { gastosRef.current = gastos; });

  useEffect(() => {
    api.get<LegalizacionConfig>('/config/legalizacion').then((r) => setConfig(r.data)).catch(() => {});
    api.get<UsuarioSugerido[]>('/usuarios/nombres').then((r) => setUsuarios(r.data)).catch(() => {});
  }, []);

  const sugeridos = useMemo(() => {
    const term = autorizadorInput.trim().toLowerCase();
    if (term.length < 2) return [];
    return usuarios.filter((u) => u.nombreCompleto.toLowerCase().includes(term)).slice(0, 8);
  }, [autorizadorInput, usuarios]);

  const totalGastos = useMemo(() => {
    return gastos.reduce((acc, g) => acc + (parseFloat(String(g.valor).replace(/\./g, '').replace(',', '.')) || 0), 0);
  }, [gastos]);

  const todosConFactura = useMemo(() => gastos.every((g) => !!g._factura), [gastos]);
  const gastosTienenDatos = useMemo(
    () => gastos.every((g) => g.categoria && g.descripcion && g.fechaGasto && g.valor),
    [gastos]
  );

  function elegirAutorizador(u: UsuarioSugerido) {
    setAutorizadorId(u.id);
    setAutorizadorNombre(u.nombreCompleto);
    setAutorizadorInput(u.nombreCompleto);
    setShowSugeridos(false);
  }

  function actualizarGasto(idx: number, g: Gasto) {
    setGastos((prev) => prev.map((old, i) => (i === idx ? g : old)));
  }

  function agregarGasto() {
    setGastos((prev) => [...prev, gastoVacio()]);
  }

  function eliminarGasto(idx: number) {
    if (gastos.length === 1) return;
    setGastos((prev) => prev.filter((_, i) => i !== idx));
  }

  const adjuntarFactura = useCallback(async (idx: number, file: File) => {
    setGastos((prev) => prev.map((g, i) =>
      i === idx ? { ...g, _validando: true, _facturaAlertas: [] } : g
    ));

    // 1. Subir archivo — error visible si falla
    let archivoId = '';
    try {
      const archivoParaSubir = await prepararImagen(file);
      const fd = new FormData();
      fd.append('archivo', archivoParaSubir);
      const up = await api.post<{ id: string }>('/archivos', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      archivoId = up.data.id;
    } catch {
      setGastos((prev) => prev.map((g, i) =>
        i === idx ? {
          ...g,
          _validando: false,
          _facturaAlertas: ['No se pudo subir el archivo. Verifica tu conexión e intenta de nuevo.'],
        } : g
      ));
      return;
    }

    // 2. Hash para duplicados
    const hash = await hashFile(file);

    // 3. OCR — no bloquea el registro si falla
    const alertas: string[] = [];
    try {
      const ocr = await procesarArchivo(file);
      if (ocr) {
        const textoOcr = ocr.text;
        const gasto = gastosRef.current[idx];
        const valorStr = String(gasto.valor || '').replace(/\./g, '').replace(',', '');

        if (valorStr.length >= 3) {
          const v = validarOcrContraDato(textoOcr, valorStr, 'cc');
          if (!v.coincide) {
            alertas.push(`El valor $${formatearMiles(parseInt(valorStr))} no se identificó claramente en la factura.`);
          }
        }
        if (gasto.nitProveedor) {
          const vNit = validarOcrContraDato(textoOcr, gasto.nitProveedor, 'cc');
          if (!vNit.coincide) alertas.push(`El NIT ${gasto.nitProveedor} no coincide con el de la factura.`);
        }
        if (ocr.confidence < 45) {
          alertas.push(`Lectura de baja calidad (${Math.round(ocr.confidence)}%). Verifica que la imagen sea legible.`);
        }
        const t = textoOcr.toLowerCase();
        const marcadores = ['total', 'nit', 'valor', 'fecha'].filter((k) => t.includes(k)).length;
        if (marcadores < 2) {
          alertas.push('El archivo no parece ser una factura válida. Verifica que sea el documento correcto.');
        }
      }
    } catch {
      alertas.push('No se pudo analizar el contenido automáticamente. El archivo fue registrado correctamente.');
    }

    setGastos((prev) => prev.map((g, i) =>
      i === idx ? {
        ...g,
        _facturaArchivoId: archivoId,
        _factura: file.name,
        _facturaHash: hash,
        _facturaConfianza: 0,
        _facturaAlertas: alertas,
        _validando: false,
      } : g
    ));
  }, [procesarArchivo]);

  function validarPaso(): string {
    if (paso === 1) {
      if (!concepto.trim()) return 'Escribe el concepto / motivo del gasto';
      if (!fechaPeriodo) return 'Selecciona la fecha del período del gasto';
      if (!autorizadorId) return 'Selecciona el usuario que autorizó el gasto de la lista';
      if (autorizadorInput.trim() !== autorizadorNombre) return 'Selecciona el autorizador de la lista de sugerencias';
    }
    if (paso === 2) {
      if (!gastosTienenDatos) return 'Completa todos los campos obligatorios de cada gasto (categoría, descripción, fecha, valor)';
      if (!todosConFactura) return 'Todos los gastos deben tener factura adjunta antes de continuar';
      if (config.montoMaximo > 0 && totalGastos > config.montoMaximo) {
        return `El total ($${formatearMiles(totalGastos)}) supera el límite permitido de $${formatearMiles(config.montoMaximo)}`;
      }
    }
    if (paso === 3) {
      if (!banco) return 'Selecciona el banco';
      if (!numeroCuenta.trim()) return 'Ingresa el número de cuenta';
      if (!titularCuenta.trim()) return 'Ingresa el nombre del titular de la cuenta';
    }
    if (paso === 4) {
      if (!firma) return 'La firma digital es obligatoria';
    }
    return '';
  }

  function siguiente() {
    const e = validarPaso();
    if (e) { setErr(e); return; }
    setErr('');
    setPaso((p) => Math.min(4, p + 1) as 1 | 2 | 3 | 4);
  }

  function anterior() {
    setErr('');
    setPaso((p) => Math.max(1, p - 1) as 1 | 2 | 3 | 4);
  }

  async function enviar() {
    const e = validarPaso();
    if (e) { setErr(e); return; }
    setErr('');
    setEnviando(true);

    try {
      // Cargar el tipo legalizacion
      const tipos = await api.get<Array<{ id: number; slug: string; nombre: string }>>('/tipos');
      const tipo = tipos.data.find((t) => t.slug === 'legalizacion');
      if (!tipo) {
        setErr('No se encontró el tipo "Legalizaciones" en el sistema. Pídele al administrador que lo configure.');
        setEnviando(false);
        return;
      }

      const gastosPayload = gastos.map(({ _validando, ...g }) => g);

      const payload = {
        tipoSolicitudId: tipo.id,
        datos: {
          concepto,
          fechaPeriodo,
          autorizadorId,
          autorizadorNombre,
          totalGastos: String(totalGastos),
          gastos: JSON.stringify(gastosPayload),
          banco,
          tipoCuenta,
          numeroCuenta,
          titularCuenta,
        },
        documentos: {},
        firmas: { profesional: firma },
      };

      const res = await api.post<{ id: number; numeroRadicado: string }>('/solicitudes', payload);
      setMsg(`¡Legalización creada exitosamente! Radicado: ${res.data.numeroRadicado}`);
      onCreada?.({ id: res.data.id, numeroRadicado: res.data.numeroRadicado });
    } catch (ex: unknown) {
      const msg = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(msg || 'Ocurrió un error al crear la legalización. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (msg) {
    return (
      <div className="leg-success card-surface">
        <div className="leg-success-icon">✓</div>
        <h3>Legalización radicada</h3>
        <p>{msg}</p>
        <p className="leg-success-note">
          El sistema notificó al autorizador para que dé su visto bueno. Puedes hacer seguimiento en <strong>Mis solicitudes</strong>.
        </p>
        <button type="button" className="admin-primary-button"
          onClick={() => { setMsg(''); setPaso(1); setGastos([gastoVacio()]); setConcepto(''); setFechaPeriodo(''); setAutorizadorId(0); setAutorizadorInput(''); setAutorizadorNombre(''); setBanco(''); setNumeroCuenta(''); setTitularCuenta(''); setFirma(''); }}>
          Nueva legalización
        </button>
      </div>
    );
  }

  const pasos = ['Datos básicos', 'Gastos y facturas', 'Datos bancarios', 'Firma y envío'];

  return (
    <div className="leg-panel">
      {/* Stepper */}
      <div className="leg-stepper" role="list">
        {pasos.map((label, i) => (
          <div key={i} role="listitem"
            className={`leg-step${paso === i + 1 ? ' active' : ''}${paso > i + 1 ? ' done' : ''}`}>
            <span className="leg-step-num">{paso > i + 1 ? '✓' : i + 1}</span>
            <span className="leg-step-label">{label}</span>
          </div>
        ))}
      </div>

      {err && <div className="admin-error" role="alert">{err}</div>}

      {/* ── Paso 1: Datos básicos ── */}
      {paso === 1 && (
        <div className="leg-form card-surface">
          <h3>Datos básicos de la legalización</h3>

          <div className="leg-field">
            <label>Concepto / motivo del gasto *</label>
            <textarea value={concepto} onChange={(e) => setConcepto(e.target.value)}
              placeholder="Describe brevemente el motivo del gasto (ej: Alimentación durante visita de campo a sede norte)"
              rows={3} required />
          </div>

          <div className="leg-field">
            <label>Fecha del período del gasto *</label>
            <input type="date" value={fechaPeriodo} onChange={(e) => setFechaPeriodo(e.target.value)} required />
          </div>

          <div className="leg-field leg-autocomplete-wrap">
            <label>¿Quién autorizó el gasto? *</label>
            <input
              type="text"
              value={autorizadorInput}
              onChange={(e) => { setAutorizadorInput(e.target.value); setAutorizadorId(0); setAutorizadorNombre(''); setShowSugeridos(true); }}
              onFocus={() => setShowSugeridos(true)}
              onBlur={() => setTimeout(() => setShowSugeridos(false), 150)}
              placeholder="Escribe el nombre del director o gerente que te autorizó…"
              autoComplete="off"
            />
            {autorizadorId > 0 && (
              <span className="leg-autorizado-ok">✓ {autorizadorNombre}</span>
            )}
            {showSugeridos && sugeridos.length > 0 && (
              <div className="leg-sugeridos" role="listbox">
                {sugeridos.map((u) => (
                  <button key={u.id} type="button" className="leg-sugerido-item"
                    onMouseDown={() => elegirAutorizador(u)}>
                    <strong>{u.nombreCompleto}</strong>
                    <span>{u.rol}{u.area ? ` · ${u.area}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
            {showSugeridos && autorizadorInput.length >= 2 && sugeridos.length === 0 && (
              <div className="leg-sugeridos">
                <span className="leg-sin-resultados">Sin coincidencias para "{autorizadorInput}"</span>
              </div>
            )}
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Gastos y facturas
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 2: Gastos y facturas ── */}
      {paso === 2 && (
        <div className="leg-form">
          <div className="leg-gastos-header">
            <div>
              <h3>Gastos y facturas</h3>
              <p className="leg-nota">Cada gasto debe tener su factura adjunta. La suma total debe coincidir exactamente.</p>
            </div>
            <div className="leg-total-badge">
              <span>Total</span>
              <strong>${formatearMiles(totalGastos)}</strong>
              {config.montoMaximo > 0 && (
                <span className={totalGastos > config.montoMaximo ? 'leg-over-limit' : 'leg-under-limit'}>
                  Límite: ${formatearMiles(config.montoMaximo)}
                </span>
              )}
            </div>
          </div>

          {gastos.map((g, idx) => (
            <FilaGasto
              key={g.id}
              gasto={g}
              idx={idx}
              categorias={config.categorias}
              onChange={(updated) => actualizarGasto(idx, updated)}
              onRemove={() => eliminarGasto(idx)}
              onAdjuntarFactura={adjuntarFactura}
              canRemove={gastos.length > 1}
            />
          ))}

          <button type="button" className="admin-ghost-button leg-add-gasto" onClick={agregarGasto}>
            + Agregar otro gasto
          </button>

          <div className="leg-resumen">
            <div className="leg-resumen-row">
              <span>Gastos registrados:</span> <strong>{gastos.length}</strong>
            </div>
            <div className="leg-resumen-row">
              <span>Con factura:</span>
              <strong className={todosConFactura ? 'color-ok' : 'color-warn'}>
                {gastos.filter((g) => g._factura).length} / {gastos.length}
              </strong>
            </div>
            <div className="leg-resumen-row leg-resumen-total">
              <span>Total a legalizar:</span> <strong>${formatearMiles(totalGastos)}</strong>
            </div>
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Datos bancarios
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 3: Datos bancarios ── */}
      {paso === 3 && (
        <div className="leg-form card-surface">
          <h3>Datos bancarios para el pago</h3>
          <p className="leg-nota">El reembolso se realizará a la cuenta que registres a continuación.</p>

          <div className="leg-field">
            <label>Banco *</label>
            <select value={banco} onChange={(e) => setBanco(e.target.value)} required>
              <option value="">— Selecciona el banco —</option>
              {BANCOS_COLOMBIA.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="leg-field">
            <label>Tipo de cuenta *</label>
            <div className="leg-radio-group">
              {TIPOS_CUENTA.map((t) => (
                <label key={t} className="leg-radio-item">
                  <input type="radio" name="tipoCuenta" value={t}
                    checked={tipoCuenta === t} onChange={() => setTipoCuenta(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <div className="leg-field">
            <label>Número de cuenta *</label>
            <input type="text" inputMode="numeric" value={numeroCuenta}
              onChange={(e) => setNumeroCuenta(e.target.value.replace(/\D/g, ''))}
              placeholder="Número de cuenta sin espacios ni guiones" required />
          </div>

          <div className="leg-field">
            <label>Titular de la cuenta *</label>
            <input type="text" value={titularCuenta}
              onChange={(e) => setTitularCuenta(e.target.value)}
              placeholder="Nombre completo del titular tal como aparece en el banco" required />
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Firma y envío
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 4: Firma y resumen ── */}
      {paso === 4 && (
        <div className="leg-form card-surface">
          <h3>Resumen y firma</h3>

          <div className="leg-resumen-final">
            <h4>Datos básicos</h4>
            <div className="leg-resumen-row"><span>Concepto:</span> <strong>{concepto}</strong></div>
            <div className="leg-resumen-row"><span>Período:</span> <strong>{fechaPeriodo}</strong></div>
            <div className="leg-resumen-row"><span>Autorizado por:</span> <strong>{autorizadorNombre}</strong></div>

            <h4>Gastos</h4>
            {gastos.map((g, i) => (
              <div key={g.id} className="leg-resumen-gasto">
                <strong>{i + 1}. {g.categoria} — {g.descripcion}</strong>
                <span>${formatearMiles(parseFloat(String(g.valor).replace(/\./g, '').replace(',', '.')) || 0)}</span>
                <span className="leg-resumen-fact">{g._factura ? `✓ ${g._factura}` : '⚠ Sin factura'}</span>
              </div>
            ))}
            <div className="leg-resumen-total-line">
              <span>Total a legalizar:</span>
              <strong>${formatearMiles(totalGastos)}</strong>
            </div>

            <h4>Cuenta bancaria</h4>
            <div className="leg-resumen-row"><span>Banco:</span> <strong>{banco}</strong></div>
            <div className="leg-resumen-row"><span>Tipo:</span> <strong>{tipoCuenta}</strong></div>
            <div className="leg-resumen-row"><span>Cuenta:</span> <strong>{numeroCuenta}</strong></div>
            <div className="leg-resumen-row"><span>Titular:</span> <strong>{titularCuenta}</strong></div>
          </div>

          <div className="leg-field">
            <label>Firma digital del solicitante *</label>
            <p className="leg-nota">Al firmar, declaras que los gastos son reales y están debidamente soportados con las facturas adjuntas.</p>
            <SignaturePad value={firma} onChange={setFirma} />
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar solicitud de legalización'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
