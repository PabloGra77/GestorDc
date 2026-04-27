import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createCuentaCobroOpsSolicitud,
  submitCuentaCobroOpsDocumentos,
  verifyCuentaCobroOps,
} from './radicaciones.service';

type TurnoSolicitud = {
  fecha: string;
  numero: string;
  eron: string;
};

const ERON_OPCIONES = [
  'ERON Fresno',
  'ERON Honda',
  'ERON Ibague',
  'ERON Espinal',
  'ERON Melgar',
  'ERON Chaparral',
];

function formatearFechaTurno(fechaIso: string): string {
  const fecha = new Date(`${fechaIso}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    return fechaIso;
  }

  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fecha);
}

function convertirMenorDeCien(numero: number): string {
  const especiales = [
    'cero',
    'uno',
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve',
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'dieciseis',
    'diecisiete',
    'dieciocho',
    'diecinueve',
    'veinte',
    'veintiuno',
    'veintidos',
    'veintitres',
    'veinticuatro',
    'veinticinco',
    'veintiseis',
    'veintisiete',
    'veintiocho',
    'veintinueve',
  ];
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

  if (numero < 30) {
    return especiales[numero];
  }

  const decena = Math.floor(numero / 10);
  const unidad = numero % 10;

  if (unidad === 0) {
    return decenas[decena];
  }

  return `${decenas[decena]} y ${especiales[unidad]}`;
}

function convertirMenorDeMil(numero: number): string {
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  if (numero === 100) {
    return 'cien';
  }

  if (numero < 100) {
    return convertirMenorDeCien(numero);
  }

  const centena = Math.floor(numero / 100);
  const resto = numero % 100;

  if (resto === 0) {
    return centenas[centena];
  }

  return `${centenas[centena]} ${convertirMenorDeCien(resto)}`;
}

function convertirEnteroALetras(numero: number): string {
  if (numero === 0) {
    return 'cero';
  }

  if (numero < 1000) {
    return convertirMenorDeMil(numero);
  }

  if (numero < 1000000) {
    const miles = Math.floor(numero / 1000);
    const resto = numero % 1000;
    const prefijo = miles === 1 ? 'mil' : `${convertirMenorDeMil(miles)} mil`;
    return resto === 0 ? prefijo : `${prefijo} ${convertirMenorDeMil(resto)}`;
  }

  if (numero < 1000000000) {
    const millones = Math.floor(numero / 1000000);
    const resto = numero % 1000000;
    const prefijo = millones === 1 ? 'un millon' : `${convertirEnteroALetras(millones)} millones`;
    return resto === 0 ? prefijo : `${prefijo} ${convertirEnteroALetras(resto)}`;
  }

  const milesDeMillones = Math.floor(numero / 1000000000);
  const resto = numero % 1000000000;
  const prefijo = milesDeMillones === 1 ? 'mil millones' : `${convertirEnteroALetras(milesDeMillones)} mil millones`;
  return resto === 0 ? prefijo : `${prefijo} ${convertirEnteroALetras(resto)}`;
}

function numeroAPesosEnLetras(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  if (!digitos) {
    return '';
  }

  const numero = Number(digitos);
  if (!Number.isSafeInteger(numero)) {
    return '';
  }

  const textoBase = convertirEnteroALetras(numero)
    .replace(/veintiuno$/g, 'veintiun')
    .replace(/ y uno$/g, ' y un')
    .replace(/ uno$/g, ' un');

  return `${textoBase} ${numero === 1 ? 'peso' : 'pesos'}`;
}

export function OpsCuentaCobroUploadPage() {
  const [params] = useSearchParams();
  const [numeroRadicado, setNumeroRadicado] = useState((params.get('radicado') || '').trim().toUpperCase());

  const [numeroCc, setNumeroCc] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [mostrarSolicitud, setMostrarSolicitud] = useState(false);
  const [tipoRadicado, setTipoRadicado] = useState('radicacion-cuenta-cobro');
  const [correoSolicitud, setCorreoSolicitud] = useState('');
  const [numeroCcSolicitud, setNumeroCcSolicitud] = useState('');
  const [nombreSolicitud, setNombreSolicitud] = useState('');
  const [establecimientoSolicitud, setEstablecimientoSolicitud] = useState('IPS Goleman');
  const [mesRadicadoSolicitud, setMesRadicadoSolicitud] = useState('');
  const [ultimaFechaMesSolicitud, setUltimaFechaMesSolicitud] = useState('');
  const [lugarExpedicionCedulaSolicitud, setLugarExpedicionCedulaSolicitud] = useState('');
  const [valorNumeroSolicitud, setValorNumeroSolicitud] = useState('');
  const [valorLetrasSolicitud, setValorLetrasSolicitud] = useState('');
  const [turnosSolicitud, setTurnosSolicitud] = useState<TurnoSolicitud[]>([{ fecha: '', numero: '', eron: '' }]);
  const [cantidadTurnosSolicitud, setCantidadTurnosSolicitud] = useState('');
  const [fechaInicioContratoSolicitud, setFechaInicioContratoSolicitud] = useState('');
  const [objetoContractualSolicitud, setObjetoContractualSolicitud] = useState('Administración de medicamentos');
  const [epsSolicitud, setEpsSolicitud] = useState('');
  const [nombreCoordinadoraSolicitud, setNombreCoordinadoraSolicitud] = useState('');
  const [notaAclaratoriaSolicitud, setNotaAclaratoriaSolicitud] = useState('');
  const [telefonoContactoSolicitud, setTelefonoContactoSolicitud] = useState('');
  const [correoContactoSolicitud, setCorreoContactoSolicitud] = useState('');
  const [firmaDigitalObligatoriaSolicitud, setFirmaDigitalObligatoriaSolicitud] = useState(false);
  const [observacionesSolicitud, setObservacionesSolicitud] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [documentosSolicitados, setDocumentosSolicitados] = useState<string[]>([]);
  const [archivos, setArchivos] = useState<Record<string, string>>({});
  const [autorizado, setAutorizado] = useState(false);

  const faltantes = useMemo(
    () => documentosSolicitados.filter((doc) => !archivos[doc]),
    [documentosSolicitados, archivos],
  );

  useEffect(() => {
    const turnosCompletos = turnosSolicitud.filter((turno) => turno.fecha && turno.numero && turno.eron);
    setCantidadTurnosSolicitud(turnosCompletos.length ? String(turnosCompletos.length) : '');
  }, [turnosSolicitud]);

  function actualizarTurno(index: number, campo: keyof TurnoSolicitud, valor: string) {
    setTurnosSolicitud((prev) => prev.map((turno, i) => (i === index ? { ...turno, [campo]: valor } : turno)));
  }

  function agregarTurno() {
    setTurnosSolicitud((prev) => [...prev, { fecha: '', numero: '', eron: '' }]);
  }

  function eliminarTurno(index: number) {
    setTurnosSolicitud((prev) => {
      if (prev.length === 1) {
        return [{ fecha: '', numero: '', eron: '' }];
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSolicitarRadicado(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMensaje('');

    if (!tipoRadicado) {
      setError('Selecciona un tipo de radicado.');
      return;
    }

    if (!mesRadicadoSolicitud || !ultimaFechaMesSolicitud) {
      setError('Ingresa el mes a radicar y la ultima fecha del mes.');
      return;
    }

    if (!valorNumeroSolicitud.trim() || !valorLetrasSolicitud.trim()) {
      setError('Debes indicar el valor a radicar en numero y en letras.');
      return;
    }

    if (!nombreSolicitud.trim() || !notaAclaratoriaSolicitud.trim() || !observacionesSolicitud.trim()) {
      setError('Debes completar todos los campos obligatorios del formulario.');
      return;
    }

    const turnosConDatos = turnosSolicitud.filter((turno) => turno.fecha || turno.numero || turno.eron);
    if (turnosConDatos.length === 0 || !cantidadTurnosSolicitud.trim()) {
      setError('Debes completar fechas y cantidad de turnos realizados.');
      return;
    }

    const hayTurnoIncompleto = turnosConDatos.some((turno) => !turno.fecha || !turno.numero || !turno.eron);
    if (hayTurnoIncompleto) {
      setError('Completa numero, fecha y ERON en cada turno registrado.');
      return;
    }

    if (!firmaDigitalObligatoriaSolicitud) {
      setError('Debes confirmar que la firma digital es obligatoria.');
      return;
    }

    setSolicitando(true);
    try {
      const response = await createCuentaCobroOpsSolicitud({
        correoSolicitado: correoSolicitud.trim(),
        numeroCcSolicitado: numeroCcSolicitud.trim(),
        nombreSolicitado: nombreSolicitud.trim(),
        documentosSolicitados: [
          'Cuenta de cobro firmada',
          'RUT',
          'Planilla seguridad social',
        ],
        observaciones: observacionesSolicitud.trim(),
        datosPlantilla: {
          tipoRadicado,
          establecimiento: establecimientoSolicitud.trim(),
          mesRadicado: mesRadicadoSolicitud,
          ultimaFechaMes: ultimaFechaMesSolicitud,
          nombreAuxiliar: nombreSolicitud.trim(),
          cedula: numeroCcSolicitud.trim(),
          lugarExpedicionCedula: lugarExpedicionCedulaSolicitud.trim(),
          valorNumero: valorNumeroSolicitud.trim(),
          valorLetras: valorLetrasSolicitud.trim(),
          fechasTurnos: turnosConDatos.map(
            (turno) => `${formatearFechaTurno(turno.fecha)} ${turno.eron} (${turno.numero})`,
          ),
          turnosDetalle: turnosConDatos,
          cantidadTurnos: cantidadTurnosSolicitud.trim(),
          fechaInicioContrato: fechaInicioContratoSolicitud,
          objetoContractual: objetoContractualSolicitud.trim(),
          epsAfiliacion: epsSolicitud.trim(),
          nombreCoordinadora: nombreCoordinadoraSolicitud.trim(),
          notaAclaratoria: notaAclaratoriaSolicitud.trim(),
          telefonoContacto: telefonoContactoSolicitud.trim(),
          correoContacto: correoContactoSolicitud.trim(),
          firmaDigitalObligatoria: firmaDigitalObligatoriaSolicitud,
        },
      });

      setNumeroRadicado(response.numero);
      setNumeroCc(numeroCcSolicitud.trim());
      setMostrarSolicitud(false);
      setMensaje(
        `Radicado generado: ${response.numero}. Se envio un correo con el enlace para cargar documentos.`,
      );
    } catch {
      setError('No se pudo generar el radicado. Verifica los datos e intenta nuevamente.');
    } finally {
      setSolicitando(false);
    }
  }

  async function handleVerificar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMensaje('');

    if (!numeroRadicado.trim()) {
      setError('Ingresa tu número de radicado para continuar.');
      return;
    }

    if (!numeroCc.trim()) {
      setError('Ingresa tu número de CC para continuar.');
      return;
    }

    setVerificando(true);
    try {
      const radicadoNormalizado = numeroRadicado.trim().toUpperCase();
      setNumeroRadicado(radicadoNormalizado);
      const response = await verifyCuentaCobroOps(radicadoNormalizado, numeroCc.trim());
      if (!response.existe || !response.autorizado) {
        setAutorizado(false);
        setError(response.message || 'No fue posible validar la solicitud.');
        return;
      }

      setAutorizado(true);
      setDocumentosSolicitados(response.documentosSolicitados || []);
      setMensaje('Solicitud validada. Ahora adjunta los documentos requeridos.');
    } catch {
      setAutorizado(false);
      setError('No se pudo validar la solicitud con los datos suministrados.');
    } finally {
      setVerificando(false);
    }
  }

  async function handleEnviarDocumentos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMensaje('');

    if (!autorizado) {
      setError('Primero valida tu solicitud con número de CC.');
      return;
    }

    if (faltantes.length > 0) {
      setError('Debes adjuntar todos los documentos solicitados antes de enviar.');
      return;
    }

    setSubiendo(true);
    const documentos = documentosSolicitados.map((nombre) => ({
      nombre,
      archivo: archivos[nombre],
    }));

    try {
      const response = await submitCuentaCobroOpsDocumentos({
        numeroRadicado,
        numeroCc: numeroCc.trim(),
        documentos,
      });
      setMensaje(response.message);
    } catch {
      setError('No se pudieron cargar los documentos. Intenta nuevamente.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="login-shell ops-shell">
      <section className="login-panel ops-panel">
        <div className="login-brand">
          <div>
            <h1 className="login-title">Radicación cuenta de cobro OPS</h1>
            <p className="login-subtitle">Carga de soportes por radicado y validación por número de CC.</p>
          </div>
        </div>

        <div className="login-card ops-card">
          <div className="login-card-header">
            <h2>Validación de solicitud</h2>
            <p>Radicado: {numeroRadicado || 'No disponible'}</p>
          </div>

          {mensaje ? <div className="login-success">{mensaje}</div> : null}
          {error ? <div className="login-error">{error}</div> : null}

          <button
            type="button"
            className="login-button login-button-secondary"
            onClick={() => setMostrarSolicitud((prev) => !prev)}
          >
            {mostrarSolicitud ? 'Cerrar solicitud' : 'Solicitar radicado'}
          </button>

          {mostrarSolicitud ? (
            <form className="login-form ops-request-form" onSubmit={handleSolicitarRadicado}>
              <div className="ops-form-grid">
              <p className="ops-section-label ops-span-2">Datos personales y de radicación</p>
              <div className="form-group">
                <label htmlFor="tipo-radicado">Tipo de radicado</label>
                <select
                  id="tipo-radicado"
                  value={tipoRadicado}
                  onChange={(event) => setTipoRadicado(event.target.value)}
                  required
                >
                  <option value="radicacion-cuenta-cobro">Radicación de cuenta de cobro</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-correo">Correo electrónico</label>
                <input
                  id="solicitud-correo"
                  type="email"
                  value={correoSolicitud}
                  onChange={(event) => setCorreoSolicitud(event.target.value)}
                  placeholder="contratista@empresa.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-cc">Número de CC</label>
                <input
                  id="solicitud-cc"
                  type="text"
                  value={numeroCcSolicitud}
                  onChange={(event) => setNumeroCcSolicitud(event.target.value)}
                  placeholder="Ingresa el número de cédula"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-nombre">Nombre completo</label>
                <input
                  id="solicitud-nombre"
                  type="text"
                  value={nombreSolicitud}
                  onChange={(event) => setNombreSolicitud(event.target.value)}
                  placeholder="Nombre del contratista"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-establecimiento">Establecimiento</label>
                <input
                  id="solicitud-establecimiento"
                  type="text"
                  value={establecimientoSolicitud}
                  onChange={(event) => setEstablecimientoSolicitud(event.target.value)}
                  placeholder="IPS o establecimiento"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-mes-radicar">Mes y año a radicar</label>
                <input
                  id="solicitud-mes-radicar"
                  type="month"
                  value={mesRadicadoSolicitud}
                  onChange={(event) => setMesRadicadoSolicitud(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-ultima-fecha">Ultima fecha del mes</label>
                <input
                  id="solicitud-ultima-fecha"
                  type="date"
                  value={ultimaFechaMesSolicitud}
                  onChange={(event) => setUltimaFechaMesSolicitud(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-lugar-expedicion">Lugar de expedición de cédula</label>
                <input
                  id="solicitud-lugar-expedicion"
                  type="text"
                  value={lugarExpedicionCedulaSolicitud}
                  onChange={(event) => setLugarExpedicionCedulaSolicitud(event.target.value)}
                  placeholder="Municipio o ciudad"
                  required
                />
              </div>

              <p className="ops-section-label ops-span-2">Contrato y valores</p>
              <div className="form-group">
                <label htmlFor="solicitud-valor-numero">Valor a radicar (pesos)</label>
                <input
                  id="solicitud-valor-numero"
                  type="text"
                  value={valorNumeroSolicitud}
                  onChange={(event) => {
                    const valor = event.target.value.replace(/\D/g, '');
                    setValorNumeroSolicitud(valor);
                    setValorLetrasSolicitud(numeroAPesosEnLetras(valor));
                  }}
                  placeholder="Ejemplo: 500000"
                  inputMode="numeric"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-valor-letras">Valor a radicar (letras)</label>
                <input
                  id="solicitud-valor-letras"
                  type="text"
                  value={valorLetrasSolicitud}
                  onChange={(event) => setValorLetrasSolicitud(event.target.value)}
                  placeholder="Ejemplo: quinientos mil pesos"
                  readOnly
                  required
                />
              </div>

              <div className="form-group ops-span-2">
                <label htmlFor="solicitud-objeto">Objeto contractual</label>
                <input
                  id="solicitud-objeto"
                  type="text"
                  value={objetoContractualSolicitud}
                  onChange={(event) => setObjetoContractualSolicitud(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-fecha-inicio">Fecha de inicio de contrato</label>
                <input
                  id="solicitud-fecha-inicio"
                  type="date"
                  value={fechaInicioContratoSolicitud}
                  onChange={(event) => setFechaInicioContratoSolicitud(event.target.value)}
                  required
                />
              </div>

              <p className="ops-section-label ops-span-2">Turnos, soporte y confirmaciones</p>
              <div className="form-group ops-span-2">
                <label>Turnos realizados</label>
                <div className="turnos-list">
                {turnosSolicitud.map((turno, index) => (
                  <div key={`turno-${index}`} className="turno-row">
                    <input
                      type="number"
                      min={1}
                      value={turno.numero}
                      onChange={(event) => actualizarTurno(index, 'numero', event.target.value)}
                      placeholder="Numero"
                      required
                    />
                    <input
                      type="date"
                      value={turno.fecha}
                      onChange={(event) => actualizarTurno(index, 'fecha', event.target.value)}
                      required
                    />
                    <select
                      value={turno.eron}
                      onChange={(event) => actualizarTurno(index, 'eron', event.target.value)}
                      required
                    >
                      <option value="">Selecciona ERON</option>
                      {ERON_OPCIONES.map((eron) => (
                        <option key={eron} value={eron}>
                          {eron}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="login-button login-button-secondary turno-remove"
                      onClick={() => eliminarTurno(index)}
                    >
                      Eliminar turno
                    </button>
                  </div>
                ))}
                </div>

                <button type="button" className="login-button login-button-secondary turno-add" onClick={agregarTurno}>
                  Agregar turno
                </button>
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-cantidad-turnos">Cantidad total de turnos realizados</label>
                <input
                  id="solicitud-cantidad-turnos"
                  type="text"
                  value={cantidadTurnosSolicitud}
                  onChange={() => undefined}
                  placeholder="Se calcula automaticamente"
                  readOnly
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-eps">EPS o afiliación</label>
                <input
                  id="solicitud-eps"
                  type="text"
                  value={epsSolicitud}
                  onChange={(event) => setEpsSolicitud(event.target.value)}
                  placeholder="EPS del auxiliar"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-coordinadora">Nombre de la coordinadora autorizada</label>
                <input
                  id="solicitud-coordinadora"
                  type="text"
                  value={nombreCoordinadoraSolicitud}
                  onChange={(event) => setNombreCoordinadoraSolicitud(event.target.value)}
                  required
                />
              </div>

              <div className="form-group ops-span-2">
                <label htmlFor="solicitud-nota">Nota aclaratoria</label>
                <textarea
                  id="solicitud-nota"
                  value={notaAclaratoriaSolicitud}
                  onChange={(event) => setNotaAclaratoriaSolicitud(event.target.value)}
                  placeholder="Nota aclaratoria del periodo o certificación"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-telefono">Teléfono de contacto</label>
                <input
                  id="solicitud-telefono"
                  type="text"
                  value={telefonoContactoSolicitud}
                  onChange={(event) => setTelefonoContactoSolicitud(event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="solicitud-correo-contacto">Correo electrónico de contacto</label>
                <input
                  id="solicitud-correo-contacto"
                  type="email"
                  value={correoContactoSolicitud}
                  onChange={(event) => setCorreoContactoSolicitud(event.target.value)}
                  required
                />
              </div>

              <label className="ops-checkbox">
                <input
                  type="checkbox"
                  checked={firmaDigitalObligatoriaSolicitud}
                  onChange={(event) => setFirmaDigitalObligatoriaSolicitud(event.target.checked)}
                  required
                />{' '}
                Confirmo que la firma digital es obligatoria
              </label>

              <div className="form-group ops-span-2">
                <label htmlFor="solicitud-obs">Observaciones</label>
                <input
                  id="solicitud-obs"
                  type="text"
                  value={observacionesSolicitud}
                  onChange={(event) => setObservacionesSolicitud(event.target.value)}
                  placeholder="Detalle adicional"
                  required
                />
              </div>
              </div>

              <button type="submit" className="login-button" disabled={solicitando}>
                {solicitando ? 'Generando radicado...' : 'Generar radicado'}
              </button>
            </form>
          ) : null}

          <form className="login-form" onSubmit={handleVerificar}>
            <div className="form-group">
              <label htmlFor="ops-radicado">Número de radicado</label>
              <input
                id="ops-radicado"
                type="text"
                value={numeroRadicado}
                onChange={(event) => setNumeroRadicado(event.target.value)}
                placeholder="Ejemplo: RAD-20260417-000001-1234"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="ops-cc">Número de CC</label>
              <input
                id="ops-cc"
                type="text"
                value={numeroCc}
                onChange={(event) => setNumeroCc(event.target.value)}
                placeholder="Ingresa tu número de CC"
                required
              />
            </div>
            <button type="submit" className="login-button" disabled={verificando}>
              {verificando ? 'Validando...' : 'Validar solicitud'}
            </button>
          </form>

          {autorizado ? (
            <form className="login-form" onSubmit={handleEnviarDocumentos}>
              <h3>Documentos solicitados</h3>
              {documentosSolicitados.map((documento) => (
                <div className="form-group" key={documento}>
                  <label htmlFor={`doc-${documento}`}>{documento}</label>
                  <input
                    id={`doc-${documento}`}
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }
                      setArchivos((prev) => ({
                        ...prev,
                        [documento]: file.name,
                      }));
                    }}
                    required
                  />
                </div>
              ))}

              <button type="submit" className="login-button" disabled={subiendo}>
                {subiendo ? 'Enviando...' : 'Enviar documentos'}
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <aside className="login-side">
        <div className="login-side-card">
          <span className="badge">Cuenta de cobro OPS</span>
          <h3>Flujo de carga documental</h3>
          <p>
            Valida tu solicitud con número de cédula, adjunta los soportes y finaliza el envío para revisión del solicitante.
          </p>
        </div>
      </aside>
    </div>
  );
}
