import { useEffect, useState } from 'react';
import { pagosService } from '../pagos/pagos.service';
import { PagosBanco, PagosEmpresa, TIPOS_IDENTIFICACION } from '../pagos/pagos.types';

function nuevaEmpresa(): Partial<PagosEmpresa> {
	return { nombre: '', identificacion: '', tipoIdentificacion: '03', cuentaOrigen: '', tipoCuenta: 'CA' };
}

export function ConfigPagosPanel() {
	const [tab, setTab] = useState<'empresas' | 'bancos'>('empresas');
	const [empresas, setEmpresas] = useState<PagosEmpresa[]>([]);
	const [bancos, setBancos] = useState<PagosBanco[]>([]);
	const [cargando, setCargando] = useState(true);
	const [err, setErr] = useState('');
	const [ok, setOk] = useState('');

	const [formEmpresa, setFormEmpresa] = useState<Partial<PagosEmpresa> | null>(null);
	const [nuevoCodigoBanco, setNuevoCodigoBanco] = useState('');
	const [nuevoNombreBanco, setNuevoNombreBanco] = useState('');

	function cargar() {
		setCargando(true);
		Promise.all([pagosService.listarEmpresas(), pagosService.listarBancos(true)])
			.then(([e, b]) => { setEmpresas(e); setBancos(b); })
			.catch(() => setErr('No se pudo cargar la configuración del Portal de Pagos.'))
			.finally(() => setCargando(false));
	}

	useEffect(() => { cargar(); }, []);

	async function guardarEmpresa() {
		if (!formEmpresa) return;
		setErr(''); setOk('');
		try {
			if (formEmpresa.id) {
				await pagosService.actualizarEmpresa(formEmpresa.id, formEmpresa);
			} else {
				await pagosService.crearEmpresa(formEmpresa);
			}
			setFormEmpresa(null);
			setOk('Empresa guardada.');
			cargar();
		} catch (ex) {
			setErr(pagosService.extraerMensaje(ex, 'No se pudo guardar la empresa.'));
		}
	}

	async function alternarActivaEmpresa(e: PagosEmpresa) {
		setErr(''); setOk('');
		try {
			await pagosService.actualizarEmpresa(e.id, { activa: !e.activa });
			cargar();
		} catch (ex) {
			setErr(pagosService.extraerMensaje(ex, 'No se pudo actualizar la empresa.'));
		}
	}

	async function registrarBanco() {
		setErr(''); setOk('');
		try {
			await pagosService.crearBancoManual(nuevoCodigoBanco, nuevoNombreBanco);
			setNuevoCodigoBanco(''); setNuevoNombreBanco('');
			setOk('Entidad registrada.');
			cargar();
		} catch (ex) {
			setErr(pagosService.extraerMensaje(ex, 'No se pudo registrar la entidad.'));
		}
	}

	async function alternarActivoBanco(b: PagosBanco) {
		setErr(''); setOk('');
		try {
			await pagosService.cambiarEstadoBanco(b.codigo, !b.activo);
			cargar();
		} catch (ex) {
			setErr(pagosService.extraerMensaje(ex, 'No se pudo actualizar la entidad.'));
		}
	}

	async function eliminarBanco(b: PagosBanco) {
		if (!window.confirm(`¿Eliminar la entidad ${b.codigo} — ${b.nombre}?`)) return;
		setErr(''); setOk('');
		try {
			await pagosService.eliminarBancoManual(b.codigo);
			setOk('Entidad eliminada.');
			cargar();
		} catch (ex) {
			setErr(pagosService.extraerMensaje(ex, 'No se pudo eliminar la entidad.'));
		}
	}

	if (cargando) return <div className="admin-loading">Cargando configuración…</div>;

	return (
		<div className="admin-module-content leg-config">
			<h2>Configuración — Portal de Pagos</h2>
			<p className="leg-config-desc">
				Administre las empresas ordenantes (cuentas de origen) y las entidades bancarias del catálogo.
				El acceso al módulo se habilita por rol/usuario en <strong>Roles</strong>, permisos del módulo «Portal de Pagos».
			</p>

			{err ? <div className="admin-error">{err}</div> : null}
			{ok ? <div className="admin-success">{ok}</div> : null}

			<div className="admin-module-nav" role="tablist" style={{ marginBottom: 16 }}>
				<button type="button" className={`admin-module-item${tab === 'empresas' ? ' active' : ''}`} onClick={() => setTab('empresas')}>
					Empresas ordenantes
				</button>
				<button type="button" className={`admin-module-item${tab === 'bancos' ? ' active' : ''}`} onClick={() => setTab('bancos')}>
					Entidades bancarias
				</button>
			</div>

			{tab === 'empresas' ? (
				<section className="leg-config-section">
					<div style={{ overflowX: 'auto', marginBottom: 16 }}>
						<table className="pagos-tabla">
							<thead>
								<tr>
									<th>Nombre</th>
									<th>Identificación</th>
									<th>Cuenta origen</th>
									<th>Tipo cuenta</th>
									<th>Estado</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{empresas.map((e) => (
									<tr key={e.id}>
										<td>{e.nombre}</td>
										<td>{e.tipoIdentificacion} — {e.identificacion}</td>
										<td>{e.cuentaOrigen}</td>
										<td>{e.tipoCuenta}</td>
										<td>{e.activa ? 'Activa' : 'Inactiva'}</td>
										<td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 4 }}>
											<button type="button" className="admin-ghost-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setFormEmpresa(e)}>Editar</button>
											<button type="button" className="admin-ghost-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => alternarActivaEmpresa(e)}>
												{e.activa ? 'Desactivar' : 'Activar'}
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{formEmpresa ? (
						<div className="ruta-especifica-form">
							<h4 className="tarifa-subtitulo">{formEmpresa.id ? 'Editar empresa' : 'Nueva empresa ordenante'}</h4>
							<div className="tipos-editor-fields">
								<div className="leg-field">
									<label>Nombre *</label>
									<input value={formEmpresa.nombre ?? ''} onChange={(e) => setFormEmpresa((f) => ({ ...f, nombre: e.target.value }))} />
								</div>
								<div className="tipos-editor-fila-doble">
									<div className="leg-field">
										<label>Tipo identificación</label>
										<select value={formEmpresa.tipoIdentificacion ?? '03'} onChange={(e) => setFormEmpresa((f) => ({ ...f, tipoIdentificacion: e.target.value }))}>
											{TIPOS_IDENTIFICACION.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
										</select>
									</div>
									<div className="leg-field">
										<label>Identificación *</label>
										<input value={formEmpresa.identificacion ?? ''} onChange={(e) => setFormEmpresa((f) => ({ ...f, identificacion: e.target.value.replace(/\D/g, '') }))} />
									</div>
								</div>
								<div className="tipos-editor-fila-doble">
									<div className="leg-field">
										<label>Cuenta de origen *</label>
										<input value={formEmpresa.cuentaOrigen ?? ''} onChange={(e) => setFormEmpresa((f) => ({ ...f, cuentaOrigen: e.target.value.replace(/\D/g, '') }))} />
									</div>
									<div className="leg-field">
										<label>Tipo de cuenta</label>
										<select value={formEmpresa.tipoCuenta ?? 'CA'} onChange={(e) => setFormEmpresa((f) => ({ ...f, tipoCuenta: e.target.value }))}>
											<option value="CA">CA — Ahorros</option>
											<option value="CC">CC — Corriente</option>
										</select>
									</div>
								</div>
							</div>
							<div className="pagos-nuevo-form-actions">
								<button type="button" className="admin-primary-button" onClick={guardarEmpresa}>Guardar</button>
								<button type="button" className="admin-ghost-button" onClick={() => setFormEmpresa(null)}>Cancelar</button>
							</div>
						</div>
					) : (
						<button type="button" className="admin-ghost-button" onClick={() => setFormEmpresa(nuevaEmpresa())}>+ Nueva empresa ordenante</button>
					)}
				</section>
			) : (
				<section className="leg-config-section">
					<p className="leg-config-hint">
						Las entidades oficiales vienen de la tabla publicada por Davivienda. Las registradas manualmente
						quedan marcadas y generan advertencia hasta que el banco las publique oficialmente.
					</p>
					<div style={{ overflowX: 'auto', marginBottom: 16 }}>
						<table className="pagos-tabla">
							<thead>
								<tr>
									<th>Código</th>
									<th>Nombre</th>
									<th>Origen</th>
									<th>Estado</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{bancos.map((b) => (
									<tr key={b.codigo}>
										<td>{b.codigo}</td>
										<td>{b.nombre}</td>
										<td>{b.oficial ? 'Oficial' : 'Manual'}</td>
										<td>{b.activo ? 'Activa' : 'Inactiva'}</td>
										<td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 4 }}>
											<button type="button" className="admin-ghost-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => alternarActivoBanco(b)}>
												{b.activo ? 'Desactivar' : 'Activar'}
											</button>
											{!b.oficial ? (
												<button type="button" className="tipos-eliminar-btn" onClick={() => eliminarBanco(b)}>Eliminar</button>
											) : null}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="ruta-especifica-form">
						<h4 className="tarifa-subtitulo">Registrar entidad manual</h4>
						<div className="tipos-editor-fila-doble">
							<div className="leg-field">
								<label>Código *</label>
								<input value={nuevoCodigoBanco} onChange={(e) => setNuevoCodigoBanco(e.target.value.replace(/\D/g, ''))} placeholder="Ej: 999" />
							</div>
							<div className="leg-field">
								<label>Nombre *</label>
								<input value={nuevoNombreBanco} onChange={(e) => setNuevoNombreBanco(e.target.value)} placeholder="Nombre de la entidad" />
							</div>
						</div>
						<button type="button" className="admin-primary-button" style={{ marginTop: 10 }} onClick={registrarBanco}>
							+ Registrar entidad
						</button>
					</div>
				</section>
			)}
		</div>
	);
}
