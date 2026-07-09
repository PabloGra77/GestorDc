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

const PROFESIONES_OPS = [
  // Salud — terapias
  'Fisioterapeuta',
  'Fisioterapeuta Respiratoria',
  'Fonoaudiólogo(a)',
  'Terapeuta Ocupacional',
  // Salud — clínicas
  'Médico(a) General',
  'Médico(a) Especialista',
  'Psiquiatra',
  'Psicólogo(a)',
  'Enfermero(a)',
  'Auxiliar de Enfermería',
  'Bacteriólogo(a)',
  'Nutricionista — Dietista',
  'Regente de Farmacia',
  'Auxiliar de Farmacia',
  'Odontólogo(a)',
  'Auxiliar de Odontología',
  'Optómetra',
  'Trabajador(a) Social',
  'Médico(a) Legista',
  // Ingenierías y otros
  'Ingeniero(a) de Sistemas',
  'Ingeniero(a) Industrial',
  'Ingeniero(a) Biomédico(a)',
  'Administrador(a) en Salud',
  'Coordinador(a) de Área',
  'Otro',
];

// ── Regionales y sedes INPEC ─────────────────────────────────────────────────
const REGIONALES_PPL: Record<string, string[]> = {
  'Central': [
    'CAMIS ACACIAS',
    'COMPLEJO CARCELARIO Y PENITENCIARIO BOGOTA',
    'CPAMS EL BARNE',
    'CPAMSEJAPI',
    'CPAMSEJART',
    'CPAMSEJEPO',
    'CPAMSEJEYO',
    'CPAMSM BOGOTA',
    'CPMMSF FACATATIVA',
    'CPMS ACACIAS',
    'CPMS CHIQUINQUIRA',
    'CPMS CHOCONTA',
    'CPMS ESPINAL',
    'CPMS FLORENCIA',
    'CPMS FUSAGASUGA',
    'CPMS GACHETA',
    'CPMS GARZON',
    'CPMS GIRARDOT',
    'CPMS GUAMO',
    'CPMS LA MESA',
    'CPMS LA PLATA',
    'CPMS MELGAR',
    'CPMS MONIQUIRA',
    'CPMS NEIVA',
    'CPMS PAZ DE ARIPORO',
    'CPMS RAMIRIQUI',
    'CPMS TUNJA',
    'CPMS UBATE',
    'CPMS VILLAVICENCIO',
    'CPMS VILLETA',
    'CPMS YOPAL',
    'CPMSCACOM-2',
    'EPMSC CAQUEZA',
    'EPMSC CHAPARRAL',
    'EPMSC DUITAMA',
    'EPMSC GRANADA',
    'EPMSC GUATEQUE',
    'EPMSC LETICIA',
    'EPMSC PITALITO',
    'EPMSC SANTA ROSA DE VITERBO (JYP-MUJERES)',
    'EPMSC SOGAMOSO',
    'EPMSC ZIPAQUIRA',
    'PMS LA ESPERANZA DE GUADUAS',
    'PMS LAS HELICONIAS DE FLORENCIA',
    'Otra sede',
  ],
  'Norte': [
    'ARCAR CARTAGENA',
    'CMS BARRANQUILLA (MODELO)',
    'CPAMS ARCOR',
    'CPAMS CARTAGENA',
    'CPAMS EJEMA',
    'CPAMS EJUPA',
    'CPAMS VALLEDUPAR (TRAMACUA)',
    'CPMS MAGANGUE',
    'CPMS MONTERIA',
    'CPMS RIOHACHA',
    'CPMS SINCELEJO',
    'CPMS TIERRALTA',
    'EPMSC BARRANQUILLA BOSQUE',
    'EPMSC EL BANCO',
    'EPMSC SAN ANDRES',
    'EPMSC SANTA MARTA',
    'EPMSC VALLEDUPAR (JUDICIAL)',
    'Otra sede',
  ],
  'Noroeste': [
    'COMPLEJO CARCELARIO Y PENITENCIARIO PEDREGAL',
    'CPAMS LA PAZ',
    'CPAMSEJEBE',
    'CPMS APARTADO',
    'CPMS BELLO',
    'CPMS JERICO',
    'CPMS PUERTO TRIUNFO',
    'CPMS SANTO DOMINGO',
    'EPMSC ANDES',
    'EPMSC BOLIVAR-ANTIOQUIA',
    'EPMSC CAUCASIA',
    'EPMSC ISTMINA',
    'EPMSC LA CEJA',
    'EPMSC PUERTO BERRIO',
    'EPMSC QUIBDO',
    'EPMSC SANTA BARBARA',
    'EPMSC SANTA ROSA DE OSOS',
    'EPMSC SONSON',
    'EPMSC TAMESIS',
    'EPMSC YARUMAL',
    'Otra sede',
  ],
  'Occidente': [
    'ARBUE BUENAVENTURA',
    'COMPLEJO CARCELARIO Y PENITENCIARIO JAMUNDI',
    'CPAMS PALMIRA',
    'CPAMS POPAYAN (ERE)',
    'CPAMSEJECA',
    'CPMS BUGA',
    'CPMS CALI (ERE)',
    'CPMS EL BORDO',
    'CPMS IPIALES',
    'CPMS TULUA',
    'CPMS TUQUERRES',
    'CPMSM PASTO',
    'CPMSM POPAYAN',
    'EPMSC BOLIVAR-CAUCA',
    'EPMSC BUENAVENTURA',
    'EPMSC CAICEDONIA',
    'EPMSC CARTAGO',
    'EPMSC LA UNION',
    'EPMSC MOCOA',
    'EPMSC PUERTO TEJADA',
    'EPMSC ROLDANILLO',
    'EPMSC SANTANDER DE QUILICHAO',
    'EPMSC SEVILLA',
    'EPMSC SILVIA',
    'EPMSC TUMACO',
    'Otra sede',
  ],
  'Oriente': [
    'COMPLEJO CARCELARIO Y PENITENCIARIO METROPOLITANO DE CUCUTA',
    'CPAMS GIRON',
    'CPMS BUCARAMANGA (ERE)',
    'CPMS SAN VICENTE DE CHUCURI',
    'CPMSM BUCARAMANGA',
    'EPMS SAN GIL',
    'EPMSC AGUACHICA',
    'EPMSC ARAUCA',
    'EPMSC BARRANCABERMEJA',
    'EPMSC MALAGA',
    'EPMSC OCANA',
    'EPMSC PAMPLONA',
    'EPMSC SOCORRO',
    'EPMSC VELEZ',
    'Otra sede',
  ],
  'Viejo Caldas': [
    'COMPLEJO CARCELARIO Y PENITENCIARIO IBAGUE COIBA',
    'CPAMS LA DORADA',
    'EPMSC ANSERMA',
    'EPMSC ARMENIA',
    'EPMSC CALARCA',
    'EPMSC FRESNO',
    'EPMSC HONDA',
    'EPMSC LIBANO',
    'EPMSC MANIZALES',
    'EPMSC PACORA',
    'EPMSC PENSILVANIA',
    'EPMSC PEREIRA (ERE)',
    'EPMSC PUERTO BOYACA',
    'EPMSC RIOSUCIO',
    'EPMSC SALAMINA',
    'EPMSC SANTA ROSA DE CABAL',
    'RM ARMENIA',
    'RM MANIZALES',
    'RM PEREIRA',
    'Otra sede',
  ],
};

