import jsPDF from 'jspdf';

interface CampoPlantilla {
  key: string;
  label: string;
  type: string;
  group?: string;
  operandos?: string[];
  operacion?: 'suma' | 'resta' | 'multiplicacion' | 'division';
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

// Fecha de la solicitud (creación) en formato largo; cae a hoy solo si no hay dato.
function fechaSolicitud(s: SolicitudParaPdf): string {
  const raw = s.creadoEn;
  const d = raw ? new Date(raw.replace(' ', 'T')) : new Date();
  const valida = !isNaN(d.getTime()) ? d : new Date();
  return valida.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Convierte un texto monetario ("$ 1.500.000", "1500000", "1,500,000.50") a número.
// Formato colombiano: el punto es separador de miles. Devuelve 0 si no hay dígitos.
function parseMoneda(texto: string): number {
  const limpio = String(texto).replace(/[^0-9,.-]/g, '').trim();
  if (!limpio) return 0;
  // Quita separadores de miles (puntos) y usa coma decimal si existe
  const normal = limpio.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normal);
  return isNaN(n) ? 0 : n;
}

// Busca en los datos una tabla de ítems (campo tipo 'tabla-items' guardado como JSON array)
function tablaItemsDeDatos(s: SolicitudParaPdf): { columnas: string[]; filas: Record<string, string>[] } | null {
  const d = s.datosFormulario || {};
  for (const k of Object.keys(d)) {
    const v = d[k];
    if (typeof v === 'string' && v.trim().startsWith('[')) {
      try {
        const a = JSON.parse(v);
        if (Array.isArray(a) && a.length && a[0] && typeof a[0] === 'object') {
          return { columnas: Object.keys(a[0]), filas: a };
        }
      } catch { /* no era tabla */ }
    }
  }
  return null;
}

function aplicarPlaceholders(texto: string, s: SolicitudParaPdf): string {
  const d = s.datosFormulario || {};
  const valor = String(d.valorPesos ?? d.valor ?? '');
  const valorLetras = String(d.valorPesos__letras ?? d.valorLetras ?? '');
  const concepto = String(d.observaciones ?? d.concepto ?? d.descripcion ?? '');
  const ciudad = String(d.lugarExpedicion ?? d.ciudad ?? '');
  const fecha = fechaSolicitud(s);
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
  // Fallback: cualquier {{campoKey}} restante se reemplaza por el dato diligenciado
  out = out.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    const raw = d[k];
    if (raw == null || typeof raw === 'object') return '';
    return String(raw);
  });
  return out;
}

