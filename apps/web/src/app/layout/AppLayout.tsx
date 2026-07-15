import { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
	nombre: string;
	rol: string;
	esAdmin: boolean;
	activeSection: string;
	onSelectSection: (section: string) => void;
	onLogout: () => void;
	children: ReactNode;
}

export function AppLayout({
	nombre,
	rol,
	esAdmin,
	activeSection,
	onSelectSection,
	onLogout,
	children,
}: AppLayoutProps) {
	return (
		<div className="admin-shell">
			<Sidebar
				esAdmin={esAdmin}
				activeSection={activeSection}
				onSelectSection={onSelectSection}
				currentUser={nombre}
				rol={rol}
				onLogout={onLogout}
			/>

			<div className="admin-workspace chat-collapsed">
				<div className="admin-main">
					<Header
						nombre={nombre}
						rol={rol}
						onLogout={onLogout}
					/>
					<main className="admin-content">{children}</main>
				</div>
			</div>
		</div>
	);
}
