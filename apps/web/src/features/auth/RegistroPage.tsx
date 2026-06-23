import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePayopsLogo } from '../../hooks/usePayopsLogo';

const API_PUBLICO = '/api/index.php/publico';

const TIPOS_DOCUMENTO = [
  { v: 'CC', l: 'Cédula de ciudadanía' },
  { v: 'CE', l: 'Cédula de extranjería' },
  { v: 'TI', l: 'Tarjeta de identidad' },
  { v: 'PP', l: 'Pasaporte' },
  { v: 'PEP', l: 'PEP / PPT' },
];

// Normaliza nombres: primera letra en mayúscula, el resto en minúscula (config de plataforma).
function capitalizarNombre(s: string): string {
  return s.trim().toLowerCase().replace(/(^|[\s-])([a-záéíóúñü])/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

export function RegistroPage() {
  const navigate = useNavigate();
  const logoSrc = usePayopsLogo();
  const [logoOk, setLogoOk] = useState(true);

  const [primerNombre, setPrimerNombre] = useState('');
  const [segundoNombre, setSegundoNombre] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('CC');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr('');
    if (!correo.toLowerCase().endsWith('@ipsgoleman.com.co')) {
      setErr('El correo debe ser del dominio @ipsgoleman.com.co');
      return;
    }
    if (!numeroDocumento.trim()) {
      setErr('Ingresa tu número de documento');
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch(`${API_PUBLICO}/usuarios/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primerNombre: capitalizarNombre(primerNombre),
          segundoNombre: capitalizarNombre(segundoNombre) || null,
          primerApellido: capitalizarNombre(primerApellido),
          segundoApellido: capitalizarNombre(segundoApellido) || null,
          tipoDocumento,
          numeroDocumento: numeroDocumento.trim(),
          correo: correo.trim().toLowerCase(),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(data?.message || 'No se pudo completar el registro.');
        return;
      }
      setOk(true);
    } catch {
      setErr('No se pudo conectar con el servidor.');
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return (
      <div className="payops-login">
        <div className="payops-login-bg" aria-hidden="true" />
        <aside className="payops-login-brand">
          <div className="payops-login-brand-inner">
            {logoOk ? (
              <img src={logoSrc} alt="Goleman IPS" className="payops-brand-logo" onError={() => setLogoOk(false)} />
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
              <h2>Cuenta creada</h2>
              <p>Tu cuenta fue creada correctamente.</p>
            </div>
            <div className="payops-registro-confirmacion">
              <div className="payops-registro-checkmark">✓</div>
              <p>Te enviamos la contraseña temporal a <strong>{correo}</strong>.</p>
              <p className="payops-registro-help">
                Ingresa con esa contraseña y cámbiala en el primer inicio de sesión.
              </p>
              <button type="button" className="payops-btn-primary" onClick={() => navigate('/login')}>
                Volver al inicio de sesion
              </button>
            </div>
          </div>
        </section>
        <footer className="payops-login-footer">© Goleman IPS — Todos los derechos reservados.</footer>
      </div>
    );
  }

  return (
    <div className="payops-login">
      <div className="payops-login-bg" aria-hidden="true" />

      <aside className="payops-login-brand">
        <div className="payops-login-brand-inner">
          {logoOk ? (
            <img src={logoSrc} alt="Goleman IPS" className="payops-brand-logo" onError={() => setLogoOk(false)} />
          ) : (
            <div className="payops-brand-logo payops-brand-logo-fallback">P</div>
          )}
          <div className="payops-brand-line">
            <span className="payops-brand-line-segment" />
            <span className="payops-brand-line-text">PAYOPS</span>
            <span className="payops-brand-line-segment" />
          </div>
          <div className="payops-brand-welcome">
            <h2>Bienvenido a Payops</h2>
            <p>La plataforma documental de Goleman IPS. Crea tu cuenta y radica tus solicitudes desde donde estés.</p>
            <ul className="payops-brand-features">
              <li><span aria-hidden="true">📱</span> Instálala como app en tu celular</li>
              <li><span aria-hidden="true">💻</span> Y también en tu PC, desde el navegador</li>
              <li><span aria-hidden="true">🔒</span> Acceso seguro con tu correo corporativo</li>
            </ul>
          </div>
        </div>
      </aside>

      <section className="payops-login-form-col">
        <div className="payops-login-card payops-registro-card">
          <div className="payops-card-header">
            <h2>Crear cuenta en Payops</h2>
            <p>Solo correos @ipsgoleman.com.co y documentos autorizados por el administrador. Tu rol y área ya están asignados.</p>
          </div>

          <form className="payops-form payops-registro-form" onSubmit={enviar}>
            <div className="payops-registro-row">
              <div className="payops-field">
                <label htmlFor="reg-pn">Primer nombre *</label>
                <div className="payops-input-wrap">
                  <input id="reg-pn" type="text" value={primerNombre} onChange={(e) => setPrimerNombre(e.target.value)} required maxLength={80} />
                </div>
              </div>
              <div className="payops-field">
                <label htmlFor="reg-sn">Segundo nombre</label>
                <div className="payops-input-wrap">
                  <input id="reg-sn" type="text" value={segundoNombre} onChange={(e) => setSegundoNombre(e.target.value)} maxLength={80} />
                </div>
              </div>
            </div>

            <div className="payops-registro-row">
              <div className="payops-field">
                <label htmlFor="reg-pa">Primer apellido *</label>
                <div className="payops-input-wrap">
                  <input id="reg-pa" type="text" value={primerApellido} onChange={(e) => setPrimerApellido(e.target.value)} required maxLength={80} />
                </div>
              </div>
              <div className="payops-field">
                <label htmlFor="reg-sa">Segundo apellido</label>
                <div className="payops-input-wrap">
                  <input id="reg-sa" type="text" value={segundoApellido} onChange={(e) => setSegundoApellido(e.target.value)} maxLength={80} />
                </div>
              </div>
            </div>

            <div className="payops-registro-row">
              <div className="payops-field">
                <label htmlFor="reg-td">Tipo de documento *</label>
                <div className="payops-input-wrap">
                  <select id="reg-td" value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} required>
                    {TIPOS_DOCUMENTO.map((t) => <option key={t.v} value={t.v}>{t.v} · {t.l}</option>)}
                  </select>
                </div>
              </div>
              <div className="payops-field">
                <label htmlFor="reg-nd">Número de documento *</label>
                <div className="payops-input-wrap">
                  <input
                    id="reg-nd"
                    type="text"
                    inputMode="numeric"
                    placeholder="Sin puntos ni comas"
                    value={numeroDocumento}
                    onChange={(e) => setNumeroDocumento(e.target.value.replace(/[^\dA-Za-z]/g, ''))}
                    required
                    maxLength={20}
                  />
                </div>
              </div>
            </div>

            <div className="payops-field">
              <label htmlFor="reg-correo">Correo corporativo *</label>
              <div className="payops-input-wrap">
                <span className="payops-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
                <input
                  id="reg-correo"
                  type="email"
                  placeholder="usuario@ipsgoleman.com.co"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  required
                />
              </div>
            </div>

            <p className="payops-registro-help" style={{ marginTop: 4 }}>
              Tu rol y tu área los asigna el administrador. Solo puedes crear cuenta si tu
              documento fue autorizado previamente.
            </p>

            <div className="payops-registro-actions">
              <Link to="/login" className="payops-forgot-link">← Cancelar</Link>
              <button type="submit" className="payops-btn-primary" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Crear cuenta'}
              </button>
            </div>

            {err ? <div className="payops-error">{err}</div> : null}
          </form>
        </div>
      </section>

      <footer className="payops-login-footer">© Goleman IPS — Todos los derechos reservados.</footer>
    </div>
  );
}