function valorCampo(s: SolicitudParaPdf, key: string): string {
  if (key === '__radicado') return s.numeroRadicado;
  if (key === '__nombre') return s.solicitanteNombre || '';
  if (key === '__cedula') return s.solicitanteDocumento || '';
  if (key === '__correo') return s.solicitanteCorreo || '';
  if (key === '__fecha') return fechaSolicitud(s);
  if (key === '__ciudad') {
    const d = s.datosFormulario || {};
    return String(d.lugarExpedicion ?? d.ciudad ?? 'Bogotá');
  }
  // Campo calculado: si tiene definición, recalcula desde sus operandos y formatea como moneda
  const def = (s.camposPlantilla || []).find((c) => c.key === key);
  if (def && def.type === 'calculado') {
    const datos = s.datosFormulario || {};
    const operandos = def.operandos || [];
    const vals = operandos.map((k) => parseMoneda(String(datos[k] ?? '')));
    let total = 0;
    if (vals.length > 0) {
      total = vals.reduce((acc, v, i) => {
        if (i === 0) return v;
        switch (def.operacion) {
          case 'resta': return acc - v;
          case 'multiplicacion': return acc * v;
          case 'division': return v === 0 ? acc : acc / v;
          default: return acc + v;
        }
      });
    } else {
      total = parseMoneda(String(datos[key] ?? ''));
    }
    return `$ ${(Math.round(total * 100) / 100).toLocaleString('es-CO')}`;
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
    if (b.tipo === 'encabezado') urlsACargar.add(b.src || LOGO_DEFAULT);
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
    if (b.tipo === 'encabezado') {
      // Recuadro oficial: 3 columnas (logo | título/proceso/área | código/fecha/versión/página)
      const filaH = 7;
      const totalH = filaH * 4;
      const colLogoW = b.w * 0.24;
      const colMetaW = b.w * 0.27;
      const colTitX = b.x + colLogoW;
      const colMetaX = b.x + b.w - colMetaW;
      const colTitW = colMetaX - colTitX;
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.3);
      // Marco exterior
      doc.rect(b.x, baseY, b.w, totalH);
      // Líneas verticales
      doc.line(colTitX, baseY, colTitX, baseY + totalH);
      doc.line(colMetaX, baseY, colMetaX, baseY + totalH);
      // Líneas horizontales de la columna meta (4 filas)
      for (let i = 1; i < 4; i++) doc.line(colMetaX, baseY + filaH * i, b.x + b.w, baseY + filaH * i);
      // Separadores de la columna central (título ocupa 2 filas)
      doc.line(colTitX, baseY + filaH * 2, colMetaX, baseY + filaH * 2);
      doc.line(colTitX, baseY + filaH * 3, colMetaX, baseY + filaH * 3);
      // Logo
      const dataUrl = logoCache.get(b.src || LOGO_DEFAULT) || null;
      if (dataUrl) {
        try {
          const lw = Math.min(colLogoW - 4, 30);
          const lh = lw * 0.55;
          doc.addImage(dataUrl, 'PNG', b.x + (colLogoW - lw) / 2, baseY + (totalH - lh) / 2, lw, lh);
        } catch { /* ignorar */ }
      }
      // Columna central
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(b.titulo || '', colTitW - 4), colTitX + colTitW / 2, baseY + filaH, { align: 'center', baseline: 'middle' });
      doc.setFontSize(8);
      doc.text(b.subtitulo || '', colTitX + colTitW / 2, baseY + filaH * 2.5, { align: 'center', baseline: 'middle' });
      doc.text(b.area || '', colTitX + colTitW / 2, baseY + filaH * 3.5, { align: 'center', baseline: 'middle' });
      // Columna meta
      doc.setFontSize(7.5);
      const metaTx = colMetaX + 2;
      const metas: Array<[string, string]> = [
        ['Código:', b.codigo || ''], ['Fecha:', b.fecha || ''],
        ['Versión:', b.version || ''], ['Página:', b.paginaTexto || ''],
      ];
      metas.forEach(([k, v], i) => {
        const y = baseY + filaH * i + filaH / 2;
        doc.setFont('helvetica', 'bold');
        doc.text(k, metaTx, y, { baseline: 'middle' });
        doc.setFont('helvetica', 'normal');
        doc.text(String(v), metaTx + doc.getTextWidth(k) + 1.5, y, { baseline: 'middle' });
      });
    } else if (b.tipo === 'logo') {
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
      const items = tablaItemsDeDatos(s);
      const cols = items ? items.columnas : (b.columnas && b.columnas.length > 0 ? b.columnas : ['FECHA', 'ITEM', 'VALOR']);
      const numCols = cols.length || 1;
      const colWidth = b.w / numCols;
      // Encabezado
      doc.setFillColor(15, 23, 42);
      doc.rect(b.x, baseY, b.w, 7, 'F');
      doc.setTextColor(212, 175, 55);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      cols.forEach((c, i) => doc.text(String(c), b.x + i * colWidth + 2, baseY + 5, { maxWidth: colWidth - 4 }));
      // Filas de datos
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      let filas: string[][];
      if (items) {
        filas = items.filas.map((r) => cols.map((c) => String(r[c] ?? '')));
      } else {
        const concepto = String(s.datosFormulario?.observaciones ?? s.datosFormulario?.concepto ?? '');
        const valor = String(s.datosFormulario?.valorPesos ?? '');
        filas = [[fechaSolicitud(s), concepto, valor ? `$ ${Number(valor).toLocaleString('es-CO')}` : ''].slice(0, numCols)];
      }
      const rowH = 6;
      const totalRows = Math.max(filas.length, items ? filas.length : 3);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      for (let r = 0; r < totalRows; r++) {
        const rowTop = baseY + 7 + r * rowH;
        const fila = filas[r];
        if (fila) {
          fila.forEach((txt, i) => doc.text(String(txt || ''), b.x + i * colWidth + 2, rowTop + 4, { maxWidth: colWidth - 4 }));
        }
        doc.line(b.x, rowTop + rowH, b.x + b.w, rowTop + rowH);
      }
      const bottom = baseY + 7 + totalRows * rowH;
      doc.line(b.x, baseY, b.x, bottom);
      doc.line(b.x + b.w, baseY, b.x + b.w, bottom);
      for (let c = 1; c < numCols; c++) {
        doc.line(b.x + c * colWidth, baseY, b.x + c * colWidth, bottom);
      }
      // Fila de total automática (suma de la columna de valores)
      if (b.conTotal && numCols >= 2) {
        const colTotalIdx = (() => {
          const i = cols.findIndex((c) => String(c).toUpperCase().includes('VALOR'));
          return i >= 0 ? i : numCols - 1;
        })();
        const suma = filas.reduce((acc, fila) => acc + parseMoneda(fila[colTotalIdx] ?? ''), 0);
        const totalH = 7;
        const totBottom = bottom + totalH;
        doc.setFillColor(240, 240, 244);
        doc.rect(b.x, bottom, b.w, totalH, 'F');
        doc.setDrawColor(60, 60, 60);
        doc.setLineWidth(0.3);
        doc.rect(b.x, bottom, b.w, totalH);
        doc.line(b.x + colTotalIdx * colWidth, bottom, b.x + colTotalIdx * colWidth, totBottom);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(b.etiquetaTotal || 'TOTAL', b.x + colTotalIdx * colWidth - 2, bottom + 5, { align: 'right' });
        doc.text(`$ ${suma.toLocaleString('es-CO')}`, b.x + colTotalIdx * colWidth + 2, bottom + 5);
      }
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
