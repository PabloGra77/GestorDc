import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/http/api';
import { getAuthSession, saveAuthSession } from '../auth/auth.service';

interface Area { id: number; nombre: string; activo: boolean; }

interface PerfilData {
  id: number;
  primerNombre?: string | null;
  segundoNombre?: string | null;
  primerApellido?: string | null;
  segundoApellido?: string | null;
  tipoDocumento?: string | null;
  numeroDocumento?: string | null;
  fechaNacimiento?: string | null;
  fechaExpedicion?: string | null;
  lugarExpedicion?: string | null;
  nombreCompleto: string;
  correo: string;
  correoPersonal?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  banco?: string | null;
  tipoCuenta?: string | null;
  numeroCuenta?: string | null;
  titularCuenta?: string | null;
  cargo?: string | null;
  eps?: string | null;
  archivoEpsId?: string | null;
  archivoEpsNombre?: string | null;
  archivoDocumentoId?: string | null;
  archivoDocumentoNombre?: string | null;
  archivoCuentaId?: string | null;
  archivoCuentaNombre?: string | null;
  archivoRutId?: string | null;
  archivoRutNombre?: string | null;
  archivoCartaEpsId?: string | null;
  archivoCartaEpsNombre?: string | null;
  rol: { nombre: string };
  areaId?: number | null;
  nivelAprobacion?: string | null;
}

type Seccion = 'personal' | 'contacto' | 'banco' | 'documentos';

const SECCIONES: { key: Seccion; label: string; icon: string }[] = [
  { key: 'personal',    label: 'Datos personales', icon: 'person' },
  { key: 'contacto',   label: 'Contacto',          icon: 'mail'   },
  { key: 'banco',      label: 'Cuenta bancaria',   icon: 'card'   },
  { key: 'documentos', label: 'Documentos OPS',    icon: 'file'   },
];

