export interface Radicado {
	id: number;
	numero: string;
	referencia: string;
	asunto?: string | null;
	estado: string;
	creadoEn: string;
	actualizadoEn: string;
}

export interface TrazadoPaso {
	rol: string;
	label: string;
	orden: number;
	estado: 'pendiente' | 'en_curso' | 'completado';
}

export interface MovimientoPublico {
	accion: string;
	paso: string | null;
	estadoResultado: string | null;
	comentario: string | null;
	creadoEn: string;
}

export interface SolicitudVerificada {
	id: number;
	numeroRadicado: string;
	tipoNombre: string;
	areaNombre: string;
	estado: string;
	pasoActual: string | null;
	creadoEn: string;
	aprobadoEn: string | null;
	trazado: TrazadoPaso[];
	movimientosPublicos: MovimientoPublico[];
}

export interface VerificarRadicadoResponse {
	existe: boolean;
	tipo?: 'solicitud' | 'radicado';
	solicitud?: SolicitudVerificada;
	radicado?: Radicado;
}

export interface CreateCuentaCobroOpsResponse {
	id: number;
	numero: string;
	referencia: string;
	estado: string;
	linkCarga: string;
	correoSolicitado: string;
	documentosSolicitados: string[];
}

export interface VerifyCuentaCobroOpsResponse {
	existe: boolean;
	autorizado: boolean;
	message?: string;
	numero?: string;
	referencia?: string;
	estado?: string;
	documentosSolicitados?: string[];
	documentosAdjuntos?: Array<{ nombre: string; archivo: string; cargadoEn: string }>;
}
