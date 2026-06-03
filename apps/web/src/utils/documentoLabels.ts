/**
 * Mapea las claves internas de documento (target) a etiquetas legibles
 * para mostrarle al usuario sin exponer terminologia tecnica.
 */
const LABELS: Record<string, string> = {
  cedula: 'documento de identidad',
  rut: 'RUT',
  eps: 'certificado de EPS',
  adres: 'certificado ADRES',
  planilla: 'planilla de seguridad social',
  cuenta_cobro: 'cuenta de cobro',
  cuenta_bancaria: 'certificación bancaria',
  contrato: 'contrato',
};

export function etiquetaDocumento(clave?: string | null): string {
  if (!clave) return 'documento';
  return LABELS[clave] || clave;
}