const CARGOS = [
  'ABOGADO JUNIOR',
  'AGENTE DE CALL CENTER',
  'ANALISTA CONTABLE',
  'ANALISTA CONTABLE Y NÓMINA',
  'ANALISTA DE COMPRAS JUNIOR',
  'ANALISTA DE FACTURACION',
  'ANALISTA DE GLOSAS Y FACTURACION',
  'ANALISTA DE PQRS Y SIAU',
  'ANALISTA DE TALENTO HUMANO',
  'APRENDIZ SENA',
  'ARQUITECTURA',
  'ASISTENTE DE GERENCIA',
  'ASISTENTE LOGISTICO',
  'AUDITOR GESTOR DE CALIDAD',
  'AUXILIAR ADMINISTRATIVO',
  'AUXILIAR ATENCION AL USUARIO',
  'AUXILIAR DE BODEGA',
  'AUXILIAR DE CALIDAD',
  'AUXILIAR DE ENFERMERIA',
  'AUXILIAR DE FACTURACION',
  'AUXILIAR DE FARMACIA',
  'AUXILIAR DE LABORATORIO',
  'AUXILIAR DE NUTRICION',
  'AUXILIAR DE SERVICIOS GENERALES',
  'AUXILIAR DE TALENTO HUMANO',
  'AUXILIAR DE TOMA DE MUESTRAS',
  'AUXILIAR ENFERMERIA INTEGRAL',
  'AUXILIAR ESTADISTICO Y SOFTWARE',
  'AUXILIAR JURIDICO',
  'AUXILIAR LINEA DE FRENTE',
  'AUXILIAR ODONTOLOGIA',
  'AUXILIAR SOPORTE TECNICO',
  'BACTERIOLOGO/A',
  'CONDUCTOR TODERO',
  'CONTADOR',
  'COORDINADOR DE COMPRAS Y ACTIVOS FIJOS',
  'COORDINADOR DE PHD',
  'COORDINADOR DE PSICOLOGIA',
  'COORDINADOR DEL SERVICIO',
  'COORDINADOR FISIOTERAPEUTA',
  'COORDINADOR REGIONAL CENTRAL',
  'COORDINADOR REGIONAL OCCIDENTE',
  'COORDINADOR REGIONAL ORIENTE',
  'COORDINADOR REGIONAL VIEJOCALDAS',
  'COORDINADORA DE OFICINA JURIDICA Y CONTRATACION',
  'COORDINADORA DE PIR Y CONSULTA EXTERNA',
  'CUIDADOR',
  'DIRECTOR ADMINISTRATIVO',
  'DIRECTOR DE CONTABILIDAD COSTOS Y TESORERIA',
  'DIRECTOR DE INNOVACION Y TECNOLOGIA',
  'EDUCACION ESPECIAL',
  'EDUCADORA ESPECIAL',
  'EDUCADORA ESPECIAL DE ACOMPAÑAMIENTO',
  'EDUCADORA ESPECIAL/TERAPEUTA ACOMPAÑAMIENTO',
  'ENFERMERA',
  'FISIOTERAPEUTA',
  'FISIOTERAPEUTA DOMICILIARIO',
  'FONOAUDIOLOGO(A)',
  'GERENTE ADMINISTRATIVO',
  'GERENTE FINANCIERO',
  'GERENTE Y REPRESENTANTE LEGAL',
  'GESTOR DOCUMENTAL',
  'HIGIENISTA ORAL',
  'INTERPRETE DE SEÑAS',
  'INVENTARISTA',
  'JEFE DE ENFERMERIA',
  'JEFE PARTICIPACION SOCIAL',
  'LIDER DE ESTADISTICA Y SOFTWARE',
  'MAESTRO DE OBRAS',
  'MEDICO',
  'MEDICO PSIQUIATRA',
  'NEUROPSICOLOGO',
  'NUTRICIONISTA',
  'ODONTOLOGA',
  'ORIENTADORA SERVICIO AL CLIENTE',
  'PROFESIONAL DE CALIDAD',
  'PROFESIONAL EN SEGURIDAD Y SALUD EN EL TRABAJO',
  'PSICOLOGA/TERAPEUTA ACOMPAÑAMIENTO',
  'PSICOLOGO',
  'PSICOPEDAGOGA',
  'PSICOPEDAGOGA/TERAPEUTA ACOMPAÑAMIENTO',
  'PSIQUIATRA',
  'PSIQUIATRIA',
  'QUIMICO FARMACEUTICO',
  'REGENTE DIRECTOR TECNICO DE ESTABLECIMIENTO CARC',
  'REGENTE DE FARMACIA',
  'SERVICIOS GENERALES',
  'SUBGERENTE ADMINISTRATIVO',
  'TECNICO DE SISTEMAS Y TECNOLOGIA',
  'TECNICO ESTADISTICO',
  'TERAPEUTA OCUPACIONAL',
  'TRABAJO SOCIAL',
];

const BANCOS = [
  'Bancolombia','Davivienda','Banco de Bogotá','Banco Popular','BBVA',
  'Scotiabank Colpatria','Banco de Occidente','Banco Caja Social','Banco Agrario',
  'Nequi','Daviplata','Banco Falabella','Banco Pichincha','Banco Finandina',
  'Lulo Bank','Rappi Pay','Banco Cooperativo Coopcentral',
  'Caja Promotora de Vivienda Militar',
];

function SeccionIcon({ name }: { name: string }) {
  const s = 17;
  if (name === 'person') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
  if (name === 'mail') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/>
    </svg>
  );
  if (name === 'card') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  );
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  );
}

function DocAdjunto({
  label, hint, subiendoDoc, tipo, nombre, onSubir, onQuitar,
}: {
  label: string; hint?: string;
  subiendoDoc: string | null; tipo: string; nombre: string;
  onSubir: (f: File, tipo: string) => void;
  onQuitar: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onSubir(f, tipo);
    e.target.value = '';
  }, [onSubir, tipo]);

  return (
    <div className="prof-doc-item">
      <div className="prof-doc-info">
        <span className="prof-doc-label">{label}</span>
        {hint && <span className="prof-doc-hint">{hint}</span>}
      </div>
      <div className="prof-doc-actions">
        {subiendoDoc === tipo ? (
          <span className="prof-doc-uploading">Subiendo…</span>
        ) : nombre ? (
          <>
            <span className="prof-doc-ok">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
              {nombre}
            </span>
            <button type="button" className="prof-doc-quitar" onClick={onQuitar}>Quitar</button>
          </>
        ) : (
          <label className="prof-doc-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adjuntar
            <input ref={inputRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleChange} />
          </label>
        )}
      </div>
    </div>
  );
}

