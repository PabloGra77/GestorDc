import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/http/api';

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
    } catch {
      // ignorar
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, refreshMs);
    return () => clearInterval(t);
  }, [cargar, refreshMs]);

  return { items, pendientesBandeja, recargar: cargar };
}
