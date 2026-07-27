import jsPDF from 'jspdf';
import { formatearMiles } from '../../utils/numeroALetras';

interface FlujoStep { rol: string; label: string; orden: number; }

interface InformeTipoData {
  tipo: {
    id: number;
    nombre: string;
    slug: string;
    descripcion: string | null;
    areaNombre: string;
    flujoAprobacion: FlujoStep[];
  };
  resumen: {
    total: number;
    aprobadas: number;
    rechazadas: number;
    tasaAprobacion: number | null;
    promedioHoras: number | null;
    minHoras: number | null;
    maxHoras: number | null;
    primera: string | null;
    ultima: string | null;
  };
  porEstado: { estado: string; total: number }[];
  porMes: { mes: string; total: number }[];
  topSolicitantes: { solicitante_nombre: string; total: number }[];
  filtros: { desde: string | null; hasta: string | null };
}

const ESTADO_LABELS: Record<string, string> = {
  borrador:      'Borrador',
  en_validacion: 'En validación',
  aprobado:      'Aprobado',
  por_legalizar: 'Por legalizar',
  rechazado:     'Rechazado',
  devuelto:      'Devuelto',
};

const MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function fmtMes(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MES_LABELS[(parseInt(m) - 1) % 12]} ${y}`;
}

function fmtHoras(h: number | null): string {
  if (h === null) return '—';
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} días`;
}

