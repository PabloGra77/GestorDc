import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/http/api';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  usuario: string;
  remitente: string;
  passwordConfigurada: boolean;
  fuente: 'base_datos' | 'env';
}

export function ConfiguracionSmtpPanel() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [host, setHost] = useState('');
  const [port, setPort] = useState<number | ''>(465);
  const [secure, setSecure] = useState(true);
  const [usuario, setUsuario] = useState('');
  const [remitente, setRemitente] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfigurada, setPasswordConfigurada] = useState(false);
  const [fuente, setFuente] = useState<'base_datos' | 'env'>('env');

  const [destinatarioPrueba, setDestinatarioPrueba] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await api.get<SmtpConfig>('/config/smtp');
      setHost(r.data.host ?? '');
      setPort(typeof r.data.port === 'number' ? r.data.port : 465);
      setSecure(Boolean(r.data.secure));
      setUsuario(r.data.usuario ?? '');
      setRemitente(r.data.remitente ?? '');
      setPasswordConfigurada(Boolean(r.data.passwordConfigurada));
      setFuente(r.data.fuente ?? 'env');
      setPassword('');
    } catch {
      setErr('No se pudo cargar la configuración SMTP.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg('');
    setErr('');
    if (!host.trim() || !usuario.trim()) {
      setErr('Host y usuario son obligatorios.');
      return;
    }
    if (!passwordConfigurada && !password.trim()) {
      setErr('Debes ingresar la contraseña (App Password) la primera vez.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        host: host.trim(),
        port: typeof port === 'number' ? port : Number(port) || 465,
        secure,
        usuario: usuario.trim(),
        remitente: remitente.trim(),
      };
      // Solo enviar la contraseña si el usuario escribió una nueva (campo de solo-escritura).
      if (password.trim()) payload.password = password.trim();
      await api.put('/config/smtp', payload);
      setMsg('Configuración SMTP guardada.');
      setPassword('');
      cargar();
    } catch (e) {
      const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(r || 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  async function enviarPrueba() {
    setMsg('');
    setErr('');
    const dest = destinatarioPrueba.trim();
    if (!dest) {
      setErr('Ingresa un correo destinatario para la prueba.');
      return;
    }
    setTesting(true);
    try {
      await api.post('/config/smtp/test', { destinatario: dest });
      setMsg(`Correo de prueba enviado a ${dest}. Revisa la bandeja (y spam).`);
    } catch (e) {
      const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(r || 'No se pudo enviar el correo de prueba.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="admin-areas-panel">
      <div className="admin-form-grid">
        <form className="admin-form card-surface" onSubmit={guardar}>
          <header className="admin-panel-head">
            <div>
              <h3>Configuración de correo (SMTP)</h3>
              <p className="admin-help-text">
                Servidor de envío de correos de la plataforma (notificaciones, registro, recuperación
                de contraseña). Para Gmail usa <code>smtp.gmail.com</code>, puerto <code>465</code>,
                SSL activo, y una <strong>App Password</strong> de 16 caracteres.
              </p>
            </div>
          </header>

          <div className="admin-user-form-grid">
            <div className="form-group">
              <label htmlFor="smtp-host">Host SMTP</label>
              <input
                id="smtp-host"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="smtp-port">Puerto</label>
              <input
                id="smtp-port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="465"
              />
            </div>
            <div className="form-group">
              <label htmlFor="smtp-user">Usuario (correo)</label>
              <input
                id="smtp-user"
                type="email"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="notificaciones@tudominio.com"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="smtp-from">Remitente (From)</label>
              <input
                id="smtp-from"
                type="text"
                value={remitente}
                onChange={(e) => setRemitente(e.target.value)}
                placeholder="Payops <notificaciones@tudominio.com>"
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="smtp-pass">
                Contraseña / App Password{' '}
                {passwordConfigurada ? (
                  <span className="admin-state-active">· ya configurada</span>
                ) : (
                  <span className="admin-state-inactive">· sin configurar</span>
                )}
              </label>
              <input
                id="smtp-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={passwordConfigurada ? 'Dejar vacío para no cambiarla' : 'Pega aquí la App Password'}
                autoComplete="new-password"
              />
              <p className="admin-help-text">
                Por seguridad nunca se muestra la contraseña guardada. Escribe una nueva solo si quieres
                cambiarla.
              </p>
            </div>
            <label className="ops-checkbox" style={{ alignSelf: 'end' }}>
              <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} /> Conexión
              segura (SSL/TLS)
            </label>
          </div>

          <p className="admin-help-text">
            Fuente actual de la configuración:{' '}
            <strong>{fuente === 'base_datos' ? 'base de datos (este panel)' : 'archivo .env del servidor'}</strong>
          </p>

          {msg ? <div className="admin-success">{msg}</div> : null}
          {err ? <div className="admin-error">{err}</div> : null}

          <button type="submit" className="admin-primary-button" disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </form>

        <aside className="admin-side-list card-surface">
          <header className="admin-panel-head">
            <div>
              <h3>Enviar correo de prueba</h3>
              <p className="admin-help-text">
                Verifica que el envío funcione con la configuración guardada.
              </p>
            </div>
            <button type="button" className="admin-refresh-button" onClick={cargar} disabled={loading}>
              {loading ? 'Cargando…' : 'Refrescar'}
            </button>
          </header>

          <div className="form-group">
            <label htmlFor="smtp-test-to">Correo destinatario</label>
            <input
              id="smtp-test-to"
              type="email"
              value={destinatarioPrueba}
              onChange={(e) => setDestinatarioPrueba(e.target.value)}
              placeholder="tu-correo@ejemplo.com"
            />
          </div>
          <button
            type="button"
            className="admin-ghost-button"
            onClick={enviarPrueba}
            disabled={testing || loading}
          >
            {testing ? 'Enviando…' : 'Enviar prueba'}
          </button>
        </aside>
      </div>
    </section>
  );
}
