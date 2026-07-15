import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
	nombre: string;
	rol: string;
	onLogout: () => void;
	mostrarBienvenida?: boolean;
}

export function Header({ nombre, rol, onLogout }: HeaderProps) {
	const [menuAbierto, setMenuAbierto] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const iniciales = nombre
		.split(' ')
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0].toUpperCase())
		.join('');

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuAbierto(false);
			}
		}
		document.addEventListener('mousedown', handleClick);
		return () => document.removeEventListener('mousedown', handleClick);
	}, []);

	return (
		<header className="topbar-minimal">
			<div className="topbar-right">
				{/* Campana de notificaciones */}
				<button type="button" className="topbar-icon-btn topbar-bell" aria-label="Notificaciones" title="Notificaciones">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
						<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
					</svg>
				</button>

				{/* Avatar con menú */}
				<div className="topbar-user-wrap" ref={menuRef}>
					<button
						type="button"
						className="topbar-avatar-btn"
						onClick={() => setMenuAbierto((v) => !v)}
						aria-label={`Cuenta de ${nombre}`}
						aria-expanded={menuAbierto}
					>
						<span className="topbar-avatar-initials">{iniciales}</span>
					</button>

					{menuAbierto && (
						<div className="topbar-user-dropdown">
							<div className="topbar-user-info">
								<strong>{nombre}</strong>
								<span className="topbar-user-rol">{rol}</span>
							</div>
							<div className="topbar-dropdown-divider" />
							<button
								type="button"
								className="topbar-logout-btn"
								onClick={() => { setMenuAbierto(false); onLogout(); }}
							>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
									<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
									<polyline points="16 17 21 12 16 7"/>
									<line x1="21" y1="12" x2="9" y2="12"/>
								</svg>
								Cerrar sesión
							</button>
						</div>
					)}
				</div>
			</div>
		</header>
	);
}
