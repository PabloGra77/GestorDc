import { useCallback, useEffect, useRef, useState } from 'react';

const INACTIVITY_MS   = 30 * 60 * 1000; // 30 min
const WARNING_BEFORE  =  5 * 60 * 1000; // avisar 5 min antes → aviso a los 25 min
const WARNING_MS      = INACTIVITY_MS - WARNING_BEFORE;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

export type SessionTimeoutState = 'active' | 'warning' | 'expired';

export function useSessionTimeout(onExpire: () => void) {
  const [state, setState] = useState<SessionTimeoutState>('active');
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [remaining, setRemaining] = useState(WARNING_BEFORE); // segundos restantes cuando está en warning

  const clearTimers = () => {
    if (warnTimer.current)   clearTimeout(warnTimer.current);
    if (expireTimer.current) clearTimeout(expireTimer.current);
  };

  const reset = useCallback(() => {
    clearTimers();
    setState('active');
    setRemaining(WARNING_BEFORE);

    warnTimer.current = setTimeout(() => {
      setState('warning');
      // Contador regresivo cada segundo
      let secs = Math.floor(WARNING_BEFORE / 1000);
      setRemaining(secs * 1000);
      const tick = setInterval(() => {
        secs -= 1;
        setRemaining(secs * 1000);
        if (secs <= 0) clearInterval(tick);
      }, 1000);

      expireTimer.current = setTimeout(() => {
        clearInterval(tick);
        setState('expired');
        onExpire();
      }, WARNING_BEFORE);
    }, WARNING_MS);
  }, [onExpire]);

  // Escuchar actividad del usuario
  useEffect(() => {
    const handler = () => {
      if (state !== 'warning' && state !== 'expired') reset();
    };
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, handler, { passive: true }));
    reset(); // arrancar al montar
    return () => {
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, handler));
      clearTimers();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extend = useCallback(() => {
    reset();
  }, [reset]);

  return { state, remaining, extend };
}
