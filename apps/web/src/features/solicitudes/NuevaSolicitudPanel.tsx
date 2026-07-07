import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/http/api';
import { useOcrDocument, validarOcrContraDato, validarTipoDocumento } from '../../hooks/useOcrDocument';
import { numeroAPesosEnLetras, formatearMiles } from '../../utils/numeroALetras';
import { SignaturePad } from '../../components/SignaturePad';
import { BANCOS_COLOMBIA } from '../../utils/bancos';
import { etiquetaDocumento } from '../../utils/documentoLabels';
import { DireccionField } from '../../components/DireccionField';
import { ordenarCamposPorPlantilla } from '../../utils/ordenCamposPlantilla';
import { LegalizacionPanel } from './LegalizacionPanel';
import { ViaticosPanel } from './ViaticosPanel';
import { AnticipOPanel } from './AnticipOPanel';

interface Area {
  id: number;
  nombre: string;
  descripcion: string | null;
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
  operandos?: string[];
  operacion?: 'suma' | 'resta' | 'multiplicacion' | 'division';
  validar_contra?: string;
  comparar_contra?: string;
  columnas?: string[];
  opciones?: string[];
  conFactura?: boolean;
  verificaciones?: string[];
  establecimientoEsperado?: string;
  mostrarSi?: { campo: string; en: string[] };
}

