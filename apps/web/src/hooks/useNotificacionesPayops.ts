import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/http/api';
import { isPushSupported, subscribeToPush } from '../utils/pushNotifications';

export interface NotificacionPayops {
  id: number;
  numeroRadicado: string;
  titulo: string;
  detalle: string;
  tipo: 'pendiente' | 'devuelta' | 'aprobada' | 'rechazada';
  areaNombre: string;
  creadoEn: string;
}

interface SolicitudResumen {
  id: number;
  numeroRadicado: string;
  estado: string;
  pasoActual: string | null;
  areaNombre: string;
  tipoNombre: string;
  creadoEn: string;
  alertasCount: number;
  solicitanteUsuarioId?: number | null;
}

interface BandejaItem {
  id: number;
  numeroRadicado: string;
  pasoActual: string | null;
  areaNombre: string;
  tipoNombre: string;
  creadoEn: string;
  alertasCount: number;
}

export function useNotificacionesPayops(refreshMs = 30000) {
  const [items, setItems] = useState<NotificacionPayops[]>([]);
  const [pendientesBandeja, setPendientesBandeja] = useState(0);
  const prevCountRef = useRef(0);
  const pushInitRef = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const [bandejaR, misR] = await Promise.all([
        api.get<BandejaItem[]>('/solicitudes/bandeja').catch(() => ({ data: [] as BandejaItem[] })),
        api.get<SolicitudResumen[]>('/solicitudes').catch(() => ({ data: [] as SolicitudResumen[] })),
      ]);
      const bandeja = bandejaR.data;
      setPendientesBandeja(bandeja.length);

      const notifs: NotificacionPayops[] = [];

      for (const b of bandeja.slice(0, 10)) {
        notifs.push({
          id: b.id,
          numeroRadicado: b.numeroRadicado,
          titulo: `Solicitud pendiente del área ${b.areaNombre}`,
          detalle: `${b.tipoNombre} · paso: ${b.pasoActual ?? '—'}${b.alertasCount > 0 ? ` · ${b.alertasCount} alerta(s)` : ''}`,
          tipo: 'pendiente',
          areaNombre: b.areaNombre,
          creadoEn: b.creadoEn,
        });
      }

      for (const s of misR.data) {
        if (s.estado === 'devuelto') {
          notifs.push({
            id: s.id + 1000000,
            numeroRadicado: s.numeroRadicado,
            titulo: `Tu solicitud fue devuelta por el área ${s.areaNombre}`,
            detalle: `${s.tipoNombre} · revisa los comentarios y reenvía.`,
            tipo: 'devuelta',
            areaNombre: s.areaNombre,
            creadoEn: s.creadoEn,
          });
        } else if (s.estado === 'aprobado') {
          // Solo notificar las últimas 5 aprobadas
          if (notifs.filter((n) => n.tipo === 'aprobada').length < 5) {
            notifs.push({
              id: s.id + 2000000,
              numeroRadicado: s.numeroRadicado,
              titulo: `Solicitud aprobada por ${s.areaNombre}`,
              detalle: s.tipoNombre,
              tipo: 'aprobada',
              areaNombre: s.areaNombre,
              creadoEn: s.creadoEn,
            });
          }
        }
      }

      setItems(notifs);

      // Show browser notification when bandeja count increases while app is open
      const newCount = notifs.filter((n) => n.tipo === 'pendiente').length;
      if (newCount > prevCountRef.current && prevCountRef.current > 0 && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('PayOPS · Goleman IPS', {
          body: `Tienes ${newCount} solicitud${newCount !== 1 ? 'es' : ''} pendiente${newCount !== 1 ? 's' : ''} de validación.`,
          icon: '/icon-app.png',
          tag: 'payops-in-app',
          silent: true,
        });
      }
      prevCountRef.current = newCount;
    } catch {
      // ignorar
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, refreshMs);
    return () => clearInterval(t);
  }, [cargar, refreshMs]);

  // Auto-subscribe to Web Push after a short delay (once per session)
  useEffect(() => {
    if (pushInitRef.current) return;
    pushInitRef.current = true;
    if (!isPushSupported()) return;
    // Wait 8 seconds before prompting so the user has settled into the app
    const timer = setTimeout(() => {
      subscribeToPush().catch(() => {});
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  return { items, pendientesBandeja, recargar: cargar };
}
