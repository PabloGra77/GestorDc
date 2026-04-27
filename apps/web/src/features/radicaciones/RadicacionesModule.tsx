import { FormEvent, useMemo, useRef, useState } from 'react';
import { createCuentaCobroOpsSolicitud } from './radicaciones.service';

type RadicacionesVista =
  | 'nuevaSolicitud'
  | 'tablero'
  | 'opsCuentaCobro'
  | 'validacion'
  | 'supervision'
  | 'historial';

type EstadoDocumento = 'cargado' | 'pendiente' | 'rechazado' | 'aprobado';
type Cumplimiento = 'si' | 'parcial' | 'no';

interface DocumentoRadicacion {
  id: number;
  nombre: string;
  estado: EstadoDocumento;
  observacion?: string;
  archivo?: string;
}

interface ObligacionSupervision {
  id: number;
  titulo: string;
  detalle: string;
  cumplimiento: Cumplimiento;
  observacion: string;
}

interface HistorialCuenta {
  id: number;
  periodo: string;
  contratista: string;
  estado: 'Aprobada' | 'En revisión' | 'Rechazada';
}

const ETAPAS_FLUJO = [
  'Radicación documental',
  'Validación documental',
  'Informe de supervisión',
  'Decisión final',
] as const;

const DOCUMENTOS_BASE: DocumentoRadicacion[] = [
  { id: 1, nombre: 'Cuenta de cobro firmada', estado: 'cargado' },
  { id: 2, nombre: 'RUT actualizado', estado: 'cargado' },
  { id: 3, nombre: 'Planilla PILA', estado: 'rechazado', observacion: 'Falta soporte del último periodo' },
  { id: 4, nombre: 'Certificación bancaria', estado: 'pendiente' },
  { id: 5, nombre: 'Informe de actividades OPS', estado: 'cargado' },
];

const OBLIGACIONES_BASE: ObligacionSupervision[] = [
  {
    id: 1,
    titulo: 'Obligación 1: Entrega de informes mensuales',
    detalle: 'Validar consistencia técnica, oportunidad de entrega y soportes anexos.',
    cumplimiento: 'si',
    observacion: '',
  },
  {
    id: 2,
    titulo: 'Obligación 2: Actualización de expediente contractual',
    detalle: 'Revisar trazabilidad de documentos y actualización de metadatos obligatorios.',
    cumplimiento: 'parcial',
    observacion: '',
  },
  {
    id: 3,
    titulo: 'Obligación 3: Respuesta a requerimientos de interventoría',
    detalle: 'Confirmar cierre de hallazgos abiertos y cumplimiento de plazos de respuesta.',
    cumplimiento: 'no',
    observacion: '',
  },
];

const HISTORIAL_BASE: HistorialCuenta[] = [
  { id: 4021, periodo: 'Ene 2026', contratista: 'Pablo Granados Garay', estado: 'Aprobada' },
  { id: 4022, periodo: 'Feb 2026', contratista: 'Pablo Granados Garay', estado: 'Rechazada' },
  { id: 4023, periodo: 'Mar 2026', contratista: 'Pablo Granados Garay', estado: 'En revisión' },
];

const DOCUMENTOS_OPS_TEMPLATE = [
  'Cuenta de cobro firmada',
  'RUT actualizado',
  'Planilla PILA del periodo',
  'Certificación bancaria vigente',
  'Informe de actividades OPS',
];

function estadoDocumentoLabel(estado: EstadoDocumento) {
  switch (estado) {
    case 'cargado':
      return 'Cargado';
    case 'pendiente':
      return 'Pendiente';
    case 'rechazado':
      return 'Rechazado';
    case 'aprobado':
      return 'Aprobado';
    default:
      return estado;
  }
}

function cumplimientoLabel(cumplimiento: Cumplimiento) {
  if (cumplimiento === 'si') return 'Sí';
  if (cumplimiento === 'parcial') return 'Parcial';
  return 'No';
}

