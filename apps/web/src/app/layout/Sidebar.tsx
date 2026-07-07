import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotificacionesPayops } from '../../hooks/useNotificacionesPayops';

interface SidebarProps {
	esAdmin: boolean;
	activeSection: string;
	onSelectSection: (section: string) => void;
	currentUser: string;
	rol?: string;
	onLogout?: () => void;
}

const SEEN_KEY = 'payops:notif:seen';

function getSeenIds(): Set<number> {
	try {
		const raw = localStorage.getItem(SEEN_KEY);
		if (!raw) return new Set();
		const arr = JSON.parse(raw);
		return Array.isArray(arr) ? new Set(arr) : new Set();
	} catch { return new Set(); }
}

function setSeenIds(ids: number[]) {
	try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-100))); } catch { /* ok */ }
}

export function Sidebar({ esAdmin, activeSection, onSelectSection, currentUser, rol, onLogout }: SidebarProps) {
	const [showNotifications, setShowNotifications] = useState(false);
	const [movilAbierto, setMovilAbierto] = useState(false);
	const notificationsRef = useRef<HTMLDivElement | null>(null);
	const bellMovilRef = useRef<HTMLButtonElement | null>(null);
	const { items } = useNotificacionesPayops();
	const [seenIds, setSeenIdsState] = useState<Set<number>>(() => getSeenIds());

	const menuItems = esAdmin
		? ['Inicio', 'Radicaciones', 'Panel administrador', 'Mi perfil']
		: ['Inicio', 'Radicaciones', 'Mi perfil'];

	const unread = items.filter((n) => !seenIds.has(n.id));

	useEffect(() => {
		if (!showNotifications) return;
		const allIds = items.map((n) => n.id);
		const merged = new Set([...seenIds, ...allIds]);
		setSeenIdsState(merged);
		setSeenIds(Array.from(merged));
	}, [showNotifications, items]);

	useEffect(() => {
		function handleOutside(event: MouseEvent) {
			const target = event.target as HTMLElement;
			if (!target) return;
			if (notificationsRef.current?.contains(target)) return;
			if (bellMovilRef.current?.contains(target)) return;
			if (target.closest('.admin-notifications-panel')) return;
			setShowNotifications(false);
		}
		document.addEventListener('mousedown', handleOutside);
		return () => document.removeEventListener('mousedown', handleOutside);
	}, []);

	function seleccionar(item: string) { onSelectSection(item); setMovilAbierto(false); }

	function abrirNotif(e: React.MouseEvent<HTMLButtonElement>) {
		e.stopPropagation();
		setShowNotifications((v) => !v);
	}

	const panelNotif = showNotifications ? createPortal(
		<div
			className="admin-notifications-panel"
			role="status"
			aria-live="polite"
			ref={(el) => {
				if (!el) return;
				// Usar el bell visible (topbar en móvil, o sidebar en desktop)
				const btn = bellMovilRef.current ?? notificationsRef.current?.querySelector('.admin-bell-button') as HTMLElement | null;
				if (btn) {
					const r = (btn as HTMLElement).getBoundingClientRect();
					const vw = window.innerWidth;
					const panelW = Math.min(360, vw - 32);
					const rawLeft = Math.max(12, r.left);
					const left = Math.min(rawLeft, vw - panelW - 12);
					el.style.top = `${r.bottom + 10}px`;
					el.style.left = `${left}px`;
					el.style.width = `${panelW}px`;
				}
			}}
		>
			<div className="admin-notif-panel-head">
				<h4>Notificaciones</h4>
				<button type="button" className="admin-notif-panel-cerrar" onClick={() => setShowNotifications(false)}>✕</button>
			</div>
			<div className="admin-notif-panel-body">
				{items.length === 0 ? (
					<div className="admin-notif-vacio">
						<span className="admin-notif-vacio-icon">📭</span>
						<p>Sin notificaciones por el momento.</p>
					</div>
				) : (
					<ul>
						{items.map((n) => (
							<li key={n.id} className={`notif-item notif-${n.tipo}`}>
								<div className="notif-titulo">{n.titulo}</div>
								<div className="notif-detalle">{n.detalle}</div>
								<div className="notif-rad">{n.numeroRadicado}</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>,
		document.body
	) : null;

	const topbarPortal = createPortal(
		<div className="admin-movil-topbar">
			<button
				type="button"
				className="admin-movil-hamburger"
				onClick={() => setMovilAbierto(true)}
				aria-label="Abrir menú"
			>
				☰
			</button>
			<span className="admin-movil-brand">PAYOPS</span>
			<span className="admin-movil-sep">·</span>
			<span className="admin-movil-modulo">{activeSection}</span>
			<button
				ref={bellMovilRef}
				type="button"
				className="admin-movil-bell"
				onClick={abrirNotif}
				aria-label="Notificaciones"
			>
				🔔
				{unread.length > 0 ? (
					<span className="admin-movil-bell-badge">{unread.length}</span>
				) : null}
			</button>
		</div>,
		document.body
	);

	return (
		<>
			{topbarPortal}

			{/* Overlay */}
			{movilAbierto ? (
				<div className="admin-nav-overlay" role="presentation" onClick={() => setMovilAbierto(false)} />
			) : null}

			{/* ═══ SIDEBAR / DRAWER ═══ */}
			<aside className={`admin-sidebar${movilAbierto ? ' movil-abierto' : ''}`}>

				{/* Header del drawer (solo en móvil) */}
				<div className="admin-sidebar-brand-wrap">
					<div className="admin-sidebar-brand">PAYOPS</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						{/* Bell en desktop sidebar */}
						<div className="admin-notifications admin-desktop-notif" ref={notificationsRef}>
							<button
								type="button"
								className="admin-bell-button"
								onClick={() => setShowNotifications((v) => !v)}
								aria-label="Notificaciones"
							>
								<span className="admin-bell-icon">🔔</span>
								{unread.length > 0 ? <span className="admin-bell-count">{unread.length}</span> : null}
							</button>
						</div>
						{/* Botón cerrar drawer (solo móvil) */}
						<button type="button" className="admin-sidebar-cerrar" onClick={() => setMovilAbierto(false)}>✕</button>
					</div>
				</div>

				{/* Info de usuario en el drawer (solo visible en móvil) */}
				<div className="admin-drawer-usuario">
					<div className="admin-drawer-avatar">
						{(currentUser?.[0] || 'U').toUpperCase()}
					</div>
					<div>
						<div className="admin-drawer-nombre">{currentUser}</div>
						{rol ? <div className="admin-drawer-rol">{rol}</div> : null}
					</div>
				</div>

				{/* Nav items */}
				<nav className="admin-sidebar-nav" aria-label="Navegación principal">
					{menuItems.map((item) => (
						<button
							key={item}
							type="button"
							className={`admin-nav-item${activeSection === item ? ' active' : ''}`}
							onClick={() => seleccionar(item)}
						>
							{item}
						</button>
					))}
				</nav>

				{/* Cerrar sesión en el drawer (solo móvil) */}
				{onLogout ? (
					<button
						type="button"
						className="admin-drawer-logout"
						onClick={() => { setMovilAbierto(false); onLogout(); }}
					>
						⏏ Cerrar sesión
					</button>
				) : null}
			</aside>

			{panelNotif}
		</>
	);
}
