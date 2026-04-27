/**
 * Configuración de la URL base de la API.
 *
 * Opciones según entorno:
 * - Desarrollo con Expo Go en el mismo PC:  http://10.0.2.2:3001/api  (Android emulator)
 * - Desarrollo en dispositivo físico:       http://<IP_LOCAL>:3001/api
 * - Producción / VPS:                       https://tu-dominio.com/api
 *
 * Cambia API_BASE_URL según tu entorno antes de ejecutar la app.
 */
export const API_BASE_URL = 'http://10.0.2.2:3001/api';

/** Tiempo máximo de espera en ms para cada petición */
export const API_TIMEOUT_MS = 15000;