export function RadicacionesModule() {
  const [vistaActiva, setVistaActiva] = useState<RadicacionesVista>('nuevaSolicitud');
  const [documentos, setDocumentos] = useState<DocumentoRadicacion[]>(DOCUMENTOS_BASE);
  const [obligaciones, setObligaciones] = useState<ObligacionSupervision[]>(OBLIGACIONES_BASE);
  const [historial, setHistorial] = useState<HistorialCuenta[]>(HISTORIAL_BASE);
  const [etapaActual, setEtapaActual] = useState(0);
  const [obligacionExpandida, setObligacionExpandida] = useState<number | null>(OBLIGACIONES_BASE[0].id);
  const [firmaSupervisor, setFirmaSupervisor] = useState('');
  const [firmaContratista, setFirmaContratista] = useState('');
  const [estadoMensaje, setEstadoMensaje] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composePara, setComposePara] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeReferencia, setComposeReferencia] = useState('');
  const [composeMensaje, setComposeMensaje] = useState('');
  const [correoSolicitado, setCorreoSolicitado] = useState('');
  const [numeroCcSolicitado, setNumeroCcSolicitado] = useState('');
  const [nombreSolicitado, setNombreSolicitado] = useState('');
  const [observacionesSolicitud, setObservacionesSolicitud] = useState('');
  const [documentosSolicitados, setDocumentosSolicitados] = useState<string[]>([...DOCUMENTOS_OPS_TEMPLATE]);
  const composeAdjuntoInputRef = useRef<HTMLInputElement | null>(null);
  const composeMensajeEditorRef = useRef<HTMLDivElement | null>(null);

  const documentosPendientes = useMemo(
    () => documentos.filter((documento) => documento.estado === 'pendiente').length,
    [documentos],
  );

  const documentosProcesadosPorRevisor = useMemo(
    () => documentos.filter((documento) => documento.estado === 'aprobado' || documento.estado === 'rechazado').length,
    [documentos],
  );

  const todosProcesados = documentosProcesadosPorRevisor === documentos.length;

  const cuentasAprobadas = useMemo(
    () => historial.filter((item) => item.estado === 'Aprobada').length,
    [historial],
  );

  const cuentasEnRevision = useMemo(
    () => historial.filter((item) => item.estado === 'En revisión').length,
    [historial],
  );

  const cuentasRechazadas = useMemo(
    () => historial.filter((item) => item.estado === 'Rechazada').length,
    [historial],
  );

  const avanceObligaciones = useMemo(() => {
    const total = obligaciones.length;
    const puntaje = obligaciones.reduce((acumulado, item) => {
      if (item.cumplimiento === 'si') return acumulado + 1;
      if (item.cumplimiento === 'parcial') return acumulado + 0.5;
      return acumulado;
    }, 0);

    return Math.round((puntaje / total) * 100);
  }, [obligaciones]);

  function cargarDocumento(id: number) {
    setDocumentos((actuales) =>
      actuales.map((documento) =>
        documento.id === id
          ? {
              ...documento,
              estado: 'cargado',
              observacion: undefined,
              archivo: `soporte_${id}.pdf`,
            }
          : documento,
      ),
    );
  }

  function enviarAValidacion() {
    setEtapaActual(1);
    setVistaActiva('validacion');
    setEstadoMensaje('La cuenta fue enviada a validación documental.');
  }

  function decidirDocumento(id: number, decision: 'aprobado' | 'rechazado') {
    setDocumentos((actuales) =>
      actuales.map((documento) =>
        documento.id === id
          ? {
              ...documento,
              estado: decision,
              observacion: decision === 'rechazado' ? 'Subsanar soporte en formato válido' : undefined,
            }
          : documento,
      ),
    );
  }

  function enviarASupervision() {
    setEtapaActual(2);
    setVistaActiva('supervision');
    setEstadoMensaje('Validación completa. La cuenta fue enviada a supervisión.');
  }

  function actualizarCumplimiento(id: number, cumplimiento: Cumplimiento) {
    setObligaciones((actuales) =>
      actuales.map((item) => (item.id === id ? { ...item, cumplimiento } : item)),
    );
  }

  function actualizarObservacion(id: number, observacion: string) {
    setObligaciones((actuales) =>
      actuales.map((item) => (item.id === id ? { ...item, observacion } : item)),
    );
  }

  function finalizarCuenta(estado: 'Aprobada' | 'Rechazada') {
    if (!firmaSupervisor.trim() || !firmaContratista.trim()) {
      setEstadoMensaje('Debes registrar la firma electrónica de supervisor y contratista.');
      return;
    }

    const nuevaCuenta: HistorialCuenta = {
      id: Date.now(),
      periodo: 'Abr 2026',
      contratista: 'Pablo Granados Garay',
      estado: estado === 'Aprobada' ? 'Aprobada' : 'Rechazada',
    };

    setHistorial((actual) => [nuevaCuenta, ...actual]);
    setEtapaActual(3);
    setVistaActiva('historial');
    setEstadoMensaje(
      estado === 'Aprobada'
        ? 'La cuenta fue avalada y registrada en historial.'
        : 'La cuenta fue objetada y quedó pendiente de subsanación.',
    );
  }

  function subsanarCuenta() {
    setDocumentos((actuales) =>
      actuales.map((documento) =>
        documento.estado === 'rechazado' ? { ...documento, estado: 'pendiente', observacion: undefined } : documento,
      ),
    );
    setEtapaActual(0);
    setVistaActiva('opsCuentaCobro');
    setEstadoMensaje('Se habilitó la subsanación de documentos rechazados.');
  }

  function toggleDocumentoSolicitado(documento: string) {
    setDocumentosSolicitados((actuales) => {
      if (actuales.includes(documento)) {
        return actuales.filter((item) => item !== documento);
      }
      return [...actuales, documento];
    });
  }

  function sincronizarMensajeDesdeEditor() {
    const editor = composeMensajeEditorRef.current;
    if (!editor) {
      return;
    }

    const textoPlano = editor.innerText.replace(/\u00a0/g, ' ').trim();
    setComposeMensaje(textoPlano);
  }

  function aplicarComandoEditor(command: string) {
    const editor = composeMensajeEditorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    document.execCommand(command, false);
    sincronizarMensajeDesdeEditor();
  }

  function insertarEnlaceEditor() {
    const editor = composeMensajeEditorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    const url = window.prompt('URL del enlace', 'https://');
    if (!url) {
      return;
    }

    document.execCommand('createLink', false, url);
    sincronizarMensajeDesdeEditor();
  }

  function handleSubmitNuevaSolicitud(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!composePara.trim()) {
      setEstadoMensaje('Ingresa al menos un destino en el campo Para.');
      return;
    }

    if (!composeReferencia.trim()) {
      setEstadoMensaje('Ingresa el asunto o referencia de la solicitud.');
      return;
    }

    setCorreoSolicitado(composePara.trim());
    setObservacionesSolicitud(composeMensaje.trim() || composeReferencia.trim());
    setVistaActiva('opsCuentaCobro');
    setEstadoMensaje('Completa los datos OPS para enviar la solicitud de cuenta de cobro.');
    setIsComposeOpen(false);
    setComposePara('');
    setComposeCc('');
    setComposeReferencia('');
    setComposeMensaje('');
    if (composeMensajeEditorRef.current) {
      composeMensajeEditorRef.current.innerText = '';
    }
  }

  async function handleCrearSolicitudOps(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!correoSolicitado.trim()) {
      setEstadoMensaje('Ingresa el correo del contratista al que se solicitarán los documentos.');
      return;
    }

    if (!numeroCcSolicitado.trim()) {
      setEstadoMensaje('Ingresa el número de CC del contratista para validación.');
      return;
    }

    if (documentosSolicitados.length === 0) {
      setEstadoMensaje('Selecciona al menos un documento solicitado.');
      return;
    }

    try {
      const response = await createCuentaCobroOpsSolicitud({
        correoSolicitado: correoSolicitado.trim(),
        numeroCcSolicitado: numeroCcSolicitado.trim(),
        nombreSolicitado: nombreSolicitado.trim() || undefined,
        documentosSolicitados,
        observaciones: observacionesSolicitud.trim() || undefined,
      });

      setEstadoMensaje(
        `Solicitud creada. Radicado ${response.numero}. Se envió correo a ${response.correoSolicitado} con el enlace de carga.`,
      );
      setVistaActiva('validacion');
    } catch {
      setEstadoMensaje('No fue posible crear la solicitud OPS. Verifica los datos e intenta nuevamente.');
    }
  }

  return (
    <section className="card-surface radicaciones-module">
      <header className="radicaciones-head">
        <div>
          <h3>RADICACIONES</h3>
          <p>
            Flujo legal de cuentas de cobro para contratación pública en Colombia (Ley 80/93,
            Ley 1150/2007, Resolución 2275/2023).
          </p>
        </div>
      </header>

      {estadoMensaje ? <div className="admin-success">{estadoMensaje}</div> : null}

      <nav className="radicaciones-nav" aria-label="Módulos de radicación">
        <button
          type="button"
          className={`radicaciones-nav-item${vistaActiva === 'nuevaSolicitud' ? ' active' : ''}`}
          onClick={() => setVistaActiva('nuevaSolicitud')}
        >
          Nueva solicitud
        </button>
        <button
          type="button"
          className={`radicaciones-nav-item${vistaActiva === 'tablero' ? ' active' : ''}`}
          onClick={() => setVistaActiva('tablero')}
        >
          Tablero general
        </button>
        <button
          type="button"
          className={`radicaciones-nav-item${vistaActiva === 'opsCuentaCobro' ? ' active' : ''}`}
          onClick={() => setVistaActiva('opsCuentaCobro')}
        >
          Radicación cuenta cobro OPS
        </button>
        <button
          type="button"
          className={`radicaciones-nav-item${vistaActiva === 'validacion' ? ' active' : ''}`}
          onClick={() => setVistaActiva('validacion')}
        >
          Validación documental
        </button>
        <button
          type="button"
          className={`radicaciones-nav-item${vistaActiva === 'supervision' ? ' active' : ''}`}
          onClick={() => setVistaActiva('supervision')}
        >
          Informe de supervisión
        </button>
        <button
          type="button"
          className={`radicaciones-nav-item${vistaActiva === 'historial' ? ' active' : ''}`}
          onClick={() => setVistaActiva('historial')}
        >
          Historial
        </button>
      </nav>

      {vistaActiva === 'nuevaSolicitud' ? (
        <section className="radicaciones-panel">
          <h4>Nueva solicitud</h4>
          <div className="radicaciones-nueva-solicitud-box">
            <button
              type="button"
              className="radicado-action-button"
              onClick={() => setIsComposeOpen(true)}
            >
              Realizar nueva solicitud
            </button>
          </div>

          {isComposeOpen ? (
            <div className="mail-compose-overlay" role="dialog" aria-modal="true" aria-label="Redactar solicitud">
              <div className="mail-compose-window card-surface">
                <div className="mail-compose-window-head">
                  <div>
                    <strong>Realizar nueva solicitud</strong>
                    <span>Correspondencia institucional</span>
                  </div>
                </div>

                <div className="mail-editor-toolbar" role="toolbar" aria-label="Herramientas de redacción">
                  <button
                    type="button"
                    className="mail-toolbar-button"
                    aria-label="Negrita"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      aplicarComandoEditor('bold');
                    }}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className="mail-toolbar-button"
                    aria-label="Cursiva"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      aplicarComandoEditor('italic');
                    }}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    className="mail-toolbar-button"
                    aria-label="Subrayado"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      aplicarComandoEditor('underline');
                    }}
                  >
                    U
                  </button>
                  <button
                    type="button"
                    className="mail-toolbar-button"
                    aria-label="Insertar enlace"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertarEnlaceEditor();
                    }}
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    className="mail-toolbar-button"
                    aria-label="Adjuntar archivo"
                    onClick={() => composeAdjuntoInputRef.current?.click()}
                  >
                    Adjuntar
                  </button>
                </div>

                <form className="admin-form mail-compose-form" onSubmit={handleSubmitNuevaSolicitud}>
                  <input ref={composeAdjuntoInputRef} type="file" multiple className="mail-hidden-file-input" />

                  <label className="mail-chip-label">Para</label>
                  <input
                    type="text"
                    placeholder="usuario o correo"
                    value={composePara}
                    onChange={(event) => setComposePara(event.target.value)}
                    required
                  />

                  <label className="mail-chip-label">CC (opcional)</label>
                  <input
                    type="text"
                    placeholder="usuario o correo en copia"
                    value={composeCc}
                    onChange={(event) => setComposeCc(event.target.value)}
                  />

                  <input
                    type="text"
                    className="mail-compose-subject"
                    placeholder="Asunto / referencia unica"
                    value={composeReferencia}
                    onChange={(event) => setComposeReferencia(event.target.value)}
                    required
                  />

                  <div
                    ref={composeMensajeEditorRef}
                    className="mail-compose-editor"
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    data-placeholder="Redacta el contenido de la solicitud"
                    onInput={sincronizarMensajeDesdeEditor}
                  />

                  <div className="mail-compose-actions">
                    <button type="button" className="mail-compose-close" onClick={() => setIsComposeOpen(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="radicado-action-button">
                      Enviar a radicacion
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {vistaActiva === 'tablero' ? (
        <div className="radicaciones-grid">
          <article className="radicaciones-kpi">
            <span>Cuentas aprobadas</span>
            <strong>{cuentasAprobadas}</strong>
          </article>
          <article className="radicaciones-kpi">
            <span>Cuentas en revisión</span>
            <strong>{cuentasEnRevision}</strong>
          </article>
          <article className="radicaciones-kpi">
            <span>Cuentas rechazadas</span>
            <strong>{cuentasRechazadas}</strong>
          </article>

          <article className="radicaciones-progress">
            <h4>Progreso de obligaciones contractuales</h4>
            <div className="radicaciones-progress-track" role="progressbar" aria-valuenow={avanceObligaciones}>
              <div className="radicaciones-progress-bar" style={{ width: `${avanceObligaciones}%` }} />
            </div>
            <span>{avanceObligaciones}% de cumplimiento agregado</span>
          </article>

          <article className="radicaciones-timeline">
            <h4>Línea de tiempo de radicación</h4>
            <ol>
              {ETAPAS_FLUJO.map((etapa, index) => (
                <li key={etapa} className={index <= etapaActual ? 'done' : ''}>
                  {etapa}
                </li>
              ))}
            </ol>
          </article>
        </div>
      ) : null}

      {vistaActiva === 'opsCuentaCobro' ? (
        <div className="radicaciones-panel">
          <h4>Radicación de cuentas de cobro OPS</h4>
          <p className="admin-help-text">
            Crea la solicitud y el sistema enviará al contratista un correo con número de radicado y enlace de carga.
          </p>

          <form className="admin-form" onSubmit={handleCrearSolicitudOps}>
            <input
              type="email"
              placeholder="Correo del contratista"
              value={correoSolicitado}
              onChange={(event) => setCorreoSolicitado(event.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Número de CC del contratista"
              value={numeroCcSolicitado}
              onChange={(event) => setNumeroCcSolicitado(event.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Nombre del contratista (opcional)"
              value={nombreSolicitado}
              onChange={(event) => setNombreSolicitado(event.target.value)}
            />

            <div className="role-permissions-builder">
              <h5>Documentos solicitados</h5>
              <div className="role-permissions-grid">
                {DOCUMENTOS_OPS_TEMPLATE.map((documento) => (
                  <label key={documento} className="role-permission-item">
                    <input
                      type="checkbox"
                      checked={documentosSolicitados.includes(documento)}
                      onChange={() => toggleDocumentoSolicitado(documento)}
                    />
                    <span>{documento}</span>
                  </label>
                ))}
              </div>
            </div>

            <textarea
              placeholder="Observaciones para el contratista"
              value={observacionesSolicitud}
              onChange={(event) => setObservacionesSolicitud(event.target.value)}
            />

            <button type="submit" className="admin-primary-button">
              Crear solicitud de radicación OPS
            </button>
          </form>
        </div>
      ) : null}

      {vistaActiva === 'validacion' ? (
        <div className="radicaciones-panel">
          <h4>Panel de validación del revisor</h4>
          <ul className="radicaciones-doc-list">
            {documentos.map((documento) => (
              <li key={documento.id} className={documento.estado === 'rechazado' ? 'rejected' : ''}>
                <div>
                  <strong>{documento.nombre}</strong>
                  <span className={`status-pill ${documento.estado === 'rechazado' ? 'off' : 'on'}`}>
                    {estadoDocumentoLabel(documento.estado)}
                  </span>
                </div>
                <div className="radicaciones-doc-actions">
                  <button
                    type="button"
                    className="admin-ghost-button"
                    onClick={() => decidirDocumento(documento.id, 'aprobado')}
                  >
                    ✓ Aprobar
                  </button>
                  <button
                    type="button"
                    className="admin-ghost-button"
                    onClick={() => decidirDocumento(documento.id, 'rechazado')}
                  >
                    ✗ Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="admin-primary-button"
            disabled={!todosProcesados}
            onClick={enviarASupervision}
          >
            Enviar a supervisión
          </button>
        </div>
      ) : null}

      {vistaActiva === 'supervision' ? (
        <div className="radicaciones-panel">
          <h4>Informe de supervisión</h4>
          <div className="radicaciones-obligaciones">
            {obligaciones.map((obligacion) => (
              <article key={obligacion.id} className="radicaciones-obligacion-item">
                <button
                  type="button"
                  className="radicaciones-obligacion-toggle"
                  onClick={() =>
                    setObligacionExpandida((actual) =>
                      actual === obligacion.id ? null : obligacion.id,
                    )
                  }
                >
                  <strong>{obligacion.titulo}</strong>
                  <span>{cumplimientoLabel(obligacion.cumplimiento)}</span>
                </button>

                {obligacionExpandida === obligacion.id ? (
                  <div className="radicaciones-obligacion-body">
                    <p>{obligacion.detalle}</p>
                    <div className="radicaciones-cumplimiento-options">
                      <label>
                        <input
                          type="radio"
                          name={`cumplimiento-${obligacion.id}`}
                          checked={obligacion.cumplimiento === 'si'}
                          onChange={() => actualizarCumplimiento(obligacion.id, 'si')}
                        />
                        Sí
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`cumplimiento-${obligacion.id}`}
                          checked={obligacion.cumplimiento === 'parcial'}
                          onChange={() => actualizarCumplimiento(obligacion.id, 'parcial')}
                        />
                        Parcial
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`cumplimiento-${obligacion.id}`}
                          checked={obligacion.cumplimiento === 'no'}
                          onChange={() => actualizarCumplimiento(obligacion.id, 'no')}
                        />
                        No
                      </label>
                    </div>
                    <textarea
                      placeholder="Observaciones de supervisión"
                      value={obligacion.observacion}
                      onChange={(event) => actualizarObservacion(obligacion.id, event.target.value)}
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <div className="radicaciones-firmas">
            <h5>Constancia de firma electrónica</h5>
            <input
              type="text"
              placeholder="Firma supervisor"
              value={firmaSupervisor}
              onChange={(event) => setFirmaSupervisor(event.target.value)}
            />
            <input
              type="text"
              placeholder="Firma contratista"
              value={firmaContratista}
              onChange={(event) => setFirmaContratista(event.target.value)}
            />
          </div>

          <div className="radicaciones-supervision-actions">
            <button type="button" className="admin-ghost-button" onClick={() => finalizarCuenta('Rechazada')}>
              Objetar cuenta
            </button>
            <button type="button" className="admin-primary-button" onClick={() => finalizarCuenta('Aprobada')}>
              Avalar cuenta
            </button>
          </div>
        </div>
      ) : null}

      {vistaActiva === 'historial' ? (
        <div className="radicaciones-panel">
          <h4>Historial de cuentas</h4>
          <table className="radicaciones-history-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Periodo</th>
                <th>Contratista</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.periodo}</td>
                  <td>{item.contratista}</td>
                  <td>
                    <span className={`status-pill ${item.estado === 'Rechazada' ? 'off' : 'on'}`}>
                      {item.estado}
                    </span>
                  </td>
                  <td>
                    {item.estado === 'Rechazada' ? (
                      <button type="button" className="admin-ghost-button" onClick={subsanarCuenta}>
                        Subsanar
                      </button>
                    ) : (
                      <span className="radicaciones-history-neutral">Sin acciones</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
