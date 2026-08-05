export interface PagosEmpresa {
	id: number;
	nombre: string;
	identificacion: string;
	tipoIdentificacion: string;
	cuentaOrigen: string;
	tipoCuenta: string;
	activa: boolean;
}

export interface PagosBanco {
	codigo: number;
	nombre: string;
	oficial: boolean;
	activo: boolean;
}

export type PagosLoteEstado = 'borrador' | 'validado' | 'generado' | 'anulado';

export interface PagosLoteResumen {
	id: number;
	referencia: string;
	empresaNombre: string;
	autor: string;
	descripcion: string | null;
	fechaProceso: string;
	estado: PagosLoteEstado;
	cantidadPagos: number;
	valorTotal: string;
	generadoEn: string | null;
	vecesReabierto: number;
	creadoEn: string;
}

export interface PagosPago {
	orden: number;
	filaOrigen: number | null;
	identificacion: string;
	tipoIdentificacion: string;
	productoDestino: string;
	tipoProducto: string;
	codigoBanco: string;
	valor: string;
	beneficiario: string;
	bancoManual: boolean;
}

export interface PagosLoteDetalle extends PagosLoteResumen {
	empresaId: number;
	usuarioId: number;
	archivoNombre: string | null;
	archivoNombreCsv: string | null;
	archivoZipNombre: string | null;
	puedeEditar: boolean;
	puedeReabrir: boolean;
	pagos: PagosPago[];
}

export interface PagosHallazgo {
	severidad: 'error' | 'aviso';
	codigo: string;
	mensaje: string;
	fila: number | null;
	campo: string;
}

export interface PagosValidacionResultado {
	valido: boolean;
	errores: PagosHallazgo[];
	avisos: PagosHallazgo[];
	porCelda: Record<string, Array<{ severidad: string; mensaje: string; codigo: string }>>;
}

export interface PagosImportarResultado {
	pagos: PagosPago[];
	hallazgos: PagosHallazgo[];
	filasLeidas: number;
	celdasLimpiadas: number;
}

export interface PagosAuditoriaEntrada {
	id: number;
	usuario: string | null;
	accion: string;
	detalle: Record<string, unknown> | null;
	ip: string | null;
	creadoEn: string;
}

export const TIPOS_IDENTIFICACION: Array<{ value: string; label: string }> = [
	{ value: '01', label: '01 — Cédula de ciudadanía' },
	{ value: '02', label: '02 — Cédula de extranjería' },
	{ value: '03', label: '03 — NIT' },
	{ value: '04', label: '04 — Tarjeta de identidad' },
	{ value: '05', label: '05 — Pasaporte' },
	{ value: '06', label: '06 — Trj. seguro social extranjero' },
	{ value: '07', label: '07 — Sociedad extranjera sin NIT en Colombia' },
	{ value: '08', label: '08 — Fideicomiso' },
	{ value: '09', label: '09 — NIT menores' },
	{ value: '10', label: '10 — RIF Venezuela' },
	{ value: '11', label: '11 — NIT extranjería' },
	{ value: '12', label: '12 — NIT persona natural' },
	{ value: '13', label: '13 — Registro civil de nacimiento' },
	{ value: '99', label: '99 — NIT desasociado' },
];

export const TIPOS_PRODUCTO: Array<{ value: string; label: string }> = [
	{ value: 'CA', label: 'CA — Cuenta de ahorros' },
	{ value: 'CC', label: 'CC — Cuenta corriente' },
	{ value: 'DP', label: 'DP — Daviplata' },
	{ value: 'TP', label: 'TP — Tarjeta prepago' },
];

export function pagosEstadoLabel(estado: PagosLoteEstado): string {
	return { borrador: 'Borrador', validado: 'Validado', generado: 'Generado', anulado: 'Anulado' }[estado];
}

export function pagosEstadoBadgeClass(estado: PagosLoteEstado): string {
	return {
		borrador: 'rad-badge--draft',
		validado: 'rad-badge--info',
		generado: 'rad-badge--ok',
		anulado: 'rad-badge--err',
	}[estado];
}

export function formatoCop(valor: string | number): string {
	const n = typeof valor === 'string' ? parseFloat(valor) : valor;
	if (!Number.isFinite(n)) return '$0';
	return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
