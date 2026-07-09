import axios from 'axios';

const AUTH_STORAGE_KEY = 'payops.auth';

export const api = axios.create({
	baseURL: '/api/index.php',
	headers: {
		'Content-Type': 'application/json',
	},
});

/**
 * Interceptor de autenticación.
 * Adjunta el token JWT en todas las peticiones si hay sesión activa.
 * Lee directamente de localStorage para evitar dependencia circular con auth.service.
 */
api.interceptors.request.use((config) => {
	const raw = localStorage.getItem(AUTH_STORAGE_KEY);
	if (raw) {
		try {
			const session = JSON.parse(raw) as { token?: string };
			if (session?.token) {
				config.headers['Authorization'] = `Bearer ${session.token}`;
			}
		} catch {
			localStorage.removeItem(AUTH_STORAGE_KEY);
		}
	}
	return config;
});

/* Sesión expirada: emitir evento global para que el modal de sesión lo capture.
   Excluir /auth/login y /auth/register para que el formulario muestre el error. */
api.interceptors.response.use(
	(r) => r,
	(error) => {
		const url: string = error?.config?.url ?? '';
		const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/change-initial-password');
		if (error?.response?.status === 401 && !isAuthCall) {
			// Emitir evento en lugar de redirigir: el modal de sesión intercepta esto
			window.dispatchEvent(new CustomEvent('payops:session-expired'));
		}
		return Promise.reject(error);
	}
);
