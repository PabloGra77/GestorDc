import { useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { SignaturePad } from '../../components/SignaturePad';
import { BANCOS_COLOMBIA } from '../../utils/bancos';
import { formatearMiles, numeroAPesosEnLetras } from '../../utils/numeroALetras';
import { getAuthSession } from '../auth/auth.service';

interface AnticipoPanelProps {
  onCreada?: (info: { id: number; numeroRadicado: string }) => void;
}

interface TipoInfo { id: number; nombre: string; areaNombre: string; slug: string; }
interface ItemGasto { id: string; concepto: string; descripcion: string; valor: string; }

const CONCEPTOS = [
  { key: 'viaje',        label: 'Viaje / Transporte' },
  { key: 'hospedaje',    label: 'Hospedaje / Alojamiento' },
  { key: 'alimentacion', label: 'Alimentación / Viáticos' },
  { key: 'materiales',   label: 'Materiales / Insumos' },
  { key: 'capacitacion', label: 'Capacitación / Evento' },
  { key: 'otro',         label: 'Otro concepto' },
];

const TIPOS_CUENTA = ['Ahorros', 'Corriente'];

function uid() { return Math.random().toString(36).slice(2, 10); }
function normTxt(s: string) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

export function AnticipOPanel({ onCreada }: AnticipoPanelProps) {
  const session = getAuthSession();
  const nombreSesion = session?.usuario?.nombreCompleto || '';

  const [tipo, setTipo] = useState<TipoInfo | null>(null);
  const [paso, setPaso] = useState(1);
  const PASOS = ['Datos del formato', 'Concepto', 'Desglose económico', 'Cuenta bancaria', 'Firma'];

  /* ─── Step 1 ─────────────────────────────────── */
  const [cargo, setCargo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [dependencia, setDependencia] = useState('');

  /* ─── Step 2 ─────────────────────────────────── */
  const [conceptoGasto, setConceptoGasto] = useState('viaje');
  const [descripcionGasto, setDescripcionGasto] = useState('');
  const [fechaEvento, setFechaEvento] = useState('');
  const [destino, setDestino] = useState('');
  const [numeroDias, setNumeroDias] = useState('');

  /* ─── Step 3 ─────────────────────────────────── */
  const [items, setItems] = useState<ItemGasto[]>([
    { id: uid(), concepto: '', descripcion: '', valor: '' },
  ]);

  const total = items.reduce((s, it) => s + (parseFloat(it.valor.replace(/\D/g, '')) || 0), 0);

  function addItem() {
    setItems((p) => [...p, { id: uid(), concepto: '', descripcion: '', valor: '' }]);
  }
  function removeItem(id: string) {
    setItems((p) => p.filter((x) => x.id !== id));
  }
  function setItemField(id: string, field: keyof ItemGasto, value: string) {
    setItems((p) => p.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  }

  /* ─── Step 4 ─────────────────────────────────── */
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('Ahorros');
  const [numeroCuenta, setNumeroCuenta] = useState('');

  /* ─── Step 5 ─────────────────────────────────── */
  const [firma, setFirma] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  /* ─── Load tipo anticipo ─────────────────────── */
  useEffect(() => {
    api.get<TipoInfo[]>('/tipos').then((r) => {
      const t = r.data.find(
        (x) => normTxt(x.slug ?? '') === 'anticipo' || normTxt(x.nombre) === 'anticipo',
      );
      setTipo(t ?? null);
    }).catch(() => {});
  }, []);

  /* ─── Validación por paso ────────────────────── */
  function validarPasoActual(): string {
    if (paso === 1) {
      if (!cargo.trim()) return 'Escribe tu cargo.';
      if (!telefono.trim()) return 'Escribe tu teléfono de contacto.';
    }
    if (paso === 2) {
      if (!descripcionGasto.trim()) return 'Describe el propósito del anticipo.';
      if (!fechaEvento) return 'Selecciona la fecha del evento o actividad.';
    }
    if (paso === 3) {
      const validos = items.filter((it) => it.concepto.trim() && parseFloat(it.valor.replace(/\D/g, '')) > 0);
      if (validos.length === 0) return 'Agrega al menos un ítem con concepto y valor.';
      if (total <= 0) return 'El valor total del anticipo debe ser mayor a 0.';
    }
    if (paso === 4) {
      if (!banco) return 'Selecciona el banco.';
      if (!numeroCuenta.trim()) return 'Escribe el número de cuenta.';
    }
    return '';
  }

  function siguiente() {
    const err = validarPasoActual();
    if (err) { setError(err); return; }
    setError('');
    setPaso((p) => Math.min(p + 1, PASOS.length));
  }

  async function enviar() {
    if (!firma) { setError('Firma requerida para continuar.'); return; }
    if (!tipo) { setError('No se encontró el tipo "Anticipo". Créalo primero en Panel administrador → Tipos de solicitud con slug "anticipo".'); return; }
    setEnviando(true);
    setError('');
    try {
      const r = await api.post<{ id: number; numeroRadicado: string }>('/solicitudes', {
        tipoSolicitudId: tipo.id,
        datos: {
          solicitanteNombre: nombreSesion,
          cargo,
          dependencia,
          telefono,
          conceptoGasto,
          descripcionGasto,
          fechaEvento,
          destino,
          numeroDias,
          items: JSON.stringify(items.filter((it) => it.concepto.trim() && parseFloat(it.valor.replace(/\D/g, '')) > 0)),
          valorPesos: String(total),
          banco,
          tipoCuenta,
          numeroCuenta,
        },
        firmas: { profesional: firma },
      });
      onCreada?.({ id: r.data.id, numeroRadicado: r.data.numeroRadicado });
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'No se pudo registrar el anticipo.');
    } finally {
      setEnviando(false);
    }
  }

  const mostrarDestino = conceptoGasto === 'viaje' || conceptoGasto === 'hospedaje';

  return (
    <div className="anticipo-panel card-surface">
      {/* Indicador de pasos */}
      <div className="nueva-sol-substeps">
        {PASOS.map((nombre, i) => (
          <span
            key={nombre}
            className={`nueva-sol-substep${paso === i + 1 ? ' active' : ''}${paso > i + 1 ? ' done' : ''}`}
          >
            {i + 1}. {nombre}
          </span>
        ))}
      </div>

      {error ? <div className="admin-error" style={{ marginBottom: 14 }}>{error}</div> : null}

      {/* ═══ PASO 1: DATOS DEL FORMATO ═══ */}
      {paso === 1 ? (
        <div className="anticipo-paso">
          <h4 className="anticipo-paso-titulo">Datos del formato</h4>
          <div className="anticipo-grid">
            <div className="form-group form-group--wide">
              <label>Nombre del solicitante</label>
              <input type="text" value={nombreSesion} disabled className="input-disabled" />
            </div>
            <div className="form-group">
              <label>Cargo / Posición <span className="req">*</span></label>
              <input
                type="text"
                placeholder="Ej: Analista de proyectos"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Área / Dependencia</label>
              <input
                type="text"
                placeholder="Ej: Dirección de operaciones"
                value={dependencia}
                onChange={(e) => setDependencia(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Teléfono de contacto <span className="req">*</span></label>
              <input
                type="tel"
                placeholder="Ej: 3001234567"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ PASO 2: CONCEPTO ═══ */}
      {paso === 2 ? (
        <div className="anticipo-paso">
          <h4 className="anticipo-paso-titulo">Concepto del anticipo</h4>
          <div className="form-group form-group--wide">
            <label>Tipo de gasto <span className="req">*</span></label>
            <div className="anticipo-concepto-grid">
              {CONCEPTOS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`anticipo-concepto-btn${conceptoGasto === c.key ? ' selected' : ''}`}
                  onClick={() => setConceptoGasto(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="anticipo-grid">
            <div className="form-group form-group--wide">
              <label>Descripción detallada del propósito <span className="req">*</span></label>
              <textarea
                rows={3}
                placeholder="Explica para qué se necesita el dinero, qué actividad se realizará, etc."
                value={descripcionGasto}
                onChange={(e) => setDescripcionGasto(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Fecha del evento / actividad <span className="req">*</span></label>
              <input
                type="date"
                value={fechaEvento}
                onChange={(e) => setFechaEvento(e.target.value)}
              />
            </div>
            {mostrarDestino ? (
              <div className="form-group">
                <label>Destino / Ciudad</label>
                <input
                  type="text"
                  placeholder="Ej: Medellín, Colombia"
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                />
              </div>
            ) : null}
            <div className="form-group">
              <label>Número de días</label>
              <input
                type="number"
                min="1"
                placeholder="Ej: 3"
                value={numeroDias}
                onChange={(e) => setNumeroDias(e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ PASO 3: DESGLOSE ECONÓMICO ═══ */}
      {paso === 3 ? (
        <div className="anticipo-paso">
          <h4 className="anticipo-paso-titulo">Desglose del gasto solicitado</h4>
          <p className="admin-help-text" style={{ marginBottom: 12 }}>
            Detalla cada gasto que compone el anticipo. Al final se calculará el total.
          </p>
          <div className="anticipo-tabla-wrap">
            <table className="anticipo-tabla">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Descripción</th>
                  <th>Valor ($)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <input
                        type="text"
                        placeholder="Ej: Tiquete aéreo"
                        value={it.concepto}
                        onChange={(e) => setItemField(it.id, 'concepto', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="Descripción breve"
                        value={it.descripcion}
                        onChange={(e) => setItemField(it.id, 'descripcion', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={it.valor ? formatearMiles(it.valor) : ''}
                        onChange={(e) => setItemField(it.id, 'valor', e.target.value.replace(/\D/g, ''))}
                        style={{ textAlign: 'right' }}
                      />
                    </td>
                    <td>
                      {items.length > 1 ? (
                        <button
                          type="button"
                          className="admin-ghost-button"
                          style={{ padding: '4px 8px', fontSize: 14 }}
                          onClick={() => removeItem(it.id)}
                        >✕</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="admin-ghost-button tabla-items-add" onClick={addItem}>
            ➕ Agregar ítem
          </button>
          {total > 0 ? (
            <div className="anticipo-total-box">
              <div className="anticipo-total-row">
                <span>Total solicitado</span>
                <strong className="anticipo-total-valor">$ {formatearMiles(String(total))}</strong>
              </div>
              <div className="anticipo-total-letras">{numeroAPesosEnLetras(String(total))}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ═══ PASO 4: CUENTA BANCARIA ═══ */}
      {paso === 4 ? (
        <div className="anticipo-paso">
          <h4 className="anticipo-paso-titulo">Cuenta para el desembolso</h4>
          <p className="admin-help-text" style={{ marginBottom: 12 }}>
            Indica la cuenta donde se realizará el desembolso del anticipo.
          </p>
          <div className="anticipo-grid">
            <div className="form-group">
              <label>Banco <span className="req">*</span></label>
              <select value={banco} onChange={(e) => setBanco(e.target.value)}>
                <option value="">— selecciona banco —</option>
                {BANCOS_COLOMBIA.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Tipo de cuenta</label>
              <select value={tipoCuenta} onChange={(e) => setTipoCuenta(e.target.value)}>
                {TIPOS_CUENTA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group form-group--wide">
              <label>Número de cuenta <span className="req">*</span></label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej: 1234567890"
                value={numeroCuenta}
                onChange={(e) => setNumeroCuenta(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ PASO 5: FIRMA Y COMPROMISO ═══ */}
      {paso === 5 ? (
        <div className="anticipo-paso">
          <h4 className="anticipo-paso-titulo">Compromiso y firma</h4>
          <div className="anticipo-compromiso-box">
            <p>
              Yo, <strong>{nombreSesion || 'el/la solicitante'}</strong>, declaro que la información
              suministrada es veraz y me comprometo a legalizar el anticipo de{' '}
              <strong>$ {formatearMiles(String(total))}</strong> ({numeroAPesosEnLetras(String(total))})
              mediante la presentación de las facturas o soportes correspondientes dentro del plazo
              establecido por la institución, de acuerdo con la política de anticipos vigente.
            </p>
            <p style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              Concepto: <em>{CONCEPTOS.find((c) => c.key === conceptoGasto)?.label ?? conceptoGasto}</em>
              {fechaEvento ? ` · Fecha: ${fechaEvento}` : ''}
              {destino ? ` · Destino: ${destino}` : ''}
            </p>
          </div>
          <div className="form-group form-group--wide" style={{ marginTop: 16 }}>
            <label>Firma digital <span className="req">*</span></label>
            <SignaturePad onChange={setFirma} />
          </div>
        </div>
      ) : null}

      {/* ─── Navegación de pasos ─── */}
      <div className="nueva-sol-actions">
        {paso > 1 ? (
          <button type="button" className="admin-ghost-button" onClick={() => { setError(''); setPaso((p) => p - 1); }}>
            ← Anterior
          </button>
        ) : null}
        {paso < PASOS.length ? (
          <button type="button" className="admin-primary-button" onClick={siguiente}>
            Siguiente →
          </button>
        ) : (
          <button
            type="button"
            className="admin-primary-button"
            disabled={enviando || !firma}
            onClick={enviar}
          >
            {enviando ? 'Enviando…' : '📤 Enviar solicitud de anticipo'}
          </button>
        )}
      </div>
    </div>
  );
}
