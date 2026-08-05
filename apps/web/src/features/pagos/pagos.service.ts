import { api } from '../../services/http/api';
import type {
	PagosAuditoriaEntrada,
	PagosBanco,
	PagosEmpresa,
	PagosImportarResultado,
	PagosLoteDetalle,
	PagosLoteResumen,
	PagosValidacionResultado,
} from './pagos.types';

function extraerMensaje(ex: unknown, fallback: string): string {
	const m = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
	return m || fallback;
}

async function descargarBlob(url: string, nombreSugerido: string): Promise<void> {
	const r = await api.get(url, { responseType: 'blob' });
	const disposition = String(r.headers['content-disposition'] ?? '');
	const match = /filename="([^"]+)"/.exec(disposition);
	const nombre = match ? match[1] : nombreSugerido;
	const blobUrl = URL.createObjectURL(r.data as Blob);
	const link = document.createElement('a');
	link.href = blobUrl;
	link.download = nombre;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(blobUrl);
}

export const pagosService = {
	extraerMensaje,

	// ── Empresas ──
	listarEmpresas: () => api.get<PagosEmpresa[]>('/pagos/empresas').then((r) => r.data),
	crearEmpresa: (body: Partial<PagosEmpresa>) => api.post<{ id: number }>('/pagos/empresas', body).then((r) => r.data),
	actualizarEmpresa: (id: number, body: Partial<PagosEmpresa>) => api.patch(`/pagos/empresas/${id}`, body).then((r) => r.data),

	// ── Bancos ──
	listarBancos: (todos = false) => api.get<PagosBanco[]>('/pagos/bancos' + (todos ? '?todos=1' : '')).then((r) => r.data),
	crearBancoManual: (codigo: string, nombre: string) =>
		api.post<{ ok: boolean; mensaje: string; codigo: number }>('/pagos/bancos', { codigo, nombre }).then((r) => r.data),
	cambiarEstadoBanco: (codigo: number, activo: boolean) => api.patch(`/pagos/bancos/${codigo}`, { activo }).then((r) => r.data),
	eliminarBancoManual: (codigo: number) => api.delete(`/pagos/bancos/${codigo}`).then((r) => r.data),

	// ── Lotes ──
	listarLotes: (limite = 50) => api.get<PagosLoteResumen[]>(`/pagos/lotes?limite=${limite}`).then((r) => r.data),
	crearLote: (body: { empresaId: number; descripcion: string; fechaProceso: string }) =>
		api.post<{ id: number }>('/pagos/lotes', body).then((r) => r.data),
	obtenerLote: (id: number) => api.get<PagosLoteDetalle>(`/pagos/lotes/${id}`).then((r) => r.data),
	eliminarLote: (id: number, motivo: string) =>
		api.delete(`/pagos/lotes/${id}`, { data: { motivo } }).then((r) => r.data),

	guardarPagos: (id: number, pagos: unknown[]) =>
		api.put(`/pagos/lotes/${id}/pagos`, { pagos }).then((r) => r.data),

	importarArchivo: (id: number, archivo: File) => {
		const form = new FormData();
		form.append('archivo', archivo);
		return api
			.post<PagosImportarResultado>(`/pagos/lotes/${id}/importar`, form, { headers: { 'Content-Type': undefined } })
			.then((r) => r.data);
	},

	validarLote: (id: number) => api.post<PagosValidacionResultado>(`/pagos/lotes/${id}/validar`).then((r) => r.data),

	generarArchivo: (id: number) =>
		api.post<{ ok: boolean; mensaje: string; nombre: string }>(`/pagos/lotes/${id}/generar`).then((r) => r.data),

	empaquetarZip: (id: number) =>
		api
			.post<{ ok: boolean; mensaje: string; clave: string; nombre: string }>(`/pagos/lotes/${id}/empaquetar`)
			.then((r) => r.data),

	consultarClave: (id: number) => api.get<{ clave: string }>(`/pagos/lotes/${id}/clave`).then((r) => r.data),

	anularLote: (id: number, motivo: string) =>
		api.post<{ ok: boolean; mensaje: string }>(`/pagos/lotes/${id}/anular`, { motivo }).then((r) => r.data),

	reabrirLote: (id: number, motivo: string) =>
		api.post<{ ok: boolean; mensaje: string }>(`/pagos/lotes/${id}/reabrir`, { motivo }).then((r) => r.data),

	descargarArchivo: (id: number, tipo: 'txt' | 'csv' | 'zip', nombreSugerido: string) =>
		descargarBlob(`/pagos/lotes/${id}/descargar?tipo=${tipo}`, nombreSugerido),

	descargarPlantilla: () => descargarBlob('/pagos/plantilla', 'plantilla-portal-pagos.csv'),

	generarCorreo: async (id: number, body: { para: string; cc: string; asunto: string; cuerpo: string }, referencia: string) => {
		const r = await api.post(`/pagos/lotes/${id}/correo`, body, { responseType: 'blob' });
		const blobUrl = URL.createObjectURL(r.data as Blob);
		const link = document.createElement('a');
		link.href = blobUrl;
		link.download = `PortalPagos-${referencia}.eml`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(blobUrl);
	},

	// ── Auditoría ──
	listarAuditoria: (limite = 100) =>
		api.get<PagosAuditoriaEntrada[]>(`/pagos/auditoria?limite=${limite}`).then((r) => r.data),
};