const NOMBRES_REGIONALES = Object.keys(REGIONALES_PPL);

interface AtencionSede {
  id: string;
  regional: string;
  sede: string;
  fecha: string;
  hc: string;
}

interface NotaAclaratoria {
  id: string;
  regional: string;
  sede: string;
  fecha: string;
  hc: string;
  descripcion: string;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function defaultAtencion(): AtencionSede {
  return { id: uid(), regional: 'Central', sede: REGIONALES_PPL['Central'][0], fecha: '', hc: '' };
}
function defaultNota(): NotaAclaratoria {
  return { id: uid(), regional: 'Central', sede: REGIONALES_PPL['Central'][0], fecha: '', hc: '', descripcion: '' };
}

export function CuentaCobroOpsPanel({ onCreada, tipoSolicitudId, areaId }: CuentaCobroOpsPanelProps) {
  const [paso, setPaso] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [tipoId, setTipoId] = useState<number | null>(tipoSolicitudId ?? null);
  const [areaSolId, setAreaSolId] = useState<number | null>(areaId ?? null);

  // ── Paso 1: Período ─────────────────────────────────────────────────────────
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [fechaInicioContrato, setFechaInicioContrato] = useState('');
  const [fechaFinContrato, setFechaFinContrato] = useState('');

  // ── Paso 2: Cobro y atenciones ───────────────────────────────────────────────
  const [valorCobrar, setValorCobrar] = useState('');
  const [atenciones, setAtenciones] = useState<AtencionSede[]>([defaultAtencion()]);
  const [conNotasAcl, setConNotasAcl] = useState(false);
  const [notasAcl, setNotasAcl] = useState<NotaAclaratoria[]>([defaultNota()]);
  const [comentariosAdicionales, setComentariosAdicionales] = useState('');

  // ── Paso 3: Datos personales (pre-cargados, verificar) ──────────────────────
  const [datosConfirmados, setDatosConfirmados] = useState(false);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [profesion, setProfesion] = useState('');

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
  const [eps, setEps] = useState('');
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('Ahorros');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [titularCuenta, setTitularCuenta] = useState('');

  // ── Paso 4: Documentos ──────────────────────────────────────────────────────
  // Nota: los documentos de prestación de servicios y Panacea/360 los carga el analista, no el profesional
  const [opsAlDia, setOpsAlDia] = useState(false);
  const [esNuevo, setEsNuevo] = useState(false);
  // Del perfil (solo mostrar estado, re-subir opcional)
  const [docCartaEpsId, setDocCartaEpsId] = useState('');
  const [docCartaEpsNombre, setDocCartaEpsNombre] = useState('');
  const [docAfiliacionesId, setDocAfiliacionesId] = useState('');
  const [docAfiliacionesNombre, setDocAfiliacionesNombre] = useState('');
  const [docCuentaId, setDocCuentaId] = useState('');
  const [docCuentaNombre, setDocCuentaNombre] = useState('');
  const [docDocumentoId, setDocDocumentoId] = useState('');
  const [docDocumentoNombre, setDocDocumentoNombre] = useState('');
  const [docRutId, setDocRutId] = useState('');
  const [docRutNombre, setDocRutNombre] = useState('');
  const [subiendoDoc, setSubiendoDoc] = useState<string | null>(null);

  // ── Paso 5: Firma ──────────────────────────────────────────────────────────
  const [firma, setFirma] = useState('');

  // ── Auto-crear tipo ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (tipoId) return;
    api.post<{ id: number; areaId: number }>('/tipos/ensure', { slug: 'cuenta-cobro-ops' })
      .then((r) => { setTipoId(r.data.id); if (!areaSolId) setAreaSolId(r.data.areaId); })
      .catch(() => {
        api.get<Array<{ id: number; slug: string; areaId: number }>>('/tipos').then((r) => {
          const t = r.data.find((x) => x.slug === 'cuenta-cobro-ops');
          if (t) { setTipoId(t.id); if (!areaSolId) setAreaSolId(t.areaId); }
        }).catch(() => {});
      });
  }, []);

  // ── Pre-cargar perfil ───────────────────────────────────────────────────────
  useEffect(() => {
    api.get<Record<string, string>>('/usuarios/perfil').then((r) => {
      const s = getAuthSession(); const u = s?.usuario;
      if (r.data.tipoDocumento) setFormTipoDoc(r.data.tipoDocumento);
      if (r.data.numeroDocumento || (u?.numeroDocumento as string | undefined)) {
        setFormNumDoc(r.data.numeroDocumento || (u?.numeroDocumento as string | undefined) || '');
      }
      setFormPrimerNombre(r.data.primerNombre || (u?.primerNombre as string | undefined) || u?.nombreCompleto?.split(' ')[0] || '');
      setFormSegundoNombre(r.data.segundoNombre || '');
      setFormPrimerApellido(r.data.primerApellido || (u?.primerApellido as string | undefined) || '');
      setFormSegundoApellido(r.data.segundoApellido || '');
      setFormFechaNac(r.data.fechaNacimiento || '');
      setFormFechaExp(r.data.fechaExpedicion || '');
      setFormLugarExp(r.data.lugarExpedicion || '');
      setFormTelefono(r.data.telefono || '');
      if (r.data.banco) setBanco(r.data.banco);
      if (r.data.tipoCuenta) setTipoCuenta(r.data.tipoCuenta === 'corriente' ? 'Corriente' : 'Ahorros');
      if (r.data.numeroCuenta) setNumeroCuenta(r.data.numeroCuenta);
      if (r.data.titularCuenta) setTitularCuenta(r.data.titularCuenta);
      if (r.data.eps) setEps(r.data.eps);
      if (r.data.profesion) setProfesion(r.data.profesion);
      if (r.data.archivoEpsId) { setDocAfiliacionesId(r.data.archivoEpsId); setDocAfiliacionesNombre(r.data.archivoEpsNombre || 'Cert. EPS (perfil)'); }
      if (r.data.archivoCartaEpsId) { setDocCartaEpsId(r.data.archivoCartaEpsId); setDocCartaEpsNombre(r.data.archivoCartaEpsNombre || 'Carta EPS (perfil)'); }
      if (r.data.archivoCuentaId) { setDocCuentaId(r.data.archivoCuentaId); setDocCuentaNombre(r.data.archivoCuentaNombre || 'Cert. bancario (perfil)'); }
      if (r.data.archivoDocumentoId) { setDocDocumentoId(r.data.archivoDocumentoId); setDocDocumentoNombre(r.data.archivoDocumentoNombre || 'Doc. identidad (perfil)'); }
      if (r.data.archivoRutId) { setDocRutId(r.data.archivoRutId); setDocRutNombre(r.data.archivoRutNombre || 'RUT (perfil)'); }
    }).catch(() => {});
  }, []);

  // ── Helpers atenciones ──────────────────────────────────────────────────────
  function setAtencionField(id: string, f: keyof AtencionSede, v: string) {
    setAtenciones(prev => prev.map(a => {
      if (a.id !== id) return a;
      const updated = { ...a, [f]: v };
      if (f === 'regional') updated.sede = REGIONALES_PPL[v]?.[0] || '';
      return updated;
    }));
  }
  function setNotaField(id: string, f: keyof NotaAclaratoria, v: string) {
    setNotasAcl(prev => prev.map(n => {
      if (n.id !== id) return n;
      const updated = { ...n, [f]: v };
      if (f === 'regional') updated.sede = REGIONALES_PPL[v]?.[0] || '';
      return updated;
    }));
  }

  // ── Upload doc ──────────────────────────────────────────────────────────────
  async function subirDoc(file: File, campo: string) {
    setSubiendoDoc(campo);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const r = await api.post<{ id: string }>('/archivos', fd, { headers: { 'Content-Type': undefined } });
      const id = r.data.id; const nom = file.name;
      if (campo === 'cartaEps')     { setDocCartaEpsId(id);     setDocCartaEpsNombre(nom); }
      else if (campo === 'afiliaciones') { setDocAfiliacionesId(id); setDocAfiliacionesNombre(nom); }
      else if (campo === 'cuenta')       { setDocCuentaId(id);       setDocCuentaNombre(nom); }
      else if (campo === 'documento')    { setDocDocumentoId(id);    setDocDocumentoNombre(nom); }
      else if (campo === 'rut')          { setDocRutId(id);          setDocRutNombre(nom); }
    } catch { setErr('No se pudo subir el archivo. Máx 10 MB, formatos: PDF, JPG, PNG.'); }
    finally   { setSubiendoDoc(null); }
  }

  // ── Validación ──────────────────────────────────────────────────────────────
  function validarPaso(): string {
    if (paso === 1) {
      if (!periodoInicio || !periodoFin) return 'Define el período del cobro (fecha inicio y fin).';
      if (periodoFin < periodoInicio) return 'La fecha fin del período no puede ser anterior a la de inicio.';
    }
    if (paso === 2) {
      if (!valorCobrar.trim()) return 'Ingresa el valor a cobrar en este período.';
      for (const a of atenciones) {
        if (!a.fecha) return 'Cada fila de atenciones debe tener una fecha.';
        if (!a.hc.trim()) return 'Indica el número de HC cargadas en cada fecha.';
      }
      if (conNotasAcl) {
        for (const n of notasAcl) {
          if (!n.fecha) return 'Cada nota aclaratoria debe tener fecha.';
        }
      }
    }
    if (paso === 3) {
      if (!formTipoDoc) return 'Selecciona el tipo de documento.';
      if (!formNumDoc.trim()) return 'Ingresa tu número de documento.';
      if (!formPrimerNombre.trim()) return 'Ingresa tu primer nombre.';
      if (!formPrimerApellido.trim()) return 'Ingresa tu primer apellido.';
      if (!profesion) return 'Selecciona tu profesión o cargo.';
      if (!banco) return 'Selecciona el banco para el pago.';
      if (!numeroCuenta.trim()) return 'Ingresa el número de cuenta bancaria.';
      if (!datosConfirmados) return 'Confirma que tus datos personales y bancarios son correctos.';
    }
    if (paso === 4) {
      if (!opsAlDia) return 'Debes confirmar la certificación de OPS al día.';
      if (esNuevo && !docDocumentoId) return 'Para primera radicación debes adjuntar la copia del documento de identidad.';
      if (esNuevo && !docRutId) return 'Para primera radicación debes adjuntar la copia del RUT.';
    }
    if (paso === 5) {
      if (!firma) return 'La firma digital es obligatoria.';
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

  // ── Envío ────────────────────────────────────────────────────────────────────
  async function enviar() {
    const e = validarPaso();
    if (e) { setErr(e); return; }
    if (!tipoId) { setErr('No se encontró el tipo de solicitud. Recarga la página.'); return; }
    setErr(''); setEnviando(true);
    try {
      const usr = getAuthSession()?.usuario;
      const payload = {
        tipoSolicitudId: tipoId,
        ...(areaSolId ? { areaId: areaSolId } : {}),
        datos: {
          periodoInicio, periodoFin,
          fechaInicioContrato, fechaFinContrato,
          valorCobrar,
          atencionesJson: JSON.stringify(atenciones),
          conNotasAclaratorias: conNotasAcl ? 'si' : 'no',
          notasAclaratorias: conNotasAcl ? JSON.stringify(notasAcl) : '[]',
          actividadesRealizadas: comentariosAdicionales,
          comentariosAdicionales,
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
          banco, tipoCuenta, numeroCuenta, titularCuenta,
          eps, entidadSalud: eps,
          profesion,
          opsAlDia: opsAlDia ? 'si' : 'no',
          esNuevoColaborador: esNuevo ? 'si' : 'no',
        },
        documentos: {
          ...(docCartaEpsId      ? { cartaEps:                       { nombre: docCartaEpsNombre,      archivoId: docCartaEpsId      } } : {}),
          ...(docAfiliacionesId  ? { certificadoEpsAdres:            { nombre: docAfiliacionesNombre,  archivoId: docAfiliacionesId  } } : {}),
          ...(docCuentaId        ? { certificadoCuentaBancaria:      { nombre: docCuentaNombre,        archivoId: docCuentaId        } } : {}),
          ...(docDocumentoId     ? { copiaDocumentoIdentidad:        { nombre: docDocumentoNombre,     archivoId: docDocumentoId     } } : {}),
          ...(docRutId           ? { copiaRut:                       { nombre: docRutNombre,           archivoId: docRutId           } } : {}),
        },
        firmas: { profesional: firma },
      };
      const res = await api.post<{ id: number; numeroRadicado: string }>('/solicitudes', payload);
      setMsg(`Cuenta de cobro radicada exitosamente. Radicado: ${res.data.numeroRadicado}`);
      onCreada?.({ id: res.data.id, numeroRadicado: res.data.numeroRadicado });
    } catch (ex: unknown) {
      const m = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(m || 'Error al enviar. Intenta de nuevo.');
    } finally { setEnviando(false); }
  }

  if (msg) {
    return (
      <div className="leg-success card-surface">
        <div className="leg-success-icon">✓</div>
        <h3>Cuenta de cobro radicada</h3>
        <p>{msg}</p>
        <p className="leg-nota">Puedes hacer seguimiento en <strong>Mis solicitudes</strong>.</p>
        <button type="button" className="admin-primary-button"
          onClick={() => { setMsg(''); setPaso(1); setValorCobrar(''); setAtenciones([defaultAtencion()]); setConNotasAcl(false); setNotasAcl([defaultNota()]); setComentariosAdicionales(''); setDatosConfirmados(false); setFirma(''); setOpsAlDia(false); setEsNuevo(false); }}>
          Nueva cuenta de cobro
        </button>
      </div>
    );
  }

  const pasos = ['Período', 'Cobro y atenciones', 'Tus datos', 'Documentos', 'Firma'];
  const nombreCompleto = [formPrimerNombre, formSegundoNombre, formPrimerApellido, formSegundoApellido].filter(Boolean).join(' ');

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

      {/* ═══ Paso 1: Período ═══ */}
      {paso === 1 && (
        <div className="leg-form card-surface">
          <h3>Período del cobro</h3>
          <p className="leg-nota">Define el período de servicios que vas a cobrar en esta cuenta.</p>

          <div className="leg-field-row">
            <div className="leg-field">
              <label>Período del cobro — desde <span className="req">*</span></label>
              <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
            </div>
            <div className="leg-field">
              <label>Período del cobro — hasta <span className="req">*</span></label>
              <input type="date" value={periodoFin} onChange={(e) => setPeriodoFin(e.target.value)} />
            </div>
          </div>

          <div className="leg-field-row" style={{ marginTop: 8 }}>
            <div className="leg-field">
              <label>Fecha de inicio del contrato <span style={{ opacity: 0.5 }}>(opcional)</span></label>
              <input type="date" value={fechaInicioContrato} onChange={(e) => setFechaInicioContrato(e.target.value)} />
            </div>
            <div className="leg-field">
              <label>Fecha de terminación del contrato <span style={{ opacity: 0.5 }}>(opcional)</span></label>
              <input type="date" value={fechaFinContrato} onChange={(e) => setFechaFinContrato(e.target.value)} />
            </div>
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Cobro y atenciones
            </button>
          </div>
        </div>
      )}

      {/* ═══ Paso 2: Cobro y atenciones ═══ */}
      {paso === 2 && (
        <div className="leg-form card-surface">
          <h3>Cobro y atenciones</h3>

          {/* Valor */}
          <div className="leg-field">
            <label>Valor a cobrar en este período <span className="req">*</span></label>
            <input type="text" inputMode="numeric" value={valorCobrar}
              onChange={(e) => setValorCobrar(e.target.value.replace(/\D/g, ''))}
              placeholder="Valor en pesos colombianos" />
            {valorCobrar && <span className="leg-nota">$ {formatearMiles(valorCobrar)}</span>}
          </div>

          {/* ── Atenciones por sede ── */}
          <div className="ops-atenciones-section">
            <h4 className="ops-seccion-titulo">Atenciones por sede</h4>
            <p className="leg-nota" style={{ marginBottom: 10 }}>
              Registra cada día de atención indicando la sede, la fecha y el número de HC cargadas.
            </p>

            {atenciones.map((a, idx) => (
              <div key={a.id} className="ops-atencion-row">
                <span className="ops-atencion-num">{idx + 1}</span>
                <div className="ops-atencion-fields">
                  <div className="leg-field" style={{ flex: '0 0 130px' }}>
                    <label>Regional</label>
                    <select value={a.regional} onChange={(e) => setAtencionField(a.id, 'regional', e.target.value)}>
                      {NOMBRES_REGIONALES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="leg-field" style={{ flex: '1 1 200px' }}>
                    <label>Establecimiento</label>
                    <select value={a.sede} onChange={(e) => setAtencionField(a.id, 'sede', e.target.value)}>
                      {(REGIONALES_PPL[a.regional] || []).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="leg-field" style={{ flex: '0 0 145px' }}>
                    <label>Fecha</label>
                    <input type="date" value={a.fecha} onChange={(e) => setAtencionField(a.id, 'fecha', e.target.value)} />
                  </div>
                  <div className="leg-field" style={{ flex: '0 0 90px' }}>
                    <label>N° HC</label>
                    <input type="number" min="0" placeholder="0" value={a.hc}
                      onChange={(e) => setAtencionField(a.id, 'hc', e.target.value)} />
                  </div>
                </div>
                {atenciones.length > 1 && (
                  <button type="button" className="admin-ghost-button ops-rm-btn"
                    onClick={() => setAtenciones(p => p.filter(x => x.id !== a.id))}>✕</button>
                )}
              </div>
            ))}

            <button type="button" className="admin-ghost-button" style={{ marginTop: 8 }}
              onClick={() => setAtenciones(p => [...p, defaultAtencion()])}>
              + Agregar otra fecha de atención
            </button>

            {atenciones.length > 0 && (
              <p className="leg-nota" style={{ marginTop: 6 }}>
                Total HC registradas: <strong>{atenciones.reduce((s, a) => s + (parseInt(a.hc) || 0), 0)}</strong>
              </p>
            )}
          </div>

          {/* ── Notas aclaratorias ── */}
          <div className="ops-atenciones-section" style={{ marginTop: 16 }}>
            <label className="ops-seccion-check">
              <input type="checkbox" checked={conNotasAcl} onChange={e => setConNotasAcl(e.target.checked)} />
              <span className="ops-seccion-titulo">Se cargaron notas aclaratorias</span>
            </label>
            {conNotasAcl && (
              <div style={{ marginTop: 10 }}>
                <p className="leg-nota" style={{ marginBottom: 10 }}>
                  Registra las notas aclaratorias con sede, fecha y número de HC.
                </p>
                {notasAcl.map((n, idx) => (
                  <div key={n.id} className="ops-atencion-row">
                    <span className="ops-atencion-num">{idx + 1}</span>
                    <div className="ops-atencion-fields" style={{ flexWrap: 'wrap' }}>
                      <div className="leg-field" style={{ flex: '0 0 130px' }}>
                        <label>Regional</label>
                        <select value={n.regional} onChange={(e) => setNotaField(n.id, 'regional', e.target.value)}>
                          {NOMBRES_REGIONALES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="leg-field" style={{ flex: '1 1 200px' }}>
                        <label>Establecimiento</label>
                        <select value={n.sede} onChange={(e) => setNotaField(n.id, 'sede', e.target.value)}>
                          {(REGIONALES_PPL[n.regional] || []).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="leg-field" style={{ flex: '0 0 145px' }}>
                        <label>Fecha</label>
                        <input type="date" value={n.fecha} onChange={(e) => setNotaField(n.id, 'fecha', e.target.value)} />
                      </div>
                      <div className="leg-field" style={{ flex: '0 0 90px' }}>
                        <label>N° HC</label>
                        <input type="number" min="0" placeholder="0" value={n.hc}
                          onChange={(e) => setNotaField(n.id, 'hc', e.target.value)} />
                      </div>
                      <div className="leg-field" style={{ flex: '1 1 100%', marginTop: 4 }}>
                        <label>Descripción de la nota <span style={{ opacity: 0.5 }}>(opcional)</span></label>
                        <input type="text" placeholder="Ej: corrección de fecha anterior, HC adicionales no cargados…"
                          value={n.descripcion} onChange={(e) => setNotaField(n.id, 'descripcion', e.target.value)} />
                      </div>
                    </div>
                    {notasAcl.length > 1 && (
                      <button type="button" className="admin-ghost-button ops-rm-btn"
                        onClick={() => setNotasAcl(p => p.filter(x => x.id !== n.id))}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" className="admin-ghost-button" style={{ marginTop: 8 }}
                  onClick={() => setNotasAcl(p => [...p, defaultNota()])}>
                  + Agregar otra nota aclaratoria
                </button>
              </div>
            )}
          </div>

          {/* Comentarios adicionales */}
          <div className="leg-field" style={{ marginTop: 16 }}>
            <label>Comentarios adicionales <span style={{ opacity: 0.5 }}>(opcional)</span></label>
            <textarea value={comentariosAdicionales}
              onChange={(e) => setComentariosAdicionales(e.target.value)}
              rows={3}
              placeholder="Algún comentario o información adicional que quieras incluir en la cuenta de cobro…" />
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Tus datos
            </button>
          </div>
        </div>
      )}

      {/* ═══ Paso 3: Verificación de datos personales ═══ */}
      {paso === 3 && (
        <div className="leg-form card-surface">
          <h3>Verifica tus datos personales</h3>
          <p className="leg-nota">Estos datos aparecen en la cuenta de cobro. Confírmalos o edítalos si algo cambió.</p>

          {/* Tarjeta de resumen */}
          <div className="ops-verify-card">
            <div className="ops-verify-section">
              <span className="ops-verify-label">Nombre completo</span>
              <strong>{nombreCompleto || '—'}</strong>
            </div>
            <div className="ops-verify-row">
              <div className="ops-verify-section">
                <span className="ops-verify-label">Profesión / Cargo</span>
                <strong style={!profesion ? { color: 'var(--accent, #d4af1f)' } : {}}>
                  {profesion || '⚠ Sin definir — haz clic en "Editar mis datos"'}
                </strong>
              </div>
            </div>
            <div className="ops-verify-row">
              <div className="ops-verify-section">
                <span className="ops-verify-label">Tipo de documento</span>
                <strong>{formTipoDoc}</strong>
              </div>
              <div className="ops-verify-section">
                <span className="ops-verify-label">N° de documento</span>
                <strong>{formNumDoc || '—'}</strong>
              </div>
              <div className="ops-verify-section">
                <span className="ops-verify-label">Teléfono</span>
                <strong>{formTelefono || '—'}</strong>
              </div>
            </div>
            <div className="ops-verify-row">
              <div className="ops-verify-section">
                <span className="ops-verify-label">EPS</span>
                <strong>{eps || '—'}</strong>
              </div>
            </div>
            <div className="ops-verify-row">
              <div className="ops-verify-section">
                <span className="ops-verify-label">Banco</span>
                <strong>{banco || '—'}</strong>
              </div>
              <div className="ops-verify-section">
                <span className="ops-verify-label">Tipo de cuenta</span>
                <strong>{tipoCuenta}</strong>
              </div>
              <div className="ops-verify-section">
                <span className="ops-verify-label">N° de cuenta</span>
                <strong>{numeroCuenta || '—'}</strong>
              </div>
            </div>
            {titularCuenta && (
              <div className="ops-verify-section">
                <span className="ops-verify-label">Titular de la cuenta</span>
                <strong>{titularCuenta}</strong>
              </div>
            )}

            <button type="button" className="ops-verify-toggle"
              onClick={() => setEditandoDatos(v => !v)}>
              {editandoDatos ? '▲ Cerrar edición' : '✏ Editar mis datos'}
            </button>
          </div>

          {/* Formulario de edición (colapsable) */}
          {editandoDatos && (
            <div className="ops-verify-edit">
              <div className="leg-seccion-personal">
                <h4>Identificación</h4>
                <div className="leg-field-row">
                  <div className="leg-field">
                    <label>Tipo de documento</label>
                    <select value={formTipoDoc} onChange={(e) => setFormTipoDoc(e.target.value)}>
                      {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="leg-field">
                    <label>Número de documento</label>
                    <input type="text" inputMode="numeric" value={formNumDoc}
                      onChange={(e) => setFormNumDoc(e.target.value)} placeholder="Sin puntos ni guiones" />
                  </div>
                </div>
                <div className="leg-field-row">
                  <div className="leg-field">
                    <label>Primer nombre</label>
                    <input type="text" value={formPrimerNombre} onChange={(e) => setFormPrimerNombre(e.target.value)} />
                  </div>
                  <div className="leg-field">
                    <label>Segundo nombre</label>
                    <input type="text" value={formSegundoNombre} onChange={(e) => setFormSegundoNombre(e.target.value)} placeholder="(opcional)" />
                  </div>
                </div>
                <div className="leg-field-row">
                  <div className="leg-field">
                    <label>Primer apellido</label>
                    <input type="text" value={formPrimerApellido} onChange={(e) => setFormPrimerApellido(e.target.value)} />
                  </div>
                  <div className="leg-field">
                    <label>Segundo apellido</label>
                    <input type="text" value={formSegundoApellido} onChange={(e) => setFormSegundoApellido(e.target.value)} placeholder="(opcional)" />
                  </div>
                </div>
                <div className="leg-field-row">
                  <div className="leg-field">
                    <label>Fecha de nacimiento</label>
                    <input type="date" value={formFechaNac} onChange={(e) => setFormFechaNac(e.target.value)} />
                  </div>
                  <div className="leg-field">
                    <label>Fecha de expedición</label>
                    <input type="date" value={formFechaExp} onChange={(e) => setFormFechaExp(e.target.value)} />
                  </div>
                </div>
                <div className="leg-field-row">
                  <div className="leg-field">
                    <label>Lugar de expedición</label>
                    <input type="text" value={formLugarExp} onChange={(e) => setFormLugarExp(e.target.value)} placeholder="Ciudad" />
                  </div>
                  <div className="leg-field">
                    <label>Teléfono de contacto</label>
                    <input type="tel" value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} placeholder="Celular o fijo" />
                  </div>
                </div>
                <div className="leg-field">
                  <label>EPS a la que está afiliado</label>
                  <input type="text" value={eps} onChange={(e) => setEps(e.target.value)} placeholder="Ej: Sura, Nueva EPS, Sanitas…" />
                </div>
                <div className="leg-field">
                  <label>Profesión / Cargo <span className="req">*</span></label>
                  <select value={profesion} onChange={(e) => setProfesion(e.target.value)}>
                    <option value="">— Selecciona tu profesión —</option>
                    {PROFESIONES_OPS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="leg-seccion-personal">
                <h4>Datos bancarios</h4>
                <div className="leg-field">
                  <label>Banco</label>
                  <select value={banco} onChange={(e) => setBanco(e.target.value)}>
                    <option value="">— Selecciona el banco —</option>
                    {BANCOS_COLOMBIA.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="leg-field">
                  <label>Tipo de cuenta</label>
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
                    <label>Número de cuenta</label>
                    <input type="text" inputMode="numeric" value={numeroCuenta}
                      onChange={(e) => setNumeroCuenta(e.target.value.replace(/\D/g, ''))}
                      placeholder="Sin espacios ni guiones" />
                  </div>
                  <div className="leg-field">
                    <label>Titular de la cuenta</label>
                    <input type="text" value={titularCuenta}
                      onChange={(e) => setTitularCuenta(e.target.value)}
                      placeholder="Nombre completo del titular" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confirmación obligatoria */}
          <label className="ops-confirm-check">
            <input type="checkbox" checked={datosConfirmados} onChange={(e) => setDatosConfirmados(e.target.checked)} />
            <span>
              <strong>Confirmo que mis datos personales y bancarios son correctos</strong> y que la
              cuenta de cobro puede ser generada con esta información.
            </span>
          </label>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Documentos
            </button>
          </div>
        </div>
      )}

      {/* ═══ Paso 4: Documentos ═══ */}
      {paso === 4 && (
        <div className="leg-form card-surface">
          <h3>Documentos adjuntos</h3>

          <div className="leg-field" style={{ marginTop: 14 }}>
            <label className="leg-check-label" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={opsAlDia} onChange={(e) => setOpsAlDia(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0 }} />
              <span>
                <strong>Certificación de OPS al día <span className="req">*</span></strong><br />
                <span className="leg-nota">Declaro bajo la gravedad de juramento que no tengo cuentas de cobro de períodos anteriores pendientes por radicar.</span>
              </span>
            </label>
          </div>

          {/* ── Del profesional (desde perfil) ── */}
          <h4 className="ops-docs-grupo-titulo" style={{ marginTop: 20 }}>
            Documentos del profesional <span className="ops-perfil-badge">✦ desde tu perfil</span>
          </h4>
          <p className="leg-nota" style={{ marginBottom: 10 }}>
            Estos documentos se toman automáticamente de tu perfil. Solo adjunta uno nuevo si cambió o venció.
          </p>

          <DocField label="Carta EPS / Carta informando afiliación" nota="Carta que informa a qué EPS está afiliado."
            campo="cartaEps" id={docCartaEpsId} nombre={docCartaEpsNombre} subiendo={subiendoDoc}
            onSubir={subirDoc} onQuitar={() => { setDocCartaEpsId(''); setDocCartaEpsNombre(''); }} opcional />

          <DocField label="Certificado de EPS o consulta ADRES" nota="Certificado que evidencia que está activo en EPS / ARL / Pensión."
            campo="afiliaciones" id={docAfiliacionesId} nombre={docAfiliacionesNombre} subiendo={subiendoDoc}
            onSubir={subirDoc} onQuitar={() => { setDocAfiliacionesId(''); setDocAfiliacionesNombre(''); }} opcional />

          <DocField label="Certificado bancario" nota="Certificado del banco que acredita la cuenta para el pago."
            campo="cuenta" id={docCuentaId} nombre={docCuentaNombre} subiendo={subiendoDoc}
            onSubir={subirDoc} onQuitar={() => { setDocCuentaId(''); setDocCuentaNombre(''); }} opcional />

          {/* ── Primera radicación ── */}
          <h4 className="ops-docs-grupo-titulo" style={{ marginTop: 20 }}>Primera radicación</h4>
          <div className="leg-field">
            <label className="leg-check-label" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={esNuevo} onChange={(e) => setEsNuevo(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0 }} />
              <span>
                <strong>Soy colaborador nuevo / es mi primera radicación</strong><br />
                <span className="leg-nota">Si marcas esta opción debes adjuntar copia del RUT y del documento de identidad.</span>
              </span>
            </label>
          </div>

          {esNuevo && (
            <>
              <DocField label="Copia del documento de identidad" nota="Copia legible de la cédula u otro documento."
                campo="documento" id={docDocumentoId} nombre={docDocumentoNombre} subiendo={subiendoDoc}
                onSubir={subirDoc} onQuitar={() => { setDocDocumentoId(''); setDocDocumentoNombre(''); }} />
              <DocField label="Copia del RUT" nota="Registro Único Tributario actualizado."
                campo="rut" id={docRutId} nombre={docRutNombre} subiendo={subiendoDoc}
                onSubir={subirDoc} onQuitar={() => { setDocRutId(''); setDocRutNombre(''); }} />
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

      {/* ═══ Paso 5: Firma ═══ */}
      {paso === 5 && (
        <div className="leg-form card-surface">
          <h3>Firma y envío</h3>

          <div className="ops-resumen">
            <h4>Resumen de la cuenta de cobro</h4>
            <div className="ops-resumen-grid">
              <span>Período:</span><strong>{periodoInicio} — {periodoFin}</strong>
              <span>Valor a cobrar:</span><strong>$ {formatearMiles(valorCobrar)}</strong>
              <span>Fechas de atención:</span>
              <strong>
                {atenciones.filter(a => a.fecha && a.hc).map(a => `${a.fecha} ${a.sede} (${a.hc} HC)`).join(', ') || '—'}
              </strong>
              <span>Banco:</span><strong>{banco} · {tipoCuenta} · {numeroCuenta}</strong>
            </div>
          </div>

          <div className="leg-field" style={{ marginTop: 16 }}>
            <label>Firma digital del contratista <span className="req">*</span></label>
            <SignaturePad label="Firma con dedo, lápiz táctil o adjunta imagen" value={firma} onChange={setFirma} />
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

// ── Componente auxiliar para subir documentos ─────────────────────────────────
interface DocFieldProps {
  label: string;
  nota: string;
  campo: string;
  id: string;
  nombre: string;
  subiendo: string | null;
  onSubir: (file: File, campo: string) => void;
  onQuitar: () => void;
  opcional?: boolean;
}
function DocField({ label, nota, campo, id, nombre, subiendo, onSubir, onQuitar, opcional }: DocFieldProps) {
  return (
    <div className="leg-field" style={{ marginTop: 14 }}>
      <label>{label}{!opcional && <span className="req"> *</span>}</label>
      {nota && <p className="leg-nota" style={{ marginBottom: 6 }}>{nota}</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {subiendo === campo ? (
          <span className="leg-validando">Subiendo…</span>
        ) : (
          <label className={`admin-ghost-button${id ? ' ops-doc-ok' : ''}`} style={{ cursor: 'pointer' }}>
            {id ? `✓ ${nombre}` : `+ Adjuntar ${opcional ? '(opcional)' : ''}`}
            <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubir(f, campo); e.target.value = ''; }} />
          </label>
        )}
        {id && subiendo !== campo && (
          <button type="button" className="admin-ghost-button" style={{ fontSize: 12 }} onClick={onQuitar}>✕ quitar</button>
        )}
      </div>
    </div>
  );
}
