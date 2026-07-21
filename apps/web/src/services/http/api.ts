import axios from 'axios';

export const api = axios.create({
	baseURL: '/api/index.php',
	withCredentials: true,
	headers: {
		'Content-Type': 'application/json',
	},
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
