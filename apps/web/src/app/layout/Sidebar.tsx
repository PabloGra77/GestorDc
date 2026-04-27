import { useEffect, useMemo, useRef, useState } from 'react';
import {
	getChatUpdateEventName,
	getUnreadIncomingMessages,
	markIncomingNotificationsAsSeen,
} from './requestsChatStore';

interface SidebarProps {
	esAdmin: boolean;
	activeSection: string;
	onSelectSection: (section: string) => void;
	currentUser: string;
}

export function Sidebar({ esAdmin, activeSection, onSelectSection, currentUser }: SidebarProps) {
	const [showNotifications, setShowNotifications] = useState(false);
	const [notificationTick, setNotificationTick] = useState(0);
	const notificationsRef = useRef<HTMLDivElement | null>(null);
	const menuItems = esAdmin
		? ['Inicio', 'Radicaciones', 'Panel administrador']
		: ['Inicio', 'Radicaciones'];

	const pendingNotifications = useMemo(
		() => getUnreadIncomingMessages(currentUser),
		[currentUser, notificationTick],
	);

	useEffect(() => {
		const syncNotifications = () => setNotificationTick((current) => current + 1);

		window.addEventListener('storage', syncNotifications);
		window.addEventListener(getChatUpdateEventName(), syncNotifications);

		return () => {
			window.removeEventListener('storage', syncNotifications);
			window.removeEventListener(getChatUpdateEventName(), syncNotifications);
		};
	}, []);

	useEffect(() => {
		if (!showNotifications) {
			return;
		}

		markIncomingNotificationsAsSeen(currentUser);
		setNotificationTick((current) => current + 1);
	}, [showNotifications, currentUser]);

	useEffect(() => {
		function handleOutsideClick(event: MouseEvent) {
			if (!notificationsRef.current) {
				return;
			}

			if (!notificationsRef.current.contains(event.target as Node)) {
				setShowNotifications(false);
			}
		}

		document.addEventListener('mousedown', handleOutsideClick);
		return () => {
			document.removeEventListener('mousedown', handleOutsideClick);
		};
	}, []);

	return (
		<aside className="admin-sidebar">
			<div className="admin-sidebar-brand-wrap">
				<div className="admin-sidebar-brand">GestorDoc CO</div>
				<div className="admin-notifications" ref={notificationsRef}>
					<button
						type="button"
						className="admin-bell-button"
						onClick={() => setShowNotifications((current) => !current)}
						aria-label="Notificaciones pendientes"
						aria-expanded={showNotifications}
					>
						<span className="admin-bell-icon" aria-hidden="true">
							🔔
						</span>
						<span className="admin-bell-count">{pendingNotifications.length}</span>
					</button>

					{showNotifications ? (
						<div className="admin-notifications-panel card-surface" role="status" aria-live="polite">
							<h4>Notificaciones nuevas</h4>
							{pendingNotifications.length === 0 ? (
								<p>No tienes notificaciones nuevas.</p>
							) : (
								<ul>
									{pendingNotifications.map((notification) => (
										<li key={notification.id}>{notification.title}</li>
									))}
								</ul>
							)}
						</div>
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
