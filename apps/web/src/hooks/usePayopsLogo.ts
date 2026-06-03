import { useEffect, useState } from 'react';

const LOGO_LIGHT = '/logo-payops-dark.png?v=3'; // versión oscura para fondos claros
const LOGO_DARK = '/logo-payops.png?v=3';       // versión clara para fondos oscuros

/**
 * Devuelve la URL del logo segun el tema activo del documento.
 * Reacciona a cambios del atributo data-theme en <html>.
 */
export function usePayopsLogo(): string {
  const [logo, setLogo] = useState<string>(() => {
    if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light') {
      return LOGO_LIGHT;
    }
    return LOGO_DARK;
  });

  useEffect(() => {
    const html = document.documentElement;
    const update = () => {
      setLogo(html.getAttribute('data-theme') === 'light' ? LOGO_LIGHT : LOGO_DARK);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return logo;
}
