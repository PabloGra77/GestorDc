import { useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { SignaturePad } from '../../components/SignaturePad';
import { BANCOS_COLOMBIA } from '../../utils/bancos';
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
  servicio: string;
}

interface AtencionServicio {
  id: string;
  nombres: string;
  apellidos: string;
  numId: string;
  servicio: string;
  sesiones: string;
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
  return { id: uid(), regional: 'Central', sede: REGIONALES_PPL['Central'][0], fecha: '', hc: '', servicio: '' };
}
function defaultAtencionServicio(): AtencionServicio {
  return { id: uid(), nombres: '', apellidos: '', numId: '', servicio: '', sesiones: '1' };
}
function defaultNota(): NotaAclaratoria {
  return { id: uid(), regional: 'Central', sede: REGIONALES_PPL['Central'][0], fecha: '', hc: '', descripcion: '' };
}

export function CuentaCobroOpsPanel({ onCreada, tipoSolicitudId, areaId }: CuentaCobroOpsPanelProps) {
  const [paso, setPaso] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [modalDiscrepancia, setModalDiscrepancia] = useState(false);
  const [discrepancias, setDiscrepancias] = useState<Array<{ descripcion: string; declaradas: number; registradas: number; diferencia: number }>>([]);
  const [tipoId, setTipoId] = useState<number | null>(tipoSolicitudId ?? null);
  const [areaSolId, setAreaSolId] = useState<number | null>(areaId ?? null);

  // ── Paso 1: Período ─────────────────────────────────────────────────────────
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState('');
  const [fechaInicioContrato, setFechaInicioContrato] = useState('');
  const [fechaFinContrato, setFechaFinContrato] = useState('');

  // ── Paso 2: Atenciones ───────────────────────────────────────────────────────
  const [tipoPlantillaAten, setTipoPlantillaAten] = useState<'ppl' | 'servicio'>('ppl');
  const [atenciones, setAtenciones] = useState<AtencionSede[]>([defaultAtencion()]);
  const [cargandoAten, setCargandoAten] = useState(false);
  const [atenAutoload, setAtenAutoload] = useState(false);
  const [atencionesServicio, setAtencionesServicio] = useState<AtencionServicio[]>([defaultAtencionServicio()]);
  const [tarifasOps, setTarifasOps] = useState<Array<{ servicio: string; valorUnitario: number }>>([]);
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
  // Del perfil (todos obligatorios)
  const [docCartaEpsId, setDocCartaEpsId] = useState('');
  const [docCartaEpsNombre, setDocCartaEpsNombre] = useState('');
  const [docCuentaId, setDocCuentaId] = useState('');
  const [docCuentaNombre, setDocCuentaNombre] = useState('');
  const [docDocumentoId, setDocDocumentoId] = useState('');
  const [docDocumentoNombre, setDocDocumentoNombre] = useState('');
  const [docRutId, setDocRutId] = useState('');
  const [docRutNombre, setDocRutNombre] = useState('');
  const [subiendoDoc, setSubiendoDoc] = useState<string | null>(null);

  // ── Paso 5: Firma ──────────────────────────────────────────────────────────
  const [firma, setFirma] = useState('');

  // ── Cargar tarifas OPS ──────────────────────────────────────────────────────
  useEffect(() => {
    api.get<Array<{ servicio: string; valorUnitario: number }>>('/tarifas-ops')
      .then((r) => setTarifasOps(r.data))
      .catch(() => {});
  }, []);

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
      if (r.data.cargo) setProfesion(r.data.cargo);
      if (r.data.archivoCartaEpsId) { setDocCartaEpsId(r.data.archivoCartaEpsId); setDocCartaEpsNombre(r.data.archivoCartaEpsNombre || 'Cert. EPS (perfil)'); }
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
      if (tipoPlantillaAten === 'ppl') {
        for (const a of atenciones) {
          if (!a.fecha) return 'Cada fila de atenciones debe tener una fecha.';
          if (!a.hc.trim()) return 'Indica el número de HC cargadas en cada fecha.';
          if (!a.servicio.trim()) return 'Selecciona el servicio realizado en cada fila.';
        }
        if (conNotasAcl) {
          for (const n of notasAcl) {
            if (!n.fecha) return 'Cada nota aclaratoria debe tener fecha.';
          }
        }
      } else {
        if (atencionesServicio.length === 0) return 'Agrega al menos una fila de atenciones.';
        for (const a of atencionesServicio) {
          if (!a.numId.trim()) return 'El número de identificación del paciente es obligatorio en cada fila.';
          if (!a.servicio.trim()) return 'Cada fila debe tener un servicio seleccionado.';
          if (!a.sesiones.trim() || parseInt(a.sesiones) < 1) return 'El número de sesiones debe ser al menos 1.';
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
      if (!docCartaEpsId) return 'El Certificado EPS o carta de afiliación es obligatorio. Ve a tu Perfil → Documentos para cargarlo.';
      if (!docCuentaId) return 'El Certificado de cuenta bancaria es obligatorio. Ve a tu Perfil → Documentos para cargarlo.';
      if (!docDocumentoId) return 'La Copia del documento de identidad es obligatoria. Ve a tu Perfil → Documentos para cargarla.';
      if (!docRutId) return 'La Copia del RUT es obligatoria. Ve a tu Perfil → Documentos para cargarla.';
    }
    if (paso === 5) {
      if (!firma) return 'La firma digital es obligatoria.';
    }
    return '';
  }

  async function siguiente() {
    const e = validarPaso();
    if (e) { setErr(e); return; }
    setErr('');

    if (paso === 1 && formNumDoc.trim()) {
      setCargandoAten(true);
      try {
        const res = await api.get<{
          encontrado: boolean;
          atencionesPpl: Array<{ fecha: string; servicio: string; hc: number }>;
          atencionesServicio: Array<{ ccPaciente: string; nombres: string; apellidos: string; servicio: string; sesiones: number }>;
        }>('/solicitudes/mis-atenciones-ops', {
          params: { cc: formNumDoc.trim(), periodoInicio, periodoFin },
        });
        if (res.data.encontrado) {
          if (res.data.atencionesPpl.length > 0) {
            setAtenciones(res.data.atencionesPpl.map((a) => ({
              id: uid(), regional: 'Central', sede: REGIONALES_PPL['Central'][0],
              fecha: a.fecha, hc: String(a.hc), servicio: a.servicio,
            })));
          }
          if (res.data.atencionesServicio.length > 0) {
            setAtencionesServicio(res.data.atencionesServicio.map((a) => ({
              id: uid(), nombres: a.nombres, apellidos: a.apellidos,
              numId: a.ccPaciente, servicio: a.servicio, sesiones: String(a.sesiones),
            })));
          }
          setAtenAutoload(res.data.atencionesPpl.length > 0 || res.data.atencionesServicio.length > 0);
        } else {
          setAtenAutoload(false);
        }
      } catch { /* sin informe: llenar manualmente */ }
      finally { setCargandoAten(false); }
    }

    setPaso((p) => Math.min(5, p + 1) as typeof paso);
  }
  function anterior() { setErr(''); setPaso((p) => Math.max(1, p - 1) as typeof paso); }

  // ── Verificación de atenciones contra informe ────────────────────────────────
  async function verificarAtenciones() {
    try {
      const cc = formNumDoc.trim();
      if (!cc) return null;
      const res = await api.post<{ hayDiscrepancias: boolean; sinInforme: boolean; discrepancias: Array<{ descripcion: string; declaradas: number; registradas: number; diferencia: number }> }>(
        '/solicitudes/comparar-ops',
        {
          cc,
          periodoInicio,
          periodoFin,
          tipo: tipoPlantillaAten,
          atencionesJson: tipoPlantillaAten === 'ppl' ? JSON.stringify(atenciones) : '[]',
          atencionesServicioJson: tipoPlantillaAten === 'servicio' ? JSON.stringify(atencionesServicio) : '[]',
        }
      );
      return res.data;
    } catch { return null; }
  }

  // ── Calcular valor a cobrar desde tarifas configuradas ───────────────────────
  function calcularValor(): { total: number; desglose: Array<{ servicio: string; cantidad: number; tarifa: number; subtotal: number }> } {
    const tMap = new Map(tarifasOps.map(t => [t.servicio, t.valorUnitario]));
    const grupos = new Map<string, { cantidad: number; tarifa: number }>();
    if (tipoPlantillaAten === 'ppl') {
      atenciones.forEach(a => {
        const hc = parseInt(a.hc) || 0;
        if (hc > 0 && a.servicio) {
          const g = grupos.get(a.servicio) ?? { cantidad: 0, tarifa: tMap.get(a.servicio) ?? 0 };
          grupos.set(a.servicio, { cantidad: g.cantidad + hc, tarifa: g.tarifa });
        }
      });
    } else {
      atencionesServicio.forEach(a => {
        const ses = parseInt(a.sesiones) || 1;
        if (a.servicio) {
          const g = grupos.get(a.servicio) ?? { cantidad: 0, tarifa: tMap.get(a.servicio) ?? 0 };
          grupos.set(a.servicio, { cantidad: g.cantidad + ses, tarifa: g.tarifa });
        }
      });
    }
    let total = 0;
    const desglose: Array<{ servicio: string; cantidad: number; tarifa: number; subtotal: number }> = [];
    grupos.forEach((v, k) => {
      const sub = v.cantidad * v.tarifa;
      total += sub;
      desglose.push({ servicio: k, cantidad: v.cantidad, tarifa: v.tarifa, subtotal: sub });
    });
    return { total, desglose };
  }

  // ── Envío real ───────────────────────────────────────────────────────────────
  async function doEnviar() {
    if (!tipoId) { setErr('No se encontró el tipo de solicitud. Recarga la página.'); return; }
    setErr(''); setEnviando(true);
    try {
      const usr = getAuthSession()?.usuario;
      const { total: valorCalcTotal, desglose: desglosePago } = calcularValor();
      const payload = {
        tipoSolicitudId: tipoId,
        ...(areaSolId ? { areaId: areaSolId } : {}),
        datos: {
          periodoInicio, periodoFin,
          valorCobrar: String(valorCalcTotal),
          desglosePago: JSON.stringify(desglosePago),
          fechaInicioContrato, fechaFinContrato,
          tipoPlantillaAtenciones: tipoPlantillaAten,
          atencionesJson: tipoPlantillaAten === 'ppl' ? JSON.stringify(atenciones) : '[]',
          atencionesServicioJson: tipoPlantillaAten === 'servicio' ? JSON.stringify(atencionesServicio) : '[]',
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
        },
        documentos: {
          ...(docCartaEpsId      ? { cartaEps:                       { nombre: docCartaEpsNombre,      archivoId: docCartaEpsId      } } : {}),
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

  // ── Envío con verificación previa ────────────────────────────────────────────
  async function enviar() {
    const e = validarPaso();
    if (e) { setErr(e); return; }
    setErr('');

    // Verificar discrepancias contra el informe cargado
    const resultado = await verificarAtenciones();
    if (resultado && !resultado.sinInforme && resultado.hayDiscrepancias) {
      setDiscrepancias(resultado.discrepancias);
      setModalDiscrepancia(true);
      return;
    }

    await doEnviar();
  }

  if (msg) {
    return (
      <div className="leg-success card-surface">
        <div className="leg-success-icon">✓</div>
        <h3>Cuenta de cobro radicada</h3>
        <p>{msg}</p>
        <p className="leg-nota">Puedes hacer seguimiento en <strong>Mis solicitudes</strong>.</p>
        <button type="button" className="admin-primary-button"
          onClick={() => { setMsg(''); setPaso(1); setAtenciones([defaultAtencion()]); setConNotasAcl(false); setNotasAcl([defaultNota()]); setComentariosAdicionales(''); setDatosConfirmados(false); setFirma(''); setOpsAlDia(false); }}>
          Nueva cuenta de cobro
        </button>
      </div>
    );
  }

  const pasos = ['Período', 'Atenciones', 'Tus datos', 'Documentos', 'Firma'];
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
            <button type="button" className="admin-primary-button" disabled={cargandoAten} onClick={siguiente}>
              {cargandoAten ? 'Consultando informe…' : 'Continuar → Atenciones'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Paso 2: Atenciones ═══ */}
      {paso === 2 && (
        <div className="leg-form card-surface">
          <h3>{tipoPlantillaAten === 'ppl' ? 'Atenciones realizadas en PPL' : 'Atenciones realizadas por servicio'}</h3>

          {/* ── Selector tipo de plantilla ── */}
          <div className="leg-field" style={{ marginBottom: 16 }}>
            <label>Tipo de atenciones a reportar</label>
            <div className="leg-radio-group">
              <label className="leg-radio-item">
                <input type="radio" name="tipoPlantillaAten" value="ppl"
                  checked={tipoPlantillaAten === 'ppl'}
                  onChange={() => setTipoPlantillaAten('ppl')} />
                Atenciones realizadas en PPL
              </label>
              <label className="leg-radio-item">
                <input type="radio" name="tipoPlantillaAten" value="servicio"
                  checked={tipoPlantillaAten === 'servicio'}
                  onChange={() => setTipoPlantillaAten('servicio')} />
                Atenciones realizadas por servicio
              </label>
            </div>
          </div>

          {/* ── Formulario PPL ── */}
          {tipoPlantillaAten === 'ppl' && (
            <>
              <div className="ops-atenciones-section">
                <h4 className="ops-seccion-titulo">Atenciones por sede</h4>
                <p className="leg-nota" style={{ marginBottom: 10 }}>
                  Registra cada día de atención indicando la sede, la fecha y el número de HC cargadas.
                </p>

                {atenAutoload && (
                  <p style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: 6, background: 'rgba(22,163,74,.1)', border: '1px solid rgba(22,163,74,.3)', fontSize: 13 }}>
                    Atenciones pre-cargadas desde el informe. Verifica la regional, el establecimiento y los datos antes de continuar.
                  </p>
                )}

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
                      <div className="leg-field" style={{ flex: '1 1 180px' }}>
                        <label>Establecimiento</label>
                        <select value={a.sede} onChange={(e) => setAtencionField(a.id, 'sede', e.target.value)}>
                          {(REGIONALES_PPL[a.regional] || []).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="leg-field" style={{ flex: '1 1 170px' }}>
                        <label>Servicio <span className="req">*</span></label>
                        <select value={a.servicio} disabled={tarifasOps.length === 0}
                          onChange={(e) => setAtencionField(a.id, 'servicio', e.target.value)}>
                          <option value="">{tarifasOps.length === 0 ? 'Cargando…' : '— Selecciona —'}</option>
                          {tarifasOps.map(t => <option key={t.servicio} value={t.servicio}>{t.servicio}</option>)}
                        </select>
                      </div>
                      <div className="leg-field" style={{ flex: '0 0 140px' }}>
                        <label>Fecha <span className="req">*</span></label>
                        <input type="date" value={a.fecha} onChange={(e) => setAtencionField(a.id, 'fecha', e.target.value)} />
                      </div>
                      <div className="leg-field" style={{ flex: '0 0 85px' }}>
                        <label>N° HC <span className="req">*</span></label>
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
            </>
          )}

          {/* ── Formulario Por servicio ── */}
          {tipoPlantillaAten === 'servicio' && (
            <div className="ops-atenciones-section">
              <p className="leg-nota" style={{ marginBottom: 10 }}>
                Registra cada paciente con el servicio prestado y el número de sesiones.
              </p>

              {atencionesServicio.map((a, idx) => (
                <div key={a.id} className="ops-atencion-row">
                  <span className="ops-atencion-num">{idx + 1}</span>
                  <div className="ops-atencion-fields" style={{ flexWrap: 'wrap' }}>
                    <div className="leg-field" style={{ flex: '1 1 150px' }}>
                      <label>Nombres del paciente <span style={{ opacity: 0.5 }}>(opc.)</span></label>
                      <input type="text" placeholder="Nombres" value={a.nombres}
                        onChange={(e) => setAtencionesServicio(p => p.map(x => x.id === a.id ? { ...x, nombres: e.target.value } : x))} />
                    </div>
                    <div className="leg-field" style={{ flex: '1 1 150px' }}>
                      <label>Apellidos <span style={{ opacity: 0.5 }}>(opc.)</span></label>
                      <input type="text" placeholder="Apellidos" value={a.apellidos}
                        onChange={(e) => setAtencionesServicio(p => p.map(x => x.id === a.id ? { ...x, apellidos: e.target.value } : x))} />
                    </div>
                    <div className="leg-field" style={{ flex: '0 0 130px' }}>
                      <label>N° identificación <span className="req">*</span></label>
                      <input type="text" inputMode="numeric" placeholder="CC/TI" value={a.numId}
                        onChange={(e) => setAtencionesServicio(p => p.map(x => x.id === a.id ? { ...x, numId: e.target.value.replace(/\D/g, '') } : x))} />
                    </div>
                    <div className="leg-field" style={{ flex: '1 1 200px' }}>
                      <label>Servicio <span className="req">*</span></label>
                      <select value={a.servicio} disabled={tarifasOps.length === 0}
                        onChange={(e) => setAtencionesServicio(p => p.map(x => x.id === a.id ? { ...x, servicio: e.target.value } : x))}>
                        <option value="">{tarifasOps.length === 0 ? 'Cargando servicios…' : '— Selecciona —'}</option>
                        {tarifasOps.map(t => <option key={t.servicio} value={t.servicio}>{t.servicio}</option>)}
                      </select>
                    </div>
                    <div className="leg-field" style={{ flex: '0 0 100px' }}>
                      <label>Sesiones <span className="req">*</span></label>
                      <input type="number" min="1" placeholder="1" value={a.sesiones}
                        onChange={(e) => setAtencionesServicio(p => p.map(x => x.id === a.id ? { ...x, sesiones: e.target.value } : x))} />
                    </div>
                  </div>
                  {atencionesServicio.length > 1 && (
                    <button type="button" className="admin-ghost-button ops-rm-btn"
                      onClick={() => setAtencionesServicio(p => p.filter(x => x.id !== a.id))}>✕</button>
                  )}
                </div>
              ))}

              <button type="button" className="admin-ghost-button" style={{ marginTop: 8 }}
                onClick={() => setAtencionesServicio(p => [...p, defaultAtencionServicio()])}>
                + Agregar paciente / servicio
              </button>

              <p className="leg-nota" style={{ marginTop: 6 }}>
                Total sesiones: <strong>{atencionesServicio.reduce((s, a) => s + (parseInt(a.sesiones) || 0), 0)}</strong>
              </p>
            </div>
          )}

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

          {/* ── Documentos del profesional (todos obligatorios) ── */}
          <h4 className="ops-docs-grupo-titulo" style={{ marginTop: 20 }}>
            Documentos obligatorios <span className="ops-perfil-badge">✦ desde tu perfil</span>
          </h4>
          <p className="leg-nota" style={{ marginBottom: 10 }}>
            Todos los documentos son <strong>obligatorios</strong>. Se toman de tu perfil automáticamente. Si alguno falta, ve a <strong>Perfil → Documentos</strong> para cargarlo y vuelve aquí.
          </p>

          <DocField label="Certificado EPS o carta de afiliación" nota="Carta o cert. que acredita a qué EPS está afiliado."
            campo="cartaEps" id={docCartaEpsId} nombre={docCartaEpsNombre} subiendo={subiendoDoc}
            onSubir={subirDoc} onQuitar={() => { setDocCartaEpsId(''); setDocCartaEpsNombre(''); }} />

          <DocField label="Certificado de cuenta bancaria" nota="Certificado del banco que acredita la cuenta para el pago."
            campo="cuenta" id={docCuentaId} nombre={docCuentaNombre} subiendo={subiendoDoc}
            onSubir={subirDoc} onQuitar={() => { setDocCuentaId(''); setDocCuentaNombre(''); }} />

          <DocField label="Copia del documento de identidad" nota="Copia legible de la cédula u otro documento de identidad."
            campo="documento" id={docDocumentoId} nombre={docDocumentoNombre} subiendo={subiendoDoc}
            onSubir={subirDoc} onQuitar={() => { setDocDocumentoId(''); setDocDocumentoNombre(''); }} />

          <DocField label="Copia del RUT" nota="Registro Único Tributario actualizado."
            campo="rut" id={docRutId} nombre={docRutNombre} subiendo={subiendoDoc}
            onSubir={subirDoc} onQuitar={() => { setDocRutId(''); setDocRutNombre(''); }} />

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
              <span>Fechas de atención:</span>
              <strong>
                {atenciones.filter(a => a.fecha && a.hc).map(a => `${a.fecha} ${a.sede} (${a.hc} HC)`).join(', ') || '—'}
              </strong>
              <span>Banco:</span><strong>{banco} · {tipoCuenta} · {numeroCuenta}</strong>
              {(() => { const { total } = calcularValor(); return total > 0 ? (<><span>Valor total a cobrar:</span><strong style={{ color: 'var(--success, #16a34a)' }}>$ {total.toLocaleString('es-CO')}</strong></>) : null; })()}
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

      {/* ── Modal de discrepancias ── */}
      {modalDiscrepancia && (
        <div className="admin-permissions-overlay" style={{ zIndex: 9999 }} onClick={() => setModalDiscrepancia(false)}>
          <div className="admin-permissions-modal card-surface" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 8, color: 'var(--danger, #dc2626)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠</span> Diferencias con el informe cargado
            </h3>
            <p style={{ marginBottom: 14, fontSize: 14, color: 'var(--muted, #6b7280)' }}>
              Lo que declaras no coincide con el informe de atenciones del período. Revisa antes de radicar:
            </p>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(220,38,38,.1)' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid rgba(220,38,38,.2)' }}>Atención</th>
                    <th style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid rgba(220,38,38,.2)', whiteSpace: 'nowrap' }}>Declaradas</th>
                    <th style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid rgba(220,38,38,.2)', whiteSpace: 'nowrap' }}>En informe</th>
                    <th style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid rgba(220,38,38,.2)' }}>Dif.</th>
                  </tr>
                </thead>
                <tbody>
                  {discrepancias.map((d, i) => {
                    const desc = d.descripcion.replace(/\b(\d{4}-\d{2}-\d{2})\b/, (raw) => {
                      const dt = new Date(raw + 'T00:00:00');
                      if (isNaN(dt.getTime())) return raw;
                      const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
                      return `${dt.getDate()} ${M[dt.getMonth()]} ${dt.getFullYear()}`;
                    });
                    return (
                      <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,.07)', background: i % 2 === 1 ? 'rgba(0,0,0,.025)' : undefined }}>
                        <td style={{ padding: '6px 10px' }}>{desc}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{d.declaradas}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{d.registradas}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700,
                          color: d.diferencia < 0 ? 'var(--danger, #dc2626)' : 'var(--success, #16a34a)' }}>
                          {d.diferencia > 0 ? `+${d.diferencia}` : d.diferencia}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ marginBottom: 18, fontSize: 13 }}>
              Puedes <strong>enviar de todas formas</strong> y el analista revisará las diferencias,
              o <strong>revisar tus datos</strong> antes de radicar.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="admin-primary-button"
                disabled={enviando}
                onClick={async () => { setModalDiscrepancia(false); await doEnviar(); }}>
                {enviando ? 'Enviando…' : 'Enviar para revisión'}
              </button>
              <button type="button" className="admin-ghost-button"
                onClick={() => setModalDiscrepancia(false)}>
                Revisar mis datos
              </button>
            </div>
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
