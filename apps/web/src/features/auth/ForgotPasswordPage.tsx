import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthErrorMessage, requestPasswordReset } from './auth.service';

export function ForgotPasswordPage() {
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

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
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-brand">
          <div className="login-logo">
            <span className="login-logo-fallback">GD</span>
          </div>
          <div>
            <h1 className="login-title">Recuperar contraseña</h1>
            <p className="login-subtitle">Te enviaremos un enlace al correo del usuario.</p>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <h2>Restablecimiento</h2>
            <p>Ingresa tu correo corporativo para recibir el enlace de recuperación.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="correo-recuperacion">Correo electrónico</label>
              <input
                id="correo-recuperacion"
                type="email"
                placeholder="usuario@empresa.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <button type="submit" className="login-button" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar enlace de restablecimiento'}
            </button>

            {mensaje ? <div className="login-success">{mensaje}</div> : null}
            {error ? <div className="login-error">{error}</div> : null}
          </form>

          <div className="login-links-row">
            <Link to="/login" className="login-inline-link">
              Volver a iniciar sesión
            </Link>
          </div>
        </div>
      </div>

      <div className="login-side">
        <div className="login-side-card">
          <span className="badge">Seguridad</span>
          <h3>Enlace temporal de recuperación</h3>
          <p>
            Recibirás un mensaje para restablecer tu contraseña con un enlace único y vigencia limitada.
          </p>
        </div>
      </div>
    </div>
  );
}
