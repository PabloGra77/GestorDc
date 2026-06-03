import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import {
  getAuthErrorMessage,
  getAuthSession,
  login,
  saveAuthSession,
} from './auth.service';
import { usePayopsLogo } from '../../hooks/usePayopsLogo';

export function LoginPage() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [logoOk, setLogoOk] = useState(true);
  const LOGO_PATH = usePayopsLogo();

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
    <div className="payops-login">
      <div className="payops-login-bg" aria-hidden="true" />

      <aside className="payops-login-brand">
        <div className="payops-login-brand-inner">
          {logoOk ? (
            <img
              src={LOGO_PATH}
              alt="Goleman IPS"
              className="payops-brand-logo"
              onError={() => setLogoOk(false)}
            />
          ) : (
            <div className="payops-brand-logo payops-brand-logo-fallback">P</div>
          )}

          <div className="payops-brand-line">
            <span className="payops-brand-line-segment" />
            <span className="payops-brand-line-text">PAYOPS</span>
            <span className="payops-brand-line-segment" />
          </div>
        </div>
      </aside>

      <section className="payops-login-form-col">
        <div className="payops-login-card">
          <div className="payops-card-header">
            <h2>Iniciar sesión</h2>
            <p>Ingresa con tu cuenta del dominio @ipsgoleman.com.co</p>
          </div>
          <form className="payops-form" onSubmit={handleSubmit}>
            <div className="payops-field">
              <label htmlFor="correo">Correo electrónico</label>
              <div className="payops-input-wrap">
                <span className="payops-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
                <input
                  id="correo"
                  type="email"
                  placeholder="usuario@ipsgoleman.com.co"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="payops-field">
              <label htmlFor="password">Contraseña</label>
              <div className="payops-input-wrap">
                <span className="payops-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="payops-input-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <line x1="3" y1="3" x2="21" y2="21" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="payops-forgot-row" style={{ justifyContent: 'space-between' }}>
              <Link to="/registro" className="payops-forgot-link">
                Crear cuenta
              </Link>
              <Link to="/forgot-password" className="payops-forgot-link">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button type="submit" className="payops-btn-primary" disabled={enviando}>
              {enviando ? 'Validando...' : 'Ingresar'}
            </button>

            {error ? <div className="payops-error">{error}</div> : null}

            <div className="payops-divider"><span>o continúa con</span></div>

            <Link to="/radicacion-cuenta-cobro-ops" className="payops-btn-secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>Verificar radicado</span>
            </Link>

            <Link to="/instalar" className="payops-install-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Descargar app para móvil o escritorio</span>
            </Link>
          </form>
        </div>
      </section>

      <footer className="payops-login-footer">
        © Goleman IPS — Todos los derechos reservados.
      </footer>
    </div>
  );
}
