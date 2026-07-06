import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotificacionesPayops } from '../../hooks/useNotificacionesPayops';

interface SidebarProps {
	esAdmin: boolean;
	activeSection: string;
	onSelectSection: (section: string) => void;
	currentUser: string;
}

const SEEN_KEY = 'payops:notif:seen';

function getSeenIds(): Set<number> {
	try {
		const raw = localStorage.getItem(SEEN_KEY);
		if (!raw) return new Set();
		const arr = JSON.parse(raw);
		return Array.isArray(arr) ? new Set(arr) : new Set();
	} catch {
		return new Set();
	}
}

function setSeenIds(ids: number[]) {
	try {
		localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-100)));
	} catch {
		// ignorar
	}
}

export function Sidebar({ esAdmin, activeSection, onSelectSection }: SidebarProps) {
	const [showNotifications, setShowNotifications] = useState(false);
	const [movilAbierto, setMovilAbierto] = useState(false);
	const notificationsRef = useRef<HTMLDivElement | null>(null);
	const { items } = useNotificacionesPayops();
	const [seenIds, setSeenIdsState] = useState<Set<number>>(() => getSeenIds());

	const menuItems = esAdmin
		? ['Inicio', 'Radicaciones', 'Panel administrador']
		: ['Inicio', 'Radicaciones'];

	const unread = items.filter((n) => !seenIds.has(n.id));

	useEffect(() => {
		if (!showNotifications) return;
		const allIds = items.map((n) => n.id);
		const merged = new Set([...seenIds, ...allIds]);
		setSeenIdsState(merged);
		setSeenIds(Array.from(merged));
	}, [showNotifications, items]);

	useEffect(() => {
		function handleOutsideClick(event: MouseEvent) {
			const target = event.target as HTMLElement;
			if (!target) return;
			if (notificationsRef.current?.contains(target)) return;
			if (target.closest('.admin-notifications-panel')) return;
			setShowNotifications(false);
		}
		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	}, []);

	function seleccionar(item: string) {
		onSelectSection(item);
		setMovilAbierto(false);
	}

	return (
		<>
			{/* Barra superior en móvil con hamburger */}
			<div className="admin-movil-topbar">
				<button
					type="button"
					className="admin-movil-hamburger"
					onClick={() => setMovilAbierto(true)}
					aria-label="Abrir menú"
				>
					☰
				</button>
				<span className="admin-movil-topbar-seccion">{activeSection}</span>
			</div>

			{/* Overlay oscuro */}
			{movilAbierto ? (
				<div
					className="admin-nav-overlay"
					role="presentation"
					onClick={() => setMovilAbierto(false)}
				/>
			) : null}

			{/* Sidebar */}
			<aside className={`admin-sidebar${movilAbierto ? ' movil-abierto' : ''}`}>
				<div className="admin-sidebar-brand-wrap">
					<div className="admin-sidebar-brand">PAYOPS</div>

					{/* Botón cerrar — solo visible en móvil */}
					<button
						type="button"
						className="admin-sidebar-cerrar"
						onClick={() => setMovilAbierto(false)}
						aria-label="Cerrar menú"
					>
						✕
					</button>

					<div className="admin-notifications" ref={notificationsRef}>
						<button
							type="button"
							className="admin-bell-button"
							onClick={() => setShowNotifications((current) => !current)}
							aria-label="Notificaciones"
							aria-expanded={showNotifications}
						>
							<span className="admin-bell-icon" aria-hidden="true">🔔</span>
							{unread.length > 0 ? <span className="admin-bell-count">{unread.length}</span> : null}
						</button>

						{showNotifications ? createPortal(
							<div
								className="admin-notifications-panel"
								role="status"
								aria-live="polite"
								ref={(el) => {
									if (!el) return;
									const btn = notificationsRef.current?.querySelector('.admin-bell-button') as HTMLElement | null;
									if (btn) {
										const r = btn.getBoundingClientRect();
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
									<button
										type="button"
										className="admin-notif-panel-cerrar"
										onClick={() => setShowNotifications(false)}
										aria-label="Cerrar notificaciones"
									>✕</button>
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
						) : null}
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
			</aside>
		</>
	);
}
