export interface Role {
  id: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  permisos?: Record<string, string[]>;
}
