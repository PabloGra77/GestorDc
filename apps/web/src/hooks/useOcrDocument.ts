import { useCallback, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number; // 0..100
}

/**
 * OCR cliente con Tesseract.js. El worker se inicializa una sola vez
 * y se reutiliza. Procesa imagenes (jpg/png) o PDFs renderizados como imagen.
 */
export function useOcrDocument() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const workerRef = useRef<Tesseract.Worker | null>(null);

  const initWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    const worker = await Tesseract.createWorker('spa', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
      },
    });
    workerRef.current = worker;
    return worker;
  }, []);

  const procesarArchivo = useCallback(async (file: File): Promise<OcrResult | null> => {
    if (!file) return null;
    // Solo OCR a imagenes (Tesseract no procesa PDF directamente sin libs extras)
    if (!file.type.startsWith('image/')) {
      return null;
    }
    setRunning(true);
    setProgress(0);
    try {
      const worker = await initWorker();
      const { data } = await worker.recognize(file);
      return {
        text: data.text.trim(),
        confidence: data.confidence ?? 0,
      };
    } catch (e) {
      console.error('[ocr] error', e);
      return null;
    } finally {
      setRunning(false);
      setProgress(0);
    }
  }, [initWorker]);

  return { procesarArchivo, running, progress };
}

/**
 * Valida coincidencia entre el texto OCR y un dato esperado.
 * - Para CC/NIT: extrae numeros y verifica que el dato aparezca completo.
 * - Para texto: verifica que las palabras del dato esten todas en el OCR.
 */
export function validarOcrContraDato(
  ocrText: string,
  datoEsperado: string,
  tipo: 'cc' | 'nit' | 'texto' = 'texto'
): { coincide: boolean; razon?: string } {
  if (!ocrText || !datoEsperado) {
    return { coincide: false, razon: 'OCR vacio o dato no proporcionado' };
  }
  const ocr = ocrText.toLowerCase().replace(/\s+/g, ' ');
  const dato = datoEsperado.toLowerCase().trim();

  if (tipo === 'cc' || tipo === 'nit') {
    const ocrNumeros = (ocr.match(/\d{5,}/g) || []).join(' ');
    const datoNumeros = dato.replace(/\D/g, '');
    if (!datoNumeros) return { coincide: false, razon: 'Dato sin digitos' };
    if (ocrNumeros.includes(datoNumeros)) return { coincide: true };
    return { coincide: false, razon: `Numero ${datoNumeros} no encontrado en OCR` };
  }

  // texto: split palabras > 2 chars, verifica mayoria
  const palabras = dato.split(/\s+/).filter((p) => p.length > 2);
  if (palabras.length === 0) return { coincide: false };
  const encontradas = palabras.filter((p) => ocr.includes(p)).length;
  const ratio = encontradas / palabras.length;
  if (ratio >= 0.6) return { coincide: true };
  return { coincide: false, razon: `Solo coincide ${Math.round(ratio * 100)}% del texto` };
}

/**
 * Verifica que el texto del documento corresponda al tipo esperado
 * mediante palabras clave caracteristicas. Si ninguna palabra clave aparece,
 * el documento adjuntado no es del tipo correcto.
 */
const PALABRAS_CLAVE: Record<string, string[]> = {
  cedula: ['cedula', 'cédula', 'republica de colombia', 'identificacion', 'identificación', 'registraduria', 'nacional'],
  rut: ['rut', 'registro unico tributario', 'registro único tributario', 'dian', 'numero de identificacion tributaria', 'razon social'],
  eps: ['eps', 'afiliacion', 'afiliación', 'afiliado', 'cotizante', 'entidad promotora de salud', 'plan obligatorio', 'sura', 'sanitas', 'nueva eps', 'famisanar', 'salud total', 'compensar', 'coomeva', 'mutual ser', 'aliansalud', 'savia salud', 'medimas', 'asmet salud', 'capital salud'],
  adres: ['adres', 'administradora de los recursos', 'sistema general de seguridad social', 'fosyga'],
  planilla: ['planilla', 'pila', 'aportes', 'seguridad social', 'integrada', 'liquidacion'],
  cuenta_cobro: ['cuenta de cobro', 'paguese', 'páguese', 'me permito cobrar', 'concepto', 'valor a cobrar', 'honorarios'],
  cuenta_bancaria: ['certificacion', 'certificación', 'cuenta bancaria', 'cuenta de ahorros', 'cuenta corriente', 'banco', 'davivienda', 'bancolombia', 'bbva', 'banco agrario', 'banco popular', 'banco de bogota', 'av villas', 'caja social', 'titular'],
  contrato: ['contrato', 'clausula', 'cláusula', 'contratante', 'contratista', 'objeto del contrato'],
};

export function validarTipoDocumento(
  ocrText: string,
  target: string
): { esValido: boolean; tipoDetectado?: string } {
  if (!ocrText || !target) return { esValido: false };
  const ocr = ocrText.toLowerCase().replace(/\s+/g, ' ');
  const palabras = PALABRAS_CLAVE[target];
  if (!palabras) return { esValido: true }; // sin keywords definidas: no podemos verificar, permitir

  const encontradas = palabras.filter((p) => ocr.includes(p.toLowerCase()));
  if (encontradas.length === 0) {
    // No coincide con el tipo esperado: detectar a que tipo se parece mas
    let mejor = '';
    let mejorCount = 0;
    for (const [otroTarget, otrasPalabras] of Object.entries(PALABRAS_CLAVE)) {
      if (otroTarget === target) continue;
      const c = otrasPalabras.filter((p) => ocr.includes(p.toLowerCase())).length;
      if (c > mejorCount) { mejor = otroTarget; mejorCount = c; }
    }
    return { esValido: false, tipoDetectado: mejor || undefined };
  }
  return { esValido: true };
}
