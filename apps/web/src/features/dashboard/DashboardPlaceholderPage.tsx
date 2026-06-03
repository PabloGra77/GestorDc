import { useNavigate } from 'react-router-dom';
import { clearAuthSession, getAuthSession } from '../auth/auth.service';

export function DashboardPlaceholderPage() {
  const navigate = useNavigate();
  const session = getAuthSession();

  function handleLogout() {
    clearAuthSession();
    navigate('/login', { replace: true });
  }

  return (
    <div className="placeholder-shell">
      <div className="placeholder-card">
        <h1>Panel inicial</h1>
        <p>
          Sesión iniciada correctamente contra el backend de Payops.
        </p>

        {session ? (
          <div className="session-summary">
            <div>
              <strong>Usuario:</strong> {session.usuario.nombreCompleto}
            </div>
            <div>
              <strong>Correo:</strong> {session.usuario.correo}
            </div>
            <div>
              <strong>Rol:</strong> {session.usuario.rol.nombre}
            </div>
          </div>
        ) : null}

        <div className="placeholder-actions">
          <button type="button" className="secondary-link secondary-button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}