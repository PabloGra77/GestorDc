import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../app/layout/AppLayout';
import { clearAuthSession, getAuthSession } from '../auth/auth.service';
import { useSessionTimeout } from '../auth/useSessionTimeout';
import { SessionTimeoutModal } from '../auth/SessionTimeoutModal';
import { api } from '../../services/http/api';
import { appendChatMessages, formatRelativeNow } from '../../app/layout/requestsChatStore';
import { RadicacionesModule } from '../radicaciones/RadicacionesModule';
import { AreasPanel } from '../admin/AreasPanel';
import { ReportesPanel } from '../admin/ReportesPanel';
import { BulkCreatePanel } from '../admin/BulkCreatePanel';
import { PersonalAutorizadoPanel } from '../admin/PersonalAutorizadoPanel';
import { ConfiguracionSmtpPanel } from '../admin/ConfiguracionSmtpPanel';
import { ConfigViaticosPanel } from '../admin/ConfigViaticosPanel';
import { ConfigCuentaCobroPanel } from '../admin/ConfigCuentaCobroPanel';
import { ConfigLegalizacionPanel } from '../admin/ConfigLegalizacionPanel';
import { ProfilePanel } from '../admin/ProfilePanel';
import { HistorialPanel } from '../admin/HistorialPanel';
import { InformesOpsPanel } from '../admin/InformesOpsPanel';
import { InicioStats, InicioRecientes, SeguimientoRadicado } from './InicioStats';
import { usePayopsLogo } from '../../hooks/usePayopsLogo';
import type { Role } from '../../types/role';
import type { Radicado, VerificarRadicadoResponse } from '../../types/radicado';
import type { Usuario } from '../../types/usuario';

type AdminModule = 'Usuarios' | 'Personal autorizado' | 'Roles' | 'Areas' | 'Usuarios en linea' | 'Configuracion' | 'Config. Viáticos' | 'Config. Cuenta de Cobro' | 'Config. Legalización' | 'Historial' | 'Informes OPS';

const ROLE_PERMISSIONS_CATALOG = {
	inicio: {
		label: 'Inicio',
		permissions: [
			{ key: 'realizarSolicitudes', label: 'Realizar solicitudes' },
			{ key: 'verificarRadicados', label: 'Verificar radicados' },
		],
	},
	radicaciones: {
		label: 'Radicaciones',
		permissions: [
			{ key: 'verTableroGeneral', label: 'Ver tablero general' },
			{ key: 'radicarDocumentos', label: 'Radicar documentos' },
			{ key: 'validarDocumentalmente', label: 'Validar documentalmente' },
			{ key: 'emitirInformeSupervision', label: 'Emitir informe de supervision' },
			{ key: 'consultarHistorial', label: 'Consultar historial' },
		],
	},
	panelAdministrador: {
		label: 'Panel administrador',
		permissions: [
			{ key: 'crearUsuarios', label: 'Crear usuarios' },
			{ key: 'crearRoles', label: 'Crear roles' },
		],
	},
} as const;

type RolePermisos = Record<string, string[]>;

function buildDefaultRolePermisos(): RolePermisos {
	return Object.fromEntries(
		Object.keys(ROLE_PERMISSIONS_CATALOG).map((modulo) => [modulo, [] as string[]]),
	);
}

function normalizarPermisosEntrada(permisos?: Record<string, string[]>): RolePermisos {
	const base = buildDefaultRolePermisos();

	if (!permisos) {
		return base;
	}

	for (const modulo of Object.keys(base)) {
		base[modulo] = Array.isArray(permisos[modulo]) ? [...permisos[modulo]] : [];
	}

	return base;
}

function combinarPermisos(basePermisos?: Record<string, string[]>, extrasPermisos?: Record<string, string[]>): RolePermisos {
	const combinado = buildDefaultRolePermisos();

	for (const modulo of Object.keys(combinado)) {
		const base = Array.isArray(basePermisos?.[modulo]) ? basePermisos[modulo] : [];
		const extras = Array.isArray(extrasPermisos?.[modulo]) ? extrasPermisos[modulo] : [];
		combinado[modulo] = [...new Set([...base, ...extras])];
	}

	return combinado;
}

