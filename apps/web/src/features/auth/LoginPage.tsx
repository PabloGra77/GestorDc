import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import {
  getAuthErrorMessage,
  getAuthSession,
  login,
  saveAuthSession,
} from './auth.service';

export function LoginPage() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [logoDisponible, setLogoDisponible] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getAuthSession();
    if (session) {
      if (session.usuario.debeCambiarPassword) {
        navigate('/first-password', { replace: true });
        return;
      }

      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setError('');

    try {
      const session = await login({ correo, password });
      saveAuthSession(session);

      if (session.usuario.debeCambiarPassword) {
        navigate('/first-password', { replace: true });
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-brand">
          <div className="login-logo" aria-hidden={!logoDisponible}>
            {logoDisponible ? (
              <img
                src="/logo.png"
                alt="GestorDoc CO"
                className="login-logo-image"
                onError={() => setLogoDisponible(false)}
              />
            ) : (
              <span className="login-logo-fallback">GD</span>
            )}
          </div>
          <div>
            <h1 className="login-title">GestorDoc CO</h1>
            <p className="login-subtitle">Plataforma de gestión documental</p>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <h2>Iniciar sesión</h2>
            <p>Ingresa con tu cuenta para acceder al panel administrativo.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="correo">Correo electrónico</label>
              <input
                id="correo"
                type="email"
                placeholder="usuario@empresa.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="login-button">
              {enviando ? 'Validando...' : 'Ingresar'}
            </button>

            <div className="login-links-row">
              <Link to="/forgot-password" className="login-inline-link">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Link to="/radicacion-cuenta-cobro-ops" className="login-button login-button-secondary">
              Verificar radicado
            </Link>

            {error ? <div className="login-error">{error}</div> : null}
          </form>

          <div className="login-note">
            Usa un usuario existente del backend para ingresar al panel.
          </div>
        </div>
      </div>

      <div className="login-side">
        <div className="login-side-card">
          <span className="badge">Versión inicial</span>
          <h3>Control documental con enfoque profesional</h3>
          <p>
            Radicación, expedientes, trazabilidad, roles, auditoría y operación
            administrativa en una sola plataforma.
          </p>

          <ul>
            <li>Gestión de expedientes</li>
            <li>Control de usuarios y roles</li>
            <li>Seguimiento de procesos documentales</li>
            <li>Base preparada para autenticación segura</li>
          </ul>
        </div>
      </div>
    </div>
  );
}