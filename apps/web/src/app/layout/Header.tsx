import { usePayopsLogo } from '../../hooks/usePayopsLogo';

interface HeaderProps {
	nombre: string;
	rol: string;
	onLogout: () => void;
	mostrarBienvenida?: boolean;
}

export function Header({ nombre, rol, onLogout, mostrarBienvenida = true }: HeaderProps) {
	const logoSrc = usePayopsLogo();
	if (!mostrarBienvenida) {
		return (
			<header className="admin-header admin-header-compact">
				<div className="admin-header-actions">
					<span className="admin-role-pill">Rol: {rol}</span>
					<button type="button" className="secondary-link secondary-button" onClick={onLogout}>
						Cerrar sesión
					</button>
				</div>
			</header>
		);
	}
	return (
		<header className="admin-header">
			<div className="admin-header-brand">
				<img
					src={logoSrc}
					alt="Goleman IPS"
					className="admin-header-logo"
					onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
				/>
				<div>
					<p className="admin-header-label">Panel de control</p>
					<h1>Bienvenido, {nombre}</h1>
				</div>
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
