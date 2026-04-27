import AsyncStorage from '@react-native-async-storage/async-storage';
import { AxiosError } from 'axios';
import { api } from './api';
import type { AuthSession } from '../types/usuario';

const AUTH_STORAGE_KEY = 'gestordoc.auth';

// ── Payloads ──────────────────────────────────────────────────────────────────

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

// ── API calls ─────────────────────────────────────────────────────────────────

export async function login(payload: LoginPayload): Promise<AuthSession> {
  const response = await api.post<AuthSession>('/auth/login', payload);
  return response.data;
}

export async function requestPasswordReset(
  payload: RequestPasswordResetPayload,
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(
    '/auth/password-reset/request',
    payload,
  );
  return response.data;
}

export async function confirmPasswordReset(
  payload: ConfirmPasswordResetPayload,
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(
    '/auth/password-reset/confirm',
    payload,
  );
  return response.data;
}

export async function changeInitialPassword(
  payload: ChangeInitialPasswordPayload,
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(
    '/auth/change-initial-password',
    payload,
  );
  return response.data;
}

// ── Sesión ────────────────────────────────────────────────────────────────────

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => undefined);
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}

// ── Errores ───────────────────────────────────────────────────────────────────

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const msg = error.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join('. ');
  }
  return 'No fue posible completar la operación. Intenta nuevamente.';
}