export function DashboardPage() {
	const navigate = useNavigate();
	const session = getAuthSession();
	const [activeSection, setActiveSection] = useState('Inicio');
	const [radicacionesVista, setRadicacionesVista] = useState<'nueva' | 'misSolicitudes' | 'bandeja' | 'tablero'>('misSolicitudes');
	const [solicitudAbierta, setSolicitudAbierta] = useState<number | undefined>(undefined);
	const [activeAdminModule, setActiveAdminModule] = useState<AdminModule>('Usuarios');
	const [perfilBannerDismissed, setPerfilBannerDismissed] = useState(() => {
		try { return localStorage.getItem('payops:perfil:banner:' + (session?.usuario.correo ?? '')) === '1'; } catch { return false; }
	});
	const [bienvenidaVista, setBienvenidaVista] = useState(() => {
		try { return localStorage.getItem('payops:bienvenida:v1:' + (session?.usuario.correo ?? '')) === '1'; } catch { return true; }
	});
	const [datosAutorizados, setDatosAutorizados] = useState(false);
	const [isLoadingAdminData, setIsLoadingAdminData] = useState(false);
	const [roles, setRoles] = useState<Role[]>([]);
	const [usuarios, setUsuarios] = useState<Usuario[]>([]);
	const [userSearch, setUserSearch] = useState('');
	const [adminMessage, setAdminMessage] = useState('');
	const [adminError, setAdminError] = useState('');

	const [userPrimerNombre, setUserPrimerNombre] = useState('');
	const [userSegundoNombre, setUserSegundoNombre] = useState('');
	const [userPrimerApellido, setUserPrimerApellido] = useState('');
	const [userSegundoApellido, setUserSegundoApellido] = useState('');
	const [userTipoDocumento, setUserTipoDocumento] = useState('CC');
	const [userNumeroDocumento, setUserNumeroDocumento] = useState('');
	const [userCorreoCorporativo, setUserCorreoCorporativo] = useState('');
	const [userPassword, setUserPassword] = useState('');
	const [userRolId, setUserRolId] = useState<number | ''>('');
	const [userAreaId, setUserAreaId] = useState<number | ''>('');
	const [userNivelAprobacion, setUserNivelAprobacion] = useState<string>('');
	const [userCorreoPersonal, setUserCorreoPersonal] = useState('');
	const [userBanco, setUserBanco] = useState('');
	const [userTipoCuenta, setUserTipoCuenta] = useState('');
	const [userNumeroCuenta, setUserNumeroCuenta] = useState('');
	const [userTitularCuenta, setUserTitularCuenta] = useState('');
	const [areasUsuarios, setAreasUsuarios] = useState<Array<{ id: number; nombre: string }>>([]);
	const [editingUserId, setEditingUserId] = useState<number | null>(null);
	const [isUserPermisosOpen, setIsUserPermisosOpen] = useState(false);
	const [usuarioPermisosObjetivo, setUsuarioPermisosObjetivo] = useState<Usuario | null>(null);
	const [usuarioPermisosDraft, setUsuarioPermisosDraft] = useState<RolePermisos>(buildDefaultRolePermisos);

	const [roleNombre, setRoleNombre] = useState('');
	const [roleDescripcion, setRoleDescripcion] = useState('');
	const [rolePermisos, setRolePermisos] = useState<RolePermisos>(buildDefaultRolePermisos);
	const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
	const [referenciaRadicado, setReferenciaRadicado] = useState('');
	const [asuntoRadicado, setAsuntoRadicado] = useState('');
	const [radicadoMessage, setRadicadoMessage] = useState('');
	const [radicadoError, setRadicadoError] = useState('');
	const [isComposeRadicadoOpen, setIsComposeRadicadoOpen] = useState(false);
	const [composeParaDestinos, setComposeParaDestinos] = useState<string[]>([]);
	const [composeParaInput, setComposeParaInput] = useState('');
	const [composeCcDestinos, setComposeCcDestinos] = useState<string[]>([]);
	const [composeCcInput, setComposeCcInput] = useState('');
	const [composeMensaje, setComposeMensaje] = useState('');
	const [composeAdjuntos, setComposeAdjuntos] = useState<string[]>([]);
	const composeParaInputRef = useRef<HTMLInputElement | null>(null);
	const composeAdjuntoInputRef = useRef<HTMLInputElement | null>(null);
	const composeMensajeEditorRef = useRef<HTMLDivElement | null>(null);

	const rol = useMemo(() => session?.usuario.rol.nombre ?? 'Sin rol', [session]);
	const usePayopsLogoHero = usePayopsLogo();
	const saludoInicio = useMemo(() => {
		const h = new Date().getHours();
		if (h >= 6 && h < 12) return 'Buenos días';
		if (h >= 12 && h < 18) return 'Buenas tardes';
		return 'Buenas noches';
	}, []);
	const primerNombreSesion = useMemo(() => {
		const n = session?.usuario.nombreCompleto ?? '';
		return n.split(' ')[0] || n;
	}, [session]);
	const permisosUsuarioSesion = useMemo(() => session?.usuario.permisos ?? {}, [session]);
	const permisosRolSesion = useMemo(() => session?.usuario.rol.permisos ?? {}, [session]);
	const esAdmin = rol.toLowerCase() === 'administrador';
	const permisosEfectivosSesion = useMemo(
		() => combinarPermisos(permisosRolSesion, permisosUsuarioSesion),
		[permisosRolSesion, permisosUsuarioSesion],
	);
	const tienePermisosConfigurados = useMemo(
		() => Object.values(permisosEfectivosSesion).some((items) => items.length > 0),
		[permisosEfectivosSesion],
	);

	const tienePermiso = (modulo: string, permiso: string) => {
		if (!tienePermisosConfigurados) {
			return true;
		}

		const permisosModulo = permisosEfectivosSesion[modulo] || [];
		return permisosModulo.includes(permiso);
	};

	const canCrearUsuarios = esAdmin || tienePermiso('panelAdministrador', 'crearUsuarios');
	const canCrearRoles = tienePermiso('panelAdministrador', 'crearRoles');
	const totalUsuariosActivos = useMemo(() => usuarios.filter((usuario) => usuario.activo).length, [usuarios]);
	const usuariosRecientes = useMemo(() => [...usuarios].reverse(), [usuarios]);
	const usuariosFiltrados = useMemo(() => {
		const q = userSearch.trim().toLowerCase();
		if (!q) return usuariosRecientes;
		return usuariosRecientes.filter((u) =>
			u.nombreCompleto.toLowerCase().includes(q) ||
			u.correo.toLowerCase().includes(q) ||
			(u.rol?.nombre || '').toLowerCase().includes(q)
		);
	}, [usuariosRecientes, userSearch]);
	const usuariosEnLinea = useMemo(() => {
		if (!session) {
			return [] as Usuario[];
		}

		const correoSesion = session.usuario.correo.trim().toLowerCase();
		const usuarioSesion = usuarios.find(
			(usuario) => usuario.correo.trim().toLowerCase() === correoSesion,
		);

		return usuarioSesion ? [usuarioSesion] : [session.usuario];
	}, [usuarios, session]);
	const usuariosSugeridosPara = useMemo(() => {
		const termino = composeParaInput.trim().toLowerCase();

		if (!termino) {
			return [] as Usuario[];
		}

		return usuarios
			.filter((usuario) => {
				const nombre = usuario.nombreCompleto.toLowerCase();
				const correo = usuario.correo.toLowerCase();
				const yaAgregado = composeParaDestinos.some((destino) => destino.toLowerCase() === correo);
				return !yaAgregado && (nombre.startsWith(termino) || correo.startsWith(termino));
			})
			.slice(0, 8);
	}, [composeParaInput, composeParaDestinos, usuarios]);

	const usuariosSugeridosCc = useMemo(() => {
		const termino = composeCcInput.trim().toLowerCase();

		if (!termino) {
			return [] as Usuario[];
		}

		return usuarios
			.filter((usuario) => {
				const nombre = usuario.nombreCompleto.toLowerCase();
				const correo = usuario.correo.toLowerCase();
				const yaAgregado = composeCcDestinos.some((destino) => destino.toLowerCase() === nombre);
				return !yaAgregado && (nombre.startsWith(termino) || correo.startsWith(termino));
			})
			.slice(0, 8);
	}, [composeCcInput, composeCcDestinos, usuarios]);

	function resolverUsuarioInterno(destino: string) {
		const valor = destino.trim().toLowerCase();
		if (!valor) {
			return null;
		}

		const usuario = usuarios.find(
			(item) => item.nombreCompleto.toLowerCase() === valor || item.correo.toLowerCase() === valor,
		);

		return usuario ? usuario.nombreCompleto : null;
	}

	function normalizarDestinos(valor: string) {
		return valor
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	function agregarDestinoUnico(destinos: string[], nuevo: string) {
		if (destinos.some((item) => item.toLowerCase() === nuevo.toLowerCase())) {
			return destinos;
		}

		return [...destinos, nuevo];
	}

	function agregarParaDesdeInput() {
		const items = normalizarDestinos(composeParaInput);
		if (items.length === 0) {
			setComposeParaInput('');
			return;
		}

		setComposeParaDestinos((prev) => items.reduce((acc, item) => agregarDestinoUnico(acc, item), prev));
		setComposeParaInput('');
	}

	function agregarCcDesdeInput() {
		const items = normalizarDestinos(composeCcInput);
		if (items.length === 0) {
			setComposeCcInput('');
			return;
		}

		setComposeCcDestinos((prev) => items.reduce((acc, item) => agregarDestinoUnico(acc, item), prev));
		setComposeCcInput('');
	}

	function manejarTeclaDestinos(event: KeyboardEvent<HTMLInputElement>, tipo: 'para' | 'cc') {
		if (event.key !== 'Enter' && event.key !== ',') {
			return;
		}

		event.preventDefault();
		if (tipo === 'para') {
			agregarParaDesdeInput();
			return;
		}

		agregarCcDesdeInput();
	}

	function sincronizarMensajeDesdeEditor() {
		const editor = composeMensajeEditorRef.current;
		if (!editor) {
			return;
		}

		const textoPlano = editor.innerText.replace(/\u00a0/g, ' ').trim();
		setComposeMensaje(textoPlano);
		setAsuntoRadicado(textoPlano);
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
		const url = (window.prompt('URL del enlace', 'https://') ?? '').trim();
		if (!url) return;
		if (!/^(https?:|mailto:)/i.test(url)) {
			alert('Solo se permiten URLs que empiecen con http://, https:// o mailto:');
			return;
		}

		document.execCommand('createLink', false, url);
		sincronizarMensajeDesdeEditor();
	}

	async function loadAdminData() {
		if (!esAdmin) {
			return;
		}

		setIsLoadingAdminData(true);
		setAdminError('');

		try {
			const [rolesResponse, usuariosResponse, areasResponse] = await Promise.all([
				api.get<Role[]>('/roles'),
				api.get<Usuario[]>('/usuarios'),
				api.get<Array<{ id: number; nombre: string }>>('/areas'),
			]);

			setRoles(rolesResponse.data);
			setUsuarios(usuariosResponse.data);
			setAreasUsuarios(areasResponse.data);

			if (rolesResponse.data.length > 0 && userRolId === '') {
				setUserRolId(rolesResponse.data[0].id);
			}
		} catch {
			setAdminError('No se pudieron cargar los datos administrativos.');
		} finally {
			setIsLoadingAdminData(false);
		}
	}

	useEffect(() => {
		loadAdminData();
		// Se recarga cuando cambia el tipo de sesión o el rol seleccionado por defecto.
	}, [esAdmin, userRolId]);

	useEffect(() => {
		if (!isComposeRadicadoOpen || !composeMensajeEditorRef.current) {
			return;
		}

		composeMensajeEditorRef.current.innerText = composeMensaje;
	}, [isComposeRadicadoOpen]);

	if (!session) {
		navigate('/login', { replace: true });
		return null;
	}

	function handleLogout() {
		clearAuthSession();
		navigate('/login', { replace: true });
	}

	// ── Sesión por inactividad ──────────────────────────────────────────────
	const { state: sessionState, remaining: sessionRemaining, extend: extendSession } = useSessionTimeout(handleLogout);

	// Escuchar evento 401 del interceptor axios (sesión expirada por el servidor)
	useEffect(() => {
		const handler = () => {
			clearAuthSession();
			navigate('/login', { replace: true });
		};
		window.addEventListener('payops:session-expired', handler);
		return () => window.removeEventListener('payops:session-expired', handler);
	}, [navigate]);

	function getErrorMessage(error: unknown) {
		const maybeError = error as { response?: { data?: { message?: string | string[] } } };
		const message = maybeError.response?.data?.message;
		if (Array.isArray(message)) {
			return message.join(', ');
		}
		if (typeof message === 'string') {
			return message;
		}
		return 'No fue posible completar la operación.';
	}

	function construirNombreCompleto() {
		return [userPrimerNombre, userSegundoNombre, userPrimerApellido, userSegundoApellido]
			.map((parte) => parte.trim())
			.filter(Boolean)
			.join(' ');
	}

	function descomponerNombreCompleto(nombreCompleto: string) {
		const partes = nombreCompleto
			.split(' ')
			.map((item) => item.trim())
			.filter(Boolean);

		if (partes.length <= 1) {
			return {
				primerNombre: partes[0] || '',
				segundoNombre: '',
				primerApellido: '',
				segundoApellido: '',
			};
		}

		if (partes.length === 2) {
			return {
				primerNombre: partes[0],
				segundoNombre: '',
				primerApellido: partes[1],
				segundoApellido: '',
			};
		}

		if (partes.length === 3) {
			return {
				primerNombre: partes[0],
				segundoNombre: partes[1],
				primerApellido: partes[2],
				segundoApellido: '',
			};
		}

		return {
			primerNombre: partes[0],
			segundoNombre: partes[1],
			primerApellido: partes[2],
			segundoApellido: partes.slice(3).join(' '),
		};
	}

	function limpiarFormularioUsuario() {
		setUserPrimerNombre('');
		setUserSegundoNombre('');
		setUserPrimerApellido('');
		setUserSegundoApellido('');
		setUserTipoDocumento('CC');
		setUserNumeroDocumento('');
		setUserCorreoCorporativo('');
		setUserPassword('');
		setUserAreaId('');
		setUserNivelAprobacion('');
		setUserCorreoPersonal('');
		setUserBanco('');
		setUserTipoCuenta('');
		setUserNumeroCuenta('');
		setUserTitularCuenta('');
		setEditingUserId(null);
	}

	function toggleRolePermiso(moduloKey: string, permisoKey: string) {
		setRolePermisos((prev) => {
			const actuales = prev[moduloKey] || [];
			const existe = actuales.includes(permisoKey);

			return {
				...prev,
				[moduloKey]: existe
					? actuales.filter((item) => item !== permisoKey)
					: [...actuales, permisoKey],
			};
		});
	}

	function toggleUsuarioPermiso(moduloKey: string, permisoKey: string) {
		setUsuarioPermisosDraft((prev) => {
			const actuales = prev[moduloKey] || [];
			const existe = actuales.includes(permisoKey);

			return {
				...prev,
				[moduloKey]: existe
					? actuales.filter((item) => item !== permisoKey)
					: [...actuales, permisoKey],
			};
		});
	}

	function limpiarFormularioRol() {
		setRoleNombre('');
		setRoleDescripcion('');
		setRolePermisos(buildDefaultRolePermisos());
		setEditingRoleId(null);
	}

	function abrirPermisosUsuario(usuario: Usuario) {
		if (usuario.rol.nombre.trim().toLowerCase() === 'administrador') {
			setAdminError('No está permitido modificar permisos de usuarios con rol Administrador.');
			return;
		}

		setUsuarioPermisosObjetivo(usuario);
		setUsuarioPermisosDraft(normalizarPermisosEntrada(usuario.permisos));
		setIsUserPermisosOpen(true);
	}

	function cerrarPermisosUsuario() {
		setIsUserPermisosOpen(false);
		setUsuarioPermisosObjetivo(null);
		setUsuarioPermisosDraft(buildDefaultRolePermisos());
	}

	function contarPermisosRole(rolItem: Role) {
		const permisos = rolItem.permisos ?? {};
		return Object.values(permisos).reduce((acc, current) => acc + current.length, 0);
	}

	function iniciarEdicionRol(roleItem: Role) {
		setAdminMessage('');
		setAdminError('');
		setEditingRoleId(roleItem.id);
		setRoleNombre(roleItem.nombre);
		setRoleDescripcion(roleItem.descripcion || '');
		setRolePermisos(normalizarPermisosEntrada(roleItem.permisos));
	}

	async function iniciarEdicionUsuario(usuario: Usuario) {
		setAdminMessage('');
		setAdminError('');
		setEditingUserId(usuario.id);

		const nombrePartido = descomponerNombreCompleto(usuario.nombreCompleto || '');
		setUserPrimerNombre(usuario.primerNombre?.trim() || nombrePartido.primerNombre);
		setUserSegundoNombre(usuario.segundoNombre?.trim() || nombrePartido.segundoNombre);
		setUserPrimerApellido(usuario.primerApellido?.trim() || nombrePartido.primerApellido);
		setUserSegundoApellido(usuario.segundoApellido?.trim() || nombrePartido.segundoApellido);
		setUserTipoDocumento((usuario.tipoDocumento?.trim().toUpperCase() || 'CC') as 'CC' | 'CE' | 'TI' | 'PP' | 'NIT');
		setUserNumeroDocumento(usuario.numeroDocumento?.trim() || '');
		setUserCorreoCorporativo(usuario.correo);
		setUserPassword('');
		setUserRolId(usuario.rol?.id || '');
		setUserAreaId(usuario.areaId ?? '');
		setUserNivelAprobacion(usuario.nivelAprobacion ?? '');
		// Cargar datos extra (cuenta bancaria, correo personal)
		try {
			const r = await api.get<Record<string, unknown>>(`/usuarios/${usuario.id}`);
			const d = r.data;
			setUserCorreoPersonal((d.correoPersonal as string) ?? '');
			setUserBanco((d.banco as string) ?? '');
			setUserTipoCuenta((d.tipoCuenta as string) ?? '');
			setUserNumeroCuenta((d.numeroCuenta as string) ?? '');
			setUserTitularCuenta((d.titularCuenta as string) ?? '');
		} catch { /* silencioso */ }
	}

	async function handleCreateRole(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setAdminMessage('');
		setAdminError('');

		try {
			const payload = {
				nombre: roleNombre,
				descripcion: roleDescripcion || null,
				permisos: rolePermisos,
				activo: true,
			};

			if (editingRoleId) {
				await api.patch(`/roles/${editingRoleId}`, payload);
				setAdminMessage('Rol actualizado correctamente.');
			} else {
				await api.post('/roles', payload);
				setAdminMessage('Rol creado correctamente.');
			}

			limpiarFormularioRol();
			await loadAdminData();
		} catch (error) {
			setAdminError(getErrorMessage(error));
		}
	}

	async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setAdminMessage('');
		setAdminError('');

		if (userRolId === '') {
			setAdminError('Selecciona un rol para el usuario.');
			return;
		}

		const nombreCompleto = construirNombreCompleto();
		if (!nombreCompleto) {
			setAdminError('Completa al menos primer nombre y primer apellido.');
			return;
		}

		const rolSeleccionado = roles.find((roleItem) => roleItem.id === Number(userRolId));
		if (!rolSeleccionado) {
			setAdminError('No fue posible resolver el rol seleccionado.');
			return;
		}

		try {
			const payload = {
				nombreCompleto,
				primerNombre: userPrimerNombre,
				segundoNombre: userSegundoNombre || null,
				primerApellido: userPrimerApellido,
				segundoApellido: userSegundoApellido || null,
				tipoDocumento: userTipoDocumento,
				numeroDocumento: userNumeroDocumento,
				correo: userCorreoCorporativo,
				area: rolSeleccionado.nombre,
				rolId: Number(userRolId),
				areaId: userAreaId === '' ? null : Number(userAreaId),
				nivelAprobacion: userNivelAprobacion || null,
				correoPersonal: userCorreoPersonal || null,
				banco: userBanco || null,
				tipoCuenta: userTipoCuenta || null,
				numeroCuenta: userNumeroCuenta || null,
				titularCuenta: userTitularCuenta || null,
				activo: true,
			} as Record<string, unknown>;

			if (editingUserId && userPassword.trim()) {
				payload.password = userPassword;
			}

			if (editingUserId) {
				await api.patch(`/usuarios/${editingUserId}`, payload);
				setAdminMessage('Usuario actualizado correctamente.');
			} else {
				const resp = await api.post<{ correoEnviado?: boolean; passwordTemporal?: string | null }>(
					'/usuarios',
					payload,
				);
				if (resp.data?.correoEnviado === false) {
					setAdminMessage(
						`Usuario creado, pero el correo no se pudo enviar. Contraseña temporal: ${
							resp.data.passwordTemporal ?? '(usa "Restablecer")'
						}. Entrégasela al usuario o usa "Restablecer".`,
					);
				} else {
					setAdminMessage('Usuario creado. Se envió la contraseña temporal por correo.');
				}
			}

			limpiarFormularioUsuario();
			await loadAdminData();
		} catch (error) {
			setAdminError(getErrorMessage(error));
		}
	}

	async function guardarPermisosUsuario() {
		if (!usuarioPermisosObjetivo) {
			return;
		}

		setAdminMessage('');
		setAdminError('');

		try {
			await api.patch(`/usuarios/${usuarioPermisosObjetivo.id}`, {
				permisos: usuarioPermisosDraft,
			});

			setAdminMessage(`Permisos actualizados para ${usuarioPermisosObjetivo.nombreCompleto}.`);
			cerrarPermisosUsuario();
			await loadAdminData();
		} catch (error) {
			setAdminError(getErrorMessage(error));
		}
	}

	async function enviarRestablecimientoUsuario(usuario: Usuario) {
		setAdminMessage('');
		setAdminError('');

		try {
			await api.post('/auth/password-reset/request', {
				correo: usuario.correo,
			});

			setAdminMessage(`Se envió el correo de restablecimiento a ${usuario.correo}.`);
		} catch (error) {
			setAdminError(getErrorMessage(error));
		}
	}

	async function cambiarEstadoUsuario(usuario: Usuario) {
		setAdminMessage('');
		setAdminError('');

		try {
			await api.patch(`/usuarios/${usuario.id}`, {
				activo: !usuario.activo,
			});

			setAdminMessage(
				`Usuario ${usuario.nombreCompleto} ${usuario.activo ? 'desactivado' : 'aprobado'} correctamente.`,
			);
			await loadAdminData();
		} catch (error) {
			setAdminError(getErrorMessage(error));
		}
	}

	async function eliminarUsuario(usuario: Usuario) {
		setAdminMessage('');
		setAdminError('');
		if (
			!window.confirm(
				`¿Rechazar y eliminar definitivamente a ${usuario.nombreCompleto} (${usuario.correo})? Esta acción no se puede deshacer.`,
			)
		) {
			return;
		}
		try {
			await api.delete(`/usuarios/${usuario.id}`);
			setAdminMessage(`Usuario ${usuario.correo} rechazado y eliminado.`);
			await loadAdminData();
		} catch (error) {
			setAdminError(getErrorMessage(error));
		}
	}

	async function cambiarEstadoRol(rolItem: Role) {
		setAdminMessage('');
		setAdminError('');
		try {
			await api.patch(`/roles/${rolItem.id}`, { activo: !rolItem.activo });
			setAdminMessage(`Rol "${rolItem.nombre}" ${rolItem.activo ? 'desactivado' : 'activado'}.`);
			await loadAdminData();
		} catch (error) {
			setAdminError(getErrorMessage(error));
		}
	}

	async function eliminarRol(rolItem: Role) {
		setAdminMessage('');
		setAdminError('');
		const ok = window.confirm(`¿Eliminar el rol "${rolItem.nombre}"? Esta acción no se puede deshacer.`);
		if (!ok) return;
		try {
			await api.delete(`/roles/${rolItem.id}`);
			setAdminMessage(`Rol "${rolItem.nombre}" eliminado.`);
			await loadAdminData();
		} catch (error) {
			setAdminError(getErrorMessage(error));
		}
	}

	async function handleCreateRadicado(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setRadicadoMessage('');
		setRadicadoError('');

		const paraPendientes = normalizarDestinos(composeParaInput);
		const ccPendientes = normalizarDestinos(composeCcInput);

		const destinosPara = [...composeParaDestinos];
		for (const destino of paraPendientes) {
			if (!destinosPara.some((item) => item.toLowerCase() === destino.toLowerCase())) {
				destinosPara.push(destino);
			}
		}

		const destinosCc = [...composeCcDestinos];
		for (const cc of ccPendientes) {
			if (!destinosCc.some((item) => item.toLowerCase() === cc.toLowerCase())) {
				destinosCc.push(cc);
			}
		}

		if (destinosPara.length === 0) {
			setRadicadoError('Selecciona un destino para la solicitud antes de enviar.');
			return;
		}

		try {
			const ccTexto = destinosCc.length > 0 ? ` | CC: ${destinosCc.join(', ')}` : '';
			const adjuntosTexto = composeAdjuntos.length > 0 ? ` | Adjuntos: ${composeAdjuntos.join(', ')}` : '';
			const asuntoConDestino = composeMensaje.trim()
				? `[Para: ${destinosPara.join(', ')}${ccTexto}${adjuntosTexto}] ${composeMensaje.trim()}`
				: `[Para: ${destinosPara.join(', ')}${ccTexto}${adjuntosTexto}]`;

			const response = await api.post<Radicado>('/radicados', {
				referencia: referenciaRadicado,
				asunto: asuntoConDestino || asuntoRadicado || null,
				para: destinosPara,
				cc: destinosCc,
				mensaje: composeMensaje || null,
				adjuntos: composeAdjuntos,
			});

			const tituloSolicitud =
				referenciaRadicado.trim() || composeMensaje.trim() || `Radicado ${response.data.numero}`;
			const destinatariosInternos = [...destinosPara, ...destinosCc]
				.map((item) => resolverUsuarioInterno(item))
				.filter((item): item is string => Boolean(item));
			const chatMessages = destinatariosInternos.map((recipient, index) => ({
				id: Date.now() + index,
				title: composeAdjuntos.length > 0 ? `${tituloSolicitud} (con adjunto)` : tituloSolicitud,
				author: session!.usuario.nombreCompleto,
				recipient,
				createdAt: formatRelativeNow(),
			}));
			appendChatMessages(chatMessages);

			setReferenciaRadicado('');
			setAsuntoRadicado('');
			setComposeParaDestinos([]);
			setComposeParaInput('');
			setComposeCcDestinos([]);
			setComposeCcInput('');
			setComposeMensaje('');
			setComposeAdjuntos([]);
			setIsComposeRadicadoOpen(false);
			setRadicadoMessage(`Radicado ${response.data.numero} creado correctamente.`);
		} catch (error) {
			setRadicadoError(getErrorMessage(error));
		}
	}

	return (
		<>
		{/* Modal de bienvenida — primer acceso */}
		{!bienvenidaVista && (
			<div style={{
				position: 'fixed', inset: 0, zIndex: 9999,
				background: 'rgba(0,0,0,0.72)', display: 'flex',
				alignItems: 'center', justifyContent: 'center', padding: '16px 12px',
			}}>
				{/* card con colores explícitos para que no herede dark-mode global */}
				<div style={{
					background: '#ffffff', borderRadius: 16, maxWidth: 520, width: '100%',
					maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto',
					padding: 'clamp(20px, 5vw, 32px) clamp(16px, 5vw, 28px)',
					boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
					color: '#1a2742',
				}}>
					<div style={{ textAlign: 'center', marginBottom: 18 }}>
						<div style={{ fontSize: 44, marginBottom: 6, lineHeight: 1 }}>📋</div>
						<h2 style={{ margin: 0, fontSize: 'clamp(17px, 4.5vw, 21px)', fontWeight: 700, color: '#1a2742' }}>
							Bienvenido(a) a PayOPS
						</h2>
						<p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 12.5 }}>
							Plataforma de gestión documental de pagos · Goleman IPS
						</p>
					</div>

					<p style={{ fontSize: 13.5, lineHeight: 1.65, margin: '0 0 10px', color: '#334155' }}>
						PayOPS es la plataforma oficial de Goleman IPS para el registro, aprobación y
						trazabilidad de solicitudes de anticipo, viáticos, cuentas de cobro y legalizaciones.
					</p>
					<p style={{ fontSize: 13.5, lineHeight: 1.65, margin: '0 0 14px', color: '#334155' }}>
						<strong style={{ color: '#1a2742' }}>Primer paso:</strong> completa tu información en{' '}
						<em>Mi Perfil</em>. Esos datos se usarán en todas tus solicitudes.
					</p>

					<div style={{
						background: '#fefce8', borderRadius: 8,
						padding: '10px 14px', fontSize: 12.5, lineHeight: 1.6,
						borderLeft: '3px solid #d4a017', marginBottom: 16, color: '#78350f',
					}}>
						<strong style={{ color: '#92400e' }}>Aviso legal:</strong>{' '}
						La falsificación, alteración o manipulación de documentos constituye delito conforme al{' '}
						<strong style={{ color: '#92400e' }}>Art. 286 del Código Penal colombiano</strong> (Ley 599 de 2000).
						Todos los documentos subidos son objeto de análisis forense digital.
					</div>

					<label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 18 }}>
						<input
							type="checkbox"
							checked={datosAutorizados}
							onChange={(e) => setDatosAutorizados(e.target.checked)}
							style={{ marginTop: 3, flexShrink: 0, accentColor: '#1a2742', width: 16, height: 16 }}
						/>
						<span style={{ fontSize: 12.5, lineHeight: 1.55, color: '#334155' }}>
							Autorizo el tratamiento de mis datos personales conforme a la{' '}
							<strong style={{ color: '#1a2742' }}>Ley 1581 de 2012</strong> (Protección de Datos Personales)
							y declaro que la información que registre en esta plataforma es veraz y verificable.
						</span>
					</label>

					<button
						type="button"
						disabled={!datosAutorizados}
						onClick={() => {
							try { localStorage.setItem('payops:bienvenida:v1:' + (session?.usuario.correo ?? ''), '1'); } catch { /* */ }
							api.patch('/usuarios/perfil', { datosAutorizados: true }).catch(() => {});
							setBienvenidaVista(true);
							setActiveSection('Mi perfil');
						}}
						style={{
							display: 'block', width: '100%',
							padding: '13px 16px', borderRadius: 10, border: 'none',
							background: datosAutorizados ? '#1a2742' : '#94a3b8',
							color: '#ffffff', fontWeight: 700, fontSize: 15,
							cursor: datosAutorizados ? 'pointer' : 'not-allowed',
							transition: 'background 0.2s, opacity 0.2s',
							opacity: datosAutorizados ? 1 : 0.7,
							letterSpacing: '0.01em',
						}}
					>
						Comenzar → ir a Mi Perfil
					</button>
				</div>
			</div>
		)}

		{(sessionState === 'warning' || sessionState === 'expired') && (
			<SessionTimeoutModal
				state={sessionState}
				remaining={sessionRemaining}
				correo={session.usuario.correo}
				onExtend={extendSession}
				onLogout={handleLogout}
			/>
		)}
		<AppLayout
			nombre={session.usuario.nombreCompleto}
			rol={rol}
			esAdmin={esAdmin}
			activeSection={activeSection}
			onSelectSection={setActiveSection}
			onNavigateRadicaciones={(vista, solicitudId) => { setRadicacionesVista(vista); setSolicitudAbierta(solicitudId); setActiveSection('Radicaciones'); }}
			onLogout={handleLogout}
		>
			{activeSection === 'Inicio' ? (
				<section className="inicio-layout">

					{/* ── Hero de bienvenida ── */}
					<div className="inicio-hero">
						<div className="inicio-hero-left">
							<div className="inicio-hero-logo-row">
								<img
									src={usePayopsLogoHero}
									alt="Goleman IPS"
									className="inicio-hero-logo"
									onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
								/>
							</div>
							<p className="inicio-saludo-label">{saludoInicio}</p>
							<h1 className="inicio-hero-nombre">{primerNombreSesion}</h1>
							<p className="inicio-hero-sub">{rol}&nbsp;·&nbsp;Gestiona tus solicitudes y radicados</p>
						</div>
						<div className="inicio-acciones">
							<button type="button" className="inicio-accion-card" onClick={() => { setRadicacionesVista('nueva'); setActiveSection('Radicaciones'); }}>
								<span className="inicio-accion-icon">
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
								</span>
								<span className="inicio-accion-label">Nueva solicitud</span>
								<span className="inicio-accion-desc">Crea un nuevo radicado de viático u otros</span>
							</button>
							<button type="button" className="inicio-accion-card" onClick={() => { setRadicacionesVista('misSolicitudes'); setActiveSection('Radicaciones'); }}>
								<span className="inicio-accion-icon">
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
								</span>
								<span className="inicio-accion-label">Mis radicaciones</span>
								<span className="inicio-accion-desc">Consulta y haz seguimiento a tus solicitudes</span>
							</button>
							{esAdmin ? (
								<button type="button" className="inicio-accion-card inicio-accion-card--admin" onClick={() => setActiveSection('Panel administrador')}>
									<span className="inicio-accion-icon">
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
									</span>
									<span className="inicio-accion-label">Panel admin</span>
									<span className="inicio-accion-desc">Gestiona usuarios, roles y configuración</span>
								</button>
							) : (
								<button type="button" className="inicio-accion-card" onClick={() => setActiveSection('Mi perfil')}>
									<span className="inicio-accion-icon">
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
									</span>
									<span className="inicio-accion-label">Mi perfil</span>
									<span className="inicio-accion-desc">Verifica tus datos y cuenta bancaria</span>
								</button>
							)}
						</div>
					</div>

					{/* ── Banner perfil pendiente ── */}
					{!perfilBannerDismissed && (
						<div className="profile-verify-banner">
							<span>👤 <strong>Completa tu perfil:</strong> verifica tus datos personales y cuenta bancaria para agilizar futuras solicitudes.</span>
							<div className="pv-actions">
								<button type="button" className="admin-primary-button" style={{ fontSize: 12, padding: '6px 14px' }}
									onClick={() => setActiveSection('Mi perfil')}>Ir a Mi perfil</button>
								<button type="button" className="admin-ghost-button" style={{ fontSize: 12, padding: '6px 10px' }}
									onClick={() => {
										setPerfilBannerDismissed(true);
										try { localStorage.setItem('payops:perfil:banner:' + (session?.usuario.correo ?? ''), '1'); } catch { /* ok */ }
									}}>✕</button>
							</div>
						</div>
					)}

					{/* ── Grid 2 columnas: seguimiento + recientes ── */}
					<div className="inicio-2col">
						<div className="inicio-2col-main">
							<SeguimientoRadicado />
						</div>
						<div className="inicio-2col-side">
							<InicioRecientes />
						</div>
					</div>

					{isComposeRadicadoOpen ? (
						<div className="mail-compose-overlay" role="dialog" aria-modal="true" aria-label="Redactar radicado">
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

								<form id="radicado-compose-form" className="admin-form mail-compose-form" onSubmit={handleCreateRadicado}>
									<input
										ref={composeAdjuntoInputRef}
										type="file"
										multiple
										className="mail-hidden-file-input"
										onChange={(event) => {
											const files = event.target.files;
											if (!files) {
												setComposeAdjuntos([]);
												return;
											}

											setComposeAdjuntos(Array.from(files).map((file) => file.name));
											event.target.value = '';
										}}
									/>
									<div className="mail-chip-field">
										<label className="mail-chip-label">Para</label>
										<div className="mail-chip-input-wrap">
											{composeParaDestinos.map((destino) => (
												<span key={destino} className="mail-chip">
													{destino}
													<button
														type="button"
														aria-label={`Quitar ${destino}`}
														onClick={() =>
															setComposeParaDestinos((prev) =>
																prev.filter((item) => item.toLowerCase() !== destino.toLowerCase()),
															)
														}
													>
														x
													</button>
												</span>
											))}
											<input
												ref={composeParaInputRef}
												type="text"
												className="mail-chip-input"
												placeholder="usuario o correo"
												value={composeParaInput}
												onChange={(event) => setComposeParaInput(event.target.value)}
												onKeyDown={(event) => manejarTeclaDestinos(event, 'para')}
												onBlur={agregarParaDesdeInput}
											/>
										</div>
										{usuariosSugeridosPara.length > 0 ? (
											<div className="mail-suggestions" role="listbox" aria-label="Usuarios sugeridos">
												{usuariosSugeridosPara.map((usuario) => (
													<button
														key={usuario.id}
														type="button"
														className="mail-suggestion-item"
														onMouseDown={(event) => {
															event.preventDefault();
															setComposeParaDestinos((prev) => agregarDestinoUnico(prev, usuario.nombreCompleto));
															setComposeParaInput('');
														}}
													>
														<strong>{usuario.nombreCompleto}</strong>
														<span>{usuario.correo}</span>
													</button>
												))}
											</div>
										) : null}
									</div>

									<div className="mail-chip-field">
										<label className="mail-chip-label">CC (opcional)</label>
										<div className="mail-chip-input-wrap">
											{composeCcDestinos.map((destino) => (
												<span key={destino} className="mail-chip">
													{destino}
													<button
														type="button"
														aria-label={`Quitar ${destino}`}
														onClick={() =>
															setComposeCcDestinos((prev) =>
																prev.filter((item) => item.toLowerCase() !== destino.toLowerCase()),
															)
														}
													>
														x
													</button>
												</span>
											))}
											<input
												type="text"
												className="mail-chip-input"
												placeholder="usuario o correo en copia"
												value={composeCcInput}
												onChange={(event) => setComposeCcInput(event.target.value)}
												onKeyDown={(event) => manejarTeclaDestinos(event, 'cc')}
												onBlur={agregarCcDesdeInput}
											/>
										</div>
										{usuariosSugeridosCc.length > 0 ? (
											<div className="mail-suggestions" role="listbox" aria-label="Usuarios sugeridos en copia">
												{usuariosSugeridosCc.map((usuario) => (
													<button
														key={usuario.id}
														type="button"
														className="mail-suggestion-item"
														onMouseDown={(event) => {
															event.preventDefault();
															setComposeCcDestinos((prev) => agregarDestinoUnico(prev, usuario.nombreCompleto));
															setComposeCcInput('');
														}}
													>
														<strong>{usuario.nombreCompleto}</strong>
														<span>{usuario.correo}</span>
													</button>
												))}
											</div>
										) : null}
									</div>

									{composeAdjuntos.length > 0 ? (
										<div className="mail-attachments-list">
											{composeAdjuntos.map((name) => (
												<span key={name} className="mail-chip">
													{name}
													<button
														type="button"
														aria-label={`Quitar ${name}`}
														onClick={() =>
															setComposeAdjuntos((prev) => prev.filter((item) => item !== name))
														}
													>
														x
													</button>
												</span>
											))}
										</div>
									) : null}
									<input
										type="text"
										className="mail-compose-subject"
										placeholder="Asunto / referencia unica"
										value={referenciaRadicado}
										onChange={(event) => setReferenciaRadicado(event.target.value)}
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
										<button type="button" className="mail-compose-close" onClick={() => setIsComposeRadicadoOpen(false)}>
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

			{activeSection === 'Panel administrador' && esAdmin ? (
				<section className="card-surface admin-panel admin-forms-panel">
					<div className="admin-panel-head">
						<div>
							<h3>Panel administrador</h3>
							<p>Centraliza los módulos de configuración administrativa.</p>
						</div>
						<button
							type="button"
							className="admin-refresh-button"
							onClick={() => {
								loadAdminData();
								setAdminMessage('Datos administrativos actualizados.');
							}}
							disabled={isLoadingAdminData}
						>
							{isLoadingAdminData ? 'Actualizando...' : 'Actualizar datos'}
						</button>
					</div>

					<div className="admin-kpi-grid">
						<article className="admin-kpi-card">
							<span>Usuarios totales</span>
							<strong>{usuarios.length}</strong>
						</article>
						<article className="admin-kpi-card">
							<span>Cuentas habilitadas</span>
							<strong>{totalUsuariosActivos}</strong>
						</article>
						<article className="admin-kpi-card">
							<span>Roles registrados</span>
							<strong>{roles.length}</strong>
						</article>
					</div>

					<div className="admin-module-nav" role="tablist" aria-label="Módulos administrativos">
						{(['Usuarios', 'Personal autorizado', 'Roles', 'Areas', 'Usuarios en linea', 'Configuracion', 'Config. Viáticos', 'Config. Cuenta de Cobro', 'Config. Legalización', 'Historial', 'Informes OPS'] as AdminModule[]).map((module) => (
							<button
								key={module}
								type="button"
								className={`admin-module-item${activeAdminModule === module ? ' active' : ''}`}
								onClick={() => {
									setActiveAdminModule(module);
									setAdminMessage('');
									setAdminError('');
								}}
							>
								{module}
							</button>
						))}
					</div>

					{adminMessage ? <div className="admin-success">{adminMessage}</div> : null}
					{adminError ? <div className="admin-error">{adminError}</div> : null}

					<div className="admin-form-grid">
							{activeAdminModule === 'Usuarios' ? (
							<>
									{canCrearUsuarios ? (
									<form className="admin-form card-surface" onSubmit={handleCreateUser}>
										<h4>{editingUserId ? 'Modificar usuario' : 'Creación de usuario'}</h4>
										{editingUserId ? (
											<div className="admin-inline-actions">
												<button
													type="button"
													className="admin-ghost-button"
													onClick={limpiarFormularioUsuario}
												>
													Cancelar edición
												</button>
											</div>
										) : null}
									<div className="admin-user-form-grid">
										<input
											type="text"
											placeholder="Primer nombre"
											value={userPrimerNombre}
											onChange={(event) => setUserPrimerNombre(event.target.value)}
											required
										/>
										<input
											type="text"
											placeholder="Segundo nombre"
											value={userSegundoNombre}
											onChange={(event) => setUserSegundoNombre(event.target.value)}
										/>
										<input
											type="text"
											placeholder="Primer apellido"
											value={userPrimerApellido}
											onChange={(event) => setUserPrimerApellido(event.target.value)}
											required
										/>
										<input
											type="text"
											placeholder="Segundo apellido"
											value={userSegundoApellido}
											onChange={(event) => setUserSegundoApellido(event.target.value)}
										/>
										<select
											value={userTipoDocumento}
											onChange={(event) => setUserTipoDocumento(event.target.value)}
											required
										>
											<option value="CC">Cédula de ciudadanía (CC)</option>
											<option value="CE">Cédula de extranjería (CE)</option>
											<option value="TI">Tarjeta de identidad (TI)</option>
											<option value="PP">Pasaporte (PP)</option>
											<option value="NIT">NIT</option>
										</select>
										<input
											type="text"
											placeholder="Número de documento"
											value={userNumeroDocumento}
											onChange={(event) => setUserNumeroDocumento(event.target.value)}
											required
										/>
										<input
											type="email"
											placeholder="Correo corporativo"
											value={userCorreoCorporativo}
											onChange={(event) => setUserCorreoCorporativo(event.target.value)}
											required
										/>
									</div>
									<input
										type="password"
										placeholder={editingUserId ? 'Nueva contraseña (opcional)' : 'Contraseña temporal automática'}
										value={userPassword}
										onChange={(event) => setUserPassword(event.target.value)}
										minLength={8}
										required={false}
									/>
									<select
										value={userRolId}
										onChange={(event) => setUserRolId(Number(event.target.value))}
										required
									>
										<option value="" disabled>
											Selecciona un rol
										</option>
										{roles.map((roleItem) => (
											<option key={roleItem.id} value={roleItem.id}>
												{roleItem.nombre}
											</option>
										))}
									</select>
									<select
										value={userAreaId}
										onChange={(event) => setUserAreaId(event.target.value === '' ? '' : Number(event.target.value))}
									>
										<option value="">Sin area institucional</option>
										{areasUsuarios.map((a) => (
											<option key={a.id} value={a.id}>{a.nombre}</option>
										))}
									</select>
									<select
										value={userNivelAprobacion}
										onChange={(event) => setUserNivelAprobacion(event.target.value)}
									>
										<option value="">Sin nivel de aprobacion</option>
										<option value="analista">Analista del area</option>
										<option value="coordinador">Coordinador</option>
										<option value="director">Director</option>
										<option value="contabilidad">Contabilidad</option>
									</select>
									{editingUserId ? (
										<>
											<p className="admin-help-text" style={{ margin: '8px 0 2px', fontWeight: 600, fontSize: 12 }}>Datos personales y bancarios</p>
											<input
												type="email"
												placeholder="Correo personal"
												value={userCorreoPersonal}
												onChange={(e) => setUserCorreoPersonal(e.target.value)}
											/>
											<input
												type="text"
												placeholder="Banco"
												value={userBanco}
												onChange={(e) => setUserBanco(e.target.value)}
											/>
											<select
												value={userTipoCuenta}
												onChange={(e) => setUserTipoCuenta(e.target.value)}
											>
												<option value="">Tipo de cuenta</option>
												<option value="ahorros">Ahorros</option>
												<option value="corriente">Corriente</option>
											</select>
											<input
												type="text"
												placeholder="Número de cuenta"
												value={userNumeroCuenta}
												onChange={(e) => setUserNumeroCuenta(e.target.value)}
											/>
											<input
												type="text"
												placeholder="Titular de la cuenta"
												value={userTitularCuenta}
												onChange={(e) => setUserTitularCuenta(e.target.value)}
											/>
										</>
									) : null}
										<button type="submit" className="admin-primary-button">
											{editingUserId ? 'Guardar cambios' : 'Crear usuario'}
										</button>
									</form>
									) : (
										<aside className="admin-side-list card-surface">
											<h4>Usuarios</h4>
											<p>No tienes permiso para crear o modificar usuarios.</p>
										</aside>
									)}

								<aside className="admin-side-list card-surface">
									<div className="admin-user-list-head">
										<h4>Usuarios ({usuarios.length})</h4>
										<p className="admin-help-text">El estado refleja si la cuenta está habilitada, no si tiene sesión activa.</p>
									</div>
									<div className="admin-user-search-wrap">
										<input
											type="search"
											className="admin-input admin-user-search"
											placeholder="Buscar por nombre, correo o rol…"
											value={userSearch}
											onChange={(e) => setUserSearch(e.target.value)}
										/>
									</div>
									{usuariosFiltrados.length === 0 ? (
										<p className="admin-help-text" style={{ margin: '12px 0 0' }}>
											{userSearch ? 'Sin resultados para esa búsqueda.' : 'No hay usuarios creados aún.'}
										</p>
									) : (
										<ul>
											{usuariosFiltrados.map((usuario) => (
												<li key={usuario.id} className="admin-user-list-item">
													<div className="admin-user-info">
														<strong>{usuario.nombreCompleto}</strong>
														<span>{usuario.correo}</span>
														<span className="admin-user-meta">{usuario.rol?.nombre || 'Sin rol'}</span>
													</div>
													<div className="admin-user-status-row">
														<span className={`status-pill ${usuario.activo ? 'on' : 'off'}`}>
															{usuario.activo ? 'Habilitado' : 'Pendiente'}
														</span>
													</div>
													<div className="admin-user-actions">
														<button type="button" className="admin-ghost-button"
															onClick={() => iniciarEdicionUsuario(usuario)} disabled={!canCrearUsuarios}>
															Modificar
														</button>
														<button type="button" className="admin-ghost-button"
															disabled={usuario.rol.nombre.trim().toLowerCase() === 'administrador'}
															onClick={() => abrirPermisosUsuario(usuario)}>
															Permisos
														</button>
														<button type="button" className="admin-ghost-button"
															onClick={() => enviarRestablecimientoUsuario(usuario)}>
															Restablecer
														</button>
														{usuario.activo ? (
															<button type="button" className="admin-ghost-button"
																disabled={!canCrearUsuarios} onClick={() => cambiarEstadoUsuario(usuario)}>
																Desactivar
															</button>
														) : (
															<>
																<button type="button" className="admin-ghost-button"
																	disabled={!canCrearUsuarios} onClick={() => cambiarEstadoUsuario(usuario)}>
																	Aprobar
																</button>
																<button type="button" className="admin-ghost-button admin-role-delete"
																	disabled={!canCrearUsuarios} onClick={() => eliminarUsuario(usuario)}>
																	Rechazar
																</button>
															</>
														)}
													</div>
												</li>
											))}
										</ul>
									)}
								</aside>
							</>
						) : null}

							{activeAdminModule === 'Roles' ? (
							<>
									{canCrearRoles ? (
									<form className="admin-form card-surface admin-role-form" onSubmit={handleCreateRole}>
									<div className="admin-role-head">
										<h4>{editingRoleId ? 'Modificar rol' : 'Gestión de roles'}</h4>
										<p>Define perfiles con permisos institucionales claros.</p>
									</div>
									{editingRoleId ? (
										<div className="admin-inline-actions">
											<button type="button" className="admin-ghost-button" onClick={limpiarFormularioRol}>
												Cancelar edición
											</button>
										</div>
									) : null}
									<input
										type="text"
										placeholder="Nombre del rol"
										value={roleNombre}
										onChange={(event) => setRoleNombre(event.target.value)}
										required
									/>
									<input
										type="text"
										placeholder="Descripción"
										value={roleDescripcion}
										onChange={(event) => setRoleDescripcion(event.target.value)}
									/>
									<div className="role-permissions-builder">
										<h5>Permisos por módulo</h5>
										{Object.entries(ROLE_PERMISSIONS_CATALOG).map(([moduloKey, modulo]) => (
											<div key={moduloKey} className="role-permissions-module">
												<strong>{modulo.label}</strong>
												<div className="role-permissions-grid">
													{modulo.permissions.map((permission) => {
														const id = `${moduloKey}.${permission.key}`;
														const checked = (rolePermisos[moduloKey] || []).includes(permission.key);

														return (
															<label key={id} htmlFor={id} className="role-permission-item">
																<input
																	id={id}
																	type="checkbox"
																	checked={checked}
																	onChange={() => toggleRolePermiso(moduloKey, permission.key)}
																/>
																<span>{permission.label}</span>
															</label>
														);
													})}
												</div>
											</div>
										))}
									</div>
									<button type="submit" className="admin-primary-button admin-role-submit-button">
										{editingRoleId ? 'Guardar cambios del rol' : 'Crear rol'}
									</button>
									</form>
									) : (
										<aside className="admin-side-list card-surface">
											<h4>Roles</h4>
											<p>No tienes permiso para crear roles.</p>
										</aside>
									)}

								<aside className="admin-side-list card-surface admin-role-catalog">
									<h4>Catálogo de roles</h4>
									{roles.length === 0 ? (
										<p>No hay roles registrados.</p>
									) : (
										<ul>
											{roles.map((roleItem) => (
												<li key={roleItem.id} className="admin-role-item">
													<div>
														<strong>{roleItem.nombre}</strong>
														<span>{roleItem.descripcion || 'Sin descripción'}</span>
														<span className="admin-user-meta">ID #{roleItem.id}</span>
														<span className="admin-user-meta">
															Permisos: {contarPermisosRole(roleItem)}
														</span>
													</div>
													<span className={`status-pill ${roleItem.activo ? 'on' : 'off'}`}>
														{roleItem.activo ? 'Activo' : 'Inactivo'}
													</span>
													<button
														type="button"
														className="admin-ghost-button"
														disabled={!canCrearRoles}
														onClick={() => iniciarEdicionRol(roleItem)}
													>
														Modificar
													</button>
													<button
														type="button"
														className="admin-ghost-button"
														disabled={!canCrearRoles || roleItem.nombre.toLowerCase() === 'administrador'}
														onClick={() => cambiarEstadoRol(roleItem)}
													>
														{roleItem.activo ? 'Desactivar' : 'Activar'}
													</button>
													<button
														type="button"
														className="admin-ghost-button admin-role-delete"
														disabled={!canCrearRoles || roleItem.nombre.toLowerCase() === 'administrador'}
														onClick={() => eliminarRol(roleItem)}
													>
														Eliminar
													</button>
												</li>
											))}
										</ul>
									)}
								</aside>
							</>
						) : null}

						{activeAdminModule === 'Personal autorizado' ? (
							<PersonalAutorizadoPanel areas={areasUsuarios} />
						) : null}

						{activeAdminModule === 'Areas' ? (
							<AreasPanel />
						) : null}

						{activeAdminModule === 'Configuracion' ? (
							<ConfiguracionSmtpPanel />
						) : null}

						{activeAdminModule === 'Config. Viáticos' ? (
							<ConfigViaticosPanel />
						) : null}

						{activeAdminModule === 'Config. Cuenta de Cobro' ? (
							<ConfigCuentaCobroPanel />
						) : null}

						{activeAdminModule === 'Config. Legalización' ? (
							<ConfigLegalizacionPanel />
						) : null}

						{activeAdminModule === 'Historial' ? (
							<HistorialPanel />
						) : null}

						{activeAdminModule === 'Informes OPS' ? (
							<InformesOpsPanel
								onMsg={(m) => setAdminMessage(m)}
								onErr={(e) => setAdminError(e)}
							/>
						) : null}

						{activeAdminModule === 'Usuarios' && canCrearUsuarios ? (
							<BulkCreatePanel
								roles={roles}
								areas={areasUsuarios}
								onResult={(creados, errores) => {
									setAdminMessage(`Carga masiva: ${creados} creados, ${errores} errores.`);
									loadAdminData();
								}}
								onError={setAdminError}
							/>
						) : null}

						{activeAdminModule === 'Usuarios en linea' ? (
							<>
								<aside className="admin-side-list card-surface online-users-panel">
									<h4>Usuarios en línea</h4>
									<p className="admin-help-text">Sesiones activas detectadas en esta instancia.</p>
									{usuariosEnLinea.length === 0 ? (
										<p>No hay usuarios en línea en este momento.</p>
									) : (
										<ul>
											{usuariosEnLinea.map((usuario) => (
												<li key={usuario.id}>
													<div>
														<strong>{usuario.nombreCompleto}</strong>
														<span>{usuario.correo}</span>
														<span className="admin-user-meta">{usuario.rol?.nombre || 'Sin rol'}</span>
													</div>
													<span className="status-pill on">En línea</span>
												</li>
											))}
										</ul>
									)}
								</aside>

								<aside className="admin-side-list card-surface">
									<h4>Monitoreo rápido</h4>
									<p>
										La visualización de usuarios en línea toma como referencia la sesión activa del
										navegador actual.
									</p>
								</aside>
							</>
						) : null}
					</div>
				</section>
			) : null}

			{activeSection === 'Radicaciones' ? <RadicacionesModule vistaInicial={radicacionesVista} solicitudId={solicitudAbierta} /> : null}

			{activeSection === 'Mi perfil' ? (
				<>
					<ProfilePanel />
					<div className="profile-logout-mobile">
						<div className="profile-logout-info">
							<span className="profile-logout-rol">Rol: {session?.usuario.rol.nombre}</span>
						</div>
						<button type="button" className="profile-logout-btn" onClick={handleLogout}>
							Cerrar sesión
						</button>
					</div>
				</>
			) : null}

			{isUserPermisosOpen && usuarioPermisosObjetivo ? (
				<div className="admin-permissions-overlay" role="dialog" aria-modal="true" aria-label="Permisos de usuario">
					<div className="admin-permissions-modal card-surface">
						<div className="admin-role-head">
							<h4>Permisos adicionales de usuario</h4>
							<p>
								{usuarioPermisosObjetivo.nombreCompleto} · Rol base: {usuarioPermisosObjetivo.rol.nombre}
							</p>
						</div>

						<div className="role-permissions-builder">
							{Object.entries(ROLE_PERMISSIONS_CATALOG).map(([moduloKey, modulo]) => (
								<div key={moduloKey} className="role-permissions-module">
									<strong>{modulo.label}</strong>
									<div className="role-permissions-grid">
										{modulo.permissions.map((permission) => {
											const id = `user.${usuarioPermisosObjetivo.id}.${moduloKey}.${permission.key}`;
											const checked = (usuarioPermisosDraft[moduloKey] || []).includes(permission.key);

											return (
												<label key={id} htmlFor={id} className="role-permission-item">
													<input
														id={id}
														type="checkbox"
														checked={checked}
														onChange={() => toggleUsuarioPermiso(moduloKey, permission.key)}
													/>
													<span>{permission.label}</span>
												</label>
											);
										})}
									</div>
								</div>
							))}
						</div>

						<div className="admin-permissions-actions">
							<button type="button" className="admin-ghost-button" onClick={cerrarPermisosUsuario}>
								Cancelar
							</button>
							<button type="button" className="admin-primary-button" onClick={guardarPermisosUsuario}>
								Guardar permisos
							</button>
						</div>
					</div>
				</div>
			) : null}

			{activeSection !== 'Inicio' && activeSection !== 'Panel administrador' && activeSection !== 'Radicaciones' && activeSection !== 'Mi perfil' ? (
				<section className="card-surface module-card">
					<h3>{activeSection}</h3>
					<p>Vista en construcción. Este módulo se conectará en el siguiente paso.</p>
				</section>
			) : null}
		</AppLayout>
		</>
	);
}
