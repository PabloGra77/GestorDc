import jsPDF from 'jspdf';

interface CampoPlantilla {
  key: string;
  label: string;
  type: string;
  group?: string;
}

interface Movimiento {
  accion: string;
  paso: string | null;
  usuarioNombre: string | null;
  comentario: string | null;
  creadoEn: string;
}

type PdfAlineacion = 'izquierda' | 'centro' | 'derecha';

interface BloqueBase {
  id: string;
  x: number;
  y: number;
  w: number;
  pagina?: number;
}

type PdfBloque = BloqueBase & (
  | { tipo: 'logo'; alineacion: PdfAlineacion; ancho: number; src?: string }
  | { tipo: 'titulo'; texto: string; alineacion: PdfAlineacion; tamano: number; negrita: boolean }
  | { tipo: 'texto'; texto: string; alineacion: PdfAlineacion; tamano: number }
  | { tipo: 'campo'; campoKey: string; etiqueta: string; alineacion: PdfAlineacion }
  | { tipo: 'tabla'; columnas: string[] }
  | { tipo: 'divider' }
  | { tipo: 'firma'; etiqueta: string; campoFirma: 'profesional' | 'coordinador' | 'contabilidad' }
  | { tipo: 'caja'; alto: number; relleno: boolean; etiqueta?: string }
  | { tipo: 'imagen'; src: string; etiqueta?: string }
  | { tipo: 'lista'; items: string[]; conVinetas: boolean }
  | { tipo: 'separador-doble' }
  | { tipo: 'qr-radicado'; tamano: number }
);

async function cargarImagenDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface PlantillaPdf {
  bloques?: PdfBloque[];
}

interface SolicitudParaPdf {
  numeroRadicado: string;
  tipoNombre: string;
  areaNombre: string;
  solicitanteNombre: string | null;
  solicitanteCorreo: string | null;
  solicitanteDocumento: string | null;
  datosFormulario: Record<string, unknown>;
  documentos: Record<string, unknown>;
  alertas: Array<{ tipo?: string; descripcion?: string; severidad?: string }>;
  estado: string;
  creadoEn: string;
  aprobadoEn?: string | null;
  camposPlantilla: CampoPlantilla[];
  movimientos: Movimiento[];
  firmas?: Record<string, string> | null;
  plantillaPdf?: PlantillaPdf | null;
}

function aplicarPlaceholders(texto: string, s: SolicitudParaPdf): string {
  const d = s.datosFormulario || {};
  const valor = String(d.valorPesos ?? d.valor ?? '');
  const valorLetras = String(d.valorPesos__letras ?? d.valorLetras ?? '');
  const concepto = String(d.observaciones ?? d.concepto ?? d.descripcion ?? '');
  const ciudad = String(d.lugarExpedicion ?? d.ciudad ?? '');
  const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const nombre = s.solicitanteNombre || '';
  const cedula = s.solicitanteDocumento || '';
  const subst: Record<string, string> = {
    '{{valor}}': valor ? `$ ${Number(valor).toLocaleString('es-CO')}` : '',
    '{{valorLetras}}': valorLetras,
    '{{concepto}}': concepto,
    '{{ciudad}}': ciudad,
    '{{fecha}}': fecha,
    '{{nombre}}': nombre,
    '{{cedula}}': cedula,
  };
  let out = texto;
  for (const [k, v] of Object.entries(subst)) {
    out = out.split(k).join(v);
  }
  return out;
}

function valorCampo(s: SolicitudParaPdf, key: string): string {
  if (key === '__radicado') return s.numeroRadicado;
  if (key === '__nombre') return s.solicitanteNombre || '';
  if (key === '__cedula') return s.solicitanteDocumento || '';
  if (key === '__correo') return s.solicitanteCorreo || '';
  if (key === '__fecha') return new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  if (key === '__ciudad') {
    const d = s.datosFormulario || {};
    return String(d.lugarExpedicion ?? d.ciudad ?? 'Bogotá');
  }
  const raw = (s.datosFormulario || {})[key];
  if (raw == null) return '';
  if (typeof raw === 'object') {
    try { return JSON.stringify(raw); } catch { return ''; }
  }
  return String(raw);
}