export function ProfilePanel() {
  const session = getAuthSession();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [seccion, setSeccion] = useState<Seccion>('personal');

  const [primerNombre, setPrimerNombre] = useState('');
  const [segundoNombre, setSegundoNombre] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('CC');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [fechaExpedicion, setFechaExpedicion] = useState('');
  const [lugarExpedicion, setLugarExpedicion] = useState('');
  const [correo, setCorreo] = useState('');
  const [correoPersonal, setCorreoPersonal] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('ahorros');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [titularCuenta, setTitularCuenta] = useState('');
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaId, setAreaId] = useState<number | null>(null);
  const [eps, setEps] = useState('');
  const [archivoEpsId, setArchivoEpsId] = useState('');
  const [archivoEpsNombre, setArchivoEpsNombre] = useState('');
  const [archivoDocumentoId, setArchivoDocumentoId] = useState('');
  const [archivoDocumentoNombre, setArchivoDocumentoNombre] = useState('');
  const [archivoCuentaId, setArchivoCuentaId] = useState('');
  const [archivoCuentaNombre, setArchivoCuentaNombre] = useState('');
  const [archivoRutId, setArchivoRutId] = useState('');
  const [archivoRutNombre, setArchivoRutNombre] = useState('');
  const [archivoCartaEpsId, setArchivoCartaEpsId] = useState('');
  const [archivoCartaEpsNombre, setArchivoCartaEpsNombre] = useState('');
  const [cargo, setCargo] = useState('');
  const [sugCargo, setSugCargo] = useState<string[]>([]);
  const [subiendoDoc, setSubiendoDoc] = useState<string | null>(null);
  const [errDoc, setErrDoc] = useState('');

  useEffect(() => {
    api.get<Area[]>('/areas').then((r) => setAreas(r.data.filter((a) => a.activo))).catch(() => {});
    api.get<PerfilData>('/usuarios/perfil').then((r) => {
      const p = r.data;
      setPerfil(p);
      setAreaId(p.areaId ?? null);
      const partes = p.nombreCompleto.split(' ');
      setPrimerNombre(p.primerNombre || partes[0] || '');
      setSegundoNombre(p.segundoNombre || '');
      setPrimerApellido(p.primerApellido || partes[1] || '');
      setSegundoApellido(p.segundoApellido || '');
      setTipoDocumento(p.tipoDocumento || 'CC');
      setNumeroDocumento(p.numeroDocumento || '');
      setFechaNacimiento(p.fechaNacimiento || '');
      setFechaExpedicion(p.fechaExpedicion || '');
      setLugarExpedicion(p.lugarExpedicion || '');
      setCorreo(p.correo || '');
      setCorreoPersonal(p.correoPersonal || '');
      setTelefono(p.telefono || '');
      setDireccion(p.direccion || '');
      setBanco(p.banco || '');
      setTipoCuenta(p.tipoCuenta || 'ahorros');
      setNumeroCuenta(p.numeroCuenta || '');
      setTitularCuenta(p.titularCuenta || '');
      setEps(p.eps || '');
      setArchivoEpsId(p.archivoEpsId || '');
      setArchivoEpsNombre(p.archivoEpsNombre || '');
      setArchivoDocumentoId(p.archivoDocumentoId || '');
      setArchivoDocumentoNombre(p.archivoDocumentoNombre || '');
      setArchivoCuentaId(p.archivoCuentaId || '');
      setArchivoCuentaNombre(p.archivoCuentaNombre || '');
      setArchivoRutId(p.archivoRutId || '');
      setArchivoRutNombre(p.archivoRutNombre || '');
      setArchivoCartaEpsId(p.archivoCartaEpsId || '');
      setArchivoCartaEpsNombre(p.archivoCartaEpsNombre || '');
      setCargo(p.cargo || '');
    }).catch(() => setErr('No se pudo cargar el perfil.'))
      .finally(() => setLoading(false));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true); setErr(''); setMsg('');
    try {
      const r = await api.patch<PerfilData>('/usuarios/perfil', {
        primerNombre: primerNombre.trim(),
        segundoNombre: segundoNombre.trim() || null,
        primerApellido: primerApellido.trim(),
        segundoApellido: segundoApellido.trim() || null,
        tipoDocumento,
        numeroDocumento: numeroDocumento.trim(),
        ...(fechaNacimiento  ? { fechaNacimiento }  : { fechaNacimiento: null }),
        ...(fechaExpedicion  ? { fechaExpedicion }  : { fechaExpedicion: null }),
        ...(lugarExpedicion.trim() ? { lugarExpedicion: lugarExpedicion.trim() } : { lugarExpedicion: null }),
        correo: correo.trim(),
        ...(correoPersonal.trim() ? { correoPersonal: correoPersonal.trim() } : { correoPersonal: null }),
        ...(telefono.trim()       ? { telefono: telefono.trim() }             : { telefono: null }),
        ...(direccion.trim()      ? { direccion: direccion.trim() }           : { direccion: null }),
        ...(banco                 ? { banco: banco.trim() }                   : { banco: null }),
        tipoCuenta: tipoCuenta || 'ahorros',
        ...(numeroCuenta.trim()   ? { numeroCuenta: numeroCuenta.trim() }     : { numeroCuenta: null }),
        ...(titularCuenta.trim()  ? { titularCuenta: titularCuenta.trim() }   : { titularCuenta: null }),
        ...(eps.trim()            ? { eps: eps.trim() }                       : { eps: null }),
        ...(cargo.trim()          ? { cargo: cargo.trim() }                   : { cargo: null }),
        areaId: areaId ?? null,
      });
      setPerfil(r.data);
      setMsg('Perfil actualizado correctamente.');
      if (session) {
        saveAuthSession({
          ...session,
          usuario: {
            ...session.usuario,
            nombreCompleto: r.data.nombreCompleto,
            correo: r.data.correo,
            primerNombre: r.data.primerNombre ?? undefined,
            primerApellido: r.data.primerApellido ?? undefined,
            tipoDocumento: r.data.tipoDocumento ?? undefined,
            numeroDocumento: r.data.numeroDocumento ?? undefined,
            areaId: r.data.areaId ?? undefined,
          },
        });
      }
    } catch (ex: unknown) {
      const m = (ex as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErr(m || 'No se pudo guardar el perfil.');
    } finally {
      setGuardando(false);
    }
  }

  async function subirDoc(file: File, tipo: string) {
    setErrDoc(''); setSubiendoDoc(tipo);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const r = await api.post<{ id: string }>('/archivos', fd, { headers: { 'Content-Type': undefined } });
      const id = r.data.id; const nombre = file.name;
      const patch: Record<string, string | null> = {};
      if (tipo === 'eps') {
        setArchivoEpsId(id); setArchivoEpsNombre(nombre);
        patch.archivoEpsId = id; patch.archivoEpsNombre = nombre;
      } else if (tipo === 'documento') {
        setArchivoDocumentoId(id); setArchivoDocumentoNombre(nombre);
        patch.archivoDocumentoId = id; patch.archivoDocumentoNombre = nombre;
      } else if (tipo === 'rut') {
        setArchivoRutId(id); setArchivoRutNombre(nombre);
        patch.archivoRutId = id; patch.archivoRutNombre = nombre;
      } else if (tipo === 'carta_eps') {
        setArchivoCartaEpsId(id); setArchivoCartaEpsNombre(nombre);
        patch.archivoCartaEpsId = id; patch.archivoCartaEpsNombre = nombre;
      } else {
        setArchivoCuentaId(id); setArchivoCuentaNombre(nombre);
        patch.archivoCuentaId = id; patch.archivoCuentaNombre = nombre;
      }
      await api.patch('/usuarios/perfil', patch);
    } catch {
      setErrDoc('No se pudo subir el archivo. Máx 10 MB, formatos: PDF, JPG, PNG.');
    } finally { setSubiendoDoc(null); }
  }

  function quitarDoc(tipo: string) {
    const patch: Record<string, null> = {};
    if (tipo === 'eps') { setArchivoEpsId(''); setArchivoEpsNombre(''); patch.archivoEpsId = null; patch.archivoEpsNombre = null; }
    else if (tipo === 'documento') { setArchivoDocumentoId(''); setArchivoDocumentoNombre(''); patch.archivoDocumentoId = null; patch.archivoDocumentoNombre = null; }
    else if (tipo === 'cuenta') { setArchivoCuentaId(''); setArchivoCuentaNombre(''); patch.archivoCuentaId = null; patch.archivoCuentaNombre = null; }
    else if (tipo === 'rut') { setArchivoRutId(''); setArchivoRutNombre(''); patch.archivoRutId = null; patch.archivoRutNombre = null; }
    else if (tipo === 'carta_eps') { setArchivoCartaEpsId(''); setArchivoCartaEpsNombre(''); patch.archivoCartaEpsId = null; patch.archivoCartaEpsNombre = null; }
    api.patch('/usuarios/perfil', patch).catch(() => {});
  }

  /* Completitud del perfil */
  const camposObligatorios = [primerNombre, primerApellido, numeroDocumento, correo];
  const camposOpcionales = [segundoNombre, primerApellido, tipoDocumento, fechaNacimiento, telefono, direccion, banco, numeroCuenta, eps, cargo];
  const todos = [...camposObligatorios, ...camposOpcionales];
  const llenos = todos.filter(Boolean).length;
  const pct = Math.round((llenos / todos.length) * 100);

  const inicial = (perfil?.nombreCompleto?.[0] || session?.usuario.nombreCompleto?.[0] || 'U').toUpperCase();
  const areaNombre = areaId ? (areas.find((a) => a.id === areaId)?.nombre ?? '') : '';

  if (loading) {
    return (
      <div className="prof-shell">
        <div className="prof-loading">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="prof-loading-icon" aria-hidden>
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
            <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
          </svg>
          <p>Cargando perfil…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prof-shell">
      {/* ── Hero ── */}
      <div className="prof-hero">
        <div className="prof-hero-avatar">{inicial}</div>
        <div className="prof-hero-info">
          <h2 className="prof-hero-nombre">{perfil?.nombreCompleto || 'Mi perfil'}</h2>
          <div className="prof-hero-badges">
            <span className="prof-badge prof-badge--rol">{perfil?.rol?.nombre ?? 'Usuario'}</span>
            {areaNombre && <span className="prof-badge prof-badge--area">{areaNombre}</span>}
            {perfil?.nivelAprobacion && <span className="prof-badge prof-badge--nivel">Nivel {perfil.nivelAprobacion}</span>}
          </div>
          <div className="prof-completitud">
            <div className="prof-completitud-bar">
              <div className="prof-completitud-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="prof-completitud-pct">{pct}% completado</span>
          </div>
        </div>
      </div>

      {/* ── Mensajes globales ── */}
      {err ? <div className="admin-error" style={{ margin: '0 0 12px' }}>{err}</div> : null}
      {msg ? <div className="admin-success" style={{ margin: '0 0 12px' }}>{msg}</div> : null}

      {/* ── Tabs de sección ── */}
      <nav className="prof-tabs" aria-label="Secciones del perfil">
        {SECCIONES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`prof-tab${seccion === s.key ? ' prof-tab--active' : ''}`}
            onClick={() => { setSeccion(s.key); setMsg(''); setErr(''); }}
          >
            <span className="prof-tab-icon"><SeccionIcon name={s.icon} /></span>
            <span className="prof-tab-label">{s.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Contenido ── */}
      <form className="prof-form" onSubmit={guardar}>

        {/* ─── DATOS PERSONALES ─── */}
        {seccion === 'personal' && (
          <div className="prof-section">
            <div className="prof-section-head">
              <h3>Datos personales</h3>
              <p>Nombre completo e información del documento de identidad.</p>
            </div>
            <div className="prof-fields-grid">
              <div className="prof-field">
                <label>Primer nombre *</label>
                <input type="text" value={primerNombre} onChange={(e) => setPrimerNombre(e.target.value)} required placeholder="Ej: María" />
              </div>
              <div className="prof-field">
                <label>Segundo nombre</label>
                <input type="text" value={segundoNombre} onChange={(e) => setSegundoNombre(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="prof-field">
                <label>Primer apellido *</label>
                <input type="text" value={primerApellido} onChange={(e) => setPrimerApellido(e.target.value)} required placeholder="Ej: García" />
              </div>
              <div className="prof-field">
                <label>Segundo apellido</label>
                <input type="text" value={segundoApellido} onChange={(e) => setSegundoApellido(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="prof-field">
                <label>Tipo de documento</label>
                <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
                  <option value="CC">Cédula (CC)</option>
                  <option value="CE">Cédula extranjería (CE)</option>
                  <option value="TI">Tarjeta identidad (TI)</option>
                  <option value="PP">Pasaporte (PP)</option>
                </select>
              </div>
              <div className="prof-field">
                <label>Número de documento *</label>
                <input type="text" value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} required placeholder="Número de documento" />
              </div>
              <div className="prof-field">
                <label>Fecha de nacimiento</label>
                <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
              </div>
              <div className="prof-field">
                <label>Fecha de expedición</label>
                <input type="date" value={fechaExpedicion} onChange={(e) => setFechaExpedicion(e.target.value)} />
              </div>
              <div className="prof-field prof-field--full">
                <label>Lugar de expedición</label>
                <input type="text" value={lugarExpedicion} onChange={(e) => setLugarExpedicion(e.target.value)} placeholder="Ej: Bogotá D.C." maxLength={150} />
              </div>
              <div className="prof-field prof-field--full prof-cargo-wrap">
                <label>Cargo</label>
                <input
                  type="text"
                  value={cargo}
                  autoComplete="off"
                  placeholder="Escribe para buscar tu cargo…"
                  maxLength={150}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCargo(v);
                    const q = v.trim().toUpperCase();
                    setSugCargo(q.length >= 2 ? CARGOS.filter((c) => c.includes(q)).slice(0, 8) : []);
                  }}
                  onBlur={() => setTimeout(() => setSugCargo([]), 150)}
                />
                {sugCargo.length > 0 && (
                  <ul className="prof-cargo-sugerencias">
                    {sugCargo.map((s) => (
                      <li key={s} onMouseDown={() => { setCargo(s); setSugCargo([]); }}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── CONTACTO ─── */}
        {seccion === 'contacto' && (
          <div className="prof-section">
            <div className="prof-section-head">
              <h3>Contacto</h3>
              <p>Correos, teléfono y área organizacional.</p>
            </div>
            <div className="prof-fields-grid">
              <div className="prof-field prof-field--full">
                <label>Correo institucional *</label>
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required placeholder="usuario@ipsgoleman.com" />
                <span className="prof-field-hint">Debe ser correo con dominio @ipsgoleman.com</span>
              </div>
              <div className="prof-field prof-field--full">
                <label>Correo personal</label>
                <input type="email" value={correoPersonal} onChange={(e) => setCorreoPersonal(e.target.value)} placeholder="Ej: usuario@gmail.com" maxLength={120} />
                <span className="prof-field-hint">Correo de uso personal (cualquier dominio)</span>
              </div>
              <div className="prof-field">
                <label>Teléfono / Celular</label>
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 3001234567" maxLength={20} />
              </div>
              <div className="prof-field">
                <label>Dirección</label>
                <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Ej: Cra 10 #25-30, Bogotá" maxLength={255} />
              </div>
              <div className="prof-field prof-field--full">
                <label>Área organizacional</label>
                <select value={areaId ?? ''} onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Sin área asignada</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
                <span className="prof-field-hint">Define qué área aparece en tus solicitudes y quién las valida primero.</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── CUENTA BANCARIA ─── */}
        {seccion === 'banco' && (
          <div className="prof-section">
            <div className="prof-section-head">
              <h3>Cuenta bancaria</h3>
              <p>Estos datos se pre-rellenan automáticamente en las solicitudes de legalización.</p>
            </div>
            <div className="prof-fields-grid">
              <div className="prof-field">
                <label>Banco</label>
                <select value={banco} onChange={(e) => setBanco(e.target.value)}>
                  <option value="">Selecciona banco</option>
                  {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="prof-field">
                <label>Tipo de cuenta</label>
                <select value={tipoCuenta} onChange={(e) => setTipoCuenta(e.target.value)}>
                  <option value="ahorros">Ahorros</option>
                  <option value="corriente">Corriente</option>
                </select>
              </div>
              <div className="prof-field">
                <label>Número de cuenta</label>
                <input type="text" value={numeroCuenta} onChange={(e) => setNumeroCuenta(e.target.value)} placeholder="Ej: 12345678901" maxLength={30} />
              </div>
              <div className="prof-field">
                <label>Titular de la cuenta</label>
                <input type="text" value={titularCuenta} onChange={(e) => setTitularCuenta(e.target.value)} placeholder="Nombre exacto en la cuenta" maxLength={120} />
              </div>
            </div>
          </div>
        )}

        {/* ─── DOCUMENTOS OPS ─── */}
        {seccion === 'documentos' && (
          <div className="prof-section">
            <div className="prof-section-head">
              <h3>Documentos para Cuenta de Cobro OPS</h3>
              <p>Se adjuntan automáticamente al crear una Cuenta de Cobro OPS. Súbelos una vez y no tendrás que hacerlo de nuevo.</p>
            </div>

            {errDoc ? <div className="admin-error" style={{ marginBottom: 12 }}>{errDoc}</div> : null}

            <div className="prof-field prof-field--full" style={{ marginBottom: 16 }}>
              <label>EPS a la que está afiliado</label>
              <input type="text" value={eps} onChange={(e) => setEps(e.target.value)} placeholder="Ej: Sura, Nueva EPS, Sanitas…" maxLength={120} />
            </div>

            <div className="prof-docs-list">
              <DocAdjunto label="Certificado de afiliaciones (EPS / ARL / Pensión)"
                tipo="eps" nombre={archivoEpsNombre} subiendoDoc={subiendoDoc}
                onSubir={subirDoc} onQuitar={() => quitarDoc('eps')} />
              <DocAdjunto label="Copia del documento de identidad"
                tipo="documento" nombre={archivoDocumentoNombre} subiendoDoc={subiendoDoc}
                onSubir={subirDoc} onQuitar={() => quitarDoc('documento')} />
              <DocAdjunto label="Certificado de cuenta bancaria"
                tipo="cuenta" nombre={archivoCuentaNombre} subiendoDoc={subiendoDoc}
                onSubir={subirDoc} onQuitar={() => quitarDoc('cuenta')} />
              <DocAdjunto label="Carta informando EPS" hint="Carta o constancia de afiliación a EPS. Se adjunta automáticamente en cada radicación."
                tipo="carta_eps" nombre={archivoCartaEpsNombre} subiendoDoc={subiendoDoc}
                onSubir={subirDoc} onQuitar={() => quitarDoc('carta_eps')} />
              <DocAdjunto label="Copia del RUT" hint="Requerido para colaboradores nuevos. Se adjunta automáticamente si está guardado aquí."
                tipo="rut" nombre={archivoRutNombre} subiendoDoc={subiendoDoc}
                onSubir={subirDoc} onQuitar={() => quitarDoc('rut')} />
            </div>
          </div>
        )}

        {/* Botón guardar (no en documentos porque se guarda inmediatamente al subir) */}
        {seccion !== 'documentos' && (
          <div className="prof-save-row">
            <button type="submit" className="admin-primary-button prof-save-btn" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
