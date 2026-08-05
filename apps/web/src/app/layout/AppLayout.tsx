import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
	nombre: string;
	rol: string;
	esAdmin: boolean;
	mostrarPortalPagos?: boolean;
	activeSection: string;
	onSelectSection: (section: string) => void;
	onNavigateRadicaciones?: (vista: 'nueva' | 'misSolicitudes' | 'bandeja' | 'tablero', solicitudId?: number) => void;
	onLogout: () => void;
	children: ReactNode;
}

export function AppLayout({
	nombre,
	rol,
	esAdmin,
	mostrarPortalPagos,
	activeSection,
	onSelectSection,
	onNavigateRadicaciones,
	onLogout,
	children,
}: AppLayoutProps) {
	return (
		<div className="admin-shell">
			<Sidebar
				esAdmin={esAdmin}
				mostrarPortalPagos={mostrarPortalPagos}
				activeSection={activeSection}
				onSelectSection={onSelectSection}
				onNavigateRadicaciones={onNavigateRadicaciones}
				currentUser={nombre}
				rol={rol}
				onLogout={onLogout}
			/>

			<div className="admin-workspace chat-collapsed">
				<div className="admin-main">
					<main className="admin-content">{children}</main>
				</div>
			</div>
		</div>
	);
}