async function generarPdfPlantilla(s: SolicitudParaPdf, pl: PlantillaPdf, filenameOverride?: string, opts?: { bloburl?: boolean }): Promise<string | void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  function anchorX(b: { x: number; w: number; alineacion?: 'izquierda' | 'centro' | 'derecha' }) {
    const al = b.alineacion || 'izquierda';
    if (al === 'centro') return { x: b.x + b.w / 2, opt: { align: 'center' as const } };
    if (al === 'derecha') return { x: b.x + b.w, opt: { align: 'right' as const } };
    return { x: b.x, opt: { align: 'left' as const } };
  }

  function dibujarRadicadoEsquina() {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text('RADICADO', pageWidth - 18, 12, { align: 'right' });
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(s.numeroRadicado, pageWidth - 18, 18, { align: 'right' });
  }

  const bloques = pl.bloques || [];

  // Precargar imágenes de logos y bloques tipo imagen
  const logoCache = new Map<string, string>();
  const LOGO_DEFAULT = '/logo-payops-dark.png';
  const urlsACargar = new Set<string>();
  for (const b of bloques) {
    if (b.tipo === 'logo') urlsACargar.add(b.src || LOGO_DEFAULT);
    if (b.tipo === 'imagen' && b.src) urlsACargar.add(b.src);
  }
  for (const url of urlsACargar) {
    if (!logoCache.has(url)) {
      const data = await cargarImagenDataUrl(url);
      if (data) logoCache.set(url, data);
    }
  }

  // Agrupar bloques por página
  const paginas = new Map<number, PdfBloque[]>();
  for (const b of bloques) {
    const p = b.pagina ?? 1;
    if (!paginas.has(p)) paginas.set(p, []);
    paginas.get(p)!.push(b);
  }
  const numerosPagina = Array.from(paginas.keys()).sort((a, b) => a - b);
  if (numerosPagina.length === 0) numerosPagina.push(1);

  for (let pIdx = 0; pIdx < numerosPagina.length; pIdx++) {
    if (pIdx > 0) doc.addPage();
    dibujarRadicadoEsquina();
    const bloquesPag = paginas.get(numerosPagina[pIdx]) || [];

    for (const b of bloquesPag) {
    const baseY = b.y;
    if (b.tipo === 'logo') {
      const ancho = Math.max(20, Math.min(80, b.ancho || 36));
      const alto = ancho * 0.55; // proporción aproximada
      let lx = b.x;
      if (b.alineacion === 'centro') lx = b.x + (b.w - ancho) / 2;
      else if (b.alineacion === 'derecha') lx = b.x + b.w - ancho;
      const dataUrl = logoCache.get(b.src || LOGO_DEFAULT) || null;
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, 'PNG', lx, baseY, ancho, alto);
        } catch {
          // fallback al recuadro genérico
          doc.setFillColor(7, 11, 29);
          doc.rect(lx, baseY, ancho, 16, 'F');
          doc.setTextColor(212, 175, 55);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.text('GOLEMAN', lx + ancho / 2, baseY + 10, { align: 'center' });
        }
      } else {
        doc.setFillColor(7, 11, 29);
        doc.rect(lx, baseY, ancho, 16, 'F');
        doc.setTextColor(212, 175, 55);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('GOLEMAN', lx + ancho / 2, baseY + 9, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200, 206, 224);
        doc.text('IPS', lx + ancho / 2, baseY + 13, { align: 'center' });
      }
    } else if (b.tipo === 'titulo') {
      const tamano = b.tamano || 13;
      doc.setFont('helvetica', b.negrita ? 'bold' : 'normal');
      doc.setFontSize(tamano);
      doc.setTextColor(15, 23, 42);
      const texto = aplicarPlaceholders(b.texto || '', s);
      const { x, opt } = anchorX(b);
      const lineas = doc.splitTextToSize(texto, b.w);
      doc.text(lineas, x, baseY + tamano * 0.35, opt);
    } else if (b.tipo === 'texto') {
      const tamano = b.tamano || 11;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(tamano);
      doc.setTextColor(15, 23, 42);
      const texto = aplicarPlaceholders(b.texto || '', s);
      const { x, opt } = anchorX(b);
      const lineas = doc.splitTextToSize(texto, b.w);
      doc.text(lineas, x, baseY + tamano * 0.35, opt);
    } else if (b.tipo === 'campo') {
      const valor = valorCampo(s, b.campoKey);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      const baseLine = baseY + 4;
      if (b.etiqueta) {
        doc.setFont('helvetica', 'bold');
        doc.text(b.etiqueta, b.x, baseLine);
        doc.setFont('helvetica', 'normal');
        const offsetEtiqueta = doc.getTextWidth(b.etiqueta) + 3;
        doc.text(valor, b.x + offsetEtiqueta, baseLine);
        doc.setLineWidth(0.3);
        doc.line(b.x + offsetEtiqueta, baseLine + 1, b.x + b.w, baseLine + 1);
      } else {
        const { x, opt } = anchorX(b);
        doc.setFont('helvetica', 'normal');
        doc.text(valor, x, baseLine, opt);
      }
    } else if (b.tipo === 'tabla') {
      const cols = b.columnas && b.columnas.length > 0 ? b.columnas : ['FECHA', 'ITEM', 'VALOR'];
      const numCols = cols.length;
      const colWidth = b.w / numCols;
      const headY = baseY + 5;
      doc.setFillColor(15, 23, 42);
      doc.rect(b.x, baseY, b.w, 7, 'F');
      doc.setTextColor(212, 175, 55);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      cols.forEach((c, i) => doc.text(c, b.x + i * colWidth + 2, headY));
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      const fechaItem = s.creadoEn
        ? new Date(s.creadoEn.replace(' ', 'T')).toLocaleDateString('es-CO')
        : new Date().toLocaleDateString('es-CO');
      const concepto = String(s.datosFormulario?.observaciones ?? s.datosFormulario?.concepto ?? s.tipoNombre);
      const valor = String(s.datosFormulario?.valorPesos ?? '');
      const datosFila = [
        fechaItem,
        concepto,
        valor ? `$ ${Number(valor).toLocaleString('es-CO')}` : '',
      ];
      const dataRowY = baseY + 13;
      cols.forEach((_, i) => {
        const txt = datosFila[i] || '';
        doc.text(txt, b.x + i * colWidth + 2, dataRowY, { maxWidth: colWidth - 4 });
      });
      doc.setDrawColor(180, 180, 180);
      for (let i = 0; i < 6; i++) {
        const yy = baseY + 7 + i * 5;
        doc.line(b.x, yy, b.x + b.w, yy);
        for (let c = 1; c < numCols; c++) {
          doc.line(b.x + c * colWidth, baseY + 7, b.x + c * colWidth, baseY + 7 + 5 * 5);
        }
      }
      doc.line(b.x, baseY, b.x, baseY + 32);
      doc.line(b.x + b.w, baseY, b.x + b.w, baseY + 32);
    } else if (b.tipo === 'divider') {
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.5);
      doc.line(b.x, baseY, b.x + b.w, baseY);
    } else if (b.tipo === 'firma') {
      const firmaData = s.firmas?.[b.campoFirma] || '';
      if (firmaData && firmaData.startsWith('data:image')) {
        try {
          doc.addImage(firmaData, 'PNG', b.x, baseY, Math.min(b.w, 60), 22);
        } catch {
          // ignorar
        }
      }
      doc.setLineWidth(0.3);
      doc.line(b.x, baseY + 22, b.x + b.w, baseY + 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(b.etiqueta || 'Firma', b.x, baseY + 27);
      doc.setFont('helvetica', 'normal');
      if (b.campoFirma === 'profesional') {
        doc.text(s.solicitanteNombre || '', b.x, baseY + 32);
      }
    } else if (b.tipo === 'caja') {
      const alto = Math.max(5, Math.min(200, b.alto || 30));
      if (b.relleno) {
        doc.setFillColor(245, 224, 145);
        doc.rect(b.x, baseY, b.w, alto, 'FD');
      } else {
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.4);
        doc.rect(b.x, baseY, b.w, alto, 'S');
      }
      if (b.etiqueta) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(b.etiqueta, b.x + b.w / 2, baseY + alto / 2, { align: 'center' });
      }
    } else if (b.tipo === 'imagen') {
      if (b.src) {
        const dataUrl = logoCache.get(b.src);
        if (dataUrl) {
          try {
            const alto = b.w * 0.6;
            doc.addImage(dataUrl, 'PNG', b.x, baseY, b.w, alto);
          } catch {
            // ignorar
          }
        }
      }
    } else if (b.tipo === 'lista') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      const items = b.items || [];
      items.forEach((it, i) => {
        const prefix = b.conVinetas ? '• ' : '';
        doc.text(prefix + aplicarPlaceholders(it, s), b.x, baseY + 4 + i * 5, { maxWidth: b.w });
      });
    } else if (b.tipo === 'separador-doble') {
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.6);
      doc.line(b.x, baseY, b.x + b.w, baseY);
      doc.setLineWidth(0.3);
      doc.line(b.x, baseY + 1.5, b.x + b.w, baseY + 1.5);
    } else if (b.tipo === 'qr-radicado') {
      const t = Math.max(20, Math.min(60, b.tamano || 30));
      // Recuadro placeholder con número del radicado (QR real requeriría librería extra)
      doc.setFillColor(15, 23, 42);
      doc.rect(b.x, baseY, t, t, 'F');
      doc.setTextColor(212, 175, 55);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('RADICADO', b.x + t / 2, baseY + t / 2 - 3, { align: 'center' });
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(s.numeroRadicado, b.x + t / 2, baseY + t / 2 + 2, { align: 'center' });
    }
    }
  }

  // Footer con paginación
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Payops · Goleman IPS · ${i}/${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
  }

  if (opts?.bloburl) {
    return doc.output('bloburl') as unknown as string;
  }
  doc.save(filenameOverride || `Payops_${s.numeroRadicado}.pdf`);
}

