import { useEffect, useState } from 'react';
import { pagosService } from './pagos.service';
import { LoteEditorPanel } from './LoteEditorPanel';
import {
	PagosEmpresa,
	PagosLoteResumen,
	formatoCop,
	pagosEstadoBadgeClass,
	pagosEstadoLabel,
} from './pagos.types';

interface PagosModuleProps {
	tienePermiso: (permiso: string) => boolean;
}

export function PagosModule({ tienePermiso }: PagosModuleProps) {
	const [lotes, setLotes] = useState<PagosLoteResumen[]>([]);
	const [empresas, setEmpresas] = useState<PagosEmpresa[]>([]);
	const [cargando, setCargando] = useState(true);
	const [error, setError] = useState('');
	const [loteAbierto, setLoteAbierto] = useState<number | null>(null);
	const [mostrarForm, setMostrarForm] = useState(false);
	const [creando, setCreando] = useState(false);

	const [empresaId, setEmpresaId] = useState<number | ''>('');
	const [descripcion, setDescripcion] = useState('');
	const [fechaProceso, setFechaProceso] = useState(() => new Date().toISOString().slice(0, 10));

	const puedeCrear = tienePermiso('crearLotes');

	function cargarLotes() {
		setCargando(true);
		setError('');
		pagosService
			.listarLotes()
			.then(setLotes)
			.catch((ex) => setError(pagosService.extraerMensaje(ex, 'No se pudieron cargar los lotes.')))
			.finally(() => setCargando(false));
	}

	useEffect(() => {
		cargarLotes();
		if (puedeCrear) {
			pagosService.listarEmpresas().then(setEmpresas).catch(() => undefined);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function crearLote() {
		if (!empresaId) { setError('Seleccione la empresa ordenante.'); return; }
		if (!fechaProceso) { setError('Indique la fecha de proceso.'); return; }
		setCreando(true);
		setError('');
		try {
			const { id } = await pagosService.crearLote({ empresaId: Number(empresaId), descripcion, fechaProceso });
			setMostrarForm(false);
			setDescripcion('');
			cargarLotes();
			setLoteAbierto(id);
		} catch (ex) {
			setError(pagosService.extraerMensaje(ex, 'No se pudo crear el lote.'));
		} finally {
			setCreando(false);
		}
	}

	if (loteAbierto !== null) {
		return (
			<LoteEditorPanel
				loteId={loteAbierto}
				tienePermiso={tienePermiso}
				onVolver={() => { setLoteAbierto(null); cargarLotes(); }}
			/>
		);
	}

	return (
		<div className="card-surface module-card pagos-module">
			<div className="pagos-module-header">
				<div>
					<h2>Portal de Pagos</h2>
					<p className="pagos-module-subtitle">Traslado de fondos — genere el archivo plano para el portal bancario.</p>
				</div>
				<div className="pagos-module-actions">
					<button type="button" className="admin-ghost-button" onClick={() => pagosService.descargarPlantilla()}>
						⬇ Plantilla CSV
					</button>
					{puedeCrear ? (
						<button type="button" className="admin-primary-button" onClick={() => setMostrarForm((v) => !v)}>
							+ Nuevo lote
						</button>
					) : null}
				</div>
			</div>

			{error ? <div className="admin-error">{error}</div> : null}

			{mostrarForm ? (
				<div className="pagos-nuevo-form">
					<div className="leg-field">
						<label>Empresa ordenante *</label>
						<select value={empresaId} onChange={(e) => setEmpresaId(e.target.value ? Number(e.target.value) : '')}>
							<option value="">— Seleccione —</option>
							{empresas.filter((e) => e.activa).map((e) => (
								<option key={e.id} value={e.id}>{e.nombre} — {e.cuentaOrigen}</option>
							))}
						</select>
					</div>
					<div className="leg-field">
						<label>Descripción</label>
						<input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Nómina quincena 1 — agosto" />
					</div>
					<div className="leg-field">
						<label>Fecha de proceso *</label>
						<input type="date" value={fechaProceso} onChange={(e) => setFechaProceso(e.target.value)} />
					</div>
					<div className="pagos-nuevo-form-actions">
						<button type="button" className="admin-primary-button" onClick={crearLote} disabled={creando}>
							{creando ? 'Creando…' : 'Crear lote'}
						</button>
						<button type="button" className="admin-ghost-button" onClick={() => setMostrarForm(false)}>Cancelar</button>
					</div>
				</div>
			) : null}

			{cargando ? (
				<div className="admin-loading">Cargando lotes…</div>
			) : lotes.length === 0 ? (
				<p className="leg-config-hint">Todavía no hay lotes. {puedeCrear ? 'Cree el primero con "Nuevo lote".' : ''}</p>
			) : (
				<div style={{ overflowX: 'auto' }}>
					<table className="pagos-tabla">
						<thead>
							<tr>
								<th>Referencia</th>
								<th>Empresa</th>
								<th>Autor</th>
								<th>Fecha proceso</th>
								<th>Estado</th>
								<th>Pagos</th>
								<th>Valor total</th>
							</tr>
						</thead>
						<tbody>
							{lotes.map((l) => (
								<tr key={l.id} className="pagos-tabla-row" onClick={() => setLoteAbierto(l.id)}>
									<td>{l.referencia}</td>
									<td>{l.empresaNombre}</td>
									<td>{l.autor}</td>
									<td>{l.fechaProceso}</td>
									<td><span className={`rad-badge ${pagosEstadoBadgeClass(l.estado)}`}>{pagosEstadoLabel(l.estado)}</span></td>
									<td>{l.cantidadPagos}</td>
									<td>{formatoCop(l.valorTotal)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
