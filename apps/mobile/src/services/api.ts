import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS } from '../config/api.config';

const AUTH_STORAGE_KEY = 'gestordoc.auth';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Interceptor de autenticación.
 * Lee el token JWT de AsyncStorage y lo adjunta como Bearer en cada petición.
 * Funciona de forma transparente para todos los servicios.
 */
api.interceptors.request.use(async (config) => {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw) as { token?: string };
      if (session?.token) {
        config.headers['Authorization'] = `Bearer ${session.token}`;
      }
    }
  } catch {
    // Sesión corrompida — se ignora sin romper la petición
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => undefined);
  }
  return config;
});
