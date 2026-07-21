import { AxiosError } from 'axios';
import { api } from '../../services/http/api';
import type { AuthSession } from '../../types/usuario';

const AUTH_STORAGE_KEY = 'payops.auth';

export interface LoginPayload {
  correo: string;
  password: string;
}

export interface RequestPasswordResetPayload {
  correo: string;
}

export interface ConfirmPasswordResetPayload {
  token: string;
  newPassword: string;
}

export interface ChangeInitialPasswordPayload {
  correo: string;
  currentPassword: string;
  newPassword: string;
}

export async function login(payload: LoginPayload): Promise<AuthSession> {
  const response = await api.post<AuthSession>('/auth/login', payload);
  return response.data;
}

export async function requestPasswordReset(payload: RequestPasswordResetPayload): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('/auth/password-reset/request', payload);
  return response.data;
}

export async function confirmPasswordReset(payload: ConfirmPasswordResetPayload): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('/auth/password-reset/confirm', payload);
  return response.data;
}

export async function changeInitialPassword(payload: ChangeInitialPasswordPayload): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>('/auth/change-initial-password', payload);
  return response.data;
}

export function saveAuthSession(session: AuthSession) {
  // Guardar solo datos de usuario; el token viaja en cookie HttpOnly y no debe persistirse
  const { token: _ignored, ...rest } = session;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(rest));
}

export function getAuthSession(): AuthSession | null {
  const rawSession = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  // Limpiar la cookie HttpOnly del servidor (fire-and-forget)
  api.post('/auth/logout').catch(() => {});
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const backendMessage = error.response?.data?.message;

    if (typeof backendMessage === 'string') {
      return backendMessage;
    }
  }

  return 'No fue posible iniciar sesión. Intenta nuevamente.';
}