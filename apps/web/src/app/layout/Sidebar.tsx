import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotificacionesPayops } from '../../hooks/useNotificacionesPayops';

interface SidebarProps {
	esAdmin: boolean;
	activeSection: string;
	onSelectSection: (section: string) => void;
	onNavigateRadicaciones?: (vista: 'nueva' | 'misSolicitudes' | 'bandeja' | 'tablero') => void;
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

function NavIcon({ item }: { item: string }) {
	const s = 22;
	if (item === 'Inicio') return (
		<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
		</svg>
	);
	if (item === 'Radicaciones') return (
		<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
		</svg>
	);
	if (item === 'Panel administrador') return (
		<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
		</svg>
	);
	if (item === 'Mi perfil') return (
		<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
		</svg>
	);
	return <span style={{ fontSize: 18, lineHeight: 1 }}>●</span>;
}

export function Sidebar({ esAdmin, activeSection, onSelectSection, onNavigateRadicaciones, currentUser, rol, onLogout }: SidebarProps) {
	const [showNotifications, setShowNotifications] = useState(false);
	const [movilAbierto, setMovilAbierto] = useState(false);
	const notificationsRef = useRef<HTMLDivElement | null>(null);
	const bellMovilRef = useRef<HTMLButtonElement | null>(null);
	const { items } = useNotificacionesPayops();
	const [seenIds, setSeenIdsState] = useState<Set<number>>(() => getSeenIds());
	// IDs que eran nuevos justo al abrir el panel (para marcarlos visualmente en la lista)
	const [newAtOpen, setNewAtOpen] = useState<Set<number>>(new Set());

	const menuItems = esAdmin
		? ['Inicio', 'Radicaciones', 'Panel administrador', 'Mi perfil']
		: ['Inicio', 'Radicaciones', 'Mi perfil'];

	const unread = items.filter((n) => !seenIds.has(n.id));

	useEffect(() => {
		if (!showNotifications) return;
		// Captura los IDs no vistos antes de marcarlos como vistos
		const currentUnread = new Set(items.filter((n) => !seenIds.has(n.id)).map((n) => n.id));
		setNewAtOpen(currentUnread);
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

	function irASolicitud(n: ReturnType<typeof useNotificacionesPayops>['items'][number]) {
		setShowNotifications(false);
		if (onNavigateRadicaciones) {
			onNavigateRadicaciones(n.vista);
		} else {
			onSelectSection('Radicaciones');
		}
	}

	const panelNotif = showNotifications ? createPortal(
		<div
			className="admin-notifications-panel"
			role="dialog"
			aria-label="Notificaciones"
			ref={(el) => {
				if (!el) return;
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
						{items.map((n) => {
							const esNueva = newAtOpen.has(n.id);
							return (
								<li key={n.id}>
									<button
										type="button"
										className={`notif-item notif-${n.tipo}${esNueva ? ' notif-nueva' : ' notif-vista'}`}
										onClick={() => irASolicitud(n)}
									>
										{esNueva && <span className="notif-dot" aria-label="Nueva" />}
										<div className="notif-titulo">{n.titulo}</div>
										<div className="notif-detalle">{n.detalle}</div>
										<div className="notif-rad">{n.numeroRadicado}</div>
										<div className="notif-cta">Ver solicitud →</div>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>,
		document.body
	) : null;

	/* ── Topbar móvil: campana | PAYOPS | perfil ── */
	const topbarMovil = createPortal(
		<div className="admin-movil-topbar">
			<button
				ref={bellMovilRef}
				type="button"
				className={`admin-movil-topbar-btn${unread.length > 0 ? ' has-notif' : ''}`}
				onClick={abrirNotif}
				aria-label="Notificaciones"
			>
				<svg className="admin-movil-bell-svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
					<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
				</svg>
				{unread.length > 0 && (
					<span className="admin-movil-bell-badge">{unread.length}</span>
				)}
			</button>

			<span className="admin-movil-brand">PAYOPS</span>

			<button
				type="button"
				className="admin-movil-topbar-btn"
				onClick={() => seleccionar('Mi perfil')}
				aria-label="Mi perfil"
				title={currentUser}
			>
				<span className="admin-movil-avatar">{(currentUser?.[0] || 'U').toUpperCase()}</span>
			</button>
		</div>,
		document.body
	);

	/* ── Bottom nav móvil ── */
	const bottomNav = createPortal(
		<nav className="admin-bottom-nav" aria-label="Navegación">
			{menuItems.map((item) => (
				<button
					key={item}
					type="button"
					className={`admin-bottom-nav-item${activeSection === item ? ' active' : ''}`}
					onClick={() => seleccionar(item)}
				>
					<span className="admin-bottom-nav-icon"><NavIcon item={item} /></span>
					<span className="admin-bottom-nav-label">
						{item === 'Panel administrador' ? 'Admin' : item}
					</span>
				</button>
			))}
		</nav>,
		document.body
	);

	return (
		<>
			{/* Topbar + bottom nav — solo en móvil, controlado por CSS */}
			{topbarMovil}
			{bottomNav}

			{/* Overlay para tablet drawer */}
			{movilAbierto ? (
				<div className="admin-nav-overlay" role="presentation" onClick={() => setMovilAbierto(false)} />
			) : null}

			{/* ═══ SIDEBAR — desktop y tablet drawer ═══ */}
			<aside className={`admin-sidebar${movilAbierto ? ' movil-abierto' : ''}`}>

				<div className="admin-sidebar-brand-wrap">
					<div className="admin-sidebar-brand">PAYOPS</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<div className="admin-notifications admin-desktop-notif" ref={notificationsRef}>
							<button
								type="button"
								className={`admin-bell-button${unread.length > 0 ? ' has-notif' : ''}`}
								onClick={() => setShowNotifications((v) => !v)}
								aria-label={`Notificaciones${unread.length > 0 ? ` (${unread.length} nuevas)` : ''}`}
							>
								<svg className={`admin-bell-svg${unread.length > 0 ? ' admin-bell-ringing' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
									<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
									<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
								</svg>
								{unread.length > 0 ? <span className="admin-bell-count">{unread.length > 9 ? '9+' : unread.length}</span> : null}
							</button>
						</div>
						<button type="button" className="admin-sidebar-cerrar" onClick={() => setMovilAbierto(false)}>✕</button>
					</div>
				</div>

				<div className="admin-drawer-usuario">
					<div className="admin-drawer-avatar">
						{(currentUser?.[0] || 'U').toUpperCase()}
					</div>
					<div>
						<div className="admin-drawer-nombre">{currentUser}</div>
						{rol ? <div className="admin-drawer-rol">{rol}</div> : null}
					</div>
				</div>

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