/**
 * Genera el PDF del formato diligenciado y devuelve un blob URL para mostrarlo
 * embebido (iframe), sin descargarlo. Solo aplica si el tipo tiene plantilla PDF.
 */
export async function generarFormatoBlobUrl(s: SolicitudParaPdf): Promise<string | null> {
  if (!s.plantillaPdf) return null;
  const url = await generarPdfPlantilla(s, s.plantillaPdf, undefined, { bloburl: true });
  return typeof url === 'string' ? url : null;
}

export async function descargarPreviewPlantilla(
  plantilla: PlantillaPdf,
  campos: CampoPlantilla[],
  modo: 'vacia' | 'ejemplo',
): Promise<void> {
  const datos: Record<string, unknown> = {};
  if (modo === 'ejemplo') {
    for (const c of campos) {
      if (c.type === 'valor-pesos' || c.type === 'number') datos[c.key] = '1500000';
      else if (c.type === 'email') datos[c.key] = 'ejemplo@correo.com';
      else if (c.type === 'date') datos[c.key] = new Date().toISOString().slice(0, 10);
      else if (c.type === 'mes-anio') datos[c.key] = '05/2026';
      else if (c.type === 'cc' || c.type === 'nit') datos[c.key] = '1.020.456.789';
      else if (c.type === 'tipo-doc') datos[c.key] = 'CC';
      else if (c.type === 'banco-select') datos[c.key] = 'Bancolombia';
      else if (c.type === 'cuenta-bancaria') datos[c.key] = '0123456789';
      else if (c.type === 'direccion') datos[c.key] = 'Carrera 7 #74-21, Bogotá, Colombia';
      else if (c.type === 'select') datos[c.key] = 'Opción ejemplo';
      else if (c.type === 'textarea') datos[c.key] = 'Texto de ejemplo para verificar el diligenciamiento.';
      else if (c.type === 'file') datos[c.key] = '(archivo cargado)';
      else if (c.type === 'texto-fijo') datos[c.key] = c.label;
      else datos[c.key] = c.label;
    }
    datos['valorPesos__letras'] = 'UN MILLÓN QUINIENTOS MIL PESOS M/CTE';
    datos['ciudad'] = 'Bogotá D.C.';
  }
  const sintetica: SolicitudParaPdf = {
    numeroRadicado: modo === 'ejemplo' ? 'EJ-2026-00001' : 'PLANTILLA-VACÍA',
    tipoNombre: 'Vista previa',
    areaNombre: '',
    solicitanteNombre: modo === 'ejemplo' ? 'Juan Pérez García' : '',
    solicitanteCorreo: modo === 'ejemplo' ? 'juan.perez@ejemplo.com' : '',
    solicitanteDocumento: modo === 'ejemplo' ? '1.020.456.789' : '',
    datosFormulario: datos,
    documentos: {},
    alertas: [],
    estado: 'borrador',
    creadoEn: new Date().toISOString(),
    aprobadoEn: null,
    camposPlantilla: campos,
    movimientos: [],
    firmas: null,
    plantillaPdf: plantilla,
  };
  const filename = modo === 'ejemplo'
    ? 'Plantilla_EJEMPLO_diligenciada.pdf'
    : 'Plantilla_EN_BLANCO_a_diligenciar.pdf';
  await generarPdfPlantilla(sintetica, plantilla, filename);
}

