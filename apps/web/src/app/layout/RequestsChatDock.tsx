import { useEffect, useMemo, useState } from 'react';
import {
	appendChatMessages,
	formatRelativeNow,
	getChatUpdateEventName,
	loadChatMessages,
	type ChatRequestMessage,
} from './requestsChatStore';

type RequestStatus = 'Pendiente' | 'Enviada';

type ChatTab = 'Bandeja' | 'Enviadas';

interface RequestsChatDockProps {
	isOpen: boolean;
	onToggle: () => void;
	currentUser: string;
}

const INITIAL_MESSAGES: ChatRequestMessage[] = [];

export function RequestsChatDock({ isOpen, onToggle, currentUser }: RequestsChatDockProps) {
	const [activeTab, setActiveTab] = useState<ChatTab>('Bandeja');
	const [messages, setMessages] = useState<ChatRequestMessage[]>([...INITIAL_MESSAGES]);

	useEffect(() => {
		const stored = loadChatMessages();
		if (stored.length > 0) {
			setMessages((current) => {
				const known = new Set(current.map((item) => item.id));
				const incoming = stored.filter((item) => !known.has(item.id));
				return incoming.length > 0 ? [...incoming, ...current] : current;
			});
		}

		const syncFromStorage = () => {
			const latest = loadChatMessages();
			setMessages((current) => {
				const currentIds = new Set(current.map((item) => item.id));
				const latestIds = new Set(latest.map((item) => item.id));

				if (currentIds.size === latestIds.size) {
					let allMatch = true;
					for (const id of currentIds) {
						if (!latestIds.has(id)) {
							allMatch = false;
							break;
						}
					}
					if (allMatch) {
						return current;
					}
				}

				const initialWithoutDup = INITIAL_MESSAGES.filter(
					(initial) => !latest.some((item) => item.id === initial.id),
				);
				return [...latest, ...initialWithoutDup];
			});
		};

		window.addEventListener('storage', syncFromStorage);
		window.addEventListener(getChatUpdateEventName(), syncFromStorage);

		return () => {
			window.removeEventListener('storage', syncFromStorage);
			window.removeEventListener(getChatUpdateEventName(), syncFromStorage);
		};
	}, []);

	const visibleMessages = useMemo(
		() =>
			messages.filter((message) => {
				const author = message.author.toLowerCase();
				const recipient = message.recipient.toLowerCase();
				const viewer = currentUser.toLowerCase();
				return author === viewer || recipient === viewer;
			}),
		[messages, currentUser],
	);

	function getStatusForViewer(message: ChatRequestMessage): RequestStatus {
		return message.author.toLowerCase() === currentUser.toLowerCase() ? 'Enviada' : 'Pendiente';
	}

	const pendingCount = useMemo(
		() => visibleMessages.filter((message) => getStatusForViewer(message) === 'Pendiente').length,
		[visibleMessages, currentUser],
	);

	const filteredMessages = useMemo(() => {
		if (activeTab === 'Enviadas') {
			return visibleMessages.filter((message) => getStatusForViewer(message) === 'Enviada');
		}
		if (activeTab === 'Bandeja') {
			return visibleMessages.filter((message) => getStatusForViewer(message) === 'Pendiente');
		}
		return visibleMessages;
	}, [activeTab, visibleMessages, currentUser]);

	return (
		<aside className={`requests-chat-dock${isOpen ? ' open' : ' closed'}`} aria-label="Solicitudes y chat">
			<button
				type="button"
				className="requests-chat-toggle"
				onClick={onToggle}
				aria-expanded={isOpen}
				aria-label={isOpen ? 'Ocultar chat de solicitudes' : 'Abrir chat de solicitudes'}
			>
				<span className="requests-chat-toggle-icon" aria-hidden="true">
					💬
				</span>
				{isOpen ? 'Ocultar chat' : 'Abrir chat'}
				<span className="requests-chat-badge">{pendingCount}</span>
			</button>

			{isOpen ? (
				<div className="requests-chat-panel card-surface">
					<header className="requests-chat-header">
						<h3>Solicitudes</h3>
						<p>Canal interno para gestionar requerimientos.</p>
					</header>

					<nav className="requests-chat-tabs" aria-label="Tipos de solicitudes">
						{(['Bandeja', 'Enviadas'] as ChatTab[]).map((tab) => (
							<button
								key={tab}
								type="button"
								className={`requests-chat-tab${activeTab === tab ? ' active' : ''}`}
								onClick={() => setActiveTab(tab)}
							>
								{tab}
							</button>
						))}
					</nav>

					<ul className="requests-chat-list">
						{filteredMessages.length === 0 ? (
							<li className="requests-chat-empty">No hay solicitudes en esta vista.</li>
						) : (
							filteredMessages.map((message) => (
								<li key={message.id}>
									<div>
										<strong>{message.title}</strong>
										<span>
											{message.author} para {message.recipient} · {message.createdAt}
										</span>
									</div>
									<span className={`status-pill ${getStatusForViewer(message) === 'Pendiente' ? 'off' : 'on'}`}>
										{getStatusForViewer(message)}
									</span>
								</li>
							))
						)}
					</ul>
				</div>
			) : null}
		</aside>
	);
}
