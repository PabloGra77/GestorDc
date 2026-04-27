import { ReactNode, useState } from 'react';
import { Header } from './Header';
import { RequestsChatDock } from './RequestsChatDock';
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
	const [isChatOpen, setIsChatOpen] = useState(true);

	return (
		<div className="admin-shell">
			<Sidebar
				esAdmin={esAdmin}
				activeSection={activeSection}
				onSelectSection={onSelectSection}
				currentUser={nombre}
			/>

			<div className={`admin-workspace ${isChatOpen ? 'with-chat' : 'chat-collapsed'}`}>
				<RequestsChatDock
					isOpen={isChatOpen}
					onToggle={() => setIsChatOpen((current) => !current)}
					currentUser={nombre}
				/>

				<div className="admin-main">
					<Header nombre={nombre} rol={rol} onLogout={onLogout} />
					<main className="admin-content">{children}</main>
				</div>
			</div>
		</div>
	);
}
