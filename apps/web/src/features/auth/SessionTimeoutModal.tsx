import { useState } from 'react';
import { api } from '../../services/http/api';
import { saveAuthSession } from './auth.service';
import type { AuthSession } from '../../types/usuario';

interface Props {
  state: 'warning' | 'expired';
  remaining: number; // ms
  correo: string;
  onExtend: () => void;
  onLogout: () => void;
}

export function SessionTimeoutModal({ state, remaining, correo, onExtend, onLogout }: Props) {
  const [password, setPassword] = useState('');
  const [err, setErr]     = useState('');
  const [busy, setBusy]   = useState(false);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const countdown = `${mins}:${String(secs).padStart(2, '0')}`;

  async function relogin() {
    if (!password.trim()) { setErr('Ingresa tu contraseña para continuar.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api.post<AuthSession>('/auth/login', { correo, password });
      saveAuthSession(r.data);
      setPassword('');
      onExtend();
    } catch {
      setErr('Contraseña incorrecta. Inténtalo de nuevo.');
    } finally { setBusy(false); }
  }

  return (
    <div className="session-modal-overlay" role="dialog" aria-modal="true" aria-label="Aviso de sesión">
      <div className="session-modal">
        <div className="session-modal-icon">{state === 'expired' ? '🔒' : '⏱'}</div>

        {state === 'warning' ? (
          <>
            <h3>Tu sesión está a punto de expirar</h3>
            <p className="session-modal-countdown">
              La sesión cerrará en <strong>{countdown}</strong> por inactividad.
            </p>
            <p className="session-modal-sub">
              Ingresa tu contraseña para continuar trabajando sin perder lo que estás haciendo.
            </p>
          </>
        ) : (
          <>
            <h3>Sesión expirada</h3>
            <p className="session-modal-sub">
              Tu sesión se cerró por inactividad. Ingresa tu contraseña para volver sin perder tu progreso.
            </p>
          </>
        )}

        <div className="session-modal-field">
          <label>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && relogin()}
            placeholder="Tu contraseña"
            autoFocus
          />
        </div>

        {err && <p className="session-modal-err">{err}</p>}

        <div className="session-modal-actions">
          <button type="button" className="admin-primary-button" onClick={relogin} disabled={busy}>
            {busy ? 'Verificando…' : 'Continuar sesión'}
          </button>
          <button type="button" className="admin-ghost-button" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
