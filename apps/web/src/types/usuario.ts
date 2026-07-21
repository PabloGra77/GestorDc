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
	areaId?: number | null;
	nivelAprobacion?: string | null;
}

export interface AuthSession {
	/** @deprecated Token ya no se usa en frontend — viaja en cookie HttpOnly */
	token?: string;
	usuario: Usuario;
}
