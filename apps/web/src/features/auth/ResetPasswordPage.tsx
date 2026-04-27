import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, getAuthErrorMessage } from './auth.service';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

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
      const response = await confirmPasswordReset({
        token,
        newPassword,
      });
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
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-brand">
          <div className="login-logo">
            <span className="login-logo-fallback">GD</span>
          </div>
          <div>
            <h1 className="login-title">Nueva contraseña</h1>
            <p className="login-subtitle">Define una contraseña segura para tu cuenta.</p>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <h2>Restablecer contraseña</h2>
            <p>Ingresa y confirma tu nueva contraseña.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="new-password">Nueva contraseña</label>
              <input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirmar contraseña</label>
              <input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <button type="submit" className="login-button" disabled={enviando}>
              {enviando ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>

            {mensaje ? <div className="login-success">{mensaje}</div> : null}
            {error ? <div className="login-error">{error}</div> : null}
          </form>

          <div className="login-links-row">
            <Link to="/login" className="login-inline-link">
              Ir al inicio de sesión
            </Link>
          </div>
        </div>
      </div>

      <div className="login-side">
        <div className="login-side-card">
          <span className="badge">Cuenta segura</span>
          <h3>Actualiza tu contraseña</h3>
          <p>
            El enlace de restablecimiento es temporal. Si vence, solicita uno nuevo desde la opción de recuperación.
          </p>
        </div>
      </div>
    </div>
  );
}
