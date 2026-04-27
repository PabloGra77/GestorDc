interface HeaderProps {
	nombre: string;
	rol: string;
	onLogout: () => void;
}

export function Header({ nombre, rol, onLogout }: HeaderProps) {
	return (
		<header className="admin-header">
			<div>
				<p className="admin-header-label">Panel de control</p>
				<h1>Bienvenido, {nombre}</h1>
			</div>

			<div className="admin-header-actions">
				<span className="admin-role-pill">Rol: {rol}</span>
				<button type="button" className="secondary-link secondary-button" onClick={onLogout}>
					Cerrar sesión
				</button>
			</div>
		</header>
	);
}
