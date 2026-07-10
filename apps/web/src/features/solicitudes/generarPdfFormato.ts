import jsPDF from 'jspdf';
import { numeroAPesosEnLetras } from '../../utils/numeroALetras';

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
  tipoSlug?: string;
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
    const bloquesPag = paginas.get(numerosPagina[pIdx]) || [];
    // Si la página tiene encabezado oficial, NO se dibuja el radicado en la esquina
    // (evita que se encime con el recuadro; el radicado va dentro del formato vía {{radicado}}).
    const tieneEncabezado = bloquesPag.some((b) => b.tipo === 'encabezado');
    if (!tieneEncabezado) dibujarRadicadoEsquina();

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
      // Columna central (los campos admiten tokens: {{radicado}}, {{fecha}}, etc.)
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(aplicarPlaceholders(b.titulo || '', s), colTitW - 4), colTitX + colTitW / 2, baseY + filaH, { align: 'center', baseline: 'middle' });
      doc.setFontSize(8);
      doc.text(aplicarPlaceholders(b.subtitulo || '', s), colTitX + colTitW / 2, baseY + filaH * 2.5, { align: 'center', baseline: 'middle' });
      doc.text(aplicarPlaceholders(b.area || '', s), colTitX + colTitW / 2, baseY + filaH * 3.5, { align: 'center', baseline: 'middle' });
      // Columna meta
      doc.setFontSize(7.5);
      const metaTx = colMetaX + 2;
      const metas: Array<[string, string]> = [
        ['Código:', aplicarPlaceholders(b.codigo || '', s)], ['Fecha:', aplicarPlaceholders(b.fecha || '', s)],
        ['Versión:', aplicarPlaceholders(b.version || '', s)], ['Página:', aplicarPlaceholders(b.paginaTexto || '', s)],
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
  const esLegalizacion = s.tipoSlug === 'legalizacion'
    || typeof s.datosFormulario['gastos'] === 'string';
  const esViaticos = s.tipoSlug === 'viaticos'
    || typeof s.datosFormulario['tiqueteIda'] === 'string';
  const esAnticipo = s.tipoSlug === 'anticipo'
    || typeof s.datosFormulario['items'] === 'string';
  const esCuentaCobroOpsB = s.tipoSlug === 'cuenta-cobro-ops';
  if (esLegalizacion || esViaticos || esAnticipo || esCuentaCobroOpsB) {
    const url = _generarPdfEspecial(s, { bloburl: true });
    return typeof url === 'string' ? url : null;
  }
  if (!s.plantillaPdf) return null;
  const url = await generarPdfPlantilla(s, s.plantillaPdf, undefined, { bloburl: true });
  return typeof url === 'string' ? url : null;
}

