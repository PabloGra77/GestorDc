import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, getAuthErrorMessage } from './auth.service';
import { usePayopsLogo } from '../../hooks/usePayopsLogo';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [logoOk, setLogoOk] = useState(true);
  const LOGO_PATH = usePayopsLogo();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMensaje('');

    if (!token) {
      setError('No se encontró token de restablecimiento en el enlace.');
      return;
    }
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setEnviando(true);
    try {
      const response = await confirmPasswordReset({ token, newPassword });
      setMensaje(response.message || 'Contraseña restablecida correctamente.');
      setNewPassword('');
      setConfirmPassword('');
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
            <img src={LOGO_PATH} alt="Goleman IPS" className="payops-brand-logo" onError={() => setLogoOk(false)} />
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
            <h2>Nueva contraseña</h2>
            <p>Define una contraseña segura para tu cuenta.</p>
          </div>

          <form className="payops-form" onSubmit={handleSubmit}>
            <div className="payops-field">
              <label htmlFor="new-password">Nueva contraseña</label>
              <div className="payops-input-wrap">
                <span className="payops-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="new-password"
                  type={showPwd1 ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="payops-input-eye"
                  onClick={() => setShowPwd1((v) => !v)}
                  aria-label="Mostrar/ocultar"
                  tabIndex={-1}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="payops-field">
              <label htmlFor="confirm-password">Confirmar contraseña</label>
              <div className="payops-input-wrap">
                <span className="payops-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="confirm-password"
                  type={showPwd2 ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="payops-input-eye"
                  onClick={() => setShowPwd2((v) => !v)}
                  aria-label="Mostrar/ocultar"
                  tabIndex={-1}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" className="payops-btn-primary" disabled={enviando}>
              {enviando ? 'Guardando...' : 'Guardar contraseña'}
            </button>

            {mensaje ? <div className="payops-success">{mensaje}</div> : null}
            {error ? <div className="payops-error">{error}</div> : null}

            <div className="payops-divider"><span>o</span></div>

            <Link to="/login" className="payops-btn-secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
              <span>Ir al inicio de sesión</span>
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
