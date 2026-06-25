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
	const notificationsRef = useRef<HTMLDivElement | null>(null);
	const { items } = useNotificacionesPayops();
	const [seenIds, setSeenIdsState] = useState<Set<number>>(() => getSeenIds());

	const menuItems = esAdmin
		? ['Inicio', 'Radicaciones', 'Legalizaciones', 'Panel administrador']
		: ['Inicio', 'Radicaciones', 'Legalizaciones'];

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
			// Click dentro del bell o dentro del panel (que vive en document.body)
			if (notificationsRef.current?.contains(target)) return;
			if (target.closest('.admin-notifications-panel')) return;
			setShowNotifications(false);
		}
		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	}, []);

	return (
		<aside className="admin-sidebar">
			<div className="admin-sidebar-brand-wrap">
				<div className="admin-sidebar-brand">PAYOPS</div>
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
							className="admin-notifications-panel card-surface"
							role="status"
							aria-live="polite"
							ref={(el) => {
								if (!el) return;
								// Posicionar relativo al bell button
								const btn = notificationsRef.current?.querySelector('.admin-bell-button') as HTMLElement | null;
								if (btn) {
									const r = btn.getBoundingClientRect();
									el.style.top = `${r.bottom + 8}px`;
									el.style.left = `${Math.max(12, r.left)}px`;
								}
							}}
						>
							<h4>Notificaciones</h4>
							{items.length === 0 ? (
								<p>Sin notificaciones por el momento.</p>
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
						onClick={() => onSelectSection(item)}
					>
						{item}
					</button>
				))}
			</nav>
		</aside>
	);
}
