import { useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { SignaturePad } from '../../components/SignaturePad';
import { BANCOS_COLOMBIA } from '../../utils/bancos';
import { formatearMiles } from '../../utils/numeroALetras';
import { getAuthSession } from '../auth/auth.service';

interface CuentaCobroOpsPanelProps {
  onCreada?: (info: { id: number; numeroRadicado: string }) => void;
  tipoSolicitudId?: number;
  areaId?: number;
}

const TIPOS_DOC = ['CC', 'CE', 'TI', 'PA', 'NIT'];
const TIPOS_CUENTA = ['Ahorros', 'Corriente'];

export function CuentaCobroOpsPanel({ onCreada, tipoSolicitudId, areaId }: CuentaCobroOpsPanelProps) {
  const [paso, setPaso] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [tipoId, setTipoId] = useState<number | null>(tipoSolicitudId ?? null);
  const [areaSolId, setAreaSolId] = useState<number | null>(areaId ?? null);

  // Paso 1 – Datos del contrato
  const [numeroContrato, setNumeroContrato] = useState('');
  const [objetoContrato, setObjetoContrato] = useState('');
  const [fechaInicioContrato, setFechaInicioContrato] = useState('');
  const [fechaFinContrato, setFechaFinContrato] = useState('');
  const [valorTotalContrato, setValorTotalContrato] = useState('');

  // Paso 2 – Datos del cobro
  const [numeroCuentaCobro, setNumeroCuentaCobro] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [valorCobrar, setValorCobrar] = useState('');
  const [actividadesRealizadas, setActividadesRealizadas] = useState('');

  // Paso 3 – Datos personales (editables)
  const [formTipoDoc, setFormTipoDoc] = useState('CC');
  const [formNumDoc, setFormNumDoc] = useState('');
  const [formPrimerNombre, setFormPrimerNombre] = useState('');
  const [formSegundoNombre, setFormSegundoNombre] = useState('');
  const [formPrimerApellido, setFormPrimerApellido] = useState('');
  const [formSegundoApellido, setFormSegundoApellido] = useState('');
  const [formFechaNac, setFormFechaNac] = useState('');
  const [formFechaExp, setFormFechaExp] = useState('');
  const [formLugarExp, setFormLugarExp] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  // Paso 3 – Datos bancarios
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('Ahorros');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [titularCuenta, setTitularCuenta] = useState('');

  // Paso 3 – EPS
  const [eps, setEps] = useState('');

  // Paso 4 – Documentos adjuntos
  const [docCertServiciosId, setDocCertServiciosId] = useState('');
  const [docCertServiciosNombre, setDocCertServiciosNombre] = useState('');
  const [docCartaEpsId, setDocCartaEpsId] = useState('');
  const [docCartaEpsNombre, setDocCartaEpsNombre] = useState('');
  const [docAfiliacionesId, setDocAfiliacionesId] = useState('');
  const [docAfiliacionesNombre, setDocAfiliacionesNombre] = useState('');
  const [docPanaceaId, setDocPanaceaId] = useState('');
  const [docPanaceaNombre, setDocPanaceaNombre] = useState('');
  const [docCuentaId, setDocCuentaId] = useState('');
  const [docCuentaNombre, setDocCuentaNombre] = useState('');
  const [docDocumentoId, setDocDocumentoId] = useState('');
  const [docDocumentoNombre, setDocDocumentoNombre] = useState('');
  const [docRutId, setDocRutId] = useState('');
  const [docRutNombre, setDocRutNombre] = useState('');
  const [opsAlDia, setOpsAlDia] = useState(false);
  const [esNuevo, setEsNuevo] = useState(false);
  const [subiendoDoc, setSubiendoDoc] = useState<string | null>(null);

  // Paso 5 – Firma
  const [firma, setFirma] = useState('');

  // Auto-crear tipo si no fue pasado como prop
  useEffect(() => {
    if (tipoId) return;
    api.post<{ id: number; areaId: number }>('/tipos/ensure', { slug: 'cuenta-cobro-ops' })
      .then((r) => {
        setTipoId(r.data.id);
        if (!areaSolId) setAreaSolId(r.data.areaId);
      })
      .catch(() => {
        // Intentar obtener por listado de tipos
        api.get<Array<{ id: number; slug: string; areaId: number }>>('/tipos').then((r) => {
          const t = r.data.find((x) => x.slug === 'cuenta-cobro-ops');
          if (t) { setTipoId(t.id); if (!areaSolId) setAreaSolId(t.areaId); }
        }).catch(() => {});
      });
  }, []);

  // Pre-llenar desde perfil
  useEffect(() => {
    api.get<Record<string, string>>('/usuarios/perfil').then((r) => {
      const s = getAuthSession();
      const u = s?.usuario;
      if (r.data.tipoDocumento) setFormTipoDoc(r.data.tipoDocumento);
      const num = r.data.numeroDocumento || (u?.numeroDocumento as string | undefined) || '';
      if (num) setFormNumDoc(num);
      const pn = r.data.primerNombre || (u?.primerNombre as string | undefined) || u?.nombreCompleto?.split(' ')[0] || '';
      setFormPrimerNombre(pn);
      setFormSegundoNombre(r.data.segundoNombre || '');
      const pa = r.data.primerApellido || (u?.primerApellido as string | undefined) || '';
      setFormPrimerApellido(pa);
      setFormSegundoApellido(r.data.segundoApellido || '');
      setFormFechaNac(r.data.fechaNacimiento || '');
      setFormFechaExp(r.data.fechaExpedicion || '');
      setFormLugarExp(r.data.lugarExpedicion || '');
      setFormTelefono(r.data.telefono || '');
      if (r.data.banco) setBanco(r.data.banco);
      if (r.data.tipoCuenta) setTipoCuenta(r.data.tipoCuenta === 'corriente' ? 'Corriente' : 'Ahorros');
      if (r.data.numeroCuenta) setNumeroCuenta(r.data.numeroCuenta);
      if (r.data.titularCuenta) setTitularCuenta(r.data.titularCuenta);
      // EPS y documentos pre-guardados en perfil
      if (r.data.eps) setEps(r.data.eps);
      if (r.data.archivoEpsId) { setDocAfiliacionesId(r.data.archivoEpsId); setDocAfiliacionesNombre(r.data.archivoEpsNombre || 'Certificado EPS (perfil)'); }
      if (r.data.archivoCartaEpsId) { setDocCartaEpsId(r.data.archivoCartaEpsId); setDocCartaEpsNombre(r.data.archivoCartaEpsNombre || 'Carta EPS (perfil)'); }
      if (r.data.archivoDocumentoId) { setDocDocumentoId(r.data.archivoDocumentoId); setDocDocumentoNombre(r.data.archivoDocumentoNombre || 'Doc. identidad (perfil)'); }
      if (r.data.archivoCuentaId) { setDocCuentaId(r.data.archivoCuentaId); setDocCuentaNombre(r.data.archivoCuentaNombre || 'Cert. bancario (perfil)'); }
      if (r.data.archivoRutId) { setDocRutId(r.data.archivoRutId); setDocRutNombre(r.data.archivoRutNombre || 'RUT (perfil)'); }
    }).catch(() => {});
  }, []);

  async function subirDoc(file: File, campo: string) {
    setSubiendoDoc(campo);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const r = await api.post<{ id: string }>('/archivos', fd, { headers: { 'Content-Type': undefined } });
      const id = r.data.id; const nom = file.name;
      if (campo === 'certServicios') { setDocCertServiciosId(id); setDocCertServiciosNombre(nom); }
      else if (campo === 'cartaEps')  { setDocCartaEpsId(id);     setDocCartaEpsNombre(nom); }
      else if (campo === 'afiliaciones') { setDocAfiliacionesId(id); setDocAfiliacionesNombre(nom); }
      else if (campo === 'panacea')   { setDocPanaceaId(id);      setDocPanaceaNombre(nom); }
      else if (campo === 'cuenta')    { setDocCuentaId(id);       setDocCuentaNombre(nom); }
      else if (campo === 'documento') { setDocDocumentoId(id);    setDocDocumentoNombre(nom); }
      else if (campo === 'rut')       { setDocRutId(id);          setDocRutNombre(nom); }
    } catch {
      setErr('No se pudo subir el archivo. Máx 10 MB, formatos: PDF, JPG, PNG.');
    } finally {
      setSubiendoDoc(null);
    }
  }

  function validarPaso(): string {
    if (paso === 1) {
      if (!numeroContrato.trim()) return 'Ingresa el número de contrato u OPS';
      if (!objetoContrato.trim()) return 'Ingresa el objeto del contrato';
      if (!periodoInicio || !periodoFin) return 'Define el período del cobro (fecha inicio y fin)';
    }
    if (paso === 2) {
      if (!valorCobrar.trim()) return 'Ingresa el valor a cobrar';
      if (!actividadesRealizadas.trim()) return 'Describe las actividades realizadas en el período';
    }
    if (paso === 3) {
      if (!formTipoDoc) return 'Selecciona el tipo de documento';
      if (!formNumDoc.trim()) return 'Ingresa tu número de documento';
      if (!formPrimerNombre.trim()) return 'Ingresa tu primer nombre';
      if (!formPrimerApellido.trim()) return 'Ingresa tu primer apellido';
      if (!banco) return 'Selecciona el banco';
      if (!numeroCuenta.trim()) return 'Ingresa el número de cuenta bancaria';
      if (!titularCuenta.trim()) return 'Ingresa el titular de la cuenta';
    }
    if (paso === 4) {
      if (!docCertServiciosId) return 'Debes adjuntar el Certificado de prestación de servicios';
      if (!docPanaceaId) return 'Debes adjuntar la constancia de cargue en Panacea o 360';
      if (!opsAlDia) return 'Debes marcar la Certificación de OPS al día para continuar';
      if (esNuevo && !docDocumentoId) return 'Para colaboradores nuevos debes adjuntar la copia del documento de identidad';
      if (esNuevo && !docRutId) return 'Para colaboradores nuevos debes adjuntar la copia del RUT';
    }
    if (paso === 5) {
      if (!firma) return 'La firma es obligatoria';
    }
    return '';
  }

  function siguiente() {
    const e = validarPaso();
    if (e) { setErr(e); return; }
    setErr('');
    setPaso((p) => Math.min(5, p + 1) as typeof paso);
  }
  function anterior() { setErr(''); setPaso((p) => Math.max(1, p - 1) as typeof paso); }

  async function enviar() {
    const e = validarPaso();
    if (e) { setErr(e); return; }
    if (!tipoId) { setErr('No se encontró el tipo de solicitud. Recarga la página.'); return; }
    setErr('');
    setEnviando(true);
    try {
      const usr = getAuthSession()?.usuario;
      const payload = {
        tipoSolicitudId: tipoId,
        ...(areaSolId ? { areaId: areaSolId } : {}),
        datos: {
          // Contrato
          numeroContrato,
          objetoContrato,
          fechaInicioContrato,
          fechaFinContrato,
          valorTotalContrato,
          // Cobro
          numeroCuentaCobro,
          periodoInicio,
          periodoFin,
          valorCobrar,
          actividadesRealizadas,
          // Personales (camelCase + snake_case)
          tipoDocumento: formTipoDoc, tipo_documento: formTipoDoc,
          numeroDocumento: formNumDoc, numero_documento: formNumDoc,
          primerNombre: formPrimerNombre, primer_nombre: formPrimerNombre,
          segundoNombre: formSegundoNombre, segundo_nombre: formSegundoNombre,
          primerApellido: formPrimerApellido, primer_apellido: formPrimerApellido,
          segundoApellido: formSegundoApellido, segundo_apellido: formSegundoApellido,
          fechaNacimiento: formFechaNac, fecha_nacimiento: formFechaNac,
          fechaExpedicion: formFechaExp, fecha_expedicion: formFechaExp,
          lugarExpedicion: formLugarExp, lugar_expedicion: formLugarExp,
          telefono: formTelefono,
          nombreCompleto: usr?.nombreCompleto ?? '',
          correoElectronico: usr?.correo ?? '',
          // Bancarios
          banco, tipoCuenta, numeroCuenta, titularCuenta,
          // EPS
          eps, entidadSalud: eps,
          // Declaraciones
          opsAlDia: opsAlDia ? 'si' : 'no',
          esNuevoColaborador: esNuevo ? 'si' : 'no',
        },
        documentos: {
          ...(docCertServiciosId ? { certificadoPrestacionServicios: { nombre: docCertServiciosNombre, archivoId: docCertServiciosId } } : {}),
          ...(docCartaEpsId ? { cartaEps: { nombre: docCartaEpsNombre, archivoId: docCartaEpsId } } : {}),
          ...(docAfiliacionesId ? { certificadoEpsAdres: { nombre: docAfiliacionesNombre, archivoId: docAfiliacionesId } } : {}),
          ...(docPanaceaId ? { constanciaPanacea360: { nombre: docPanaceaNombre, archivoId: docPanaceaId } } : {}),
          ...(docCuentaId ? { certificadoCuentaBancaria: { nombre: docCuentaNombre, archivoId: docCuentaId } } : {}),
          ...(docDocumentoId ? { copiaDocumentoIdentidad: { nombre: docDocumentoNombre, archivoId: docDocumentoId } } : {}),
          ...(docRutId ? { copiaRut: { nombre: docRutNombre, archivoId: docRutId } } : {}),
        },
        firmas: { profesional: firma },
      };
      const res = await api.post<{ id: number; numeroRadicado: string }>('/solicitudes', payload);
      setMsg(`Cuenta de cobro radicada exitosamente. Radicado: ${res.data.numeroRadicado}`);
      onCreada?.({ id: res.data.id, numeroRadicado: res.data.numeroRadicado });
    } catch (ex: unknown) {
      const m = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(m || 'Error al enviar. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (msg) {
    return (
      <div className="leg-success card-surface">
        <div className="leg-success-icon">✓</div>
        <h3>Cuenta de cobro radicada</h3>
        <p>{msg}</p>
        <p className="leg-nota">Puedes hacer seguimiento en <strong>Mis solicitudes</strong>.</p>
        <button type="button" className="admin-primary-button"
          onClick={() => { setMsg(''); setPaso(1); setNumeroContrato(''); setObjetoContrato(''); setValorCobrar(''); setActividadesRealizadas(''); setFirma(''); setDocCertServiciosId(''); setDocCertServiciosNombre(''); setDocCartaEpsId(''); setDocCartaEpsNombre(''); setDocPanaceaId(''); setDocPanaceaNombre(''); setOpsAlDia(false); setEsNuevo(false); setDocRutId(''); setDocRutNombre(''); }}>
          Nueva cuenta de cobro
        </button>
      </div>
    );
  }

  const pasos = ['Contrato', 'Cobro', 'Datos personales y bancarios', 'Documentos', 'Firma'];

  return (
    <div className="leg-panel">
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

      {/* ── Paso 1: Datos del contrato ── */}
      {paso === 1 && (
        <div className="leg-form card-surface">
          <h3>Datos del contrato OPS</h3>

          <div className="leg-field-row">
            <div className="leg-field">
              <label>Número de contrato / OPS *</label>
              <input type="text" value={numeroContrato}
                onChange={(e) => setNumeroContrato(e.target.value)}
                placeholder="Ej: OPS-2024-0123" />
            </div>
            <div className="leg-field">
              <label>Número de cuenta de cobro</label>
              <input type="text" value={numeroCuentaCobro}
                onChange={(e) => setNumeroCuentaCobro(e.target.value)}
                placeholder="Ej: 01, 02, …" />
            </div>
          </div>

          <div className="leg-field">
            <label>Objeto del contrato *</label>
            <textarea value={objetoContrato} onChange={(e) => setObjetoContrato(e.target.value)}
              rows={3}
              placeholder="Describe el servicio o actividad contratada tal como aparece en el contrato" />
          </div>

          <div className="leg-field-row">
            <div className="leg-field">
              <label>Fecha de inicio del contrato</label>
              <input type="date" value={fechaInicioContrato}
                onChange={(e) => setFechaInicioContrato(e.target.value)} />
            </div>
            <div className="leg-field">
              <label>Fecha de terminación del contrato</label>
              <input type="date" value={fechaFinContrato}
                onChange={(e) => setFechaFinContrato(e.target.value)} />
            </div>
          </div>

          <div className="leg-field-row">
            <div className="leg-field">
              <label>Período del cobro — desde *</label>
              <input type="date" value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)} />
            </div>
            <div className="leg-field">
              <label>Período del cobro — hasta *</label>
              <input type="date" value={periodoFin}
                onChange={(e) => setPeriodoFin(e.target.value)} />
            </div>
          </div>

          <div className="leg-field">
            <label>Valor total del contrato</label>
            <input type="text" inputMode="numeric" value={valorTotalContrato}
              onChange={(e) => setValorTotalContrato(e.target.value.replace(/\D/g, ''))}
              placeholder="Valor total pactado en el contrato" />
            {valorTotalContrato && (
              <span className="leg-nota">$ {formatearMiles(valorTotalContrato)}</span>
            )}
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Datos del cobro
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 2: Datos del cobro ── */}
      {paso === 2 && (
        <div className="leg-form card-surface">
          <h3>Datos del cobro</h3>

          <div className="leg-field">
            <label>Valor a cobrar en este período *</label>
            <input type="text" inputMode="numeric" value={valorCobrar}
              onChange={(e) => setValorCobrar(e.target.value.replace(/\D/g, ''))}
              placeholder="Valor en pesos colombianos" />
            {valorCobrar && (
              <span className="leg-nota">$ {formatearMiles(valorCobrar)}</span>
            )}
          </div>

          <div className="leg-field">
            <label>Actividades realizadas en el período *</label>
            <textarea value={actividadesRealizadas}
              onChange={(e) => setActividadesRealizadas(e.target.value)}
              rows={5}
              placeholder="Describe detalladamente las actividades y productos entregados en este período..." />
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Datos personales
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 3: Datos personales + bancarios ── */}
      {paso === 3 && (
        <div className="leg-form card-surface">
          <h3>Datos personales y bancarios</h3>
          <p className="leg-nota">Verifica o completa tus datos — aparecerán en la cuenta de cobro.</p>

          <div className="leg-seccion-personal">
            <h4>Identificación</h4>
            <div className="leg-field-row">
              <div className="leg-field">
                <label>Tipo de documento *</label>
                <select value={formTipoDoc} onChange={(e) => setFormTipoDoc(e.target.value)}>
                  {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="leg-field">
                <label>Número de documento *</label>
                <input type="text" inputMode="numeric" value={formNumDoc}
                  onChange={(e) => setFormNumDoc(e.target.value)}
                  placeholder="Sin puntos ni guiones" />
              </div>
            </div>
            <div className="leg-field-row">
              <div className="leg-field">
                <label>Primer nombre *</label>
                <input type="text" value={formPrimerNombre}
                  onChange={(e) => setFormPrimerNombre(e.target.value)} />
              </div>
              <div className="leg-field">
                <label>Segundo nombre</label>
                <input type="text" value={formSegundoNombre}
                  onChange={(e) => setFormSegundoNombre(e.target.value)} placeholder="(opcional)" />
              </div>
            </div>
            <div className="leg-field-row">
              <div className="leg-field">
                <label>Primer apellido *</label>
                <input type="text" value={formPrimerApellido}
                  onChange={(e) => setFormPrimerApellido(e.target.value)} />
              </div>
              <div className="leg-field">
                <label>Segundo apellido</label>
                <input type="text" value={formSegundoApellido}
                  onChange={(e) => setFormSegundoApellido(e.target.value)} placeholder="(opcional)" />
              </div>
            </div>
            <div className="leg-field-row">
              <div className="leg-field">
                <label>Fecha de nacimiento</label>
                <input type="date" value={formFechaNac}
                  onChange={(e) => setFormFechaNac(e.target.value)} />
              </div>
              <div className="leg-field">
                <label>Fecha de expedición del documento</label>
                <input type="date" value={formFechaExp}
                  onChange={(e) => setFormFechaExp(e.target.value)} />
              </div>
            </div>
            <div className="leg-field-row">
              <div className="leg-field">
                <label>Lugar de expedición</label>
                <input type="text" value={formLugarExp}
                  onChange={(e) => setFormLugarExp(e.target.value)}
                  placeholder="Ciudad" />
              </div>
              <div className="leg-field">
                <label>Teléfono de contacto</label>
                <input type="tel" value={formTelefono}
                  onChange={(e) => setFormTelefono(e.target.value)}
                  placeholder="Celular o fijo" />
              </div>
            </div>
            <div className="leg-field" style={{ marginTop: 10 }}>
              <label>EPS a la que está afiliado</label>
              <input type="text" value={eps}
                onChange={(e) => setEps(e.target.value)}
                placeholder="Ej: Sura, Nueva EPS, Sanitas…" />
            </div>
          </div>

          <div className="leg-seccion-personal">
            <h4>Datos bancarios para el pago</h4>
            <div className="leg-field">
              <label>Banco *</label>
              <select value={banco} onChange={(e) => setBanco(e.target.value)}>
                <option value="">— Selecciona el banco —</option>
                {BANCOS_COLOMBIA.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="leg-field">
              <label>Tipo de cuenta *</label>
              <div className="leg-radio-group">
                {TIPOS_CUENTA.map((t) => (
                  <label key={t} className="leg-radio-item">
                    <input type="radio" name="tipoCuentaOps" value={t}
                      checked={tipoCuenta === t} onChange={() => setTipoCuenta(t)} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div className="leg-field-row">
              <div className="leg-field">
                <label>Número de cuenta *</label>
                <input type="text" inputMode="numeric" value={numeroCuenta}
                  onChange={(e) => setNumeroCuenta(e.target.value.replace(/\D/g, ''))}
                  placeholder="Sin espacios ni guiones" />
              </div>
              <div className="leg-field">
                <label>Titular de la cuenta *</label>
                <input type="text" value={titularCuenta}
                  onChange={(e) => setTitularCuenta(e.target.value)}
                  placeholder="Nombre completo del titular" />
              </div>
            </div>
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Documentos
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 4: Documentos adjuntos ── */}
      {paso === 4 && (
        <div className="leg-form card-surface">
          <h3>Documentos adjuntos</h3>
          <p className="leg-nota">Adjunta los soportes requeridos. Los marcados con <strong>✦</strong> se cargan automáticamente desde tu perfil. PDF, JPG o PNG · máx. 10 MB.</p>

          {/* ── Grupo 1: Documentos del período (subir cada vez) ── */}
          <h4 style={{ marginTop: 16, marginBottom: 8, fontSize: 12, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Documentos del período</h4>

          {/* 1. Certificado de prestación de servicios */}
          <div className="leg-field">
            <label>Certificado de prestación de servicios *</label>
            <p className="leg-nota" style={{ marginBottom: 6 }}>Documento que certifica los servicios prestados durante el período cobrado.</p>
            <div className="leg-factura-actions" style={{ display: 'flex', gap: 8 }}>
              {subiendoDoc === 'certServicios' ? <span className="leg-validando">Subiendo…</span> : (
                <label className="admin-ghost-button" style={{ cursor: 'pointer' }}>
                  {docCertServiciosNombre ? `✓ ${docCertServiciosNombre}` : '+ Adjuntar certificado'}
                  <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDoc(f, 'certServicios'); e.target.value = ''; }} />
                </label>
              )}
              {docCertServiciosNombre && subiendoDoc !== 'certServicios' && (
                <button type="button" className="admin-ghost-button" style={{ fontSize: 12 }} onClick={() => { setDocCertServiciosId(''); setDocCertServiciosNombre(''); }}>✕</button>
              )}
            </div>
          </div>

          {/* 2. Cargue en Panacea o 360 */}
          <div className="leg-field" style={{ marginTop: 14 }}>
            <label>Cargue en Panacea o 360 *</label>
            <p className="leg-nota" style={{ marginBottom: 6 }}>Constancia del registro del servicio prestado en el sistema Panacea o 360 (pantallazo o reporte).</p>
            <div className="leg-factura-actions" style={{ display: 'flex', gap: 8 }}>
              {subiendoDoc === 'panacea' ? <span className="leg-validando">Subiendo…</span> : (
                <label className="admin-ghost-button" style={{ cursor: 'pointer' }}>
                  {docPanaceaNombre ? `✓ ${docPanaceaNombre}` : '+ Adjuntar constancia Panacea / 360'}
                  <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDoc(f, 'panacea'); e.target.value = ''; }} />
                </label>
              )}
              {docPanaceaNombre && subiendoDoc !== 'panacea' && (
                <button type="button" className="admin-ghost-button" style={{ fontSize: 12 }} onClick={() => { setDocPanaceaId(''); setDocPanaceaNombre(''); }}>✕</button>
              )}
            </div>
          </div>

          {/* 3. Declaración OPS al día */}
          <div className="leg-field" style={{ marginTop: 14 }}>
            <label className="leg-check-label" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={opsAlDia} onChange={(e) => setOpsAlDia(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0 }} />
              <span>
                <strong>Certificación de OPS al día *</strong><br />
                <span className="leg-nota">Declaro bajo la gravedad de juramento que no tengo cuentas de cobro de períodos anteriores pendientes por radicar en esta institución.</span>
              </span>
            </label>
          </div>

          {/* ── Grupo 2: Documentos del profesional (desde perfil) ── */}
          <h4 style={{ marginTop: 20, marginBottom: 8, fontSize: 12, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Documentos del profesional ✦ desde perfil</h4>

          {/* 4. Carta EPS */}
          <div className="leg-field">
            <label>Carta informando EPS a la que está afiliado{docCartaEpsNombre.includes('perfil') ? ' ✦' : ''}</label>
            <p className="leg-nota" style={{ marginBottom: 6 }}>
              Carta o constancia que informa a qué EPS está afiliado.
              {docCartaEpsId && docCartaEpsNombre.includes('perfil') ? ' Cargado desde tu perfil.' : ''}
            </p>
            <div className="leg-factura-actions" style={{ display: 'flex', gap: 8 }}>
              {subiendoDoc === 'cartaEps' ? <span className="leg-validando">Subiendo…</span> : (
                <label className="admin-ghost-button" style={{ cursor: 'pointer' }}>
                  {docCartaEpsNombre ? `✓ ${docCartaEpsNombre}` : '+ Adjuntar carta EPS'}
                  <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDoc(f, 'cartaEps'); e.target.value = ''; }} />
                </label>
              )}
              {docCartaEpsNombre && subiendoDoc !== 'cartaEps' && (
                <button type="button" className="admin-ghost-button" style={{ fontSize: 12 }} onClick={() => { setDocCartaEpsId(''); setDocCartaEpsNombre(''); }}>✕</button>
              )}
            </div>
          </div>

          {/* 5. Certificado de EPS / ADRES */}
          <div className="leg-field" style={{ marginTop: 14 }}>
            <label>Certificado de EPS o consulta ADRES{docAfiliacionesNombre.includes('perfil') ? ' ✦' : ''}</label>
            <p className="leg-nota" style={{ marginBottom: 6 }}>
              Certificado que evidencia que está activo en EPS (afiliaciones EPS / ARL / Pensión o consulta ADRES).
              {docAfiliacionesId && docAfiliacionesNombre.includes('perfil') ? ' Cargado desde tu perfil.' : ''}
            </p>
            <div className="leg-factura-actions" style={{ display: 'flex', gap: 8 }}>
              {subiendoDoc === 'afiliaciones' ? <span className="leg-validando">Subiendo…</span> : (
                <label className="admin-ghost-button" style={{ cursor: 'pointer' }}>
                  {docAfiliacionesNombre ? `✓ ${docAfiliacionesNombre}` : '+ Adjuntar certificado EPS / ADRES'}
                  <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDoc(f, 'afiliaciones'); e.target.value = ''; }} />
                </label>
              )}
              {docAfiliacionesNombre && subiendoDoc !== 'afiliaciones' && (
                <button type="button" className="admin-ghost-button" style={{ fontSize: 12 }} onClick={() => { setDocAfiliacionesId(''); setDocAfiliacionesNombre(''); }}>✕</button>
              )}
            </div>
          </div>

          {/* 6. Certificación bancaria */}
          <div className="leg-field" style={{ marginTop: 14 }}>
            <label>Copia de certificación bancaria{docCuentaNombre.includes('perfil') ? ' ✦' : ''}</label>
            <p className="leg-nota" style={{ marginBottom: 6 }}>
              Certificado del banco que acredita la cuenta para el pago.
              {docCuentaId && docCuentaNombre.includes('perfil') ? ' Cargado desde tu perfil.' : ''}
            </p>
            <div className="leg-factura-actions" style={{ display: 'flex', gap: 8 }}>
              {subiendoDoc === 'cuenta' ? <span className="leg-validando">Subiendo…</span> : (
                <label className="admin-ghost-button" style={{ cursor: 'pointer' }}>
                  {docCuentaNombre ? `✓ ${docCuentaNombre}` : '+ Adjuntar certificado bancario'}
                  <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDoc(f, 'cuenta'); e.target.value = ''; }} />
                </label>
              )}
              {docCuentaNombre && subiendoDoc !== 'cuenta' && (
                <button type="button" className="admin-ghost-button" style={{ fontSize: 12 }} onClick={() => { setDocCuentaId(''); setDocCuentaNombre(''); }}>✕</button>
              )}
            </div>
          </div>

          {/* ── Grupo 3: Colaborador nuevo (condicional) ── */}
          <h4 style={{ marginTop: 20, marginBottom: 8, fontSize: 12, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Primera radicación</h4>

          <div className="leg-field">
            <label className="leg-check-label" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={esNuevo} onChange={(e) => setEsNuevo(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0 }} />
              <span>
                <strong>Soy colaborador nuevo / es mi primera radicación en la IPS</strong><br />
                <span className="leg-nota">Si marcas esta opción debes adjuntar copia del RUT y del documento de identidad.</span>
              </span>
            </label>
          </div>

          {esNuevo && (
            <>
              {/* 7. Copia del documento de identidad */}
              <div className="leg-field" style={{ marginTop: 14 }}>
                <label>Copia del documento de identidad *{docDocumentoNombre.includes('perfil') ? ' ✦' : ''}</label>
                <p className="leg-nota" style={{ marginBottom: 6 }}>
                  Copia legible de la cédula u otro documento de identidad.
                  {docDocumentoId && docDocumentoNombre.includes('perfil') ? ' Cargado desde tu perfil.' : ''}
                </p>
                <div className="leg-factura-actions" style={{ display: 'flex', gap: 8 }}>
                  {subiendoDoc === 'documento' ? <span className="leg-validando">Subiendo…</span> : (
                    <label className="admin-ghost-button" style={{ cursor: 'pointer' }}>
                      {docDocumentoNombre ? `✓ ${docDocumentoNombre}` : '+ Adjuntar copia del documento'}
                      <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDoc(f, 'documento'); e.target.value = ''; }} />
                    </label>
                  )}
                  {docDocumentoNombre && subiendoDoc !== 'documento' && (
                    <button type="button" className="admin-ghost-button" style={{ fontSize: 12 }} onClick={() => { setDocDocumentoId(''); setDocDocumentoNombre(''); }}>✕</button>
                  )}
                </div>
              </div>

              {/* 8. Copia del RUT */}
              <div className="leg-field" style={{ marginTop: 14 }}>
                <label>Copia del RUT *{docRutNombre.includes('perfil') ? ' ✦' : ''}</label>
                <p className="leg-nota" style={{ marginBottom: 6 }}>
                  Registro Único Tributario actualizado.
                  {docRutId && docRutNombre.includes('perfil') ? ' Cargado desde tu perfil.' : ''}
                </p>
                <div className="leg-factura-actions" style={{ display: 'flex', gap: 8 }}>
                  {subiendoDoc === 'rut' ? <span className="leg-validando">Subiendo…</span> : (
                    <label className="admin-ghost-button" style={{ cursor: 'pointer' }}>
                      {docRutNombre ? `✓ ${docRutNombre}` : '+ Adjuntar RUT'}
                      <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDoc(f, 'rut'); e.target.value = ''; }} />
                    </label>
                  )}
                  {docRutNombre && subiendoDoc !== 'rut' && (
                    <button type="button" className="admin-ghost-button" style={{ fontSize: 12 }} onClick={() => { setDocRutId(''); setDocRutNombre(''); }}>✕</button>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Firma
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 5: Firma y envío ── */}
      {paso === 5 && (
        <div className="leg-form card-surface">
          <h3>Firma y envío</h3>

          <div className="leg-field">
            <label>Firma digital del contratista *</label>
            <SignaturePad
              label="Firma con dedo, lápiz táctil o adjunta imagen"
              value={firma}
              onChange={setFirma}
            />
          </div>

          <div className="ops-resumen">
            <h4>Resumen de la cuenta de cobro</h4>
            <div className="ops-resumen-grid">
              <span>Contrato / OPS:</span><strong>{numeroContrato}</strong>
              {numeroCuentaCobro && (<><span>N° cuenta de cobro:</span><strong>{numeroCuentaCobro}</strong></>)}
              <span>Período:</span><strong>{periodoInicio} — {periodoFin}</strong>
              <span>Valor a cobrar:</span><strong>$ {formatearMiles(valorCobrar)}</strong>
              <span>Banco:</span><strong>{banco} · {tipoCuenta} · {numeroCuenta}</strong>
            </div>
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Radicar cuenta de cobro'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
