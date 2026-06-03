import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthErrorMessage, requestPasswordReset } from './auth.service';
import { usePayopsLogo } from '../../hooks/usePayopsLogo';

export function ForgotPasswordPage() {
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [logoOk, setLogoOk] = useState(true);
  const LOGO_PATH = usePayopsLogo();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setError('');
    setMensaje('');

    try {
      const response = await requestPasswordReset({ correo });
      setMensaje(response.message || 'Si el correo existe, enviaremos un enlace de restablecimiento.');
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
            <h2>Recuperar contraseña</h2>
            <p>Te enviaremos un enlace al correo del usuario.</p>
          </div>

          <form className="payops-form" onSubmit={handleSubmit}>
            <div className="payops-field">
              <label htmlFor="correo-recuperacion">Correo electrónico</label>
              <div className="payops-input-wrap">
                <span className="payops-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
                <input
                  id="correo-recuperacion"
                  type="email"
                  placeholder="usuario@ipsgoleman.com.co"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <button type="submit" className="payops-btn-primary" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar enlace'}
            </button>

            {mensaje ? <div className="payops-success">{mensaje}</div> : null}
            {error ? <div className="payops-error">{error}</div> : null}

            <div className="payops-divider"><span>o</span></div>

            <Link to="/login" className="payops-btn-secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
              <span>Volver a iniciar sesión</span>
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
