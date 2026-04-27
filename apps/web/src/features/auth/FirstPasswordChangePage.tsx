import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  changeInitialPassword,
  clearAuthSession,
  getAuthErrorMessage,
  getAuthSession,
  saveAuthSession,
} from './auth.service';

export function FirstPasswordChangePage() {
  const navigate = useNavigate();
  const session = getAuthSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMensaje('');

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
        ...session,
        usuario: {
          ...session.usuario,
          debeCambiarPassword: false,
        },
      });

      setMensaje(response.message || 'Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 700);
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
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-brand">
          <div className="login-logo">
            <span className="login-logo-fallback">GD</span>
          </div>
          <div>
            <h1 className="login-title">Cambio inicial de contraseña</h1>
            <p className="login-subtitle">Debes actualizar la contraseña temporal para continuar.</p>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <h2>Primer ingreso</h2>
            <p>Usuario: {session.usuario.correo}</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="current-password">Contraseña temporal</label>
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

            <div className="form-group">
              <label htmlFor="new-password-first">Nueva contraseña</label>
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

            <div className="form-group">
              <label htmlFor="confirm-password-first">Confirmar nueva contraseña</label>
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

            <button type="submit" className="login-button" disabled={enviando}>
              {enviando ? 'Guardando...' : 'Actualizar contraseña'}
            </button>

            {mensaje ? <div className="login-success">{mensaje}</div> : null}
            {error ? <div className="login-error">{error}</div> : null}
          </form>
        </div>
      </div>

      <div className="login-side">
        <div className="login-side-card">
          <span className="badge">Primer acceso</span>
          <h3>Protege tu cuenta desde el primer ingreso</h3>
          <p>
            La contraseña temporal enviada por correo solo se usa para entrar por primera vez.
            Después debes definir una nueva contraseña personal.
          </p>
        </div>
      </div>
    </div>
  );
}