// Texto numérico/monetario → número (formato colombiano: punto = miles, coma = decimal)
function parseNumeroForm(texto: string): number {
  const limpio = String(texto ?? '').replace(/[^0-9,.-]/g, '').trim();
  if (!limpio) return 0;
  const n = parseFloat(limpio.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// Combina valores según la operación del campo calculado
function calcularCampo(operandos: string[], operacion: string, datos: Record<string, string>): number {
  const vals = operandos.map((k) => parseNumeroForm(datos[k] || ''));
  if (vals.length === 0) return 0;
  return vals.reduce((acc, v, i) => {
    if (i === 0) return v;
    switch (operacion) {
      case 'resta': return acc - v;
      case 'multiplicacion': return acc * v;
      case 'division': return v === 0 ? acc : acc / v;
      case 'suma':
      default: return acc + v;
    }
  });
}

interface BloqueCampoMin {
  tipo: string;
  campoKey?: string;
  etiqueta?: string;
  texto?: string;
  pagina?: number;
  y?: number;
  x?: number;
}

// Adivina el tipo de un campo por su clave (mismo criterio que el editor de plantillas)
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

const TOKEN_CAMPOS: Record<string, { key: string; label: string; type: CampoPlantilla['type'] }> = {
  valor: { key: 'valorPesos', label: 'Valor a cobrar', type: 'valor-pesos' },
  concepto: { key: 'observaciones', label: 'Concepto / observaciones', type: 'textarea' },
  ciudad: { key: 'ciudad', label: 'Ciudad', type: 'text' },
};

// Une los campos definidos del tipo con los que están colocados en la hoja
// (bloques "campo" y tokens {{valor}}/{{concepto}}/{{ciudad}}), para que el
// formulario PREGUNTE todo lo que el documento necesita aunque no se haya
// agregado manualmente como dato.
function camposCompletos(campos: CampoPlantilla[], plantillaPdf?: PlantillaPdfMin | null): CampoPlantilla[] {
  const vistos = new Set(campos.map((c) => c.key));
  const extra: CampoPlantilla[] = [];
  const bloques = (plantillaPdf?.bloques || []) as BloqueCampoMin[];
  for (const b of bloques) {
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

interface PlantillaPdfMin {
  bloques?: BloqueCampoMin[];
}

interface TipoSolicitud {
  id: number;
  areaId: number;
  areaNombre: string;
  nombre: string;
  descripcion: string | null;
  slug: string;
  activo: boolean;
  camposPlantilla: CampoPlantilla[];
  plantillaPdf?: PlantillaPdfMin | null;
}

interface NuevaSolicitudPanelProps {
  onCreada?: (info: { id: number; numeroRadicado: string }) => void;
}

interface ValidacionFactura { nombre: string; confianza: number; alertas: string[] }

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/** Campo de tabla con varias filas (ej. varios viáticos). Opcional: factura por fila validada por IA. */
function TablaItemsField({ columnas, value, onChange, conFactura, verificaciones, establecimiento, onValidarFactura }: {
  columnas: string[];
  value: string;
  onChange: (json: string) => void;
  conFactura?: boolean;
  verificaciones?: string[];
  establecimiento?: string;
  onValidarFactura?: (file: File, valorEsperado: string, opts: { verificaciones?: string[]; establecimiento?: string }) => Promise<ValidacionFactura>;
}) {
  const cols = columnas.length ? columnas : ['Ítem', 'Valor'];
  const colValor = cols.find((c) => c.toLowerCase().includes('valor')) || cols[cols.length - 1];
  const [validando, setValidando] = useState<number | null>(null);
  const filas: Record<string, string>[] = useMemo(() => {
    if (!value) return [{}];
    try { const a = JSON.parse(value); return Array.isArray(a) && a.length ? a : [{}]; } catch { return [{}]; }
  }, [value]);
  function emit(next: Record<string, string>[]) {
    const hayDatos = next.some((r) => cols.some((c) => (r[c] || '').trim() !== '') || r._factura);
    onChange(hayDatos ? JSON.stringify(next) : '');
  }
  function setCell(i: number, col: string, v: string) {
    emit(filas.map((r, ri) => (ri === i ? { ...r, [col]: v } : r)));
  }
  function addFila() { emit([...filas, {}]); }
  function delFila(i: number) { const next = filas.filter((_, ri) => ri !== i); emit(next.length ? next : [{}]); }
  async function adjuntarFactura(i: number, file: File | null) {
    if (!file || !onValidarFactura) return;
    setValidando(i);
    try {
      const res = await onValidarFactura(file, filas[i]?.[colValor] || '', { verificaciones, establecimiento });
      emit(filas.map((r, ri) => (ri === i
        ? { ...r, _factura: res.nombre, _facturaConf: String(Math.round(res.confianza)), _facturaAlertas: JSON.stringify(res.alertas) }
        : r)));
    } finally {
      setValidando(null);
    }
  }
  const filasConDatos = filas.filter((r) => cols.some((c) => (r[c] || '').trim() !== '')).length;
  const filasConFactura = filas.filter((r) => r._factura).length;
  const faltan = conFactura ? Math.max(0, filasConDatos - filasConFactura) : 0;

  return (
    <div className="tabla-items">
      <div className="tabla-items-scroll">
        <table>
          <thead>
            <tr>{cols.map((c) => <th key={c}>{c}</th>)}{conFactura ? <th>Factura (IA)</th> : null}<th aria-label="acciones" /></tr>
          </thead>
          <tbody>
            {filas.map((r, i) => {
              let alertas: string[] = [];
              if (r._facturaAlertas) { try { alertas = JSON.parse(r._facturaAlertas); } catch { alertas = []; } }
              return (
              <tr key={i}>
                {cols.map((col) => (
                  <td key={col}>
                    <input type="text" value={r[col] || ''} onChange={(e) => setCell(i, col, e.target.value)} placeholder={col} />
                  </td>
                ))}
                {conFactura ? (
                  <td className="tabla-items-factura">
                    {r._factura ? (
                      <span className={alertas.length ? 'factura-warn' : 'factura-ok'} title={alertas.join(' · ')}>
                        {alertas.length ? '⚠' : '✓'} {r._factura}
                      </span>
                    ) : (
                      <span className="factura-falta">⚠ falta factura</span>
                    )}
                    <label className="factura-btn">
                      {validando === i ? '⏳ Validando…' : (r._factura ? 'Cambiar' : 'Adjuntar')}
                      <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => adjuntarFactura(i, e.target.files?.[0] ?? null)} />
                    </label>
                  </td>
                ) : null}
                <td>
                  {filas.length > 1 ? (
                    <button type="button" className="tabla-items-del" title="Quitar fila" onClick={() => delFila(i)}>✕</button>
                  ) : null}
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
      <div className="tabla-items-foot">
        <button type="button" className="admin-ghost-button tabla-items-add" onClick={addFila}>➕ Agregar fila</button>
        {conFactura ? (
          faltan > 0 ? (
            <span className="factura-resumen warn">⚠ La IA detectó que faltan {faltan} factura(s) por adjuntar.</span>
          ) : filasConFactura > 0 ? (
            <span className="factura-resumen ok">✓ Todas las filas tienen su factura adjunta.</span>
          ) : null
        ) : null}
      </div>
    </div>
  );
}

export function NuevaSolicitudPanel({ onCreada }: NuevaSolicitudPanelProps) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tipos, setTipos] = useState<TipoSolicitud[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [areaSel, setAreaSel] = useState<Area | null>(null);
  const [tipoSel, setTipoSel] = useState<TipoSolicitud | null>(null);
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [docArchivos, setDocArchivos] = useState<Record<string, string>>({});
  const [subiendoDoc, setSubiendoDoc] = useState<string | null>(null);
  const [ocrPorCampo, setOcrPorCampo] = useState<Record<string, { texto: string; confianza: number; alertas: string[] }>>({});
  const [ocrCampoActivo, setOcrCampoActivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [firmaSolicitante, setFirmaSolicitante] = useState('');
  const [subPaso, setSubPaso] = useState(0);
  const [personas, setPersonas] = useState<string[]>([]);
  const { procesarArchivo, running: ocrRunning, progress: ocrProgress } = useOcrDocument();

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      api.get<Area[]>('/areas'),
      api.get<TipoSolicitud[]>('/tipos'),
    ])
      .then(([a, t]) => {
        if (cancel) return;
        setAreas(a.data.filter((x) => x.activo));
        setTipos(t.data.filter((x) => x.activo));
      })
      .catch(() => setErr('No se pudo cargar areas y tipos.'))
      .finally(() => setLoading(false));
    return () => { cancel = true; };
  }, []);

  // Nombres de usuarios para autocompletar campos tipo "persona" (no crítico si falla)
  useEffect(() => {
    let cancel = false;
    api.get<Array<{ nombreCompleto?: string }>>('/usuarios/nombres')
      .then((r) => { if (!cancel) setPersonas(r.data.map((u) => u.nombreCompleto || '').filter(Boolean)); })
      .catch(() => { /* silencioso */ });
    return () => { cancel = true; };
  }, []);

  // Mantener actualizados los campos calculados cuando cambian sus operandos
  useEffect(() => {
    if (!tipoSel) return;
    const calculados = (tipoSel.camposPlantilla || []).filter((c) => c.type === 'calculado');
    if (calculados.length === 0) return;
    setDatos((prev) => {
      let cambio = false;
      const next = { ...prev };
      for (const c of calculados) {
        const r = calcularCampo(c.operandos || [], c.operacion || 'suma', prev);
        const txt = String(Math.round(r * 100) / 100);
        if (next[c.key] !== txt) { next[c.key] = txt; cambio = true; }
      }
      return cambio ? next : prev;
    });
  }, [datos, tipoSel]);

  const tiposDelArea = useMemo(() => {
    if (!areaSel) return [];
    return tipos.filter((t) => {
      if (t.areaId === areaSel.id) return true;
      const participantes = (t as unknown as { flujoAreas?: { areasParticipantes?: number[] } })?.flujoAreas?.areasParticipantes;
      return Array.isArray(participantes) && participantes.includes(areaSel.id);
    });
  }, [tipos, areaSel]);

  const camposPorGrupo = useMemo(() => {
    if (!tipoSel) return new Map<string, CampoPlantilla[]>();
    const todos = camposCompletos(tipoSel.camposPlantilla, tipoSel.plantillaPdf);
    const camposOrdenados = ordenarCamposPorPlantilla(todos, tipoSel.plantillaPdf);
    const m = new Map<string, CampoPlantilla[]>();
    for (const c of camposOrdenados) {
      const g = c.group || 'Datos';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
    return m;
  }, [tipoSel]);

  function reiniciar() {
    setPaso(1);
    setAreaSel(null);
    setTipoSel(null);
    setDatos({});
    setDocs({});
    setDocArchivos({});
    setMsg('');
    setErr('');
  }

  function elegirArea(a: Area) {
    setAreaSel(a);
    setTipoSel(null);
    setPaso(2);
  }

  function elegirTipo(t: TipoSolicitud) {
    setTipoSel(t);
    setPaso(3);
    setSubPaso(0);
    setDatos({});
    setDocs({});
  }

  const gruposArr = useMemo(() => Array.from(camposPorGrupo.entries()), [camposPorGrupo]);
  const totalSubPasos = gruposArr.length + 1; // grupos + firma

  // Mostrar/ocultar campos segun el valor de otro campo (ej. destino solo si "Viaje")
  function esVisible(c: CampoPlantilla): boolean {
    const ms = c.mostrarSi;
    if (!ms || !ms.campo || !Array.isArray(ms.en)) return true;
    return ms.en.includes((datos[ms.campo] || '').trim());
  }

  function validarGrupoActual(): string {
    if (subPaso < gruposArr.length) {
      const [, campos] = gruposArr[subPaso];
      const faltan = campos.filter((c) => {
        if (!esVisible(c)) return false;
        if (!c.required) return false;
        if (c.type === 'texto-fijo') return false;
        if (c.type === 'file') return !docs[c.key];
        return !datos[c.key] || (datos[c.key] || '').trim() === '';
      });
      if (faltan.length > 0) return `Faltan: ${faltan.map((f) => f.label).join(', ')}`;
      // Campos "persona": el valor debe coincidir con un usuario activo del sistema
      const personaInvalida = campos.filter((c) => c.type === 'persona' && (datos[c.key] || '').trim() !== '' && !personas.includes((datos[c.key] || '').trim()));
      if (personaInvalida.length > 0) return `Elige un usuario válido de la lista en: ${personaInvalida.map((f) => f.label).join(', ')}`;
    }
    return '';
  }

  function siguienteSubPaso() {
    const e = validarGrupoActual();
    if (e) { setErr(e); return; }
    setErr('');
    setSubPaso((p) => Math.min(totalSubPasos - 1, p + 1));
  }

  function anteriorSubPaso() {
    setErr('');
    setSubPaso((p) => Math.max(0, p - 1));
  }

  async function handleFile(key: string, file: File | null) {
    if (!file) {
      setDocs((p) => { const copy = { ...p }; delete copy[key]; return copy; });
      setDocArchivos((p) => { const copy = { ...p }; delete copy[key]; return copy; });
      setOcrPorCampo((p) => { const copy = { ...p }; delete copy[key]; return copy; });
      return;
    }
    setDocs((p) => ({ ...p, [key]: file.name }));

    // Subir el archivo al servidor para que el validador pueda abrirlo después
    setSubiendoDoc(key);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      const up = await api.post<{ id: string }>('/archivos', fd, { headers: { 'Content-Type': undefined } });
      setDocArchivos((p) => ({ ...p, [key]: up.data.id }));
    } catch {
      setErr('No se pudo subir “' + file.name + '”. Verifica que sea PDF/JPG/PNG y pese menos de 10 MB.');
    } finally {
      setSubiendoDoc(null);
    }

    // Corre la IA si el adjunto tiene un tipo esperado (ocr_target) O si algún dato
    // del formulario debe compararse contra este soporte (comparar_contra).
    const todosCampos = camposEnviar();
    const campo = todosCampos.find((c) => c.key === key);
    const camposQueComparan = todosCampos.filter((c) => c.comparar_contra === key);
    if (!campo?.ocr_target && camposQueComparan.length === 0) return;

    setOcrCampoActivo(key);
    const ocr = await procesarArchivo(file);
    setOcrCampoActivo(null);
    if (!ocr) return;

    const alertas: string[] = [];

    // Comparación genérica: cada dato marcado "comparar contra este adjunto"
    for (const cmp of camposQueComparan) {
      const valor = String(datos[cmp.key] || '').trim();
      if (!valor) continue;
      const modo = (cmp.type === 'valor-pesos' || cmp.type === 'number' || cmp.type === 'cc' || cmp.type === 'nit' || cmp.type === 'cuenta-bancaria') ? 'cc' : 'texto';
      const v = validarOcrContraDato(ocr.text, valor, modo);
      if (!v.coincide) {
        alertas.push(`El dato “${cmp.label}” (“${valor}”) no se identificó claramente en este soporte.`);
      }
    }

    if (!campo?.ocr_target) {
      // Sin tipo esperado: solo comparaciones + confianza + forense
      if (ocr.confidence < 50) {
        alertas.push(`La inteligencia artificial leyó el documento con baja confiabilidad (${Math.round(ocr.confidence)}%). El archivo puede estar borroso o ser ilegible.`);
      }
      try {
        const dataUrl = await leerComoDataUrl(file);
        const fr = await api.post<{ hallazgos?: Array<{ severidad: string; texto: string }> }>(
          '/forense', { archivoBase64: dataUrl, nombre: file.name },
        );
        for (const h of fr.data?.hallazgos || []) {
          if (h.severidad === 'alta' || h.severidad === 'media') alertas.push(`🔎 ${h.texto}`);
        }
      } catch { /* complementario */ }
      setOcrPorCampo((p) => ({ ...p, [key]: { texto: ocr.text, confianza: ocr.confidence, alertas } }));
      return;
    }

    const target = campo.ocr_target;
    const targetLabel = etiquetaDocumento(target);

    // 1) Verificar que el documento sea del tipo correcto
    const tipoCheck = validarTipoDocumento(ocr.text, target);
    if (!tipoCheck.esValido) {
      const detectadoLabel = tipoCheck.tipoDetectado ? etiquetaDocumento(tipoCheck.tipoDetectado) : '';
      alertas.push(
        detectadoLabel
          ? `El archivo adjuntado no parece ser un ${targetLabel}. La inteligencia artificial detectó que se parece más a un ${detectadoLabel}.`
          : `El archivo adjuntado no parece ser un ${targetLabel}. Verifica que estés subiendo el documento correcto.`
      );
    }

    // Comparar contra cedula del solicitante (campo 'cedula' o 'numeroDocumento')
    if (target === 'cedula') {
      const cc = datos.cedula || datos.numeroDocumento || datos.cc || '';
      if (cc) {
        const v = validarOcrContraDato(ocr.text, cc, 'cc');
        if (!v.coincide) alertas.push(`El número ${cc} no se identificó en el ${targetLabel}.`);
      }
    }
    if (target === 'rut' || target === 'eps' || target === 'adres') {
      const cc = datos.cedula || datos.numeroDocumento || '';
      const nombre = datos.nombreCompleto || '';
      if (cc) {
        const v = validarOcrContraDato(ocr.text, cc, 'cc');
        if (!v.coincide) alertas.push(`El número ${cc} no se identificó en el ${targetLabel}.`);
      }
      if (nombre) {
        const v2 = validarOcrContraDato(ocr.text, nombre, 'texto');
        if (!v2.coincide) alertas.push(`El nombre "${nombre}" coincide solo parcialmente con el ${targetLabel}.`);
      }
      if (target === 'eps') {
        const eps = datos.eps || '';
        if (eps) {
          const v3 = validarOcrContraDato(ocr.text, eps, 'texto');
          if (!v3.coincide) alertas.push(`La EPS "${eps}" no se identificó en el certificado.`);
        }
      }
    }
    if (target === 'cuenta_bancaria') {
      const banco = datos.banco || '';
      const numCuenta = datos.numeroCuenta || '';
      if (banco) {
        const v = validarOcrContraDato(ocr.text, banco, 'texto');
        if (!v.coincide) alertas.push(`El banco "${banco}" no se identificó en la certificación bancaria.`);
      }
      if (numCuenta && numCuenta.length >= 5) {
        const v = validarOcrContraDato(ocr.text, numCuenta, 'cc');
        if (!v.coincide) alertas.push(`El número de cuenta ${numCuenta} no se identificó en la certificación bancaria.`);
      }
    }
    if (target === 'cuenta_cobro' || target === 'planilla') {
      const cc = datos.cedula || '';
      if (cc) {
        const v = validarOcrContraDato(ocr.text, cc, 'cc');
        if (!v.coincide) alertas.push(`El número de identidad no coincide con el ${targetLabel}.`);
      }
    }
    if (ocr.confidence < 50) {
      alertas.push(`La inteligencia artificial leyó el documento con baja confiabilidad (${Math.round(ocr.confidence)}%). El archivo puede estar borroso o ser ilegible.`);
    }

    // Verificación forense en el servidor (metadatos / EXIF / ELA)
    try {
      const dataUrl = await leerComoDataUrl(file);
      const fr = await api.post<{ hallazgos?: Array<{ severidad: string; texto: string }> }>(
        '/forense', { archivoBase64: dataUrl, nombre: file.name },
      );
      for (const h of fr.data?.hallazgos || []) {
        if (h.severidad === 'alta' || h.severidad === 'media') alertas.push(`🔎 ${h.texto}`);
      }
    } catch { /* complementario */ }

    setOcrPorCampo((p) => ({
      ...p,
      [key]: { texto: ocr.text, confianza: ocr.confidence, alertas },
    }));
  }

  // Valida la factura de una fila con OCR/IA según los complementos configurados
  const validarFacturaFila = useCallback(async (
    file: File,
    valorEsperado: string,
    opts: { verificaciones?: string[]; establecimiento?: string },
  ): Promise<ValidacionFactura> => {
    const ocr = await procesarArchivo(file);
    if (!ocr) return { nombre: file.name, confianza: 0, alertas: ['No se pudo leer la factura.'] };
    const checks = opts.verificaciones && opts.verificaciones.length
      ? opts.verificaciones
      : ['total', 'establecimiento', 'fecha', 'multiples', 'alteracion'];
    const texto = ocr.text;
    const t = texto.toLowerCase();
    const alertas: string[] = [];

    // Total / valor de la fila
    if (checks.includes('total')) {
      const limpio = (valorEsperado || '').replace(/\D/g, '');
      if (limpio.length >= 3) {
        const v = validarOcrContraDato(texto, limpio, 'cc');
        if (!v.coincide) alertas.push(`El total ${Number(limpio).toLocaleString('es-CO')} no se identificó en la factura.`);
      }
    }
    // Establecimiento / NIT
    if (checks.includes('establecimiento')) {
      const hayNit = /\bnit\b/.test(t) || /\b\d{9,}\b/.test(texto.replace(/[.\s-]/g, ''));
      if (opts.establecimiento && opts.establecimiento.trim()) {
        const v = validarOcrContraDato(texto, opts.establecimiento, 'texto');
        if (!v.coincide) alertas.push(`No se identificó el establecimiento "${opts.establecimiento}" en la factura.`);
      } else if (!hayNit) {
        alertas.push('No se detectó NIT ni datos del establecimiento; verifica que sea una factura válida.');
      }
    }
    // Fecha
    if (checks.includes('fecha')) {
      const tieneFecha = /\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/.test(texto) || /\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}/.test(texto)
        || /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/.test(t);
      if (!tieneFecha) alertas.push('No se detectó una fecha en la factura.');
    }
    // Varias facturas en el mismo archivo
    if (checks.includes('multiples')) {
      const nTotales = (t.match(/total/g) || []).length;
      const nNits = (t.match(/nit/g) || []).length;
      if (nTotales >= 2 || nNits >= 2) alertas.push('Parece haber varias facturas en el archivo; verifica que la fila corresponda a la correcta.');
    }
    // Señales básicas de alteración / legibilidad (no es análisis forense)
    if (checks.includes('alteracion')) {
      const marcadores = ['factura', 'total', 'nit', 'valor', 'fecha', 'cantidad'].filter((k) => t.includes(k)).length;
      if (ocr.confidence < 45) {
        alertas.push(`Lectura de muy baja calidad (${Math.round(ocr.confidence)}%): el documento puede estar borroso, editado o no ser una factura. Requiere revisión manual.`);
      } else if (marcadores <= 1) {
        alertas.push('El documento no tiene la estructura típica de una factura; requiere revisión manual.');
      }
    }

    // Verificación forense en el servidor (metadatos PDF, EXIF, ELA)
    try {
      const dataUrl = await leerComoDataUrl(file);
      const fr = await api.post<{ nivelRiesgo?: string; hallazgos?: Array<{ severidad: string; texto: string }> }>(
        '/forense', { archivoBase64: dataUrl, nombre: file.name },
      );
      for (const h of fr.data?.hallazgos || []) {
        if (h.severidad === 'alta' || h.severidad === 'media') alertas.push(`🔎 ${h.texto}`);
      }
    } catch { /* el análisis forense es complementario; si falla, no bloquea */ }

    return { nombre: file.name, confianza: ocr.confidence, alertas };
  }, [procesarArchivo]);

  const camposEnviar = useCallback(() => {
    if (!tipoSel) return [];
    return camposCompletos(tipoSel.camposPlantilla, tipoSel.plantillaPdf);
  }, [tipoSel]);

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErr('');
    setMsg('');
    if (!tipoSel) return;

    // Validacion cliente: campos requeridos
    const faltantes = camposEnviar().filter((c) => {
      if (!esVisible(c)) return false;
      if (!c.required) return false;
      if (c.type === 'file') return !docs[c.key];
      return !datos[c.key] || datos[c.key].trim() === '';
    });
    if (faltantes.length > 0) {
      setErr(`Faltan campos obligatorios: ${faltantes.map((f) => f.label).join(', ')}`);
      return;
    }
    // Campos "persona": deben coincidir con un usuario activo del sistema
    const personaInvalida = camposEnviar().filter((c) => c.type === 'persona' && (datos[c.key] || '').trim() !== '' && !personas.includes((datos[c.key] || '').trim()));
    if (personaInvalida.length > 0) {
      setErr(`Elige un usuario válido de la lista en: ${personaInvalida.map((f) => f.label).join(', ')}`);
      return;
    }
    if (!firmaSolicitante) {
      setErr('Debes firmar antes de enviar la solicitud.');
      return;
    }

    setEnviando(true);
    try {
      // Documentos enriquecidos con OCR si lo hubo
      const documentosFinales: Record<string, unknown> = {};
      Object.entries(docs).forEach(([k, nombre]) => {
        const ocrInfo = ocrPorCampo[k];
        const archivoId = docArchivos[k];
        documentosFinales[k] = {
          nombre,
          ...(archivoId ? { archivoId } : {}),
          ...(ocrInfo ? { ocrTexto: ocrInfo.texto, ocrConfianza: ocrInfo.confianza, ocrAlertas: ocrInfo.alertas } : {}),
        };
      });

      const r = await api.post<{ id: number; numeroRadicado: string; pasoLabel: string | null }>(
        '/solicitudes',
        {
          tipoSolicitudId: tipoSel.id,
          datos,
          documentos: documentosFinales,
          firmas: { profesional: firmaSolicitante },
        }
      );
      setMsg(
        `Solicitud creada. Radicado: ${r.data.numeroRadicado}. ` +
        (r.data.pasoLabel ? `Pendiente de: ${r.data.pasoLabel}` : '')
      );
      onCreada?.(r.data);
      // Despues de 1.5s reinicia el formulario
      setTimeout(reiniciar, 2000);
    } catch (e) {
      const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(r || 'No se pudo crear la solicitud.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="nueva-solicitud-panel">
      {/* Stepper */}
      <div className="nueva-sol-steps">
        <button
          type="button"
          className={`nueva-sol-step${paso >= 1 ? ' active' : ''}`}
          onClick={() => paso > 1 && setPaso(1)}
        >
          <span className="nueva-sol-step-n">1</span>
          <span>Area</span>
          {areaSel ? <small>{areaSel.nombre}</small> : null}
        </button>
        <div className="nueva-sol-divider" />
        <button
          type="button"
          className={`nueva-sol-step${paso >= 2 ? ' active' : ''}`}
          disabled={!areaSel}
          onClick={() => paso > 2 && areaSel && setPaso(2)}
        >
          <span className="nueva-sol-step-n">2</span>
          <span>Tipo de solicitud</span>
          {tipoSel ? <small>{tipoSel.nombre}</small> : null}
        </button>
        <div className="nueva-sol-divider" />
        <button
          type="button"
          className={`nueva-sol-step${paso >= 3 ? ' active' : ''}`}
          disabled={!tipoSel}
        >
          <span className="nueva-sol-step-n">3</span>
          <span>Diligenciar</span>
        </button>
      </div>

      {err ? <div className="admin-error">{err}</div> : null}
      {msg ? <div className="admin-success">{msg}</div> : null}

      {/* PASO 1: elegir area */}
      {paso === 1 ? (
        <div className="nueva-sol-cards">
          {loading ? <p className="admin-help-text">Cargando areas…</p> : null}
          {!loading && areas.length === 0 ? (
            <p className="admin-help-text">
              No hay areas activas. Pide al administrador crear al menos una en Panel administrador → Areas.
            </p>
          ) : null}
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              className="nueva-sol-card"
              onClick={() => elegirArea(a)}
            >
              <strong>{a.nombre}</strong>
              <p>{a.descripcion || 'Sin descripcion'}</p>
            </button>
          ))}
        </div>
      ) : null}

      {/* PASO 2: elegir tipo del area */}
      {paso === 2 && areaSel ? (
        <>
          <header className="admin-panel-head">
            <div>
              <h3>Tipo de solicitud · {areaSel.nombre}</h3>
              <p className="admin-help-text">Elige el tipo de solicitud que corresponde al tramite.</p>
            </div>
            <button type="button" className="admin-ghost-button" onClick={() => setPaso(1)}>
              ← Cambiar area
            </button>
          </header>
          <div className="nueva-sol-cards">
            {tiposDelArea.length === 0 ? (
              <p className="admin-help-text">
                No hay tipos de solicitud activos en esta area. Pide al administrador crear uno
                en Panel administrador → Tipos de solicitud.
              </p>
            ) : null}
            {tiposDelArea.map((t) => (
              <button
                key={t.id}
                type="button"
                className="nueva-sol-card"
                onClick={() => elegirTipo(t)}
              >
                <strong>{t.nombre}</strong>
                <p>{t.descripcion || 'Sin descripcion'}</p>
                <small>{t.camposPlantilla.length} campo(s)</small>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* PASO 3: diligenciar formulario */}
      {paso === 3 && tipoSel ? (
        <>
          <header className="admin-panel-head">
            <div>
              <h3>{tipoSel.nombre}</h3>
              <p className="admin-help-text">{areaSel?.nombre} · {tipoSel.descripcion || 'Diligencia los campos requeridos.'}</p>
            </div>
            <button type="button" className="admin-ghost-button" onClick={() => setPaso(2)}>
              ← Cambiar tipo
            </button>
          </header>

          {(() => {
            const norm = (s: string) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
            const esLegal     = norm(tipoSel.slug) === 'legalizacion' || norm(tipoSel.nombre) === 'legalizacion';
            const esViat      = norm(tipoSel.slug) === 'viaticos'    || norm(tipoSel.nombre) === 'viaticos';
            const esAnticipo  = norm(tipoSel.slug) === 'anticipo'    || norm(tipoSel.nombre) === 'anticipo';
            if (esLegal)    return <LegalizacionPanel tipoSolicitudId={tipoSel.id} areaId={areaSel?.id} onCreada={onCreada} />;
            if (esViat)     return <ViaticosPanel     onCreada={onCreada} />;
            if (esAnticipo) return <AnticipOPanel     onCreada={onCreada} />;
            return (
          <form className="nueva-sol-form" onSubmit={enviar}>
            {/* Indicador de sub-pasos */}
            <div className="nueva-sol-substeps">
              {gruposArr.map(([g], i) => (
                <span key={g} className={`nueva-sol-substep${i === subPaso ? ' active' : ''}${i < subPaso ? ' done' : ''}`}>
                  {i + 1}. {g}
                </span>
              ))}
              <span className={`nueva-sol-substep${subPaso === gruposArr.length ? ' active' : ''}`}>
                {gruposArr.length + 1}. Firma
              </span>
            </div>

            {subPaso < gruposArr.length ? (() => {
              const [grupo, campos] = gruposArr[subPaso];
              return (
              <div key={grupo} className="nueva-sol-grupo">
                <h4 className="nueva-sol-grupo-titulo">{grupo}</h4>
                <div className="nueva-sol-grupo-grid">
                  {campos.filter((c) => esVisible(c)).map((c) => (
                    <div key={c.key} className={`form-group${(c.type === 'direccion' || c.type === 'textarea' || c.type === 'tabla-items' || c.type === 'file' || c.type === 'texto-fijo') ? ' form-group--wide' : ''}`}>
                      <label htmlFor={`f-${c.key}`}>
                        {c.label} {c.required ? <span className="req">*</span> : null}
                      </label>
                      {c.type === 'textarea' ? (
                        <textarea
                          id={`f-${c.key}`}
                          value={datos[c.key] || ''}
                          onChange={(e) => setDatos((p) => ({ ...p, [c.key]: e.target.value }))}
                          required={c.required}
                        />
                      ) : c.type === 'file' ? (
                        <>
                          <input
                            id={`f-${c.key}`}
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => handleFile(c.key, e.target.files?.[0] ?? null)}
                            required={c.required && !docs[c.key]}
                          />
                          {subiendoDoc === c.key ? (
                            <small className="admin-help-text">⏳ Subiendo el archivo…</small>
                          ) : docArchivos[c.key] ? (
                            <small className="ocr-ok" style={{ display: 'block' }}>✓ Archivo guardado ({docs[c.key]})</small>
                          ) : null}
                          {c.ocr_target ? (
                            <small className="admin-help-text">
                              Validación automática con inteligencia artificial · documento esperado: <em>{etiquetaDocumento(c.ocr_target)}</em>
                            </small>
                          ) : null}
                          {ocrCampoActivo === c.key && ocrRunning ? (
                            <div className="ocr-progress">
                              <div className="ocr-progress-bar" style={{ width: `${ocrProgress}%` }} />
                              <small>Validando con inteligencia artificial… {ocrProgress}%</small>
                            </div>
                          ) : null}
                          {ocrPorCampo[c.key] ? (
                            <div className={`ocr-result ${ocrPorCampo[c.key].alertas.length > 0 ? 'ocr-warn' : 'ocr-ok'}`}>
                              {ocrPorCampo[c.key].alertas.length === 0 ? (
                                <small>✓ Documento validado por IA · confiabilidad {Math.round(ocrPorCampo[c.key].confianza)}%</small>
                              ) : (
                                <>
                                  <small>⚠ La inteligencia artificial detectó:</small>
                                  <ul>
                                    {ocrPorCampo[c.key].alertas.map((a, i) => <li key={i}>{a}</li>)}
                                  </ul>
                                </>
                              )}
                            </div>
                          ) : null}
                        </>
                      ) : c.type === 'texto-fijo' ? (
                        <p className="texto-fijo-nota">
                          {(c as { texto?: string }).texto || c.label}
                        </p>
                      ) : c.type === 'tipo-doc' ? (
                        <select
                          id={`f-${c.key}`}
                          value={datos[c.key] || ''}
                          onChange={(e) => setDatos((p) => ({ ...p, [c.key]: e.target.value }))}
                          required={c.required}
                        >
                          <option value="">— selecciona —</option>
                          <option value="CC">Cedula de ciudadania (CC)</option>
                          <option value="CE">Cedula de extranjeria (CE)</option>
                          <option value="TI">Tarjeta de identidad (TI)</option>
                          <option value="PP">Pasaporte (PP)</option>
                          <option value="NIT">NIT</option>
                        </select>
                      ) : c.type === 'mes-anio' ? (
                        <input
                          id={`f-${c.key}`}
                          type="month"
                          value={datos[c.key] || ''}
                          onChange={(e) => setDatos((p) => ({ ...p, [c.key]: e.target.value }))}
                          required={c.required}
                        />
                      ) : c.type === 'valor-pesos' ? (
                        <div className="valor-pesos-wrap">
                          <input
                            id={`f-${c.key}`}
                            type="text"
                            inputMode="numeric"
                            placeholder="Ej: 1500000"
                            value={datos[c.key] || ''}
                            onChange={(e) => {
                              const limpio = e.target.value.replace(/\D/g, '');
                              setDatos((p) => ({
                                ...p,
                                [c.key]: limpio,
                                [`${c.key}__letras`]: numeroAPesosEnLetras(limpio),
                              }));
                            }}
                            required={c.required}
                          />
                          {datos[c.key] ? (
                            <div className="valor-pesos-preview">
                              <span>$ {formatearMiles(datos[c.key])}</span>
                              <strong>{datos[`${c.key}__letras`] || numeroAPesosEnLetras(datos[c.key])}</strong>
                            </div>
                          ) : null}
                        </div>
                      ) : c.type === 'cuenta-bancaria' ? (
                        <input
                          id={`f-${c.key}`}
                          type="text"
                          inputMode="numeric"
                          placeholder="Solo numeros"
                          value={datos[c.key] || ''}
                          onChange={(e) => setDatos((p) => ({ ...p, [c.key]: e.target.value.replace(/\D/g, '') }))}
                          required={c.required}
                        />
                      ) : c.type === 'banco-select' ? (
                        <select
                          id={`f-${c.key}`}
                          value={datos[c.key] || ''}
                          onChange={(e) => setDatos((p) => ({ ...p, [c.key]: e.target.value }))}
                          required={c.required}
                        >
                          <option value="">— selecciona banco —</option>
                          {BANCOS_COLOMBIA.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      ) : c.type === 'select' && (c.opciones?.length ?? 0) > 0 ? (
                        <select
                          id={`f-${c.key}`}
                          value={datos[c.key] || ''}
                          onChange={(e) => setDatos((p) => ({ ...p, [c.key]: e.target.value }))}
                          required={c.required}
                        >
                          <option value="">— selecciona —</option>
                          {(c.opciones || []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : c.type === 'tabla-items' ? (
                        <TablaItemsField
                          columnas={c.columnas || []}
                          value={datos[c.key] || ''}
                          onChange={(json) => setDatos((p) => ({ ...p, [c.key]: json }))}
                          conFactura={c.conFactura}
                          verificaciones={c.verificaciones}
                          establecimiento={c.establecimientoEsperado}
                          onValidarFactura={validarFacturaFila}
                        />
                      ) : c.type === 'direccion' ? (
                        <DireccionField
                          value={datos[c.key] || ''}
                          onChange={(json) => setDatos((p) => ({ ...p, [c.key]: json }))}
                          required={c.required}
                        />
                      ) : c.type === 'select' && c.key === 'tipoCuenta' ? (
                        <select
                          id={`f-${c.key}`}
                          value={datos[c.key] || ''}
                          onChange={(e) => setDatos((p) => ({ ...p, [c.key]: e.target.value }))}
                          required={c.required}
                        >
                          <option value="">— selecciona —</option>
                          <option value="ahorros">Ahorros</option>
                          <option value="corriente">Corriente</option>
                        </select>
                      ) : c.type === 'select' && c.key === 'tipoTransporte' ? (
                        <select
                          id={`f-${c.key}`}
                          value={datos[c.key] || ''}
                          onChange={(e) => setDatos((p) => ({ ...p, [c.key]: e.target.value }))}
                          required={c.required}
                        >
                          <option value="">— selecciona —</option>
                          <option value="avion">Avión</option>
                          <option value="taxi">Taxi</option>
                          <option value="pickup">Pick-up / Uber / Cabify / DiDi</option>
                          <option value="carro_arrendado">Carro arrendado</option>
                          <option value="bus">Bus / transporte público</option>
                          <option value="otro">Otro</option>
                        </select>
                      ) : c.type === 'calculado' ? (
                        <div className="valor-pesos-wrap">
                          <input
                            id={`f-${c.key}`}
                            type="text"
                            value={`$ ${formatearMiles(datos[c.key] || '0')}`}
                            readOnly
                            tabIndex={-1}
                            style={{ background: '#f3f4f6', fontWeight: 700 }}
                          />
                          <div className="valor-pesos-preview">
                            <span>Se calcula automáticamente: {(c.operandos || []).map((k) => tipoSel?.camposPlantilla.find((x) => x.key === k)?.label || k).join(c.operacion === 'resta' ? ' − ' : c.operacion === 'multiplicacion' ? ' × ' : c.operacion === 'division' ? ' ÷ ' : ' + ')}</span>
                          </div>
                        </div>
                      ) : c.type === 'persona' ? (
                        (() => {
                          const val = (datos[c.key] || '').trim();
                          const esValido = val !== '' && personas.includes(val);
                          const escribiendo = val.length > 0 && val.length < 3;
                          return (
                            <>
                              <input
                                id={`f-${c.key}`}
                                type="text"
                                list={`dl-${c.key}`}
                                autoComplete="off"
                                value={datos[c.key] || ''}
                                onChange={(e) => setDatos((p) => ({ ...p, [c.key]: e.target.value }))}
                                required={c.required}
                                placeholder="Escribe al menos 3 letras y elige de la lista…"
                                style={val !== '' ? { borderColor: esValido ? '#16a34a' : '#dc2626' } : undefined}
                              />
                              <datalist id={`dl-${c.key}`}>
                                {personas.map((n, i) => <option key={i} value={n} />)}
                              </datalist>
                              {val === '' ? (
                                <small className="admin-help-text">Solo se permiten usuarios activos del sistema.</small>
                              ) : esValido ? (
                                <small className="ocr-ok" style={{ display: 'block' }}>✓ Usuario válido</small>
                              ) : (
                                <small style={{ display: 'block', color: '#dc2626' }}>
                                  {escribiendo ? 'Sigue escribiendo y elige una opción de la lista.' : 'Debes elegir un usuario de la lista (no es un usuario válido).'}
                                </small>
                              )}
                            </>
                          );
                        })()
                      ) : (
                        <input
                          id={`f-${c.key}`}
                          type={c.type === 'cc' || c.type === 'nit' ? 'text' : c.type}
                          inputMode={c.type === 'cc' || c.type === 'nit' || c.type === 'number' ? 'numeric' : undefined}
                          value={datos[c.key] || ''}
                          onChange={(e) => setDatos((p) => ({ ...p, [c.key]: e.target.value }))}
                          required={c.required}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              );
            })() : (
              <div className="nueva-sol-grupo">
                <h4 className="nueva-sol-grupo-titulo">Firma del solicitante</h4>
                <SignaturePad
                  label="Firma con dedo, lapiz tactil o adjunta imagen"
                  value={firmaSolicitante}
                  onChange={setFirmaSolicitante}
                />
              </div>
            )}

            <div className="nueva-sol-actions">
              <button type="button" className="admin-ghost-button" onClick={reiniciar}>
                Cancelar
              </button>
              {subPaso > 0 ? (
                <button type="button" className="admin-ghost-button" onClick={anteriorSubPaso}>
                  ← Anterior
                </button>
              ) : null}
              {subPaso < totalSubPasos - 1 ? (
                <button type="button" className="admin-primary-button" onClick={siguienteSubPaso}>
                  Siguiente →
                </button>
              ) : (
              <button type="submit" className="admin-primary-button" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar solicitud'}
              </button>
              )}
            </div>
          </form>
            );
          })()}
        </>
      ) : null}
    </section>
  );
}
