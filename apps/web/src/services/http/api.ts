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
			// Sesión corrompida — se ignora sin romper la petición
			localStorage.removeItem(AUTH_STORAGE_KEY);
		}
	}
	return config;
});
