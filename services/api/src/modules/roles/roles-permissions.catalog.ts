export const ROLES_PERMISSIONS_CATALOG = {
  inicio: ['realizarSolicitudes', 'verificarRadicados'],
  panelAdministrador: ['crearUsuarios', 'crearRoles'],
} as const;

export type PermisosPorModulo = Record<string, string[]>;
