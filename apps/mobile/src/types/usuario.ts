import type { Role } from './role';

export interface Usuario {
  id: number;
  primerNombre?: string | null;
  segundoNombre?: string | null;
  primerApellido?: string | null;
  segundoApellido?: string | null;
  tipoDocumento?: string | null;
  numeroDocumento?: string | null;
  nombreCompleto: string;
  correo: string;
  area?: string | null;
  permisos?: Record<string, string[]>;
  debeCambiarPassword?: boolean;
  activo: boolean;
  rol: Role;
}

export interface AuthSession {
  /** JWT Bearer token */
  token: string;
  usuario: Usuario;
}
