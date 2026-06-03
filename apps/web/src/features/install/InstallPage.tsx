import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePayopsLogo } from '../../hooks/usePayopsLogo';

type Platform = 'ios' | 'android' | 'windows' | 'mac' | 'desktop' | 'unknown';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  // iPadOS reciente se identifica como Mac con touch
  if (/macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/windows/.test(ua)) return 'windows';
  if (/macintosh|mac os x/.test(ua)) return 'mac';
  return 'desktop';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPage() {
  const [platform] = useState<Platform>(() => detectPlatform());
  const [installed] = useState<boolean>(() => isStandalone());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [logoOk, setLogoOk] = useState(true);
  const logoSrc = usePayopsLogo();

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <div className="payops-install">
      <div className="payops-install-bg" aria-hidden="true" />
      <main className="payops-install-inner">
        <header className="payops-install-header">
          {logoOk ? (
            <img
              src={logoSrc}
              alt="Goleman IPS"
              className="payops-install-logo"
              onError={() => setLogoOk(false)}
            />
          ) : (
            <span className="payops-brand-logo-fallback" aria-hidden="true">P</span>
          )}
          <div className="payops-brand-line">
            <span className="payops-brand-line-segment" />
            <span className="payops-brand-line-text">PAYOPS</span>
            <span className="payops-brand-line-segment" />
          </div>
          <p className="payops-install-tagline">
            Instala la aplicación en tu dispositivo para acceso rápido y sin abrir el navegador.
          </p>
        </header>

        {installed ? (
          <section className="payops-install-card payops-install-success">
            <h2>✓ Aplicación instalada</h2>
            <p>Estás viendo Payops desde la app instalada. ¡Disfrútala!</p>
            <Link to="/login" className="payops-btn-secondary">
              Ir al inicio de sesión
            </Link>
          </section>
        ) : null}

        {!installed && deferredPrompt ? (
          <section className="payops-install-card">
            <h2>Instalación directa</h2>
            <p>Tu navegador detectó que Payops se puede instalar como aplicación.</p>
            <button type="button" className="payops-btn-primary" onClick={handleInstallClick}>
              Instalar Payops
            </button>
          </section>
        ) : null}

        {!installed && platform === 'ios' ? (
          <section className="payops-install-card">
            <h2>iPhone · iPad (iOS)</h2>
            <ol className="payops-install-steps">
              <li>
                <strong>Abre esta página en Safari</strong> (no funciona desde Chrome o Firefox en iOS).
              </li>
              <li>
                Toca el icono <em>Compartir</em>
                <svg className="payops-inline-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                en la barra inferior.
              </li>
              <li>
                Desplázate y pulsa <strong>Añadir a pantalla de inicio</strong>.
              </li>
              <li>Confirma con <strong>Añadir</strong>.</li>
            </ol>
          </section>
        ) : null}

        {!installed && platform === 'android' ? (
          <section className="payops-install-card">
            <h2>Android</h2>
            <ol className="payops-install-steps">
              <li>Abre esta página en <strong>Chrome</strong> o <strong>Edge</strong>.</li>
              <li>
                Toca el menú <strong>⋮</strong> (arriba a la derecha).
              </li>
              <li>
                Selecciona <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla principal</strong>.
              </li>
              <li>Confirma con <strong>Instalar</strong>.</li>
            </ol>
            <p className="payops-install-hint">
              También puede aparecer un banner automático en la parte inferior pidiéndote instalar.
            </p>
          </section>
        ) : null}

        {!installed && (platform === 'mac' || platform === 'windows' || platform === 'desktop') ? (
          <section className="payops-install-card">
            <h2>{platform === 'mac' ? 'macOS' : platform === 'windows' ? 'Windows' : 'Escritorio'}</h2>
            <ol className="payops-install-steps">
              <li>
                Abre esta página en <strong>Chrome</strong>, <strong>Edge</strong> o <strong>Brave</strong>.
              </li>
              <li>
                Mira la barra de direcciones. A la derecha del candado aparece un icono de instalación
                <svg className="payops-inline-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <polyline points="6 9 12 15 18 9" />
                  <path d="M5 21h14" />
                </svg>.
              </li>
              <li>Haz clic y pulsa <strong>Instalar</strong>.</li>
              <li>
                Payops aparecerá como aplicación en tu Launchpad / menú de inicio.
              </li>
            </ol>
            <p className="payops-install-hint">
              Si no ves el icono, abre el menú del navegador (⋮ o ···) y busca
              <strong> "Instalar Payops" </strong> o <strong>"Crear acceso directo"</strong>.
            </p>
          </section>
        ) : null}

        <section className="payops-install-card payops-install-info">
          <h3>¿Qué obtienes con la app instalada?</h3>
          <ul>
            <li>Acceso directo desde la pantalla de inicio / escritorio.</li>
            <li>Pantalla completa sin barra del navegador.</li>
            <li>Funciona offline las páginas que ya hayas visitado.</li>
            <li>Notificaciones del navegador cuando estén disponibles.</li>
            <li>Mismas credenciales y datos que la versión web.</li>
          </ul>
        </section>

        <Link to="/login" className="payops-install-back">
          ← Volver a iniciar sesión
        </Link>
      </main>
    </div>
  );
}