export async function previewPlantillaBlobUrl(
  plantilla: PlantillaPdf,
  campos: CampoPlantilla[],
): Promise<string | null> {
  const datos: Record<string, unknown> = {};
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
  const sintetica: SolicitudParaPdf = {
    numeroRadicado: 'EJ-2026-00001',
    tipoNombre: 'Vista previa',
    areaNombre: '',
    solicitanteNombre: 'Juan Pérez García',
    solicitanteCorreo: 'juan.perez@ejemplo.com',
    solicitanteDocumento: '1.020.456.789',
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
  const url = await generarPdfPlantilla(sintetica, plantilla, undefined, { bloburl: true });
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

function formatFechaBullet(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function drawInfoGrid(
  doc: jsPDF,
  items: Array<[string, string]>,
  margin: number,
  pageWidth: number,
  startY: number,
): number {
  let y = startY;
  const cols = 2;
  const colW = (pageWidth - margin * 2) / cols;
  for (let i = 0; i < items.length; i += cols) {
    const row = items.slice(i, i + cols);
    let maxH = 0;
    row.forEach(([label, val], ci) => {
      const x = margin + ci * colW;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 140);
      doc.text(label.toUpperCase(), x, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const lines = doc.splitTextToSize(val || '—', colW - 4);
      doc.text(lines, x, y + 4.5);
      maxH = Math.max(maxH, lines.length * 4.5 + 7);
    });
    y += maxH;
  }
  return y;
}

function _generarPdfEspecial(s: SolicitudParaPdf, opts?: { bloburl?: boolean }): string | void {
  const esLegalizacion = s.tipoSlug === 'legalizacion'
    || typeof s.datosFormulario['gastos'] === 'string';
  const esViaticos = s.tipoSlug === 'viaticos'
    || typeof s.datosFormulario['tiqueteIda'] === 'string';
  const esAnticipo = s.tipoSlug === 'anticipo'
    || typeof s.datosFormulario['items'] === 'string';
  const esCuentaCobroOps = s.tipoSlug === 'cuenta-cobro-ops';

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

  y = 36;

  // Info grid (radicado, tipo, área, estado, fechas)
  const fechaCreacion = (() => {
    try { return new Date(s.creadoEn.replace(' ', 'T') + 'Z').toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' }); }
    catch { return s.creadoEn; }
  })();
  const infoItems: Array<[string, string]> = [
    ['Radicado', s.numeroRadicado],
    ['Estado', s.estado.toUpperCase()],
    ['Tipo de solicitud', s.tipoNombre],
    ['Fecha de radicación', fechaCreacion],
    ['Área', s.areaNombre || '—'],
    ...(s.aprobadoEn ? [['Aprobado el', new Date(s.aprobadoEn.replace(' ','T')+'Z').toLocaleDateString('es-CO')] as [string,string]] : []),
  ];
  doc.setFillColor(245, 246, 250);
  const infoBoxH = Math.ceil(infoItems.length / 2) * 11 + 6;
  doc.rect(margin, y, pageWidth - margin * 2, infoBoxH, 'F');
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, pageWidth - margin * 2, infoBoxH);
  y += 5;
  y = drawInfoGrid(doc, infoItems, margin + 2, pageWidth - 2, y);
  y += 4;

  // Título principal centrado
  if (esLegalizacion || esViaticos || esAnticipo || esCuentaCobroOps) {
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(7, 11, 29);
    doc.text(
      esLegalizacion ? 'SOLICITUD DE LEGALIZACIÓN DE GASTOS'
      : esViaticos ? 'SOLICITUD DE VIÁTICOS'
      : esAnticipo ? 'SOLICITUD DE ANTICIPO DE GASTOS'
      : 'CUENTA DE COBRO — CONTRATO DE PRESTACIÓN DE SERVICIOS OPS',
      pageWidth / 2, y, { align: 'center' },
    );
    y += 5;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  }

  // Solicitante (omitir para CuentaCobroOps que tiene su propia sección detallada)
  if (!esCuentaCobroOps) {
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(184, 144, 31);
    doc.setFontSize(11);
    doc.text('DATOS DEL SOLICITANTE', margin, y);
    y += 6;
    const solItems: Array<[string, string]> = [];
    if (s.solicitanteNombre) solItems.push(['Nombre completo', s.solicitanteNombre]);
    if (s.solicitanteDocumento) solItems.push(['Documento', s.solicitanteDocumento]);
    if (s.solicitanteCorreo) solItems.push(['Correo electrónico', s.solicitanteCorreo]);
    y = drawInfoGrid(doc, solItems, margin, pageWidth, y);
    y += 4;
  }

  // Párrafo narrativo de legalización
  if (esLegalizacion) {
    const concepto = String(s.datosFormulario['concepto'] || '');
    const periodo = String(s.datosFormulario['fechaPeriodo'] || '');
    const autorizador = String(s.datosFormulario['autorizadorNombre'] || '');
    const banco = String(s.datosFormulario['banco'] || '');
    const tipoCuenta = String(s.datosFormulario['tipoCuenta'] || '');
    const numCuenta = String(s.datosFormulario['numeroCuenta'] || '');
    const titular = String(s.datosFormulario['titularCuenta'] || '');
    const totalGastosRaw = String(s.datosFormulario['totalGastos'] || '');
    const totalFmt = totalGastosRaw
      ? `$${Number(totalGastosRaw.replace(/[^0-9.]/g, '')).toLocaleString('es-CO')}`
      : '';
    const tipoDoc = s.solicitanteDocumento ? 'identificado(a) con documento N°' : '';
    const narrativa = [
      `Yo, ${s.solicitanteNombre || 'el(la) suscrito(a)'}${tipoDoc ? ', ' + tipoDoc + ' ' + (s.solicitanteDocumento || '') : ''},`,
      `por medio del presente documento solicito la legalización de gastos` +
        (concepto ? ` por concepto de "${concepto}"` : '') +
        (totalFmt ? ` por un valor total de ${totalFmt}` : '') +
        (periodo ? `, correspondiente al período ${periodo}` : '') + '.',
      autorizador ? `Gastos autorizados por: ${autorizador}.` : '',
      (banco && numCuenta)
        ? `Solicito el desembolso a cuenta ${tipoCuenta || 'bancaria'} N° ${numCuenta} del banco ${banco}${titular ? ', a nombre de ' + titular : ''}.`
        : '',
    ].filter(Boolean).join(' ');

    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    const split = doc.splitTextToSize(narrativa, pageWidth - margin * 2);
    doc.text(split, margin, y);
    y += split.length * 5 + 6;
  }

  // Narrativa de viáticos
  if (esViaticos) {
    const motivoViaje = String(s.datosFormulario['motivoViaje'] || '');
    const ciudadOrigen = String(s.datosFormulario['ciudadOrigen'] || '');
    const ciudadDestino = String(s.datosFormulario['ciudadDestino'] || '');
    const fechaIda = String(s.datosFormulario['fechaIda'] || '');
    const fechaRegreso = String(s.datosFormulario['fechaRegreso'] || '');
    const tipoViatico = String(s.datosFormulario['tipoViatico'] || '');
    const autorizador = String(s.datosFormulario['autorizadorNombre'] || '');
    const totalGeneral = String(s.datosFormulario['totalGeneral'] || '');
    const totalFmt = totalGeneral
      ? `$${Number(totalGeneral.replace(/[^0-9]/g, '')).toLocaleString('es-CO')}`
      : '';
    const tipoDoc = s.solicitanteDocumento ? 'identificado(a) con documento N°' : '';
    const accion = tipoViatico === 'anticipo' ? 'solicito anticipo de viáticos' : 'solicito legalización de viáticos';
    const ruta = ciudadOrigen && ciudadDestino ? ` para viajar de ${ciudadOrigen} a ${ciudadDestino}` : '';
    const fechas = fechaIda ? ` el ${fechaIda}${fechaRegreso ? ` con regreso el ${fechaRegreso}` : ''}` : '';
    const narrativa = [
      `Yo, ${s.solicitanteNombre || 'el(la) suscrito(a)'}${tipoDoc ? ', ' + tipoDoc + ' ' + (s.solicitanteDocumento || '') : ''},`,
      `${accion}${ruta}${fechas}${motivoViaje ? ` por motivo de: ${motivoViaje}` : ''}${totalFmt ? `, por un valor total de ${totalFmt}` : ''}.`,
      autorizador ? `Viaje autorizado por: ${autorizador}.` : '',
    ].filter(Boolean).join(' ');
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    const split = doc.splitTextToSize(narrativa, pageWidth - margin * 2);
    doc.text(split, margin, y);
    y += split.length * 5 + 6;
  }

  // Bloque especial: gastos de legalización (datosFormulario.gastos = JSON array)
  const rawGastos = s.datosFormulario['gastos'];
  if (rawGastos && typeof rawGastos === 'string') {
    try {
      const gastosArr = JSON.parse(rawGastos) as Record<string, string>[];
      if (Array.isArray(gastosArr) && gastosArr.length > 0) {
        if (y > 240) { doc.addPage(); y = margin; }
        // Encabezado de sección
        doc.setFillColor(7, 11, 29);
        doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(212, 175, 55);
        doc.setFontSize(9);
        doc.text('RELACIÓN DE GASTOS LEGALIZADOS', margin + 3, y + 5);
        y += 10;
        // Info grid: concepto, período, autorizador
        const concepto = String(s.datosFormulario['concepto'] || '');
        const periodo = String(s.datosFormulario['fechaPeriodo'] || '');
        const autorizador = String(s.datosFormulario['autorizadorNombre'] || '');
        const infoItems: Array<[string, string]> = [];
        if (concepto) infoItems.push(['Concepto', concepto]);
        if (periodo) infoItems.push(['Período', periodo]);
        if (autorizador) infoItems.push(['Autorizado por', autorizador]);
        if (infoItems.length > 0) {
          y = drawInfoGrid(doc, infoItems, margin, pageWidth, y);
          y += 3;
        }
        // Tabla de gastos
        const cols = ['#', 'Categoría', 'Descripción', 'Fecha', 'Valor', 'Proveedor'];
        const absW = [0.05, 0.14, 0.30, 0.11, 0.13, 0.27].map((r) => (pageWidth - margin * 2) * r);
        // Header row
        doc.setFillColor(212, 175, 55);
        doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F');
        doc.setTextColor(7, 11, 29);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        let cx = margin;
        cols.forEach((col, i) => {
          doc.text(col, cx + 1, y + 3.8);
          cx += absW[i];
        });
        y += 5.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(8);
        let totalLegal = 0;
        gastosArr.forEach((g, idx) => {
          if (y > 275) { doc.addPage(); y = margin; }
          const valor = Number(String(g.valor || '0').replace(/[^0-9]/g, ''));
          totalLegal += valor;
          const vals = [
            String(idx + 1),
            g.categoria || '',
            g.descripcion || '',
            g.fechaGasto || '',
            `$${valor.toLocaleString('es-CO')}`,
            g.nombreProveedor || '',
          ];
          const bg = idx % 2 === 0 ? [245, 245, 248] as [number,number,number] : [255, 255, 255] as [number,number,number];
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.rect(margin, y, pageWidth - margin * 2, 5, 'F');
          cx = margin;
          vals.forEach((v, i) => {
            const txt = doc.splitTextToSize(v, absW[i] - 1.5);
            doc.text(txt[0] || '', cx + 1, y + 3.5);
            cx += absW[i];
          });
          y += 5;
          if (g._factura || g.numeroFactura || g.nitProveedor) {
            doc.setTextColor(100, 100, 120);
            doc.setFontSize(6.5);
            const factLine = [`Factura: ${g._factura || ''}`, g.numeroFactura ? `N° ${g.numeroFactura}` : '', g.nitProveedor ? `NIT ${g.nitProveedor}` : ''].filter(Boolean).join(' · ');
            doc.text(`  ${factLine}`, margin + 6, y + 1.5);
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            y += 3.5;
          }
        });
        // Total row
        doc.setFillColor(7, 11, 29);
        doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(212, 175, 55);
        doc.text('TOTAL LEGALIZADO', margin + 1, y + 4.2);
        doc.text(`$ ${totalLegal.toLocaleString('es-CO')}`, pageWidth - margin - 1, y + 4.2, { align: 'right' });
        y += 8;
        // Valor en letras
        if (totalLegal > 0) {
          if (y > 272) { doc.addPage(); y = margin; }
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8.5);
          doc.setTextColor(80, 80, 100);
          const letrasL = `(${numeroAPesosEnLetras(String(totalLegal))})`;
          const letrasLLines = doc.splitTextToSize(letrasL, pageWidth - margin * 2);
          doc.text(letrasLLines, margin, y);
          y += letrasLLines.length * 4.5 + 3;
          doc.setTextColor(15, 23, 42);
        }
        // Datos bancarios
        if (y > 265) { doc.addPage(); y = margin; }
        doc.setFillColor(7, 11, 29);
        doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(212, 175, 55);
        doc.setFontSize(9);
        doc.text('DATOS BANCARIOS PARA EL PAGO', margin + 3, y + 5);
        y += 10;
        const bancoL = String(s.datosFormulario['banco'] || '');
        const nroCtaL = String(s.datosFormulario['numeroCuenta'] || '');
        const titularL = String(s.datosFormulario['titularCuenta'] || '');
        const tipoCtaL = String(s.datosFormulario['tipoCuenta'] || '');
        y = drawInfoGrid(doc, [
          ['Banco', bancoL || '—'],
          ['Tipo de cuenta', tipoCtaL || '—'],
          ['Número de cuenta', nroCtaL || '—'],
          ['Titular', titularL || '—'],
        ], margin, pageWidth, y);
        y += 4;
      }
    } catch { /* no era gastos válidos */ }
  }

  // Bloque especial: viáticos (tiquetes, hospedaje, alimentación)
  const rawTiqueteIda = s.datosFormulario['tiqueteIda'];
  if (esViaticos && rawTiqueteIda && typeof rawTiqueteIda === 'string') {
    try {
      const tIda = JSON.parse(rawTiqueteIda) as Record<string, string>;
      const rawVuelta = String(s.datosFormulario['tiqueteVuelta'] || '');
      const tVuelta: Record<string, string> | null = rawVuelta ? JSON.parse(rawVuelta) : null;
      const fmt = (v: string) => { const n = Number(String(v || '0').replace(/[^0-9]/g, '')); return n ? `$ ${n.toLocaleString('es-CO')}` : '—'; };

      const seccionViat = (titulo: string) => {
        if (y > 255) { doc.addPage(); y = margin; }
        y += 2;
        doc.setFillColor(7, 11, 29);
        doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(212, 175, 55);
        doc.setFontSize(9);
        doc.text(titulo, margin + 3, y + 5);
        y += 10;
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'normal');
      };

      // Encabezado info viaje
      seccionViat('1. INFORMACIÓN DEL VIAJE');
      const ciudadOrigen = String(s.datosFormulario['ciudadOrigen'] || '');
      const ciudadDestino = String(s.datosFormulario['ciudadDestino'] || '');
      const fechaIda = String(s.datosFormulario['fechaIda'] || '');
      const fechaRegreso = String(s.datosFormulario['fechaRegreso'] || '');
      const autorizadorViat = String(s.datosFormulario['autorizadorNombre'] || '');
      const viatInfoItems: Array<[string, string]> = [];
      if (ciudadOrigen && ciudadDestino) viatInfoItems.push(['Ruta', `${ciudadOrigen} - ${ciudadDestino}`]);
      if (fechaIda) viatInfoItems.push(['Fecha de ida', fechaIda]);
      if (fechaRegreso) viatInfoItems.push(['Fecha de regreso', fechaRegreso]);
      if (autorizadorViat) viatInfoItems.push(['Autorizado por', autorizadorViat]);
      if (viatInfoItems.length > 0) {
        y = drawInfoGrid(doc, viatInfoItems, margin, pageWidth, y);
        y += 3;
      }

      // Tabla de tiquetes
      seccionViat('2. TIQUETES DE TRANSPORTE');
      const tCols = ['Trayecto', 'Tipo', 'Empresa', 'N° vuelo/tiquete', 'Salida', 'Llegada', 'Valor'];
      const tW = [0.10, 0.09, 0.16, 0.19, 0.10, 0.10, 0.14].map((r) => (pageWidth - margin * 2) * r);
      if (y > 265) { doc.addPage(); y = margin; }
      doc.setFillColor(212, 175, 55);
      doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F');
      doc.setTextColor(7, 11, 29);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      let cx = margin;
      tCols.forEach((col, i) => { doc.text(col, cx + 1, y + 3.8); cx += tW[i]; });
      y += 5.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const tRows = [['Ida', tIda], ...(tVuelta ? [['Vuelta', tVuelta]] : [])] as [string, Record<string, string>][];
      tRows.forEach(([label, t], idx) => {
        if (y > 275) { doc.addPage(); y = margin; }
        const vals = [
          label,
          t.tipo === 'aereo' ? 'Aéreo' : 'Terrestre',
          t.empresa || '',
          t.numDoc || '',
          t.horaSalida || '',
          t.horaLlegada || '',
          fmt(t.valor),
        ];
        const bg = idx % 2 === 0 ? [245, 245, 248] as [number,number,number] : [255, 255, 255] as [number,number,number];
        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.rect(margin, y, pageWidth - margin * 2, 5, 'F');
        cx = margin;
        vals.forEach((v, i) => { doc.text(doc.splitTextToSize(v, tW[i] - 1)[0] || '', cx + 1, y + 3.5); cx += tW[i]; });
        y += 5;
      });
      const totalTransporte = String(s.datosFormulario['totalTransporte'] || '');
      if (Number(totalTransporte) > 0) {
        doc.setFillColor(7, 11, 29);
        doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(212, 175, 55);
        doc.text('SUBTOTAL TRANSPORTE', margin + 1, y + 3.8);
        doc.text(fmt(totalTransporte), pageWidth - margin - 1, y + 3.8, { align: 'right' });
        y += 7;
      }

      // Hospedaje
      const tieneHospedaje = String(s.datosFormulario['tieneHospedaje'] || '') === 'true';
      if (tieneHospedaje) {
        seccionViat('3. ALOJAMIENTO');
        const hotelNombre = String(s.datosFormulario['hotelNombre'] || '');
        const hotelEntrada = String(s.datosFormulario['hotelEntrada'] || '');
        const hotelSalida = String(s.datosFormulario['hotelSalida'] || '');
        const hotelNoches = String(s.datosFormulario['hotelNoches'] || '');
        const hotelValorNoche = String(s.datosFormulario['hotelValorNoche'] || '');
        const totalHospedaje = String(s.datosFormulario['totalHospedaje'] || '');
        const hospItems: Array<[string, string]> = [
          ['Hotel / Alojamiento', hotelNombre || '—'],
          ['Noches', hotelNoches || '—'],
          ['Fecha entrada', hotelEntrada || '—'],
          ['Fecha salida', hotelSalida || '—'],
          ['Valor por noche', fmt(hotelValorNoche)],
          ['Total alojamiento', fmt(totalHospedaje)],
        ];
        y = drawInfoGrid(doc, hospItems, margin, pageWidth, y);
        y += 3;
      }

      // Alimentación
      const diasD = parseInt(String(s.datosFormulario['diasDesayuno'] || '0')) || 0;
      const valD = parseInt(String(s.datosFormulario['valorDesayuno'] || '0')) || 0;
      const diasA = parseInt(String(s.datosFormulario['diasAlmuerzo'] || '0')) || 0;
      const valA = parseInt(String(s.datosFormulario['valorAlmuerzo'] || '0')) || 0;
      const diasC = parseInt(String(s.datosFormulario['diasCena'] || '0')) || 0;
      const valC = parseInt(String(s.datosFormulario['valorCena'] || '0')) || 0;
      if (diasD + diasA + diasC > 0) {
        seccionViat('4. ALIMENTACIÓN');
        const aCols = ['Tipo de comida', 'N° días', 'Valor por día', 'Total'];
        const aW = [0.30, 0.20, 0.25, 0.25].map((r) => (pageWidth - margin * 2) * r);
        if (y > 260) { doc.addPage(); y = margin; }
        doc.setFillColor(212, 175, 55);
        doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F');
        doc.setTextColor(7, 11, 29);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        cx = margin;
        aCols.forEach((col, i) => { doc.text(col, cx + 1, y + 3.8); cx += aW[i]; });
        y += 5.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        const comidas = [
          ...(diasD > 0 ? [['Desayuno', String(diasD), fmt(String(valD)), fmt(String(diasD * valD))]] : []),
          ...(diasA > 0 ? [['Almuerzo', String(diasA), fmt(String(valA)), fmt(String(diasA * valA))]] : []),
          ...(diasC > 0 ? [['Cena', String(diasC), fmt(String(valC)), fmt(String(diasC * valC))]] : []),
        ];
        comidas.forEach((row, idx) => {
          if (y > 275) { doc.addPage(); y = margin; }
          const bg = idx % 2 === 0 ? [245, 245, 248] as [number,number,number] : [255, 255, 255] as [number,number,number];
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.rect(margin, y, pageWidth - margin * 2, 5, 'F');
          cx = margin;
          row.forEach((v, i) => { doc.text(v, cx + 1, y + 3.5); cx += aW[i]; });
          y += 5;
        });
        const totalComidas = String(s.datosFormulario['totalComidas'] || '');
        if (Number(totalComidas) > 0) {
          doc.setFillColor(7, 11, 29);
          doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(212, 175, 55);
          doc.text('SUBTOTAL ALIMENTACIÓN', margin + 1, y + 3.8);
          doc.text(fmt(totalComidas), pageWidth - margin - 1, y + 3.8, { align: 'right' });
          y += 7;
        }
      }

      // Total general
      const totalGeneral = String(s.datosFormulario['totalGeneral'] || '');
      if (Number(totalGeneral) > 0) {
        if (y > 260) { doc.addPage(); y = margin; }
        doc.setFillColor(7, 11, 29);
        doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(212, 175, 55);
        doc.text('TOTAL GENERAL VIÁTICOS', margin + 3, y + 5.5);
        doc.text(fmt(totalGeneral), pageWidth - margin - 3, y + 5.5, { align: 'right' });
        y += 10;
        // Valor en letras
        const totalViatNum = parseInt(totalGeneral.replace(/[^0-9]/g, '')) || 0;
        if (totalViatNum > 0) {
          if (y > 272) { doc.addPage(); y = margin; }
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8.5);
          doc.setTextColor(80, 80, 100);
          const letrasV = `(${numeroAPesosEnLetras(String(totalViatNum))})`;
          const letrasVLines = doc.splitTextToSize(letrasV, pageWidth - margin * 2);
          doc.text(letrasVLines, margin, y);
          y += letrasVLines.length * 4.5 + 3;
          doc.setTextColor(15, 23, 42);
        }
      }
    } catch { /* datos de viáticos no válidos */ }
  }

  // Bloque especial: anticipo de gastos (datosFormulario.items = JSON string)
  const rawItems = s.datosFormulario['items'];
  if (esAnticipo && rawItems && typeof rawItems === 'string') {
    try {
      const itemsArr = JSON.parse(rawItems) as Record<string, string>[];
      if (Array.isArray(itemsArr) && itemsArr.length > 0) {
        // Narrativa anticipo
        const descripcionGasto = String(s.datosFormulario['descripcionGasto'] || '');
        const fechaEvento = String(s.datosFormulario['fechaEvento'] || '');
        const destino = String(s.datosFormulario['destino'] || '');
        const valorPesos = String(s.datosFormulario['valorPesos'] || '');
        const totalFmt = valorPesos
          ? `$${Number(valorPesos.replace(/[^0-9]/g, '')).toLocaleString('es-CO')}`
          : '';
        const narrativa = [
          `Yo, ${s.solicitanteNombre || 'el(la) suscrito(a)'},`,
          `solicito anticipo de gastos${descripcionGasto ? ` para: ${descripcionGasto}` : ''}` +
            (destino ? ` en ${destino}` : '') +
            (fechaEvento ? ` el ${fechaEvento}` : '') +
            (totalFmt ? `, por un valor total de ${totalFmt}` : '') + '.',
        ].filter(Boolean).join(' ');
        if (y > 240) { doc.addPage(); y = margin; }
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'normal');
        const splitNarr = doc.splitTextToSize(narrativa, pageWidth - margin * 2);
        doc.text(splitNarr, margin, y);
        y += splitNarr.length * 5 + 5;

        // Autorización del gasto
        const autorizadorAnticipo = String(s.datosFormulario['autorizadorNombre'] || s.datosFormulario['autorizador'] || s.datosFormulario['autorizadoPor'] || '');
        const propositoAnticipo = String(s.datosFormulario['propositoGasto'] || s.datosFormulario['paraque'] || s.datosFormulario['justificacion'] || '');
        if (autorizadorAnticipo || propositoAnticipo) {
          if (y > 245) { doc.addPage(); y = margin; }
          const boxH = (autorizadorAnticipo ? 8 : 0) + (propositoAnticipo ? 8 : 0) + 4;
          doc.setFillColor(253, 246, 220);
          doc.setDrawColor(212, 175, 55);
          doc.setLineWidth(0.5);
          doc.rect(margin, y, pageWidth - margin * 2, boxH, 'FD');
          let by = y + 5;
          if (autorizadorAnticipo) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(120, 85, 0);
            doc.text('AUTORIZADO POR:', margin + 3, by);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(autorizadorAnticipo, margin + 42, by);
            by += 8;
          }
          if (propositoAnticipo) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(120, 85, 0);
            doc.text('PROPÓSITO DEL GASTO:', margin + 3, by);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            const pLines = doc.splitTextToSize(propositoAnticipo, pageWidth - margin * 2 - 55);
            doc.text(pLines, margin + 52, by);
          }
          y += boxH + 5;
        }

        // Tabla de ítems
        if (y > 240) { doc.addPage(); y = margin; }
        doc.setDrawColor(212, 175, 55);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(184, 144, 31);
        doc.setFontSize(11);
        doc.text('DESGLOSE DEL ANTICIPO', margin, y);
        y += 5;
        const iCols = ['#', 'Concepto', 'Descripción', 'Valor'];
        const iW = [0.05, 0.20, 0.50, 0.20].map((r) => (pageWidth - margin * 2) * r);
        doc.setFillColor(212, 175, 55);
        doc.rect(margin, y, pageWidth - margin * 2, 5, 'F');
        doc.setTextColor(7, 11, 29);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        let cxA = margin;
        iCols.forEach((col, i) => { doc.text(col, cxA + 1, y + 3.5); cxA += iW[i]; });
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        let totalAnticipo = 0;
        itemsArr.forEach((it, idx) => {
          if (y > 275) { doc.addPage(); y = margin; }
          const valor = Number(String(it.valor || '0').replace(/[^0-9]/g, ''));
          totalAnticipo += valor;
          const bg = idx % 2 === 0 ? [245, 245, 248] : [255, 255, 255];
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.rect(margin, y, pageWidth - margin * 2, 4.5, 'F');
          cxA = margin;
          [String(idx + 1), it.concepto || '', it.descripcion || '', `$${valor.toLocaleString('es-CO')}`]
            .forEach((v, i) => { doc.text(doc.splitTextToSize(v, iW[i] - 1)[0] || '', cxA + 1, y + 3.2); cxA += iW[i]; });
          y += 4.5;
        });
        // Total row
        doc.setFillColor(7, 11, 29);
        doc.rect(margin, y, pageWidth - margin * 2, 5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(212, 175, 55);
        doc.text('TOTAL ANTICIPO', margin + 1, y + 3.5);
        doc.text(`$${totalAnticipo.toLocaleString('es-CO')}`, pageWidth - margin - 1, y + 3.5, { align: 'right' });
        y += 7;
        // Valor en letras
        if (totalAnticipo > 0) {
          if (y > 272) { doc.addPage(); y = margin; }
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8.5);
          doc.setTextColor(80, 80, 100);
          const letras = `(${numeroAPesosEnLetras(String(totalAnticipo))})`;
          const letrasLines = doc.splitTextToSize(letras, pageWidth - margin * 2);
          doc.text(letrasLines, margin, y);
          y += letrasLines.length * 4.5 + 3;
          doc.setTextColor(15, 23, 42);
        }
        // Cuenta bancaria
        const bancoA = String(s.datosFormulario['banco'] || '');
        const cuentaA = String(s.datosFormulario['numeroCuenta'] || '');
        const tipoCtaA = String(s.datosFormulario['tipoCuenta'] || '');
        if (bancoA || cuentaA) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text(`Cuenta para desembolso: ${bancoA} ${tipoCtaA} — ${cuentaA}`, margin, y);
          y += 6;
        }
      }
    } catch { /* datos inválidos */ }
  }

  // ── Cuenta de Cobro OPS — 4 documentos ────────────────────────────────────
  if (esCuentaCobroOps) {
    const d = s.datosFormulario;
    const get = (k: string) => String(d[k] ?? '');

    // Datos comunes
    const tipoDocP = get('tipoDocumento') || get('tipo_documento');
    const numDocP  = get('numeroDocumento') || get('numero_documento') || s.solicitanteDocumento || '';
    const nombreProf = [
      get('primerNombre') || get('primer_nombre'),
      get('segundoNombre') || get('segundo_nombre'),
      get('primerApellido') || get('primer_apellido'),
      get('segundoApellido') || get('segundo_apellido'),
    ].filter(Boolean).join(' ') || s.solicitanteNombre || '';
    const profesion    = get('profesion');
    const telefono     = get('telefono');
    const correo       = s.solicitanteCorreo || get('correoElectronico') || '';
    const lugarExp     = get('lugarExpedicion') || get('lugar_expedicion') || 'Bogotá';
    const eps          = get('eps') || get('entidadSalud');
    const banco        = get('banco');
    const tipoCta      = get('tipoCuenta');
    const numCta       = get('numeroCuenta');
    const titularCta   = get('titularCuenta');
    const periodoIni   = get('periodoInicio');
    const periodoFin_  = get('periodoFin');
    const fecIniCto    = get('fechaInicioContrato');
    const valorRaw     = get('valorCobrar').replace(/[^0-9]/g, '');
    const valorNum     = parseInt(valorRaw) || 0;
    const valorFmt     = valorNum ? `$ ${valorNum.toLocaleString('es-CO')}` : '—';
    const comentarios  = get('actividadesRealizadas') || get('comentariosAdicionales');

    // Calcular info del movimiento para firmas
    const _aprobPorPaso: Record<string, string> = {};
    s.movimientos.forEach((m) => {
      if ((m.accion === 'validada' || m.accion === 'reenviada' || m.accion === 'aprobada') && m.paso && m.usuarioNombre) {
        _aprobPorPaso[m.paso] = m.usuarioNombre;
      }
    });

    // Parse atenciones
    let atArr: Array<{ regional: string; sede: string; fecha: string; hc: string }> = [];
    try { const raw = get('atencionesJson'); if (raw) atArr = JSON.parse(raw); } catch { /* skip */ }
    let totalHC = 0;
    atArr.forEach(a => { totalHC += parseInt(a.hc) || 0; });
    const turnos = new Set(atArr.map(a => a.fecha)).size;

    // Primary sede = mayor HC
    const hcPorSede = new Map<string, number>();
    atArr.forEach(a => { const s_ = a.sede || a.regional; hcPorSede.set(s_, (hcPorSede.get(s_) || 0) + (parseInt(a.hc) || 0)); });
    let sedePrincipal = ''; let maxHcS = 0;
    hcPorSede.forEach((hc, sede) => { if (hc > maxHcS) { maxHcS = hc; sedePrincipal = sede; } });
    if (!sedePrincipal && atArr.length > 0) sedePrincipal = atArr[0].sede || atArr[0].regional;

    // Parse notas aclaratorias
    let notasArr: Array<{ sede: string; regional: string; fecha: string; hc: string; descripcion: string }> = [];
    if (get('conNotasAclaratorias') === 'si') {
      try { const rawN = get('notasAclaratorias'); if (rawN) notasArr = JSON.parse(rawN); } catch { /* skip */ }
    }

    // Fechas del período
    const fechaDocObj  = periodoFin_ ? new Date(periodoFin_ + 'T00:00:00') : null;
    const diaDoc       = fechaDocObj ? fechaDocObj.getDate() : '';
    const MESES_       = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const mesDocMin    = fechaDocObj ? MESES_[fechaDocObj.getMonth()] : '';
    const mesDocUp     = mesDocMin.toUpperCase();
    const anioDoc      = fechaDocObj ? fechaDocObj.getFullYear() : '';
    const fechaDocFmt  = formatFechaBullet(periodoFin_); // "30 de JUNIO de 2026"

    // ════════════════════════════════════════════════════════
    // DOCUMENTO 1: CUENTA DE COBRO (INVOICE)
    // La cabecera general (radicado/estado) ya está renderizada.
    // A partir de aquí va el cuerpo de la factura.
    // ════════════════════════════════════════════════════════
    y += 4;

    // Sede y fecha (alineado a la derecha)
    if (sedePrincipal || fechaDocFmt) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`${sedePrincipal.toUpperCase()}, ${fechaDocFmt.toUpperCase()}`, pageWidth - margin, y, { align: 'right' });
      y += 7;
    }

    // Razón social
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('I.P.S GOLEMAN SERVICIO INTEGRAL S.A.S  NIT.900.231.829', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // DEBE A block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DEBE A:', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(12);
    doc.text(nombreProf.toUpperCase() || '—', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (tipoDocP && numDocP) { doc.text(`${tipoDocP}  ${numDocP}`, pageWidth / 2, y, { align: 'center' }); y += 5; }
    if (profesion) { doc.setFont('helvetica', 'bold'); doc.text(profesion.toUpperCase(), pageWidth / 2, y, { align: 'center' }); y += 5; doc.setFont('helvetica', 'normal'); }
    y += 5;

    // Valor en letras
    if (valorNum > 0) {
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const letras = numeroAPesosEnLetras(String(valorNum));
      const sumaLines = doc.splitTextToSize(`La suma de ${valorFmt} (${letras})`, pageWidth - margin * 2);
      doc.text(sumaLines, margin, y);
      y += sumaLines.length * 5 + 3;
    }

    // POR CONCEPTO DE
    const conceptoBase = profesion
      ? `Prestación de servicios como ${profesion} en administración de medicamentos PPL`
      : 'Prestación de servicios profesionales en administración de medicamentos PPL';
    const conceptoLine = doc.splitTextToSize(`POR CONCEPTO DE: ${conceptoBase}`, pageWidth - margin * 2);
    doc.setFontSize(9.5);
    doc.text(conceptoLine, margin, y);
    y += conceptoLine.length * 5;
    if (periodoIni && periodoFin_) {
      doc.text(`Período: ${periodoIni} al ${periodoFin_}`, margin, y);
      y += 5;
    }
    y += 4;

    // Bullet list de atenciones (ordenadas por fecha)
    const atSorted = [...atArr].sort((a, b) => a.fecha.localeCompare(b.fecha));
    atSorted.forEach((a) => {
      if (y > 272) { doc.addPage(); y = margin; }
      const hcN = parseInt(a.hc) || 0;
      const linea = `• ${formatFechaBullet(a.fecha)} ${a.sede || a.regional} (${hcN})`;
      const split = doc.splitTextToSize(linea, pageWidth - margin * 2 - 4);
      doc.setFontSize(9.5); doc.setTextColor(15, 23, 42);
      doc.text(split, margin + 4, y);
      y += split.length * 5 + 0.5;
    });
    y += 6;

    // Declaración art. 383
    if (y > 252) { doc.addPage(); y = margin; }
    const art383 = `Yo, ${nombreProf}${tipoDocP && numDocP ? `, identificado(a) con ${tipoDocP} N° ${numDocP}` : ''},` +
      ` de ${lugarExp}, dando cumplimiento al parágrafo 2 del artículo 383 del Estatuto Tributario,` +
      ` modificado por el artículo 17 de la ley 1819 del 29 de diciembre de 2016, Certifico bajo la` +
      ` gravedad de juramento que no he contratado, vinculado 2 o más trabajadores asociados a la actividad que desarrollo.`;
    const art383Lines = doc.splitTextToSize(art383, pageWidth - margin * 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
    doc.text(art383Lines, margin, y);
    y += art383Lines.length * 4.8 + 5;
    doc.text('Atentamente,', margin, y); y += 18;

    // Línea de firma del profesional
    doc.setDrawColor(15, 23, 42); doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 75, y); y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(nombreProf.toUpperCase() || '—', margin, y); y += 4.5;
    doc.setFont('helvetica', 'normal');
    if (tipoDocP && numDocP) { doc.text(`${tipoDocP} ${numDocP}`, margin, y); y += 4.5; }
    if (profesion) { doc.text(profesion, margin, y); y += 4.5; }

    // ════════════════════════════════════════════════════════
    // DOCUMENTO 2: CERTIFICACIÓN DE PRESTACIÓN DE SERVICIOS
    // ════════════════════════════════════════════════════════
    doc.addPage(); y = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('CERTIFICACIÓN DE PRESTACIÓN DE SERVICIOS', pageWidth / 2, y + 8, { align: 'center' });
    y += 18;

    // Párrafo introductorio
    const introText = `Teniendo en cuenta la cuenta de cobro presentada por ${nombreProf} sobre las` +
      ` actividades desarrolladas para dar cumplimiento a los términos contratados, he verificado los resultados` +
      ` de su prestación, por lo que se autoriza el pago correspondiente al período comprendido del mes de` +
      ` ${mesDocMin ? mesDocMin + (anioDoc ? ' ' + anioDoc : '') : (periodoFin_ || 'dicho período')}.`;
    const introLines = doc.splitTextToSize(introText, pageWidth - margin * 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text(introLines, margin, y);
    y += introLines.length * 5 + 6;

    // Tabla de datos
    const certFilas: Array<[string, string]> = [
      ['Contratista', nombreProf],
      ['Cédula del Cesionario', numDocP],
      ['Objeto contractual', profesion ? `Prestación de servicios como ${profesion}` : 'Prestación de servicios profesionales'],
      ['Fecha inicio de contrato', fecIniCto || '—'],
      ['Período radicado', mesDocUp ? `${mesDocUp} ${anioDoc}` : (periodoFin_ || '—')],
      ['Valor Certificado', valorFmt],
    ];
    certFilas.forEach(([label, val]) => {
      if (y > 272) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      const lw = doc.getTextWidth(label + ':   ');
      doc.text(`${label}:`, margin, y);
      doc.setFont('helvetica', 'normal');
      const vLines = doc.splitTextToSize(val, pageWidth - margin * 2 - lw);
      doc.text(vLines, margin + lw, y);
      y += vLines.length * 4.8 + 0.5;
    });
    y += 5;

    // Texto legal
    const legal1 = 'De acuerdo con la norma en el parágrafo 1 del Art. 23 la ley 1150 de 2017 y el Artículo 244 de' +
      ' la ley 1955 de 2019, se adjunta certificado de salud activo sin planilla de seguridad social, teniendo en' +
      ' cuenta que no supera un salario mínimo legal vigente.';
    const l1Lines = doc.splitTextToSize(legal1, pageWidth - margin * 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
    doc.text(l1Lines, margin, y); y += l1Lines.length * 4.8 + 4;

    const cumplioText = `Certifico que ${nombreProf} cumplió con las obligaciones generales contempladas en el contrato suscrito entre las partes.`;
    const cLines = doc.splitTextToSize(cumplioText, pageWidth - margin * 2);
    doc.text(cLines, margin, y); y += cLines.length * 4.8 + 4;

    const sistText = `Así mismo, al verificar en el sistema se encontraron (${turnos} TURNO${turnos !== 1 ? 'S' : ''} Y ${totalHC} NOTA${totalHC !== 1 ? 'S' : ''}) debidamente registradas en salud 360.`;
    const sistLines = doc.splitTextToSize(sistText, pageWidth - margin * 2);
    doc.text(sistLines, margin, y); y += sistLines.length * 4.8 + 5;

    // Notas aclaratorias
    if (notasArr.length > 0) {
      if (y > 260) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold'); doc.text('Nota Aclaratoria:', margin, y); y += 5;
      doc.setFont('helvetica', 'normal');
      notasArr.forEach((n) => {
        if (y > 272) { doc.addPage(); y = margin; }
        const notaLine = n.descripcion || `${formatFechaBullet(n.fecha)} ${n.sede || n.regional}${n.hc ? ` (${n.hc} HC)` : ''}`;
        const nLines = doc.splitTextToSize(notaLine, pageWidth - margin * 2 - 4);
        doc.text(nLines, margin + 4, y); y += nLines.length * 4.8 + 0.5;
      });
      y += 3;
    }

    // Comentarios adicionales
    if (comentarios.trim()) {
      if (y > 262) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold'); doc.text('Comentarios:', margin, y); y += 5;
      doc.setFont('helvetica', 'normal');
      const comLines2 = doc.splitTextToSize(comentarios, pageWidth - margin * 2);
      doc.text(comLines2, margin, y); y += comLines2.length * 4.8 + 4;
    }

    // Constancia y firma del supervisor
    if (y > 255) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.text(`En constancia se firma a los ${diaDoc} días del mes de ${mesDocMin} de ${anioDoc}.`, margin, y); y += 12;
    doc.text('Supervisor:', margin, y); y += 22;
    doc.setDrawColor(15, 23, 42); doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 85, y); y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('COORDINADOR(A) DEL ÁREA', margin, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('I.P.S Goleman Servicio Integral S.A.S', margin, y); y += 4;
    doc.text('Coordinadora Nacional', margin, y); y += 3.5;
    doc.text('Elaborado: Coordinación Área PPL', margin, y); y += 3.5;
    doc.text('Aprobado: Coordinadora de Oficina Jurídica', margin, y); y += 8;

    // Datos bancarios — al final del doc 2
    if (y > 255) { doc.addPage(); y = margin; }
    doc.setFillColor(7, 11, 29);
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(212, 175, 55); doc.setFontSize(9);
    doc.text('DATOS BANCARIOS PARA EL PAGO', margin + 3, y + 5);
    y += 10;
    doc.setTextColor(15, 23, 42);
    y = drawInfoGrid(doc, [
      ['Banco', banco || '—'],
      ['Tipo de cuenta', tipoCta || '—'],
      ['N° de cuenta', numCta || '—'],
      ['Titular de la cuenta', titularCta || '—'],
      ['EPS / Entidad de salud', eps || '—'],
      ['Período cobrado', periodoIni && periodoFin_ ? `${periodoIni} al ${periodoFin_}` : (periodoIni || periodoFin_ || '—')],
    ], margin, pageWidth, y);
    y += 4;

    // ════════════════════════════════════════════════════════
    // DOCUMENTO 3: CERTIFICACIÓN (OPS AL DÍA)
    // ════════════════════════════════════════════════════════
    doc.addPage(); y = margin;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(15, 23, 42);
    doc.text('CERTIFICACIÓN', pageWidth / 2, y + 10, { align: 'center' });
    y += 24;

    const certOpsHdr = `Por medio de la presente, ${nombreProf} identificado(a) con ${tipoDocP} y ${numDocP} certifico que:`;
    const certOpsHdrLines = doc.splitTextToSize(certOpsHdr, pageWidth - margin * 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(certOpsHdrLines, margin, y); y += certOpsHdrLines.length * 5.2 + 6;

    const pt1 = `1.   Hago entrega de la cuenta de cobro correspondiente al mes de ${mesDocUp ? mesDocUp + ' ' + anioDoc : (periodoFin_ || 'dicho período')}.`;
    const pt1Lines = doc.splitTextToSize(pt1, pageWidth - margin * 2);
    doc.text(pt1Lines, margin, y); y += pt1Lines.length * 5.2 + 5;

    const pt2 = `2.   A la fecha, no tengo pendientes cuentas de cobro de períodos anteriores por radicar a la empresa IPS GOLEMAN SERVICIO INTEGRAL SAS NIT 900.231.829, salvo la mencionada cuenta de cobro del mes de ${mesDocUp ? mesDocUp + ' ' + anioDoc : ''}.`;
    const pt2Lines = doc.splitTextToSize(pt2, pageWidth - margin * 2);
    doc.text(pt2Lines, margin, y); y += pt2Lines.length * 5.2 + 10;

    const emision = 'Se emite esta certificación a solicitud del interesado(a) para los fines que estime convenientes.';
    const emisionLines = doc.splitTextToSize(emision, pageWidth - margin * 2);
    doc.text(emisionLines, margin, y); y += emisionLines.length * 5.2 + 12;

    doc.text(`Fecha: ${diaDoc ? `${diaDoc} de ${mesDocMin} de ${anioDoc}` : formatFechaBullet(new Date().toISOString().slice(0, 10))}`, margin, y);
    y += 22;

    doc.setDrawColor(15, 23, 42); doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 85, y); y += 4;
    doc.setFontSize(9);
    doc.text(`Nombre: ${nombreProf}`, margin, y); y += 4.5;
    doc.text(`Identificación: ${tipoDocP} ${numDocP}`, margin, y); y += 4.5;
    if (profesion) { doc.text(`Labor: ${profesion}`, margin, y); y += 4.5; }
    if (telefono)  { doc.text(`Teléfono de contacto: ${telefono}`, margin, y); y += 4.5; }
    if (correo)    { doc.text(`Correo electrónico: ${correo}`, margin, y); y += 4.5; }

    // ════════════════════════════════════════════════════════
    // DOCUMENTO 4: PÁGINA DE FIRMAS
    // ════════════════════════════════════════════════════════
    doc.addPage(); y = margin;

    doc.setFillColor(7, 11, 29);
    doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(212, 175, 55); doc.setFontSize(12);
    doc.text('FIRMAS Y APROBACIONES', pageWidth / 2, y + 7, { align: 'center' });
    y += 18;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 100);
    doc.text('Las firmas que aparecen a continuación dan fe de la revisión, validación y aprobación de la presente cuenta de cobro.', pageWidth / 2, y, { align: 'center' });
    y += 10;

    const sigColW = (pageWidth - margin * 2) / 2 - 4;
    const sigH    = 24;
    const drawFirmaOps = (dataUrl: string, label: string, sublabel: string, posX: number, posY: number) => {
      if (dataUrl && dataUrl.startsWith('data:image')) {
        try { doc.addImage(dataUrl, 'PNG', posX, posY, sigColW, sigH - 6); } catch { /* ok */ }
      }
      const lineY = posY + sigH - 2;
      doc.setDrawColor(15, 23, 42); doc.setLineWidth(0.3);
      doc.line(posX, lineY, posX + sigColW, lineY);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42);
      doc.text(label, posX + sigColW / 2, lineY + 4.5, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 100, 120);
      doc.text(sublabel, posX + sigColW / 2, lineY + 8.5, { align: 'center' });
    };

    const firmasOps = s.firmas || {};
    const col1X = margin;
    const col2X = margin + sigColW + 8;
    const row1Y = y + 4;
    const row2Y = row1Y + sigH + 22;

    drawFirmaOps(firmasOps.profesional || '', nombreProf || 'Profesional OPS', 'Firma del Profesional OPS', col1X, row1Y);
    drawFirmaOps(firmasOps.analista    || '', _aprobPorPaso['analista'] || 'Analista del Área', 'Analista del Área', col2X, row1Y);
    drawFirmaOps(firmasOps.coordinador || '', _aprobPorPaso['coordinador'] || 'Coordinador(a) del Área', 'Coordinador(a) del Área', col1X, row2Y);
    drawFirmaOps(firmasOps.contabilidad || '', _aprobPorPaso['contabilidad'] || 'Responsable Área Final', 'Revisó y aprobó pago', col2X, row2Y);

    y = row2Y + sigH + 20;

    // Pie de página del documento 4
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text('I.P.S Goleman Servicio Integral S.A.S  ·  NIT 900.231.829  ·  Área PPL', pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  // Datos por grupo
  const grupos = new Map<string, CampoPlantilla[]>();
  (Array.isArray(s.camposPlantilla) ? s.camposPlantilla : []).forEach((c) => {
    const g = c.group || 'Datos';
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(c);
  });

  const GRUPOS_VALIDOS_ANTICIPO = new Set(['Solicitud de anticipo', 'Compromiso de legalización', 'Datos']);
  grupos.forEach((campos, grupo) => {
    // Para anticipo: solo mostrar grupos del nuevo formulario limpio; omitir secciones obsoletas
    if (esAnticipo && !GRUPOS_VALIDOS_ANTICIPO.has(grupo)) return;
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

  // Firmas
  const firmas = s.firmas || {};
  if (y > 230) { doc.addPage(); y = margin; }
  const firmasY = Math.max(y + 6, 235);

  // Para legalizaciones y viáticos: 4 firmas; para otros: 3
  const numCols = (esLegalizacion || esViaticos) ? 4 : 3;
  const colWidth = (pageWidth - margin * 2) / numCols;
  const firmaImgH = 18;
  const firmaImgW = colWidth - 6;

  // Extraer nombres de validadores desde movimientos
  const aprobacionPorPaso: Record<string, string> = {};
  s.movimientos.forEach((m) => {
    if ((m.accion === 'validada' || m.accion === 'reenviada' || m.accion === 'aprobada') && m.paso && m.usuarioNombre) {
      aprobacionPorPaso[m.paso] = m.usuarioNombre;
    }
  });

  const drawFirma = (dataUrl: string, label: string, nota: string, colIndex: number) => {
    const cx = margin + colWidth * colIndex + 3;
    const lineY = firmasY + firmaImgH + 2;
    if (dataUrl && dataUrl.startsWith('data:image')) {
      try { doc.addImage(dataUrl, 'PNG', cx, firmasY, firmaImgW, firmaImgH); } catch { /* ok */ }
    }
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.line(cx, lineY, cx + firmaImgW, lineY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const labelLines = doc.splitTextToSize(label, firmaImgW);
    doc.text(labelLines[0], cx + firmaImgW / 2, lineY + 4, { align: 'center' });
    if (nota) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(120, 120, 120);
      doc.text(nota, cx + firmaImgW / 2, lineY + 8, { align: 'center' });
    }
  };

  if (esLegalizacion || esViaticos) {
    const autorizadorNombre = String(s.datosFormulario['autorizadorNombre'] || '');
    const autorizadorLabel = esViaticos ? 'Quien autorizó el viaje' : 'Quien autoriza el gasto';
    drawFirma(firmas.profesional || '', s.solicitanteNombre || 'Solicitante', 'Solicita', 0);
    drawFirma('', autorizadorNombre || autorizadorLabel, autorizadorLabel, 1);
    drawFirma(firmas.analista || firmas.coordinador || '', aprobacionPorPaso['analista'] || aprobacionPorPaso['coordinador'] || 'Analista / Coordinador', 'Validó', 2);
    drawFirma(firmas.contabilidad || '', aprobacionPorPaso['contabilidad'] || aprobacionPorPaso['director'] || 'Área final', 'Aprobó', 3);
  } else if (esCuentaCobroOps) {
    // Firmas ya renderizadas en Documento 4 dentro del bloque esCuentaCobroOps
  } else {
    drawFirma(firmas.profesional || firmas.analista || '', 'Profesional solicitante', 'Diligenciamiento', 0);
    drawFirma(firmas.coordinador || '', 'Coordinador', 'Validación', 1);
    drawFirma(firmas.contabilidad || '', 'Contabilidad', 'Finalización', 2);
  }

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

  if (opts?.bloburl) {
    return doc.output('bloburl') as unknown as string;
  }
  doc.save(`Payops_${s.numeroRadicado}.pdf`);
}

export function generarPdfFormato(s: SolicitudParaPdf): void {
  const esLegalizacion = s.tipoSlug === 'legalizacion'
    || typeof s.datosFormulario['gastos'] === 'string';
  const esViaticos = s.tipoSlug === 'viaticos'
    || typeof s.datosFormulario['tiqueteIda'] === 'string';
  const esAnticipo = s.tipoSlug === 'anticipo'
    || typeof s.datosFormulario['items'] === 'string';
  const esCCO = s.tipoSlug === 'cuenta-cobro-ops';
  if (s.plantillaPdf && !esLegalizacion && !esViaticos && !esAnticipo && !esCCO) {
    void generarPdfPlantilla(s, s.plantillaPdf);
    return;
  }
  _generarPdfEspecial(s);
}

