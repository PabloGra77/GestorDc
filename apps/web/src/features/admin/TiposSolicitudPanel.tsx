import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/http/api';
import { descargarPreviewPlantilla } from '../solicitudes/generarPdfFormato';
import { PreviewFormularioModal, PreviewFormularioContenido } from '../../components/PreviewFormularioModal';
import '../../styles/modulos-editor.css';

interface Area {
  id: number;
  nombre: string;
  slug: string;
  activo: boolean;
}

interface CampoPlantilla {
  key: string;
  label: string;
  type:
    | 'text'
    | 'email'
    | 'number'
    | 'valor-pesos'
    | 'date'
    | 'mes-anio'
    | 'file'
    | 'select'
    | 'textarea'
    | 'texto-fijo'
    | 'tipo-doc'
    | 'cc'
    | 'nit'
    | 'cuenta-bancaria'
    | 'banco-select'
    | 'direccion'
    | 'persona'
    | 'calculado'
    | 'tabla-items';
  required: boolean;
  group?: string;
  ocr_target?: string;
  texto?: string;
  /** Para 'calculado': campos que se combinan y la operación (suma, resta, etc.) */
  operandos?: string[];
  operacion?: 'suma' | 'resta' | 'multiplicacion' | 'division';
  /** Para campos tipo 'file': key del dato que la IA debe encontrar/validar dentro del adjunto */
  validar_contra?: string;
  /** Para datos normales: key del adjunto contra el cual la IA debe comparar este valor */
  comparar_contra?: string;
  /** Para campos tipo 'tabla-items': columnas que llena el solicitante (varias filas) */
  columnas?: string[];
  /** Para campos tipo 'select': opciones de la lista desplegable */
  opciones?: string[];
  /** Para 'tabla-items': cada fila lleva su propia factura validada por IA */
  conFactura?: boolean;
  /** Qué debe verificar la IA en la factura (total, establecimiento, fecha, múltiples, alteración) */
  verificaciones?: string[];
  /** Nombre esperado del establecimiento/proveedor (opcional, para la verificación) */
  establecimientoEsperado?: string;
}

const VERIFICACIONES_FACTURA: Array<{ v: string; l: string }> = [
  { v: 'total', l: 'Verificar el total / valor' },
  { v: 'establecimiento', l: 'Verificar establecimiento / NIT' },
  { v: 'fecha', l: 'Verificar que tenga fecha' },
  { v: 'multiples', l: 'Detectar si hay varias facturas en el archivo' },
  { v: 'alteracion', l: 'Señales de alteración / legibilidad (básico)' },
];

interface PasoFlujo {
  rol: string;
  label: string;
  orden: number;
}

interface FlujoAreas {
  areasParticipantes: number[];
  areaInicialId: number | null;
  areaFinalId: number | null;
  remision: Record<string, number[]>;
}

type PdfAlineacion = 'izquierda' | 'centro' | 'derecha';

interface BloqueBase {
  id: string;
  x: number;
  y: number;
  w: number;
  pagina?: number; // default 1
}

type PdfBloque = BloqueBase & (
  | { tipo: 'encabezado'; titulo: string; subtitulo: string; area: string; codigo: string; fecha: string; version: string; paginaTexto: string; src?: string }
  | { tipo: 'logo'; alineacion: PdfAlineacion; ancho: number; src?: string }
  | { tipo: 'titulo'; texto: string; alineacion: PdfAlineacion; tamano: number; negrita: boolean }
  | { tipo: 'texto'; texto: string; alineacion: PdfAlineacion; tamano: number }
  | { tipo: 'campo'; campoKey: string; etiqueta: string; alineacion: PdfAlineacion }
  | { tipo: 'tabla'; columnas: string[]; conTotal?: boolean; etiquetaTotal?: string }
  | { tipo: 'divider' }
  | { tipo: 'firma'; etiqueta: string; campoFirma: 'profesional' | 'coordinador' | 'contabilidad' }
  | { tipo: 'caja'; alto: number; relleno: boolean; etiqueta?: string }
  | { tipo: 'imagen'; src: string; etiqueta?: string }
  | { tipo: 'lista'; items: string[]; conVinetas: boolean }
  | { tipo: 'separador-doble' }
  | { tipo: 'qr-radicado'; tamano: number }
);

const LOGOS_DISPONIBLES: Array<{ id: string; nombre: string; src: string }> = [
  { id: 'goleman-claro', nombre: 'Goleman IPS · Color', src: '/logo-payops-dark.png' },
  { id: 'goleman-oscuro', nombre: 'Goleman IPS · Versión clara', src: '/logo-payops.png' },
  { id: 'pestana', nombre: 'Logo pestaña (transparente)', src: '/logo-pestana.png' },
  { id: 'icon-app', nombre: 'Icono Payops', src: '/icon-app.png' },
];

const FIRMA_LABELS: Record<'profesional' | 'coordinador' | 'contabilidad', string> = {
  profesional: 'Solicitante / Profesional del área',
  coordinador: 'Coordinador / Director',
  contabilidad: 'Persona que certifica (área final)',
};

interface PlantillaPdf {
  bloques: PdfBloque[];
}

function nuevoId() {
  return Math.random().toString(36).slice(2, 9);
}

function plantillaCuentaCobro(): PdfBloque[] {
  return [
    // Página 1: Cuenta de cobro principal
    { id: nuevoId(), pagina: 1, x: 18, y: 10, w: 174, tipo: 'encabezado', titulo: 'FORMATO CUENTA DE COBRO', subtitulo: 'DIRECCION FINANCIERA', area: 'CONTABILIDAD', codigo: 'DF-CON-FR-003', fecha: '23/01/2026', version: '2', paginaTexto: '1 de 1', src: '/logo-payops-dark.png' },
    { id: nuevoId(), pagina: 1, x: 18, y: 46, w: 110, tipo: 'texto', texto: 'Ciudad y fecha: {{ciudad}}, {{fecha}}', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), pagina: 1, x: 18, y: 58, w: 174, tipo: 'titulo', texto: 'CUENTA DE COBRO N° {{radicado}}', alineacion: 'centro', tamano: 14, negrita: true },
    { id: nuevoId(), pagina: 1, x: 18, y: 70, w: 174, tipo: 'titulo', texto: 'IPS GOLEMAN SERVICIO INTEGRAL SAS', alineacion: 'centro', tamano: 11, negrita: true },
    { id: nuevoId(), pagina: 1, x: 18, y: 78, w: 174, tipo: 'titulo', texto: 'NIT 900.231.82', alineacion: 'centro', tamano: 11, negrita: true },
    { id: nuevoId(), pagina: 1, x: 18, y: 90, w: 174, tipo: 'titulo', texto: 'DEBE A:', alineacion: 'centro', tamano: 11, negrita: true },
    { id: nuevoId(), pagina: 1, x: 18, y: 100, w: 174, tipo: 'campo', campoKey: '__nombre', etiqueta: 'NOMBRE:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 112, w: 174, tipo: 'campo', campoKey: '__cedula', etiqueta: 'C.C:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 126, w: 174, tipo: 'texto', texto: 'La suma de: {{valor}} ({{valorLetras}})', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), pagina: 1, x: 18, y: 136, w: 174, tipo: 'texto', texto: 'Por concepto de: {{concepto}} — Discriminados así:', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), pagina: 1, x: 18, y: 148, w: 174, tipo: 'tabla', columnas: ['FECHA', 'ITEM', 'VALOR'], conTotal: true, etiquetaTotal: 'TOTAL' },
    { id: nuevoId(), pagina: 1, x: 18, y: 214, w: 174, tipo: 'campo', campoKey: 'numeroCuenta', etiqueta: 'Por favor efectuar el pago a mi cuenta N°:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 226, w: 174, tipo: 'campo', campoKey: 'banco', etiqueta: 'Banco / Tipo de cuenta:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 252, w: 80, tipo: 'firma', etiqueta: 'Firma del solicitante', campoFirma: 'profesional' },
    // Página 2: Soportes documentales adjuntos
    { id: nuevoId(), pagina: 2, x: 18, y: 18, w: 174, tipo: 'titulo', texto: 'ANEXOS · SOPORTES DOCUMENTALES', alineacion: 'centro', tamano: 13, negrita: true },
    { id: nuevoId(), pagina: 2, x: 18, y: 28, w: 174, tipo: 'divider' },
    { id: nuevoId(), pagina: 2, x: 18, y: 38, w: 174, tipo: 'campo', campoKey: 'banco', etiqueta: 'Banco:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 50, w: 174, tipo: 'campo', campoKey: 'numeroCuenta', etiqueta: 'N° Cuenta:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 62, w: 174, tipo: 'campo', campoKey: 'tipoCuenta', etiqueta: 'Tipo de cuenta:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 78, w: 174, tipo: 'campo', campoKey: 'eps', etiqueta: 'EPS:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 94, w: 174, tipo: 'texto', texto: 'Documentos cargados:', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), pagina: 2, x: 18, y: 104, w: 174, tipo: 'campo', campoKey: 'docRut', etiqueta: '• RUT:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 114, w: 174, tipo: 'campo', campoKey: 'docEps', etiqueta: '• Certificado EPS:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 124, w: 174, tipo: 'campo', campoKey: 'docCuentaBancaria', etiqueta: '• Certificación bancaria:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 134, w: 174, tipo: 'campo', campoKey: 'docPlanilla', etiqueta: '• Planilla seguridad social:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 144, w: 174, tipo: 'campo', campoKey: 'docAdres', etiqueta: '• Certificado ADRES:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 154, w: 174, tipo: 'campo', campoKey: 'docCuentaCobro', etiqueta: '• Cuenta de cobro firmada:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 240, w: 70, tipo: 'firma', etiqueta: 'Certifica área final', campoFirma: 'contabilidad' },
  ];
}

function plantillaViaticos(): PdfBloque[] {
  return [
    { id: nuevoId(), pagina: 1, x: 18, y: 14, w: 36, tipo: 'logo', alineacion: 'izquierda', ancho: 36, src: '/logo-payops-dark.png' },
    { id: nuevoId(), pagina: 1, x: 18, y: 38, w: 174, tipo: 'titulo', texto: 'SOLICITUD DE VIÁTICOS · {{radicado}}', alineacion: 'centro', tamano: 14, negrita: true },
    { id: nuevoId(), pagina: 1, x: 18, y: 54, w: 174, tipo: 'texto', texto: 'Fecha de elaboración: {{fecha}}', alineacion: 'izquierda', tamano: 10 },
    { id: nuevoId(), pagina: 1, x: 18, y: 70, w: 174, tipo: 'divider' },
    { id: nuevoId(), pagina: 1, x: 18, y: 80, w: 174, tipo: 'titulo', texto: 'DATOS DEL SOLICITANTE', alineacion: 'izquierda', tamano: 11, negrita: true },
    { id: nuevoId(), pagina: 1, x: 18, y: 92, w: 174, tipo: 'campo', campoKey: '__nombre', etiqueta: 'Nombre:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 104, w: 174, tipo: 'campo', campoKey: '__cedula', etiqueta: 'Documento:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 120, w: 174, tipo: 'titulo', texto: 'DETALLES DEL VIAJE', alineacion: 'izquierda', tamano: 11, negrita: true },
    { id: nuevoId(), pagina: 1, x: 18, y: 132, w: 174, tipo: 'campo', campoKey: 'destinoViaje', etiqueta: 'Destino:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 144, w: 174, tipo: 'campo', campoKey: 'tipoTransporte', etiqueta: 'Medio de transporte:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 156, w: 174, tipo: 'campo', campoKey: 'numeroReferenciaViaje', etiqueta: 'Referencia (vuelo/reserva/placa):', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 168, w: 174, tipo: 'campo', campoKey: 'fechaViaje', etiqueta: 'Fecha del viaje:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 184, w: 174, tipo: 'texto', texto: 'Valor total del viaje: {{valor}} ({{valorLetras}})', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), pagina: 1, x: 18, y: 198, w: 174, tipo: 'campo', campoKey: 'docFacturaViaje', etiqueta: 'Soporte / factura adjunta:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 235, w: 70, tipo: 'firma', etiqueta: 'Solicitante', campoFirma: 'profesional' },
    { id: nuevoId(), pagina: 1, x: 100, y: 235, w: 70, tipo: 'firma', etiqueta: 'Coordinador / Director', campoFirma: 'coordinador' },
  ];
}

function plantillaAdres(): PdfBloque[] {
  return [
    { id: nuevoId(), x: 18, y: 14, w: 36, tipo: 'logo', alineacion: 'izquierda', ancho: 36 },
    { id: nuevoId(), x: 18, y: 38, w: 174, tipo: 'titulo', texto: 'CERTIFICADO ADRES', alineacion: 'centro', tamano: 16, negrita: true },
    { id: nuevoId(), x: 18, y: 52, w: 174, tipo: 'texto', texto: 'Radicado N° {{radicado}} · Fecha: {{fecha}}', alineacion: 'centro', tamano: 10 },
    { id: nuevoId(), x: 18, y: 70, w: 174, tipo: 'titulo', texto: 'ADMINISTRADORA DE LOS RECURSOS DEL SISTEMA DE SEGURIDAD SOCIAL EN SALUD', alineacion: 'centro', tamano: 10, negrita: true },
    { id: nuevoId(), x: 18, y: 92, w: 174, tipo: 'divider' },
    { id: nuevoId(), x: 18, y: 100, w: 174, tipo: 'texto', texto: 'Por medio del presente documento se certifica la información de afiliación del usuario:', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), x: 18, y: 118, w: 174, tipo: 'campo', campoKey: '__nombre', etiqueta: 'Nombre:', alineacion: 'izquierda' },
    { id: nuevoId(), x: 18, y: 130, w: 174, tipo: 'campo', campoKey: '__cedula', etiqueta: 'Documento:', alineacion: 'izquierda' },
    { id: nuevoId(), x: 18, y: 142, w: 174, tipo: 'campo', campoKey: 'eps', etiqueta: 'EPS:', alineacion: 'izquierda' },
    { id: nuevoId(), x: 18, y: 160, w: 174, tipo: 'texto', texto: 'La presente certificación se expide a solicitud del interesado para los fines que estime convenientes.', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), x: 18, y: 230, w: 80, tipo: 'firma', etiqueta: 'Firma autorizada', campoFirma: 'coordinador' },
  ];
}

function plantillaEps(): PdfBloque[] {
  return [
    { id: nuevoId(), x: 18, y: 14, w: 36, tipo: 'logo', alineacion: 'izquierda', ancho: 36 },
    { id: nuevoId(), x: 18, y: 38, w: 174, tipo: 'titulo', texto: 'CERTIFICADO DE AFILIACIÓN EPS', alineacion: 'centro', tamano: 15, negrita: true },
    { id: nuevoId(), x: 18, y: 54, w: 174, tipo: 'texto', texto: 'Radicado: {{radicado}} · Bogotá D.C., {{fecha}}', alineacion: 'centro', tamano: 10 },
    { id: nuevoId(), x: 18, y: 72, w: 174, tipo: 'divider' },
    { id: nuevoId(), x: 18, y: 84, w: 174, tipo: 'texto', texto: 'La Entidad Promotora de Salud certifica que el usuario relacionado a continuación se encuentra afiliado:', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), x: 18, y: 104, w: 174, tipo: 'campo', campoKey: '__nombre', etiqueta: 'Nombre completo:', alineacion: 'izquierda' },
    { id: nuevoId(), x: 18, y: 116, w: 174, tipo: 'campo', campoKey: '__cedula', etiqueta: 'Documento de identidad:', alineacion: 'izquierda' },
    { id: nuevoId(), x: 18, y: 128, w: 174, tipo: 'campo', campoKey: 'eps', etiqueta: 'EPS:', alineacion: 'izquierda' },
    { id: nuevoId(), x: 18, y: 148, w: 174, tipo: 'texto', texto: 'Estado: ACTIVO · Régimen: Contributivo', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), x: 18, y: 166, w: 174, tipo: 'texto', texto: 'Se expide a solicitud del interesado a los {{fecha}}.', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), x: 18, y: 230, w: 80, tipo: 'firma', etiqueta: 'Firma representante EPS', campoFirma: 'coordinador' },
  ];
}

function plantillaRut(): PdfBloque[] {
  return [
    { id: nuevoId(), x: 18, y: 14, w: 36, tipo: 'logo', alineacion: 'izquierda', ancho: 36 },
    { id: nuevoId(), x: 18, y: 38, w: 174, tipo: 'titulo', texto: 'REGISTRO ÚNICO TRIBUTARIO - RUT', alineacion: 'centro', tamano: 15, negrita: true },
    { id: nuevoId(), x: 18, y: 54, w: 174, tipo: 'texto', texto: 'Radicado: {{radicado}}', alineacion: 'centro', tamano: 10 },
    { id: nuevoId(), x: 18, y: 72, w: 174, tipo: 'titulo', texto: 'DIAN · Dirección de Impuestos y Aduanas Nacionales', alineacion: 'centro', tamano: 10, negrita: true },
    { id: nuevoId(), x: 18, y: 90, w: 174, tipo: 'divider' },
    { id: nuevoId(), x: 18, y: 102, w: 174, tipo: 'campo', campoKey: '__nombre', etiqueta: 'Razón social / Nombre:', alineacion: 'izquierda' },
    { id: nuevoId(), x: 18, y: 114, w: 174, tipo: 'campo', campoKey: '__cedula', etiqueta: 'NIT / Documento:', alineacion: 'izquierda' },
    { id: nuevoId(), x: 18, y: 130, w: 174, tipo: 'texto', texto: 'Información tributaria certificada por la DIAN.', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), x: 18, y: 230, w: 80, tipo: 'firma', etiqueta: 'Firma del solicitante', campoFirma: 'profesional' },
  ];
}

