import { useEffect, useMemo, useState } from 'react';
import { pagosService } from './pagos.service';
import {
	PagosHallazgo,
	PagosLoteDetalle,
	PagosPago,
	TIPOS_IDENTIFICACION,
	TIPOS_PRODUCTO,
	formatoCop,
	pagosEstadoBadgeClass,
	pagosEstadoLabel,
} from './pagos.types';

interface LoteEditorPanelProps {
	loteId: number;
	tienePermiso: (permiso: string) => boolean;
	onVolver: () => void;
}

function filaVacia(): PagosPago {
	return {
		orden: 0,
		filaOrigen: null,
		identificacion: '',
		tipoIdentificacion: '01',
		productoDestino: '',
		tipoProducto: 'CA',
		codigoBanco: '',
		valor: '',
		beneficiario: '',
		bancoManual: false,
	};
}

export function LoteEditorPanel({ loteId, tienePermiso, onVolver }: LoteEditorPanelProps) {
	const [lote, setLote] = useState<PagosLoteDetalle | null>(null);
	const [pagos, setPagos] = useState<PagosPago[]>([]);
	const [cargando, setCargando] = useState(true);
	const [guardando, setGuardando] = useState(false);
	const [error, setError] = useState('');
	const [mensaje, setMensaje] = useState('');
	const [errores, setErrores] = useState<PagosHallazgo[]>([]);
	const [avisos, setAvisos] = useState<PagosHallazgo[]>([]);
	const [porCelda, setPorCelda] = useState<Record<string, Array<{ severidad: string; mensaje: string }>>>({});
	const [clave, setClave] = useState<string | null>(null);
	const [mostrarCorreo, setMostrarCorreo] = useState(false);
	const [correoPara, setCorreoPara] = useState('');
	const [correoCc, setCorreoCc] = useState('');
	const [procesando, setProcesando] = useState('');

	const puedeGenerar = tienePermiso('generarArchivo');
	const puedeAnular = tienePermiso('anularLotes');

	function cargar() {
		setCargando(true);
		setError('');
		pagosService
			.obtenerLote(loteId)
			.then((d) => { setLote(d); setPagos(d.pagos); })
			.catch((ex) => setError(pagosService.extraerMensaje(ex, 'No se pudo cargar el lote.')))
			.finally(() => setCargando(false));
	}

	useEffect(() => { cargar(); }, [loteId]); // eslint-disable-line react-hooks/exhaustive-deps

	const hallazgosCelda = (orden: number, campo: string) => porCelda[`${orden}:${campo}`] ?? [];

	function actualizarFila(idx: number, campo: keyof PagosPago, valor: string | boolean) {
		setPagos((prev) => prev.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
	}

	function agregarFila() {
		setPagos((prev) => [...prev, filaVacia()]);
	}

	function quitarFila(idx: number) {
		setPagos((prev) => prev.filter((_, i) => i !== idx));
	}

	async function guardarCambios() {
		setGuardando(true);
		setError('');
		setMensaje('');
		try {
			await pagosService.guardarPagos(loteId, pagos);
			setMensaje('Pagos guardados.');
			cargar();
		} catch (ex) {
			setError(pagosService.extraerMensaje(ex, 'No se pudieron guardar los pagos.'));
		} finally {
			setGuardando(false);
		}
	}

	async function importar(archivo: File) {
		setProcesando('importar');
		setError('');
		setMensaje('');
		try {
			const r = await pagosService.importarArchivo(loteId, archivo);
			setPagos((prev) => [...prev, ...r.pagos]);
			setErrores(r.hallazgos.filter((h) => h.severidad === 'error'));
			setAvisos(r.hallazgos.filter((h) => h.severidad === 'aviso'));
			setMensaje(`Se leyeron ${r.filasLeidas} filas (${r.celdasLimpiadas} celdas corregidas automáticamente). Revise abajo y guarde para confirmar.`);
		} catch (ex) {
			setError(pagosService.extraerMensaje(ex, 'No se pudo interpretar el archivo.'));
		} finally {
			setProcesando('');
		}
	}

	async function validar() {
		setProcesando('validar');
		setError('');
		setMensaje('');
		try {
			const r = await pagosService.validarLote(loteId);
			setErrores(r.errores);
			setAvisos(r.avisos);
			setPorCelda(r.porCelda);
			setMensaje(r.valido ? 'El lote es válido. Ya puede generar el archivo.' : `El lote tiene ${r.errores.length} error(es).`);
			cargar();
		} catch (ex) {
			setError(pagosService.extraerMensaje(ex, 'No se pudo validar el lote.'));
		} finally {
			setProcesando('');
		}
	}

	async function generar() {
		setProcesando('generar');
		setError('');
		setMensaje('');
		try {
			const r = await pagosService.generarArchivo(loteId);
			setMensaje(r.mensaje);
			cargar();
		} catch (ex) {
			setError(pagosService.extraerMensaje(ex, 'No se pudo generar el archivo.'));
		} finally {
			setProcesando('');
		}
	}

	async function empaquetar() {
		setProcesando('empaquetar');
		setError('');
		setMensaje('');
		try {
			const r = await pagosService.empaquetarZip(loteId);
			setClave(r.clave);
			setMensaje('ZIP cifrado generado. Copie la clave ahora: solo se muestra una vez en claro.');
			cargar();
		} catch (ex) {
			setError(pagosService.extraerMensaje(ex, 'No se pudo empaquetar el ZIP.'));
		} finally {
			setProcesando('');
		}
	}

	async function verClave() {
		setProcesando('clave');
		setError('');
		try {
			const r = await pagosService.consultarClave(loteId);
			setClave(r.clave);
		} catch (ex) {
			setError(pagosService.extraerMensaje(ex, 'No se pudo consultar la clave.'));
		} finally {
			setProcesando('');
		}
	}

	async function anular() {
		const motivo = window.prompt('Motivo de la anulación (obligatorio):');
		if (motivo === null) return;
		setProcesando('anular');
		setError('');
		try {
			const r = await pagosService.anularLote(loteId, motivo);
			setMensaje(r.mensaje);
			cargar();
		} catch (ex) {
			setError(pagosService.extraerMensaje(ex, 'No se pudo anular el lote.'));
		} finally {
			setProcesando('');
		}
	}

	async function reabrir() {
		const motivo = window.prompt('Motivo de la reapertura (obligatorio):');
		if (motivo === null) return;
		setProcesando('reabrir');
		setError('');
		try {
			const r = await pagosService.reabrirLote(loteId, motivo);
			setMensaje(r.mensaje);
			setClave(null);
			cargar();
		} catch (ex) {
			setError(pagosService.extraerMensaje(ex, 'No se pudo reabrir el lote.'));
		} finally {
			setProcesando('');
		}
	}

	async function enviarCorreo() {
		if (!lote) return;
		setProcesando('correo');
		setError('');
		try {
			await pagosService.generarCorreo(loteId, { para: correoPara, cc: correoCc, asunto: '', cuerpo: '' }, lote.referencia);
			setMostrarCorreo(false);
			setMensaje('Correo .eml descargado. Ábralo en Outlook de escritorio y pulse Reenviar.');
		} catch (ex) {
			setError(pagosService.extraerMensaje(ex, 'No se pudo generar el correo.'));
		} finally {
			setProcesando('');
		}
	}

	const totalCalculado = useMemo(
		() => pagos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0),
		[pagos],
	);

	if (cargando) return <div className="admin-loading">Cargando lote…</div>;
	if (!lote) return <div className="admin-error">{error || 'Lote no encontrado.'}</div>;

	const editable = lote.puedeEditar;

	return (
		<div className="card-surface module-card pagos-module">
			<button type="button" className="admin-ghost-button" onClick={onVolver}>← Volver a lotes</button>

			<div className="pagos-lote-header">
				<div>
					<h2>Lote {lote.referencia}</h2>
					<p className="pagos-module-subtitle">{lote.empresaNombre} · {lote.fechaProceso} · creado por {lote.autor}</p>
				</div>
				<span className={`rad-badge ${pagosEstadoBadgeClass(lote.estado)}`}>{pagosEstadoLabel(lote.estado)}</span>
			</div>

			<div className="pagos-lote-resumen">
				<div><span>Pagos</span><strong>{pagos.length}</strong></div>
				<div><span>Valor total</span><strong>{formatoCop(String(totalCalculado))}</strong></div>
				{lote.vecesReabierto > 0 ? <div><span>Reaberto</span><strong>{lote.vecesReabierto}×</strong></div> : null}
			</div>

			{error ? <div className="admin-error">{error}</div> : null}
			{mensaje ? <div className="admin-success">{mensaje}</div> : null}

			{clave ? (
				<div className="admin-success pagos-clave-banner">
					Clave del ZIP: <code>{clave}</code> — cópiela ahora, no volverá a mostrarse completa.
				</div>
			) : null}

			{errores.length > 0 ? (
				<div className="admin-error">
					<strong>{errores.length} error(es):</strong>
					<ul>{errores.slice(0, 20).map((h, i) => <li key={i}>{h.fila ? `Fila ${h.fila}: ` : ''}{h.mensaje}</li>)}</ul>
				</div>
			) : null}
			{avisos.length > 0 ? (
				<div className="pagos-avisos">
					<strong>{avisos.length} aviso(s):</strong>
					<ul>{avisos.slice(0, 20).map((h, i) => <li key={i}>{h.fila ? `Fila ${h.fila}: ` : ''}{h.mensaje}</li>)}</ul>
				</div>
			) : null}

			{editable ? (
				<div className="pagos-lote-toolbar">
					<button type="button" className="admin-ghost-button" onClick={agregarFila}>+ Agregar pago manual</button>
					<label className="admin-ghost-button pagos-file-label">
						{procesando === 'importar' ? 'Leyendo…' : '⬆ Cargar Excel/CSV'}
						<input
							type="file"
							accept=".xlsx,.xlsm,.csv,.txt"
							style={{ display: 'none' }}
							disabled={procesando === 'importar'}
							onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }}
						/>
					</label>
					<button type="button" className="admin-primary-button" onClick={guardarCambios} disabled={guardando}>
						{guardando ? 'Guardando…' : 'Guardar pagos'}
					</button>
					<button type="button" className="admin-ghost-button" onClick={validar} disabled={procesando === 'validar'}>
						{procesando === 'validar' ? 'Validando…' : 'Validar lote'}
					</button>
				</div>
			) : null}

			<div style={{ overflowX: 'auto' }}>
				<table className="pagos-tabla pagos-tabla-pagos">
					<thead>
						<tr>
							<th>#</th>
							<th>Identificación</th>
							<th>Tipo ID</th>
							<th>Producto destino</th>
							<th>Tipo</th>
							<th>Banco</th>
							<th>Valor</th>
							<th>Beneficiario</th>
							{editable ? <th></th> : null}
						</tr>
					</thead>
					<tbody>
						{pagos.map((p, i) => {
							const orden = i + 1;
							const errId = hallazgosCelda(orden, 'identificacion');
							const errProd = hallazgosCelda(orden, 'producto_destino');
							const errBanco = hallazgosCelda(orden, 'codigo_banco');
							const errValor = hallazgosCelda(orden, 'valor');
							const errBenef = hallazgosCelda(orden, 'beneficiario');
							const claseCelda = (h: typeof errId) =>
								h.some((x) => x.severidad === 'error') ? 'pagos-celda-error' : h.length ? 'pagos-celda-aviso' : '';
							return (
								<tr key={i}>
									<td>{orden}</td>
									<td className={claseCelda(errId)}>
										{editable ? (
											<input value={p.identificacion} onChange={(e) => actualizarFila(i, 'identificacion', e.target.value)} style={{ width: 110 }} />
										) : p.identificacion}
									</td>
									<td>
										{editable ? (
											<select value={p.tipoIdentificacion} onChange={(e) => actualizarFila(i, 'tipoIdentificacion', e.target.value)}>
												{TIPOS_IDENTIFICACION.map((t) => <option key={t.value} value={t.value}>{t.value}</option>)}
											</select>
										) : p.tipoIdentificacion}
									</td>
									<td className={claseCelda(errProd)}>
										{editable ? (
											<input value={p.productoDestino} onChange={(e) => actualizarFila(i, 'productoDestino', e.target.value)} style={{ width: 140 }} />
										) : p.productoDestino}
									</td>
									<td>
										{editable ? (
											<select value={p.tipoProducto} onChange={(e) => actualizarFila(i, 'tipoProducto', e.target.value)}>
												{TIPOS_PRODUCTO.map((t) => <option key={t.value} value={t.value}>{t.value}</option>)}
											</select>
										) : p.tipoProducto}
									</td>
									<td className={claseCelda(errBanco)}>
										{editable ? (
											<input value={p.codigoBanco} onChange={(e) => actualizarFila(i, 'codigoBanco', e.target.value)} style={{ width: 70 }} />
										) : p.codigoBanco}
									</td>
									<td className={claseCelda(errValor)}>
										{editable ? (
											<input value={p.valor} onChange={(e) => actualizarFila(i, 'valor', e.target.value)} style={{ width: 100 }} />
										) : formatoCop(p.valor)}
									</td>
									<td className={claseCelda(errBenef)}>
										{editable ? (
											<input value={p.beneficiario} onChange={(e) => actualizarFila(i, 'beneficiario', e.target.value)} style={{ width: 160 }} />
										) : p.beneficiario}
									</td>
									{editable ? (
										<td><button type="button" className="tipos-eliminar-btn" onClick={() => quitarFila(i)}>✕</button></td>
									) : null}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<div className="pagos-lote-toolbar pagos-lote-toolbar-final">
				{lote.estado !== 'generado' && lote.estado !== 'anulado' && puedeGenerar ? (
					<button type="button" className="admin-primary-button" onClick={generar} disabled={procesando === 'generar'}>
						{procesando === 'generar' ? 'Generando…' : 'Generar archivo'}
					</button>
				) : null}

				{lote.estado === 'generado' && !lote.archivoZipNombre && puedeGenerar ? (
					<button type="button" className="admin-primary-button" onClick={empaquetar} disabled={procesando === 'empaquetar'}>
						{procesando === 'empaquetar' ? 'Empaquetando…' : 'Empaquetar ZIP cifrado'}
					</button>
				) : null}

				{lote.archivoZipNombre && puedeGenerar ? (
					<button type="button" className="admin-ghost-button" onClick={verClave} disabled={procesando === 'clave'}>Ver clave del ZIP</button>
				) : null}

				{lote.estado === 'generado' ? (
					<>
						<button type="button" className="admin-ghost-button" onClick={() => pagosService.descargarArchivo(loteId, 'txt', 'ArchivoPagos.txt')}>⬇ .txt</button>
						<button type="button" className="admin-ghost-button" onClick={() => pagosService.descargarArchivo(loteId, 'csv', 'ArchivoPagos.csv')}>⬇ .csv</button>
						{lote.archivoZipNombre ? (
							<>
								<button type="button" className="admin-ghost-button" onClick={() => pagosService.descargarArchivo(loteId, 'zip', 'ArchivoPagos.zip')}>⬇ .zip</button>
								{puedeGenerar ? (
									<button type="button" className="admin-ghost-button" onClick={() => setMostrarCorreo((v) => !v)}>✉ Generar correo</button>
								) : null}
							</>
						) : null}
					</>
				) : null}

				{lote.puedeReabrir ? (
					<button type="button" className="admin-ghost-button" onClick={reabrir} disabled={procesando === 'reabrir'}>Reabrir lote</button>
				) : null}
				{lote.estado !== 'anulado' && puedeAnular ? (
					<button type="button" className="tipos-eliminar-btn" onClick={anular} disabled={procesando === 'anular'}>Anular lote</button>
				) : null}
			</div>

			{mostrarCorreo ? (
				<div className="pagos-correo-form">
					<div className="leg-field">
						<label>Destinatario (correo del portal bancario) *</label>
						<input type="email" value={correoPara} onChange={(e) => setCorreoPara(e.target.value)} placeholder="analista@banco.com" />
					</div>
					<div className="leg-field">
						<label>Con copia (opcional)</label>
						<input type="text" value={correoCc} onChange={(e) => setCorreoCc(e.target.value)} placeholder="separado por comas" />
					</div>
					<div className="pagos-nuevo-form-actions">
						<button type="button" className="admin-primary-button" onClick={enviarCorreo} disabled={procesando === 'correo'}>
							{procesando === 'correo' ? 'Generando…' : 'Descargar .eml'}
						</button>
						<button type="button" className="admin-ghost-button" onClick={() => setMostrarCorreo(false)}>Cancelar</button>
					</div>
				</div>
			) : null}
		</div>
	);
}