export async function generarInformeTipo(data: InformeTipoData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW = 210;
  const PH = 297;
  const ML = 18;
  const MR = 18;
  const CW = PW - ML - MR;
  let y = 0;

  // ─── Colores institucionales ─────────────────────────────────
  const AZUL_CORP  = [26, 86, 219] as const;
  const AZUL_CLARO = [219, 234, 254] as const;
  const GRIS_TEXTO = [55, 65, 81] as const;
  const GRIS_CLARO = [249, 250, 251] as const;
  const VERDE      = [21, 128, 61] as const;
  const ROJO       = [185, 28, 28] as const;
  const GRIS_BORDE = [209, 213, 219] as const;

  function setFont(style: 'normal' | 'bold', size: number, color: readonly [number, number, number] = GRIS_TEXTO) {
    doc.setFont('Helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  }

  function newPage() {
    doc.addPage();
    y = 20;
    drawPageFooter();
  }

  function checkY(needed: number) {
    if (y + needed > PH - 20) newPage();
  }

  function drawPageFooter() {
    const pg = doc.getNumberOfPages();
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`PayOPS — Informe generado el ${fmtFecha(new Date().toISOString())}`, ML, PH - 8);
    doc.text(`Pág. ${pg}`, PW - MR, PH - 8, { align: 'right' });
    doc.setDrawColor(...GRIS_BORDE);
    doc.setLineWidth(0.2);
    doc.line(ML, PH - 12, PW - MR, PH - 12);
  }

  function drawSectionTitle(title: string) {
    checkY(14);
    doc.setFillColor(...AZUL_CORP);
    doc.roundedRect(ML, y, CW, 8, 1, 1, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), ML + 4, y + 5.2);
    y += 12;
  }

  function drawKpiGrid(kpis: { label: string; value: string; color?: readonly [number,number,number] }[]) {
    const cols = Math.min(kpis.length, 4);
    const kpiW = (CW - (cols - 1) * 4) / cols;
    const kpiH = 20;
    checkY(kpiH + 4);
    kpis.forEach((kpi, i) => {
      const kx = ML + i * (kpiW + 4);
      doc.setFillColor(...AZUL_CLARO);
      doc.roundedRect(kx, y, kpiW, kpiH, 2, 2, 'F');
      doc.setDrawColor(...AZUL_CORP);
      doc.setLineWidth(0.4);
      doc.roundedRect(kx, y, kpiW, kpiH, 2, 2, 'S');
      const valColor = kpi.color ?? AZUL_CORP;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...valColor);
      doc.text(kpi.value, kx + kpiW / 2, y + 11, { align: 'center' });
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GRIS_TEXTO);
      doc.text(kpi.label, kx + kpiW / 2, y + 17, { align: 'center' });
    });
    y += kpiH + 6;
  }

  function drawTable(headers: string[], rows: string[][], colWidths?: number[]) {
    const ROW_H = 7;
    const HEAD_H = 8;
    const widths = colWidths ?? headers.map(() => CW / headers.length);
    checkY(HEAD_H + ROW_H);

    // Cabecera
    doc.setFillColor(...AZUL_CORP);
    doc.roundedRect(ML, y, CW, HEAD_H, 1, 1, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    let cx = ML + 3;
    headers.forEach((h, i) => {
      doc.text(h, cx, y + 5.2);
      cx += widths[i];
    });
    y += HEAD_H;

    rows.forEach((row, ri) => {
      checkY(ROW_H + 2);
      if (ri % 2 === 0) {
        doc.setFillColor(...GRIS_CLARO);
        doc.rect(ML, y, CW, ROW_H, 'F');
      }
      doc.setDrawColor(...GRIS_BORDE);
      doc.setLineWidth(0.1);
      doc.rect(ML, y, CW, ROW_H, 'S');
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...GRIS_TEXTO);
      let rx = ML + 3;
      row.forEach((cell, i) => {
        const maxW = widths[i] - 4;
        const lines = doc.splitTextToSize(cell, maxW);
        doc.text(lines[0], rx, y + 4.8);
        rx += widths[i];
      });
      y += ROW_H;
    });
    y += 4;
  }

  function drawBarChart(data: { label: string; value: number }[], maxBarW = CW - 60) {
    if (!data.length) return;
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const BAR_H = 6;
    const GAP   = 3;
    const LABEL_W = 45;
    const VAL_W  = 14;
    checkY((BAR_H + GAP) * data.length + 4);
    data.forEach((item) => {
      checkY(BAR_H + GAP);
      const barW = Math.max(2, (item.value / maxVal) * maxBarW);
      // Label
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GRIS_TEXTO);
      const lbl = doc.splitTextToSize(item.label, LABEL_W - 2);
      doc.text(lbl[0], ML, y + BAR_H * 0.7);
      // Bar
      doc.setFillColor(...AZUL_CORP);
      doc.roundedRect(ML + LABEL_W, y, barW, BAR_H, 1, 1, 'F');
      // Value
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...GRIS_TEXTO);
      doc.text(String(item.value), ML + LABEL_W + barW + 2, y + BAR_H * 0.72);
      y += BAR_H + GAP;
    });
    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════
  // PORTADA
  // ═══════════════════════════════════════════════════════════════
  // Banda superior
  doc.setFillColor(...AZUL_CORP);
  doc.rect(0, 0, PW, 52, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(180, 210, 255);
  doc.text('IPS GOLEMAN — SISTEMA PAYOPS', ML, 14);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  const tituloLines = doc.splitTextToSize(`INFORME DE SOLICITUDES`, CW);
  doc.text(tituloLines, ML, 25);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(180, 210, 255);
  const subtLines = doc.splitTextToSize(data.tipo.nombre, CW);
  doc.text(subtLines, ML, 35);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 210, 255);
  const periodoText = (data.filtros.desde || data.filtros.hasta)
    ? `Período: ${data.filtros.desde ? fmtFecha(data.filtros.desde) : 'inicio'} — ${data.filtros.hasta ? fmtFecha(data.filtros.hasta) : 'hoy'}`
    : 'Período: todos los registros';
  doc.text(periodoText, ML, 44);
  doc.text(`Generado: ${fmtFecha(new Date().toISOString())}`, PW - MR, 44, { align: 'right' });

  // Cuadro de información del tipo
  y = 60;
  doc.setFillColor(...GRIS_CLARO);
  doc.roundedRect(ML, y, CW, 28, 2, 2, 'F');
  doc.setDrawColor(...GRIS_BORDE);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, 28, 2, 2, 'S');

  const infoItems = [
    { label: 'Área responsable:', value: data.tipo.areaNombre },
    { label: 'Identificador (slug):', value: data.tipo.slug },
    { label: 'Flujo de aprobación:', value: data.tipo.flujoAprobacion.map((s) => s.label).join(' → ') || '—' },
  ];
  if (data.tipo.descripcion) {
    infoItems.unshift({ label: 'Descripción:', value: data.tipo.descripcion });
  }

  let iy = y + 6;
  infoItems.forEach((item) => {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text(item.label, ML + 4, iy);
    doc.setFont('Helvetica', 'normal');
    const valLines = doc.splitTextToSize(item.value, CW - 48);
    doc.text(valLines[0], ML + 40, iy);
    iy += 6;
  });

  y = 96;
  drawPageFooter();

  // ─── KPIs ─────────────────────────────────────────────────────
  drawSectionTitle('Resumen ejecutivo');
  drawKpiGrid([
    { label: 'Total solicitudes', value: formatearMiles(data.resumen.total) },
    { label: 'Tasa de aprobación', value: data.resumen.tasaAprobacion !== null ? `${data.resumen.tasaAprobacion}%` : '—', color: VERDE },
    { label: 'Aprobadas', value: formatearMiles(data.resumen.aprobadas), color: VERDE },
    { label: 'Rechazadas', value: formatearMiles(data.resumen.rechazadas), color: ROJO },
  ]);

  const tiempoKpis = [
    { label: 'Tiempo promedio resolución', value: fmtHoras(data.resumen.promedioHoras) },
    { label: 'Tiempo mínimo resolución', value: fmtHoras(data.resumen.minHoras) },
    { label: 'Tiempo máximo resolución', value: fmtHoras(data.resumen.maxHoras) },
  ];
  if (data.resumen.primera) {
    tiempoKpis.push({ label: 'Primera solicitud', value: fmtFecha(data.resumen.primera) });
  }
  drawKpiGrid(tiempoKpis);

  // ─── Distribución por estado ──────────────────────────────────
  if (data.porEstado.length > 0) {
    drawSectionTitle('Distribución por estado');
    const estRows = data.porEstado.map((e) => {
      const pct = data.resumen.total > 0 ? ((e.total / data.resumen.total) * 100).toFixed(1) : '0';
      return [ESTADO_LABELS[e.estado] ?? e.estado, String(e.total), `${pct}%`];
    });
    drawTable(
      ['Estado', 'Cantidad', 'Porcentaje'],
      estRows,
      [90, 40, 44],
    );
  }

  // ─── Tendencia mensual ────────────────────────────────────────
  if (data.porMes.length > 0) {
    drawSectionTitle('Tendencia mensual de solicitudes');
    const chartData = data.porMes.map((m) => ({
      label: fmtMes(m.mes),
      value: Number(m.total),
    }));
    drawBarChart(chartData);

    // También tabla
    const mesRows = data.porMes.map((m) => [fmtMes(m.mes), String(m.total)]);
    drawTable(['Mes', 'Solicitudes'], mesRows, [100, 74]);
  }

  // ─── Top solicitantes ─────────────────────────────────────────
  if (data.topSolicitantes.length > 0) {
    drawSectionTitle('Top 10 solicitantes');
    const solRows = data.topSolicitantes.map((s, i) => [
      `${i + 1}.`,
      s.solicitante_nombre || '(sin nombre)',
      String(s.total),
      data.resumen.total > 0 ? `${((s.total / data.resumen.total) * 100).toFixed(1)}%` : '0%',
    ]);
    drawTable(
      ['#', 'Profesional', 'Solicitudes', '%'],
      solRows,
      [10, 104, 30, 30],
    );
  }

  // ─── Notas finales ────────────────────────────────────────────
  checkY(28);
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(ML, y, CW, 22, 2, 2, 'F');
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, 22, 2, 2, 'S');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120, 53, 15);
  doc.text('Notas del informe', ML + 4, y + 6);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(92, 50, 10);
  const notas = [
    '• Este informe fue generado automáticamente por el sistema PayOPS y refleja el estado de los datos al momento de su generación.',
    '• "Tasa de aprobación" considera únicamente solicitudes con resultado definitivo (aprobadas o rechazadas).',
    '• "Tiempo de resolución" aplica solo a solicitudes con fecha de aprobación registrada.',
  ];
  let ny = y + 12;
  notas.forEach((nota) => {
    const nLines = doc.splitTextToSize(nota, CW - 8);
    doc.text(nLines, ML + 4, ny);
    ny += nLines.length * 4.5;
  });
  y += 26;

  // ─── Firma digital ────────────────────────────────────────────
  checkY(20);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Informe generado digitalmente por PayOPS — Área: ${data.tipo.areaNombre} — Tipo: ${data.tipo.nombre}`,
    PW / 2,
    y + 6,
    { align: 'center' },
  );

  doc.save(`Informe_${data.tipo.slug}_${new Date().toISOString().slice(0,10)}.pdf`);
}