function plantillaGenerica(): PdfBloque[] {
  return [
    { id: nuevoId(), x: 18, y: 14, w: 36, tipo: 'logo', alineacion: 'izquierda', ancho: 36 },
    { id: nuevoId(), x: 18, y: 38, w: 174, tipo: 'titulo', texto: 'SOLICITUD - {{radicado}}', alineacion: 'centro', tamano: 14, negrita: true },
    { id: nuevoId(), x: 18, y: 54, w: 174, tipo: 'texto', texto: 'Fecha: {{fecha}}', alineacion: 'izquierda', tamano: 10 },
    { id: nuevoId(), x: 18, y: 72, w: 174, tipo: 'divider' },
    { id: nuevoId(), x: 18, y: 84, w: 174, tipo: 'campo', campoKey: '__nombre', etiqueta: 'Solicitante:', alineacion: 'izquierda' },
    { id: nuevoId(), x: 18, y: 96, w: 174, tipo: 'campo', campoKey: '__cedula', etiqueta: 'Documento:', alineacion: 'izquierda' },
    { id: nuevoId(), x: 18, y: 230, w: 80, tipo: 'firma', etiqueta: 'Firma', campoFirma: 'profesional' },
  ];
}

// DF-CON-FR-004 · Anticipo de gastos de viaje o trámites correspondientes
function plantillaAnticipoGastos(): PdfBloque[] {
  return [
    { id: nuevoId(), pagina: 1, x: 18, y: 10, w: 174, tipo: 'encabezado', titulo: 'ANTICIPO DE GASTOS DE VIAJE O TRAMITES CORRESPONDIENTES', subtitulo: 'DIRECCION FINANCIERA', area: 'CONTABILIDAD', codigo: 'DF-CON-FR-004', fecha: '16/01/2026', version: '2', paginaTexto: '1 de 1', src: '/logo-payops-dark.png' },
    { id: nuevoId(), pagina: 1, x: 18, y: 48, w: 174, tipo: 'titulo', texto: 'REFERENCIA: ANTICIPO DE GASTOS DE VIAJE O TRAMITES CORRESPONDIENTE', alineacion: 'centro', tamano: 11, negrita: true },
    { id: nuevoId(), pagina: 1, x: 18, y: 64, w: 174, tipo: 'campo', campoKey: 'dirigidoA', etiqueta: 'A:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 80, w: 174, tipo: 'texto', texto: 'FECHA: {{fecha}}. Yo, {{nombre}} identificado con CC {{cedula}}, autorizo de manera expresa a IPS GOLEMAN SERVICIOS INTEGRALES SAS, para que en el evento que no se realice la legalización en un término máximo de cinco (5) días hábiles siguientes a la finalización del viaje del colaborador o terminación de los tramites solicitados por la empresa, sea descontado el valor de $ {{valor}} ({{valorLetras}}), correspondiente al Anticipo de gastos de viaje y entrega de anticipo para tramites de la empresa, correspondiente a: {{concepto}}', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), pagina: 1, x: 18, y: 132, w: 174, tipo: 'texto', texto: 'Este descuento será aplicable a conceptos de pago de salarios, primas extralegales, primas legales. Igualmente, que en caso de retiro o desvinculación de la empresa autorizo a que el saldo que en cualquier momento se encuentre en mi contra, sea descontado de mi liquidación de salarios y prestaciones sociales finales, vacaciones, auxilios y en general cualquier concepto que deba cancelarme la Empresa.', alineacion: 'izquierda', tamano: 11 },
    { id: nuevoId(), pagina: 1, x: 18, y: 158, w: 174, tipo: 'campo', campoKey: 'banco', etiqueta: 'Banco:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 168, w: 174, tipo: 'campo', campoKey: 'tipoCuenta', etiqueta: 'Tipo de cuenta:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 178, w: 174, tipo: 'campo', campoKey: 'numeroCuenta', etiqueta: 'Número de cuenta:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 210, w: 90, tipo: 'firma', etiqueta: 'Firma', campoFirma: 'profesional' },
    { id: nuevoId(), pagina: 1, x: 18, y: 240, w: 174, tipo: 'campo', campoKey: '__nombre', etiqueta: 'Nombre completo:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 250, w: 174, tipo: 'campo', campoKey: 'cargo', etiqueta: 'Cargo:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 260, w: 174, tipo: 'campo', campoKey: '__cedula', etiqueta: 'C.C.:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 270, w: 174, tipo: 'campo', campoKey: 'telefono', etiqueta: 'Teléfono:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 280, w: 174, tipo: 'campo', campoKey: 'direccion', etiqueta: 'Dirección:', alineacion: 'izquierda' },
  ];
}

// PRE-PPL-FR-026 · Formato informe de visita (Programas Especiales · Modelo Especial PPL) — 4 páginas
function plantillaInformeVisitaPPL(): PdfBloque[] {
  const enc = (pag: number, p: string): PdfBloque => ({ id: nuevoId(), pagina: pag, x: 18, y: 10, w: 174, tipo: 'encabezado', titulo: 'FORMATO INFORME DE VISITA', subtitulo: 'PROGRAMAS ESPECIALES', area: 'MODELO ESPECIAL PPL', codigo: 'PRE-PPL-FR-026', fecha: '22/05/2025', version: '1', paginaTexto: p, src: '/logo-payops-dark.png' });
  return [
    // Página 1
    enc(1, '1 de 4'),
    { id: nuevoId(), pagina: 1, x: 18, y: 46, w: 174, tipo: 'campo', campoKey: 'fechaCobertura', etiqueta: 'Fecha de cobertura:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 56, w: 174, tipo: 'campo', campoKey: 'establecimientoVisitado', etiqueta: 'Establecimiento visitado:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 66, w: 174, tipo: 'campo', campoKey: 'profesionalResponsable', etiqueta: 'Profesional responsable:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 76, w: 174, tipo: 'campo', campoKey: 'regional', etiqueta: 'Regional:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 92, w: 174, tipo: 'titulo', texto: '1. OBJETIVOS DE LA VISITA', alineacion: 'izquierda', tamano: 12, negrita: true },
    { id: nuevoId(), pagina: 1, x: 18, y: 102, w: 174, tipo: 'campo', campoKey: 'objetivosVisita', etiqueta: '', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 120, w: 174, tipo: 'titulo', texto: '2. METODOLOGÍA', alineacion: 'izquierda', tamano: 12, negrita: true },
    { id: nuevoId(), pagina: 1, x: 18, y: 130, w: 174, tipo: 'campo', campoKey: 'metodologiaPlaneacion', etiqueta: 'Planeación:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 1, x: 18, y: 150, w: 174, tipo: 'campo', campoKey: 'metodologiaEjecucion', etiqueta: 'Ejecución clínica:', alineacion: 'izquierda' },
    // Página 2
    enc(2, '2 de 4'),
    { id: nuevoId(), pagina: 2, x: 18, y: 46, w: 174, tipo: 'campo', campoKey: 'registroTecnico', etiqueta: 'Registro técnico:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 64, w: 174, tipo: 'titulo', texto: '3. RESULTADOS', alineacion: 'izquierda', tamano: 12, negrita: true },
    { id: nuevoId(), pagina: 2, x: 18, y: 74, w: 174, tipo: 'campo', campoKey: 'resultados', etiqueta: '', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 94, w: 174, tipo: 'titulo', texto: '4. HALLAZGOS RELEVANTES', alineacion: 'izquierda', tamano: 12, negrita: true },
    { id: nuevoId(), pagina: 2, x: 18, y: 104, w: 174, tipo: 'campo', campoKey: 'hallazgos', etiqueta: '', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 130, w: 174, tipo: 'titulo', texto: '5. COMPROMISOS', alineacion: 'izquierda', tamano: 12, negrita: true },
    { id: nuevoId(), pagina: 2, x: 18, y: 140, w: 174, tipo: 'campo', campoKey: 'compromisos', etiqueta: '', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 2, x: 18, y: 160, w: 174, tipo: 'titulo', texto: '6. CONCLUSIÓN', alineacion: 'izquierda', tamano: 12, negrita: true },
    { id: nuevoId(), pagina: 2, x: 18, y: 170, w: 174, tipo: 'campo', campoKey: 'conclusion', etiqueta: '', alineacion: 'izquierda' },
    // Página 3 — firmas
    enc(3, '3 de 4'),
    { id: nuevoId(), pagina: 3, x: 18, y: 50, w: 174, tipo: 'titulo', texto: 'FIRMA DEL PROFESIONAL RESPONSABLE', alineacion: 'izquierda', tamano: 11, negrita: true },
    { id: nuevoId(), pagina: 3, x: 18, y: 62, w: 174, tipo: 'campo', campoKey: '__nombre', etiqueta: 'Nombre:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 3, x: 18, y: 72, w: 174, tipo: 'campo', campoKey: 'cargo', etiqueta: 'Cargo:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 3, x: 18, y: 82, w: 174, tipo: 'campo', campoKey: '__cedula', etiqueta: 'Documento:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 3, x: 18, y: 92, w: 90, tipo: 'firma', etiqueta: 'Firma', campoFirma: 'profesional' },
    { id: nuevoId(), pagina: 3, x: 18, y: 140, w: 174, tipo: 'titulo', texto: 'AVAL DEL DIRECTOR DEL ERON', alineacion: 'izquierda', tamano: 11, negrita: true },
    { id: nuevoId(), pagina: 3, x: 18, y: 152, w: 174, tipo: 'campo', campoKey: 'nombreDirector', etiqueta: 'Nombre del director:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 3, x: 18, y: 162, w: 90, tipo: 'firma', etiqueta: 'Firma del director', campoFirma: 'coordinador' },
    { id: nuevoId(), pagina: 3, x: 18, y: 200, w: 174, tipo: 'campo', campoKey: 'selloEstablecimiento', etiqueta: 'Sello del establecimiento:', alineacion: 'izquierda' },
    // Página 4 — certificación de asistencia
    enc(4, '4 de 4'),
    { id: nuevoId(), pagina: 4, x: 18, y: 46, w: 174, tipo: 'titulo', texto: 'CERTIFICACIÓN DE ASISTENCIA A ACTIVIDADES PROFESIONALES EN EL ERON', alineacion: 'centro', tamano: 10, negrita: true },
    { id: nuevoId(), pagina: 4, x: 18, y: 60, w: 174, tipo: 'campo', campoKey: 'lugar', etiqueta: 'Lugar:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 4, x: 18, y: 70, w: 174, tipo: 'campo', campoKey: 'nombreEstablecimientoEron', etiqueta: 'Nombre del Establecimiento (ERON):', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 4, x: 18, y: 80, w: 174, tipo: 'campo', campoKey: 'fechaActividad', etiqueta: 'Fecha de la actividad:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 4, x: 18, y: 92, w: 174, tipo: 'texto', texto: 'Por medio del presente documento, se certifica que el(la) profesional:', alineacion: 'izquierda', tamano: 10 },
    { id: nuevoId(), pagina: 4, x: 18, y: 102, w: 174, tipo: 'campo', campoKey: '__nombre', etiqueta: 'Nombre completo del profesional:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 4, x: 18, y: 112, w: 174, tipo: 'campo', campoKey: 'cargo', etiqueta: 'Cargo o especialidad:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 4, x: 18, y: 124, w: 174, tipo: 'texto', texto: 'Asistió a las instalaciones de este establecimiento en cumplimiento de sus funciones, realizando actividades programadas dentro del marco del programa de salud mental PPL.', alineacion: 'izquierda', tamano: 10 },
    { id: nuevoId(), pagina: 4, x: 18, y: 146, w: 174, tipo: 'campo', campoKey: 'horaIngreso', etiqueta: 'Hora de ingreso al ERON:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 4, x: 18, y: 156, w: 174, tipo: 'campo', campoKey: 'horaSalida', etiqueta: 'Hora de salida del ERON:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 4, x: 18, y: 168, w: 174, tipo: 'campo', campoKey: 'descripcionActividad', etiqueta: 'Descripción breve de la actividad realizada:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 4, x: 18, y: 190, w: 174, tipo: 'campo', campoKey: 'nombreFuncionarioCertifica', etiqueta: 'Nombre del funcionario que certifica:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 4, x: 18, y: 200, w: 174, tipo: 'campo', campoKey: 'cargoCertifica', etiqueta: 'Cargo:', alineacion: 'izquierda' },
    { id: nuevoId(), pagina: 4, x: 18, y: 230, w: 90, tipo: 'firma', etiqueta: 'Firma coordinación', campoFirma: 'coordinador' },
  ];
}

const PLANTILLAS_EJEMPLO: Array<{ id: string; nombre: string; build: () => PdfBloque[] }> = [
  { id: 'cuenta-cobro', nombre: 'Cuenta de cobro (DF-CON-FR-003)', build: plantillaCuentaCobro },
  { id: 'anticipo-gastos', nombre: 'Anticipo de gastos de viaje (DF-CON-FR-004)', build: plantillaAnticipoGastos },
  { id: 'informe-visita-ppl', nombre: 'Informe de visita PPL (PRE-PPL-FR-026)', build: plantillaInformeVisitaPPL },
  { id: 'viaticos', nombre: 'Solicitud de viáticos', build: plantillaViaticos },
  { id: 'adres', nombre: 'Certificado ADRES', build: plantillaAdres },
  { id: 'eps', nombre: 'Certificado EPS', build: plantillaEps },
  { id: 'rut', nombre: 'Registro RUT', build: plantillaRut },
  { id: 'generica', nombre: 'Solicitud genérica', build: plantillaGenerica },
];

function inferirPlantillaPorNombre(nombre: string): PdfBloque[] {
  const lower = nombre.toLowerCase();
  if (lower.includes('anticipo')) return plantillaAnticipoGastos();
  if (lower.includes('informe') && (lower.includes('visita') || lower.includes('ppl'))) return plantillaInformeVisitaPPL();
  if (lower.includes('viatic') || lower.includes('viaje')) return plantillaViaticos();
  if (lower.includes('adres')) return plantillaAdres();
  if (lower.includes('eps')) return plantillaEps();
  if (lower.includes('rut')) return plantillaRut();
  if (lower.includes('cuenta') && lower.includes('cobro')) return plantillaCuentaCobro();
  return plantillaGenerica();
}

// ── Sugerencias inteligentes (catálogo offline) ───────────────────────────
// Según el título del tipo (ej. "cuenta de cobro") propone una descripción y
// los conjuntos de campos (de BLOQUES_PREDEFINIDOS) que normalmente se requieren.
// La plantilla del PDF se infiere con inferirPlantillaPorNombre().
interface SugerenciaTipo {
  descripcion: string;
  conjuntos: string[]; // ids de BLOQUES_PREDEFINIDOS
}

function sugerirDesdeTitulo(nombre: string): SugerenciaTipo | null {
  const l = nombre.trim().toLowerCase();
  if (l.length < 3) return null;
  if (l.includes('cuenta') && l.includes('cobro')) {
    return {
      descripcion: 'Radicación de cuenta de cobro: indica el periodo, el valor a cobrar (con su valor en letras) y el concepto, y adjunta la cuenta de cobro firmada junto con la certificación bancaria.',
      conjuntos: ['cuenta-cobro', 'cuenta-bancaria'],
    };
  }
  if (l.includes('anticipo')) {
    return {
      descripcion: 'Solicitud de anticipo de gastos: indica el valor del anticipo, el concepto y la cuenta bancaria donde se consignará. Se legaliza con facturas dentro del plazo establecido.',
      conjuntos: ['cuenta-cobro', 'cuenta-bancaria'],
    };
  }
  if (l.includes('viatic') || l.includes('viaje')) {
    return {
      descripcion: 'Solicitud de viáticos / viaje: indica el destino, el medio de transporte y el valor, y adjunta las facturas o recibos del viaje.',
      conjuntos: ['destino-viaje-soporte'],
    };
  }
  if (l.includes('rut')) {
    return {
      descripcion: 'Registro / actualización de RUT: el solicitante adjunta el RUT para su validación automática.',
      conjuntos: ['datos-personales', 'rut'],
    };
  }
  if (l.includes('eps')) {
    return {
      descripcion: 'Certificado de EPS: indica la EPS de afiliación y adjunta el certificado vigente.',
      conjuntos: ['certificado-eps'],
    };
  }
  if (l.includes('adres')) {
    return {
      descripcion: 'Certificado ADRES: el solicitante adjunta el certificado ADRES para su validación.',
      conjuntos: ['adres'],
    };
  }
  if (l.includes('seguridad') || l.includes('planilla') || l.includes('aporte')) {
    return {
      descripcion: 'Soporte de seguridad social: el solicitante adjunta la planilla de aportes del periodo.',
      conjuntos: ['planilla-seguridad'],
    };
  }
  if (l.includes('banc') || l.includes('cuenta')) {
    return {
      descripcion: 'Certificación bancaria: indica banco, tipo y número de cuenta, y adjunta la certificación bancaria.',
      conjuntos: ['cuenta-bancaria'],
    };
  }
  // Genérico: al menos pide identificación del solicitante.
  return {
    descripcion: 'Solicitud con los datos básicos de identificación del solicitante.',
    conjuntos: ['datos-personales'],
  };
}

// Plantilla inicial para un tipo NUEVO: genérica y neutral (no cuenta de cobro),
// para no confundir. El admin elige el formato real con "escoge un ejemplo".
const PLANTILLA_PDF_DEFAULT: PlantillaPdf = {
  bloques: plantillaGenerica(),
};

const TIPOS_BLOQUE_LABELS: Record<string, string> = {
  encabezado: '▤ Encabezado',
  logo: '🏷️ Logo',
  titulo: '🅷 Título',
  texto: '📝 Texto',
  campo: '🔗 Campo',
  tabla: '▦ Tabla',
  divider: '─ Línea',
  firma: '✍ Firma',
  caja: '▭ Caja',
  imagen: '🖼️ Imagen',
  lista: '☰ Lista',
  'separador-doble': '═ Separador doble',
  'qr-radicado': '▣ QR del radicado',
};

interface TipoSolicitud {
  id: number;
  areaId: number;
  areaNombre: string;
  areaSlug: string;
  nombre: string;
  descripcion: string | null;
  slug: string;
  activo: boolean;
  orden: number;
  camposPlantilla: CampoPlantilla[];
  flujoAprobacion: PasoFlujo[];
  flujoAreas: FlujoAreas | null;
  plantillaPdf?: PlantillaPdf | null;
}

const TIPOS_CAMPO = [
  { v: 'text', l: 'Texto' },
  { v: 'email', l: 'Correo' },
  { v: 'number', l: 'Numero' },
  { v: 'valor-pesos', l: 'Valor en pesos (auto letras)' },
  { v: 'date', l: 'Fecha' },
  { v: 'mes-anio', l: 'Mes y ano' },
  { v: 'textarea', l: 'Texto largo' },
  { v: 'texto-fijo', l: 'Texto fijo / nota' },
  { v: 'select', l: 'Lista de opciones' },
  { v: 'tipo-doc', l: 'Tipo de documento (CC/CE/TI)' },
  { v: 'cc', l: 'Cedula / numero' },
  { v: 'nit', l: 'NIT' },
  { v: 'cuenta-bancaria', l: 'Numero cuenta bancaria' },
  { v: 'banco-select', l: 'Banco (lista colombiana)' },
  { v: 'direccion', l: 'Dirección + ciudad + país (con mapa y clima)' },
  { v: 'persona', l: 'Nombre con autocompletar (usuarios del sistema)' },
  { v: 'calculado', l: 'Calculado (suma/resta/× /÷ de otros campos)' },
  { v: 'tabla-items', l: 'Tabla de varias filas (ej. varios viáticos)' },
  { v: 'file', l: 'Archivo / documento' },
];

const OPERACIONES_CALCULO: Array<{ v: 'suma' | 'resta' | 'multiplicacion' | 'division'; l: string; sim: string }> = [
  { v: 'suma', l: 'Sumar (+)', sim: '+' },
  { v: 'resta', l: 'Restar (−)', sim: '−' },
  { v: 'multiplicacion', l: 'Multiplicar (×)', sim: '×' },
  { v: 'division', l: 'Dividir (÷)', sim: '÷' },
];

// Combina varios valores numéricos según la operación. Compartido por editor, formulario y PDF.
function calcularOperacion(valores: number[], operacion: 'suma' | 'resta' | 'multiplicacion' | 'division'): number {
  if (valores.length === 0) return 0;
  return valores.reduce((acc, v, i) => {
    if (i === 0) return v;
    switch (operacion) {
      case 'suma': return acc + v;
      case 'resta': return acc - v;
      case 'multiplicacion': return acc * v;
      case 'division': return v === 0 ? acc : acc / v;
      default: return acc;
    }
  });
}

// Texto monetario/numérico → número (formato colombiano: punto = miles, coma = decimal)
function parseNumeroEditor(texto: string): number {
  const limpio = String(texto ?? '').replace(/[^0-9,.-]/g, '').trim();
  if (!limpio) return 0;
  const n = parseFloat(limpio.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

const BLOQUES_PREDEFINIDOS: Array<{ id: string; nombre: string; descripcion: string; campos: CampoPlantilla[] }> = [
  {
    id: 'datos-personales',
    nombre: 'Datos personales',
    descripcion: 'Documento, nombres, apellidos, fechas',
    campos: [
      { key: 'tipoDocumento', label: 'Tipo de documento', type: 'tipo-doc', required: true, group: 'Datos personales' },
      { key: 'numeroDocumento', label: 'Numero de documento', type: 'cc', required: true, group: 'Datos personales' },
      { key: 'primerNombre', label: 'Primer nombre', type: 'text', required: true, group: 'Datos personales' },
      { key: 'segundoNombre', label: 'Segundo nombre (opcional)', type: 'text', required: false, group: 'Datos personales' },
      { key: 'primerApellido', label: 'Primer apellido', type: 'text', required: true, group: 'Datos personales' },
      { key: 'segundoApellido', label: 'Segundo apellido (opcional)', type: 'text', required: false, group: 'Datos personales' },
      { key: 'fechaNacimiento', label: 'Fecha de nacimiento', type: 'date', required: true, group: 'Datos personales' },
      { key: 'fechaExpedicion', label: 'Fecha de expedicion', type: 'date', required: true, group: 'Datos personales' },
      { key: 'lugarExpedicion', label: 'Lugar de expedicion', type: 'text', required: true, group: 'Datos personales' },
      { key: 'telefono', label: 'Telefono', type: 'text', required: true, group: 'Datos personales' },
      { key: 'correo', label: 'Correo electronico', type: 'email', required: true, group: 'Datos personales' },
      { key: 'docCedula', label: 'Adjuntar cedula', type: 'file', required: true, group: 'Datos personales', ocr_target: 'cedula' },
    ],
  },
  {
    id: 'rut',
    nombre: 'RUT',
    descripcion: 'Solicitar y validar RUT',
    campos: [
      { key: 'docRut', label: 'Adjuntar RUT', type: 'file', required: true, group: 'RUT', ocr_target: 'rut' },
    ],
  },
  {
    id: 'certificado-eps',
    nombre: 'Certificado EPS',
    descripcion: 'Solicitar y validar EPS',
    campos: [
      { key: 'eps', label: 'EPS / afiliacion', type: 'text', required: true, group: 'Salud' },
      { key: 'docEps', label: 'Adjuntar certificado EPS', type: 'file', required: true, group: 'Salud', ocr_target: 'eps' },
    ],
  },
  {
    id: 'cuenta-bancaria',
    nombre: 'Certificado cuenta bancaria',
    descripcion: 'Banco, numero de cuenta, tipo y certificado',
    campos: [
      { key: 'banco', label: 'Banco', type: 'banco-select', required: true, group: 'Cuenta bancaria' },
      { key: 'tipoCuenta', label: 'Tipo de cuenta (ahorros/corriente)', type: 'select', required: true, group: 'Cuenta bancaria' },
      { key: 'numeroCuenta', label: 'Numero de cuenta', type: 'cuenta-bancaria', required: true, group: 'Cuenta bancaria' },
      { key: 'docCuentaBancaria', label: 'Adjuntar certificacion bancaria', type: 'file', required: true, group: 'Cuenta bancaria', ocr_target: 'cuenta_bancaria' },
    ],
  },
  {
    id: 'planilla-seguridad',
    nombre: 'Planilla seguridad social',
    descripcion: 'Soporte de aportes',
    campos: [
      { key: 'docPlanilla', label: 'Adjuntar planilla seguridad social', type: 'file', required: true, group: 'Planilla seguridad social', ocr_target: 'planilla' },
    ],
  },
  {
    id: 'cuenta-cobro',
    nombre: 'Cuenta de cobro (valor + texto)',
    descripcion: 'Mes a radicar, valor en numero y letras (auto), texto formal',
    campos: [
      { key: 'mesRadicar', label: 'Mes y ano a radicar', type: 'mes-anio', required: true, group: 'Cuenta de cobro' },
      { key: 'valorPesos', label: 'Valor a radicar', type: 'valor-pesos', required: true, group: 'Cuenta de cobro' },
      { key: 'observaciones', label: 'Observaciones (opcional)', type: 'textarea', required: false, group: 'Cuenta de cobro' },
      { key: 'docCuentaCobro', label: 'Adjuntar cuenta de cobro firmada', type: 'file', required: true, group: 'Cuenta de cobro', ocr_target: 'cuenta_cobro' },
    ],
  },
  {
    id: 'adres',
    nombre: 'Certificado ADRES',
    descripcion: 'Validacion ADRES',
    campos: [
      { key: 'docAdres', label: 'Adjuntar certificado ADRES', type: 'file', required: false, group: 'ADRES', ocr_target: 'adres' },
    ],
  },
  {
    id: 'direccion-viaje',
    nombre: 'Dirección / destino',
    descripcion: 'Dirección con ciudad, país, mapa y clima del destino',
    campos: [
      { key: 'direccionDestino', label: 'Dirección del destino', type: 'direccion', required: true, group: 'Destino' },
    ],
  },
  {
    id: 'destino-viaje-soporte',
    nombre: 'Destino de viaje + soporte',
    descripcion: 'Destino con mapa/clima + medio de transporte, valor y factura/recibo',
    campos: [
      { key: 'destinoViaje', label: 'Destino del viaje', type: 'direccion', required: true, group: 'Viaje' },
      { key: 'tipoTransporte', label: 'Medio de transporte', type: 'select', required: true, group: 'Viaje' },
      { key: 'numeroReferenciaViaje', label: 'Número de vuelo / reserva / placa', type: 'text', required: false, group: 'Viaje' },
      { key: 'fechaViaje', label: 'Fecha del viaje', type: 'date', required: true, group: 'Viaje' },
      { key: 'valorViaje', label: 'Valor del viaje', type: 'valor-pesos', required: true, group: 'Viaje' },
      { key: 'docFacturaViaje', label: 'Adjuntar factura / recibo (avión, taxi, pickup, carro)', type: 'file', required: true, group: 'Viaje' },
    ],
  },
];

// Documentos simplificados: cada uno agrega SOLO un campo de archivo (con su
// validación de IA por OCR). Sin campos extra. Para la columna derecha del editor.
const DOCUMENTOS_PREDEFINIDOS: Array<{ key: string; label: string; emoji: string; ocr_target: string }> = [
  { key: 'docCedula', label: 'Documento de identidad', emoji: '🪪', ocr_target: 'cedula' },
  { key: 'docRut', label: 'RUT', emoji: '🧾', ocr_target: 'rut' },
  { key: 'docEps', label: 'Certificado EPS', emoji: '🏥', ocr_target: 'eps' },
  { key: 'docAdres', label: 'Certificado ADRES', emoji: '📄', ocr_target: 'adres' },
  { key: 'docCuentaBancaria', label: 'Certificación bancaria', emoji: '🏦', ocr_target: 'cuenta_bancaria' },
  { key: 'docPlanilla', label: 'Planilla seguridad social', emoji: '🛡️', ocr_target: 'planilla' },
  { key: 'docCuentaCobro', label: 'Cuenta de cobro firmada', emoji: '✍️', ocr_target: 'cuenta_cobro' },
];

const OCR_TARGETS = [
  { v: '', l: '— ninguno —' },
  { v: 'cedula', l: 'Cedula de ciudadania' },
  { v: 'rut', l: 'RUT' },
  { v: 'eps', l: 'Certificado EPS' },
  { v: 'adres', l: 'Certificado ADRES' },
  { v: 'planilla', l: 'Planilla seguridad social' },
  { v: 'cuenta_cobro', l: 'Cuenta de cobro' },
  { v: 'contrato', l: 'Contrato' },
];

const FLUJO_DEFAULT: PasoFlujo[] = [
  { rol: 'analista', label: 'Analista del area', orden: 1 },
  { rol: 'coordinador', label: 'Coordinador / Director', orden: 2 },
  { rol: 'contabilidad', label: 'Contabilidad', orden: 3 },
];

export function TiposSolicitudPanel() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [tipos, setTipos] = useState<TipoSolicitud[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [filtroArea, setFiltroArea] = useState<number | ''>('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [areaId, setAreaId] = useState<number | ''>('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [slug, setSlug] = useState('');
  const [activo, setActivo] = useState(true);
  const [orden, setOrden] = useState<number | ''>(0);
  const [campos, setCampos] = useState<CampoPlantilla[]>([]);
  const [dragCampoIdx, setDragCampoIdx] = useState<number | null>(null);
  const [flujo, setFlujo] = useState<PasoFlujo[]>(FLUJO_DEFAULT);

  const [areasParticipantes, setAreasParticipantes] = useState<number[]>([]);
  const [areaInicialId, setAreaInicialId] = useState<number | null>(null);
  const [areaFinalId, setAreaFinalId] = useState<number | null>(null);
  const [remision, setRemision] = useState<Record<string, number[]>>({});
  const [plantillaPdf, setPlantillaPdf] = useState<PlantillaPdf>(PLANTILLA_PDF_DEFAULT);
  const [usaPlantillaPdf, setUsaPlantillaPdf] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [a, t] = await Promise.all([
        api.get<Area[]>('/areas'),
        api.get<TipoSolicitud[]>('/tipos'),
      ]);
      setAreas(a.data);
      setTipos(t.data);
    } catch {
      setErr('No se pudo cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const areasActivas = useMemo(() => areas.filter((a) => a.activo), [areas]);
  const areasParticipantesArr = useMemo(
    () => areasActivas.filter((a) => areasParticipantes.includes(a.id)),
    [areasActivas, areasParticipantes],
  );

  // Orden de áreas para mostrar en el editor: inicial → … → final
  const ordenAreasNombres = useMemo(() => {
    const byId = new Map(areas.map((a) => [a.id, a.nombre]));
    const ids = [...areasParticipantes];
    ids.sort((a, b) => {
      if (a === areaInicialId) return -1;
      if (b === areaInicialId) return 1;
      if (a === areaFinalId) return 1;
      if (b === areaFinalId) return -1;
      return 0;
    });
    return ids.map((id) => byId.get(id) || `Área #${id}`);
  }, [areas, areasParticipantes, areaInicialId, areaFinalId]);

  // Sugerencias inteligentes según el título escrito en "Nombre del tipo".
  const sugerencia = useMemo(() => sugerirDesdeTitulo(nombre), [nombre]);
  const requisitosSugeridos = useMemo(() => {
    if (!sugerencia) return [] as string[];
    const labels: string[] = [];
    const vistos = new Set<string>();
    for (const id of sugerencia.conjuntos) {
      const conj = BLOQUES_PREDEFINIDOS.find((b) => b.id === id);
      if (!conj) continue;
      for (const c of conj.campos) {
        if (!vistos.has(c.key)) { vistos.add(c.key); labels.push(c.label); }
      }
    }
    return labels;
  }, [sugerencia]);

  function aplicarSugerencia(incluirPlantilla: boolean) {
    if (!sugerencia) return;
    if (!descripcion.trim()) setDescripcion(sugerencia.descripcion);
    setCampos((prev) => {
      const keys = new Set(prev.map((c) => c.key));
      const add: CampoPlantilla[] = [];
      for (const id of sugerencia.conjuntos) {
        const conj = BLOQUES_PREDEFINIDOS.find((b) => b.id === id);
        if (!conj) continue;
        for (const c of conj.campos) {
          if (!keys.has(c.key)) { keys.add(c.key); add.push(c); }
        }
      }
      return [...prev, ...add];
    });
    if (incluirPlantilla) {
      setPlantillaPdf({ bloques: inferirPlantillaPorNombre(nombre) });
      setUsaPlantillaPdf(true);
    }
    setErr('');
    setMsg('Sugerencia aplicada. Revisa los campos y la plantilla; puedes seguir editándolos manualmente abajo.');
  }

  function abrirEditor(t: TipoSolicitud | null) {
    setMsg('');
    setErr('');
    if (t) {
      setEditingId(t.id);
      setAreaId(t.areaId);
      setNombre(t.nombre);
      setDescripcion(t.descripcion ?? '');
      setSlug(t.slug);
      setActivo(t.activo);
      setOrden(t.orden);
      setCampos(t.camposPlantilla || []);
      setFlujo((t.flujoAprobacion || []).length > 0 ? t.flujoAprobacion : FLUJO_DEFAULT);
      const fa = t.flujoAreas;
      setAreasParticipantes(fa?.areasParticipantes || (t.areaId ? [t.areaId] : []));
      setAreaInicialId(fa?.areaInicialId ?? null);
      setAreaFinalId(fa?.areaFinalId ?? null);
      setRemision(fa?.remision || {});
      if (t.plantillaPdf) {
        setUsaPlantillaPdf(true);
        // Migrar plantillas viejas: asegurar pagina y src en logos
        const bloquesMig = (t.plantillaPdf.bloques || []).map((b) => {
          const next: PdfBloque = { ...b, pagina: b.pagina ?? 1 } as PdfBloque;
          if (next.tipo === 'logo' && !next.src) {
            return { ...next, src: '/logo-payops-dark.png' } as PdfBloque;
          }
          return next;
        });
        setPlantillaPdf({ bloques: bloquesMig });
      } else {
        const bloquesSugeridos = inferirPlantillaPorNombre(t.nombre);
        // Si existe plantilla inferida (viáticos, anticipo, cuenta cobro, etc.) mostrar el editor ya activo
        setUsaPlantillaPdf(bloquesSugeridos.length > 0);
        setPlantillaPdf({ bloques: bloquesSugeridos });
      }
    } else {
      setEditingId(null);
      setAreaId('');
      setNombre('');
      setDescripcion('');
      setSlug('');
      setActivo(true);
      setOrden(0);
      setCampos([]);
      setFlujo(FLUJO_DEFAULT);
      setAreasParticipantes([]);
      setAreaInicialId(null);
      setAreaFinalId(null);
      setRemision({});
      setUsaPlantillaPdf(false);
      setPlantillaPdf(PLANTILLA_PDF_DEFAULT);
    }
    setEditorOpen(true);
  }

  function cerrarEditor() {
    setEditorOpen(false);
  }

  function toggleAreaParticipante(id: number) {
    setAreasParticipantes((prev) => {
      const yaEsta = prev.includes(id);
      const next = yaEsta ? prev.filter((x) => x !== id) : [...prev, id];
      if (yaEsta) {
        if (areaInicialId === id) setAreaInicialId(null);
        if (areaFinalId === id) setAreaFinalId(null);
        setRemision((r) => {
          const copy = { ...r };
          delete copy[String(id)];
          for (const k of Object.keys(copy)) {
            copy[k] = copy[k].filter((x) => x !== id);
          }
          return copy;
        });
      }
      return next;
    });
  }

  function toggleRemision(origen: number, destino: number) {
    setRemision((prev) => {
      const lista = prev[String(origen)] || [];
      const tiene = lista.includes(destino);
      const next = tiene ? lista.filter((x) => x !== destino) : [...lista, destino];
      return { ...prev, [String(origen)]: next };
    });
  }

  function marcarTodaLaMatriz() {
    const ids = areasParticipantes;
    const next: Record<string, number[]> = {};
    for (const origen of ids) {
      next[String(origen)] = ids.filter((d) => d !== origen);
    }
    setRemision(next);
  }

  function limpiarMatriz() {
    setRemision({});
  }

  function agregarCampo() {
    setCampos((prev) => [...prev, { key: '', label: '', type: 'text', required: true, group: 'Datos personales' }]);
  }
  function actualizarCampo(idx: number, patch: Partial<CampoPlantilla>) {
    setCampos((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function eliminarCampo(idx: number) {
    setCampos((prev) => prev.filter((_, i) => i !== idx));
  }
  function moverCampo(from: number, to: number) {
    if (from === to) return;
    setCampos((prev) => {
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }
  function agregarPaso() {
    setFlujo((prev) => [...prev, { rol: '', label: '', orden: prev.length + 1 }]);
  }
  function actualizarPaso(idx: number, patch: Partial<PasoFlujo>) {
    setFlujo((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function eliminarPaso(idx: number) {
    setFlujo((prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, orden: i + 1 })));
  }

  async function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg(''); setErr('');
    if (!nombre.trim()) { setErr('Nombre es obligatorio.'); return; }
    if (areasParticipantes.length === 0) {
      setErr('Debes seleccionar al menos un área participante en el flujo.');
      return;
    }
    // Derivar areaId del area inicial o de la primera participante
    const areaIdResuelto = Number(areaId) > 0
      ? Number(areaId)
      : (areaInicialId ?? areasParticipantes[0]);

    const camposLimpios = campos
      .map((c) => ({ ...c, key: c.key.trim(), label: c.label.trim() }))
      .filter((c) => c.key && c.label);
    const flujoLimpio = flujo
      .map((p, i) => ({ rol: p.rol.trim(), label: p.label.trim(), orden: i + 1 }))
      .filter((p) => p.rol && p.label);

    const flujoAreas: FlujoAreas | null = areasParticipantes.length > 0 ? {
      areasParticipantes,
      areaInicialId,
      areaFinalId,
      remision,
    } : null;

    const payload = {
      areaId: areaIdResuelto,
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      slug: slug.trim() || undefined,
      activo,
      orden: typeof orden === 'number' ? orden : 0,
      camposPlantilla: camposLimpios,
      flujoAprobacion: flujoLimpio,
      flujoAreas,
      plantillaPdf: usaPlantillaPdf ? plantillaPdf : null,
    };
    try {
      if (editingId) {
        await api.patch(`/tipos/${editingId}`, payload);
        setMsg('Tipo actualizado.');
      } else {
        await api.post('/tipos', payload);
        setMsg('Tipo creado.');
      }
      cerrarEditor();
      cargar();
    } catch (e) {
      const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(r || 'No se pudo guardar el tipo.');
    }
  }

  async function eliminar(t: TipoSolicitud) {
    if (!window.confirm(`¿Eliminar el tipo "${t.nombre}"? Esta acción no se puede deshacer.`)) return;
    setMsg(''); setErr('');
    try {
      await api.delete(`/tipos/${t.id}`);
      setMsg(`Tipo "${t.nombre}" eliminado.`);
      cargar();
    } catch (e) {
      const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(r || 'No se pudo eliminar el tipo.');
    }
  }

  async function toggleActivo(t: TipoSolicitud) {
    setMsg(''); setErr('');
    try {
      await api.patch(`/tipos/${t.id}`, { activo: !t.activo });
      setMsg(`Tipo "${t.nombre}" ${t.activo ? 'desactivado' : 'activado'}.`);
      cargar();
    } catch (e) {
      const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(r || 'No se pudo actualizar.');
    }
  }

  const tiposFiltrados = useMemo(
    () => filtroArea ? tipos.filter((t) => t.areaId === filtroArea) : tipos,
    [tipos, filtroArea],
  );

  return (
    <section className="admin-tipos-panel">
      <div className="tipos-toolbar card-surface">
        <div>
          <h3>Tipos de solicitud</h3>
          <p className="admin-help-text">
            {loading ? 'Cargando…' : `${tipos.length} tipo(s) en el sistema.`}
          </p>
        </div>
        <div className="tipos-toolbar-actions">
          <select
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label="Filtrar por area"
          >
            <option value="">Todas las áreas</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <button type="button" className="admin-refresh-button" onClick={cargar}>Refrescar</button>
          <button type="button" className="admin-primary-button" onClick={() => abrirEditor(null)}>
            + Nuevo tipo
          </button>
        </div>
      </div>

      {msg ? <div className="admin-success">{msg}</div> : null}
      {err ? <div className="admin-error">{err}</div> : null}

      <div className="tipos-grid">
        {tiposFiltrados.length === 0 ? (
          <p className="admin-help-text">No hay tipos registrados.</p>
        ) : null}
        {tiposFiltrados.map((t) => (
          <article key={t.id} className="tipo-card card-surface">
            <div className="tipo-card-head">
              <div>
                <strong>{t.nombre}</strong>
                <p className="admin-help-text">{t.areaNombre}</p>
              </div>
              <span className={`status-pill ${t.activo ? 'on' : 'off'}`}>{t.activo ? 'Activo' : 'Inactivo'}</span>
            </div>
            {t.descripcion ? <p className="admin-help-text">{t.descripcion}</p> : null}
            <ul className="tipo-card-meta">
              <li>{t.camposPlantilla.length} campo(s)</li>
              <li>{(t.flujoAprobacion || []).length} nivel(es)</li>
              {t.flujoAreas?.areasParticipantes?.length ? (
                <li>{t.flujoAreas.areasParticipantes.length} área(s) en flujo</li>
              ) : null}
            </ul>
            <div className="tipo-card-actions">
              <button type="button" className="admin-ghost-button" onClick={() => abrirEditor(t)}>Editar</button>
              <button type="button" className="admin-ghost-button" onClick={() => toggleActivo(t)}>
                {t.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button type="button" className="admin-ghost-button admin-role-delete" onClick={() => eliminar(t)}>
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>

      {editorOpen ? (
        <div className="tipos-editor-overlay" role="dialog" aria-modal="true" aria-label="Editor de tipo de solicitud">
          <div className="tipos-editor card-surface">
            <header className="tipos-editor-head">
              <h3>{editingId ? 'Editar tipo de solicitud' : 'Crear tipo de solicitud'}</h3>
              <button type="button" className="admin-ghost-button" onClick={cerrarEditor}>✕ Cerrar</button>
            </header>

            <form className="tipos-editor-form" onSubmit={guardar}>
              {/* SECCIÓN 1: Datos generales */}
              <section className="tipos-editor-section">
                <h4>1. Datos generales</h4>
                <div className="admin-user-form-grid">
                  <div className="form-group">
                    <label htmlFor="t-nombre">Nombre del tipo *</label>
                    <input id="t-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Ej. Cuenta de cobro OPS" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="t-slug">Identificador (slug)</label>
                    <input id="t-slug" type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generado" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="t-orden">Orden</label>
                    <input id="t-orden" type="number" value={orden} onChange={(e) => setOrden(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="t-desc">Descripción</label>
                    <input id="t-desc" type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción visible al solicitante" />
                  </div>
                  {sugerencia && requisitosSugeridos.length > 0 ? (
                    <div className="form-group sugerencia-tipo" style={{ gridColumn: '1 / -1' }}>
                      <strong>💡 Sugerencia para «{nombre.trim()}»</strong>
                      <p className="admin-help-text" style={{ margin: '4px 0' }}>Normalmente este trámite requiere:</p>
                      <div className="sugerencia-chips">
                        {requisitosSugeridos.map((r) => (
                          <span key={r} className="sugerencia-chip">{r}</span>
                        ))}
                      </div>
                      <div className="admin-inline-actions" style={{ marginTop: 8 }}>
                        <button type="button" className="admin-primary-button" onClick={() => aplicarSugerencia(true)}>
                          ✨ Aplicar campos + plantilla
                        </button>
                        <button type="button" className="admin-ghost-button" onClick={() => aplicarSugerencia(false)}>
                          Solo agregar campos
                        </button>
                        {!descripcion.trim() ? (
                          <button type="button" className="admin-ghost-button" onClick={() => setDescripcion(sugerencia.descripcion)}>
                            Usar descripción sugerida
                          </button>
                        ) : null}
                      </div>
                      <small className="admin-help-text" style={{ display: 'block', marginTop: 6 }}>
                        Son sugerencias automáticas según el título. Puedes editarlas, quitarlas o seguir agregando datos manualmente.
                      </small>
                    </div>
                  ) : null}
                  <label className="ops-checkbox" style={{ alignSelf: 'end' }}>
                    <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activo
                  </label>
                </div>
                <p className="admin-help-text">
                  El tipo será visible para todas las áreas que selecciones como participantes en la siguiente sección.
                </p>
              </section>

              {/* SECCIÓN 2: Flujo de áreas (la novedad) */}
              <section className="tipos-editor-section tipos-editor-flujo-areas">
                <h4>2. Flujo de áreas</h4>
                <p className="admin-help-text">
                  Define qué áreas participan en este tipo, dónde inicia y termina, y qué remisiones están permitidas entre ellas.
                </p>

                <div className="form-group">
                  <label>Áreas participantes</label>
                  <div className="flujo-areas-chips">
                    {areasActivas.map((a) => {
                      const checked = areasParticipantes.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className={`flujo-area-chip${checked ? ' active' : ''}`}
                          onClick={() => toggleAreaParticipante(a.id)}
                        >
                          {checked ? '✓ ' : '+ '}{a.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {areasParticipantesArr.length > 0 ? (
                  <>
                    <div className="admin-user-form-grid">
                      <div className="form-group">
                        <label htmlFor="t-area-ini">Área inicial (recibe primero)</label>
                        <select id="t-area-ini" value={areaInicialId ?? ''} onChange={(e) => setAreaInicialId(e.target.value === '' ? null : Number(e.target.value))}>
                          <option value="">— selecciona —</option>
                          {areasParticipantesArr.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="t-area-fin">Área final (aprueba)</label>
                        <select id="t-area-fin" value={areaFinalId ?? ''} onChange={(e) => setAreaFinalId(e.target.value === '' ? null : Number(e.target.value))}>
                          <option value="">— selecciona —</option>
                          {areasParticipantesArr.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="flujo-matriz-wrap">
                      <div className="flujo-matriz-toolbar">
                        <p className="admin-help-text" style={{ margin: 0 }}>
                          Matriz de remisión: marca a qué áreas puede remitir cada una.
                        </p>
                        <div className="admin-inline-actions">
                          <button type="button" className="admin-ghost-button" onClick={marcarTodaLaMatriz}>
                            ✓ Marcar todas
                          </button>
                          <button type="button" className="admin-ghost-button" onClick={limpiarMatriz}>
                            ✕ Limpiar matriz
                          </button>
                        </div>
                      </div>
                      <table className="flujo-matriz">
                        <thead>
                          <tr>
                            <th></th>
                            {areasParticipantesArr.map((destino) => (
                              <th key={destino.id} title={destino.nombre}>{destino.nombre}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {areasParticipantesArr.map((origen) => (
                            <tr key={origen.id}>
                              <th scope="row">{origen.nombre}</th>
                              {areasParticipantesArr.map((destino) => {
                                if (origen.id === destino.id) {
                                  return <td key={destino.id} className="flujo-matriz-self">—</td>;
                                }
                                const permitido = (remision[String(origen.id)] || []).includes(destino.id);
                                return (
                                  <td key={destino.id}>
                                    <input
                                      type="checkbox"
                                      checked={permitido}
                                      onChange={() => toggleRemision(origen.id, destino.id)}
                                      aria-label={`Permitir remision de ${origen.nombre} a ${destino.nombre}`}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="admin-help-text">Selecciona al menos un área para configurar el flujo.</p>
                )}
              </section>

              {/* SECCIÓN 3: Campos */}
              <section className="tipos-editor-section">
                <header className="admin-panel-head">
                  <h4>3. Campos de la plantilla</h4>
                  <button type="button" className="admin-ghost-button" onClick={agregarCampo}>+ Agregar campo</button>
                </header>
                <p className="admin-help-text">
                  Datos que se piden al solicitante. En archivos, elige el documento esperado para que la IA valide automáticamente. Los conjuntos predefinidos (Datos personales, RUT, EPS, anexos…) ahora se insertan desde el editor de plantilla, sección 5.
                </p>
                {campos.length === 0 ? <p className="admin-help-text">Sin campos. Agrega al menos uno o usa los conjuntos predefinidos del editor de plantilla (sección 5).</p> : null}
                <div className="campos-modulos-lista">
                  {campos.map((c, idx) => (
                    <div
                      key={idx}
                      className={`campo-modulo-card${dragCampoIdx === idx ? ' dragging' : ''}`}
                      draggable
                      onDragStart={() => setDragCampoIdx(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragCampoIdx !== null) moverCampo(dragCampoIdx, idx);
                        setDragCampoIdx(null);
                      }}
                      onDragEnd={() => setDragCampoIdx(null)}
                    >
                      <div className="campo-modulo-drag" title="Arrastra para reordenar" aria-hidden="true">⠿</div>
                      <div className="campo-modulo-body">
                        <div className="campo-modulo-linea">
                          <input
                            className="campo-modulo-label"
                            type="text"
                            placeholder="Etiqueta visible (ej. Número de cuenta)"
                            value={c.label}
                            onChange={(e) => actualizarCampo(idx, { label: e.target.value })}
                          />
                          <select value={c.type} onChange={(e) => actualizarCampo(idx, { type: e.target.value as CampoPlantilla['type'] })}>
                            {TIPOS_CAMPO.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                          </select>
                        </div>
                        <div className="campo-modulo-linea campo-modulo-linea-sec">
                          <input type="text" placeholder="key (ej. numeroCuenta)" value={c.key} onChange={(e) => actualizarCampo(idx, { key: e.target.value })} />
                          <input type="text" placeholder="Grupo (ej. Cuenta bancaria)" value={c.group ?? ''} onChange={(e) => actualizarCampo(idx, { group: e.target.value })} />
                          {c.type === 'file' ? (
                            <select value={c.ocr_target ?? ''} onChange={(e) => actualizarCampo(idx, { ocr_target: e.target.value || undefined })}>
                              {OCR_TARGETS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                            </select>
                          ) : null}
                        </div>
                      </div>
                      <div className="campo-modulo-acciones">
                        <button
                          type="button"
                          className={`campo-req-toggle${c.required ? ' on' : ''}`}
                          onClick={() => actualizarCampo(idx, { required: !c.required })}
                          title="Cambiar entre obligatorio y opcional"
                        >
                          {c.required ? '● Obligatorio' : '○ Opcional'}
                        </button>
                        <button type="button" className="campo-modulo-del" onClick={() => eliminarCampo(idx)} title="Eliminar campo">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* SECCIÓN 4: Flujo de aprobación por niveles */}
              <section className="tipos-editor-section">
                <header className="admin-panel-head">
                  <h4>4. Flujo de aprobación por niveles</h4>
                  <button type="button" className="admin-ghost-button" onClick={agregarPaso}>+ Agregar paso</button>
                </header>
                <p className="admin-help-text">Niveles secuenciales que deben validar dentro de cada área.</p>
                {flujo.map((p, idx) => (
                  <div key={idx} className="admin-paso-row">
                    <span className="admin-paso-orden">{idx + 1}.</span>
                    <input type="text" placeholder="rol (analista, coordinador, contabilidad)" value={p.rol} onChange={(e) => actualizarPaso(idx, { rol: e.target.value })} />
                    <input type="text" placeholder="Etiqueta visible" value={p.label} onChange={(e) => actualizarPaso(idx, { label: e.target.value })} />
                    <button type="button" className="admin-ghost-button" onClick={() => eliminarPaso(idx)}>Eliminar</button>
                  </div>
                ))}
              </section>

              {/* SECCIÓN 5: Editor de plantilla PDF tipo Word (bloques) */}
              <section className="tipos-editor-section">
                <header className="admin-panel-head">
                  <div>
                    <h4>5. Diseñador del PDF de salida</h4>
                    <p className="admin-help-text">
                      Arma el PDF como en Word: agrega bloques (logo, títulos, párrafos, campos del formulario, tablas, firmas) y ordénalos como quieras. Cada bloque se renderiza arriba a abajo en el documento.
                    </p>
                  </div>
                  <label className="ops-checkbox">
                    <input type="checkbox" checked={usaPlantillaPdf} onChange={(e) => setUsaPlantillaPdf(e.target.checked)} /> Usar plantilla personalizada
                  </label>
                </header>
                {/* Aviso para tipos con PDF especial autogenerado */}
                {(() => {
                  const n = (slug || nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
                  const esEspecial = n === 'legalizacion' || n === 'viaticos' || n === 'anticipo';
                  if (!esEspecial) return null;
                  const labels: Record<string, string> = { legalizacion: 'legalización de gastos', viaticos: 'viáticos', anticipo: 'anticipo de gastos' };
                  return (
                    <div className="tipos-pdf-especial-aviso">
                      <span>⚡</span>
                      <div>
                        <strong>Este tipo usa un PDF especial autogenerado</strong>
                        <p>El PDF de <em>{labels[n]}</em> incluye tablas dinámicas (tiquetes, gastos, desglose económico) que el editor de bloques no puede representar. El diseñador de arriba aplica solo para tipos genéricos. El PDF real se genera automáticamente al descargar o previsualizar desde la bandeja.</p>
                      </div>
                    </div>
                  );
                })()}
                {usaPlantillaPdf ? (
                  <PlantillaPdfEditor
                    plantilla={plantillaPdf}
                    onChange={setPlantillaPdf}
                    campos={campos}
                    onCamposChange={setCampos}
                    ordenAreas={ordenAreasNombres}
                    onInsertarConjunto={(conjuntoId, pagina) => {
                      const conjunto = BLOQUES_PREDEFINIDOS.find((b) => b.id === conjuntoId);
                      if (!conjunto) return;
                      // 1) Agregar campos al state (evitando duplicados por key)
                      const keysExistentes = new Set(campos.map((c) => c.key));
                      const nuevos = conjunto.campos.filter((c) => !keysExistentes.has(c.key));
                      const camposFinales = [...campos, ...nuevos];
                      setCampos(camposFinales);
                      // 2) Agregar bloques visuales al PDF (incluso si los campos ya existían: solo se crean para los nuevos)
                      if (nuevos.length === 0) return;
                      const bloquesPag = (plantillaPdf.bloques || []).filter((b) => (b.pagina ?? 1) === pagina);
                      const maxBottom = bloquesPag.reduce((acc, b) => {
                        const h = b.tipo === 'encabezado' ? 30 : b.tipo === 'tabla' ? 36 : b.tipo === 'firma' ? 36 : b.tipo === 'logo' ? 18 : 10;
                        return Math.max(acc, b.y + h);
                      }, 18);
                      let yActual = Math.min(260, maxBottom + 6);
                      const tituloBloque: PdfBloque = {
                        id: nuevoId(),
                        pagina,
                        x: 18,
                        y: yActual,
                        w: 174,
                        tipo: 'titulo',
                        texto: conjunto.nombre.toUpperCase(),
                        alineacion: 'izquierda',
                        tamano: 12,
                        negrita: true,
                      };
                      yActual += 8;
                      const dividerBloque: PdfBloque = {
                        id: nuevoId(),
                        pagina,
                        x: 18,
                        y: yActual,
                        w: 174,
                        tipo: 'divider',
                      };
                      yActual += 4;
                      const camposBloques: PdfBloque[] = nuevos.map((c) => {
                        const yy = yActual;
                        yActual += 10;
                        if (c.type === 'file') {
                          return {
                            id: nuevoId(),
                            pagina,
                            x: 18,
                            y: yy,
                            w: 174,
                            tipo: 'campo',
                            campoKey: c.key,
                            etiqueta: `☐ ${c.label}:`,
                            alineacion: 'izquierda',
                          } as PdfBloque;
                        }
                        return {
                          id: nuevoId(),
                          pagina,
                          x: 18,
                          y: yy,
                          w: 174,
                          tipo: 'campo',
                          campoKey: c.key,
                          etiqueta: `${c.label}:`,
                          alineacion: 'izquierda',
                        } as PdfBloque;
                      });
                      setPlantillaPdf({
                        ...plantillaPdf,
                        bloques: [...(plantillaPdf.bloques || []), tituloBloque, dividerBloque, ...camposBloques],
                      });
                    }}
                  />
                ) : null}
              </section>

              <footer className="tipos-editor-footer">
                <button type="button" className="admin-ghost-button" onClick={cerrarEditor}>Cancelar</button>
                <button type="submit" className="admin-primary-button">
                  {editingId ? 'Guardar cambios' : 'Crear tipo'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ============================================================
   Editor de plantilla PDF por bloques (tipo Word)
   ============================================================ */
interface EditorProps {
  plantilla: PlantillaPdf;
  onChange: (next: PlantillaPdf) => void;
  campos: CampoPlantilla[];
  onCamposChange: (next: CampoPlantilla[]) => void;
  onInsertarConjunto: (conjuntoId: string, pagina: number) => void;
  ordenAreas?: string[];
}

function PlantillaPdfEditor({ plantilla, onChange, campos, onCamposChange, onInsertarConjunto, ordenAreas }: EditorProps) {
  const bloques = plantilla.bloques || [];

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [paginaActiva, setPaginaActiva] = useState(1);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [ocultarOverlap, setOcultarOverlap] = useState(false);
  const [previewFormOpen, setPreviewFormOpen] = useState(false);
  const [zoomDoc, setZoomDoc] = useState(1);
  const [vistaPreviaDatos, setVistaPreviaDatos] = useState(false);
  const [vistaCentro, setVistaCentro] = useState<'hoja' | 'formulario'>('hoja');
  const [arrastrando, setArrastrando] = useState(false);
  const [guias, setGuias] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const pageRef = useRef<HTMLDivElement | null>(null);

  const ZOOM_MIN = 0.4;
  const ZOOM_MAX = 1.8;
  function ajustarZoom(delta: number) {
    setZoomDoc((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)));
  }

  useEffect(() => {
    if (!pantallaCompleta) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [pantallaCompleta]);

  const totalPaginas = useMemo(
    () => Math.max(1, ...bloques.map((b) => b.pagina ?? 1)),
    [bloques],
  );

  function insertarPlaceholder(token: string) {
    if (!seleccionadoId) return;
    const b = bloques.find((x) => x.id === seleccionadoId);
    if (!b) return;
    if (b.tipo === 'texto' || b.tipo === 'titulo') {
      actualizar(b.id, { texto: (b.texto || '') + ' ' + token } as Partial<PdfBloque>);
    } else if (b.tipo === 'campo') {
      actualizar(b.id, { etiqueta: (b.etiqueta || '') + ' ' + token } as Partial<PdfBloque>);
    }
  }

  // Valores de ejemplo para la vista previa "con datos" (cómo se vería diligenciado)
  function ejemploCampoValor(key: string): string {
    switch (key) {
      case '__nombre': return 'Juan Pérez García';
      case '__cedula': return '1.020.456.789';
      case '__correo': return 'juan.perez@ejemplo.com';
      case '__radicado': return 'X2026-CO0001';
      case '__fecha': return new Date().toLocaleDateString('es-CO');
      case '__ciudad': return 'Bogotá D.C.';
    }
    const c = campos.find((x) => x.key === key);
    if (!c) return 'Ejemplo';
    switch (c.type) {
      case 'valor-pesos':
      case 'number': return '1.500.000';
      case 'email': return 'correo@ejemplo.com';
      case 'date': return new Date().toLocaleDateString('es-CO');
      case 'mes-anio': return 'mayo 2026';
      case 'cc':
      case 'nit': return '1.020.456.789';
      case 'tipo-doc': return 'CC';
      case 'banco-select': return 'Bancolombia';
      case 'cuenta-bancaria': return '0123456789';
      case 'direccion': return 'Carrera 7 #74-21, Bogotá';
      case 'select': return 'Opción seleccionada';
      case 'textarea': return 'Texto diligenciado por el solicitante.';
      case 'persona': return 'Camilo Restrepo';
      case 'calculado': {
        const vals = (c.operandos || []).map((k) => parseNumeroEditor(ejemploCampoValor(k)));
        const r = calcularOperacion(vals, c.operacion || 'suma');
        return r.toLocaleString('es-CO');
      }
      default: return c.label;
    }
  }
  function aplicarEjemploTokens(texto: string): string {
    const map: Record<string, string> = {
      radicado: 'X2026-CO0001', nombre: 'Juan Pérez García', cedula: '1.020.456.789',
      correo: 'juan.perez@ejemplo.com', ciudad: 'Bogotá D.C.', fecha: new Date().toLocaleDateString('es-CO'),
      valor: '$1.500.000', valorLetras: 'un millón quinientos mil pesos m/cte', concepto: 'Servicios profesionales',
    };
    return texto.replace(/\{\{(\w+)\}\}/g, (m, k) => {
      if (map[k] != null) return map[k];
      if (campos.some((c) => c.key === k)) return ejemploCampoValor(k);
      return m;
    });
  }

  // El formulario se arma con los Datos definidos + los campos que ya están
  // colocados en la hoja (bloques tipo "campo"), para que el simulador refleje
  // la plantilla aunque no se hayan agregado datos manualmente.
  function adivinarTipoCampo(key: string): CampoPlantilla['type'] {
    const k = key.toLowerCase();
    if (k.startsWith('doc')) return 'file';
    if (k.includes('valor') || k.includes('monto') || k.includes('suma')) return 'valor-pesos';
    if (k.includes('fecha')) return 'date';
    if (k.includes('correo') || k.includes('email')) return 'email';
    if (k.includes('banco')) return 'banco-select';
    if (k.includes('cuenta')) return 'cuenta-bancaria';
    if (k.includes('concepto') || k.includes('observ') || k.includes('descrip')) return 'textarea';
    if (k.includes('direccion') || k.includes('destino')) return 'direccion';
    return 'text';
  }
  // Tokens {{...}} que el solicitante diligencia (los demás son automáticos)
  const TOKEN_CAMPOS: Record<string, { key: string; label: string; type: CampoPlantilla['type'] }> = {
    valor: { key: 'valorPesos', label: 'Valor a cobrar', type: 'valor-pesos' },
    concepto: { key: 'observaciones', label: 'Concepto / observaciones', type: 'textarea' },
    ciudad: { key: 'ciudad', label: 'Ciudad', type: 'text' },
  };
  function camposDelFormulario(): CampoPlantilla[] {
    const vistos = new Set(campos.map((c) => c.key));
    const extra: CampoPlantilla[] = [];
    for (const b of (plantilla.bloques || [])) {
      // 1) bloques tipo "campo"
      if (b.tipo === 'campo' && b.campoKey && !b.campoKey.startsWith('__') && !vistos.has(b.campoKey)) {
        vistos.add(b.campoKey);
        extra.push({
          key: b.campoKey,
          label: (b.etiqueta || b.campoKey).replace(/[:]\s*$/, '').replace(/^[•☐]\s*/, '').trim() || b.campoKey,
          type: adivinarTipoCampo(b.campoKey),
          required: true,
          group: 'Datos del formato',
        });
      }
      // 2) tokens {{valor}}, {{concepto}}, etc. dentro de textos/títulos
      if ((b.tipo === 'texto' || b.tipo === 'titulo') && b.texto) {
        const re = /\{\{(\w+)\}\}/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(b.texto)) !== null) {
          const def = TOKEN_CAMPOS[m[1]];
          if (def && !vistos.has(def.key)) {
            vistos.add(def.key);
            extra.push({ ...def, required: true, group: 'Datos del formato' });
          }
        }
      }
    }
    return [...campos, ...extra];
  }

  // Escala mm → pixeles (A4 = 210x297 mm). Base × zoom del editor (no del navegador).
  const SCALE_BASE = 2.6; // ~ A4 = 546 × 772 px a 100%
  const SCALE = SCALE_BASE * zoomDoc;

  function setBloques(next: PdfBloque[]) {
    onChange({ ...plantilla, bloques: next });
  }
  function agregar(b: PdfBloque) {
    const conPagina = { ...b, pagina: (b.pagina ?? paginaActiva) } as PdfBloque;
    setBloques([...bloques, conPagina]);
    setSeleccionadoId(b.id);
  }
  function actualizar(id: string, patch: Partial<PdfBloque>) {
    setBloques(bloques.map((b) => (b.id === id ? ({ ...b, ...patch } as PdfBloque) : b)));
  }
  function eliminar(id: string) {
    setBloques(bloques.filter((b) => b.id !== id));
    if (seleccionadoId === id) setSeleccionadoId(null);
  }

  function eliminarPagina(pagina: number) {
    if (pagina <= 1) return;
    const cantBloques = bloques.filter((b) => (b.pagina ?? 1) === pagina).length;
    const msg = cantBloques > 0
      ? `¿Eliminar la página ${pagina}? Se borrarán ${cantBloques} bloque(s) y las páginas posteriores se reorganizarán.`
      : `¿Eliminar la página ${pagina}?`;
    if (!window.confirm(msg)) return;
    // Quita bloques de esa página y compacta el número de página de las posteriores
    const next = bloques
      .filter((b) => (b.pagina ?? 1) !== pagina)
      .map((b) => {
        const p = b.pagina ?? 1;
        return p > pagina ? ({ ...b, pagina: p - 1 } as PdfBloque) : b;
      });
    setBloques(next);
    if (paginaActiva === pagina) setPaginaActiva(Math.max(1, pagina - 1));
    else if (paginaActiva > pagina) setPaginaActiva(paginaActiva - 1);
  }

  const camposDisponibles = [
    { key: '__radicado', label: 'Número de radicado' },
    { key: '__nombre', label: 'Nombre del solicitante' },
    { key: '__cedula', label: 'Cédula del solicitante' },
    { key: '__correo', label: 'Correo del solicitante' },
    { key: '__fecha', label: 'Fecha actual' },
    { key: '__ciudad', label: 'Ciudad' },
    ...campos.filter((c) => c.key && c.type !== 'texto-fijo').map((c) => ({ key: c.key, label: c.label })),
  ];

  // --- Gestión de campos desde las columnas izq (datos) y der (documentos) ---
  const datosIdx = campos.map((c, idx) => ({ c, idx })).filter((x) => x.c.type !== 'file');
  const docsIdx = campos.map((c, idx) => ({ c, idx })).filter((x) => x.c.type === 'file');

  function patchCampoIdx(idx: number, patch: Partial<CampoPlantilla>) {
    onCamposChange(campos.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function eliminarCampoIdx(idx: number) {
    onCamposChange(campos.filter((_, i) => i !== idx));
  }
  function keyUnica(base: string): string {
    const existentes = new Set(campos.map((c) => c.key));
    let i = 1;
    let k = `${base}${i}`;
    while (existentes.has(k)) { i++; k = `${base}${i}`; }
    return k;
  }
  function agregarDato() {
    onCamposChange([...campos, { key: keyUnica('dato'), label: 'Nuevo dato', type: 'text', required: true, group: 'Datos' }]);
  }
  function agregarDocumentoPredef(d: { key: string; label: string; ocr_target: string }) {
    if (campos.some((c) => c.key === d.key)) return; // ya existe, no duplicar
    onCamposChange([...campos, { key: d.key, label: d.label, type: 'file', required: true, group: 'Documentos', ocr_target: d.ocr_target }]);
  }
  function agregarDocumentoCustom() {
    onCamposChange([...campos, { key: keyUnica('doc'), label: 'Nuevo adjunto', type: 'file', required: true, group: 'Documentos' }]);
  }

  // Posición inicial para nuevo bloque: busca un Y libre debajo del último bloque de la página activa
  function nuevaPos(): { x: number; y: number; w: number } {
    const bloquesPag = bloques.filter((b) => (b.pagina ?? 1) === paginaActiva);
    if (bloquesPag.length === 0) return { x: 18, y: 30, w: 174 };
    const maxBottom = bloquesPag.reduce((acc, b) => {
      const h = b.tipo === 'encabezado' ? 30 : b.tipo === 'tabla' ? 36 : b.tipo === 'firma' ? 36 : b.tipo === 'logo' ? 18 : 10;
      return Math.max(acc, b.y + h);
    }, 0);
    const nextY = Math.min(280, maxBottom + 4);
    return { x: 18, y: nextY, w: 174 };
  }

  // Bloques que se superponen: aproximación con bounding box rectangular
  function alturaEstimada(b: PdfBloque): number {
    if (b.tipo === 'encabezado') return 30;
    if (b.tipo === 'tabla') return 36;
    if (b.tipo === 'firma') return 36;
    if (b.tipo === 'logo') return 18;
    if (b.tipo === 'titulo') return Math.max(6, b.tamano * 0.5);
    if (b.tipo === 'texto') return Math.max(5, b.tamano * 0.5);
    if (b.tipo === 'divider') return 2;
    return 8;
  }
  const idsSuperpuestos = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < bloques.length; i++) {
      const a = bloques[i];
      const ah = alturaEstimada(a);
      for (let j = i + 1; j < bloques.length; j++) {
        const b = bloques[j];
        const bh = alturaEstimada(b);
        const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
        const overlapY = a.y < b.y + bh && a.y + ah > b.y;
        if (overlapX && overlapY) {
          set.add(a.id);
          set.add(b.id);
        }
      }
    }
    return set;
  }, [bloques]);

  // Detecta los campos/adjuntos que la hoja referencia pero que aún no existen
  // como "Dato" o "Documento", para crearlos y dejar todo conectado.
  function camposFaltantesDeHoja(bloquesActuales: PdfBloque[]): CampoPlantilla[] {
    const existentes = new Set(campos.map((c) => c.key));
    const nuevos: CampoPlantilla[] = [];
    const limpiar = (s: string) => s.replace(/[:•☐]/g, '').trim();
    const agregar = (key: string, etiqueta: string, tipo?: CampoPlantilla['type']) => {
      if (!key || key.startsWith('__') || existentes.has(key)) return;
      existentes.add(key);
      const pre = DOCUMENTOS_PREDEFINIDOS.find((d) => d.key === key);
      if (pre) {
        nuevos.push({ key, label: pre.label, type: 'file', required: true, group: 'Documentos a adjuntar', ocr_target: pre.ocr_target });
      } else if (key.toLowerCase().startsWith('doc')) {
        nuevos.push({ key, label: limpiar(etiqueta) || key, type: 'file', required: false, group: 'Documentos a adjuntar' });
      } else {
        nuevos.push({ key, label: limpiar(etiqueta) || key, type: tipo || adivinarTipoCampo(key), required: true, group: 'Datos del formato' });
      }
    };
    for (const b of bloquesActuales) {
      if (b.tipo === 'campo' && b.campoKey) agregar(b.campoKey, b.etiqueta || b.campoKey);
      if ((b.tipo === 'texto' || b.tipo === 'titulo') && b.texto) {
        const re = /\{\{(\w+)\}\}/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(b.texto)) !== null) {
          const def = TOKEN_CAMPOS[m[1]];
          if (def) agregar(def.key, def.label, def.type);
        }
      }
    }
    return nuevos;
  }

  function conectarCamposDeHoja() {
    const faltan = camposFaltantesDeHoja(bloques);
    if (faltan.length === 0) {
      window.alert('Todos los campos de la hoja ya están conectados.');
      return;
    }
    onCamposChange([...campos, ...faltan]);
    window.alert(`Se conectaron ${faltan.length} campo(s)/adjunto(s) que estaban en la hoja. Revisa la columna de datos y adjuntos.`);
  }

  function cargarEjemplo(id: string) {
    const ej = PLANTILLAS_EJEMPLO.find((p) => p.id === id);
    if (!ej) return;
    if (bloques.length > 0 && !window.confirm('Esto reemplaza la plantilla actual con un ejemplo. ¿Continuar?')) return;
    const nuevosBloques = ej.build();
    setBloques(nuevosBloques);
    const faltan = camposFaltantesDeHoja(nuevosBloques);
    if (faltan.length > 0) onCamposChange([...campos, ...faltan]);
    setSeleccionadoId(null);
  }

  // Márgenes de la hoja (mm) usados como guías fijas, estilo regla de Word/Canva
  const MARGEN_IZQ = 18;
  const MARGEN_DER = 210 - 18; // 192
  const CENTRO_HOJA = 105;
  const MARGEN_SUP = 14;
  const SNAP_MM = 1.8; // umbral de imantado (~5px a 100%)

  // Calcula posición imantada a los márgenes, al centro de la hoja y a los
  // bordes/centros de los demás bloques. Devuelve también las líneas-guía a pintar.
  function calcularSnap(nx: number, ny: number, w: number, id: string, pagina: number) {
    const otros = bloques.filter((o) => o.id !== id && (o.pagina ?? 1) === pagina);

    // Objetivos verticales (eje X): márgenes, centro y bordes de otros bloques
    const objX: number[] = [MARGEN_IZQ, CENTRO_HOJA, MARGEN_DER];
    for (const o of otros) {
      const ow = o.w || 100;
      objX.push(o.x, o.x + ow / 2, o.x + ow);
    }
    // Bordes del bloque arrastrado: izquierdo, centro y derecho
    const bordesX = [{ e: nx, off: 0 }, { e: nx + w / 2, off: w / 2 }, { e: nx + w, off: w }];
    let mejorX: { delta: number; linea: number } | null = null;
    for (const { e } of bordesX) {
      for (const t of objX) {
        const d = t - e;
        if (Math.abs(d) <= SNAP_MM && (!mejorX || Math.abs(d) < Math.abs(mejorX.delta))) {
          mejorX = { delta: d, linea: t };
        }
      }
    }

    // Objetivos horizontales (eje Y): margen superior y top de otros bloques
    const objY: number[] = [MARGEN_SUP];
    for (const o of otros) objY.push(o.y);
    let mejorY: { delta: number; linea: number } | null = null;
    for (const t of objY) {
      const d = t - ny;
      if (Math.abs(d) <= SNAP_MM && (!mejorY || Math.abs(d) < Math.abs(mejorY.delta))) {
        mejorY = { delta: d, linea: t };
      }
    }

    return {
      x: mejorX ? nx + mejorX.delta : nx,
      y: mejorY ? ny + mejorY.delta : ny,
      guias: { x: mejorX ? [mejorX.linea] : [], y: mejorY ? [mejorY.linea] : [] },
    };
  }

  // Drag handling
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    const target = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const b = bloques.find((x) => x.id === id);
    if (!b) return;
    const startBx = b.x;
    const startBy = b.y;
    const w = b.w || 100;
    const pagina = b.pagina ?? 1;
    setSeleccionadoId(id);
    setArrastrando(true);
    target.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const dxMm = (ev.clientX - startX) / SCALE;
      const dyMm = (ev.clientY - startY) / SCALE;
      let nx = Math.max(0, Math.min(210, startBx + dxMm));
      let ny = Math.max(0, Math.min(297, startBy + dyMm));
      // Imantado inteligente (se desactiva manteniendo Alt, como en Canva/Figma)
      if (!ev.altKey) {
        const snap = calcularSnap(nx, ny, w, id, pagina);
        nx = snap.x;
        ny = snap.y;
        setGuias(snap.guias);
      } else {
        setGuias({ x: [], y: [] });
      }
      actualizar(id, { x: Math.round(nx), y: Math.round(ny) } as Partial<PdfBloque>);
    };
    const up = (ev: PointerEvent) => {
      try { target.releasePointerCapture(ev.pointerId); } catch { /* ignorar */ }
      setArrastrando(false);
      setGuias({ x: [], y: [] });
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Redimensionar como en Word: 'e' = lado derecho (ancho), 'se' = esquina (ancho + alto/tamaño)
  function onResize(e: React.PointerEvent<HTMLSpanElement>, id: string, dir: 'e' | 'se') {
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const b = bloques.find((x) => x.id === id);
    if (!b) return;
    const startW = b.w || 100;
    const bb = b as unknown as { alto?: number; tamano?: number; ancho?: number };
    const startAlto = bb.alto ?? 0;
    const startTamano = bb.tamano ?? 0;
    const startAncho = bb.ancho ?? 0;
    const bx = b.x;
    const pagina = b.pagina ?? 1;
    setSeleccionadoId(id);
    setArrastrando(true);
    target.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const dxMm = (ev.clientX - startX) / SCALE;
      const dyMm = (ev.clientY - startY) / SCALE;
      let nuevoW = Math.max(10, Math.min(210 - bx, startW + dxMm));
      // Imantar el borde derecho a márgenes / centro / bordes de otros bloques
      if (!ev.altKey) {
        const otros = bloques.filter((o) => o.id !== id && (o.pagina ?? 1) === pagina);
        const objX: number[] = [MARGEN_IZQ, CENTRO_HOJA, MARGEN_DER];
        for (const o of otros) { const ow = o.w || 100; objX.push(o.x, o.x + ow / 2, o.x + ow); }
        const borde = bx + nuevoW;
        let mejor: { delta: number; linea: number } | null = null;
        for (const t of objX) {
          const d = t - borde;
          if (Math.abs(d) <= SNAP_MM && (!mejor || Math.abs(d) < Math.abs(mejor.delta))) mejor = { delta: d, linea: t };
        }
        if (mejor) { nuevoW += mejor.delta; setGuias({ x: [mejor.linea], y: [] }); }
        else setGuias({ x: [], y: [] });
      }
      const patch: Record<string, number> = { w: Math.max(10, Math.round(nuevoW)) };
      if (dir === 'se') {
        if (b.tipo === 'caja') patch.alto = Math.max(5, Math.round(startAlto + dyMm));
        else if (b.tipo === 'qr-radicado') { const t = Math.max(15, Math.round(startTamano + dyMm)); patch.tamano = t; }
        else if (b.tipo === 'logo') patch.ancho = Math.max(10, Math.round(startAncho + dxMm));
        else if (b.tipo === 'titulo' || b.tipo === 'texto') patch.tamano = Math.max(7, Math.min(40, Math.round(startTamano + dyMm / 2)));
      }
      actualizar(id, patch as Partial<PdfBloque>);
    };
    const up = (ev: PointerEvent) => {
      try { target.releasePointerCapture(ev.pointerId); } catch { /* ignorar */ }
      setArrastrando(false);
      setGuias({ x: [], y: [] });
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const sel = bloques.find((b) => b.id === seleccionadoId) || null;

  const editorContent = (
    <div className={`plantilla-editor${pantallaCompleta ? ' plantilla-editor-fullscreen' : ''}`}>
      {pantallaCompleta ? (
        <div className="plantilla-fullscreen-bar">
          <strong>Editor de plantilla · Pantalla completa</strong>
          <button type="button" className="admin-ghost-button" onClick={() => setPantallaCompleta(false)}>
            ✕ Salir de pantalla completa
          </button>
        </div>
      ) : (
        <div className="plantilla-fullscreen-toggle">
          <button type="button" className="admin-primary-button" onClick={() => setPantallaCompleta(true)}>
            ⛶ Editar en pantalla completa (estilo Word)
          </button>
        </div>
      )}
      <div className="plantilla-paleta">
        <span className="admin-help-text"><strong>Cargar ejemplo:</strong></span>
        <select
          className="plantilla-ejemplo-select"
          value=""
          onChange={(e) => { if (e.target.value) { cargarEjemplo(e.target.value); e.target.value = ''; } }}
        >
          <option value="">— escoge un ejemplo —</option>
          {PLANTILLAS_EJEMPLO.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <button
          type="button"
          className="bloque-rapido-btn"
          title="Crea automáticamente los datos y adjuntos que están en la hoja pero aún no aparecen en las columnas (conecta todo)."
          onClick={conectarCamposDeHoja}
        >
          🔗 Conectar campos de la hoja
        </button>
        <span className="plantilla-preview-sep" />
        <button
          type="button"
          className="bloque-rapido-btn plantilla-preview-btn"
          title="Descarga el PDF con datos de ejemplo — así lo verá el solicitante"
          onClick={() => descargarPreviewPlantilla(plantilla, campos, 'ejemplo')}
        >
          👁️ Cómo se ve el formulario
        </button>
        <button
          type="button"
          className="bloque-rapido-btn plantilla-preview-btn"
          title="Descarga el PDF en blanco, listo para diligenciar"
          onClick={() => descargarPreviewPlantilla(plantilla, campos, 'vacia')}
        >
          📥 Descargar en blanco
        </button>
        <button
          type="button"
          className="bloque-rapido-btn plantilla-preview-btn"
          title="Vista previa del formulario tal como lo verá el solicitante"
          onClick={() => setPreviewFormOpen(true)}
        >
          📝 Cómo se ve el formulario
        </button>
        <span className="admin-help-text" style={{ marginLeft: 8 }}><strong>Agregar bloque:</strong> <span style={{ fontWeight: 400 }}>(pasa el mouse para ver qué hace cada uno)</span></span>
        <button type="button" className="bloque-rapido-btn" title="Encabezado oficial: recuadro con logo, título del formato y Código/Fecha/Versión/Página (como en los formatos de Goleman)." onClick={() => { agregar({ id: nuevoId(), x: 18, y: 12, w: 174, tipo: 'encabezado', titulo: 'NOMBRE DEL FORMATO', subtitulo: 'DIRECCION FINANCIERA', area: 'CONTABILIDAD', codigo: 'DF-CON-FR-000', fecha: new Date().toLocaleDateString('es-CO'), version: '1', paginaTexto: '1 de 1', src: '/logo-payops-dark.png' }); }}>▤ Encabezado</button>
        <button type="button" className="bloque-rapido-btn" title="Inserta el logo de Goleman IPS. Puedes cambiar la imagen y la alineación en el panel derecho." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, w: 40, tipo: 'logo', alineacion: 'izquierda', ancho: 36, src: '/logo-payops-dark.png' }); }}>🏷️ Logo</button>
        <button type="button" className="bloque-rapido-btn" title="Texto grande de encabezado (ej. el nombre del documento). Configura tamaño y negrita." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, tipo: 'titulo', texto: 'Nuevo título', alineacion: 'centro', tamano: 14, negrita: true }); }}>🅷 Título</button>
        <button type="button" className="bloque-rapido-btn" title="Párrafo de texto normal. Admite variables como {{nombre}}, {{fecha}}, {{valor}}." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, tipo: 'texto', texto: 'Texto del documento', alineacion: 'izquierda', tamano: 11 }); }}>📝 Texto</button>
        <button type="button" className="bloque-rapido-btn" title="Muestra el valor de un campo del formulario (ej. Número de cuenta) con su etiqueta." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, tipo: 'campo', campoKey: camposDisponibles[0]?.key || '__nombre', etiqueta: 'Campo:', alineacion: 'izquierda' }); }}>🔗 Campo</button>
        <button type="button" className="bloque-rapido-btn" title="Tabla con columnas (ej. Fecha / Ítem / Valor) para detallar conceptos." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, w: 170, tipo: 'tabla', columnas: ['FECHA', 'ITEM', 'VALOR'] }); }}>▦ Tabla</button>
        <button type="button" className="bloque-rapido-btn" title="Línea horizontal para separar secciones del documento." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, w: 170, tipo: 'divider' }); }}>─ Línea</button>
        <button type="button" className="bloque-rapido-btn" title="Espacio de firma con línea y etiqueta (solicitante, coordinador o área final)." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, w: 70, tipo: 'firma', etiqueta: 'Firma', campoFirma: 'profesional' }); }}>✍ Firma</button>
        <button type="button" className="bloque-rapido-btn" title="Recuadro vacío o relleno para resaltar o dejar un espacio en blanco." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, w: 80, tipo: 'caja', alto: 30, relleno: false, etiqueta: '' }); }}>▭ Caja</button>
        <button type="button" className="bloque-rapido-btn" title="Inserta una imagen desde una URL (sello, foto, gráfico…)." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, w: 60, tipo: 'imagen', src: '' }); }}>🖼️ Imagen</button>
        <button type="button" className="bloque-rapido-btn" title="Lista de puntos (con o sin viñetas), ej. requisitos o documentos." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, w: 120, tipo: 'lista', items: ['Item 1', 'Item 2', 'Item 3'], conVinetas: true }); }}>☰ Lista</button>
        <button type="button" className="bloque-rapido-btn" title="Doble línea dorada decorativa para separar secciones." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, w: 170, tipo: 'separador-doble' }); }}>═ Doble línea</button>
        <button type="button" className="bloque-rapido-btn" title="Código QR que codifica automáticamente el número de radicado de la solicitud." onClick={() => { const p = nuevaPos(); agregar({ id: nuevoId(), ...p, w: 30, tipo: 'qr-radicado', tamano: 30 }); }}>▣ QR Radicado</button>
      </div>

      {idsSuperpuestos.size > 0 && !ocultarOverlap ? (
        <div className="plantilla-overlap-aviso">
          <span>⚠ {idsSuperpuestos.size} bloque(s) cercanos. Puedes seguir editando.</span>
          <button type="button" className="admin-ghost-button" onClick={() => setOcultarOverlap(true)}>✕ Ocultar</button>
        </div>
      ) : null}

      <div className="plantilla-tip">
        <span>👆 Toma un bloque del documento y arrástralo a donde quieras. Click para editarlo.</span>
      </div>

      {/* Selector de página (multi-página) */}
      <div className="plantilla-paginas-nav">
        {[1, 2, 3, 4, 5].filter((p) => p === 1 || bloques.some((b) => (b.pagina ?? 1) === p) || p === paginaActiva).map((p) => {
          const cantBloques = bloques.filter((b) => (b.pagina ?? 1) === p).length;
          return (
            <div key={p} className={`plantilla-pagina-tab-wrap${p === paginaActiva ? ' active' : ''}`}>
              <button
                type="button"
                className={`plantilla-pagina-tab${p === paginaActiva ? ' active' : ''}`}
                onClick={() => setPaginaActiva(p)}
              >
                Página {p}{cantBloques === 0 && p > 1 ? ' (vacía)' : cantBloques > 0 ? ` · ${cantBloques}` : ''}
              </button>
              {p > 1 ? (
                <button
                  type="button"
                  className="plantilla-pagina-delete"
                  title={`Eliminar página ${p}`}
                  onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    eliminarPagina(p);
                  }}
                >
                  ✕
                </button>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          className="plantilla-pagina-add"
          onClick={() => setPaginaActiva(Math.min(5, totalPaginas + 1))}
        >
          + Agregar página
        </button>
      </div>

      {/* Chips clickeables de placeholders */}
      {sel && (sel.tipo === 'texto' || sel.tipo === 'titulo' || sel.tipo === 'campo') ? (
        <div className="plantilla-placeholders-bar">
          <span className="admin-help-text">Insertar en el bloque seleccionado:</span>
          {[
            { key: 'radicado', label: 'N° Radicado' },
            { key: 'nombre', label: 'Nombre' },
            { key: 'cedula', label: 'Cédula' },
            { key: 'correo', label: 'Correo' },
            { key: 'ciudad', label: 'Ciudad' },
            { key: 'fecha', label: 'Fecha' },
            { key: 'valor', label: 'Valor $' },
            { key: 'valorLetras', label: 'Valor en letras' },
            { key: 'concepto', label: 'Concepto' },
          ].map((p) => (
            <button
              key={p.key}
              type="button"
              className="plantilla-placeholder-chip"
              onClick={() => insertarPlaceholder(`{{${p.key}}}`)}
            >
              + {p.label}
            </button>
          ))}
          {datosIdx.length > 0 ? (
            <>
              <span className="plantilla-zoom-sep" />
              <span className="admin-help-text">Tus datos:</span>
              {datosIdx.map(({ c }) => (
                <button
                  key={c.key}
                  type="button"
                  className="plantilla-placeholder-chip"
                  title={`Inserta el valor de "${c.label}" diligenciado por el solicitante`}
                  onClick={() => insertarPlaceholder(`{{${c.key}}}`)}
                >
                  + {c.label}
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      <div className="plantilla-3col">
        {/* IZQUIERDA: datos que llena el solicitante */}
        <div className="plantilla-col-datos">
          <div className="plantilla-col-head">
            <strong>🧾 Campos del formulario</strong>
            <button type="button" className="admin-ghost-button" onClick={agregarDato}>+ Campo</button>
          </div>
          <p className="admin-help-text">Lo que la persona va a llenar. Define la <strong>etiqueta</strong> y el <strong>tipo</strong>, y con <strong>↘</strong> lo colocas en la hoja. El check <span style={{ color: '#16a34a' }}>✓</span> indica que ya está en el documento.</p>
          {datosIdx.length === 0 ? <p className="admin-help-text">Sin campos aún. Agrega uno con “+ Campo”.</p> : null}
          {datosIdx.map(({ c, idx }) => {
            const enHoja = !!c.key && bloques.some((b) => b.tipo === 'campo' && b.campoKey === c.key);
            return (
            <div key={idx} className={`plantilla-campo-item${enHoja ? ' en-hoja' : ''}`}>
              <div className="plantilla-campo-item-row">
                <span className="plantilla-campo-estado" title={enHoja ? 'Ya está en la hoja' : 'Aún no está en la hoja'}>{enHoja ? '✓' : '○'}</span>
                <input
                  className="plantilla-campo-item-label"
                  type="text"
                  value={c.label}
                  placeholder="Etiqueta (ej. Nombre)"
                  onChange={(e) => patchCampoIdx(idx, { label: e.target.value })}
                />
                <button
                  type="button"
                  className="plantilla-campo-insertar"
                  title={enHoja ? 'Colocar otra vez en la hoja activa' : 'Colocar este campo en la hoja activa'}
                  onClick={() => { const pos = nuevaPos(); agregar({ id: nuevoId(), ...pos, tipo: 'campo', campoKey: c.key, etiqueta: `${c.label}:`, alineacion: 'izquierda' }); }}
                >↘</button>
                <button type="button" className="campo-modulo-del" title="Eliminar campo" onClick={() => eliminarCampoIdx(idx)}>🗑</button>
              </div>
              <div className="plantilla-campo-item-row">
                <select value={c.type} onChange={(e) => patchCampoIdx(idx, { type: e.target.value as CampoPlantilla['type'] })}>
                  {TIPOS_CAMPO.filter((t) => t.v !== 'file').map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
                <button
                  type="button"
                  className={`campo-req-toggle${c.required ? ' on' : ''}`}
                  onClick={() => patchCampoIdx(idx, { required: !c.required })}
                >{c.required ? '● Obligatorio' : '○ Opcional'}</button>
              </div>
              {campos.some((x) => x.type === 'file') && c.type !== 'file' && c.type !== 'calculado' && c.type !== 'texto-fijo' ? (
                <>
                  <label className="plantilla-campo-mini-label">🔍 Comparar contra un adjunto (la IA verifica que este valor aparezca en el soporte)</label>
                  <select
                    value={c.comparar_contra ?? ''}
                    onChange={(e) => patchCampoIdx(idx, { comparar_contra: e.target.value || undefined })}
                  >
                    <option value="">— No comparar —</option>
                    {campos.filter((x) => x.type === 'file').map((x) => (
                      <option key={x.key} value={x.key}>{x.label || x.key}</option>
                    ))}
                  </select>
                </>
              ) : null}
              {c.type === 'tabla-items' ? (
                <>
                  <label className="plantilla-campo-mini-label">Columnas (separadas por coma)</label>
                  <input
                    type="text"
                    placeholder="Ej. Fecha, Destino, Concepto, Valor"
                    value={(c.columnas || []).join(', ')}
                    onChange={(e) => patchCampoIdx(idx, { columnas: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  />
                  <span className="plantilla-campo-mini-label">El solicitante podrá agregar varias filas (ej. varios viáticos).</span>
                  <label className="ops-checkbox" style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={!!c.conFactura}
                      onChange={(e) => patchCampoIdx(idx, { conFactura: e.target.checked, verificaciones: e.target.checked && !c.verificaciones ? VERIFICACIONES_FACTURA.map((x) => x.v) : c.verificaciones })}
                    /> Cada fila lleva su factura (la IA valida y avisa cuáles faltan)
                  </label>
                  {c.conFactura ? (
                    <>
                      <label className="plantilla-campo-mini-label">¿Qué debe verificar la IA en cada factura?</label>
                      {VERIFICACIONES_FACTURA.map((vf) => {
                        const activos = c.verificaciones ?? VERIFICACIONES_FACTURA.map((x) => x.v);
                        const on = activos.includes(vf.v);
                        return (
                          <label key={vf.v} className="ops-checkbox" style={{ fontSize: 11 }}>
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => patchCampoIdx(idx, { verificaciones: on ? activos.filter((x) => x !== vf.v) : [...activos, vf.v] })}
                            /> {vf.l}
                          </label>
                        );
                      })}
                      {(c.verificaciones ?? []).includes('establecimiento') ? (
                        <input
                          type="text"
                          placeholder="Establecimiento esperado (opcional, ej. Restaurante La Brasa)"
                          value={c.establecimientoEsperado || ''}
                          onChange={(e) => patchCampoIdx(idx, { establecimientoEsperado: e.target.value })}
                        />
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}
              {c.type === 'select' ? (
                <>
                  <label className="plantilla-campo-mini-label">Opciones de la lista (separadas por coma)</label>
                  <input
                    type="text"
                    placeholder="Ej. Solicitar anticipo, Legalizar con facturas"
                    value={(c.opciones || []).join(', ')}
                    onChange={(e) => patchCampoIdx(idx, { opciones: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  />
                </>
              ) : null}
              {c.type === 'persona' ? (
                <span className="plantilla-campo-mini-label">Al escribir, el solicitante verá sugerencias de los usuarios registrados (ej. “cami” → Camilo).</span>
              ) : null}
              {c.type === 'calculado' ? (
                <>
                  <label className="plantilla-campo-mini-label">Operación</label>
                  <select
                    value={c.operacion || 'suma'}
                    onChange={(e) => patchCampoIdx(idx, { operacion: e.target.value as CampoPlantilla['operacion'] })}
                  >
                    {OPERACIONES_CALCULO.map((op) => <option key={op.v} value={op.v}>{op.l}</option>)}
                  </select>
                  <label className="plantilla-campo-mini-label">Campos a combinar (en orden)</label>
                  {campos.filter((x) => x.key && x.key !== c.key && ['valor-pesos', 'number', 'calculado'].includes(x.type)).length === 0 ? (
                    <span className="plantilla-campo-mini-label">Agrega primero campos de tipo “Valor en pesos” o “Número” para poder combinarlos.</span>
                  ) : (
                    campos.filter((x) => x.key && x.key !== c.key && ['valor-pesos', 'number', 'calculado'].includes(x.type)).map((x) => {
                      const sel = (c.operandos || []).includes(x.key);
                      return (
                        <label key={x.key} className="ops-checkbox" style={{ fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => {
                              const actuales = c.operandos || [];
                              const next = sel ? actuales.filter((k) => k !== x.key) : [...actuales, x.key];
                              patchCampoIdx(idx, { operandos: next });
                            }}
                          /> {x.label || x.key}
                        </label>
                      );
                    })
                  )}
                  {(c.operandos || []).length > 0 ? (
                    <span className="plantilla-campo-mini-label">
                      = {(c.operandos || []).map((k) => campos.find((x) => x.key === k)?.label || k).join(` ${OPERACIONES_CALCULO.find((op) => op.v === (c.operacion || 'suma'))?.sim} `)}
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
            );
          })}
        </div>

        {/* CENTRO: todas las hojas de la plantilla */}
        <div className="plantilla-col-hojas">
        <div className="plantilla-zoom-bar">
          <div className="plantilla-vista-toggle">
            <button type="button" className={vistaCentro === 'hoja' ? 'activo' : ''} onClick={() => setVistaCentro('hoja')}>🗎 Hoja</button>
            <button type="button" className={vistaCentro === 'formulario' ? 'activo' : ''} onClick={() => setVistaCentro('formulario')}>📝 Formulario</button>
          </div>
          <span className="plantilla-zoom-sep" />
          <button type="button" className="plantilla-zoom-btn" title="Alejar" onClick={() => ajustarZoom(-0.1)}>−</button>
          <span className="plantilla-zoom-valor">{Math.round(zoomDoc * 100)}%</span>
          <button type="button" className="plantilla-zoom-btn" title="Acercar" onClick={() => ajustarZoom(0.1)}>+</button>
          <button type="button" className="plantilla-zoom-reset" title="Tamaño 100%" onClick={() => setZoomDoc(1)}>Ajustar</button>
          <button
            type="button"
            className={`plantilla-zoom-reset${vistaPreviaDatos ? ' activo' : ''}`}
            title="Ver cómo se vería la hoja diligenciada por el solicitante"
            onClick={() => setVistaPreviaDatos((v) => !v)}
          >
            {vistaPreviaDatos ? '👁 Viendo con datos' : '👁 Ver con datos'}
          </button>
          <span className="admin-help-text" style={{ marginLeft: 8 }}>Los campos se alinean solos al arrastrar · mantén <kbd>Alt</kbd> para mover libre.</span>
        </div>
        {ordenAreas && ordenAreas.length > 0 ? (
          <div className="plantilla-flujo-areas-strip">
            <strong>🏢 Áreas:</strong>
            {ordenAreas.map((nom, i) => (
              <span key={i} className="plantilla-flujo-area">
                {i > 0 ? <span className="plantilla-flujo-flecha">→</span> : null}
                {nom}{i === ordenAreas.length - 1 ? ' (final)' : ''}
              </span>
            ))}
          </div>
        ) : null}
        <div className="plantilla-hojas-canvas">
        {vistaCentro === 'formulario' ? (
          <div className="plantilla-form-live"><PreviewFormularioContenido campos={camposDelFormulario()} plantillaPdf={plantilla} /></div>
        ) : Array.from({ length: totalPaginas }, (_, i) => i + 1).map((pg) => (
        <div
          key={pg}
          className={`plantilla-page${pg === paginaActiva ? ' activa' : ''}${pg === paginaActiva && arrastrando ? ' arrastrando' : ''}`}
          ref={pg === paginaActiva ? pageRef : undefined}
          style={{ width: 210 * SCALE, height: 297 * SCALE }}
          onClick={() => { setPaginaActiva(pg); setSeleccionadoId(null); }}
        >
          <div className="plantilla-page-num">Página {pg} de {totalPaginas}</div>
          {/* Líneas-guía de alineación (estilo Canva): aparecen al imantar */}
          {pg === paginaActiva && (guias.x.length > 0 || guias.y.length > 0) ? (
            <div className="plantilla-guias">
              {guias.x.map((gx, i) => (
                <span key={`gx${i}`} className="plantilla-guia plantilla-guia-v" style={{ left: gx * SCALE }} />
              ))}
              {guias.y.map((gy, i) => (
                <span key={`gy${i}`} className="plantilla-guia plantilla-guia-h" style={{ top: gy * SCALE }} />
              ))}
            </div>
          ) : null}
          {bloques.filter((b) => (b.pagina ?? 1) === pg).map((b) => {
            const left = b.x * SCALE;
            const top = b.y * SCALE;
            const width = (b.w || 100) * SCALE;
            const isSel = b.id === seleccionadoId;
            return (
              <div
                key={b.id}
                className={`plantilla-canvas-bloque tipo-${b.tipo}${isSel ? ' seleccionado' : ''}${idsSuperpuestos.has(b.id) && !ocultarOverlap ? ' con-overlap' : ''}`}
                style={{ left, top, width }}
                onPointerDown={(e) => onPointerDown(e, b.id)}
                onClick={(e) => { e.stopPropagation(); setSeleccionadoId(b.id); }}
              >
                {b.tipo === 'encabezado' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8, tableLayout: 'fixed' }}>
                    <tbody>
                      <tr>
                        <td rowSpan={4} style={{ border: '1px solid #333', width: '24%', textAlign: 'center', verticalAlign: 'middle', padding: 3 }}>
                          <img src={b.src || '/logo-payops-dark.png'} alt="Logo" style={{ maxWidth: '100%', maxHeight: 40, objectFit: 'contain' }} />
                        </td>
                        <td rowSpan={2} style={{ border: '1px solid #333', textAlign: 'center', fontWeight: 700, padding: '3px 4px', verticalAlign: 'middle' }}>{b.titulo}</td>
                        <td style={{ border: '1px solid #333', width: '27%', padding: '2px 4px' }}><strong>Código:</strong> {b.codigo}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #333', padding: '2px 4px' }}><strong>Fecha:</strong> {b.fecha}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #333', textAlign: 'center', fontWeight: 700, padding: '3px 4px' }}>{b.subtitulo}</td>
                        <td style={{ border: '1px solid #333', padding: '2px 4px' }}><strong>Versión:</strong> {b.version}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #333', textAlign: 'center', fontWeight: 700, padding: '3px 4px' }}>{b.area}</td>
                        <td style={{ border: '1px solid #333', padding: '2px 4px' }}><strong>Página:</strong> {b.paginaTexto}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : null}
                {b.tipo === 'logo' ? (
                  <div className="canvas-logo" style={{ width: '100%', textAlign: b.alineacion === 'centro' ? 'center' : b.alineacion === 'derecha' ? 'right' : 'left' }}>
                    <img
                      src={b.src || '/logo-payops-dark.png'}
                      alt="Logo"
                      style={{ maxWidth: '100%', maxHeight: 60, display: 'inline-block', objectFit: 'contain' }}
                    />
                  </div>
                ) : null}
                {b.tipo === 'titulo' ? (
                  <div style={{ textAlign: b.alineacion === 'centro' ? 'center' : b.alineacion === 'derecha' ? 'right' : 'left', fontSize: b.tamano, fontWeight: b.negrita ? 700 : 400 }}>
                    {vistaPreviaDatos ? aplicarEjemploTokens(b.texto) : b.texto}
                  </div>
                ) : null}
                {b.tipo === 'texto' ? (
                  <div style={{ textAlign: b.alineacion === 'centro' ? 'center' : b.alineacion === 'derecha' ? 'right' : 'left', fontSize: b.tamano }}>
                    {vistaPreviaDatos ? aplicarEjemploTokens(b.texto) : b.texto}
                  </div>
                ) : null}
                {b.tipo === 'campo' ? (
                  <div style={{ fontSize: 11, textAlign: b.alineacion === 'centro' ? 'center' : b.alineacion === 'derecha' ? 'right' : 'left' }}>
                    <strong>{b.etiqueta}</strong>{' '}
                    {vistaPreviaDatos ? (
                      <span style={{ borderBottom: '1px solid #555' }}>{ejemploCampoValor(b.campoKey)}</span>
                    ) : (
                      <span style={{ color: '#999', borderBottom: '1px solid #999', display: 'inline-block', minWidth: 60 }}>[{b.campoKey}]</span>
                    )}
                  </div>
                ) : null}
                {b.tipo === 'tabla' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr>{b.columnas.map((c, i) => <th key={i} style={{ background: '#070B1D', color: '#D4AF37', padding: '4px 6px' }}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      <tr>{b.columnas.map((_, i) => <td key={i} style={{ border: '1px solid #ccc', padding: '4px 6px', minHeight: 18 }}>&nbsp;</td>)}</tr>
                      <tr>{b.columnas.map((_, i) => <td key={i} style={{ border: '1px solid #ccc', padding: '4px 6px' }}>&nbsp;</td>)}</tr>
                      {b.conTotal ? (
                        <tr>
                          <td colSpan={Math.max(1, b.columnas.length - 1)} style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontWeight: 700, background: '#f3f4f6' }}>{b.etiquetaTotal || 'TOTAL'}</td>
                          <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontWeight: 700, background: '#f3f4f6', color: '#6366F1' }}>$ ∑</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                ) : null}
                {b.tipo === 'divider' ? (
                  <div style={{ borderTop: '1px solid #D4AF37', width: '100%', height: 1 }} />
                ) : null}
                {b.tipo === 'firma' ? (
                  <div style={{ textAlign: 'center', fontSize: 11 }}>
                    <div style={{ height: 28, border: '1px dashed #aaa', background: 'repeating-linear-gradient(45deg, #fafafa, #fafafa 4px, #eee 4px, #eee 8px)' }} />
                    <div style={{ borderTop: '1px solid #444', marginTop: 2, paddingTop: 2 }}>{b.etiqueta}</div>
                  </div>
                ) : null}
                {b.tipo === 'caja' ? (
                  <div style={{ width: '100%', height: (b.alto || 30) * SCALE / 2, border: '2px solid #0F172A', background: b.relleno ? 'rgba(212, 175, 55, 0.18)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#444' }}>
                    {b.etiqueta || '—'}
                  </div>
                ) : null}
                {b.tipo === 'imagen' ? (
                  b.src ? (
                    <img src={b.src} alt="" style={{ maxWidth: '100%', maxHeight: 80, display: 'block', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: '100%', height: 40, border: '1px dashed #999', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999', background: '#fafafa' }}>
                      📷 Sin imagen — pega URL en el panel
                    </div>
                  )
                ) : null}
                {b.tipo === 'lista' ? (
                  <ul style={{ margin: 0, paddingLeft: b.conVinetas ? 18 : 0, fontSize: 11, listStyle: b.conVinetas ? 'disc' : 'none' }}>
                    {b.items.slice(0, 6).map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                ) : null}
                {b.tipo === 'separador-doble' ? (
                  <div style={{ width: '100%' }}>
                    <div style={{ borderTop: '2px solid #D4AF37' }} />
                    <div style={{ borderTop: '1px solid #D4AF37', marginTop: 2 }} />
                  </div>
                ) : null}
                {b.tipo === 'qr-radicado' ? (
                  <div style={{ width: (b.tamano || 30) * SCALE / 2, height: (b.tamano || 30) * SCALE / 2, background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontSize: 9, textAlign: 'center', padding: 4 }}>
                    QR<br/>{'{radicado}'}
                  </div>
                ) : null}
                <span className="canvas-bloque-tag">{TIPOS_BLOQUE_LABELS[b.tipo]} · {b.x},{b.y}</span>
                {isSel ? (
                  <button
                    type="button"
                    className="canvas-bloque-del"
                    title="Quitar este bloque de la hoja"
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    onClick={(e) => { e.stopPropagation(); eliminar(b.id); }}
                  >✕</button>
                ) : null}
                {isSel ? (
                  <>
                    <span
                      className="canvas-resize canvas-resize-e"
                      title="Estirar el ancho"
                      onPointerDown={(e) => onResize(e, b.id, 'e')}
                    />
                    <span
                      className="canvas-resize canvas-resize-se"
                      title="Cambiar tamaño"
                      onPointerDown={(e) => onResize(e, b.id, 'se')}
                    />
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
        ))}
        </div>{/* fin hojas-canvas */}
        </div>{/* fin col-hojas */}

        {/* DERECHA: documentos a adjuntar + validación IA */}
        <div className="plantilla-col-docs">
          <div className="plantilla-col-head">
            <strong>📎 Documentos a adjuntar</strong>
            <button type="button" className="admin-ghost-button" onClick={agregarDocumentoCustom}>+ Adjunto</button>
          </div>
          <p className="admin-help-text">Lo que sube el solicitante; la IA valida que el adjunto corresponda.</p>
          <div className="plantilla-docs-rapidos">
            {DOCUMENTOS_PREDEFINIDOS.map((d) => {
              const ya = campos.some((c) => c.key === d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  className="plantilla-doc-chip"
                  disabled={ya}
                  title={ya ? 'Ya agregado' : `Agregar ${d.label}`}
                  onClick={() => agregarDocumentoPredef(d)}
                >
                  {d.emoji} {d.label}{ya ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
          {docsIdx.length === 0 ? <p className="admin-help-text">Sin documentos aún. Usa los botones de arriba o “+ Adjunto”.</p> : null}
          {docsIdx.map(({ c, idx }) => (
            <div key={idx} className="plantilla-campo-item">
              <div className="plantilla-campo-item-row">
                <input
                  className="plantilla-campo-item-label"
                  type="text"
                  value={c.label}
                  placeholder="Nombre del documento"
                  onChange={(e) => patchCampoIdx(idx, { label: e.target.value })}
                />
                <button type="button" className="campo-modulo-del" title="Eliminar adjunto" onClick={() => eliminarCampoIdx(idx)}>🗑</button>
              </div>
              <label className="plantilla-campo-mini-label">Qué documento es (para la IA)</label>
              <select value={c.ocr_target ?? ''} onChange={(e) => patchCampoIdx(idx, { ocr_target: e.target.value || undefined })}>
                {OCR_TARGETS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <label className="plantilla-campo-mini-label">Dato que la IA debe verificar dentro del adjunto</label>
              <select value={c.validar_contra ?? ''} onChange={(e) => patchCampoIdx(idx, { validar_contra: e.target.value || undefined })}>
                <option value="">— ninguno —</option>
                {datosIdx.map(({ c: dc }) => <option key={dc.key} value={dc.key}>{dc.label}</option>)}
              </select>
              <button
                type="button"
                className={`campo-req-toggle${c.required ? ' on' : ''}`}
                onClick={() => patchCampoIdx(idx, { required: !c.required })}
              >{c.required ? '● Obligatorio' : '○ Opcional'}</button>
            </div>
          ))}
        </div>
      </div>{/* fin plantilla-3col */}

      {sel ? (
        <aside className="plantilla-edit-panel plantilla-bloque-props">
          {!sel ? (
            <p className="admin-help-text">Selecciona un bloque del documento para editar sus propiedades.</p>
          ) : (
            <>
              <header className="plantilla-edit-head">
                <strong>{TIPOS_BLOQUE_LABELS[sel.tipo]}</strong>
                <button type="button" className="admin-ghost-button admin-role-delete" onClick={() => eliminar(sel.id)}>✕ Eliminar</button>
              </header>
              <div className="plantilla-edit-body">
                <div className="plantilla-edit-row">
                  <label>X (mm)</label>
                  <input type="number" value={sel.x} onChange={(e) => actualizar(sel.id, { x: Number(e.target.value) } as Partial<PdfBloque>)} />
                  <label>Y (mm)</label>
                  <input type="number" value={sel.y} onChange={(e) => actualizar(sel.id, { y: Number(e.target.value) } as Partial<PdfBloque>)} />
                  <label>Ancho (mm)</label>
                  <input type="number" value={sel.w} onChange={(e) => actualizar(sel.id, { w: Number(e.target.value) } as Partial<PdfBloque>)} />
                </div>
                <label>Página</label>
                <select value={sel.pagina ?? 1} onChange={(e) => actualizar(sel.id, { pagina: Number(e.target.value) } as Partial<PdfBloque>)}>
                  {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>Página {p}</option>)}
                </select>

                {sel.tipo === 'encabezado' ? (
                  <>
                    <label>Título del formato</label>
                    <input type="text" value={sel.titulo} onChange={(e) => actualizar(sel.id, { titulo: e.target.value })} placeholder="ej. ANTICIPO DE GASTOS DE VIAJE" />
                    <label>Dirección / proceso</label>
                    <input type="text" value={sel.subtitulo} onChange={(e) => actualizar(sel.id, { subtitulo: e.target.value })} placeholder="ej. DIRECCION FINANCIERA" />
                    <label>Área</label>
                    <input type="text" value={sel.area} onChange={(e) => actualizar(sel.id, { area: e.target.value })} placeholder="ej. CONTABILIDAD" />
                    <label>Código</label>
                    <input type="text" value={sel.codigo} onChange={(e) => actualizar(sel.id, { codigo: e.target.value })} placeholder="ej. DF-CON-FR-004" />
                    <div className="plantilla-edit-row">
                      <label>Fecha</label>
                      <input type="text" value={sel.fecha} onChange={(e) => actualizar(sel.id, { fecha: e.target.value })} />
                      <label>Versión</label>
                      <input type="text" value={sel.version} onChange={(e) => actualizar(sel.id, { version: e.target.value })} />
                      <label>Página</label>
                      <input type="text" value={sel.paginaTexto} onChange={(e) => actualizar(sel.id, { paginaTexto: e.target.value })} placeholder="1 de 1" />
                    </div>
                    <label>Logo</label>
                    <select value={sel.src || ''} onChange={(e) => actualizar(sel.id, { src: e.target.value || undefined })}>
                      {LOGOS_DISPONIBLES.map((l) => (
                        <option key={l.id} value={l.src}>{l.nombre}</option>
                      ))}
                    </select>
                  </>
                ) : null}

                {sel.tipo === 'logo' ? (
                  <>
                    <label>Imagen del logo</label>
                    <select value={sel.src || ''} onChange={(e) => actualizar(sel.id, { src: e.target.value || undefined })}>
                      <option value="">— Recuadro genérico (GOLEMAN IPS) —</option>
                      {LOGOS_DISPONIBLES.map((l) => (
                        <option key={l.id} value={l.src}>{l.nombre}</option>
                      ))}
                    </select>
                    <label>Alineación</label>
                    <select value={sel.alineacion} onChange={(e) => actualizar(sel.id, { alineacion: e.target.value as PdfAlineacion })}>
                      <option value="izquierda">Izquierda</option>
                      <option value="centro">Centro</option>
                      <option value="derecha">Derecha</option>
                    </select>
                  </>
                ) : null}

                {sel.tipo === 'titulo' ? (
                  <>
                    <label>Texto</label>
                    <input type="text" value={sel.texto} onChange={(e) => actualizar(sel.id, { texto: e.target.value })} />
                    <label>Alineación</label>
                    <select value={sel.alineacion} onChange={(e) => actualizar(sel.id, { alineacion: e.target.value as PdfAlineacion })}>
                      <option value="izquierda">Izquierda</option>
                      <option value="centro">Centro</option>
                      <option value="derecha">Derecha</option>
                    </select>
                    <label>Tamaño</label>
                    <input type="number" min={8} max={32} value={sel.tamano} onChange={(e) => actualizar(sel.id, { tamano: Number(e.target.value) })} />
                    <label className="ops-checkbox">
                      <input type="checkbox" checked={sel.negrita} onChange={(e) => actualizar(sel.id, { negrita: e.target.checked })} /> Negrita
                    </label>
                  </>
                ) : null}

                {sel.tipo === 'texto' ? (
                  <>
                    <label>Texto</label>
                    <textarea rows={3} value={sel.texto} onChange={(e) => actualizar(sel.id, { texto: e.target.value })} />
                    <label>Alineación</label>
                    <select value={sel.alineacion} onChange={(e) => actualizar(sel.id, { alineacion: e.target.value as PdfAlineacion })}>
                      <option value="izquierda">Izquierda</option>
                      <option value="centro">Centro</option>
                      <option value="derecha">Derecha</option>
                    </select>
                    <label>Tamaño</label>
                    <input type="number" min={8} max={20} value={sel.tamano} onChange={(e) => actualizar(sel.id, { tamano: Number(e.target.value) })} />
                  </>
                ) : null}

                {sel.tipo === 'campo' ? (() => {
                  const idxDato = campos.findIndex((c) => c.key === sel.campoKey);
                  const dato = idxDato >= 0 ? campos[idxDato] : null;
                  return (
                  <>
                    <label>Campo</label>
                    <select
                      value={sel.campoKey}
                      onChange={(e) => {
                        if (e.target.value === '__nuevo__') {
                          const nombre = window.prompt('Nombre del nuevo dato (ej. Concepto del gasto):', '');
                          if (!nombre || !nombre.trim()) return;
                          const base = nombre.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 28) || 'campo';
                          let key = base; let n = 1;
                          while (campos.some((c) => c.key === key)) { key = base + (++n); }
                          onCamposChange([...campos, { key, label: nombre.trim(), type: 'text', required: true, group: 'Datos del formato' }]);
                          actualizar(sel.id, { campoKey: key, etiqueta: `${nombre.trim()}:` });
                        } else {
                          actualizar(sel.id, { campoKey: e.target.value });
                        }
                      }}
                    >
                      {camposDisponibles.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                      <option value="__nuevo__">➕ Crear dato nuevo…</option>
                    </select>
                    <label>Etiqueta</label>
                    <input type="text" value={sel.etiqueta} onChange={(e) => actualizar(sel.id, { etiqueta: e.target.value })} />
                    {dato ? (
                      <>
                        <label>Tipo del dato (lo que llena la persona)</label>
                        <select value={dato.type} onChange={(e) => patchCampoIdx(idxDato, { type: e.target.value as CampoPlantilla['type'] })}>
                          {TIPOS_CAMPO.filter((t) => t.v !== 'file').map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                        </select>
                        {dato.type === 'select' ? (
                          <>
                            <label>Opciones de la lista (separadas por coma)</label>
                            <input
                              type="text"
                              placeholder="Ej. Opción A, Opción B"
                              value={(dato.opciones || []).join(', ')}
                              onChange={(e) => patchCampoIdx(idxDato, { opciones: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                            />
                          </>
                        ) : null}
                        {campos.some((x) => x.type === 'file') && dato.type !== 'calculado' ? (
                          <>
                            <label>🔍 Comparar contra un adjunto</label>
                            <select value={dato.comparar_contra ?? ''} onChange={(e) => patchCampoIdx(idxDato, { comparar_contra: e.target.value || undefined })}>
                              <option value="">— No comparar —</option>
                              {campos.filter((x) => x.type === 'file').map((x) => <option key={x.key} value={x.key}>{x.label || x.key}</option>)}
                            </select>
                          </>
                        ) : null}
                      </>
                    ) : null}
                    <label>Alineación</label>
                    <select value={sel.alineacion} onChange={(e) => actualizar(sel.id, { alineacion: e.target.value as PdfAlineacion })}>
                      <option value="izquierda">Izquierda</option>
                      <option value="centro">Centro</option>
                      <option value="derecha">Derecha</option>
                    </select>
                  </>
                  );
                })() : null}

                {sel.tipo === 'tabla' ? (
                  <>
                    <label>Columnas (separadas por coma)</label>
                    <input type="text" value={sel.columnas.join(', ')} onChange={(e) => actualizar(sel.id, { columnas: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                    <label className="ops-checkbox">
                      <input type="checkbox" checked={!!sel.conTotal} onChange={(e) => actualizar(sel.id, { conTotal: e.target.checked } as Partial<PdfBloque>)} /> Fila de total (suma automática de la última columna)
                    </label>
                    {sel.conTotal ? (
                      <>
                        <label>Etiqueta del total</label>
                        <input type="text" value={sel.etiquetaTotal || ''} onChange={(e) => actualizar(sel.id, { etiquetaTotal: e.target.value } as Partial<PdfBloque>)} placeholder="TOTAL" />
                        <span className="admin-help-text">Suma los valores numéricos de la última columna (ej. VALOR) que llena el solicitante.</span>
                      </>
                    ) : null}
                  </>
                ) : null}

                {sel.tipo === 'firma' ? (
                  <>
                    <label>Etiqueta</label>
                    <input type="text" value={sel.etiqueta} onChange={(e) => actualizar(sel.id, { etiqueta: e.target.value })} />
                    <label>Tipo</label>
                    <select value={sel.campoFirma} onChange={(e) => actualizar(sel.id, { campoFirma: e.target.value as 'profesional' | 'coordinador' | 'contabilidad' })}>
                      <option value="profesional">{FIRMA_LABELS.profesional}</option>
                      <option value="coordinador">{FIRMA_LABELS.coordinador}</option>
                      <option value="contabilidad">{FIRMA_LABELS.contabilidad}</option>
                    </select>
                  </>
                ) : null}

                {sel.tipo === 'divider' ? (
                  <span className="admin-help-text">Línea horizontal. Solo necesita posición y ancho.</span>
                ) : null}

                {sel.tipo === 'caja' ? (
                  <>
                    <label>Alto (mm)</label>
                    <input type="number" min={5} max={200} value={sel.alto} onChange={(e) => actualizar(sel.id, { alto: Number(e.target.value) })} />
                    <label>Etiqueta interior</label>
                    <input type="text" value={sel.etiqueta || ''} onChange={(e) => actualizar(sel.id, { etiqueta: e.target.value })} placeholder="Texto opcional dentro de la caja" />
                    <label className="ops-checkbox">
                      <input type="checkbox" checked={sel.relleno} onChange={(e) => actualizar(sel.id, { relleno: e.target.checked })} /> Caja rellena (dorado)
                    </label>
                  </>
                ) : null}

                {sel.tipo === 'imagen' ? (
                  <>
                    <label>URL de la imagen</label>
                    <input type="text" value={sel.src} onChange={(e) => actualizar(sel.id, { src: e.target.value })} placeholder="https://... o /ruta-local.png" />
                    <label>Etiqueta (caption opcional)</label>
                    <input type="text" value={sel.etiqueta || ''} onChange={(e) => actualizar(sel.id, { etiqueta: e.target.value })} />
                  </>
                ) : null}

                {sel.tipo === 'lista' ? (
                  <>
                    <label>Items (uno por línea)</label>
                    <textarea rows={4} value={sel.items.join('\n')} onChange={(e) => actualizar(sel.id, { items: e.target.value.split('\n').filter(Boolean) })} />
                    <label className="ops-checkbox">
                      <input type="checkbox" checked={sel.conVinetas} onChange={(e) => actualizar(sel.id, { conVinetas: e.target.checked })} /> Con viñetas
                    </label>
                  </>
                ) : null}

                {sel.tipo === 'separador-doble' ? (
                  <span className="admin-help-text">Doble línea horizontal dorada. Solo posición y ancho.</span>
                ) : null}

                {sel.tipo === 'qr-radicado' ? (
                  <>
                    <label>Tamaño (mm)</label>
                    <input type="number" min={20} max={60} value={sel.tamano} onChange={(e) => actualizar(sel.id, { tamano: Number(e.target.value) })} />
                    <span className="admin-help-text">El QR codifica automáticamente el número de radicado de la solicitud.</span>
                  </>
                ) : null}
              </div>
            </>
          )}
        </aside>
      ) : null}

      <PreviewFormularioModal
        open={previewFormOpen}
        onClose={() => setPreviewFormOpen(false)}
        campos={camposDelFormulario()}
        plantillaPdf={plantilla}
        tipoNombre=""
      />
    </div>
  );

  // Cuando está en pantalla completa, portal a document.body para escapar
  // de modales padres y stacking contexts
  if (pantallaCompleta && typeof document !== 'undefined') {
    return createPortal(editorContent, document.body);
  }
  return editorContent;
}
