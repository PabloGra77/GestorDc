import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  changeInitialPassword,
  clearAuthSession,
  getAuthErrorMessage,
  getAuthSession,
  saveAuthSession,
} from './auth.service';
import { usePayopsLogo } from '../../hooks/usePayopsLogo';

export function FirstPasswordChangePage() {
  const navigate = useNavigate();
  const session = getAuthSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [logoOk, setLogoOk] = useState(true);
  const LOGO_PATH = usePayopsLogo();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMensaje('');

    if (!session) return;

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
      const response = await changeInitialPassword({
        correo: session.usuario.correo,
        currentPassword,
        newPassword,
      });

      saveAuthSession({
        usuario: { ...session.usuario, debeCambiarPassword: false },
      });

      setMensaje(response.message || 'Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => navigate('/dashboard', { replace: true }), 700);
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
      if ((requestError as { response?: { status?: number } })?.response?.status === 401) {
        clearAuthSession();
      }
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
            <h2>Primer ingreso</h2>
            <p>Actualiza la contraseña temporal de <strong>{session.usuario.correo}</strong>.</p>
          </div>

          <form className="payops-form" onSubmit={handleSubmit}>
            <div className="payops-field">
              <label htmlFor="current-password">Contraseña temporal</label>
              <div className="payops-input-wrap">
                <span className="payops-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="current-password"
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <div className="payops-field">
              <label htmlFor="new-password-first">Nueva contraseña</label>
              <div className="payops-input-wrap">
                <span className="payops-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="new-password-first"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div className="payops-field">
              <label htmlFor="confirm-password-first">Confirmar nueva contraseña</label>
              <div className="payops-input-wrap">
                <span className="payops-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="confirm-password-first"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="payops-btn-primary" disabled={enviando}>
              {enviando ? 'Guardando...' : 'Actualizar contraseña'}
            </button>

            {mensaje ? <div className="payops-success">{mensaje}</div> : null}
            {error ? <div className="payops-error">{error}</div> : null}
          </form>
        </div>
      </section>

      <footer className="payops-login-footer">
        © Goleman IPS — Todos los derechos reservados.
      </footer>
    </div>
  );
}