export function generarPdfFormato(s: SolicitudParaPdf): void {
  if (s.plantillaPdf) {
    void generarPdfPlantilla(s, s.plantillaPdf);
    return;
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  // Header
  doc.setFillColor(7, 11, 29);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('PAYOPS', margin, 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 206, 224);
  doc.text('Goleman IPS · Formato de solicitud', margin, 22);
  // Numero de radicado arriba a la derecha (destacado)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(9);
  doc.text('RADICADO', pageWidth - margin, 13, { align: 'right' });
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(s.numeroRadicado, pageWidth - margin, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 206, 224);
  doc.text(new Date().toLocaleString('es-CO'), pageWidth - margin, 25, { align: 'right' });

  y = 38;

  // Numero de radicado
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Radicado:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(s.numeroRadicado, margin + 28, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Tipo:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(s.tipoNombre, margin + 28, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Area:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(s.areaNombre, margin + 28, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Estado:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(s.estado.toUpperCase(), margin + 28, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Creado:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(s.creadoEn.replace(' ', 'T') + 'Z').toLocaleString('es-CO'), margin + 28, y);
  if (s.aprobadoEn) {
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Aprobado:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(s.aprobadoEn.replace(' ', 'T') + 'Z').toLocaleString('es-CO'), margin + 28, y);
  }
  y += 8;

  // Solicitante
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(184, 144, 31);
  doc.setFontSize(11);
  doc.text('DATOS DEL SOLICITANTE', margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  if (s.solicitanteNombre) {
    doc.text(`Nombre: ${s.solicitanteNombre}`, margin, y); y += 5;
  }
  if (s.solicitanteCorreo) {
    doc.text(`Correo: ${s.solicitanteCorreo}`, margin, y); y += 5;
  }
  if (s.solicitanteDocumento) {
    doc.text(`Documento: ${s.solicitanteDocumento}`, margin, y); y += 5;
  }
  y += 4;

  // Datos por grupo
  const grupos = new Map<string, CampoPlantilla[]>();
  s.camposPlantilla.forEach((c) => {
    const g = c.group || 'Datos';
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(c);
  });

  grupos.forEach((campos, grupo) => {
    if (y > 260) { doc.addPage(); y = margin; }
    doc.setDrawColor(212, 175, 55);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(184, 144, 31);
    doc.setFontSize(11);
    doc.text(grupo.toUpperCase(), margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    campos.forEach((c) => {
      if (y > 270) { doc.addPage(); y = margin; }
      const valor = c.type === 'file'
        ? (typeof s.documentos[c.key] === 'object' && s.documentos[c.key] !== null
            ? (s.documentos[c.key] as { nombre?: string }).nombre || '—'
            : String(s.documentos[c.key] ?? '—'))
        : String(s.datosFormulario[c.key] ?? '—');
      const linea = `${c.label}: ${valor}`;
      const split = doc.splitTextToSize(linea, pageWidth - margin * 2);
      doc.text(split, margin, y);
      y += split.length * 5;
    });
    y += 4;
  });

  // Alertas
  if (s.alertas.length > 0) {
    if (y > 250) { doc.addPage(); y = margin; }
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 122, 51);
    doc.setFontSize(11);
    doc.text(`ALERTAS DETECTADAS (${s.alertas.length})`, margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(120, 60, 20);
    doc.setFont('helvetica', 'normal');
    s.alertas.forEach((a) => {
      if (y > 270) { doc.addPage(); y = margin; }
      const split = doc.splitTextToSize(`• [${a.severidad || 'media'}] ${a.descripcion || a.tipo}`, pageWidth - margin * 2);
      doc.text(split, margin, y);
      y += split.length * 4;
    });
    y += 4;
  }

  // Trazabilidad
  if (s.movimientos.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setDrawColor(212, 175, 55);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(184, 144, 31);
    doc.setFontSize(11);
    doc.text('TRAZABILIDAD', margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    s.movimientos.forEach((m) => {
      if (y > 275) { doc.addPage(); y = margin; }
      const fecha = new Date(m.creadoEn.replace(' ', 'T') + 'Z').toLocaleString('es-CO');
      const linea = `${fecha} · ${m.accion.toUpperCase()}` +
        (m.paso ? ` · paso: ${m.paso}` : '') +
        (m.usuarioNombre ? ` · ${m.usuarioNombre}` : '') +
        (m.comentario ? `\n   "${m.comentario}"` : '');
      const split = doc.splitTextToSize(linea, pageWidth - margin * 2);
      doc.text(split, margin, y);
      y += split.length * 4 + 1;
    });
  }

  // Firmas: profesional (izq), coordinador (centro), contabilidad (der)
  const firmas = s.firmas || {};
  const firmaProfesional = firmas.profesional || firmas.analista || '';
  const firmaCoordinador = firmas.coordinador || '';
  const firmaContabilidad = firmas.contabilidad || '';
  // Reservar espacio para firmas (40mm). Si no cabe, nueva pagina.
  if (y > 230) { doc.addPage(); y = margin; }
  const firmasY = Math.max(y + 6, 235);
  const colWidth = (pageWidth - margin * 2) / 3;
  const firmaImgH = 22;
  const firmaImgW = colWidth - 8;

  const drawFirma = (dataUrl: string, label: string, nota: string, colIndex: number) => {
    const cx = margin + colWidth * colIndex + 4;
    const lineY = firmasY + firmaImgH + 2;
    if (dataUrl && dataUrl.startsWith('data:image')) {
      try {
        doc.addImage(dataUrl, 'PNG', cx, firmasY, firmaImgW, firmaImgH);
      } catch {
        // ignorar errores de imagen
      }
    }
    // Linea de firma
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.line(cx, lineY, cx + firmaImgW, lineY);
    // Etiqueta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(label, cx + firmaImgW / 2, lineY + 4, { align: 'center' });
    if (nota) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(nota, cx + firmaImgW / 2, lineY + 8, { align: 'center' });
    }
  };

  drawFirma(firmaProfesional, 'Profesional solicitante', 'Diligenciamiento', 0);
  drawFirma(firmaCoordinador, 'Coordinador', 'Validación', 1);
  drawFirma(firmaContabilidad, 'Contabilidad', 'Finalización', 2);

  // Footer en cada pagina
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Payops · Goleman IPS · ${i}/${totalPages}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
  }

  doc.save(`Payops_${s.numeroRadicado}.pdf`);
}
