import { useEffect, useState } from 'react';
import { api } from '../../services/http/api';
import { getAuthSession, saveAuthSession } from '../auth/auth.service';

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
  rol: { nombre: string };
  areaId?: number | null;
  nivelAprobacion?: string | null;
}

export function ProfilePanel() {
  const session = getAuthSession();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

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

  useEffect(() => {
    api.get<PerfilData>('/usuarios/perfil').then((r) => {
      const p = r.data;
      setPerfil(p);
      const partes = p.nombreCompleto.split(' ');
      setPrimerNombre(p.primerNombre || partes[0] || '');
      setSegundoNombre(p.segundoNombre || '');
      setPrimerApellido(p.primerApellido || (partes.length >= 3 ? partes[2] : partes[1]) || '');
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
    }).catch(() => {
      setErr('No se pudo cargar el perfil.');
    }).finally(() => setLoading(false));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setErr('');
    setMsg('');
    try {
      const r = await api.patch<PerfilData>('/usuarios/perfil', {
        primerNombre: primerNombre.trim(),
        segundoNombre: segundoNombre.trim() || null,
        primerApellido: primerApellido.trim(),
        segundoApellido: segundoApellido.trim() || null,
        tipoDocumento,
        numeroDocumento: numeroDocumento.trim(),
        ...(fechaNacimiento ? { fechaNacimiento } : { fechaNacimiento: null }),
        ...(fechaExpedicion ? { fechaExpedicion } : { fechaExpedicion: null }),
        ...(lugarExpedicion.trim() ? { lugarExpedicion: lugarExpedicion.trim() } : { lugarExpedicion: null }),
        correo: correo.trim(),
        ...(correoPersonal.trim() ? { correoPersonal: correoPersonal.trim() } : { correoPersonal: null }),
        ...(telefono.trim() ? { telefono: telefono.trim() } : { telefono: null }),
        ...(direccion.trim() ? { direccion: direccion.trim() } : { direccion: null }),
        ...(banco ? { banco: banco.trim() } : { banco: null }),
        tipoCuenta: tipoCuenta || 'ahorros',
        ...(numeroCuenta.trim() ? { numeroCuenta: numeroCuenta.trim() } : { numeroCuenta: null }),
        ...(titularCuenta.trim() ? { titularCuenta: titularCuenta.trim() } : { titularCuenta: null }),
      });
      setPerfil(r.data);
      setMsg('Perfil actualizado correctamente.');

      // Actualizar nombre en sesión para que el sidebar lo refleje
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
          },
        });
      }
    } catch (ex: unknown) {
      const errMsg = (ex as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErr(errMsg || 'No se pudo guardar el perfil.');
    } finally {
      setGuardando(false);
    }
  }

  const inicial = (perfil?.nombreCompleto?.[0] || session?.usuario.nombreCompleto?.[0] || 'U').toUpperCase();

  return (
    <section className="profile-panel card-surface">
      <header className="admin-panel-head">
        <div>
          <h3>Mi perfil</h3>
          <p className="admin-help-text">Actualiza tus datos personales. Tu correo debe ser institucional (@ipsgoleman.com).</p>
        </div>
      </header>

      {loading ? <p className="admin-help-text">Cargando perfil…</p> : null}
      {err ? <div className="admin-error">{err}</div> : null}
      {msg ? <div className="admin-success">{msg}</div> : null}

      {perfil && !loading ? (
        <div className="profile-layout">
          {/* Avatar + info estática */}
          <div className="profile-avatar-col">
            <div className="profile-avatar-circle">{inicial}</div>
            <p className="profile-nombre-display">{perfil.nombreCompleto}</p>
            <p className="admin-help-text">{perfil.rol?.nombre}</p>
            {perfil.nivelAprobacion ? (
              <p className="admin-help-text">Nivel: {perfil.nivelAprobacion}</p>
            ) : null}
          </div>

          {/* Formulario */}
          <form className="profile-form admin-form" onSubmit={guardar}>
            <h4>Datos personales</h4>

            <div className="admin-user-form-grid">
              <div>
                <label className="profile-label">Primer nombre *</label>
                <input
                  type="text"
                  className="admin-input"
                  value={primerNombre}
                  onChange={(e) => setPrimerNombre(e.target.value)}
                  required
                  placeholder="Ej: María"
                />
              </div>
              <div>
                <label className="profile-label">Segundo nombre</label>
                <input
                  type="text"
                  className="admin-input"
                  value={segundoNombre}
                  onChange={(e) => setSegundoNombre(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="profile-label">Primer apellido *</label>
                <input
                  type="text"
                  className="admin-input"
                  value={primerApellido}
                  onChange={(e) => setPrimerApellido(e.target.value)}
                  required
                  placeholder="Ej: García"
                />
              </div>
              <div>
                <label className="profile-label">Segundo apellido</label>
                <input
                  type="text"
                  className="admin-input"
                  value={segundoApellido}
                  onChange={(e) => setSegundoApellido(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <h4 style={{ marginTop: 16 }}>Documento de identidad</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <div>
                <label className="profile-label">Tipo</label>
                <select
                  className="admin-input"
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value)}
                >
                  <option value="CC">Cédula (CC)</option>
                  <option value="CE">Cédula extranjería (CE)</option>
                  <option value="TI">Tarjeta identidad (TI)</option>
                  <option value="PP">Pasaporte (PP)</option>
                </select>
              </div>
              <div>
                <label className="profile-label">Número *</label>
                <input
                  type="text"
                  className="admin-input"
                  value={numeroDocumento}
                  onChange={(e) => setNumeroDocumento(e.target.value)}
                  required
                  placeholder="Número de documento"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <div>
                <label className="profile-label">Fecha de nacimiento</label>
                <input
                  type="date"
                  className="admin-input"
                  value={fechaNacimiento}
                  onChange={(e) => setFechaNacimiento(e.target.value)}
                />
              </div>
              <div>
                <label className="profile-label">Fecha de expedición</label>
                <input
                  type="date"
                  className="admin-input"
                  value={fechaExpedicion}
                  onChange={(e) => setFechaExpedicion(e.target.value)}
                />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="profile-label">Lugar de expedición</label>
              <input
                type="text"
                className="admin-input"
                value={lugarExpedicion}
                onChange={(e) => setLugarExpedicion(e.target.value)}
                placeholder="Ej: Bogotá D.C."
                maxLength={150}
              />
            </div>

            <h4 style={{ marginTop: 16 }}>Contacto</h4>
            <div>
              <label className="profile-label">Correo institucional *</label>
              <input
                type="email"
                className="admin-input"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                placeholder="usuario@ipsgoleman.com"
              />
              <p className="admin-help-text" style={{ marginTop: 3 }}>Debe ser correo con dominio @ipsgoleman.com</p>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="profile-label">Correo personal</label>
              <input
                type="email"
                className="admin-input"
                value={correoPersonal}
                onChange={(e) => setCorreoPersonal(e.target.value)}
                placeholder="Ej: usuario@gmail.com"
                maxLength={120}
              />
              <p className="admin-help-text" style={{ marginTop: 3 }}>Correo de uso personal (cualquier dominio)</p>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="profile-label">Teléfono / Celular</label>
              <input
                type="tel"
                className="admin-input"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 3001234567"
                maxLength={20}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="profile-label">Dirección</label>
              <input
                type="text"
                className="admin-input"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Ej: Cra 10 #25-30, Bogotá"
                maxLength={255}
              />
            </div>

            <h4 style={{ marginTop: 16 }}>Cuenta bancaria para pagos</h4>
            <p className="admin-help-text" style={{ marginBottom: 8 }}>
              Estos datos se pre-rellenan automáticamente en las solicitudes de legalización.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <div>
                <label className="profile-label">Banco</label>
                <select
                  className="admin-input"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                >
                  <option value="">Selecciona banco</option>
                  {['Bancolombia','Davivienda','Banco de Bogotá','Banco Popular','BBVA','Scotiabank Colpatria','Banco de Occidente','Banco Caja Social','Banco Agrario','Nequi','Daviplata','Banco Falabella','Banco Pichincha','Banco Finandina','Lulo Bank','Rappi Pay','Banco Cooperativo Coopcentral','Caja Promotora de Vivienda Militar'].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="profile-label">Tipo de cuenta</label>
                <select
                  className="admin-input"
                  value={tipoCuenta}
                  onChange={(e) => setTipoCuenta(e.target.value)}
                >
                  <option value="ahorros">Ahorros</option>
                  <option value="corriente">Corriente</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="profile-label">Número de cuenta</label>
              <input
                type="text"
                className="admin-input"
                value={numeroCuenta}
                onChange={(e) => setNumeroCuenta(e.target.value)}
                placeholder="Ej: 12345678901"
                maxLength={30}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="profile-label">Titular de la cuenta</label>
              <input
                type="text"
                className="admin-input"
                value={titularCuenta}
                onChange={(e) => setTitularCuenta(e.target.value)}
                placeholder="Nombre exacto como aparece en la cuenta"
                maxLength={120}
              />
            </div>

            <div style={{ marginTop: 20 }}>
              <button type="submit" className="admin-primary-button" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
