/** Paleta de colores y tokens de diseño de GestorDoc CO */
export const Colors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: 'rgba(37, 99, 235, 0.1)',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#cbd5e1',
  borderFocus: '#2563eb',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  success: '#16a34a',
  successLight: '#dcfce7',
  error: '#dc2626',
  errorLight: '#fee2e2',
  warning: '#d97706',
  warningLight: '#fef3c7',
  shadow: 'rgba(15, 23, 42, 0.08)',
} as const;

/** Radios de borde */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

/** Espaciado */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Tipografía */
export const Typography = {
  title: { fontSize: 22, fontWeight: '700' as const, color: Colors.text },
  subtitle: { fontSize: 15, fontWeight: '400' as const, color: Colors.textSecondary },
  heading: { fontSize: 18, fontWeight: '600' as const, color: Colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: Colors.text },
  label: { fontSize: 13, fontWeight: '500' as const, color: Colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '400' as const, color: Colors.textMuted },
} as const;
