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

/* Sesión expirada: limpiar storage y redirigir al login.
   Excluir /auth/login para que el formulario pueda mostrar el error de credenciales. */
api.interceptors.response.use(
	(r) => r,
	(error) => {
		const url: string = error?.config?.url ?? '';
		const isLoginCall = url.includes('/auth/login') || url.includes('/auth/register');
		if (error?.response?.status === 401 && !isLoginCall) {
			localStorage.removeItem(AUTH_STORAGE_KEY);
			window.location.href = '/';
		}
		return Promise.reject(error);
	}
);
